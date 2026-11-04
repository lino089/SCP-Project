<?php

namespace Tests\Feature;

use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\SimpleExcel\SimpleExcelWriter;
use Tests\TestCase;

class TeacherImportTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;
    private User $student;

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

        $this->teacher = User::create([
            'name' => 'Guru Eksis',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012010011002',
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

    private function createTempExcel(array $rows, ?array $headers = null): string
    {
        $tempPath = tempnam(sys_get_temp_dir(), 'test_teacher_') . '.xlsx';
        $writer = SimpleExcelWriter::create($tempPath);
        if ($headers !== null) {
            $writer->addHeader($headers);
        }
        if (!empty($rows)) {
            $writer->addRows($rows);
        }
        $writer->close();

        return $tempPath;
    }

    public function test_guest_cannot_download_teacher_template_or_import(): void
    {
        $this->getJson('/api/teachers/import-template')
            ->assertStatus(401);

        $this->postJson('/api/teachers/import')
            ->assertStatus(401);
    }

    public function test_non_waka_cannot_download_teacher_template_or_import(): void
    {
        Sanctum::actingAs($this->teacher);

        $this->getJson('/api/teachers/import-template')
            ->assertStatus(403);

        $this->postJson('/api/teachers/import')
            ->assertStatus(403);

        Sanctum::actingAs($this->student);

        $this->getJson('/api/teachers/import-template')
            ->assertStatus(403);

        $this->postJson('/api/teachers/import')
            ->assertStatus(403);
    }

    public function test_waka_can_download_teacher_import_template(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->get('/api/teachers/import-template');

        $response->assertStatus(200);
        $response->assertHeader('content-disposition', 'attachment; filename=guru_import_template.xlsx');
    }

    public function test_waka_can_import_valid_teachers_excel(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            [
                'no' => 1,
                'nip' => '199001012020011005',
                'nama' => 'Rahmat Hidayat, S.Kom.',
                'mapel' => 'Informatika',
            ],
            [
                'no' => 2,
                'nip' => '199202022021022006',
                'nama' => 'Siti Nurhaliza, M.Pd.',
                'mapel' => 'Bahasa Indonesia',
            ],
        ]);

        $file = new UploadedFile($filePath, 'guru.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Data guru berhasil diimpor.',
                'data' => [
                    'imported_count' => 2,
                ],
            ]);

        $teacher1 = User::where('nis_nip', '199001012020011005')->first();
        $this->assertNotNull($teacher1);
        $this->assertEquals('teacher', $teacher1->role);
        $this->assertEquals('Rahmat Hidayat, S.Kom.', $teacher1->name);
        $this->assertNull($teacher1->email);
        $this->assertNull($teacher1->phone_number);
        $this->assertNotNull($teacher1->subject_id);
        $this->assertEquals('Informatika', $teacher1->subject->name);
        $this->assertTrue($teacher1->must_change_password);
        // Password Awal: GuruSCP@1005!
        $this->assertTrue(Hash::check('GuruSCP@1005!', $teacher1->password));

        $teacher2 = User::where('nis_nip', '199202022021022006')->first();
        $this->assertNotNull($teacher2);
        $this->assertNull($teacher2->email);
        $this->assertNotNull($teacher2->subject_id);
        $this->assertEquals('Bahasa Indonesia', $teacher2->subject->name);
        $this->assertTrue($teacher2->must_change_password);
        // Password Awal: GuruSCP@2006!
        $this->assertTrue(Hash::check('GuruSCP@2006!', $teacher2->password));

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_teacher_can_login_with_nip_and_option_1_password_and_forced_to_change_password(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            [
                'no' => 1,
                'nip' => '199001012020011005',
                'nama' => 'Rahmat Hidayat, S.Kom.',
                'mapel' => 'Informatika',
            ],
        ]);

        $file = new UploadedFile($filePath, 'guru.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $this->postJson('/api/teachers/import', ['file' => $file])
            ->assertStatus(201);

        // Attempt login with NIP and Option 1 initial password
        $loginResponse = $this->postJson('/api/login', [
            'username' => '199001012020011005',
            'password' => 'GuruSCP@1005!',
            'device_name' => 'TestBrowser',
        ]);

        $loginResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'must_change_password' => true,
                ],
            ]);

        $this->assertNotEmpty($loginResponse->json('data.token'));

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_when_file_is_missing_or_invalid_extension(): void
    {
        Sanctum::actingAs($this->waka);

        // Missing file
        $response1 = $this->postJson('/api/teachers/import', []);
        $response1->assertStatus(422)
            ->assertJsonValidationErrors(['file']);

        // Invalid extension (.txt)
        $fakeTxt = UploadedFile::fake()->create('guru.txt', 100, 'text/plain');
        $response2 = $this->postJson('/api/teachers/import', [
            'file' => $fakeTxt,
        ]);
        $response2->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    public function test_import_fails_when_file_exceeds_max_size(): void
    {
        Sanctum::actingAs($this->waka);

        // 5121 KB exceeds max 5120 KB limit
        $fakeHugeFile = UploadedFile::fake()->create('guru_huge.xlsx', 5121, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $response = $this->postJson('/api/teachers/import', [
            'file' => $fakeHugeFile,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    public function test_import_fails_when_header_is_missing_nip_or_name(): void
    {
        Sanctum::actingAs($this->waka);

        // Header missing 'nip'
        $filePath = $this->createTempExcel([
            [
                'no' => 1,
                'nama' => 'Rahmat Hidayat',
                'mapel' => 'Informatika',
            ],
        ]);

        $file = new UploadedFile($filePath, 'guru_invalid_header.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertStringContainsString('NIP', $response->json('message'));

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_when_excel_has_no_data_rows(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([], ['no', 'nip', 'nama', 'mapel']);

        $file = new UploadedFile($filePath, 'guru_empty_rows.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Berkas Excel tidak memuat data guru.',
            ]);

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_when_required_fields_are_empty(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            [
                'no' => 1,
                'nip' => '',
                'nama' => 'Guru Tanpa NIP',
                'mapel' => '',
            ],
            [
                'no' => 2,
                'nip' => '199901012022011001',
                'nama' => '',
                'mapel' => '',
            ],
        ]);

        $file = new UploadedFile($filePath, 'guru_empty_fields.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
            ]);

        $errors = $response->json('errors');
        $this->assertNotEmpty($errors);

        $attributes = array_column($errors, 'attribute');
        $this->assertContains('nip', $attributes);
        $this->assertContains('name', $attributes);

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_and_rollbacks_on_in_sheet_duplicate_nip(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            [
                'no' => 1,
                'nip' => '199001012020011005',
                'nama' => 'Guru Satu',
                'mapel' => 'Matematika',
            ],
            [
                'no' => 2,
                'nip' => '199001012020011005', // Duplicate NIP in row 3
                'nama' => 'Guru Dua',
                'mapel' => 'Matematika',
            ],
        ]);

        $file = new UploadedFile($filePath, 'guru_duplicate_nip.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
            ]);

        $this->assertEquals(3, $response->json('errors.0.row'));
        $this->assertEquals('nip', $response->json('errors.0.attribute'));

        // Rollback: Guru Satu should NOT be inserted into database
        $this->assertNull(User::where('nis_nip', '199001012020011005')->first());

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_handles_empty_mapel_gracefully(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            [
                'no' => 1,
                'nip' => '199001012020011005',
                'nama' => 'Guru Tanpa Mapel',
                'mapel' => '', // Empty mapel is allowed!
            ],
        ]);

        $file = new UploadedFile($filePath, 'guru_no_mapel.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'imported_count' => 1,
                ],
            ]);

        $teacher = User::where('nis_nip', '199001012020011005')->first();
        $this->assertNotNull($teacher);
        $this->assertNull($teacher->subject_id);

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_and_rollbacks_on_database_nip_collision(): void
    {
        Sanctum::actingAs($this->waka);

        // $this->teacher already exists with NIP 198001012010011002
        $filePath = $this->createTempExcel([
            [
                'no' => 1,
                'nip' => '199505052020011010', // New valid teacher
                'nama' => 'Guru Baru',
                'mapel' => 'Sejarah',
            ],
            [
                'no' => 2,
                'nip' => '198001012010011002', // Collision with existing teacher in DB
                'nama' => 'Budi Collide',
                'mapel' => 'Sejarah',
            ],
        ]);

        $file = new UploadedFile($filePath, 'guru_collision_nip.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
            ]);

        $this->assertEquals(3, $response->json('errors.0.row'));
        $this->assertEquals('nip', $response->json('errors.0.attribute'));

        // Rollback: Guru Baru should NOT be inserted into database
        $this->assertNull(User::where('nis_nip', '199505052020011010')->first());

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_safeguards_waka_account_when_nip_collides(): void
    {
        Sanctum::actingAs($this->waka);

        // Attempt importing an entry that has the Waka's NIP
        $filePath = $this->createTempExcel([
            [
                'no' => 1,
                'nip' => '197001011990011001', // Collides with Waka Kurikulum NIP
                'nama' => 'Fake Teacher Impersonator',
                'mapel' => 'Hacking',
            ],
        ]);

        $file = new UploadedFile($filePath, 'guru_waka_collision.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
            ]);

        $this->assertStringContainsString('Administrator/Waka', $response->json('errors.0.message'));

        // Ensure Waka account is intact
        $wakaUser = User::find($this->waka->id);
        $this->assertEquals('vice_principal', $wakaUser->role);
        $this->assertEquals('Waka Kurikulum', $wakaUser->name);

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_links_existing_subject_and_auto_creates_new_subject(): void
    {
        Sanctum::actingAs($this->waka);

        // Pre-existing subject
        $existingSubject = Subject::create(['name' => 'Bahasa Inggris']);

        $filePath = $this->createTempExcel([
            [
                'no' => 1,
                'nip' => '199101012020011011',
                'nama' => 'Guru Bahasa',
                'mapel' => 'Bahasa Inggris', // Existing subject
            ],
            [
                'no' => 2,
                'nip' => '199102022020022012',
                'nama' => 'Guru Robotika',
                'mapel' => 'Robotika Terapan', // New subject auto-created
            ],
        ]);

        $file = new UploadedFile($filePath, 'guru_subjects.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(201);

        $teacher1 = User::where('nis_nip', '199101012020011011')->first();
        $this->assertNotNull($teacher1);
        $this->assertEquals($existingSubject->id, $teacher1->subject_id);

        $teacher2 = User::where('nis_nip', '199102022020022012')->first();
        $this->assertNotNull($teacher2);
        $this->assertNotNull($teacher2->subject_id);
        $this->assertEquals('Robotika Terapan', $teacher2->subject->name);

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_actual_production_excel_file(): void
    {
        Sanctum::actingAs($this->waka);

        $realFilePath = 'D:/MyUKK/SchoolClassProject/scp/MD/xlsx/Data_Pegawai_2026_Per_Juni_2026_FIX.xlsx';
        $this->assertFileExists($realFilePath);

        $file = new UploadedFile($realFilePath, 'Data_Pegawai_2026_Per_Juni_2026_FIX.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Data guru berhasil diimpor.',
                'data' => [
                    'imported_count' => 90,
                ],
            ]);

        // Verify total teachers in database
        $this->assertEquals(91, User::where('role', 'teacher')->count()); // 90 + 1 pre-existing $this->teacher

        // Verify sample teacher 1: SUNARSIH, S.Pd. (197109021994012001)
        $sunarsih = User::where('nis_nip', '197109021994012001')->first();
        $this->assertNotNull($sunarsih);
        $this->assertEquals('SUNARSIH, S.Pd.', $sunarsih->name);
        $this->assertNull($sunarsih->email);
        $this->assertNull($sunarsih->phone_number);
        $this->assertTrue($sunarsih->must_change_password);
        $this->assertTrue(Hash::check('GuruSCP@2001!', $sunarsih->password));
        $this->assertEquals('IPAS', $sunarsih->subject?->name);

        // Verify sample teacher 90: DINDA AYU DEWANTI, S.Kom (3403036308970002)
        $dinda = User::where('nis_nip', '3403036308970002')->first();
        $this->assertNotNull($dinda);
        $this->assertEquals('DINDA AYU DEWANTI, S.Kom', $dinda->name);
        $this->assertNull($dinda->email);
        $this->assertTrue($dinda->must_change_password);
        $this->assertTrue(Hash::check('GuruSCP@0002!', $dinda->password));
        $this->assertEquals('REKAYASA PERANGKAT LUNAK', $dinda->subject?->name);

        // Verify row 87 (empty mapel): SELLYANA NURUL AZIZAH, S.Pd (3271024211950002)
        $sellyana = User::where('nis_nip', '3271024211950002')->first();
        $this->assertNotNull($sellyana);
        $this->assertNull($sellyana->subject_id);
    }
}
