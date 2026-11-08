<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class LeaveRequest extends Model
{
    protected $table = 'leave_requests';

    protected $fillable = [
        'student_id',
        'class_id',
        'academic_year',
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

    protected $appends = ['document_url'];

    /**
     * Resolves absolute URL to Supabase Storage (public or presigned temporary URL)
     */
    public function getDocumentUrlAttribute(): ?string
    {
        if (empty($this->document_path)) {
            return null;
        }

        if (str_starts_with($this->document_path, 'http://') || str_starts_with($this->document_path, 'https://')) {
            return $this->document_path;
        }

        $disk = config('filesystems.default', 'public');
        try {
            if ($disk === 's3') {
                $isPrivate = config('filesystems.disks.s3.visibility') === 'private'
                    || (bool) config('filesystems.supabase_storage_private', false)
                    || (bool) config('filesystems.disks.s3.supabase_storage_private', false);
                if ($isPrivate) {
                    return Storage::disk('s3')->temporaryUrl($this->document_path, now()->addMinutes(120));
                }
                return Storage::disk('s3')->url($this->document_path);
            }
            return Storage::disk($disk)->url($this->document_path);
        } catch (\Throwable) {
            return url('storage/' . ltrim($this->document_path, '/'));
        }
    }

    protected $casts = [
        'class_id' => 'integer',
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
        return $this->belongsTo(User::class, 'student_id')->withTrashed();
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(Classes::class, 'class_id')->withTrashed();
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'applicant_id')->withTrashed();
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by')->withTrashed();
    }
}
