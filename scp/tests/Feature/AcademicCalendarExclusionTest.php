<?php

namespace Tests\Feature;

use App\Models\AcademicEvent;
use App\Models\Classes;
use App\Models\Journal;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\SystemConfiguration;
use App\Models\User;
use App\Services\AcademicCalendarExclusionService;
use Carbon\Carbon;
use Database\Seeders\PeriodTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AcademicCalendarExclusionTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;
    private User $student;
    private Classes $classGrade10;
    private Classes $classGrade11;
    private Subject $subject;
    private Room $room;
    private Schedule $scheduleGrade10;
    private Schedule $scheduleGrade11;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        AcademicCalendarExclusionService::clearCache();
        $this->seed(PeriodTemplateSeeder::class);

        SystemConfiguration::create([
            'id' => 1,
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990031001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
        ]);

        $this->teacher = User::create([
            'name' => 'Budi Santoso, S.Pd.',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012005011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $this->classGrade10 = Classes::create([
            'name' => 'X RPL 1',
            'level' => 10,
        ]);

        $this->classGrade11 = Classes::create([
            'name' => 'XI RPL 1',
            'level' => 11,
        ]);

        $this->student = User::create([
            'name' => 'Siswa Teladan',
            'email' => 'siswa@example.com',
            'nis_nip' => '12345678',
            'role' => 'student',
            'class_id' => $this->classGrade10->id,
            'password' => Hash::make('password123'),
        ]);

        $this->subject = Subject::create([
            'name' => 'Pemrograman Berorientasi Objek',
            'code' => 'PBO',
        ]);

        $this->room = Room::create([
            'name' => 'Lab Komputer 1',
            'code' => 'LAB-01',
            'capacity' => 36,
        ]);

        // Jadwal hari Senin (day_of_week = 1)
        $this->scheduleGrade10 = Schedule::create([
            'class_id' => $this->classGrade10->id,
            'subject_id' => $this->subject->id,
            'teacher_id' => $this->teacher->id,
            'room_id' => $this->room->id,
            'day_of_week' => 1,
            'period_number' => 2,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->scheduleGrade11 = Schedule::create([
            'class_id' => $this->classGrade11->id,
            'subject_id' => $this->subject->id,
            'teacher_id' => $this->teacher->id,
            'room_id' => $this->room->id,
            'day_of_week' => 1,
            'period_number' => 4,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);
    }

    protected function tearDown(): void
    {
        AcademicCalendarExclusionService::clearCache();
        parent::tearDown();
    }

    public function test_waka_can_manage_academic_events_and_other_roles_forbidden(): void
    {
        Sanctum::actingAs($this->waka);

        // 1. Create Event
        $createRes = $this->postJson('/api/academic-events', [
            'title' => 'Kemah Bakti Sekolah',
            'description' => 'Kegiatan kemah di Bumi Perkemahan',
            'start_date' => '2026-11-10',
            'end_date' => '2026-11-12',
            'type' => 'school_event',
            'scope_type' => 'grade',
            'scope_targets' => ['10'],
            'disables_teaching' => true,
        ]);

        $createRes->assertStatus(201)
            ->assertJsonPath('data.title', 'Kemah Bakti Sekolah')
            ->assertJsonPath('data.scope_type', 'grade');

        $eventId = $createRes->json('data.id');

        // 2. Update Event
        $updateRes = $this->putJson("/api/academic-events/{$eventId}", [
            'title' => 'Kemah Bakti Sekolah (Revisi)',
            'description' => 'Update deskripsi kegiatan',
            'start_date' => '2026-11-10',
            'end_date' => '2026-11-12',
            'type' => 'school_event',
            'scope_type' => 'grade',
            'scope_targets' => ['10'],
            'disables_teaching' => true,
        ]);

        $updateRes->assertStatus(200)
            ->assertJsonPath('data.title', 'Kemah Bakti Sekolah (Revisi)');

        // 3. Teacher forbidden to mutate
        Sanctum::actingAs($this->teacher);
        $this->postJson('/api/academic-events', [
            'title' => 'Event Ilegal Guru',
            'start_date' => '2026-11-15',
            'end_date' => '2026-11-15',
            'type' => 'school_event',
            'scope_type' => 'all',
            'disables_teaching' => true,
        ])->assertStatus(403);

        $this->deleteJson("/api/academic-events/{$eventId}")->assertStatus(403);

        // 4. Waka can delete
        Sanctum::actingAs($this->waka);
        $this->deleteJson("/api/academic-events/{$eventId}")
            ->assertStatus(200)
            ->assertJsonPath('message', 'Agenda kalender akademik berhasil dihapus.');

        $this->assertSoftDeleted('academic_events', ['id' => $eventId]);
    }

    public function test_exemption_scope_all_disables_teaching_and_blocks_journal(): void
    {
        $targetDate = '2026-11-09'; // Hari Senin (day 1)

        AcademicEvent::create([
            'title' => 'Hari Libur Nasional',
            'description' => 'Libur resmi seluruh sekolah',
            'start_date' => $targetDate,
            'end_date' => $targetDate,
            'type' => 'holiday',
            'scope_type' => 'all',
            'scope_targets' => null,
            'disables_teaching' => true,
            'created_by' => $this->waka->id,
        ]);
        AcademicCalendarExclusionService::clearCache();

        Sanctum::actingAs($this->teacher);

        // Percobaan pengisian jurnal KBM normal
        $resStore = $this->postJson('/api/journals', [
            'schedule_id' => $this->scheduleGrade10->id,
            'date' => $targetDate,
        ]);

        $resStore->assertStatus(422)
            ->assertJsonPath('error_code', 'TEACHING_DISABLED_BY_EVENT');

        // Percobaan tandai guru absen / jam kosong pada pembukaan sesi
        $resAbsent = $this->postJson('/api/journals', [
            'schedule_id' => $this->scheduleGrade10->id,
            'date' => $targetDate,
            'status' => 'teacher_absent',
        ]);

        $resAbsent->assertStatus(422)
            ->assertJsonPath('error_code', 'TEACHING_DISABLED_BY_EVENT');
    }

    public function test_exemption_scope_grade_only_affects_targeted_grades(): void
    {
        $targetDate = '2026-11-09'; // Hari Senin (day 1)

        // Agenda khusus hanya untuk kelas 10
        AcademicEvent::create([
            'title' => 'Tes Asesmen Minat Bakat Kelas X',
            'description' => 'Pelaksanaan asesmen psikologi kelas 10',
            'start_date' => $targetDate,
            'end_date' => $targetDate,
            'type' => 'exam',
            'scope_type' => 'grade',
            'scope_targets' => ['10'],
            'disables_teaching' => true,
            'created_by' => $this->waka->id,
        ]);
        AcademicCalendarExclusionService::clearCache();

        Sanctum::actingAs($this->teacher);

        // 1. Kelas 10 harus diblokir karena terdampak
        $resGrade10 = $this->postJson('/api/journals', [
            'schedule_id' => $this->scheduleGrade10->id,
            'date' => $targetDate,
        ]);

        $resGrade10->assertStatus(422)
            ->assertJsonPath('error_code', 'TEACHING_DISABLED_BY_EVENT');

        // 2. Kelas 11 TIDAK terdampak sehingga wajib dan dapat diisi
        $resGrade11 = $this->postJson('/api/journals', [
            'schedule_id' => $this->scheduleGrade11->id,
            'date' => $targetDate,
        ]);

        $resGrade11->assertStatus(201);
    }

    public function test_exemption_scope_class_only_affects_targeted_class(): void
    {
        $targetDate = '2026-11-09'; // Hari Senin (day 1)

        // Rombel kelas 10 kedua
        $classGrade10B = Classes::create([
            'name' => 'X RPL 2',
            'level' => 10,
        ]);

        $scheduleGrade10B = Schedule::create([
            'class_id' => $classGrade10B->id,
            'subject_id' => $this->subject->id,
            'teacher_id' => $this->teacher->id,
            'room_id' => $this->room->id,
            'day_of_week' => 1,
            'period_number' => 6,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        // Agenda hanya rombel spesifik X RPL 1
        AcademicEvent::create([
            'title' => 'Kunjungan Industri Khusus X RPL 1',
            'description' => 'Kunjungan industri PT Telkom',
            'start_date' => $targetDate,
            'end_date' => $targetDate,
            'type' => 'class_event',
            'scope_type' => 'class',
            'scope_targets' => [(string) $this->classGrade10->id],
            'disables_teaching' => true,
            'created_by' => $this->waka->id,
        ]);
        AcademicCalendarExclusionService::clearCache();

        Sanctum::actingAs($this->teacher);

        // X RPL 1 diblokir
        $resA = $this->postJson('/api/journals', [
            'schedule_id' => $this->scheduleGrade10->id,
            'date' => $targetDate,
        ]);
        $resA->assertStatus(422)->assertJsonPath('error_code', 'TEACHING_DISABLED_BY_EVENT');

        // X RPL 2 tetap berjalan normal
        $resB = $this->postJson('/api/journals', [
            'schedule_id' => $scheduleGrade10B->id,
            'date' => $targetDate,
        ]);
        $resB->assertStatus(201);
    }

    public function test_non_disabling_event_leaves_teaching_active(): void
    {
        $targetDate = '2026-11-09'; // Hari Senin (day 1)

        // Event peringatan hari pahlawan (tidak meliburkan KBM)
        AcademicEvent::create([
            'title' => 'Peringatan Hari Pahlawan',
            'description' => 'Mengenakan seragam khusus, KBM tetap berjalan',
            'start_date' => $targetDate,
            'end_date' => $targetDate,
            'type' => 'school_event',
            'scope_type' => 'all',
            'disables_teaching' => false,
            'created_by' => $this->waka->id,
        ]);
        AcademicCalendarExclusionService::clearCache();

        Sanctum::actingAs($this->teacher);

        $res = $this->postJson('/api/journals', [
            'schedule_id' => $this->scheduleGrade10->id,
            'date' => $targetDate,
        ]);

        $res->assertStatus(201);
    }

    public function test_exempted_schedules_excluded_from_missing_journals(): void
    {
        $targetDate = '2026-11-09'; // Senin

        AcademicEvent::create([
            'title' => 'Hari Libur Nasional',
            'description' => 'Libur seluruh sekolah',
            'start_date' => $targetDate,
            'end_date' => $targetDate,
            'type' => 'holiday',
            'scope_type' => 'all',
            'disables_teaching' => true,
            'created_by' => $this->waka->id,
        ]);
        AcademicCalendarExclusionService::clearCache();

        Sanctum::actingAs($this->waka);

        $res = $this->getJson('/api/schedules?status=missing_journal');

        $res->assertStatus(200);
        $items = $res->json('data') ?? [];

        foreach ($items as $item) {
            $this->assertFalse(
                ($item['is_teaching_exempted'] ?? false) === true && ($item['status'] ?? '') === 'missing_journal'
            );
        }
    }

    public function test_daily_recap_and_compliance_metrics_calculation(): void
    {
        $targetDate = '2026-11-09'; // Senin (day 1, ada scheduleGrade10 dan scheduleGrade11)

        // Kelas 10 diliburkan karena asesmen
        AcademicEvent::create([
            'title' => 'Asesmen Kelas X',
            'start_date' => $targetDate,
            'end_date' => $targetDate,
            'type' => 'exam',
            'scope_type' => 'grade',
            'scope_targets' => ['10'],
            'disables_teaching' => true,
            'created_by' => $this->waka->id,
        ]);
        AcademicCalendarExclusionService::clearCache();

        // Kelas 11 menyelesaikan jurnal
        Journal::create([
            'schedule_id' => $this->scheduleGrade11->id,
            'date' => $targetDate,
            'status' => 'completed',
            'topic_description' => 'KBM Kelas 11 Selesai',
        ]);

        Sanctum::actingAs($this->waka);

        $res = $this->getJson("/api/journals/daily-recap?date={$targetDate}");

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.date', $targetDate)
            ->assertJsonPath('data.total_mandatory', 2)
            ->assertJsonPath('data.exempted_count', 1)
            ->assertJsonPath('data.effective_mandatory', 1)
            ->assertJsonPath('data.completed_count', 1);

        $this->assertEquals(100.0, (float) $res->json('data.compliance_rate'));

        $items = $res->json('data.items');
        $this->assertCount(2, $items);

        $grade10Item = collect($items)->firstWhere('schedule_id', $this->scheduleGrade10->id);
        $grade11Item = collect($items)->firstWhere('schedule_id', $this->scheduleGrade11->id);

        $this->assertEquals('exempted', $grade10Item['status']);
        $this->assertTrue($grade10Item['is_teaching_exempted']);
        $this->assertEquals('Asesmen Kelas X', $grade10Item['exemption_reason']);

        $this->assertEquals('completed', $grade11Item['status']);
        $this->assertFalse($grade11Item['is_teaching_exempted']);
    }

    public function test_student_and_teacher_leave_requests_on_exempted_dates(): void
    {
        $targetDate = '2026-11-09'; // Senin

        AcademicEvent::create([
            'title' => 'Hari Libur Nasional',
            'start_date' => $targetDate,
            'end_date' => $targetDate,
            'type' => 'holiday',
            'scope_type' => 'all',
            'disables_teaching' => true,
            'created_by' => $this->waka->id,
        ]);
        AcademicCalendarExclusionService::clearCache();

        // 1. Siswa mengajukan izin pada hari libur total -> 422
        Sanctum::actingAs($this->student);
        $studentLeaveRes = $this->postJson('/api/leave-requests', [
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => $targetDate,
            'end_date' => $targetDate,
        ]);

        $studentLeaveRes->assertStatus(422)
            ->assertJsonPath('error_code', 'TEACHING_DISABLED_BY_EVENT');

        // 2. Guru mengajukan izin/piket pada slot jadwal yang sudah diliburkan -> 422
        Sanctum::actingAs($this->teacher);
        $teacherLeaveRes = $this->postJson('/api/teacher-leave-requests', [
            'date' => $targetDate,
            'reason' => 'Pelatihan Kurikulum Nasional',
            'schedule_ids' => [$this->scheduleGrade10->id],
        ]);

        $teacherLeaveRes->assertStatus(422)
            ->assertJsonPath('error_code', 'TEACHING_DISABLED_BY_EVENT');
    }
}
