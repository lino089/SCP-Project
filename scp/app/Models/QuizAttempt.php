<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuizAttempt extends Model
{
    use HasFactory;

    protected $table = 'quiz_attempts';

    protected $fillable = [
        'quiz_id',
        'student_id',
        'attempt_number',
        'started_at',
        'expires_at',
        'submitted_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'expires_at' => 'datetime',
        'submitted_at' => 'datetime',
    ];

    public function quiz()
    {
        return $this->belongsTo(Quiz::class);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function isExpired(): bool
    {
        return now()->greaterThan($this->expires_at);
    }
}
