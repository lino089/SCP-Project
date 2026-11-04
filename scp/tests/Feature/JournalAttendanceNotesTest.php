<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Classes;
use App\Models\Journal;
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

class JournalAttendanceNotesTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;
    private Classes $class;
    private Schedule $schedule;
    private User $student1;
    private User $student2;
    private User $student3;

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
            'nis_nip' => '198501012010011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $this->class = Classes::create([
            'name' => 'XII RPL 1',
            'level' => 12,
        ]);

        $subject = Subject::create([
            'name' => 'Pemrograman Web',
        ]);

        $room = Room::create([
            'name' => 'Lab Komputer 1',
            'capacity' => 36,
        ]);

        $dayOfWeek = (int) Carbon::now('Asia/Jakarta')->dayOfWeekIso;

        $this->schedule = Schedule::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => $dayOfWeek,
            'period_number' => 1,
            'duration_periods' => 3,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->student1 = User::create([
            'name' => 'Budi Pratama',
            'nis_nip' => '1001',
            'role' => 'student',
            'class_id' => $this->class->id,
            'password' => Hash::make('password123'),
        ]);

        $this->student2 = User::create([
            'name' => 'Siti Aisyah',
            'nis_nip' => '1002',
            'role' => 'student',
            'class_id' => $this->class->id,
            'password' => Hash::make('password123'),
        ]);

        $this->student3 = User::create([
            'name' => 'Rian Hidayat',
            'nis_nip' => '1003',
            'role' => 'student',
            'class_id' => $this->class->id,
            'password' => Hash::make('password123'),
        ]);
    }

    public function test_can_save_individual_student_notes_for_present_and_absent_students(): void
    {
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        $journal = Journal::create([
            'schedule_id' => $this->schedule->id,
            'date' => $today,
            'status' => 'ongoing',
        ]);

        Sanctum::actingAs($this->teacher);

        $photo = UploadedFile::fake()->image('kbm.jpg', 800, 600);

        // Student 1: Hadir dengan catatan "Aktif bertanya dan menyelesaikan modul tepat waktu"
        // Student 2: Sakit dengan catatan di exceptions "Demam, surat izin menyusul"
        // Student 3: Hadir tanpa catatan (notes null)
        $response = $this->postJson("/api/journals/{$journal->id}", [
            '_method' => 'PUT',
            'topic_description' => 'Materi Pemrograman Web Lanjutan dan Routing API',
            'photo' => $photo,
            'exceptions' => [
                [
                    'student_id' => $this->student2->id,
                    'status' => 'Sakit',
                    'notes' => 'Demam, surat izin menyusul',
                ],
            ],
            'student_notes' => [
                [
                    'student_id' => $this->student1->id,
                    'notes' => 'Aktif bertanya dan menyelesaikan modul tepat waktu',
                ],
            ],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'completed');

        // Verifikasi di database
        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->student1->id,
            'status' => 'Hadir',
            'notes' => 'Aktif bertanya dan menyelesaikan modul tepat waktu',
        ]);

        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->student2->id,
            'status' => 'Sakit',
            'notes' => 'Demam, surat izin menyusul',
        ]);

        $this->assertDatabaseHas('attendances', [
            'journal_id' => $journal->id,
            'student_id' => $this->student3->id,
            'status' => 'Hadir',
            'notes' => null,
        ]);

        // Verifikasi detail endpoint /api/journals/{id} memuat catatan siswa
        $detailRes = $this->getJson("/api/journals/{$journal->id}");
        $detailRes->assertStatus(200);

        $attendances = collect($detailRes->json('data.attendances'));
        $att1 = $attendances->firstWhere('student_id', $this->student1->id);
        $att2 = $attendances->firstWhere('student_id', $this->student2->id);
        $att3 = $attendances->firstWhere('student_id', $this->student3->id);

        $this->assertEquals('Aktif bertanya dan menyelesaikan modul tepat waktu', $att1['notes']);
        $this->assertEquals('Demam, surat izin menyusul', $att2['notes']);
        $this->assertNull($att3['notes']);
    }
}
