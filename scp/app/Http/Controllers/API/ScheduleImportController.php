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

        // Simpan file fisik di storage private
        $pathKelas = $request->file('file_kelas')->store('imports/schedules');
        $pathRuangan = $request->file('file_ruangan')->store('imports/schedules');

        $import = ScheduleImport::create([
            'waka_id' => $request->user()->id,
            'cycle_type' => $request->cycle_type,
            'file_path_kelas' => $pathKelas,
            'file_path_ruangan' => $pathRuangan,
            'status' => 'uploaded',
            'parser_version' => 'v1.0',
        ]);

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

        // Check if all 4 entities are now populated
        if (
            $row->matched_class_id &&
            $row->matched_teacher_id &&
            $row->matched_room_id &&
            $row->matched_subject_id
        ) {
            $conflictService = new ScheduleConflictService();
            $conflicts = $conflictService->findConflicts([
                'teacher_id' => $row->matched_teacher_id,
                'class_id' => $row->matched_class_id,
                'room_id' => $row->matched_room_id,
                'cycle_type' => $import->cycle_type,
                'day_of_week' => $row->day_of_week,
                'period_number' => $row->period_number,
                'duration_periods' => $row->duration_periods,
            ]);

            $row->match_status = $conflicts->isEmpty() ? 'matched' : 'conflict';
        } else {
            $row->match_status = 'unmatched';
        }

        $row->save();

        return response()->json([
            'success' => true,
            'message' => 'Baris import berhasil diupdate.',
            'data' => $row->fresh(['matchedClass', 'matchedTeacher', 'matchedRoom', 'matchedSubject']),
        ], 200);
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
            // Soft-delete previous schedules on this cycle_type only
            Schedule::where('cycle_type', $import->cycle_type)->delete();

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

        return response()->json([
            'success' => true,
            'message' => 'Draft import jadwal berhasil dibatalkan.',
        ], 200);
    }
}
