<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudentPermision extends Model
{
    protected $fillable = [
        'student_id',
        'permission_type',
        'start_date',
        'end_date',
        'reason',
        'attachment_path',
        'status',
        'approved_by',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }
}
