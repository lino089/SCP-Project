<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_sanctum_expiration_config_is_set_to_43200(): void
    {
        $this->assertSame(43200, config('sanctum.expiration'));
    }

    public function test_login_successful_returns_token_expires_at_and_must_change_password(): void
    {
        $user = User::create([
            'name' => 'Siswa Test',
            'email' => 'siswa@example.com',
            'nis_nip' => '12345678',
            'role' => 'student',
            'password' => Hash::make('password123'),
            'must_change_password' => true,
        ]);

        $response = $this->postJson('/api/login', [
            'nis_nip' => '12345678',
            'password' => 'password123',
            'device_name' => 'Flutter-App',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Berhasil Login',
                'data' => [
                    'must_change_password' => true,
                ],
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'token',
                    'expires_at',
                    'must_change_password',
                ],
            ]);

        $tokenData = $response->json('data');
        $this->assertNotEmpty($tokenData['token']);
        $this->assertNotEmpty($tokenData['expires_at']);
        $this->assertTrue($tokenData['must_change_password']);

        // Pastikan token tersimpan di database dengan expires_at
        $pat = PersonalAccessToken::first();
        $this->assertNotNull($pat);
        $this->assertNotNull($pat->expires_at);
        $this->assertTrue($pat->expires_at->isFuture());
    }

    public function test_login_failed_with_wrong_password(): void
    {
        User::create([
            'name' => 'Guru Test',
            'email' => 'guru@example.com',
            'nis_nip' => '1987654321',
            'role' => 'teacher',
            'password' => Hash::make('correct_password'),
            'must_change_password' => false,
        ]);

        $response = $this->postJson('/api/login', [
            'nis_nip' => '1987654321',
            'password' => 'wrong_password',
            'device_name' => 'Web-Browser',
        ]);

        $response->assertStatus(401)
            ->assertExactJson([
                'success' => false,
                'message' => 'Kredensial tidak valid',
                'errors' => [
                    'nis_nip' => [
                        'NIS/NIP atau password salah',
                    ],
                ],
            ]);
    }

    public function test_login_failed_with_nonexistent_user(): void
    {
        $response = $this->postJson('/api/login', [
            'nis_nip' => '99999999',
            'password' => 'anypassword',
            'device_name' => 'Web-Browser',
        ]);

        $response->assertStatus(401)
            ->assertExactJson([
                'success' => false,
                'message' => 'Kredensial tidak valid',
                'errors' => [
                    'nis_nip' => [
                        'NIS/NIP atau password salah',
                    ],
                ],
            ]);
    }
}
