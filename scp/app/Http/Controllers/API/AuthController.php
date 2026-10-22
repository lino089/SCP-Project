<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
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

        $identifier = $request->input('username') ?? $request->input('nis_nip');

        // Memvalidasi kredensial pengguna berdasarkan nis_nip atau email
        $user = User::where('nis_nip', $identifier)
            ->orWhere('email', $identifier)
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

        return response()->json([
            'success' => true,
            'message' => 'Data profil berhasil diambil',
            'data' => $user
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
    public function loginWithGoogle(Request $request)
    {
        $request->validate([
            'id_token' => 'required|string',
            'device_name' => 'required|string',
        ]);

        $googleData = ProfileController::verifyGoogleIdToken($request->id_token);

        if (! $googleData) {
            return response()->json([
                'success' => false,
                'message' => 'Token Google tidak valid atau telah kedaluwarsa.',
            ], 422);
        }

        $googleId = $googleData['sub'];
        $user = User::where('google_id', $googleId)->first();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Akun Google belum terhubung ke akun SCP mana pun. Silakan login menggunakan NIS/NIP dan tautkan akun Google di menu profil.',
            ], 404);
        }

        $expiresAt = now()->addMinutes((int) (config('sanctum.expiration') ?? 43200));
        $token = $user->createToken($request->device_name, ['*'], $expiresAt);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil Login dengan Google',
            'data' => [
                'token' => $token->plainTextToken,
                'expires_at' => $expiresAt,
                'must_change_password' => (bool) $user->must_change_password,
                'user' => $user->load('assignments'),
            ],
        ], 200);
    }
}
