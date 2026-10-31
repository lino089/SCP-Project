<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Rooms;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\TeacherAssignment;
use App\Models\TeacherLeaveRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeacherLeaveRequestTest extends TestCase
{
    use RefreshDatabase;

    private User $teacherA;
    private User $teacherB;
    private User $kesiswaan;
    private User $waka;
    private User $student;
    private Schedule $scheduleA;
    private Schedule $scheduleB;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        // 1. Akun Guru A (Reguler)
        $this->teacherA = User::create([
            'name' => 'Guru A',
            'email' => 'gurua@example.com',
            'nis_nip' => '198001012005011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 2. Akun Guru B (Wali Kelas)
        $this->teacherB = User::create([
            'name' => 'Guru B',
            'email' => 'gurub@example.com',
            'nis_nip' => '198001012005011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 3. Akun Guru Kesiswaan
        $this->kesiswaan = User::create([
            'name' => 'Guru Kesiswaan',
            'email' => 'kesiswaan@example.com',
            'nis_nip' => '198001012005011003',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
        TeacherAssignment::create([
            'user_id' => $this->kesiswaan->id,
            'type' => 'kesiswaan',
        ]);

        // 4. Akun Waka Kurikulum
        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197501012000011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 5. Akun Siswa
        $this->student = User::create([
            'name' => 'Siswa Test',
            'email' => 'siswa@example.com',
            'nis_nip' => '12345',
            'role' => 'student',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // Setup Master Data untuk Jadwal
        $class = Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        $room = Rooms::create(['name' => 'Lab Komputer 1', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Pemrograman Web']);

        $this->scheduleA = Schedule::create([
            'teacher_id' => $this->teacherA->id,
            'class_id' => $class->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->scheduleB = Schedule::create([
            'teacher_id' => $this->teacherB->id,
            'class_id' => $class->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 2,
            'period_number' => 3,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);
    }

    /**
     * 1. Guru dapat mengajukan izin dengan data lengkap dan berkas lampiran.
     */
    public function test_teacher_can_submit_leave_request_with_valid_data(): void
    {
        Sanctum::actingAs($this->teacherA);

        $attachment = UploadedFile::fake()->create('surat_dokter.pdf', 500, 'application/pdf');
        $taskAttachment = UploadedFile::fake()->create('soal_tugas.pdf', 300, 'application/pdf');

        $response = $this->postJson('/api/teacher-leave-requests', [
            'date' => '2026-11-05',
            'reason' => 'Sakit demam dan perlu istirahat dokter',
            'schedule_ids' => [$this->scheduleA->id],
            'attachment' => $attachment,
            'task_instruction' => 'Kerjakan modul latihan bab 3 halaman 45',
            'task_attachment' => $taskAttachment,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Pengajuan izin mengajar berhasil dikirim.',
            ])
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.reason', 'Sakit demam dan perlu istirahat dokter');

        $this->assertDatabaseHas('teacher_leave_requests', [
            'teacher_id' => $this->teacherA->id,
            'date' => '2026-11-05',
            'status' => 'pending',
            'reason' => 'Sakit demam dan perlu istirahat dokter',
        ]);

        $leave = TeacherLeaveRequest::where('teacher_id', $this->teacherA->id)->first();
        $this->assertNotNull($leave->attachment_path);
        $this->assertNotNull($leave->task_attachment_path);
        Storage::disk('public')->assertExists($leave->attachment_path);
        Storage::disk('public')->assertExists($leave->task_attachment_path);
    }

    /**
     * 2. Guru ditolak (422) jika mencoba mengajukan izin untuk jadwal milik guru lain.
     */
    public function test_teacher_cannot_submit_leave_request_with_schedules_of_other_teacher(): void
    {
        Sanctum::actingAs($this->teacherA);

        $response = $this->postJson('/api/teacher-leave-requests', [
            'date' => '2026-11-05',
            'reason' => 'Izin keperluan keluarga',
            'schedule_ids' => [$this->scheduleB->id], // Jadwal milik Guru B
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Anda hanya dapat mengajukan izin untuk jadwal mengajar milik Anda sendiri.',
            ]);
    }

    /**
     * 3. Guru dilarang mengajukan izin duplikat pada tanggal yang sama jika sudah ada izin pending atau approved.
     */
    public function test_teacher_cannot_submit_duplicate_leave_request_for_same_date_if_pending_or_approved(): void
    {
        TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherA->id,
            'date' => '2026-11-05',
            'reason' => 'Izin pertama',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->teacherA);

        $response = $this->postJson('/api/teacher-leave-requests', [
            'date' => '2026-11-05',
            'reason' => 'Izin kedua pada tanggal sama',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Anda sudah memiliki pengajuan izin yang berstatus pending atau disetujui pada tanggal tersebut.',
            ]);
    }

    /**
     * 4. Guru diizinkan mengajukan kembali izin pada tanggal yang sama jika izin sebelumnya berstatus rejected.
     */
    public function test_teacher_can_resubmit_leave_request_for_same_date_if_previously_rejected(): void
    {
        TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherA->id,
            'date' => '2026-11-05',
            'reason' => 'Izin ditolak karena kurang surat dokter',
            'status' => 'rejected',
        ]);

        Sanctum::actingAs($this->teacherA);

        $response = $this->postJson('/api/teacher-leave-requests', [
            'date' => '2026-11-05',
            'reason' => 'Pengajuan ulang dengan surat dokter lengkap',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Pengajuan izin mengajar berhasil dikirim.',
            ]);
    }

    /**
     * 5. Guru biasa hanya melihat daftar pengajuan izin miliknya sendiri di index.
     */
    public function test_teacher_only_sees_their_own_leave_requests_in_index(): void
    {
        $leaveA = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherA->id,
            'date' => '2026-11-05',
            'reason' => 'Izin Guru A',
            'status' => 'pending',
        ]);

        $leaveB = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherB->id,
            'date' => '2026-11-06',
            'reason' => 'Izin Guru B',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->teacherA);

        $response = $this->getJson('/api/teacher-leave-requests');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Daftar pengajuan izin guru berhasil diambil.',
            ]);

        $data = $response->json('data');
        $ids = collect($data)->pluck('id')->toArray();

        $this->assertContains($leaveA->id, $ids);
        $this->assertNotContains($leaveB->id, $ids);
    }

    /**
     * 6. Tim Kesiswaan dan Waka Kurikulum dapat melihat seluruh izin guru dan menggunakan filter.
     */
    public function test_kesiswaan_and_waka_can_see_all_teachers_leave_requests_and_filter(): void
    {
        $leaveA = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherA->id,
            'date' => '2026-11-05',
            'reason' => 'Izin Guru A',
            'status' => 'pending',
        ]);

        $leaveB = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherB->id,
            'date' => '2026-11-06',
            'reason' => 'Izin Guru B',
            'status' => 'approved',
        ]);

        // Uji akses Kesiswaan
        Sanctum::actingAs($this->kesiswaan);

        $responseAll = $this->getJson('/api/teacher-leave-requests');
        $responseAll->assertStatus(200);
        $allIds = collect($responseAll->json('data'))->pluck('id')->toArray();
        $this->assertContains($leaveA->id, $allIds);
        $this->assertContains($leaveB->id, $allIds);

        // Filter berdasarkan teacher_id
        $responseFilterTeacher = $this->getJson('/api/teacher-leave-requests?teacher_id=' . $this->teacherA->id);
        $responseFilterTeacher->assertStatus(200);
        $filteredIds = collect($responseFilterTeacher->json('data'))->pluck('id')->toArray();
        $this->assertContains($leaveA->id, $filteredIds);
        $this->assertNotContains($leaveB->id, $filteredIds);

        // Filter berdasarkan status
        $responseFilterStatus = $this->getJson('/api/teacher-leave-requests?status=approved');
        $responseFilterStatus->assertStatus(200);
        $statusIds = collect($responseFilterStatus->json('data'))->pluck('id')->toArray();
        $this->assertContains($leaveB->id, $statusIds);
        $this->assertNotContains($leaveA->id, $statusIds);

        // Uji akses Waka
        Sanctum::actingAs($this->waka);
        $responseWaka = $this->getJson('/api/teacher-leave-requests');
        $responseWaka->assertStatus(200);
    }

    /**
     * 7. Guru dapat melihat detail izin miliknya dan detail jadwal terkait ter-load.
     */
    public function test_teacher_can_view_own_leave_request_detail_with_schedules(): void
    {
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherA->id,
            'schedule_ids' => [$this->scheduleA->id],
            'date' => '2026-11-05',
            'reason' => 'Izin Guru A',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->teacherA);

        $response = $this->getJson('/api/teacher-leave-requests/' . $leave->id);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $leave->id,
                    'reason' => 'Izin Guru A',
                ],
            ]);

        $this->assertNotEmpty($response->json('data.schedules'));
        $this->assertEquals($this->scheduleA->id, $response->json('data.schedules.0.id'));
    }

    /**
     * 8. Guru dilarang melihat detail izin milik guru lain (HTTP 403).
     */
    public function test_teacher_cannot_view_other_teacher_leave_request_detail(): void
    {
        $leaveB = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherB->id,
            'date' => '2026-11-06',
            'reason' => 'Izin Guru B',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->teacherA);

        $response = $this->getJson('/api/teacher-leave-requests/' . $leaveB->id);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat detail perizinan ini.',
            ]);
    }

    /**
     * 9. Tim Kesiswaan dan Waka Kurikulum dapat melihat detail izin guru manapun.
     */
    public function test_kesiswaan_and_waka_can_view_any_teacher_leave_request_detail(): void
    {
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherA->id,
            'date' => '2026-11-05',
            'reason' => 'Izin Guru A',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->kesiswaan);
        $this->getJson('/api/teacher-leave-requests/' . $leave->id)->assertStatus(200);

        Sanctum::actingAs($this->waka);
        $this->getJson('/api/teacher-leave-requests/' . $leave->id)->assertStatus(200);
    }

    /**
     * 10. Tim Kesiswaan dapat menyetujui pengajuan izin guru (approve).
     */
    public function test_kesiswaan_can_approve_pending_leave_request(): void
    {
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherA->id,
            'date' => '2026-11-05',
            'reason' => 'Izin Guru A',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->kesiswaan);

        $response = $this->patchJson('/api/teacher-leave-requests/' . $leave->id . '/approve');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Pengajuan izin guru berhasil disetujui.',
            ])
            ->assertJsonPath('data.id', $leave->id)
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.approved_by.id', $this->kesiswaan->id);

        $leave->refresh();
        $this->assertEquals('approved', $leave->status);
        $this->assertEquals($this->kesiswaan->id, $leave->approved_by);
        $this->assertNotNull($leave->verified_at);
    }

    /**
     * 11. Waka Kurikulum dapat menolak pengajuan izin guru (reject).
     */
    public function test_waka_can_reject_pending_leave_request(): void
    {
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherA->id,
            'date' => '2026-11-05',
            'reason' => 'Izin Guru A',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->patchJson('/api/teacher-leave-requests/' . $leave->id . '/reject');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Pengajuan izin guru berhasil ditolak.',
            ])
            ->assertJsonPath('data.id', $leave->id)
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.approved_by.id', $this->waka->id);

        $leave->refresh();
        $this->assertEquals('rejected', $leave->status);
        $this->assertEquals($this->waka->id, $leave->approved_by);
        $this->assertNotNull($leave->verified_at);
    }

    /**
     * 12. Guru biasa dan wali kelas ditolak (HTTP 403) jika memanggil endpoint approve atau reject.
     */
    public function test_regular_teacher_cannot_approve_or_reject_leave_request(): void
    {
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherA->id,
            'date' => '2026-11-05',
            'reason' => 'Izin Guru A',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->teacherB);

        $this->patchJson('/api/teacher-leave-requests/' . $leave->id . '/approve')
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Akses ditolak. Hanya Tim Kesiswaan atau Waka Kurikulum yang berhak memverifikasi perizinan guru.',
            ]);

        $this->patchJson('/api/teacher-leave-requests/' . $leave->id . '/reject')
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Akses ditolak. Hanya Tim Kesiswaan atau Waka Kurikulum yang berhak memverifikasi perizinan guru.',
            ]);
    }

    /**
     * 13. Izin yang sudah berstatus approved atau rejected tidak dapat diproses ulang (HTTP 422).
     */
    public function test_already_processed_leave_request_cannot_be_approved_or_rejected_again(): void
    {
        $approvedLeave = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherA->id,
            'date' => '2026-11-05',
            'reason' => 'Izin sudah approved',
            'status' => 'approved',
            'approved_by' => $this->kesiswaan->id,
            'verified_at' => Carbon::now(),
        ]);

        Sanctum::actingAs($this->kesiswaan);

        $this->patchJson('/api/teacher-leave-requests/' . $approvedLeave->id . '/approve')
            ->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Status perizinan ini sudah diproses sebelumnya dan tidak dapat diubah lagi.',
            ]);

        $this->patchJson('/api/teacher-leave-requests/' . $approvedLeave->id . '/reject')
            ->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Status perizinan ini sudah diproses sebelumnya dan tidak dapat diubah lagi.',
            ]);
    }

    /**
     * 14. Pengguna dengan role siswa atau orang tua ditolak (HTTP 403) saat mengakses perizinan guru.
     */
    public function test_student_cannot_access_teacher_leave_requests(): void
    {
        Sanctum::actingAs($this->student);

        $this->getJson('/api/teacher-leave-requests')->assertStatus(403);
        $this->postJson('/api/teacher-leave-requests', ['reason' => 'test'])->assertStatus(403);
    }

    /**
     * 15. Pengguna yang belum login ditolak (HTTP 401).
     */
    public function test_unauthenticated_user_cannot_access_endpoints(): void
    {
        $this->getJson('/api/teacher-leave-requests')->assertStatus(401);
        $this->postJson('/api/teacher-leave-requests', ['reason' => 'test'])->assertStatus(401);
    }

    /**
     * 16. Format payload schedule_ids berupa JSON string pada form-data dapat di-decode dan divalidasi.
     */
    public function test_multipart_schedule_ids_json_string_is_properly_parsed(): void
    {
        Sanctum::actingAs($this->teacherA);

        $response = $this->postJson('/api/teacher-leave-requests', [
            'date' => '2026-11-10',
            'reason' => 'Izin urusan dinas luar',
            'schedule_ids' => json_encode([$this->scheduleA->id]),
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'schedule_ids' => [$this->scheduleA->id],
                ],
            ]);
    }

    /**
     * 17 (S21). Wali kelas yang memiliki jadwal mengajar dapat mengajukan izin mengajar seperti guru biasa.
     */
    public function test_homeroom_teacher_can_also_submit_teaching_leave_request(): void
    {
        TeacherAssignment::create([
            'user_id' => $this->teacherB->id,
            'type' => 'wali_kelas',
            'class_id' => $this->scheduleB->class_id,
        ]);

        Sanctum::actingAs($this->teacherB);

        $response = $this->postJson('/api/teacher-leave-requests', [
            'date' => '2026-11-12',
            'reason' => 'Izin menghadiri bimbingan teknis kurikulum',
            'schedule_ids' => [$this->scheduleB->id],
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Pengajuan izin mengajar berhasil dikirim.',
            ])
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.teacher_id', $this->teacherB->id);

        $this->assertDatabaseHas('teacher_leave_requests', [
            'teacher_id' => $this->teacherB->id,
            'date' => '2026-11-12',
            'status' => 'pending',
        ]);
    }
}
