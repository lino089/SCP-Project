<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classes;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class MasterDataSummaryController extends Controller
{
    /**
     * Mendapatkan statistik ringkas jumlah entitas master data.
     * Digunakan untuk inisialisasi badge tab dan verifikasi prasyarat secara instan (~2ms).
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Ringkasan master data berhasil diambil.',
            'data' => [
                'classes' => Classes::count(),
                'rooms' => Room::count(),
                'subjects' => Subject::count(),
                'teachers' => User::where('role', 'teacher')->count(),
                'students' => User::where('role', 'student')->whereNull('graduation_date')->whereNotNull('class_id')->count(),
                'alumni' => User::where('role', 'student')->whereNotNull('graduation_date')->count(),
                'schedules' => Schedule::count(),
            ],
        ], 200);
    }

    /**
     * Reset seluruh Master Data sekolah (Keamanan Reset Data / PRD 6.4).
     * POST /api/master-data/reset
     *
     * Alur:
     * 1. Verifikasi Password pengguna di Backend (Step-Up Auth)
     * 2. Validasi Relasi Data: Reset Master Data ditolak jika masih ada Data Jadwal terhubung
     * 3. Eksekusi reset aman via DB::transaction
     */
    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
            'scope' => 'nullable|string|in:all,classes,rooms,subjects,teachers,students',
        ]);

        // 1. Verifikasi Password di Backend
        if ($error = $this->passwordIsConfirmed($request)) {
            return $error;
        }

        // 2. Validasi Relasi Data: Reset Master Data ditolak jika masih terdapat data Jadwal di sistem
        $existingSchedulesCount = Schedule::withTrashed()->count();
        if ($existingSchedulesCount > 0) {
            return response()->json([
                'success' => false,
                'message' => "Reset Master Data ditolak: Masih terdapat {$existingSchedulesCount} data jadwal yang terhubung. Silakan reset Data Jadwal terlebih dahulu sebelum melakukan reset Master Data.",
                'errors' => [
                    'schedules' => ["Masih terdapat {$existingSchedulesCount} data jadwal (aktif/riwayat) yang terhubung dengan master data."],
                ],
            ], 409);
        }

        $scope = $request->input('scope', 'all');

        DB::transaction(function () use ($scope) {
            // A. Siswa & Orang Tua (Hard Delete)
            if ($scope === 'all' || $scope === 'students') {
                $studentUserIds = User::whereIn('role', ['student', 'parent'])->withTrashed()->pluck('id')->all();

                if (!empty($studentUserIds)) {
                    if (Schema::hasTable('attendances')) {
                        DB::table('attendances')->whereIn('student_id', $studentUserIds)->delete();
                    }
                    if (Schema::hasTable('leave_requests')) {
                        DB::table('leave_requests')
                            ->whereIn('student_id', $studentUserIds)
                            ->orWhereIn('applicant_id', $studentUserIds)
                            ->delete();
                    }
                    if (Schema::hasTable('quiz_submissions')) {
                        DB::table('quiz_submissions')->whereIn('student_id', $studentUserIds)->delete();
                    }
                    if (Schema::hasTable('otp_codes')) {
                        DB::table('otp_codes')->whereIn('user_id', $studentUserIds)->delete();
                    }
                    if (Schema::hasTable('personal_access_tokens')) {
                        DB::table('personal_access_tokens')
                            ->where('tokenable_type', User::class)
                            ->whereIn('tokenable_id', $studentUserIds)
                            ->delete();
                    }

                    // Hapus permanen orang tua & siswa dari database
                    User::where('role', 'parent')->withTrashed()->forceDelete();
                    User::where('role', 'student')->withTrashed()->forceDelete();
                }
            }

            // B. Guru (Hard Delete, kecuali Waka vice_principal)
            if ($scope === 'all' || $scope === 'teachers') {
                $teacherUserIds = User::where('role', 'teacher')->withTrashed()->pluck('id')->all();

                if (!empty($teacherUserIds)) {
                    if (Schema::hasTable('teacher_leave_requests')) {
                        DB::table('teacher_leave_requests')
                            ->whereIn('teacher_id', $teacherUserIds)
                            ->orWhereIn('approved_by', $teacherUserIds)
                            ->delete();
                    }
                    if (Schema::hasTable('teacher_assignments')) {
                        DB::table('teacher_assignments')->whereIn('user_id', $teacherUserIds)->delete();
                    }
                    if (Schema::hasTable('ai_quizzes')) {
                        $quizIds = DB::table('ai_quizzes')->whereIn('teacher_id', $teacherUserIds)->pluck('id')->all();
                        if (!empty($quizIds)) {
                            if (Schema::hasTable('quiz_questions')) {
                                DB::table('quiz_questions')->whereIn('quiz_id', $quizIds)->delete();
                            }
                            if (Schema::hasTable('quiz_submissions')) {
                                DB::table('quiz_submissions')->whereIn('quiz_id', $quizIds)->delete();
                            }
                            DB::table('ai_quizzes')->whereIn('id', $quizIds)->delete();
                        }
                    }
                    if (Schema::hasTable('quizzes')) {
                        DB::table('quizzes')->whereIn('teacher_id', $teacherUserIds)->delete();
                    }
                    if (Schema::hasTable('journals')) {
                        DB::table('journals')->whereIn('substitute_teacher_id', $teacherUserIds)->update(['substitute_teacher_id' => null]);
                    }
                    if (Schema::hasTable('schedule_import_rows')) {
                        DB::table('schedule_import_rows')->whereIn('matched_teacher_id', $teacherUserIds)->update(['matched_teacher_id' => null]);
                    }
                    if (Schema::hasTable('otp_codes')) {
                        DB::table('otp_codes')->whereIn('user_id', $teacherUserIds)->delete();
                    }
                    if (Schema::hasTable('personal_access_tokens')) {
                        DB::table('personal_access_tokens')
                            ->where('tokenable_type', User::class)
                            ->whereIn('tokenable_id', $teacherUserIds)
                            ->delete();
                    }

                    User::where('role', 'teacher')->update(['subject_id' => null]);
                    User::where('role', 'teacher')->withTrashed()->forceDelete();
                }
            }

            // C. Kelas Rombel (Hard Delete)
            if ($scope === 'all' || $scope === 'classes') {
                Classes::query()->update(['next_class_id' => null]);
                User::whereNotNull('class_id')->update(['class_id' => null]);

                if (Schema::hasTable('teacher_assignments')) {
                    DB::table('teacher_assignments')->whereNotNull('class_id')->delete();
                }
                if (Schema::hasTable('schedule_import_rows')) {
                    DB::table('schedule_import_rows')->whereNotNull('matched_class_id')->update(['matched_class_id' => null]);
                }

                Classes::withTrashed()->forceDelete();
            }

            // D. Ruangan (Hard Delete)
            if ($scope === 'all' || $scope === 'rooms') {
                if (Schema::hasTable('schedule_import_rows')) {
                    DB::table('schedule_import_rows')->whereNotNull('matched_room_id')->update(['matched_room_id' => null]);
                }
                Room::withTrashed()->forceDelete();
            }

            // E. Mata Pelajaran (Hard Delete)
            if ($scope === 'all' || $scope === 'subjects') {
                User::whereNotNull('subject_id')->update(['subject_id' => null]);

                if (Schema::hasTable('schedule_import_rows')) {
                    DB::table('schedule_import_rows')->whereNotNull('matched_subject_id')->update(['matched_subject_id' => null]);
                }
                Subject::withTrashed()->forceDelete();
            }
        });

        return response()->json([
            'success' => true,
            'message' => $scope === 'all'
                ? 'Seluruh Master Data (kelas, ruang, mapel, guru, dan siswa) berhasil di-reset.'
                : "Master Data {$scope} berhasil di-reset.",
            'data' => null,
        ], 200);
    }
}
