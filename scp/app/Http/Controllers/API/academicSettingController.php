<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\CycleHistory;
use App\Models\SystemConfiguration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AcademicSettingController extends Controller
{
    /**
     * Menampilkan konfigurasi akademik aktif (active_cycle, monday_is_upacara).
     */
    public function index(Request $request): JsonResponse
    {
        $config = SystemConfiguration::firstOrFail();

        return response()->json([
            'success' => true,
            'message' => 'Pengaturan akademik berhasil diambil.',
            'data' => $config,
        ], 200);
    }

    /**
     * Mengubah putaran aktif (Putaran 1 / Putaran 2) dengan konfirmasi password (PRD 5.5).
     */
    public function updateCycle(Request $request): JsonResponse
    {
        $request->validate([
            'cycle_type' => 'required|integer|in:1,2',
            'password' => 'required|string',
        ]);

        if ($error = $this->passwordIsConfirmed($request)) {
            return $error;
        }

        $result = DB::transaction(function () use ($request) {
            $config = SystemConfiguration::firstOrFail();
            $config->update(['active_cycle' => $request->cycle_type]);

            // Tutup riwayat putaran sebelumnya jika ada
            CycleHistory::whereNull('ended_at')->update(['ended_at' => now()]);

            // Catat log riwayat putaran baru
            $history = CycleHistory::create([
                'cycle_number' => $request->cycle_type,
                'started_at' => now(),
                'changed_by' => $request->user()->id,
            ]);

            return [
                'active_cycle' => $config->active_cycle,
                'history' => $history,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Putaran aktif berhasil diubah.',
            'data' => $result,
        ], 200);
    }

    /**
     * Memperbarui status upacara bendera hari Senin dengan konfirmasi password.
     */
    public function updateMondayStatus(Request $request): JsonResponse
    {
        $request->validate([
            'is_upacara' => 'required|boolean',
            'password' => 'required|string',
        ]);

        if ($error = $this->passwordIsConfirmed($request)) {
            return $error;
        }

        $config = SystemConfiguration::firstOrFail();
        $config->update(['monday_is_upacara' => $request->is_upacara]);

        return response()->json([
            'success' => true,
            'message' => 'Status upacara hari senin berhasil diperbarui.',
            'data' => [
                'monday_is_upacara' => $config->monday_is_upacara,
            ],
        ], 200);
    }

    /**
     * Menampilkan riwayat pergantian putaran (cycle_history) berpaginasi.
     */
    public function cycleHistory(Request $request): JsonResponse
    {
        $request->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $perPage = $request->integer('per_page', 15);

        $histories = CycleHistory::with('changedBy:id,name,nis_nip')
            ->orderByDesc('started_at')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Riwayat pergantian putaran berhasil diambil.',
            'data' => $histories->items(),
            'meta' => [
                'current_page' => $histories->currentPage(),
                'per_page' => $histories->perPage(),
                'total' => $histories->total(),
                'last_page' => $histories->lastPage(),
            ],
        ], 200);
    }
}
