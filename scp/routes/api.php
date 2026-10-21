<?php

use App\Http\Controllers\API\AcademicSettingController;
use App\Http\Controllers\API\AttendanceController;
use App\Http\Controllers\API\AttendanceWarningController;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\JournalController;
use App\Http\Controllers\API\LeaveRequestController;
use App\Http\Controllers\API\QuizController;
use App\Http\Controllers\API\ReportController;
use App\Http\Controllers\API\RoomController;
use App\Http\Controllers\API\ScheduleController;
use App\Http\Controllers\API\ScheduleImportController;
use App\Http\Controllers\API\SchoolClassController;
use App\Http\Controllers\API\StudentController;
use App\Http\Controllers\API\StudentPermisionController;
use App\Http\Controllers\API\SubjectController;
use App\Http\Controllers\API\SubstituteAssignmentController;
use App\Http\Controllers\API\TeacherController;
use Illuminate\Support\Facades\Route;

Route::get('/ping', function () {
    return response()->json([
        'success' => true,
        'message' => 'Backend SCP berhasil Merespon',
        'data' => [
            'waktu_sekarang' => now()->toDateTimeString()
        ]
    ]);
});

Route::post('/login', [AuthController::class, 'login']);

Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Master Data Read (Auth - Semua Role Terautentikasi: PRD 9.3 & 9.6)
    Route::get('/classes', [SchoolClassController::class, 'index']);
    Route::get('/rooms', [RoomController::class, 'index']);
    Route::get('/subjects', [SubjectController::class, 'index']);
    Route::get('/teachers', [TeacherController::class, 'index']);
    Route::get('/students', [StudentController::class, 'index']);
    Route::get('/schedules', [ScheduleController::class, 'index']);
    Route::get('/attendances', [AttendanceController::class, 'index']);

    // 9.6 Perizinan Siswa (Leave Requests)
    Route::get('/leave-requests', [LeaveRequestController::class, 'index']);
    Route::get('/leave-requests/{id}', [LeaveRequestController::class, 'show']);
    Route::patch('/leave-requests/{id}', [LeaveRequestController::class, 'update']);

    // 1. Khusus Waka Kurikulum (Setting Akademik & Mutasi Master Data: PRD 9.2 & 9.3)
    Route::middleware('role:vice_principal')->group(function () {
        Route::get('/waka-only', function () {
            return response()->json([
                'success' => true,
                'message' => 'Selamat datang waka kurikulum'
            ]);
        });

        // 9.2 Setting Akademik & Riwayat
        Route::get('/academic-settings', [AcademicSettingController::class, 'index']);
        Route::patch('/academic-settings', [AcademicSettingController::class, 'updateCycle']);
        Route::patch('/academic-settings/monday-status', [AcademicSettingController::class, 'updateMondayStatus']);
        Route::get('/cycle-history', [AcademicSettingController::class, 'cycleHistory']);
        Route::get('/academic-settings/cycle-history', [AcademicSettingController::class, 'cycleHistory']);

        // 9.3 Master Data Classes
        Route::post('/classes', [SchoolClassController::class, 'store']);
        Route::put('/classes/{id}', [SchoolClassController::class, 'update']);
        Route::delete('/classes/{id}', [SchoolClassController::class, 'destroy']);
        Route::post('/class-promotions', [SchoolClassController::class, 'promoteClasses']);

        // 9.3 Master Data Rooms
        Route::post('/rooms', [RoomController::class, 'store']);
        Route::put('/rooms/{id}', [RoomController::class, 'update']);
        Route::delete('/rooms/{id}', [RoomController::class, 'destroy']);

        // 9.3 Master Data Subjects
        Route::post('/subjects', [SubjectController::class, 'store']);
        Route::put('/subjects/{id}', [SubjectController::class, 'update']);
        Route::delete('/subjects/{id}', [SubjectController::class, 'destroy']);

        // 9.3 Master Data Teachers & Assignments
        Route::post('/teachers', [TeacherController::class, 'store']);
        Route::put('/teachers/{id}', [TeacherController::class, 'update']);
        Route::delete('/teachers/{id}', [TeacherController::class, 'destroy']);
        Route::post('/teachers/{id}/assignments', [TeacherController::class, 'assignRole']);
        Route::delete('/teachers/{id}/assignments/{assignment_id}', [TeacherController::class, 'revokeRole']);

        // 9.3 Master Data Students & Hold-Back
        Route::post('/students', [StudentController::class, 'store']);
        Route::put('/students/{id}', [StudentController::class, 'update']);
        Route::delete('/students/{id}', [StudentController::class, 'destroy']);
        Route::post('/students/{id}/hold-back', [StudentController::class, 'holdBack']);

        // Schedules & Imports Waka
        Route::post('/schedules', [ScheduleController::class, 'store']);
        Route::put('/schedules/{id}', [ScheduleController::class, 'update']);
        Route::delete('/schedules/{id}', [ScheduleController::class, 'destroy']);
        Route::post('/schedule-imports', [ScheduleImportController::class, 'store']);
        Route::get('/schedule-imports/{id}', [ScheduleImportController::class, 'show']);
        Route::patch('/schedule-imports/{id}/rows/{row_id}', [ScheduleImportController::class, 'resolveRow']);
        Route::post('/schedule-imports/{id}/confirm', [ScheduleImportController::class, 'confirm']);
        Route::delete('/schedule-imports/{id}', [ScheduleImportController::class, 'destroy']);

        Route::get('/reports/journals', [ReportController::class, 'teachingJournals']);
    });

    // 2. Waka Kurikulum & Guru (Shared Read/Verification & Journals: PRD 9.7)
    Route::middleware('role:vice_principal,teacher')->group(function () {
        Route::get('/attendance-warnings', [AttendanceWarningController::class, 'index']);
        Route::get('/journals', [JournalController::class, 'index']);
        Route::get('/journals/{id}', [JournalController::class, 'show']);
        Route::post('/journals', [JournalController::class, 'store']);
        Route::patch('/journals/{id}', [JournalController::class, 'markTeacherAbsent']);
    });

    // 3. Khusus Guru (termasuk Kesiswaan & Wali Kelas)
    Route::middleware('role:teacher')->group(function () {
        Route::match(['put', 'post'], '/journals/{id}', [JournalController::class, 'update']);
        Route::post('/journals/{id}/attendance', [AttendanceController::class, 'store']);
        Route::post('/journals/{id}/complete', [JournalController::class, 'complete']);

        Route::post('/permissions/{id}/status', [StudentPermisionController::class, 'updateStatus']);
        Route::post('/substitute', [SubstituteAssignmentController::class, 'store']);

        Route::post('/journals/{id}/quiz/generate', [QuizController::class, 'generate']);
        Route::patch('/quizzes/{id}/publish', [QuizController::class, 'publish']);
    });

    Route::middleware('role:teacher,student')->group(function() {
        Route::get('/quizzes/{id}', [QuizController::class, 'show']);
    });

    // 4. Siswa & Orang Tua
    Route::middleware('role:student,parent')->group(function () {
        Route::post('/leave-requests', [LeaveRequestController::class, 'store']);
        Route::delete('/leave-requests/{id}', [LeaveRequestController::class, 'destroy']);

        Route::post('/permissions', [StudentPermisionController::class, 'store']);
        Route::get('/students/{id}/attendance/summary', [StudentController::class, 'attendanceSummary']);
        Route::post('/quizzes/{id}/submissions', [QuizController::class, 'submit']);
    });
});
