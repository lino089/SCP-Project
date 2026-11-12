<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classes;
use App\Models\CurriculumTeachingAssignment;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\ScheduleGenerationBatch;
use App\Models\ScheduleGenerationDraft;
use App\Models\Subject;
use App\Models\User;
use App\Services\ScheduleGeneratorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ScheduleGenerationController extends Controller
{
    public function __construct(
        protected ScheduleGeneratorService $generatorService
    ) {
    }

    /**
     * Mengambil konfigurasi, kesiapan master data, dan pemetaan rombel paralel.
     * GET /api/schedule-generation/config
     */
    public function config(): JsonResponse
    {
        $cachedData = Cache::remember('schedule_generation_config_meta', 60, function () {
            $classes = Classes::orderBy('level')->orderBy('name')->get(['id', 'name', 'level']);
            $teachersCount = User::where('role', 'teacher')->whereNull('deleted_at')->count();
            $roomsCount = Room::whereNull('deleted_at')->count();
            $subjectsCount = Subject::whereNull('deleted_at')->count();
            $assignmentsCount = CurriculumTeachingAssignment::whereNull('deleted_at')->count();

            // Identifikasi pasangan rombel paralel (misal X RPL 1 <-> X RPL 2)
            $parallelGroups = [];
            foreach ($classes as $c) {
                $baseName = trim(preg_replace('/\s+\d+$/', '', $c->name));
                $parallelGroups[$baseName][] = [
                    'id' => $c->id,
                    'name' => $c->name,
                    'level' => $c->level,
                ];
            }

            $rollingPairs = [];
            foreach ($parallelGroups as $baseName => $group) {
                $rollingPairs[] = [
                    'group_name' => $baseName,
                    'classes' => $group,
                    'is_paired' => count($group) >= 2,
                ];
            }

            $isReady = $classes->count() > 0 && $teachersCount > 0 && $roomsCount > 0 && $subjectsCount > 0 && $assignmentsCount > 0;

            return [
                'is_ready' => $isReady,
                'master_counts' => [
                    'classes' => $classes->count(),
                    'teachers' => $teachersCount,
                    'rooms' => $roomsCount,
                    'subjects' => $subjectsCount,
                    'curriculum_assignments' => $assignmentsCount,
                ],
                'rolling_pairs' => $rollingPairs,
            ];
        });

        // cycle_states selalu dicek real-time
        $cycleStates = $this->generatorService->checkTargetCyclesState([1, 2]);
        $cachedData['cycle_states'] = $cycleStates;

        return response()->json([
            'success' => true,
            'message' => 'Konfigurasi generate jadwal berhasil dimuat.',
            'data' => $cachedData,
        ], 200);
    }

    /**
     * Memeriksa kondisi jadwal pada putaran target (kosong vs sudah terisi).
     * POST /api/schedule-generation/check-target-state
     */
    public function checkTargetState(Request $request): JsonResponse
    {
        $request->validate([
            'cycles' => 'required|array|min:1',
            'cycles.*' => 'integer|in:1,2',
        ]);

        $cycles = $request->input('cycles');
        $states = $this->generatorService->checkTargetCyclesState($cycles);

        $hasExisting = false;
        $totalActive = 0;
        foreach ($states as $s) {
            if (!$s['is_empty']) {
                $hasExisting = true;
                $totalActive += $s['active_schedules_count'];
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'has_existing_schedules' => $hasExisting,
                'total_active_schedules' => $totalActive,
                'states' => $states,
            ],
        ], 200);
    }

    /**
     * Menjalankan proses generate jadwal otomatis.
     * POST /api/schedule-generation/run
     */
    public function run(Request $request): JsonResponse
    {
        $request->validate([
            'cycles' => 'required|array|min:1',
            'cycles.*' => 'integer|in:1,2',
        ]);

        $cycles = $request->input('cycles');
        $user = $request->user();

        $batch = $this->generatorService->generate($cycles, $user->id);

        $conflictCount = ScheduleGenerationDraft::where('batch_id', $batch->id)
            ->where('has_conflict', true)
            ->count();

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil digenerate secara otomatis.',
            'data' => [
                'batch_uuid' => $batch->batch_uuid,
                'status' => $batch->status,
                'target_cycles' => $batch->target_cycles,
                'total_classes_processed' => $batch->total_classes_processed,
                'total_slots_generated' => $batch->total_slots_generated,
                'conflict_slots_count' => $conflictCount,
                'execution_time_seconds' => $batch->execution_time_seconds,
            ],
        ], 200);
    }

    /**
     * Mengambil detail batch generate.
     * GET /api/schedule-generation/batches/{batchUuid}
     */
    public function show(string $batchUuid): JsonResponse
    {
        $batch = ScheduleGenerationBatch::where('batch_uuid', $batchUuid)->firstOrFail();

        $conflictCount = ScheduleGenerationDraft::where('batch_id', $batch->id)
            ->where('has_conflict', true)
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'batch_uuid' => $batch->batch_uuid,
                'status' => $batch->status,
                'target_cycles' => $batch->target_cycles,
                'total_classes_processed' => $batch->total_classes_processed,
                'total_slots_generated' => $batch->total_slots_generated,
                'conflict_slots_count' => $conflictCount,
                'execution_time_seconds' => $batch->execution_time_seconds,
                'created_at' => $batch->created_at?->toIso8601String(),
            ],
        ], 200);
    }

    /**
     * Mengambil draft jadwal hasil generate untuk dipratinjau pada matriks.
     * GET /api/schedule-generation/batches/{batchUuid}/drafts
     */
    public function drafts(Request $request, string $batchUuid): JsonResponse
    {
        $batch = ScheduleGenerationBatch::where('batch_uuid', $batchUuid)->firstOrFail();

        $query = ScheduleGenerationDraft::where('batch_id', $batch->id)
            ->with([
                'schoolClass:id,name,level',
                'subject:id,name,category',
                'teacher:id,name,nis_nip',
                'room:id,name,capacity,type',
            ]);

        if ($request->filled('cycle')) {
            $query->where('cycle_type', $request->integer('cycle'));
        }

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        }

        if ($request->boolean('has_conflict')) {
            $query->where('has_conflict', true);
        }

        $drafts = $query->orderBy('cycle_type')
            ->orderBy('day_of_week')
            ->orderBy('period_number')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $drafts,
            'meta' => [
                'batch_uuid' => $batch->batch_uuid,
                'total' => $drafts->count(),
            ],
        ], 200);
    }

    /**
     * Menerapkan jadwal hasil generate ke KBM aktif dengan konfirmasi password Waka.
     * POST /api/schedule-generation/batches/{batchUuid}/apply
     */
    public function apply(Request $request, string $batchUuid): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        if ($error = $this->passwordIsConfirmed($request)) {
            return $error;
        }

        $result = $this->generatorService->applyBatch($batchUuid, $request->user()->id);

        return response()->json([
            'success' => true,
            'message' => 'Jadwal pelajaran hasil generate otomatis berhasil diterapkan ke KBM aktif.',
            'data' => $result,
        ], 200);
    }

    /**
     * Membatalkan dan menghapus draft generate.
     * DELETE /api/schedule-generation/batches/{batchUuid}
     */
    public function destroy(string $batchUuid): JsonResponse
    {
        $this->generatorService->discardBatch($batchUuid);

        return response()->json([
            'success' => true,
            'message' => 'Draft jadwal generate otomatis berhasil dibatalkan dan dihapus.',
        ], 200);
    }

    /**
     * Mengambil daftar alokasi beban mengajar kurikulum.
     * GET /api/schedule-generation/curriculum-assignments
     */
    public function getAssignments(Request $request): JsonResponse
    {
        $query = CurriculumTeachingAssignment::with([
            'schoolClass:id,name,level',
            'subject:id,name,category',
            'teacher:id,name,nis_nip',
            'preferredRoom:id,name,capacity,type',
        ]);

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        }

        if ($request->filled('teacher_id')) {
            $query->where('teacher_id', $request->integer('teacher_id'));
        }

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->whereHas('schoolClass', fn ($cq) => $cq->where('name', 'ILIKE', "%{$s}%"))
                    ->orWhereHas('subject', fn ($sq) => $sq->where('name', 'ILIKE', "%{$s}%"))
                    ->orWhereHas('teacher', fn ($tq) => $tq->where('name', 'ILIKE', "%{$s}%"));
            });
        }

        $perPage = min(500, max(10, $request->integer('per_page', 50)));
        $paginated = $query->orderBy('class_id')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $paginated->items(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
        ], 200);
    }

    /**
     * Memperbarui satu alokasi beban mengajar.
     * PUT /api/schedule-generation/curriculum-assignments/{id}
     */
    public function updateAssignment(Request $request, int $id): JsonResponse
    {
        $assignment = CurriculumTeachingAssignment::findOrFail($id);

        $validated = $request->validate([
            'total_jp' => 'nullable|integer|min:1|max:48',
            'preferred_cycle' => 'nullable|string|in:cycle_1,cycle_2,both,auto',
            'preferred_room_id' => 'nullable|integer|exists:rooms,id',
            'max_block_jp' => 'nullable|integer|min:1|max:10',
            'teacher_id' => 'nullable|integer|exists:users,id',
        ]);

        $assignment->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Alokasi beban mengajar berhasil diperbarui.',
            'data' => $assignment->fresh([
                'schoolClass:id,name,level',
                'subject:id,name,category',
                'teacher:id,name,nis_nip',
                'preferredRoom:id,name,capacity,type',
            ]),
        ], 200);
    }
}
