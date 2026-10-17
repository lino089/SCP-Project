<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classes;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SchoolClassController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'per_page' => 'nullable|integer|min:1|max:100'
        ]);

        $perPage = $request->integer('per_page', 15);

        $classes = Classes::paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Data kelas berhasil diambil.',
            'data' => $classes->items(),
            'meta' => [
                'current_page' => $classes->currentPage(),
                'per_page' => $classes->perPage(),
                'total' => $classes->total(),
                'last_page' => $classes->lastPage()
            ]
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:50',
                Rule::unique('classes', 'name')->whereNull('delete_at')
            ],
            'level' => 'required|integer|in:10,11,12'
        ]);

        $classes = Classes::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Data berhasil ditambahkan',
            'data' => $classes
        ],201);
    }

    public function destroy($id){
        $class = Classes::findOrFail($id);

        if($class->schedules()->exists()){
            return response()->json([
                'success' => false,
                'message' => 'Kelas tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
                'errors' => [
                    'class' => ['Hapus atau pindahkan jadwal terkait terlebih dahulu.']
                ]
            ],409);
        }

        $class->delete();

        return response()->json([
            'success' => true,
            'message' => 'Data kelas berhasil dihapus',
            'data' => $class
        ], 201);
    }
}
