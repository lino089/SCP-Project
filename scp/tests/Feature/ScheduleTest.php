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

class ScheduleTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;
    private User $teacher2;
    private Classes $class;
    private Rooms $room;
    private Subject $subject;

    protected function setUp(): void
    {
        parent::setUp();

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('wakaPassword123'),
            'must_change_password' => false,
        ]);

        $this->teacher = User::create([
            'name' => 'Guru A',
            'email' => 'guru_a@example.com',
            'nis_nip' => '198001012005011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->teacher2 = User::create([
            'name' => 'Guru B',
            'email' => 'guru_b@example.com',
            'nis_nip' => '198001012005011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->class = Classes::create([
            'name' => 'X RPL 1',
            'level' => '10',
        ]);

        $this->room = Rooms::create([
            'name' => 'Lab Komputer 1',
            'capacity' => 36,
        ]);

        $this->subject = Subject::create([
            'name' => 'Pemrograman Web',
        ]);
    }

    public function test_schedule_store_requires_password_confirmation(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/schedules', [
            'cycle_type' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
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

        $this->assertDatabaseCount('schedules', 0);
    }

    public function test_schedule_store_success_creates_single_record(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/schedules', [
            'cycle_type' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'password' => 'wakaPassword123',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Jadwal berhasil dibuat',
            ]);

        // Pastikan hanya 1 record yang dibuat (tidak terduplikasi)
        $this->assertDatabaseCount('schedules', 1);

        $this->assertDatabaseHas('schedules', [
            'cycle_type' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'source' => 'manual',
        ]);
    }

    public function test_schedule_store_detects_conflict(): void
    {
        Sanctum::actingAs($this->waka);

        // Schedule 1: Period 1..2
        Schedule::create([
            'cycle_type' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'source' => 'manual',
        ]);

        // Attempt overlapping schedule: Period 2..3 with same teacher
        $response = $this->postJson('/api/schedules', [
            'cycle_type' => 1,
            'period_number' => 2,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'password' => 'wakaPassword123',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Jadwal bentrok!',
            ]);

        $this->assertDatabaseCount('schedules', 1);
    }

    public function test_schedule_adjacent_periods_do_not_conflict(): void
    {
        Sanctum::actingAs($this->waka);

        // Schedule 1: Period 1..2 (Period 1 dan 2)
        Schedule::create([
            'cycle_type' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'source' => 'manual',
        ]);

        // Schedule 2: Period 3..4 (Period 3 dan 4) - berdekatan tapi TIDAK overlap
        $response = $this->postJson('/api/schedules', [
            'cycle_type' => 1,
            'period_number' => 3,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'password' => 'wakaPassword123',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Jadwal berhasil dibuat',
            ]);

        $this->assertDatabaseCount('schedules', 2);
    }

    public function test_schedule_update_requires_password_confirmation(): void
    {
        Sanctum::actingAs($this->waka);

        $schedule = Schedule::create([
            'cycle_type' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'source' => 'manual',
        ]);

        $response = $this->putJson("/api/schedules/{$schedule->id}", [
            'cycle_type' => 1,
            'period_number' => 3,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
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

        $this->assertDatabaseHas('schedules', [
            'id' => $schedule->id,
            'period_number' => 1,
        ]);
    }

    public function test_schedule_update_success_with_valid_password(): void
    {
        Sanctum::actingAs($this->waka);

        $schedule = Schedule::create([
            'cycle_type' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'source' => 'manual',
        ]);

        $response = $this->putJson("/api/schedules/{$schedule->id}", [
            'cycle_type' => 1,
            'period_number' => 3,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'password' => 'wakaPassword123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Jadwal berhasil diperbarui',
                'data' => [
                    'id' => $schedule->id,
                    'period_number' => 3,
                ],
            ]);

        $this->assertDatabaseHas('schedules', [
            'id' => $schedule->id,
            'period_number' => 3,
        ]);
    }

    public function test_schedule_update_fails_when_conflicting_with_other_schedule(): void
    {
        Sanctum::actingAs($this->waka);

        // Schedule A: teacher, day 1, period 1..2
        $scheduleA = Schedule::create([
            'cycle_type' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'source' => 'manual',
        ]);

        // Schedule B: teacher2, day 1, period 3..4
        $scheduleB = Schedule::create([
            'cycle_type' => 1,
            'period_number' => 3,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher2->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'source' => 'manual',
        ]);

        // Try updating schedule B to move to period 2..3 with teacher (conflicts with teacher & room & class at period 2)
        $response = $this->putJson("/api/schedules/{$scheduleB->id}", [
            'cycle_type' => 1,
            'period_number' => 2,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'password' => 'wakaPassword123',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Jadwal bentrok!',
            ]);
    }

    public function test_schedule_destroy_requires_password_confirmation(): void
    {
        Sanctum::actingAs($this->waka);

        $schedule = Schedule::create([
            'cycle_type' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'source' => 'manual',
        ]);

        $response = $this->deleteJson("/api/schedules/{$schedule->id}", [
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

        $this->assertDatabaseHas('schedules', [
            'id' => $schedule->id,
            'deleted_at' => null,
        ]);
    }

    public function test_schedule_destroy_success_soft_deletes_schedule(): void
    {
        Sanctum::actingAs($this->waka);

        $schedule = Schedule::create([
            'cycle_type' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'source' => 'manual',
        ]);

        $response = $this->deleteJson("/api/schedules/{$schedule->id}", [
            'password' => 'wakaPassword123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Jadwal berhasil dihapus',
            ]);

        $this->assertSoftDeleted('schedules', [
            'id' => $schedule->id,
        ]);
    }
}
