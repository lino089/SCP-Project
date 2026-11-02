<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;
    private Classes $classX;
    private Classes $classXI;

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

        $this->classX = Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        $this->classXI = Classes::create(['name' => 'XI RPL 1', 'level' => 11]);
    }

    public function test_authenticated_user_can_list_students_and_filter(): void
    {
        Sanctum::actingAs($this->teacher);

        User::create([
            'name' => 'Andi Siswa',
            'nis_nip' => '1001',
            'role' => 'student',
            'class_id' => $this->classX->id,
            'password' => Hash::make('password123'),
        ]);

        User::create([
            'name' => 'Budi Siswa',
            'nis_nip' => '1002',
            'role' => 'student',
            'class_id' => $this->classXI->id,
            'password' => Hash::make('password123'),
        ]);

        $listAll = $this->getJson('/api/students');
        $listAll->assertStatus(200)
            ->assertJsonCount(2, 'data');

        $filterClass = $this->getJson('/api/students?class_id=' . $this->classX->id);
        $filterClass->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Andi Siswa');

        $search = $this->getJson('/api/students?search=Budi');
        $search->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Budi Siswa');
    }

    public function test_waka_can_create_student_with_auto_provisioned_parent(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/students', [
            'name' => 'Citra Lestari',
            'nis' => '1003',
            'class_id' => $this->classX->id,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'student' => [
                        'name' => 'Citra Lestari',
                        'nis_nip' => '1003',
                        'role' => 'student',
                    ],
                    'parent' => [
                        'nis_nip' => 'P-1003',
                        'role' => 'parent',
                    ],
                ],
            ]);

        $studentId = $response->json('data.student.id');

        $this->assertDatabaseHas('users', [
            'id' => $studentId,
            'name' => 'Citra Lestari',
            'nis_nip' => '1003',
            'role' => 'student',
        ]);

        $this->assertDatabaseHas('users', [
            'role' => 'parent',
            'nis_nip' => 'P-1003',
            'linked_student_id' => $studentId,
        ]);
    }

    public function test_waka_can_update_student_and_syncs_parent_account(): void
    {
        Sanctum::actingAs($this->waka);

        $student = User::create([
            'name' => 'Doni Asli',
            'nis_nip' => '1004',
            'role' => 'student',
            'class_id' => $this->classX->id,
            'password' => Hash::make('password123'),
        ]);

        $parent = User::create([
            'name' => 'Wali dari Doni Asli',
            'nis_nip' => 'P-1004',
            'role' => 'parent',
            'linked_student_id' => $student->id,
            'password' => Hash::make('password123'),
        ]);

        $response = $this->putJson('/api/students/' . $student->id, [
            'name' => 'Doni Pratama',
            'nis' => '1005',
            'class_id' => $this->classXI->id,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $student->id,
                    'name' => 'Doni Pratama',
                    'nis_nip' => '1005',
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $student->id,
            'name' => 'Doni Pratama',
            'nis_nip' => '1005',
            'class_id' => $this->classXI->id,
        ]);

        $this->assertDatabaseHas('users', [
            'id' => $parent->id,
            'name' => 'Wali Murid Doni Pratama',
            'nis_nip' => 'P-1005',
        ]);
    }

    public function test_waka_can_delete_student_and_cascades_soft_delete_to_parent(): void
    {
        Sanctum::actingAs($this->waka);

        $student = User::create([
            'name' => 'Eka Siswa',
            'nis_nip' => '1006',
            'role' => 'student',
            'class_id' => $this->classX->id,
            'password' => Hash::make('password123'),
        ]);

        $parent = User::create([
            'name' => 'Wali dari Eka Siswa',
            'nis_nip' => 'P-1006',
            'role' => 'parent',
            'linked_student_id' => $student->id,
            'password' => Hash::make('password123'),
        ]);

        $response = $this->deleteJson('/api/students/' . $student->id);
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Data siswa berhasil dihapus.',
            ]);

        $this->assertSoftDeleted('users', ['id' => $student->id]);
        $this->assertSoftDeleted('users', ['id' => $parent->id]);
    }

    public function test_waka_can_mark_student_as_held_back(): void
    {
        Sanctum::actingAs($this->waka);

        $student = User::create([
            'name' => 'Fajar Siswa',
            'nis_nip' => '1007',
            'role' => 'student',
            'class_id' => $this->classX->id,
            'is_held_back' => false,
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/students/' . $student->id . '/hold-back');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Siswa berhasil ditandai tinggal kelas.',
                'data' => [
                    'id' => $student->id,
                    'is_held_back' => true,
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $student->id,
            'is_held_back' => true,
        ]);
    }

    public function test_non_waka_cannot_mutate_student(): void
    {
        Sanctum::actingAs($this->teacher);

        $student = User::create([
            'name' => 'Gita Siswa',
            'nis_nip' => '1008',
            'role' => 'student',
            'class_id' => $this->classX->id,
            'password' => Hash::make('password123'),
        ]);

        $this->postJson('/api/students', [
            'name' => 'Hadi Siswa',
            'nis' => '1009',
            'class_id' => $this->classX->id,
        ])->assertStatus(403);

        $this->putJson('/api/students/' . $student->id, [
            'name' => 'Gita Baru',
            'nis' => '1008',
            'class_id' => $this->classX->id,
        ])->assertStatus(403);

        $this->deleteJson('/api/students/' . $student->id)->assertStatus(403);
        $this->postJson('/api/students/' . $student->id . '/hold-back')->assertStatus(403);
    }

    public function test_waka_can_create_student_with_gender_and_nisn(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/students', [
            'name' => 'Ahmad Fauzan',
            'nis' => '1010',
            'class_id' => $this->classX->id,
            'gender' => 'l',
            'nisn' => '0081234567',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'student' => [
                        'name' => 'Ahmad Fauzan',
                        'nis_nip' => '1010',
                        'gender' => 'L',
                        'nisn' => '0081234567',
                    ],
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'nis_nip' => '1010',
            'gender' => 'L',
            'nisn' => '0081234567',
        ]);
    }

    public function test_waka_cannot_create_student_with_duplicate_nisn(): void
    {
        Sanctum::actingAs($this->waka);

        User::create([
            'name' => 'Siswa Pertama',
            'nis_nip' => '1011',
            'role' => 'student',
            'class_id' => $this->classX->id,
            'password' => Hash::make('password123'),
            'gender' => 'L',
            'nisn' => '0089999999',
        ]);

        $response = $this->postJson('/api/students', [
            'name' => 'Siswa Kedua',
            'nis' => '1012',
            'class_id' => $this->classX->id,
            'gender' => 'P',
            'nisn' => '0089999999',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['nisn']);
    }

    public function test_waka_can_create_student_without_gender_and_nisn_backward_compatible(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/students', [
            'name' => 'Siswa Polos',
            'nis' => '1013',
            'class_id' => $this->classX->id,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('users', [
            'nis_nip' => '1013',
            'gender' => null,
            'nisn' => null,
        ]);
    }

    public function test_waka_can_update_student_gender_and_nisn(): void
    {
        Sanctum::actingAs($this->waka);

        $student = User::create([
            'name' => 'Siti Aisyah',
            'nis_nip' => '1014',
            'role' => 'student',
            'class_id' => $this->classX->id,
            'password' => Hash::make('password123'),
            'gender' => 'P',
            'nisn' => '0071111111',
        ]);

        $response = $this->putJson('/api/students/' . $student->id, [
            'name' => 'Siti Aisyah Putri',
            'nis' => '1014',
            'class_id' => $this->classXI->id,
            'gender' => 'P',
            'nisn' => '0072222222',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $student->id,
                    'gender' => 'P',
                    'nisn' => '0072222222',
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $student->id,
            'gender' => 'P',
            'nisn' => '0072222222',
        ]);
    }

    public function test_waka_updating_student_without_gender_and_nisn_retains_existing_values(): void
    {
        Sanctum::actingAs($this->waka);

        $student = User::create([
            'name' => 'Budi Santoso',
            'nis_nip' => '1015',
            'role' => 'student',
            'class_id' => $this->classX->id,
            'password' => Hash::make('password123'),
            'gender' => 'L',
            'nisn' => '0073333333',
        ]);

        $response = $this->putJson('/api/students/' . $student->id, [
            'name' => 'Budi Santoso Update',
            'nis' => '1015',
            'class_id' => $this->classXI->id,
        ]);

        $response->assertStatus(200);

        $fresh = $student->fresh();
        $this->assertSame('L', $fresh->gender);
        $this->assertSame('0073333333', $fresh->nisn);
    }
}
