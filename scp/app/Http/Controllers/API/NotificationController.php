<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Schedule;
use App\Models\SystemConfiguration;
use App\Models\User;
use App\Services\AcademicCalendarExclusionService;
use App\Services\PeriodResolutionService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    protected PeriodResolutionService $periodResolver;
    protected AcademicCalendarExclusionService $exclusionService;

    public function __construct(
        PeriodResolutionService $periodResolver,
        AcademicCalendarExclusionService $exclusionService
    ) {
        $this->periodResolver = $periodResolver;
        $this->exclusionService = $exclusionService;
    }

    /**
     * Mengambil daftar notifikasi milik pengguna saat ini.
     * Secara otomatis membangkitkan pengingat jurnal setiap 5 menit selama sesi KBM aktif jika pengguna adalah Guru.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Bangkitkan pengingat otomatis jika pengguna adalah Guru
        if ($user && $user->role === 'teacher') {
            $this->generateAutomaticJournalReminders($user);
        }

        $userId = $user->id;

        $notifications = Notification::forUser($userId)
            ->with('sender:id,name,role')
            ->orderByDesc('created_at')
            ->take(20)
            ->get();

        $unreadCount = Notification::forUser($userId)
            ->unread()
            ->count();

        return response()->json([
            'success' => true,
            'message' => 'Daftar notifikasi berhasil dimuat.',
            'data' => $notifications,
            'meta' => [
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    /**
     * Memeriksa dan membuat notifikasi pengingat otomatis setiap 5 menit
     * bagi guru yang memiliki sesi KBM aktif (antara jam mulai s.d. 30 menit setelah mulai)
     * yang belum diisi jurnalnya.
     */
    protected function generateAutomaticJournalReminders(User $user): void
    {
        $now = Carbon::now('Asia/Jakarta');
        $dayOfWeek = (int) $now->dayOfWeekIso;
        if ($dayOfWeek < 1 || $dayOfWeek > 5) {
            return;
        }

        $activeCycle = (int) (SystemConfiguration::first()?->active_cycle ?? 1);

        $schedules = Schedule::where('teacher_id', $user->id)
            ->where('day_of_week', $dayOfWeek)
            ->where('cycle_type', $activeCycle)
            ->with([
                'schoolClass:id,name,level',
                'subject:id,name',
                'journals' => fn ($jq) => $jq->whereDate('date', $now->toDateString()),
            ])
            ->get();

        foreach ($schedules as $sched) {
            $classLevel = $sched->schoolClass?->level;
            if ($classLevel !== null && $this->exclusionService->getActiveDisablingEvent($sched->class_id, $classLevel, $now)) {
                continue;
            }

            $todayJournal = $sched->journals->first();
            if ($todayJournal && in_array($todayJournal->status, ['completed', 'teacher_absent'])) {
                continue;
            }

            $times = $this->periodResolver->getScheduleTimes($sched, $now);
            if (empty($times['start_time'])) {
                continue;
            }

            $startTime = Carbon::parse($now->toDateString() . ' ' . $times['start_time'], 'Asia/Jakarta');
            $deadline = $startTime->copy()->addMinutes(30);

            // Aturan Baru: Mulai muncul setelah jam pelajaran dimulai s.d. 30 menit setelah jam pelajaran dimulai
            if ($now->greaterThanOrEqualTo($startTime) && $now->lessThanOrEqualTo($deadline)) {
                $remainingMinutes = max(1, (int) $now->diffInMinutes($deadline, false));
                $startTimeStr = $startTime->format('H:i');
                $deadlineStr = $deadline->format('H:i');
                $className = $sched->schoolClass?->name ?? 'Kelas';
                $subjectName = $sched->subject?->name ?? 'Mata Pelajaran';

                // Cek notifikasi serupa dalam 5 menit terakhir untuk schedule ini hari ini
                $recentNotif = Notification::forUser($user->id)
                    ->where('type', 'journal_reminder')
                    ->whereDate('created_at', $now->toDateString())
                    ->where('data->schedule_id', $sched->id)
                    ->where('created_at', '>=', $now->copy()->subMinutes(5))
                    ->first();

                if (!$recentNotif) {
                    Notification::create([
                        'user_id' => $user->id,
                        'sender_id' => null,
                        'title' => 'Pengingat Pengisian Jurnal KBM',
                        'message' => "Sesi KBM {$subjectName} di kelas {$className} (Jam ke-{$sched->period_number}) telah dimulai pukul {$startTimeStr} WIB. Batas waktu pengisian adalah 30 menit setelah KBM dimulai (hingga {$deadlineStr} WIB, sisa {$remainingMinutes} menit). Mohon segera melengkapi jurnal KBM.",
                        'type' => 'journal_reminder',
                        'action_url' => '/teacher/journal',
                        'data' => [
                            'schedule_id' => $sched->id,
                            'class_name' => $className,
                            'subject_name' => $subjectName,
                            'period_number' => $sched->period_number,
                            'start_time' => $startTimeStr,
                            'deadline' => $deadlineStr,
                            'remaining_minutes' => $remainingMinutes,
                        ],
                    ]);
                }
            }
        }
    }

    /**
     * Menandai satu notifikasi sebagai sudah dibaca.
     */
    public function markAsRead(Request $request, int $id): JsonResponse
    {
        $userId = $request->user()->id;

        $notification = Notification::forUser($userId)->find($id);

        if (!$notification) {
            return response()->json([
                'success' => false,
                'message' => 'Notifikasi tidak ditemukan.',
            ], 404);
        }

        if (!$notification->read_at) {
            $notification->update(['read_at' => now()]);
        }

        $unreadCount = Notification::forUser($userId)
            ->unread()
            ->count();

        return response()->json([
            'success' => true,
            'message' => 'Notifikasi telah ditandai sebagai dibaca.',
            'data' => $notification,
            'meta' => [
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    /**
     * Menandai semua notifikasi milik pengguna sebagai sudah dibaca.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        Notification::forUser($userId)
            ->unread()
            ->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Semua notifikasi telah ditandai sebagai dibaca.',
            'meta' => [
                'unread_count' => 0,
            ],
        ]);
    }

    /**
     * Mengirimkan pengingat keterlambatan pengisian jurnal KBM oleh Waka ke Guru.
     */
    public function remindJournal(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'vice_principal') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya Waka Kurikulum yang memiliki wewenang mengirimkan pengingat jurnal.',
            ], 403);
        }

        $validated = $request->validate([
            'schedule_id' => 'required|integer|exists:schedules,id',
            'teacher_id' => 'required|integer|exists:users,id',
            'custom_message' => 'nullable|string|max:500',
        ]);

        $schedule = Schedule::with(['schoolClass', 'subject', 'teacher'])->findOrFail($validated['schedule_id']);
        $teacher = User::findOrFail($validated['teacher_id']);

        // Anti-spam check: jika dalam 5 menit terakhir sudah ada notifikasi serupa, perbarui statusnya
        $recent = Notification::forUser($teacher->id)
            ->where('type', 'journal_reminder')
            ->where('data->schedule_id', $schedule->id)
            ->where('created_at', '>=', now()->subMinutes(5))
            ->first();

        if ($recent) {
            $recent->update([
                'read_at' => null,
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => "Pengingat KBM telah diperbarui dan dikirimkan ulang ke {$teacher->name}.",
                'data' => $recent,
            ]);
        }

        $className = $schedule->schoolClass?->name ?? 'Kelas';
        $subjectName = $schedule->subject?->name ?? 'Mata Pelajaran';
        $periodInfo = "Jam ke-{$schedule->period_number}";

        $times = $this->periodResolver->getScheduleTimes($schedule, now('Asia/Jakarta'));
        $startTimeStr = !empty($times['start_time']) ? Carbon::parse($times['start_time'])->format('H:i') : 'KBM';
        $deadlineStr = !empty($times['start_time']) ? Carbon::parse($times['start_time'])->addMinutes(30)->format('H:i') : 'batas waktu';

        $message = $validated['custom_message'] ?? "Pengingat Waka Kurikulum: Sesi KBM {$subjectName} di kelas {$className} ({$periodInfo}) telah dimulai pukul {$startTimeStr} WIB. Batas waktu pengisian jurnal adalah 30 menit setelah KBM dimulai (hingga {$deadlineStr} WIB). Mohon segera melengkapi jurnal KBM.";

        $notification = Notification::create([
            'user_id' => $teacher->id,
            'sender_id' => $user->id,
            'title' => 'Peringatan Pengisian Jurnal KBM',
            'message' => $message,
            'type' => 'journal_reminder',
            'action_url' => '/teacher/journal',
            'data' => [
                'schedule_id' => $schedule->id,
                'class_name' => $className,
                'subject_name' => $subjectName,
                'period_number' => $schedule->period_number,
                'start_time' => $startTimeStr,
                'deadline' => $deadlineStr,
                'sender_name' => $user->name,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Pengingat KBM berhasil dikirimkan ke {$teacher->name}.",
            'data' => $notification,
        ], 201);
    }
}
