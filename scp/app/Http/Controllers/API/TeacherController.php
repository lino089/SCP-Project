<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\TeacherAssignment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TeacherController extends Controller
{
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
