<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoomTest extends TestCase
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
            'name' => 'Guru Pengajar',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012010011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
    }

    public function test_authenticated_user_can_list_rooms_and_search(): void
    {
        Sanctum::actingAs($this->teacher);

        Room::create(['name' => 'Lab Komputer 1', 'capacity' => 36]);
        Room::create(['name' => 'Lab IPA', 'capacity' => 30]);

        $response = $this->getJson('/api/rooms');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonCount(2, 'data');

        $searchResponse = $this->getJson('/api/rooms?search=IPA');
        $searchResponse->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Lab IPA');
    }

    public function test_waka_can_create_room(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/rooms', [
            'name' => 'Ruang Teori 1',
            'capacity' => 32,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Ruang Teori 1',
                    'capacity' => 32,
                ],
            ]);

        $this->assertDatabaseHas('rooms', [
            'name' => 'Ruang Teori 1',
            'capacity' => 32,
        ]);
    }

    public function test_waka_can_update_room(): void
    {
        Sanctum::actingAs($this->waka);

        $room = Room::create(['name' => 'Ruang Lama', 'capacity' => 20]);

        $response = $this->putJson('/api/rooms/' . $room->id, [
            'name' => 'Ruang Baru',
            'capacity' => 25,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Ruang Baru',
                    'capacity' => 25,
                ],
            ]);

        $this->assertDatabaseHas('rooms', [
            'id' => $room->id,
            'name' => 'Ruang Baru',
            'capacity' => 25,
        ]);
    }

    public function test_waka_can_delete_room_without_schedules(): void
    {
        Sanctum::actingAs($this->waka);

        $room = Room::create(['name' => 'Ruang Kosong', 'capacity' => 30]);

        $response = $this->deleteJson('/api/rooms/' . $room->id);
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Data ruangan berhasil dihapus.',
            ]);

        $this->assertSoftDeleted('rooms', ['id' => $room->id]);
    }

    public function test_delete_room_fails_with_409_if_referenced_by_schedule(): void
    {
        Sanctum::actingAs($this->waka);

        $room = Room::create(['name' => 'Lab Jaringan', 'capacity' => 36]);
        $class = Classes::create(['name' => 'XII TKJ 1', 'level' => 12]);
        $subject = Subject::create(['name' => 'Administrasi Jaringan']);

        Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $class->id,
            'room_id' => $room->id,
            'subject_id' => $subject->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $response = $this->deleteJson('/api/rooms/' . $room->id);
        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'message' => 'Ruangan tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
            ]);
    }

    public function test_non_waka_cannot_mutate_rooms(): void
    {
        Sanctum::actingAs($this->teacher);

        $room = Room::create(['name' => 'Ruang Server', 'capacity' => 10]);

        $this->postJson('/api/rooms', ['name' => 'Ruang Baru', 'capacity' => 20])
            ->assertStatus(403);

        $this->putJson('/api/rooms/' . $room->id, ['name' => 'Ganti Nama', 'capacity' => 20])
            ->assertStatus(403);

        $this->deleteJson('/api/rooms/' . $room->id)
            ->assertStatus(403);
    }

    public function test_soft_deleted_room_name_can_be_reused(): void
    {
        Sanctum::actingAs($this->waka);

        $room = Room::create(['name' => 'Lab Multimedia', 'capacity' => 30]);
        $room->delete();

        $response = $this->postJson('/api/rooms', [
            'name' => 'Lab Multimedia',
            'capacity' => 35,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Lab Multimedia',
                    'capacity' => 35,
                ],
            ]);
    }
}
