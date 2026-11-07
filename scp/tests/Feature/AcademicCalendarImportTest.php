<?php

namespace Tests\Feature;

use App\Models\AcademicEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AcademicCalendarImportTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;
    private string $excelPath;

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

        $this->excelPath = base_path('MD/xlsx/SMKN 1 BANTUL_KALDIK _26_27.xlsx');
    }

    public function test_non_waka_cannot_access_import_preview_or_commit(): void
    {
        Sanctum::actingAs($this->teacher);

        $response = $this->postJson('/api/academic-events/import-preview', []);
        $response->assertStatus(403);

        $responseCommit = $this->postJson('/api/academic-events/import-commit', []);
        $responseCommit->assertStatus(403);
    }

    public function test_waka_can_generate_import_preview_from_kaldik_excel(): void
    {
        Sanctum::actingAs($this->waka);

        $this->assertFileExists($this->excelPath);

        $uploadedFile = new UploadedFile(
            $this->excelPath,
            'SMKN 1 BANTUL_KALDIK _26_27.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );

        $response = $this->postJson('/api/academic-events/import-preview', [
            'file' => $uploadedFile,
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'preview_token',
                'academic_year',
                'summary' => [
                    'total_events',
                    'valid_count',
                    'warning_count',
                    'duplicate_count',
                    'holiday_count',
                    'exam_count',
                    'school_event_count',
                ],
                'items' => [
                    '*' => [
                        'id',
                        'title',
                        'start_date',
                        'end_date',
                        'type',
                        'scope_type',
                        'scope_targets',
                        'disables_teaching',
                        'status',
                    ],
                ],
            ],
        ]);

        $data = $response->json('data');
        $this->assertEquals('2026/2027', $data['academic_year']);
        $this->assertEquals(46, $data['summary']['total_events']);
        $this->assertNotEmpty($data['preview_token']);

        // Verifikasi Keputusan 1 (Opsi A): Anomali tahun menggunakan tahun blok dengan warning
        $juliAnomaly = collect($data['items'])->first(fn($i) => str_contains($i['title'], 'Libur Akhir Tahun Ajaran 2025/2026'));
        $this->assertNotNull($juliAnomaly);
        $this->assertEquals('2026-07-01', $juliAnomaly['start_date']);
        $this->assertEquals('2026-07-10', $juliAnomaly['end_date']);
        $this->assertEquals('needs_review', $juliAnomaly['status']);

        $israAnomaly = collect($data['items'])->first(fn($i) => str_contains($i['title'], "Isra Mi'raj"));
        $this->assertNotNull($israAnomaly);
        $this->assertEquals('2027-01-05', $israAnomaly['start_date']);
        $this->assertEquals('needs_review', $israAnomaly['status']);

        // Verifikasi Keputusan 2 (Opsi A): Tanggal koma dipecah menjadi 2 event
        $wafatEvents = collect($data['items'])->filter(fn($i) => str_contains($i['title'], 'Wafat & Kebangkitan'))->values();
        $this->assertCount(2, $wafatEvents);
        $this->assertEquals('2027-03-26', $wafatEvents[0]['start_date']);
        $this->assertEquals('2027-03-28', $wafatEvents[1]['start_date']);

        // Verifikasi Keputusan 3 (Opsi A): Deteksi tingkat kelas
        $tkaEvent = collect($data['items'])->first(fn($i) => str_contains($i['title'], 'TKA & AN kelas XII'));
        $this->assertNotNull($tkaEvent);
        $this->assertEquals('grade', $tkaEvent['scope_type']);
        $this->assertEquals(['12'], $tkaEvent['scope_targets']);

        // Token tersimpan di Cache
        $this->assertTrue(Cache::has("academic_event_import_preview:{$data['preview_token']}"));
    }

    public function test_waka_can_commit_import_items_atomically(): void
    {
        Sanctum::actingAs($this->waka);

        $uploadedFile = new UploadedFile(
            $this->excelPath,
            'SMKN 1 BANTUL_KALDIK _26_27.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );

        $previewResponse = $this->postJson('/api/academic-events/import-preview', [
            'file' => $uploadedFile,
        ]);
        $previewData = $previewResponse->json('data');
        $token = $previewData['preview_token'];
        $items = $previewData['items'];

        $commitResponse = $this->postJson('/api/academic-events/import-commit', [
            'preview_token' => $token,
            'duplicate_mode' => 'skip',
            'items' => $items,
        ]);

        $commitResponse->assertStatus(200);
        $commitResponse->assertJson([
            'success' => true,
            'data' => [
                'created' => 46,
                'updated' => 0,
                'skipped' => 0,
            ],
        ]);

        // Verifikasi data tersimpan di DB
        $this->assertDatabaseCount('academic_events', 46);

        // Verifikasi token dihapus dari Cache setelah commit
        $this->assertFalse(Cache::has("academic_event_import_preview:{$token}"));
    }

    public function test_duplicate_events_handling_with_skip_and_update_modes(): void
    {
        Sanctum::actingAs($this->waka);

        // Buat 1 event awal
        $existingEvent = AcademicEvent::create([
            'title' => 'Hari Kemerdekaan RI ke-81',
            'start_date' => '2026-08-17',
            'end_date' => '2026-08-17',
            'type' => 'holiday',
            'scope_type' => 'all',
            'disables_teaching' => true,
            'academic_year' => '2026/2027',
            'created_by' => $this->waka->id,
            'description' => 'Deskripsi Lama',
        ]);

        $uploadedFile = new UploadedFile(
            $this->excelPath,
            'SMKN 1 BANTUL_KALDIK _26_27.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );

        $previewRes = $this->postJson('/api/academic-events/import-preview', [
            'file' => $uploadedFile,
        ]);
        $previewData = $previewRes->json('data');

        // Pastikan terdeteksi duplikat
        $this->assertEquals(1, $previewData['summary']['duplicate_count']);
        $dupItem = collect($previewData['items'])->first(fn($i) => $i['title'] === 'Hari Kemerdekaan RI ke-81');
        $this->assertTrue($dupItem['is_duplicate']);
        $this->assertEquals($existingEvent->id, $dupItem['existing_event_id']);

        // Uji Commit Mode Skip
        $token = $previewData['preview_token'];
        $commitSkipRes = $this->postJson('/api/academic-events/import-commit', [
            'preview_token' => $token,
            'duplicate_mode' => 'skip',
            'items' => $previewData['items'],
        ]);
        $commitSkipRes->assertStatus(200);
        $this->assertEquals(45, $commitSkipRes->json('data.created'));
        $this->assertEquals(1, $commitSkipRes->json('data.skipped'));
        $this->assertEquals(0, $commitSkipRes->json('data.updated'));

        // Event lama tetap tidak berubah
        $this->assertEquals('Deskripsi Lama', $existingEvent->fresh()->description);
    }
}
