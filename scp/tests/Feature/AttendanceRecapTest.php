<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Classes;
use App\Models\Journal;
use App\Models\Rooms;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\SystemConfiguration;
use App\Models\TeacherAssignment;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\PeriodTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AttendanceRecapTest extends TestCase
{
    use RefreshDatabase;

    private User $waliKelas;
    private User $kesiswaan;
    private User $regularTeacher;
    private User $student1;
    private User $student2;
    private User $studentOtherClass;
    private Classes $classA;
    private Classes $classB;
    private Classes $classOther;
    private Schedule $scheduleA;
    private Journal $journal1;
    private Journal $journal2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PeriodTemplateSeeder::class);

        SystemConfiguration::create([
            'id' => 1,
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        // Classes
        $this->classA = Classes::create(['name' => 'X RPL 1', 'level' => 'X']);
        $this->classB = Classes::create(['name' => 'X RPL 2', 'level' => 'X']);
        $this->classOther = Classes::create(['name' => 'XI TKJ 1', 'level' => 'XI']);

        $room = Rooms::create(['name' => 'Lab RPL 1', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Pemrograman Berorientasi Objek', 'code' => 'PBO']);

        // Users
        $this->waliKelas = User::create([
            'name' => 'Bu Guru Wali',
            'email' => 'wali@example.com',
            'nis_nip' => '198101012005012001',
            'role' => 'teacher',
            'password' => Hash::make('secret123'),
        ]);

        $this->kesiswaan = User::create([
            'name' => 'Pak Guru Kesiswaan',
            'email' => 'kesiswaan@example.com',
            'nis_nip' => '198202022006021002',
            'role' => 'teacher',
            'password' => Hash::make('secret123'),
        ]);

        $this->regularTeacher = User::create([
            'name' => 'Guru Biasa',
            'email' => 'guru@example.com',
            'nis_nip' => '198303032007031003',
            'role' => 'teacher',
            'password' => Hash::make('secret123'),
        ]);

        // Assignments
        // Bu Guru Wali is wali kelas of classA
        TeacherAssignment::create([
            'user_id' => $this->waliKelas->id,
            'type' => 'wali_kelas',
            'class_id' => $this->classA->id,
            'is_active' => true,
        ]);

        // Pak Kesiswaan is kesiswaan for classA and classB
        TeacherAssignment::create([
            'user_id' => $this->kesiswaan->id,
            'type' => 'kesiswaan',
            'class_id' => $this->classA->id,
            'is_active' => true,
        ]);
        TeacherAssignment::create([
            'user_id' => $this->kesiswaan->id,
            'type' => 'kesiswaan',
            'class_id' => $this->classB->id,
            'is_active' => true,
        ]);

        // Students
        $this->student1 = User::create([
            'name' => 'Aditya Pratama',
            'email' => 'aditya@example.com',
            'nis_nip' => '10001',
            'role' => 'student',
            'gender' => 'L',
            'class_id' => $this->classA->id,
            'password' => Hash::make('secret123'),
        ]);

        $this->student2 = User::create([
            'name' => 'Bela Safitri',
            'email' => 'bela@example.com',
            'nis_nip' => '10002',
            'role' => 'student',
            'gender' => 'P',
            'class_id' => $this->classA->id,
            'password' => Hash::make('secret123'),
        ]);

        $this->studentOtherClass = User::create([
            'name' => 'Citra Dewi',
            'email' => 'citra@example.com',
            'nis_nip' => '10003',
            'role' => 'student',
            'gender' => 'P',
            'class_id' => $this->classOther->id,
            'password' => Hash::make('secret123'),
        ]);

        // Schedule & Journals
        $this->scheduleA = Schedule::create([
            'class_id' => $this->classA->id,
            'subject_id' => $subject->id,
            'teacher_id' => $this->waliKelas->id,
            'room_id' => $room->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->journal1 = Journal::create([
            'schedule_id' => $this->scheduleA->id,
            'date' => Carbon::now('Asia/Jakarta')->subDays(2)->toDateString(),
            'status' => 'completed',
            'topic_description' => 'Konsep Dasar OOP',
        ]);

        $this->journal2 = Journal::create([
            'schedule_id' => $this->scheduleA->id,
            'date' => Carbon::now('Asia/Jakarta')->subDay()->toDateString(),
            'status' => 'completed',
            'topic_description' => 'Encapsulation & Inheritance',
        ]);

        // Attendance Student 1: Both Hadir
        Attendance::create([
            'journal_id' => $this->journal1->id,
            'student_id' => $this->student1->id,
            'date' => $this->journal1->date,
            'status' => 'Hadir',
            'notes' => null,
        ]);
        Attendance::create([
            'journal_id' => $this->journal2->id,
            'student_id' => $this->student1->id,
            'date' => $this->journal2->date,
            'status' => 'Hadir',
            'notes' => null,
        ]);

        // Attendance Student 2: 1 Sakit, 1 Alpa with Teacher Notes
        Attendance::create([
            'journal_id' => $this->journal1->id,
            'student_id' => $this->student2->id,
            'date' => $this->journal1->date,
            'status' => 'Sakit',
            'notes' => 'Surat dokter terlampir di meja piket',
        ]);
        Attendance::create([
            'journal_id' => $this->journal2->id,
            'student_id' => $this->student2->id,
            'date' => $this->journal2->date,
            'status' => 'Alpa',
            'notes' => 'Tidak hadir tanpa kabar, nomor HP orang tua tidak aktif',
        ]);
    }

    public function test_unauthenticated_user_cannot_access_endpoints(): void
    {
        $this->getJson('/api/attendance-recap/classes')->assertStatus(401);
        $this->getJson('/api/attendance-recap/summary')->assertStatus(401);
    }

    public function test_teacher_without_wali_or_kesiswaan_assignment_gets_403(): void
    {
        Sanctum::actingAs($this->regularTeacher);

        $this->getJson('/api/attendance-recap/classes')->assertStatus(403);
        $this->getJson('/api/attendance-recap/summary')->assertStatus(403);
    }

    public function test_wali_kelas_fetches_classes_and_only_receives_assigned_class(): void
    {
        Sanctum::actingAs($this->waliKelas);

        $response = $this->getJson('/api/attendance-recap/classes');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.role_context.is_wali_kelas', true)
            ->assertJsonPath('data.role_context.is_kesiswaan', false)
            ->assertJsonCount(1, 'data.classes')
            ->assertJsonPath('data.classes.0.id', $this->classA->id);
    }

    public function test_kesiswaan_fetches_classes_and_receives_assigned_classes(): void
    {
        Sanctum::actingAs($this->kesiswaan);

        $response = $this->getJson('/api/attendance-recap/classes');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.role_context.is_kesiswaan', true)
            ->assertJsonCount(2, 'data.classes')
            ->assertJsonPath('data.default_class_id', 'all');
    }

    public function test_wali_kelas_can_view_summary_of_own_class_with_accurate_kpi(): void
    {
        Sanctum::actingAs($this->waliKelas);

        $response = $this->getJson('/api/attendance-recap/summary?class_id=' . $this->classA->id);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.kpi.total_students', 2)
            ->assertJsonPath('data.kpi.total_hadir', 2)
            ->assertJsonPath('data.kpi.total_sakit', 1)
            ->assertJsonPath('data.kpi.total_alpa', 1);

        $students = collect($response->json('data.students'));
        
        // Student 1 (Aditya): 2 Hadir, 0 Alpa => 100%, Safe
        $aditya = $students->firstWhere('id', $this->student1->id);
        $this->assertEquals(2, $aditya['hadir']);
        $this->assertEquals(0, $aditya['alpa']);
        $this->assertEquals(100.0, $aditya['attendance_rate']);
        $this->assertEquals('safe', $aditya['risk_level']);

        // Student 2 (Bela): 0 Hadir, 1 Sakit, 1 Alpa => 0%, Alpa 1 => danger (rate < 85%)
        $bela = $students->firstWhere('id', $this->student2->id);
        $this->assertEquals(0, $bela['hadir']);
        $this->assertEquals(1, $bela['sakit']);
        $this->assertEquals(1, $bela['alpa']);
        $this->assertEquals(0.0, $bela['attendance_rate']);
        $this->assertEquals('danger', $bela['risk_level']);
        $this->assertEquals('Tidak hadir tanpa kabar, nomor HP orang tua tidak aktif', $bela['latest_note']);
    }

    public function test_wali_kelas_forbidden_from_viewing_unassigned_class(): void
    {
        Sanctum::actingAs($this->waliKelas);

        $this->getJson('/api/attendance-recap/summary?class_id=' . $this->classOther->id)
            ->assertStatus(403);
    }

    public function test_wali_kelas_forbidden_from_viewing_all_classes(): void
    {
        Sanctum::actingAs($this->waliKelas);

        $this->getJson('/api/attendance-recap/summary?class_id=all')
            ->assertStatus(403);
    }

    public function test_kesiswaan_can_view_all_assigned_classes_and_class_comparisons(): void
    {
        Sanctum::actingAs($this->kesiswaan);

        $response = $this->getJson('/api/attendance-recap/summary?class_id=all');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.is_multi_class', true);

        $comparisons = $response->json('data.class_comparisons');
        $this->assertNotEmpty($comparisons);
    }

    public function test_student_history_returns_timeline_with_teacher_notes(): void
    {
        Sanctum::actingAs($this->waliKelas);

        $response = $this->getJson('/api/attendance-recap/student/' . $this->student2->id);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.student.name', 'Bela Safitri')
            ->assertJsonPath('data.summary.alpa', 1)
            ->assertJsonPath('data.summary.sakit', 1)
            ->assertJsonPath('data.summary.has_notes_count', 2)
            ->assertJsonCount(2, 'data.history');

        $history = collect($response->json('data.history'));
        $alpaRecord = $history->firstWhere('status', 'Alpa');
        $this->assertEquals('Tidak hadir tanpa kabar, nomor HP orang tua tidak aktif', $alpaRecord['notes']);
    }

    public function test_student_history_forbidden_for_student_outside_assigned_classes(): void
    {
        Sanctum::actingAs($this->waliKelas);

        $this->getJson('/api/attendance-recap/student/' . $this->studentOtherClass->id)
            ->assertStatus(403);
    }

    public function test_export_excel_returns_successful_download(): void
    {
        Sanctum::actingAs($this->waliKelas);

        $response = $this->get('/api/attendance-recap/export?class_id=' . $this->classA->id);

        $response->assertStatus(200);
        $this->assertStringContainsString('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', $response->headers->get('Content-Type'));
    }
}
