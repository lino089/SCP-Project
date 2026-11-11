<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Journal;
use App\Models\LeaveRequest;
use App\Models\Schedule;
use App\Models\SystemConfiguration;
use App\Models\User;
use App\Services\AcademicCalendarExclusionService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Laravel\Facades\Image;

class JournalController extends Controller
{
    public function __construct(
        protected AcademicCalendarExclusionService $exclusionService
    ) {}

    /**
     * Menampilkan daftar riwayat jurnal mengajar ter-scoped (PRD 9.7).
     * GET /api/journals
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'per_page' => 'sometimes|integer|min:1|max:100',
            'date' => 'sometimes|date',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date|after_or_equal:start_date',
            'class_id' => 'sometimes|integer',
            'subject_id' => 'sometimes|integer',
            'teacher_id' => 'sometimes|integer',
            'status' => 'sometimes|string|in:draft,completed,cancelled',
        ]);

        $user = $request->user();

        // Otorisasi: Siswa dan Orang Tua tidak memiliki akses rekap jurnal
        if (!in_array($user->role, ['vice_principal', 'teacher'])) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat daftar jurnal.',
            ], 403);
        }

        $query = Journal::query()
            ->with([
                'schedule.subject:id,name',
                'schedule.schoolClass:id,name,level',
                'schedule.teacher:id,name,nis_nip',
                'substituteTeacher:id,name,nis_nip',
            ]);

        // Scoping akses:
        // Waka Kurikulum & Guru Kesiswaan dapat melihat seluruh jurnal sekolah
        // Wali Kelas dapat melihat jurnal kelas binaannya, jurnal yang diinval, atau jadwal mengajarnya sendiri
        // Guru biasa hanya dapat melihat jurnal di mana dia adalah guru utama atau guru pengganti
        $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());
        $isWaka = ($user->role === 'vice_principal');

        if (!$isWaka && !$isKesiswaan) {
            if ($user->isWaliKelas()) {
                $waliClassIds = $user->homeroomClassIds();
                $query->where(function ($q) use ($user, $waliClassIds) {
                    $q->whereHas('schedule', function ($sq) use ($user, $waliClassIds) {
                        $sq->whereIn('class_id', $waliClassIds)
                            ->orWhere('teacher_id', $user->id);
                    })->orWhere('substitute_teacher_id', $user->id);
                });
            } else {
                $query->where(function ($q) use ($user) {
                    $q->whereHas('schedule', function ($sq) use ($user) {
                        $sq->where('teacher_id', $user->id);
                    })->orWhere('substitute_teacher_id', $user->id);
                });
            }
        }

        // Filtering
        if ($request->filled('date')) {
            $query->whereDate('date', $request->input('date'));
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('date', [$request->input('start_date'), $request->input('end_date')]);
        }

        if ($request->filled('class_id')) {
            $query->whereHas('schedule', function ($sq) use ($request) {
                $sq->where('class_id', $request->integer('class_id'));
            });
        }

        if ($request->filled('teacher_id')) {
            $teacherId = $request->integer('teacher_id');
            $query->where(function ($q) use ($teacherId) {
                $q->whereHas('schedule', fn ($sq) => $sq->where('teacher_id', $teacherId))
                    ->orWhere('substitute_teacher_id', $teacherId);
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $perPage = $request->integer('per_page', 15);
        $journals = $query->orderBy('date', 'desc')->orderBy('id', 'desc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Data jurnal berhasil diambil.',
            'data' => $journals->items(),
            'meta' => [
                'current_page' => $journals->currentPage(),
                'per_page' => $journals->perPage(),
                'total' => $journals->total(),
                'last_page' => $journals->lastPage(),
            ],
        ], 200);
    }

    /**
     * Menampilkan detail jurnal mengajar beserta data presensi (PRD 9.7).
     * GET /api/journals/{id}
     */
    public function show(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $journal = Journal::with([
            'schedule.subject:id,name',
            'schedule.schoolClass:id,name,level',
            'schedule.teacher:id,name,nis_nip',
            'schedule.room:id,name',
            'substituteTeacher:id,name,nis_nip',
            'attendances.student:id,name,nis_nip',
        ])->findOrFail($id);

        $isWaka = ($user->role === 'vice_principal');
        $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());
        $isOriginalTeacher = ($journal->schedule->teacher_id === $user->id);
        $isSubstitute = ($journal->substitute_teacher_id === $user->id);
        $isWaliKelasOfClass = ($user->role === 'teacher' && $user->isWaliKelas($journal->schedule->class_id));
        $isStudentInClass = ($user->role === 'student' && $user->class_id === $journal->schedule->class_id);
        $isParentOfClass = ($user->role === 'parent' && $user->linkedStudent?->class_id === $journal->schedule->class_id);

