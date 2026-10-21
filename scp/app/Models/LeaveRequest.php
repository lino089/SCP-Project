<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveRequest extends Model
{
    protected $table = 'leave_requests';

    protected $fillable = [
        'student_id',
        'applicant_id',
        'type',
        'category',
        'start_date',
        'end_date',
        'departure_time',
        'expected_return_time',
        'status_approval',
        'document_path',
        'verified_by',
        'verified_at',
    ];

    protected $casts = [
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
        'verified_at' => 'datetime',
    ];

    /**
     * Alias status untuk status_approval agar fleksibel.
     */
    protected function status(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->status_approval,
            set: fn ($value) => ['status_approval' => $value],
        );
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'applicant_id');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
