<?php

namespace Tests\Feature;

use App\Jobs\ParseSchedulePdfJob;
use App\Models\Classes;
use App\Models\Rooms;
use App\Models\Schedule;
use App\Models\ScheduleImport;
use App\Models\ScheduleImportRow;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ScheduleImportTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;
    private Classes $class;
    private Subject $subject;
    private Rooms $room;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->teacher = User::create([
            'name' => 'Dwi Lesmiyati',
            'email' => 'dwi@example.com',
            'nis_nip' => '198001012010011002',
            'fet_staff_id' => '34',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->class = Classes::create([
            'name' => 'X RPL 1',
            'level' => 10,
        ]);

        $this->subject = Subject::create([
            'name' => 'Matematika',
        ]);

        $this->room = Rooms::create([
            'name' => 'Ruang 12',
            'capacity' => 36,
        ]);

        User::create([
            'name' => 'Siswa Test',
            'email' => 'siswa@example.com',
            'nis_nip' => '12345678',
            'role' => 'student',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
    }

    public function test_waka_can_upload_pdfs_and_dispatches_parse_job(): void
    {
        Queue::fake();
        Sanctum::actingAs($this->waka);

        $fileKelas = UploadedFile::fake()->create('Jadwal_Kelas.pdf', 200, 'application/pdf');
        $fileRuangan = UploadedFile::fake()->create('Jadwal_Ruangan.pdf', 200, 'application/pdf');

        $response = $this->postJson('/api/schedule-imports', [
            'cycle_type' => 1,
            'file_kelas' => $fileKelas,
            'file_ruangan' => $fileRuangan,
        ]);

        $response->assertStatus(202)
            ->assertJson([
                'success' => true,
                'data' => [
                    'cycle_type' => 1,
                    'status' => 'uploaded',
                ],
            ]);

        Queue::assertPushed(ParseSchedulePdfJob::class);
        $this->assertDatabaseHas('schedule_imports', [
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'status' => 'uploaded',
        ]);
    }

    public function test_teacher_cannot_upload_schedule_import(): void
    {
        Sanctum::actingAs($this->teacher);

        $fileKelas = UploadedFile::fake()->create('Jadwal_Kelas.pdf', 200, 'application/pdf');
        $fileRuangan = UploadedFile::fake()->create('Jadwal_Ruangan.pdf', 200, 'application/pdf');

        $response = $this->postJson('/api/schedule-imports', [
            'cycle_type' => 1,
            'file_kelas' => $fileKelas,
            'file_ruangan' => $fileRuangan,
        ]);

        $response->assertStatus(403);
    }

    public function test_waka_can_preview_import_details_and_summary_meta(): void
    {
        Sanctum::actingAs($this->waka);

        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'file_path_kelas' => 'test/kelas.pdf',
            'file_path_ruangan' => 'test/ruangan.pdf',
            'status' => 'preview_ready',
        ]);

        // Create matched row
        ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => ['mapel_mentah' => 'Matematika'],
            'matched_class_id' => $this->class->id,
            'matched_teacher_id' => $this->teacher->id,
            'matched_room_id' => $this->room->id,
            'matched_subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'match_status' => 'matched',
            'room_source_conflict' => false,
            'resolved_by_waka' => false,
        ]);

        // Create unmatched row
        ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => ['mapel_mentah' => 'Sejarah'],
            'matched_class_id' => $this->class->id,
            'matched_teacher_id' => null,
            'matched_room_id' => null,
            'matched_subject_id' => null,
            'day_of_week' => 1,
            'period_number' => 3,
            'duration_periods' => 2,
            'match_status' => 'unmatched',
            'room_source_conflict' => false,
            'resolved_by_waka' => false,
        ]);

        $response = $this->getJson("/api/schedule-imports/{$import->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $import->id,
                    'status' => 'preview_ready',
                ],
                'meta' => [
                    'total_rows' => 2,
                    'matched_count' => 1,
                    'unmatched_count' => 1,
                    'conflict_count' => 0,
                ],
            ]);
    }

    public function test_waka_can_resolve_unmatched_row_manually(): void
    {
        Sanctum::actingAs($this->waka);

        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'file_path_kelas' => 'test/kelas.pdf',
            'file_path_ruangan' => 'test/ruangan.pdf',
            'status' => 'preview_ready',
        ]);

        $row = ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => ['mapel_mentah' => 'Matematika'],
            'matched_class_id' => $this->class->id,
            'matched_teacher_id' => null,
            'matched_room_id' => null,
            'matched_subject_id' => null,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'match_status' => 'unmatched',
            'room_source_conflict' => false,
            'resolved_by_waka' => false,
        ]);

        $response = $this->patchJson("/api/schedule-imports/{$import->id}/rows/{$row->id}", [
            'matched_teacher_id' => $this->teacher->id,
            'matched_room_id' => $this->room->id,
            'matched_subject_id' => $this->subject->id,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $row->id,
                    'matched_teacher_id' => $this->teacher->id,
                    'matched_room_id' => $this->room->id,
                    'matched_subject_id' => $this->subject->id,
                    'match_status' => 'matched',
                    'resolved_by_waka' => true,
                ],
            ]);

        $this->assertDatabaseHas('schedule_import_rows', [
            'id' => $row->id,
            'match_status' => 'matched',
            'resolved_by_waka' => true,
        ]);
    }

    public function test_waka_can_exclude_row_from_import(): void
    {
        Sanctum::actingAs($this->waka);

        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'file_path_kelas' => 'test/kelas.pdf',
            'file_path_ruangan' => 'test/ruangan.pdf',
            'status' => 'preview_ready',
        ]);

        $row = ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => ['mapel_mentah' => 'Upacara'],
            'matched_class_id' => $this->class->id,
            'matched_teacher_id' => null,
            'matched_room_id' => null,
            'matched_subject_id' => null,
            'day_of_week' => 1,
            'period_number' => 0,
            'duration_periods' => 1,
            'match_status' => 'unmatched',
            'room_source_conflict' => false,
            'resolved_by_waka' => false,
        ]);

        $response = $this->patchJson("/api/schedule-imports/{$import->id}/rows/{$row->id}", [
            'exclude' => true,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $row->id,
                    'match_status' => 'duplicate',
                    'resolved_by_waka' => true,
                ],
            ]);
    }

    public function test_confirm_fails_with_invalid_password(): void
    {
        Sanctum::actingAs($this->waka);

        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'file_path_kelas' => 'test/kelas.pdf',
            'file_path_ruangan' => 'test/ruangan.pdf',
            'status' => 'preview_ready',
        ]);

        $response = $this->postJson("/api/schedule-imports/{$import->id}/confirm", [
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    public function test_confirm_commits_matched_rows_and_soft_deletes_cycle_schedules(): void
    {
        Sanctum::actingAs($this->waka);

        // Pre-existing schedule in cycle 1 (should be soft-deleted)
        $oldScheduleCycle1 = Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 2,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        // Pre-existing schedule in cycle 2 (must NOT be touched)
        $oldScheduleCycle2 = Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 2,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 2,
            'source' => 'manual',
        ]);

        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'file_path_kelas' => 'imports/schedules/test_kelas.pdf',
            'file_path_ruangan' => 'imports/schedules/test_ruangan.pdf',
            'status' => 'preview_ready',
        ]);

        // Fake create files on local storage to verify deletion
        Storage::disk('local')->put($import->file_path_kelas, 'fake content');
        Storage::disk('local')->put($import->file_path_ruangan, 'fake content');

        // Matched row (should become schedule)
        ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => ['mapel_mentah' => 'Matematika'],
            'matched_class_id' => $this->class->id,
            'matched_teacher_id' => $this->teacher->id,
            'matched_room_id' => $this->room->id,
            'matched_subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 3,
            'match_status' => 'matched',
            'room_source_conflict' => false,
            'resolved_by_waka' => false,
        ]);

        // Unmatched row (should NOT become schedule)
        ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => ['mapel_mentah' => 'Fisika'],
            'matched_class_id' => null,
            'matched_teacher_id' => null,
            'matched_room_id' => null,
            'matched_subject_id' => null,
            'day_of_week' => 1,
            'period_number' => 4,
            'duration_periods' => 2,
            'match_status' => 'unmatched',
            'room_source_conflict' => false,
            'resolved_by_waka' => false,
        ]);

        $response = $this->postJson("/api/schedule-imports/{$import->id}/confirm", [
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'import_id' => $import->id,
                    'cycle_type' => 1,
                    'inserted_schedules_count' => 1,
                ],
            ]);

        // Verify old schedule cycle 1 is soft-deleted
        $this->assertSoftDeleted('schedules', ['id' => $oldScheduleCycle1->id]);

        // Verify cycle 2 schedule remains intact
        $this->assertDatabaseHas('schedules', [
            'id' => $oldScheduleCycle2->id,
            'deleted_at' => null,
        ]);

        // Verify new imported schedule was inserted
        $this->assertDatabaseHas('schedules', [
            'class_id' => $this->class->id,
            'teacher_id' => $this->teacher->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'cycle_type' => 1,
            'source' => 'imported',
            'import_batch_id' => $import->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 3,
            'deleted_at' => null,
        ]);

        // Verify import record updated and physical files deleted
        $this->assertDatabaseHas('schedule_imports', [
            'id' => $import->id,
            'status' => 'confirmed',
            'file_path_kelas' => null,
            'file_path_ruangan' => null,
        ]);

        Storage::assertMissing('imports/schedules/test_kelas.pdf');
        Storage::assertMissing('imports/schedules/test_ruangan.pdf');
    }

    public function test_waka_can_cancel_draft_import(): void
    {
        Sanctum::actingAs($this->waka);

        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'file_path_kelas' => 'imports/schedules/cancel_kelas.pdf',
            'file_path_ruangan' => 'imports/schedules/cancel_ruangan.pdf',
            'status' => 'preview_ready',
        ]);

        Storage::disk('local')->put($import->file_path_kelas, 'cancel content');
        Storage::disk('local')->put($import->file_path_ruangan, 'cancel content');

        ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => ['mapel_mentah' => 'Matematika'],
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'match_status' => 'unmatched',
        ]);

        $response = $this->deleteJson("/api/schedule-imports/{$import->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Draft import jadwal berhasil dibatalkan.',
            ]);

        $this->assertDatabaseMissing('schedule_imports', ['id' => $import->id]);
        $this->assertDatabaseMissing('schedule_import_rows', ['import_id' => $import->id]);
        Storage::assertMissing('imports/schedules/cancel_kelas.pdf');
        Storage::assertMissing('imports/schedules/cancel_ruangan.pdf');
    }

    public function test_cannot_cancel_already_confirmed_import(): void
    {
        Sanctum::actingAs($this->waka);

        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'file_path_kelas' => null,
            'file_path_ruangan' => null,
            'status' => 'confirmed',
        ]);

        $response = $this->deleteJson("/api/schedule-imports/{$import->id}");

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Import yang sudah dikonfirmasi tidak dapat dibatalkan.',
            ]);
    }

    public function test_reimport_update_replaces_old_schedule_without_false_positive_conflict(): void
    {
        Sanctum::actingAs($this->waka);

        // 1. Create existing active schedule for Putaran 1
        Schedule::create([
            'class_id' => $this->class->id,
            'teacher_id' => $this->teacher->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'cycle_type' => 1,
            'source' => 'imported',
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
        ]);

        // 2. Create import batch for revised Putaran 1
        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'status' => 'preview_ready',
        ]);

        $row = ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => ['mapel_mentah' => 'Matematika'],
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 3,
            'match_status' => 'unmatched',
        ]);

        // 3. Resolve row for the same class (update scenario)
        $response = $this->patchJson("/api/schedule-imports/{$import->id}/rows/{$row->id}", [
            'matched_class_id' => $this->class->id,
            'matched_teacher_id' => $this->teacher->id,
            'matched_room_id' => $this->room->id,
            'matched_subject_id' => $this->subject->id,
        ]);

        $response->assertStatus(200);
        $this->assertEquals('matched', $response->json('data.match_status'));

        // 4. Confirm import
        $confirmRes = $this->postJson("/api/schedule-imports/{$import->id}/confirm", [
            'password' => 'password123',
        ]);

        $confirmRes->assertStatus(200);

        // Verify only 1 active schedule exists for this class (no duplication, old one replaced)
        $activeSchedules = Schedule::where('class_id', $this->class->id)
            ->where('cycle_type', 1)
            ->get();

        $this->assertCount(1, $activeSchedules);
        $this->assertEquals(3, $activeSchedules->first()->duration_periods);
    }

    public function test_reimport_detects_real_conflict_against_other_active_classes(): void
    {
        Sanctum::actingAs($this->waka);

        $otherClass = Classes::create([
            'name' => 'XI RPL 2',
            'level' => 11,
        ]);

        // Teacher is busy teaching otherClass in DB
        Schedule::create([
            'class_id' => $otherClass->id,
            'teacher_id' => $this->teacher->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'cycle_type' => 1,
            'source' => 'imported',
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
        ]);

        // New import batch only updates $this->class (not $otherClass)
        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'status' => 'preview_ready',
        ]);

        $row = ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => ['mapel_mentah' => 'Matematika'],
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'match_status' => 'unmatched',
        ]);

        // Resolving to $this->class with $this->teacher collides with active schedule of $otherClass
        $response = $this->patchJson("/api/schedule-imports/{$import->id}/rows/{$row->id}", [
            'matched_class_id' => $this->class->id,
            'matched_teacher_id' => $this->teacher->id,
            'matched_room_id' => $this->room->id,
            'matched_subject_id' => $this->subject->id,
        ]);

        $response->assertStatus(200);
        // Must be flagged as conflict because $otherClass is NOT in this import batch
        $this->assertEquals('conflict', $response->json('data.match_status'));
    }

    public function test_reimport_preserves_unrelated_class_schedules(): void
    {
        Sanctum::actingAs($this->waka);

        $unrelatedClass = Classes::create([
            'name' => 'XII TKJ 1',
            'level' => 12,
        ]);

        $otherTeacher = User::create([
            'name' => 'Guru Lain',
            'email' => 'gurulain@example.com',
            'nis_nip' => '198501012010011003',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        // Unrelated schedule on cycle 1
        $unrelatedSchedule = Schedule::create([
            'class_id' => $unrelatedClass->id,
            'teacher_id' => $otherTeacher->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'cycle_type' => 1,
            'source' => 'imported',
            'day_of_week' => 2,
            'period_number' => 5,
            'duration_periods' => 2,
        ]);

        // Old schedule for target class on cycle 1
        $targetOldSchedule = Schedule::create([
            'class_id' => $this->class->id,
            'teacher_id' => $this->teacher->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'cycle_type' => 1,
            'source' => 'imported',
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
        ]);

        // Import batch targeting ONLY $this->class
        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'status' => 'preview_ready',
        ]);

        $row = ScheduleImportRow::create([
            'import_id' => $import->id,
            'matched_class_id' => $this->class->id,
            'matched_teacher_id' => $this->teacher->id,
            'matched_room_id' => $this->room->id,
            'matched_subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 3,
            'match_status' => 'matched',
            'raw_data' => [],
        ]);

        $this->postJson("/api/schedule-imports/{$import->id}/confirm", [
            'password' => 'password123',
        ])->assertStatus(200);

        // Verify target old schedule was soft-deleted
        $this->assertSoftDeleted('schedules', ['id' => $targetOldSchedule->id]);

        // Verify unrelated schedule was NOT touched
        $this->assertDatabaseHas('schedules', [
            'id' => $unrelatedSchedule->id,
            'deleted_at' => null,
        ]);
    }

    public function test_resolve_row_applies_bulk_to_same_raw_teacher_name(): void
    {
        Sanctum::actingAs($this->waka);

        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'status' => 'preview_ready',
        ]);

        $row1 = ScheduleImportRow::create([
            'import_id' => $import->id,
            'matched_class_id' => $this->class->id,
            'matched_teacher_id' => null,
            'matched_room_id' => $this->room->id,
            'matched_subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'match_status' => 'unmatched',
            'raw_data' => ['guru_mentah' => 'MUHAMMAD FAUZI, S.Pd.'],
        ]);

        $row2 = ScheduleImportRow::create([
            'import_id' => $import->id,
            'matched_class_id' => $this->class->id,
            'matched_teacher_id' => null,
            'matched_room_id' => $this->room->id,
            'matched_subject_id' => $this->subject->id,
            'day_of_week' => 2,
            'period_number' => 3,
            'duration_periods' => 2,
            'match_status' => 'unmatched',
            'raw_data' => ['guru_mentah' => 'MUHAMMAD FAUZI, S.Pd.'],
        ]);

        $response = $this->patchJson("/api/schedule-imports/{$import->id}/rows/{$row1->id}", [
            'matched_teacher_id' => $this->teacher->id,
            'apply_to_same_teacher_raw' => true,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('meta.applied_bulk_count', 1);

        $this->assertEquals($this->teacher->id, $row1->fresh()->matched_teacher_id);
        $this->assertEquals($this->teacher->id, $row2->fresh()->matched_teacher_id);
        $this->assertEquals('matched', $row1->fresh()->match_status);
        $this->assertEquals('matched', $row2->fresh()->match_status);
    }

    public function test_resolve_teachers_bulk_maps_multiple_raw_teachers(): void
    {
        Sanctum::actingAs($this->waka);

        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'status' => 'preview_ready',
        ]);

        $row1 = ScheduleImportRow::create([
            'import_id' => $import->id,
            'matched_class_id' => $this->class->id,
            'matched_teacher_id' => null,
            'matched_room_id' => $this->room->id,
            'matched_subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'match_status' => 'unmatched',
            'raw_data' => ['guru_mentah' => 'MUHAMMAD FAUZI, S.Pd.'],
        ]);

        $row2 = ScheduleImportRow::create([
            'import_id' => $import->id,
            'matched_class_id' => $this->class->id,
            'matched_teacher_id' => null,
            'matched_room_id' => $this->room->id,
            'matched_subject_id' => $this->subject->id,
            'day_of_week' => 2,
            'period_number' => 3,
            'duration_periods' => 2,
            'match_status' => 'unmatched',
            'raw_data' => ['guru_mentah' => 'MUHAMMAD FAUZI, S.Pd.'],
        ]);

        $response = $this->postJson("/api/schedule-imports/{$import->id}/resolve-teachers-bulk", [
            'mappings' => [
                [
                    'raw_teacher_name' => 'MUHAMMAD FAUZI, S.Pd.',
                    'teacher_id' => $this->teacher->id,
                ],
            ],
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.updated_rows', 2);

        $this->assertEquals($this->teacher->id, $row1->fresh()->matched_teacher_id);
        $this->assertEquals($this->teacher->id, $row2->fresh()->matched_teacher_id);
        $this->assertEquals('matched', $row1->fresh()->match_status);
        $this->assertEquals('matched', $row2->fresh()->match_status);
    }

    public function test_teacher_matcher_service_auto_matches_high_confidence_teacher(): void
    {
        $matcher = new \App\Services\TeacherMatcherService();
        $teachers = collect([$this->teacher]);

        // Input nama dari PDF memiliki gelar tambahan "Dwi Lesmiyati, M.Pd."
        $result = $matcher->match($teachers, 'Dwi Lesmiyati, M.Pd.');

        $this->assertEquals('auto_matched', $result['status']);
        $this->assertNotNull($result['matched_teacher']);
        $this->assertEquals($this->teacher->id, $result['matched_teacher']->id);
    }

    public function test_schedule_conflict_service_in_memory_detects_collision(): void
    {
        $conflictService = new \App\Services\ScheduleConflictService();
        $existing = collect([
            (object) [
                'day_of_week' => 1,
                'period_number' => 1,
                'duration_periods' => 2,
                'teacher_id' => $this->teacher->id,
                'class_id' => $this->class->id,
                'room_id' => $this->room->id,
            ],
        ]);

        // Same teacher, overlapping period (JP 2)
        $hasConflict = $conflictService->hasConflictInMemory($existing, [
            'day_of_week' => 1,
            'period_number' => 2,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => 999,
            'room_id' => 999,
        ]);

        $this->assertTrue($hasConflict);

        // Different day - no conflict
        $noConflict = $conflictService->hasConflictInMemory($existing, [
            'day_of_week' => 2,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => 999,
            'room_id' => 999,
        ]);

        $this->assertFalse($noConflict);
    }

    public function test_show_endpoint_returns_error_message_when_import_failed(): void
    {
        Sanctum::actingAs($this->waka);

        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'status' => 'failed',
            'error_message' => 'Berkas PDF rusak atau tabel tidak terdeteksi.',
        ]);

        $response = $this->getJson("/api/schedule-imports/{$import->id}");

        $response->assertStatus(200);
        $response->assertJson([
            'success' => false,
            'message' => 'Berkas PDF rusak atau tabel tidak terdeteksi.',
            'data' => [
                'id' => $import->id,
                'status' => 'failed',
                'error_message' => 'Berkas PDF rusak atau tabel tidak terdeteksi.',
            ],
        ]);
    }
}
