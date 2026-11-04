<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\TeacherAssignment;
use App\Models\User;
use App\Services\TeacherAssignmentImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\SimpleExcel\SimpleExcelWriter;
use Tests\TestCase;

class TeacherAssignmentImportTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher1;
    private User $teacher2;
    private User $counselor1;
    private Classes $classA;
    private Classes $classB;

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

        $this->teacher1 = User::create([
            'name' => 'ERIDHA DEWI SEPITASARI, S.Pd.',
            'email' => 'eridha@example.com',
            'nis_nip' => '197901012015091064',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->teacher2 = User::create([
            'name' => 'SULARDI, S.Pd.',
            'email' => 'sulardi@example.com',
            'nis_nip' => '198007152019051050',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->counselor1 = User::create([
            'name' => 'CANDRA RAHADIAN, S.Pd',
            'email' => 'candra@example.com',
            'nis_nip' => '197507152005011090',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->classA = Classes::create(['name' => 'X AK 1', 'level' => 10]);
        $this->classB = Classes::create(['name' => 'X AK 2', 'level' => 10]);
    }

    /**
     * Helper untuk membuat berkas Excel mock dengan baris custom
     */
    private function createMockExcel(array $dataRows): string
    {
        $tempPath = tempnam(sys_get_temp_dir(), 'test_asgn_') . '.xlsx';
        $writer = SimpleExcelWriter::create($tempPath);

        // Header kosong/metadata baris 1-3
        $writer->addRow(['DAFTAR WALI KELAS DAN GURU BK', '', '', '']);
        $writer->addRow(['SEMESTER GANJIL', '', '', '']);
        $writer->addRow(['NO', 'KELAS', 'NAMA WALI KELAS', 'NAMA GURU BK']);

        // Data rows
        foreach ($dataRows as $r) {
            $writer->addRow($r);
        }

        // Footer
        $writer->addRow(['', 'KETERANGAN :', '', '']);
        $writer->addRow(['1.', 'DKV = Desain Komunikasi Visual', '', '']);
        $writer->close();

        return $tempPath;
    }

    /**
     * Skenario 1: File Excel valid dengan berkas asli sekolah
     */
    public function test_import_preview_with_valid_official_school_excel(): void
    {
        Sanctum::actingAs($this->waka);

        $officialExcelPath = base_path('MD/xlsx/WALI KELAS 2026.2027.xlsx');
        if (!file_exists($officialExcelPath)) {
            $this->markTestSkipped('Berkas resmi sekolah tidak ditemukan di MD/xlsx.');
        }

        $uploadedFile = new UploadedFile(
            $officialExcelPath,
            'WALI KELAS 2026.2027.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );

        $res = $this->postJson('/api/teachers/assignments/import-preview', [
            'file' => $uploadedFile,
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonStructure([
                'success',
                'message',
                'preview_token',
                'expires_at',
                'summary' => [
                    'total_rows',
                    'exact_matched',
                    'fuzzy_matched',
                    'ambiguous',
                    'unmatched',
                    'ready_to_commit',
                ],
                'data' => [
                    '*' => [
                        'row_number',
                        'no',
                        'raw_class',
                        'clean_class',
                        'class_id',
                        'class_status',
                        'wali_kelas',
                        'guru_bk',
                    ],
                ],
            ]);

        $this->assertEquals(48, $res->json('summary.total_rows'));
    }

    /**
     * Skenario 2: File dengan format atau struktur tidak sesuai (misal berkas non-xlsx)
     */
    public function test_import_preview_rejects_invalid_file_extension(): void
    {
        Sanctum::actingAs($this->waka);

        $fakeFile = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');

        $res = $this->postJson('/api/teachers/assignments/import-preview', [
            'file' => $fakeFile,
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    /**
     * Skenario 3: Nama guru memiliki variasi ejaan (fuzzy match)
     */
    public function test_fuzzy_matching_detects_spelling_variations(): void
    {
        Sanctum::actingAs($this->waka);

        // Guru di database: ALIVI SAZKIA HAMIE, S.Pd
        User::create([
            'name' => 'ALIVI SAZKIA HAMIE, S.Pd',
            'email' => 'alivi@example.com',
            'nis_nip' => '197610222006032091',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        // Di Excel tertulis 'ALIVI SAZKIA HAWIE, S.Pd' (W vs M)
        $excelPath = $this->createMockExcel([
            [1, 'X AK 1', 'ERIDHA DEWI SEPITASARI, S.Pd.', 'ALIVI SAZKIA HAWIE, S.Pd'],
        ]);

        $uploaded = new UploadedFile($excelPath, 'test.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $res = $this->postJson('/api/teachers/assignments/import-preview', [
            'file' => $uploaded,
        ]);

        $res->assertStatus(200);
        $bkData = $res->json('data.0.guru_bk');
        $this->assertEquals('fuzzy_match', $bkData['status']);
        $this->assertEquals('ALIVI SAZKIA HAMIE, S.Pd', $bkData['matched_teacher']['name']);
        $this->assertGreaterThanOrEqual(0.8, $bkData['confidence']);
    }

    /**
     * Skenario 4: Nama guru tidak ditemukan pada master guru aktif
     */
    public function test_unmatched_teacher_marked_as_not_found(): void
    {
        Sanctum::actingAs($this->waka);

        $excelPath = $this->createMockExcel([
            [1, 'X AK 1', 'GURU MISTERIUS TIDAK ADA, S.Pd', 'CANDRA RAHADIAN, S.Pd'],
        ]);

        $uploaded = new UploadedFile($excelPath, 'test.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $res = $this->postJson('/api/teachers/assignments/import-preview', [
            'file' => $uploaded,
        ]);

        $res->assertStatus(200);
        $waliData = $res->json('data.0.wali_kelas');
        $this->assertEquals('not_found', $waliData['status']);
        $this->assertNull($waliData['matched_teacher']);
        $this->assertEquals(0, $waliData['confidence']);
    }

    /**
     * Skenario 5: Satu nama guru memiliki beberapa kandidat dengan kemiripan (ambiguous)
     */
    public function test_ambiguous_teacher_provides_candidates_without_auto_selection(): void
    {
        Sanctum::actingAs($this->waka);

        // Dua guru dengan nama sangat mirip di DB
        $gA = User::create([
            'name' => 'BUDI SANTOSO, S.Pd.',
            'email' => 'budi1@example.com',
            'nis_nip' => '198001012010011021',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $gB = User::create([
            'name' => 'BUDI SANTOSA, S.Pd.',
            'email' => 'budi2@example.com',
            'nis_nip' => '198001012010011022',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $excelPath = $this->createMockExcel([
            [1, 'X AK 1', 'BUDI SANTOSI, S.Pd.', 'CANDRA RAHADIAN, S.Pd'],
        ]);

        $uploaded = new UploadedFile($excelPath, 'test.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $res = $this->postJson('/api/teachers/assignments/import-preview', [
            'file' => $uploaded,
        ]);

        $res->assertStatus(200);
        $waliData = $res->json('data.0.wali_kelas');
        $this->assertEquals('ambiguous', $waliData['status']);
        $this->assertNull($waliData['matched_teacher']);
        $this->assertGreaterThanOrEqual(2, count($waliData['candidates']));
    }

    /**
     * Skenario 6: Kelas tidak ditemukan dalam database
     */
    public function test_unmatched_class_marked_as_invalid(): void
    {
        Sanctum::actingAs($this->waka);

        $excelPath = $this->createMockExcel([
            [1, 'X KELAS GAIB 99', 'ERIDHA DEWI SEPITASARI, S.Pd.', 'CANDRA RAHADIAN, S.Pd'],
        ]);

        $uploaded = new UploadedFile($excelPath, 'test.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $res = $this->postJson('/api/teachers/assignments/import-preview', [
            'file' => $uploaded,
        ]);

        $res->assertStatus(200);
        $row = $res->json('data.0');
        $this->assertEquals('not_found', $row['class_status']);
        $this->assertNull($row['class_id']);
    }

    /**
     * Skenario 7: Terjadi duplikasi penugasan Wali Kelas di dalam payload commit
     */
    public function test_import_commit_rejects_duplicate_wali_kelas_in_payload(): void
    {
        Sanctum::actingAs($this->waka);

        $service = app(TeacherAssignmentImportService::class);
        $excelPath = $this->createMockExcel([
            [1, 'X AK 1', 'ERIDHA DEWI SEPITASARI, S.Pd.', 'CANDRA RAHADIAN, S.Pd'],
            [2, 'X AK 2', 'SULARDI, S.Pd.', 'CANDRA RAHADIAN, S.Pd'],
        ]);
        $preview = $service->generatePreview($excelPath);

        // Coba kirim payload di mana teacher1 dijadikan wali kelas di KEDUA kelas A dan B
        $res = $this->postJson('/api/teachers/assignments/import-commit', [
            'preview_token' => $preview['preview_token'],
            'items' => [
                [
                    'class_id' => $this->classA->id,
                    'wali_teacher_id' => $this->teacher1->id,
                    'bk_teacher_id' => $this->counselor1->id,
                ],
                [
                    'class_id' => $this->classB->id,
                    'wali_teacher_id' => $this->teacher1->id, // Duplikat!
                    'bk_teacher_id' => $this->counselor1->id,
                ],
            ],
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['items.1.wali_teacher_id']);
    }

    /**
     * Skenario 8: Satu guru sudah menjadi Wali Kelas di kelas lain di database
     */
    public function test_import_commit_rejects_if_wali_already_assigned_elsewhere(): void
    {
        Sanctum::actingAs($this->waka);

        // Kelas C di luar data import
        $classC = Classes::create(['name' => 'X RPL 3', 'level' => 10]);

        // Teacher 1 sudah menjadi wali kelas di Kelas C
        TeacherAssignment::create([
            'user_id' => $this->teacher1->id,
            'type' => 'wali_kelas',
            'class_id' => $classC->id,
        ]);

        $service = app(TeacherAssignmentImportService::class);
        $excelPath = $this->createMockExcel([
            [1, 'X AK 1', 'ERIDHA DEWI SEPITASARI, S.Pd.', 'CANDRA RAHADIAN, S.Pd'],
        ]);
        $preview = $service->generatePreview($excelPath);

        // Coba commit teacher1 ke Kelas A
        $res = $this->postJson('/api/teachers/assignments/import-commit', [
            'preview_token' => $preview['preview_token'],
            'items' => [
                [
                    'class_id' => $this->classA->id,
                    'wali_teacher_id' => $this->teacher1->id,
                    'bk_teacher_id' => $this->counselor1->id,
                ],
            ],
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['items']);
    }

    /**
     * Skenario 9: Preview tidak mengubah database sama sekali
     */
    public function test_import_preview_does_not_modify_database(): void
    {
        Sanctum::actingAs($this->waka);

        $initialAssignmentsCount = TeacherAssignment::count();

        $excelPath = $this->createMockExcel([
            [1, 'X AK 1', 'ERIDHA DEWI SEPITASARI, S.Pd.', 'CANDRA RAHADIAN, S.Pd'],
            [2, 'X AK 2', 'SULARDI, S.Pd.', 'CANDRA RAHADIAN, S.Pd'],
        ]);
        $uploaded = new UploadedFile($excelPath, 'test.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $res = $this->postJson('/api/teachers/assignments/import-preview', [
            'file' => $uploaded,
        ]);
        $res->assertStatus(200);

        // Hitung baris di database: wajib sama persis
        $this->assertEquals($initialAssignmentsCount, TeacherAssignment::count());
    }

    /**
     * Skenario 10: Commit gagal di tengah proses dan seluruh perubahan berhasil di-rollback
     */
    public function test_import_commit_rolls_back_entirely_on_failure(): void
    {
        Sanctum::actingAs($this->waka);

        $initialCount = TeacherAssignment::count();

        $service = app(TeacherAssignmentImportService::class);
        $excelPath = $this->createMockExcel([
            [1, 'X AK 1', 'ERIDHA DEWI SEPITASARI, S.Pd.', 'CANDRA RAHADIAN, S.Pd'],
            [2, 'X AK 2', 'SULARDI, S.Pd.', 'CANDRA RAHADIAN, S.Pd'],
        ]);
        $preview = $service->generatePreview($excelPath);

        // Coba kirim item ke-2 dengan class_id tidak valid (999999)
        $res = $this->postJson('/api/teachers/assignments/import-commit', [
            'preview_token' => $preview['preview_token'],
            'items' => [
                [
                    'class_id' => $this->classA->id,
                    'wali_teacher_id' => $this->teacher1->id,
                    'bk_teacher_id' => $this->counselor1->id,
                ],
                [
                    'class_id' => 999999, // ID invalid
                    'wali_teacher_id' => $this->teacher2->id,
                    'bk_teacher_id' => $this->counselor1->id,
                ],
            ],
        ]);

        $res->assertStatus(422);

        // Pastikan Item 1 TIDAK TERSIMPAN di database (100% rollback)
        $this->assertEquals($initialCount, TeacherAssignment::count());
    }

    /**
     * Skenario 11: Commit ulang dengan token preview yang sama tidak menggandakan data (idempotency)
     */
    public function test_import_commit_prevents_duplicate_commit_with_same_token(): void
    {
        Sanctum::actingAs($this->waka);

        $service = app(TeacherAssignmentImportService::class);
        $excelPath = $this->createMockExcel([
            [1, 'X AK 1', 'ERIDHA DEWI SEPITASARI, S.Pd.', 'CANDRA RAHADIAN, S.Pd'],
            [2, 'X AK 2', 'SULARDI, S.Pd.', 'CANDRA RAHADIAN, S.Pd'],
        ]);
        $preview = $service->generatePreview($excelPath);

        $payload = [
            'preview_token' => $preview['preview_token'],
            'items' => [
                [
                    'class_id' => $this->classA->id,
                    'wali_teacher_id' => $this->teacher1->id,
                    'bk_teacher_id' => $this->counselor1->id,
                ],
                [
                    'class_id' => $this->classB->id,
                    'wali_teacher_id' => $this->teacher2->id,
                    'bk_teacher_id' => $this->counselor1->id,
                ],
            ],
        ];

        // 1. Commit pertama -> Sukses (200)
        $res1 = $this->postJson('/api/teachers/assignments/import-commit', $payload);
        $res1->assertStatus(200)
            ->assertJson(['success' => true]);

        // 2. Commit kedua dengan token yang sama -> Wajib Ditolak (409 Conflict / 410 Gone)
        $res2 = $this->postJson('/api/teachers/assignments/import-commit', $payload);
        $this->assertTrue(in_array($res2->status(), [409, 410], true));
    }
}
