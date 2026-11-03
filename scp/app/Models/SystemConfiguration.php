<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemConfiguration extends Model
{
    protected $fillable = [
        'active_cycle',
        'monday_is_upacara',
        'academic_year',
        'semester',
    ];

    protected $casts = [
        'active_cycle' => 'integer',
        'monday_is_upacara' => 'boolean',
    ];
}
