<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CycleHistory extends Model
{
    protected $table = 'cycle_history';

    protected $fillable = [
        'cycle_number',
        'started_at',
        'ended_at',
        'changed_by',
    ];

    protected $casts = [
        'cycle_number' => 'integer',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
