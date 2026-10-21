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

class MasterDataPrerequisiteRuleTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;
    private User $student;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Queue::fake();

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->teacher = User::create([
            'name' => 'Budi Santoso',
            'email' => 'budi@example.com',
            'nis_nip' => '198501012010011003',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->student = User::create([
            'name' => 'Siswa Test',
            'email' => 'siswa@example.com',
            'nis_nip' => '12345678',
            'role' => 'student',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
    }

    public function test_manual_schedule_creation_is_rejected_when_master_data_is_completely_empty(): void
    {
        // Hapus guru dari master data agar benar-benar kosong
        User::where('role', 'teacher')->delete();

        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/schedules', [
            'cycle_type' => 1,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => 999,
            'class_id' => 999,
            'room_id' => 999,
            'subject_id' => 999,
            'password' => 'password123',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'errors' => ['classes', 'teachers', 'subjects', 'rooms'],
                'meta' => ['missing_entities'],
            ]);

        $this->assertEqualsCanonicalizing(
            ['classes', 'teachers', 'subjects', 'rooms'],
            $response->json('meta.missing_entities')
        );
        $this->assertEquals(0, Schedule::count());
    }

    public function test_manual_schedule_creation_is_rejected_when_some_master_data_is_missing(): void
    {
        // Hanya sediakan Kelas dan Guru, Ruangan & Mata Pelajaran dibiarkan kosong
        Classes::create(['name' => 'X RPL 1', 'level' => 10]);

        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/schedules', [
            'cycle_type' => 1,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => 1,
            'room_id' => 999,
            'subject_id' => 999,
            'password' => 'password123',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.',
            ]);

        $this->assertEqualsCanonicalizing(
            ['subjects', 'rooms'],
            $response->json('meta.missing_entities')
        );
        $this->assertArrayNotHasKey('classes', $response->json('errors'));
        $this->assertArrayNotHasKey('teachers', $response->json('errors'));
    }

    public function test_manual_schedule_creation_is_allowed_when_master_data_is_complete(): void
    {
        $class = Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        $room = Rooms::create(['name' => 'Lab Komputer 1', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Pemrograman Web']);

        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/schedules', [
            'cycle_type' => 1,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'teacher_id' => $this->teacher->id,
            'class_id' => $class->id,
            'room_id' => $room->id,
            'subject_id' => $subject->id,
            'password' => 'password123',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Jadwal berhasil dibuat',
            ]);

        $this->assertDatabaseHas('schedules', [
            'teacher_id' => $this->teacher->id,
            'class_id' => $class->id,
            'room_id' => $room->id,
            'subject_id' => $subject->id,
            'cycle_type' => 1,
            'day_of_week' => 1,
            'period_number' => 1,
        ]);
    }

    public function test_pdf_import_upload_is_rejected_when_master_data_is_empty(): void
    {
        User::where('role', 'teacher')->delete();

        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/schedule-imports', [
            'cycle_type' => 1,
            'file_kelas' => UploadedFile::fake()->create('jadwal_kelas.pdf', 100, 'application/pdf'),
            'file_ruangan' => UploadedFile::fake()->create('jadwal_ruangan.pdf', 100, 'application/pdf'),
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'errors' => ['classes', 'teachers', 'subjects', 'rooms'],
                'meta' => ['missing_entities'],
            ]);

        // Pastikan tidak ada file yang tersimpan ke storage dan tidak ada job yang di-dispatch
        Queue::assertNothingPushed();
        $this->assertEmpty(Storage::disk('local')->allFiles());
        $this->assertEquals(0, ScheduleImport::count());
    }

    public function test_pdf_import_upload_is_rejected_when_teachers_lack_fet_staff_id(): void
    {
        // Lengkapi master data kelas, ruangan, subject, dan guru, tapi belum ada guru dengan fet_staff_id
        Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        Rooms::create(['name' => 'Lab Komputer 1', 'capacity' => 36]);
        Subject::create(['name' => 'Pemrograman Web']);
        // $this->teacher memiliki fet_staff_id = null

        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/schedule-imports', [
            'cycle_type' => 1,
            'file_kelas' => UploadedFile::fake()->create('jadwal_kelas.pdf', 100, 'application/pdf'),
            'file_ruangan' => UploadedFile::fake()->create('jadwal_ruangan.pdf', 100, 'application/pdf'),
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.',
            ]);

        $this->assertContains('fet_staff_id', $response->json('meta.missing_entities'));
        $this->assertArrayHasKey('fet_staff_id', $response->json('errors'));

        Queue::assertNothingPushed();
        $this->assertEquals(0, ScheduleImport::count());
    }

    public function test_pdf_import_upload_is_allowed_when_master_data_and_fet_staff_id_are_present(): void
    {
        Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        Rooms::create(['name' => 'Lab Komputer 1', 'capacity' => 36]);
        Subject::create(['name' => 'Pemrograman Web']);
        $this->teacher->update(['fet_staff_id' => '34']);

        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/schedule-imports', [
            'cycle_type' => 1,
            'file_kelas' => UploadedFile::fake()->create('jadwal_kelas.pdf', 100, 'application/pdf'),
            'file_ruangan' => UploadedFile::fake()->create('jadwal_ruangan.pdf', 100, 'application/pdf'),
        ]);

        $response->assertStatus(202)
            ->assertJson([
                'success' => true,
                'message' => 'File jadwal diunggah. Sedang memproses...',
            ]);

        Queue::assertPushed(ParseSchedulePdfJob::class);
        $this->assertEquals(1, ScheduleImport::count());
    }

    public function test_confirm_import_is_rejected_when_matched_count_is_zero(): void
    {
        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'status' => 'preview_ready',
            'parser_version' => 'v1.0',
        ]);

        // Buat baris import yang hanya berstatus unmatched atau conflict
        ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => [
                'class_name' => 'X RPL 99',
                'teacher_name' => 'Guru Asing',
                'room_name' => 'Ruang Gaib',
                'subject_name' => 'Mapel Asing',
            ],
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'match_status' => 'unmatched',
        ]);

        ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => [
                'class_name' => 'X RPL 98',
                'teacher_name' => 'Guru Asing 2',
                'room_name' => 'Ruang Gaib 2',
                'subject_name' => 'Mapel Asing 2',
            ],
            'day_of_week' => 1,
            'period_number' => 3,
            'duration_periods' => 2,
            'match_status' => 'conflict',
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->postJson("/api/schedule-imports/{$import->id}/confirm", [
            'password' => 'password123',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Konfirmasi gagal. Tidak ada baris jadwal yang berstatus matched untuk dimasukkan ke jadwal aktif.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'errors' => ['import'],
            ]);

        $this->assertEquals(0, Schedule::count());
        $this->assertEquals('preview_ready', $import->fresh()->status);
    }

    public function test_confirm_import_is_allowed_when_matched_rows_exist(): void
    {
        $class = Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        $room = Rooms::create(['name' => 'Lab Komputer 1', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Pemrograman Web']);
        $this->teacher->update(['fet_staff_id' => '34']);

        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'status' => 'preview_ready',
            'parser_version' => 'v1.0',
        ]);

        ScheduleImportRow::create([
            'import_id' => $import->id,
            'raw_data' => [
                'class_name' => 'X RPL 1',
                'teacher_name' => 'Budi Santoso',
                'room_name' => 'Lab Komputer 1',
                'subject_name' => 'Pemrograman Web',
            ],
            'matched_class_id' => $class->id,
            'matched_teacher_id' => $this->teacher->id,
            'matched_room_id' => $room->id,
            'matched_subject_id' => $subject->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'match_status' => 'matched',
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->postJson("/api/schedule-imports/{$import->id}/confirm", [
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Import jadwal berhasil dikonfirmasi.',
                'data' => [
                    'import_id' => $import->id,
                    'cycle_type' => 1,
                    'inserted_schedules_count' => 1,
                ],
            ]);

        $this->assertEquals(1, Schedule::count());
        $this->assertEquals('confirmed', $import->fresh()->status);
    }

    public function test_non_waka_users_cannot_access_schedule_store_and_import(): void
    {
        Sanctum::actingAs($this->student);

        $resSchedule = $this->postJson('/api/schedules', []);
        $resSchedule->assertStatus(403);

        $resImport = $this->postJson('/api/schedule-imports', []);
        $resImport->assertStatus(403);
    }
}
