<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AcademicEvent extends Model
{
    use HasFactory, SoftDeletes;

    public const TYPE_HOLIDAY = 'holiday';
    public const TYPE_SCHOOL_EVENT = 'school_event';
    public const TYPE_CLASS_EVENT = 'class_event';
    public const TYPE_EXAM = 'exam';

    public const TYPES = [
        self::TYPE_HOLIDAY,
        self::TYPE_SCHOOL_EVENT,
        self::TYPE_CLASS_EVENT,
        self::TYPE_EXAM,
    ];

    public const SCOPE_ALL = 'all';
    public const SCOPE_GRADE = 'grade';
    public const SCOPE_CLASS = 'class';

    public const SCOPES = [
        self::SCOPE_ALL,
        self::SCOPE_GRADE,
        self::SCOPE_CLASS,
    ];

    protected $table = 'academic_events';

    protected $fillable = [
        'title',
        'description',
        'start_date',
        'end_date',
        'type',
        'scope_type',
        'scope_targets',
        'disables_teaching',
        'academic_year',
        'created_by',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
            'scope_targets' => 'array',
            'disables_teaching' => 'boolean',
        ];
    }

    /**
     * Relasi ke Waka pembuat agenda.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }
}
