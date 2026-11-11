<?php

namespace Tests\Feature;

use App\Mail\ResetPasswordOtpMail;
use App\Models\PasswordResetOtp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ForgotPasswordTest extends TestCase
{
    use RefreshDatabase;

    private User $userWithEmail;
    private User $userWithoutEmail;

    protected function setUp(): void
    {
        parent::setUp();

        $this->userWithEmail = User::create([
            'name' => 'Budi Santoso',
            'role' => 'teacher',
            'nis_nip' => '198501012010011001',
            'email' => 'budi.santoso@smkn1bantul.sch.id',
            'password' => Hash::make('PasswordLama123!'),
            'must_change_password' => true,
            'is_active' => true,
        ]);

        $this->userWithoutEmail = User::create([
            'name' => 'Ahmad Fajar',
            'role' => 'student',
            'nis_nip' => '19413',
            'email' => null,
            'password' => Hash::make('PasswordAwal194131!'),
            'must_change_password' => true,
            'is_active' => true,
        ]);
    }

    /**
     * Test 1: Pemeriksaan Identitas Akun (Check Identity)
     */
    public function test_check_identity_flow(): void
    {
        // 1. Akun tidak ditemukan
        $resNotFound = $this->postJson('/api/auth/forgot-password/check-identity', [
            'identifier' => '999999999',
        ]);
        $resNotFound->assertStatus(404)
            ->assertJson([
                'success' => false,
            ]);

        // 2. Akun ditemukan tapi tidak memiliki email (Graceful Fallback)
        $resNoEmail = $this->postJson('/api/auth/forgot-password/check-identity', [
            'identifier' => '19413',
        ]);
        $resNoEmail->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'identifier' => '19413',
                    'user_name' => 'Ahmad Fajar',
                    'has_email' => false,
                    'masked_email' => null,
                ],
            ]);
        $this->assertNotEmpty($resNoEmail->json('data.guidance'));

        // 3. Akun ditemukan dan memiliki email
        $resWithEmail = $this->postJson('/api/auth/forgot-password/check-identity', [
            'identifier' => '198501012010011001',
        ]);
        $resWithEmail->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'identifier' => '198501012010011001',
                    'user_name' => 'Budi Santoso',
                    'has_email' => true,
                ],
            ]);
        $this->assertStringContainsString('@smkn1bantul.sch.id', $resWithEmail->json('data.masked_email'));
    }

    /**
     * Test 2: Pengiriman Kode OTP via Email & Batas Cooldown 60 Detik
     */
    public function test_send_otp_flow_and_cooldown(): void
    {
        Mail::fake();

        // 1. Akun tanpa email gagal kirim OTP
        $resNoEmail = $this->postJson('/api/auth/forgot-password/send-otp', [
            'identifier' => '19413',
        ]);
        $resNoEmail->assertStatus(422);

        // 2. Akun dengan email berhasil kirim OTP
        $resSuccess = $this->postJson('/api/auth/forgot-password/send-otp', [
            'identifier' => '198501012010011001',
        ]);
        $resSuccess->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        Mail::assertSent(ResetPasswordOtpMail::class, function ($mail) {
            return $mail->hasTo('budi.santoso@smkn1bantul.sch.id');
        });

        // Verifikasi record tersimpan di database
        $this->assertDatabaseHas('password_reset_otps', [
            'user_id' => $this->userWithEmail->id,
            'target' => 'budi.santoso@smkn1bantul.sch.id',
            'is_verified' => false,
        ]);

        // 3. Permintaan kedua langsung (dalam 60 detik) ditolak cooldown 429
        $resCooldown = $this->postJson('/api/auth/forgot-password/send-otp', [
            'identifier' => '198501012010011001',
        ]);
        $resCooldown->assertStatus(429)
            ->assertJson([
                'success' => false,
            ]);
    }

    /**
     * Test 3: Verifikasi Kode OTP (Berhasil, Salah, dan Batas Maksimal 5x)
     */
    public function test_verify_otp_flow(): void
    {
        // Siapkan OTP aktif di database dengan kode 123456
        $plainCode = '123456';
        PasswordResetOtp::create([
            'user_id' => $this->userWithEmail->id,
            'identifier_input' => '198501012010011001',
            'target' => $this->userWithEmail->email,
            'channel' => 'email',
            'code_hash' => hash('sha256', $plainCode),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(10),
            'is_verified' => false,
        ]);

        // 1. Input kode salah
        $resWrong = $this->postJson('/api/auth/forgot-password/verify-otp', [
            'identifier' => '198501012010011001',
            'code' => '999999',
        ]);
        $resWrong->assertStatus(422)
            ->assertJson([
                'success' => false,
                'remaining_attempts' => 4,
            ]);

        // 2. Input kode benar
        $resCorrect = $this->postJson('/api/auth/forgot-password/verify-otp', [
            'identifier' => '198501012010011001',
            'code' => '123456',
        ]);
        $resCorrect->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $resetToken = $resCorrect->json('data.reset_token');
        $this->assertNotEmpty($resetToken);
        $this->assertEquals(64, strlen($resetToken));

        // Verifikasi status OTP berubah jadi verified
        $this->assertDatabaseHas('password_reset_otps', [
            'user_id' => $this->userWithEmail->id,
            'reset_token' => $resetToken,
            'is_verified' => true,
        ]);
    }

    /**
     * Test 4: Reset Kata Sandi Baru dengan Reset Token
     */
    public function test_reset_password_with_token_flow(): void
    {
        $resetToken = str_repeat('a', 64);
        PasswordResetOtp::create([
            'user_id' => $this->userWithEmail->id,
            'identifier_input' => '198501012010011001',
            'target' => $this->userWithEmail->email,
            'channel' => 'email',
            'code_hash' => hash('sha256', '123456'),
            'reset_token' => $resetToken,
            'is_verified' => true,
            'expires_at' => now()->addMinutes(10),
            'token_expires_at' => now()->addMinutes(15),
        ]);

        // Buat token Sanctum aktif untuk user ini (simulasi sesi login lama)
        $this->userWithEmail->createToken('old-phone-token');
        $this->assertCount(1, $this->userWithEmail->tokens);

        // 1. Reset kata sandi dengan token valid
        $resReset = $this->postJson('/api/auth/forgot-password/reset-password', [
            'identifier' => '198501012010011001',
            'reset_token' => $resetToken,
            'new_password' => 'PasswordBaru999!',
            'new_password_confirmation' => 'PasswordBaru999!',
        ]);

        $resReset->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        // Verifikasi kata sandi baru tersimpan dan must_change_password false
        $this->userWithEmail->refresh();
        $this->assertTrue(Hash::check('PasswordBaru999!', $this->userWithEmail->password));
        $this->assertFalse((bool) $this->userWithEmail->must_change_password);

        // Verifikasi token sesi lama dicabut
        $this->assertCount(0, $this->userWithEmail->fresh()->tokens);

        // Verifikasi record OTP dihapus (tidak bisa reuse token)
        $this->assertDatabaseMissing('password_reset_otps', [
            'reset_token' => $resetToken,
        ]);

        // 2. Percobaan reuse token yang sama ditolak 403
        $resReuse = $this->postJson('/api/auth/forgot-password/reset-password', [
            'identifier' => '198501012010011001',
            'reset_token' => $resetToken,
            'new_password' => 'PasswordBaruLagi123!',
            'new_password_confirmation' => 'PasswordBaruLagi123!',
        ]);
        $resReuse->assertStatus(403);

        // 3. Login dengan kata sandi baru sukses
        $resLogin = $this->postJson('/api/login', [
            'username' => '198501012010011001',
            'password' => 'PasswordBaru999!',
            'device_name' => 'Test PHPUnit',
        ]);
        $resLogin->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    /**
     * Test 5: Pemulihan Kata Sandi Menggunakan Saluran WhatsApp OTP
     */
    public function test_forgot_password_via_whatsapp_channel(): void
    {
        $userWa = User::create([
            'name' => 'Rina Wahyuni',
            'role' => 'teacher',
            'nis_nip' => '199002022015022002',
            'phone_number' => '081298765432',
            'phone_verified_at' => now(),
            'password' => Hash::make('PasswordLama123!'),
            'is_active' => true,
        ]);

        // 1. Check Identity mendeteksi nomor WhatsApp
        $resCheck = $this->postJson('/api/auth/forgot-password/check-identity', [
            'identifier' => '081298765432',
        ]);
        $resCheck->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'has_channel' => true,
                    'has_phone' => true,
                    'available_channels' => ['whatsapp'],
                    'default_channel' => 'whatsapp',
                ],
            ]);

        // 2. Request OTP via WhatsApp
        $resSend = $this->postJson('/api/auth/forgot-password/send-otp', [
            'identifier' => '199002022015022002',
            'channel' => 'whatsapp',
        ]);
        $resSend->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'channel' => 'whatsapp',
                ],
            ]);

        $otp = PasswordResetOtp::where('user_id', $userWa->id)
            ->where('channel', 'whatsapp')
            ->first();
        $this->assertNotNull($otp);

        // 3. Verifikasi OTP WhatsApp
        // Set fixed code
        $code = '654321';
        $otp->update(['code_hash' => hash('sha256', $code)]);

        $resVerify = $this->postJson('/api/auth/forgot-password/verify-otp', [
            'identifier' => '081298765432',
            'code' => $code,
        ]);
        $resVerify->assertStatus(200)
            ->assertJsonStructure([
                'data' => ['reset_token'],
            ]);

        $resetToken = $resVerify->json('data.reset_token');

        // 4. Reset password dengan token
        $resReset = $this->postJson('/api/auth/forgot-password/reset-password', [
            'identifier' => '081298765432',
            'reset_token' => $resetToken,
            'new_password' => 'PasswordBaruWa123!',
            'new_password_confirmation' => 'PasswordBaruWa123!',
        ]);
        $resReset->assertStatus(200);

        // 5. Cek login dengan password baru
        $resLogin = $this->postJson('/api/login', [
            'username' => '081298765432',
            'password' => 'PasswordBaruWa123!',
            'device_name' => 'Test Phone',
        ]);
        $resLogin->assertStatus(200);
    }
}
