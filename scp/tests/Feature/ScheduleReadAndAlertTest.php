<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Journal;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\SystemConfiguration;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\PeriodTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ScheduleReadAndAlertTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacherA;
    private User $teacherB;
    private Classes $class1;
    private Classes $class2;
    private Room $room1;
    private Subject $subject1;
    private Subject $subject2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PeriodTemplateSeeder::class);

        SystemConfiguration::create([
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->teacherA = User::create([
            'name' => 'Guru A',
            'email' => 'gurua@example.com',
            'nis_nip' => '198001012010011001',
            'fet_staff_id' => 'GA01',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->teacherB = User::create([
            'name' => 'Guru B',
            'email' => 'gurub@example.com',
            'nis_nip' => '198001012010011002',
            'fet_staff_id' => 'GB02',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->class1 = Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        $this->class2 = Classes::create(['name' => 'XI RPL 1', 'level' => 11]);
        $this->room1 = Room::create(['name' => 'Lab Komputer 1', 'capacity' => 36]);
        $this->subject1 = Subject::create(['name' => 'Pemrograman Dasar']);
        $this->subject2 = Subject::create(['name' => 'Basis Data']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_teacher_can_only_read_their_own_schedules(): void
    {
        // Schedule for Teacher A on Monday Cycle 1
        Schedule::create([
            'teacher_id' => $this->teacherA->id,
            'class_id' => $this->class1->id,
            'room_id' => $this->room1->id,
            'subject_id' => $this->subject1->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        // Schedule for Teacher B on Monday Cycle 1
        Schedule::create([
            'teacher_id' => $this->teacherB->id,
            'class_id' => $this->class2->id,
            'room_id' => $this->room1->id,
            'subject_id' => $this->subject2->id,
            'day_of_week' => 1,
            'period_number' => 3,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        Sanctum::actingAs($this->teacherA);

        $response = $this->getJson('/api/schedules?cycle=1');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.teacher_id', $this->teacherA->id)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'teacher_id',
                        'class_id',
                        'period_number',
                        'duration_periods',
                        'resolved_times' => ['start_time', 'end_time'],
                        'school_class',
                        'teacher',
                        'room',
                        'subject',
                    ],
                ],
            ]);
    }

    public function test_waka_can_read_all_schedules_and_filter_by_teacher_and_class(): void
    {
        Schedule::create([
            'teacher_id' => $this->teacherA->id,
            'class_id' => $this->class1->id,
            'room_id' => $this->room1->id,
            'subject_id' => $this->subject1->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        Schedule::create([
            'teacher_id' => $this->teacherB->id,
            'class_id' => $this->class2->id,
            'room_id' => $this->room1->id,
            'subject_id' => $this->subject2->id,
            'day_of_week' => 1,
            'period_number' => 3,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        Sanctum::actingAs($this->waka);

        // Waka sees all
        $allResponse = $this->getJson('/api/schedules?cycle=1');
        $allResponse->assertStatus(200)
            ->assertJsonCount(2, 'data');

        // Waka filters by Teacher B
        $filteredResponse = $this->getJson('/api/schedules?cycle=1&teacher_id=' . $this->teacherB->id);
        $filteredResponse->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.teacher_id', $this->teacherB->id);
    }

    public function test_schedule_filter_by_day_and_cycle(): void
    {
        // Monday Cycle 1
        Schedule::create([
            'teacher_id' => $this->teacherA->id,
            'class_id' => $this->class1->id,
            'room_id' => $this->room1->id,
            'subject_id' => $this->subject1->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        // Tuesday Cycle 1
        Schedule::create([
            'teacher_id' => $this->teacherA->id,
            'class_id' => $this->class1->id,
            'room_id' => $this->room1->id,
            'subject_id' => $this->subject1->id,
            'day_of_week' => 2,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        // Monday Cycle 2
        Schedule::create([
            'teacher_id' => $this->teacherA->id,
            'class_id' => $this->class1->id,
            'room_id' => $this->room1->id,
            'subject_id' => $this->subject1->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 2,
            'source' => 'manual',
        ]);

        Sanctum::actingAs($this->waka);

        // Filter Day 1 Cycle 1 -> 1 schedule
        $response = $this->getJson('/api/schedules?cycle=1&day=1');
        $response->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.day_of_week', 1)
            ->assertJsonPath('data.0.cycle_type', 1);

        // Filter Day 1 Cycle 2 -> 1 schedule
        $responseCycle2 = $this->getJson('/api/schedules?cycle=2&day=1');
        $responseCycle2->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.cycle_type', 2);
    }

    public function test_missing_journal_alert_detects_overdue_schedule_without_journal(): void
    {
        // Set fixed test time: Monday at 09:30:00 WIB
        // On Senin Upacara, JP 1 ends at 08:45:00.
        // Deadline = 08:45:00 + 30 mins = 09:15:00.
        // At 09:30:00, it is 15 minutes past the grace period!
        $testMonday = Carbon::parse('2026-10-19 09:30:00', 'Asia/Jakarta');
        Carbon::setTestNow($testMonday);

        $schedule = Schedule::create([
            'teacher_id' => $this->teacherA->id,
            'class_id' => $this->class1->id,
            'room_id' => $this->room1->id,
            'subject_id' => $this->subject1->id,
            'day_of_week' => 1, // Monday
            'period_number' => 1,
            'duration_periods' => 1,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->getJson('/api/schedules?status=missing_journal');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $schedule->id)
            ->assertJsonPath('data.0.journal_status', 'not_started')
            ->assertJsonPath('meta.total_missing', 1);
    }

    public function test_missing_journal_alert_ignores_schedule_within_grace_period(): void
    {
        // Monday at 09:00:00 WIB.
        // JP 1 ends at 08:45:00. Grace period extends to 09:15:00.
        // At 09:00:00, only 15 minutes passed -> NOT overdue.
        $testMonday = Carbon::parse('2026-10-19 09:00:00', 'Asia/Jakarta');
        Carbon::setTestNow($testMonday);

        Schedule::create([
            'teacher_id' => $this->teacherA->id,
            'class_id' => $this->class1->id,
            'room_id' => $this->room1->id,
            'subject_id' => $this->subject1->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 1,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->getJson('/api/schedules?status=missing_journal');

        $response->assertStatus(200)
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.total_missing', 0);
    }

    public function test_missing_journal_alert_ignores_completed_journal(): void
    {
        // Monday at 10:00:00 WIB (well past JP 1 end).
        $testMonday = Carbon::parse('2026-10-19 10:00:00', 'Asia/Jakarta');
        Carbon::setTestNow($testMonday);

        $schedule = Schedule::create([
            'teacher_id' => $this->teacherA->id,
            'class_id' => $this->class1->id,
            'room_id' => $this->room1->id,
            'subject_id' => $this->subject1->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 1,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        // Create completed journal for today
        Journal::create([
            'schedule_id' => $schedule->id,
            'date' => $testMonday->toDateString(),
            'topic_description' => 'Materi Selesai',
            'status' => 'completed',
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->getJson('/api/schedules?status=missing_journal');

        $response->assertStatus(200)
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.total_missing', 0);
    }

    public function test_missing_journal_alert_excludes_teacher_absent_status(): void
    {
        // Monday at 10:00:00 WIB.
        $testMonday = Carbon::parse('2026-10-19 10:00:00', 'Asia/Jakarta');
        Carbon::setTestNow($testMonday);

        $schedule = Schedule::create([
            'teacher_id' => $this->teacherA->id,
            'class_id' => $this->class1->id,
            'room_id' => $this->room1->id,
            'subject_id' => $this->subject1->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 1,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        // Marked as teacher_absent per PRD 5.6 & 5.7
        Journal::create([
            'schedule_id' => $schedule->id,
            'date' => $testMonday->toDateString(),
            'topic_description' => 'Guru Sakit',
            'status' => 'teacher_absent',
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->getJson('/api/schedules?status=missing_journal');

        $response->assertStatus(200)
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.total_missing', 0);
    }

    public function test_missing_journal_alert_is_scoped_for_teacher(): void
    {
        $testMonday = Carbon::parse('2026-10-19 10:05:00', 'Asia/Jakarta');
        Carbon::setTestNow($testMonday);

        // Schedule for Teacher A (missing)
        Schedule::create([
            'teacher_id' => $this->teacherA->id,
            'class_id' => $this->class1->id,
            'room_id' => $this->room1->id,
            'subject_id' => $this->subject1->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 1,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        // Schedule for Teacher B (missing)
        Schedule::create([
            'teacher_id' => $this->teacherB->id,
            'class_id' => $this->class2->id,
            'room_id' => $this->room1->id,
            'subject_id' => $this->subject2->id,
            'day_of_week' => 1,
            'period_number' => 2,
            'duration_periods' => 1,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        // Teacher A checks missing journals -> sees ONLY Teacher A
        Sanctum::actingAs($this->teacherA);
        $teacherResponse = $this->getJson('/api/schedules?status=missing_journal');
        $teacherResponse->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.teacher_id', $this->teacherA->id);

        // Waka checks missing journals -> sees BOTH
        Sanctum::actingAs($this->waka);
        $wakaResponse = $this->getJson('/api/schedules?status=missing_journal');
        $wakaResponse->assertStatus(200)
            ->assertJsonCount(2, 'data');
    }
}
