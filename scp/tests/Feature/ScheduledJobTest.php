<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Classes;
use App\Models\Journal;
use App\Models\LeaveRequest;
use App\Models\OtpCode;
use App\Models\Quiz;
use App\Models\QuizSubmission;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ScheduledJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_prune_graduated_students_hard_deletes_students_and_relations_after_14_days(): void
    {
        $class = Classes::create(['name' => 'XII RPL 1', 'level' => '12']);

        // Siswa lulus 15 hari yang lalu (> 14 hari)
        $student = User::factory()->create([
            'role' => 'student',
            'nis_nip' => '11223344',
            'class_id' => $class->id,
            'graduation_date' => now()->subDays(15)->toDateString(),
        ]);

        // Orang tua terikat
        $parent = User::factory()->create([
            'role' => 'parent',
            'nis_nip' => '99887766',
            'linked_student_id' => $student->id,
        ]);

        // Guru dan jadwal
        $teacher = User::factory()->create(['role' => 'teacher', 'nis_nip' => 'GURU001']);
        $subject = Subject::create(['name' => 'Pemrograman Web']);
        $room = Room::create(['name' => 'Lab RPL 1', 'capacity' => 36]);
        $schedule = Schedule::create([
            'class_id' => $class->id,
            'teacher_id' => $teacher->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 'senin',
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => '1',
            'source' => 'manual',
        ]);

        // Relasi jurnal & presensi
        $journal = Journal::create([
            'schedule_id' => $schedule->id,
            'date' => now()->subDays(20)->toDateString(),
            'status' => 'completed',
        ]);
        $attendance = Attendance::create([
            'journal_id' => $journal->id,
            'student_id' => $student->id,
            'date' => now()->subDays(20)->toDateString(),
            'status' => 'Hadir',
        ]);

        // Relasi perizinan
        $leaveRequest = LeaveRequest::create([
            'student_id' => $student->id,
            'applicant_id' => $student->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => now()->subDays(30)->toDateString(),
            'end_date' => now()->subDays(29)->toDateString(),
            'reason' => 'Demam berdarah',
            'status' => 'approved',
        ]);

        // Relasi kuis & submission
        $quiz = Quiz::create([
            'teacher_id' => $teacher->id,
            'class_id' => $class->id,
            'title' => 'Ujian Akhir Kelulusan',
            'status' => 'published',
            'total_questions' => 1,
            'question_types' => 'essay',
            'essay_count' => 1,
            'mc_count' => 0,
            'due_date' => now()->subDays(16),
            'max_attempts' => 1,
        ]);

        $submission = QuizSubmission::create([
            'quiz_id' => $quiz->id,
            'student_id' => $student->id,
            'attempt_number' => 1,
            'answers_payload' => ['1' => 'Jawaban siswa'],
            'grading_status' => 'graded',
            'ai_score' => 90.0,
        ]);

        // Kode OTP siswa & ortu
        OtpCode::create([
            'user_id' => $student->id,
            'target' => 'siswa@example.com',
            'code' => '123456',
            'purpose' => 'email',
            'expires_at' => now()->addMinutes(10),
        ]);

        OtpCode::create([
            'user_id' => $parent->id,
            'target' => 'ortu@example.com',
            'code' => '654321',
            'purpose' => 'email',
            'expires_at' => now()->addMinutes(10),
        ]);

        // Jalankan perintah Artisan
        $this->artisan('scp:prune-graduated-students')
            ->expectsOutputToContain('Pembersihan retensi 14 hari selesai: 1 siswa dan 1 orang tua dihapus permanen.')
            ->assertExitCode(0);

        // Verifikasi hard delete: tidak ada di database, bahkan dengan withTrashed
        $this->assertNull(User::withTrashed()->find($student->id));
        $this->assertNull(User::withTrashed()->find($parent->id));
        $this->assertDatabaseMissing('attendances', ['id' => $attendance->id]);
        $this->assertDatabaseMissing('leave_requests', ['id' => $leaveRequest->id]);
        $this->assertDatabaseMissing('quiz_submissions', ['id' => $submission->id]);
        $this->assertDatabaseMissing('otp_codes', ['user_id' => $student->id]);
        $this->assertDatabaseMissing('otp_codes', ['user_id' => $parent->id]);
    }

    public function test_prune_graduated_students_does_not_delete_recent_graduates_or_active_students(): void
    {
        $class = Classes::create(['name' => 'XII RPL 2', 'level' => '12']);

        // Siswa baru lulus 10 hari yang lalu (belum melewati retensi 14 hari)
        $recentGraduate = User::factory()->create([
            'role' => 'student',
            'nis_nip' => '33445566',
            'class_id' => $class->id,
            'graduation_date' => now()->subDays(10)->toDateString(),
        ]);

        $parentGraduate = User::factory()->create([
            'role' => 'parent',
            'nis_nip' => '77665544',
            'linked_student_id' => $recentGraduate->id,
        ]);

        // Siswa aktif (tanpa graduation_date)
        $activeStudent = User::factory()->create([
            'role' => 'student',
            'nis_nip' => '55667788',
            'class_id' => $class->id,
            'graduation_date' => null,
        ]);

        $this->artisan('scp:prune-graduated-students')
            ->assertExitCode(0);

        // Kedua siswa dan orang tua tetap utuh
        $this->assertNotNull(User::find($recentGraduate->id));
        $this->assertNotNull(User::find($parentGraduate->id));
        $this->assertNotNull(User::find($activeStudent->id));
    }

    public function test_prune_expired_otps_deletes_only_expired_codes(): void
    {
        $user = User::factory()->create([
            'role' => 'student',
            'nis_nip' => '99881122',
        ]);

        // OTP kedaluwarsa
        $expiredOtp = OtpCode::create([
            'user_id' => $user->id,
            'target' => 'expired@example.com',
            'code' => '111111',
            'purpose' => 'email',
            'expires_at' => now()->subMinutes(5),
        ]);

        // OTP masih aktif
        $activeOtp = OtpCode::create([
            'user_id' => $user->id,
            'target' => 'active@example.com',
            'code' => '222222',
            'purpose' => 'email',
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->artisan('scp:prune-expired-otps')
            ->expectsOutputToContain('Berhasil membersihkan 1 kode OTP kedaluwarsa.')
            ->assertExitCode(0);

        $this->assertDatabaseMissing('otp_codes', ['id' => $expiredOtp->id]);
        $this->assertDatabaseHas('otp_codes', ['id' => $activeOtp->id]);
    }
}
