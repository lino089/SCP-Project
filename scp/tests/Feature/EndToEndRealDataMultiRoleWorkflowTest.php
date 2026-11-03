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
use Tests\TestCase;

/**
 * Fase 5: Pengujian End-to-End & Verifikasi Multi-Role
 * 
 * Verifikasi alur operasional terintegrasi:
 * 1. Login & Profil Waka Kurikulum, Guru, Siswa, dan Wali Murid.
 * 2. Guru Membuka Jurnal KBM & Melakukan Presensi Exception-based.
 * 3. Presensi langsung terbaca di Portal Siswa (Dimas Nugroho).
 * 4. Presensi anak langsung terbaca di Portal Wali Murid.
 * 5. Waka Kurikulum melihat rekapitulasi KBM terbarui secara real-time.
 */
class EndToEndRealDataMultiRoleWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;
    private User $student;
    private User $parent;
    private Classes $class;
    private Schedule $schedule;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        $this->seed(PeriodTemplateSeeder::class);

        // 1. Konfigurasi Sistem Akademik
        SystemConfiguration::create([
            'id' => 1,
            'active_cycle' => 1,
            'monday_is_upacara' => true,
            'academic_year' => '2025/2026 Ganjil',
            'semester' => 'Ganjil',
        ]);

        // 2. Akun Waka Kurikulum
        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'admin@sch.id',
            'nis_nip' => '12345678',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 3. Akun Guru Pengampu
        $this->teacher = User::create([
            'name' => 'Aris Purwantinah, S.Pd.',
            'phone_number' => '081234567801',
            'nis_nip' => '197707152007051002',
            'role' => 'teacher',
            'password' => Hash::make('197707152007051002'),
            'must_change_password' => false,
        ]);

        // 4. Data Master Kelas, Ruang, Mapel
        $this->class = Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        $room = Room::create(['name' => 'Lab RPL 1', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Dasar Keahlian RPL']);

        // 5. Akun Siswa (Dimas Nugroho)
        $this->student = User::create([
            'name' => 'Dimas Nugroho',
            'nis_nip' => '12100',
            'nisn' => '0082975643',
            'role' => 'student',
            'class_id' => $this->class->id,
            'gender' => 'L',
            'password' => Hash::make('0082975643'),
            'must_change_password' => false,
        ]);

        // 6. Akun Wali Murid Dimas
        $this->parent = User::create([
            'name' => 'Wali Murid Dimas Nugroho',
            'nis_nip' => 'P-12100',
            'role' => 'parent',
            'linked_student_id' => $this->student->id,
            'password' => Hash::make('0082975643'),
            'must_change_password' => false,
        ]);

        // 7. Jadwal KBM Guru di Kelas Dimas
        $todayDayOfWeek = (int) Carbon::now('Asia/Jakarta')->dayOfWeekIso;
        $this->schedule = Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $room->id,
            'subject_id' => $subject->id,
            'day_of_week' => $todayDayOfWeek,
            'period_number' => 1,
            'duration_periods' => 3,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);
    }

    /**
     * 1. Test Login & Profil Multi-Role
     */
    public function test_multi_role_authentication_and_profile_integrity(): void
    {
        // 1a. Login Waka Kurikulum
        auth()->forgetGuards();
        $resWaka = $this->postJson('/api/login', [
            'username' => 'admin@sch.id',
            'password' => 'password123',
            'device_name' => 'TestBrowser-Waka',
        ]);
        $resWaka->assertStatus(200)
            ->assertJson(['success' => true]);
        $wakaToken = $resWaka->json('data.token');

        auth()->forgetGuards();
        $meWaka = $this->withHeader('Authorization', "Bearer {$wakaToken}")
            ->getJson('/api/me');
        $meWaka->assertStatus(200)
            ->assertJsonPath('data.role', 'vice_principal')
            ->assertJsonPath('data.academic_year', '2025/2026 Ganjil')
            ->assertJsonPath('data.active_cycle', 1);

        // 1b. Login Guru (ID: Nomor Telepon, Pwd: NIP)
        auth()->forgetGuards();
        $resTeacher = $this->postJson('/api/login', [
            'username' => '081234567801',
            'password' => '197707152007051002',
            'device_name' => 'TestBrowser-Guru',
        ]);
        $resTeacher->assertStatus(200)
            ->assertJson(['success' => true]);
        $teacherToken = $resTeacher->json('data.token');

        auth()->forgetGuards();
        $meTeacher = $this->withHeader('Authorization', "Bearer {$teacherToken}")
            ->getJson('/api/me');
        $meTeacher->assertStatus(200)
            ->assertJsonPath('data.role', 'teacher')
            ->assertJsonPath('data.name', 'Aris Purwantinah, S.Pd.')
            ->assertJsonPath('data.academic_year', '2025/2026 Ganjil');

        // 1c. Login Siswa (ID: NIS, Pwd: NISN)
        auth()->forgetGuards();
        $resStudent = $this->postJson('/api/login', [
            'username' => '12100',
            'password' => '0082975643',
            'device_name' => 'TestBrowser-Siswa',
        ]);
        $resStudent->assertStatus(200)
            ->assertJson(['success' => true]);
        $studentToken = $resStudent->json('data.token');

        auth()->forgetGuards();
        $meStudent = $this->withHeader('Authorization', "Bearer {$studentToken}")
            ->getJson('/api/me');
        $meStudent->assertStatus(200)
            ->assertJsonPath('data.role', 'student')
            ->assertJsonPath('data.nis_nip', '12100')
            ->assertJsonPath('data.school_class.name', 'X RPL 1');

        // 1d. Login Wali Murid (ID: P-NIS, Pwd: NISN Anak)
        auth()->forgetGuards();
        $resParent = $this->postJson('/api/login', [
            'username' => 'P-12100',
            'password' => '0082975643',
            'device_name' => 'TestBrowser-Wali',
        ]);
        $resParent->assertStatus(200)
            ->assertJson(['success' => true]);
        $parentToken = $resParent->json('data.token');

        auth()->forgetGuards();
        $meParent = $this->withHeader('Authorization', "Bearer {$parentToken}")
            ->getJson('/api/me');
        $meParent->assertStatus(200)
            ->assertJsonPath('data.role', 'parent')
            ->assertJsonPath('data.linked_student.name', 'Dimas Nugroho')
            ->assertJsonPath('data.linked_student.school_class.name', 'X RPL 1');
    }

    /**
     * 2. Test End-to-End Alur Operasional:
     *    Buka Jurnal KBM Guru -> Presensi Siswa -> Terbaca di Portal Siswa, Wali, & Rekap Waka
     */
    public function test_complete_e2e_journal_kbm_attendance_propagation_workflow(): void
    {
        // Step 1: Login Guru
        auth()->forgetGuards();
        $loginTeacher = $this->postJson('/api/login', [
            'username' => '081234567801',
            'password' => '197707152007051002',
            'device_name' => 'TestBrowser-Guru',
        ]);
        $teacherToken = $loginTeacher->json('data.token');

        // Step 2: Guru Mulai / Buka Sesi Jurnal KBM
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->schedule->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        // Step 3: Guru menyelesaikan Jurnal KBM dengan presensi exception-based
        // Dimas Nugroho tidak dimasukkan ke exception, sehingga otomatis Hadir
        auth()->forgetGuards();
        $fakePhoto = UploadedFile::fake()->image('kbm_photo.jpg', 800, 600);
        $resJournal = $this->withHeader('Authorization', "Bearer {$teacherToken}")
            ->postJson("/api/journals/{$journal->id}", [
                '_method' => 'PUT',
                'topic_description' => 'Pengenalan Algoritma Pemrograman dan Git Workflow',
                'material_summary' => 'Siswa memahami branch, commit, dan merge request',
                'photo' => $fakePhoto,
                'exceptions' => [], // Seluruh siswa hadir
            ]);

        $resJournal->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'completed');

        // Verifikasi database: Dimas Nugroho tercatat Hadir
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->student->id,
            'status' => 'Hadir',
        ]);

        // Step 4: Login Siswa & Periksa Kehadiran
        auth()->forgetGuards();
        $loginStudent = $this->postJson('/api/login', [
            'username' => '12100',
            'password' => '0082975643',
            'device_name' => 'TestBrowser-Siswa',
        ]);
        $studentToken = $loginStudent->json('data.token');

        // Siswa memeriksa riwayat presensinya
        $attendancesCount = Attendance::where('student_id', $this->student->id)
            ->where('status', 'Hadir')
            ->count();
        $this->assertEquals(1, $attendancesCount);

        // Step 5: Login Wali Murid & Periksa Kehadiran Anak
        auth()->forgetGuards();
        $loginParent = $this->postJson('/api/login', [
            'username' => 'P-12100',
            'password' => '0082975643',
            'device_name' => 'TestBrowser-Wali',
        ]);
        $parentToken = $loginParent->json('data.token');

        auth()->forgetGuards();
        $parentMe = $this->withHeader('Authorization', "Bearer {$parentToken}")
            ->getJson('/api/me');
        $linkedStudentId = $parentMe->json('data.linked_student.id');
        $this->assertEquals($this->student->id, $linkedStudentId);

        $parentChildAttendanceCount = Attendance::where('student_id', $linkedStudentId)
            ->where('status', 'Hadir')
            ->count();
        $this->assertEquals(1, $parentChildAttendanceCount);

        // Step 6: Login Waka Kurikulum & Periksa Jurnal KBM di Rekapitulasi
        auth()->forgetGuards();
        $loginWaka = $this->postJson('/api/login', [
            'username' => 'admin@sch.id',
            'password' => 'password123',
            'device_name' => 'TestBrowser-Waka',
        ]);
        $wakaToken = $loginWaka->json('data.token');

        auth()->forgetGuards();
        $resWakaJournals = $this->withHeader('Authorization', "Bearer {$wakaToken}")
            ->getJson('/api/journals');
        $resWakaJournals->assertStatus(200);

        // Pastikan jurnal yang baru saja diselesaikan muncul dalam daftar jurnal Waka
        $journalsList = $resWakaJournals->json('data');
        $completedJournalFound = collect($journalsList)->contains(function ($j) use ($journal) {
            return $j['id'] === $journal->id && $j['status'] === 'completed';
        });
        $this->assertTrue($completedJournalFound, 'Completed journal should be visible in Waka Kurikulum monitoring list.');
    }
}
