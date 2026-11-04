<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Rooms;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\TeacherAssignment;
use App\Models\TeacherLeaveRequest;
use App\Models\User;
use App\Services\TeacherLeaveAuthorityResolver;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class TeacherLeaveAuthorityResolverTest extends TestCase
{
    use RefreshDatabase;

    private TeacherLeaveAuthorityResolver $resolver;
    private User $waka;
    private User $counselorA;
    private User $counselorB;
    private User $regularTeacher;
    private Classes $classA;
    private Classes $classB;
    private Schedule $schedA;
    private Schedule $schedB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resolver = new TeacherLeaveAuthorityResolver();

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->counselorA = User::create([
            'name' => 'Guru BK A',
            'email' => 'bka@example.com',
            'nis_nip' => '198501012010011010',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->counselorB = User::create([
            'name' => 'Guru BK B',
            'email' => 'bkb@example.com',
            'nis_nip' => '198501012010011011',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->regularTeacher = User::create([
            'name' => 'Guru Reguler Pengajar',
            'email' => 'reguler@example.com',
            'nis_nip' => '198501012010011012',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->classA = Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        $this->classB = Classes::create(['name' => 'X AK 1', 'level' => 10]);

        // Counselor A membina Kelas A, Counselor B membina Kelas B
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

        $room = Rooms::create(['name' => 'Ruang 101', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Dasar Program']);

        $this->schedA = Schedule::create([
            'teacher_id' => $this->regularTeacher->id,
            'class_id' => $this->classA->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->schedB = Schedule::create([
            'teacher_id' => $this->regularTeacher->id,
            'class_id' => $this->classB->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 1,
            'period_number' => 3,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);
    }

    public function test_kesiswaan_applicant_escalates_exclusively_to_waka(): void
    {
        // Guru Kesiswaan A mengajukan izin
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->counselorA->id,
            'schedule_ids' => [],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin Dinas Pelatihan BK',
            'status' => 'pending',
        ]);

        $approverIds = $this->resolver->getAuthorizedApproverIds($leave);

        // 1. Approver hanya Waka Kurikulum
        $this->assertContains($this->waka->id, $approverIds);
        // 2. Anti-Self-Approval: Pemohon (Counselor A) TIDAK BOLEH ada di daftar
        $this->assertNotContains($this->counselorA->id, $approverIds);
        // 3. Rekan sesama kesiswaan (Counselor B) TIDAK BOLEH menyetujui izin rekannya
        $this->assertNotContains($this->counselorB->id, $approverIds);

        $this->assertTrue($this->resolver->canUserApprove($this->waka, $leave));
        $this->assertFalse($this->resolver->canUserApprove($this->counselorA, $leave));
        $this->assertFalse($this->resolver->canUserApprove($this->counselorB, $leave));
    }

    public function test_regular_teacher_with_single_class_schedule_assigned_to_counselor_a_and_waka(): void
    {
        // Guru biasa mengajukan izin untuk jam di Kelas A saja
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedA->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Sakit Demam',
            'status' => 'pending',
        ]);

        $approverIds = $this->resolver->getAuthorizedApproverIds($leave);

        // Counselor A (pembina Kelas A) dan Waka Kurikulum berwenang
        $this->assertContains($this->counselorA->id, $approverIds);
        $this->assertContains($this->waka->id, $approverIds);
        // Counselor B (pembina Kelas B) TIDAK berwenang karena guru tidak mengajar di Kelas B
        $this->assertNotContains($this->counselorB->id, $approverIds);
        // Guru pemohon tidak ada di list
        $this->assertNotContains($this->regularTeacher->id, $approverIds);

        $this->assertTrue($this->resolver->canUserApprove($this->counselorA, $leave));
        $this->assertTrue($this->resolver->canUserApprove($this->waka, $leave));
        $this->assertFalse($this->resolver->canUserApprove($this->counselorB, $leave));
    }

    public function test_regular_teacher_with_multi_class_schedule_assigned_to_both_counselors(): void
    {
        // Guru biasa mengajukan izin mencakup Kelas A dan Kelas B pada hari yang sama
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedA->id, $this->schedB->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Urusan Keluarga',
            'status' => 'pending',
        ]);

        $approverIds = $this->resolver->getAuthorizedApproverIds($leave);

        // Kedua Guru BK (A dan B) serta Waka Kurikulum berwenang
        $this->assertContains($this->counselorA->id, $approverIds);
        $this->assertContains($this->counselorB->id, $approverIds);
        $this->assertContains($this->waka->id, $approverIds);

        $this->assertTrue($this->resolver->canUserApprove($this->counselorA, $leave));
        $this->assertTrue($this->resolver->canUserApprove($this->counselorB, $leave));
        $this->assertTrue($this->resolver->canUserApprove($this->waka, $leave));
    }

    public function test_teacher_leave_without_schedule_falls_back_to_waka(): void
    {
        // Guru izin tanpa jadwal spesifik
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin Dinas Luar Umum',
            'status' => 'pending',
        ]);

        $approverIds = $this->resolver->getAuthorizedApproverIds($leave);

        // Fallback otomatis ke Waka Kurikulum
        $this->assertCount(1, $approverIds);
        $this->assertContains($this->waka->id, $approverIds);
        $this->assertTrue($this->resolver->canUserApprove($this->waka, $leave));
        $this->assertFalse($this->resolver->canUserApprove($this->counselorA, $leave));
    }

    public function test_scope_pending_requests_for_user_filters_correctly(): void
    {
        // Leave 1: Guru mengajar di Kelas A
        $leave1 = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedA->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin Kelas A',
            'status' => 'pending',
        ]);

        // Leave 2: Guru mengajar di Kelas B
        $leave2 = TeacherLeaveRequest::create([
            'teacher_id' => $this->regularTeacher->id,
            'schedule_ids' => [$this->schedB->id],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin Kelas B',
            'status' => 'pending',
        ]);

        // Leave 3: Guru Kesiswaan A mengajukan izin
        $leave3 = TeacherLeaveRequest::create([
            'teacher_id' => $this->counselorA->id,
            'schedule_ids' => [],
            'date' => Carbon::now()->toDateString(),
            'reason' => 'Izin Guru Kesiswaan',
            'status' => 'pending',
        ]);

        // 1. Waka Kurikulum dapat melihat seluruh pengajuan
        $wakaQuery = $this->resolver->scopePendingRequestsForUser(TeacherLeaveRequest::query(), $this->waka);
        $wakaLeaves = $wakaQuery->pluck('id')->toArray();
        $this->assertContains($leave1->id, $wakaLeaves);
        $this->assertContains($leave2->id, $wakaLeaves);
        $this->assertContains($leave3->id, $wakaLeaves);

        // 2. Counselor A hanya dapat melihat Leave 1 (Kelas A), tidak melihat Leave 2 (Kelas B) atau Leave 3 (Kesiswaan)
        $counselorAQuery = $this->resolver->scopePendingRequestsForUser(TeacherLeaveRequest::query(), $this->counselorA);
        $counselorALeaves = $counselorAQuery->pluck('id')->toArray();
        $this->assertContains($leave1->id, $counselorALeaves);
        $this->assertNotContains($leave2->id, $counselorALeaves);
        $this->assertNotContains($leave3->id, $counselorALeaves);

        // 3. Counselor B hanya dapat melihat Leave 2 (Kelas B)
        $counselorBQuery = $this->resolver->scopePendingRequestsForUser(TeacherLeaveRequest::query(), $this->counselorB);
        $counselorBLeaves = $counselorBQuery->pluck('id')->toArray();
        $this->assertNotContains($leave1->id, $counselorBLeaves);
        $this->assertContains($leave2->id, $counselorBLeaves);
        $this->assertNotContains($leave3->id, $counselorBLeaves);

        // 4. Guru reguler tidak dapat melihat apa pun
        $regQuery = $this->resolver->scopePendingRequestsForUser(TeacherLeaveRequest::query(), $this->regularTeacher);
        $this->assertEquals(0, $regQuery->count());
    }
}
