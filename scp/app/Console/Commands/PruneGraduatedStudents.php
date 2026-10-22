<?php

namespace App\Console\Commands;

use App\Models\Attendance;
use App\Models\LeaveRequest;
use App\Models\OtpCode;
use App\Models\QuizSubmission;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Console\Command\Command as SymfonyCommand;

class PruneGraduatedStudents extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'scp:prune-graduated-students';

    /**
     * The console command description.
     */
    protected $description = 'Menghapus permanen (hard delete) akun siswa lulus beserta relasinya tepat 14 hari setelah graduation_date.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $cutoff = now()->subDays(14)->toDateString();

        $students = User::where('role', 'student')
            ->whereNotNull('graduation_date')
            ->where('graduation_date', '<=', $cutoff)
            ->get();

        if ($students->isEmpty()) {
            $this->info("Tidak ada akun siswa lulus yang memenuhi kriteria retensi 14 hari (<= {$cutoff}).");

            return SymfonyCommand::SUCCESS;
        }

        $studentCount = $students->count();
        $parentCount = 0;

        DB::transaction(function () use ($students, &$parentCount) {
            $studentIds = $students->pluck('id')->all();

            // 1. Hapus data kuis siswa
            QuizSubmission::whereIn('student_id', $studentIds)->delete();

            // 2. Hapus presensi siswa
            Attendance::whereIn('student_id', $studentIds)->delete();

            // 3. Hapus perizinan siswa
            LeaveRequest::whereIn('student_id', $studentIds)
                ->orWhereIn('applicant_id', $studentIds)
                ->delete();

            // 4. Hapus data izin legacy jika tabel masih ada
            if (Schema::hasTable('student_permisions')) {
                DB::table('student_permisions')->whereIn('student_id', $studentIds)->delete();
            }

            // 5. Hapus kode OTP siswa
            OtpCode::whereIn('user_id', $studentIds)->delete();

            // 6. Hapus permanen akun orang tua yang terikat ke siswa lulus
            $parents = User::where('role', 'parent')
                ->whereIn('linked_student_id', $studentIds)
                ->get();

            $parentCount = $parents->count();
            foreach ($parents as $parent) {
                OtpCode::where('user_id', $parent->id)->delete();
                $parent->forceDelete();
            }

            // 7. Hapus permanen akun siswa
            foreach ($students as $student) {
                $student->forceDelete();
            }
        });

        $this->info("Pembersihan retensi 14 hari selesai: {$studentCount} siswa dan {$parentCount} orang tua dihapus permanen.");

        return SymfonyCommand::SUCCESS;
    }
}
