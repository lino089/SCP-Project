<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classes;
use App\Models\Room;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class MasterDataSummaryController extends Controller
{
    /**
     * Mendapatkan statistik ringkas jumlah entitas master data.
     * Digunakan untuk inisialisasi badge tab dan verifikasi prasyarat secara instan (~2ms).
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Ringkasan master data berhasil diambil.',
            'data' => [
                'classes' => Classes::count(),
                'rooms' => Room::count(),
                'subjects' => Subject::count(),
                'teachers' => User::where('role', 'teacher')->count(),
                'students' => User::where('role', 'student')->count(),
            ],
        ], 200);
    }
}
