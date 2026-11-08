<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GoogleAuthService
{
    /**
     * Memverifikasi JWT ID Token Google via Google TokenInfo API resmi
     */
    public function verifyIdToken(string $idToken): ?array
    {
        try {
            $verifySsl = (bool) config('services.google.verify_ssl', false);
            $httpClient = Http::timeout(10);

            if (! $verifySsl) {
                $httpClient = $httpClient->withoutVerifying();
            }

            $response = $httpClient->get('https://oauth2.googleapis.com/tokeninfo', [
                'id_token' => $idToken,
            ]);

            if (!$response->successful()) {
                Log::warning('[GoogleAuthService] Token verification failed: ' . $response->body());

                return null;
            }

            $data = $response->json();
            $expectedClientId = config('services.google.client_id');

            // 1. Verifikasi Audience (aud) jika client ID telah dikonfigurasi
            if (!empty($expectedClientId) && isset($data['aud']) && $data['aud'] !== $expectedClientId) {
                Log::warning("[GoogleAuthService] Token audience mismatch. Expected: {$expectedClientId}, Got: " . ($data['aud'] ?? 'null'));

                return null;
            }

            // 2. Verifikasi Issuer (iss)
            if (isset($data['iss']) && !in_array($data['iss'], ['accounts.google.com', 'https://accounts.google.com'], true)) {
                Log::warning("[GoogleAuthService] Invalid token issuer: " . ($data['iss'] ?? 'null'));

                return null;
            }

            // 3. Pastikan Google Subject ID (sub) tersedia
            if (empty($data['sub'])) {
                return null;
            }

            // 4. Pastikan token belum kedaluwarsa
            if (isset($data['exp']) && (int) $data['exp'] < time()) {
                Log::warning('[GoogleAuthService] Token expired at ' . $data['exp']);

                return null;
            }

            return $data;
        } catch (\Throwable $e) {
            Log::error('[GoogleAuthService] Exception during token verification: ' . $e->getMessage());

            return null;
        }
    }

    /**
     * Menautkan akun Google ke akun pengguna SCP yang sedang login
     */
    public function linkAccount(User $user, array $googleData): array
    {
        $googleId = (string) $googleData['sub'];
        $googleEmail = $googleData['email'] ?? null;

        // Cek apakah akun Google sudah dipakai oleh akun SCP lain
        if (User::where('google_id', $googleId)->where('id', '!=', $user->id)->exists()) {
            return [
                'success' => false,
                'status' => 'already_linked',
                'message' => 'Akun Google ini sudah terhubung dengan akun pengguna lain di sistem SCP.',
            ];
        }

        $updates = [
            'google_id' => $googleId,
            'google_email' => $googleEmail,
            'google_linked_at' => now(),
        ];

        // Opsi A: Auto-mengisi email akun SCP jika email saat ini masih kosong
        if (empty($user->email) && !empty($googleEmail)) {
            if (!User::where('email', $googleEmail)->where('id', '!=', $user->id)->exists()) {
                $updates['email'] = $googleEmail;
                $updates['email_verified_at'] = now();
            }
        }

        $user->update($updates);

        return [
            'success' => true,
            'status' => 'linked',
            'message' => 'Akun Google berhasil ditautkan ke profil Anda.',
            'user' => $user->fresh(),
        ];
    }

    /**
     * Melepas tautan akun Google dengan verifikasi kata sandi akun SCP (Step-Up Auth)
     */
    public function unlinkAccount(User $user, string $password): array
    {
        // 1. Validasi kata sandi akun saat ini
        if (!Hash::check($password, $user->password)) {
            return [
                'success' => false,
                'status' => 'wrong_password',
                'message' => 'Kata sandi akun yang Anda masukkan salah.',
            ];
        }

        // 2. Kosongkan identitas Google
        $user->update([
            'google_id' => null,
            'google_email' => null,
            'google_linked_at' => null,
        ]);

        return [
            'success' => true,
            'status' => 'unlinked',
            'message' => 'Tautan akun Google berhasil dilepas dari profil Anda.',
            'user' => $user->fresh(),
        ];
    }

    /**
     * Autentikasi Login SSO menggunakan akun Google
     */
    public function loginWithGoogle(array $googleData, string $deviceName): array
    {
        $googleId = (string) $googleData['sub'];
        $googleEmail = $googleData['email'] ?? null;
        $user = User::where('google_id', $googleId)->first();

        // Fallback auto-link: jika google_id belum terisi namun google_email telah didaftarkan pada profil
        if (! $user && ! empty($googleEmail)) {
            $userByGoogleEmail = User::where('google_email', $googleEmail)->first();
            if ($userByGoogleEmail && empty($userByGoogleEmail->google_id)) {
                $userByGoogleEmail->update([
                    'google_id' => $googleId,
                    'google_linked_at' => now(),
                ]);
                $user = $userByGoogleEmail;
            }
        }

        if (!$user) {
            return [
                'success' => false,
                'status' => 'not_linked',
                'message' => 'Akun Google belum terhubung ke akun SCP mana pun. Silakan login menggunakan NIS/NIP dan tautkan akun Google di menu profil.',
            ];
        }

        if ($user->trashed() || $user->is_active === false) {
            return [
                'success' => false,
                'status' => 'inactive',
                'message' => 'Akun Anda telah dinonaktifkan atau berada di tempat sampah. Silakan hubungi pihak Waka/Administrator sekolah.',
            ];
        }

        $expiresAt = now()->addMinutes((int) (config('sanctum.expiration') ?? 43200));
        $token = $user->createToken($deviceName, ['*'], $expiresAt);

        return [
            'success' => true,
            'status' => 'success',
            'message' => 'Berhasil Login dengan Google',
            'data' => [
                'token' => $token->plainTextToken,
                'expires_at' => $expiresAt,
                'must_change_password' => (bool) $user->must_change_password,
                'user' => $user->load('assignments'),
            ],
        ];
    }
}
