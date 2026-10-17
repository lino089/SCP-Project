<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduleImportRow extends Model
{
    protected $fillable = [
        'import_id',
        'raw_data',
        'matched_class_id',
        'matched_teacher_id',
        'matched_room_id',
        'matched_subject_id',
        'day_of_week',
        'period_number',
        'duration_periods',
        'match_status',
        'room_source_conflict',
        'resolved_by_waka',
    ];

    protected $casts = [
        'raw_data' => 'array',
        'room_source_conflict' => 'boolean',
        'resolved_by_waka' => 'boolean',
        'day_of_week' => 'integer',
        'period_number' => 'integer',
        'duration_periods' => 'integer',
    ];

    public function import(): BelongsTo
    {
        return $this->belongsTo(ScheduleImport::class, 'import_id');
    }

    public function matchedClass(): BelongsTo
    {
        return $this->belongsTo(Classes::class, 'matched_class_id');
    }

    public function matchedTeacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'matched_teacher_id');
    }

    public function matchedRoom(): BelongsTo
    {
        return $this->belongsTo(Rooms::class, 'matched_room_id');
    }

    public function matchedSubject(): BelongsTo
    {
        return $this->belongsTo(Subject::class, 'matched_subject_id');
    }
}
