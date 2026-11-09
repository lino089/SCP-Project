<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\ScheduleImport;
use App\Models\ScheduleImportRow;
use App\Models\Subject;
use App\Models\User;
use App\Services\ScheduleConflictService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoomSourceComparisonAndAlternativeTest extends TestCase
{
    use RefreshDatabase;

    public function test_room_category_distinguishes_theory_lab_and_specialized()
    {
        $this->assertEquals('theory', ScheduleConflictService::getRoomCategory('9'));
        $this->assertEquals('theory', ScheduleConflictService::getRoomCategory('30'));
        $this->assertEquals('computer_lab', ScheduleConflictService::getRoomCategory('L.1'));
        $this->assertEquals('computer_lab', ScheduleConflictService::getRoomCategory('LAB 5'));
        $this->assertEquals('specialized_lab', ScheduleConflictService::getRoomCategory('L.IPA'));
        $this->assertEquals('specialized_lab', ScheduleConflictService::getRoomCategory('LAB PB'));
        $this->assertEquals('common', ScheduleConflictService::getRoomCategory('OR'));
    }

    public function test_find_alternative_rooms_does_not_recommend_computer_labs_for_theory_or_ipa()
    {
        $room9 = Room::create(['name' => '9', 'capacity' => 36]);
        $room30 = Room::create(['name' => '30', 'capacity' => 36]);
        $room34 = Room::create(['name' => '34', 'capacity' => 36]);
        $lab1 = Room::create(['name' => 'L.1', 'capacity' => 36]);
        $lab2 = Room::create(['name' => 'L.2', 'capacity' => 36]);
        $labIpa = Room::create(['name' => 'L.IPA', 'capacity' => 36]);

        $service = new ScheduleConflictService();
        $allRooms = Room::all();

        // If current room is L.IPA (specialized) or 30 (theory), alternative rooms must NOT include computer labs L.1 or L.2
        $alts = $service->findAlternativeRooms(3, 3, 4, $allRooms, collect(), [], $labIpa);

        $altNames = array_column($alts, 'room_name');
        $this->assertNotContains('L.1', $altNames);
        $this->assertNotContains('L.2', $altNames);
        $this->assertContains('9', $altNames);
        $this->assertContains('30', $altNames);
        $this->assertContains('34', $altNames);
    }

    public function test_get_recommendations_detects_home_room_comparison_when_room_collides()
    {
        $waka = User::factory()->create(['role' => 'vice_principal', 'nis_nip' => '198001012000011001']);
        $teacher = User::factory()->create(['role' => 'teacher', 'name' => 'GURU IPAS', 'nis_nip' => '198501012005011002']);
        $class = Classes::create(['name' => 'X AK 3', 'level' => 10]);
        $subject = Subject::create(['name' => 'IPAS']);

        $room30 = Room::create(['name' => '30', 'capacity' => 36]);
        $labIpa = Room::create(['name' => 'L.IPA', 'capacity' => 36]);

        $import = ScheduleImport::create([
            'waka_id' => $waka->id,
            'cycle_type' => 'putaran_2',
            'status' => 'preview_ready',
        ]);

        // Row 1: Another lesson of X AK 3 using Room 30 (so Room 30 is established as Home Room)
        ScheduleImportRow::create([
            'import_id' => $import->id,
            'matched_class_id' => $class->id,
            'matched_teacher_id' => $teacher->id,
            'matched_subject_id' => $subject->id,
            'matched_room_id' => $room30->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'match_status' => 'matched',
            'raw_data' => ['kelas_mentah' => 'X AK 3', 'ruang_final' => '30'],
        ]);

        // Row 2: Conflict row on Wednesday period 3 using L.IPA (where L.IPA collides)
        $conflictRow = ScheduleImportRow::create([
            'import_id' => $import->id,
            'matched_class_id' => $class->id,
            'matched_teacher_id' => $teacher->id,
            'matched_subject_id' => $subject->id,
            'matched_room_id' => $labIpa->id,
            'day_of_week' => 3,
            'period_number' => 3,
            'duration_periods' => 4,
            'match_status' => 'conflict',
            'raw_data' => [
                'kelas_mentah' => 'X AK 3',
                'ruang_jadwal' => 'L.IPA',
                'ruang_final' => 'L.IPA',
                'issue_detail' => ['type' => 'room_collision'],
            ],
        ]);

        $response = $this->actingAs($waka)->getJson("/api/schedule-imports/{$import->id}/rows/{$conflictRow->id}/recommendations");

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertNotNull($data['room_source_options']);
        $this->assertEquals('Ruang Pangkalan Rombel', $data['room_source_options']['room_kelas']['label']);
        $this->assertEquals('30', $data['room_source_options']['room_kelas']['name']);
        $this->assertTrue($data['room_source_options']['room_kelas']['is_available']);

        $this->assertEquals('PDF Matriks Ruang', $data['room_source_options']['room_jadwal']['label']);
        $this->assertEquals('L.IPA', $data['room_source_options']['room_jadwal']['name']);
    }
}
