<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\AssignmentMiddleware;
use Illuminate\Http\Request;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use App\Http\Middleware\RoleMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'assignment' => AssignmentMiddleware::class
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (Throwable $e, Request $request){
            if (! $request->is('api/*')){
                return null;
            }

            //422 : validasi gagal
            if($e instanceof ValidationException){
                return response()->json([
                    'success' => false,
                    'message' => 'Validasi gagal.',
                    'errors' => $e->errors()
                ], 422);
            }

            //401 : Belum login atau token tidak valid
            if($e instanceof AuthenticationException){
                return response()->json([
                    'success' => false,
                    'message' => 'Anda belum login atau sesi sudah berakhir.',
                    'errors' => null
                ], 401);
            }

            //404 : data atau route tidak ditemukan
            if($e instanceof NotFoundHttpException || $e instanceof ModelNotFoundException){
                return response()->json([
                    'success' => false,
                    'message' => 'Data tidak ditemukan',
                    'errors' => null
                ], 404);
            }

            //Error Http lain, misalnya 403, 405, dan 429
            if($e instanceof HttpException){
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage() ?: 'Terjadi kesalahan.',
                    'errors' => null
                ], $e->getStatusCode());
            }

            // 500 : error tak terduga
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Terjadi kesalahan pada server.',
                'errors' => null
            ], 500);
        });
    })->create();
