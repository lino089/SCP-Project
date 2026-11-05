<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentClassHistory extends Model
{
    protected $table = 'student_class_histories';

    protected $fillable = [
        'student_id',
        'from_class_id',
        'to_class_id',
        'academic_year',
        'action_type',
        'processed_by',
        'processed_at',
    ];

    protected function casts(): array
    {
        return [
            'student_id' => 'integer',
            'from_class_id' => 'integer',
            'to_class_id' => 'integer',
            'processed_by' => 'integer',
            'processed_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id')->withTrashed();
    }

    public function fromClass(): BelongsTo
    {
        return $this->belongsTo(Classes::class, 'from_class_id')->withTrashed();
    }

    public function toClass(): BelongsTo
    {
        return $this->belongsTo(Classes::class, 'to_class_id')->withTrashed();
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by')->withTrashed();
    }
}
