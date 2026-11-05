<?php

namespace App\Services;

use App\Models\AcademicEvent;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Support\Collection;

class AcademicCalendarExclusionService
{
    /**
     * Cache in-memory untuk event aktif per tanggal (Y-m-d).
     * Mencegah N+1 query ketika memeriksa ratusan jadwal KBM.
     *
     * @var array<string, Collection>
     */
    protected static array $eventsByDateCache = [];

    /**
     * Membersihkan cache in-memory (berguna saat test atau setelah mutasi event).
     */
    public static function clearCache(): void
    {
        self::$eventsByDateCache = [];
    }

    /**
     * Mengambil seluruh agenda aktif pada suatu tanggal (ter-cache per tanggal).
     */
    public function getEventsForDate(Carbon|string $date): Collection
    {
        $dateStr = $date instanceof Carbon ? $date->toDateString() : Carbon::parse($date)->toDateString();

        if (!isset(self::$eventsByDateCache[$dateStr])) {
            self::$eventsByDateCache[$dateStr] = AcademicEvent::query()
                ->whereDate('start_date', '<=', $dateStr)
                ->whereDate('end_date', '>=', $dateStr)
                ->orderBy('start_date')
                ->get();
        }

        return self::$eventsByDateCache[$dateStr];
    }

    /**
     * Normalisasi tingkatan kelas ke string standar ('10', '11', '12').
     */
    public function normalizeGrade(int|string $gradeLevel): string
    {
        $g = trim(strtoupper((string) $gradeLevel));
        return match ($g) {
            'X', '10' => '10',
            'XI', '11' => '11',
            'XII', '12' => '12',
            default => $g,
        };
    }

    /**
     * Memeriksa apakah suatu event berlaku untuk kelas & tingkat tertentu.
     */
    public function isEventApplicableToClass(AcademicEvent $event, int $classId, int|string $gradeLevel): bool
    {
        if ($event->scope_type === AcademicEvent::SCOPE_ALL) {
            return true;
        }

        $targets = $event->scope_targets ?? [];
        if (!is_array($targets)) {
            return false;
        }

        if ($event->scope_type === AcademicEvent::SCOPE_GRADE) {
            $normGrade = $this->normalizeGrade($gradeLevel);
            $normTargets = array_map(fn ($t) => $this->normalizeGrade($t), $targets);
            return in_array($normGrade, $normTargets, true);
        }

        if ($event->scope_type === AcademicEvent::SCOPE_CLASS) {
            $intTargets = array_map('intval', $targets);
            return in_array((int) $classId, $intTargets, true);
        }

        return false;
    }

    /**
     * Mendapatkan event yang menonaktifkan KBM (disables_teaching = true)
     * untuk kelas tertentu pada tanggal tertentu.
     * Mengembalikan null jika KBM berjalan normal.
     */
    public function getActiveDisablingEvent(int $classId, int|string $gradeLevel, Carbon|string $date): ?AcademicEvent
    {
        $events = $this->getEventsForDate($date);

        $disablingEvents = $events
            ->filter(fn (AcademicEvent $e) => (bool) $e->disables_teaching)
            ->filter(fn (AcademicEvent $e) => $this->isEventApplicableToClass($e, $classId, $gradeLevel));

        if ($disablingEvents->isEmpty()) {
            return null;
        }

        // Prioritas resolusi jika terdapat beberapa event yang menonaktifkan KBM:
        // 1. Holiday dengan cakupan All
        // 2. Event lain dengan cakupan All
        // 3. Event cakupan Grade
        // 4. Event cakupan Class
        return $disablingEvents->sort(function (AcademicEvent $a, AcademicEvent $b) {
            $weightA = match ($a->scope_type) {
                AcademicEvent::SCOPE_ALL => ($a->type === AcademicEvent::TYPE_HOLIDAY ? 4 : 3),
                AcademicEvent::SCOPE_GRADE => 2,
                AcademicEvent::SCOPE_CLASS => 1,
                default => 0,
            };
            $weightB = match ($b->scope_type) {
                AcademicEvent::SCOPE_ALL => ($b->type === AcademicEvent::TYPE_HOLIDAY ? 4 : 3),
                AcademicEvent::SCOPE_GRADE => 2,
                AcademicEvent::SCOPE_CLASS => 1,
                default => 0,
            };

            return $weightB <=> $weightA;
        })->first();
    }

    /**
     * Mendapatkan seluruh agenda aktif (baik yang menonaktifkan KBM maupun tidak)
     * untuk suatu kelas pada tanggal tertentu (untuk banner/dashboard).
     */
    public function getActiveEventsForClass(int $classId, int|string $gradeLevel, Carbon|string $date): Collection
    {
        return $this->getEventsForDate($date)
            ->filter(fn (AcademicEvent $e) => $this->isEventApplicableToClass($e, $classId, $gradeLevel))
            ->values();
    }

    /**
     * Mengambil agenda dalam rentang tanggal untuk kalender visual.
     */
    public function getEventsForRange(
        Carbon|string $startDate,
        Carbon|string $endDate,
        ?int $classId = null,
        int|string|null $gradeLevel = null
    ): Collection {
        $startStr = $startDate instanceof Carbon ? $startDate->toDateString() : Carbon::parse($startDate)->toDateString();
        $endStr = $endDate instanceof Carbon ? $endDate->toDateString() : Carbon::parse($endDate)->toDateString();

        $events = AcademicEvent::query()
            ->where(function ($q) use ($startStr, $endStr) {
                $q->whereBetween('start_date', [$startStr, $endStr])
                    ->orWhereBetween('end_date', [$startStr, $endStr])
                    ->orWhere(function ($sub) use ($startStr, $endStr) {
                        $sub->where('start_date', '<=', $startStr)
                            ->where('end_date', '>=', $endStr);
                    });
            })
            ->orderBy('start_date')
            ->get();

        if ($classId !== null && $gradeLevel !== null) {
            $events = $events->filter(fn (AcademicEvent $e) => $this->isEventApplicableToClass($e, $classId, $gradeLevel))->values();
        }

        return $events;
    }

