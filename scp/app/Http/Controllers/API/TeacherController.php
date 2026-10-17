<?php

namespace App\Http\Controllers\API;

use App\Models\TeacherAssignment;
use GrahamCampbell\ResultType\Success;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class TeacherController extends Controller
{
    public function store(Request $request){
        $request->validate([
            'name' => 'required|string',
            'nip' => 'required|string|unique:users,nis_nip',
            'fet_staff_id' => 'nullable|string|unique:users,fet_staff_id'
        ]);

        $randomPassword = Str::random(8);

        $teacher = User::create([
            'name' =>  $request->name,
            'role' => 'teacher',
            'nis_nip' => $request->nip,
            'fet_staff_id' => $request->fet_staff_id,
            'password' => Hash::make($randomPassword),
            'must_change_password' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Akun guru berhasil dibuat',
            'data' => [
                'teacher' => $teacher,
                'password' => $randomPassword
            ]
        ], 201);
    }

    public function assignRole(Request $request, $id){
        $teacher = User::where('role', 'teacher')->findOrFail($id);

        $request->validate([
            'type' => 'required|in:kesiswaan,wali_kelas',
            'class_id' => 'required_if:type,wali_kelas|exists:classes,id|nullable'
        ]);

        $assignment = TeacherAssignment::create([
            'user_id' => $teacher->id,
            'type' => $request->type,
            'class_id' => $request->class_id
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tugas tambahan berhasil diberikan',
            'data' => $assignment
        ], 201);
    }
}
