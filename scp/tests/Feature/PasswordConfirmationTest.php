<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Rooms;
use App\Models\ScheduleImport;
use App\Models\Subject;
use App\Models\SystemConfiguration;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PasswordConfirmationTest extends TestCase
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
            'password' => Hash::make('wakaSecret123'),
            'must_change_password' => false,
        ]);
    }

    public function test_monday_status_fails_with_invalid_password(): void
    {
        SystemConfiguration::create([
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->patchJson('/api/academic-settings/monday-status', [
            'is_upacara' => false,
            'password' => 'wrongPassword',
        ]);

        $response->assertStatus(422)
            ->assertExactJson([
                'success' => false,
                'message' => 'Validasi Gagal',
                'errors' => [
                    'password' => ['Password tidak valid'],
                ],
            ]);
    }

    public function test_monday_status_succeeds_with_valid_password(): void
    {
        SystemConfiguration::create([
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->patchJson('/api/academic-settings/monday-status', [
            'is_upacara' => false,
            'password' => 'wakaSecret123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Status upacara hari senin berhasil diperbarui.',
                'data' => [
                    'monday_is_upacara' => false,
                ],
            ]);
    }

    public function test_schedule_store_fails_with_invalid_password(): void
    {
        $teacher = User::create([
            'name' => 'Guru Pengajar',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012005011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $class = Classes::create([
            'name' => 'X RPL 1',
            'level' => 10,
        ]);

        $room = Rooms::create([
            'name' => 'Lab Komputer 1',
            'capacity' => 36,
        ]);

        $subject = Subject::create([
            'name' => 'Pemrograman Berorientasi Objek',
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/schedules', [
            'cycle_type' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $teacher->id,
            'class_id' => $class->id,
            'room_id' => $room->id,
            'subject_id' => $subject->id,
            'day_of_week' => 1,
            'password' => 'wrongPassword',
        ]);

        $response->assertStatus(422)
            ->assertExactJson([
                'success' => false,
                'message' => 'Validasi Gagal',
                'errors' => [
                    'password' => ['Password tidak valid'],
                ],
            ]);
    }

    public function test_schedule_import_confirm_fails_with_invalid_password(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/schedule-imports/999/confirm', [
            'password' => 'wrongPassword',
        ]);

        $response->assertStatus(422)
            ->assertExactJson([
                'success' => false,
                'message' => 'Validasi Gagal',
                'errors' => [
                    'password' => ['Password tidak valid'],
                ],
            ]);
    }
}
