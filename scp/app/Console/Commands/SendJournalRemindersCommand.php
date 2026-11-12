<?php

namespace App\Console\Commands;

use App\Models\Notification;
use App\Models\Schedule;
use App\Models\SystemConfiguration;
use App\Models\User;
use App\Services\AcademicCalendarExclusionService;
use App\Services\PeriodResolutionService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SendJournalRemindersCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'scp:notify-journal-reminders';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Kirim notifikasi pengingat pengisian jurnal mengajar setiap 5 menit untuk sesi KBM aktif';

    public function handle(
        PeriodResolutionService $periodResolver,
        AcademicCalendarExclusionService $exclusionService
    ): int {
        $now = Carbon::now('Asia/Jakarta');
        $dayOfWeek = (int) $now->dayOfWeekIso;

        if ($dayOfWeek < 1 || $dayOfWeek > 5) {
            $this->info('Hari ini bukan hari KBM aktif (akhir pekan).');
            return Command::SUCCESS;
        }

        $activeCycle = (int) (SystemConfiguration::first()?->active_cycle ?? 1);

        $schedules = Schedule::where('day_of_week', $dayOfWeek)
            ->where('cycle_type', $activeCycle)
            ->with([
                'schoolClass:id,name,level',
                'teacher:id,name,nis_nip',
                'subject:id,name',
                'journals' => fn ($jq) => $jq->whereDate('date', $now->toDateString()),
            ])
            ->get();

        $notificationsSent = 0;

        foreach ($schedules as $sched) {
            if (!$sched->teacher_id) {
                continue;
            }

            $classLevel = $sched->schoolClass?->level;
            if ($classLevel !== null && $exclusionService->getActiveDisablingEvent($sched->class_id, $classLevel, $now)) {
                continue;
            }

            $todayJournal = $sched->journals->first();
            if ($todayJournal && in_array($todayJournal->status, ['completed', 'teacher_absent'])) {
                continue;
            }

            $times = $periodResolver->getScheduleTimes($sched, $now);
            if (empty($times['start_time'])) {
                continue;
            }

            $startTime = Carbon::parse($now->toDateString() . ' ' . $times['start_time'], 'Asia/Jakarta');
            $deadline = $startTime->copy()->addMinutes(30);

            // Muncul mulai jam pelajaran dimulai s.d. 30 menit setelah jam pelajaran dimulai
            if ($now->greaterThanOrEqualTo($startTime) && $now->lessThanOrEqualTo($deadline)) {
                $remainingMinutes = max(1, (int) $now->diffInMinutes($deadline, false));
                $startTimeStr = $startTime->format('H:i');
                $deadlineStr = $deadline->format('H:i');
                $className = $sched->schoolClass?->name ?? 'Kelas';
                $subjectName = $sched->subject?->name ?? 'Mata Pelajaran';

                // Cek notifikasi serupa dalam 5 menit terakhir
                $recentNotif = Notification::forUser($sched->teacher_id)
                    ->where('type', 'journal_reminder')
                    ->whereDate('created_at', $now->toDateString())
                    ->where('data->schedule_id', $sched->id)
                    ->where('created_at', '>=', $now->copy()->subMinutes(5))
                    ->first();

                if (!$recentNotif) {
                    Notification::create([
                        'user_id' => $sched->teacher_id,
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
                    $notificationsSent++;
                }
            }
        }

        $this->info("Pemeriksaan selesai. Dikirim {$notificationsSent} notifikasi pengingat jurnal.");
        return Command::SUCCESS;
    }
}
