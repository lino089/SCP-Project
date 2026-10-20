<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Rooms;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SchoolClassTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;

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
    }

    public function test_waka_can_create_class_and_recreate_after_soft_delete(): void
    {
        Sanctum::actingAs($this->waka);

        // 1. Create class
        $response = $this->postJson('/api/classes', [
            'name' => 'X RPL 1',
            'level' => 10,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'X RPL 1',
                    'level' => 10,
                ],
            ]);

        $classId = $response->json('data.id');

        // 2. Delete class -> must return 200
        $deleteResponse = $this->deleteJson('/api/classes/' . $classId);
        $deleteResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Data kelas berhasil dihapus',
            ]);

        $this->assertSoftDeleted('classes', ['id' => $classId]);

        // 3. Re-create class with same name -> must succeed because previous was soft deleted
        $recreateResponse = $this->postJson('/api/classes', [
            'name' => 'X RPL 1',
            'level' => 10,
        ]);

        $recreateResponse->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'X RPL 1',
                ],
            ]);
    }

    public function test_delete_class_fails_with_409_if_referenced_by_active_schedule(): void
    {
        Sanctum::actingAs($this->waka);

        $class = Classes::create([
            'name' => 'X RPL 2',
            'level' => 10,
        ]);

        $teacher = User::create([
            'name' => 'Guru Pengajar',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012010011003',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $room = Rooms::create([
            'name' => 'Lab 1',
            'capacity' => 36,
        ]);

        $subject = Subject::create([
            'name' => 'Pemrograman Web',
        ]);

        Schedule::create([
            'teacher_id' => $teacher->id,
            'class_id' => $class->id,
            'room_id' => $room->id,
            'subject_id' => $subject->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $response = $this->deleteJson('/api/classes/' . $class->id);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'message' => 'Kelas tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
            ]);
    }
}
