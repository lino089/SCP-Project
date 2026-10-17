<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubstituteAssignment extends Model
{
    protected $fillable = [
        'schedule_id',
        'original_teacher_id',
        'substitute_teacher_id',
        'assigned_by',
        'date',
        'reason',
    ];
}
