<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AssignmentMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string $type): Response
    {
        $user   = $request->user();

        $hasAssignment = $user?->role === 'teacher'
            && $user->teacherAsssignments()->where('type', $type)->exists();

        if(!$hasAssignment) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak, anda tidak memiliki izin.',
                'errors' => [
                    'assigment' => ['Membutuhkan penugasan' . $type . '.']
                ]
            ], 403);
        }

        return $next($request);
    }
}
