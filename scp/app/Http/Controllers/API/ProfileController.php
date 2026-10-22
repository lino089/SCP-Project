<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Mail\VerifyEmailOtpMail;
use App\Models\OtpCode;
use App\Models\User;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ProfileController extends Controller
{
    public function __construct(
        protected WhatsAppService $whatsAppService
    ) {}

    /**
     * Meminta pengiriman kode OTP verifikasi ke alamat email
     * POST /api/me/email
     */
    public function requestEmailOtp(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email|max:255',
        ]);

        $user = $request->user();

        // Cek apakah email sudah digunakan oleh pengguna lain
        if (User::where('email', $request->email)->where('id', '!=', $user->id)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Alamat email sudah digunakan oleh pengguna lain.',
                'errors' => [
                    'email' => ['Alamat email sudah digunakan oleh pengguna lain.'],
                ],
            ], 422);
        }

        // Rate limiting / Cooldown 1 menit per user
        $recent = OtpCode::where('user_id', $user->id)
            ->where('purpose', 'email')
            ->where('created_at', '>=', now()->subMinute())
            ->first();

        if ($recent) {
            return response()->json([
                'success' => false,
                'message' => 'Harap tunggu 1 menit sebelum meminta kode verifikasi email baru.',
            ], 429);
        }

        // Hapus kode OTP email lama untuk user ini
        OtpCode::where('user_id', $user->id)->where('purpose', 'email')->delete();

        // Generate 6 digit numeric code
        $code = sprintf('%06d', random_int(100000, 999999));

        OtpCode::create([
            'user_id' => $user->id,
            'target' => $request->email,
            'code' => $code,
            'purpose' => 'email',
            'expires_at' => now()->addMinutes(10),
        ]);

        try {
            Mail::to($request->email)->send(new VerifyEmailOtpMail($user, $code));
        } catch (\Throwable $e) {
            Log::error('[ProfileController:requestEmailOtp] Gagal kirim email: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Gagal mengirim email verifikasi. Pastikan konfigurasi SMTP benar atau coba lagi nanti.',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Kode verifikasi berhasil dikirim ke email Anda.',
            'data' => [
                'target' => $request->email,
                'expires_in_minutes' => 10,
            ],
        ], 200);
    }

    /**
     * Memverifikasi kode OTP email dan menandai email terverifikasi
     * POST /api/me/email/verify
     */
    public function verifyEmailOtp(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'code' => 'required|string|size:6',
        ]);

        $user = $request->user();

        $otp = OtpCode::where('user_id', $user->id)
            ->where('purpose', 'email')
            ->where('target', $request->email)
            ->where('code', $request->code)
            ->first();

        if (! $otp || $otp->isExpired()) {
            return response()->json([
                'success' => false,
                'message' => 'Kode verifikasi tidak valid atau telah kedaluwarsa.',
            ], 422);
        }

        // Cek ulang ketersediaan email
        if (User::where('email', $request->email)->where('id', '!=', $user->id)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Alamat email sudah digunakan oleh pengguna lain.',
            ], 422);
        }

        $user->update([
            'email' => $request->email,
            'email_verified_at' => now(),
        ]);

        $otp->delete();

        return response()->json([
            'success' => true,
            'message' => 'Email berhasil diverifikasi dan ditautkan ke akun Anda.',
            'data' => [
                'user' => $user->fresh(),
            ],
        ], 200);
    }

    /**
     * Meminta pengiriman kode OTP verifikasi nomor HP via WhatsApp
     * POST /api/me/phone
     */
    public function requestPhoneOtp(Request $request): JsonResponse
    {
        $request->validate([
            'phone_number' => ['required', 'string', 'regex:/^(\+62|62|0)8[0-9]{7,11}$/'],
        ], [
            'phone_number.regex' => 'Format nomor WhatsApp tidak valid. Gunakan nomor Indonesia (misal: 08123456789 atau 628123456789).',
        ]);

        $user = $request->user();
        $normalizedPhone = WhatsAppService::normalizeNumber($request->phone_number);

        // Cek apakah nomor sudah digunakan user lain
        if (User::where('phone_number', $normalizedPhone)->where('id', '!=', $user->id)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Nomor WhatsApp sudah digunakan oleh pengguna lain.',
                'errors' => [
                    'phone_number' => ['Nomor WhatsApp sudah digunakan oleh pengguna lain.'],
                ],
            ], 422);
        }

        // Cooldown 1 menit per user
        $recent = OtpCode::where('user_id', $user->id)
            ->where('purpose', 'phone')
            ->where('created_at', '>=', now()->subMinute())
            ->first();

        if ($recent) {
            return response()->json([
                'success' => false,
                'message' => 'Harap tunggu 1 menit sebelum meminta kode verifikasi WhatsApp baru.',
            ], 429);
        }

        // Hapus kode OTP phone lama untuk user ini
        OtpCode::where('user_id', $user->id)->where('purpose', 'phone')->delete();

        $code = sprintf('%06d', random_int(100000, 999999));

        OtpCode::create([
            'user_id' => $user->id,
            'target' => $normalizedPhone,
            'code' => $code,
            'purpose' => 'phone',
            'expires_at' => now()->addMinutes(10),
        ]);

        $message = "[SCP SMKN 1 Bantul] Kode verifikasi WhatsApp Anda adalah: {$code}. Kode ini berlaku selama 10 menit. Jangan bagikan kode ini kepada siapa pun.";
        $sent = $this->whatsAppService->sendMessage($normalizedPhone, $message);

        if (! $sent['success']) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengirim pesan WhatsApp. Pastikan nomor aktif atau coba lagi nanti.',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Kode verifikasi berhasil dikirim ke nomor WhatsApp Anda.',
            'data' => [
                'target' => $normalizedPhone,
                'expires_in_minutes' => 10,
            ],
        ], 200);
    }

    /**
     * Memverifikasi kode OTP nomor WhatsApp
     * POST /api/me/phone/verify
     */
    public function verifyPhoneOtp(Request $request): JsonResponse
    {
        $request->validate([
            'phone_number' => 'required|string',
            'code' => 'required|string|size:6',
        ]);

        $user = $request->user();
        $normalizedPhone = WhatsAppService::normalizeNumber($request->phone_number);

        $otp = OtpCode::where('user_id', $user->id)
            ->where('purpose', 'phone')
            ->where('target', $normalizedPhone)
            ->where('code', $request->code)
            ->first();

        if (! $otp || $otp->isExpired()) {
            return response()->json([
                'success' => false,
                'message' => 'Kode verifikasi tidak valid atau telah kedaluwarsa.',
            ], 422);
        }

        // Cek ulang ketersediaan nomor
        if (User::where('phone_number', $normalizedPhone)->where('id', '!=', $user->id)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Nomor WhatsApp sudah digunakan oleh pengguna lain.',
            ], 422);
        }

        $user->update([
            'phone_number' => $normalizedPhone,
        ]);

        $otp->delete();

        return response()->json([
            'success' => true,
            'message' => 'Nomor WhatsApp berhasil diverifikasi dan ditautkan ke akun Anda.',
            'data' => [
                'user' => $user->fresh(),
            ],
        ], 200);
    }

    /**
     * Menautkan akun Google ke akun user (PRD 5.2: auto-mengisi email jika kosong)
     * POST /api/me/google-link
     */
    public function linkGoogle(Request $request): JsonResponse
    {
        $request->validate([
            'id_token' => 'required|string',
        ]);

        $user = $request->user();
        $googleData = self::verifyGoogleIdToken($request->id_token);

        if (! $googleData) {
            return response()->json([
                'success' => false,
                'message' => 'Token Google tidak valid atau telah kedaluwarsa.',
            ], 422);
        }

        $googleId = $googleData['sub'];
        $googleEmail = $googleData['email'] ?? null;

        // Cek apakah akun Google sudah dipakai user lain
        if (User::where('google_id', $googleId)->where('id', '!=', $user->id)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Akun Google ini sudah terhubung dengan pengguna lain.',
            ], 422);
        }

        $updates = [
            'google_id' => $googleId,
        ];

        // PRD 5.2: Auto-mengisi email jika kosong
        if (empty($user->email) && ! empty($googleEmail)) {
            if (! User::where('email', $googleEmail)->where('id', '!=', $user->id)->exists()) {
                $updates['email'] = $googleEmail;
                $updates['email_verified_at'] = now();
            }
        }

        $user->update($updates);

        return response()->json([
            'success' => true,
            'message' => 'Akun Google berhasil ditautkan ke profil Anda.',
            'data' => [
                'user' => $user->fresh(),
            ],
        ], 200);
    }

    /**
     * Memverifikasi JWT ID Token Google via Google TokenInfo API
     */
    public static function verifyGoogleIdToken(string $idToken): ?array
    {
        try {
            $response = Http::timeout(10)->get('https://oauth2.googleapis.com/tokeninfo', [
                'id_token' => $idToken,
            ]);

            if (! $response->successful()) {
                Log::warning('[GoogleAuth] Token verification failed: ' . $response->body());

                return null;
            }

            $data = $response->json();
            $expectedClientId = config('services.google.client_id');

            // Verifikasi audience (aud) jika client id telah dikonfigurasi
            if (! empty($expectedClientId) && isset($data['aud']) && $data['aud'] !== $expectedClientId) {
                Log::warning("[GoogleAuth] Token audience mismatch. Expected: {$expectedClientId}, Got: " . ($data['aud'] ?? 'null'));

                return null;
            }

            if (empty($data['sub'])) {
                return null;
            }

            return $data;
        } catch (\Throwable $e) {
            Log::error('[GoogleAuth] Exception during token verification: ' . $e->getMessage());

            return null;
        }
    }
}
