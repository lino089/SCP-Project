<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\TeacherAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeacherManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;

    protected function setUp(): void
    {
        parent::setUp();

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->teacher = User::create([
            'name' => 'Budi Santoso',
            'email' => 'budi@example.com',
            'nis_nip' => '198001012010011002',
            'fet_staff_id' => 'BS01',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
    }

    public function test_authenticated_user_can_list_teachers_with_assignments_and_search(): void
    {
        Sanctum::actingAs($this->teacher);

        $class = Classes::create(['name' => 'X RPL 1', 'level' => 10]);

        TeacherAssignment::create([
            'user_id' => $this->teacher->id,
            'type' => 'wali_kelas',
            'class_id' => $class->id,
        ]);

        $response = $this->getJson('/api/teachers');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonPath('data.0.fet_staff_id', 'BS01')
            ->assertJsonPath('data.0.assignments.0.type', 'wali_kelas');

        $searchResponse = $this->getJson('/api/teachers?search=BS01');
        $searchResponse->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Budi Santoso');
    }

    public function test_waka_can_create_teacher_with_fet_staff_id(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/teachers', [
            'name' => 'Dewi Lestari',
            'nip' => '198505052015022001',
            'fet_staff_id' => 'DL02',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'teacher' => [
                        'name' => 'Dewi Lestari',
                        'fet_staff_id' => 'DL02',
                        'role' => 'teacher',
                    ],
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'nis_nip' => '198505052015022001',
            'fet_staff_id' => 'DL02',
            'role' => 'teacher',
        ]);
    }

    public function test_waka_can_update_teacher(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->putJson('/api/teachers/' . $this->teacher->id, [
            'name' => 'Budi Santoso, M.Kom',
            'fet_staff_id' => 'BS99',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Budi Santoso, M.Kom',
                    'fet_staff_id' => 'BS99',
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $this->teacher->id,
            'name' => 'Budi Santoso, M.Kom',
            'fet_staff_id' => 'BS99',
        ]);
    }

    public function test_waka_can_delete_teacher_without_schedules(): void
    {
        Sanctum::actingAs($this->waka);

        $target = User::create([
            'name' => 'Guru Resign',
            'email' => 'resign@example.com',
            'nis_nip' => '199999999999999999',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->deleteJson('/api/teachers/' . $target->id);
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Data guru berhasil dihapus.',
            ]);

        $this->assertSoftDeleted('users', ['id' => $target->id]);
    }

    public function test_delete_teacher_fails_with_409_if_referenced_by_schedule(): void
    {
        Sanctum::actingAs($this->waka);

        $room = Room::create(['name' => 'Lab RPL', 'capacity' => 30]);
        $class = Classes::create(['name' => 'XII RPL 1', 'level' => 12]);
        $subject = Subject::create(['name' => 'PBO']);

        Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $class->id,
            'room_id' => $room->id,
            'subject_id' => $subject->id,
            'day_of_week' => 3,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $response = $this->deleteJson('/api/teachers/' . $this->teacher->id);
        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'message' => 'Guru tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
            ]);
    }

    public function test_waka_can_assign_homeroom_role_to_teacher(): void
    {
        Sanctum::actingAs($this->waka);

        $class = Classes::create(['name' => 'XI RPL 1', 'level' => 11]);

        $response = $this->postJson('/api/teachers/' . $this->teacher->id . '/assignments', [
            'type' => 'wali_kelas',
            'class_id' => $class->id,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Tugas tambahan berhasil diberikan.',
            ]);

        $this->assertDatabaseHas('teacher_assignments', [
            'user_id' => $this->teacher->id,
            'type' => 'wali_kelas',
            'class_id' => $class->id,
        ]);
    }

    public function test_assign_homeroom_fails_if_class_already_has_active_homeroom_teacher(): void
    {
        Sanctum::actingAs($this->waka);

        $class = Classes::create(['name' => 'XI RPL 2', 'level' => 11]);

        TeacherAssignment::create([
            'user_id' => $this->teacher->id,
            'type' => 'wali_kelas',
            'class_id' => $class->id,
        ]);

        $otherTeacher = User::create([
            'name' => 'Guru Kedua',
            'email' => 'guru2@example.com',
            'nis_nip' => '198001012010011003',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/teachers/' . $otherTeacher->id . '/assignments', [
            'type' => 'wali_kelas',
            'class_id' => $class->id,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Kelas ini sudah memiliki wali kelas aktif.',
            ]);
    }

    public function test_waka_can_assign_and_revoke_kesiswaan_role(): void
    {
        Sanctum::actingAs($this->waka);

        $assignResponse = $this->postJson('/api/teachers/' . $this->teacher->id . '/assignments', [
            'type' => 'kesiswaan',
        ]);

        $assignResponse->assertStatus(201);
        $assignmentId = $assignResponse->json('data.id');

        $this->assertDatabaseHas('teacher_assignments', [
            'id' => $assignmentId,
            'user_id' => $this->teacher->id,
            'type' => 'kesiswaan',
        ]);

        $revokeResponse = $this->deleteJson('/api/teachers/' . $this->teacher->id . '/assignments/' . $assignmentId);
        $revokeResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Penugasan guru berhasil dicabut.',
            ]);

        $this->assertDatabaseMissing('teacher_assignments', [
            'id' => $assignmentId,
        ]);
    }

    public function test_non_waka_cannot_mutate_teacher(): void
    {
        Sanctum::actingAs($this->teacher);

        $this->postJson('/api/teachers', [
            'name' => 'Guru Ilegal',
            'nip' => '123456789',
        ])->assertStatus(403);

        $this->putJson('/api/teachers/' . $this->teacher->id, [
            'name' => 'Nama Ilegal',
        ])->assertStatus(403);

        $this->deleteJson('/api/teachers/' . $this->teacher->id)->assertStatus(403);
    }
}
