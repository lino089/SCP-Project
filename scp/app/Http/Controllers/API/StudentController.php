<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classes;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Spatie\SimpleExcel\SimpleExcelReader;
use Spatie\SimpleExcel\SimpleExcelWriter;
use Symfony\Component\HttpFoundation\Response;

class StudentController extends Controller
{
    /**
     * Mengunduh berkas template Excel untuk impor siswa.
     */
    public function downloadTemplate(): Response
    {
        $templatePath = storage_path('app/templates/template_import_siswa.xlsx');
        if (!file_exists($templatePath)) {
            $templatePath = storage_path('app/templates/siswa_import_template.xlsx');
        }

        $headers = [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ];

        if (file_exists($templatePath)) {
            return response()->download($templatePath, 'siswa_import_template.xlsx', $headers);
        }

        return response()->streamDownload(function () {
            $writer = SimpleExcelWriter::create('php://output', 'xlsx');

            $writer->addRows([
                [
                    'nis' => '12045',
                    'name' => 'Ahmad Fauzan Pratama',
                    'class_name' => 'X RPL 1',
                    'gender' => 'L',
                    'nisn' => '0081234567',
                ],
                [
                    'nis' => '12046',
                    'name' => 'Anisa Rahmawati',
                    'class_name' => 'X RPL 1',
                    'gender' => 'P',
                    'nisn' => '0089876543',
                ],
                [
                    'nis' => '11580',
                    'name' => 'Budi Santoso',
                    'class_name' => 'XI TKJ 2',
                    'gender' => 'L',
                    'nisn' => '0071122334',
                ],
            ]);

            $writer->close();
        }, 'siswa_import_template.xlsx', $headers);
    }

