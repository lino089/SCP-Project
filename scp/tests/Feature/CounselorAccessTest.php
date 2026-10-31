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

class CounselorAccessTest extends TestCase
{
    use RefreshDatabase;

    private User $counselor;
    private User $regularTeacher;
    private User $originalTeacher;
    private Classes $classA;
    private Classes $classB;
    private Rooms $room;
    private Subject $subject;
    private Schedule $scheduleA;
    private Schedule $scheduleB;
    private User $studentA;
    private User $studentB;

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

        // 1. Akun Guru Kesiswaan / BK
        $this->counselor = User::create([
            'name' => 'Guru Kesiswaan',
            'email' => 'kesiswaan@example.com',
            'nis_nip' => '198201012006011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
        TeacherAssignment::create([
            'user_id' => $this->counselor->id,
            'type' => 'kesiswaan',
        ]);

        // 2. Akun Guru Reguler (Bukan Kesiswaan, Bukan Wali Kelas)
        $this->regularTeacher = User::create([
            'name' => 'Guru Reguler Biasa',
            'email' => 'gurureguler@example.com',
            'nis_nip' => '198701012011011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 3. Akun Guru Pengampu Asli Jadwal
        $this->originalTeacher = User::create([
            'name' => 'Guru Pengampu Asli',
            'email' => 'guruasli@example.com',
            'nis_nip' => '198301012008011003',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 4. Master Data Kelas & Ruangan
        $this->classA = Classes::create(['name' => 'X RPL 1', 'level' => '10']);
        $this->classB = Classes::create(['name' => 'XI TKJ 1', 'level' => '11']);
        $this->room = Rooms::create(['name' => 'Lab Komputer 1', 'capacity' => 36]);
        $this->subject = Subject::create(['name' => 'Basis Data']);

        // 5. Akun Siswa
        $this->studentA = User::create([
            'name' => 'Siswa Kelas A',
            'email' => 'siswa_a@example.com',
            'nis_nip' => '7001',
            'role' => 'student',
            'class_id' => $this->classA->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->studentB = User::create([
            'name' => 'Siswa Kelas B',
            'email' => 'siswa_b@example.com',
            'nis_nip' => '7002',
            'role' => 'student',
            'class_id' => $this->classB->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $todayIso = (int) Carbon::now('Asia/Jakarta')->dayOfWeekIso;

        // 6. Jadwal Mengajar Guru Asli
        $this->scheduleA = Schedule::create([
            'teacher_id' => $this->originalTeacher->id,
            'class_id' => $this->classA->id,
            'subject_id' => $this->subject->id,
            'room_id' => $this->room->id,
            'day_of_week' => $todayIso,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->scheduleB = Schedule::create([
            'teacher_id' => $this->originalTeacher->id,
            'class_id' => $this->classB->id,
            'subject_id' => $this->subject->id,
            'room_id' => $this->room->id,
            'day_of_week' => $todayIso,
            'period_number' => 3,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);
    }

    /**
     * S22. Kesiswaan dapat melihat rekap presensi seluruh siswa tanpa pembatasan filter kelas.
     */
    public function test_counselor_can_view_all_students_attendance(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();

        $journalA = Journal::create([
            'schedule_id' => $this->scheduleA->id,
            'date' => $today,
            'status' => 'completed',
            'substitute_teacher_id' => null,
        ]);

        $attendanceA = Attendance::create([
            'journal_id' => $journalA->id,
            'student_id' => $this->studentA->id,
            'date' => $today,
            'status' => 'Hadir',
        ]);

        $journalB = Journal::create([
            'schedule_id' => $this->scheduleB->id,
            'date' => $today,
            'status' => 'completed',
            'substitute_teacher_id' => null,
        ]);

        $attendanceB = Attendance::create([
            'journal_id' => $journalB->id,
            'student_id' => $this->studentB->id,
            'date' => $today,
            'status' => 'Hadir',
        ]);

        Sanctum::actingAs($this->counselor);

        $response = $this->getJson('/api/attendances');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $ids = collect($response->json('data'))->pluck('id')->toArray();
        $this->assertContains($attendanceA->id, $ids);
        $this->assertContains($attendanceB->id, $ids);
    }

    /**
     * S23. Kesiswaan dapat membuka jurnal KBM pengganti untuk kelas mana pun di sekolah.
     */
    public function test_counselor_can_open_substitute_journal_for_any_class(): void
    {
        Sanctum::actingAs($this->counselor);

        $response = $this->postJson('/api/journals', [
            'schedule_id' => $this->scheduleA->id,
            'status' => 'ongoing',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $journal = Journal::where('schedule_id', $this->scheduleA->id)->first();
        $this->assertNotNull($journal);
        $this->assertEquals($this->counselor->id, $journal->substitute_teacher_id);
    }

    /**
     * S24. Kesiswaan dapat menyelesaikan jurnal yang ia buka sebagai guru pengganti.
     */
    public function test_counselor_can_complete_substitute_journal(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();

        $journal = Journal::create([
            'schedule_id' => $this->scheduleA->id,
            'date' => $today,
            'status' => 'ongoing',
            'substitute_teacher_id' => $this->counselor->id,
        ]);

        Sanctum::actingAs($this->counselor);

        $fakePhoto = UploadedFile::fake()->image('kbm_kesiswaan.jpg', 800, 600);

        $response = $this->postJson('/api/journals/' . $journal->id, [
            '_method' => 'PUT',
            'topic_description' => 'Materi pengganti pembinaan kedisiplinan dan pengantar basis data.',
            'photo' => $fakePhoto,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertEquals('completed', $journal->fresh()->status);
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->studentA->id,
            'status' => 'Hadir',
        ]);
    }

    /**
     * S25. Kesiswaan dapat menandai status guru berhalangan hadir (teacher_absent).
     */
    public function test_counselor_can_mark_teacher_absent(): void
    {
        Sanctum::actingAs($this->counselor);

        $response = $this->postJson('/api/journals', [
            'schedule_id' => $this->scheduleB->id,
            'status' => 'teacher_absent',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $journal = Journal::where('schedule_id', $this->scheduleB->id)->first();
        $this->assertNotNull($journal);
        $this->assertEquals('teacher_absent', $journal->status);
    }

    /**
     * S26. Kesiswaan dapat melihat dan menyetujui seluruh perizinan siswa multi-kelas.
     */
    public function test_counselor_can_view_and_approve_all_student_leaves(): void
    {
        $leaveA = LeaveRequest::create([
            'student_id' => $this->studentA->id,
            'applicant_id' => $this->studentA->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-02',
            'status_approval' => 'pending',
        ]);

        $leaveB = LeaveRequest::create([
            'student_id' => $this->studentB->id,
            'applicant_id' => $this->studentB->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-02',
            'status_approval' => 'pending',
        ]);

        Sanctum::actingAs($this->counselor);

        // 1. Melihat semua perizinan siswa lintas kelas
        $responseIndex = $this->getJson('/api/leave-requests');
        $responseIndex->assertStatus(200);

        $ids = collect($responseIndex->json('data'))->pluck('id')->toArray();
        $this->assertContains($leaveA->id, $ids);
        $this->assertContains($leaveB->id, $ids);

        // 2. Menyetujui izin siswa Kelas B
        $responseApprove = $this->patchJson('/api/leave-requests/' . $leaveB->id, [
            'status' => 'approved',
        ]);

        $responseApprove->assertStatus(200);
        $this->assertEquals('approved', $leaveB->fresh()->status_approval);
        $this->assertEquals($this->counselor->id, $leaveB->fresh()->verified_by);
    }

    /**
     * S27. Guru reguler yang bukan pengampu asli, bukan wali kelas, dan bukan kesiswaan ditolak saat mencoba membuka kelas lain.
     */
    public function test_non_counselor_teacher_cannot_act_as_substitute_for_other_class(): void
    {
        Sanctum::actingAs($this->regularTeacher);

        $response = $this->postJson('/api/journals', [
            'schedule_id' => $this->scheduleA->id,
            'status' => 'ongoing',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Akses ditolak. Hanya guru pengajar jadwal, Guru Kesiswaan, atau Wali Kelas terkait yang berhak membuka atau menggantikan jadwal ini.');
    }
}
