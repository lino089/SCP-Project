<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

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
        $request->validate([
            'name' => 'required|string',
            'level' => 'required|string'
        ]);

        $schoolClass = Classes::create([
            'name' => $request->name,
            'level' => $request->level
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Data berhasil ditambahkan',
            'data' => $schoolClass
        ],201);
    }

    public function destroy($id){
        $schoolClass = Classes::findOrFail($id);

        $schoolClass->delete();

        return response()->json([
            'success' => true,
            'message' => 'Data kelas berhasil dihapus',
            'data' => $schoolClass
        ]);
    }
}
