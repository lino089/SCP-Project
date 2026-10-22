<?php

namespace Tests\Feature;

use App\Models\Attendance;
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
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * FASE 9 - Tugas 9.1: Verifikasi Kriteria 9 (Presensi Exception-Based & Kompresi Foto)
 * PRD Bagian 10 & MASTER_IMPROVEMENT_PLAN.md:
 * - Payload PUT jurnal hanya mencantumkan siswa yang tidak hadir (exceptions).
 * - Siswa yang tidak disebutkan otomatis tercatat Hadir.
 * - Kompresi foto KBM ~800px dan ukuran <150KB.
 */
class JournalAttendanceTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;
    private Classes $class;
    private Schedule $schedule;
    private User $studentAbsent;
    private User $studentPresent1;
    private User $studentPresent2;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        $this->seed(PeriodTemplateSeeder::class);

        SystemConfiguration::create([
            'id' => 1,
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        $this->teacher = User::create([
            'name' => 'Guru Pengajar Presensi',
            'email' => 'guru_presensi@example.com',
            'nis_nip' => '198201012010011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $this->class = Classes::create(['name' => 'XI PPLG 1', 'level' => 11]);
        $room = Room::create(['name' => 'Lab RPL 1', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Pemrograman Web & Perangkat Bergerak']);

        $dayOfWeek = (int) Carbon::now('Asia/Jakarta')->dayOfWeekIso;

        $this->schedule = Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $room->id,
            'subject_id' => $subject->id,
            'day_of_week' => $dayOfWeek,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->studentAbsent = User::create([
            'name' => 'Budi Bolos',
            'nis_nip' => '2001',
            'role' => 'student',
            'class_id' => $this->class->id,
            'password' => Hash::make('password123'),
        ]);

        $this->studentPresent1 = User::create([
            'name' => 'Ani Hadir',
            'nis_nip' => '2002',
            'role' => 'student',
            'class_id' => $this->class->id,
            'password' => Hash::make('password123'),
        ]);

        $this->studentPresent2 = User::create([
            'name' => 'Candra Hadir',
            'nis_nip' => '2003',
            'role' => 'student',
            'class_id' => $this->class->id,
            'password' => Hash::make('password123'),
        ]);
    }

    public function test_exception_based_attendance_records_unlisted_students_as_hadir(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->schedule->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        Sanctum::actingAs($this->teacher);

        // Upload foto berdimensi besar (1600x1200) untuk memicu kompresi gambar
        $largePhoto = UploadedFile::fake()->image('kbm_big.jpg', 1600, 1200);

        // Hanya menyebutkan siswa Budi sebagai Alpa di exceptions
        $response = $this->postJson("/api/journals/{$journal->id}", [
            '_method' => 'PUT',
            'topic_description' => 'Implementasi Clean Architecture pada REST API',
            'material_summary' => 'Refactoring logic ke service layer',
            'photo' => $largePhoto,
            'exceptions' => [
                [
                    'student_id' => $this->studentAbsent->id,
                    'status' => 'Alpa',
                ],
            ],
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Jurnal KBM dan presensi berhasil diselesaikan.',
            ])
            ->assertJsonPath('data.status', 'completed');

        // 1. Siswa yang ada di exception tercatat sesuai statusnya (Alpa)
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->studentAbsent->id,
            'status' => 'Alpa',
        ]);

        // 2. Siswa lain yang TIDAK disebut guru otomatis tercatat 'Hadir'
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->studentPresent1->id,
            'status' => 'Hadir',
        ]);

        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->studentPresent2->id,
            'status' => 'Hadir',
        ]);

        // Total presensi tepat 3 siswa dalam kelas
        $this->assertEquals(3, Attendance::where('journal_id', $journal->id)->count());

        // 3. Verifikasi Foto dikompresi dan tersimpan di storage
        $journal->refresh();
        $this->assertNotNull($journal->photo_path);
        Storage::disk('public')->assertExists($journal->photo_path);

        $storedBytes = Storage::disk('public')->size($journal->photo_path);
        // Ukuran harus di bawah 150 KB (150 * 1024 bytes)
        $this->assertLessThanOrEqual(150 * 1024, $storedBytes);
    }
}
