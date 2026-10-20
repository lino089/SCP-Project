<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classes;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SchoolClassController extends Controller
{
    /**
     * Menampilkan daftar kelas (berpaginasi).
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string|max:100',
        ]);

        $perPage = $request->integer('per_page', 15);
        $search = $request->input('search');

        $query = Classes::query()->with('nextClass:id,name,level');

        if ($search) {
            $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->where('name', $like, '%' . $search . '%');
        }

        $classes = $query->orderBy('level')->orderBy('name')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Data kelas berhasil diambil.',
            'data' => $classes->items(),
            'meta' => [
                'current_page' => $classes->currentPage(),
                'per_page' => $classes->perPage(),
                'total' => $classes->total(),
                'last_page' => $classes->lastPage(),
            ],
        ], 200);
    }

    /**
     * Menambahkan kelas baru.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:50',
                Rule::unique('classes', 'name')->whereNull('deleted_at'),
            ],
            'level' => 'required|integer|in:10,11,12',
            'next_class_id' => 'nullable|integer|exists:classes,id',
        ]);

        $class = Classes::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Data berhasil ditambahkan',
            'data' => $class,
        ], 201);
    }

    /**
     * Memperbarui data kelas (nama, level, next_class_id).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $class = Classes::findOrFail($id);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:50',
                Rule::unique('classes', 'name')->ignore($class->id)->whereNull('deleted_at'),
            ],
            'level' => 'required|integer|in:10,11,12',
            'next_class_id' => [
                'nullable',
                'integer',
                'exists:classes,id',
                Rule::notIn([$class->id]),
            ],
        ]);

        $class->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Data kelas berhasil diperbarui.',
            'data' => $class,
        ], 200);
    }

    /**
     * Menghapus kelas (soft-delete), ditolak 409 jika terikat jadwal aktif.
     */
    public function destroy(int $id): JsonResponse
    {
        $class = Classes::findOrFail($id);

        if ($class->schedules()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Kelas tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
                'errors' => [
                    'class' => ['Hapus atau pindahkan jadwal terkait terlebih dahulu.'],
                ],
            ], 409);
        }

        $class->delete();

        return response()->json([
            'success' => true,
            'message' => 'Data kelas berhasil dihapus',
            'data' => $class,
        ], 200);
    }

    /**
     * Promosi kenaikan kelas dan kelulusan massal akhir tahun ajaran (PRD 5.13).
     */
    public function promoteClasses(Request $request): JsonResponse
    {
        $result = DB::transaction(function () {
            $students = User::where('role', 'student')->with('schoolClass')->get();

            $promotedCount = 0;
            $heldBackCount = 0;
            $graduatedCount = 0;

            foreach ($students as $student) {
                if ($student->is_held_back) {
                    // Siswa tinggal kelas: reset flag untuk tahun ajaran baru, tidak ubah class_id
                    $student->update(['is_held_back' => false]);
                    $heldBackCount++;
                    continue;
                }

                $currentClass = $student->schoolClass;

                if ($currentClass && $currentClass->next_class_id) {
                    // Naik ke kelas berikutnya
                    $student->update(['class_id' => $currentClass->next_class_id]);
                    $promotedCount++;
                } elseif ($currentClass && is_null($currentClass->next_class_id)) {
                    // Kelas akhir (kelas 12): kelulusan
                    $student->update([
                        'graduation_date' => now()->toDateString(),
                        'class_id' => null,
                    ]);
                    $graduatedCount++;
                }
            }

            return [
                'total_students' => $students->count(),
                'promoted' => $promotedCount,
                'held_back' => $heldBackCount,
                'graduated' => $graduatedCount,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Proses kenaikan kelas dan kelulusan berhasil diproses.',
            'data' => $result,
        ], 200);
    }
}
