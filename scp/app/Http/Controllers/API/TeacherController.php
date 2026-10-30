<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
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
    public function downloadTemplate(): StreamedResponse
    {
        return response()->streamDownload(function () {
            $writer = SimpleExcelWriter::create('php://output', 'xlsx');

            $writer->addRows([
                [
                    'nip' => '198001012010011002',
                    'name' => 'Budi Santoso, S.Pd.',
                    'fet_staff_id' => '1',
                    'email' => 'budi.santoso@sekolah.sch.id',
                    'phone_number' => '081234567890',
                ],
                [
                    'nip' => '198502022015022003',
                    'name' => 'Dewi Lestari, M.Pd.',
                    'fet_staff_id' => '14',
                    'email' => 'dewi.lestari@sekolah.sch.id',
                    'phone_number' => '082345678901',
                ],
            ]);

            $writer->close();
        }, 'guru_import_template.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /**
     * Mengimpor data guru massal dari berkas Excel (.xlsx).
     */
    public function import(Request $request): JsonResponse
    {
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
        $reader = SimpleExcelReader::create($uploadedFile->getRealPath())->trimHeaderRow()->headersToSnakeCase();
        $headers = $reader->getHeaders();

        if (empty($headers)) {
            return response()->json([
                'success' => false,
                'message' => 'Berkas Excel tidak memuat data guru atau header kosong.',
                'errors' => null,
            ], 422);
        }

        $requiredHeaders = ['nip', 'name', 'fet_staff_id'];
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

        foreach ($rows as $row) {
            $rowNumber++;

            $rawNip = isset($row['nip']) ? trim((string) $row['nip']) : '';
            $rawName = isset($row['name']) ? trim((string) $row['name']) : '';
            $rawFetId = isset($row['fet_staff_id']) ? trim((string) $row['fet_staff_id']) : '';
            $rawEmail = isset($row['email']) ? trim((string) $row['email']) : '';
            $rawPhone = isset($row['phone_number']) ? trim((string) $row['phone_number']) : '';

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
            } elseif (User::where('nis_nip', $rawNip)->whereNull('deleted_at')->exists()) {
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
            } elseif (User::where('fet_staff_id', $rawFetId)->whereNull('deleted_at')->exists()) {
                $errors[] = [
                    'row' => $rowNumber,
                    'attribute' => 'fet_staff_id',
                    'message' => "ID staf FET '{$rawFetId}' sudah terdaftar di sistem.",
                ];
            } else {
                $seenFetStaffIds[$rawFetId] = $rowNumber;
            }

            // Validasi Email jika diisi
            if ($rawEmail !== '') {
                if (!filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) {
                    $errors[] = [
                        'row' => $rowNumber,
                        'attribute' => 'email',
                        'message' => "Format email '{$rawEmail}' tidak valid.",
                    ];
                } elseif (User::where('email', $rawEmail)->whereNull('deleted_at')->exists()) {
                    $errors[] = [
                        'row' => $rowNumber,
                        'attribute' => 'email',
                        'message' => "Email '{$rawEmail}' sudah terdaftar di sistem.",
                    ];
                }
            }

            $validTeachers[] = [
                'name' => $rawName,
                'role' => 'teacher',
                'nis_nip' => $rawNip,
                'password' => Hash::make($rawNip),
                'fet_staff_id' => $rawFetId,
                'email' => $rawEmail !== '' ? $rawEmail : null,
                'phone_number' => $rawPhone !== '' ? $rawPhone : null,
                'must_change_password' => true,
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
            foreach ($validTeachers as $teacherData) {
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

        $query = User::where('role', 'teacher')->with(['assignments.schoolClass']);

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
        ]);

        $nip = $request->input('nip') ?? $request->input('nis_nip');
        $randomPassword = Str::random(8);

        $teacher = User::create([
            'name' => $request->name,
            'role' => 'teacher',
            'nis_nip' => $nip,
            'email' => $request->input('email'),
            'fet_staff_id' => $request->fet_staff_id,
            'password' => Hash::make($randomPassword),
            'must_change_password' => true,
        ]);

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
    public function update(Request $request, int $id): JsonResponse
    {
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

        $teacher->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Data guru berhasil diperbarui.',
            'data' => $teacher,
        ], 200);
    }

    /**
     * Menghapus akun guru (soft-delete), ditolak 409 jika terikat jadwal aktif.
     */
    public function destroy(int $id): JsonResponse
    {
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
    public function assignRole(Request $request, int $id): JsonResponse
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
    public function revokeRole(int $id, int $assignment_id): JsonResponse
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
