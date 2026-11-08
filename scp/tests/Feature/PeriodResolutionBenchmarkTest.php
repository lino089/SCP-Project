<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\PeriodTemplate;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\User;
use App\Models\Journal;
use App\Models\Attendance;
use App\Models\AcademicEvent;
use App\Models\TeacherAssignment;
use Database\Seeders\PeriodTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PeriodResolutionBenchmarkTest extends TestCase
{
    use RefreshDatabase;

    public function test_schedule_index_executes_minimal_queries(): void
    {
        $this->seed(PeriodTemplateSeeder::class);

        $waka = User::factory()->create(['role' => 'vice_principal', 'nis_nip' => '197001011990011001']);
        $teacher = User::factory()->create(['role' => 'teacher', 'nis_nip' => '198001012005011001']);
        $class = Classes::create(['name' => 'X RPL 1', 'level' => '10']);
        $room = Room::create(['name' => '12', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Matematika']);

        // Create 20 schedules
        for ($i = 1; $i <= 20; $i++) {
            Schedule::create([
                'cycle_type' => 1,
                'day_of_week' => ($i % 5) + 1,
                'period_number' => ($i % 8) + 1,
                'duration_periods' => 2,
                'teacher_id' => $teacher->id,
                'class_id' => $class->id,
                'room_id' => $room->id,
                'subject_id' => $subject->id,
                'source' => 'manual',
            ]);
        }

        DB::enableQueryLog();

        $req = Request::create('/api/schedules', 'GET', ['all' => 1, 'cycle' => 1]);
        $req->setUserResolver(fn() => $waka);

        $res = app(\App\Http\Controllers\API\ScheduleController::class)->index($req);

        $queries = DB::getQueryLog();
        $queryCount = count($queries);

        // Minimal queries: schedules, classes, users, rooms, subjects, journals, period_templates + academic_events per weekday
        $this->assertLessThanOrEqual(15, $queryCount);
        $this->assertTrue($res->getData()->success);
        $this->assertCount(20, $res->getData()->data);
    }

    public function test_attendance_index_executes_minimal_queries(): void
    {
        $waka = User::factory()->create(['role' => 'vice_principal', 'nis_nip' => '197001011990011002']);
        $teacher = User::factory()->create(['role' => 'teacher', 'nis_nip' => '198001012005011002']);
        $class = Classes::create(['name' => 'XI RPL 1', 'level' => '11']);
        $room = Room::create(['name' => 'Lab 1', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Pemrograman']);

        $schedule = Schedule::create([
            'cycle_type' => 1,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $teacher->id,
            'class_id' => $class->id,
            'room_id' => $room->id,
            'subject_id' => $subject->id,
            'source' => 'manual',
        ]);

        $journal = Journal::create([
            'schedule_id' => $schedule->id,
            'date' => '2026-11-09',
            'status' => 'completed',
            'topic_description' => 'Materi Array',
        ]);

        $student = User::factory()->create([
            'role' => 'student',
            'class_id' => $class->id,
            'nis_nip' => '1001',
        ]);

        Attendance::create([
            'journal_id' => $journal->id,
            'student_id' => $student->id,
            'date' => '2026-11-09',
            'status' => 'Hadir',
        ]);

        DB::flushQueryLog();
        DB::enableQueryLog();

        $req = Request::create('/api/attendances', 'GET', ['per_page' => 15]);
        $req->setUserResolver(fn() => $waka);

        $res = app(\App\Http\Controllers\API\AttendanceController::class)->index($req);

        $queries = DB::getQueryLog();
        $queryCount = count($queries);

        // Ambang query <= 12 per dokumen rancangan
        $this->assertLessThanOrEqual(12, $queryCount);
        $this->assertTrue($res->getData()->success);
    }

    public function test_academic_event_my_calendar_executes_minimal_queries(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher', 'nis_nip' => '198001012005011003']);
        $class = Classes::create(['name' => 'XII RPL 1', 'level' => '12']);

        TeacherAssignment::create([
            'user_id' => $teacher->id,
            'class_id' => $class->id,
            'type' => 'wali_kelas',
            'is_active' => true,
        ]);

        TeacherAssignment::create([
            'user_id' => $teacher->id,
            'class_id' => null,
            'type' => 'kesiswaan',
            'is_active' => true,
        ]);

        AcademicEvent::create([
            'title' => 'Libur Nasional',
            'start_date' => '2026-11-10',
            'end_date' => '2026-11-10',
            'type' => 'holiday',
            'scope_type' => AcademicEvent::SCOPE_ALL,
            'disables_teaching' => true,
            'is_active' => true,
        ]);

        DB::flushQueryLog();
        DB::enableQueryLog();

        $req = Request::create('/api/academic-events/my-calendar', 'GET');
        $req->setUserResolver(fn() => $teacher);

        $res = app(\App\Http\Controllers\API\AcademicEventController::class)->myCalendar($req);

        $queries = DB::getQueryLog();
        $queryCount = count($queries);

        // Ambang batas query <= 12 (berkat memoize helper dan eliminasi N+1)
        $this->assertLessThanOrEqual(12, $queryCount);
        $this->assertTrue($res->getData()->success);
    }

    public function test_attendance_pagination_validates_per_page_bounds(): void
    {
        $waka = User::factory()->create(['role' => 'vice_principal', 'nis_nip' => '197001011990011004']);

        // 1. per_page=100000 melebihi batas max:100 -> harus 422
        $responseExcessive = $this->actingAs($waka, 'sanctum')
            ->getJson('/api/attendances?per_page=100000');

        $responseExcessive->assertStatus(422)
            ->assertJsonValidationErrors(['per_page']);

        // 2. per_page=50 dalam batas yang sah -> harus 200
        $responseValid = $this->actingAs($waka, 'sanctum')
            ->getJson('/api/attendances?per_page=50');

        $responseValid->assertStatus(200);
    }

    public function test_login_rate_limiter_blocks_on_sixth_attempt(): void
    {
        $payload = [
            'nis_nip' => 'invalid_user_test',
            'password' => 'wrong_password',
            'device_name' => 'test_device',
        ];

        // 5 percobaan pertama gagal dengan 401
        for ($i = 1; $i <= 5; $i++) {
            $res = $this->postJson('/api/login', $payload);
            $this->assertNotEquals(429, $res->status(), "Attempt $i should not be rate limited yet");
        }

        // Percobaan ke-6 harus terkena HTTP 429 Too Many Requests
        $resBlocked = $this->postJson('/api/login', $payload);
        $resBlocked->assertStatus(429);
        $resBlocked->assertJson([
            'success' => false,
            'message' => 'Terlalu banyak percobaan login. Silakan tunggu 1 menit sebelum mencoba kembali.',
        ]);
    }

    public function test_health_endpoint_returns_healthy_status(): void
    {
        $response = $this->getJson('/api/health');
        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'status' => 'healthy',
                'services' => [
                    'database' => ['status' => 'ok'],
                    'cache' => ['status' => 'ok'],
                    'queue' => ['status' => 'ok'],
                ],
            ],
        ]);
    }
}
