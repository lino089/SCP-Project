<?php

namespace App\Services;

use App\Models\PhoneAuthOtp;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PhoneAuthOtpService
{
    /**
     * Durasi masa berlaku kode OTP dalam menit (5 menit)
     */
    public const OTP_EXPIRY_MINUTES = 5;

    /**
     * Waktu jeda (cooldown) antar permintaan OTP dalam detik (60 detik)
     */
    public const COOLDOWN_SECONDS = 60;

    /**
     * Batas maksimal kegagalan input kode OTP (5 kali)
     */
    public const MAX_ATTEMPTS = 5;

    /**
     * Durasi token pemilih akun multi-akun dalam menit (5 menit)
     */
    public const SELECTION_TOKEN_EXPIRY_MINUTES = 5;

    public function __construct(
        protected WhatsAppService $whatsAppService
    ) {}

    /**
     * Menyamarkan nomor telepon untuk privasi (contoh: 0812****7890)
     */
    public static function maskPhoneNumber(?string $number): ?string
    {
        if (empty($number)) {
            return null;
        }

        $clean = preg_replace('/[^0-9]/', '', $number);
        $len = strlen($clean);

        if ($len <= 6) {
            return substr($clean, 0, 2) . '****' . substr($clean, -2);
        }

        $start = substr($clean, 0, 4);
        $end = substr($clean, -4);

        return $start . '****' . $end;
    }

    /**
     * Meminta pengiriman kode OTP untuk login menggunakan nomor WhatsApp
     */
    public function requestLoginOtp(string $phoneNumber, ?string $ipAddress = null, ?string $userAgent = null): array
    {
        $normalizedPhone = User::normalizePhoneNumber($phoneNumber);

        if (empty($normalizedPhone) || strlen($normalizedPhone) < 9) {
            return [
                'success' => false,
                'status' => 'invalid_number',
                'message' => 'Format nomor WhatsApp tidak valid. Gunakan nomor Indonesia (contoh: 08123456789 atau 628123456789).',
            ];
        }

        // Cari seluruh akun aktif pemilik nomor ini
        $users = User::withTrashed()
            ->where('phone_number', $normalizedPhone)
            ->get();

        if ($users->isEmpty()) {
            return [
                'success' => false,
                'status' => 'not_found',
                'message' => 'Nomor WhatsApp belum terdaftar di sistem SCP. Silakan hubungi admin sekolah atau masuk menggunakan NIS/NIP & kata sandi.',
            ];
        }

        // Cek jika seluruh akun terkait dinonaktifkan / di tempat sampah
        $activeUsers = $users->filter(fn ($u) => ! $u->trashed() && $u->is_active !== false);
        if ($activeUsers->isEmpty()) {
            return [
                'success' => false,
                'status' => 'inactive',
                'message' => 'Akun yang terhubung dengan nomor ini telah dinonaktifkan atau berada di tempat sampah.',
            ];
        }

        // Cek status verifikasi (Keputusan Pengguna: Wajib verifikasi via OTP di profil sebelum bisa login OTP)
        $verifiedUsers = $activeUsers->filter(fn ($u) => $u->phone_verified_at !== null);
        if ($verifiedUsers->isEmpty()) {
            return [
                'success' => false,
                'status' => 'unverified',
                'message' => 'Nomor WhatsApp ini belum diverifikasi. Silakan masuk terlebih dahulu menggunakan NIS/NIP & kata sandi, kemudian lakukan verifikasi nomor di menu Profil.',
            ];
        }

        // Cek cooldown pengiriman ulang OTP
        $recentOtp = PhoneAuthOtp::where('phone_number', $normalizedPhone)
            ->where('purpose', 'login')
            ->where('resend_available_at', '>', now())
            ->first();

        if ($recentOtp) {
            $remainingSeconds = max(1, now()->diffInSeconds($recentOtp->resend_available_at, false));

            return [
                'success' => false,
                'status' => 'cooldown',
                'message' => "Harap tunggu {$remainingSeconds} detik sebelum meminta kode OTP baru.",
                'data' => [
                    'session_token' => $recentOtp->session_token,
                    'cooldown_seconds' => $remainingSeconds,
                    'masked_phone' => self::maskPhoneNumber($normalizedPhone),
                ],
            ];
        }

        // Proteksi limit harian (maksimal 10 OTP per 24 jam)
        $dailyCount = PhoneAuthOtp::where('phone_number', $normalizedPhone)
            ->where('created_at', '>=', now()->subDay())
            ->count();

        if ($dailyCount >= 10) {
            return [
                'success' => false,
                'status' => 'rate_limited',
                'message' => 'Batas pengiriman kode OTP harian untuk nomor ini telah tercapai. Silakan coba lagi besok.',
            ];
        }

        // Hapus sesi login OTP lama untuk nomor ini
        PhoneAuthOtp::where('phone_number', $normalizedPhone)
            ->where('purpose', 'login')
            ->delete();

        // Generate 6 digit numeric code
        $code = sprintf('%06d', random_int(100000, 999999));
        $sessionToken = (string) Str::uuid();

        PhoneAuthOtp::create([
            'user_id' => $verifiedUsers->count() === 1 ? $verifiedUsers->first()->id : null,
            'phone_number' => $normalizedPhone,
            'channel' => 'whatsapp',
            'code_hash' => Hash::make($code),
            'purpose' => 'login',
            'session_token' => $sessionToken,
            'attempts' => 0,
            'is_verified' => false,
            'expires_at' => now()->addMinutes(self::OTP_EXPIRY_MINUTES),
            'resend_available_at' => now()->addSeconds(self::COOLDOWN_SECONDS),
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
        ]);

        $message = "[SCP SMKN 1 Bantul] Kode verifikasi masuk akun Anda adalah: {$code}. Kode ini berlaku selama 5 menit. Jangan berikan kode ini kepada siapapun.";
        $dispatch = $this->whatsAppService->sendMessage($normalizedPhone, $message);

        if (! $dispatch['success']) {
            Log::warning("[PhoneAuthOtpService] Gagal kirim WA OTP ke {$normalizedPhone}: " . ($dispatch['message'] ?? 'Unknown'));

            return [
                'success' => false,
                'status' => 'dispatch_failed',
                'message' => 'Gagal mengirimkan pesan WhatsApp verifikasi. Pastikan nomor aktif atau coba lagi nanti.',
            ];
        }

        return [
            'success' => true,
            'message' => 'Kode verifikasi berhasil dikirimkan ke nomor WhatsApp Anda.',
            'data' => [
                'session_token' => $sessionToken,
                'masked_phone' => self::maskPhoneNumber($normalizedPhone),
                'expires_in_seconds' => self::OTP_EXPIRY_MINUTES * 60,
                'cooldown_seconds' => self::COOLDOWN_SECONDS,
                'account_count' => $verifiedUsers->count(),
            ],
        ];
    }

    /**
     * Memverifikasi kode OTP login. Menerbitkan token langsung jika 1 akun, atau token pemilih jika multi-akun.
     */
    public function verifyLoginOtp(string $sessionToken, string $code, string $deviceName): array
    {
        $otp = PhoneAuthOtp::where('session_token', $sessionToken)
            ->where('purpose', 'login')
            ->first();

        if (! $otp || $otp->isExpired()) {
            return [
                'success' => false,
                'status' => 'expired_or_invalid',
                'message' => 'Sesi verifikasi tidak valid atau telah kedaluwarsa. Silakan minta kode OTP baru.',
            ];
        }

        if ($otp->hasExceededAttempts()) {
            $otp->delete();

            return [
                'success' => false,
                'status' => 'max_attempts_exceeded',
                'message' => 'Batas percobaan memasukkan kode telah terlampaui. Silakan minta kode OTP baru.',
            ];
        }

        if (! $otp->verifyCode($code)) {
            $otp->increment('attempts');
            $remaining = self::MAX_ATTEMPTS - $otp->attempts;

            if ($remaining <= 0) {
                $otp->delete();

                return [
                    'success' => false,
                    'status' => 'max_attempts_exceeded',
                    'message' => 'Kode OTP salah. Batas percobaan telah habis. Silakan minta kode OTP baru.',
                ];
            }

            return [
                'success' => false,
                'status' => 'wrong_code',
                'message' => "Kode OTP yang Anda masukkan salah. Sisa percobaan: {$remaining} kali.",
                'data' => [
                    'attempts_left' => $remaining,
                ],
            ];
        }

        // Kode OTP cocok!
        $otp->update(['is_verified' => true]);

        // Ambil akun-akun terverifikasi
        $verifiedUsers = User::where('phone_number', $otp->phone_number)
            ->whereNotNull('phone_verified_at')
            ->whereNull('deleted_at')
            ->where('is_active', true)
            ->with(['schoolClass:id,name,level', 'linkedStudent:id,name,nis_nip,class_id'])
            ->get();

        if ($verifiedUsers->isEmpty()) {
            $otp->delete();

            return [
                'success' => false,
                'status' => 'no_verified_accounts',
                'message' => 'Tidak ditemukan akun aktif yang terverifikasi untuk nomor ini.',
            ];
        }

        // KASUS A: Akun Tunggal (Single Account) -> Langsung terbitkan Sanctum Token
        if ($verifiedUsers->count() === 1) {
            $user = $verifiedUsers->first();
            $otp->delete();

            $expiresAt = now()->addMinutes((int) (config('sanctum.expiration') ?? 43200));
            $token = $user->createToken($deviceName, ['*'], $expiresAt);

            return [
                'success' => true,
                'multiple_accounts' => false,
                'message' => 'Berhasil Masuk dengan Nomor WhatsApp',
                'data' => [
                    'token' => $token->plainTextToken,
                    'expires_at' => $expiresAt,
                    'must_change_password' => (bool) $user->must_change_password,
                    'user' => $user->load('assignments'),
                ],
            ];
        }

        // KASUS B: Akun Ganda (Multi-Account - Keputusan Pengguna A2) -> Terbitkan selection_token
        $selectionToken = (string) Str::uuid();
        $otp->update([
            'selection_token' => $selectionToken,
            'expires_at' => now()->addMinutes(self::SELECTION_TOKEN_EXPIRY_MINUTES),
        ]);

        $accountList = $verifiedUsers->map(function ($u) {
            $detail = match ($u->role) {
                'student' => $u->schoolClass ? 'Kelas ' . $u->schoolClass->name : 'Siswa',
                'teacher' => 'Guru Pengajar',
                'parent' => $u->linkedStudent ? 'Wali dari ' . $u->linkedStudent->name : 'Orang Tua / Wali',
                'vice_principal' => 'Waka Kurikulum',
                'admin' => 'Administrator',
                default => ucfirst($u->role),
            };

            return [
                'id' => $u->id,
                'name' => $u->name,
                'role' => $u->role,
                'nis_nip' => $u->nis_nip,
                'detail' => $detail,
            ];
        })->values()->all();

        return [
            'success' => true,
            'multiple_accounts' => true,
            'message' => 'Verifikasi berhasil. Nomor ini terhubung ke beberapa akun. Silakan pilih akun yang ingin diakses.',
            'data' => [
                'selection_token' => $selectionToken,
                'accounts' => $accountList,
                'expires_in_seconds' => self::SELECTION_TOKEN_EXPIRY_MINUTES * 60,
            ],
        ];
    }

    /**
     * Memilih salah satu akun dari daftar nomor bersama dan menerbitkan Sanctum Token
     */
    public function selectAccountAndLogin(string $selectionToken, int $selectedUserId, string $deviceName): array
    {
        $otp = PhoneAuthOtp::where('selection_token', $selectionToken)
            ->where('is_verified', true)
            ->first();

        if (! $otp || $otp->isExpired()) {
            return [
                'success' => false,
                'status' => 'expired_session',
                'message' => 'Sesi pemilihan akun telah kedaluwarsa. Silakan ulangi proses login.',
            ];
        }

        $user = User::where('id', $selectedUserId)
            ->where('phone_number', $otp->phone_number)
            ->whereNotNull('phone_verified_at')
            ->whereNull('deleted_at')
            ->where('is_active', true)
            ->first();

        if (! $user) {
            return [
                'success' => false,
                'status' => 'unauthorized_account',
                'message' => 'Akun yang dipilih tidak valid atau tidak memiliki izin akses untuk nomor ini.',
            ];
        }

        // Hapus sesi OTP
        $otp->delete();

        $expiresAt = now()->addMinutes((int) (config('sanctum.expiration') ?? 43200));
        $token = $user->createToken($deviceName, ['*'], $expiresAt);

        return [
            'success' => true,
            'message' => "Berhasil Masuk sebagai {$user->name}",
            'data' => [
                'token' => $token->plainTextToken,
                'expires_at' => $expiresAt,
                'must_change_password' => (bool) $user->must_change_password,
                'user' => $user->load('assignments'),
            ],
        ];
    }

    /**
     * Meminta pengiriman kode OTP untuk penautan nomor WhatsApp pada profil akun aktif
     */
    public function sendLinkingOtp(User $user, string $phoneNumber, ?string $ipAddress = null, ?string $userAgent = null): array
    {
        $normalizedPhone = User::normalizePhoneNumber($phoneNumber);

        if (empty($normalizedPhone) || strlen($normalizedPhone) < 9) {
            return [
                'success' => false,
                'status' => 'invalid_number',
                'message' => 'Format nomor WhatsApp tidak valid. Gunakan nomor Indonesia (contoh: 08123456789 atau 628123456789).',
            ];
        }

        // Cek cooldown
        $recentOtp = PhoneAuthOtp::where('user_id', $user->id)
            ->where('purpose', 'link_phone')
            ->where('resend_available_at', '>', now())
            ->first();

        if ($recentOtp) {
            $remaining = max(1, now()->diffInSeconds($recentOtp->resend_available_at, false));

            return [
                'success' => false,
                'status' => 'cooldown',
                'message' => "Harap tunggu {$remaining} detik sebelum meminta kode OTP verifikasi baru.",
            ];
        }

        // Hapus link OTP lama user ini
        PhoneAuthOtp::where('user_id', $user->id)
            ->where('purpose', 'link_phone')
            ->delete();

        $code = sprintf('%06d', random_int(100000, 999999));
        $sessionToken = (string) Str::uuid();

        PhoneAuthOtp::create([
            'user_id' => $user->id,
            'phone_number' => $normalizedPhone,
            'channel' => 'whatsapp',
            'code_hash' => Hash::make($code),
            'purpose' => 'link_phone',
            'session_token' => $sessionToken,
            'attempts' => 0,
            'is_verified' => false,
            'expires_at' => now()->addMinutes(self::OTP_EXPIRY_MINUTES),
            'resend_available_at' => now()->addSeconds(self::COOLDOWN_SECONDS),
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
        ]);

        $message = "[SCP SMKN 1 Bantul] Kode verifikasi penautan nomor WhatsApp Anda adalah: {$code}. Kode ini berlaku selama 5 menit. Jangan bagikan kode ini kepada siapapun.";
        $dispatch = $this->whatsAppService->sendMessage($normalizedPhone, $message);

        if (! $dispatch['success']) {
            return [
                'success' => false,
                'status' => 'dispatch_failed',
                'message' => 'Gagal mengirimkan pesan WhatsApp verifikasi. Pastikan nomor aktif atau coba lagi nanti.',
            ];
        }

        return [
            'success' => true,
            'message' => 'Kode verifikasi berhasil dikirimkan ke nomor WhatsApp Anda.',
            'data' => [
                'session_token' => $sessionToken,
                'target' => $normalizedPhone,
                'masked_phone' => self::maskPhoneNumber($normalizedPhone),
                'expires_in_minutes' => self::OTP_EXPIRY_MINUTES,
                'cooldown_seconds' => self::COOLDOWN_SECONDS,
            ],
        ];
    }

    /**
     * Memverifikasi kode OTP dan menautkan nomor WhatsApp ke akun pengguna
     */
    public function verifyAndLinkPhone(User $user, string $sessionToken, string $code): array
    {
        $otp = PhoneAuthOtp::where('session_token', $sessionToken)
            ->where('user_id', $user->id)
            ->where('purpose', 'link_phone')
            ->first();

        if (! $otp || $otp->isExpired()) {
            return [
                'success' => false,
                'status' => 'expired_or_invalid',
                'message' => 'Kode verifikasi tidak valid atau telah kedaluwarsa. Silakan minta kode baru.',
            ];
        }

        if ($otp->hasExceededAttempts()) {
            $otp->delete();

            return [
                'success' => false,
                'status' => 'max_attempts_exceeded',
                'message' => 'Batas percobaan memasukkan kode telah terlampaui. Silakan minta kode baru.',
            ];
        }

        if (! $otp->verifyCode($code)) {
            $otp->increment('attempts');
            $remaining = self::MAX_ATTEMPTS - $otp->attempts;

            return [
                'success' => false,
                'status' => 'wrong_code',
                'message' => "Kode verifikasi salah. Sisa percobaan: {$remaining} kali.",
            ];
        }

        // Berhasil! Update nomor dan waktu verifikasi
        $user->update([
            'phone_number' => $otp->phone_number,
            'phone_verified_at' => now(),
        ]);

        $otp->delete();

        return [
            'success' => true,
            'message' => 'Nomor WhatsApp berhasil diverifikasi dan ditautkan ke akun Anda.',
            'data' => [
                'user' => $user->fresh(),
            ],
        ];
    }

    /**
     * Melepas penautan nomor WhatsApp setelah verifikasi kata sandi
     */
    public function unlinkPhone(User $user, string $currentPassword): array
    {
        if (! Hash::check($currentPassword, $user->password)) {
            return [
                'success' => false,
                'status' => 'wrong_password',
                'message' => 'Kata sandi saat ini yang Anda masukkan salah.',
            ];
        }

        $user->update([
            'phone_number' => null,
            'phone_verified_at' => null,
        ]);

        return [
            'success' => true,
            'message' => 'Penautan nomor WhatsApp berhasil dilepas dari akun Anda.',
            'data' => [
                'user' => $user->fresh(),
            ],
        ];
    }
}
