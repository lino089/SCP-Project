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
use OpenSpout\Reader\XLSX\Options as OpenSpoutOptions;
use OpenSpout\Reader\XLSX\Reader as OpenSpoutReader;
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
        if (!file_exists($templatePath)) {
            $templatePath = base_path('MD/xlsx/Absen 2026-2027.xlsx');
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
        $filePath = $uploadedFile->getRealPath();

        $extractedRows = [];

        try {
            $options = new OpenSpoutOptions();
            $reader = new OpenSpoutReader($options);
            $reader->open($filePath);

            foreach ($reader->getSheetIterator() as $sheet) {
                $sheetName = $sheet->getName();
                $currentClass = null;
                $inStudentTable = false;

                foreach ($sheet->getRowIterator() as $rowIndex => $row) {
                    $cells = $row->toArray();
                    $c0 = isset($cells[0]) ? trim((string)$cells[0]) : '';
                    $c1 = isset($cells[1]) ? trim((string)$cells[1]) : '';
                    $c2 = isset($cells[2]) ? trim((string)$cells[2]) : '';
                    $c3 = isset($cells[3]) ? trim((string)$cells[3]) : '';

                    // 1. Deteksi baris kelas rombel (contoh: "KELAS : X RPL 1")
                    if (stripos($c0, 'KELAS :') !== false || stripos($c0, 'KELAS:') !== false) {
                        $currentClass = trim(preg_replace('/^KELAS\s*:\s*/i', '', $c0));
                        $inStudentTable = false;
                        continue;
                    }

                    // 2. Deteksi header kolom tabel siswa ("Urt" dan "NIS")
                    if (strcasecmp($c0, 'Urt') === 0 && strcasecmp($c1, 'NIS') === 0) {
                        $inStudentTable = true;
                        continue;
                    }

                    // 3. Baris data siswa
                    if ($inStudentTable && is_numeric($c0) && is_numeric($c1)) {
                        $extractedRows[] = [
                            'sheet' => $sheetName,
                            'file_row' => $rowIndex + 1,
                            'class_name' => $currentClass,
                            'student_number' => (int) $c0,
                            'nis' => (string) $c1,
                            'name' => $c2,
                            'gender' => strtoupper($c3),
                            'nisn' => null,
                        ];
                        continue;
                    }

                    // 4. Deteksi akhir tabel (footer tanda tangan guru atau judul daftar hadir berikutnya)
                    if (stripos($cells[11] ?? '', 'Guru Mata Pelajaran') !== false || stripos($c0, 'DAFTAR HADIR') !== false) {
                        $inStudentTable = false;
                    }
                }
            }
            $reader->close();
        } catch (\Throwable $e) {
            // Lanjut ke fallback jika parsing OpenSpout gagal
        }

        // Fallback: Jika tidak terdeteksi struktur buku absen, coba deteksi tabel flat (format kolom nis, name, dll.)
        if (empty($extractedRows)) {
            try {
                $flatReader = SimpleExcelReader::create($filePath, 'xlsx')->trimHeaderRow()->headersToSnakeCase();
                $headers = $flatReader->getHeaders();

                if (!empty($headers)) {
                    $requiredFlatHeaders = ['nis', 'name', 'class_name', 'gender'];
                    $hasAnyKeyHeader = in_array('nis', $headers, true) || in_array('name', $headers, true);
                    if ($hasAnyKeyHeader) {
                        $missingHeaders = array_diff($requiredFlatHeaders, $headers);
                        if (!empty($missingHeaders)) {
                            return response()->json([
                                'success' => false,
                                'message' => 'Format berkas tidak valid. Kolom header ' . implode(', ', $missingHeaders) . ' wajib tersedia.',
                                'errors' => null,
                            ], 422);
                        }

                        $flatRows = $flatReader->getRows();
                        if ($flatRows->isEmpty()) {
                            return response()->json([
                                'success' => false,
                                'message' => 'Berkas Excel tidak memuat data siswa.',
                                'errors' => null,
                            ], 422);
                        }

                        $flatRowIndex = 1;
                        $classSequence = [];

                        foreach ($flatRows as $row) {
                            $flatRowIndex++;
                            $cName = isset($row['class_name']) ? trim((string) $row['class_name']) : '';
                            $num = null;
                            if (isset($row['student_number']) && is_numeric($row['student_number'])) {
                                $num = (int) $row['student_number'];
                            } elseif (isset($row['absen']) && is_numeric($row['absen'])) {
                                $num = (int) $row['absen'];
                            } elseif (isset($row['urt']) && is_numeric($row['urt'])) {
                                $num = (int) $row['urt'];
                            } else {
                                $classSequence[$cName] = ($classSequence[$cName] ?? 0) + 1;
                                $num = $classSequence[$cName];
                            }

                            $extractedRows[] = [
                                'sheet' => 'Sheet1',
                                'file_row' => $flatRowIndex,
                                'class_name' => $cName,
                                'student_number' => $num,
                                'nis' => isset($row['nis']) ? trim((string) $row['nis']) : '',
                                'name' => isset($row['name']) ? trim((string) $row['name']) : '',
                                'gender' => isset($row['gender']) ? strtoupper(trim((string) $row['gender'])) : '',
                                'nisn' => isset($row['nisn']) ? trim((string) $row['nisn']) : null,
                            ];
                        }
                    }
                }
            } catch (\Throwable $e) {
                // Abaikan error fallback
            }
        }

        if (empty($extractedRows)) {
            return response()->json([
                'success' => false,
                'message' => 'Berkas Excel tidak memuat data siswa.',
                'errors' => null,
            ], 422);
        }

        $errors = [];
        $seenNis = [];
        $validRows = [];
        $skippedRows = [];

        // Preload active NIS to prevent N+1 queries on large datasets
        $existingNis = User::whereNull('deleted_at')->pluck('nis_nip')->flip()->toArray();

        foreach ($extractedRows as $item) {
            $rowDesc = "Sheet {$item['sheet']}, Baris {$item['file_row']}";
            $rawNis = $item['nis'];
            $rawName = $item['name'];
            $rawClassName = $item['class_name'];
            $rawGender = $item['gender'];
            $studentNumber = $item['student_number'];

            // 1. Validasi NIS
            if ($rawNis === '') {
                $errors[] = [
                    'row' => $item['file_row'],
                    'attribute' => 'nis',
                    'message' => "Kolom NIS pada {$rowDesc} wajib diisi.",
                ];
            } elseif (isset($existingNis[$rawNis]) || isset($existingNis['P-' . $rawNis])) {
                // 2. Skip jika siswa atau akun wali murid sudah terdaftar di sistem
                $skippedRows[] = [
                    'row' => $item['file_row'],
                    'nis' => $rawNis,
                    'name' => $rawName,
                    'reason' => "NIS '{$rawNis}' sudah terdaftar di sistem.",
                ];
                continue;
            } elseif (isset($seenNis[$rawNis])) {
                // 3. Cek duplikasi NIS siswa baru di dalam berkas ini
                $errors[] = [
                    'row' => $item['file_row'],
                    'attribute' => 'nis',
                    'message' => "NIS '{$rawNis}' duplikat di dalam berkas ini (pertama kali muncul di {$seenNis[$rawNis]}).",
                ];
            } else {
                $seenNis[$rawNis] = $rowDesc;
            }

            // 4. Validasi Kelas
            if (empty($rawClassName)) {
                $errors[] = [
                    'row' => $item['file_row'],
                    'attribute' => 'class_name',
                    'message' => "Kelas siswa '{$rawName}' ({$rawNis}) pada {$rowDesc} tidak teridentifikasi.",
                ];
            }

            // 5. Validasi Nama Siswa
            if ($rawName === '') {
                $errors[] = [
                    'row' => $item['file_row'],
                    'attribute' => 'name',
                    'message' => "Kolom nama siswa pada {$rowDesc} wajib diisi.",
                ];
            } elseif (mb_strlen($rawName) > 100) {
                $errors[] = [
                    'row' => $item['file_row'],
                    'attribute' => 'name',
                    'message' => "Nama siswa pada {$rowDesc} tidak boleh melebihi 100 karakter.",
                ];
            }

            // 6. Validasi Jenis Kelamin
            if ($rawGender === '') {
                $errors[] = [
                    'row' => $item['file_row'],
                    'attribute' => 'gender',
                    'message' => "Kolom jenis kelamin pada {$rowDesc} wajib diisi.",
                ];
            } elseif (!in_array($rawGender, ['L', 'P'], true)) {
                $errors[] = [
                    'row' => $item['file_row'],
                    'attribute' => 'gender',
                    'message' => "Jenis kelamin pada {$rowDesc} harus bernilai L atau P.",
                ];
            }

            // 7. Validasi Nomor Absen
            if ($studentNumber !== null && $studentNumber <= 0) {
                $errors[] = [
                    'row' => $item['file_row'],
                    'attribute' => 'student_number',
                    'message' => "Nomor absen pada {$rowDesc} harus berupa angka positif.",
                ];
            }

            if ($rawNis !== '') {
                $validRows[] = [
                    'nis' => $rawNis,
                    'name' => $rawName,
                    'class_name' => trim(preg_replace('/\s+/', ' ', (string) $rawClassName)),
                    'gender' => $rawGender,
                    'student_number' => $studentNumber,
                    'nisn' => $item['nisn'],
                ];
            }
        }

        if (!empty($errors)) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
                'errors' => $errors,
            ], 422);
        }

        // Jika seluruh baris sudah terdaftar di sistem dan tidak ada data baru yang perlu diimpor
        if (empty($validRows) && !empty($skippedRows)) {
            return response()->json([
                'success' => true,
                'message' => 'Seluruh data siswa dalam berkas sudah terdaftar di sistem (' . count($skippedRows) . ' siswa dilewati). Tidak ada data baru yang perlu ditambahkan.',
                'data' => [
                    'classes_created' => 0,
                    'classes_existing' => 0,
                    'students_imported' => 0,
                    'parents_imported' => 0,
                    'students_skipped' => count($skippedRows),
                ],
            ], 200);
        }

        $skippedCount = count($skippedRows);
        $summary = DB::transaction(function () use ($validRows, $skippedCount) {
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
                    $trashedClass = Classes::onlyTrashed()->where('name', $className)->first();
                    if ($trashedClass) {
                        $trashedClass->restore();
                        $trashedClass->update(['next_class_id' => null]);
                        $classMap[$className] = $trashedClass->id;
                        $classesExisting++;
                    } else {
                        // Deteksi level kelas (XII -> 12, XI -> 11, X -> 10)
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
            }

            $studentsImported = 0;
            $parentsImported = 0;

            foreach ($validRows as $row) {
                $classId = $classMap[$row['class_name']];
                $studentNumber = $row['student_number'] ?? null;
                // Password awal: NIS + Nomor Absen (Contoh: NIS 18260, Absen 1 -> 182601)
                $passwordInitial = $studentNumber !== null ? (string) $row['nis'] . (string) $studentNumber : (string) $row['nis'];
                $passwordHash = Hash::make($passwordInitial, ['rounds' => 4]);

                $student = User::create([
                    'name' => $row['name'],
                    'role' => 'student',
                    'nis_nip' => $row['nis'],
                    'student_number' => $studentNumber,
                    'password' => $passwordHash,
                    'class_id' => $classId,
                    'gender' => $row['gender'],
                    'nisn' => $row['nisn'] ?? null,
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
                'students_skipped' => $skippedCount,
            ];
        });

        $message = $summary['students_skipped'] > 0
            ? "Impor data siswa selesai. {$summary['students_imported']} siswa baru ditambahkan, {$summary['students_skipped']} siswa lama dilewati."
            : 'Data siswa dan kelas berhasil diimpor.';

        return response()->json([
            'success' => true,
            'message' => $message,
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
            'level' => 'nullable|string|max:10',
            'status' => 'nullable|in:active,alumni,all',
            'all' => 'nullable|in:true,false,1,0',
        ]);

        $perPage = $request->integer('per_page', 15);
        $search = $request->input('search');
        $classId = $request->input('class_id');
        $level = $request->input('level');
        $status = $request->input('status', 'active');

        $query = User::where('role', 'student')->with('schoolClass:id,name,level');

        // Scoping status siswa: default hanya menampilkan siswa aktif (bukan alumni)
        if ($status === 'active') {
            $query->whereNull('graduation_date')->whereNotNull('class_id');
        } elseif ($status === 'alumni') {
            $query->whereNotNull('graduation_date');
        }

        if ($classId) {
            $query->where('class_id', $classId);
        }

        if ($level && $level !== 'ALL') {
            $query->whereHas('schoolClass', function ($q) use ($level) {
                $q->where('level', (string) $level);
            });
        }

        if ($search) {
            $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->where(function ($q) use ($search, $like) {
                $q->where('name', $like, '%' . $search . '%')
                    ->orWhere('nis_nip', $like, '%' . $search . '%')
                    ->orWhereHas('schoolClass', function ($cq) use ($search, $like) {
                        $cq->where('name', $like, '%' . $search . '%');
                    });
            });
        }

        $isPgsql = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql';
        $orderRaw = $isPgsql ? 'student_number ASC NULLS LAST' : 'student_number IS NULL, student_number ASC';

        if ($request->boolean('all')) {
            $students = $query->orderByRaw($orderRaw)->orderBy('name')->get();

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

        $students = $query->orderByRaw($orderRaw)->orderBy('name')->paginate($perPage);

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
     * Menampilkan daftar alumni (siswa yang telah lulus) beserta histori kelas terakhirnya.
     * GET /api/alumni
     */
    public function alumni(Request $request): JsonResponse
    {
        $request->validate([
            'per_page' => 'nullable|integer|min:1|max:1000',
            'search' => 'nullable|string|max:100',
            'graduation_year' => 'nullable|string|max:10',
            'major' => 'nullable|string|max:20',
            'all' => 'nullable|in:true,false,1,0',
        ]);

        $perPage = $request->integer('per_page', 20);
        $search = $request->input('search');
        $gradYear = $request->input('graduation_year');
        $major = $request->input('major');

        // Siswa berstatus alumni: graduation_date not null ATAU ada record graduated di student_class_histories
        $query = User::where('role', 'student')
            ->where(function ($q) {
                $q->whereNotNull('graduation_date')
                    ->orWhereHas('classHistories', fn($hq) => $hq->where('action_type', 'graduated'));
            })
            ->with([
                'classHistories' => fn($q) => $q->with(['fromClass:id,name,level', 'toClass:id,name,level'])->orderByDesc('processed_at')->orderByDesc('id'),
            ]);

        if ($gradYear && $gradYear !== 'ALL') {
            $query->where(function ($q) use ($gradYear) {
                $q->whereYear('graduation_date', (int) $gradYear)
                    ->orWhereHas('classHistories', function ($hq) use ($gradYear) {
                        $hq->where('action_type', 'graduated')
                            ->where('academic_year', 'like', "%{$gradYear}%");
                    });
            });
        }

        if ($major && $major !== 'ALL') {
            $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->whereHas('classHistories', function ($hq) use ($major, $like) {
                $hq->whereHas('fromClass', function ($cq) use ($major, $like) {
                    $cq->where('name', $like, '%' . $major . '%');
                });
            });
        }

        if ($search) {
            $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->where(function ($q) use ($search, $like) {
                $q->where('name', $like, '%' . $search . '%')
                    ->orWhere('nis_nip', $like, '%' . $search . '%')
                    ->orWhere('nisn', $like, '%' . $search . '%');
            });
        }

        $orderRaw = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql'
            ? 'graduation_date DESC NULLS LAST, name ASC'
            : 'graduation_date IS NULL, graduation_date DESC, name ASC';

        // Hitung tahun-tahun kelulusan yang ada untuk filter dropdown
        $availableYears = User::where('role', 'student')
            ->whereNotNull('graduation_date')
            ->selectRaw('DISTINCT EXTRACT(YEAR FROM graduation_date)::integer as year')
            ->orderByDesc('year')
            ->pluck('year')
            ->filter()
            ->values();

        if ($request->boolean('all')) {
            $alumni = $query->orderByRaw($orderRaw)->get();
            $data = $this->transformAlumniCollection($alumni, $major);

            return response()->json([
                'success' => true,
                'message' => 'Data alumni berhasil diambil.',
                'data' => $data,
                'meta' => [
                    'total' => count($data),
                    'available_years' => $availableYears,
                ],
            ], 200);
        }

        $paginated = $query->orderByRaw($orderRaw)->paginate($perPage);
        $transformedItems = $this->transformAlumniCollection(collect($paginated->items()), $major);

        return response()->json([
            'success' => true,
            'message' => 'Data alumni berhasil diambil.',
            'data' => $transformedItems,
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'last_page' => $paginated->lastPage(),
                'available_years' => $availableYears,
            ],
        ], 200);
    }

    /**
     * Helper untuk memformat koleksi alumni beserta riwayat kelas terakhirnya.
     */
    protected function transformAlumniCollection($collection, ?string $majorFilter = null): array
    {
        $result = [];

        foreach ($collection as $student) {
            $histories = $student->classHistories ?? collect();
            $graduatedHistory = $histories->firstWhere('action_type', 'graduated');
            $lastClass = $graduatedHistory?->fromClass ?: $histories->first()?->fromClass;
            $lastClassName = $lastClass?->name ?? '-';

            // Filter jurusan jika diberikan
            if ($majorFilter && $majorFilter !== 'ALL') {
                if (!str_contains(strtoupper($lastClassName), strtoupper($majorFilter))) {
                    continue;
                }
            }

            $gradYear = $student->graduation_date
                ? (int) date('Y', strtotime($student->graduation_date))
                : ($graduatedHistory ? (int) substr($graduatedHistory->academic_year, 0, 4) : null);

            $result[] = [
                'id' => $student->id,
                'name' => $student->name,
                'nis' => $student->nis_nip,
                'nisn' => $student->nisn,
                'gender' => $student->gender,
                'email' => $student->email,
                'phone_number' => $student->phone_number,
                'graduation_date' => $student->graduation_date ? date('Y-m-d', strtotime($student->graduation_date)) : null,
                'graduation_year' => $gradYear,
                'last_class_name' => $lastClassName,
                'last_class_level' => $lastClass?->level ?? '12',
                'class_histories' => $histories->map(fn($h) => [
                    'id' => $h->id,
                    'academic_year' => $h->academic_year,
                    'action_type' => $h->action_type,
                    'from_class' => $h->fromClass?->name,
                    'to_class' => $h->toClass?->name,
                    'processed_at' => $h->processed_at?->format('Y-m-d H:i:s'),
                ]),
            ];
        }

        return $result;
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
            'student_number' => 'nullable|integer|min:1|max:100',
            'nisn' => [
                'nullable',
                'string',
                'max:20',
                Rule::unique('users', 'nisn')->whereNull('deleted_at'),
            ],
        ], [
            'gender.in' => 'Jenis kelamin harus bernilai L atau P.',
            'student_number.integer' => 'Nomor absen harus berupa angka.',
            'nisn.unique' => 'NISN sudah terdaftar.',
            'nisn.max' => 'NISN tidak boleh melebihi 20 karakter.',
        ]);

        $result = DB::transaction(function () use ($request) {
            $studentNumber = $request->filled('student_number') ? (int) $request->student_number : null;
            $initialPassword = $studentNumber !== null
                ? trim($request->nis) . $studentNumber
                : ($request->filled('nisn') ? trim($request->nisn) : trim($request->nis));

            $student = User::create([
                'name' => $request->name,
                'role' => 'student',
                'nis_nip' => $request->nis,
                'student_number' => $studentNumber,
                'password' => Hash::make($initialPassword),
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
                'password' => Hash::make($initialPassword),
                'must_change_password' => true,
            ]);

            return [
                'student' => $student->load('schoolClass'),
                'parent' => $parent,
                'generate_password' => $initialPassword,
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
            'student_number' => 'nullable|integer|min:1|max:100',
            'nisn' => [
                'nullable',
                'string',
                'max:20',
                Rule::unique('users', 'nisn')->ignore($student->id)->whereNull('deleted_at'),
            ],
        ], [
            'gender.in' => 'Jenis kelamin harus bernilai L atau P.',
            'student_number.integer' => 'Nomor absen harus berupa angka.',
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

            if ($request->has('student_number')) {
                $updateData['student_number'] = $request->filled('student_number') ? (int) $request->student_number : null;
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
            $student->tokens()->delete();
            $student->update(['is_active' => false]);
            User::where('linked_student_id', $student->id)->update(['is_active' => false]);
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
     * Mendukung toggle otomatis atau nilai eksplisit is_held_back.
     */
    public function holdBack(Request $request, $id): JsonResponse
    {
        $student = User::where('role', 'student')->findOrFail($id);

        $newStatus = $request->has('is_held_back')
            ? filter_var($request->input('is_held_back'), FILTER_VALIDATE_BOOLEAN)
            : !$student->is_held_back;

        $student->update(['is_held_back' => $newStatus]);

        return response()->json([
            'success' => true,
            'message' => $newStatus ? 'Siswa berhasil ditandai tinggal kelas.' : 'Tanda tinggal kelas siswa berhasil dibatalkan.',
            'data' => $student,
        ], 200);
    }
}
