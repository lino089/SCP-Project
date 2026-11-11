<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\PhoneAuthOtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PhoneAuthController extends Controller
{
    public function __construct(
        protected PhoneAuthOtpService $phoneAuthService
    ) {}

    /**
     * Meminta pengiriman kode OTP untuk login nomor WhatsApp
     * POST /api/auth/phone/login-request
     */
    public function requestLoginOtp(Request $request): JsonResponse
    {
        $request->validate([
            'phone_number' => ['required', 'string', 'min:9', 'max:20'],
        ], [
            'phone_number.required' => 'Nomor WhatsApp wajib diisi.',
            'phone_number.min' => 'Nomor WhatsApp minimal 9 digit.',
        ]);

        $ipAddress = $request->ip();
        $userAgent = $request->userAgent();

        $result = $this->phoneAuthService->requestLoginOtp(
            $request->input('phone_number'),
            $ipAddress,
            $userAgent
        );

        if (! $result['success']) {
            $status = $result['status'] ?? 'error';
            $httpCode = match ($status) {
                'not_found' => 404,
                'inactive', 'unverified' => 403,
                'cooldown', 'rate_limited' => 429,
                'invalid_number' => 422,
                default => 500,
            };

            return response()->json($result, $httpCode);
        }

        return response()->json($result, 200);
    }

    /**
     * Memverifikasi kode OTP login WhatsApp
     * POST /api/auth/phone/login-verify
     */
    public function verifyLoginOtp(Request $request): JsonResponse
    {
        $request->validate([
            'session_token' => ['required', 'string', 'size:36'],
            'code' => ['required', 'string', 'size:6'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ], [
            'session_token.required' => 'Token sesi tidak valid.',
            'code.required' => 'Kode OTP 6 digit wajib diisi.',
            'code.size' => 'Kode OTP harus tepat 6 digit.',
        ]);

        $deviceName = $request->input('device_name') ?? 'Unknown Device';

        $result = $this->phoneAuthService->verifyLoginOtp(
            $request->input('session_token'),
            $request->input('code'),
            $deviceName
        );

        if (! $result['success']) {
            $status = $result['status'] ?? 'error';
            $httpCode = match ($status) {
                'expired_or_invalid' => 404,
                'max_attempts_exceeded' => 429,
                'wrong_code' => 422,
                'no_verified_accounts' => 403,
                default => 500,
            };

            return response()->json($result, $httpCode);
        }

        return response()->json($result, 200);
    }

    /**
     * Memilih salah satu akun dari nomor bersama (Multi-Account) dan menerbitkan token
     * POST /api/auth/phone/login-select
     */
    public function selectAccount(Request $request): JsonResponse
    {
        $request->validate([
            'selection_token' => ['required', 'string', 'size:36'],
            'user_id' => ['required', 'integer'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ], [
            'selection_token.required' => 'Sesi pemilihan akun tidak valid.',
            'user_id.required' => 'Akun yang dipilih wajib ditentukan.',
        ]);

        $deviceName = $request->input('device_name') ?? 'Unknown Device';

        $result = $this->phoneAuthService->selectAccountAndLogin(
            $request->input('selection_token'),
            (int) $request->input('user_id'),
            $deviceName
        );

        if (! $result['success']) {
            $status = $result['status'] ?? 'error';
            $httpCode = match ($status) {
                'expired_session' => 404,
                'unauthorized_account' => 403,
                default => 500,
            };

            return response()->json($result, $httpCode);
        }

        return response()->json($result, 200);
    }
}
