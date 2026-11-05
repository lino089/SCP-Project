<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GoogleSsoTest extends TestCase
{
    use RefreshDatabase;

    private User $teacherUser;
    private User $studentUser;
    private string $clientId = 'test-client-id.apps.googleusercontent.com';

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('services.google.client_id', $this->clientId);

        $this->teacherUser = User::create([
            'name' => 'Agatha Christianti',
            'role' => 'teacher',
            'nis_nip' => '197510282009032001',
            'email' => 'agatha@smkn1bantul.sch.id',
            'password' => Hash::make('GuruSCP@{2001}!'),
            'must_change_password' => false,
            'is_active' => true,
        ]);

        $this->studentUser = User::create([
            'name' => 'Abella Chomaira',
            'role' => 'student',
            'nis_nip' => '19413',
            'email' => null,
            'password' => Hash::make('SiswaSCP@{19413}!'),
            'must_change_password' => false,
            'is_active' => true,
        ]);
    }

    /**
     * Helper untuk mock respon Google TokenInfo API
     */
    private function mockGoogleTokenInfo(array $overrides = [], int $status = 200): void
    {
        Http::fake([
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response(array_merge([
                'sub' => 'google-sub-123456789',
                'email' => 'abella.google@gmail.com',
                'email_verified' => 'true',
                'aud' => $this->clientId,
                'iss' => 'https://accounts.google.com',
                'exp' => (string) (time() + 3600),
            ], $overrides), $status),
        ]);
    }

    /**
     * Test 1: Penautan Akun Google pertama kali untuk user tanpa email (Auto-sync Opsi A)
     */
    public function test_link_google_account_auto_fills_empty_email(): void
    {
        $this->mockGoogleTokenInfo([
            'sub' => 'google-sub-student-01',
            'email' => 'abella.student@gmail.com',
        ]);

        Sanctum::actingAs($this->studentUser);

        $response = $this->postJson('/api/me/google-link', [
            'id_token' => 'valid-mock-id-token',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Akun Google berhasil ditautkan ke profil Anda.',
            ]);

        $this->studentUser->refresh();
        $this->assertEquals('google-sub-student-01', $this->studentUser->google_id);
        $this->assertEquals('abella.student@gmail.com', $this->studentUser->google_email);
        $this->assertNotNull($this->studentUser->google_linked_at);
        // Opsi A: karena email sebelumnya null, harus auto-terisi
        $this->assertEquals('abella.student@gmail.com', $this->studentUser->email);
        $this->assertNotNull($this->studentUser->email_verified_at);
    }

    /**
     * Test 2: Penautan Akun Google untuk user yang sudah memiliki email sekolah (Opsi A: jangan timpa email sekolah)
     */
    public function test_link_google_account_preserves_existing_email(): void
    {
        $this->mockGoogleTokenInfo([
            'sub' => 'google-sub-teacher-01',
            'email' => 'agatha.personal@gmail.com',
        ]);

        Sanctum::actingAs($this->teacherUser);

        $response = $this->postJson('/api/me/google-link', [
            'id_token' => 'valid-mock-id-token',
        ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->teacherUser->refresh();
        $this->assertEquals('google-sub-teacher-01', $this->teacherUser->google_id);
        $this->assertEquals('agatha.personal@gmail.com', $this->teacherUser->google_email);
        // Email sekolah harus tetap terjaga
        $this->assertEquals('agatha@smkn1bantul.sch.id', $this->teacherUser->email);
    }

    /**
     * Test 3: Mencegah akun Google ditautkan ke dua user yang berbeda
     */
    public function test_prevent_duplicate_google_account_linking(): void
    {
        // Tautkan ke teacher dulu
        $this->teacherUser->update([
            'google_id' => 'shared-google-id-999',
            'google_email' => 'shared@gmail.com',
        ]);

        $this->mockGoogleTokenInfo([
            'sub' => 'shared-google-id-999',
            'email' => 'shared@gmail.com',
        ]);

        // Coba tautkan ke student
        Sanctum::actingAs($this->studentUser);

        $response = $this->postJson('/api/me/google-link', [
            'id_token' => 'valid-mock-id-token',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Akun Google ini sudah terhubung dengan akun pengguna lain di sistem SCP.',
            ]);
    }

    /**
     * Test 4: Gagal menautkan jika ID token tidak valid
     */
    public function test_link_fails_with_invalid_google_token(): void
    {
        Http::fake([
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response(['error' => 'invalid_token'], 400),
        ]);

        Sanctum::actingAs($this->studentUser);

        $response = $this->postJson('/api/me/google-link', [
            'id_token' => 'bad-token',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Token Google tidak valid atau telah kedaluwarsa.',
            ]);
    }

    /**
     * Test 5: Melepas tautan Google dengan kata sandi salah (Ditolak)
     */
    public function test_unlink_google_rejects_wrong_password(): void
    {
        $this->teacherUser->update([
            'google_id' => 'google-sub-teacher-01',
            'google_email' => 'agatha.personal@gmail.com',
        ]);

        Sanctum::actingAs($this->teacherUser);

        $response = $this->postJson('/api/me/google-unlink', [
            'password' => 'WrongPassword123!',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Kata sandi akun yang Anda masukkan salah.',
            ]);

        $this->teacherUser->refresh();
        $this->assertNotNull($this->teacherUser->google_id);
    }

    /**
     * Test 6: Melepas tautan Google dengan kata sandi benar (Berhasil)
     */
    public function test_unlink_google_succeeds_with_correct_password(): void
    {
        $this->teacherUser->update([
            'google_id' => 'google-sub-teacher-01',
            'google_email' => 'agatha.personal@gmail.com',
            'google_linked_at' => now(),
        ]);

        Sanctum::actingAs($this->teacherUser);

        $response = $this->postJson('/api/me/google-unlink', [
            'password' => 'GuruSCP@{2001}!',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Tautan akun Google berhasil dilepas dari profil Anda.',
            ]);

        $this->teacherUser->refresh();
        $this->assertNull($this->teacherUser->google_id);
        $this->assertNull($this->teacherUser->google_email);
        $this->assertNull($this->teacherUser->google_linked_at);
    }

    /**
     * Test 7: Login dengan Google SSO berhasil ketika akun sudah tertaut
     */
    public function test_login_with_google_succeeds_when_linked(): void
    {
        $this->teacherUser->update([
            'google_id' => 'google-sub-teacher-01',
            'google_email' => 'agatha.personal@gmail.com',
        ]);

        $this->mockGoogleTokenInfo([
            'sub' => 'google-sub-teacher-01',
            'email' => 'agatha.personal@gmail.com',
        ]);

        $response = $this->postJson('/api/auth/google', [
            'id_token' => 'valid-mock-id-token',
            'device_name' => 'PHPUnit Test Chrome',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'token',
                    'expires_at',
                    'must_change_password',
                    'user',
                ],
            ]);
    }

    /**
     * Test 8: Login dengan Google ditolak (404) jika akun Google belum terhubung
     */
    public function test_login_with_google_fails_when_unlinked(): void
    {
        $this->mockGoogleTokenInfo([
            'sub' => 'unlinked-google-sub-999',
            'email' => 'unlinked@gmail.com',
        ]);

        $response = $this->postJson('/api/auth/google', [
            'id_token' => 'valid-mock-id-token',
            'device_name' => 'PHPUnit Test Chrome',
        ]);

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Akun Google belum terhubung ke akun SCP mana pun. Silakan login menggunakan NIS/NIP dan tautkan akun Google di menu profil.',
            ]);
    }

    /**
     * Test 9: Login dengan Google ditolak (403) jika akun user dinonaktifkan
     */
    public function test_login_with_google_fails_when_user_is_inactive(): void
    {
        $this->teacherUser->update([
            'google_id' => 'google-sub-inactive',
            'is_active' => false,
        ]);

        $this->mockGoogleTokenInfo([
            'sub' => 'google-sub-inactive',
        ]);

        $response = $this->postJson('/api/auth/google', [
            'id_token' => 'valid-mock-id-token',
            'device_name' => 'PHPUnit Test Chrome',
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }
}
