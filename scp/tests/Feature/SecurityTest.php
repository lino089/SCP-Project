<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * FASE 9 - Tugas 9.1: Verifikasi Kriteria 1 (API Security)
 * PRD Bagian 10 & MASTER_IMPROVEMENT_PLAN.md:
 * - Request tanpa Bearer Token ditolak universal (401)
 * - Rate limiting 60 req/min aktif (429)
 * - Token expired ditolak (401)
 * - Fleksibilitas login (username dan nis_nip)
 */
class SecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        RateLimiter::clear('api');
        parent::tearDown();
    }

    public function test_unauthenticated_request_is_universally_rejected_with_401(): void
    {
        $endpoints = [
            ['method' => 'getJson', 'url' => '/api/me'],
            ['method' => 'getJson', 'url' => '/api/classes'],
            ['method' => 'getJson', 'url' => '/api/rooms'],
            ['method' => 'getJson', 'url' => '/api/subjects'],
            ['method' => 'getJson', 'url' => '/api/schedules'],
            ['method' => 'getJson', 'url' => '/api/journals'],
            ['method' => 'getJson', 'url' => '/api/leave-requests'],
            ['method' => 'getJson', 'url' => '/api/quizzes'],
            ['method' => 'getJson', 'url' => '/api/academic-settings'],
        ];

        foreach ($endpoints as $ep) {
            $method = $ep['method'];
            $response = $this->$method($ep['url']);

            $response->assertStatus(401)
                ->assertJson([
                    'success' => false,
                    'message' => 'Anda belum login atau sesi sudah berakhir.',
                ]);
        }
    }

    public function test_expired_bearer_token_is_rejected_with_401(): void
    {
        $user = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
        ]);

        // Buat token yang sudah kedaluwarsa
        $token = $user->createToken('test-device', ['*'], now()->subMinutes(10));

        $response = $this->withHeader('Authorization', 'Bearer ' . $token->plainTextToken)
            ->getJson('/api/me');

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Anda belum login atau sesi sudah berakhir.',
            ]);
    }

    public function test_rate_limiting_enforces_maximum_60_requests_per_minute(): void
    {
        $user = User::create([
            'name' => 'Security Throttle User',
            'email' => 'sec_throttle@example.com',
            'nis_nip' => '99881122',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        Sanctum::actingAs($user);

        // 60 request pertama harus berhasil (200 OK)
        for ($i = 1; $i <= 60; $i++) {
            $response = $this->getJson('/api/me');
            $response->assertStatus(200);
        }

        // Request ke-61 harus ditolak dengan status 429 Too Many Requests
        $exceededResponse = $this->getJson('/api/me');
        $exceededResponse->assertStatus(429)
            ->assertJson([
                'success' => false,
                'message' => 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
            ]);
    }

    public function test_flexible_login_supports_both_nis_nip_and_username(): void
    {
        $user = User::create([
            'name' => 'User Fleksibel',
            'email' => 'fisika@example.com',
            'nis_nip' => '198801012015011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 1. Login menggunakan field 'nis_nip'
        $resNisNip = $this->postJson('/api/login', [
            'nis_nip' => '198801012015011001',
            'password' => 'password123',
            'device_name' => 'Mobile-App',
        ]);

        $resNisNip->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Berhasil Login',
            ]);
        $this->assertNotEmpty($resNisNip->json('data.token'));

        // 2. Login menggunakan field 'username' (sesuai spesifikasi PRD Bagian 9)
        $resUsername = $this->postJson('/api/login', [
            'username' => '198801012015011001',
            'password' => 'password123',
            'device_name' => 'Web-Browser',
        ]);

        $resUsername->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Berhasil Login',
            ]);
        $this->assertNotEmpty($resUsername->json('data.token'));

        // 3. Login gagal dengan username salah
        $resWrongUser = $this->postJson('/api/login', [
            'username' => 'user_salah',
            'password' => 'password123',
            'device_name' => 'Web-Browser',
        ]);

        $resWrongUser->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Kredensial tidak valid',
                'errors' => [
                    'username' => [
                        'Username atau password salah',
                    ],
                ],
            ]);
    }
}
