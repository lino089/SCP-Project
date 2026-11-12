<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ScheduleGenerationBatch extends Model
{
    protected $table = 'schedule_generation_batches';

    protected $fillable = [
        'batch_uuid',
        'user_id',
        'target_cycles',
        'status',
        'total_classes_processed',
        'total_slots_generated',
        'execution_time_seconds',
        'error_message',
    ];

    protected $casts = [
        'target_cycles' => 'array',
        'total_classes_processed' => 'integer',
        'total_slots_generated' => 'integer',
        'execution_time_seconds' => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function drafts(): HasMany
    {
        return $this->hasMany(ScheduleGenerationDraft::class, 'batch_id');
    }
}
