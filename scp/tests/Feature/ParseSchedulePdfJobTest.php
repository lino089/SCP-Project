<?php

namespace Tests\Feature;

use App\Jobs\ParseSchedulePdfJob;
use App\Models\Classes;
use App\Models\Rooms;
use App\Models\ScheduleImport;
use App\Models\ScheduleImportRow;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ParseSchedulePdfJobTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;

    protected function setUp(): void
    {
        parent::setUp();

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
    }

    public function test_parse_job_executes_python_parser_and_populates_rows(): void
    {
        $pathKelas = base_path('MD/PDF/Jadwal_Kelas.pdf');
        $pathRuangan = base_path('MD/PDF/Jadwal_Ruangan.pdf');

        if (!file_exists($pathKelas) || !file_exists($pathRuangan)) {
            $this->markTestSkipped('Sample PDF files not found in MD/PDF/.');
        }

        // Seed some known master data from the PDF
        // In Jadwal_Kelas.pdf page 2: X RPL 1, Senin JP 1-3 is Matematika by fet_staff_id 34 (DWI LESMIYATI, S.Pd.) in room 12
        $class = Classes::create([
            'name' => 'X RPL 1',
            'level' => 10,
        ]);

        $teacher = User::create([
            'name' => 'Dwi Lesmiyati',
            'email' => 'dwi.lesmiyati@example.com',
            'nis_nip' => '197501012000012001',
            'fet_staff_id' => '34',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $subject = Subject::create([
            'name' => 'Matematika',
        ]);

        $room = Rooms::create([
            'name' => 'Ruang 12',
            'capacity' => 36,
        ]);

        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'file_path_kelas' => $pathKelas,
            'file_path_ruangan' => $pathRuangan,
            'status' => 'uploaded',
        ]);

        $job = new ParseSchedulePdfJob($import->id);
        $job->handle();

        $import->refresh();

        // Status should transition to preview_ready
        $this->assertEquals('preview_ready', $import->status);

        // Rows should be extracted (should be > 700 rows)
        $totalRows = ScheduleImportRow::where('import_id', $import->id)->count();
        $this->assertGreaterThan(700, $totalRows);

        // Find the specific row for X RPL 1, Senin (day 1), period 1
        $matchedRow = ScheduleImportRow::where('import_id', $import->id)
            ->where('matched_class_id', $class->id)
            ->where('day_of_week', 1)
            ->where('period_number', 1)
            ->first();

        $this->assertNotNull($matchedRow);
        $this->assertEquals($teacher->id, $matchedRow->matched_teacher_id);
        $this->assertEquals($subject->id, $matchedRow->matched_subject_id);
        $this->assertEquals($room->id, $matchedRow->matched_room_id);
        $this->assertEquals(3, $matchedRow->duration_periods);
        $this->assertEquals('matched', $matchedRow->match_status);
        $this->assertFalse($matchedRow->room_source_conflict);

        // Verify that rows with missing master data are flagged as 'unmatched'
        $unmatchedCount = ScheduleImportRow::where('import_id', $import->id)
            ->where('match_status', 'unmatched')
            ->count();
        $this->assertGreaterThan(0, $unmatchedCount);

        // Verify that room conflicts are tracked
        $conflictRoomRows = ScheduleImportRow::where('import_id', $import->id)
            ->where('room_source_conflict', true)
            ->count();
        $this->assertGreaterThan(0, $conflictRoomRows);

        // Verify that auto-registration created other rooms, subjects, and classes from the PDF
        $this->assertGreaterThan(1, Rooms::count());
        $this->assertGreaterThan(1, Subject::count());
        $this->assertGreaterThan(1, Classes::count());

        // Verify that all auto-created rooms have default capacity of 36
        $autoRooms = Rooms::where('name', '!=', 'Ruang 12')->get();
        foreach ($autoRooms as $ar) {
            $this->assertEquals(36, $ar->capacity);
        }
    }

    public function test_auto_register_rooms_creates_rooms_with_default_capacity_and_prevents_duplicates(): void
    {
        $this->assertEquals(0, Rooms::count());

        $parseData = [
            ['ruang_final' => '12'],
            ['ruang_final' => 'L.16'],
            ['ruang_final' => 'OR'],
            ['ruang_final' => '12'], // duplicate
            ['ruang_final' => ''],   // empty
            ['ruang_final' => null], // null
            ['ruang_final' => '   '],// whitespace
        ];

        $job = new ParseSchedulePdfJob(1);
        $job->autoRegisterRooms($parseData);

        $this->assertEquals(3, Rooms::count());
        $this->assertDatabaseHas('rooms', ['name' => '12', 'capacity' => 36]);
        $this->assertDatabaseHas('rooms', ['name' => 'L.16', 'capacity' => 36]);
        $this->assertDatabaseHas('rooms', ['name' => 'OR', 'capacity' => 36]);
    }

    public function test_auto_register_rooms_reuses_existing_rooms_without_creating_duplicates(): void
    {
        // Ruangan sudah terdaftar sebelumnya dengan format nama lengkap
        Rooms::create(['name' => 'Ruang 12', 'capacity' => 40]);

        $parseData = [
            ['ruang_final' => '12'], // Kode angka 12 cocok dengan Ruang 12 via findRoom
        ];

        $job = new ParseSchedulePdfJob(1);
        $job->autoRegisterRooms($parseData);

        // Tidak boleh membuat record duplikat "12"
        $this->assertEquals(1, Rooms::count());
        $this->assertDatabaseHas('rooms', ['name' => 'Ruang 12', 'capacity' => 40]);
        $this->assertDatabaseMissing('rooms', ['name' => '12']);
    }

    public function test_auto_register_subjects_creates_subjects_and_ignores_placeholders(): void
    {
        $this->assertEquals(0, Subject::count());

        $parseData = [
            ['mapel_mentah' => 'Matematika'],
            ['mapel_mentah' => 'Bahasa Indonesia'],
            ['mapel_mentah' => 'Matematika'], // duplicate
            ['mapel_mentah' => '-x-'],        // placeholder
            ['mapel_mentah' => '---'],        // placeholder
            ['mapel_mentah' => ''],           // empty
            ['mapel_mentah' => null],         // null
            ['mapel_mentah' => '   '],        // whitespace
        ];

        $job = new ParseSchedulePdfJob(1);
        $job->autoRegisterSubjects($parseData);

        $this->assertEquals(2, Subject::count());
        $this->assertDatabaseHas('subjects', ['name' => 'Matematika']);
        $this->assertDatabaseHas('subjects', ['name' => 'Bahasa Indonesia']);
        $this->assertDatabaseMissing('subjects', ['name' => '-x-']);
        $this->assertDatabaseMissing('subjects', ['name' => '---']);
    }

    public function test_auto_register_classes_detects_levels_correctly_and_prevents_duplicates(): void
    {
        $this->assertEquals(0, Classes::count());

        $parseData = [
            ['kelas_mentah' => 'X RPL 1'],
            ['kelas_mentah' => 'XI TKJ 2'],
            ['kelas_mentah' => 'XII AKL 1'],
            ['kelas_mentah' => '10 PPLG 2'],
            ['kelas_mentah' => 'KELAS REGULER'], // fallback
            ['kelas_mentah' => 'X RPL 1'],        // duplicate
            ['kelas_mentah' => ''],               // empty
            ['kelas_mentah' => null],             // null
        ];

        $job = new ParseSchedulePdfJob(1);
        $job->autoRegisterClasses($parseData);

        $this->assertEquals(5, Classes::count());
        $this->assertDatabaseHas('classes', ['name' => 'X RPL 1', 'level' => '10']);
        $this->assertDatabaseHas('classes', ['name' => 'XI TKJ 2', 'level' => '11']);
        $this->assertDatabaseHas('classes', ['name' => 'XII AKL 1', 'level' => '12']);
        $this->assertDatabaseHas('classes', ['name' => '10 PPLG 2', 'level' => '10']);
        $this->assertDatabaseHas('classes', ['name' => 'KELAS REGULER', 'level' => '10']);
    }

    public function test_parse_job_auto_registers_rooms_and_subjects_when_initially_empty(): void
    {
        $pathKelas = base_path('MD/PDF/Jadwal_Kelas.pdf');
        $pathRuangan = base_path('MD/PDF/Jadwal_Ruangan.pdf');

        if (!file_exists($pathKelas) || !file_exists($pathRuangan)) {
            $this->markTestSkipped('Sample PDF files not found in MD/PDF/.');
        }

        // Tabel rooms dan subjects sengaja dibiarkan KOSONG sama sekali (0 record)
        $this->assertEquals(0, Rooms::count());
        $this->assertEquals(0, Subject::count());

        // Hanya sediakan guru ber-fet_staff_id (prasyarat Fase 5)
        $teacher = User::create([
            'name' => 'Dwi Lesmiyati',
            'email' => 'dwi.lesmiyati@example.com',
            'nis_nip' => '197501012000012001',
            'fet_staff_id' => '34',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $import = ScheduleImport::create([
            'waka_id' => $this->waka->id,
            'cycle_type' => 1,
            'file_path_kelas' => $pathKelas,
            'file_path_ruangan' => $pathRuangan,
            'status' => 'uploaded',
        ]);

        $job = new ParseSchedulePdfJob($import->id);
        $job->handle();

        $import->refresh();
        $this->assertEquals('preview_ready', $import->status);

        // Verifikasi rooms dan subjects terdaftar otomatis ke database
        $this->assertGreaterThan(0, Rooms::count());
        $this->assertGreaterThan(0, Subject::count());
        $this->assertGreaterThan(0, Classes::count());

        // Verifikasi ruangan 12 terdaftar otomatis dengan kapasitas 36
        $room12 = Rooms::where('name', '12')->first();
        $this->assertNotNull($room12);
        $this->assertEquals(36, $room12->capacity);

        // Verifikasi mapel Matematika terdaftar otomatis
        $this->assertDatabaseHas('subjects', ['name' => 'Matematika']);

        // Verifikasi baris Dwi Lesmiyati (Senin JP 1) berhasil berstatus 'matched'
        $matchedRow = ScheduleImportRow::where('import_id', $import->id)
            ->where('matched_teacher_id', $teacher->id)
            ->where('day_of_week', 1)
            ->where('period_number', 1)
            ->first();

        $this->assertNotNull($matchedRow);
        $this->assertEquals('matched', $matchedRow->match_status);
        $this->assertNotNull($matchedRow->matched_room_id);
        $this->assertNotNull($matchedRow->matched_subject_id);
        $this->assertNotNull($matchedRow->matched_class_id);
    }
}
