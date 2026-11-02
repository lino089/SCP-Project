<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Journal;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SmartDeleteAndRecycleBinTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;
    private User $student;
    private Classes $class;
    private Room $room;
    private Subject $subject;

    protected function setUp(): void
    {
        parent::setUp();

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('wakaSecret123'),
            'must_change_password' => false,
            'is_active' => true,
        ]);

        $this->class = Classes::create([
            'name' => 'X RPL 1',
            'level' => 10,
        ]);

        $this->room = Room::create([
            'name' => 'Lab Komputer 1',
            'capacity' => 36,
        ]);

        $this->subject = Subject::create([
            'name' => 'Pemrograman Berorientasi Objek',
        ]);

        $this->teacher = User::create([
            'name' => 'Pak Guru Budi',
            'email' => 'budi@example.com',
            'nis_nip' => '198001012005011002',
            'role' => 'teacher',
            'password' => Hash::make('guruSecret123'),
            'must_change_password' => false,
            'is_active' => true,
        ]);

        $this->student = User::create([
            'name' => 'Siswa Ani',
            'email' => 'ani@example.com',
            'nis_nip' => '1001',
            'role' => 'student',
            'class_id' => $this->class->id,
            'password' => Hash::make('siswaSecret123'),
            'must_change_password' => false,
            'is_active' => true,
        ]);
    }

    public function test_check_dependencies_endpoint_with_no_relations(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->getJson("/api/master/guru/{$this->teacher->id}/dependencies");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'can_hard_delete' => true,
                    'total_dependencies' => 0,
                ],
            ]);
    }

    public function test_check_dependencies_endpoint_with_active_relations(): void
    {
        Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'subject_id' => $this->subject->id,
            'room_id' => $this->room->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->getJson("/api/master/guru/{$this->teacher->id}/dependencies");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'can_hard_delete' => false,
                    'total_dependencies' => 1,
                    'dependencies_count' => [
                        'schedules' => 1,
                    ],
                ],
            ]);
    }

    public function test_soft_delete_moves_student_to_trash_and_deactivates(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->deleteJson("/api/students/{$this->student->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        // Verifikasi soft-deleted dan is_active false
        $trashedStudent = User::onlyTrashed()->find($this->student->id);
        $this->assertNotNull($trashedStudent);
        $this->assertFalse((bool) $trashedStudent->is_active);

        // Siswa tidak bisa login lagi
        $loginRes = $this->postJson('/api/login', [
            'username' => '1001',
            'password' => 'siswaSecret123',
            'device_name' => 'test-device',
        ]);

        $loginRes->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_trash_endpoint_lists_trashed_items(): void
    {
        $this->student->delete();
        $this->student->update(['is_active' => false]);

        Sanctum::actingAs($this->waka);

        $response = $this->getJson('/api/master/trash');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'summary' => [
                    'total' => 1,
                    'siswa' => 1,
                    'guru' => 0,
                ],
            ]);

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals(30, $data[0]['days_remaining']);
    }

    public function test_restore_endpoint_restores_user_and_reactivates(): void
    {
        $this->student->delete();
        $this->student->update(['is_active' => false]);

        Sanctum::actingAs($this->waka);

        $response = $this->postJson("/api/master/siswa/{$this->student->id}/restore");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $restored = User::find($this->student->id);
        $this->assertNotNull($restored);
        $this->assertTrue((bool) $restored->is_active);
        $this->assertNull($restored->deleted_at);
    }

    public function test_force_delete_fails_with_invalid_password(): void
    {
        $this->student->delete();

        Sanctum::actingAs($this->waka);

        $response = $this->deleteJson("/api/master/siswa/{$this->student->id}/force", [
            'password' => 'wrongPassword',
        ]);

        $response->assertStatus(422);

        // Data masih ada di database
        $this->assertNotNull(User::withTrashed()->find($this->student->id));
    }

    public function test_force_delete_succeeds_with_valid_password(): void
    {
        $this->student->delete();

        Sanctum::actingAs($this->waka);

        $response = $this->deleteJson("/api/master/siswa/{$this->student->id}/force", [
            'password' => 'wakaSecret123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        // Data telah terhapus fisik dari database
        $this->assertNull(User::withTrashed()->find($this->student->id));
    }

    public function test_auto_purge_command_purges_clean_users_after_30_days(): void
    {
        // Siswa tanpa riwayat KBM dihapus 35 hari lalu
        $this->student->deleted_at = Carbon::now()->subDays(35);
        $this->student->is_active = false;
        $this->student->save();

        Artisan::call('scp:purge-soft-deleted-users', ['--days' => 30]);

        // Karena data bersih, siswa dihapus secara fisik
        $this->assertNull(User::withTrashed()->find($this->student->id));
    }

    public function test_auto_purge_command_anonymizes_users_with_legal_history_after_30_days(): void
    {
        // Guru memiliki jadwal dan jurnal mengajar legal
        $schedule = Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'subject_id' => $this->subject->id,
            'room_id' => $this->room->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        Journal::create([
            'schedule_id' => $schedule->id,
            'date' => Carbon::now()->subDays(40)->toDateString(),
            'topic_description' => 'Materi Pemrograman Objek Lanjut',
            'status' => 'completed',
        ]);

        // Guru dihapus 35 hari lalu
        $this->teacher->deleted_at = Carbon::now()->subDays(35);
        $this->teacher->is_active = false;
        $this->teacher->save();

        Artisan::call('scp:purge-soft-deleted-users', ['--days' => 30]);

        // Guru TIDAK dihapus fisik, melainkan di-anonimkan agar jurnal tetap valid
        $anonymized = User::withTrashed()->find($this->teacher->id);
        $this->assertNotNull($anonymized);
        $this->assertStringStartsWith('[Arsip] ', $anonymized->name);
        $this->assertStringStartsWith('DEL_', $anonymized->nis_nip);
        $this->assertStringContainsString('@archived.local', $anonymized->email);
        $this->assertNotNull($anonymized->archived_at);
        $this->assertFalse((bool) $anonymized->is_active);

        // Jurnal KBM tetap memiliki foreign key yang valid
        $this->assertDatabaseHas('journals', [
            'schedule_id' => $schedule->id,
        ]);
    }
}
