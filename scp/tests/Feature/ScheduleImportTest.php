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
}
