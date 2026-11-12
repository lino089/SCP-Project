<?php

namespace App\Services;

use App\Models\PeriodTemplate;
use App\Models\Schedule;
use App\Models\SystemConfiguration;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

class PeriodResolutionService
{
    /**
     * Cache in-memory untuk seluruh baris period_templates (~48 baris).
     * Mencegah N+1 query berulang saat mapping ribuan jadwal KBM.
     */
    protected static ?Collection $templateCache = null;

    /**
     * Membersihkan cache in-memory (berguna saat test atau perubahan setting bel).
     */
    public static function clearCache(): void
    {
        self::$templateCache = null;
    }

    /**
     * Mengambil seluruh template jam dalam satu query tunggal ter-cache.
     */
    protected function getTemplates(): Collection
    {
        if (self::$templateCache === null) {
            self::$templateCache = PeriodTemplate::all();
        }
        return self::$templateCache;
    }

    /**
     * Menentukan tipe hari (day_type) berdasarkan indeks hari dalam minggu (1 = Senin s/d 5 = Jumat).
     */
    public function resolveDayTypeForDayOfWeek(int $dayOfWeek, ?bool $mondayIsUpacara = null): ?string
    {
        if ($dayOfWeek < 1 || $dayOfWeek > 5) {
            return null; // Sabtu & Minggu tidak ada jadwal sekolah
        }

        if ($dayOfWeek === 1 && $mondayIsUpacara === null) {
            $config = SystemConfiguration::first();
            $mondayIsUpacara = $config ? (bool) $config->monday_is_upacara : true;
        }

        return PeriodTemplate::dayTypeFor($dayOfWeek, (bool) $mondayIsUpacara);
    }

    /**
     * Menentukan tipe hari (day_type) berdasarkan tanggal Carbon.
     */
    public function resolveDayType(Carbon $date, ?bool $mondayIsUpacara = null): ?string
    {
        $dayOfWeek = (int) $date->dayOfWeekIso; // 1 = Senin, ..., 7 = Minggu
        return $this->resolveDayTypeForDayOfWeek($dayOfWeek, $mondayIsUpacara);
    }

    /**
     * Menghitung jam mulai dan jam selesai literal (HH:MM:SS) untuk suatu jadwal.
     * Mengutamakan day_of_week dari jadwal agar resolusi jam selalu akurat sesuai hari KBM jadwal tersebut.
     */
    public function getScheduleTimes(Schedule $schedule, ?Carbon $date = null, ?bool $mondayIsUpacara = null): array
    {
        $dayOfWeek = (int) ($schedule->day_of_week ?? ($date ? $date->dayOfWeekIso : 0));
        $dayType = $this->resolveDayTypeForDayOfWeek($dayOfWeek, $mondayIsUpacara);

        if (!$dayType) {
            return [
                'start_time' => null,
                'end_time' => null,
            ];
        }

        $startPeriod = (int) $schedule->period_number;
        $duration = (int) ($schedule->duration_periods ?? 1);
        $endPeriod = $startPeriod + $duration - 1;

        $templates = $this->getTemplates()->where('day_type', $dayType);

        $startTemplate = $templates->firstWhere('period_number', $startPeriod);
        $endTemplate = $templates->firstWhere('period_number', $endPeriod);

        return [
            'start_time' => $startTemplate?->start_time,
            'end_time' => $endTemplate?->end_time,
        ];
    }

    /**
     * Mengecek apakah jadwal hari ini sudah melewati batas waktu pengisian jurnal
     * (Aturan Baru: 30 menit setelah jam pelajaran DIMULAI).
     */
    public function isSchedulePastTolerance(Schedule $schedule, Carbon $now): bool
    {
        $times = $this->getScheduleTimes($schedule, $now);

        if (empty($times['start_time'])) {
            return false;
        }

        $startTimeString = is_string($times['start_time'])
            ? $times['start_time']
            : (string) $times['start_time'];

        $deadline = Carbon::parse($now->toDateString() . ' ' . $startTimeString, 'Asia/Jakarta')
            ->addMinutes(30);

        return $now->greaterThan($deadline);
    }

    /**
     * Mendapatkan objek Carbon batas akhir pengisian jurnal (start_time + 30 menit).
     */
    public function getJournalDeadline(Schedule $schedule, Carbon $now): ?Carbon
    {
        $times = $this->getScheduleTimes($schedule, $now);

        if (empty($times['start_time'])) {
            return null;
        }

        $startTimeString = is_string($times['start_time'])
            ? $times['start_time']
            : (string) $times['start_time'];

        return Carbon::parse($now->toDateString() . ' ' . $startTimeString, 'Asia/Jakarta')
            ->addMinutes(30);
    }

    /**
     * Mengecek apakah waktu saat ini berada dalam rentang pengisian jurnal aktif
     * (mulai dari jam pelajaran dimulai s.d. 30 menit setelahnya).
     */
    public function isWithinJournalFillingWindow(Schedule $schedule, Carbon $now): bool
    {
        $times = $this->getScheduleTimes($schedule, $now);

        if (empty($times['start_time'])) {
            return false;
        }

        $startTimeString = is_string($times['start_time'])
            ? $times['start_time']
            : (string) $times['start_time'];

        $startTime = Carbon::parse($now->toDateString() . ' ' . $startTimeString, 'Asia/Jakarta');
        $deadline = $startTime->copy()->addMinutes(30);

        return $now->greaterThanOrEqualTo($startTime) && $now->lessThanOrEqualTo($deadline);
    }
}
