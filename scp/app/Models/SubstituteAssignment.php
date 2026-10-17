<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class, 'schedule_id');
    }

    public function originalTeacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'original_teacher_id');
    }

    public function substituteTeacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'substitute_teacher_id');
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
