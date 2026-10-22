<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\TeacherAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * FASE 9 - Tugas 9.1: Verifikasi Kriteria 7 (Multirole Guru)
 * PRD Bagian 10 & MASTER_IMPROVEMENT_PLAN.md:
 * - Satu akun Guru dapat memegang lebih dari satu teacher_assignment sekaligus (Kesiswaan + Wali Kelas).
 * - Middleware assignment memvalidasi hak akses secara tepat.
 */
class TeacherAssignmentTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $multiRoleTeacher;
    private User $regularTeacher;
    private Classes $classA;

    protected function setUp(): void
    {
        parent::setUp();

        // Register dummy routes protected by assignment middleware for test verification
        Route::middleware(['auth:sanctum', 'assignment:kesiswaan'])->get('/test-route-kesiswaan', function () {
            return response()->json(['success' => true, 'message' => 'Akses kesiswaan diizinkan']);
        });

        Route::middleware(['auth:sanctum', 'assignment:wali_kelas'])->get('/test-route-wali-kelas', function () {
            return response()->json(['success' => true, 'message' => 'Akses wali kelas diizinkan']);
        });

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
        ]);

        $this->multiRoleTeacher = User::create([
            'name' => 'Guru Multitalenta',
            'email' => 'multirole@example.com',
            'nis_nip' => '198501012010011005',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $this->regularTeacher = User::create([
            'name' => 'Guru Pengajar Murni',
            'email' => 'regular@example.com',
            'nis_nip' => '198501012010011006',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $this->classA = Classes::create(['name' => 'XII RPL 1', 'level' => 12]);
    }

    public function test_teacher_can_hold_both_kesiswaan_and_wali_kelas_assignments_simultaneously(): void
    {
        Sanctum::actingAs($this->waka);

        // 1. Berikan tugas Kesiswaan
        $resKesiswaan = $this->postJson("/api/teachers/{$this->multiRoleTeacher->id}/assignments", [
            'type' => 'kesiswaan',
        ]);
        $resKesiswaan->assertStatus(201);

        // 2. Berikan tugas Wali Kelas untuk XII RPL 1
        $resWaliKelas = $this->postJson("/api/teachers/{$this->multiRoleTeacher->id}/assignments", [
            'type' => 'wali_kelas',
            'class_id' => $this->classA->id,
        ]);
        $resWaliKelas->assertStatus(201);

        // 3. Pastikan guru memiliki 2 penugasan aktif di database
        $assignments = TeacherAssignment::where('user_id', $this->multiRoleTeacher->id)->get();
        $this->assertCount(2, $assignments);
        $this->assertTrue($assignments->contains('type', 'kesiswaan'));
        $this->assertTrue($assignments->contains('type', 'wali_kelas'));

        // 4. Pastikan /api/me memuat kedua assignments
        Sanctum::actingAs($this->multiRoleTeacher);
        $meRes = $this->getJson('/api/me');
        $meRes->assertStatus(200)
            ->assertJsonCount(2, 'data.assignments');
    }

    public function test_middleware_assignment_grants_access_to_multirole_teacher_and_blocks_regular_teacher(): void
    {
        // Berikan kedua role kepada multiRoleTeacher
        TeacherAssignment::create([
            'user_id' => $this->multiRoleTeacher->id,
            'type' => 'kesiswaan',
        ]);
        TeacherAssignment::create([
            'user_id' => $this->multiRoleTeacher->id,
            'type' => 'wali_kelas',
            'class_id' => $this->classA->id,
        ]);

        // A. Guru Multirole dapat mengakses rute kesiswaan dan wali kelas
        Sanctum::actingAs($this->multiRoleTeacher);

        $resKesiswaanAllowed = $this->getJson('/test-route-kesiswaan');
        $resKesiswaanAllowed->assertStatus(200)
            ->assertJson(['success' => true]);

        $resWaliKelasAllowed = $this->getJson('/test-route-wali-kelas');
        $resWaliKelasAllowed->assertStatus(200)
            ->assertJson(['success' => true]);

        // B. Guru biasa ditolak pada kedua rute dengan 403 Forbidden
        Sanctum::actingAs($this->regularTeacher);

        $resKesiswaanBlocked = $this->getJson('/test-route-kesiswaan');
        $resKesiswaanBlocked->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Akses ditolak, anda tidak memiliki izin.',
            ]);

        $resWaliKelasBlocked = $this->getJson('/test-route-wali-kelas');
        $resWaliKelasBlocked->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Akses ditolak, anda tidak memiliki izin.',
            ]);
    }
}
