<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StudentController extends Controller
{
    /**
     * Menampilkan daftar siswa (berpaginasi).
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string|max:100',
            'class_id' => 'nullable|integer|exists:classes,id',
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
            ]);

            $parent = User::create([
                'name' => 'Wali dari ' . $request->name,
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
    public function update(Request $request, int $id): JsonResponse
    {
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
        ]);

        DB::transaction(function () use ($student, $request) {
            $student->update([
                'name' => $request->name,
                'nis_nip' => $request->nis,
                'class_id' => $request->class_id,
            ]);

            // Sinkronkan username orang tua jika NIS berubah
            User::where('linked_student_id', $student->id)
                ->where('role', 'parent')
                ->update([
                    'name' => 'Wali dari ' . $request->name,
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
    public function destroy(int $id): JsonResponse
    {
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
    public function holdBack(Request $request, int $id): JsonResponse
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
