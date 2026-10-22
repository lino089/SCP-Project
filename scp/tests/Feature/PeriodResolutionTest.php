<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\PeriodTemplate;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\SystemConfiguration;
use App\Models\User;
use App\Services\PeriodResolutionService;
use Carbon\Carbon;
use Database\Seeders\PeriodTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * FASE 9 - Tugas 9.1: Verifikasi Kriteria 5 (Resolusi Jam Pelajaran)
 * PRD Bagian 10 & MASTER_IMPROVEMENT_PLAN.md:
 * - Waktu riil periode dihitung akurat sesuai day_type:
 *   - Senin upacara (mulai 08:00) vs Senin reguler (mulai 07:15)
 *   - Jumat (durasi 40 menit per JP)
 * - Alert missing journal (30 menit pasca periode berakhir)
 */
class PeriodResolutionTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;
    private Classes $class;
    private Room $room;
    private Subject $subject;
    private PeriodResolutionService $periodService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PeriodTemplateSeeder::class);
        $this->periodService = new PeriodResolutionService();

        SystemConfiguration::create([
            'id' => 1,
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
        ]);

        $this->teacher = User::create([
            'name' => 'Guru Pengajar',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012010011001',
            'fet_staff_id' => 'G01',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $this->class = Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        $this->room = Room::create(['name' => 'Lab Komputer 1', 'capacity' => 36]);
        $this->subject = Subject::create(['name' => 'Pemrograman Berorientasi Objek']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_actual_period_time_resolves_accurately_for_senin_upacara_vs_senin_reguler(): void
    {
        // 1. Senin Upacara: JP 1 mulai jam 08:00:00, selesai 08:45:00
        $mondayDate = Carbon::parse('2026-10-19 08:00:00'); // Senin
        SystemConfiguration::first()->update(['monday_is_upacara' => true]);

        $schedule = Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $resolvedUpacara = $this->periodService->getScheduleTimes($schedule, $mondayDate);
        $this->assertEquals('08:00:00', $resolvedUpacara['start_time']);
        $this->assertEquals('09:30:00', $resolvedUpacara['end_time']); // 2 JP x 45 min = 09:30
        $this->assertEquals('senin_upacara', $this->periodService->resolveDayType($mondayDate));

        // 2. Ubah konfigurasi menjadi Senin Reguler (tanpa upacara): JP 1 mulai jam 07:15:00
        SystemConfiguration::first()->update(['monday_is_upacara' => false]);

        $resolvedReguler = $this->periodService->getScheduleTimes($schedule, $mondayDate);
        $this->assertEquals('07:15:00', $resolvedReguler['start_time']);
        $this->assertEquals('08:45:00', $resolvedReguler['end_time']);
        $this->assertEquals('senin_reguler', $this->periodService->resolveDayType($mondayDate));
    }

    public function test_actual_period_time_resolves_accurately_for_friday_short_duration_40_minutes(): void
    {
        // Jumat: 2026-10-23
        $fridayDate = Carbon::parse('2026-10-23 07:15:00');

        $scheduleJumat = Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 5, // Jumat
            'period_number' => 1,
            'duration_periods' => 2, // 2 JP
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $resolvedFriday = $this->periodService->getScheduleTimes($scheduleJumat, $fridayDate);
        $this->assertEquals('07:15:00', $resolvedFriday['start_time']);
        // JP 1: 07:15 - 07:55 (40 menit), JP 2: 07:55 - 08:35 (40 menit)
        $this->assertEquals('08:35:00', $resolvedFriday['end_time']);
        $this->assertEquals('jumat', $this->periodService->resolveDayType($fridayDate));
    }

    public function test_missing_journal_alert_triggers_after_30_minute_grace_period(): void
    {
        // Simulasi waktu tes: Senin pada 09:30:00 WIB
        // Pada Senin Upacara, JP 1 ends at 08:45:00.
        // Batas toleransi = 08:45:00 + 30 menit = 09:15:00.
        // Pada pukul 09:30:00, sudah lewat 15 menit dari grace period!
        $testMonday = Carbon::parse('2026-10-19 09:30:00', 'Asia/Jakarta');
        Carbon::setTestNow($testMonday);

        $schedule = Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
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
}
