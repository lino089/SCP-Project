<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classes;
use App\Models\Subject;
use App\Models\TeacherAssignment;
use App\Models\User;
use App\Services\TeacherAssignmentImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Spatie\SimpleExcel\SimpleExcelReader;
use Spatie\SimpleExcel\SimpleExcelWriter;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TeacherController extends Controller
{
    /**
     * Mengunduh berkas template Excel untuk impor guru.
     */
    public function downloadTemplate(): \Symfony\Component\HttpFoundation\Response
    {
        $templatePath = storage_path('app/templates/guru_import_template.xlsx');
        if (!file_exists($templatePath)) {
            $templatePath = storage_path('app/templates/template_import_guru.xlsx');
        }

        $headers = [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ];

        if (file_exists($templatePath)) {
            return response()->download($templatePath, 'guru_import_template.xlsx', $headers);
        }

        return response()->streamDownload(function () {
            $writer = SimpleExcelWriter::create('php://output', 'xlsx');

            $writer->addRows([
                [
                    'no' => 1,
                    'nip' => '198001012010011002',
                    'nama' => 'Budi Santoso, S.Pd.',
                    'mapel' => 'Matematika',
                ],
                [
                    'no' => 2,
                    'nip' => '198502022015022003',
                    'nama' => 'Dewi Lestari, M.Pd.',
                    'mapel' => 'Bahasa Indonesia',
                ],
                [
                    'no' => 3,
                    'nip' => '199003032020031004',
                    'nama' => 'Ahmad Fauzi, S.Kom.',
                    'mapel' => 'Rekayasa Perangkat Lunak',
                ],
            ]);

            $writer->close();
        }, 'guru_import_template.xlsx', $headers);
    }

    /**
     * Mengimpor data guru massal dari berkas Excel (.xlsx).
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
            'file.required' => 'Berkas Excel guru wajib diunggah.',
            'file.mimes' => 'Berkas harus berupa spreadsheet dengan ekstensi .xlsx.',
            'file.max' => 'Ukuran berkas tidak boleh melebihi 5 MB.',
        ]);

        $uploadedFile = $request->file('file');
        $reader = SimpleExcelReader::create($uploadedFile->getRealPath(), 'xlsx')->noHeaderRow();

        $headerFound = false;
        $headerRowNumber = 0;
        $colMap = [];
        $validTeachers = [];
        $errors = [];
        $seenNips = [];
        $rowNumber = 0;

        // Preload active non-deleted NIPs and their roles to prevent N+1 queries & safeguard Waka accounts
        $existingUsers = User::whereNull('deleted_at')->pluck('role', 'nis_nip')->toArray();

        foreach ($reader->getRows() as $row) {
            $rowNumber++;
            $values = array_values($row);
            $normalized = array_map(fn($v) => strtolower(trim((string)$v)), $values);

            if (!$headerFound) {
                $nipIdx = array_search('nip', $normalized);
                $nameIdx = array_search('nama', $normalized);
                if ($nameIdx === false) {
                    $nameIdx = array_search('name', $normalized);
                }

                if ($nipIdx !== false && $nameIdx !== false) {
                    $headerFound = true;
                    $headerRowNumber = $rowNumber;
                    $colMap['nip'] = $nipIdx;
                    $colMap['name'] = $nameIdx;

                    $mapelIdx = array_search('mapel', $normalized);
                    if ($mapelIdx === false) {
                        $mapelIdx = array_search('mata_pelajaran', $normalized);
                    }
                    if ($mapelIdx === false) {
                        $mapelIdx = array_search('subject', $normalized);
                    }
                    $colMap['mapel'] = $mapelIdx !== false ? $mapelIdx : null;

                    $noIdx = array_search('no', $normalized);
                    $colMap['no'] = $noIdx !== false ? $noIdx : null;
                }
                continue;
            }

            // Skip completely empty rows
            if (empty(array_filter($values, fn($v) => trim((string)$v) !== ''))) {
                continue;
            }

            $rawNip = isset($colMap['nip']) && isset($values[$colMap['nip']]) ? trim((string)$values[$colMap['nip']]) : '';
            $rawName = isset($colMap['name']) && isset($values[$colMap['name']]) ? trim((string)$values[$colMap['name']]) : '';
            $rawMapel = isset($colMap['mapel']) && isset($values[$colMap['mapel']]) ? trim((string)$values[$colMap['mapel']]) : '';

            // Validasi NIP
            if ($rawNip === '') {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'nip',
                    'message' => 'Kolom NIP wajib diisi.',
                ];
            } elseif (isset($seenNips[$rawNip])) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'nip',
                    'message' => "NIP '{$rawNip}' duplikat di dalam berkas ini (pertama kali muncul di baris {$seenNips[$rawNip]}).",
                ];
            } elseif (isset($existingUsers[$rawNip])) {
                $existingRole = $existingUsers[$rawNip];
                if ($existingRole !== 'teacher') {
                    $errors[] = [
                        'row' => $rowNumber,
                        'attribute' => 'nip',
                        'message' => "NIP '{$rawNip}' terdaftar sebagai akun Administrator/Waka dan tidak dapat diubah.",
                    ];
                } else {
                    $errors[] = [
                        'row' => $rowNumber,
                        'attribute' => 'nip',
                        'message' => "NIP '{$rawNip}' sudah terdaftar di sistem.",
                    ];
                }
            } else {
                $seenNips[$rawNip] = $rowNumber;
            }

            // Validasi Nama
            if ($rawName === '') {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'name',
                    'message' => 'Kolom nama guru wajib diisi.',
                ];
            } elseif (mb_strlen($rawName) > 100) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'name',
                    'message' => 'Nama guru tidak boleh melebihi 100 karakter.',
                ];
            }

            // Validasi Mata Pelajaran (opsional, maks 100 karakter jika diisi)
            if ($rawMapel !== '' && mb_strlen($rawMapel) > 100) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'mapel',
                    'message' => 'Nama mata pelajaran tidak boleh melebihi 100 karakter.',
                ];
            }

            // Password Awal: Opsi 1 (GuruSCP@{4_digit_terakhir_NIP}!)
            $last4 = substr($rawNip, -4);
            $initialPassword = 'GuruSCP@' . $last4 . '!';

            $validTeachers[] = [
                'subject_name' => $rawMapel,
                'data' => [
                    'name' => $rawName,
                    'role' => 'teacher',
                    'nis_nip' => $rawNip,
                    'password' => Hash::make($initialPassword),
                    'email' => null,
                    'phone_number' => null,
                    'must_change_password' => true,
                ],
            ];
        }

        if (!$headerFound) {
            return response()->json([
                'success' => false,
                'message' => 'Format berkas tidak valid. Kolom header NIP dan NAMA wajib tersedia.',
                'errors' => null,
            ], 422);
        }

        if (empty($validTeachers) && empty($errors)) {
            return response()->json([
                'success' => false,
                'message' => 'Berkas Excel tidak memuat data guru.',
                'errors' => null,
            ], 422);
        }

        if (!empty($errors)) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
                'errors' => $errors,
            ], 422);
        }

        DB::transaction(function () use ($validTeachers) {
            $subjectCache = [];
            foreach ($validTeachers as $item) {
                $subjectName = $item['subject_name'];
                $subjectId = null;

                if ($subjectName !== '') {
                    $key = mb_strtolower($subjectName);
                    if (!isset($subjectCache[$key])) {
                        $found = Subject::whereRaw('LOWER(name) = ?', [$key])->first();
                        if (!$found) {
                            $found = Subject::create(['name' => $subjectName]);
                        }
                        $subjectCache[$key] = $found;
                    }
                    $subjectId = $subjectCache[$key]->id;
                }

                $teacherData = $item['data'];
                $teacherData['subject_id'] = $subjectId;

                User::create($teacherData);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Data guru berhasil diimpor.',
            'data' => [
                'imported_count' => count($validTeachers),
            ],
        ], 201);
    }
    /**
     * Menampilkan daftar guru beserta penugasan tambahannya (berpaginasi).
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string|max:100',
        ]);

        $perPage = $request->integer('per_page', 15);
        $search = $request->input('search');

        $query = User::where('role', 'teacher')->with(['assignments.schoolClass', 'subject']);

        if ($search) {
            $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->where(function ($q) use ($search, $like) {
                $q->where('name', $like, '%' . $search . '%')
                    ->orWhere('nis_nip', $like, '%' . $search . '%');
            });
        }

        $teachers = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Data guru berhasil diambil.',
            'data' => $teachers->items(),
            'meta' => [
                'current_page' => $teachers->currentPage(),
                'per_page' => $teachers->perPage(),
                'total' => $teachers->total(),
                'last_page' => $teachers->lastPage(),
            ],
        ], 200);
    }

    /**
     * Menambahkan akun guru baru (Kredensial Login: NIP, Password Awal: Opsi 1).
     */
    public function store(Request $request): JsonResponse
    {
        if ($request->filled('phone_number') || $request->filled('no_telp') || $request->filled('telp')) {
            $rawPhone = $request->input('phone_number') ?? $request->input('no_telp') ?? $request->input('telp');
            $request->merge(['phone_number' => User::normalizePhoneNumber($rawPhone)]);
        }

        $request->validate([
            'name' => 'required|string|max:100',
            'nip' => [
                'required_without:nis_nip',
                'nullable',
                'string',
                'max:50',
                Rule::unique('users', 'nis_nip')->whereNull('deleted_at'),
            ],
            'nis_nip' => [
                'required_without:nip',
                'nullable',
                'string',
                'max:50',
                Rule::unique('users', 'nis_nip')->whereNull('deleted_at'),
            ],
            'phone_number' => [
                'nullable',
                'string',
                'regex:/^08[0-9]{8,13}$/',
                Rule::unique('users', 'phone_number')->whereNull('deleted_at'),
            ],
            'email' => 'nullable|email|unique:users,email',
            'subject_id' => 'nullable|exists:subjects,id',
        ], [
            'phone_number.regex' => 'Format nomor telepon harus berupa nomor seluler Indonesia yang valid (contoh: 081234567890).',
            'phone_number.unique' => 'Nomor telepon sudah terdaftar di sistem.',
        ]);

        $nip = $request->input('nip') ?? $request->input('nis_nip');
        $initialPassword = 'GuruSCP@' . substr($nip, -4) . '!';

        $teacher = User::create([
            'name' => $request->name,
            'role' => 'teacher',
            'nis_nip' => $nip,
            'email' => $request->input('email'),
            'phone_number' => $request->input('phone_number'),
            'subject_id' => $request->input('subject_id'),
            'password' => Hash::make($initialPassword),
            'must_change_password' => true,
        ]);

        $teacher->load('subject');

        return response()->json([
            'success' => true,
            'message' => 'Akun guru berhasil dibuat.',
            'data' => [
                'teacher' => $teacher,
                'password' => $initialPassword,
            ],
        ], 201);
    }

    /**
     * Memperbarui data profil guru.
     */
    public function update(Request $request, $id): JsonResponse
    {
        if ($request->filled('password')) {
            if ($error = $this->passwordIsConfirmed($request)) {
                return $error;
            }
        }

        $teacher = User::where('role', 'teacher')->findOrFail($id);

        if ($request->filled('phone_number') || $request->filled('no_telp') || $request->filled('telp')) {
            $rawPhone = $request->input('phone_number') ?? $request->input('no_telp') ?? $request->input('telp');
            $request->merge(['phone_number' => User::normalizePhoneNumber($rawPhone)]);
        }

        $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'nip' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('users', 'nis_nip')->ignore($teacher->id)->whereNull('deleted_at'),
            ],
            'nis_nip' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('users', 'nis_nip')->ignore($teacher->id)->whereNull('deleted_at'),
            ],
            'phone_number' => [
                'nullable',
                'string',
                'regex:/^08[0-9]{8,13}$/',
                Rule::unique('users', 'phone_number')->ignore($teacher->id)->whereNull('deleted_at'),
            ],
            'email' => [
                'nullable',
                'email',
                Rule::unique('users', 'email')->ignore($teacher->id),
            ],
            'subject_id' => 'nullable|exists:subjects,id',
        ], [
            'phone_number.regex' => 'Format nomor telepon harus berupa nomor seluler Indonesia yang valid (contoh: 081234567890).',
            'phone_number.unique' => 'Nomor telepon sudah terdaftar di sistem.',
        ]);

        $data = [];
        if ($request->has('name')) {
            $data['name'] = $request->name;
        }
        if ($request->filled('nip') || $request->filled('nis_nip')) {
            $newNip = $request->input('nip') ?? $request->input('nis_nip');
            $data['nis_nip'] = $newNip;
            // Jika guru belum pernah ganti password mandiri (masih password awal),
            // sinkronkan password ke format password awal NIP baru
            if ($teacher->must_change_password) {
                $data['password'] = Hash::make('GuruSCP@' . substr($newNip, -4) . '!');
            }
        }
        if ($request->has('email')) {
            $data['email'] = $request->email;
        }
        if ($request->has('phone_number')) {
            $data['phone_number'] = User::normalizePhoneNumber($request->phone_number);
        }
        if ($request->has('subject_id')) {
            $data['subject_id'] = $request->subject_id;
        }

        $teacher->update($data);
        $teacher->load('subject');

        return response()->json([
            'success' => true,
            'message' => 'Data guru berhasil diperbarui.',
            'data' => $teacher,
        ], 200);
    }

    /**
     * Menghapus akun guru (soft-delete), ditolak 409 jika terikat jadwal aktif.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        if ($request->filled('password')) {
            if ($error = $this->passwordIsConfirmed($request)) {
                return $error;
            }
        }

        $teacher = User::where('role', 'teacher')->findOrFail($id);

        if ($teacher->schedules()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Guru tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
                'errors' => [
                    'teacher' => ['Hapus atau pindahkan jadwal terkait terlebih dahulu, atau gunakan opsi Hapus Paksa.'],
                ],
            ], 409);
        }

        $teacher->tokens()->delete();
        $teacher->update(['is_active' => false]);
        $teacher->delete();

        return response()->json([
            'success' => true,
            'message' => 'Data guru berhasil dihapus.',
            'data' => $teacher,
        ], 200);
    }

    /**
     * Memberikan penugasan tambahan (Kesiswaan / Wali Kelas) kepada guru.
     */
    public function assignRole(Request $request, $id): JsonResponse
    {
        $teacher = User::where('role', 'teacher')->findOrFail($id);

        $request->validate([
            'type' => 'required|in:kesiswaan,wali_kelas',
            'class_id' => 'required_if:type,wali_kelas|exists:classes,id|nullable',
        ]);

        if ($request->type === 'wali_kelas') {
            // 1. Validasi Ketat: Seorang guru hanya boleh mengampu maksimal 1 rombel kelas sebagai Wali Kelas
            $existingTeacherWali = TeacherAssignment::where('type', 'wali_kelas')
                ->where('user_id', $teacher->id)
                ->where('class_id', '!=', $request->class_id)
                ->first();

            if ($existingTeacherWali) {
                return response()->json([
                    'success' => false,
                    'message' => 'Guru ini sudah menjadi wali kelas di kelas lain. Setiap guru hanya diperbolehkan mengampu maksimal 1 rombel kelas sebagai Wali Kelas.',
                ], 422);
            }

            // 2. Validasi Ketat: Satu rombel kelas hanya boleh memiliki tepat 1 wali kelas aktif
            $existingClassWali = TeacherAssignment::where('type', 'wali_kelas')
                ->where('class_id', $request->class_id)
                ->where('user_id', '!=', $teacher->id)
                ->first();

            if ($existingClassWali) {
                return response()->json([
                    'success' => false,
                    'message' => 'Kelas ini sudah memiliki wali kelas aktif.',
                ], 422);
            }
        }

        $assignment = TeacherAssignment::firstOrCreate([
            'user_id' => $teacher->id,
            'type' => $request->type,
            'class_id' => $request->class_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tugas tambahan berhasil diberikan.',
            'data' => $assignment->load(['schoolClass:id,name,level', 'teacher:id,name,nis_nip']),
        ], 201);
    }

    /**
     * Mengambil matriks pemetaan seluruh rombel kelas dengan Wali Kelas dan Petugas BK/Kesiswaan binaan.
     * GET /api/teachers/assignments/matrix
     */
    public function getAssignmentMatrix(Request $request): JsonResponse
    {
        $classes = Classes::query()
            ->orderBy('level')
            ->orderBy('name')
            ->with([
                'teacherAssignments' => function ($q) {
                    $q->with('teacher:id,name,nis_nip,email,phone_number');
                },
            ])
            ->get();

        $matrix = $classes->map(function ($cls) {
            $assignments = $cls->teacherAssignments ?? collect();

            $waliAssignment = $assignments->firstWhere('type', 'wali_kelas');
            $wali = $waliAssignment?->teacher;
            $kesiswaanAssignments = $assignments->where('type', 'kesiswaan')->values();

            return [
                'class_id' => $cls->id,
                'class_name' => $cls->name,
                'level' => $cls->level,
                'wali_kelas' => $wali ? [
                    'assignment_id' => $waliAssignment->id,
                    'id' => $wali->id,
                    'name' => $wali->name,
                    'nis_nip' => $wali->nis_nip,
                    'phone_number' => $wali->phone_number,
                ] : null,
                'kesiswaan' => $kesiswaanAssignments->map(function ($asgn) {
                    $t = $asgn->teacher;
                    if (!$t) return null;
                    return [
                        'assignment_id' => $asgn->id,
                        'id' => $t->id,
                        'name' => $t->name,
                        'nis_nip' => $t->nis_nip,
                        'phone_number' => $t->phone_number,
                    ];
                })->filter()->values()->toArray(),
            ];
        });

        $totalClasses = $classes->count();
        $classesWithWali = $matrix->filter(fn($item) => !empty($item['wali_kelas']))->count();
        $classesWithKesiswaan = $matrix->filter(fn($item) => !empty($item['kesiswaan']))->count();

        return response()->json([
            'success' => true,
            'message' => 'Matriks penugasan guru berhasil diambil.',
            'data' => $matrix,
            'summary' => [
                'total_classes' => $totalClasses,
                'classes_with_wali' => $classesWithWali,
                'classes_with_kesiswaan' => $classesWithKesiswaan,
            ],
        ], 200);
    }

    /**
     * Mencabut penugasan tambahan spesifik milik guru.
     */
    public function revokeRole($id, $assignment_id): JsonResponse
    {
        $teacher = User::where('role', 'teacher')->findOrFail($id);

        $assignment = TeacherAssignment::where('user_id', $teacher->id)->findOrFail($assignment_id);
        $assignment->delete();

        return response()->json([
            'success' => true,
            'message' => 'Penugasan guru berhasil dicabut.',
            'data' => null,
        ], 200);
    }

    /**
     * Menganalisis berkas Excel penugasan dan menghasilkan pratinjau pemetaan (tanpa mengubah database).
     * POST /api/teachers/assignments/import-preview
     */
    public function importPreview(Request $request, TeacherAssignmentImportService $importService): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx|max:5120',
        ], [
            'file.required' => 'Berkas Excel penugasan wajib diunggah.',
            'file.mimes' => 'Format berkas harus berupa spreadsheet dengan ekstensi .xlsx.',
            'file.max' => 'Ukuran berkas Excel tidak boleh melebihi 5 MB.',
        ]);

        $preview = $importService->generatePreview($request->file('file'));

        return response()->json([
            'success' => true,
            'message' => 'Analisis berkas Excel penugasan berhasil.',
            'preview_token' => $preview['preview_token'],
            'expires_at' => $preview['expires_at'],
            'summary' => $preview['summary'],
            'data' => $preview['data'],
        ], 200);
    }

    /**
     * Menyimpan hasil konfirmasi pemetaan penugasan ke database secara atomik.
     * POST /api/teachers/assignments/import-commit
     */
    public function importCommit(Request $request, TeacherAssignmentImportService $importService): JsonResponse
    {
        $request->validate([
            'preview_token' => 'required|string',
            'items' => 'required|array|min:1',
            'items.*.class_id' => 'required|integer|exists:classes,id',
            'items.*.wali_teacher_id' => 'required|integer|exists:users,id',
            'items.*.bk_teacher_id' => 'required|integer|exists:users,id',
        ], [
            'preview_token.required' => 'Token pratinjau wajib disertakan.',
            'items.required' => 'Daftar pemetaan penugasan kelas wajib dikirimkan.',
            'items.*.class_id.exists' => 'Salah satu kelas yang dipilih tidak valid di database.',
            'items.*.wali_teacher_id.exists' => 'Salah satu guru wali kelas yang dipilih tidak valid di database.',
            'items.*.bk_teacher_id.exists' => 'Salah satu guru BK yang dipilih tidak valid di database.',
        ]);

        $result = $importService->commit(
            $request->input('preview_token'),
            $request->input('items')
        );

        return response()->json([
            'success' => true,
            'message' => 'Data penugasan Wali Kelas dan BK/Kesiswaan berhasil disimpan.',
            'summary' => $result,
        ], 200);
    }
}
