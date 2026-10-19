<?php

namespace App\Http\Controllers;
use Illuminate\Http\JsonResponse;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

abstract class Controller
{
    protected function passwordIsConfirmed(Request $request): ?JsonResponse
    {
        return $this->passwordIdConfirmed($request);
    }

    protected function passwordIdConfirmed(Request $request): ?JsonResponse{
        if (Hash::check($request->input('password'), $request->user()->password)){
            return null;
        }

        return response()->json([
            'success' => false,
            'message' => 'Validasi Gagal',
            'errors' => [
                'password' => ['Password tidak valid']
            ]
        ], 422);
    }
}
