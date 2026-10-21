<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Classes;
use App\Models\Journal;
use App\Models\LeaveRequest;
use App\Models\Rooms;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\TeacherAssignment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class JournalAndAttendanceTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacherA;
    private User $teacherKesiswaan;
    private User $teacherWaliKelas;
    private User $teacherReguler;
    private User $student1;
    private User $student2;
    private User $student3;
    private Classes $classA;
    private Subject $subject;
    private Rooms $room;
    private Schedule $schedule;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        // 1. Akun Waka Kurikulum
        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 2. Akun Guru Utama (Teacher A)
        $this->teacherA = User::create([
            'name' => 'Guru A (Utama)',
            'email' => 'guruA@example.com',
            'nis_nip' => '198101012005011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 3. Akun Guru Kesiswaan (Teacher B)
        $this->teacherKesiswaan = User::create([
            'name' => 'Guru B (Kesiswaan)',
            'email' => 'kesiswaan@example.com',
            'nis_nip' => '198201012006011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
        TeacherAssignment::create([
            'user_id' => $this->teacherKesiswaan->id,
            'type' => 'kesiswaan',
        ]);

        // 4. Master Data Kelas, Mapel, Ruang
        $this->classA = Classes::create([
            'name' => 'XII RPL 1',
            'level' => 12,
        ]);

        // 5. Akun Guru Wali Kelas (Teacher C)
        $this->teacherWaliKelas = User::create([
            'name' => 'Guru C (Wali Kelas)',
            'email' => 'walikelas@example.com',
            'nis_nip' => '198301012007011003',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
        TeacherAssignment::create([
            'user_id' => $this->teacherWaliKelas->id,
            'type' => 'wali_kelas',
            'class_id' => $this->classA->id,
        ]);

        // 6. Akun Guru Reguler (Teacher D)
        $this->teacherReguler = User::create([
            'name' => 'Guru D (Reguler)',
            'email' => 'reguler@example.com',
            'nis_nip' => '198401012008011004',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 7. Siswa di Kelas XII RPL 1
        $this->student1 = User::create([
            'name' => 'Siswa Satu',
            'email' => 'siswa1@example.com',
            'nis_nip' => '1001',
            'role' => 'student',
            'class_id' => $this->classA->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->student2 = User::create([
            'name' => 'Siswa Dua',
            'email' => 'siswa2@example.com',
            'nis_nip' => '1002',
            'role' => 'student',
            'class_id' => $this->classA->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->student3 = User::create([
            'name' => 'Siswa Tiga',
            'email' => 'siswa3@example.com',
            'nis_nip' => '1003',
            'role' => 'student',
            'class_id' => $this->classA->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->subject = Subject::create(['name' => 'Pemrograman Berorientasi Objek']);
        $this->room = Rooms::create(['name' => 'Lab RPL 1', 'capacity' => 36]);

        // 8. Jadwal Mengajar Guru A pada Kelas XII RPL 1
        $this->schedule = Schedule::create([
            'teacher_id' => $this->teacherA->id,
            'class_id' => $this->classA->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => Carbon::now('Asia/Jakarta')->dayOfWeekIso,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);
    }

    public function test_original_teacher_can_open_journal_session(): void
    {
        Sanctum::actingAs($this->teacherA);

        $response = $this->postJson('/api/journals', [
            'schedule_id' => $this->schedule->id,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Jurnal KBM berhasil dibuka.',
                'data' => [
                    'schedule_id' => $this->schedule->id,
                    'status' => 'ongoing',
                    'substitute_teacher_id' => null,
                ],
            ]);

        $this->assertDatabaseHas('journals', [
            'schedule_id' => $this->schedule->id,
            'status' => 'ongoing',
            'substitute_teacher_id' => null,
        ]);
    }

    public function test_kesiswaan_can_open_journal_as_substitute_teacher(): void
    {
        Sanctum::actingAs($this->teacherKesiswaan);

        $response = $this->postJson('/api/journals', [
            'schedule_id' => $this->schedule->id,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Jurnal KBM berhasil dibuka.',
                'data' => [
                    'schedule_id' => $this->schedule->id,
                    'status' => 'ongoing',
                    'substitute_teacher_id' => $this->teacherKesiswaan->id,
                ],
            ]);

        $this->assertDatabaseHas('journals', [
            'schedule_id' => $this->schedule->id,
            'status' => 'ongoing',
            'substitute_teacher_id' => $this->teacherKesiswaan->id,
        ]);
    }

    public function test_kesiswaan_can_mark_teacher_absent_via_store(): void
    {
        Sanctum::actingAs($this->teacherKesiswaan);

        $response = $this->postJson('/api/journals', [
            'schedule_id' => $this->schedule->id,
            'status' => 'teacher_absent',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Jadwal berhasil ditandai sebagai guru berhalangan hadir (teacher_absent).',
                'data' => [
                    'schedule_id' => $this->schedule->id,
                    'status' => 'teacher_absent',
                ],
            ]);

        $this->assertDatabaseHas('journals', [
            'schedule_id' => $this->schedule->id,
            'status' => 'teacher_absent',
        ]);
    }

    public function test_waka_can_mark_teacher_absent_via_store(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/journals', [
            'schedule_id' => $this->schedule->id,
            'status' => 'teacher_absent',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Jadwal berhasil ditandai sebagai guru berhalangan hadir (teacher_absent).',
            ]);

        $this->assertDatabaseHas('journals', [
            'schedule_id' => $this->schedule->id,
            'status' => 'teacher_absent',
        ]);
    }

    public function test_wali_kelas_is_forbidden_from_opening_or_substituting_journal(): void
    {
        Sanctum::actingAs($this->teacherWaliKelas);

        $response = $this->postJson('/api/journals', [
            'schedule_id' => $this->schedule->id,
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Akses ditolak. Hanya guru pengajar jadwal atau Guru Kesiswaan yang berhak membuka atau menggantikan jadwal ini.',
            ]);

        $this->assertEquals(0, Journal::count());
    }

    public function test_regular_teacher_without_kesiswaan_is_forbidden_from_substituting(): void
    {
        Sanctum::actingAs($this->teacherReguler);

        $response = $this->postJson('/api/journals', [
            'schedule_id' => $this->schedule->id,
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Akses ditolak. Hanya guru pengajar jadwal atau Guru Kesiswaan yang berhak membuka atau menggantikan jadwal ini.',
            ]);

        $this->assertEquals(0, Journal::count());
    }

    public function test_student_and_parent_cannot_open_journal(): void
    {
        Sanctum::actingAs($this->student1);

        $response = $this->postJson('/api/journals', [
            'schedule_id' => $this->schedule->id,
        ]);

        $response->assertStatus(403);
    }

    public function test_kesiswaan_or_waka_can_mark_ongoing_journal_as_teacher_absent_via_patch(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->schedule->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        Sanctum::actingAs($this->teacherKesiswaan);

        $response = $this->patchJson("/api/journals/{$journal->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Status jurnal berhasil diubah menjadi guru berhalangan hadir (teacher_absent).',
            ]);

        $this->assertEquals('teacher_absent', $journal->fresh()->status);
    }

    public function test_wali_kelas_cannot_patch_journal_to_teacher_absent(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->schedule->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        Sanctum::actingAs($this->teacherWaliKelas);

        $response = $this->patchJson("/api/journals/{$journal->id}");

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Akses ditolak. Hanya Guru Kesiswaan atau Waka Kurikulum yang berhak menandai status guru berhalangan hadir.',
            ]);

        $this->assertEquals('ongoing', $journal->fresh()->status);
    }

    public function test_atomic_put_journal_completion_with_exception_based_attendance(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->schedule->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        Sanctum::actingAs($this->teacherA);

        $fakePhoto = UploadedFile::fake()->image('kbm_photo.jpg', 1200, 900);

        $response = $this->postJson("/api/journals/{$journal->id}", [
            '_method' => 'PUT',
            'topic_description' => 'Mempelajari konsep pewarisan (inheritance) dan polimorfisme pada OOP PHP.',
            'photo' => $fakePhoto,
            'exceptions' => [
                [
                    'student_id' => $this->student1->id,
                    'status' => 'Sakit',
                ],
            ],
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Jurnal KBM dan presensi berhasil diselesaikan.',
            ])
            ->assertJsonPath('data.status', 'completed');

        // Verifikasi Status Jurnal
        $journal->refresh();
        $this->assertEquals('completed', $journal->status);
        $this->assertNotNull($journal->photo_path);

        // Verifikasi Presensi Exception-Based:
        // Student 1 Sakit, Siswa 2 dan Siswa 3 otomatis tercatat Hadir
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->student1->id,
            'status' => 'Sakit',
        ]);
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->student2->id,
            'status' => 'Hadir',
        ]);
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->student3->id,
            'status' => 'Hadir',
        ]);

        $this->assertEquals(3, Attendance::where('journal_id', $journal->id)->count());
    }

    public function test_kesiswaan_as_substitute_can_complete_journal_and_attendance(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->schedule->id,
            'date' => $today,
            'status' => 'ongoing',
            'substitute_teacher_id' => $this->teacherKesiswaan->id,
        ]);

        Sanctum::actingAs($this->teacherKesiswaan);

        $fakePhoto = UploadedFile::fake()->image('kbm_substitute.jpg', 800, 600);

        $response = $this->postJson("/api/journals/{$journal->id}", [
            '_method' => 'PUT',
            'topic_description' => 'Materi pengganti: Dasar-dasar routing dan controller Laravel.',
            'photo' => $fakePhoto,
            'exceptions' => [],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');

        $this->assertEquals('completed', $journal->fresh()->status);
        $this->assertEquals(3, Attendance::where('journal_id', $journal->id)->where('status', 'Hadir')->count());
    }

    public function test_wali_kelas_cannot_complete_journal_of_other_teacher(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->schedule->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        Sanctum::actingAs($this->teacherWaliKelas);

        $fakePhoto = UploadedFile::fake()->image('kbm_walikelas.jpg', 800, 600);

        $response = $this->postJson("/api/journals/{$journal->id}", [
            '_method' => 'PUT',
            'topic_description' => 'Mencoba mengisi jurnal kelas binaan.',
            'photo' => $fakePhoto,
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk mengisi atau menyelesaikan jurnal ini.',
            ]);

        $this->assertEquals('ongoing', $journal->fresh()->status);
        $this->assertEquals(0, Attendance::where('journal_id', $journal->id)->count());
    }

    public function test_approved_leave_requests_are_synced_to_attendance(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();

        // Buat perizinan tidak_masuk (kategori lainnya/izin) yang telah disetujui untuk student2
        LeaveRequest::create([
            'student_id' => $this->student2->id,
            'applicant_id' => $this->student2->id,
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => $today,
            'end_date' => $today,
            'status_approval' => 'approved',
            'verified_by' => $this->teacherKesiswaan->id,
            'verified_at' => now(),
        ]);

        $journal = Journal::create([
            'schedule_id' => $this->schedule->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        Sanctum::actingAs($this->teacherA);

        $fakePhoto = UploadedFile::fake()->image('sync_test.jpg', 800, 600);

        // Guru hanya mengecualikan student1 sebagai Alpa, tanpa menyebut student2
        $response = $this->postJson("/api/journals/{$journal->id}", [
            '_method' => 'PUT',
            'topic_description' => 'Praktikum koneksi basis data MySQL dan PostgreSQL.',
            'photo' => $fakePhoto,
            'exceptions' => [
                [
                    'student_id' => $this->student1->id,
                    'status' => 'Alpa',
                ],
            ],
        ]);

        $response->assertStatus(200);

        // Student 1 -> Alpa (dari exceptions guru)
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->student1->id,
            'status' => 'Alpa',
        ]);

        // Student 2 -> Izin (otomatis dari leave_requests approved kategori lainnya)
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->student2->id,
            'status' => 'Izin',
        ]);

        // Student 3 -> Hadir (default siswa tersisa)
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->student3->id,
            'status' => 'Hadir',
        ]);
    }

    public function test_journal_index_scoping(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();

        // Jurnal 1 milik Guru A
        Journal::create([
            'schedule_id' => $this->schedule->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        // Jurnal 2 milik Guru Reguler
        $scheduleOther = Schedule::create([
            'teacher_id' => $this->teacherReguler->id,
            'class_id' => $this->classA->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 2,
            'period_number' => 3,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);
        Journal::create([
            'schedule_id' => $scheduleOther->id,
            'date' => $today,
            'status' => 'completed',
        ]);

        // 1. Guru A memanggil GET /api/journals -> Hanya melihat 1 jurnal miliknya
        Sanctum::actingAs($this->teacherA);
        $resGuruA = $this->getJson('/api/journals');
        $resGuruA->assertStatus(200);
        $this->assertCount(1, $resGuruA->json('data'));

        // 2. Kesiswaan memanggil GET /api/journals -> Melihat seluruh 2 jurnal sekolah
        Sanctum::actingAs($this->teacherKesiswaan);
        $resKesiswaan = $this->getJson('/api/journals');
        $resKesiswaan->assertStatus(200);
        $this->assertCount(2, $resKesiswaan->json('data'));

        // 3. Waka memanggil GET /api/journals -> Melihat seluruh 2 jurnal sekolah
        Sanctum::actingAs($this->waka);
        $resWaka = $this->getJson('/api/journals');
        $resWaka->assertStatus(200);
        $this->assertCount(2, $resWaka->json('data'));
    }

    public function test_attendance_index_scoping(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->schedule->id,
            'date' => $today,
            'status' => 'completed',
        ]);

        Attendance::create([
            'journal_id' => $journal->id,
            'student_id' => $this->student1->id,
            'status' => 'Hadir',
            'date' => $today,
        ]);
        Attendance::create([
            'journal_id' => $journal->id,
            'student_id' => $this->student2->id,
            'status' => 'Sakit',
            'date' => $today,
        ]);

        // 1. Siswa 1 memanggil GET /api/attendances -> Hanya melihat presensi miliknya sendiri (1 record)
        Sanctum::actingAs($this->student1);
        $resSiswa = $this->getJson('/api/attendances');
        $resSiswa->assertStatus(200);
        $this->assertCount(1, $resSiswa->json('data'));
        $this->assertEquals($this->student1->id, $resSiswa->json('data.0.student_id'));

        // 2. Wali Kelas XII RPL 1 memanggil GET /api/attendances -> Melihat presensi kelas binaannya (2 records)
        Sanctum::actingAs($this->teacherWaliKelas);
        $resWali = $this->getJson('/api/attendances');
        $resWali->assertStatus(200);
        $this->assertCount(2, $resWali->json('data'));

        // 3. Kesiswaan memanggil GET /api/attendances -> Melihat seluruh presensi (2 records)
        Sanctum::actingAs($this->teacherKesiswaan);
        $resKesiswaan = $this->getJson('/api/attendances');
        $resKesiswaan->assertStatus(200);
        $this->assertCount(2, $resKesiswaan->json('data'));
    }

    public function test_photo_compression_conforms_to_prd_specs(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->schedule->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        Sanctum::actingAs($this->teacherA);

        // Upload gambar berukuran besar (1600x1200)
        $largePhoto = UploadedFile::fake()->image('large_kbm.png', 1600, 1200);

        $response = $this->postJson("/api/journals/{$journal->id}", [
            '_method' => 'PUT',
            'topic_description' => 'Materi pengujian kompresi foto sesuai spesifikasi PRD 5.11.',
            'photo' => $largePhoto,
        ]);

        $response->assertStatus(200);

        $journal->refresh();
        $this->assertNotNull($journal->photo_path);
        Storage::disk('public')->assertExists($journal->photo_path);

        // Verifikasi ekstensi file adalah .jpg
        $this->assertStringEndsWith('.jpg', $journal->photo_path);

        // Verifikasi ukuran berkas di bawah 150 KB (153,600 byte)
        $fileSize = Storage::disk('public')->size($journal->photo_path);
        $this->assertLessThan(153600, $fileSize);

        // Verifikasi header magic number JPEG (\xFF\xD8)
        $content = Storage::disk('public')->get($journal->photo_path);
        $this->assertStringStartsWith("\xFF\xD8", $content);
    }

    public function test_journal_show_scoping(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->schedule->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        // 1. Guru pemilik jadwal -> Bisa melihat (200 OK)
        Sanctum::actingAs($this->teacherA);
        $this->getJson("/api/journals/{$journal->id}")->assertStatus(200);

        // 2. Kesiswaan -> Bisa melihat (200 OK)
        Sanctum::actingAs($this->teacherKesiswaan);
        $this->getJson("/api/journals/{$journal->id}")->assertStatus(200);

        // 3. Waka Kurikulum -> Bisa melihat (200 OK)
        Sanctum::actingAs($this->waka);
        $this->getJson("/api/journals/{$journal->id}")->assertStatus(200);

        // 4. Guru reguler yang bukan pengajar jadwal -> 403 Forbidden
        Sanctum::actingAs($this->teacherReguler);
        $this->getJson("/api/journals/{$journal->id}")->assertStatus(403);

        // 5. Siswa -> 403 Forbidden (jurnal hanya untuk Guru & Waka)
        Sanctum::actingAs($this->student1);
        $this->getJson("/api/journals/{$journal->id}")->assertStatus(403);
    }
}
