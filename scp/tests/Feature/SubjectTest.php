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

class SubjectTest extends TestCase
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

    public function test_authenticated_user_can_list_subjects_and_search(): void
    {
        Sanctum::actingAs($this->teacher);

        Subject::create(['name' => 'Matematika']);
        Subject::create(['name' => 'Bahasa Indonesia']);

        $response = $this->getJson('/api/subjects');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonCount(2, 'data');

        $searchResponse = $this->getJson('/api/subjects?search=Mate');
        $searchResponse->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Matematika');
    }

    public function test_waka_can_create_subject(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/subjects', [
            'name' => 'Fisika',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Fisika',
                ],
            ]);

        $this->assertDatabaseHas('subjects', [
            'name' => 'Fisika',
        ]);
    }

    public function test_waka_can_update_subject(): void
    {
        Sanctum::actingAs($this->waka);

        $subject = Subject::create(['name' => 'Fisika']);

        $response = $this->putJson('/api/subjects/' . $subject->id, [
            'name' => 'Fisika Terapan',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Fisika Terapan',
                ],
            ]);

        $this->assertDatabaseHas('subjects', [
            'id' => $subject->id,
            'name' => 'Fisika Terapan',
        ]);
    }

    public function test_waka_can_delete_subject_without_schedules(): void
    {
        Sanctum::actingAs($this->waka);

        $subject = Subject::create(['name' => 'Biologi']);

        $response = $this->deleteJson('/api/subjects/' . $subject->id);
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Data mata pelajaran berhasil dihapus.',
            ]);

        $this->assertSoftDeleted('subjects', ['id' => $subject->id]);
    }

    public function test_delete_subject_fails_with_409_if_referenced_by_schedule(): void
    {
        Sanctum::actingAs($this->waka);

        $subject = Subject::create(['name' => 'Kimia']);
        $room = Room::create(['name' => 'Lab IPA', 'capacity' => 30]);
        $class = Classes::create(['name' => 'X IPA 1', 'level' => 10]);

        Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $class->id,
            'room_id' => $room->id,
            'subject_id' => $subject->id,
            'day_of_week' => 2,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $response = $this->deleteJson('/api/subjects/' . $subject->id);
        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'message' => 'Mata pelajaran tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
            ]);
    }

    public function test_unique_soft_delete_rule_allows_recreating_same_name_subject(): void
    {
        Sanctum::actingAs($this->waka);

        $subject = Subject::create(['name' => 'Sejarah']);
        $subject->delete();

        $response = $this->postJson('/api/subjects', [
            'name' => 'Sejarah',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Sejarah',
                ],
            ]);
    }

    public function test_non_waka_cannot_mutate_subject(): void
    {
        Sanctum::actingAs($this->teacher);

        $subject = Subject::create(['name' => 'Seni Budaya']);

        $this->postJson('/api/subjects', ['name' => 'Seni Rupa'])
            ->assertStatus(403);

        $this->putJson('/api/subjects/' . $subject->id, ['name' => 'Seni Tari'])
            ->assertStatus(403);

        $this->deleteJson('/api/subjects/' . $subject->id)
            ->assertStatus(403);
    }
}
