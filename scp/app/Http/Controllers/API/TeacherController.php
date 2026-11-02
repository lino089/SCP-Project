<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use App\Models\TeacherAssignment;
use App\Models\User;
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
                    'nip' => '198001012010011002',
                    'name' => 'Budi Santoso, S.Pd.',
                    'fet_staff_id' => '1',
                    'mata_pelajaran' => 'Matematika',
                ],
                [
                    'nip' => '198502022015022003',
                    'name' => 'Dewi Lestari, M.Pd.',
                    'fet_staff_id' => '14',
                    'mata_pelajaran' => 'Bahasa Indonesia',
                ],
                [
                    'nip' => '199003032020031004',
                    'name' => 'Ahmad Fauzi, S.Kom.',
                    'fet_staff_id' => '25',
                    'mata_pelajaran' => 'Pemrograman Web',
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
        $reader = SimpleExcelReader::create($uploadedFile->getRealPath(), 'xlsx')->trimHeaderRow()->headersToSnakeCase();
        $headers = $reader->getHeaders();

        if (empty($headers)) {
            return response()->json([
                'success' => false,
                'message' => 'Berkas Excel tidak memuat data guru atau header kosong.',
                'errors' => null,
            ], 422);
        }

        $hasSubjectHeader = in_array('mata_pelajaran', $headers) || in_array('mapel', $headers) || in_array('subject', $headers);
        $requiredHeaders = ['nip', 'name', 'fet_staff_id'];
        if (!$hasSubjectHeader) {
            $requiredHeaders[] = 'mata_pelajaran';
        }
        $missingHeaders = array_diff($requiredHeaders, $headers);

        if (!empty($missingHeaders)) {
            return response()->json([
                'success' => false,
                'message' => "Format berkas tidak valid. Kolom header " . implode(', ', $missingHeaders) . " wajib tersedia.",
                'errors' => null,
            ], 422);
        }

        $rows = $reader->getRows();
        if ($rows->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Berkas Excel tidak memuat data guru.',
                'errors' => null,
            ], 422);
        }

        $rowNumber = 1;
        $errors = [];
        $seenNips = [];
        $seenFetStaffIds = [];
        $validTeachers = [];

        // Preload active NIPs and FET Staff IDs to prevent N+1 queries
        $existingNips = User::whereNull('deleted_at')->pluck('nis_nip')->flip()->toArray();
        $existingFetStaffIds = User::whereNotNull('fet_staff_id')->whereNull('deleted_at')->pluck('fet_staff_id')->flip()->toArray();

        foreach ($rows as $row) {
            $rowNumber++;

            $rawNip = isset($row['nip']) ? trim((string) $row['nip']) : '';
            $rawName = isset($row['name']) ? trim((string) $row['name']) : '';
            $rawFetId = isset($row['fet_staff_id']) ? trim((string) $row['fet_staff_id']) : '';
            $rawSubject = isset($row['mata_pelajaran'])
                ? trim((string) $row['mata_pelajaran'])
                : (isset($row['mapel']) ? trim((string) $row['mapel']) : (isset($row['subject']) ? trim((string) $row['subject']) : ''));

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
            } elseif (isset($existingNips[$rawNip])) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'nip',
                    'message' => "NIP '{$rawNip}' sudah terdaftar di sistem.",
                ];
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

            // Validasi fet_staff_id
            if ($rawFetId === '') {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'fet_staff_id',
                    'message' => 'Kolom fet_staff_id wajib diisi.',
                ];
            } elseif (isset($seenFetStaffIds[$rawFetId])) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'fet_staff_id',
                    'message' => "ID staf FET '{$rawFetId}' duplikat di dalam berkas ini (pertama kali muncul di baris {$seenFetStaffIds[$rawFetId]}).",
                ];
            } elseif (isset($existingFetStaffIds[$rawFetId])) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'fet_staff_id',
                    'message' => "ID staf FET '{$rawFetId}' sudah terdaftar di sistem.",
                ];
            } else {
                $seenFetStaffIds[$rawFetId] = $rowNumber;
            }

            // Validasi Mata Pelajaran
            if ($rawSubject === '') {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'mata_pelajaran',
                    'message' => 'Kolom mata pelajaran wajib diisi.',
                ];
            } elseif (mb_strlen($rawSubject) > 100) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'mata_pelajaran',
                    'message' => 'Nama mata pelajaran tidak boleh melebihi 100 karakter.',
                ];
            }

            $validTeachers[] = [
                'subject_name' => $rawSubject,
                'data' => [
                    'name' => $rawName,
                    'role' => 'teacher',
                    'nis_nip' => $rawNip,
                    'password' => Hash::make($rawNip, ['rounds' => 4]),
                    'fet_staff_id' => $rawFetId,
                    'email' => null,
                    'phone_number' => null,
                    'must_change_password' => true,
                ],
            ];
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
                $key = mb_strtolower($subjectName);

                if (!isset($subjectCache[$key])) {
                    $found = Subject::whereRaw('LOWER(name) = ?', [$key])->first();
                    if (!$found) {
                        $found = Subject::create(['name' => $subjectName]);
                    }
                    $subjectCache[$key] = $found;
                }

                $teacherData = $item['data'];
                $teacherData['subject_id'] = $subjectCache[$key]->id;

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
                    ->orWhere('nis_nip', $like, '%' . $search . '%')
                    ->orWhere('fet_staff_id', $like, '%' . $search . '%');
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
     * Menambahkan akun guru baru (Auto-provisioning password).
     */
    public function store(Request $request): JsonResponse
    {
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
            'fet_staff_id' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('users', 'fet_staff_id')->whereNull('deleted_at'),
            ],
            'email' => 'nullable|email|unique:users,email',
            'subject_id' => 'nullable|exists:subjects,id',
            'phone_number' => 'nullable|string|max:30',
        ]);

        $nip = $request->input('nip') ?? $request->input('nis_nip');
        $randomPassword = Str::random(8);

        $teacher = User::create([
            'name' => $request->name,
            'role' => 'teacher',
            'nis_nip' => $nip,
            'email' => $request->input('email'),
            'phone_number' => $request->input('phone_number'),
            'subject_id' => $request->input('subject_id'),
            'fet_staff_id' => $request->fet_staff_id,
            'password' => Hash::make($randomPassword),
            'must_change_password' => true,
        ]);

        $teacher->load('subject');

        return response()->json([
            'success' => true,
            'message' => 'Akun guru berhasil dibuat.',
            'data' => [
                'teacher' => $teacher,
                'password' => $randomPassword,
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
            'fet_staff_id' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('users', 'fet_staff_id')->ignore($teacher->id)->whereNull('deleted_at'),
            ],
            'email' => [
                'nullable',
                'email',
                Rule::unique('users', 'email')->ignore($teacher->id),
            ],
            'subject_id' => 'nullable|exists:subjects,id',
            'phone_number' => 'nullable|string|max:30',
        ]);

        $data = [];
        if ($request->has('name')) {
            $data['name'] = $request->name;
        }
        if ($request->filled('nip') || $request->filled('nis_nip')) {
            $data['nis_nip'] = $request->input('nip') ?? $request->input('nis_nip');
        }
        if ($request->has('fet_staff_id')) {
            $data['fet_staff_id'] = $request->fet_staff_id;
        }
        if ($request->has('email')) {
            $data['email'] = $request->email;
        }
        if ($request->has('phone_number')) {
            $data['phone_number'] = $request->phone_number;
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
                    'teacher' => ['Hapus atau pindahkan jadwal terkait terlebih dahulu.'],
                ],
            ], 409);
        }

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
            $existing = TeacherAssignment::where('type', 'wali_kelas')
                ->where('class_id', $request->class_id)
                ->where('user_id', '!=', $teacher->id)
                ->first();

            if ($existing) {
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
            'data' => $assignment,
        ], 201);
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
}
