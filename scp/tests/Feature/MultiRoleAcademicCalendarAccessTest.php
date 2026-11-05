<?php

namespace Tests\Feature;

use App\Models\AcademicEvent;
use App\Models\Classes;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\SystemConfiguration;
use App\Models\TeacherAssignment;
use App\Models\User;
use App\Services\AcademicCalendarExclusionService;
use Database\Seeders\PeriodTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MultiRoleAcademicCalendarAccessTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;
    private User $studentGrade10;
    private User $studentGrade11;
    private User $parent;
    private Classes $classGrade10;
    private Classes $classGrade11;
    private Classes $classGrade12;
    private AcademicEvent $eventAll;
    private AcademicEvent $eventGrade10;
    private AcademicEvent $eventGrade11;
    private AcademicEvent $eventGrade12;

    protected function setUp(): void
    {
        parent::setUp();

        AcademicCalendarExclusionService::clearCache();
        $this->seed(PeriodTemplateSeeder::class);

        SystemConfiguration::create([
            'id' => 1,
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        $this->classGrade10 = Classes::create([
            'name' => 'X RPL 1',
            'level' => 10,
        ]);

        $this->classGrade11 = Classes::create([
            'name' => 'XI RPL 1',
            'level' => 11,
        ]);

        $this->classGrade12 = Classes::create([
            'name' => 'XII RPL 1',
            'level' => 12,
        ]);

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990031001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
        ]);

        $this->teacher = User::create([
            'name' => 'Guru Pengampu',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012005011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $this->studentGrade10 = User::create([
            'name' => 'Siswa Kelas 10',
            'email' => 'siswa10@example.com',
            'nis_nip' => '10001',
            'role' => 'student',
            'class_id' => $this->classGrade10->id,
            'password' => Hash::make('password123'),
        ]);

        $this->studentGrade11 = User::create([
            'name' => 'Siswa Kelas 11',
            'email' => 'siswa11@example.com',
            'nis_nip' => '11001',
            'role' => 'student',
            'class_id' => $this->classGrade11->id,
            'password' => Hash::make('password123'),
        ]);

        $this->parent = User::create([
            'name' => 'Wali Murid Siswa 10',
            'email' => 'wali10@example.com',
            'nis_nip' => 'P-10001',
            'role' => 'parent',
            'linked_student_id' => $this->studentGrade10->id,
            'password' => Hash::make('password123'),
        ]);

        $subject = Subject::create([
            'name' => 'Pemrograman Web',
            'code' => 'PWEB',
        ]);

        $room = Room::create([
            'name' => 'Lab 1',
            'code' => 'LAB-1',
            'capacity' => 36,
        ]);

        // Guru mengajar Kelas 10 pada hari Senin (day 1)
        Schedule::create([
            'class_id' => $this->classGrade10->id,
            'subject_id' => $subject->id,
            'teacher_id' => $this->teacher->id,
            'room_id' => $room->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        // Target Date: 2026-11-09 (Senin)
        $this->eventAll = AcademicEvent::create([
            'title' => 'Hari Pahlawan Nasional',
            'description' => 'Seluruh sekolah libur',
            'start_date' => '2026-11-10',
            'end_date' => '2026-11-10',
            'type' => AcademicEvent::TYPE_HOLIDAY,
            'scope_type' => AcademicEvent::SCOPE_ALL,
            'disables_teaching' => true,
            'created_by' => $this->waka->id,
        ]);

        $this->eventGrade10 = AcademicEvent::create([
            'title' => 'Perkemahan Pramuka Blok Kelas X',
            'description' => 'Kegiatan kepramukaan kelas 10',
            'start_date' => '2026-11-09',
            'end_date' => '2026-11-09',
            'type' => AcademicEvent::TYPE_CLASS_EVENT,
            'scope_type' => AcademicEvent::SCOPE_GRADE,
            'scope_targets' => ['10'],
            'disables_teaching' => true,
            'created_by' => $this->waka->id,
        ]);

        $this->eventGrade11 = AcademicEvent::create([
            'title' => 'Kunjungan Industri Kelas XI',
            'description' => 'Kunjungan industri',
            'start_date' => '2026-11-15',
            'end_date' => '2026-11-16',
            'type' => AcademicEvent::TYPE_CLASS_EVENT,
            'scope_type' => AcademicEvent::SCOPE_GRADE,
            'scope_targets' => ['11'],
            'disables_teaching' => true,
            'created_by' => $this->waka->id,
        ]);

        $this->eventGrade12 = AcademicEvent::create([
            'title' => 'Uji Kompetensi Keahlian XII',
            'description' => 'UKK kelas 12',
            'start_date' => '2026-11-20',
            'end_date' => '2026-11-22',
            'type' => AcademicEvent::TYPE_EXAM,
            'scope_type' => AcademicEvent::SCOPE_GRADE,
            'scope_targets' => ['12'],
            'disables_teaching' => true,
            'created_by' => $this->waka->id,
        ]);
    }

    protected function tearDown(): void
    {
        AcademicCalendarExclusionService::clearCache();
        parent::tearDown();
    }

    public function test_waka_can_access_my_calendar_and_filter_by_grade(): void
    {
        Sanctum::actingAs($this->waka);

        // 1. Akses kalender umum Waka
        $res = $this->getJson('/api/academic-events/my-calendar?month=11&year=2026');
        $res->assertStatus(200)
            ->assertJsonPath('data.role', 'vice_principal')
            ->assertJsonPath('data.can_manage', true)
            ->assertJsonPath('data.summary.total_events', 4);

        // 2. Filter Waka berdasarkan tingkat 10
        $resGrade10 = $this->getJson('/api/academic-events/my-calendar?month=11&year=2026&grade=10');
        $resGrade10->assertStatus(200);
        $eventTitles = collect($resGrade10->json('data.events'))->pluck('title');
        $this->assertTrue($eventTitles->contains('Hari Pahlawan Nasional')); // scope all
        $this->assertTrue($eventTitles->contains('Perkemahan Pramuka Blok Kelas X')); // grade 10
        $this->assertFalse($eventTitles->contains('Kunjungan Industri Kelas XI')); // grade 11
        $this->assertFalse($eventTitles->contains('Uji Kompetensi Keahlian XII')); // grade 12
    }

    public function test_teacher_personalization_and_teaching_impact(): void
    {
        Sanctum::actingAs($this->teacher);

        // Guru hanya mengajar Kelas 10
        $res = $this->getJson('/api/academic-events/my-calendar?month=11&year=2026');
        $res->assertStatus(200)
            ->assertJsonPath('data.role', 'teacher')
            ->assertJsonPath('data.can_manage', false);

        $events = collect($res->json('data.events'));
        $titles = $events->pluck('title');

        // Harus melihat event all dan event grade 10
        $this->assertTrue($titles->contains('Hari Pahlawan Nasional'));
        $this->assertTrue($titles->contains('Perkemahan Pramuka Blok Kelas X'));

        // Tidak boleh melihat event grade 11 dan 12 yang tidak terkait
        $this->assertFalse($titles->contains('Kunjungan Industri Kelas XI'));
        $this->assertFalse($titles->contains('Uji Kompetensi Keahlian XII'));

        // Cek flag affects_my_teaching pada event Pramuka (karena guru mengajar di Senin 9 Nov)
        $pramukaEvent = $events->firstWhere('title', 'Perkemahan Pramuka Blok Kelas X');
        $this->assertTrue($pramukaEvent['affects_my_teaching']);
        $this->assertContains('X RPL 1', $pramukaEvent['affected_my_classes']);

        // Cek daily_teaching_status pada 2026-11-09
        $daily = $res->json('data.daily_teaching_status.2026-11-09');
        $this->assertNotNull($daily);
        $this->assertEquals('full_free', $daily['status']);
        $this->assertEquals('Jadwal Anda Bebas', $daily['label']);

        // Mutasi oleh guru harus ditolak 403
        $this->postJson('/api/academic-events', [
            'title' => 'Ilegal Event Guru',
            'start_date' => '2026-11-25',
            'end_date' => '2026-11-25',
            'type' => 'school_event',
            'scope_type' => 'all',
        ])->assertStatus(403);
    }

    public function test_student_grade_and_class_isolation(): void
    {
        Sanctum::actingAs($this->studentGrade10);

        // 1. Endpoint /my-calendar
        $res = $this->getJson('/api/academic-events/my-calendar?month=11&year=2026');
        $res->assertStatus(200)
            ->assertJsonPath('data.role', 'student')
            ->assertJsonPath('data.context.student.class_name', 'X RPL 1');

        $events = collect($res->json('data.events'));
        $titles = $events->pluck('title');

        $this->assertTrue($titles->contains('Hari Pahlawan Nasional'));
        $this->assertTrue($titles->contains('Perkemahan Pramuka Blok Kelas X'));
        $this->assertFalse($titles->contains('Kunjungan Industri Kelas XI'));
        $this->assertFalse($titles->contains('Uji Kompetensi Keahlian XII'));

        // 2. Proteksi endpoint lama GET /api/academic-events
        $resLegacy = $this->getJson('/api/academic-events?month=11&year=2026');
        $resLegacy->assertStatus(200);
        $legacyTitles = collect($resLegacy->json('data'))->pluck('title');
        $this->assertFalse($legacyTitles->contains('Kunjungan Industri Kelas XI'));
        $this->assertFalse($legacyTitles->contains('Uji Kompetensi Keahlian XII'));

        // 3. Proteksi akses langsung GET /api/academic-events/{id} untuk event kelas lain
        $this->getJson("/api/academic-events/{$this->eventGrade11->id}")
            ->assertStatus(403)
            ->assertJsonPath('message', 'Akses ditolak. Anda tidak memiliki izin untuk melihat agenda kelas ini.');
    }

    public function test_parent_access_and_child_tagging(): void
    {
        Sanctum::actingAs($this->parent);

        // 1. Kalender Orang Tua
        $res = $this->getJson('/api/academic-events/my-calendar?month=11&year=2026');
        $res->assertStatus(200)
            ->assertJsonPath('data.role', 'parent');

        $events = collect($res->json('data.events'));
        $pramuka = $events->firstWhere('title', 'Perkemahan Pramuka Blok Kelas X');
        $this->assertNotNull($pramuka);
        $this->assertNotEmpty($pramuka['applicable_children']);
        $this->assertEquals('Siswa Kelas 10', $pramuka['applicable_children'][0]['name']);
        $this->assertStringContainsString('Anak - Siswa Kelas 10', $pramuka['applicable_children'][0]['tag_label']);

        // 2. Isolasi agenda anak orang lain
        $titles = $events->pluck('title');
        $this->assertFalse($titles->contains('Kunjungan Industri Kelas XI'));

        // 3. Upaya filter anak yang bukan anaknya menghasilkan 403
        $this->getJson("/api/academic-events/my-calendar?month=11&year=2026&child_id={$this->studentGrade11->id}")
            ->assertStatus(403)
            ->assertJsonPath('message', 'Akses ditolak. Anda tidak memiliki akses ke data siswa tersebut.');

        // 4. Detail agenda kelas lain menghasilkan 403
        $this->getJson("/api/academic-events/{$this->eventGrade11->id}")
            ->assertStatus(403);
    }
}
