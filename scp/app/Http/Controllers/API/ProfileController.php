<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Mail\VerifyEmailOtpMail;
use App\Models\OtpCode;
use App\Models\User;
use App\Services\GoogleAuthService;
use App\Services\PhoneAuthOtpService;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ProfileController extends Controller
{
    public function __construct(
        protected WhatsAppService $whatsAppService,
        protected GoogleAuthService $googleAuthService,
        protected PhoneAuthOtpService $phoneAuthService
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
            'phone_number' => ['required', 'string', 'min:9', 'max:20'],
        ], [
            'phone_number.required' => 'Nomor WhatsApp wajib diisi.',
            'phone_number.min' => 'Nomor WhatsApp minimal 9 digit.',
        ]);

        $user = $request->user();
        $result = $this->phoneAuthService->sendLinkingOtp(
            $user,
            $request->input('phone_number'),
            $request->ip(),
            $request->userAgent()
        );

        if (! $result['success']) {
            $status = $result['status'] ?? 'error';
            $httpCode = match ($status) {
                'cooldown' => 429,
                'invalid_number' => 422,
                default => 500,
            };

            return response()->json($result, $httpCode);
        }

        return response()->json($result, 200);
    }

    /**
     * Memverifikasi kode OTP nomor WhatsApp
     * POST /api/me/phone/verify
     */
    public function verifyPhoneOtp(Request $request): JsonResponse
    {
        $request->validate([
            'code' => 'required|string|size:6',
            'session_token' => 'nullable|string',
            'phone_number' => 'nullable|string',
        ], [
            'code.required' => 'Kode verifikasi 6 digit wajib diisi.',
            'code.size' => 'Kode verifikasi harus tepat 6 digit.',
        ]);

        $user = $request->user();
        $sessionToken = $request->input('session_token');

        // Jika session_token tidak disertakan dari UI lama, cari session_token berdasarkan phone_number & user_id
        if (! $sessionToken && $request->filled('phone_number')) {
            $normalizedPhone = User::normalizePhoneNumber($request->input('phone_number'));
            $latestOtp = \App\Models\PhoneAuthOtp::where('user_id', $user->id)
                ->where('phone_number', $normalizedPhone)
                ->where('purpose', 'link_phone')
                ->latest()
                ->first();

            if ($latestOtp) {
                $sessionToken = $latestOtp->session_token;
            }
        }

        if (! $sessionToken) {
            return response()->json([
                'success' => false,
                'message' => 'Sesi verifikasi tidak ditemukan. Silakan minta kode OTP baru.',
            ], 422);
        }

        $result = $this->phoneAuthService->verifyAndLinkPhone(
            $user,
            $sessionToken,
            $request->input('code')
        );

        if (! $result['success']) {
            $status = $result['status'] ?? 'error';
            $httpCode = match ($status) {
                'expired_or_invalid' => 422,
                'max_attempts_exceeded' => 429,
                'wrong_code' => 422,
                default => 500,
            };

            return response()->json($result, $httpCode);
        }

        return response()->json($result, 200);
    }

    /**
     * Melepas penautan nomor WhatsApp dengan konfirmasi kata sandi
     * POST /api/me/phone/unlink
     */
    public function unlinkPhone(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
        ], [
            'current_password.required' => 'Kata sandi saat ini wajib diisi untuk melepas nomor WhatsApp.',
        ]);

        $user = $request->user();
        $result = $this->phoneAuthService->unlinkPhone(
            $user,
            $request->input('current_password')
        );

        if (! $result['success']) {
            return response()->json($result, 422);
        }

        return response()->json($result, 200);
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
        $googleData = $this->googleAuthService->verifyIdToken($request->id_token);

        if (! $googleData) {
            return response()->json([
                'success' => false,
                'message' => 'Token Google tidak valid atau telah kedaluwarsa.',
            ], 422);
        }

        $result = $this->googleAuthService->linkAccount($user, $googleData);

        if (! $result['success']) {
            return response()->json([
                'success' => false,
                'message' => $result['message'],
                'errors' => [
                    'google_id' => [$result['message']],
                ],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => $result['message'],
            'data' => [
                'user' => $result['user'],
            ],
        ], 200);
    }

    /**
     * Melepas tautan akun Google dengan konfirmasi kata sandi akun (Step-Up Auth)
     * POST /api/me/google-unlink
     */
    public function unlinkGoogle(Request $request): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
        ], [
            'password.required' => 'Kata sandi akun wajib diisi untuk konfirmasi keamanan.',
        ]);

        $user = $request->user();
        $result = $this->googleAuthService->unlinkAccount($user, $request->input('password'));

        if (! $result['success']) {
            return response()->json([
                'success' => false,
                'message' => $result['message'],
                'errors' => [
                    'password' => [$result['message']],
                ],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => $result['message'],
            'data' => [
                'user' => $result['user'],
            ],
        ], 200);
    }

    /**
     * Memverifikasi JWT ID Token Google via Google TokenInfo API (static proxy)
     */
    public static function verifyGoogleIdToken(string $idToken): ?array
    {
        return app(GoogleAuthService::class)->verifyIdToken($idToken);
    }

    /**
     * Memperbarui kata sandi akun pengguna yang sedang login.
     * PATCH /api/me/password
     */
    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'string'],
            'new_password' => [
                'required',
                'string',
                'min:8',
                'confirmed',
                'different:current_password',
            ],
            'new_password_confirmation' => ['required', 'string'],
        ], [
            'current_password.required' => 'Kata sandi saat ini wajib diisi.',
            'new_password.required' => 'Kata sandi baru wajib diisi.',
            'new_password.min' => 'Kata sandi baru minimal 8 karakter.',
            'new_password.confirmed' => 'Konfirmasi kata sandi baru tidak cocok.',
            'new_password.different' => 'Kata sandi baru tidak boleh sama dengan kata sandi saat ini.',
            'new_password_confirmation.required' => 'Konfirmasi kata sandi baru wajib diisi.',
        ]);

        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Kata sandi saat ini yang Anda masukkan tidak sesuai.',
                'errors' => [
                    'current_password' => ['Kata sandi saat ini yang Anda masukkan salah.'],
                ],
            ], 422);
        }

        $user->update([
            'password' => Hash::make($request->new_password),
            'must_change_password' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Kata sandi akun Anda berhasil diperbarui.',
            'data' => [
                'must_change_password' => false,
            ],
        ], 200);
    }
}
