<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
class Schedule extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'teacher_id',
        'class_id',
        'subject_id',
        'room_id',
        'day_of_week',
        'period_number',
        'duration_periods',
        'cycle_type',
        'source',
        'import_batch_id',
    ];

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class, 'subject_id');
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(Classes::class, 'class_id');
    }

    public function classRoom(): BelongsTo
    {
        return $this->belongsTo(Classes::class, 'class_id');
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Rooms::class, 'room_id');
    }

    public function importBatch(): BelongsTo
    {
        return $this->belongsTo(ScheduleImport::class, 'import_batch_id');
    }

    public function journals(): HasMany
    {
        return $this->hasMany(Journal::class, 'schedule_id');
    }
}
