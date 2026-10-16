<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Symfony\Component\Routing\Loader\Configurator\Traits\AddTrait;

class Schedule extends Model
{

    use SoftDeletes;
    protected $guarded = ['id'];

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class, 'subject_id');
    }

    public function classRoom()
    {
        return $this->belongsTo(Classes::class, 'class_id');
    }
}
