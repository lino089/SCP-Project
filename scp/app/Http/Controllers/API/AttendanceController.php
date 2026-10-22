<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    /**
     * Menampilkan rekapitulasi presensi multi-role (PRD 9.6).
     * GET /api/attendances
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Attendance::query()
            ->with([
                'student:id,name,nis_nip,class_id',
                'student.schoolClass:id,name,level',
                'journal:id,schedule_id,date,status,topic_description',
                'journal.schedule.subject:id,name',
                'journal.schedule.teacher:id,name',
            ]);

        // Role Scoping:
        if ($user->role === 'vice_principal' || ($user->role === 'teacher' && $user->isKesiswaan())) {
            // Waka Kurikulum & Guru Kesiswaan: Melihat data presensi seluruh sekolah
            if ($request->filled('class_id')) {
                $query->whereHas('student', fn ($q) => $q->where('class_id', $request->integer('class_id')));
            }
        } elseif ($user->role === 'teacher' && $user->isWaliKelas()) {
            // Wali Kelas: Otomatis ter-scoped hanya siswa pada kelas yang diampunya
            $waliClassIds = $user->assignments()->where('type', 'wali_kelas')->pluck('class_id');
            $query->whereHas('student', fn ($q) => $q->whereIn('class_id', $waliClassIds));

            if ($request->filled('class_id') && in_array($request->integer('class_id'), $waliClassIds->toArray())) {
                $query->whereHas('student', fn ($q) => $q->where('class_id', $request->integer('class_id')));
            }
        } elseif ($user->role === 'teacher') {
            // Guru Mapel Reguler: Ter-scoped pada jurnal jadwal miliknya atau yang digantikannya
            $query->whereHas('journal', function ($jq) use ($user) {
                $jq->where('substitute_teacher_id', $user->id)
                    ->orWhereHas('schedule', fn ($sq) => $sq->where('teacher_id', $user->id));
            });

            if ($request->filled('class_id')) {
                $query->whereHas('student', fn ($q) => $q->where('class_id', $request->integer('class_id')));
            }
        } elseif ($user->role === 'student') {
            // Siswa: Auto-scoped hanya data presensi dirinya sendiri
            $query->where('student_id', $user->id);
        } elseif ($user->role === 'parent') {
            // Orang Tua: Auto-scoped hanya data presensi anaknya
            $query->where('student_id', $user->linked_student_id);
        }

        // Filtering Umum
        if ($request->filled('date')) {
            $query->whereDate('date', $request->input('date'));
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('date', [$request->input('start_date'), $request->input('end_date')]);
        }

        if ($request->filled('student_id') && in_array($user->role, ['vice_principal', 'teacher'])) {
            $query->where('student_id', $request->integer('student_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('journal_id')) {
            $query->where('journal_id', $request->integer('journal_id'));
        }

        $perPage = $request->integer('per_page', 15);
        $attendances = $query->orderBy('date', 'desc')->orderBy('id', 'desc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Data presensi berhasil diambil.',
            'data' => $attendances->items(),
            'meta' => [
                'current_page' => $attendances->currentPage(),
                'per_page' => $attendances->perPage(),
                'total' => $attendances->total(),
                'last_page' => $attendances->lastPage(),
            ],
        ], 200);
    }
}
