<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    protected $fillable = [
        'journal_id',
        'student_id',
        'status',
        'date',
    ];
}
