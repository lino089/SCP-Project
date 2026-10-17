<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Classes extends Model
{
    use SoftDeletes;

    protected $table = 'classes';

    protected $fillable = [
        'name',
        'level',
        'next_class_id',
    ];

    public function schedules()
    {
        return $this->hasMany(Schedule::class, 'class_id');
    }
}
