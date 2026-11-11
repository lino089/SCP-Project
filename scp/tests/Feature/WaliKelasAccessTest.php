<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Classes;
use App\Models\Journal;
use App\Models\LeaveRequest;
use App\Models\Rooms;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\SystemConfiguration;
use App\Models\TeacherAssignment;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\PeriodTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WaliKelasAccessTest extends TestCase
{
    use RefreshDatabase;

    private User $waliKelas;
    private User $teacherGuruLain;
    private Classes $classBinaan;
    private Classes $classLain;
    private Rooms $room;
    private Subject $subject1;
    private Subject $subject2;
    private Schedule $scheduleBinaanGuruLain;
    private Schedule $scheduleLain;
    private User $studentInBinaan;

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

        // 1. Akun Wali Kelas
        $this->waliKelas = User::create([
            'name' => 'Bapak Wali Kelas',
            'email' => 'walikelas@example.com',
            'nis_nip' => '198501012010011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 2. Akun Guru Lain
        $this->teacherGuruLain = User::create([
            'name' => 'Guru Mata Pelajaran Lain',
            'email' => 'gurulain@example.com',
            'nis_nip' => '198602022011021002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 3. Master Kelas
        $this->classBinaan = Classes::create(['name' => 'X RPL 1', 'level' => '10']);
        $this->classLain = Classes::create(['name' => 'XI RPL 1', 'level' => '11']);

        // Penugasan Wali Kelas X RPL 1
        TeacherAssignment::create([
            'user_id' => $this->waliKelas->id,
            'type' => 'wali_kelas',
            'class_id' => $this->classBinaan->id,
        ]);

        // 4. Master Ruangan & Mapel
        $this->room = Rooms::create(['name' => 'Ruang Teori 1', 'capacity' => 36]);
        $this->subject1 = Subject::create(['name' => 'Matematika']);
        $this->subject2 = Subject::create(['name' => 'Bahasa Indonesia']);

        // 5. Siswa di Kelas Binaan
        $this->studentInBinaan = User::create([
            'name' => 'Siswa Binaan',
            'email' => 'siswa_binaan@example.com',
            'nis_nip' => '5001',
            'role' => 'student',
            'class_id' => $this->classBinaan->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $todayIso = (int) Carbon::now('Asia/Jakarta')->dayOfWeekIso;

        // Jadwal di kelas binaan tapi diajar oleh Guru Lain
        $this->scheduleBinaanGuruLain = Schedule::create([
            'teacher_id' => $this->teacherGuruLain->id,
            'class_id' => $this->classBinaan->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject1->id,
            'day_of_week' => $todayIso,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        // Jadwal di kelas lain diajar oleh Guru Lain
        $this->scheduleLain = Schedule::create([
            'teacher_id' => $this->teacherGuruLain->id,
            'class_id' => $this->classLain->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject2->id,
            'day_of_week' => $todayIso,
            'period_number' => 3,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);
    }

    public function test_homeroom_teacher_can_view_schedules_of_their_class(): void
    {
        Sanctum::actingAs($this->waliKelas);

        // Meminta jadwal dengan parameter class_id kelas binaan
        $response = $this->getJson('/api/schedules?class_id=' . $this->classBinaan->id);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        // Jadwal yang diajar oleh guru lain di kelas binaannya harus tetap muncul
        $scheduleIds = collect($response->json('data'))->pluck('id')->toArray();
        $this->assertContains($this->scheduleBinaanGuruLain->id, $scheduleIds);
    }

    public function test_homeroom_teacher_cannot_view_schedules_of_other_classes(): void
    {
        Sanctum::actingAs($this->waliKelas);

        // Meminta jadwal kelas lain di mana wali kelas tidak mengajar di sana
        $response = $this->getJson('/api/schedules?class_id=' . $this->classLain->id);

        $response->assertStatus(200);
        // Fallback aman: hanya mencari jadwal di mana teacher_id = waliKelas, sehingga data kosong
        $this->assertEmpty($response->json('data'));
    }

    public function test_homeroom_teacher_can_view_journals_of_their_class(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();

        // Jurnal di kelas binaan dibuka oleh guru lain
        $journal = Journal::create([
            'schedule_id' => $this->scheduleBinaanGuruLain->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        Sanctum::actingAs($this->waliKelas);

        $response = $this->getJson('/api/journals');

        $response->assertStatus(200);
        $journalIds = collect($response->json('data'))->pluck('id')->toArray();
        $this->assertContains($journal->id, $journalIds);
    }

    public function test_homeroom_teacher_can_view_journal_detail_of_their_class(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->scheduleBinaanGuruLain->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        Sanctum::actingAs($this->waliKelas);

        $response = $this->getJson('/api/journals/' . $journal->id);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $journal->id);
    }

    public function test_homeroom_teacher_cannot_view_journal_detail_of_other_class(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journalLain = Journal::create([
            'schedule_id' => $this->scheduleLain->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        Sanctum::actingAs($this->waliKelas);

        $response = $this->getJson('/api/journals/' . $journalLain->id);

        $response->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_homeroom_teacher_can_open_session_for_their_class(): void
    {
        Sanctum::actingAs($this->waliKelas);

        $response = $this->postJson('/api/journals', [
            'schedule_id' => $this->scheduleBinaanGuruLain->id,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.substitute_teacher_id', $this->waliKelas->id);

        $this->assertDatabaseHas('journals', [
            'schedule_id' => $this->scheduleBinaanGuruLain->id,
            'substitute_teacher_id' => $this->waliKelas->id,
            'status' => 'ongoing',
        ]);
    }

    public function test_homeroom_teacher_cannot_open_session_for_other_class(): void
    {
        Sanctum::actingAs($this->waliKelas);

        $response = $this->postJson('/api/journals', [
            'schedule_id' => $this->scheduleLain->id,
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('success', false);

        $this->assertEquals(0, Journal::where('schedule_id', $this->scheduleLain->id)->count());
    }

    public function test_homeroom_teacher_cannot_mark_teacher_absent(): void
    {
        Sanctum::actingAs($this->waliKelas);

        // Coba via POST /api/journals dengan status teacher_absent
        $responsePost = $this->postJson('/api/journals', [
            'schedule_id' => $this->scheduleBinaanGuruLain->id,
            'status' => 'teacher_absent',
        ]);
        $responsePost->assertStatus(403);

        // Coba via PATCH /api/journals/{id}
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->scheduleBinaanGuruLain->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        $responsePatch = $this->patchJson('/api/journals/' . $journal->id);
        $responsePatch->assertStatus(403);
    }

    public function test_homeroom_teacher_can_complete_journal_they_opened(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->scheduleBinaanGuruLain->id,
            'date' => $today,
            'status' => 'ongoing',
            'substitute_teacher_id' => $this->waliKelas->id,
        ]);

        Sanctum::actingAs($this->waliKelas);

        $fakePhoto = UploadedFile::fake()->image('kbm_wali.jpg', 800, 600);

        $response = $this->postJson('/api/journals/' . $journal->id, [
            '_method' => 'PUT',
            'topic_description' => 'Membimbing belajar mandiri dan pengerjaan tugas modul matematika bab 2.',
            'photo' => $fakePhoto,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertEquals('completed', $journal->fresh()->status);
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->studentInBinaan->id,
            'status' => 'Hadir',
        ]);
    }

    public function test_homeroom_teacher_cannot_complete_journal_opened_by_original_teacher(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        // Jurnal dibuka oleh guru pengampu asli (substitute_teacher_id bernilai null)
        $journal = Journal::create([
            'schedule_id' => $this->scheduleBinaanGuruLain->id,
            'date' => $today,
            'status' => 'ongoing',
            'substitute_teacher_id' => null,
        ]);

        Sanctum::actingAs($this->waliKelas);

        $fakePhoto = UploadedFile::fake()->image('kbm_wali.jpg', 800, 600);

        $response = $this->postJson('/api/journals/' . $journal->id, [
            '_method' => 'PUT',
            'topic_description' => 'Mencoba menyelesaikan jurnal milik guru asli.',
            'photo' => $fakePhoto,
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('success', false);

        $this->assertEquals('ongoing', $journal->fresh()->status);
        $this->assertEquals(0, Attendance::where('journal_id', $journal->id)->count());
    }

    /**
     * S08. Wali kelas dapat melihat daftar perizinan siswa pada kelas binaannya.
     */
    public function test_homeroom_teacher_can_view_leave_requests_of_their_class(): void
    {
        $studentLain = User::create([
            'name' => 'Siswa Kelas Lain',
            'email' => 'siswa_lain@example.com',
            'nis_nip' => '5002',
            'role' => 'student',
            'class_id' => $this->classLain->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $leaveBinaan = LeaveRequest::create([
            'student_id' => $this->studentInBinaan->id,
            'applicant_id' => $this->studentInBinaan->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-02',
            'status_approval' => 'pending',
        ]);

        $leaveLain = LeaveRequest::create([
            'student_id' => $studentLain->id,
            'applicant_id' => $studentLain->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-02',
            'status_approval' => 'pending',
        ]);

        Sanctum::actingAs($this->waliKelas);

        $response = $this->getJson('/api/leave-requests');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $ids = collect($response->json('data'))->pluck('id')->toArray();
        $this->assertContains($leaveBinaan->id, $ids);
        $this->assertNotContains($leaveLain->id, $ids);
    }

    /**
     * S09. Wali kelas berhak menyetujui (approve) izin siswa dari kelas binaannya,
     * tetapi ditolak (HTTP 403) jika mencoba memverifikasi izin siswa dari kelas lain.
     */
    public function test_homeroom_teacher_can_approve_student_leave_request_for_their_class(): void
    {
        $leaveBinaan = LeaveRequest::create([
            'student_id' => $this->studentInBinaan->id,
            'applicant_id' => $this->studentInBinaan->id,
            'class_id' => $this->classBinaan->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-02',
            'status_approval' => 'pending',
        ]);

        $studentLain = User::create([
            'name' => 'Siswa Kelas Lain Leave',
            'email' => 'siswa_leave_lain@example.com',
            'nis_nip' => '5099',
            'role' => 'student',
            'class_id' => $this->classLain->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $leaveLain = LeaveRequest::create([
            'student_id' => $studentLain->id,
            'applicant_id' => $studentLain->id,
            'class_id' => $this->classLain->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-02',
            'status_approval' => 'pending',
        ]);

        Sanctum::actingAs($this->waliKelas);

        // 1. Wali kelas menyetujui izin siswa dari kelas binaan -> Berhasil (HTTP 200)
        $response = $this->patchJson('/api/leave-requests/' . $leaveBinaan->id, [
            'status' => 'approved',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertEquals('approved', $leaveBinaan->fresh()->status_approval);
        $this->assertEquals($this->waliKelas->id, $leaveBinaan->fresh()->verified_by);

        // 2. Wali kelas memverifikasi siswa kelas lain -> Ditolak (HTTP 403)
        $responseLain = $this->patchJson('/api/leave-requests/' . $leaveLain->id, [
            'status' => 'approved',
        ]);

        $responseLain->assertStatus(403);
        $this->assertEquals('pending', $leaveLain->fresh()->status_approval);
    }

    /**
     * S10. Wali kelas melihat rekapitulasi presensi yang secara otomatis ter-scope ke kelas binaannya.
     */
    public function test_homeroom_teacher_can_view_attendance_recap_scoped_to_their_class(): void
    {
        $studentLain = User::create([
            'name' => 'Siswa Kelas Lain Presensi',
            'email' => 'siswa_presensi_lain@example.com',
            'nis_nip' => '5003',
            'role' => 'student',
            'class_id' => $this->classLain->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $today = Carbon::now('Asia/Jakarta')->toDateString();

        $journalBinaan = Journal::create([
            'schedule_id' => $this->scheduleBinaanGuruLain->id,
            'date' => $today,
            'status' => 'completed',
            'substitute_teacher_id' => null,
        ]);

        $attendanceBinaan = Attendance::create([
            'journal_id' => $journalBinaan->id,
            'student_id' => $this->studentInBinaan->id,
            'date' => $today,
            'status' => 'Hadir',
        ]);

        $journalLain = Journal::create([
            'schedule_id' => $this->scheduleLain->id,
            'date' => $today,
            'status' => 'completed',
            'substitute_teacher_id' => null,
        ]);

        $attendanceLain = Attendance::create([
            'journal_id' => $journalLain->id,
            'student_id' => $studentLain->id,
            'date' => $today,
            'status' => 'Hadir',
        ]);

        Sanctum::actingAs($this->waliKelas);

        $response = $this->getJson('/api/attendances');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $ids = collect($response->json('data'))->pluck('id')->toArray();
        $this->assertContains($attendanceBinaan->id, $ids);
        $this->assertNotContains($attendanceLain->id, $ids);
    }
}
