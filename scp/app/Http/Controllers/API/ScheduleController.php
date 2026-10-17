<?php

namespace App\Http\Controllers\API;

use GrahamCampbell\ResultType\Success;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Validator;
use App\Models\Schedule;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class ScheduleController extends Controller
{
    public function store(Request $request){
        $request->validate( [
            'cycle_type' => 'required|integer|in:1,2',
            'period_number' => 'required|integer|min:1',
            'duration_periods' => 'nullable|integer|min:1',
            'teacher_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')
                    ->where('role', 'teacher')
                    ->whereNull('delete_at')
            ], 
            'class_id' => 'required|integer|exists:classes,id',
            'room_id' => 'required|integer|exists:rooms,id',
            'subject_id' => 'required|integer|exists:subjects,id',
            'day_of_week' => 'required|integer|between:1,7',
            'password' => 'required|string'
        ]);

        if(!Hash::check($request->password, $request->user()->password)){
            return response()->json([
                'success' => false,
                'message' => 'konfirmasi gagal',
                'errors' => [
                    'password' => ['Password Salah!!']
                ]
            ], 422);
        }

        $startPeriod = $request->period_number;
        $endPeriod = $startPeriod + $request->duration_periods - 1;

        $isConflict = Schedule::where('cycle_type', $request->cycle_type)
        ->where('day_of_week', $request->day_of_week)
        ->where(function ($query) use ($request){
            $query->where('teacher_id', $request->teacher_id)
                ->orWhere('class_id', $request->class_id)
                ->orWhere('room_id', $request->room_id);
        })
        ->where(function ($query) use ($startPeriod, $endPeriod){
            $query->where('period_number', '<=', $endPeriod)
                ->whereRaw('(period_number + duration_periods - 1) >= ?', [$startPeriod]);
        })->exists();

        if($isConflict){
            return response()->json([
                'success' => false,
                'message' => 'Jadwal bentrok!',
                'errors' => ['schedule' => ['Terjadi bentrok guru, kelas atau ruangan pada jam tersebut.']]
            ], 422);
        }

        $newSchedule = Schedule::create([
            'cycle_type' => $request->cycle_type,
            'period_number' => $request->period_number,
            'duration_periods' => $request->duration_periods,
            'teacher_id' => $request->teacher_id,
            'class_id' => $request->class_id,
            'room_id' => $request->room_id,
            'subject_id' => $request->subject_id,   
            'day_of_week' => $request->day_of_week,
            'source' => 'manual'
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil dibuat',
            'data' => $newSchedule
        ], 201);
    }
}
