<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Journal extends Model
{
    protected $fillable = [
        'schedule_id',
        'date',
        'topic_description',
        'photo_path',
        'status',
        'substitute_teacher_id'
    ];

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class, 'schedule_id');
    }

    public function substituteTeacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'substitute_teacher_id');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class, 'journal_id');
    }

    public function quiz(): HasOne
    {
        return $this->hasOne(Quiz::class, 'journal_id');
    }
}
