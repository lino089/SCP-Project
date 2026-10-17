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
}
