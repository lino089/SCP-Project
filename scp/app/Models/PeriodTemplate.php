<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PeriodTemplate extends Model
{
    protected $fillable = [
        'day_type',
        'period_number',
        'start_time',
        'end_time',
    ];

    protected $casts = [
        'period_number' => 'integer'
    ];

    public static function dayTypeFor(int $dayOfWeek, bool $mondayIsUpacara): ?string
    {
        return match ($dayOfWeek) {
            1 => $mondayIsUpacara ? 'senin_upacara' : 'senin_reguler',
            2 => 'selasa',
            3, 4 => 'rabu_kamis',
            5 => 'jumat',
            default => null, // Sabtu dan Minggu tidak punya jadwal
        };
    }
}
