<?php

use App\Http\Controllers\API\AcademicSettingController;
use App\Http\Controllers\API\AttendanceController;
use App\Http\Controllers\API\AttendanceWarningController;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\JournalController;
use App\Http\Controllers\API\QuizController;
use App\Http\Controllers\API\ReportController;
use App\Http\Controllers\API\ScheduleController;
use App\Http\Controllers\API\ScheduleImportController;
use App\Http\Controllers\API\SchoolClassController;
use App\Http\Controllers\API\StudentController;
use App\Http\Controllers\API\StudentPermisionController;
use App\Http\Controllers\API\SubjectController;
use App\Http\Controllers\API\SubstituteAssignmentController;
use App\Http\Controllers\API\TeacherController;
use Illuminate\Http\Request;
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

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/classes', [SchoolClassController::class, 'index']);
});

// 1. Khusus Waka Kurikulum
Route::middleware(['auth:sanctum', 'role:vice_principal'])->group(function () {
    Route::get('/waka-only', function () {
        return response()->json([
            'success' => true,
            'message' => 'Selamat datang waka kurikulum'
        ]);
    });

    Route::patch('/academic-settings/monday-status', [AcademicSettingController::class, 'updateMondayStatus']);

    Route::post('/classes', [SchoolClassController::class, 'store']);
    Route::delete('/classes/{id}', [SchoolClassController::class, 'destroy']);

    Route::post('/students', [StudentController::class, 'store']);
    Route::post('/teachers', [TeacherController::class, 'store']);
    Route::post('/teachers/{id}/assignments', [TeacherController::class, 'assignRole']);
    Route::post('/subjects', [SubjectController::class, 'store']);

    Route::post('/schedules', [ScheduleController::class, 'store']);
    Route::put('/schedules/{id}', [ScheduleController::class, 'update']);
    Route::delete('/schedules/{id}', [ScheduleController::class, 'destroy']);
    Route::post('/schedule-imports', [ScheduleImportController::class, 'store']);
    Route::get('/schedule-imports/{id}', [ScheduleImportController::class, 'show']);
    Route::post('/schedule-imports/{id}/confirm', [ScheduleImportController::class, 'confirm']);

    Route::get('/reports/journals', [ReportController::class, 'teachingJournals']);
});

// 2. Waka Kurikulum & Guru (Shared Read/Verification)
Route::middleware(['auth:sanctum', 'role:vice_principal,teacher'])->group(function () {
    Route::get('/attendance-warnings', [AttendanceWarningController::class, 'index']);
});

// 3. Khusus Guru (termasuk Kesiswaan & Wali Kelas)
Route::middleware(['auth:sanctum', 'role:teacher'])->group(function () {
    Route::post('/journals', [JournalController::class, 'store']);
    Route::post('/journals/{id}/attendance', [AttendanceController::class, 'store']);
    Route::post('/journals/{id}/complete', [JournalController::class, 'complete']);

    Route::post('/permissions/{id}/status', [StudentPermisionController::class, 'updateStatus']);
    Route::post('/substitute', [SubstituteAssignmentController::class, 'store']);

    Route::post('/journals/{id}/quiz/generate', [QuizController::class, 'generate']);
    Route::patch('/quizzes/{id}/publish', [QuizController::class, 'publish']);
});

Route::middleware(['auth:sanctum', 'role:teacher,student'])->group(function() {
    Route::get('/quizzes/{id}', [QuizController::class, 'show']);
});

// 4. Siswa & Orang Tua
Route::middleware(['auth:sanctum', 'role:student,parent'])->group(function () {
    Route::post('/permissions', [StudentPermisionController::class, 'store']);
    Route::get('/students/{id}/attendance/summary', [StudentController::class, 'attendanceSummary']);
    Route::post('/quizzes/{id}/submissions', [QuizController::class, 'submit']);
});