<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            // P-7: Kunci unik berbasis token (hashing sha256), fallback ke user id atau IP klien
            $bearer = $request->bearerToken();
            $key = $bearer
                ? 'token:' . hash('sha256', $bearer)
                : ($request->user()?->id ? 'user:' . $request->user()->id : 'ip:' . $request->ip());

            return Limit::perMinute(60)->by($key)->response(function (Request $request, array $headers) {
                return response()->json([
                    'success' => false,
                    'message' => 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
                    'errors' => null,
                ], 429, $headers);
            });
        });

        // P-20: Rate limiter khusus login (5 percobaan per menit per IP + identitas akun)
        RateLimiter::for('login', function (Request $request) {
            $identifier = (string) ($request->input('nis_nip') ?? $request->input('email') ?? $request->input('username') ?? 'unknown');
            $key = 'login:' . $request->ip() . '|' . strtolower(trim($identifier));

            return Limit::perMinute(5)->by($key)->response(function (Request $request, array $headers) {
                return response()->json([
                    'success' => false,
                    'message' => 'Terlalu banyak percobaan login. Silakan tunggu 1 menit sebelum mencoba kembali.',
                    'errors' => null,
                ], 429, $headers);
            });
        });
    }
}
