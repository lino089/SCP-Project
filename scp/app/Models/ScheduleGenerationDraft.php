<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduleGenerationDraft extends Model
{
    protected $table = 'schedule_generation_drafts';

    protected $fillable = [
        'batch_id',
        'teacher_id',
        'class_id',
        'subject_id',
        'room_id',
        'day_of_week',
        'period_number',
        'duration_periods',
        'cycle_type',
        'category',
        'has_conflict',
        'conflict_note',
    ];

    protected $casts = [
        'day_of_week' => 'integer',
        'period_number' => 'integer',
        'duration_periods' => 'integer',
        'cycle_type' => 'integer',
        'has_conflict' => 'boolean',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ScheduleGenerationBatch::class, 'batch_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(Classes::class, 'class_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class, 'subject_id');
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'room_id');
    }
}
