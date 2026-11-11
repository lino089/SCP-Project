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
        'duration_minutes',
    ];

    protected $casts = [
        'due_date' => 'datetime',
        'max_attempts' => 'integer',
        'duration_minutes' => 'integer',
    ];

    protected $appends = [
        'subject',
        'school_class',
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

    /**
     * Resolusi Mata Pelajaran yang diampu guru untuk kuis ini.
     */
    public function getSubjectAttribute(): ?Subject
    {
        // 1. Ambil dari jadwal mengajar KBM guru pada kelas kuis ini
        $schedule = Schedule::where('teacher_id', $this->teacher_id)
            ->where('class_id', $this->class_id)
            ->with('subject:id,name')
            ->first();

        if ($schedule && $schedule->subject) {
            return $schedule->subject;
        }

        // 2. Ambil dari profil guru (subject_id)
        if ($this->relationLoaded('teacher') && $this->teacher && $this->teacher->subject) {
            return $this->teacher->subject;
        }

        $teacher = User::with('subject:id,name')->find($this->teacher_id);
        if ($teacher && $teacher->subject) {
            return $teacher->subject;
        }

        // 3. Fallback: jadwal mengajar apapun yang diampu oleh guru ini
        $fallback = Schedule::where('teacher_id', $this->teacher_id)
            ->with('subject:id,name')
            ->first();

        return $fallback?->subject;
    }

    /**
     * Accessor untuk konsistensi snake_case school_class.
     */
    public function getSchoolClassAttribute(): ?Classes
    {
        if ($this->relationLoaded('schoolClass')) {
            return $this->getRelation('schoolClass');
        }

        return $this->class_id ? Classes::select('id', 'name', 'level')->find($this->class_id) : null;
    }
}
