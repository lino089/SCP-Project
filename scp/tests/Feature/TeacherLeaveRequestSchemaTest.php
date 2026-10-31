<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\TeacherAssignment;
use App\Models\TeacherLeaveRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class TeacherLeaveRequestSchemaTest extends TestCase
{
    use RefreshDatabase;

    private function createTeacher(string $nip = '198001012010011001'): User
    {
        return User::create([
            'name' => 'Guru Pengampu Test',
            'email' => "guru_{$nip}@example.com",
            'nis_nip' => $nip,
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
    }

    public function test_can_create_teacher_leave_request_with_json_schedule_ids(): void
    {
        $teacher = $this->createTeacher();

        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $teacher->id,
            'schedule_ids' => [101, 102, 105],
            'date' => '2026-11-02',
            'reason' => 'Izin sakit demam berdarah',
            'attachment_path' => 'teacher_leaves/letters/surat_dokter.pdf',
            'task_instruction' => 'Kerjakan modul halaman 45-50',
            'task_attachment_path' => 'teacher_leaves/tasks/tugas_bab3.pdf',
        ]);

        $this->assertDatabaseHas('teacher_leave_requests', [
            'id' => $leave->id,
            'teacher_id' => $teacher->id,
            'date' => '2026-11-02',
            'reason' => 'Izin sakit demam berdarah',
            'status' => 'pending',
            'attachment_path' => 'teacher_leaves/letters/surat_dokter.pdf',
            'task_instruction' => 'Kerjakan modul halaman 45-50',
            'task_attachment_path' => 'teacher_leaves/tasks/tugas_bab3.pdf',
        ]);

        $freshLeave = $leave->fresh();
        $this->assertEquals('pending', $freshLeave->status);
        $this->assertIsArray($freshLeave->schedule_ids);
        $this->assertEquals([101, 102, 105], $freshLeave->schedule_ids);
        $this->assertNull($freshLeave->approved_by);
        $this->assertNull($freshLeave->verified_at);
    }

    public function test_teacher_leave_request_relations_work_correctly(): void
    {
        $teacher = $this->createTeacher('198001012010011002');
        $counselor = User::create([
            'name' => 'Guru Kesiswaan',
            'email' => 'kesiswaan@example.com',
            'nis_nip' => '198502022015021003',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $teacher->id,
            'schedule_ids' => [201],
            'date' => '2026-11-03',
            'reason' => 'Dinas luar seminar kurikulum',
            'status' => 'approved',
            'approved_by' => $counselor->id,
            'verified_at' => now(),
        ]);

        $this->assertEquals($teacher->id, $leave->teacher->id);
        $this->assertEquals($counselor->id, $leave->approvedBy->id);
        $this->assertTrue($teacher->teacherLeaveRequests->contains($leave));
    }

    public function test_user_homeroom_class_ids_helper_returns_expected_array(): void
    {
        $teacher = $this->createTeacher('198001012010011003');
        $student = User::create([
            'name' => 'Siswa Test',
            'email' => 'siswa@example.com',
            'nis_nip' => '12345678',
            'role' => 'student',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $class1 = Classes::create(['name' => 'X-RPL-1', 'level' => '10']);
        $class2 = Classes::create(['name' => 'X-RPL-2', 'level' => '10']);

        // Guru belum punya assignment -> harus mengembalikan []
        $this->assertEquals([], $teacher->homeroomClassIds());

        // Berikan assignment wali kelas pada class1 dan class2
        TeacherAssignment::create([
            'user_id' => $teacher->id,
            'type' => 'wali_kelas',
            'class_id' => $class1->id,
        ]);
        TeacherAssignment::create([
            'user_id' => $teacher->id,
            'type' => 'wali_kelas',
            'class_id' => $class2->id,
        ]);
        // Dan assignment kesiswaan (tanpa class_id)
        TeacherAssignment::create([
            'user_id' => $teacher->id,
            'type' => 'kesiswaan',
            'class_id' => null,
        ]);

        $this->assertEquals([$class1->id, $class2->id], $teacher->fresh()->homeroomClassIds());

        // Siswa tidak boleh mengembalikan class ID meskipun punya relasi
        $this->assertEquals([], $student->homeroomClassIds());
    }

    public function test_teacher_relation_with_soft_deleted_user(): void
    {
        $teacher = $this->createTeacher('198001012010011004');

        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $teacher->id,
            'schedule_ids' => [301],
            'date' => '2026-11-04',
            'reason' => 'Izin keluarga',
        ]);

        // Soft delete teacher
        $teacher->delete();
        $this->assertSoftDeleted('users', ['id' => $teacher->id]);

        // Karena relasi teacher() memakai withTrashed(), data guru tetap dapat diakses
        $this->assertNotNull($leave->fresh()->teacher);
        $this->assertEquals($teacher->id, $leave->fresh()->teacher->id);
    }

    public function test_null_on_delete_when_approver_is_hard_deleted(): void
    {
        $teacher = $this->createTeacher('198001012010011005');
        $approver = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011995011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $teacher->id,
            'date' => '2026-11-05',
            'reason' => 'Izin keperluan keluarga',
            'status' => 'approved',
            'approved_by' => $approver->id,
            'verified_at' => now(),
        ]);

        $this->assertEquals($approver->id, $leave->fresh()->approved_by);

        // Force delete approver
        $approver->forceDelete();

        // foreign key constraint nullOnDelete harus membuat approved_by menjadi null
        $this->assertNull($leave->fresh()->approved_by);
    }
}