        if (!$isWaka && !$isKesiswaan && !$isOriginalTeacher && !$isSubstitute && !$isWaliKelasOfClass && !$isStudentInClass && !$isParentOfClass) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat detail jurnal ini.',
            ], 403);
        }

        $journalArray = $journal->toArray();

        // Selalu sertakan data siswa kelas jika presensi belum tercatat (status ongoing atau attendances kosong)
        if ($journal->attendances->isEmpty() || $journal->status === 'ongoing') {
            $isPgsql = DB::connection()->getDriverName() === 'pgsql';
            $orderRaw = $isPgsql ? 'student_number ASC NULLS LAST' : 'student_number IS NULL, student_number ASC';
            $classStudents = User::where('role', 'student')
                ->where('class_id', $journal->schedule->class_id)
                ->whereNull('deleted_at')
                ->whereNull('graduation_date')
                ->orderByRaw($orderRaw)
                ->orderBy('name')
                ->get(['id', 'name', 'nis_nip', 'student_number', 'gender', 'class_id']);
            $journalArray['students'] = $classStudents;
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail jurnal berhasil diambil.',
            'data' => $journalArray,
        ], 200);
    }

    /**
     * Membuka sesi KBM jurnal atau menandai teacher_absent (PRD 5.7 & 9.7).
     * POST /api/journals
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'schedule_id' => 'required|integer|exists:schedules,id',
            'status' => 'nullable|string|in:ongoing,teacher_absent',
            'date' => 'nullable|date',
        ]);

        $schedule = Schedule::with('schoolClass')->findOrFail($request->schedule_id);
        $user = $request->user();
        $today = $request->input('date') ?? Carbon::now('Asia/Jakarta')->toDateString();

        // Validasi Eksklusi Kalender Akademik & Agenda Khusus KBM
        $classLevel = $schedule->schoolClass?->level;
        if ($classLevel !== null) {
            $disablingEvent = $this->exclusionService->getActiveDisablingEvent($schedule->class_id, $classLevel, $today);
            if ($disablingEvent !== null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pengisian jurnal dibatalkan karena terdapat agenda sekolah: ' . $disablingEvent->title . '.',
                    'error_code' => 'TEACHING_DISABLED_BY_EVENT',
                    'data' => [
                        'event_id' => $disablingEvent->id,
                        'event_title' => $disablingEvent->title,
                        'event_type' => $disablingEvent->type,
                    ],
                ], 422);
            }
        }

        $isOriginalTeacher = ($schedule->teacher_id === $user->id);
        $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());
        $isWaka = ($user->role === 'vice_principal');
        $isWaliKelasOfClass = ($user->role === 'teacher' && $user->isWaliKelas($schedule->class_id));

        // Penegakan Otorisasi:
        // Hanya Guru Pemilik Jadwal ATAU Guru Kesiswaan ATAU Waka ATAU Wali Kelas terkait yang memiliki akses
        // Guru lain di luar peran tersebut dilarang (HTTP 403)
        if (!$isOriginalTeacher && !$isKesiswaan && !$isWaka && !$isWaliKelasOfClass) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya guru pengajar jadwal, Guru Kesiswaan, atau Wali Kelas terkait yang berhak membuka atau menggantikan jadwal ini.',
            ], 403);
        }

        // Skenario 1: Menandai status teacher_absent (guru berhalangan hadir)
        if ($request->input('status') === 'teacher_absent') {
            if (!$isKesiswaan && !$isWaka) {
                return response()->json([
                    'success' => false,
                    'message' => 'Hanya Guru Kesiswaan atau Waka Kurikulum yang berhak menandai status guru berhalangan hadir (teacher_absent).',
                ], 403);
            }

            $journal = Journal::updateOrCreate(
                ['schedule_id' => $schedule->id, 'date' => $today],
                [
                    'status' => 'teacher_absent',
                    'substitute_teacher_id' => null,
                ]
            );

            return response()->json([
                'success' => true,
                'message' => 'Jadwal berhasil ditandai sebagai guru berhalangan hadir (teacher_absent).',
                'data' => $journal->fresh(['schedule.subject', 'schedule.schoolClass']),
            ], 201);
        }

        // Skenario 2: Membuka sesi KBM ongoing
        // Waka Kurikulum tidak mengajar kelas pengganti (hanya aksi administratif)
        if ($isWaka && !$isOriginalTeacher) {
            return response()->json([
                'success' => false,
                'message' => 'Waka Kurikulum hanya memiliki wewenang administratif menandai status teacher_absent, bukan membuka sesi KBM pengganti.',
            ], 403);
        }

        // Jika bukan original teacher, maka Kesiswaan atau Wali Kelas menjadi substitute_teacher_id
        $substituteTeacherId = (!$isOriginalTeacher && ($isKesiswaan || $isWaliKelasOfClass)) ? $user->id : null;

        $journal = Journal::firstOrCreate(
            ['schedule_id' => $schedule->id, 'date' => $today],
            [
                'status' => 'ongoing',
                'substitute_teacher_id' => $substituteTeacherId,
            ]
        );

        // Jika jurnal sudah ada dan dibuka oleh Kesiswaan atau Wali Kelas sebagai pengganti, catat substitute_teacher_id jika belum terisi
        if (!$isOriginalTeacher && ($isKesiswaan || $isWaliKelasOfClass) && is_null($journal->substitute_teacher_id)) {
            $journal->update(['substitute_teacher_id' => $user->id]);
        }

        // Ambil data siswa yang memiliki perizinan approved bertipe tidak_masuk hari ini
        $approvedLeaves = LeaveRequest::where('status_approval', 'approved')
            ->where('type', 'tidak_masuk')
            ->whereDate('start_date', '<=', $today)
            ->whereDate('end_date', '>=', $today)
            ->whereHas('student', function ($q) use ($schedule) {
                $q->where('class_id', $schedule->class_id);
            })
            ->with('student:id,name,nis_nip')
            ->get();

        $isPgsql = DB::connection()->getDriverName() === 'pgsql';
        $orderRaw = $isPgsql ? 'student_number ASC NULLS LAST' : 'student_number IS NULL, student_number ASC';

        $classStudents = User::where('role', 'student')
            ->where('class_id', $schedule->class_id)
            ->whereNull('deleted_at')
            ->whereNull('graduation_date')
            ->orderByRaw($orderRaw)
            ->orderBy('name')
            ->get(['id', 'name', 'nis_nip', 'student_number', 'gender', 'class_id']);

        $freshJournal = $journal->fresh([
            'schedule.subject',
            'schedule.schoolClass',
            'substituteTeacher',
            'attendances.student:id,name,nis_nip',
        ]);
        $journalArray = $freshJournal->toArray();
        $journalArray['students'] = $classStudents;

        return response()->json([
            'success' => true,
            'message' => 'Jurnal KBM berhasil dibuka.',
            'data' => $journalArray,
            'meta' => [
                'total_students' => $classStudents->count(),
                'approved_leaves' => $approvedLeaves->map(function ($leave) {
                    return [
                        'student_id' => $leave->student_id,
                        'student_name' => $leave->student?->name,
                        'category' => $leave->category,
                        'default_status' => ($leave->category === 'sakit') ? 'Sakit' : 'Izin',
                    ];
                }),
            ],
        ], 201);
    }

    /**
     * Menandai jurnal menjadi teacher_absent (PRD 5.7 & 9.7).
     * PATCH /api/journals/{id}
     */
    public function markTeacherAbsent(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        // Otorisasi: Khusus Kesiswaan atau Waka
        $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());
        $isWaka = ($user->role === 'vice_principal');

        if (!$isKesiswaan && !$isWaka) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya Guru Kesiswaan atau Waka Kurikulum yang berhak menandai status guru berhalangan hadir.',
            ], 403);
        }

        $journal = Journal::with('schedule.schoolClass')->findOrFail($id);

        // Validasi Eksklusi Kalender Akademik & Agenda Khusus KBM
        $classLevel = $journal->schedule?->schoolClass?->level;
        if ($classLevel !== null) {
            $disablingEvent = $this->exclusionService->getActiveDisablingEvent($journal->schedule->class_id, $classLevel, $journal->date);
            if ($disablingEvent !== null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Penandaan guru berhalangan hadir dibatalkan karena terdapat agenda sekolah: ' . $disablingEvent->title . '.',
                    'error_code' => 'TEACHING_DISABLED_BY_EVENT',
                    'data' => [
                        'event_id' => $disablingEvent->id,
                        'event_title' => $disablingEvent->title,
                        'event_type' => $disablingEvent->type,
                    ],
                ], 422);
            }
        }

        if ($journal->status === 'completed') {
            return response()->json([
                'success' => false,
                'message' => 'Jurnal KBM sudah berstatus completed dan tidak dapat diubah menjadi teacher_absent.',
            ], 422);
        }

        $journal->update([
            'status' => 'teacher_absent',
            'substitute_teacher_id' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Status jurnal berhasil diubah menjadi guru berhalangan hadir (teacher_absent).',
            'data' => $journal->fresh(['schedule.subject', 'schedule.schoolClass']),
        ], 200);
    }

    /**
     * Menyelesaikan jurnal KBM atomik: materi, kompresi foto ~800px JPEG, dan presensi exception-based (PRD 5.8, 5.11 & 9.7).
     * PUT/POST /api/journals/{id}
     */
    public function update(Request $request, $id): JsonResponse
    {
        $journal = Journal::with('schedule.schoolClass')->findOrFail($id);

        // Validasi Eksklusi Kalender Akademik & Agenda Khusus KBM
        $classLevel = $journal->schedule?->schoolClass?->level;
        if ($classLevel !== null) {
            $disablingEvent = $this->exclusionService->getActiveDisablingEvent($journal->schedule->class_id, $classLevel, $journal->date);
            if ($disablingEvent !== null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Penyelesaian jurnal dibatalkan karena terdapat agenda sekolah: ' . $disablingEvent->title . '.',
                    'error_code' => 'TEACHING_DISABLED_BY_EVENT',
                    'data' => [
                        'event_id' => $disablingEvent->id,
                        'event_title' => $disablingEvent->title,
                        'event_type' => $disablingEvent->type,
                    ],
                ], 422);
            }
        }
        $user = $request->user();

        $isOriginalTeacher = ($journal->schedule->teacher_id === $user->id);
        $isAuthorizedSubstitute = ($journal->substitute_teacher_id === $user->id) && (
            $user->isKesiswaan() || $user->isWaliKelas($journal->schedule->class_id)
        );

        // Otorisasi Ketat: Hanya Guru Pemilik Jadwal ATAU Guru Pengganti (Kesiswaan / Wali Kelas)
        // Guru lain ditolak (HTTP 403)
        if (!$isOriginalTeacher && !$isAuthorizedSubstitute) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk mengisi atau menyelesaikan jurnal ini.',
            ], 403);
        }

        if ($journal->status !== 'ongoing') {
            return response()->json([
                'success' => false,
                'message' => 'Jurnal tidak dapat diselesaikan karena status saat ini bukan ongoing (' . $journal->status . ').',
            ], 422);
        }

        $request->validate([
            'topic_description' => 'required|string|min:10',
            'photo' => 'required|image|mimes:jpg,jpeg,png,webp|max:10240',
            'exceptions' => 'nullable|array',
            'exceptions.*.student_id' => 'required_with:exceptions|integer|exists:users,id',
            'exceptions.*.status' => 'required_with:exceptions|string|in:Sakit,Izin,Alpa',
            'exceptions.*.notes' => 'nullable|string|max:500',
            'student_notes' => 'nullable|array',
            'student_notes.*.student_id' => 'required_with:student_notes|integer|exists:users,id',
            'student_notes.*.notes' => 'nullable|string|max:500',
        ]);

        $file = $request->file('photo');

        // Kompresi Gambar Standar PRD 5.11:
        // Resize lebar maksimum ~800px, encode JPEG quality 35%, target ukuran < 150KB
        $img = Image::decode($file);
        $img->scaleDown(width: 800);
        $encoded = $img->encodeUsingFileExtension('jpg', quality: 35);

        $filename = 'journals/' . Str::uuid() . '.jpg';
        $disk = config('filesystems.default', 'public');
        Storage::disk($disk)->put($filename, (string) $encoded);
        if ($disk !== 'public') {
            Storage::disk('public')->put($filename, (string) $encoded);
        }

        // Eksekusi atomik: Presensi Exception-Based + Update Status Jurnal
        $insertedCount = 0;
        $journalDate = $journal->date;
        $classId = $journal->schedule->class_id;

        DB::transaction(function () use ($journal, $request, $filename, $journalDate, $classId, &$insertedCount) {
            // 1. Ambil seluruh siswa aktif di kelas jadwal
            $allStudents = User::where('role', 'student')
                ->where('class_id', $classId)
                ->whereNull('deleted_at')
                ->get();

            // 2. Ambil perizinan siswa approved bertipe tidak_masuk untuk hari ini (PRD 5.9)
            $approvedLeaves = LeaveRequest::where('status_approval', 'approved')
                ->where('type', 'tidak_masuk')
                ->whereDate('start_date', '<=', $journalDate)
                ->whereDate('end_date', '>=', $journalDate)
                ->whereHas('student', function ($query) use ($classId) {
                    $query->where('class_id', $classId);
                })
                ->get()
                ->keyBy('student_id');

            // 3. Susun data presensi: prioritaskan array exceptions manual dari guru
            $manualExceptions = collect($request->input('exceptions', []))->keyBy('student_id');

            // Kumpulkan catatan siswa dari student_notes dan exceptions
            $notesMap = [];
            $rawStudentNotes = $request->input('student_notes', []);
            if (is_array($rawStudentNotes)) {
                foreach ($rawStudentNotes as $key => $item) {
                    if (is_array($item) && isset($item['student_id'])) {
                        $stId = (int) $item['student_id'];
                        $note = trim($item['notes'] ?? '');
                        if ($note !== '') {
                            $notesMap[$stId] = mb_substr($note, 0, 500);
                        }
                    } elseif (is_numeric($key) && is_string($item)) {
                        $stId = (int) $key;
                        $note = trim($item);
                        if ($note !== '') {
                            $notesMap[$stId] = mb_substr($note, 0, 500);
                        }
                    }
                }
            }
            if (is_array($request->input('exceptions'))) {
                foreach ($request->input('exceptions') as $exc) {
                    if (isset($exc['student_id']) && !empty($exc['notes'])) {
                        $stId = (int) $exc['student_id'];
                        if (!isset($notesMap[$stId])) {
                            $notesMap[$stId] = mb_substr(trim($exc['notes']), 0, 500);
                        }
                    }
                }
            }

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

                $note = $notesMap[$studentId] ?? null;

                $attendanceData[] = [
                    'journal_id' => $journal->id,
                    'student_id' => $studentId,
                    'status' => $status,
                    'notes' => $note,
                    'date' => $journalDate,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            // Bersihkan presensi lama (jika ada) dan simpan presensi final
            Attendance::where('journal_id', $journal->id)->delete();
            if (!empty($attendanceData)) {
                Attendance::insert($attendanceData);
                $insertedCount = count($attendanceData);
            }

            // 4. Update data jurnal menjadi completed
            $journal->update([
                'topic_description' => $request->topic_description,
                'photo_path' => $filename,
                'status' => 'completed',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Jurnal KBM dan presensi berhasil diselesaikan.',
            'data' => $journal->fresh([
                'schedule.subject',
                'schedule.schoolClass',
                'substituteTeacher',
                'attendances.student:id,name,nis_nip',
            ]),
            'meta' => [
                'total_students_attendance' => $insertedCount,
            ],
        ], 200);
    }

    /**
     * Menampilkan rekapitulasi harian KBM & kepatuhan pengisian jurnal (PRD 9.7 & Kalender Akademik).
     * GET /api/journals/daily-recap
     */
    public function dailyRecap(Request $request): JsonResponse
    {
        $user = $request->user();

        // Otorisasi: Khusus Waka Kurikulum & Guru
        if (!in_array($user->role, ['vice_principal', 'teacher'])) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat rekapitulasi jurnal.',
            ], 403);
        }

        $request->validate([
            'date' => 'nullable|date_format:Y-m-d',
            'class_id' => 'nullable|integer|exists:classes,id',
        ]);

        $dateStr = $request->input('date', Carbon::now('Asia/Jakarta')->toDateString());
        $targetDate = Carbon::parse($dateStr, 'Asia/Jakarta');
        $dayOfWeek = (int) $targetDate->dayOfWeekIso;

        $activeCycle = (int) (SystemConfiguration::first()?->active_cycle ?? 1);

        $query = Schedule::query()
            ->where('cycle_type', $activeCycle)
            ->where('day_of_week', $dayOfWeek)
            ->with([
                'schoolClass:id,name,level',
                'teacher:id,name,nis_nip',
                'room:id,name',
                'subject:id,name',
                'journals' => fn ($jq) => $jq->whereDate('date', $dateStr),
            ]);

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        }

        $schedules = $query->orderBy('class_id')->orderBy('period_number')->get();

        $rows = [];
        $totalMandatory = 0;
        $exemptedCount = 0;
        $completedCount = 0;
        $ongoingCount = 0;
        $absentCount = 0;
        $unfilledCount = 0;

        foreach ($schedules as $sched) {
            $totalMandatory++;
            $journal = $sched->journals->first();
            $classLevel = $sched->schoolClass?->level;

            $disablingEvent = $classLevel !== null
                ? $this->exclusionService->getActiveDisablingEvent($sched->class_id, $classLevel, $targetDate)
                : null;

            $isExempted = $disablingEvent !== null;

            if ($journal && $journal->status === 'completed') {
                $status = 'completed';
                $completedCount++;
            } elseif ($journal && $journal->status === 'teacher_absent') {
                $status = 'teacher_absent';
                $absentCount++;
            } elseif ($isExempted) {
                $status = 'exempted';
                $exemptedCount++;
            } elseif ($journal && $journal->status === 'ongoing') {
                $status = 'ongoing';
                $ongoingCount++;
            } else {
                $status = 'unfilled';
                $unfilledCount++;
            }

            $rows[] = [
                'schedule_id' => $sched->id,
                'class_id' => $sched->class_id,
                'class_name' => $sched->schoolClass?->name,
                'teacher_id' => $sched->teacher_id,
                'teacher_name' => $sched->teacher?->name,
                'subject_id' => $sched->subject_id,
                'subject_name' => $sched->subject?->name,
                'room_name' => $sched->room?->name,
                'period_number' => $sched->period_number,
                'date' => $dateStr,
                'status' => $status,
                'is_teaching_exempted' => $isExempted,
                'exemption_reason' => $disablingEvent?->title,
                'event_type' => $disablingEvent?->type,
                'journal_id' => $journal?->id,
                'photo_url' => $journal?->photo_url,
                'topic_description' => $journal?->topic_description,
                'substitute_teacher_id' => $journal?->substitute_teacher_id,
                'substitute_teacher_name' => $journal?->substituteTeacher?->name,
            ];
        }

        $effectiveMandatory = max(0, $totalMandatory - $exemptedCount);
        $complianceRate = $effectiveMandatory > 0
            ? round(($completedCount / $effectiveMandatory) * 100, 1)
            : 100.0;

        return response()->json([
            'success' => true,
            'message' => 'Data rekapitulasi harian KBM berhasil diambil.',
            'data' => [
                'date' => $dateStr,
                'day_of_week' => $dayOfWeek,
                'active_cycle' => $activeCycle,
                'total_mandatory' => $totalMandatory,
                'exempted_count' => $exemptedCount,
                'effective_mandatory' => $effectiveMandatory,
                'completed_count' => $completedCount,
                'ongoing_count' => $ongoingCount,
                'absent_count' => $absentCount,
                'unfilled_count' => $unfilledCount,
                'compliance_rate' => $complianceRate,
                'metrics' => [
                    'total_mandatory' => $totalMandatory,
                    'exempted_count' => $exemptedCount,
                    'effective_mandatory' => $effectiveMandatory,
                    'completed_count' => $completedCount,
                    'ongoing_count' => $ongoingCount,
                    'absent_count' => $absentCount,
                    'unfilled_count' => $unfilledCount,
                    'compliance_rate' => $complianceRate,
                ],
                'items' => $rows,
            ],
        ], 200);
    }
}
