<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Rooms;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\TeacherAssignment;
use App\Models\TeacherLeaveRequest;
use App\Models\User;
use App\Services\TeacherAssignmentImportService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\SimpleExcel\SimpleExcelWriter;
use Tests\TestCase;

/**
 * End-to-End Workflow Integration Test
 * Menguji integrasi menyeluruh dari Fase 1 hingga Fase 4:
 * 1. Import Excel Penugasan & Verifikasi Matriks
 * 2. Scoping Inbox Verifikasi Izin Kelas Binaan
 * 3. Mekanisme Multi-Kelas First-Responder Concurrency
 * 4. Eskalasi Izin Guru BK/Kesiswaan ke Waka Kurikulum
 * 5. Proteksi Anti-Self-Approval
 * 6. Universal Fallback ke Waka Kurikulum (Dinas Non-Jadwal & Kelas Tanpa BK)
 * 7. Idempotensi Token Commit & Aturan Strict 1 Guru 1 Wali Kelas
 */
class TeacherAssignmentEndToEndWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $counselorA;
    private User $counselorB;
    private User $waliA;
    private User $waliB;
    private User $teacherRegular;
    private User $teacherUnassigned;

    private Classes $classA;
    private Classes $classB;
    private Classes $classC;

    private Schedule $schedA;
    private Schedule $schedB;
    private Schedule $schedC;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Waka Kurikulum
        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka.kurikulum@school.id',
            'nis_nip' => '197501011999031001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 2. Guru BK / Kesiswaan A (Membina Kelas A)
        $this->counselorA = User::create([
            'name' => 'CANDRA RAHADIAN, S.Pd',
            'email' => 'candra.rahadian@school.id',
            'nis_nip' => '198205122006041005',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 3. Guru BK / Kesiswaan B (Membina Kelas B)
        $this->counselorB = User::create([
            'name' => 'NURHIDAYAT SULISTIAWAN, S.Pd',
            'email' => 'nurhidayat.s@school.id',
            'nis_nip' => '198308202008011012',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 4. Guru Wali Kelas A
        $this->waliA = User::create([
            'name' => 'ERIDHA DEWI SEPITASARI, S.Pd.',
            'email' => 'eridha.dewi@school.id',
            'nis_nip' => '197902142005012008',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 5. Guru Wali Kelas B
        $this->waliB = User::create([
            'name' => 'SULARDI, S.Pd.',
            'email' => 'sulardi@school.id',
            'nis_nip' => '198007152009021003',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 6. Guru Mata Pelajaran Biasa (Mengajar di beberapa kelas)
        $this->teacherRegular = User::create([
            'name' => 'GURU MAPEL PRODUKTIF, S.Kom',
            'email' => 'guru.mapel@school.id',
            'nis_nip' => '198911252014031002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 7. Guru Biasa Tanpa Penugasan
        $this->teacherUnassigned = User::create([
            'name' => 'GURU REGULER TANPA TUGAS',
            'email' => 'guru.biasa@school.id',
            'nis_nip' => '199201012019011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // Rombel Kelas
        $this->classA = Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        $this->classB = Classes::create(['name' => 'XI TKJ 1', 'level' => 11]);
        $this->classC = Classes::create(['name' => 'XII DKV 1', 'level' => 12]);

        // Master Jadwal Mengajar KBM
        $room = Rooms::create(['name' => 'Ruang Teori 1', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Pemrograman Perangkat Bergerak']);

        $this->schedA = Schedule::create([
            'teacher_id' => $this->teacherRegular->id,
            'class_id' => $this->classA->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 3,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->schedB = Schedule::create([
            'teacher_id' => $this->teacherRegular->id,
            'class_id' => $this->classB->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 1,
            'period_number' => 4,
            'duration_periods' => 3,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);

        $this->schedC = Schedule::create([
            'teacher_id' => $this->teacherRegular->id,
            'class_id' => $this->classC->id,
            'subject_id' => $subject->id,
            'room_id' => $room->id,
            'day_of_week' => 2,
            'period_number' => 1,
            'duration_periods' => 2,
            'cycle_type' => 1,
            'source' => 'manual',
        ]);
    }

    /**
     * Helper untuk membuat berkas Excel mock
     */
    private function createMockExcel(array $rows): string
    {
        $tempPath = tempnam(sys_get_temp_dir(), 'e2e_excel_') . '.xlsx';
        $writer = SimpleExcelWriter::create($tempPath);

        $writer->addRow(['DAFTAR WALI KELAS DAN GURU BK', '', '', '']);
        $writer->addRow(['SEMESTER GANJIL', '', '', '']);
        $writer->addRow(['NO', 'KELAS', 'NAMA WALI KELAS', 'NAMA GURU BK']);

        foreach ($rows as $row) {
            $writer->addRow($row);
        }

        $writer->addRow(['', 'KETERANGAN :', '', '']);
        $writer->close();

        return $tempPath;
    }

    /**
     * Skenario 1 & 2: Full Matrix Import & Matriks Penugasan Verification
     * - Preview tidak mengubah database (read-only verification).
     * - Commit berhasil menyimpan penugasan tanpa duplikasi wali kelas.
     * - Endpoint matriks menyajikan data penugasan lengkap beserta metadata statistik.
     */
    public function test_e2e_import_and_matrix_verification(): void
    {
        Sanctum::actingAs($this->waka);

        $initialAssignments = TeacherAssignment::count();
        $this->assertEquals(0, $initialAssignments);

        $excelPath = $this->createMockExcel([
            [1, 'X RPL 1', 'ERIDHA DEWI SEPITASARI, S.Pd.', 'CANDRA RAHADIAN, S.Pd'],
            [2, 'XI TKJ 1', 'SULARDI, S.Pd.', 'NURHIDAYAT SULISTIAWAN, S.Pd'],
        ]);

        $uploaded = new UploadedFile($excelPath, 'penugasan.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        // 1. Import Preview
        $previewRes = $this->postJson('/api/teachers/assignments/import-preview', [
            'file' => $uploaded,
        ]);

        $previewRes->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonStructure([
                'success',
                'preview_token',
                'summary',
                'data',
            ]);

        // Verifikasi database tidak berubah sebelum commit
        $this->assertEquals(0, TeacherAssignment::count());

        $token = $previewRes->json('preview_token');
        $this->assertNotEmpty($token);

        // 2. Commit Preview
        $commitRes = $this->postJson('/api/teachers/assignments/import-commit', [
            'preview_token' => $token,
            'items' => [
                [
                    'class_id' => $this->classA->id,
                    'wali_teacher_id' => $this->waliA->id,
                    'bk_teacher_id' => $this->counselorA->id,
                ],
                [
                    'class_id' => $this->classB->id,
                    'wali_teacher_id' => $this->waliB->id,
                    'bk_teacher_id' => $this->counselorB->id,
                ],
            ],
        ]);

        $commitRes->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertEquals(4, TeacherAssignment::count());

        // 3. Matrix Verification
        $matrixRes = $this->getJson('/api/teachers/assignments/matrix');
        $matrixRes->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    '*' => ['class_id', 'class_name', 'level', 'wali_kelas', 'kesiswaan'],
                ],
                'summary' => ['total_classes', 'classes_with_wali', 'classes_with_kesiswaan'],
            ]);

        $classes = $matrixRes->json('data');
        $this->assertCount(3, $classes); // classA, classB, classC

        // Verifikasi kelas A memiliki wali dan bk
        $cAList = array_values(array_filter($classes, fn($c) => $c['class_id'] === $this->classA->id));
        $this->assertNotEmpty($cAList);
        $this->assertEquals($this->waliA->id, $cAList[0]['wali_kelas']['id']);
        $this->assertEquals($this->counselorA->id, $cAList[0]['kesiswaan'][0]['id']);

        // Verifikasi summary statistik
        $summary = $matrixRes->json('summary');
        $this->assertEquals(3, $summary['total_classes']);
        $this->assertEquals(2, $summary['classes_with_wali']);
        $this->assertEquals(2, $summary['classes_with_kesiswaan']);
    }

    /**
     * Skenario 3: Scoped Verification Izin Rombel Tunggal
     * - Guru mengajukan izin pada jadwal Kelas A.
     * - Hanya BK A dan Waka yang dapat melihat pengajuan tersebut di inbox verification.
     * - BK B tidak dapat melihatnya.
     * - Guru tanpa wewenang mendapat daftar kosong di inbox verification dan 403 saat mencoba menyetujui.
     * - BK A menyetujui pengajuan.
     */
    public function test_e2e_single_class_leave_scoping_and_approval(): void
    {
        // Setup penugasan
        TeacherAssignment::create(['user_id' => $this->counselorA->id, 'type' => 'kesiswaan', 'class_id' => $this->classA->id]);
        TeacherAssignment::create(['user_id' => $this->counselorB->id, 'type' => 'kesiswaan', 'class_id' => $this->classB->id]);
        TeacherAssignment::create(['user_id' => $this->waliA->id, 'type' => 'wali_kelas', 'class_id' => $this->classA->id]);

        // Guru Reguler mengajukan izin pada Jadwal Kelas A
        $leaveRequest = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherRegular->id,
            'date' => Carbon::tomorrow()->toDateString(),
            'reason' => 'Demam tinggi dan flu berat',
            'status' => 'pending',
            'schedule_ids' => [$this->schedA->id],
        ]);

        // 1. Guru Tanpa Penugasan melihat inbox verifikasi kosong dan ditolak 403 saat mencoba menyetujui
        Sanctum::actingAs($this->teacherUnassigned);
        $resIndexUnassigned = $this->getJson('/api/teacher-leave-requests?scope=verification');
        $resIndexUnassigned->assertStatus(200);
        $this->assertEmpty($resIndexUnassigned->json('data'));

        $resForbidden = $this->patchJson("/api/teacher-leave-requests/{$leaveRequest->id}/approve", [
            'approval_note' => 'Ilegal approval oleh guru biasa',
        ]);
        $resForbidden->assertStatus(403);

        // 2. BK B tidak melihat izin ini (karena izin untuk Kelas A)
        Sanctum::actingAs($this->counselorB);
        $resBkB = $this->getJson('/api/teacher-leave-requests?scope=verification');
        $resBkB->assertStatus(200);
        $itemsB = $resBkB->json('data');
        $this->assertEmpty(array_filter($itemsB, fn($i) => $i['id'] === $leaveRequest->id));

        // 3. BK A melihat izin ini di inbox verification
        Sanctum::actingAs($this->counselorA);
        $resBkA = $this->getJson('/api/teacher-leave-requests?scope=verification');
        $resBkA->assertStatus(200);
        $itemsA = $resBkA->json('data');
        $this->assertNotEmpty(array_filter($itemsA, fn($i) => $i['id'] === $leaveRequest->id));

        // 4. Waka Kurikulum juga melihat izin ini
        Sanctum::actingAs($this->waka);
        $resWaka = $this->getJson('/api/teacher-leave-requests?scope=verification');
        $resWaka->assertStatus(200);
        $itemsWaka = $resWaka->json('data');
        $this->assertNotEmpty(array_filter($itemsWaka, fn($i) => $i['id'] === $leaveRequest->id));

        // 5. BK A menyetujui pengajuan
        Sanctum::actingAs($this->counselorA);
        $approveRes = $this->patchJson("/api/teacher-leave-requests/{$leaveRequest->id}/approve", [
            'approval_note' => 'Disetujui oleh Pembina BK Kelas A.',
        ]);

        $approveRes->assertStatus(200)
            ->assertJson(['success' => true]);

        $leaveRequest->refresh();
        $this->assertEquals('approved', $leaveRequest->status);
        $this->assertEquals($this->counselorA->id, $leaveRequest->approved_by);
        $this->assertNotNull($leaveRequest->verified_at);
    }

    /**
     * Skenario 4: Multi-Class Leave & First-Responder Concurrency
     * - Guru mengajukan izin yang mencakup Kelas A (BK A) dan Kelas B (BK B).
     * - Muncul di inbox BK A dan BK B.
     * - BK A menyetujui &rarr; 200 OK.
     * - BK B sesaat kemudian mencoba menolak &rarr; Ditolak 422 Unprocessable Entity (Idempotent finality).
     */
    public function test_e2e_multi_class_leave_first_responder_concurrency(): void
    {
        TeacherAssignment::create(['user_id' => $this->counselorA->id, 'type' => 'kesiswaan', 'class_id' => $this->classA->id]);
        TeacherAssignment::create(['user_id' => $this->counselorB->id, 'type' => 'kesiswaan', 'class_id' => $this->classB->id]);

        $multiLeave = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherRegular->id,
            'date' => Carbon::tomorrow()->toDateString(),
            'reason' => 'Menghadiri pernikahan keluarga di luar kota',
            'status' => 'pending',
            'schedule_ids' => [$this->schedA->id, $this->schedB->id],
        ]);

        // Verifikasi BK A dan BK B keduanya melihat pengajuan ini
        Sanctum::actingAs($this->counselorA);
        $resA = $this->getJson('/api/teacher-leave-requests?scope=verification');
        $itemsA = $resA->json('data');
        $this->assertNotEmpty(array_filter($itemsA, fn($i) => $i['id'] === $multiLeave->id));

        Sanctum::actingAs($this->counselorB);
        $resB = $this->getJson('/api/teacher-leave-requests?scope=verification');
        $itemsB = $resB->json('data');
        $this->assertNotEmpty(array_filter($itemsB, fn($i) => $i['id'] === $multiLeave->id));

        // First Responder: BK A menyetujui
        Sanctum::actingAs($this->counselorA);
        $firstResponse = $this->patchJson("/api/teacher-leave-requests/{$multiLeave->id}/approve", [
            'approval_note' => 'Disetujui First-Responder oleh BK A.',
        ]);
        $firstResponse->assertStatus(200);

        $multiLeave->refresh();
        $this->assertEquals('approved', $multiLeave->status);
        $this->assertEquals($this->counselorA->id, $multiLeave->approved_by);

        // Second Responder: BK B mencoba menolak pengajuan yang sudah final
        Sanctum::actingAs($this->counselorB);
        $secondResponse = $this->patchJson("/api/teacher-leave-requests/{$multiLeave->id}/reject", [
            'rejection_reason' => 'Ingin menolak karena jadwal padat.',
        ]);

        // Wajib ditolak dengan status 422 karena status bukan lagi pending
        $secondResponse->assertStatus(422)
            ->assertJson(['success' => false]);

        // Pastikan status tetap approved oleh BK A (tidak tertimpa)
        $multiLeave->refresh();
        $this->assertEquals('approved', $multiLeave->status);
        $this->assertEquals($this->counselorA->id, $multiLeave->approved_by);
    }

    /**
     * Skenario 5: Eskalasi Izin Guru BK/Kesiswaan ke Waka Kurikulum
     * - Guru BK A mengajukan izin.
     * - Rekan sesama Guru BK B dilarang menyetujui (403 Forbidden).
     * - Guru BK A dilarang menyetujui izinnya sendiri (Anti-Self-Approval 403 Forbidden).
     * - Waka Kurikulum berhasil menyetujui.
     */
    public function test_e2e_counselor_leave_escalation_to_waka(): void
    {
        TeacherAssignment::create(['user_id' => $this->counselorA->id, 'type' => 'kesiswaan', 'class_id' => $this->classA->id]);
        TeacherAssignment::create(['user_id' => $this->counselorB->id, 'type' => 'kesiswaan', 'class_id' => $this->classB->id]);

        $counselorLeave = TeacherLeaveRequest::create([
            'teacher_id' => $this->counselorA->id,
            'date' => Carbon::tomorrow()->toDateString(),
            'reason' => 'Periksa kesehatan di RS',
            'status' => 'pending',
            'schedule_ids' => null,
        ]);

        // 1. Rekan BK B mencoba menyetujui -> Ditolak 403 Forbidden
        Sanctum::actingAs($this->counselorB);
        $resBkB = $this->patchJson("/api/teacher-leave-requests/{$counselorLeave->id}/approve", [
            'approval_note' => 'Coba disetujui sesama BK.',
        ]);
        $resBkB->assertStatus(403);

        // 2. Guru BK A mencoba menyetujui izinnya sendiri -> Ditolak 403 (Anti-Self-Approval)
        Sanctum::actingAs($this->counselorA);
        $resSelf = $this->patchJson("/api/teacher-leave-requests/{$counselorLeave->id}/approve", [
            'approval_note' => 'Menyetujui izin diri sendiri.',
        ]);
        $resSelf->assertStatus(403);

        // 3. Waka Kurikulum menyetujui -> Berhasil 200 OK
        Sanctum::actingAs($this->waka);
        $resWaka = $this->patchJson("/api/teacher-leave-requests/{$counselorLeave->id}/approve", [
            'approval_note' => 'Disetujui oleh Waka Kurikulum sebagai atasan langsung.',
        ]);
        $resWaka->assertStatus(200);

        $counselorLeave->refresh();
        $this->assertEquals('approved', $counselorLeave->status);
        $this->assertEquals($this->waka->id, $counselorLeave->approved_by);
    }

    /**
     * Skenario 6: Universal Fallback ke Waka Kurikulum
     * A. Izin dinas non-jadwal (tanpa jam KBM).
     * B. Izin mengajar pada kelas yang belum memiliki pembina BK (orphaned class).
     */
    public function test_e2e_universal_fallback_to_waka(): void
    {
        TeacherAssignment::create(['user_id' => $this->counselorA->id, 'type' => 'kesiswaan', 'class_id' => $this->classA->id]);

        // Bagian A: Izin dinas luar tanpa jadwal (non-teaching)
        $dutyLeave = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherRegular->id,
            'date' => Carbon::tomorrow()->toDateString(),
            'reason' => 'Pelatihan Kurikulum Merdeka di Dinas Pendidikan',
            'status' => 'pending',
            'schedule_ids' => null,
        ]);

        // BK A mencoba menyetujui izin dinas non-jadwal -> Ditolak 403
        Sanctum::actingAs($this->counselorA);
        $resDutyBkA = $this->patchJson("/api/teacher-leave-requests/{$dutyLeave->id}/approve");
        $resDutyBkA->assertStatus(403);

        // Waka Kurikulum menyetujui -> Berhasil 200 OK
        Sanctum::actingAs($this->waka);
        $resDutyWaka = $this->patchJson("/api/teacher-leave-requests/{$dutyLeave->id}/approve", [
            'approval_note' => 'Disetujui tugas dinas luar kota.',
        ]);
        $resDutyWaka->assertStatus(200);

        // Bagian B: Izin mengajar di Kelas C (XII DKV 1) yang belum memiliki pembina BK
        $orphanedLeave = TeacherLeaveRequest::create([
            'teacher_id' => $this->teacherRegular->id,
            'date' => Carbon::tomorrow()->toDateString(),
            'reason' => 'Sakit radang tenggorokan',
            'status' => 'pending',
            'schedule_ids' => [$this->schedC->id], // Jadwal di Class C
        ]);

        // BK A mencoba menyetujui izin kelas C -> Ditolak 403
        Sanctum::actingAs($this->counselorA);
        $resOrphBkA = $this->patchJson("/api/teacher-leave-requests/{$orphanedLeave->id}/approve");
        $resOrphBkA->assertStatus(403);

        // Waka Kurikulum bertindak sebagai Universal Fallback -> Berhasil 200 OK
        Sanctum::actingAs($this->waka);
        $resOrphWaka = $this->patchJson("/api/teacher-leave-requests/{$orphanedLeave->id}/approve", [
            'approval_note' => 'Disetujui Waka Kurikulum (Fallback pembina belum ditugaskan).',
        ]);
        $resOrphWaka->assertStatus(200);

        $orphanedLeave->refresh();
        $this->assertEquals('approved', $orphanedLeave->status);
        $this->assertEquals($this->waka->id, $orphanedLeave->approved_by);
    }

    /**
     * Skenario 7: Idempotensi Token Commit & Aturan Strict 1 Guru 1 Wali Kelas
     * - Mencegah pemanggilan commit berulang dengan token yang sama (HTTP 409/410).
     * - Menolak penugasan jika seorang guru sudah menjabat wali kelas di kelas lain (HTTP 422).
     */
    public function test_e2e_idempotency_and_strict_assignment_protection(): void
    {
        Sanctum::actingAs($this->waka);

        $service = app(TeacherAssignmentImportService::class);
        $excelPath = $this->createMockExcel([
            [1, 'X RPL 1', 'ERIDHA DEWI SEPITASARI, S.Pd.', 'CANDRA RAHADIAN, S.Pd'],
            [2, 'XI TKJ 1', 'SULARDI, S.Pd.', 'NURHIDAYAT SULISTIAWAN, S.Pd'],
        ]);
        $preview = $service->generatePreview($excelPath);
        $token = $preview['preview_token'];

        $payload = [
            'preview_token' => $token,
            'items' => [
                [
                    'class_id' => $this->classA->id,
                    'wali_teacher_id' => $this->waliA->id,
                    'bk_teacher_id' => $this->counselorA->id,
                ],
                [
                    'class_id' => $this->classB->id,
                    'wali_teacher_id' => $this->waliB->id,
                    'bk_teacher_id' => $this->counselorB->id,
                ],
            ],
        ];

        // 1. Commit pertama -> Sukses 200 OK
        $res1 = $this->postJson('/api/teachers/assignments/import-commit', $payload);
        $res1->assertStatus(200);

        // 2. Commit kedua dengan token yang sama -> Wajib Ditolak (409 Conflict / 410 Gone)
        $res2 = $this->postJson('/api/teachers/assignments/import-commit', $payload);
        $this->assertTrue(in_array($res2->status(), [409, 410], true));

        // 3. Coba menugaskan waliA ke kelas C via endpoint penugasan guru -> Wajib Ditolak 422
        $resDuplicateWali = $this->postJson("/api/teachers/{$this->waliA->id}/assignments", [
            'type' => 'wali_kelas',
            'class_id' => $this->classC->id,
        ]);

        $resDuplicateWali->assertStatus(422)
            ->assertJson(['success' => false]);
    }
}
