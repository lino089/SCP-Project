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
                'students' => User::where('role', 'student')->count(),
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

        // 2. Validasi Relasi Data: Reset Master Data tetap ditolak apabila masih terdapat Data Jadwal yang terhubung
        $activeSchedulesCount = Schedule::whereNull('deleted_at')->count();
        if ($activeSchedulesCount > 0) {
            return response()->json([
                'success' => false,
                'message' => "Reset Master Data ditolak: Masih terdapat {$activeSchedulesCount} data jadwal yang terhubung. Silakan reset Data Jadwal terlebih dahulu sebelum melakukan reset Master Data.",
                'errors' => [
                    'schedules' => ["Masih terdapat {$activeSchedulesCount} data jadwal aktif yang terhubung dengan master data."],
                ],
            ], 409);
        }

        $scope = $request->input('scope', 'all');

        DB::transaction(function () use ($scope) {
            if ($scope === 'all' || $scope === 'students') {
                if (Schema::hasTable('attendances')) DB::table('attendances')->delete();
                if (Schema::hasTable('leave_requests')) DB::table('leave_requests')->delete();
                if (Schema::hasTable('quiz_submissions')) DB::table('quiz_submissions')->delete();
                User::where('role', 'parent')->delete();
                User::where('role', 'student')->delete();
            }

            if ($scope === 'all' || $scope === 'teachers') {
                if (Schema::hasTable('teacher_leave_requests')) DB::table('teacher_leave_requests')->delete();
                if (Schema::hasTable('teacher_assignments')) DB::table('teacher_assignments')->delete();
                if (Schema::hasTable('quiz_questions')) DB::table('quiz_questions')->delete();
                if (Schema::hasTable('ai_quizzes')) DB::table('ai_quizzes')->delete();
                if (Schema::hasTable('quizzes')) DB::table('quizzes')->delete();
                User::where('role', 'teacher')->delete();
            }

            if ($scope === 'all' || $scope === 'classes') {
                Classes::query()->update(['next_class_id' => null]);
                Classes::query()->delete();
            }

            if ($scope === 'all' || $scope === 'rooms') {
                Room::query()->delete();
            }

            if ($scope === 'all' || $scope === 'subjects') {
                Subject::query()->delete();
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
