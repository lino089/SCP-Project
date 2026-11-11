<?php

namespace App\Services;

use App\Mail\ResetPasswordOtpMail;
use App\Models\PasswordResetOtp;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class PasswordResetOtpService
{
    /**
     * Durasi kedaluwarsa kode OTP dalam menit (10 menit)
     */
    public const OTP_EXPIRY_MINUTES = 10;

    /**
     * Waktu jeda (cooldown) antar permintaan pengiriman OTP dalam detik (60 detik)
     */
    public const COOLDOWN_SECONDS = 60;

    /**
     * Batas maksimal kegagalan input kode OTP (5 kali)
     */
    public const MAX_ATTEMPTS = 5;

    /**
     * Durasi masa berlaku token reset sandi setelah verifikasi dalam menit (15 menit)
     */
    public const RESET_TOKEN_EXPIRY_MINUTES = 15;

    public function __construct(
        protected WhatsAppService $whatsAppService
    ) {}

    /**
     * Menyamarkan alamat email untuk privasi (contoh: a*****r@gmail.com)
     */
    public static function maskEmail(?string $email): ?string
    {
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        [$username, $domain] = explode('@', $email, 2);
        $len = strlen($username);

        if ($len <= 2) {
            $maskedUser = $username[0] . '*';
        } elseif ($len <= 4) {
            $maskedUser = $username[0] . str_repeat('*', $len - 2) . $username[$len - 1];
        } else {
            $maskedUser = $username[0] . str_repeat('*', $len - 2) . $username[$len - 1];
        }

        return $maskedUser . '@' . $domain;
    }

    /**
     * Menyamarkan nomor telepon untuk privasi (contoh: 0812****7890)
     */
    public static function maskPhoneNumber(?string $phone): ?string
    {
        if (empty($phone)) {
            return null;
        }

        $clean = preg_replace('/[^0-9]/', '', $phone);
        $len = strlen($clean);

        if ($len <= 4) {
            return $clean;
        }

        $prefix = substr($clean, 0, 4);
        $suffix = substr($clean, -4);
        $maskedCount = max(2, $len - 8);

        return $prefix . str_repeat('*', $maskedCount) . $suffix;
    }

    /**
     * Mencari pengguna berdasarkan NIS, NIP, email, atau nomor telepon
     */
    public function findUserByIdentifier(string $identifier): ?User
    {
        $identifier = trim($identifier);
        if ($identifier === '') {
            return null;
        }

        $normalizedPhone = User::normalizePhoneNumber($identifier);

        return User::where(function ($query) use ($identifier, $normalizedPhone) {
            $query->where('nis_nip', $identifier)
                ->orWhere('email', $identifier);

            if (!empty($normalizedPhone)) {
                $query->orWhere('phone_number', $normalizedPhone)
                    ->orWhere('phone_number', $identifier);
            }
        })->first();
    }

    /**
     * Membuat dan mengirim kode OTP pemulihan kata sandi ke alamat email pengguna
     */
    public function sendEmailOtp(User $user, string $identifierInput): array
    {
        if (empty($user->email)) {
            return [
                'success' => false,
                'status' => 'no_email',
                'message' => 'Akun Anda belum memiliki alamat email yang terdaftar atau tertaut di sistem.',
            ];
        }

        // 1. Periksa batas waktu jeda (cooldown 60 detik)
        $recent = PasswordResetOtp::where('user_id', $user->id)
            ->where('channel', 'email')
            ->where('created_at', '>=', now()->subSeconds(self::COOLDOWN_SECONDS))
            ->latest()
            ->first();

        if ($recent) {
            $elapsedSeconds = now()->diffInSeconds($recent->created_at);
            $remaining = max(1, self::COOLDOWN_SECONDS - $elapsedSeconds);

            return [
                'success' => false,
                'status' => 'cooldown_active',
                'message' => "Harap tunggu {$remaining} detik sebelum meminta pengiriman kode OTP baru.",
                'cooldown_remaining' => $remaining,
            ];
        }

        // 2. Bersihkan kode OTP pemulihan sebelumnya yang belum terverifikasi untuk user ini
        PasswordResetOtp::where('user_id', $user->id)
            ->where('is_verified', false)
            ->delete();

        // 3. Generate kode numerik 6 digit acak
        $code = sprintf('%06d', random_int(100000, 999999));
        $codeHash = hash('sha256', $code);

        // 4. Simpan ke database dengan hash SHA-256
        $otp = PasswordResetOtp::create([
            'user_id' => $user->id,
            'identifier_input' => $identifierInput,
            'target' => $user->email,
            'channel' => 'email',
            'code_hash' => $codeHash,
            'attempts' => 0,
            'is_verified' => false,
            'expires_at' => now()->addMinutes(self::OTP_EXPIRY_MINUTES),
        ]);

        // 5. Kirim email via SMTP
        try {
            Mail::to($user->email)->send(new ResetPasswordOtpMail($user, $code));
        } catch (\Throwable $e) {
            Log::error('[PasswordResetOtpService:sendEmailOtp] Gagal kirim email: ' . $e->getMessage(), [
                'user_id' => $user->id,
                'target' => $user->email,
            ]);

            $otp->delete();

            return [
                'success' => false,
                'status' => 'mail_error',
                'message' => 'Gagal mengirim email verifikasi. Pastikan koneksi atau coba beberapa saat lagi.',
            ];
        }

        return [
            'success' => true,
            'status' => 'sent',
            'channel' => 'email',
            'message' => 'Kode verifikasi pemulihan kata sandi telah dikirimkan ke alamat email Anda.',
            'target_masked' => self::maskEmail($user->email),
            'expires_in_seconds' => self::OTP_EXPIRY_MINUTES * 60,
            'cooldown_seconds' => self::COOLDOWN_SECONDS,
        ];
    }

    /**
     * Membuat dan mengirim kode OTP pemulihan kata sandi ke nomor WhatsApp pengguna
     */
    public function sendWhatsAppOtp(User $user, string $identifierInput): array
    {
        if (empty($user->phone_number)) {
            return [
                'success' => false,
                'status' => 'no_phone',
                'message' => 'Akun Anda belum memiliki nomor WhatsApp yang terdaftar atau tertaut di sistem.',
            ];
        }

        // 1. Periksa batas waktu jeda (cooldown 60 detik)
        $recent = PasswordResetOtp::where('user_id', $user->id)
            ->where('channel', 'whatsapp')
            ->where('created_at', '>=', now()->subSeconds(self::COOLDOWN_SECONDS))
            ->latest()
            ->first();

        if ($recent) {
            $elapsedSeconds = now()->diffInSeconds($recent->created_at);
            $remaining = max(1, self::COOLDOWN_SECONDS - $elapsedSeconds);

            return [
                'success' => false,
                'status' => 'cooldown_active',
                'message' => "Harap tunggu {$remaining} detik sebelum meminta pengiriman kode OTP WhatsApp baru.",
                'cooldown_remaining' => $remaining,
            ];
        }

        // 2. Bersihkan kode OTP pemulihan sebelumnya yang belum terverifikasi untuk user ini
        PasswordResetOtp::where('user_id', $user->id)
            ->where('is_verified', false)
            ->delete();

        // 3. Generate kode numerik 6 digit acak
        $code = sprintf('%06d', random_int(100000, 999999));
        $codeHash = hash('sha256', $code);

        // 4. Simpan ke database dengan hash SHA-256
        $otp = PasswordResetOtp::create([
            'user_id' => $user->id,
            'identifier_input' => $identifierInput,
            'target' => $user->phone_number,
            'channel' => 'whatsapp',
            'code_hash' => $codeHash,
            'attempts' => 0,
            'is_verified' => false,
            'expires_at' => now()->addMinutes(self::OTP_EXPIRY_MINUTES),
        ]);

        // 5. Kirim via WhatsApp Service
        $message = "[SCP SMKN 1 Bantul] Kode verifikasi pemulihan kata sandi akun Anda adalah: {$code}. Kode ini berlaku selama 10 menit. Jangan berikan kode ini kepada siapapun.";
        $dispatch = $this->whatsAppService->sendMessage($user->phone_number, $message);

        if (! $dispatch['success']) {
            $otp->delete();

            return [
                'success' => false,
                'status' => 'whatsapp_error',
                'message' => 'Gagal mengirimkan pesan WhatsApp verifikasi. Pastikan nomor aktif atau coba lagi nanti.',
            ];
        }

        return [
            'success' => true,
            'status' => 'sent',
            'channel' => 'whatsapp',
            'message' => 'Kode verifikasi pemulihan kata sandi telah dikirimkan ke nomor WhatsApp Anda.',
            'target_masked' => self::maskPhoneNumber($user->phone_number),
            'expires_in_seconds' => self::OTP_EXPIRY_MINUTES * 60,
            'cooldown_seconds' => self::COOLDOWN_SECONDS,
        ];
    }

    /**
     * Memverifikasi kode OTP yang dimasukkan oleh pengguna
     */
    public function verifyOtp(User $user, string $code): array
    {
        $otp = PasswordResetOtp::where('user_id', $user->id)
            ->where('is_verified', false)
            ->latest()
            ->first();

        if (!$otp) {
            return [
                'success' => false,
                'status' => 'not_found',
                'message' => 'Kode OTP tidak ditemukan atau telah digunakan. Silakan minta kode baru.',
            ];
        }

        if ($otp->isExpired()) {
            $otp->delete();

            return [
                'success' => false,
                'status' => 'expired',
                'message' => 'Kode OTP telah kedaluwarsa. Silakan minta kode verifikasi baru.',
            ];
        }

        // Cek percobaan salah
        if ($otp->attempts >= self::MAX_ATTEMPTS) {
            $otp->delete();

            return [
                'success' => false,
                'status' => 'max_attempts_exceeded',
                'message' => 'Batas maksimal percobaan salah telah tercapai (5 kali). Kode OTP ini dibatalkan demi keamanan. Silakan minta kode baru.',
            ];
        }

        if (!$otp->checkCode($code)) {
            $otp->increment('attempts');
            $remaining = self::MAX_ATTEMPTS - $otp->attempts;

            if ($remaining <= 0) {
                $otp->delete();

                return [
                    'success' => false,
                    'status' => 'max_attempts_exceeded',
                    'message' => 'Batas percobaan salah telah habis. Kode OTP dibatalkan.',
                    'remaining_attempts' => 0,
                ];
            }

            return [
                'success' => false,
                'status' => 'invalid_code',
                'message' => "Kode verifikasi salah. Sisa percobaan: {$remaining} kali.",
                'remaining_attempts' => $remaining,
            ];
        }

        // Kode valid: Terbitkan signed reset_token acak 64 karakter
        $resetToken = Str::random(64);

        $otp->update([
            'is_verified' => true,
            'reset_token' => $resetToken,
            'token_expires_at' => now()->addMinutes(self::RESET_TOKEN_EXPIRY_MINUTES),
        ]);

        return [
            'success' => true,
            'status' => 'verified',
            'message' => 'Kode OTP berhasil diverifikasi.',
            'reset_token' => $resetToken,
            'token_expires_in_minutes' => self::RESET_TOKEN_EXPIRY_MINUTES,
        ];
    }

    /**
     * Memperbarui kata sandi baru menggunakan reset_token sah
     */
    public function resetPasswordWithToken(User $user, string $resetToken, string $newPassword): array
    {
        $otp = PasswordResetOtp::where('user_id', $user->id)
            ->where('reset_token', $resetToken)
            ->where('is_verified', true)
            ->first();

        if (!$otp || $otp->isTokenExpired()) {
            return [
                'success' => false,
                'status' => 'invalid_token',
                'message' => 'Sesi pemulihan kata sandi tidak valid atau telah kedaluwarsa. Silakan ulangi proses lupa kata sandi.',
            ];
        }

        // Update password pengguna dan nonaktifkan must_change_password
        $user->update([
            'password' => Hash::make($newPassword),
            'must_change_password' => false,
        ]);

        // Cabut seluruh token Sanctum aktif di perangkat lain (Session Invalidation)
        $user->tokens()->delete();

        // Hapus rekaman OTP agar token tidak dapat dipakai ulang (Single-Use Guarantee)
        $otp->delete();

        return [
            'success' => true,
            'status' => 'success',
            'message' => 'Kata sandi berhasil diperbarui. Silakan masuk menggunakan kata sandi baru Anda.',
        ];
    }
}
