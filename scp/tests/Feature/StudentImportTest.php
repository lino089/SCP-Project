<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\SimpleExcel\SimpleExcelWriter;
use Tests\TestCase;

class StudentImportTest extends TestCase
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
            'name' => 'Guru Pengajar',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012010011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->student = User::create([
            'name' => 'Siswa Eksis',
            'email' => 'siswa@example.com',
            'nis_nip' => '1001',
            'role' => 'student',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
    }

    private function createTempExcel(array $rows, ?array $headers = null): string
    {
        $tempPath = tempnam(sys_get_temp_dir(), 'test_student_') . '.xlsx';
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

    public function test_guest_cannot_download_student_template_or_import(): void
    {
        $this->getJson('/api/students/import-template')
            ->assertStatus(401);

        $this->postJson('/api/students/import')
            ->assertStatus(401);
    }

    public function test_non_waka_cannot_download_student_template_or_import(): void
    {
        Sanctum::actingAs($this->teacher);

        $this->getJson('/api/students/import-template')
            ->assertStatus(403);

        $this->postJson('/api/students/import')
            ->assertStatus(403);

        Sanctum::actingAs($this->student);

        $this->getJson('/api/students/import-template')
            ->assertStatus(403);

        $this->postJson('/api/students/import')
            ->assertStatus(403);
    }

    public function test_waka_can_download_student_import_template(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->get('/api/students/import-template');

        $response->assertStatus(200);
        $response->assertHeader('content-disposition', 'attachment; filename=siswa_import_template.xlsx');

        $filePath = $response->getFile()->getPathname();
        $reader = \Spatie\SimpleExcel\SimpleExcelReader::create($filePath);
        $headers = $reader->getHeaders();

        $this->assertEquals(['nis', 'name', 'class_name', 'gender', 'nisn'], $headers);
        $this->assertNotContains('parent_name', $headers);
        $this->assertNotContains('parent_phone', $headers);
    }

    public function test_waka_can_import_valid_students_and_auto_creates_classes(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            [
                'nis' => '12045',
                'name' => 'Ahmad Fauzan Pratama',
                'class_name' => 'X RPL 1',
                'gender' => 'L',
                'nisn' => '0081234567',
            ],
            [
                'nis' => '12046',
                'name' => 'Anisa Rahmawati',
                'class_name' => 'X RPL 1',
                'gender' => 'P',
                'nisn' => '0089876543',
            ],
            [
                'nis' => '11580',
                'name' => 'Budi Santoso',
                'class_name' => 'XI TKJ 2',
                'gender' => 'L',
                'nisn' => '0071122334',
            ],
        ]);

        $file = new UploadedFile($filePath, 'siswa.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/students/import', [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Data siswa dan kelas berhasil diimpor.',
                'data' => [
                    'classes_created' => 2,
                    'classes_existing' => 0,
                    'students_imported' => 3,
                    'parents_imported' => 3,
                ],
            ]);

        // Verifikasi Kelas Terbuat dengan Level Tepat
        $classX = Classes::where('name', 'X RPL 1')->first();
        $this->assertNotNull($classX);
        $this->assertEquals('10', $classX->level);

        $classXI = Classes::where('name', 'XI TKJ 2')->first();
        $this->assertNotNull($classXI);
        $this->assertEquals('11', $classXI->level);

        // Verifikasi Siswa 1
        $student1 = User::where('nis_nip', '12045')->first();
        $this->assertNotNull($student1);
        $this->assertEquals('student', $student1->role);
        $this->assertEquals('Ahmad Fauzan Pratama', $student1->name);
        $this->assertEquals($classX->id, $student1->class_id);
        $this->assertEquals('L', $student1->gender);
        $this->assertSame('0081234567', $student1->nisn);
        $this->assertTrue($student1->must_change_password);
        $this->assertFalse($student1->is_held_back);
        $this->assertTrue(Hash::check('0081234567', $student1->password));

        // Verifikasi Orang Tua Siswa 1
        $parent1 = User::where('nis_nip', 'P-12045')->first();
        $this->assertNotNull($parent1);
        $this->assertEquals('parent', $parent1->role);
        $this->assertEquals('Wali Murid Ahmad Fauzan Pratama', $parent1->name);
        $this->assertEquals($student1->id, $parent1->linked_student_id);
        $this->assertNull($parent1->phone_number);
        $this->assertTrue($parent1->must_change_password);
        $this->assertTrue(Hash::check('0081234567', $parent1->password));

        // Verifikasi Siswa 2 (Gender Perempuan)
        $student2 = User::where('nis_nip', '12046')->first();
        $this->assertNotNull($student2);
        $this->assertEquals('P', $student2->gender);
        $this->assertEquals($classX->id, $student2->class_id);

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_reuses_existing_classes_without_duplication(): void
    {
        Sanctum::actingAs($this->waka);

        // Buat kelas terlebih dahulu
        $existingClass = Classes::create([
            'name' => 'XII RPL 1',
            'level' => '12',
            'next_class_id' => null,
        ]);

        $filePath = $this->createTempExcel([
            [
                'nis' => '13001',
                'name' => 'Citra Dewi',
                'class_name' => 'XII RPL 1', // Kelas sudah ada di DB
                'gender' => 'P',
                'nisn' => '0081300001',
            ],
            [
                'nis' => '13002',
                'name' => 'Dedi Setiawan',
                'class_name' => 'XII RPL 1', // Kelas sama
                'gender' => 'L',
                'nisn' => '0081300002',
            ],
        ]);

        $file = new UploadedFile($filePath, 'siswa_existing_class.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/students/import', [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'classes_created' => 0,
                    'classes_existing' => 1,
                    'students_imported' => 2,
                    'parents_imported' => 2,
                ],
            ]);

        // Pastikan tidak ada duplikasi kelas XII RPL 1
        $this->assertEquals(1, Classes::where('name', 'XII RPL 1')->count());

        $student1 = User::where('nis_nip', '13001')->first();
        $this->assertEquals($existingClass->id, $student1->class_id);

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_auto_create_class_level_detection_x_xi_xii_and_fallback(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            ['nis' => '2001', 'name' => 'Siswa 1', 'class_name' => 'X-A', 'gender' => 'L', 'nisn' => '0082001001'],
            ['nis' => '2002', 'name' => 'Siswa 2', 'class_name' => 'XI-B', 'gender' => 'P', 'nisn' => '0082002002'],
            ['nis' => '2003', 'name' => 'Siswa 3', 'class_name' => 'XII-C', 'gender' => 'L', 'nisn' => '0082003003'],
            ['nis' => '2004', 'name' => 'Siswa 4', 'class_name' => '10 AK 1', 'gender' => 'P', 'nisn' => '0082004004'],
            ['nis' => '2005', 'name' => 'Siswa 5', 'class_name' => '11 AK 2', 'gender' => 'L', 'nisn' => '0082005005'],
            ['nis' => '2006', 'name' => 'Siswa 6', 'class_name' => '12 AK 3', 'gender' => 'P', 'nisn' => '0082006006'],
            ['nis' => '2007', 'name' => 'Siswa 7', 'class_name' => 'Kelas Khusus', 'gender' => 'L', 'nisn' => '0082007007'], // Fallback 10
        ]);

        $file = new UploadedFile($filePath, 'siswa_levels.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/students/import', [
            'file' => $file,
        ]);

        $response->assertStatus(201);

        $this->assertEquals('10', Classes::where('name', 'X-A')->value('level'));
        $this->assertEquals('11', Classes::where('name', 'XI-B')->value('level'));
        $this->assertEquals('12', Classes::where('name', 'XII-C')->value('level'));
        $this->assertEquals('10', Classes::where('name', '10 AK 1')->value('level'));
        $this->assertEquals('11', Classes::where('name', '11 AK 2')->value('level'));
        $this->assertEquals('12', Classes::where('name', '12 AK 3')->value('level'));
        $this->assertEquals('10', Classes::where('name', 'Kelas Khusus')->value('level'));

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_when_file_is_missing_or_invalid_extension(): void
    {
        Sanctum::actingAs($this->waka);

        // Missing file
        $response1 = $this->postJson('/api/students/import', []);
        $response1->assertStatus(422)
            ->assertJsonValidationErrors(['file']);

        // Invalid extension
        $fakeTxt = UploadedFile::fake()->create('siswa.txt', 100, 'text/plain');
        $response2 = $this->postJson('/api/students/import', [
            'file' => $fakeTxt,
        ]);
        $response2->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    public function test_import_fails_when_file_exceeds_max_size(): void
    {
        Sanctum::actingAs($this->waka);

        // 5121 KB exceeds max 5120 KB
        $hugeFile = UploadedFile::fake()->create('huge_siswa.xlsx', 5121, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $response = $this->postJson('/api/students/import', [
            'file' => $hugeFile,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    public function test_import_fails_when_header_is_invalid(): void
    {
        Sanctum::actingAs($this->waka);

        // Missing 'gender' header
        $filePath = $this->createTempExcel([
            ['nis' => '12045', 'name' => 'Ahmad', 'class_name' => 'X RPL 1'],
        ]);

        $file = new UploadedFile($filePath, 'siswa_no_gender.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/students/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertStringContainsString('gender', $response->json('message'));

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_when_excel_has_no_data_rows(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([], ['nis', 'name', 'class_name', 'gender', 'nisn']);

        $file = new UploadedFile($filePath, 'siswa_empty_rows.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/students/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Berkas Excel tidak memuat data siswa.',
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
                'nis' => '',
                'name' => 'Siswa Tanpa NIS',
                'class_name' => '',
                'gender' => '',
                'nisn' => '',
            ],
            [
                'nis' => '5001',
                'name' => '',
                'class_name' => 'X RPL 1',
                'gender' => 'L',
                'nisn' => '0085001001',
            ],
        ]);

        $file = new UploadedFile($filePath, 'siswa_empty_fields.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/students/import', [
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
        $this->assertContains('nis', $attributes);
        $this->assertContains('class_name', $attributes);
        $this->assertContains('gender', $attributes);
        $this->assertContains('name', $attributes);
        $this->assertContains('nisn', $attributes);

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_when_gender_is_invalid(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            [
                'nis' => '6001',
                'name' => 'Siswa Salah Gender',
                'class_name' => 'X RPL 1',
                'gender' => 'X', // Invalid
                'nisn' => '0086001001',
            ],
        ]);

        $file = new UploadedFile($filePath, 'siswa_invalid_gender.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/students/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
            ]);

        $this->assertEquals('gender', $response->json('errors.0.attribute'));

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_and_rollbacks_on_in_sheet_duplicate_nis(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            [
                'nis' => '7001',
                'name' => 'Siswa Satu',
                'class_name' => 'X RPL 1',
                'gender' => 'L',
                'nisn' => '0087001001',
            ],
            [
                'nis' => '7001', // Duplicate NIS in row 3
                'name' => 'Siswa Dua',
                'class_name' => 'X RPL 2',
                'gender' => 'P',
                'nisn' => '0087001002',
            ],
        ]);

        $file = new UploadedFile($filePath, 'siswa_duplicate_nis.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/students/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
            ]);

        $this->assertEquals(3, $response->json('errors.0.row'));
        $this->assertEquals('nis', $response->json('errors.0.attribute'));

        // Rollback: no records inserted
        $this->assertNull(User::where('nis_nip', '7001')->first());
        $this->assertNull(Classes::where('name', 'X RPL 1')->first());

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_and_rollbacks_on_in_sheet_duplicate_nisn(): void
    {
        Sanctum::actingAs($this->waka);

        $filePath = $this->createTempExcel([
            [
                'nis' => '8001',
                'name' => 'Siswa Satu',
                'class_name' => 'X RPL 1',
                'gender' => 'L',
                'nisn' => '0081112223',
            ],
            [
                'nis' => '8002',
                'name' => 'Siswa Dua',
                'class_name' => 'X RPL 2',
                'gender' => 'P',
                'nisn' => '0081112223', // Duplicate NISN in row 3
            ],
        ]);

        $file = new UploadedFile($filePath, 'siswa_duplicate_nisn.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/students/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
            ]);

        $this->assertEquals(3, $response->json('errors.0.row'));
        $this->assertEquals('nisn', $response->json('errors.0.attribute'));

        // Rollback
        $this->assertNull(User::where('nis_nip', '8001')->first());
        $this->assertNull(User::where('nis_nip', '8002')->first());

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_fails_and_rollbacks_on_database_nis_collision(): void
    {
        Sanctum::actingAs($this->waka);

        // $this->student already has nis_nip = '1001'
        $filePath = $this->createTempExcel([
            [
                'nis' => '9001',
                'name' => 'Siswa Baru',
                'class_name' => 'X RPL 1',
                'gender' => 'L',
                'nisn' => '0089001001',
            ],
            [
                'nis' => '1001', // Collides with DB
                'name' => 'Siswa Tabrakan',
                'class_name' => 'X RPL 1',
                'gender' => 'P',
                'nisn' => '0089001002',
            ],
        ]);

        $file = new UploadedFile($filePath, 'siswa_collision_nis.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/students/import', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi berkas gagal pada beberapa baris.',
            ]);

        $this->assertEquals(3, $response->json('errors.0.row'));
        $this->assertEquals('nis', $response->json('errors.0.attribute'));

        // Rollback: Siswa Baru should NOT exist
        $this->assertNull(User::where('nis_nip', '9001')->first());

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    public function test_import_handles_siblings_and_generates_distinct_parent_accounts(): void
    {
        Sanctum::actingAs($this->waka);

        // Dua siswa bersaudara
        $filePath = $this->createTempExcel([
            [
                'nis' => '9501',
                'name' => 'Kakak Pratama',
                'class_name' => 'XII RPL 1',
                'gender' => 'L',
                'nisn' => '0089501001',
            ],
            [
                'nis' => '9502',
                'name' => 'Adik Pratama',
                'class_name' => 'X RPL 1',
                'gender' => 'P',
                'nisn' => '0089502002',
            ],
        ]);

        $file = new UploadedFile($filePath, 'siswa_siblings.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/students/import', [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'students_imported' => 2,
                    'parents_imported' => 2,
                ],
            ]);

        $parentKakak = User::where('nis_nip', 'P-9501')->first();
        $this->assertNotNull($parentKakak);
        $this->assertEquals('Wali Murid Kakak Pratama', $parentKakak->name);
        $this->assertNull($parentKakak->phone_number);

        $parentAdik = User::where('nis_nip', 'P-9502')->first();
        $this->assertNotNull($parentAdik);
        $this->assertEquals('Wali Murid Adik Pratama', $parentAdik->name);
        $this->assertNull($parentAdik->phone_number);

        // Kedua akun orang tua terhubung ke anaknya masing-masing
        $studentKakak = User::where('nis_nip', '9501')->first();
        $studentAdik = User::where('nis_nip', '9502')->first();

        $this->assertEquals($studentKakak->id, $parentKakak->linked_student_id);
        $this->assertEquals($studentAdik->id, $parentAdik->linked_student_id);

        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }
}
