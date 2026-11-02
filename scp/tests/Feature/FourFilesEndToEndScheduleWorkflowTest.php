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
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\SimpleExcel\SimpleExcelWriter;
use Tests\TestCase;

class FourFilesEndToEndScheduleWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@smkn1bantul.sch.id',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
    }

    /**
     * Menguji alur lengkap 4 berkas masukan (Four-Input Files Paradigm):
     * 1. Ingest Excel Guru (10 guru termasuk ID FET 34)
     * 2. Ingest Excel Siswa (30 siswa terbagi ke 3 rombel: X RPL 1, XI TKJ 2, XII AKL 1)
     * 3. Upload 2 PDF Jadwal FET (Jadwal Kelas & Jadwal Ruangan) saat rooms dan subjects masih 0
     * 4. Pemrosesan Worker ParseSchedulePdfJob (Auto-registration rooms cap=36, subjects, reload collections)
     * 5. Waka melakukan konfirmasi jadwal ke tabel schedules aktif
     */
    public function test_complete_four_files_schedule_ingestion_and_activation_workflow(): void
    {
        $pathKelas = base_path('MD/PDF/Jadwal_Kelas.pdf');
        $pathRuangan = base_path('MD/PDF/Jadwal_Ruangan.pdf');

        if (!file_exists($pathKelas) || !file_exists($pathRuangan)) {
            $this->markTestSkipped('Sample PDF files not found in MD/PDF/.');
        }

        Sanctum::actingAs($this->waka);

        // =========================================================================
        // LANGKAH 1: Ingest Excel Guru (10 Staf Pengajar)
        // =========================================================================
        $tempTeacherFile = tempnam(sys_get_temp_dir(), 'teacher_e2e_') . '.xlsx';
        $writerTeacher = SimpleExcelWriter::create($tempTeacherFile, 'xlsx');

        $teachersData = [];
        for ($i = 1; $i <= 10; $i++) {
            $fetId = ($i === 1) ? '34' : (string) $i;
            $name = ($i === 1) ? 'Dwi Lesmiyati, S.Pd.' : "Guru Pengajar {$i}";
            $nip = '19800101201001' . str_pad((string) $i, 4, '0', STR_PAD_LEFT);
            $teachersData[] = [
                'nip' => $nip,
                'name' => $name,
                'fet_staff_id' => $fetId,
                'mata_pelajaran' => 'Mata Pelajaran ' . $i,
            ];
        }
        $writerTeacher->addRows($teachersData);
        $writerTeacher->close();

        $uploadedTeacherFile = new UploadedFile(
            $tempTeacherFile,
            'guru_import.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );

        $resTeacher = $this->postJson('/api/teachers/import', [
            'file' => $uploadedTeacherFile,
        ]);

        $resTeacher->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Data guru berhasil diimpor.',
                'data' => [
                    'imported_count' => 10,
                ],
            ]);

        $this->assertEquals(10, User::where('role', 'teacher')->count());
        $dwiTeacher = User::where('fet_staff_id', '34')->first();
        $this->assertNotNull($dwiTeacher);
        $this->assertEquals('Dwi Lesmiyati, S.Pd.', $dwiTeacher->name);
        $this->assertTrue($dwiTeacher->must_change_password);

        // =========================================================================
        // LANGKAH 2: Ingest Excel Siswa (30 Siswa & Auto-Create 3 Rombel Kelas)
        // =========================================================================
        $tempStudentFile = tempnam(sys_get_temp_dir(), 'student_e2e_') . '.xlsx';
        $writerStudent = SimpleExcelWriter::create($tempStudentFile, 'xlsx');

        $studentsData = [];
        $classesTarget = ['X RPL 1', 'XI TKJ 2', 'XII AKL 1'];
        for ($i = 1; $i <= 30; $i++) {
            $classIdx = (int) floor(($i - 1) / 10);
            $targetClass = $classesTarget[$classIdx];
            $nis = (string) (12000 + $i);
            $studentsData[] = [
                'nis' => $nis,
                'name' => "Siswa Siswi {$i}",
                'class_name' => $targetClass,
                'gender' => ($i % 2 === 0) ? 'P' : 'L',
                'nisn' => '008' . str_pad((string) $i, 7, '0', STR_PAD_LEFT),
            ];
        }
        $writerStudent->addRows($studentsData);
        $writerStudent->close();

        $uploadedStudentFile = new UploadedFile(
            $tempStudentFile,
            'siswa_import.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );

        $resStudent = $this->postJson('/api/students/import', [
            'file' => $uploadedStudentFile,
        ]);

        $resStudent->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Data siswa dan kelas berhasil diimpor.',
                'data' => [
                    'classes_created' => 3,
                    'classes_existing' => 0,
                    'students_imported' => 30,
                    'parents_imported' => 30,
                ],
            ]);

        // Verifikasi kelas dan level hasil deteksi regex
        $this->assertEquals(3, Classes::count());
        $this->assertEquals('10', Classes::where('name', 'X RPL 1')->first()->level);
        $this->assertEquals('11', Classes::where('name', 'XI TKJ 2')->first()->level);
        $this->assertEquals('12', Classes::where('name', 'XII AKL 1')->first()->level);

        // Verifikasi akun siswa dan akun orang tua berpasangan
        $this->assertEquals(30, User::where('role', 'student')->count());
        $this->assertEquals(30, User::where('role', 'parent')->count());
        $sampleStudent = User::where('nis_nip', '12001')->first();
        $sampleParent = User::where('nis_nip', 'P-12001')->first();
        $this->assertNotNull($sampleStudent);
        $this->assertNotNull($sampleParent);
        $this->assertEquals($sampleStudent->id, $sampleParent->linked_student_id);
        $this->assertEquals('Wali Murid Siswa Siswi 1', $sampleParent->name);
        $this->assertNull($sampleParent->phone_number);

        // =========================================================================
        // LANGKAH 3: Upload 2 Berkas PDF Jadwal FET (Kondisi Rooms = 0, Subjects = 10 dari Guru)
        // =========================================================================
        $this->assertEquals(0, Rooms::count());
        $this->assertEquals(10, Subject::count());

        $uploadedPdfKelas = new UploadedFile($pathKelas, 'Jadwal_Kelas.pdf', 'application/pdf', null, true);
        $uploadedPdfRuangan = new UploadedFile($pathRuangan, 'Jadwal_Ruangan.pdf', 'application/pdf', null, true);

        $resUpload = $this->postJson('/api/schedule-imports', [
            'cycle_type' => 1,
            'file_kelas' => $uploadedPdfKelas,
            'file_ruangan' => $uploadedPdfRuangan,
        ]);

        $this->assertTrue(in_array($resUpload->status(), [200, 202]));
        $resUpload->assertJson([
            'success' => true,
            'data' => [
                'cycle_type' => 1,
            ],
        ]);

        $importId = $resUpload->json('data.id');
        $this->assertNotNull($importId);

        // =========================================================================
        // LANGKAH 4: Eksekusi Worker ParseSchedulePdfJob (Auto-Registration)
        // =========================================================================
        $job = new ParseSchedulePdfJob($importId);
        $job->handle();

        $import = ScheduleImport::find($importId);
        $this->assertEquals('preview_ready', $import->status);

        // Verifikasi auto-registration ruangan fisik dengan kapasitas 36
        $this->assertGreaterThan(0, Rooms::count());
        $room12 = Rooms::where('name', '12')->first();
        $this->assertNotNull($room12);
        $this->assertEquals(36, $room12->capacity);

        // Verifikasi auto-registration mata pelajaran dari PDF (bertambah dari 10 mapel guru sebelumnya)
        $this->assertGreaterThan(10, Subject::count());
        $this->assertDatabaseHas('subjects', ['name' => 'Matematika']);

        // Verifikasi baris jadwal Dwi Lesmiyati untuk X RPL 1 berstatus 'matched'
        $matchedRowsCount = ScheduleImportRow::where('import_id', $importId)
            ->where('match_status', 'matched')
            ->count();
        $this->assertGreaterThan(0, $matchedRowsCount);

        $dwiRow = ScheduleImportRow::where('import_id', $importId)
            ->where('matched_teacher_id', $dwiTeacher->id)
            ->where('day_of_week', 1)
            ->where('period_number', 1)
            ->first();

        $this->assertNotNull($dwiRow);
        $this->assertEquals('matched', $dwiRow->match_status);
        $this->assertEquals(Classes::where('name', 'X RPL 1')->first()->id, $dwiRow->matched_class_id);
        $this->assertEquals(Subject::where('name', 'Matematika')->first()->id, $dwiRow->matched_subject_id);
        $this->assertEquals($room12->id, $dwiRow->matched_room_id);

        // =========================================================================
        // LANGKAH 5: Waka Melakukan Konfirmasi Impor ke Jadwal Aktif
        // =========================================================================
        $resConfirm = $this->postJson("/api/schedule-imports/{$importId}/confirm", [
            'password' => 'password123',
        ]);

        $resConfirm->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Import jadwal berhasil dikonfirmasi.',
                'data' => [
                    'import_id' => $importId,
                    'cycle_type' => 1,
                ],
            ]);

        $insertedCount = $resConfirm->json('data.inserted_schedules_count');
        $this->assertGreaterThan(0, $insertedCount);

        // Verifikasi jadwal tersimpan di tabel schedules dengan relasi valid
        $this->assertEquals($insertedCount, Schedule::where('cycle_type', 1)->count());

        $activeSchedule = Schedule::where('cycle_type', 1)
            ->where('teacher_id', $dwiTeacher->id)
            ->where('day_of_week', 1)
            ->where('period_number', 1)
            ->first();

        $this->assertNotNull($activeSchedule);
        $this->assertEquals('imported', $activeSchedule->source);
        $this->assertEquals($importId, $activeSchedule->import_batch_id);

        // Bersihkan berkas sementara
        @unlink($tempTeacherFile);
        @unlink($tempStudentFile);
    }
}
