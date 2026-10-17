<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TeacherAssignment extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'class_id'
    ];

    public function teacherAssignments(): HasMany
    {
        return $this->hasMany(TeacherAssignment::class, 'user_id');
    }
}
