<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Classes;
use App\Models\Room;
use App\Models\Subject;
use App\Models\Schedule;
use App\Models\ScheduleImport;
use App\Models\ScheduleImportRow;
use App\Services\ScheduleConflictService;
use App\Services\TeacherMatcherService;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ScheduleConflictRecommendationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
    }

    public function test_find_conflict_details_and_alternative_rooms(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher', 'name' => 'Budi Santoso, S.Kom', 'nis_nip' => '198001012010011001']);
        $otherTeacher = User::factory()->create(['role' => 'teacher', 'name' => 'Siti Aminah, M.Pd', 'nis_nip' => '198001012010011002']);
        $classA = Classes::create(['name' => 'X PPLG 1', 'level' => 'X', 'major' => 'PPLG']);
        $classB = Classes::create(['name' => 'X PPLG 2', 'level' => 'X', 'major' => 'PPLG']);
        $room1 = Room::create(['name' => 'L.1', 'capacity' => 36]);
        $room2 = Room::create(['name' => 'L.2', 'capacity' => 36]);
        $room3 = Room::create(['name' => 'R.Teori 1', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Pemrograman Web', 'code' => 'PW']);

        $service = new ScheduleConflictService();

        // Simulate batchSlots where room1 is used by classA with Siti
        $batchSlots = [
            '1-1' => [
                'teachers' => [$otherTeacher->id],
                'classes' => [$classA->id],
                'rooms' => [$room1->id],
                'entries' => [
                    [
                        'teacher_id' => $otherTeacher->id,
                        'teacher_name' => $otherTeacher->name,
                        'class_id' => $classA->id,
                        'class_name' => $classA->name,
                        'room_id' => $room1->id,
                        'room_name' => $room1->name,
                        'subject_name' => $subject->name,
                    ],
                ],
            ],
        ];

        // 1. Conflict details check for room collision
        $conflict = $service->findConflictDetailsInMemory([], [
            'teacher_id' => $teacher->id,
            'teacher_name' => $teacher->name,
            'class_id' => $classB->id,
            'class_name' => $classB->name,
            'room_id' => $room1->id,
            'room_name' => $room1->name,
            'cycle_type' => 1,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 1,
        ], $batchSlots);

        $this->assertNotNull($conflict);
        $this->assertEquals('room_collision', $conflict['type']);
        $this->assertStringContainsString('L.1', $conflict['description']);
        $this->assertStringContainsString('X PPLG 1', $conflict['description']);

        // 2. Alternative rooms search: room1 is occupied, room2 and room3 are free
        $allRooms = collect([$room1, $room2, $room3]);
        $altRooms = $service->findAlternativeRooms(1, 1, 1, $allRooms, [], $batchSlots, $room1);

        $this->assertNotEmpty($altRooms);
        // room1 must not be in alternative rooms
        $altRoomIds = array_column($altRooms, 'room_id');
        $this->assertNotContains($room1->id, $altRoomIds);
        $this->assertContains($room2->id, $altRoomIds);
        $this->assertContains($room3->id, $altRoomIds);
        // Prioritizes same type: L.2 (lab) should be ranked before R.Teori 1
        $this->assertEquals('L.2', $altRooms[0]['room_name']);
    }

    public function test_diagnose_room_source_conflict(): void
    {
        $service = new ScheduleConflictService();

        $roomKelas = Room::create(['name' => 'L.10', 'capacity' => 36]);
        $roomJadwal = Room::create(['name' => 'L.11', 'capacity' => 36]);

        // Scenario: roomKelas is occupied in batchSlots, roomJadwal is free
        $batchSlots = [
            '2-3' => [
                'teachers' => [99],
                'classes' => [99],
                'rooms' => [$roomKelas->id],
                'entries' => [],
            ],
        ];

        $diag = $service->diagnoseRoomSourceConflict(
            $roomKelas,
            $roomJadwal,
            2,
            3,
            2,
            [],
            $batchSlots
        );

        $this->assertFalse($diag['room_kelas']['is_available']);
        $this->assertTrue($diag['room_jadwal']['is_available']);
        $this->assertEquals('jadwal', $diag['recommended_choice']);
        $this->assertStringContainsString('L.11', $diag['recommendation_text']);
    }

    public function test_api_get_row_recommendations_and_resolution(): void
    {
        $waka = User::factory()->create([
            'role' => 'vice_principal',
            'nis_nip' => '198501012010011005',
        ]);

        $teacherA = User::factory()->create([
            'role' => 'teacher',
            'name' => 'Achmad Fauzi',
            'nis_nip' => '198001012010011003',
        ]);
        $classA = Classes::create(['name' => 'X TO 1', 'level' => 'X', 'major' => 'TO']);
        $roomA = Room::create(['name' => 'L.15', 'capacity' => 36]);
        $roomB = Room::create(['name' => 'L.16', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Dasar Otomotif', 'code' => 'DO']);

        $import = ScheduleImport::create([
            'waka_id' => $waka->id,
            'cycle_type' => 1,
            'status' => 'preview_ready',
        ]);

        $row = ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => [
                'kelas_mentah' => 'X TO 1',
                'guru_mentah' => 'Achmad Fauzi',
                'ruang_final' => 'L.15',
                'mapel_mentah' => 'Dasar Otomotif',
                'issue_detail' => [
                    'type' => 'room_collision',
                    'title' => 'Tabrakan Pemakaian Ruangan',
                    'description' => "Ruangan 'L.15' sedang digunakan.",
                ],
                'recommendations' => [
                    'action_hint' => 'Pilih salah satu ruangan alternatif.',
                ],
            ],
            'matched_class_id' => $classA->id,
            'matched_teacher_id' => $teacherA->id,
            'matched_room_id' => $roomA->id,
            'matched_subject_id' => $subject->id,
            'day_of_week' => 1,
            'period_number' => 2,
            'duration_periods' => 2,
            'match_status' => 'conflict',
            'resolved_by_waka' => false,
        ]);

        $this->actingAs($waka, 'sanctum');

        // Test GET recommendations endpoint
        $response = $this->getJson("/api/schedule-imports/{$import->id}/rows/{$row->id}/recommendations");
        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonStructure([
            'success',
            'data' => [
                'issue_detail',
                'alternative_rooms',
                'room_source_options',
                'teacher_candidates',
            ],
        ]);

        // Test PATCH resolve row by selecting conflict-free roomB
        $resolveResponse = $this->patchJson("/api/schedule-imports/{$import->id}/rows/{$row->id}", [
            'matched_room_id' => $roomB->id,
        ]);

        $resolveResponse->assertStatus(200);
        $resolveResponse->assertJsonPath('data.match_status', 'matched');
        $resolveResponse->assertJsonPath('data.matched_room_id', $roomB->id);

        // Test row2 with conflict roomA
        $classB = Classes::create(['name' => 'X TO 2', 'level' => 'X', 'major' => 'TO']);
        $teacherB = User::factory()->create([
            'role' => 'teacher',
            'name' => 'Bambang Sudarsono',
            'nis_nip' => '198001012010011009',
        ]);
        $row2 = ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => ['kelas_mentah' => 'X TO 2'],
            'matched_class_id' => $classB->id,
            'matched_teacher_id' => $teacherB->id,
            'matched_room_id' => $roomB->id, // Conflicts with row1 on roomB at same time
            'matched_subject_id' => $subject->id,
            'day_of_week' => 1,
            'period_number' => 2,
            'duration_periods' => 2,
            'match_status' => 'conflict',
            'resolved_by_waka' => false,
        ]);

        // Attempting to save without override should stay conflict
        $noOverrideResp = $this->patchJson("/api/schedule-imports/{$import->id}/rows/{$row2->id}", [
            'matched_room_id' => $roomB->id,
            'override_conflict' => false,
        ]);
        $noOverrideResp->assertStatus(200);
        $noOverrideResp->assertJsonPath('data.match_status', 'conflict');
        $noOverrideResp->assertJsonPath('meta.is_still_conflict', true);

        // Saving WITH override_conflict should succeed and mark matched
        $overrideResp = $this->patchJson("/api/schedule-imports/{$import->id}/rows/{$row2->id}", [
            'matched_room_id' => $roomB->id,
            'override_conflict' => true,
        ]);
        $overrideResp->assertStatus(200);
        $overrideResp->assertJsonPath('data.match_status', 'matched');
        $this->assertEquals('matched', $row2->fresh()->match_status);
        $this->assertTrue($row2->fresh()->raw_data['overridden_by_waka']);
    }
}
