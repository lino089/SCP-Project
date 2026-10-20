<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classes;
use App\Models\Rooms;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\SystemConfiguration;
use App\Models\User;
use App\Services\PeriodResolutionService;
use App\Services\ScheduleConflictService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ScheduleController extends Controller
{
    public function __construct(
        private ScheduleConflictService $conflicts,
        private PeriodResolutionService $periodResolver
    ) {
    }

    private function lockResources(array $data): void
    {
        User::whereKey($data['teacher_id'])->lockForUpdate()->first();
        Classes::whereKey($data['class_id'])->lockForUpdate()->first();
        Rooms::whereKey($data['room_id'])->lockForUpdate()->first();
    }

    /**
     * Menampilkan daftar jadwal pelajaran atau alert jurnal terlambat (PRD 5.6 & 9.4).
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'cycle' => 'nullable|integer|in:1,2',
            'day' => 'nullable|integer|between:1,7',
            'class_id' => 'nullable|integer|exists:classes,id',
            'teacher_id' => 'nullable|integer|exists:users,id',
            'status' => 'nullable|string|in:missing_journal',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $user = $request->user();

        // 1. Mode Alert Keterlambatan Jurnal (PRD 5.6 & 5.7)
        if ($request->input('status') === 'missing_journal') {
            $now = Carbon::now('Asia/Jakarta');
            $activeCycle = (int) (SystemConfiguration::first()?->active_cycle ?? 1);
            $dayOfWeek = (int) $now->dayOfWeekIso;

            $query = Schedule::query()
                ->where('cycle_type', $activeCycle)
                ->where('day_of_week', $dayOfWeek)
                ->with([
                    'schoolClass:id,name,level',
                    'teacher:id,name,nis_nip,fet_staff_id',
                    'room:id,name,capacity',
                    'subject:id,name',
                    'journals' => function ($q) use ($now) {
                        $q->whereDate('date', $now->toDateString());
                    },
                ]);

            if ($user->role === 'teacher') {
                $query->where('teacher_id', $user->id);
            } elseif ($user->role === 'vice_principal' && $request->filled('teacher_id')) {
                $query->where('teacher_id', $request->input('teacher_id'));
            }

            if ($request->filled('class_id')) {
                $query->where('class_id', $request->input('class_id'));
            }

            $candidateSchedules = $query->orderBy('period_number')->get();
            $missingSchedules = [];

            foreach ($candidateSchedules as $schedule) {
                $todayJournal = $schedule->journals->first();

                // Jadwal yang sudah memiliki jurnal berstatus completed dikecualikan
                if ($todayJournal && $todayJournal->status === 'completed') {
                    continue;
                }

                // Jadwal dengan status teacher_absent dikecualikan sesuai PRD 5.6 & 5.7
                if ($todayJournal && $todayJournal->status === 'teacher_absent') {
                    continue;
                }

                // Cek apakah waktu selesai jadwal + toleransi 30 menit sudah terlewat
                if ($this->periodResolver->isSchedulePastTolerance($schedule, $now)) {
                    $times = $this->periodResolver->getScheduleTimes($schedule, $now);
                    $deadline = Carbon::parse($now->toDateString() . ' ' . $times['end_time'], 'Asia/Jakarta')->addMinutes(30);

                    $scheduleArray = $schedule->toArray();
                    $scheduleArray['resolved_times'] = $times;
                    $scheduleArray['tolerance_deadline'] = $deadline->toTimeString();
                    $scheduleArray['minutes_overdue'] = (int) $now->diffInMinutes($deadline);
                    $scheduleArray['journal_status'] = $todayJournal ? $todayJournal->status : 'not_started';

                    $missingSchedules[] = $scheduleArray;
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Data alert jadwal tanpa jurnal berhasil diambil.',
                'data' => $missingSchedules,
                'meta' => [
                    'date' => $now->toDateString(),
                    'active_cycle' => $activeCycle,
                    'day_of_week' => $dayOfWeek,
                    'total_missing' => count($missingSchedules),
                ],
            ], 200);
        }

        // 2. Mode Listing Jadwal Reguler (PRD 9.4)
        $perPage = $request->integer('per_page', 15);
        $activeCycle = (int) (SystemConfiguration::first()?->active_cycle ?? 1);
        $cycle = $request->has('cycle') ? $request->integer('cycle') : $activeCycle;

        $query = Schedule::query()
            ->where('cycle_type', $cycle)
            ->with([
                'schoolClass:id,name,level',
                'teacher:id,name,nis_nip,fet_staff_id',
                'room:id,name,capacity',
                'subject:id,name',
            ]);

        // Scoping: Guru hanya melihat jadwal miliknya sendiri
        if ($user->role === 'teacher') {
            $query->where('teacher_id', $user->id);
        } elseif ($user->role === 'vice_principal') {
            if ($request->filled('teacher_id')) {
                $query->where('teacher_id', $request->input('teacher_id'));
            }
        }

        if ($request->filled('day')) {
            $query->where('day_of_week', $request->input('day'));
        }

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->input('class_id'));
        }

        $schedules = $query->orderBy('day_of_week')->orderBy('period_number')->paginate($perPage);

        // Tambahkan resolusi jam dinamis pada tiap item
        $referenceDate = Carbon::now('Asia/Jakarta');
        $items = collect($schedules->items())->map(function ($schedule) use ($referenceDate) {
            $scheduleArray = $schedule->toArray();
            $scheduleArray['resolved_times'] = $this->periodResolver->getScheduleTimes($schedule, $referenceDate);
            return $scheduleArray;
        });

        return response()->json([
            'success' => true,
            'message' => 'Data jadwal berhasil diambil.',
            'data' => $items,
            'meta' => [
                'current_page' => $schedules->currentPage(),
                'per_page' => $schedules->perPage(),
                'total' => $schedules->total(),
                'last_page' => $schedules->lastPage(),
                'cycle' => $cycle,
            ],
        ], 200);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cycle_type' => 'required|integer|in:1,2',
            'period_number' => 'required|integer|min:1',
            'duration_periods' => 'nullable|integer|min:1',
            'teacher_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')
                    ->where('role', 'teacher')
                    ->whereNull('deleted_at'),
            ],
            'class_id' => [
                'required',
                'integer',
                Rule::exists('classes', 'id')->whereNull('deleted_at'),
            ],
            'room_id' => [
                'required',
                'integer',
                Rule::exists('rooms', 'id')->whereNull('deleted_at'),
            ],
            'subject_id' => [
                'required',
                'integer',
                Rule::exists('subjects', 'id')->whereNull('deleted_at'),
            ],
            'day_of_week' => 'required|integer|between:1,7',
            'password' => 'required|string',
        ]);

        if ($error = $this->passwordIsConfirmed($request)) {
            return $error;
        }

        $data = collect($validated)->except('password')->all();
        $data['duration_periods'] = $data['duration_periods'] ?? 1;
        $data['source'] = 'manual';

        $schedule = DB::transaction(function () use ($data) {
            $this->lockResources($data);

            if ($this->conflicts->findConflicts($data)->isNotEmpty()) {
                return null;
            }

            return Schedule::create($data);
        });

        if ($schedule === null) {
            return response()->json([
                'success' => false,
                'message' => 'Jadwal bentrok!',
                'errors' => [
                    'schedule' => ['Terjadi bentrok guru, kelas atau ruangan pada jadwal.'],
                ],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil dibuat',
            'data' => $schedule,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'cycle_type' => 'required|integer|in:1,2',
            'period_number' => 'required|integer|min:1',
            'duration_periods' => 'nullable|integer|min:1',
            'teacher_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')
                    ->where('role', 'teacher')
                    ->whereNull('deleted_at'),
            ],
            'class_id' => [
                'required',
                'integer',
                Rule::exists('classes', 'id')->whereNull('deleted_at'),
            ],
            'room_id' => [
                'required',
                'integer',
                Rule::exists('rooms', 'id')->whereNull('deleted_at'),
            ],
            'subject_id' => [
                'required',
                'integer',
                Rule::exists('subjects', 'id')->whereNull('deleted_at'),
            ],
            'day_of_week' => 'required|integer|between:1,7',
            'password' => 'required|string',
        ]);

        if ($error = $this->passwordIsConfirmed($request)) {
            return $error;
        }

        $payload = collect($validated)->except('password')->all();

        $schedule = DB::transaction(function () use ($id, $payload) {
            $schedule = Schedule::lockForUpdate()->findOrFail($id);

            $data = array_merge($schedule->only([
                'cycle_type',
                'period_number',
                'duration_periods',
                'teacher_id',
                'class_id',
                'room_id',
                'subject_id',
                'day_of_week',
            ]), $payload);

            $data['duration_periods'] = $data['duration_periods'] ?? 1;

            $this->lockResources($data);

            if ($this->conflicts->findConflicts($data, ignoreId: $schedule->id)->isNotEmpty()) {
                return null;
            }

            $schedule->update($data);

            return $schedule;
        });

        if ($schedule === null) {
            return response()->json([
                'success' => false,
                'message' => 'Jadwal bentrok!',
                'errors' => [
                    'schedule' => ['Terjadi bentrok guru, kelas atau ruangan pada jadwal.'],
                ],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil diperbarui',
            'data' => $schedule->fresh(),
        ], 200);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        if ($error = $this->passwordIsConfirmed($request)) {
            return $error;
        }

        $schedule = Schedule::findOrFail($id);
        $schedule->delete();

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil dihapus',
            'data' => null,
        ], 200);
    }
}
