<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Classes;
use App\Models\Journal;
use App\Models\LeaveRequest;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaveAttendanceSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_approving_leave_request_retroactively_updates_completed_journal_attendance(): void
    {
        $waka = User::factory()->create(['role' => 'vice_principal', 'nis_nip' => '197001011990011005']);
        $teacher = User::factory()->create(['role' => 'teacher', 'nis_nip' => '198001012005011005']);
        $class = Classes::create(['name' => 'X PPLG 1', 'level' => '10']);
        $student = User::factory()->create(['role' => 'student', 'class_id' => $class->id, 'nis_nip' => '2001']);

        $room = Room::create(['name' => 'Lab RPL', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Basis Data']);

        $schedule = Schedule::create([
            'cycle_type' => 1,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $teacher->id,
            'class_id' => $class->id,
            'room_id' => $room->id,
            'subject_id' => $subject->id,
            'source' => 'manual',
        ]);

        $journal = Journal::create([
            'schedule_id' => $schedule->id,
            'date' => '2026-11-09',
            'status' => 'completed',
            'topic_description' => 'Materi DDL dan DML',
        ]);

        // 1. Awalnya siswa tercatat 'Alpa' karena izin belum disetujui saat jurnal ditutup
        $attendance = Attendance::create([
            'journal_id' => $journal->id,
            'student_id' => $student->id,
            'date' => '2026-11-09',
            'status' => 'Alpa',
        ]);

        $this->assertEquals('Alpa', $attendance->fresh()->status);

        // 2. Ada pengajuan izin sakit yang statusnya masih 'pending'
        $leave = LeaveRequest::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'academic_year' => '2026/2027',
            'applicant_id' => $student->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-11-09',
            'end_date' => '2026-11-09',
            'status_approval' => 'pending',
        ]);

        // 3. Waka menyetujui izin (P-15 Opsi 1)
        $response = $this->actingAs($waka, 'sanctum')
            ->putJson("/api/leave-requests/{$leave->id}", [
                'status' => 'approved',
            ]);

        $response->assertStatus(200);
        $this->assertEquals('approved', $leave->fresh()->status_approval);

        // 4. Verifikasi status presensi otomatis ter-update menjadi 'Sakit'
        $updatedAttendance = $attendance->fresh();
        $this->assertEquals('Sakit', $updatedAttendance->status);
        $this->assertStringContainsString('Sinkronisasi perizinan', $updatedAttendance->notes);
    }

    public function test_approving_permission_leave_updates_attendance_to_izin(): void
    {
        $waka = User::factory()->create(['role' => 'vice_principal', 'nis_nip' => '197001011990011006']);
        $class = Classes::create(['name' => 'X PPLG 2', 'level' => '10']);
        $student = User::factory()->create(['role' => 'student', 'class_id' => $class->id, 'nis_nip' => '2002']);

        $teacher = User::factory()->create(['role' => 'teacher', 'nis_nip' => '198001012005011006']);
        $room = Room::create(['name' => 'Lab RPL 2', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Algoritma']);

        $schedule = Schedule::create([
            'cycle_type' => 1,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $teacher->id,
            'class_id' => $class->id,
            'room_id' => $room->id,
            'subject_id' => $subject->id,
            'source' => 'manual',
        ]);

        $journal = Journal::create([
            'schedule_id' => $schedule->id,
            'date' => '2026-11-09',
            'status' => 'completed',
            'topic_description' => 'Materi Percabangan',
        ]);

        $attendance = Attendance::create([
            'journal_id' => $journal->id,
            'student_id' => $student->id,
            'date' => '2026-11-09',
            'status' => 'Alpa',
        ]);

        $leave = LeaveRequest::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'academic_year' => '2026/2027',
            'applicant_id' => $student->id,
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => '2026-11-09',
            'end_date' => '2026-11-09',
            'status_approval' => 'pending',
        ]);

        $response = $this->actingAs($waka, 'sanctum')
            ->putJson("/api/leave-requests/{$leave->id}", [
                'status' => 'approved',
            ]);

        $response->assertStatus(200);

        // Kategori selain sakit dipetakan ke 'Izin'
        $this->assertEquals('Izin', $attendance->fresh()->status);
    }
}
