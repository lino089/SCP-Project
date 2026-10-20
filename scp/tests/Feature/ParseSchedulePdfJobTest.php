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
    }
}
