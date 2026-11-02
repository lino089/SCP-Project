<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Classes;
use App\Models\Journal;
use App\Models\LeaveRequest;
use App\Models\Quiz;
use App\Models\QuizSubmission;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\TeacherAssignment;
use App\Models\TeacherLeaveRequest;
use App\Models\User;
use Illuminate\Support\Facades\Schema;

class MasterDataDependencyService
{
    /**
     * Memeriksa ketergantungan relasi suatu entitas sebelum dihapus.
     *
     * @return array{can_hard_delete: bool, total_dependencies: int, dependencies_count: array<string, int>, summary_text: string}
     */
    public function checkDependencies(string $entity, int $id): array
    {
        $normalizedEntity = $this->normalizeEntity($entity);

        return match ($normalizedEntity) {
            'teacher' => $this->checkTeacherDependencies($id),
            'student' => $this->checkStudentDependencies($id),
            'class' => $this->checkClassDependencies($id),
            'room' => $this->checkRoomDependencies($id),
            'subject' => $this->checkSubjectDependencies($id),
            default => [
                'can_hard_delete' => true,
                'total_dependencies' => 0,
                'dependencies_count' => [],
                'summary_text' => 'Data ini tidak memiliki keterkaitan relasi aktif.',
            ],
        };
    }

    /**
     * Memeriksa apakah entitas memiliki rekam jejak transaksi legal
     * (jurnal KBM, catatan presensi siswa, atau pengerjaan kuis).
     */
    public function hasLegalHistory(string $entity, int $id): bool
    {
        $normalizedEntity = $this->normalizeEntity($entity);

        if ($normalizedEntity === 'teacher' || $normalizedEntity === 'user') {
            $hasJournals = Journal::where(function ($q) use ($id) {
                $q->whereHas('schedule', fn($sq) => $sq->where('teacher_id', $id))
                    ->orWhere('substitute_teacher_id', $id);
            })->exists();

            $hasAttendances = Attendance::whereHas('journal.schedule', fn($sq) => $sq->where('teacher_id', $id))->exists();
            $hasQuizzes = Schema::hasTable('ai_quizzes') && Quiz::where('teacher_id', $id)->exists();

            return $hasJournals || $hasAttendances || $hasQuizzes;
        }

        if ($normalizedEntity === 'student') {
            $hasAttendances = Attendance::where('student_id', $id)->exists();
            $hasSubmissions = Schema::hasTable('quiz_submissions') && QuizSubmission::where('student_id', $id)->exists();
            $hasLeaveRequests = LeaveRequest::where('student_id', $id)->exists();

            return $hasAttendances || $hasSubmissions || $hasLeaveRequests;
        }

        return false;
    }

    private function checkTeacherDependencies(int $teacherId): array
    {
        $counts = [];

        $counts['schedules'] = Schedule::where('teacher_id', $teacherId)->count();

        $counts['journals'] = Journal::where(function ($q) use ($teacherId) {
            $q->whereHas('schedule', fn($sq) => $sq->where('teacher_id', $teacherId))
                ->orWhere('substitute_teacher_id', $teacherId);
        })->count();

        $counts['attendances'] = Attendance::whereHas('journal.schedule', fn($sq) => $sq->where('teacher_id', $teacherId))->count();

        $counts['quizzes'] = Schema::hasTable('ai_quizzes')
            ? Quiz::where('teacher_id', $teacherId)->count()
            : 0;

        $counts['teacher_leave_requests'] = Schema::hasTable('teacher_leave_requests')
            ? TeacherLeaveRequest::where('teacher_id', $teacherId)->count()
            : 0;

        $counts['teacher_assignments'] = Schema::hasTable('teacher_assignments')
            ? TeacherAssignment::where('user_id', $teacherId)->count()
            : 0;

        $labels = [
            'schedules' => 'Jadwal Mengajar',
            'journals' => 'Catatan Jurnal KBM',
            'attendances' => 'Presensi Kelas',
            'quizzes' => 'Kuis Pembelajaran',
            'teacher_leave_requests' => 'Pengajuan Izin',
            'teacher_assignments' => 'Penugasan Tambahan',
        ];

        return $this->buildResult($counts, $labels);
    }

