<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SubjectController extends Controller
{
    /**
     * Menampilkan daftar mata pelajaran (berpaginasi).
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string|max:100',
        ]);

        $perPage = $request->integer('per_page', 15);
        $search = $request->input('search');

        $query = Subject::query();

        if ($search) {
            $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->where('name', $like, '%' . $search . '%');
        }

        $subjects = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Data mata pelajaran berhasil diambil.',
            'data' => $subjects->items(),
            'meta' => [
                'current_page' => $subjects->currentPage(),
                'per_page' => $subjects->perPage(),
                'total' => $subjects->total(),
                'last_page' => $subjects->lastPage(),
            ],
        ], 200);
    }

    /**
     * Menambahkan mata pelajaran baru.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('subjects', 'name')->whereNull('deleted_at'),
            ],
        ]);

        $subject = Subject::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Mata pelajaran berhasil ditambahkan.',
            'data' => $subject,
        ], 201);
    }

    /**
     * Memperbarui data mata pelajaran.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $subject = Subject::findOrFail($id);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('subjects', 'name')->ignore($subject->id)->whereNull('deleted_at'),
            ],
        ]);

        $subject->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Mata pelajaran berhasil diperbarui.',
            'data' => $subject,
        ], 200);
    }

    /**
     * Menghapus mata pelajaran (soft-delete), ditolak 409 jika terikat jadwal aktif.
     */
    public function destroy(int $id): JsonResponse
    {
        $subject = Subject::findOrFail($id);

        if ($subject->schedules()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Mata pelajaran tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
                'errors' => [
                    'subject' => ['Hapus atau pindahkan jadwal terkait terlebih dahulu.'],
                ],
            ], 409);
        }

        $subject->delete();

        return response()->json([
            'success' => true,
            'message' => 'Data mata pelajaran berhasil dihapus.',
            'data' => $subject,
        ], 200);
    }
}
