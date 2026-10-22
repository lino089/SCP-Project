<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Journal;
use App\Models\LeaveRequest;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\SystemConfiguration;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\PeriodTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * FASE 9 - Tugas 9.1: Verifikasi Kriteria 8 (Sinkronisasi Izin ke Presensi)
 * PRD Bagian 10 & MASTER_IMPROVEMENT_PLAN.md:
 * - Izin tidak_masuk Approved otomatis mengisi Sakit/Izin pada rentang tanggalnya.
 * - Izin keluar_sekolah tidak mengubah status Hadir (tetap Hadir).
 */
class LeaveRequestSyncTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;
    private User $student1;
    private User $student2;
    private User $student3;
    private Classes $class;
    private Schedule $schedule;
    private string $todayDate;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        $this->seed(PeriodTemplateSeeder::class);

        SystemConfiguration::create([
            'id' => 1,
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        $this->teacher = User::create([
            'name' => 'Guru Pengajar',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012010011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $this->class = Classes::create(['name' => 'XII RPL 2', 'level' => 12]);
        $room = Room::create(['name' => 'Lab RPL 2', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Pemrograman Web']);

        $this->todayDate = Carbon::now('Asia/Jakarta')->toDateString();
        $dayOfWeek = (int) Carbon::now('Asia/Jakarta')->dayOfWeekIso;

        $this->schedule = Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'room_id' => $room->id,
            'subject_id' => $subject->id,
            'day_of_week' => $dayOfWeek,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->student1 = User::create([
            'name' => 'Siswa Sakit',
            'nis_nip' => '1101',
            'role' => 'student',
            'class_id' => $this->class->id,
            'password' => Hash::make('password123'),
        ]);

        $this->student2 = User::create([
            'name' => 'Siswa Keluar Sekolah',
            'nis_nip' => '1102',
            'role' => 'student',
            'class_id' => $this->class->id,
            'password' => Hash::make('password123'),
        ]);

        $this->student3 = User::create([
            'name' => 'Siswa Rajin Hadir',
            'nis_nip' => '1103',
            'role' => 'student',
            'class_id' => $this->class->id,
            'password' => Hash::make('password123'),
        ]);
    }

    public function test_approved_tidak_masuk_auto_syncs_to_sakit_or_izin_and_keluar_sekolah_retains_hadir(): void
    {
        // 1. Siswa 1 memiliki izin tidak_masuk (sakit) yang sudah Approved
        LeaveRequest::create([
            'student_id' => $this->student1->id,
            'applicant_id' => $this->student1->id,
            'type' => 'tidak_masuk',
            'category' => 'sakit',
            'start_date' => $this->todayDate,
            'end_date' => $this->todayDate,
            'status_approval' => 'approved',
        ]);

        // 2. Siswa 2 memiliki izin keluar_sekolah (dispensasi/lomba) yang sudah Approved
        LeaveRequest::create([
            'student_id' => $this->student2->id,
            'applicant_id' => $this->student2->id,
            'type' => 'keluar_sekolah',
            'category' => 'lainnya',
            'departure_time' => '10:00',
            'expected_return_time' => '12:00',
            'status_approval' => 'approved',
        ]);

        Sanctum::actingAs($this->teacher);

        // Buka Jurnal KBM
        $openRes = $this->postJson('/api/journals', [
            'schedule_id' => $this->schedule->id,
        ]);
        $openRes->assertStatus(201);
        $journalId = $openRes->json('data.id');

        // Pastikan meta approved_leaves menyertakan Siswa 1 sebagai default Sakit
        $openRes->assertJsonFragment([
            'student_id' => $this->student1->id,
            'default_status' => 'Sakit',
        ]);

        // Guru menyimpan presensi exception-based tanpa menyebut Siswa 1, 2, atau 3
        // (Semua siswa diserahkan pada mekanisme otomatis sistem)
        $fakePhoto = UploadedFile::fake()->image('kbm_photo.jpg', 600, 400);

        $putRes = $this->putJson("/api/journals/{$journalId}", [
            'topic_description' => 'Membahas topik OOP lanjutan',
            'material_summary' => 'Belajar sinkronisasi presensi otomatis',
            'photo' => $fakePhoto,
            'exceptions' => [], // Kosong: Guru tidak meng-input exception manual
        ]);

        $putRes->assertStatus(200);

        // Verifikasi hasil presensi di database:
        // - Siswa 1 (izin tidak_masuk) otomatis tercatat 'Sakit'
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journalId,
            'student_id' => $this->student1->id,
            'status' => 'Sakit',
        ]);

        // - Siswa 2 (izin keluar_sekolah) tetap tercatat 'Hadir'
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journalId,
            'student_id' => $this->student2->id,
            'status' => 'Hadir',
        ]);

        // - Siswa 3 (tanpa izin dan tidak di exception) otomatis tercatat 'Hadir'
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journalId,
            'student_id' => $this->student3->id,
            'status' => 'Hadir',
        ]);
    }
}
