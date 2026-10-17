<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ScheduleImport extends Model
{
    protected $fillable = [
        'waka_id',
        'cycle_type',
        'file_path_kelas',
        'file_path_ruangan',
        'status',
        'parser_version',
    ];

    public function rows(): HasMany
    {
        return $this->hasMany(ScheduleImportRow::class, 'import_id');
    }

    public function waka(): BelongsTo
    {
        return $this->belongsTo(User::class, 'waka_id');
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(Schedule::class, 'import_batch_id');
    }
}
