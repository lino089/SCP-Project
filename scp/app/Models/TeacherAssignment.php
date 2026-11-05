<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeacherAssignment extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'class_id',
        'academic_year',
        'is_active',
        'started_at',
        'ended_at',
        'assigned_by',
        'revoked_by',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'class_id' => 'integer',
            'is_active' => 'boolean',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'assigned_by' => 'integer',
            'revoked_by' => 'integer',
        ];
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(Classes::class, 'class_id')->withTrashed();
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by')->withTrashed();
    }

    public function revokedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revoked_by')->withTrashed();
    }

    /**
     * Scope untuk mengambil hanya penugasan yang sedang aktif
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope untuk mengambil hanya penugasan yang sudah berakhir / nonaktif
     */
    public function scopeInactive(Builder $query): Builder
    {
        return $query->where('is_active', false);
    }

    /**
     * Scope untuk mengambil hanya penugasan Wali Kelas
     */
    public function scopeWaliKelas(Builder $query): Builder
    {
        return $query->where('type', 'wali_kelas');
    }

    /**
     * Scope untuk mengambil hanya penugasan Guru BK / Kesiswaan
     */
    public function scopeKesiswaan(Builder $query): Builder
    {
        return $query->where('type', 'kesiswaan');
    }

    /**
     * Scope untuk mengambil penugasan pada kelas tertentu
     */
    public function scopeForClass(Builder $query, int $classId): Builder
    {
        return $query->where('class_id', $classId);
    }
}
