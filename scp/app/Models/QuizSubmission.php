<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuizSubmission extends Model
{
    protected $table = 'quiz_submissions';

    protected $fillable = [
        'quiz_id',
        'student_id',
        'attempt_number',
        'answers_payload',
        'grading_status',
        'ai_score',
        'ai_feedback',
        'is_overridden',
        'overridden_by',
        'overridden_at',
    ];

    protected $casts = [
        'answers_payload' => 'array',
        'ai_score' => 'float',
        'is_overridden' => 'boolean',
        'overridden_at' => 'datetime',
        'attempt_number' => 'integer',
    ];

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class, 'quiz_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function overrider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'overridden_by');
    }
}
