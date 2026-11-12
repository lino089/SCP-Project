<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classes;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\SystemConfiguration;
use App\Models\User;
use App\Services\AcademicCalendarExclusionService;
use App\Services\PeriodResolutionService;
use App\Services\ScheduleConflictService;
use App\Services\MasterDataPrerequisiteService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ScheduleController extends Controller
{
    public function __construct(
        private ScheduleConflictService $conflicts,
        private PeriodResolutionService $periodResolver,
        private MasterDataPrerequisiteService $prerequisites,
        private AcademicCalendarExclusionService $exclusionService
    ) {
    }

    private function lockResources(array $data): void
    {
        User::whereKey($data['teacher_id'])->lockForUpdate()->first();
        Classes::whereKey($data['class_id'])->lockForUpdate()->first();
        Room::whereKey($data['room_id'])->lockForUpdate()->first();
    }

    /**
     * Menampilkan daftar jadwal pelajaran atau alert jurnal terlambat (PRD 5.6 & 9.4).
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'cycle' => 'nullable|integer|in:1,2',
            'day' => 'nullable|integer|between:1,7',
            'date' => 'nullable|date_format:Y-m-d',
            'class_id' => 'nullable|integer|exists:classes,id',
            'class_ids' => 'nullable',
            'teacher_id' => 'nullable|integer|exists:users,id',
            'status' => 'nullable|string|in:missing_journal',
            'per_page' => 'nullable|integer|min:1|max:1000',
            'all' => 'nullable|boolean',
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
                    'teacher:id,name,nis_nip',
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
            } elseif ($user->role === 'student' || $user->role === 'parent') {
                return response()->json([
                    'success' => false,
                    'message' => 'Akses ditolak.',
                ], 403);
            }

            if ($request->filled('class_id')) {
                $query->where('class_id', $request->input('class_id'));
            }

            $candidateSchedules = $query->orderBy('period_number')->get();
            $missingSchedules = [];

            foreach ($candidateSchedules as $schedule) {
                // Jadwal pada kelas/tingkat yang sedang dikecualikan oleh agenda kalender akademik
                $classLevel = $schedule->schoolClass?->level;
                if ($classLevel !== null && $this->exclusionService->getActiveDisablingEvent($schedule->class_id, $classLevel, $now)) {
                    continue;
                }

                $todayJournal = $schedule->journals->first();

                // Jadwal yang sudah memiliki jurnal berstatus completed dikecualikan
                if ($todayJournal && $todayJournal->status === 'completed') {
                    continue;
                }

                // Jadwal dengan status teacher_absent dikecualikan sesuai PRD 5.6 & 5.7
                if ($todayJournal && $todayJournal->status === 'teacher_absent') {
                    continue;
                }

                // Cek apakah waktu mulai jadwal + 30 menit sudah terlewat (Aturan Baru)
                if ($this->periodResolver->isSchedulePastTolerance($schedule, $now)) {
                    $times = $this->periodResolver->getScheduleTimes($schedule, $now);
                    $startTimeString = is_string($times['start_time']) ? $times['start_time'] : (string) $times['start_time'];
                    $deadline = Carbon::parse($now->toDateString() . ' ' . $startTimeString, 'Asia/Jakarta')->addMinutes(30);

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

        $referenceDate = $request->filled('date')
            ? Carbon::parse($request->input('date'), 'Asia/Jakarta')
            : Carbon::now('Asia/Jakarta');
        $targetDateStr = $referenceDate->toDateString();

        $query = Schedule::query()
            ->where('cycle_type', $cycle)
            ->with([
                'schoolClass:id,name,level',
                'teacher:id,name,nis_nip',
                'room:id,name,capacity',
                'subject:id,name',
                'journals' => fn ($jq) => $jq->whereDate('date', $targetDateStr),
            ]);

        // Scoping: Guru hanya melihat jadwal miliknya sendiri, kecuali Wali Kelas meminta jadwal kelas binaannya
        if ($user->role === 'teacher') {
            $homeroomIds = $user->homeroomClassIds();
            $isRequestingOwnHomeroom = $request->filled('class_id') && in_array($request->integer('class_id'), $homeroomIds);

            if ($isRequestingOwnHomeroom) {
                // Wali Kelas meminta jadwal kelas binaannya: buka akses seluruh jadwal pada kelas tersebut
                $query->where('class_id', $request->integer('class_id'));
            } else {
                // Guru biasa, ATAU Wali Kelas tanpa filter class_id, ATAU meminta kelas lain di luar binaannya:
                // Kunci jadwal mengajar pribadinya ATAU jadwal yang digantikannya (inval) pada tanggal tersebut
                $query->where(function ($q) use ($user, $targetDateStr) {
                    $q->where('teacher_id', $user->id)
                      ->orWhereHas('journals', function ($jq) use ($user, $targetDateStr) {
                          $jq->where('substitute_teacher_id', $user->id)
                             ->whereDate('date', $targetDateStr);
                      });
                });

                if ($request->filled('class_id')) {
                    $query->where('class_id', $request->integer('class_id'));
                }
            }
        } elseif ($user->role === 'vice_principal') {
            if ($request->filled('teacher_id')) {
                $query->where('teacher_id', $request->input('teacher_id'));
            }

            if ($request->filled('class_id')) {
                $query->where('class_id', $request->input('class_id'));
            } elseif ($request->filled('class_ids')) {
                $rawIds = $request->input('class_ids');
                $ids = is_array($rawIds) ? $rawIds : explode(',', (string) $rawIds);
                $cleanIds = array_filter(array_map('intval', $ids));
                if (!empty($cleanIds)) {
                    $query->whereIn('class_id', $cleanIds);
                }
            }
        } elseif ($user->role === 'student') {
            if ($user->class_id) {
                $query->where('class_id', $user->class_id);
            } else {
                $query->whereRaw('1 = 0');
            }
        } elseif ($user->role === 'parent') {
            $childClassId = $user->linkedStudent?->class_id;
            if ($childClassId) {
                $query->where('class_id', $childClassId);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if ($request->filled('day')) {
            $query->where('day_of_week', $request->input('day'));
        }

        $isAll = $request->boolean('all') || ($user->role === 'vice_principal' && $request->integer('per_page') >= 1000);

        $config = SystemConfiguration::first();
        $mondayIsUpacara = $config ? (bool) $config->monday_is_upacara : true;

        $mapScheduleItem = function ($schedule) use ($referenceDate, $mondayIsUpacara, $user) {
            // Resolusi tanggal jadwal dalam minggu referenceDate
            $startOfWeek = $referenceDate->copy()->startOfWeek(Carbon::MONDAY);
            $scheduleDate = $startOfWeek->copy()->addDays(max(0, ((int) $schedule->day_of_week) - 1));

            $scheduleArray = $schedule->toArray();
            $scheduleArray['resolved_times'] = $this->periodResolver->getScheduleTimes($schedule, $scheduleDate, $mondayIsUpacara);
            $todayJournal = $schedule->journals?->first();
            $scheduleArray['journal_status'] = $todayJournal ? $todayJournal->status : 'not_started';
            $scheduleArray['journal_id'] = $todayJournal ? $todayJournal->id : null;
            $scheduleArray['substitute_teacher_id'] = $todayJournal?->substitute_teacher_id;
            $scheduleArray['is_substitute'] = ($user->role === 'teacher' && (int)$todayJournal?->substitute_teacher_id === (int)$user->id && (int)$schedule->teacher_id !== (int)$user->id);
            $scheduleArray['original_teacher_name'] = $schedule->teacher?->name;

            if ($scheduleArray['is_substitute']) {
                $targetDateStr = $scheduleDate->toDateString();
                $leaveRequest = \App\Models\TeacherLeaveRequest::where('teacher_id', $schedule->teacher_id)
                    ->whereDate('date', $targetDateStr)
                    ->where('status', 'approved')
                    ->first();
                if ($leaveRequest) {
                    $scheduleArray['leave_task_instruction'] = $leaveRequest->task_instruction;
                    $scheduleArray['leave_task_attachment_path'] = $leaveRequest->task_attachment_path;
                }
            }

            // Deteksi status pengecualian dari kalender akademik
            $classLevel = $schedule->schoolClass?->level;
            $disablingEvent = $classLevel !== null
                ? $this->exclusionService->getActiveDisablingEvent($schedule->class_id, $classLevel, $scheduleDate)
                : null;

            $isExempted = $disablingEvent !== null;
            $scheduleArray['is_teaching_exempted'] = $isExempted;
            $scheduleArray['exemption_reason'] = $disablingEvent?->title;
            $scheduleArray['event_type'] = $disablingEvent?->type;
            $scheduleArray['academic_event_id'] = $disablingEvent?->id;

            if ($isExempted && (!$todayJournal || $todayJournal->status === 'ongoing')) {
                $scheduleArray['journal_status'] = 'exempted';
            }

            return $scheduleArray;
        };

        if ($isAll) {
            $allSchedules = $query->orderBy('day_of_week')->orderBy('period_number')->get();
            $items = $allSchedules->map($mapScheduleItem);

            return response()->json([
                'success' => true,
                'message' => 'Data jadwal berhasil diambil.',
                'data' => $items,
                'meta' => [
                    'current_page' => 1,
                    'per_page' => $allSchedules->count(),
                    'total' => $allSchedules->count(),
                    'last_page' => 1,
                    'cycle' => $cycle,
                ],
            ], 200);
        }

        $schedules = $query->orderBy('day_of_week')->orderBy('period_number')->paginate($perPage);
        $items = collect($schedules->items())->map($mapScheduleItem);

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
        $prerequisiteCheck = $this->prerequisites->validateForManualSchedule();
        if (!$prerequisiteCheck['is_valid']) {
            return response()->json([
                'success' => false,
                'message' => 'Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.',
                'errors' => $prerequisiteCheck['errors'],
                'meta' => [
                    'missing_entities' => $prerequisiteCheck['missing'],
                ],
            ], 422);
        }

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

        $periodNumber = (int) $data['period_number'];
        $durationPeriods = (int) $data['duration_periods'];
        $endPeriod = $periodNumber + $durationPeriods - 1;
        $dayOfWeek = (int) $data['day_of_week'];

        $maxPeriod = $dayOfWeek === 5 ? 8 : 10;
        if ($endPeriod > $maxPeriod) {
            $msg = $dayOfWeek === 5
                ? 'Jadwal hari Jumat maksimal sampai periode ke-8 (13:50 WIB).'
                : 'Jadwal hari Senin–Kamis maksimal sampai periode ke-10 (15:10 WIB).';
            return response()->json([
                'success' => false,
                'message' => 'Periode melebihi batas operasional.',
                'errors' => [
                    'period_number' => [$msg],
                ],
            ], 422);
        }

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

    public function update(Request $request, $id): JsonResponse
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

        $targetSchedule = Schedule::findOrFail($id);
        $dayOfWeek = (int) ($payload['day_of_week'] ?? $targetSchedule->day_of_week);
        $periodNumber = (int) ($payload['period_number'] ?? $targetSchedule->period_number);
        $durationPeriods = (int) ($payload['duration_periods'] ?? $targetSchedule->duration_periods ?? 1);
        $endPeriod = $periodNumber + $durationPeriods - 1;

        $maxPeriod = $dayOfWeek === 5 ? 8 : 10;
        if ($endPeriod > $maxPeriod) {
            $msg = $dayOfWeek === 5
                ? 'Jadwal hari Jumat maksimal sampai periode ke-8 (13:50 WIB).'
                : 'Jadwal hari Senin–Kamis maksimal sampai periode ke-10 (15:10 WIB).';
            return response()->json([
                'success' => false,
                'message' => 'Periode melebihi batas operasional.',
                'errors' => [
                    'period_number' => [$msg],
                ],
            ], 422);
        }

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

    public function destroy(Request $request, $id): JsonResponse
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

    /**
     * Reset seluruh data jadwal pelajaran secara permanen (Hard Delete) (Keamanan Reset Data / PRD 6.4).
     * POST /api/schedules/reset
     *
     * Alur:
     * 1. Verifikasi Password pengguna di Backend (Step-Up Auth)
     * 2. Eksekusi penghapusan permanen berjenjang via DB::transaction:
     *    - Hapus attendances terikat journals
     *    - Hapus file fisik foto journals dari storage
     *    - Hapus journals yang merujuk ke schedules
     *    - Bersihkan schedule_ids pada teacher_leave_requests
     *    - Hapus staging schedule_import_rows dan schedule_imports
     *    - Force delete / hard delete seluruh baris schedules
     */
    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        // 1. Verifikasi Password di Backend
        if ($error = $this->passwordIsConfirmed($request)) {
            return $error;
        }

        // 2. Eksekusi penghapusan permanen berjenjang via DB::transaction
        $deletedCount = DB::transaction(function () {
            $count = Schedule::withTrashed()->count();

            // a. Ambil jurnal terikat dan bersihkan foto fisik di storage
            if (Schema::hasTable('journals')) {
                $journals = DB::table('journals')->get(['id', 'photo_path']);
                $journalIds = $journals->pluck('id')->all();

                if (!empty($journalIds)) {
                    // Hapus data presensi terikat jurnal
                    if (Schema::hasTable('attendances')) {
                        DB::table('attendances')->whereIn('journal_id', $journalIds)->delete();
                    }

                    // Hapus berkas fisik foto jurnal dari storage
                    $disk = config('filesystems.default', 'public');
                    foreach ($journals as $journal) {
                        if (!empty($journal->photo_path) && Storage::disk($disk)->exists($journal->photo_path)) {
                            Storage::disk($disk)->delete($journal->photo_path);
                        }
                    }

                    // Hapus baris jurnal
                    DB::table('journals')->whereIn('id', $journalIds)->delete();
                }
            }

            // b. Bersihkan referensi schedule_ids di teacher_leave_requests
            if (Schema::hasTable('teacher_leave_requests')) {
                DB::table('teacher_leave_requests')->whereNotNull('schedule_ids')->update(['schedule_ids' => null]);
            }

            // c. Bersihkan baris staging impor jadwal jika ada
            if (Schema::hasTable('schedule_import_rows')) {
                DB::table('schedule_import_rows')->delete();
            }
            if (Schema::hasTable('schedule_imports')) {
                DB::table('schedule_imports')->delete();
            }

            // d. Hapus permanen seluruh jadwal (termasuk yang berstatus soft-deleted)
            Schedule::withTrashed()->forceDelete();

            return $count;
        });

        return response()->json([
            'success' => true,
            'message' => "Seluruh Data Jadwal berhasil di-reset secara permanen ({$deletedCount} jadwal dihapus).",
            'data' => [
                'deleted_count' => $deletedCount,
            ],
        ], 200);
    }

    /**
     * Ekspor data jadwal pelajaran untuk Waka Kurikulum.
     * GET /api/schedules/export
     */
    public function export(Request $request): JsonResponse
    {
        $query = Schedule::with([
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

        if ($request->filled('level')) {
            $query->whereHas('schoolClass', function ($q) use ($request) {
                $q->where('level', $request->integer('level'));
            });
        }

        $schedules = $query->orderBy('cycle_type')
            ->orderBy('class_id')
            ->orderBy('day_of_week')
            ->orderBy('period_number')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $schedules,
            'meta' => [
                'total' => $schedules->count(),
            ],
        ], 200);
    }
}
