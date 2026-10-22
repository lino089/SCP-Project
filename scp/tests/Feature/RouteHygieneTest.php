<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RouteHygieneTest extends TestCase
{
    use RefreshDatabase;

    protected User $waka;
    protected User $teacher;
    protected User $student;

    protected function setUp(): void
    {
        parent::setUp();

        $this->waka = User::factory()->create([
            'role' => 'vice_principal',
            'nis_nip' => 'WAKA_HYGIENE_01',
        ]);

        $this->teacher = User::factory()->create([
            'role' => 'teacher',
            'nis_nip' => 'TEACHER_HYGIENE_01',
        ]);

        $this->student = User::factory()->create([
            'role' => 'student',
            'nis_nip' => 'STUDENT_HYGIENE_01',
        ]);
    }

    public function test_ping_endpoint_returns_success_health_check(): void
    {
        $response = $this->getJson('/api/ping');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Backend SCP berhasil Merespon')
            ->assertJsonStructure([
                'data' => ['waktu_sekarang'],
            ]);
    }

    public function test_deleted_experimental_routes_return_404(): void
    {
        // R-02: /waka-only sudah dihapus
        $this->actingAs($this->waka)
            ->getJson('/api/waka-only')
            ->assertNotFound();

        // R-07: /attendance-warnings sudah dihapus
        $this->actingAs($this->waka)
            ->getJson('/api/attendance-warnings')
            ->assertNotFound();

        // R-11: /reports/journals sudah dihapus
        $this->actingAs($this->waka)
            ->getJson('/api/reports/journals')
            ->assertNotFound();

        // R-10: /substitute sudah dihapus
        $this->actingAs($this->teacher)
            ->postJson('/api/substitute', [])
            ->assertNotFound();

        // R-04: /journals/{id}/attendance sudah dihapus
        $this->actingAs($this->teacher)
            ->postJson('/api/journals/1/attendance', [])
            ->assertNotFound();

        // R-05: /journals/{id}/complete sudah dihapus
        $this->actingAs($this->teacher)
            ->postJson('/api/journals/1/complete', [])
            ->assertNotFound();

        // R-06: /permissions sudah dihapus
        $this->actingAs($this->student)
            ->postJson('/api/permissions', [])
            ->assertNotFound();

        $this->actingAs($this->teacher)
            ->postJson('/api/permissions/1/status', [])
            ->assertNotFound();

        // R-08: /journals/{id}/quiz/generate sudah dihapus
        $this->actingAs($this->teacher)
            ->postJson('/api/journals/1/quiz/generate', [])
            ->assertNotFound();

        // R-11: /students/{id}/attendance/summary sudah dihapus
        $this->actingAs($this->student)
            ->getJson('/api/students/' . $this->student->id . '/attendance/summary')
            ->assertNotFound();
    }

    public function test_official_routes_are_active_and_accessible(): void
    {
        // Rute resmi cycle-history
        $this->actingAs($this->waka)
            ->getJson('/api/cycle-history')
            ->assertOk();

        // Rute resmi me
        $this->actingAs($this->teacher)
            ->getJson('/api/me')
            ->assertOk();

        // Rute resmi schedules
        $this->actingAs($this->teacher)
            ->getJson('/api/schedules')
            ->assertOk();

        // Rute resmi leave-requests
        $this->actingAs($this->student)
            ->getJson('/api/leave-requests')
            ->assertOk();
    }
}
