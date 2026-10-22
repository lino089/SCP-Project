<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\PeriodTemplate;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\SystemConfiguration;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * FASE 9 - Tugas 9.2: Pengujian Konsistensi Foreign Key & Database Seeder
 * PRD Bagian 10 & MASTER_IMPROVEMENT_PLAN.md:
 * - Foreign Key Constraint: Insert siswa dengan class_id invalid ditolak DB
 * - 409 Conflict: Master data (Kelas, Ruangan, Mapel, Guru) yang direferensikan jadwal aktif tidak bisa dihapus
 * - Seeder Verification: DatabaseSeeder menginisialisasi Waka, config id=1, 50 templates, rooms, subjects
 */
class DatabaseIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;
    private Classes $class;
    private Room $room;
    private Subject $subject;
    private Schedule $activeSchedule;

    protected function setUp(): void
    {
        parent::setUp();

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
        ]);

        $this->teacher = User::create([
            'name' => 'Guru Penjadwalan',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012010011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $this->class = Classes::create(['name' => 'XII RPL 1', 'level' => 12]);
        $this->room = Room::create(['name' => 'Lab RPL 1', 'capacity' => 36]);
        $this->subject = Subject::create(['name' => 'Basis Data']);

        $this->activeSchedule = Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $this->room->id,
            'subject_id' => $this->subject->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);
    }

    public function test_foreign_key_constraint_rejects_student_with_invalid_class_id(): void
    {
        // Pastikan foreign keys aktif di SQLite testing atau PostgreSQL
        DB::statement('PRAGMA foreign_keys = ON;');

        $this->expectException(QueryException::class);

        // Langsung insert raw DB ke tabel users dengan class_id = 999999 (tidak ada di tabel classes)
        DB::table('users')->insert([
            'name' => 'Siswa Invalid Class',
            'email' => 'invalid_class@example.com',
            'nis_nip' => '99999111',
            'role' => 'student',
            'class_id' => 999999, // Non-existent foreign key
            'password' => Hash::make('password123'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_delete_class_fails_with_409_conflict_when_referenced_by_active_schedule(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->deleteJson('/api/classes/' . $this->class->id);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'message' => 'Kelas tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
            ]);

        $this->assertDatabaseHas('classes', ['id' => $this->class->id]);
    }

    public function test_delete_room_fails_with_409_conflict_when_referenced_by_active_schedule(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->deleteJson('/api/rooms/' . $this->room->id);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'message' => 'Ruangan tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
            ]);

        $this->assertDatabaseHas('rooms', ['id' => $this->room->id]);
    }

    public function test_delete_subject_fails_with_409_conflict_when_referenced_by_active_schedule(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->deleteJson('/api/subjects/' . $this->subject->id);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'message' => 'Mata pelajaran tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
            ]);

        $this->assertDatabaseHas('subjects', ['id' => $this->subject->id]);
    }

    public function test_delete_teacher_fails_with_409_conflict_when_referenced_by_active_schedule(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->deleteJson('/api/teachers/' . $this->teacher->id);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'message' => 'Guru tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
            ]);

        $this->assertDatabaseHas('users', ['id' => $this->teacher->id]);
    }

    public function test_database_seeder_initializes_all_mandatory_records(): void
    {
        $this->seed(DatabaseSeeder::class);

        // 1. Akun Waka default
        $waka = User::where('role', 'vice_principal')->where('nis_nip', '12345678')->first();
        $this->assertNotNull($waka);

        // 2. Konfigurasi sistem id=1
        $config = SystemConfiguration::find(1);
        $this->assertNotNull($config);
        $this->assertEquals(1, $config->active_cycle);

        // 3. 50 record PeriodTemplate (10 JP x 5 tipe hari)
        $this->assertEquals(50, PeriodTemplate::count());

        // 4. Data master awal ruangan (5 ruangan)
        $this->assertGreaterThanOrEqual(5, Room::count());
        $this->assertDatabaseHas('rooms', ['name' => 'Lab Komputer 1']);

        // 5. Data master awal mata pelajaran (7 mata pelajaran)
        $this->assertGreaterThanOrEqual(7, Subject::count());
        $this->assertDatabaseHas('subjects', ['name' => 'Pemrograman Web']);
    }
}
