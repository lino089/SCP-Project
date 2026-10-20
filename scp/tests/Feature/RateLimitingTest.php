<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RateLimitingTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        RateLimiter::clear('api');
        parent::tearDown();
    }

    public function test_authenticated_api_is_rate_limited_to_60_requests_per_minute(): void
    {
        $user = User::create([
            'name' => 'User Throttle',
            'email' => 'throttle@example.com',
            'nis_nip' => '99887766',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        Sanctum::actingAs($user);

        // Send 60 requests -> should all succeed
        for ($i = 0; $i < 60; $i++) {
            $response = $this->getJson('/api/me');
            $response->assertStatus(200);
        }

        // 61st request -> should return 429
        // 61st request -> should return 429
        $response61 = $this->getJson('/api/me');
        $response61->assertStatus(429)
            ->assertJson([
                'success' => false,
                'message' => 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
                'errors' => null,
            ]);
    }
}
