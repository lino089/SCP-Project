<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClassPromotionTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;

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
    }

    public function test_waka_can_configure_next_class_id(): void
    {
        Sanctum::actingAs($this->waka);

        $class11 = Classes::create(['name' => 'XI RPL 1', 'level' => 11]);
        $class10 = Classes::create(['name' => 'X RPL 1', 'level' => 10]);

        $response = $this->putJson('/api/classes/' . $class10->id, [
            'name' => 'X RPL 1',
            'level' => 10,
            'next_class_id' => $class11->id,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $class10->id,
                    'next_class_id' => $class11->id,
                ],
            ]);

        $this->assertDatabaseHas('classes', [
            'id' => $class10->id,
            'next_class_id' => $class11->id,
        ]);
    }

    public function test_configuring_next_class_id_fails_if_same_as_current_class(): void
    {
        Sanctum::actingAs($this->waka);

        $class10 = Classes::create(['name' => 'X RPL 1', 'level' => 10]);

        $response = $this->putJson('/api/classes/' . $class10->id, [
            'name' => 'X RPL 1',
            'level' => 10,
            'next_class_id' => $class10->id,
        ]);

        $response->assertStatus(422);
    }

    public function test_configuring_next_class_id_fails_if_target_level_is_not_next_level(): void
    {
        Sanctum::actingAs($this->waka);

        $class10 = Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        $class12 = Classes::create(['name' => 'XII RPL 1', 'level' => 12]);

        // Attempt mapping level 10 directly to level 12
        $response = $this->putJson('/api/classes/' . $class10->id, [
            'name' => 'X RPL 1',
            'level' => 10,
            'next_class_id' => $class12->id,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_bulk_class_promotion_promotes_holds_back_and_graduates_students(): void
    {
        Sanctum::actingAs($this->waka);

        $class12 = Classes::create(['name' => 'XII RPL 1', 'level' => 12, 'next_class_id' => null]);
        $class11 = Classes::create(['name' => 'XI RPL 1', 'level' => 11, 'next_class_id' => $class12->id]);
        $class10 = Classes::create(['name' => 'X RPL 1', 'level' => 10, 'next_class_id' => $class11->id]);

        // Student 1: regular promotion from 10 to 11
        $student1 = User::create([
            'name' => 'Siswa Naik',
            'nis_nip' => '1001',
            'role' => 'student',
            'class_id' => $class10->id,
            'is_held_back' => false,
            'password' => Hash::make('password123'),
        ]);

        // Student 2: held back in class 10
        $student2 = User::create([
            'name' => 'Siswa Tinggal Kelas',
            'nis_nip' => '1002',
            'role' => 'student',
            'class_id' => $class10->id,
            'is_held_back' => true,
            'password' => Hash::make('password123'),
        ]);

        // Student 3: graduating from class 12
        $student3 = User::create([
            'name' => 'Siswa Lulus',
            'nis_nip' => '1003',
            'role' => 'student',
            'class_id' => $class12->id,
            'is_held_back' => false,
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/class-promotions');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'total_students' => 3,
                    'promoted' => 1,
                    'held_back' => 1,
                    'graduated' => 1,
                ],
            ]);

        // Assert Student 1 is promoted to class 11
        $student1->refresh();
        $this->assertEquals($class11->id, $student1->class_id);

        // Assert Student 2 remains in class 10 and is_held_back reset to false
        $student2->refresh();
        $this->assertEquals($class10->id, $student2->class_id);
        $this->assertFalse($student2->is_held_back);

        // Assert Student 3 graduated: class_id is null and graduation_date is set
        $student3->refresh();
        $this->assertNull($student3->class_id);
        $this->assertEquals(now()->toDateString(), $student3->graduation_date->toDateString());
    }

    public function test_non_waka_cannot_trigger_class_promotions(): void
    {
        Sanctum::actingAs($this->teacher);

        $response = $this->postJson('/api/class-promotions');
        $response->assertStatus(403);
    }

    public function test_auto_map_classes_correctly_maps_parallel_classes(): void
    {
        Sanctum::actingAs($this->waka);

        $c12 = Classes::create(['name' => 'XII RPL 1', 'level' => 12]);
        $c11 = Classes::create(['name' => 'XI RPL 1', 'level' => 11]);
        $c10 = Classes::create(['name' => 'X RPL 1', 'level' => 10]);

        $response = $this->postJson('/api/classes/auto-map');
        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $c10->refresh();
        $c11->refresh();
        $c12->refresh();

        $this->assertEquals($c11->id, $c10->next_class_id);
        $this->assertEquals($c12->id, $c11->next_class_id);
        $this->assertNull($c12->next_class_id);
    }

    public function test_promote_classes_fails_if_non_final_class_has_no_next_class_id(): void
    {
        Sanctum::actingAs($this->waka);

        $c10 = Classes::create(['name' => 'X RPL 1', 'level' => 10, 'next_class_id' => null]);
        User::create([
            'name' => 'Siswa Unmapped',
            'nis_nip' => '9999',
            'role' => 'student',
            'class_id' => $c10->id,
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/class-promotions');
        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_student_index_excludes_graduated_students_by_default(): void
    {
        Sanctum::actingAs($this->waka);

        $class10 = Classes::create(['name' => 'X RPL 1', 'level' => 10]);

        $activeStudent = User::create([
            'name' => 'Siswa Aktif',
            'nis_nip' => '1111',
            'role' => 'student',
            'class_id' => $class10->id,
            'graduation_date' => null,
            'password' => Hash::make('password123'),
        ]);

        $alumniStudent = User::create([
            'name' => 'Siswa Lulus',
            'nis_nip' => '2222',
            'role' => 'student',
            'class_id' => null,
            'graduation_date' => '2026-06-20',
            'password' => Hash::make('password123'),
        ]);

        // Default query GET /api/students harus hanya mengembalikan siswa aktif
        $resDefault = $this->getJson('/api/students');
        $resDefault->assertStatus(200);
        $this->assertEquals(1, $resDefault->json('meta.total'));
        $this->assertEquals('Siswa Aktif', $resDefault->json('data.0.name'));

        // Query dengan status=all mengembalikan seluruhnya (aktif + alumni)
        $resAll = $this->getJson('/api/students?status=all');
        $resAll->assertStatus(200);
        $this->assertEquals(2, $resAll->json('meta.total'));

        // Summary master data memisahkan students aktif dan alumni
        $resSummary = $this->getJson('/api/master-data/summary');
        $resSummary->assertStatus(200);
        $this->assertEquals(1, $resSummary->json('data.students'));
        $this->assertEquals(1, $resSummary->json('data.alumni'));
    }

    public function test_post_promotion_graduated_students_are_automatically_isolated_as_alumni(): void
    {
        Sanctum::actingAs($this->waka);

        $class12 = Classes::create(['name' => 'XII RPL 1', 'level' => 12]);
        $class11 = Classes::create(['name' => 'XI RPL 1', 'level' => 11]);
        $class10 = Classes::create(['name' => 'X RPL 1', 'level' => 10, 'next_class_id' => $class11->id]);

        $senior = User::create([
            'name' => 'Siswa Senior XII',
            'nis_nip' => '3001',
            'role' => 'student',
            'class_id' => $class12->id,
            'password' => Hash::make('password123'),
        ]);

        $junior = User::create([
            'name' => 'Siswa Junior X',
            'nis_nip' => '3002',
            'role' => 'student',
            'class_id' => $class10->id,
            'password' => Hash::make('password123'),
        ]);

        // Jalankan promosi massal
        $response = $this->postJson('/api/class-promotions');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'graduated' => 1,
                    'promoted' => 1,
                ],
            ]);

        // Default list siswa aktif hanya memuat siswa junior yang naik kelas
        $resActive = $this->getJson('/api/students');
        $resActive->assertStatus(200);
        $this->assertEquals(1, $resActive->json('meta.total'));
        $this->assertEquals('Siswa Junior X', $resActive->json('data.0.name'));
        $this->assertEquals($class11->id, $resActive->json('data.0.class_id'));

        // Query alumni memuat siswa senior yang lulus
        $resAlumni = $this->getJson('/api/students?status=alumni');
        $resAlumni->assertStatus(200);
        $this->assertEquals(1, $resAlumni->json('meta.total'));
        $this->assertEquals('Siswa Senior XII', $resAlumni->json('data.0.name'));
        $this->assertNull($resAlumni->json('data.0.class_id'));
        $this->assertNotNull($resAlumni->json('data.0.graduation_date'));
    }

    public function test_auto_map_creates_target_parallel_classes_if_missing(): void
    {
        Sanctum::actingAs($this->waka);

        // XI LPS 1 and XI LPS 2 exist, but XII LPS 1 & XII LPS 2 do not exist yet
        $c11_1 = Classes::create(['name' => 'XI LPS 1', 'level' => 11]);
        $c11_2 = Classes::create(['name' => 'XI LPS 2', 'level' => 11]);

        $response = $this->postJson('/api/classes/auto-map');
        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $c12_1 = Classes::where('name', 'XII LPS 1')->first();
        $c12_2 = Classes::where('name', 'XII LPS 2')->first();

        $this->assertNotNull($c12_1);
        $this->assertNotNull($c12_2);
        $this->assertEquals('12', $c12_1->level);
        $this->assertEquals('12', $c12_2->level);

        $c11_1->refresh();
        $c11_2->refresh();
        $this->assertEquals($c12_1->id, $c11_1->next_class_id);
        $this->assertEquals($c12_2->id, $c11_2->next_class_id);
    }

    public function test_promote_classes_archives_empty_classes_post_promotion(): void
    {
        Sanctum::actingAs($this->waka);

        $c11 = Classes::create(['name' => 'XI RPL 1', 'level' => 11]);
        $c10 = Classes::create(['name' => 'X RPL 1', 'level' => 10, 'next_class_id' => $c11->id]);

        $student = User::create([
            'name' => 'Siswa X',
            'nis_nip' => '5001',
            'role' => 'student',
            'class_id' => $c10->id,
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/class-promotions');
        $response->assertStatus(200);

        // Siswa X naik ke XI RPL 1
        $student->refresh();
        $this->assertEquals($c11->id, $student->class_id);

        // X RPL 1 sekarang kosong dan harus diarsipkan (soft-deleted)
        $this->assertNull(Classes::find($c10->id));
        $this->assertNotNull(Classes::withTrashed()->find($c10->id));
        $this->assertNotNull(Classes::withTrashed()->find($c10->id)->deleted_at);

        // XI RPL 1 tetap aktif
        $this->assertNotNull(Classes::find($c11->id));
    }
}
