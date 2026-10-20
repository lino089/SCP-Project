<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Room extends Model
{
    use SoftDeletes;

    protected $table = 'rooms';

    protected $fillable = [
        'name',
        'capacity',
    ];

    public function schedules(): HasMany
    {
        return $this->hasMany(Schedule::class, 'room_id');
    }
}
