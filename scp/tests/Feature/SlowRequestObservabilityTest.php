<?php

namespace Tests\Feature;

use App\Http\Middleware\LogSlowRequestsMiddleware;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class SlowRequestObservabilityTest extends TestCase
{
    public function test_slow_request_is_logged_when_duration_exceeds_threshold(): void
    {
        Log::shouldReceive('warning')
            ->once()
            ->withArgs(function ($message, $context) {
                return $message === '[SLOW_REQUEST]'
                    && $context['path'] === '/test-slow'
                    && $context['method'] === 'POST'
                    && isset($context['duration_ms'])
                    && !isset($context['password'])
                    && !isset($context['token']);
            });

        $middleware = new class extends LogSlowRequestsMiddleware {
            protected float $slowThresholdMs = 10.0; // 10ms for unit testing
        };

        $request = Request::create('/test-slow', 'POST', ['password' => 'secret123']);

        $response = $middleware->handle($request, function () {
            usleep(15000); // 15ms sleep
            return new Response('ok', 200);
        });

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_rate_limit_exceeded_is_logged(): void
    {
        Log::shouldReceive('info')
            ->once()
            ->withArgs(function ($message, $context) {
                return $message === '[RATE_LIMIT_TRIGGERED]'
                    && $context['path'] === '/test-rate-limit';
            });

        $middleware = new LogSlowRequestsMiddleware();
        $request = Request::create('/test-rate-limit', 'POST');

        $response = $middleware->handle($request, function () {
            return new Response('too many', 429);
        });

        $this->assertEquals(429, $response->getStatusCode());
    }
}
