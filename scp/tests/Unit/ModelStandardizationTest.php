<?php

namespace Tests\Unit;

use App\Models\Classes;
use App\Models\Room;
use App\Models\Rooms;
use App\Models\Schedule;
use Tests\TestCase;

class ModelStandardizationTest extends TestCase
{
    public function test_schedule_school_class_and_class_room_relationships(): void
    {
        $schedule = new Schedule(['class_id' => 1]);

        $this->assertEquals(Classes::class, get_class($schedule->schoolClass()->getRelated()));
        $this->assertEquals(Classes::class, get_class($schedule->classRoom()->getRelated()));
    }

    public function test_room_and_rooms_models_target_rooms_table(): void
    {
        $room = new Room();
        $rooms = new Rooms();

        $this->assertEquals('rooms', $room->getTable());
        $this->assertEquals('rooms', $rooms->getTable());
    }
}
