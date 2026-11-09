<?php

namespace App\Http\Controllers\API;

use App\Jobs\ParseSchedulePdfJob;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use App\Models\ScheduleImport;
use App\Models\ScheduleImportRow;
use App\Models\Schedule;
use App\Models\Room;
use App\Models\User;
use App\Services\ScheduleConflictService;
use App\Services\TeacherMatcherService;
use App\Services\MasterDataPrerequisiteService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ScheduleImportController extends Controller
{
    public function __construct(
        private ?MasterDataPrerequisiteService $prerequisites = null
    ) {
        $this->prerequisites = $prerequisites ?? new MasterDataPrerequisiteService();
    }

    /**
     * Upload 2 PDF files and dispatch asynchronous parsing job.
     * POST /api/schedule-imports
     */
    public function store(Request $request)
    {
        $prerequisiteCheck = $this->prerequisites->validateForPdfImport();
        if (!$prerequisiteCheck['is_valid']) {
            return response()->json([
                'success' => false,
                'message' => 'Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.',
                'errors' => $prerequisiteCheck['errors'],
                'meta' => [
                    'missing_entities' => $prerequisiteCheck['missing'],
                ],
            ], 422);
        }

        $request->validate([
            'cycle_type' => 'required|integer|in:1,2',
            'file_kelas' => 'required|file|mimes:pdf|max:10240',
            'file_ruangan' => 'required|file|mimes:pdf|max:10240',
        ]);

        // Simpan file fisik di storage private lokal untuk diparsing Python
        $pathKelas = $request->file('file_kelas')->store('imports/schedules', 'local');
        $pathRuangan = $request->file('file_ruangan')->store('imports/schedules', 'local');

        $import = ScheduleImport::create([
            'waka_id' => $request->user()->id,
            'cycle_type' => $request->cycle_type,
            'file_path_kelas' => $pathKelas,
            'file_path_ruangan' => $pathRuangan,
            'status' => 'uploaded',
            'parser_version' => 'v1.0',
        ]);

        // Dispatch ekstraksi berkas jadwal PDF secara asinkron ke antrean queue
        ParseSchedulePdfJob::dispatch($import->id);

        return response()->json([
            'success' => true,
            'message' => 'File jadwal diunggah. Sedang memproses...',
            'data' => $import,
        ], 202);
    }

    /**
     * Preview import results with matched, unmatched, and conflict rows.
     * GET /api/schedule-imports/{id}
     */
    public function show($id)
    {
        $import = ScheduleImport::with([
            'rows.matchedClass',
            'rows.matchedTeacher',
            'rows.matchedRoom',
            'rows.matchedSubject',
        ])->findOrFail($id);

        $totalRows = $import->rows->count();
        $matchedCount = $import->rows->where('match_status', 'matched')->count();
        $unmatchedCount = $import->rows->where('match_status', 'unmatched')->count();
        $conflictCount = $import->rows->where('match_status', 'conflict')->count();
        $duplicateCount = $import->rows->where('match_status', 'duplicate')->count();

        return response()->json([
            'success' => $import->status !== 'failed',
            'message' => $import->status === 'failed' ? ($import->error_message ?: 'Proses ekstraksi berkas PDF gagal.') : 'Detail preview import jadwal.',
            'data' => $import,
            'meta' => [
                'total_rows' => $totalRows,
                'matched_count' => $matchedCount,
                'unmatched_count' => $unmatchedCount,
                'conflict_count' => $conflictCount,
                'duplicate_count' => $duplicateCount,
            ],
        ], 200);
    }

    /**
     * Resolve single unmatched/conflict row manually or exclude it.
     * PATCH /api/schedule-imports/{id}/rows/{row_id}
     */
    public function resolveRow(Request $request, $id, $row_id)
    {
        $import = ScheduleImport::findOrFail($id);

        if ($import->status === 'confirmed') {
            return response()->json([
                'success' => false,
                'message' => 'Import yang sudah dikonfirmasi tidak dapat diubah.',
            ], 422);
        }

        $row = ScheduleImportRow::where('import_id', $import->id)->findOrFail($row_id);

        $validated = $request->validate([
            'matched_class_id' => 'nullable|exists:classes,id',
            'matched_teacher_id' => 'nullable|exists:users,id',
            'matched_room_id' => 'nullable|exists:rooms,id',
            'matched_subject_id' => 'nullable|exists:subjects,id',
            'exclude' => 'nullable|boolean',
            'override_conflict' => 'nullable|boolean',
            'apply_to_same_teacher_raw' => 'nullable|boolean',
        ]);

        if (!empty($validated['exclude'])) {
            $row->match_status = 'duplicate';
            $row->resolved_by_waka = true;
            $row->save();

            return response()->json([
                'success' => true,
                'message' => 'Baris jadwal berhasil dikecualikan dari import.',
                'data' => $row->fresh(['matchedClass', 'matchedTeacher', 'matchedRoom', 'matchedSubject']),
            ], 200);
        }

        if ($request->has('matched_class_id')) {
            $row->matched_class_id = $validated['matched_class_id'];
        }
        if ($request->has('matched_teacher_id')) {
            $row->matched_teacher_id = $validated['matched_teacher_id'];
        }
        if ($request->has('matched_room_id')) {
            $row->matched_room_id = $validated['matched_room_id'];
        }
        if ($request->has('matched_subject_id')) {
            $row->matched_subject_id = $validated['matched_subject_id'];
        }

        $row->resolved_by_waka = true;
        // Resolusi manual Waka dari UI mengirim override_conflict: true agar langsung ditandai Matched (sama seperti Unmatched).
        // Jika tidak dikirim (misal pada automated tests atau re-evaluasi), default bernilai false.
        $overrideConflict = $request->boolean('override_conflict', false);
        $this->evaluateRowStatus($row, $import, $overrideConflict);
        $row->save();

        // Optional bulk-apply to other rows with same raw teacher name
        $appliedBulkCount = 0;
        $currentRawTeacher = $row->raw_data['guru_mentah'] ?? $row->raw_data['teacher'] ?? null;
        if (!empty($validated['apply_to_same_teacher_raw']) && !empty($validated['matched_teacher_id']) && $currentRawTeacher) {
            $otherRows = $import->rows()
                ->where('id', '!=', $row->id)
                ->whereNull('matched_teacher_id')
                ->get();

            foreach ($otherRows as $otherRow) {
                $otherRaw = $otherRow->raw_data['guru_mentah'] ?? $otherRow->raw_data['teacher'] ?? null;
                if ($otherRaw === $currentRawTeacher) {
                    $otherRow->matched_teacher_id = $validated['matched_teacher_id'];
                    $otherRow->resolved_by_waka = true;
                    $this->evaluateRowStatus($otherRow, $import);
                    $otherRow->save();
                    $appliedBulkCount++;
                }
            }
        }

        $message = match ($row->match_status) {
            'matched' => $overrideConflict
                ? 'Baris jadwal berhasil disetujui secara manual (Override Waka) dan ditandai Matched.'
                : ($appliedBulkCount > 0
                    ? "Baris import berhasil dicocokkan dan diterapkan ke {$appliedBulkCount} baris lain."
                    : 'Baris import berhasil diverifikasi dan ditandai Matched.'),
            'conflict' => 'Data pemetaan tersimpan, namun baris ini masih terdeteksi KONFLIK dengan jadwal lain. Silakan pilih Ruangan Alternatif yang kosong atau centang opsi Setujui Benturan (Override Waka).',
            default => 'Data tersimpan, namun masih berstatus Unmatched karena kelengkapan entitas belum terpenuhi.',
        };

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $row->fresh(['matchedClass', 'matchedTeacher', 'matchedRoom', 'matchedSubject']),
            'meta' => [
                'applied_bulk_count' => $appliedBulkCount,
                'is_still_conflict' => $row->match_status === 'conflict',
            ],
        ], 200);
    }

    /**
     * Bulk resolve raw teacher names from PDF into master teacher IDs.
     * POST /api/schedule-imports/{id}/resolve-teachers-bulk
     */
    public function resolveTeachersBulk(Request $request, $id)
    {
        $import = ScheduleImport::findOrFail($id);

        if ($import->status === 'confirmed') {
            return response()->json([
                'success' => false,
                'message' => 'Import yang sudah dikonfirmasi tidak dapat diubah.',
            ], 422);
        }

        $validated = $request->validate([
            'mappings' => 'required|array|min:1',
            'mappings.*.raw_teacher_name' => 'required|string',
            'mappings.*.teacher_id' => 'required|exists:users,id',
        ]);

        $mappings = collect($validated['mappings'])->pluck('teacher_id', 'raw_teacher_name')->toArray();

        $rows = $import->rows()->whereNull('matched_teacher_id')->get();
        $updatedCount = 0;

        foreach ($rows as $row) {
            $rawTeacher = $row->raw_data['guru_mentah'] ?? $row->raw_data['teacher'] ?? null;
            if ($rawTeacher && isset($mappings[$rawTeacher])) {
                $row->matched_teacher_id = $mappings[$rawTeacher];
                $row->resolved_by_waka = true;
                $this->evaluateRowStatus($row, $import);
                $row->save();
                $updatedCount++;
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Berhasil menyelaraskan {$updatedCount} baris jadwal untuk guru yang dipilih.",
            'data' => [
                'updated_rows' => $updatedCount,
            ],
        ], 200);
    }

    /**
     * Get real-time conflict diagnosis and smart recommendations for a specific import row.
     * GET /api/schedule-imports/{id}/rows/{row_id}/recommendations
     */
    public function getRecommendations($id, $row_id)
    {
        $import = ScheduleImport::findOrFail($id);
        $row = ScheduleImportRow::where('import_id', $import->id)
            ->with(['matchedClass', 'matchedTeacher', 'matchedRoom', 'matchedSubject'])
            ->findOrFail($row_id);

        $conflictService = new ScheduleConflictService();
        $teacherMatcher = new TeacherMatcherService();

        $allRooms = Room::all();
        $allTeachers = User::where('role', 'teacher')->get();

        $batchClassIds = $import->rows()
            ->whereNotNull('matched_class_id')
            ->pluck('matched_class_id')
            ->unique()
            ->values()
            ->all();

        $existingSchedules = Schedule::query()
            ->where('cycle_type', $import->cycle_type)
            ->when(!empty($batchClassIds), fn ($q) => $q->whereNotIn('class_id', $batchClassIds))
            ->with([
                'teacher:id,name',
                'class:id,name',
                'room:id,name',
                'subject:id,name',
            ])
            ->get(['id', 'teacher_id', 'class_id', 'room_id', 'subject_id', 'cycle_type', 'day_of_week', 'period_number', 'duration_periods']);

        // Build batchSlots from ALL active rows in this batch to prevent false positives
        $batchSlots = [];
        $otherActiveRows = $import->rows()
            ->where('id', '!=', $row->id)
            ->whereNotIn('match_status', ['excluded', 'duplicate'])
            ->with(['matchedClass', 'matchedTeacher', 'matchedRoom', 'matchedSubject'])
            ->get();

        foreach ($otherActiveRows as $o) {
            $day = (int) $o->day_of_week;
            $start = (int) $o->period_number;
            $dur = (int) ($o->duration_periods ?? 1);
            $end = $start + $dur - 1;
            
            $rId = $o->matched_room_id;
            if (!$rId) {
                $rn = $o->raw_data['ruang_final'] ?? $o->raw_data['ruang_jadwal'] ?? null;
                if ($rn) {
                    $m = ScheduleConflictService::findRoom($allRooms, $rn);
                    if ($m) $rId = $m->id;
                }
            }
            $isShared = ScheduleConflictService::isSharedRoom($rId);

            for ($p = $start; $p <= $end; $p++) {
                $slotKey = "{$day}-{$p}";
                if (!isset($batchSlots[$slotKey])) {
                    $batchSlots[$slotKey] = ['teachers' => [], 'classes' => [], 'rooms' => [], 'entries' => []];
                }
                if ($o->matched_teacher_id) $batchSlots[$slotKey]['teachers'][] = $o->matched_teacher_id;
                if ($o->matched_class_id) $batchSlots[$slotKey]['classes'][] = $o->matched_class_id;
                if ($rId && !$isShared) $batchSlots[$slotKey]['rooms'][] = $rId;
                $batchSlots[$slotKey]['entries'][] = [
                    'teacher_id' => $o->matched_teacher_id,
                    'teacher_name' => $o->matchedTeacher?->name ?? $o->raw_data['guru_mentah'] ?? 'Guru',
                    'class_id' => $o->matched_class_id,
                    'class_name' => $o->matchedClass?->name ?? $o->raw_data['kelas_mentah'] ?? 'Kelas',
                    'room_id' => $rId,
                    'room_name' => $o->matchedRoom?->name ?? $o->raw_data['ruang_final'] ?? 'Ruangan',
                    'subject_name' => $o->matchedSubject?->name ?? $o->raw_data['mapel_mentah'] ?? 'Mata Pelajaran',
                ];
            }
        }

        $day = (int) $row->day_of_week;
        $startPeriod = (int) $row->period_number;
        $duration = (int) ($row->duration_periods ?? 1);

        $altRooms = $conflictService->findAlternativeRooms(
            $day,
            $startPeriod,
            $duration,
            $allRooms,
            $existingSchedules,
            $batchSlots,
            $row->matched_room_id
        );

        $roomSourceDiag = null;
        $rawKelasRoom = $row->raw_data['ruang_kelas'] ?? null;
        $rawJadwalRoom = $row->raw_data['ruang_jadwal'] ?? null;

        if ($row->room_source_conflict || ($rawKelasRoom && $rawJadwalRoom && $rawKelasRoom !== $rawJadwalRoom)) {
            $rk = ScheduleConflictService::findRoom($allRooms, $rawKelasRoom);
            $rj = ScheduleConflictService::findRoom($allRooms, $rawJadwalRoom);
            $roomSourceDiag = $conflictService->diagnoseRoomSourceConflict(
                $rk,
                $rj,
                $day,
                $startPeriod,
                $duration,
                $existingSchedules,
                $batchSlots,
                'PDF Jadwal Kelas',
                'PDF Matriks Ruang'
            );
        } else {
            // Jika terjadi tabrakan ruang atau ruang kelas kosong, cari Ruang Teori Pangkalan Rombel
            $classId = $row->matched_class_id;
            if ($classId) {
                $classRows = $import->rows()
                    ->whereNotIn('match_status', ['excluded', 'duplicate'])
                    ->where('matched_class_id', $classId)
                    ->get();

                $roomCounts = [];
                foreach ($classRows as $cr) {
                    $rn = $cr->matchedRoom?->name ?? $cr->raw_data['ruang_final'] ?? $cr->raw_data['ruang_jadwal'] ?? null;
                    if ($rn && ScheduleConflictService::getRoomCategory($rn) === 'theory') {
                        $roomCounts[trim($rn)] = ($roomCounts[trim($rn)] ?? 0) + 1;
                    }
                }

                if (!empty($roomCounts)) {
                    arsort($roomCounts);
                    $homeRoomName = array_key_first($roomCounts);
                    $homeRoom = ScheduleConflictService::findRoom($allRooms, $homeRoomName);
                    $targetRoom = $row->matchedRoom ?? ScheduleConflictService::findRoom($allRooms, $rawJadwalRoom);

                    if ($homeRoom && $targetRoom && (int) $homeRoom->id !== (int) $targetRoom->id) {
                        $roomSourceDiag = $conflictService->diagnoseRoomSourceConflict(
                            $homeRoom,
                            $targetRoom,
                            $day,
                            $startPeriod,
                            $duration,
                            $existingSchedules,
                            $batchSlots,
                            'Ruang Pangkalan Rombel',
                            'PDF Matriks Ruang'
                        );
                    }
                }
            }
        }

        $teacherCandidates = [];
        if (!$row->matched_teacher_id) {
            $rawTeacher = $row->raw_data['guru_mentah'] ?? $row->raw_data['teacher'] ?? null;
            $res = $teacherMatcher->match($allTeachers, $rawTeacher);
            $teacherCandidates = $res['candidates'] ?? [];
        }

        $issueDetail = $row->issue_detail;
        if (!$issueDetail && $row->matched_teacher_id && $row->matched_class_id && $row->matched_room_id) {
            $issueDetail = $conflictService->findConflictDetailsInMemory($existingSchedules, [
                'teacher_id' => $row->matched_teacher_id,
                'teacher_name' => $row->matchedTeacher?->name ?? 'Guru',
                'class_id' => $row->matched_class_id,
                'class_name' => $row->matchedClass?->name ?? 'Kelas',
                'room_id' => $row->matched_room_id,
                'room_name' => $row->matchedRoom?->name ?? 'Ruangan',
                'cycle_type' => $import->cycle_type,
                'day_of_week' => $day,
                'period_number' => $startPeriod,
                'duration_periods' => $duration,
            ], $batchSlots);

            if ($issueDetail) {
                $raw = $row->raw_data ?? [];
                $raw['issue_detail'] = $issueDetail;
                if (!empty($altRooms)) {
                    $raw['recommendations'] = array_merge($raw['recommendations'] ?? [], ['alternative_rooms' => $altRooms]);
                }
                $row->raw_data = $raw;
                $row->save();
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'issue_detail' => $issueDetail,
                'alternative_rooms' => $altRooms,
                'room_source_options' => $roomSourceDiag,
                'teacher_candidates' => $teacherCandidates,
            ],
        ], 200);
    }

    /**
     * Evaluates whether row has all 4 entities and checks anti-collision conflicts.
     */
    protected function evaluateRowStatus(ScheduleImportRow $row, ScheduleImport $import, bool $overrideConflict = false): void
    {
        $rawData = $row->raw_data ?? [];

        if (
            $row->matched_class_id &&
            $row->matched_teacher_id &&
            $row->matched_room_id &&
            $row->matched_subject_id
        ) {
            $batchClassIds = $import->rows
                ->pluck('matched_class_id')
                ->filter()
                ->unique()
                ->values()
                ->all();
            if ($row->matched_class_id && !in_array($row->matched_class_id, $batchClassIds)) {
                $batchClassIds[] = $row->matched_class_id;
            }

            // 1. Check intra-batch collisions against other non-excluded rows in the same import
            $intraConflict = false;
            $collidedOther = null;
            $collidedType = null;
            $startPeriod = (int) $row->period_number;
            $endPeriod = $startPeriod + (int) $row->duration_periods - 1;
            $isSharedRoom = ScheduleConflictService::isSharedRoom($row->matched_room_id);

            $otherRows = $import->rows()
                ->where('id', '!=', $row->id)
                ->whereNotIn('match_status', ['excluded', 'duplicate'])
                ->where('day_of_week', $row->day_of_week)
                ->with(['matchedClass', 'matchedTeacher', 'matchedRoom', 'matchedSubject'])
                ->get();

            foreach ($otherRows as $other) {
                $otherStart = (int) $other->period_number;
                $otherEnd = $otherStart + (int) $other->duration_periods - 1;
                if ($startPeriod <= $otherEnd && $endPeriod >= $otherStart) {
                    if ($other->matched_teacher_id && $other->matched_teacher_id === $row->matched_teacher_id) {
                        $intraConflict = true;
                        $collidedOther = $other;
                        $collidedType = 'teacher_collision';
                        break;
                    }
                    if ($other->matched_class_id && $other->matched_class_id === $row->matched_class_id) {
                        $intraConflict = true;
                        $collidedOther = $other;
                        $collidedType = 'class_collision';
                        break;
                    }
                    if (!$isSharedRoom && $other->matched_room_id && $other->matched_room_id === $row->matched_room_id) {
                        $intraConflict = true;
                        $collidedOther = $other;
                        $collidedType = 'room_collision';
                        break;
                    }
                }
            }

            if ($intraConflict) {
                $row->loadMissing(['matchedClass', 'matchedTeacher', 'matchedRoom', 'matchedSubject']);
                $dayName = ScheduleConflictService::getDayName($row->day_of_week);

                if ($collidedType === 'teacher_collision') {
                    $otherClass = $collidedOther->matchedClass?->name ?? 'kelas lain';
                    $otherSub = $collidedOther->matchedSubject?->name ?? 'mapel lain';
                    $rawData['issue_detail'] = [
                        'type' => 'teacher_collision',
                        'title' => 'Tabrakan Jadwal Guru',
                        'description' => "Guru {$row->matchedTeacher?->name} sudah mengajar ({$otherSub}) di kelas {$otherClass} pada hari {$dayName} Jam Ke-{$startPeriod}.",
                    ];
                    $rawData['recommendations'] = [
                        'action_hint' => 'Pilih guru pengampu yang berbeda atau ubah jam pelajaran.',
                    ];
                } elseif ($collidedType === 'class_collision') {
                    $otherTeacher = $collidedOther->matchedTeacher?->name ?? 'guru lain';
                    $otherSub = $collidedOther->matchedSubject?->name ?? 'mapel lain';
                    $rawData['issue_detail'] = [
                        'type' => 'class_collision',
                        'title' => 'Tabrakan Jadwal Kelas',
                        'description' => "Kelas {$row->matchedClass?->name} sudah memiliki jadwal KBM ({$otherSub}, {$otherTeacher}) pada hari {$dayName} Jam Ke-{$startPeriod}.",
                    ];
                    $rawData['recommendations'] = [
                        'action_hint' => 'Periksa alokasi jam kelas agar tidak tumpang tindih.',
                    ];
                } else {
                    $otherClass = $collidedOther->matchedClass?->name ?? 'kelas lain';
                    $otherSub = $collidedOther->matchedSubject?->name ?? 'mapel lain';
                    $rawData['issue_detail'] = [
                        'type' => 'room_collision',
                        'title' => 'Tabrakan Pemakaian Ruangan',
                        'description' => "Ruangan '{$row->matchedRoom?->name}' sedang digunakan oleh kelas {$otherClass} ({$otherSub}) pada hari {$dayName} Jam Ke-{$startPeriod}.",
                    ];
                    $conflictService = new ScheduleConflictService();
                    $allRooms = Room::all();
                    $existingSchedules = Schedule::where('cycle_type', $import->cycle_type)->get();
                    $altRooms = $conflictService->findAlternativeRooms(
                        (int) $row->day_of_week,
                        (int) $row->period_number,
                        (int) ($row->duration_periods ?? 1),
                        $allRooms,
                        $existingSchedules,
                        [],
                        $row->matched_room_id
                    );
                    $rawData['recommendations'] = [
                        'alternative_rooms' => $altRooms,
                        'action_hint' => 'Pilih salah satu ruangan alternatif yang terbukti kosong.',
                    ];
                }

                if ($overrideConflict) {
                    $row->match_status = 'matched';
                    $row->room_source_conflict = false;
                    $rawData['overridden_by_waka'] = true;
                    $rawData['override_note'] = 'Disetujui secara manual oleh Waka Kurikulum meskipun terdeteksi benturan.';
                } else {
                    $row->match_status = 'conflict';
                    unset($rawData['overridden_by_waka']);
                }
            } else {
                $conflictService = new ScheduleConflictService();
                $conflicts = $conflictService->findConflicts([
                    'teacher_id' => $row->matched_teacher_id,
                    'class_id' => $row->matched_class_id,
                    'room_id' => $row->matched_room_id,
                    'cycle_type' => $import->cycle_type,
                    'day_of_week' => $row->day_of_week,
                    'period_number' => $row->period_number,
                    'duration_periods' => $row->duration_periods,
                ], ignoreClassIds: $batchClassIds);

                if ($conflicts->isNotEmpty()) {
                    $c = $conflicts->first();
                    $row->loadMissing(['matchedClass', 'matchedTeacher', 'matchedRoom', 'matchedSubject']);
                    $dayName = ScheduleConflictService::getDayName($row->day_of_week);

                    if ($c->teacher_id === $row->matched_teacher_id) {
                        $rawData['issue_detail'] = [
                            'type' => 'teacher_collision',
                            'title' => 'Tabrakan Jadwal Guru (Jadwal Aktif)',
                            'description' => "Guru {$row->matchedTeacher?->name} sudah memiliki jadwal aktif di kelas {$c->class?->name} ({$c->subject?->name}) pada hari {$dayName} Jam Ke-{$c->period_number}.",
                        ];
                    } elseif ($c->class_id === $row->matched_class_id) {
                        $rawData['issue_detail'] = [
                            'type' => 'class_collision',
                            'title' => 'Tabrakan Jadwal Kelas (Jadwal Aktif)',
                            'description' => "Kelas {$row->matchedClass?->name} sudah memiliki jadwal aktif ({$c->subject?->name}) bersama {$c->teacher?->name} pada hari {$dayName} Jam Ke-{$c->period_number}.",
                        ];
                    } else {
                        $rawData['issue_detail'] = [
                            'type' => 'room_collision',
                            'title' => 'Tabrakan Pemakaian Ruangan (Jadwal Aktif)',
                            'description' => "Ruangan '{$row->matchedRoom?->name}' terisi jadwal aktif kelas {$c->class?->name} pada hari {$dayName} Jam Ke-{$c->period_number}.",
                        ];
                    }

                    if ($overrideConflict) {
                        $row->match_status = 'matched';
                        $row->room_source_conflict = false;
                        $rawData['overridden_by_waka'] = true;
                        $rawData['override_note'] = 'Disetujui secara manual oleh Waka Kurikulum meskipun terdeteksi benturan.';
                    } else {
                        $row->match_status = 'conflict';
                        unset($rawData['overridden_by_waka']);
                    }
                } else {
                    $row->match_status = 'matched';
                    $row->room_source_conflict = false;
                    unset($rawData['issue_detail'], $rawData['recommendations'], $rawData['overridden_by_waka']);
                }
            }
        } else {
            $row->match_status = 'unmatched';
        }

        $row->raw_data = $rawData;
    }

    /**
     * Final commit replacing previous schedules per cycle_type.
     * POST /api/schedule-imports/{id}/confirm
     */
    public function confirm(Request $request, $id)
    {
        $request->validate(['password' => 'required|string']);

        if ($error = $this->passwordIsConfirmed($request)) {
            return $error;
        }

        $import = ScheduleImport::with('rows')->where('status', 'preview_ready')->findOrFail($id);

        $matchedCount = $import->rows->where('match_status', 'matched')->count();
        if ($matchedCount === 0) {
            return response()->json([
                'success' => false,
                'message' => 'Konfirmasi gagal. Tidak ada baris jadwal yang berstatus matched untuk dimasukkan ke jadwal aktif.',
                'errors' => [
                    'import' => ['Seluruh baris import masih berstatus unmatched atau conflict. Harap lengkapi master data atau lakukan resolusi baris terlebih dahulu.'],
                ],
            ], 422);
        }

        $insertedCount = 0;

        DB::transaction(function () use ($import, &$insertedCount) {
            $batchClassIds = $import->rows
                ->where('match_status', 'matched')
                ->pluck('matched_class_id')
                ->filter()
                ->unique()
                ->values()
                ->all();

            // Soft-delete previous schedules on this cycle_type for target classes being updated
            if (!empty($batchClassIds)) {
                Schedule::where('cycle_type', $import->cycle_type)
                    ->whereIn('class_id', $batchClassIds)
                    ->delete();
            } else {
                Schedule::where('cycle_type', $import->cycle_type)->delete();
            }

            foreach ($import->rows as $row) {
                if ($row->match_status === 'matched') {
                    Schedule::create([
                        'teacher_id' => $row->matched_teacher_id,
                        'class_id' => $row->matched_class_id,
                        'room_id' => $row->matched_room_id,
                        'subject_id' => $row->matched_subject_id,
                        'day_of_week' => $row->day_of_week,
                        'period_number' => $row->period_number,
                        'duration_periods' => $row->duration_periods,
                        'cycle_type' => $import->cycle_type,
                        'source' => 'imported',
                        'import_batch_id' => $import->id,
                    ]);
                    $insertedCount++;
                }
            }

            // Clean up temporary physical PDF files
            if ($import->file_path_kelas) {
                Storage::disk('local')->delete($import->file_path_kelas);
            }
            if ($import->file_path_ruangan) {
                Storage::disk('local')->delete($import->file_path_ruangan);
            }

            $import->update([
                'status' => 'confirmed',
                'file_path_kelas' => null,
                'file_path_ruangan' => null,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Import jadwal berhasil dikonfirmasi.',
            'data' => [
                'import_id' => $import->id,
                'cycle_type' => $import->cycle_type,
                'inserted_schedules_count' => $insertedCount,
            ],
        ], 200);
    }

    /**
     * Cancel and delete an unconfirmed import draft.
     * DELETE /api/schedule-imports/{id}
     */
    public function destroy($id)
    {
        $import = ScheduleImport::findOrFail($id);

        if ($import->status === 'confirmed') {
            return response()->json([
                'success' => false,
                'message' => 'Import yang sudah dikonfirmasi tidak dapat dibatalkan.',
            ], 422);
        }

        DB::transaction(function () use ($import) {
            // Delete temporary physical files
            if ($import->file_path_kelas) {
                Storage::disk('local')->delete($import->file_path_kelas);
            }
            if ($import->file_path_ruangan) {
                Storage::disk('local')->delete($import->file_path_ruangan);
            }

            // Delete rows and import
            $import->rows()->delete();
            $import->delete();
        });

        return response()->json([
            'success' => true,
            'message' => 'Draft import jadwal berhasil dibatalkan.',
        ], 200);
    }
}
