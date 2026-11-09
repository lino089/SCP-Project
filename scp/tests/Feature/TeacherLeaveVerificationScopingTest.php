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
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeacherLeaveVerificationScopingTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $counselorA;
    private User $counselorB;
    private User $regularTeacher;
    private User $homeroomTeacher;
    private User $unassignedTeacher;

    private Classes $classA;
    private Classes $classB;
    private Classes $classC;

    private Schedule $schedA;
    private Schedule $schedB;
    private Schedule $schedHomeroom;
    private Schedule $schedC;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Waka Kurikulum (Supervisor & Universal Fallback)
        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197501012000011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 2. Guru BK / Kesiswaan Kelas A (Membina X RPL 1)
        $this->counselorA = User::create([
            'name' => 'Candra Rahadian (BK A)',
            'email' => 'bka@example.com',
            'nis_nip' => '198201012006011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 3. Guru BK / Kesiswaan Kelas B (Membina X RPL 2)
        $this->counselorB = User::create([
            'name' => 'Nurhidayat Sulistiawan (BK B)',
            'email' => 'bkb@example.com',
            'nis_nip' => '198301012007011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 4. Guru Pengajar Biasa (Non-Wali Kelas)
        $this->regularTeacher = User::create([
            'name' => 'Guru Mapel Reguler',
            'email' => 'guru.reguler@example.com',
            'nis_nip' => '198801012010011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 5. Guru Wali Kelas (Wali Kelas X RPL 1 yang juga mengajar)
        $this->homeroomTeacher = User::create([
            'name' => 'Guru Wali Kelas A',
            'email' => 'wali.a@example.com',
            'nis_nip' => '198501012008011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 6. Guru Tanpa Penugasan Tambahan
        $this->unassignedTeacher = User::create([
            'name' => 'Guru Tanpa Tugas',
            'email' => 'guru.biasa@example.com',
            'nis_nip' => '199001012015011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // Master Data Kelas
        $this->classA = Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        $this->classB = Classes::create(['name' => 'X RPL 2', 'level' => 10]);
        $this->classC = Classes::create(['name' => 'XI TKJ 1', 'level' => 11]);

        // Penugasan Kesiswaan Berbasis Kelas
        TeacherAssignment::create([
            'user_id' => $this->counselorA->id,
            'type' => 'kesiswaan',
            'class_id' => $this->classA->id,
        ]);

        TeacherAssignment::create([
            'user_id' => $this->counselorB->id,
            'type' => 'kesiswaan',
            'class_id' => $this->classB->id,
        ]);

        // Penugasan Wali Kelas
        TeacherAssignment::create([
            'user_id' => $this->homeroomTeacher->id,
            'type' => 'wali_kelas',
            'class_id' => $this->classA->id,
        ]);

        // Master Data Jadwal KBM
        $room = Rooms::create(['name' => 'Lab RPL 1', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Pemrograman Berorientasi Objek']);

        $this->schedA = Schedule::create([
            'teacher_id' => $this->regularTeacher->id,
            'class_id' => $this->classA->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 3,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->schedB = Schedule::create([
            'teacher_id' => $this->regularTeacher->id,
            'class_id' => $this->classB->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 1,
            'period_number' => 4,
            'duration_periods' => 3,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->schedHomeroom = Schedule::create([
            'teacher_id' => $this->homeroomTeacher->id,
            'class_id' => $this->classA->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 2,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->schedC = Schedule::create([
            'teacher_id' => $this->regularTeacher->id,
            'class_id' => $this->classC->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 3,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);
    }

    /**
     * 1. Guru BK hanya melihat pengajuan dari kelas binaannya di inbox verifikasi.
     */
    public function test_counselor_only_sees_pending_leave_requests_from_their_assigned_class(): void
    {
        $leaveA = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedA->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin mengajar kelas A',
            'status' => 'pending',
        ]);

        $leaveB = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedB->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin mengajar kelas B',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->counselorA);

        $response = $this->getJson('/api/teacher-leave-requests?scope=verification');
        $response->assertStatus(200);

        $data = $response->json('data');
        $ids = collect($data)->pluck('id')->toArray();

        $this->assertContains($leaveA->id, $ids);
        $this->assertNotContains($leaveB->id, $ids);
    }

    /**
     * 2. Guru BK tidak dapat melihat pengajuan yang tidak berkaitan dengan kelas binaannya.
     */
    public function test_counselor_cannot_see_leave_requests_unrelated_to_their_classes(): void
    {
        $leaveB = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedB->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin kelas B saja',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->counselorA);

        $response = $this->getJson('/api/teacher-leave-requests?scope=verification');
        $response->assertStatus(200);

        $ids = collect($response->json('data'))->pluck('id')->toArray();
        $this->assertNotContains($leaveB->id, $ids);

        // Akses endpoint detail (show) juga wajib ditolak HTTP 403
        $this->getJson('/api/teacher-leave-requests/' . $leaveB->id)->assertStatus(403);
    }

    /**
     * 3. Waka Kurikulum dapat melihat seluruh pengajuan izin sesuai kewenangannya.
     */
    public function test_waka_kurikulum_can_see_all_pending_leave_requests_across_school(): void
    {
        $leaveA = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedA->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin Kelas A',
            'status' => 'pending',
        ]);

        $leaveB = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedB->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin Kelas B',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->getJson('/api/teacher-leave-requests?scope=verification');
        $response->assertStatus(200);

        $ids = collect($response->json('data'))->pluck('id')->toArray();
        $this->assertContains($leaveA->id, $ids);
        $this->assertContains($leaveB->id, $ids);
    }

    /**
     * 4. Guru non-wali kelas mengajukan izin dan dapat diverifikasi oleh BK terkait.
     */
    public function test_non_homeroom_teacher_leave_is_verifiable_by_assigned_counselor(): void
    {
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedA->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin sakit flu',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->counselorA);

        $response = $this->patchJson('/api/teacher-leave-requests/' . $leave->id . '/approve');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Pengajuan izin guru berhasil disetujui.',
            ])
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.approved_by.id', $this->counselorA->id);

        $leave->refresh();
        $this->assertEquals('approved', $leave->status);
        $this->assertEquals($this->counselorA->id, $leave->approved_by);
    }

    /**
     * 5. Guru Wali Kelas mengajukan izin dan kewenangannya ditentukan berdasarkan kelas terkait.
     */
    public function test_homeroom_teacher_leave_authority_is_determined_by_schedule_class(): void
    {
        // Wali Kelas A mengajukan izin untuk jam mengajarnya di Kelas A
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->homeroomTeacher->id,
            'schedule_ids' => [$this->schedHomeroom->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin dinas kurikulum',
            'status' => 'pending',
        ]);

        // BK Kelas B ditolak karena bukan kelas binaannya
        Sanctum::actingAs($this->counselorB);
        $this->patchJson('/api/teacher-leave-requests/' . $leave->id . '/approve')
            ->assertStatus(403);

        // BK Kelas A berhasil memverifikasi karena membina Kelas A
        Sanctum::actingAs($this->counselorA);
        $response = $this->patchJson('/api/teacher-leave-requests/' . $leave->id . '/approve');
        $response->assertStatus(200)
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.approved_by.id', $this->counselorA->id);
    }

    /**
     * 6. Guru BK/Kesiswaan mengajukan izin: disetujui oleh sesama Guru Kesiswaan (Peer-Approval)
     *    serta mematuhi Anti-Self-Approval (tidak boleh menyetujui diri sendiri).
     */
    public function test_counselor_applicant_escalates_exclusively_to_waka(): void
    {
        // Counselor A mengajukan izin
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->counselorA->id,
            'schedule_ids' => [],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin tugas dinas kesiswaan',
            'status' => 'pending',
        ]);

        // Counselor A sendiri ditolak saat mencoba menyetujui izinnya sendiri (Anti-Self-Approval)
        Sanctum::actingAs($this->counselorA);
        $this->patchJson('/api/teacher-leave-requests/' . $leave->id . '/approve')
            ->assertStatus(403);

        // Rekan sesama Guru Kesiswaan (Counselor B) berhasil menyetujui izin rekannya
        Sanctum::actingAs($this->counselorB);
        $responseB = $this->patchJson('/api/teacher-leave-requests/' . $leave->id . '/approve');
        $responseB->assertStatus(200)
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.approved_by.id', $this->counselorB->id);
    }

    /**
     * 7. Pengajuan tanpa petugas BK terkait otomatis menggunakan fallback Waka.
     */
    public function test_leave_without_assigned_counselor_falls_back_to_waka(): void
    {
        // Izin mengajar di Kelas C (belum memiliki petugas BK)
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedC->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin mengajar di Kelas C',
            'status' => 'pending',
        ]);

        // BK Kelas A dan BK Kelas B ditolak
        Sanctum::actingAs($this->counselorA);
        $this->patchJson('/api/teacher-leave-requests/' . $leave->id . '/approve')->assertStatus(403);

        Sanctum::actingAs($this->counselorB);
        $this->patchJson('/api/teacher-leave-requests/' . $leave->id . '/approve')->assertStatus(403);

        // Fallback otomatis ke Waka Kurikulum
        Sanctum::actingAs($this->waka);
        $responseWaka = $this->patchJson('/api/teacher-leave-requests/' . $leave->id . '/approve');
        $responseWaka->assertStatus(200)
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.approved_by.id', $this->waka->id);
    }

    /**
     * 8. Pengajuan multi-kelas muncul di seluruh inbox petugas yang berwenang.
     */
    public function test_multi_class_leave_appears_in_all_relevant_counselors_inboxes(): void
    {
        // Guru mengajar di Kelas A dan Kelas B pada hari yang sama
        $multiClassLeave = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedA->id, $this->schedB->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin multi-kelas A dan B',
            'status' => 'pending',
        ]);

        // Muncul di inbox Counselor A
        Sanctum::actingAs($this->counselorA);
        $resA = $this->getJson('/api/teacher-leave-requests?scope=verification');
        $this->assertContains($multiClassLeave->id, collect($resA->json('data'))->pluck('id')->toArray());

        // Muncul di inbox Counselor B
        Sanctum::actingAs($this->counselorB);
        $resB = $this->getJson('/api/teacher-leave-requests?scope=verification');
        $this->assertContains($multiClassLeave->id, collect($resB->json('data'))->pluck('id')->toArray());

        // Muncul di inbox Waka
        Sanctum::actingAs($this->waka);
        $resWaka = $this->getJson('/api/teacher-leave-requests?scope=verification');
        $this->assertContains($multiClassLeave->id, collect($resWaka->json('data'))->pluck('id')->toArray());
    }

    /**
     * 9. Persetujuan oleh satu petugas langsung menjadi keputusan final (First-Responder).
     */
    public function test_first_responder_approval_becomes_final_immediately(): void
    {
        $multiClassLeave = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedA->id, $this->schedB->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin multi-kelas First Responder',
            'status' => 'pending',
        ]);

        // Petugas BK A menjadi First Responder dan menyetujui
        Sanctum::actingAs($this->counselorA);
        $res = $this->patchJson('/api/teacher-leave-requests/' . $multiClassLeave->id . '/approve');
        $res->assertStatus(200)
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.approved_by.id', $this->counselorA->id);

        $multiClassLeave->refresh();
        $this->assertEquals('approved', $multiClassLeave->status);
        $this->assertEquals($this->counselorA->id, $multiClassLeave->approved_by);
        $this->assertNotNull($multiClassLeave->verified_at);
    }

    /**
     * 10. Petugas lain tidak dapat memproses ulang pengajuan yang sudah diputuskan (Idempotency).
     */
    public function test_other_counselor_cannot_reprocess_already_decided_leave(): void
    {
        $multiClassLeave = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedA->id, $this->schedB->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin multi-kelas',
            'status' => 'pending',
        ]);

        // BK A menyetujui lebih dulu
        Sanctum::actingAs($this->counselorA);
        $this->patchJson('/api/teacher-leave-requests/' . $multiClassLeave->id . '/approve')->assertStatus(200);

        // BK B mencoba memproses ulang setelahnya -> ditolak HTTP 422
        Sanctum::actingAs($this->counselorB);
        $responseReject = $this->patchJson('/api/teacher-leave-requests/' . $multiClassLeave->id . '/reject');
        $responseReject->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Status perizinan ini sudah diproses sebelumnya dan tidak dapat diubah lagi.',
            ]);

        $responseApprove = $this->patchJson('/api/teacher-leave-requests/' . $multiClassLeave->id . '/approve');
        $responseApprove->assertStatus(422);

        // Pastikan status database tidak berubah
        $multiClassLeave->refresh();
        $this->assertEquals('approved', $multiClassLeave->status);
        $this->assertEquals($this->counselorA->id, $multiClassLeave->approved_by);
    }

    /**
     * 11. Pengguna tanpa kewenangan ditolak ketika memanggil endpoint verifikasi secara langsung.
     */
    public function test_unauthorized_user_is_forbidden_from_calling_verification_endpoints(): void
    {
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedA->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin kelas A',
            'status' => 'pending',
        ]);

        // Guru biasa tanpa tugas kesiswaan
        Sanctum::actingAs($this->unassignedTeacher);
        $this->patchJson('/api/teacher-leave-requests/' . $leave->id . '/approve')
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Akses ditolak. Hanya Tim Kesiswaan atau Waka Kurikulum yang berhak memverifikasi perizinan guru.',
            ]);

        // Endpoint index verification untuk guru biasa mengembalikan array kosong
        $resIndex = $this->getJson('/api/teacher-leave-requests?scope=verification');
        $resIndex->assertStatus(200);
        $this->assertEmpty($resIndex->json('data'));
    }

    /**
     * 12. Guru BK/Kesiswaan dilarang menyetujui permohonan izin miliknya sendiri (Anti-Self-Approval).
     */
    public function test_counselor_cannot_approve_or_reject_their_own_leave(): void
    {
        $ownLeave = TeacherLeaveRequest::create([
            'teacher_id' => $this->counselorA->id,
            'schedule_ids' => [$this->schedA->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin sendiri',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->counselorA);

        $this->patchJson('/api/teacher-leave-requests/' . $ownLeave->id . '/approve')
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak dapat menyetujui permohonan izin Anda sendiri.',
            ]);

        $this->patchJson('/api/teacher-leave-requests/' . $ownLeave->id . '/reject')
            ->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak dapat menolak permohonan izin Anda sendiri.',
            ]);
    }

    /**
     * 13. Guru Kesiswaan membuka menu pengajuan izin pribadi (scope=mine) hanya melihat riwayat miliknya.
     */
    public function test_counselor_accessing_scope_mine_only_sees_their_own_leave_history(): void
    {
        $ownLeave = TeacherLeaveRequest::create([
            'teacher_id' => $this->counselorA->id,
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin pribadi Counselor A',
            'status' => 'pending',
        ]);

        $otherLeave = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedA->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin guru lain di kelas binaan A',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->counselorA);

        $response = $this->getJson('/api/teacher-leave-requests?scope=mine');
        $response->assertStatus(200);

        $ids = collect($response->json('data'))->pluck('id')->toArray();
        $this->assertContains($ownLeave->id, $ids);
        $this->assertNotContains($otherLeave->id, $ids);
    }
}
