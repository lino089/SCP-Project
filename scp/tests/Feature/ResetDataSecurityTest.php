<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Classes;
use App\Models\Journal;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ResetDataSecurityTest extends TestCase
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
            'password' => Hash::make('wakaPassword123'),
            'must_change_password' => false,
        ]);

        $this->teacher = User::create([
            'name' => 'Guru Pengajar',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012005011002',
            'role' => 'teacher',
            'password' => Hash::make('guruPassword123'),
            'must_change_password' => false,
        ]);

        $this->class = Classes::create([
            'name' => 'X RPL 1',
            'level' => 10,
        ]);

        $this->student = User::create([
            'name' => 'Siswa Teladan',
            'email' => 'siswa@example.com',
            'nis_nip' => '1001',
            'role' => 'student',
            'class_id' => $this->class->id,
            'password' => Hash::make('siswaPassword123'),
            'must_change_password' => false,
        ]);

        $this->room = Room::create([
            'name' => 'Lab Komputer 1',
            'capacity' => 36,
        ]);

        $this->subject = Subject::create([
            'name' => 'Pemrograman Berorientasi Objek',
        ]);
    }

    public function test_reset_schedules_requires_auth(): void
    {
        $response = $this->postJson('/api/schedules/reset', [
            'password' => 'wakaPassword123',
        ]);

        $response->assertStatus(401);
    }

    public function test_reset_schedules_forbidden_for_teacher(): void
    {
        Sanctum::actingAs($this->teacher);

        $response = $this->postJson('/api/schedules/reset', [
            'password' => 'guruPassword123',
        ]);

        $response->assertStatus(403);
    }

    public function test_reset_schedules_fails_with_invalid_password(): void
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

        $response = $this->postJson('/api/schedules/reset', [
            'password' => 'wrongPassword',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi Gagal',
                'errors' => [
                    'password' => ['Password tidak valid'],
                ],
            ]);

        // Verifikasi tidak ada jadwal yang terhapus
        $this->assertEquals(1, Schedule::whereNull('deleted_at')->count());
    }

    public function test_reset_schedules_succeeds_with_valid_password(): void
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

        Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'subject_id' => $this->subject->id,
            'room_id' => $this->room->id,
            'day_of_week' => 2,
            'period_number' => 3,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/schedules/reset', [
            'password' => 'wakaPassword123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'deleted_count' => 2,
                ],
            ]);

        // Verifikasi seluruh jadwal aktif dan riwayat telah di-reset secara permanen (0 jadwal di DB)
        $this->assertEquals(0, Schedule::whereNull('deleted_at')->count());
        $this->assertEquals(0, Schedule::withTrashed()->count());
    }

    public function test_reset_master_data_requires_auth(): void
    {
        $response = $this->postJson('/api/master-data/reset', [
            'password' => 'wakaPassword123',
        ]);

        $response->assertStatus(401);
    }

    public function test_reset_master_data_forbidden_for_student(): void
    {
        Sanctum::actingAs($this->student);

        $response = $this->postJson('/api/master-data/reset', [
            'password' => 'siswaPassword123',
        ]);

        $response->assertStatus(403);
    }

    public function test_reset_master_data_fails_with_invalid_password(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/master-data/reset', [
            'password' => 'invalidPassword99',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi Gagal',
                'errors' => [
                    'password' => ['Password tidak valid'],
                ],
            ]);

        // Verifikasi master data tidak berubah
        $this->assertEquals(1, Classes::count());
        $this->assertEquals(1, Room::count());
        $this->assertEquals(1, Subject::count());
        $this->assertEquals(1, User::where('role', 'teacher')->count());
        $this->assertEquals(1, User::where('role', 'student')->count());
    }

    public function test_reset_master_data_rejected_with_409_if_schedules_exist(): void
    {
        // Buat jadwal aktif yang terhubung dengan master data
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

        // Reset Master Data harus DITOLAK (HTTP 409) jika masih ada Data Jadwal terhubung
        $response = $this->postJson('/api/master-data/reset', [
            'password' => 'wakaPassword123',
        ]);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertStringContainsString('jadwal', strtolower($response->json('message')));

        // Verifikasi tidak ada master data yang dihapus
        $this->assertEquals(1, Classes::count());
        $this->assertEquals(1, Room::count());
        $this->assertEquals(1, Subject::count());
        $this->assertEquals(1, User::where('role', 'teacher')->count());
        $this->assertEquals(1, User::where('role', 'student')->count());
    }

    public function test_reset_master_data_succeeds_when_no_schedules_exist(): void
    {
        // Pastikan tidak ada jadwal aktif
        $this->assertEquals(0, Schedule::whereNull('deleted_at')->count());

        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/master-data/reset', [
            'password' => 'wakaPassword123',
            'scope' => 'all',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        // Verifikasi seluruh master data sekolah ter-reset secara permanen (0 data di DB)
        $this->assertEquals(0, Classes::withTrashed()->count());
        $this->assertEquals(0, Room::withTrashed()->count());
        $this->assertEquals(0, Subject::withTrashed()->count());
        $this->assertEquals(0, User::where('role', 'teacher')->withTrashed()->count());
        $this->assertEquals(0, User::where('role', 'student')->withTrashed()->count());

        // Akun Waka Kurikulum tetap utuh dan aktif
        $this->assertDatabaseHas('users', [
            'id' => $this->waka->id,
            'role' => 'vice_principal',
            'email' => 'waka@example.com',
        ]);
    }

    public function test_reset_schedules_permanently_removes_journals_and_attendances(): void
    {
        $sched = Schedule::create([
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

        $journal = Journal::create([
            'schedule_id' => $sched->id,
            'date' => '2026-11-03',
            'status' => 'ongoing',
        ]);

        Attendance::create([
            'journal_id' => $journal->id,
            'student_id' => $this->student->id,
            'status' => 'Hadir',
            'date' => '2026-11-03',
        ]);

        Sanctum::actingAs($this->waka);

        $response = $this->postJson('/api/schedules/reset', [
            'password' => 'wakaPassword123',
        ]);

        $response->assertStatus(200);

        // Verifikasi seluruh schedules, journals, dan attendances benar-benar terhapus fisik dari DB
        $this->assertEquals(0, Schedule::withTrashed()->count());
        $this->assertEquals(0, Journal::count());
        $this->assertEquals(0, Attendance::count());
    }
}
