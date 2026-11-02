<?php

namespace App\Services;

use App\Models\Room;
use App\Models\Schedule;
use Illuminate\Database\Eloquent\Collection;

class ScheduleConflictService
{
    /**
     * Determine if a room or room code/name is a shared facility (e.g. Lapangan Olahraga / OR)
     * where multiple classes and teachers can be scheduled simultaneously without room collision.
     */
    public static function isSharedRoom(Room|int|string|null $room): bool
    {
        if (!$room) {
            return false;
        }

        $name = '';
        if ($room instanceof Room) {
            $name = $room->name;
        } elseif (is_numeric($room)) {
            $roomModel = Room::find($room);
            $name = $roomModel ? $roomModel->name : '';
        } elseif (is_string($room)) {
            $name = $room;
        }

        $upper = strtoupper(trim($name));
        if (!$upper) {
            return false;
        }

        if (in_array($upper, ['OR', 'OR1', 'OR2', 'OR3', 'LAPANGAN', 'LAPANGAN OLAHRAGA'])) {
            return true;
        }

        if (preg_match('/\b(OR|LAPANGAN)\b/i', $upper)) {
            return true;
        }

        if (preg_match('/^OR\d*$/i', $upper)) {
            return true;
        }

        return false;
    }

    /**
     * Find conflicting active schedules for given resource allocation.
     *
     * @param array $data ['cycle_type', 'day_of_week', 'period_number', 'duration_periods', 'teacher_id', 'class_id', 'room_id']
     * @param int|null $ignoreId Single schedule ID to ignore (e.g. during manual update)
     * @param array|null $ignoreClassIds Array of class IDs whose existing schedules are being replaced in this batch
     * @return Collection
     */
    public function findConflicts(
        array $data,
        ?int $ignoreId = null,
        ?array $ignoreClassIds = null
    ): Collection {
        $duration = (int) ($data['duration_periods'] ?? 1);
        $start = (int) $data['period_number'];
        $end = $start + $duration - 1;

        $roomId = $data['room_id'] ?? null;
        if ($roomId && self::isSharedRoom($roomId)) {
            $roomId = null;
        }

        $resources = array_filter([
            'teacher_id' => $data['teacher_id'] ?? null,
            'class_id' => $data['class_id'] ?? null,
            'room_id' => $roomId
        ], fn ($value) => $value !== null);

        if (empty($resources)) {
            return new Collection();
        }

        return Schedule::query()
            ->where('cycle_type', $data['cycle_type'])
            ->where('day_of_week', $data['day_of_week'])
            ->where('period_number', '<=', $end)
            ->whereRaw('(period_number + duration_periods - 1) >= ?', [$start])
            ->where(function ($query) use ($resources) {
                $first = true;

                foreach ($resources as $column => $value) {
                    $first 
                        ? $query->where($column, $value)
                        : $query->orWhere($column, $value);

                    $first = false;
                }
            })
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->when(!empty($ignoreClassIds), fn ($query) => $query->whereNotIn('class_id', $ignoreClassIds))
            ->get();
    }
}
