<?php

namespace App\Http\Controllers\API;

use GrahamCampbell\ResultType\Success;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Validator;
use App\Models\Schedule;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use App\Services\ScheduleConflictService;

class ScheduleController extends Controller
{
    public function __construct(private ScheduleConflictService $conflicts){}
    public function store(Request $request){
        $validated = $request->validate( [
            'cycle_type' => 'required|integer|in:1,2',
            'period_number' => 'required|integer|min:1',
            'duration_periods' => 'nullable|integer|min:1',
            'teacher_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')
                    ->where('role', 'teacher')
                    ->whereNull('deleted_at')
            ], 
            'class_id' => 'required|integer|exists:classes,id',
            'room_id' => 'required|integer|exists:rooms,id',
            'subject_id' => 'required|integer|exists:subjects,id',
            'day_of_week' => 'required|integer|between:1,7',
            'password' => 'required|string'
        ]);

        if ($error = $this->passwordIdConfirmed($request)) {
            return $error;
        }

        $conflicts = $this->conflicts->findConflicts($validated);

        if($conflicts->isNotEmpty()){
            return response()->json([
                'success' => false,
                'message' => 'Jadwal bentrok!',
                'errors' => [
                    'schedule' => ['Terjadi bentrok guru, kelas atau ruangan pada jadwal.']
                ]
            ], 422);
        }
        
        $schedule = Schedule::create($validated + ['source' => 'manual']);
        
        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil dibuat',
            'data' => $schedule
        ], 201);
    }
}
