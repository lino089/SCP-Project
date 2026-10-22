<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    /**
     * Normalisasi nomor telepon ke format standar (628...)
     */
    public static function normalizeNumber(string $number): string
    {
        // Hapus karakter non-digit kecuali leading '+'
        $clean = preg_replace('/[^0-9+]/', '', $number);

        // Jika berawalan +62, hilangkan tanda +
        if (str_starts_with($clean, '+62')) {
            $clean = substr($clean, 1);
        }
        // Jika berawalan 0, ganti dengan 62
        elseif (str_starts_with($clean, '0')) {
            $clean = '62' . substr($clean, 1);
        }
        // Jika berawalan 8, tambahkan 62
        elseif (str_starts_with($clean, '8')) {
            $clean = '62' . $clean;
        }

        return $clean;
    }

    /**
     * Mengirim pesan WhatsApp melalui Fonnte atau Log driver
     */
    public function sendMessage(string $target, string $message): array
    {
        $normalizedTarget = self::normalizeNumber($target);
        $driver = config('services.fonnte.driver', 'fonnte');

        if ($driver === 'log') {
            Log::info("[WhatsAppService:log] Message to {$normalizedTarget}: {$message}");

            return [
                'success' => true,
                'message' => 'Simulated WhatsApp message logged successfully.',
                'target' => $normalizedTarget,
            ];
        }

        try {
            $token = config('services.fonnte.token');
            $baseUrl = rtrim(config('services.fonnte.base_url', 'https://api.fonnte.com'), '/');

            $response = Http::withHeaders([
                'Authorization' => $token,
            ])->timeout(15)->post("{$baseUrl}/send", [
                'target' => $normalizedTarget,
                'message' => $message,
                'countryCode' => '62',
            ]);

            $responseData = $response->json();
            $isStatusTrue = $response->successful() && (
                isset($responseData['status']) && ($responseData['status'] === true || $responseData['status'] === 'true')
            );

            if ($isStatusTrue) {
                return [
                    'success' => true,
                    'message' => 'WhatsApp message dispatched successfully.',
                    'target' => $normalizedTarget,
                    'response' => $responseData,
                ];
            }

            Log::warning('[WhatsAppService:fonnte] Failed sending WhatsApp: ' . json_encode($responseData));

            return [
                'success' => false,
                'message' => $responseData['reason'] ?? 'Failed sending WhatsApp message via Fonnte.',
                'response' => $responseData,
            ];
        } catch (\Throwable $e) {
            Log::error('[WhatsAppService:error] Exception: ' . $e->getMessage());

            return [
                'success' => false,
                'message' => 'Layanan WhatsApp tidak dapat dihubungi.',
                'error' => $e->getMessage(),
            ];
        }
    }
}
