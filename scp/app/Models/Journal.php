<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;

class Journal extends Model
{
    protected $fillable = [
        'schedule_id',
        'date',
        'topic_description',
        'photo_path',
        'status',
        'substitute_teacher_id'
    ];

    protected $appends = ['photo_url'];

    /**
     * Resolves absolute URL to Supabase Storage (public or presigned temporary URL)
     */
    public function getPhotoUrlAttribute(): ?string
    {
        if (empty($this->photo_path)) {
            return null;
        }

        if (str_starts_with($this->photo_path, 'http://') || str_starts_with($this->photo_path, 'https://')) {
            return $this->photo_path;
        }

        $disk = config('filesystems.default', 'public');
        try {
            if ($disk === 's3') {
                $isPrivate = config('filesystems.disks.s3.visibility') === 'private'
                    || (bool) config('filesystems.supabase_storage_private', false)
                    || (bool) config('filesystems.disks.s3.supabase_storage_private', false);
                if ($isPrivate) {
                    return Storage::disk('s3')->temporaryUrl($this->photo_path, now()->addMinutes(120));
                }
                return Storage::disk('s3')->url($this->photo_path);
            }
            return Storage::disk($disk)->url($this->photo_path);
        } catch (\Throwable) {
            return url('storage/' . ltrim($this->photo_path, '/'));
        }
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class, 'schedule_id');
    }

    public function substituteTeacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'substitute_teacher_id');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class, 'journal_id');
    }

    public function quiz(): HasOne
    {
        return $this->hasOne(Quiz::class, 'journal_id');
    }
}
