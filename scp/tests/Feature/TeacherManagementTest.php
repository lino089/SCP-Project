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
            ->assertJsonPath('data.0.nis_nip', '198001012010011002')
            ->assertJsonPath('data.0.assignments.0.type', 'wali_kelas');

        $searchResponse = $this->getJson('/api/teachers?search=Budi');
        $searchResponse->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Budi Santoso');
    }

    public function test_waka_can_create_teacher_with_nip_and_option_1_password(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/teachers', [
            'name' => 'Dewi Lestari',
            'nip' => '198505052015022001',
            'phone_number' => '081234567891',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'teacher' => [
                        'name' => 'Dewi Lestari',
                        'role' => 'teacher',
                    ],
                    'password' => 'GuruSCP@2001!',
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'nis_nip' => '198505052015022001',
            'role' => 'teacher',
        ]);
    }

    public function test_waka_can_update_teacher(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->putJson('/api/teachers/' . $this->teacher->id, [
            'name' => 'Budi Santoso, M.Kom',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Budi Santoso, M.Kom',
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $this->teacher->id,
            'name' => 'Budi Santoso, M.Kom',
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

        $this->assertDatabaseHas('teacher_assignments', [
            'id' => $assignmentId,
            'is_active' => false,
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

    public function test_create_teacher_succeeds_without_phone_number(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/teachers', [
            'name' => 'Guru Tanpa Telp',
            'nip' => '198901012015011001',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'nis_nip' => '198901012015011001',
            'phone_number' => null,
        ]);
    }

    public function test_create_teacher_fails_with_invalid_phone_format(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/teachers', [
            'name' => 'Guru Telp Salah',
            'nip' => '198901012015011002',
            'phone_number' => '1234567', // Tidak sesuai format Indonesia 08...
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone_number']);
    }

    public function test_create_teacher_fails_with_duplicate_phone_number(): void
    {
        Sanctum::actingAs($this->waka);

        // Guru pertama terdaftar dengan nomor 081234567899
        $this->postJson('/api/teachers', [
            'name' => 'Guru Pertama',
            'nip' => '198901012015011003',
            'phone_number' => '081234567899',
        ])->assertStatus(201);

        // Guru kedua mencoba mendaftar dengan nomor yang sama
        $response = $this->postJson('/api/teachers', [
            'name' => 'Guru Kedua Duplikat',
            'nip' => '198901012015011004',
            'phone_number' => '081234567899',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone_number']);
    }

    public function test_create_teacher_auto_normalizes_phone_number(): void
    {
        Sanctum::actingAs($this->waka);

        // Input nomor menggunakan format internasional +62 812-3344-5566
        $response = $this->postJson('/api/teachers', [
            'name' => 'Guru Format Internasional',
            'nip' => '198901012015011005',
            'phone_number' => '+62 812-3344-5566',
        ]);

        $response->assertStatus(201);

        // Memastikan tersimpan di database dalam format standar nasional 081233445566
        $this->assertDatabaseHas('users', [
            'nis_nip' => '198901012015011005',
            'phone_number' => '081233445566',
        ]);
    }

    public function test_update_teacher_fails_with_duplicate_phone_number(): void
    {
        Sanctum::actingAs($this->waka);

        // Guru 1 dengan nomor telepon
        $teacher1 = User::create([
            'name' => 'Guru Satu',
            'nis_nip' => '198901012015011010',
            'phone_number' => '081299990001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        // Guru 2 dengan nomor telepon lain
        $teacher2 = User::create([
            'name' => 'Guru Dua',
            'nis_nip' => '198901012015011011',
            'phone_number' => '081299990002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        // Guru 2 mengupdate nomor teleponnya menggunakan nomor milik Guru 1
        $response = $this->putJson('/api/teachers/' . $teacher2->id, [
            'name' => 'Guru Dua Update',
            'phone_number' => '081299990001',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone_number']);
    }
}
