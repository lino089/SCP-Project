<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classes;
use App\Models\Room;
use App\Models\Subject;
use App\Models\User;
use App\Services\MasterDataDependencyService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class RecycleBinController extends Controller
{
    public function __construct(
        private MasterDataDependencyService $dependencyService
    ) {
    }

    /**
     * Memeriksa ketergantungan relasi entitas sebelum penghapusan.
     * GET /api/master/{entity}/{id}/dependencies
     */
    public function checkDependencies(Request $request, string $entity, int $id): JsonResponse
    {
        $result = $this->dependencyService->checkDependencies($entity, $id);

        return response()->json([
            'success' => true,
            'message' => 'Analisis dependensi data berhasil diambil.',
            'data' => $result,
        ], 200);
    }

    /**
     * Menampilkan daftar data yang sedang berada di Tempat Sampah (30 Hari).
     * GET /api/master/trash atau GET /api/master/{entity}/trash
     */
    public function trash(Request $request, ?string $entity = null): JsonResponse
    {
        $targetEntity = $entity ?: $request->query('entity', 'all');
        $normalized = $this->normalizeEntity($targetEntity);

        $items = collect();

        // 1. Guru
        if ($normalized === 'all' || $normalized === 'teacher') {
            $teachers = User::where('role', 'teacher')->onlyTrashed()->get()->map(function ($t) {
                return $this->formatTrashItem($t, 'guru', $t->nis_nip ?: '-');
            });
            $items = $items->concat($teachers);
        }

        // 2. Siswa
        if ($normalized === 'all' || $normalized === 'student') {
            $students = User::where('role', 'student')->onlyTrashed()->get()->map(function ($s) {
                return $this->formatTrashItem($s, 'siswa', $s->nis_nip ?: ($s->nisn ?: '-'));
            });
            $items = $items->concat($students);
        }

        // 3. Kelas
        if ($normalized === 'all' || $normalized === 'class') {
            $classes = Classes::onlyTrashed()->get()->map(function ($c) {
                return $this->formatTrashItem($c, 'kelas', "Tingkat {$c->level}");
            });
            $items = $items->concat($classes);
        }

        // 4. Ruangan
        if ($normalized === 'all' || $normalized === 'room') {
            $rooms = Room::onlyTrashed()->get()->map(function ($r) {
                return $this->formatTrashItem($r, 'ruang', "Kapasitas: {$r->capacity}");
            });
            $items = $items->concat($rooms);
        }

        // 5. Mata Pelajaran
        if ($normalized === 'all' || $normalized === 'subject') {
            $subjects = Subject::onlyTrashed()->get()->map(function ($s) {
                return $this->formatTrashItem($s, 'mapel', "ID #{$s->id}");
            });
            $items = $items->concat($subjects);
        }

        // Sort items by deleted_at descending (terbaru di atas)
        $sortedItems = $items->sortByDesc('deleted_at')->values();

        $summary = [
            'total' => $sortedItems->count(),
            'guru' => User::where('role', 'teacher')->onlyTrashed()->count(),
            'siswa' => User::where('role', 'student')->onlyTrashed()->count(),
            'kelas' => Classes::onlyTrashed()->count(),
            'ruang' => Room::onlyTrashed()->count(),
            'mapel' => Subject::onlyTrashed()->count(),
        ];

        return response()->json([
            'success' => true,
            'message' => 'Daftar tempat sampah berhasil diambil.',
            'data' => $sortedItems,
            'summary' => $summary,
        ], 200);
    }

    /**
     * Memulihkan data dari Tempat Sampah kembali aktif.
     * POST /api/master/{entity}/{id}/restore
     */
    public function restore(Request $request, string $entity, int $id): JsonResponse
    {
        $normalized = $this->normalizeEntity($entity);

        $model = match ($normalized) {
            'teacher' => User::where('role', 'teacher')->onlyTrashed()->findOrFail($id),
            'student' => User::where('role', 'student')->onlyTrashed()->findOrFail($id),
            'class' => Classes::onlyTrashed()->findOrFail($id),
            'room' => Room::onlyTrashed()->findOrFail($id),
            'subject' => Subject::onlyTrashed()->findOrFail($id),
            default => abort(404, "Entitas '{$entity}' tidak valid."),
        };

        DB::transaction(function () use ($model, $normalized) {
            $model->restore();

            // Aktifkan kembali akun pengguna
            if ($model instanceof User) {
                $model->update([
                    'is_active' => true,
                    'archived_at' => null,
                ]);

                // Pulihkan juga akun orang tua terkait jika siswa
                if ($normalized === 'student') {
                    User::where('role', 'parent')
                        ->where('linked_student_id', $model->id)
                        ->onlyTrashed()
                        ->restore();
                }
            }
        });

        $name = $model->name ?? 'Data';

        return response()->json([
            'success' => true,
            'message' => "Data {$name} berhasil dipulihkan dari tempat sampah.",
            'data' => $model->fresh(),
        ], 200);
    }

    /**
     * Hapus Bersih & Paksa (Force Delete) data beserta keterkaitannya.
     * DELETE /api/master/{entity}/{id}/force
     */
    public function forceDestroy(Request $request, string $entity, int $id): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        if ($error = $this->passwordIsConfirmed($request)) {
            return $error;
        }

        $normalized = $this->normalizeEntity($entity);

        DB::transaction(function () use ($normalized, $id, $request) {
            match ($normalized) {
                'teacher' => $this->forceDeleteTeacher($id),
                'student' => $this->forceDeleteStudent($id),
                'class' => $this->forceDeleteClass($id),
                'room' => $this->forceDeleteRoom($id),
                'subject' => $this->forceDeleteSubject($id),
                default => abort(404, "Entitas '{$normalized}' tidak valid."),
            };

            Log::warning("Force delete executed on {$normalized} ID: {$id} by {$request->user()->name} (ID: {$request->user()->id})");
        });

        return response()->json([
            'success' => true,
            'message' => "Data {$entity} beserta seluruh riwayat terkait berhasil dihapus permanen.",
            'data' => null,
        ], 200);
    }

    private function forceDeleteTeacher(int $id): void
    {
        $teacher = User::where('role', 'teacher')->withTrashed()->findOrFail($id);

        // Hapus token login Sanctum
        $teacher->tokens()->delete();

        // 1. Hapus kuis dan pertanyaan
        if (Schema::hasTable('ai_quizzes')) {
            DB::table('ai_quizzes')->where('teacher_id', $id)->delete();
        }

        // 2. Hapus izin guru
        if (Schema::hasTable('teacher_leave_requests')) {
            DB::table('teacher_leave_requests')->where('teacher_id', $id)->delete();
        }

        // 3. Hapus penugasan wali kelas / kesiswaan
        if (Schema::hasTable('teacher_assignments')) {
            DB::table('teacher_assignments')->where('user_id', $id)->delete();
        }

        // 4. Hapus jadwal dan anak jadwalnya (jurnal & presensi)
        $scheduleIds = DB::table('schedules')->where('teacher_id', $id)->pluck('id');
        $this->deleteSchedulesAndChildren($scheduleIds);

        // 5. Force delete user guru
        $teacher->forceDelete();
    }

    private function forceDeleteStudent(int $id): void
    {
        $student = User::where('role', 'student')->withTrashed()->findOrFail($id);

        $student->tokens()->delete();

        // 1. Hapus presensi
        DB::table('attendances')->where('student_id', $id)->delete();

        // 2. Hapus izin siswa
        DB::table('leave_requests')->where('student_id', $id)->delete();

        // 3. Hapus submission kuis
        if (Schema::hasTable('quiz_submissions')) {
            DB::table('quiz_submissions')->where('student_id', $id)->delete();
        }

        // 4. Hapus akun orang tua terkait
        $parentIds = DB::table('users')->where('linked_student_id', $id)->pluck('id');
        if ($parentIds->isNotEmpty()) {
            DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $parentIds)->delete();
            DB::table('users')->whereIn('id', $parentIds)->delete();
        }

        // 5. Force delete siswa
        $student->forceDelete();
    }

    private function forceDeleteClass(int $id): void
    {
        $class = Classes::withTrashed()->findOrFail($id);

        // Putus relasi next_class_id
        Classes::where('next_class_id', $id)->update(['next_class_id' => null]);

        // Putus class_id pada siswa atau update null
        User::where('class_id', $id)->update(['class_id' => null]);

        // Hapus penugasan wali kelas
        if (Schema::hasTable('teacher_assignments')) {
            DB::table('teacher_assignments')->where('class_id', $id)->delete();
        }

        // Hapus jadwal kelas beserta anak
        $scheduleIds = DB::table('schedules')->where('class_id', $id)->pluck('id');
        $this->deleteSchedulesAndChildren($scheduleIds);

        $class->forceDelete();
    }

    private function forceDeleteRoom(int $id): void
    {
        $room = Room::withTrashed()->findOrFail($id);

        $scheduleIds = DB::table('schedules')->where('room_id', $id)->pluck('id');
        $this->deleteSchedulesAndChildren($scheduleIds);

        $room->forceDelete();
    }

    private function forceDeleteSubject(int $id): void
    {
        $subject = Subject::withTrashed()->findOrFail($id);

        // Lepas relasi subject_id pada guru
        User::where('subject_id', $id)->update(['subject_id' => null]);

        $scheduleIds = DB::table('schedules')->where('subject_id', $id)->pluck('id');
        $this->deleteSchedulesAndChildren($scheduleIds);

        $subject->forceDelete();
    }

    private function deleteSchedulesAndChildren($scheduleIds): void
    {
        if ($scheduleIds->isEmpty()) {
            return;
        }

        $journalIds = DB::table('journals')->whereIn('schedule_id', $scheduleIds)->pluck('id');
        if ($journalIds->isNotEmpty()) {
            DB::table('attendances')->whereIn('journal_id', $journalIds)->delete();
            DB::table('journals')->whereIn('id', $journalIds)->delete();
        }

        DB::table('schedules')->whereIn('id', $scheduleIds)->delete();
    }

    private function formatTrashItem($model, string $entityType, string $identifier): array
    {
        $deletedAt = $model->deleted_at ? Carbon::parse($model->deleted_at) : Carbon::now();
        $daysPassed = $deletedAt->diffInDays(Carbon::now());
        $daysRemaining = max(0, 30 - (int) $daysPassed);

        return [
            'id' => $model->id,
            'name' => $model->name,
            'entity_type' => $entityType,
            'identifier' => $identifier,
            'deleted_at' => $deletedAt->toIso8601String(),
            'formatted_deleted_at' => $deletedAt->translatedFormat('d M Y, H:i'),
            'days_remaining' => $daysRemaining,
            'is_expired' => $daysRemaining <= 0,
        ];
    }

    private function normalizeEntity(string $entity): string
    {
        return match (strtolower(trim($entity))) {
            'all', 'semua' => 'all',
            'guru', 'teachers', 'teacher' => 'teacher',
            'siswa', 'students', 'student' => 'student',
            'kelas', 'classes', 'class' => 'class',
            'ruang', 'ruangan', 'rooms', 'room' => 'room',
            'mapel', 'mata-pelajaran', 'subjects', 'subject' => 'subject',
            default => strtolower(trim($entity)),
        };
    }
}
