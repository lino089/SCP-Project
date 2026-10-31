<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeacherLeaveRequest extends Model
{
    use HasFactory;

    protected $table = 'teacher_leave_requests';

    protected $fillable = [
        'teacher_id',
        'schedule_ids',
        'date',
        'reason',
        'attachment_path',
        'task_instruction',
        'task_attachment_path',
        'status',
        'approved_by',
        'verified_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'schedule_ids' => 'array',
            'date' => 'date:Y-m-d',
            'verified_at' => 'datetime',
        ];
    }

    /**
     * Relasi ke guru pengaju perizinan (tetap terbaca jika akun di-soft delete)
     */
    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id')->withTrashed();
    }

    /**
     * Relasi ke akun verifikator yang menyetujui / memproses izin
     */
    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by')->withTrashed();
    }
}
