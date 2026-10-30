<?php

namespace Tests\Feature;

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
            'fet_staff_id' => 'BS01',
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
                'nip' => '199001012020011005',
                'name' => 'Rahmat Hidayat, S.Kom.',
                'fet_staff_id' => '101',
                'email' => 'rahmat@sekolah.sch.id',
                'phone_number' => '081299990001',
            ],
            [
                'nip' => '199202022021022006',
                'name' => 'Siti Nurhaliza, M.Pd.',
                'fet_staff_id' => '102',
                'email' => 'siti@sekolah.sch.id',
                'phone_number' => '081299990002',
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
        $this->assertEquals('101', $teacher1->fet_staff_id);
        $this->assertEquals('rahmat@sekolah.sch.id', $teacher1->email);
        $this->assertEquals('081299990001', $teacher1->phone_number);
        $this->assertTrue($teacher1->must_change_password);
        $this->assertTrue(Hash::check('199001012020011005', $teacher1->password));

        $teacher2 = User::where('nis_nip', '199202022021022006')->first();
        $this->assertNotNull($teacher2);
        $this->assertEquals('102', $teacher2->fet_staff_id);
        $this->assertTrue(Hash::check('199202022021022006', $teacher2->password));

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

    public function test_import_fails_when_header_is_invalid(): void
    {
        Sanctum::actingAs($this->waka);

        // Header missing 'fet_staff_id'
        $filePath = $this->createTempExcel([
            [
                'nip' => '199001012020011005',
                'name' => 'Rahmat Hidayat',
                'email' => 'rahmat@sekolah.sch.id',
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

        $this->assertStringContainsString('fet_staff_id', $response->json('message'));

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_when_excel_has_no_data_rows(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([], ['nip', 'name', 'fet_staff_id', 'email', 'phone_number']);

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
                'nip' => '',
                'name' => 'Guru Tanpa NIP',
                'fet_staff_id' => '',
            ],
            [
                'nip' => '199901012022011001',
                'name' => '',
                'fet_staff_id' => 'FET99',
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
        $this->assertContains('fet_staff_id', $attributes);

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_and_rollbacks_on_in_sheet_duplicate_nip(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            [
                'nip' => '199001012020011005',
                'name' => 'Guru Satu',
                'fet_staff_id' => '101',
            ],
            [
                'nip' => '199001012020011005', // Duplicate NIP in row 3
                'name' => 'Guru Dua',
                'fet_staff_id' => '102',
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

    public function test_import_fails_and_rollbacks_on_in_sheet_duplicate_fet_staff_id(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            [
                'nip' => '199001012020011005',
                'name' => 'Guru Satu',
                'fet_staff_id' => 'SAME_FET_ID',
            ],
            [
                'nip' => '199002022020022006',
                'name' => 'Guru Dua',
                'fet_staff_id' => 'SAME_FET_ID', // Duplicate FET Staff ID in row 3
            ],
        ]);

        $file = new UploadedFile($filePath, 'guru_duplicate_fet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
            ]);

        $this->assertEquals(3, $response->json('errors.0.row'));
        $this->assertEquals('fet_staff_id', $response->json('errors.0.attribute'));

        // Rollback: no records inserted
        $this->assertNull(User::where('nis_nip', '199001012020011005')->first());
        $this->assertNull(User::where('nis_nip', '199002022020022006')->first());

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_and_rollbacks_on_in_sheet_duplicate_email(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            [
                'nip' => '199001012020011005',
                'name' => 'Guru Satu',
                'fet_staff_id' => 'FET01',
                'email' => 'duplicate.email@sekolah.sch.id',
            ],
            [
                'nip' => '199002022020022006',
                'name' => 'Guru Dua',
                'fet_staff_id' => 'FET02',
                'email' => 'duplicate.email@sekolah.sch.id', // Duplicate email in row 3
            ],
        ]);

        $file = new UploadedFile($filePath, 'guru_duplicate_email.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
            ]);

        $this->assertEquals(3, $response->json('errors.0.row'));
        $this->assertEquals('email', $response->json('errors.0.attribute'));

        // Rollback: no records inserted
        $this->assertNull(User::where('nis_nip', '199001012020011005')->first());
        $this->assertNull(User::where('nis_nip', '199002022020022006')->first());

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
                'nip' => '199505052020011010', // New valid teacher
                'name' => 'Guru Baru',
                'fet_staff_id' => '201',
            ],
            [
                'nip' => '198001012010011002', // Collision with existing teacher in DB
                'name' => 'Budi Collide',
                'fet_staff_id' => '202',
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

    public function test_import_fails_and_rollbacks_on_database_fet_staff_id_collision(): void
    {
        Sanctum::actingAs($this->waka);

        // $this->teacher already exists with fet_staff_id = 'BS01'
        $filePath = $this->createTempExcel([
            [
                'nip' => '199505052020011010',
                'name' => 'Guru Baru',
                'fet_staff_id' => 'BS01', // Collides with existing fet_staff_id in DB
            ],
        ]);

        $file = new UploadedFile($filePath, 'guru_collision_fet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
            ]);

        $this->assertEquals(2, $response->json('errors.0.row'));
        $this->assertEquals('fet_staff_id', $response->json('errors.0.attribute'));

        // Rollback
        $this->assertNull(User::where('nis_nip', '199505052020011010')->first());

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_on_invalid_email_format(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            [
                'nip' => '199001012020011005',
                'name' => 'Guru Email Salah',
                'fet_staff_id' => 'FET99',
                'email' => 'invalid-email-format',
            ],
        ]);

        $file = new UploadedFile($filePath, 'guru_invalid_email.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/teachers/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
            ]);

        $this->assertEquals('email', $response->json('errors.0.attribute'));

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }
}