    /**
     * Melakukan pre-load seluruh event dalam rentang tanggal ke dalam static cache
     * dalam 1 query DB tunggal. Mempercepat kalkulasi rekapitulasi multi-hari.
     */
    public function preloadEventsForRange(Carbon|string $startDate, Carbon|string $endDate): void
    {
        $start = $startDate instanceof Carbon ? $startDate->copy()->startOfDay() : Carbon::parse($startDate)->startOfDay();
        $end = $endDate instanceof Carbon ? $endDate->copy()->startOfDay() : Carbon::parse($endDate)->startOfDay();

        $events = $this->getEventsForRange($start, $end);

        $period = CarbonPeriod::create($start, $end);
        foreach ($period as $date) {
            $dateStr = $date->toDateString();
            self::$eventsByDateCache[$dateStr] = $events->filter(function (AcademicEvent $e) use ($dateStr) {
                $eventStart = $e->start_date instanceof Carbon ? $e->start_date->toDateString() : (string) $e->start_date;
                $eventEnd = $e->end_date instanceof Carbon ? $e->end_date->toDateString() : (string) $e->end_date;
                return $eventStart <= $dateStr && $eventEnd >= $dateStr;
            })->values();
        }
    }

    /**
     * Resolusi panduan kepastian kehadiran bagi Siswa dan Orang Tua.
     */
    public function getAttendanceGuidance(AcademicEvent $event): string
    {
        if ($event->type === AcademicEvent::TYPE_HOLIDAY) {
            return 'Hari Libur Resmi Sekolah — Siswa libur dan belajar mandiri di rumah.';
        }

        if ((bool) $event->disables_teaching) {
            if ($event->type === AcademicEvent::TYPE_EXAM) {
                return 'Masa Penilaian / Ujian — Siswa wajib hadir mengikuti asesmen sesuai jadwal. KBM reguler dialihkan.';
            }

            return 'Kegiatan Wajib Sekolah/Lapangan — Siswa wajib hadir mengikuti agenda kegiatan. KBM reguler di kelas ditiadakan.';
        }

        return 'Kegiatan Pendamping Sekolah — Proses Belajar Mengajar (KBM) reguler tetap berjalan normal.';
    }

    /**
     * Mengevaluasi status mengajar harian guru untuk setiap tanggal dalam rentang tertentu.
     * Mengembalikan array dengan key 'YYYY-MM-DD' => status info.
     *
     * @param \App\Models\User $teacher
     * @param \Illuminate\Support\Collection $schedules
     * @param \Carbon\Carbon $startDate
     * @param \Carbon\Carbon $endDate
     * @return array<string, array>
     */
    public function evaluateDailyTeachingStatus(
        $teacher,
        Collection $schedules,
        Carbon $startDate,
        Carbon $endDate
    ): array {
        $dailyStatus = [];
        $period = CarbonPeriod::create($startDate, $endDate);

        // Preload events for this range
        $this->preloadEventsForRange($startDate, $endDate);

        foreach ($period as $dt) {
            $dateStr = $dt->toDateString();
            // Di SCP, Senin = 1, Minggu = 7 (ISO-8601 day of week)
            $dayOfWeek = (int) $dt->dayOfWeekIso;

            // Jadwal guru pada hari tersebut
            $daySchedules = $schedules->filter(fn ($s) => (int) $s->day_of_week === $dayOfWeek);

            if ($daySchedules->isEmpty()) {
                continue;
            }

            $exemptedClassNames = [];
            $activeClassNames = [];

            foreach ($daySchedules as $sched) {
                $cId = (int) $sched->class_id;
                $level = $sched->schoolClass?->level ?? 10;
                $cName = $sched->schoolClass?->name ?? "Kelas #{$cId}";

                $disablingEvent = $this->getActiveDisablingEvent($cId, $level, $dateStr);

                if ($disablingEvent !== null) {
                    $exemptedClassNames[$cId] = $cName;
                } else {
                    $activeClassNames[$cId] = $cName;
                }
            }

            $exemptedCount = count($exemptedClassNames);
            $activeCount = count($activeClassNames);

            if ($exemptedCount > 0 && $activeCount === 0) {
                $dailyStatus[$dateStr] = [
                    'date' => $dateStr,
                    'status' => 'full_free',
                    'label' => 'Jadwal Anda Bebas',
                    'exempted_classes' => array_values($exemptedClassNames),
                    'active_classes' => [],
                ];
            } elseif ($exemptedCount > 0 && $activeCount > 0) {
                $dailyStatus[$dateStr] = [
                    'date' => $dateStr,
                    'status' => 'partial_teaching',
                    'label' => 'KBM Parsial: Tetap Mengajar di ' . implode(', ', array_values($activeClassNames)),
                    'exempted_classes' => array_values($exemptedClassNames),
                    'active_classes' => array_values($activeClassNames),
                ];
            }
        }

        return $dailyStatus;
    }
}
