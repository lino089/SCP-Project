<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\PasswordResetOtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ForgotPasswordController extends Controller
{
    public function __construct(
        protected PasswordResetOtpService $otpService
    ) {}

    /**
     * Memeriksa keberadaan identitas akun dan ketersediaan saluran email pemulihan
     * POST /api/auth/forgot-password/check-identity
     */
    public function checkIdentity(Request $request): JsonResponse
    {
        $request->validate([
            'identifier' => 'required|string',
        ], [
            'identifier.required' => 'ID Pengguna, NIS, NIP, atau Email wajib diisi.',
        ]);

        $identifier = trim((string) $request->input('identifier'));
        $user = $this->otpService->findUserByIdentifier($identifier);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'ID Pengguna tidak ditemukan. Silakan periksa kembali NIS, NIP, atau email Anda.',
                'errors' => [
                    'identifier' => ['ID Pengguna tidak terdaftar dalam sistem.'],
                ],
            ], 404);
        }

        if ($user->trashed() || $user->is_active === false) {
            return response()->json([
                'success' => false,
                'message' => 'Akun Anda telah dinonaktifkan atau berada di tempat sampah. Silakan hubungi Waka Kurikulum atau Administrator sekolah.',
                'errors' => [
                    'identifier' => ['Akun telah dinonaktifkan atau berada di tempat sampah.'],
                ],
            ], 403);
        }

        $hasEmail = !empty($user->email);
        $maskedEmail = PasswordResetOtpService::maskEmail($user->email);
        $hasPhone = !empty($user->phone_number);
        $maskedPhone = PasswordResetOtpService::maskPhoneNumber($user->phone_number);
        $isPhoneVerified = !empty($user->phone_verified_at);

        $channels = [];
        if ($hasPhone) {
            $channels[] = 'whatsapp';
        }
        if ($hasEmail) {
            $channels[] = 'email';
        }

        if (empty($channels)) {
            return response()->json([
                'success' => true,
                'message' => 'Akun terdaftar, namun belum memiliki email maupun nomor WhatsApp yang tertaut.',
                'data' => [
                    'identifier' => $identifier,
                    'user_name' => $user->name,
                    'role' => $user->role,
                    'has_channel' => false,
                    'has_email' => false,
                    'masked_email' => null,
                    'has_phone' => false,
                    'masked_phone' => null,
                    'is_phone_verified' => false,
                    'available_channels' => [],
                    'guidance' => 'Akun Anda belum memiliki alamat email maupun nomor WhatsApp yang tertaut di sistem untuk pengiriman kode OTP. Silakan hubungi pihak Waka Kurikulum atau Administrator sekolah di ruang kurikulum untuk mereset kata sandi Anda secara manual.',
                ],
            ], 200);
        }

        return response()->json([
            'success' => true,
            'message' => 'Identitas akun terverifikasi. Saluran pemulihan tersedia.',
            'data' => [
                'identifier' => $identifier,
                'user_name' => $user->name,
                'role' => $user->role,
                'has_channel' => true,
                'has_email' => $hasEmail,
                'masked_email' => $maskedEmail,
                'has_phone' => $hasPhone,
                'masked_phone' => $maskedPhone,
                'is_phone_verified' => $isPhoneVerified,
                'available_channels' => $channels,
                'default_channel' => in_array('whatsapp', $channels) ? 'whatsapp' : 'email',
            ],
        ], 200);
    }

    /**
     * Mengirimkan kode OTP 6-digit ke alamat email atau nomor WhatsApp akun
     * POST /api/auth/forgot-password/send-otp
     */
    public function sendOtp(Request $request): JsonResponse
    {
        $request->validate([
            'identifier' => 'required|string',
            'channel' => 'nullable|string|in:email,whatsapp',
        ]);

        $identifier = trim((string) $request->input('identifier'));
        $channel = $request->input('channel');
        $user = $this->otpService->findUserByIdentifier($identifier);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'ID Pengguna tidak terdaftar.',
            ], 404);
        }

        if ($user->trashed() || $user->is_active === false) {
            return response()->json([
                'success' => false,
                'message' => 'Akun dinonaktifkan.',
            ], 403);
        }

        // Tentukan channel default jika tidak disediakan
        if (!$channel) {
            $channel = !empty($user->phone_number) ? 'whatsapp' : 'email';
        }

        $result = $channel === 'whatsapp'
            ? $this->otpService->sendWhatsAppOtp($user, $identifier)
            : $this->otpService->sendEmailOtp($user, $identifier);

        if (!$result['success']) {
            if ($result['status'] === 'cooldown_active') {
                return response()->json([
                    'success' => false,
                    'message' => $result['message'],
                    'cooldown_remaining' => $result['cooldown_remaining'],
                ], 429);
            }

            if ($result['status'] === 'no_email' || $result['status'] === 'no_phone') {
                return response()->json([
                    'success' => false,
                    'message' => $result['message'],
                ], 422);
            }

            return response()->json([
                'success' => false,
                'message' => $result['message'],
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => $result['message'],
            'data' => [
                'channel' => $result['channel'] ?? $channel,
                'target_masked' => $result['target_masked'],
                'expires_in_seconds' => $result['expires_in_seconds'],
                'cooldown_seconds' => $result['cooldown_seconds'],
            ],
        ], 200);
    }

    /**
     * Memverifikasi kode OTP dan menerbitkan reset_token
     * POST /api/auth/forgot-password/verify-otp
     */
    public function verifyOtp(Request $request): JsonResponse
    {
        $request->validate([
            'identifier' => 'required|string',
            'code' => 'required|string|size:6',
        ], [
            'code.required' => 'Kode OTP wajib diisi.',
            'code.size' => 'Kode OTP harus terdiri dari 6 digit angka.',
        ]);

        $identifier = trim((string) $request->input('identifier'));
        $user = $this->otpService->findUserByIdentifier($identifier);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'ID Pengguna tidak terdaftar.',
            ], 404);
        }

        $result = $this->otpService->verifyOtp($user, $request->input('code'));

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'message' => $result['message'],
                'status' => $result['status'],
                'remaining_attempts' => $result['remaining_attempts'] ?? 0,
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => $result['message'],
            'data' => [
                'reset_token' => $result['reset_token'],
                'token_expires_in_minutes' => $result['token_expires_in_minutes'],
            ],
        ], 200);
    }

    /**
     * Memperbarui kata sandi baru menggunakan reset_token
     * POST /api/auth/forgot-password/reset-password
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'identifier' => 'required|string',
            'reset_token' => 'required|string|size:64',
            'new_password' => [
                'required',
                'string',
                'min:8',
                'confirmed',
            ],
            'new_password_confirmation' => 'required|string',
        ], [
            'new_password.required' => 'Kata sandi baru wajib diisi.',
            'new_password.min' => 'Kata sandi baru minimal 8 karakter.',
            'new_password.confirmed' => 'Konfirmasi kata sandi baru tidak cocok.',
            'new_password_confirmation.required' => 'Konfirmasi kata sandi baru wajib diisi.',
            'reset_token.required' => 'Token pemulihan kata sandi tidak ditemukan.',
        ]);

        $identifier = trim((string) $request->input('identifier'));
        $user = $this->otpService->findUserByIdentifier($identifier);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'ID Pengguna tidak terdaftar.',
            ], 404);
        }

        $result = $this->otpService->resetPasswordWithToken(
            $user,
            $request->input('reset_token'),
            $request->input('new_password')
        );

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'message' => $result['message'],
            ], 403);
        }

        return response()->json([
            'success' => true,
            'message' => $result['message'],
        ], 200);
    }
}
