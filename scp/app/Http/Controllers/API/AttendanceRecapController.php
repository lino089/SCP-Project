<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Classes;
use App\Models\SystemConfiguration;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\SimpleExcel\SimpleExcelWriter;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class AttendanceRecapController extends Controller
{
    /**
     * Menyelesaikan wewenang akses kelas bagi pengguna yang sedang login.
     * Wali Kelas hanya mengakses kelas binaannya.
     * Kesiswaan hanya mengakses daftar kelas binaannya.
     */
    protected function resolveUserAccess(User $user): array
    {
        $isVicePrincipal = ($user->role === 'vice_principal');
        $isTeacher = ($user->role === 'teacher');

        if (!$isVicePrincipal && !$isTeacher) {
            abort(403, 'Akses ditolak. Fitur ini hanya diperuntukkan bagi Guru dan Waka Kurikulum.');
        }

        if ($isVicePrincipal) {
            $allClassIds = Classes::pluck('id')->map(fn($id) => (int)$id)->toArray();
            return [
                'can_access' => true,
                'is_vice_principal' => true,
                'is_wali_kelas' => false,
                'is_kesiswaan' => false,
                'homeroom_class_ids' => [],
                'kesiswaan_class_ids' => $allClassIds,
                'accessible_class_ids' => $allClassIds,
            ];
        }

        $homeroomIds = array_map('intval', $user->homeroomClassIds());
        $kesiswaanIds = array_map('intval', $user->getKesiswaanClassIds());
        $accessibleIds = array_values(array_unique(array_merge($homeroomIds, $kesiswaanIds)));

        $canAccess = !empty($accessibleIds);

        if (!$canAccess) {
            abort(403, 'Akses ditolak. Anda tidak memiliki penugasan aktif sebagai Wali Kelas maupun Guru Kesiswaan.');
        }

        return [
            'can_access' => true,
            'is_vice_principal' => false,
            'is_wali_kelas' => !empty($homeroomIds),
            'is_kesiswaan' => !empty($kesiswaanIds),
            'homeroom_class_ids' => $homeroomIds,
            'kesiswaan_class_ids' => $kesiswaanIds,
            'accessible_class_ids' => $accessibleIds,
        ];
    }

    /**
     * Menampilkan daftar kelas yang berhak diakses oleh pengguna.
     * GET /api/attendance-recap/classes
     */
    public function classes(Request $request): JsonResponse
    {
        $access = $this->resolveUserAccess($request->user());

        $classes = Classes::whereIn('id', $access['accessible_class_ids'])
            ->orderBy('level')
            ->orderBy('name')
            ->get(['id', 'name', 'level']);

        $homeroomMap = array_flip($access['homeroom_class_ids']);
        $kesiswaanMap = array_flip($access['kesiswaan_class_ids']);

        $classesWithMeta = $classes->map(function ($c) use ($homeroomMap, $kesiswaanMap) {
            return [
                'id' => $c->id,
                'name' => $c->name,
                'level' => $c->level,
                'is_homeroom' => isset($homeroomMap[$c->id]),
                'is_kesiswaan' => isset($kesiswaanMap[$c->id]),
            ];
        });

        // Default class selection
        $defaultClassId = null;
        if (!empty($access['homeroom_class_ids'])) {
            $defaultClassId = $access['homeroom_class_ids'][0];
        } elseif ($access['is_kesiswaan'] && count($access['kesiswaan_class_ids']) > 1) {
            $defaultClassId = 'all';
        } elseif (!empty($access['kesiswaan_class_ids'])) {
            $defaultClassId = $access['kesiswaan_class_ids'][0];
        }

        return response()->json([
            'success' => true,
            'message' => 'Daftar kelas binaan berhasil diambil.',
            'data' => [
                'role_context' => [
                    'is_vice_principal' => $access['is_vice_principal'],
                    'is_wali_kelas' => $access['is_wali_kelas'],
                    'is_kesiswaan' => $access['is_kesiswaan'],
                    'has_multiple_classes' => count($access['accessible_class_ids']) > 1,
                ],
                'default_class_id' => $defaultClassId,
                'classes' => $classesWithMeta,
            ],
        ], 200);
    }

    /**
     * Menampilkan rekapitulasi kehadiran siswa (KPI & tabel agregat).
     * GET /api/attendance-recap/summary
     */
    public function summary(Request $request): JsonResponse
    {
        $access = $this->resolveUserAccess($request->user());

        $request->validate([
            'class_id' => 'nullable',
            'start_date' => 'nullable|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d|after_or_equal:start_date',
            'month' => 'nullable|integer|between:1,12',
            'year' => 'nullable|integer|min:2020|max:2099',
            'search' => 'nullable|string|max:100',
            'status_filter' => 'nullable|string|in:all,at_risk_only,danger,warning',
            'sort_by' => 'nullable|string|in:alpa_desc,attendance_asc,name_asc',
        ]);

        // Resolusi Target Kelas yang Diminta
        $requestedClassId = $request->input('class_id');
        $targetClassIds = [];
        $isMultiClass = false;

        if ($requestedClassId === 'all') {
            if (!$access['is_kesiswaan'] && !$access['is_vice_principal']) {
                abort(403, 'Akses ditolak. Pemantauan lintas kelas hanya diizinkan untuk Tim Kesiswaan atau Waka.');
            }
            $targetClassIds = $access['accessible_class_ids'];
            $isMultiClass = true;
        } elseif ($requestedClassId !== null && is_numeric($requestedClassId)) {
            $cId = (int)$requestedClassId;
            if (!in_array($cId, $access['accessible_class_ids'], true)) {
                abort(403, 'Akses ditolak. Anda tidak memiliki penugasan untuk kelas ini.');
            }
            $targetClassIds = [$cId];
        } else {
            // Default: kelas wali kelas atau 'all' jika kesiswaan
            if (!empty($access['homeroom_class_ids'])) {
                $targetClassIds = [$access['homeroom_class_ids'][0]];
            } else {
                $targetClassIds = $access['accessible_class_ids'];
                $isMultiClass = count($targetClassIds) > 1;
            }
        }

        // Resolusi Rentang Tanggal
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $startDate = Carbon::parse($request->input('start_date'))->startOfDay();
            $endDate = Carbon::parse($request->input('end_date'))->endOfDay();
        } elseif ($request->filled('month') && $request->filled('year')) {
            $startDate = Carbon::createFromDate($request->integer('year'), $request->integer('month'), 1)->startOfMonth();
            $endDate = Carbon::createFromDate($request->integer('year'), $request->integer('month'), 1)->endOfMonth();
        } else {
            $now = Carbon::now('Asia/Jakarta');
            $startDate = $now->copy()->startOfMonth();
            $endDate = $now->copy()->endOfMonth();
        }

        $startStr = $startDate->toDateString();
        $endStr = $endDate->toDateString();

        // 1. Ambil seluruh siswa di kelas target
        $studentsQuery = User::where('role', 'student')
            ->whereIn('class_id', $targetClassIds)
            ->with('schoolClass:id,name,level')
            ->orderBy('name');

        $search = trim((string)$request->input('search', ''));
        if ($search !== '') {
            $studentsQuery->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('nis_nip', 'like', "%{$search}%");
            });
        }

        $allStudents = $studentsQuery->get(['id', 'name', 'nis_nip', 'gender', 'class_id']);

        if ($allStudents->isEmpty()) {
            return response()->json([
                'success' => true,
                'message' => 'Tidak ada siswa yang ditemukan pada kelas ini.',
                'data' => [
                    'is_multi_class' => $isMultiClass,
                    'class_info' => $isMultiClass ? null : Classes::find($targetClassIds[0] ?? null, ['id', 'name', 'level']),
                    'period' => [
                        'start_date' => $startStr,
                        'end_date' => $endStr,
                    ],
                    'kpi' => [
                        'total_students' => 0,
                        'total_sessions' => 0,
                        'class_attendance_rate' => null,
                        'total_hadir' => 0,
                        'total_sakit' => 0,
                        'total_izin' => 0,
                        'total_alpa' => 0,
                        'at_risk_count' => 0,
                    ],
                    'students' => [],
                    'class_comparisons' => [],
                ],
            ], 200);
        }

        $studentIds = $allStudents->pluck('id')->toArray();

        // 2. Query Agregasi Presensi per Siswa dalam rentang tanggal
        $attStats = DB::table('attendances')
            ->join('journals', 'journals.id', '=', 'attendances.journal_id')
            ->join('schedules', 'schedules.id', '=', 'journals.schedule_id')
            ->whereIn('schedules.class_id', $targetClassIds)
            ->whereBetween('attendances.date', [$startStr, $endStr])
            ->whereIn('attendances.student_id', $studentIds)
            ->select([
                'attendances.student_id',
                DB::raw("COUNT(CASE WHEN LOWER(attendances.status) = 'hadir' THEN 1 END) as hadir_count"),
                DB::raw("COUNT(CASE WHEN LOWER(attendances.status) = 'sakit' THEN 1 END) as sakit_count"),
                DB::raw("COUNT(CASE WHEN LOWER(attendances.status) = 'izin' THEN 1 END) as izin_count"),
                DB::raw("COUNT(CASE WHEN LOWER(attendances.status) = 'alpa' THEN 1 END) as alpa_count"),
                DB::raw("COUNT(*) as total_sessions"),
                DB::raw("COUNT(CASE WHEN attendances.notes IS NOT NULL AND TRIM(attendances.notes) != '' THEN 1 END) as notes_count"),
            ])
            ->groupBy('attendances.student_id')
            ->get()
            ->keyBy('student_id');

        // 3. Ambil catatan guru terbaru per siswa dalam rentang tanggal
        $latestNotes = Attendance::whereIn('student_id', $studentIds)
            ->whereNotNull('notes')
            ->where('notes', '!=', '')
            ->whereBetween('date', [$startStr, $endStr])
            ->whereHas('journal.schedule', fn($q) => $q->whereIn('class_id', $targetClassIds))
            ->orderBy('date', 'desc')
            ->orderBy('id', 'desc')
            ->get(['student_id', 'notes', 'date', 'status'])
            ->unique('student_id')
            ->keyBy('student_id');

        // 4. Hitung Statistik Individual Siswa (Opsi A)
        $studentsData = $allStudents->map(function ($st) use ($attStats, $latestNotes) {
            $stat = $attStats->get($st->id);
            $hadir = (int)($stat?->hadir_count ?? 0);
            $sakit = (int)($stat?->sakit_count ?? 0);
            $izin = (int)($stat?->izin_count ?? 0);
            $alpa = (int)($stat?->alpa_count ?? 0);
            $totalSessions = (int)($stat?->total_sessions ?? ($hadir + $sakit + $izin + $alpa));
            $notesCount = (int)($stat?->notes_count ?? 0);

            // Formula Keputusan 1 (Opsi A): Hadir / (Hadir + Sakit + Izin + Alpa) * 100
            // Jika belum ada sesi KBM tercatat (totalSessions == 0), kembalikan null
            $attendanceRate = $totalSessions > 0
                ? round(($hadir / $totalSessions) * 100, 1)
                : null;

            // Kategori Keputusan 2 (Opsi A):
            // Kritis (danger): Alpa >= 3 ATAU Kehadiran < 85%
            // Waspada (warning): Alpa 1-2 ATAU Kehadiran 85% - 89.9% ATAU Total (S+I+A) >= 5
            // Aman (safe): Alpa = 0 dan Kehadiran >= 90%
            // Belum Ada KBM (unrecorded): totalSessions == 0
            if ($totalSessions === 0) {
                $riskLevel = 'unrecorded';
            } elseif ($alpa >= 3 || $attendanceRate < 85.0) {
                $riskLevel = 'danger';
            } elseif ($alpa >= 1 || $attendanceRate < 90.0 || ($sakit + $izin + $alpa) >= 5) {
                $riskLevel = 'warning';
            } else {
                $riskLevel = 'safe';
            }

            $latestNoteObj = $latestNotes->get($st->id);

            return [
                'id' => $st->id,
                'name' => $st->name,
                'nis' => $st->nis_nip,
                'gender' => $st->gender ?? 'L',
                'class_id' => $st->class_id,
                'class_name' => $st->schoolClass?->name ?? 'Belum Ditentukan',
                'level' => $st->schoolClass?->level ?? 'X',
                'hadir' => $hadir,
                'sakit' => $sakit,
                'izin' => $izin,
                'alpa' => $alpa,
                'total_sessions' => $totalSessions,
                'attendance_rate' => $attendanceRate,
                'risk_level' => $riskLevel,
                'notes_count' => $notesCount,
                'latest_note' => $latestNoteObj?->notes,
                'latest_note_date' => $latestNoteObj?->date,
                'latest_note_status' => $latestNoteObj?->status,
            ];
        });

        // 5. Filter Status & At-Risk
        $statusFilter = $request->input('status_filter', 'all');
        if ($statusFilter === 'at_risk_only') {
            $studentsData = $studentsData->filter(fn($s) => $s['risk_level'] === 'danger' || $s['risk_level'] === 'warning')->values();
        } elseif ($statusFilter === 'danger') {
            $studentsData = $studentsData->filter(fn($s) => $s['risk_level'] === 'danger')->values();
        } elseif ($statusFilter === 'warning') {
            $studentsData = $studentsData->filter(fn($s) => $s['risk_level'] === 'warning')->values();
        }

        // 6. Pengurutan Data
        $sortBy = $request->input('sort_by', 'name_asc');
        $studentsData = match ($sortBy) {
            'alpa_desc' => $studentsData->sort(function ($a, $b) {
                if ($a['alpa'] === $b['alpa']) {
                    return ($a['attendance_rate'] ?? 0) <=> ($b['attendance_rate'] ?? 0);
                }
                return $b['alpa'] <=> $a['alpa'];
            })->values(),
            'attendance_asc' => $studentsData->sort(function ($a, $b) {
                if ($a['attendance_rate'] === $b['attendance_rate']) {
                    return ($b['alpa'] ?? 0) <=> ($a['alpa'] ?? 0);
                }
                return ($a['attendance_rate'] ?? 0) <=> ($b['attendance_rate'] ?? 0);
            })->values(),
            default => $studentsData->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values(),
        };

        // 7. Hitung KPI Keseluruhan
        $totalStudents = $allStudents->count();
        $sumHadir = $studentsData->sum('hadir');
        $sumSakit = $studentsData->sum('sakit');
        $sumIzin = $studentsData->sum('izin');
        $sumAlpa = $studentsData->sum('alpa');
        $sumSessions = $sumHadir + $sumSakit + $sumIzin + $sumAlpa;
        $classRate = $sumSessions > 0 ? round(($sumHadir / $sumSessions) * 100, 1) : null;
        $atRiskCount = $allStudents->map(function ($st) use ($attStats) {
            $stat = $attStats->get($st->id);
            $hadir = (int)($stat?->hadir_count ?? 0);
            $sakit = (int)($stat?->sakit_count ?? 0);
            $izin = (int)($stat?->izin_count ?? 0);
            $alpa = (int)($stat?->alpa_count ?? 0);
            $total = $hadir + $sakit + $izin + $alpa;
            if ($total === 0) {
                return 0;
            }
            $rate = ($hadir / $total) * 100;
            return ($alpa >= 1 || $rate < 90.0 || ($sakit + $izin + $alpa) >= 5) ? 1 : 0;
        })->sum();

        $singleClassInfo = null;
        if (!$isMultiClass && !empty($targetClassIds)) {
            $singleClassInfo = Classes::find($targetClassIds[0], ['id', 'name', 'level']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Rekapitulasi kehadiran berhasil dimuat.',
            'data' => [
                'is_multi_class' => $isMultiClass,
                'class_info' => $singleClassInfo,
                'period' => [
                    'start_date' => $startStr,
                    'end_date' => $endStr,
                ],
                'kpi' => [
                    'total_students' => $totalStudents,
                    'total_sessions' => $sumSessions,
                    'class_attendance_rate' => $classRate,
                    'total_hadir' => $sumHadir,
                    'total_sakit' => $sumSakit,
                    'total_izin' => $sumIzin,
                    'total_alpa' => $sumAlpa,
                    'at_risk_count' => $atRiskCount,
                ],
                'students' => $studentsData,
            ],
        ], 200);
    }

    /**
     * Menampilkan riwayat linimasa sesi presensi dan catatan guru untuk satu siswa.
     * GET /api/attendance-recap/student/{studentId}
     */
    public function studentHistory(Request $request, int|string $studentId): JsonResponse
    {
        $access = $this->resolveUserAccess($request->user());

        $student = User::where('role', 'student')
            ->with('schoolClass:id,name,level')
            ->findOrFail($studentId);

        // Validasi Otorisasi: Siswa harus berada pada kelas binaan user
        if (!in_array((int)$student->class_id, $access['accessible_class_ids'], true)) {
            abort(403, 'Akses ditolak. Anda tidak memiliki wewenang untuk melihat data siswa ini.');
        }

        $startDate = $request->filled('start_date') ? Carbon::parse($request->input('start_date'))->startOfDay() : Carbon::now('Asia/Jakarta')->startOfMonth();
        $endDate = $request->filled('end_date') ? Carbon::parse($request->input('end_date'))->endOfDay() : Carbon::now('Asia/Jakarta')->endOfMonth();

        $query = Attendance::where('student_id', $student->id)
            ->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
            ->with([
                'journal:id,schedule_id,date,status,topic_description,substitute_teacher_id',
                'journal.schedule.subject:id,name',
                'journal.schedule.teacher:id,name',
                'journal.schedule.schoolClass:id,name',
                'journal.substituteTeacher:id,name',
            ])
            ->orderBy('date', 'desc')
            ->orderBy('id', 'desc');

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        $attendances = $query->get();

        $history = $attendances->map(function ($att) {
            $j = $att->journal;
            $s = $j?->schedule;
            $effectiveTeacher = $j?->substituteTeacher?->name ?? $s?->teacher?->name ?? 'Guru Pengampu';

            return [
                'id' => $att->id,
                'date' => $att->date,
                'status' => $att->status,
                'notes' => $att->notes,
                'subject' => $s?->subject?->name ?? 'Mata Pelajaran',
                'teacher' => $effectiveTeacher,
                'is_substitute' => (bool)$j?->substitute_teacher_id,
                'topic' => $j?->topic_description,
            ];
        });

        // Summary KPI Siswa
        $hadir = $attendances->filter(fn($a) => strcasecmp((string)$a->status, 'Hadir') === 0)->count();
        $sakit = $attendances->filter(fn($a) => strcasecmp((string)$a->status, 'Sakit') === 0)->count();
        $izin = $attendances->filter(fn($a) => strcasecmp((string)$a->status, 'Izin') === 0)->count();
        $alpa = $attendances->filter(fn($a) => strcasecmp((string)$a->status, 'Alpa') === 0)->count();
        $total = $hadir + $sakit + $izin + $alpa;
        $rate = $total > 0 ? round(($hadir / $total) * 100, 1) : null;

        return response()->json([
            'success' => true,
            'message' => 'Riwayat presensi siswa berhasil diambil.',
            'data' => [
                'student' => [
                    'id' => $student->id,
                    'name' => $student->name,
                    'nis' => $student->nis_nip,
                    'gender' => $student->gender ?? 'L',
                    'class_id' => $student->class_id,
                    'class_name' => $student->schoolClass?->name ?? 'Belum Ditentukan',
                    'level' => $student->schoolClass?->level ?? 'X',
                ],
                'period' => [
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                ],
                'summary' => [
                    'total_sessions' => $total,
                    'hadir' => $hadir,
                    'sakit' => $sakit,
                    'izin' => $izin,
                    'alpa' => $alpa,
                    'attendance_rate' => $rate,
                    'has_notes_count' => $attendances->filter(fn($a) => !empty($a->notes))->count(),
                ],
                'history' => $history,
            ],
        ], 200);
    }

    /**
     * Mengekspor data rekapitulasi kehadiran ke berkas spreadsheet Excel (.xlsx).
     * Keputusan 3 (Opsi A).
     * GET /api/attendance-recap/export
     */
    public function export(Request $request): BinaryFileResponse
    {
        // Panggil internal summary logic
        $summaryResponse = $this->summary($request);
        $resData = json_decode($summaryResponse->getContent(), true)['data'] ?? [];

        $students = $resData['students'] ?? [];
        $className = $resData['is_multi_class'] ? 'Semua_Kelas_Binaan' : ($resData['class_info']['name'] ?? 'Kelas');
        $className = preg_replace('/[^A-Za-z0-9_-]/', '_', $className);
        $periodStart = $resData['period']['start_date'] ?? date('Y-m-d');
        $periodEnd = $resData['period']['end_date'] ?? date('Y-m-d');

        $tempFile = tempnam(sys_get_temp_dir(), 'rekap_presensi_') . '.xlsx';
        $writer = SimpleExcelWriter::create($tempFile);

        $rowNo = 0;
        foreach ($students as $s) {
            $rowNo++;
            $riskLabel = match ($s['risk_level'] ?? 'unrecorded') {
                'danger' => 'Kritis (Perhatian Khusus)',
                'warning' => 'Waspada',
                'safe' => 'Baik (Aman)',
                default => 'Belum Ada KBM',
            };

            $rateText = ($s['total_sessions'] > 0 && isset($s['attendance_rate']) && $s['attendance_rate'] !== null)
                ? ($s['attendance_rate'] . '%')
                : '-';

            $writer->addRow([
                'No' => $rowNo,
                'NIS' => $s['nis'] ?? '-',
                'Nama Siswa' => $s['name'] ?? '-',
                'L/P' => $s['gender'] ?? 'L',
                'Kelas' => $s['class_name'] ?? '-',
                'Hadir (H)' => $s['hadir'] ?? 0,
                'Sakit (S)' => $s['sakit'] ?? 0,
                'Izin (I)' => $s['izin'] ?? 0,
                'Alpa (A)' => $s['alpa'] ?? 0,
                'Total Pertemuan' => $s['total_sessions'] ?? 0,
                '% Kehadiran' => $rateText,
                'Status Peringatan' => $riskLabel,
                'Catatan Guru Terbaru' => $s['latest_note'] ?? '-',
                'Tanggal Catatan' => $s['latest_note_date'] ?? '-',
            ]);
        }

        $writer->close();

        $downloadFilename = "Rekap_Kehadiran_{$className}_{$periodStart}_sd_{$periodEnd}.xlsx";
        return response()->download($tempFile, $downloadFilename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }
}
