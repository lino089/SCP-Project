<?php

namespace App\Http\Controllers\API;

use App\Models\SystemConfiguration;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class academicSettingController extends Controller
{
    public function updateMondayStatus(Request $request)
    {

        $request->validate([
            'is_upacara' => 'required|boolean',
            'password' => 'required|string'
        ]);

        if (!Hash::check($request->password, $request->user()->password)) {
            return response()->json([
                "success" => false,
                'message' => 'Validasi gagal',
                'errors' => [
                    'password' => ['Password tidak valid.']
                ]
            ], 422);
        }

        $config = SystemConfiguration::firstOrFail();
        $config->update(['monday_is_upacara' => $request->is_upacara]); 

        return response()->json([
            'success' => true,
            'message' => 'Status upacara hari senin berhasil diperbarui.',
            'data' => [
                'monday_is_upacara' => $config->monday_is_upacara
            ]
        ]);
    }
}
