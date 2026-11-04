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
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'class_id' => 'integer',
        ];
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(Classes::class, 'class_id');
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
