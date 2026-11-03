<?php

namespace Tests\Unit;

use App\Models\Classes;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\User;
use App\Services\ScheduleConflictService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ScheduleConflictServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_is_shared_room_identifies_or_and_lapangan(): void
    {
        $this->assertTrue(ScheduleConflictService::isSharedRoom('OR'));
        $this->assertTrue(ScheduleConflictService::isSharedRoom('OR1'));
        $this->assertTrue(ScheduleConflictService::isSharedRoom('Lapangan'));
        $this->assertTrue(ScheduleConflictService::isSharedRoom('Lapangan Olahraga'));
        $this->assertTrue(ScheduleConflictService::isSharedRoom('Ruang OR'));

        $this->assertFalse(ScheduleConflictService::isSharedRoom('Lab Komputer 1'));
        $this->assertFalse(ScheduleConflictService::isSharedRoom('12'));
        $this->assertFalse(ScheduleConflictService::isSharedRoom('Laboratorium'));
    }

    public function test_shared_room_does_not_conflict_for_different_classes_and_teachers(): void
    {
        $orRoom = Room::create(['name' => 'OR', 'capacity' => 100]);
        $class1 = Classes::create(['name' => 'X RPL 1', 'level' => '10']);
        $class2 = Classes::create(['name' => 'XI TKJ 1', 'level' => '11']);
        $teacher1 = User::factory()->create(['role' => 'teacher', 'nis_nip' => '198001012005011001']);
        $teacher2 = User::factory()->create(['role' => 'teacher', 'nis_nip' => '198001012005011002']);
        $subject = Subject::create(['name' => 'PJOK']);

        // Jadwal pertama di OR
        Schedule::create([
            'cycle_type' => 1,
            'day_of_week' => 2,
            'period_number' => 4,
            'duration_periods' => 3,
            'teacher_id' => $teacher1->id,
            'class_id' => $class1->id,
            'room_id' => $orRoom->id,
            'subject_id' => $subject->id,
            'source' => 'manual',
        ]);

        $service = new ScheduleConflictService();

        // Jadwal kedua di waktu yang overlap di ruangan OR dengan guru & kelas berbeda -> TIDAK BENTROK
        $conflicts = $service->findConflicts([
            'cycle_type' => 1,
            'day_of_week' => 2,
            'period_number' => 5,
            'duration_periods' => 2,
            'teacher_id' => $teacher2->id,
            'class_id' => $class2->id,
            'room_id' => $orRoom->id,
        ]);

        $this->assertTrue($conflicts->isEmpty());
    }

    public function test_shared_room_still_conflicts_if_same_teacher_or_same_class(): void
    {
        $orRoom = Room::create(['name' => 'OR', 'capacity' => 100]);
        $class1 = Classes::create(['name' => 'X RPL 1', 'level' => '10']);
        $class2 = Classes::create(['name' => 'XI TKJ 1', 'level' => '11']);
        $teacher1 = User::factory()->create(['role' => 'teacher', 'nis_nip' => '198001012005011003']);
        $subject = Subject::create(['name' => 'PJOK']);

        Schedule::create([
            'cycle_type' => 1,
            'day_of_week' => 2,
            'period_number' => 4,
            'duration_periods' => 3,
            'teacher_id' => $teacher1->id,
            'class_id' => $class1->id,
            'room_id' => $orRoom->id,
            'subject_id' => $subject->id,
            'source' => 'manual',
        ]);

        $service = new ScheduleConflictService();

        // Guru yang sama di jam yang overlap -> HARUS BENTROK
        $conflicts = $service->findConflicts([
            'cycle_type' => 1,
            'day_of_week' => 2,
            'period_number' => 4,
            'duration_periods' => 2,
            'teacher_id' => $teacher1->id,
            'class_id' => $class2->id,
            'room_id' => $orRoom->id,
        ]);

        $this->assertFalse($conflicts->isEmpty());
    }
}
