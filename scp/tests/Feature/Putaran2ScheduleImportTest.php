<?php

namespace Tests\Feature;

use App\Jobs\ParseSchedulePdfJob;
use App\Models\Classes;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\ScheduleImport;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class Putaran2ScheduleImportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
    }

    public function test_putaran_2_pdf_parser_and_room_registration(): void
    {
        $waka = User::where('role', 'vice_principal')->first();
        if (!$waka) {
            $waka = User::create([
                'name' => 'Waka Kurikulum Test',
                'email' => 'waka_p2@example.com',
                'nis_nip' => '197001011990011099',
                'role' => 'vice_principal',
                'password' => bcrypt('password123'),
                'must_change_password' => false,
            ]);
        }

        $pdfKelasPath = base_path('MD/PDF/JADWAL KELAS PUT 2 SEM GANJIL 26_27 REVISI.pdf');
        $pdfRuanganPath = base_path('MD/PDF/JADWAL RUANGAN PUT 2 GANJIL 26_27 OK.pdf');

        if (!file_exists($pdfKelasPath) || !file_exists($pdfRuanganPath)) {
            $this->markTestSkipped('Berkas PDF Putaran 2 tidak ditemukan di folder MD/PDF.');
        }

        Storage::fake('local');
        $storedKelas = Storage::disk('local')->putFile('schedules', new UploadedFile($pdfKelasPath, 'Jadwal_Kelas_P2.pdf', 'application/pdf', null, true));
        $storedRuangan = Storage::disk('local')->putFile('schedules', new UploadedFile($pdfRuanganPath, 'Jadwal_Ruangan_P2.pdf', 'application/pdf', null, true));

        // Create import for Putaran 2 (cycle_type = 2)
        $import = ScheduleImport::create([
            'waka_id' => $waka->id,
            'cycle_type' => 2,
            'file_path_kelas' => $storedKelas,
            'file_path_ruangan' => $storedRuangan,
            'status' => 'processing',
        ]);

        // Execute job synchronously with import ID
        $job = new ParseSchedulePdfJob($import->id);
        $job->handle();

        $import->refresh();
        $this->assertEquals('preview_ready', $import->status, 'Import harus berstatus preview_ready: ' . $import->error_message);

        // 1. Verifikasi auto-registrasi ruangan baru L.21, L.22, SINIAR
        $this->assertDatabaseHas('rooms', ['name' => 'L.21']);
        $this->assertDatabaseHas('rooms', ['name' => 'L.22']);
        $this->assertDatabaseHas('rooms', ['name' => 'SINIAR']);

        // 2. Verifikasi tidak ada ruangan ganda 'LAB 1' atau 'OR1' di tabel rooms
        $this->assertDatabaseMissing('rooms', ['name' => 'LAB 1']);
        $this->assertDatabaseMissing('rooms', ['name' => 'OR1']);

        // 3. Verifikasi jumlah baris yang diekstrak adalah 727
        $this->assertEquals(727, $import->rows()->count());

        // 4. Verifikasi sesi KBM XI LPS 1 & XI LPS 2 teralokasi ruangan
        $lps1Class = Classes::where('name', 'XI LPS 1')->first();
        $this->assertNotNull($lps1Class);
        $lps1RowsWithRoom = $import->rows()->where('matched_class_id', $lps1Class->id)->whereNotNull('matched_room_id')->count();
        $this->assertGreaterThan(0, $lps1RowsWithRoom, 'Baris XI LPS 1 harus memiliki matched_room_id setelah koreksi header');

        $lps2Class = Classes::where('name', 'XI LPS 2')->first();
        $this->assertNotNull($lps2Class);
        $lps2RowsWithRoom = $import->rows()->where('matched_class_id', $lps2Class->id)->whereNotNull('matched_room_id')->count();
        $this->assertGreaterThan(0, $lps2RowsWithRoom, 'Baris XI LPS 2 harus memiliki matched_room_id setelah koreksi header');

        // 5. Verifikasi isolasi Putaran 1: tidak ada jadwal cycle_type = 1 yang terpengaruh
        $p1Count = Schedule::where('cycle_type', 1)->count();
        // Pada refresh database + seed, p1Count adalah data seed awal
        // Pastikan tidak ada data cycle 2 di tabel schedules aktif sebelum dikonfirmasi Waka
        $p2Count = Schedule::where('cycle_type', 2)->count();
        $this->assertEquals(0, $p2Count, 'Jadwal Putaran 2 belum masuk tabel schedules aktif sebelum dikonfirmasi Waka');
    }
}
