<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quiz extends Model
{
    protected $table = 'ai_quizzes';

    protected $fillable = [
        'teacher_id',
        'class_id',
        'title',
        'status',
        'due_date',
        'max_attempts',
    ];

    protected $casts = [
        'due_date' => 'datetime',
        'max_attempts' => 'integer',
    ];

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(Classes::class, 'class_id');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(QuizQuestion::class, 'quiz_id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(QuizSubmission::class, 'quiz_id');
    }
}
