<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Classes;
use App\Models\Journal;
use App\Models\LeaveRequest;
use App\Models\Rooms;
use App\Models\Schedule;
use App\Models\StudentClassHistory;
use App\Models\Subject;
use App\Models\SystemConfiguration;
use App\Models\TeacherAssignment;
use App\Models\TeacherLeaveRequest;
use App\Models\User;
use App\Services\TeacherAssignmentImportService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\SimpleExcel\SimpleExcelWriter;
use Tests\TestCase;

class TeacherAssignmentLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $waliOld;
    private User $waliNew;
    private User $bkOld;
    private User $bkNew;
    private User $subjectTeacher;
    private User $student10;
    private User $student11;
    private Classes $class10;
    private Classes $class11;
    private Classes $class12;
    private Schedule $schedule10;
    private Schedule $schedule11;

    protected function setUp(): void
    {
        parent::setUp();

        SystemConfiguration::create([
            'active_cycle' => 1,
            'monday_is_upacara' => true,
            'academic_year' => '2026/2027',
            'semester' => 'Ganjil',
        ]);

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@smkn1.sch.id',
            'nis_nip' => '197501012000011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->waliOld = User::create([
            'name' => 'Guru Wali Lama, S.Pd.',
            'email' => 'wali.lama@smkn1.sch.id',
            'nis_nip' => '198001012005011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->waliNew = User::create([
            'name' => 'Guru Wali Baru, S.Pd.',
            'email' => 'wali.baru@smkn1.sch.id',
            'nis_nip' => '198201012008011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->bkOld = User::create([
            'name' => 'Guru BK Lama, S.Pd.',
            'email' => 'bk.lama@smkn1.sch.id',
            'nis_nip' => '198301012009011003',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->bkNew = User::create([
            'name' => 'Guru BK Baru, S.Pd.',
            'email' => 'bk.baru@smkn1.sch.id',
            'nis_nip' => '198401012010011004',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->subjectTeacher = User::create([
            'name' => 'Guru Mapel Produktif, S.Kom.',
            'email' => 'mapel@smkn1.sch.id',
            'nis_nip' => '198801012014011005',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->class12 = Classes::create(['name' => 'XII RPL 1', 'level' => 12, 'next_class_id' => null]);
        $this->class11 = Classes::create(['name' => 'XI RPL 1', 'level' => 11, 'next_class_id' => $this->class12->id]);
        $this->class10 = Classes::create(['name' => 'X RPL 1', 'level' => 10, 'next_class_id' => $this->class11->id]);

        $this->student10 = User::create([
            'name' => 'Budi Siswa Kelas 10',
            'nis_nip' => '26001',
            'role' => 'student',
            'class_id' => $this->class10->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->student11 = User::create([
            'name' => 'Ani Siswa Kelas 11',
            'nis_nip' => '25001',
            'role' => 'student',
            'class_id' => $this->class11->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $room = Rooms::create(['name' => 'Lab RPL 1', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Pemrograman Web']);

        $this->schedule10 = Schedule::create([
            'teacher_id' => $this->subjectTeacher->id,
            'class_id' => $this->class10->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->schedule11 = Schedule::create([
            'teacher_id' => $this->subjectTeacher->id,
            'class_id' => $this->class11->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 1,
            'period_number' => 3,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);
    }

    private function createMockExcel(array $rows): string
    {
        $tempPath = tempnam(sys_get_temp_dir(), 'lifecycle_excel_') . '.xlsx';
        $writer = SimpleExcelWriter::create($tempPath);

        $writer->addRow(['DAFTAR WALI KELAS DAN GURU BK', '', '', '']);
        $writer->addRow(['SEMESTER GANJIL', '', '', '']);
        $writer->addRow(['NO', 'KELAS', 'NAMA WALI KELAS', 'NAMA GURU BK']);

        foreach ($rows as $row) {
            $writer->addRow($row);
        }

        $writer->close();
        return $tempPath;
    }

    /**
     * TC-01: Pergantian Wali Kelas (Mid-Year / Manual) - Keputusan 1A & 2A
     * - Pencabutan / penggantian tidak menghapus baris lama (is_active = false, ended_at != null).
     * - Pejabat lama kehilangan akses monitoring kelas; pejabat baru mendapatkan akses penuh ke riwayat kelas.
     */
    public function test_tc01_wali_kelas_replacement_preserves_history_and_transfers_access(): void
    {
        Sanctum::actingAs($this->waka);

        // 1. Tugaskan Wali Lama ke X RPL 1
        $res1 = $this->postJson("/api/teachers/{$this->waliOld->id}/assignments", [
            'type' => 'wali_kelas',
            'class_id' => $this->class10->id,
        ]);
        $res1->assertStatus(201);
        $oldAssignmentId = $res1->json('data.id');

        // Siswa X RPL 1 mengajukan izin saat Wali Lama masih menjabat
        $leave = LeaveRequest::create([
            'student_id' => $this->student10->id,
            'class_id' => $this->class10->id,
            'academic_year' => '2026/2027',
            'applicant_id' => $this->student10->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-10-10',
            'end_date' => '2026-10-11',
            'status_approval' => 'approved',
            'verified_by' => $this->waka->id,
            'verified_at' => now(),
        ]);

        // 2. Ganti Wali Lama dengan Wali Baru menggunakan replace_existing = true
        $res2 = $this->postJson("/api/teachers/{$this->waliNew->id}/assignments", [
            'type' => 'wali_kelas',
            'class_id' => $this->class10->id,
            'replace_existing' => true,
            'notes' => 'Rotasi wali kelas tengah semester',
        ]);
        $res2->assertStatus(201);

        // 3. Verifikasi baris lama tetap ada sebagai histori (is_active = false, ended_at != null)
        $oldRecord = TeacherAssignment::find($oldAssignmentId);
        $this->assertNotNull($oldRecord);
        $this->assertFalse($oldRecord->is_active);
        $this->assertNotNull($oldRecord->ended_at);
        $this->assertEquals($this->waka->id, $oldRecord->revoked_by);

        // 4. Verifikasi baris baru aktif
        $this->assertTrue($this->waliNew->fresh()->isWaliKelas($this->class10->id));
        $this->assertFalse($this->waliOld->fresh()->isWaliKelas($this->class10->id));

        // 5. Keputusan 1 Opsi A: Wali Lama tidak lagi dapat mengakses daftar izin kelas X RPL 1
        Sanctum::actingAs($this->waliOld->fresh());
        $this->getJson('/api/leave-requests')->assertStatus(403);

        // 6. Keputusan 2 Opsi A: Wali Baru dapat melihat seluruh riwayat izin kelas X RPL 1 (termasuk yang dibuat sebelum ia menjabat)
        Sanctum::actingAs($this->waliNew->fresh());
        $newWaliIndex = $this->getJson('/api/leave-requests');
        $newWaliIndex->assertStatus(200);
        $ids = collect($newWaliIndex->json('data'))->pluck('id')->toArray();
        $this->assertContains($leave->id, $ids);
    }

    /**
     * TC-02: Pergantian Kesiswaan via Impor Excel
     * - Mengimpor Excel baru menonaktifkan Guru BK lama (is_active = false) dan mengaktifkan Guru BK baru.
     * - Tidak terjadi duplikasi 2 Guru BK aktif pada 1 kelas.
     */
    public function test_tc02_excel_import_deactivates_previous_bk_and_wali_without_duplication(): void
    {
        Sanctum::actingAs($this->waka);

        // Penugasan awal pada X RPL 1: Wali Lama & BK Lama
        $oldWaliAsgn = TeacherAssignment::create([
            'user_id' => $this->waliOld->id,
            'type' => 'wali_kelas',
            'class_id' => $this->class10->id,
            'academic_year' => '2026/2027',
            'is_active' => true,
            'started_at' => now()->subMonths(6),
        ]);

        $oldBkAsgn = TeacherAssignment::create([
            'user_id' => $this->bkOld->id,
            'type' => 'kesiswaan',
            'class_id' => $this->class10->id,
            'academic_year' => '2026/2027',
            'is_active' => true,
            'started_at' => now()->subMonths(6),
        ]);

        // Impor Excel baru yang memetakan X RPL 1 ke Wali Baru & BK Baru
        $service = app(TeacherAssignmentImportService::class);
        $excelPath = $this->createMockExcel([
            [1, 'X RPL 1', 'Guru Wali Baru, S.Pd.', 'Guru BK Baru, S.Pd.'],
        ]);
        $preview = $service->generatePreview($excelPath);

        $commitRes = $this->postJson('/api/teachers/assignments/import-commit', [
            'preview_token' => $preview['preview_token'],
            'items' => [
                [
                    'class_id' => $this->class10->id,
                    'wali_teacher_id' => $this->waliNew->id,
                    'bk_teacher_id' => $this->bkNew->id,
                ],
            ],
        ]);
        $commitRes->assertStatus(200);

        // Pastikan record lama masih ada di DB tapi is_active = false
        $this->assertFalse($oldWaliAsgn->fresh()->is_active);
        $this->assertNotNull($oldWaliAsgn->fresh()->ended_at);
        $this->assertFalse($oldBkAsgn->fresh()->is_active);
        $this->assertNotNull($oldBkAsgn->fresh()->ended_at);

        // Pastikan hanya ada tepat 1 Wali Kelas aktif dan 1 Guru BK aktif pada X RPL 1
        $activeWali = TeacherAssignment::active()->waliKelas()->forClass($this->class10->id)->get();
        $activeBk = TeacherAssignment::active()->kesiswaan()->forClass($this->class10->id)->get();

        $this->assertCount(1, $activeWali);
        $this->assertEquals($this->waliNew->id, $activeWali->first()->user_id);

        $this->assertCount(1, $activeBk);
        $this->assertEquals($this->bkNew->id, $activeBk->first()->user_id);
    }

    /**
     * TC-03: Integritas Izin, Presensi, & Penonaktifan Penugasan Saat Kenaikan Kelas (promoteClasses - Keputusan 6 Opsi B)
     * - Izin & presensi Budi saat di X RPL 1 tetap tercatat di X RPL 1 meskipun Budi sudah naik ke XI RPL 1.
     * - Riwayat kenaikan kelas Budi tercatat di student_class_histories.
     * - Seluruh penugasan aktif Wali Kelas & Kesiswaan otomatis dinonaktifkan (is_active = false).
     */
    public function test_tc03_class_promotion_preserves_historical_leaves_attendances_and_deactivates_assignments(): void
    {
        // 1. Setup penugasan aktif pada tahun ajaran berjalan
        $waliAsgn10 = TeacherAssignment::create([
            'user_id' => $this->waliOld->id,
            'type' => 'wali_kelas',
            'class_id' => $this->class10->id,
            'academic_year' => '2026/2027',
            'is_active' => true,
            'started_at' => now()->subMonths(10),
        ]);
        $bkAsgn10 = TeacherAssignment::create([
            'user_id' => $this->bkOld->id,
            'type' => 'kesiswaan',
            'class_id' => $this->class10->id,
            'academic_year' => '2026/2027',
            'is_active' => true,
            'started_at' => now()->subMonths(10),
        ]);

        // 2. Siswa Budi (saat masih di X RPL 1) mengajukan izin dan memiliki catatan presensi KBM di X RPL 1
        Sanctum::actingAs($this->student10);
        $storeLeaveRes = $this->postJson('/api/leave-requests', [
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => '2026-10-15',
            'end_date' => '2026-10-15',
        ]);
        $storeLeaveRes->assertStatus(201);
        $leaveId = $storeLeaveRes->json('data.id');

        // Pastikan snapshot class_id tersimpan
        $this->assertDatabaseHas('leave_requests', [
            'id' => $leaveId,
            'student_id' => $this->student10->id,
            'class_id' => $this->class10->id,
            'academic_year' => '2026/2027',
        ]);

        $journal10 = Journal::create([
            'schedule_id' => $this->schedule10->id,
            'date' => '2026-10-16',
            'status' => 'completed',
        ]);
        $attendance10 = Attendance::create([
            'journal_id' => $journal10->id,
            'student_id' => $this->student10->id,
            'date' => '2026-10-16',
            'status' => 'Hadir',
        ]);

        // 3. Waka mengeksekusi Kenaikan Kelas Massal (promoteClasses)
        Sanctum::actingAs($this->waka);
        $promoteRes = $this->postJson('/api/class-promotions');
        $promoteRes->assertStatus(200)
            ->assertJsonPath('data.deactivated_assignments', 2);

        // Siswa Budi kini berada di XI RPL 1
        $this->assertEquals($this->class11->id, $this->student10->fresh()->class_id);

        // Riwayat kenaikan kelas Budi tercatat di student_class_histories
        $this->assertDatabaseHas('student_class_histories', [
            'student_id' => $this->student10->id,
            'from_class_id' => $this->class10->id,
            'to_class_id' => $this->class11->id,
            'academic_year' => '2026/2027',
            'action_type' => 'promoted',
        ]);

        // Keputusan 6 Opsi B: Seluruh penugasan Wali Kelas & Kesiswaan otomatis dinonaktifkan
        $this->assertFalse($waliAsgn10->fresh()->is_active);
        $this->assertNotNull($waliAsgn10->fresh()->ended_at);
        $this->assertFalse($bkAsgn10->fresh()->is_active);
        $this->assertNotNull($bkAsgn10->fresh()->ended_at);

        // 4. Verifikasi Rekap Historis: Izin & Presensi Budi saat di Kelas X TETAP muncul di filter X RPL 1
        // dan TIDAK bocor ke filter XI RPL 1!
        $leavesClass10 = $this->getJson('/api/leave-requests?class_id=' . $this->class10->id)->json('data');
        $leavesClass11 = $this->getJson('/api/leave-requests?class_id=' . $this->class11->id)->json('data');

        $this->assertContains($leaveId, collect($leavesClass10)->pluck('id')->toArray());
        $this->assertNotContains($leaveId, collect($leavesClass11)->pluck('id')->toArray());

        $attClass10 = $this->getJson('/api/attendances?class_id=' . $this->class10->id)->json('data');
        $attClass11 = $this->getJson('/api/attendances?class_id=' . $this->class11->id)->json('data');

        $this->assertContains($attendance10->id, collect($attClass10)->pluck('id')->toArray());
        $this->assertNotContains($attendance10->id, collect($attClass11)->pluck('id')->toArray());
    }

    /**
     * TC-04: Integritas Nama Verifikator Historis & Akses Verifikator Lama (Keputusan 1 Opsi A)
     * - Setelah Guru BK Lama dicabut dan diganti Guru BK Baru, nama verifikator pada izin yang sudah diproses tetap Guru BK Lama.
     * - Guru BK Lama tetap dapat melihat detail izin yang pernah ia verifikasi sendiri.
     */
    public function test_tc04_historical_verifier_attribution_and_read_access_preserved(): void
    {
        $asgnOld = TeacherAssignment::create([
            'user_id' => $this->bkOld->id,
            'type' => 'kesiswaan',
            'class_id' => $this->class10->id,
            'is_active' => true,
            'started_at' => now()->subMonth(),
        ]);

        // Izin Siswa & Izin Guru diverifikasi oleh BK Lama
        $studentLeave = LeaveRequest::create([
            'student_id' => $this->student10->id,
            'class_id' => $this->class10->id,
            'academic_year' => '2026/2027',
            'applicant_id' => $this->student10->id,
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => '2026-10-12',
            'end_date' => '2026-10-12',
            'status_approval' => 'pending',
        ]);

        $teacherLeave = TeacherLeaveRequest::create([
            'teacher_id' => $this->subjectTeacher->id,
            'schedule_ids' => [$this->schedule10->id],
            'date' => '2026-10-12',
            'reason' => 'Keperluan keluarga mendadak',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->bkOld);
        $this->patchJson("/api/leave-requests/{$studentLeave->id}", ['status' => 'approved'])->assertStatus(200);
        $this->patchJson("/api/teacher-leave-requests/{$teacherLeave->id}/approve")->assertStatus(200);

        // Sekarang Waka mencabut BK Lama dan menggantinya dengan BK Baru
        Sanctum::actingAs($this->waka);
        $this->deleteJson("/api/teachers/{$this->bkOld->id}/assignments/{$asgnOld->id}")->assertStatus(200);
        $this->postJson("/api/teachers/{$this->bkNew->id}/assignments", [
            'type' => 'kesiswaan',
            'class_id' => $this->class10->id,
        ])->assertStatus(201);

        // BK Lama (yang kini sudah tidak punya penugasan aktif) tetap dapat melihat detail izin yang pernah ia verifikasi sendiri
        Sanctum::actingAs($this->bkOld->fresh());
        $showStudentLeave = $this->getJson("/api/leave-requests/{$studentLeave->id}");
        $showStudentLeave->assertStatus(200)
            ->assertJsonPath('data.verified_by', $this->bkOld->id)
            ->assertJsonPath('data.verifier.name', $this->bkOld->name);

        $showTeacherLeave = $this->getJson("/api/teacher-leave-requests/{$teacherLeave->id}");
        $showTeacherLeave->assertStatus(200)
            ->assertJsonPath('data.approved_by.id', $this->bkOld->id)
            ->assertJsonPath('data.approved_by.name', $this->bkOld->name);
    }

    /**
     * TC-05: Handover Pengajuan Izin Pending Saat Pergantian (Keputusan 3 Opsi A)
     * - Izin siswa & izin guru yang masih pending otomatis beralih ke Guru BK Baru.
     * - Guru BK Lama ditolak (403 Forbidden) jika mencoba memprosesnya setelah dicabut.
     */
    public function test_tc05_pending_leave_requests_automatically_handover_to_new_kesiswaan(): void
    {
        $asgnOld = TeacherAssignment::create([
            'user_id' => $this->bkOld->id,
            'type' => 'kesiswaan',
            'class_id' => $this->class10->id,
            'is_active' => true,
            'started_at' => now()->subMonth(),
        ]);

        // Izin siswa & izin guru diajukan saat BK Lama masih menjabat, namun masih PENDING
        $pendingStudentLeave = LeaveRequest::create([
            'student_id' => $this->student10->id,
            'class_id' => $this->class10->id,
            'academic_year' => '2026/2027',
            'applicant_id' => $this->student10->id,
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => Carbon::tomorrow()->toDateString(),
            'end_date' => Carbon::tomorrow()->toDateString(),
            'status_approval' => 'pending',
        ]);

        $pendingTeacherLeave = TeacherLeaveRequest::create([
            'teacher_id' => $this->subjectTeacher->id,
            'schedule_ids' => [$this->schedule10->id],
            'date' => Carbon::tomorrow()->toDateString(),
            'reason' => 'Menghadiri seminar pendidikan',
            'status' => 'pending',
        ]);

        // Terjadi pergantian: BK Lama digantikan oleh BK Baru pada X RPL 1
        Sanctum::actingAs($this->waka);
        $this->postJson("/api/teachers/{$this->bkNew->id}/assignments", [
            'type' => 'kesiswaan',
            'class_id' => $this->class10->id,
            'replace_existing' => true,
        ])->assertStatus(201);

        $this->assertFalse($asgnOld->fresh()->is_active);

        // 1. BK Lama mencoba menyetujui izin pending tersebut -> Wajib Ditolak 403 Forbidden
        Sanctum::actingAs($this->bkOld->fresh());
        $this->patchJson("/api/leave-requests/{$pendingStudentLeave->id}", ['status' => 'approved'])
            ->assertStatus(403);
        $this->patchJson("/api/teacher-leave-requests/{$pendingTeacherLeave->id}/approve")
            ->assertStatus(403);

        // 2. BK Baru melihat dan berhasil menyetujui kedua izin pending tersebut -> 200 OK
        Sanctum::actingAs($this->bkNew->fresh());
        $this->patchJson("/api/leave-requests/{$pendingStudentLeave->id}", ['status' => 'approved'])
            ->assertStatus(200)
            ->assertJsonPath('data.verified_by', $this->bkNew->id);

        $this->patchJson("/api/teacher-leave-requests/{$pendingTeacherLeave->id}/approve")
            ->assertStatus(200)
            ->assertJsonPath('data.approved_by.id', $this->bkNew->id)
            ->assertJsonPath('data.approved_by.name', $this->bkNew->name);
    }

    /**
     * TC-06: Scoping Kesiswaan Berdasarkan Kelas Binaan pada Izin Siswa (Keputusan 4 Opsi A)
     * - Guru BK yang hanya membina X RPL 1 tidak dapat melihat maupun memverifikasi izin siswa XI RPL 1.
     */
    public function test_tc06_kesiswaan_student_leave_scoping_restricted_to_assigned_classes(): void
    {
        TeacherAssignment::create([
            'user_id' => $this->bkOld->id,
            'type' => 'kesiswaan',
            'class_id' => $this->class10->id,
            'is_active' => true,
            'started_at' => now(),
        ]);

        $leave10 = LeaveRequest::create([
            'student_id' => $this->student10->id,
            'class_id' => $this->class10->id,
            'academic_year' => '2026/2027',
            'applicant_id' => $this->student10->id,
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => Carbon::tomorrow()->toDateString(),
            'end_date' => Carbon::tomorrow()->toDateString(),
            'status_approval' => 'pending',
        ]);

        $leave11 = LeaveRequest::create([
            'student_id' => $this->student11->id,
            'class_id' => $this->class11->id,
            'academic_year' => '2026/2027',
            'applicant_id' => $this->student11->id,
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => Carbon::tomorrow()->toDateString(),
            'end_date' => Carbon::tomorrow()->toDateString(),
            'status_approval' => 'pending',
        ]);

        Sanctum::actingAs($this->bkOld);

        // 1. Daftar izin hanya menampilkan siswa dari kelas binaannya (X RPL 1), tidak menampilkan XI RPL 1
        $indexRes = $this->getJson('/api/leave-requests');
        $indexRes->assertStatus(200);
        $ids = collect($indexRes->json('data'))->pluck('id')->toArray();
        $this->assertContains($leave10->id, $ids);
        $this->assertNotContains($leave11->id, $ids);

        // 2. Melihat detail atau memverifikasi izin siswa XI RPL 1 ditolak dengan 403 Forbidden
        $this->getJson("/api/leave-requests/{$leave11->id}")->assertStatus(403);
        $this->patchJson("/api/leave-requests/{$leave11->id}", ['status' => 'approved'])->assertStatus(403);
    }

    /**
     * TC-07: Guru Merangkap Wali Kelas & Kesiswaan (Keputusan 7 Opsi A)
     * - Pencabutan tugas Wali Kelas di X RPL 1 tidak memengaruhi tugas Kesiswaan aktif di XI RPL 1.
     */
    public function test_tc07_revoking_wali_kelas_does_not_affect_active_kesiswaan_assignment(): void
    {
        Sanctum::actingAs($this->waka);

        $waliRes = $this->postJson("/api/teachers/{$this->waliOld->id}/assignments", [
            'type' => 'wali_kelas',
            'class_id' => $this->class10->id,
        ]);
        $waliRes->assertStatus(201);
        $waliAssignmentId = $waliRes->json('data.id');

        $bkRes = $this->postJson("/api/teachers/{$this->waliOld->id}/assignments", [
            'type' => 'kesiswaan',
            'class_id' => $this->class11->id,
        ]);
        $bkRes->assertStatus(201);

        // Cabut hanya tugas Wali Kelas X RPL 1
        $this->deleteJson("/api/teachers/{$this->waliOld->id}/assignments/{$waliAssignmentId}")
            ->assertStatus(200);

        $teacher = $this->waliOld->fresh();
        $this->assertFalse($teacher->isWaliKelas($this->class10->id));
        $this->assertTrue($teacher->isKesiswaan($this->class11->id));
        $this->assertEquals([$this->class11->id], $teacher->getKesiswaanClassIds());
    }
}
