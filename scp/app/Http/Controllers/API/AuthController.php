<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\GoogleAuthService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request){
        // Cek data yang harus masuk (mendukung nis_nip atau username)
        $request->validate([
            'username' => 'required_without:nis_nip|string',
            'nis_nip' => 'required_without:username|string',
            'password' => 'required|string',
            'device_name' => 'required|string'
        ]);

        $identifier = trim((string) ($request->input('username') ?? $request->input('nis_nip')));
        $normalizedPhone = User::normalizePhoneNumber($identifier);

        // Memvalidasi kredensial pengguna berdasarkan nis_nip, email, atau no. telepon (guru)
        $user = User::withTrashed()
            ->where(function ($q) use ($identifier, $normalizedPhone) {
                $q->where('nis_nip', $identifier)
                    ->orWhere('email', $identifier);

                if (!empty($normalizedPhone)) {
                    $q->orWhere('phone_number', $normalizedPhone)
                        ->orWhere('phone_number', $identifier);
                }
            })
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            $errorKey = $request->filled('username') && ! $request->filled('nis_nip') ? 'username' : 'nis_nip';
            $errorMessage = $errorKey === 'username' ? 'Username atau password salah' : 'NIS/NIP atau password salah';

            return response()->json([
                'success' => false,
                'message' => 'Kredensial tidak valid',
                'errors' => [
                    $errorKey => [
                        $errorMessage
                    ]
                ]
            ], 401);
        }

        if ($user->trashed() || $user->is_active === false) {
            return response()->json([
                'success' => false,
                'message' => 'Akun Anda telah dinonaktifkan atau berada di tempat sampah. Silakan hubungi pihak Waka/Administrator sekolah.',
                'errors' => [
                    'account' => ['Akun telah dinonaktifkan atau berada di tempat sampah.'],
                ],
            ], 403);
        }

        $expiresAt = now()->addMinutes((int) (config('sanctum.expiration') ?? 43200));
        $token = $user->createToken($request->device_name, ['*'], $expiresAt);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil Login',
            'data' => [
                'token' => $token->plainTextToken,
                'expires_at' => $expiresAt,
                'must_change_password' => (bool) $user->must_change_password
            ]
        ], 200);
    }

    public function me(Request $request){
        $user = $request->user()->load('assignments');

        if ($user->role === 'student') {
            $user->load('schoolClass:id,name,level');
        }

        if ($user->role === 'parent') {
            $user->load([
                'linkedStudent:id,name,nis_nip,class_id,gender',
                'linkedStudent.schoolClass:id,name,level',
            ]);
        }

        $sysConfig = \App\Models\SystemConfiguration::first();
        $userData = $user->toArray();
        $userData['academic_year'] = $sysConfig?->academic_year ?? '2025/2026 Ganjil';
        $userData['active_cycle'] = $sysConfig?->active_cycle ?? 1;
        $userData['monday_is_upacara'] = $sysConfig ? (bool) $sysConfig->monday_is_upacara : true;
        $userData['semester'] = $sysConfig?->semester ?? 'Ganjil';

        return response()->json([
            'success' => true,
            'message' => 'Data profil berhasil diambil',
            'data' => $userData
        ], 200);
    }

    public function logout(Request $request){
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logout Berhasil',
        ], 200);
    }

    /**
     * Login Single Sign-On (SSO) menggunakan Google ID Token
     * POST /api/auth/google
     */
    public function loginWithGoogle(Request $request, GoogleAuthService $googleAuthService)
    {
        $request->validate([
            'id_token' => 'required|string',
            'device_name' => 'required|string',
        ]);

        $googleData = $googleAuthService->verifyIdToken($request->id_token);

        if (! $googleData) {
            return response()->json([
                'success' => false,
                'message' => 'Token Google tidak valid atau telah kedaluwarsa.',
            ], 422);
        }

        $result = $googleAuthService->loginWithGoogle($googleData, $request->device_name);

        if (! $result['success']) {
            $status = match ($result['status']) {
                'not_linked' => 404,
                'inactive' => 403,
                default => 422,
            };

            $response = [
                'success' => false,
                'message' => $result['message'],
            ];

            if ($result['status'] === 'inactive') {
                $response['errors'] = [
                    'account' => ['Akun telah dinonaktifkan atau berada di tempat sampah.'],
                ];
            }

            return response()->json($response, $status);
        }

        return response()->json([
            'success' => true,
            'message' => $result['message'],
            'data' => $result['data'],
        ], 200);
    }

    /**
     * Verifikasi kata sandi pengguna saat ini untuk Step-Up Auth / tindakan sensitif.
     * POST /api/me/verify-password
     */
    public function verifyPassword(Request $request)
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        if (! Hash::check($request->password, $request->user()->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Kata sandi tidak valid.',
                'errors' => [
                    'password' => ['Kata sandi yang Anda masukkan salah.'],
                ],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Kata sandi terverifikasi.',
        ], 200);
    }
}
