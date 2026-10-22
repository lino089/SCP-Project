<?php

namespace Tests\Feature;

use App\Mail\VerifyEmailOtpMail;
use App\Models\OtpCode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ProfileContactTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create([
            'role' => 'student',
            'nis_nip' => '12345678',
            'name' => 'Siswa Test',
            'email' => null,
            'email_verified_at' => null,
            'phone_number' => null,
            'google_id' => null,
        ]);
    }

    public function test_unauthenticated_user_cannot_access_profile_contact_endpoints(): void
    {
        $this->postJson('/api/me/email', ['email' => 'test@example.com'])->assertUnauthorized();
        $this->postJson('/api/me/email/verify', ['email' => 'test@example.com', 'code' => '123456'])->assertUnauthorized();
        $this->postJson('/api/me/phone', ['phone_number' => '08123456789'])->assertUnauthorized();
        $this->postJson('/api/me/phone/verify', ['phone_number' => '08123456789', 'code' => '123456'])->assertUnauthorized();
        $this->postJson('/api/me/google-link', ['id_token' => 'dummy_token'])->assertUnauthorized();
    }

    public function test_user_can_request_email_otp_and_receives_mail(): void
    {
        Mail::fake();

        $response = $this->actingAs($this->user)
            ->postJson('/api/me/email', [
                'email' => 'siswa@example.com',
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.target', 'siswa@example.com');

        $this->assertDatabaseHas('otp_codes', [
            'user_id' => $this->user->id,
            'target' => 'siswa@example.com',
            'purpose' => 'email',
        ]);

        Mail::assertSent(VerifyEmailOtpMail::class, function ($mail) {
            return $mail->hasTo('siswa@example.com') && strlen($mail->code) === 6;
        });
    }

    public function test_request_email_otp_enforces_cooldown_rate_limit(): void
    {
        Mail::fake();

        // Permintaan pertama
        $this->actingAs($this->user)
            ->postJson('/api/me/email', ['email' => 'siswa@example.com'])
            ->assertOk();

        // Permintaan kedua langsung (dalam 1 menit) -> 429
        $second = $this->actingAs($this->user)
            ->postJson('/api/me/email', ['email' => 'siswa@example.com']);

        $second->assertStatus(429)
            ->assertJsonPath('success', false);
    }

    public function test_request_email_otp_rejects_duplicate_email(): void
    {
        User::factory()->create([
            'role' => 'student',
            'email' => 'used@example.com',
            'nis_nip' => '87654321',
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/api/me/email', [
                'email' => 'used@example.com',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_user_can_verify_email_otp_successfully(): void
    {
        OtpCode::create([
            'user_id' => $this->user->id,
            'target' => 'siswa@example.com',
            'code' => '123456',
            'purpose' => 'email',
            'expires_at' => now()->addMinutes(10),
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/api/me/email/verify', [
                'email' => 'siswa@example.com',
                'code' => '123456',
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true);

        $this->user->refresh();
        $this->assertSame('siswa@example.com', $this->user->email);
        $this->assertNotNull($this->user->email_verified_at);

        // Baris OTP harus sudah terhapus
        $this->assertDatabaseMissing('otp_codes', [
            'user_id' => $this->user->id,
            'purpose' => 'email',
        ]);
    }

    public function test_verify_email_otp_rejects_wrong_or_expired_code(): void
    {
        // Kode kedaluwarsa
        OtpCode::create([
            'user_id' => $this->user->id,
            'target' => 'siswa@example.com',
            'code' => '111111',
            'purpose' => 'email',
            'expires_at' => now()->subMinute(),
        ]);

        $this->actingAs($this->user)
            ->postJson('/api/me/email/verify', [
                'email' => 'siswa@example.com',
                'code' => '111111',
            ])
            ->assertStatus(422);

        // Kode salah
        OtpCode::create([
            'user_id' => $this->user->id,
            'target' => 'siswa@example.com',
            'code' => '222222',
            'purpose' => 'email',
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->actingAs($this->user)
            ->postJson('/api/me/email/verify', [
                'email' => 'siswa@example.com',
                'code' => '999999',
            ])
            ->assertStatus(422);
    }

    public function test_user_can_request_phone_otp_via_whatsapp(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson('/api/me/phone', [
                'phone_number' => '081234567890',
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.target', '6281234567890');

        $this->assertDatabaseHas('otp_codes', [
            'user_id' => $this->user->id,
            'target' => '6281234567890',
            'purpose' => 'phone',
        ]);
    }

    public function test_request_phone_otp_enforces_validation_and_cooldown(): void
    {
        // Format salah
        $this->actingAs($this->user)
            ->postJson('/api/me/phone', ['phone_number' => '12345'])
            ->assertStatus(422);

        // Sukses pertama
        $this->actingAs($this->user)
            ->postJson('/api/me/phone', ['phone_number' => '081234567890'])
            ->assertOk();

        // Request kedua langsung -> 429
        $this->actingAs($this->user)
            ->postJson('/api/me/phone', ['phone_number' => '081234567890'])
            ->assertStatus(429);
    }

    public function test_user_can_verify_phone_otp_successfully(): void
    {
        OtpCode::create([
            'user_id' => $this->user->id,
            'target' => '6281234567890',
            'code' => '654321',
            'purpose' => 'phone',
            'expires_at' => now()->addMinutes(10),
        ]);

        // Verifikasi dengan format input 08... (yang otomatis dinormalisasi)
        $response = $this->actingAs($this->user)
            ->postJson('/api/me/phone/verify', [
                'phone_number' => '081234567890',
                'code' => '654321',
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true);

        $this->user->refresh();
        $this->assertSame('6281234567890', $this->user->phone_number);

        $this->assertDatabaseMissing('otp_codes', [
            'user_id' => $this->user->id,
            'purpose' => 'phone',
        ]);
    }

    public function test_user_can_link_google_account_and_autofill_email(): void
    {
        $clientId = config('services.google.client_id');

        Http::fake([
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response([
                'sub' => 'google_sub_123456789',
                'email' => 'google_student@example.com',
                'aud' => $clientId,
                'exp' => time() + 3600,
            ], 200),
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/api/me/google-link', [
                'id_token' => 'valid_mocked_google_token',
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true);

        $this->user->refresh();
        $this->assertSame('google_sub_123456789', $this->user->google_id);
        // PRD 5.2: auto-mengisi email jika kosong
        $this->assertSame('google_student@example.com', $this->user->email);
        $this->assertNotNull($this->user->email_verified_at);
    }

    public function test_link_google_rejects_duplicate_google_id(): void
    {
        $clientId = config('services.google.client_id');

        // Buat user lain yang sudah ditautkan
        User::factory()->create([
            'role' => 'student',
            'nis_nip' => '99990001',
            'google_id' => 'existing_google_sub',
        ]);

        Http::fake([
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response([
                'sub' => 'existing_google_sub',
                'email' => 'other@example.com',
                'aud' => $clientId,
            ], 200),
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/api/me/google-link', [
                'id_token' => 'duplicate_token',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_link_google_rejects_invalid_token_or_audience_mismatch(): void
    {
        Http::fake([
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response([
                'error' => 'invalid_token',
                'error_description' => 'Invalid Value',
            ], 400),
        ]);

        $this->actingAs($this->user)
            ->postJson('/api/me/google-link', [
                'id_token' => 'invalid_token',
            ])
            ->assertStatus(422);

        // Audience mismatch
        Http::fake([
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response([
                'sub' => '12345',
                'aud' => 'different_client_id.apps.googleusercontent.com',
            ], 200),
        ]);

        $this->actingAs($this->user)
            ->postJson('/api/me/google-link', [
                'id_token' => 'mismatched_aud_token',
            ])
            ->assertStatus(422);
    }

    public function test_user_can_login_with_google_sso(): void
    {
        $clientId = config('services.google.client_id');

        $this->user->update([
            'google_id' => 'sso_google_sub_999',
        ]);

        Http::fake([
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response([
                'sub' => 'sso_google_sub_999',
                'email' => 'student_sso@example.com',
                'aud' => $clientId,
            ], 200),
        ]);

        $response = $this->postJson('/api/auth/google', [
            'id_token' => 'valid_sso_token',
            'device_name' => 'Android Flutter Test',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'token',
                    'expires_at',
                    'must_change_password',
                    'user',
                ],
            ]);
    }

    public function test_login_with_google_fails_if_account_not_linked(): void
    {
        $clientId = config('services.google.client_id');

        Http::fake([
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response([
                'sub' => 'unlinked_google_sub',
                'email' => 'unknown@example.com',
                'aud' => $clientId,
            ], 200),
        ]);

        $response = $this->postJson('/api/auth/google', [
            'id_token' => 'unlinked_token',
            'device_name' => 'Web App',
        ]);

        $response->assertStatus(404)
            ->assertJsonPath('success', false);
    }
}