    /**
     * Mengimpor data siswa dan auto-create kelas dari berkas Excel (.xlsx).
     */
    public function import(Request $request): JsonResponse
    {
        set_time_limit(300);

        $request->validate([
            'file' => [
                'required',
                'file',
                'mimes:xlsx',
                'max:5120',
            ],
        ], [
            'file.required' => 'Berkas Excel siswa wajib diunggah.',
            'file.mimes' => 'Berkas harus berupa spreadsheet dengan ekstensi .xlsx.',
            'file.max' => 'Ukuran berkas tidak boleh melebihi 5 MB.',
        ]);

        $uploadedFile = $request->file('file');
        $reader = SimpleExcelReader::create($uploadedFile->getRealPath(), 'xlsx')->trimHeaderRow()->headersToSnakeCase();
        $headers = $reader->getHeaders();

        if (empty($headers)) {
            return response()->json([
                'success' => false,
                'message' => 'Berkas Excel tidak memuat data siswa atau header kosong.',
                'errors' => null,
            ], 422);
        }

        $requiredHeaders = ['nis', 'name', 'class_name', 'gender'];
        $missingHeaders = array_diff($requiredHeaders, $headers);

        if (!empty($missingHeaders)) {
            return response()->json([
                'success' => false,
                'message' => 'Format berkas tidak valid. Kolom header ' . implode(', ', $missingHeaders) . ' wajib tersedia.',
                'errors' => null,
            ], 422);
        }

        $rows = $reader->getRows();
        if ($rows->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Berkas Excel tidak memuat data siswa.',
                'errors' => null,
            ], 422);
        }

        $rowNumber = 1;
        $errors = [];
        $seenNis = [];
        $seenNisns = [];
        $validRows = [];

        // Preload active NIS and NISNs to prevent N+1 queries on large datasets
        $existingNis = User::whereNull('deleted_at')->pluck('nis_nip')->flip()->toArray();
        $existingNisns = User::whereNotNull('nisn')->whereNull('deleted_at')->pluck('nisn')->flip()->toArray();

        foreach ($rows as $row) {
            $rowNumber++;

            $rawNis = isset($row['nis']) ? trim((string) $row['nis']) : '';
            $rawName = isset($row['name']) ? trim((string) $row['name']) : '';
            $rawClassName = isset($row['class_name']) ? trim((string) $row['class_name']) : '';
            $rawGender = isset($row['gender']) ? strtoupper(trim((string) $row['gender'])) : '';
            $rawNisn = isset($row['nisn']) ? trim((string) $row['nisn']) : '';

            // 1. Validasi NIS
            if ($rawNis === '') {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'nis',
                    'message' => 'Kolom NIS wajib diisi.',
                ];
            } elseif (isset($seenNis[$rawNis])) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'nis',
                    'message' => "NIS '{$rawNis}' duplikat di dalam berkas ini (pertama kali muncul di baris {$seenNis[$rawNis]}).",
                ];
            } elseif (isset($existingNis[$rawNis])) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'nis',
                    'message' => "NIS '{$rawNis}' sudah terdaftar di sistem.",
                ];
            } elseif (isset($existingNis['P-' . $rawNis])) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'nis',
                    'message' => "Akun orang tua untuk NIS '{$rawNis}' sudah terdaftar di sistem.",
                ];
            } else {
                $seenNis[$rawNis] = $rowNumber;
            }

            // 2. Validasi Nama
            if ($rawName === '') {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'name',
                    'message' => 'Kolom nama siswa wajib diisi.',
                ];
            } elseif (mb_strlen($rawName) > 100) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'name',
                    'message' => 'Nama siswa tidak boleh melebihi 100 karakter.',
                ];
            }

            // 3. Validasi Nama Kelas
            if ($rawClassName === '') {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'class_name',
                    'message' => 'Kolom kelas wajib diisi.',
                ];
            } elseif (mb_strlen($rawClassName) > 50) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'class_name',
                    'message' => 'Nama kelas tidak boleh melebihi 50 karakter.',
                ];
            }

            // 4. Validasi Gender
            if ($rawGender === '') {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'gender',
                    'message' => 'Kolom jenis kelamin wajib diisi.',
                ];
            } elseif (!in_array($rawGender, ['L', 'P'], true)) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'gender',
                    'message' => 'Jenis kelamin harus bernilai L atau P.',
                ];
            }

            // 5. Validasi NISN (Opsional)
            if ($rawNisn !== '') {
                if (mb_strlen($rawNisn) > 20) {
                    $errors[] = [
                        'row' => $rowNumber,
                        'attribute' => 'nisn',
                        'message' => 'NISN tidak boleh melebihi 20 karakter.',
                    ];
                } elseif (isset($seenNisns[$rawNisn])) {
                    $errors[] = [
                        'row' => $rowNumber,
                        'attribute' => 'nisn',
                        'message' => "NISN '{$rawNisn}' duplikat di dalam berkas ini (pertama kali muncul di baris {$seenNisns[$rawNisn]}).",
                    ];
                } elseif (isset($existingNisns[$rawNisn])) {
                    $errors[] = [
                        'row' => $rowNumber,
                        'attribute' => 'nisn',
                        'message' => "NISN '{$rawNisn}' sudah terdaftar di sistem.",
                    ];
                } else {
                    $seenNisns[$rawNisn] = $rowNumber;
                }
            }

            $validRows[] = [
                'nis' => $rawNis,
                'name' => $rawName,
                'class_name' => trim(preg_replace('/\s+/', ' ', $rawClassName)),
                'gender' => $rawGender,
                'nisn' => $rawNisn !== '' ? $rawNisn : null,
            ];
        }

        if (!empty($errors)) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
                'errors' => $errors,
            ], 422);
        }

        $summary = DB::transaction(function () use ($validRows) {
            $classMap = [];
            $classesCreated = 0;
            $classesExisting = 0;

            // Kumpulkan kelas unik
            $distinctClasses = array_unique(array_column($validRows, 'class_name'));

            foreach ($distinctClasses as $className) {
                $existingClass = Classes::where('name', $className)->whereNull('deleted_at')->first();

                if ($existingClass) {
                    $classMap[$className] = $existingClass->id;
                    $classesExisting++;
                } else {
                    // Deteksi level kelas
                    if (preg_match('/^XII(\s|-|_|$)/i', $className)) {
                        $level = '12';
                    } elseif (preg_match('/^XI(\s|-|_|$)/i', $className)) {
                        $level = '11';
                    } elseif (preg_match('/^X(\s|-|_|$)/i', $className)) {
                        $level = '10';
                    } elseif (preg_match('/^12(\s|-|_|$)/', $className)) {
                        $level = '12';
                    } elseif (preg_match('/^11(\s|-|_|$)/', $className)) {
                        $level = '11';
                    } elseif (preg_match('/^10(\s|-|_|$)/', $className)) {
                        $level = '10';
                    } else {
                        $level = '10'; // Fallback default
                    }

                    $newClass = Classes::create([
                        'name' => $className,
                        'level' => $level,
                        'next_class_id' => null,
                    ]);

                    $classMap[$className] = $newClass->id;
                    $classesCreated++;
                }
            }

            $studentsImported = 0;
            $parentsImported = 0;

            foreach ($validRows as $row) {
                $classId = $classMap[$row['class_name']];
                $passwordHash = Hash::make($row['nis'], ['rounds' => 4]);

                $student = User::create([
                    'name' => $row['name'],
                    'role' => 'student',
                    'nis_nip' => $row['nis'],
                    'password' => $passwordHash,
                    'class_id' => $classId,
                    'gender' => $row['gender'],
                    'nisn' => $row['nisn'],
                    'is_held_back' => false,
                    'must_change_password' => true,
                ]);
                $studentsImported++;

                User::create([
                    'name' => 'Wali Murid ' . $row['name'],
                    'role' => 'parent',
                    'nis_nip' => 'P-' . $row['nis'],
                    'linked_student_id' => $student->id,
                    'password' => $passwordHash,
                    'phone_number' => null,
                    'must_change_password' => true,
                ]);
                $parentsImported++;
            }

            return [
                'classes_created' => $classesCreated,
                'classes_existing' => $classesExisting,
                'students_imported' => $studentsImported,
                'parents_imported' => $parentsImported,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Data siswa dan kelas berhasil diimpor.',
            'data' => $summary,
        ], 201);
    }
    /**
     * Menampilkan daftar siswa (berpaginasi).
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'per_page' => 'nullable|integer|min:1|max:5000',
            'search' => 'nullable|string|max:100',
            'class_id' => 'nullable|integer|exists:classes,id',
            'all' => 'nullable|in:true,false,1,0',
        ]);

        $perPage = $request->integer('per_page', 15);
        $search = $request->input('search');
        $classId = $request->input('class_id');

        $query = User::where('role', 'student')->with('schoolClass');

        if ($classId) {
            $query->where('class_id', $classId);
        }

        if ($search) {
            $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->where(function ($q) use ($search, $like) {
                $q->where('name', $like, '%' . $search . '%')
                    ->orWhere('nis_nip', $like, '%' . $search . '%');
            });
        }

        if ($request->boolean('all')) {
            $students = $query->orderBy('name')->get();

            return response()->json([
                'success' => true,
                'message' => 'Data siswa berhasil diambil.',
                'data' => $students,
                'meta' => [
                    'current_page' => 1,
                    'per_page' => $students->count(),
                    'total' => $students->count(),
                    'last_page' => 1,
                ],
            ], 200);
        }

        $students = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Data siswa berhasil diambil.',
            'data' => $students->items(),
            'meta' => [
                'current_page' => $students->currentPage(),
                'per_page' => $students->perPage(),
                'total' => $students->total(),
                'last_page' => $students->lastPage(),
            ],
        ], 200);
    }

    /**
     * Menambahkan siswa baru beserta akun orang tua otomatis (Auto-provisioning).
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'nis' => [
                'required',
                'string',
                'max:50',
                Rule::unique('users', 'nis_nip')->whereNull('deleted_at'),
            ],
            'class_id' => 'required|integer|exists:classes,id',
            'gender' => 'nullable|string|in:L,P,l,p',
            'nisn' => [
                'nullable',
                'string',
                'max:20',
                Rule::unique('users', 'nisn')->whereNull('deleted_at'),
            ],
        ], [
            'gender.in' => 'Jenis kelamin harus bernilai L atau P.',
            'nisn.unique' => 'NISN sudah terdaftar.',
            'nisn.max' => 'NISN tidak boleh melebihi 20 karakter.',
        ]);

        $result = DB::transaction(function () use ($request) {
            $randomPassword = Str::random(8);

            $student = User::create([
                'name' => $request->name,
                'role' => 'student',
                'nis_nip' => $request->nis,
                'password' => Hash::make($randomPassword),
                'must_change_password' => true,
                'class_id' => $request->class_id,
                'gender' => $request->filled('gender') ? strtoupper(trim($request->gender)) : null,
                'nisn' => $request->filled('nisn') ? trim($request->nisn) : null,
            ]);

            $parent = User::create([
                'name' => 'Wali Murid ' . $request->name,
                'role' => 'parent',
                'nis_nip' => 'P-' . $request->nis,
                'linked_student_id' => $student->id,
                'password' => Hash::make($randomPassword),
                'must_change_password' => true,
            ]);

            return [
                'student' => $student->load('schoolClass'),
                'parent' => $parent,
                'generate_password' => $randomPassword,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Data siswa berhasil ditambahkan.',
            'data' => $result,
        ], 201);
    }

    /**
     * Memperbarui data siswa.
     */
    public function update(Request $request, $id): JsonResponse
    {
        if ($request->filled('password')) {
            if ($error = $this->passwordIsConfirmed($request)) {
                return $error;
            }
        }

        $student = User::where('role', 'student')->findOrFail($id);

        $request->validate([
            'name' => 'required|string|max:100',
            'nis' => [
                'required',
                'string',
                'max:50',
                Rule::unique('users', 'nis_nip')->ignore($student->id)->whereNull('deleted_at'),
            ],
            'class_id' => 'required|integer|exists:classes,id',
            'gender' => 'nullable|string|in:L,P,l,p',
            'nisn' => [
                'nullable',
                'string',
                'max:20',
                Rule::unique('users', 'nisn')->ignore($student->id)->whereNull('deleted_at'),
            ],
        ], [
            'gender.in' => 'Jenis kelamin harus bernilai L atau P.',
            'nisn.unique' => 'NISN sudah terdaftar.',
            'nisn.max' => 'NISN tidak boleh melebihi 20 karakter.',
        ]);

        DB::transaction(function () use ($student, $request) {
            $updateData = [
                'name' => $request->name,
                'nis_nip' => $request->nis,
                'class_id' => $request->class_id,
            ];

            if ($request->has('gender')) {
                $updateData['gender'] = $request->filled('gender') ? strtoupper(trim($request->gender)) : null;
            }

            if ($request->has('nisn')) {
                $updateData['nisn'] = $request->filled('nisn') ? trim($request->nisn) : null;
            }

            $student->update($updateData);

            // Sinkronkan username orang tua jika NIS berubah
            User::where('linked_student_id', $student->id)
                ->where('role', 'parent')
                ->update([
                    'name' => 'Wali Murid ' . $request->name,
                    'nis_nip' => 'P-' . $request->nis,
                ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Data siswa berhasil diperbarui.',
            'data' => $student->fresh(['schoolClass']),
        ], 200);
    }

    /**
     * Menghapus siswa (soft-delete siswa dan akun orang tuanya).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        if ($request->filled('password')) {
            if ($error = $this->passwordIsConfirmed($request)) {
                return $error;
            }
        }

        $student = User::where('role', 'student')->findOrFail($id);

        DB::transaction(function () use ($student) {
            User::where('linked_student_id', $student->id)->delete();
            $student->delete();
        });

        return response()->json([
            'success' => true,
            'message' => 'Data siswa berhasil dihapus.',
            'data' => $student,
        ], 200);
    }

    /**
     * Menandai siswa tidak naik kelas sebelum promosi kelas massal (PRD 5.13).
     */
    public function holdBack(Request $request, $id): JsonResponse
    {
        $student = User::where('role', 'student')->findOrFail($id);

        $student->update(['is_held_back' => true]);

        return response()->json([
            'success' => true,
            'message' => 'Siswa berhasil ditandai tinggal kelas.',
            'data' => $student,
        ], 200);
    }
}
