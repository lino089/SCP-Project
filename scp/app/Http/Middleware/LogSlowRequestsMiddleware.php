<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class LogSlowRequestsMiddleware
{
    /**
     * Ambang batas request lambat dalam milidetik (P-23: > 1000ms)
     */
    protected float $slowThresholdMs = 1000.0;

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $startTime = microtime(true);

        $response = $next($request);

        $durationMs = (microtime(true) - $startTime) * 1000;

        // 1. Slow Request Logging (> 1000ms) tanpa mencatat password / token
        if ($durationMs >= $this->slowThresholdMs) {
            Log::warning('[SLOW_REQUEST]', [
                'method' => $request->method(),
                'path' => '/' . ltrim($request->path(), '/'),
                'duration_ms' => round($durationMs, 2),
                'status' => $response->getStatusCode(),
                'user_id' => $request->user()?->id,
                'ip' => $request->ip(),
            ]);
        }

        // 2. Metrik Server Error (HTTP 5xx)
        if ($response->getStatusCode() >= 500) {
            Log::error('[SERVER_ERROR_METRIC]', [
                'method' => $request->method(),
                'path' => '/' . ltrim($request->path(), '/'),
                'status' => $response->getStatusCode(),
                'duration_ms' => round($durationMs, 2),
                'user_id' => $request->user()?->id,
                'ip' => $request->ip(),
            ]);
        }

        // 3. Metrik Rate Limit Exceeded (HTTP 429)
        if ($response->getStatusCode() === 429) {
            Log::info('[RATE_LIMIT_TRIGGERED]', [
                'method' => $request->method(),
                'path' => '/' . ltrim($request->path(), '/'),
                'user_id' => $request->user()?->id,
                'ip' => $request->ip(),
            ]);
        }

        return $response;
    }
}
