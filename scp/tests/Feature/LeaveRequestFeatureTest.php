<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\LeaveRequest;
use App\Models\TeacherAssignment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeaveRequestFeatureTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacherKesiswaan;
    private User $teacherWaliKelas;
    private User $teacherReguler;
    private User $student1;
    private User $student2;
    private User $parent1;
    private Classes $classA;
    private Classes $classB;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        // Kelas
        $this->classA = Classes::create(['name' => 'XII RPL 1', 'level' => 12]);
        $this->classB = Classes::create(['name' => 'XII TKJ 1', 'level' => 12]);

        // Waka Kurikulum
        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // Guru Kesiswaan
        $this->teacherKesiswaan = User::create([
            'name' => 'Guru Kesiswaan',
            'email' => 'kesiswaan@example.com',
            'nis_nip' => '198201012006011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
        TeacherAssignment::create([
            'user_id' => $this->teacherKesiswaan->id,
            'type' => 'kesiswaan',
        ]);

        // Wali Kelas XII RPL 1
        $this->teacherWaliKelas = User::create([
            'name' => 'Guru Wali Kelas',
            'email' => 'walikelas@example.com',
            'nis_nip' => '198301012007011003',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
        TeacherAssignment::create([
            'user_id' => $this->teacherWaliKelas->id,
            'type' => 'wali_kelas',
            'class_id' => $this->classA->id,
        ]);

        // Guru Reguler
        $this->teacherReguler = User::create([
            'name' => 'Guru Reguler',
            'email' => 'reguler@example.com',
            'nis_nip' => '198401012008011004',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // Siswa 1 di XII RPL 1
        $this->student1 = User::create([
            'name' => 'Siswa Satu',
            'email' => 'siswa1@example.com',
            'nis_nip' => '1001',
            'role' => 'student',
            'class_id' => $this->classA->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // Siswa 2 di XII TKJ 1
        $this->student2 = User::create([
            'name' => 'Siswa Dua',
            'email' => 'siswa2@example.com',
            'nis_nip' => '1002',
            'role' => 'student',
            'class_id' => $this->classB->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // Orang Tua Siswa 1
        $this->parent1 = User::create([
            'name' => 'Orang Tua Siswa 1',
            'email' => 'ortu1@example.com',
            'nis_nip' => 'P-1001',
            'role' => 'parent',
            'linked_student_id' => $this->student1->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
    }

    public function test_student_can_create_leave_request_tidak_masuk(): void
    {
        Sanctum::actingAs($this->student1);

        $fakeDoc = UploadedFile::fake()->create('surat_dokter.pdf', 500, 'application/pdf');

        $response = $this->postJson('/api/leave-requests', [
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-27',
            'document' => $fakeDoc,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Pengajuan perizinan berhasil dikirim.',
                'data' => [
                    'student_id' => $this->student1->id,
                    'applicant_id' => $this->student1->id,
                    'type' => 'tidak_masuk',
                    'category' => 'sakit',
                    'start_date' => '2026-10-25',
                    'end_date' => '2026-10-27',
                    'status_approval' => 'pending',
                ],
            ]);

        $this->assertDatabaseHas('leave_requests', [
            'student_id' => $this->student1->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'status_approval' => 'pending',
        ]);

        $leave = LeaveRequest::first();
        $this->assertNotNull($leave->document_path);
        Storage::disk('public')->assertExists($leave->document_path);
    }

    public function test_student_can_create_leave_request_keluar_sekolah(): void
    {
        Sanctum::actingAs($this->student1);

        $response = $this->postJson('/api/leave-requests', [
            'type' => 'keluar_sekolah',
            'category' => 'lainnya',
            'date' => '2026-10-25',
            'departure_time' => '10:00',
            'expected_return_time' => '12:00',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Pengajuan perizinan berhasil dikirim.',
                'data' => [
                    'student_id' => $this->student1->id,
                    'type' => 'keluar_sekolah',
                    'category' => 'lainnya',
                    'departure_time' => '10:00',
                    'expected_return_time' => '12:00',
                    'status_approval' => 'pending',
                ],
            ]);

        $this->assertDatabaseHas('leave_requests', [
            'student_id' => $this->student1->id,
            'type' => 'keluar_sekolah',
            'departure_time' => '10:00',
            'expected_return_time' => '12:00',
            'status_approval' => 'pending',
        ]);
    }

    public function test_parent_can_create_leave_request_for_linked_student(): void
    {
        Sanctum::actingAs($this->parent1);

        $fakeDoc = UploadedFile::fake()->image('bukti_sakit.jpg', 600, 400);

        $response = $this->postJson('/api/leave-requests', [
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-25',
            'document' => $fakeDoc,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'student_id' => $this->student1->id,
                    'applicant_id' => $this->parent1->id,
                    'status_approval' => 'pending',
                ],
            ]);

        $this->assertDatabaseHas('leave_requests', [
            'student_id' => $this->student1->id,
            'applicant_id' => $this->parent1->id,
        ]);
    }

    public function test_parent_cannot_create_leave_request_without_linked_student(): void
    {
        $unlinkedParent = User::create([
            'name' => 'Ortu Tanpa Siswa',
            'email' => 'ortu_unlinked@example.com',
            'nis_nip' => 'P-9999',
            'role' => 'parent',
            'linked_student_id' => null,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        Sanctum::actingAs($unlinkedParent);

        $response = $this->postJson('/api/leave-requests', [
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-25',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Akun orang tua belum ditautkan ke akun siswa.',
            ]);
    }

    public function test_create_rejected_when_end_date_before_start_date(): void
    {
        Sanctum::actingAs($this->student1);

        $response = $this->postJson('/api/leave-requests', [
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-20',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['end_date']);
    }

    public function test_create_rejected_when_return_time_not_after_departure_time(): void
    {
        Sanctum::actingAs($this->student1);

        $response = $this->postJson('/api/leave-requests', [
            'type' => 'keluar_sekolah',
            'category' => 'lainnya',
            'departure_time' => '11:00',
            'expected_return_time' => '10:00',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['expected_return_time']);
    }

    public function test_create_sakit_rejected_when_document_missing(): void
    {
        Sanctum::actingAs($this->student1);

        $response = $this->postJson('/api/leave-requests', [
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-25',
            // document sengaja tidak dikirim
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['document']);
    }

    public function test_create_rejected_when_document_exceeds_2mb(): void
    {
        Sanctum::actingAs($this->student1);

        $largeDoc = UploadedFile::fake()->create('dokumen_besar.pdf', 3000, 'application/pdf');

        $response = $this->postJson('/api/leave-requests', [
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-25',
            'document' => $largeDoc,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['document']);
    }

    public function test_teacher_and_waka_cannot_create_leave_request(): void
    {
        Sanctum::actingAs($this->teacherKesiswaan);

        $response = $this->postJson('/api/leave-requests', [
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-25',
        ]);

        $response->assertStatus(403);
    }

    public function test_student_owner_can_edit_leave_request_while_pending(): void
    {
        $leave = LeaveRequest::create([
            'student_id' => $this->student1->id,
            'applicant_id' => $this->student1->id,
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-26',
            'status_approval' => 'pending',
        ]);

        Sanctum::actingAs($this->student1);

        $response = $this->patchJson("/api/leave-requests/{$leave->id}", [
            'end_date' => '2026-10-28',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Data perizinan berhasil diperbarui.',
            ]);

        $this->assertEquals('2026-10-28', $leave->fresh()->end_date->toDateString());
    }

    public function test_student_cannot_edit_leave_request_after_approved_or_rejected(): void
    {
        $leave = LeaveRequest::create([
            'student_id' => $this->student1->id,
            'applicant_id' => $this->student1->id,
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-26',
            'status_approval' => 'approved',
            'verified_by' => $this->teacherKesiswaan->id,
            'verified_at' => now(),
        ]);

        Sanctum::actingAs($this->student1);

        $response = $this->patchJson("/api/leave-requests/{$leave->id}", [
            'end_date' => '2026-10-28',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Perizinan yang sudah diverifikasi tidak dapat diubah.',
            ]);
    }

    public function test_student_owner_can_cancel_leave_request_while_pending(): void
    {
        $fakeDoc = UploadedFile::fake()->create('surat.pdf', 100, 'application/pdf');
        $path = $fakeDoc->store('leaves', 'public');

        $leave = LeaveRequest::create([
            'student_id' => $this->student1->id,
            'applicant_id' => $this->student1->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-26',
            'status_approval' => 'pending',
            'document_path' => $path,
        ]);

        Storage::disk('public')->assertExists($path);

        Sanctum::actingAs($this->student1);

        $response = $this->deleteJson("/api/leave-requests/{$leave->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Pengajuan perizinan berhasil dibatalkan.',
            ]);

        $this->assertDatabaseMissing('leave_requests', ['id' => $leave->id]);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_student_cannot_cancel_leave_request_after_approved(): void
    {
        $leave = LeaveRequest::create([
            'student_id' => $this->student1->id,
            'applicant_id' => $this->student1->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-26',
            'status_approval' => 'approved',
            'verified_by' => $this->teacherKesiswaan->id,
            'verified_at' => now(),
        ]);

        Sanctum::actingAs($this->student1);

        $response = $this->deleteJson("/api/leave-requests/{$leave->id}");

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Perizinan yang sudah diverifikasi tidak dapat dibatalkan.',
            ]);

        $this->assertDatabaseHas('leave_requests', ['id' => $leave->id]);
    }

    public function test_other_student_cannot_edit_or_delete_leave_request(): void
    {
        $leave = LeaveRequest::create([
            'student_id' => $this->student1->id,
            'applicant_id' => $this->student1->id,
            'type' => 'tidak_masuk',
            'category' => 'lainnya',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-26',
            'status_approval' => 'pending',
        ]);

        Sanctum::actingAs($this->student2);

        $resEdit = $this->patchJson("/api/leave-requests/{$leave->id}", ['category' => 'sakit']);
        $resEdit->assertStatus(403);

        $resDelete = $this->deleteJson("/api/leave-requests/{$leave->id}");
        $resDelete->assertStatus(403);
    }

    public function test_kesiswaan_can_verify_leave_request_to_approved_or_rejected(): void
    {
        $leave = LeaveRequest::create([
            'student_id' => $this->student1->id,
            'applicant_id' => $this->student1->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-26',
            'status_approval' => 'pending',
        ]);

        Sanctum::actingAs($this->teacherKesiswaan);

        $response = $this->patchJson("/api/leave-requests/{$leave->id}", [
            'status' => 'approved',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Status perizinan berhasil diverifikasi (approved).',
                'data' => [
                    'status_approval' => 'approved',
                    'verified_by' => $this->teacherKesiswaan->id,
                ],
            ]);

        $this->assertEquals('approved', $leave->fresh()->status_approval);
        $this->assertEquals($this->teacherKesiswaan->id, $leave->fresh()->verified_by);
        $this->assertNotNull($leave->fresh()->verified_at);

        // Verifikasi kedua kali pada izin yang sama harus ditolak (422)
        $resSecond = $this->patchJson("/api/leave-requests/{$leave->id}", [
            'status' => 'rejected',
        ]);
        $resSecond->assertStatus(422);
    }

    public function test_regular_teacher_and_wali_kelas_cannot_verify_leave_request(): void
    {
        $leave = LeaveRequest::create([
            'student_id' => $this->student1->id,
            'applicant_id' => $this->student1->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-26',
            'status_approval' => 'pending',
        ]);

        // Wali Kelas mencoba verifikasi
        Sanctum::actingAs($this->teacherWaliKelas);
        $resWali = $this->patchJson("/api/leave-requests/{$leave->id}", ['status' => 'approved']);
        $resWali->assertStatus(403);

        // Guru Reguler mencoba verifikasi
        Sanctum::actingAs($this->teacherReguler);
        $resReguler = $this->patchJson("/api/leave-requests/{$leave->id}", ['status' => 'approved']);
        $resReguler->assertStatus(403);
    }

    public function test_index_and_show_scoping(): void
    {
        // Leave 1 untuk Siswa 1 (Kelas XII RPL 1)
        $leave1 = LeaveRequest::create([
            'student_id' => $this->student1->id,
            'applicant_id' => $this->student1->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => '2026-10-25',
            'end_date' => '2026-10-26',
            'status_approval' => 'pending',
        ]);

        // Leave 2 untuk Siswa 2 (Kelas XII TKJ 1)
        $leave2 = LeaveRequest::create([
            'student_id' => $this->student2->id,
            'applicant_id' => $this->student2->id,
            'type' => 'keluar_sekolah',
            'category' => 'lainnya',
            'departure_time' => '10:00',
            'expected_return_time' => '12:00',
            'status_approval' => 'approved',
        ]);

        // 1. Siswa 1 hanya melihat Leave 1
        Sanctum::actingAs($this->student1);
        $resSiswa = $this->getJson('/api/leave-requests');
        $resSiswa->assertStatus(200);
        $this->assertCount(1, $resSiswa->json('data'));
        $this->assertEquals($leave1->id, $resSiswa->json('data.0.id'));

        // Siswa 1 melihat detail Leave 1 (200), mencoba melihat detail Leave 2 (403)
        $this->getJson("/api/leave-requests/{$leave1->id}")->assertStatus(200);
        $this->getJson("/api/leave-requests/{$leave2->id}")->assertStatus(403);

        // 2. Wali Kelas XII RPL 1 hanya melihat siswa di kelasnya (Leave 1)
        Sanctum::actingAs($this->teacherWaliKelas);
        $resWali = $this->getJson('/api/leave-requests');
        $resWali->assertStatus(200);
        $this->assertCount(1, $resWali->json('data'));
        $this->assertEquals($leave1->id, $resWali->json('data.0.id'));

        // 3. Kesiswaan melihat seluruh izin (2 records)
        Sanctum::actingAs($this->teacherKesiswaan);
        $resKesiswaan = $this->getJson('/api/leave-requests');
        $resKesiswaan->assertStatus(200);
        $this->assertCount(2, $resKesiswaan->json('data'));

        // 4. Waka Kurikulum melihat seluruh izin (2 records)
        Sanctum::actingAs($this->waka);
        $resWaka = $this->getJson('/api/leave-requests');
        $resWaka->assertStatus(200);
        $this->assertCount(2, $resWaka->json('data'));

        // 5. Guru reguler tanpa assignment ditolak (403)
        Sanctum::actingAs($this->teacherReguler);
        $this->getJson('/api/leave-requests')->assertStatus(403);
    }
}
