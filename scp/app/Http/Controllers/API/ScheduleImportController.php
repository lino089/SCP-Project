<?php

namespace App\Http\Controllers\API;

use App\Jobs\ParseSchedulePdfJob;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use App\Models\ScheduleImport;
use App\Models\ScheduleImportRow;
use App\Models\Schedule;
use App\Services\ScheduleConflictService;
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

        try {
            ParseSchedulePdfJob::dispatchSync($import->id);
            $import->refresh();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('PDF Extraction Error: ' . $e->getMessage());
            $import->update(['status' => 'failed']);
            $import->refresh();
        }

        return response()->json([
            'success' => true,
            'message' => $import->status === 'preview_ready'
                ? 'File jadwal berhasil diekstraksi. Preview siap ditinjau.'
                : 'File jadwal diunggah. Sedang memproses...',
            'data' => $import,
        ], $import->status === 'preview_ready' ? 200 : 202);
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
            'success' => true,
            'message' => 'Detail preview import jadwal.',
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
        $this->evaluateRowStatus($row, $import);
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

        $message = $appliedBulkCount > 0
            ? "Baris import berhasil diupdate dan diterapkan ke {$appliedBulkCount} baris lain dengan guru yang sama."
            : 'Baris import berhasil diupdate.';

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $row->fresh(['matchedClass', 'matchedTeacher', 'matchedRoom', 'matchedSubject']),
            'meta' => [
                'applied_bulk_count' => $appliedBulkCount,
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
     * Evaluates whether row has all 4 entities and checks anti-collision conflicts.
     */
    protected function evaluateRowStatus(ScheduleImportRow $row, ScheduleImport $import): void
    {
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
            $startPeriod = (int) $row->period_number;
            $endPeriod = $startPeriod + (int) $row->duration_periods - 1;
            $isSharedRoom = ScheduleConflictService::isSharedRoom($row->matched_room_id);

            $otherRows = $import->rows()
                ->where('id', '!=', $row->id)
                ->where('match_status', '!=', 'excluded')
                ->where('day_of_week', $row->day_of_week)
                ->get();

            foreach ($otherRows as $other) {
                $otherStart = (int) $other->period_number;
                $otherEnd = $otherStart + (int) $other->duration_periods - 1;
                if ($startPeriod <= $otherEnd && $endPeriod >= $otherStart) {
                    if (
                        ($other->matched_teacher_id && $other->matched_teacher_id === $row->matched_teacher_id) ||
                        ($other->matched_class_id && $other->matched_class_id === $row->matched_class_id) ||
                        (!$isSharedRoom && $other->matched_room_id && $other->matched_room_id === $row->matched_room_id)
                    ) {
                        $intraConflict = true;
                        break;
                    }
                }
            }

            if ($intraConflict) {
                $row->match_status = 'conflict';
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

                $row->match_status = $conflicts->isEmpty() ? 'matched' : 'conflict';
            }
        } else {
            $row->match_status = 'unmatched';
        }
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
