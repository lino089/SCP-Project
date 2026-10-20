<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoomController extends Controller
{
    /**
     * Menampilkan daftar master ruangan (berpaginasi).
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string|max:100',
        ]);

        $perPage = $request->integer('per_page', 15);
        $search = $request->input('search');

        $query = Room::query();

        if ($search) {
            $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->where('name', $like, '%' . $search . '%');
        }

        $rooms = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Data ruangan berhasil diambil.',
            'data' => $rooms->items(),
            'meta' => [
                'current_page' => $rooms->currentPage(),
                'per_page' => $rooms->perPage(),
                'total' => $rooms->total(),
                'last_page' => $rooms->lastPage(),
            ],
        ], 200);
    }

    /**
     * Menambahkan master ruangan baru.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:50',
                Rule::unique('rooms', 'name')->whereNull('deleted_at'),
            ],
            'capacity' => 'required|integer|min:1',
        ]);

        $room = Room::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Data ruangan berhasil ditambahkan.',
            'data' => $room,
        ], 201);
    }

    /**
     * Memperbarui data master ruangan.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $room = Room::findOrFail($id);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:50',
                Rule::unique('rooms', 'name')->ignore($room->id)->whereNull('deleted_at'),
            ],
            'capacity' => 'required|integer|min:1',
        ]);

        $room->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Data ruangan berhasil diperbarui.',
            'data' => $room,
        ], 200);
    }

    /**
     * Menghapus ruangan (soft-delete), ditolak 409 jika terikat jadwal aktif.
     */
    public function destroy(int $id): JsonResponse
    {
        $room = Room::findOrFail($id);

        if ($room->schedules()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Ruangan tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
                'errors' => [
                    'room' => ['Hapus atau pindahkan jadwal terkait terlebih dahulu.'],
                ],
            ], 409);
        }

        $room->delete();

        return response()->json([
            'success' => true,
            'message' => 'Data ruangan berhasil dihapus.',
            'data' => $room,
        ], 200);
    }
}
