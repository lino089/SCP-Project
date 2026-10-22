<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * FASE 9 - Tugas 9.1: Verifikasi Kriteria 6 (Auto-Provisioning Akun)
 * PRD Bagian 10 & MASTER_IMPROVEMENT_PLAN.md:
 * - Input Siswa otomatis buat akun Siswa + Orang Tua
 * - Password acak 8 karakter
 * - must_change_password aktif (true)
 * - Relasi linked_student_id pada akun orang tua terhubung presisi
 */
class UserProvisioningTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;
    private Classes $class;

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
            'name' => 'Guru Biasa',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012010011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->class = Classes::create(['name' => 'X PPLG 1', 'level' => 10]);
    }

    public function test_creating_student_auto_provisions_student_and_parent_with_8_char_random_passwords(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/students', [
            'name' => 'Aditya Pratama',
            'nis' => '54321',
            'class_id' => $this->class->id,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Data siswa berhasil ditambahkan.',
                'data' => [
                    'student' => [
                        'name' => 'Aditya Pratama',
                        'nis_nip' => '54321',
                        'role' => 'student',
                    ],
                    'parent' => [
                        'nis_nip' => 'P-54321',
                        'role' => 'parent',
                    ],
                ],
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'student' => ['id', 'name', 'nis_nip', 'role', 'class_id'],
                    'parent' => ['id', 'name', 'nis_nip', 'role', 'linked_student_id'],
                    'generate_password',
                ],
            ]);

        $studentId = $response->json('data.student.id');
        $parentId = $response->json('data.parent.id');
        $generatedPassword = $response->json('data.generate_password');

        // Pastikan password acak digenerate sepanjang 8 karakter
        $this->assertEquals(8, strlen($generatedPassword));

        // Verifikasi akun siswa di database
        $studentUser = User::find($studentId);
        $this->assertNotNull($studentUser);
        $this->assertTrue((bool) $studentUser->must_change_password);
        $this->assertTrue(Hash::check($generatedPassword, $studentUser->password));

        // Verifikasi akun orang tua di database
        $parentUser = User::find($parentId);
        $this->assertNotNull($parentUser);
        $this->assertTrue((bool) $parentUser->must_change_password);
        $this->assertEquals($studentId, $parentUser->linked_student_id);
        $this->assertTrue(Hash::check($generatedPassword, $parentUser->password));
    }

    public function test_non_waka_cannot_create_students(): void
    {
        Sanctum::actingAs($this->teacher);

        $response = $this->postJson('/api/students', [
            'name' => 'Siswa Ilegal',
            'nis' => '99999',
            'class_id' => $this->class->id,
        ]);

        $response->assertStatus(403);
    }
}
