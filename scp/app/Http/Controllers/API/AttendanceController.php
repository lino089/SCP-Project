<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Journal;
use App\Models\LeaveRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

    /**
     * Endpoint legacy untuk mencatat presensi terpisah (diselaraskan dengan aturan otorisasi baru & LeaveRequest).
     * POST /api/journals/{id}/attendance
     */
    public function store(Request $request, $id): JsonResponse
    {
        $journal = Journal::with('schedule')->findOrFail($id);
        $user = $request->user();

        $isOriginalTeacher = ($journal->schedule->teacher_id === $user->id);
        $isAuthorizedSubstitute = ($journal->substitute_teacher_id === $user->id && $user->isKesiswaan());

        if (!$isOriginalTeacher && !$isAuthorizedSubstitute) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk mengisi presensi jadwal ini.',
            ], 403);
        }

        if ($journal->status !== 'ongoing') {
            return response()->json([
                'success' => false,
                'message' => 'Presensi tidak dapat diubah karena status jurnal bukan ongoing.',
            ], 422);
        }

        $request->validate([
            'exceptions' => 'nullable|array',
            'exceptions.*.student_id' => 'required|exists:users,id',
            'exceptions.*.status' => 'required|in:Sakit,Izin,Alpa',
        ]);

        $insertedCount = 0;
        $journalDate = $journal->date;
        $classId = $journal->schedule->class_id;

        DB::transaction(function () use ($journal, $request, $journalDate, $classId, &$insertedCount) {
            $approvedLeaves = LeaveRequest::where('status_approval', 'approved')
                ->where('type', 'tidak_masuk')
                ->whereDate('start_date', '<=', $journalDate)
                ->whereDate('end_date', '>=', $journalDate)
                ->whereHas('student', function ($query) use ($classId) {
                    $query->where('class_id', $classId);
                })
                ->get()
                ->keyBy('student_id');

            $allStudents = User::where('role', 'student')
                ->where('class_id', $classId)
                ->whereNull('deleted_at')
                ->get();

            $manualExceptions = collect($request->input('exceptions', []))->keyBy('student_id');
            $now = Carbon::now('Asia/Jakarta');
            $attendanceData = [];

            foreach ($allStudents as $student) {
                $studentId = $student->id;
                $status = 'Hadir';

                if ($manualExceptions->has($studentId)) {
                    $status = $manualExceptions->get($studentId)['status'];
                } elseif ($approvedLeaves->has($studentId)) {
                    $leave = $approvedLeaves->get($studentId);
                    $status = ($leave->category === 'sakit') ? 'Sakit' : 'Izin';
                }

                $attendanceData[] = [
                    'journal_id' => $journal->id,
                    'student_id' => $studentId,
                    'status' => $status,
                    'date' => $journalDate,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            Attendance::where('journal_id', $journal->id)->delete();
            if (!empty($attendanceData)) {
                Attendance::insert($attendanceData);
                $insertedCount = count($attendanceData);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Presensi berhasil disimpan.',
            'data' => [
                'journal_id' => $journal->id,
                'total_recorded' => $insertedCount,
            ],
        ], 200);
    }
}
