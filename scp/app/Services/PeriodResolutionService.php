<?php

namespace App\Services;

use App\Models\PeriodTemplate;
use App\Models\Schedule;
use App\Models\SystemConfiguration;
use Carbon\Carbon;

class PeriodResolutionService
{
    /**
     * Menentukan tipe hari (day_type) berdasarkan tanggal dan setting upacara hari Senin.
     */
    public function resolveDayType(Carbon $date): ?string
    {
        $dayOfWeek = (int) $date->dayOfWeekIso; // 1 = Senin, ..., 7 = Minggu

        if ($dayOfWeek < 1 || $dayOfWeek > 5) {
            return null; // Sabtu & Minggu tidak ada jadwal sekolah
        }

        $mondayIsUpacara = true;
        if ($dayOfWeek === 1) {
            $config = SystemConfiguration::first();
            $mondayIsUpacara = $config ? (bool) $config->monday_is_upacara : true;
        }

        return PeriodTemplate::dayTypeFor($dayOfWeek, $mondayIsUpacara);
    }

    /**
     * Menghitung jam mulai dan jam selesai literal (HH:MM:SS) untuk suatu jadwal pada tanggal tertentu.
     */
    public function getScheduleTimes(Schedule $schedule, ?Carbon $date = null): array
    {
        $date = $date ? $date->copy() : Carbon::now('Asia/Jakarta');
        $dayType = $this->resolveDayType($date);

        if (!$dayType) {
            return [
                'start_time' => null,
                'end_time' => null,
            ];
        }

        $startPeriod = (int) $schedule->period_number;
        $duration = (int) ($schedule->duration_periods ?? 1);
        $endPeriod = $startPeriod + $duration - 1;

        $startTemplate = PeriodTemplate::where('day_type', $dayType)
            ->where('period_number', $startPeriod)
            ->first();

        $endTemplate = PeriodTemplate::where('day_type', $dayType)
            ->where('period_number', $endPeriod)
            ->first();

        return [
            'start_time' => $startTemplate?->start_time,
            'end_time' => $endTemplate?->end_time,
        ];
    }

    /**
     * Mengecek apakah jadwal hari ini sudah melewati batas toleransi pengisian jurnal (+30 menit).
     */
    public function isSchedulePastTolerance(Schedule $schedule, Carbon $now): bool
    {
        $times = $this->getScheduleTimes($schedule, $now);

        if (empty($times['end_time'])) {
            return false;
        }

        $endTimeString = is_string($times['end_time'])
            ? $times['end_time']
            : (string) $times['end_time'];

        $deadline = Carbon::parse($now->toDateString() . ' ' . $endTimeString, 'Asia/Jakarta')
            ->addMinutes(30);

        return $now->greaterThan($deadline);
    }
}
