<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\Request;
use App\Models\Subject;

class SubjectController extends Controller
{
    public function store(Request $request)
    {
        $request->validate( [
            'name' => 'required|string|unique:subjects,name'
        ]);

        $subject = Subject::create([
            'name' => $request->name
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Mata pelajaran berhasil ditambahkan',
            'data' => $subject
        ], 201);
    }


}
