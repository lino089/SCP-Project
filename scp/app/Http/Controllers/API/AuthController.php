<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request){
        // Cek data yang harus masuk
        $request->validate([
            'nis_nip' => 'required|string',
            'password' => 'required|string',
            'device_name' => 'required|string'
        ]);

        // Memvalidasi kredensial pengguna
        $user = User::where('nis_nip', $request->nis_nip)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Kredensial tidak valid',
                'errors' => [
                    'nis_nip' => [
                        'NIS/NIP atau password salah'
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
}
