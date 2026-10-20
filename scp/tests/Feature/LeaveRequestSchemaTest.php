<?php

namespace Tests\Feature;

use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LeaveRequestSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_leave_request_tidak_masuk_and_keluar_sekolah(): void
    {
        $student = User::create([
            'name' => 'Siswa Test',
            'email' => 'siswa@example.com',
            'nis_nip' => '12345678',
            'role' => 'student',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $parent = User::create([
            'name' => 'Wali Siswa Test',
            'email' => 'ortu@example.com',
            'nis_nip' => 'P-12345678',
            'role' => 'parent',
            'linked_student_id' => $student->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 1. Leave Request: tidak_masuk (sakit, multi-hari) diajukan orang tua
        $leave1 = LeaveRequest::create([
            'student_id' => $student->id,
            'applicant_id' => $parent->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-10-20',
            'end_date' => '2026-10-22',
            'status_approval' => 'pending',
            'document_path' => 'leaves/surat_dokter.pdf',
        ]);

        $this->assertDatabaseHas('leave_requests', [
            'id' => $leave1->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'status_approval' => 'pending',
        ]);
        $this->assertEquals('pending', $leave1->status);
        $this->assertEquals($student->id, $leave1->student->id);
        $this->assertEquals($parent->id, $leave1->applicant->id);

        // 2. Leave Request: keluar_sekolah (lainnya, same-day) diajukan siswa
        $leave2 = LeaveRequest::create([
            'student_id' => $student->id,
            'applicant_id' => $student->id,
            'type' => 'keluar_sekolah',
            'category' => 'lainnya',
            'departure_time' => '10:00:00',
            'expected_return_time' => '12:00:00',
            'status_approval' => 'approved',
            'verified_by' => $parent->id,
            'verified_at' => now(),
        ]);

        $this->assertDatabaseHas('leave_requests', [
            'id' => $leave2->id,
            'type' => 'keluar_sekolah',
            'departure_time' => '10:00:00',
            'status_approval' => 'approved',
        ]);
    }
}
