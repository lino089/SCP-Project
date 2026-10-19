<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classes;
use App\Models\Rooms;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\User;
use App\Services\ScheduleConflictService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ScheduleController extends Controller
{
    public function __construct(private ScheduleConflictService $conflicts)
    {
    }

    private function lockResources(array $data): void
    {
        User::whereKey($data['teacher_id'])->lockForUpdate()->first();
        Classes::whereKey($data['class_id'])->lockForUpdate()->first();
        Rooms::whereKey($data['room_id'])->lockForUpdate()->first();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
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
            'class_id' => [
                'required',
                'integer',
                Rule::exists('classes', 'id')->whereNull('deleted_at')
            ],
            'room_id' => [
                'required',
                'integer',
                Rule::exists('rooms', 'id')->whereNull('deleted_at')
            ],
            'subject_id' => [
                'required',
                'integer',
                Rule::exists('subjects', 'id')->whereNull('deleted_at')
            ],
            'day_of_week' => 'required|integer|between:1,7',
            'password' => 'required|string'
        ]);

        if ($error = $this->passwordIdConfirmed($request)) {
            return $error;
        }

        $data = collect($validated)->except('password')->all();
        $data['duration_periods'] = $data['duration_periods'] ?? 1;
        $data['source'] = 'manual';

        $schedule = DB::transaction(function () use ($data) {
            $this->lockResources($data);

            if ($this->conflicts->findConflicts($data)->isNotEmpty()) {
                return null;
            }

            return Schedule::create($data);
        });

        if ($schedule === null) {
            return response()->json([
                'success' => false,
                'message' => 'Jadwal bentrok!',
                'errors' => [
                    'schedule' => ['Terjadi bentrok guru, kelas atau ruangan pada jadwal.']
                ]
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil dibuat',
            'data' => $schedule
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $validated = $request->validate([
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
            'class_id' => [
                'required',
                'integer',
                Rule::exists('classes', 'id')->whereNull('deleted_at')
            ],
            'room_id' => [
                'required',
                'integer',
                Rule::exists('rooms', 'id')->whereNull('deleted_at')
            ],
            'subject_id' => [
                'required',
                'integer',
                Rule::exists('subjects', 'id')->whereNull('deleted_at')
            ],
            'day_of_week' => 'required|integer|between:1,7',
            'password' => 'required|string'
        ]);

        if ($error = $this->passwordIdConfirmed($request)) {
            return $error;
        }

        $payload = collect($validated)->except('password')->all();

        $schedule = DB::transaction(function () use ($id, $payload) {
            $schedule = Schedule::lockForUpdate()->findOrFail($id);

            $data = array_merge($schedule->only([
                'cycle_type',
                'period_number',
                'duration_periods',
                'teacher_id',
                'class_id',
                'room_id',
                'subject_id',
                'day_of_week',
            ]), $payload);

            $data['duration_periods'] = $data['duration_periods'] ?? 1;

            $this->lockResources($data);

            if ($this->conflicts->findConflicts($data, ignoreId: $schedule->id)->isNotEmpty()) {
                return null;
            }

            $schedule->update($data);

            return $schedule;
        });

        if ($schedule === null) {
            return response()->json([
                'success' => false,
                'message' => 'Jadwal bentrok!',
                'errors' => [
                    'schedule' => ['Terjadi bentrok guru, kelas atau ruangan pada jadwal.']
                ]
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil diperbarui',
            'data' => $schedule->fresh()
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        $request->validate([
            'password' => 'required|string'
        ]);

        if ($error = $this->passwordIdConfirmed($request)) {
            return $error;
        }

        $schedule = Schedule::findOrFail($id);
        $schedule->delete();

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil dihapus',
            'data' => null
        ]);
    }
}