    private function checkStudentDependencies(int $studentId): array
    {
        $counts = [];

        $counts['attendances'] = Attendance::where('student_id', $studentId)->count();
        $counts['leave_requests'] = LeaveRequest::where('student_id', $studentId)->count();
        $counts['quiz_submissions'] = Schema::hasTable('quiz_submissions')
            ? QuizSubmission::where('student_id', $studentId)->count()
            : 0;
        $counts['parent_accounts'] = User::where('linked_student_id', $studentId)->count();

        $labels = [
            'attendances' => 'Catatan Presensi Kehadiran',
            'leave_requests' => 'Pengajuan Izin',
            'quiz_submissions' => 'Pengerjaan Kuis',
            'parent_accounts' => 'Akun Orang Tua Terkait',
        ];

        return $this->buildResult($counts, $labels);
    }

    private function checkClassDependencies(int $classId): array
    {
        $counts = [];

        $counts['students'] = User::where('role', 'student')->where('class_id', $classId)->count();
        $counts['schedules'] = Schedule::where('class_id', $classId)->count();
        $counts['attendances'] = Attendance::whereHas('journal.schedule', fn($sq) => $sq->where('class_id', $classId))->count();
        $counts['quizzes'] = Schema::hasTable('ai_quizzes')
            ? Quiz::where('class_id', $classId)->count()
            : 0;
        $counts['teacher_assignments'] = Schema::hasTable('teacher_assignments')
            ? TeacherAssignment::where('class_id', $classId)->count()
            : 0;

        $labels = [
            'students' => 'Siswa Terdaftar',
            'schedules' => 'Jadwal Pelajaran',
            'attendances' => 'Catatan Presensi Kelas',
            'quizzes' => 'Kuis Kelas',
            'teacher_assignments' => 'Wali Kelas / Penugasan',
        ];

        return $this->buildResult($counts, $labels);
    }

    private function checkRoomDependencies(int $roomId): array
    {
        $counts = [
            'schedules' => Schedule::where('room_id', $roomId)->count(),
        ];

        $labels = [
            'schedules' => 'Jadwal Penggunaan Ruangan',
        ];

        return $this->buildResult($counts, $labels);
    }

    private function checkSubjectDependencies(int $subjectId): array
    {
        $counts = [
            'schedules' => Schedule::where('subject_id', $subjectId)->count(),
            'teachers' => User::where('role', 'teacher')->where('subject_id', $subjectId)->count(),
        ];

        $labels = [
            'schedules' => 'Jadwal Mata Pelajaran',
            'teachers' => 'Guru Pengampu',
        ];

        return $this->buildResult($counts, $labels);
    }

    /**
     * Menyusun format array standar output analisis dependensi.
     */
    private function buildResult(array $counts, array $labels): array
    {
        $total = array_sum($counts);
        $summaryParts = [];

        foreach ($counts as $key => $count) {
            if ($count > 0 && isset($labels[$key])) {
                $summaryParts[] = "{$count} {$labels[$key]}";
            }
        }

        if (empty($summaryParts)) {
            $summaryText = 'Data ini tidak memiliki keterkaitan relasi aktif dan aman untuk dihapus.';
        } else {
            $summaryText = 'Data ini memiliki keterkaitan dengan ' . implode(', ', $summaryParts) . '.';
        }

        return [
            'can_hard_delete' => $total === 0,
            'total_dependencies' => $total,
            'dependencies_count' => $counts,
            'summary_text' => $summaryText,
        ];
    }

    private function normalizeEntity(string $entity): string
    {
        return match (strtolower(trim($entity))) {
            'guru', 'teachers', 'teacher' => 'teacher',
            'siswa', 'students', 'student' => 'student',
            'kelas', 'classes', 'class' => 'class',
            'ruang', 'ruangan', 'rooms', 'room' => 'room',
            'mapel', 'mata-pelajaran', 'subjects', 'subject' => 'subject',
            default => strtolower(trim($entity)),
        };
    }
}
