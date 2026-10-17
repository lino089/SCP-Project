<?php

namespace App\Services;

use App\Models\Schedule;
use Illuminate\Database\Eloquent\Collection;

class ScheduleConflictService
{
    public function findConflicts(array $data, ?int $ignoreId = null): Collection
    {
        $start = (int) $data['period_number'];
        $end = $start + ($data['duration_periods']);

        $resources = array_filter([
            'teacher_id' => $data['teacher_id'] ?? null,
            'class_id' => $data['class_id'] ?? null,
            'room_id' => $data['room_id'] ?? null
        ], fn ($value) => $value !== null);

        if(empty($resources)){
            return new Collection();
        }

        return Schedule::query()
            ->where('cycle_type', $data['cycle_type'])
            ->where('day_of_week', $data['day_of_week'])
            ->where('period_number', '<=', $end)
            ->whereRaw('(period_number + duration_periods - 1) >= ?', [$start])
            ->where(function ($query) use ($resources){
                $first = true;

                foreach ($resources as $column => $value){
                                    $first 
                    ? $query->where($column, $value)
                    : $query->orWhere($column, $value);

                    $first = false;
                }

            })
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->get();
    }

}