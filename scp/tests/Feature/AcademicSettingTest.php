<?php

namespace Tests\Feature;

use App\Models\CycleHistory;
use App\Models\SystemConfiguration;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AcademicSettingTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;

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

        SystemConfiguration::create([
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);
    }

    public function test_waka_can_get_academic_settings(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->getJson('/api/academic-settings');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'active_cycle' => 1,
                    'monday_is_upacara' => true,
                ],
            ]);
    }

    public function test_waka_can_update_cycle_with_password_confirmation_and_logs_history(): void
    {
        Sanctum::actingAs($this->waka);

        // First cycle history record
        CycleHistory::create([
            'cycle_number' => 1,
            'started_at' => now()->subDays(7),
            'changed_by' => $this->waka->id,
        ]);

        $response = $this->patchJson('/api/academic-settings', [
            'cycle_type' => 2,
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'active_cycle' => 2,
                ],
            ]);

        $this->assertDatabaseHas('system_configurations', [
            'active_cycle' => 2,
        ]);

        // Check cycle history is recorded
        $this->assertDatabaseHas('cycle_history', [
            'cycle_number' => 2,
            'changed_by' => $this->waka->id,
            'ended_at' => null,
        ]);

        // Previous history should now have ended_at
        $this->assertEquals(1, CycleHistory::whereNotNull('ended_at')->count());
    }

    public function test_update_cycle_fails_with_wrong_password(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->patchJson('/api/academic-settings', [
            'cycle_type' => 2,
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi Gagal',
                'errors' => [
                    'password' => ['Password tidak valid'],
                ],
            ]);

        $this->assertDatabaseHas('system_configurations', [
            'active_cycle' => 1,
        ]);
    }

    public function test_waka_can_update_monday_status_with_password(): void
    {
        Sanctum::actingAs($this->waka);

        $response = $this->patchJson('/api/academic-settings/monday-status', [
            'is_upacara' => false,
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'monday_is_upacara' => false,
                ],
            ]);

        $this->assertDatabaseHas('system_configurations', [
            'monday_is_upacara' => false,
        ]);
    }

    public function test_waka_can_view_paginated_cycle_history(): void
    {
        Sanctum::actingAs($this->waka);

        CycleHistory::create([
            'cycle_number' => 1,
            'started_at' => now()->subDays(14),
            'ended_at' => now()->subDays(7),
            'changed_by' => $this->waka->id,
        ]);

        CycleHistory::create([
            'cycle_number' => 2,
            'started_at' => now()->subDays(7),
            'ended_at' => null,
            'changed_by' => $this->waka->id,
        ]);

        $response = $this->getJson('/api/cycle-history');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonCount(2, 'data');

        $aliasResponse = $this->getJson('/api/academic-settings/cycle-history');
        $aliasResponse->assertStatus(200)
            ->assertJsonCount(2, 'data');
    }

    public function test_non_waka_cannot_access_or_mutate_academic_settings(): void
    {
        Sanctum::actingAs($this->teacher);

        $this->getJson('/api/academic-settings')->assertStatus(403);
        $this->patchJson('/api/academic-settings', [
            'cycle_type' => 2,
            'password' => 'password123',
        ])->assertStatus(403);
        $this->patchJson('/api/academic-settings/monday-status', [
            'is_upacara' => false,
            'password' => 'password123',
        ])->assertStatus(403);
        $this->getJson('/api/cycle-history')->assertStatus(403);
    }
}
