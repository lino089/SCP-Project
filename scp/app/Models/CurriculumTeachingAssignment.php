<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CurriculumTeachingAssignment extends Model
{
    use SoftDeletes;

    protected $table = 'curriculum_teaching_assignments';

    protected $fillable = [
        'academic_year',
        'class_id',
        'subject_id',
        'teacher_id',
        'total_jp',
        'preferred_cycle',
        'preferred_room_id',
        'max_block_jp',
    ];

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(Classes::class, 'class_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class, 'subject_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function preferredRoom(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'preferred_room_id');
    }
}
