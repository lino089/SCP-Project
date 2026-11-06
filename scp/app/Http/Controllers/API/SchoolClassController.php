<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classes;
use App\Models\StudentClassHistory;
use App\Models\SystemConfiguration;
use App\Models\TeacherAssignment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SchoolClassController extends Controller
{
    /**
     * Menampilkan daftar kelas (berpaginasi).
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'per_page' => 'nullable|integer|min:1|max:1000',
            'search' => 'nullable|string|max:100',
            'all' => 'nullable|in:true,false,1,0',
            'my_taught_only' => 'nullable|in:true,false,1,0',
        ]);

        $perPage = $request->integer('per_page', 15);
        $search = $request->input('search');

        $query = Classes::query()->with('nextClass:id,name,level');

        $user = $request->user();
        if ($request->boolean('my_taught_only') && $user && $user->role === 'teacher') {
            $scheduleClassIds = \App\Models\Schedule::where('teacher_id', $user->id)
                ->pluck('class_id')
                ->filter()
                ->unique()
                ->toArray();
            $asgnClassIds = $user->assignments()->whereNotNull('class_id')->pluck('class_id')->toArray();
            $myClassIds = array_values(array_unique(array_merge($scheduleClassIds, $asgnClassIds)));

            $query->whereIn('id', $myClassIds);
        }

        if ($search) {
            $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->where('name', $like, '%' . $search . '%');
        }

        if ($request->boolean('all')) {
            $classes = $query->orderBy('level')->orderBy('name')->get();

            return response()->json([
                'success' => true,
                'message' => 'Data kelas berhasil diambil.',
                'data' => $classes,
                'meta' => [
                    'current_page' => 1,
                    'per_page' => $classes->count(),
                    'total' => $classes->count(),
                    'last_page' => 1,
                ],
            ], 200);
        }

        $classes = $query->orderBy('level')->orderBy('name')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Data kelas berhasil diambil.',
            'data' => $classes->items(),
            'meta' => [
                'current_page' => $classes->currentPage(),
                'per_page' => $classes->perPage(),
                'total' => $classes->total(),
                'last_page' => $classes->lastPage(),
            ],
        ], 200);
    }

    /**
     * Menambahkan kelas baru.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:50',
                Rule::unique('classes', 'name')->whereNull('deleted_at'),
            ],
            'level' => 'required|integer|in:10,11,12',
            'next_class_id' => 'nullable|integer|exists:classes,id',
        ]);

        $class = Classes::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Data berhasil ditambahkan',
            'data' => $class,
        ], 201);
    }

    /**
     * Memperbarui data kelas (nama, level, next_class_id).
     */
    public function update(Request $request, $id): JsonResponse
    {
        $class = Classes::findOrFail($id);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:50',
                Rule::unique('classes', 'name')->ignore($class->id)->whereNull('deleted_at'),
            ],
            'level' => 'required|integer|in:10,11,12',
            'next_class_id' => [
                'nullable',
                'integer',
                'exists:classes,id',
                Rule::notIn([$class->id]),
            ],
        ]);

        $class->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Data kelas berhasil diperbarui.',
            'data' => $class,
        ], 200);
    }

    /**
     * Menghapus kelas (soft-delete), ditolak 409 jika terikat jadwal aktif.
     */
    public function destroy($id): JsonResponse
    {
        $class = Classes::findOrFail($id);

        if ($class->schedules()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Kelas tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
                'errors' => [
                    'class' => ['Hapus atau pindahkan jadwal terkait terlebih dahulu.'],
                ],
            ], 409);
        }

        $class->delete();

        return response()->json([
            'success' => true,
            'message' => 'Data kelas berhasil dihapus',
            'data' => $class,
        ], 200);
    }

    /**
     * Promosi kenaikan kelas dan kelulusan massal akhir tahun ajaran (PRD 5.13).
     * Mencatat riwayat kelas siswa (student_class_histories) dan secara otomatis
     * menonaktifkan seluruh penugasan Wali Kelas & Kesiswaan aktif periode berjalan (Keputusan 6 Opsi B).
     */
    public function promoteClasses(Request $request): JsonResponse
    {
        $actorId = $request->user()?->id;
        $academicYear = SystemConfiguration::query()->value('academic_year') ?: '2026/2027';

        $result = DB::transaction(function () use ($actorId, $academicYear) {
            $students = User::where('role', 'student')->with('schoolClass')->get();

            $promotedCount = 0;
            $heldBackCount = 0;
            $graduatedCount = 0;
            $now = now();

            foreach ($students as $student) {
                if ($student->is_held_back) {
                    // Siswa tinggal kelas: catat histori, reset flag untuk tahun ajaran baru, tidak ubah class_id
                    StudentClassHistory::create([
                        'student_id' => $student->id,
                        'from_class_id' => $student->class_id,
                        'to_class_id' => $student->class_id,
                        'academic_year' => $academicYear,
                        'action_type' => 'held_back',
                        'processed_by' => $actorId,
                        'processed_at' => $now,
                    ]);

                    $student->update(['is_held_back' => false]);
                    $heldBackCount++;
                    continue;
                }

                $currentClass = $student->schoolClass;

                if ($currentClass && $currentClass->next_class_id) {
                    // Naik ke kelas berikutnya
                    StudentClassHistory::create([
                        'student_id' => $student->id,
                        'from_class_id' => $currentClass->id,
                        'to_class_id' => $currentClass->next_class_id,
                        'academic_year' => $academicYear,
                        'action_type' => 'promoted',
                        'processed_by' => $actorId,
                        'processed_at' => $now,
                    ]);

                    $student->update(['class_id' => $currentClass->next_class_id]);
                    $promotedCount++;
                } elseif ($currentClass && is_null($currentClass->next_class_id)) {
                    // Kelas akhir (kelas 12): kelulusan
                    StudentClassHistory::create([
                        'student_id' => $student->id,
                        'from_class_id' => $currentClass->id,
                        'to_class_id' => null,
                        'academic_year' => $academicYear,
                        'action_type' => 'graduated',
                        'processed_by' => $actorId,
                        'processed_at' => $now,
                    ]);

                    $student->update([
                        'graduation_date' => $now->toDateString(),
                        'class_id' => null,
                    ]);
                    $graduatedCount++;
                }
            }

            // Keputusan 6 Opsi B: Otomatis nonaktifkan seluruh penugasan Wali Kelas & Kesiswaan aktif
            $deactivatedAssignmentsCount = TeacherAssignment::query()
                ->where('is_active', true)
                ->update([
                    'is_active' => false,
                    'ended_at' => $now,
                    'revoked_by' => $actorId,
                    'notes' => 'Berakhir otomatis saat eksekusi kenaikan kelas & pergantian tahun ajaran',
                    'updated_at' => $now,
                ]);

            return [
                'total_students' => $students->count(),
                'promoted' => $promotedCount,
                'held_back' => $heldBackCount,
                'graduated' => $graduatedCount,
                'deactivated_assignments' => $deactivatedAssignmentsCount,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Proses kenaikan kelas dan kelulusan berhasil diproses, serta penugasan Wali Kelas dan Kesiswaan periode berjalan telah diarsipkan.',
            'data' => $result,
        ], 200);
    }
}
