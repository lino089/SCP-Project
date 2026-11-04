<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use App\Models\TeacherLeaveRequest;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeacherLeaveRequestController extends Controller
{
    /**
     * Menampilkan daftar pengajuan perizinan guru dengan role-scoping dan filter.
     * GET /api/teacher-leave-requests
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = TeacherLeaveRequest::query()->with([
            'teacher:id,name,nis_nip',
            'approvedBy:id,name,nis_nip',
        ]);

        $isVerifier = ($user->role === 'vice_principal' || ($user->role === 'teacher' && $user->isKesiswaan()));

        if ($isVerifier) {
            // Waka Kurikulum & Tim Kesiswaan dapat melihat seluruh izin guru di sekolah
            if ($request->filled('teacher_id')) {
                $query->where('teacher_id', $request->integer('teacher_id'));
            }
        } else {
            // Guru reguler dan wali kelas hanya dapat melihat izin miliknya sendiri
            $query->where('teacher_id', $user->id);
        }

        // Filtering
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('date')) {
            $query->whereDate('date', $request->input('date'));
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('date', [$request->input('start_date'), $request->input('end_date')]);
        }

        $perPage = $request->integer('per_page', 15);
        $leaveRequests = $query->orderBy('date', 'desc')->orderBy('id', 'desc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Daftar pengajuan izin guru berhasil diambil.',
            'data' => $leaveRequests->items(),
            'meta' => [
                'current_page' => $leaveRequests->currentPage(),
                'per_page' => $leaveRequests->perPage(),
                'total' => $leaveRequests->total(),
                'last_page' => $leaveRequests->lastPage(),
            ],
        ], 200);
    }

    /**
     * Menampilkan detail satu perizinan guru.
     * GET /api/teacher-leave-requests/{id}
     */
    public function show(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        $leaveRequest = TeacherLeaveRequest::with([
            'teacher:id,name,nis_nip',
            'approvedBy:id,name,nis_nip',
        ])->findOrFail($id);

        $isWaka = ($user->role === 'vice_principal');
        $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());
        $isOwner = ($leaveRequest->teacher_id === $user->id);

        if (!$isWaka && !$isKesiswaan && !$isOwner) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat detail perizinan ini.',
            ], 403);
        }

        // Jika terdapat jadwal yang ditinggalkan, lampirkan detail ringkas jadwal tersebut
        if (!empty($leaveRequest->schedule_ids) && is_array($leaveRequest->schedule_ids)) {
            $schedules = Schedule::with([
                'subject:id,name',
                'schoolClass:id,name',
                'room:id,name',
            ])->whereIn('id', $leaveRequest->schedule_ids)->get();

            $leaveRequest->setRelation('schedules', $schedules);
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail perizinan guru berhasil diambil.',
            'data' => $leaveRequest,
        ], 200);
    }

    /**
     * Mengajukan izin tidak mengajar oleh guru beserta lampiran dan tugas titipan.
     * POST /api/teacher-leave-requests
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        // Dukung pengiriman schedule_ids dalam format string JSON jika dikirim via multipart/form-data
        if ($request->has('schedule_ids') && is_string($request->input('schedule_ids'))) {
            $decoded = json_decode($request->input('schedule_ids'), true);
            if (is_array($decoded)) {
                $request->merge(['schedule_ids' => $decoded]);
            }
        }

        $request->validate([
            'date' => 'required|date',
            'reason' => 'required|string|min:5|max:1000',
            'schedule_ids' => 'nullable|array',
            'schedule_ids.*' => 'integer|exists:schedules,id',
            'attachment' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'task_instruction' => 'nullable|string|max:2000',
            'task_attachment' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
        ]);

        $scheduleIds = $request->input('schedule_ids', []);

        // 1. Validasi Integritas Kepemilikan Jadwal: Seluruh jadwal harus milik guru yang bersangkutan
        if (!empty($scheduleIds)) {
            $invalidScheduleExists = Schedule::whereIn('id', $scheduleIds)
                ->where('teacher_id', '!=', $user->id)
                ->exists();

            if ($invalidScheduleExists) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda hanya dapat mengajukan izin untuk jadwal mengajar milik Anda sendiri.',
                ], 422);
            }
        }

        // 2. Pencegahan Pengajuan Duplikat: Cegah pengajuan ganda pending/approved pada tanggal yang sama
        $targetDate = Carbon::parse($request->input('date'))->toDateString();

        $existingActiveLeave = TeacherLeaveRequest::where('teacher_id', $user->id)
            ->whereDate('date', $targetDate)
            ->whereIn('status', ['pending', 'approved'])
            ->exists();

        if ($existingActiveLeave) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah memiliki pengajuan izin yang berstatus pending atau disetujui pada tanggal tersebut.',
            ], 422);
        }

        // 3. Penyimpanan Berkas Lampiran
        $disk = config('filesystems.default', 'public');
        $attachmentPath = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $attachmentPath = $file->store('teacher_leaves/letters', $disk);
            if ($disk !== 'public') {
                try {
                    Storage::disk('public')->put($attachmentPath, file_get_contents($file->getRealPath()));
                } catch (\Throwable) {}
            }
        }

        $taskAttachmentPath = null;
        if ($request->hasFile('task_attachment')) {
            $taskFile = $request->file('task_attachment');
            $taskAttachmentPath = $taskFile->store('teacher_leaves/tasks', $disk);
            if ($disk !== 'public') {
                try {
                    Storage::disk('public')->put($taskAttachmentPath, file_get_contents($taskFile->getRealPath()));
                } catch (\Throwable) {}
            }
        }

        // 4. Penyimpanan Record Perizinan
        $leave = TeacherLeaveRequest::create([
            'teacher_id' => $user->id,
            'schedule_ids' => !empty($scheduleIds) ? array_values(array_unique($scheduleIds)) : null,
            'date' => $targetDate,
            'reason' => $request->input('reason'),
            'attachment_path' => $attachmentPath,
            'task_instruction' => $request->input('task_instruction'),
            'task_attachment_path' => $taskAttachmentPath,
            'status' => 'pending',
            'approved_by' => null,
            'verified_at' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan izin mengajar berhasil dikirim.',
            'data' => $leave->fresh([
                'teacher:id,name,nis_nip',
            ]),
        ], 201);
    }

    /**
     * Menyetujui perizinan guru (hanya Kesiswaan atau Waka Kurikulum).
     * PATCH /api/teacher-leave-requests/{id}/approve
     */
    public function approve(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        $isWaka = ($user->role === 'vice_principal');
        $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());

        if (!$isWaka && !$isKesiswaan) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya Tim Kesiswaan atau Waka Kurikulum yang berhak memverifikasi perizinan guru.',
            ], 403);
        }

        $leave = TeacherLeaveRequest::findOrFail($id);

        if ($leave->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Status perizinan ini sudah diproses sebelumnya dan tidak dapat diubah lagi.',
            ], 422);
        }

        $leave->update([
            'status' => 'approved',
            'approved_by' => $user->id,
            'verified_at' => Carbon::now('Asia/Jakarta'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan izin guru berhasil disetujui.',
            'data' => $leave->fresh([
                'teacher:id,name,nis_nip',
                'approvedBy:id,name,nis_nip',
            ]),
        ], 200);
    }

    /**
     * Menolak perizinan guru (hanya Kesiswaan atau Waka Kurikulum).
     * PATCH /api/teacher-leave-requests/{id}/reject
     */
    public function reject(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        $isWaka = ($user->role === 'vice_principal');
        $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());

        if (!$isWaka && !$isKesiswaan) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya Tim Kesiswaan atau Waka Kurikulum yang berhak memverifikasi perizinan guru.',
            ], 403);
        }

        $leave = TeacherLeaveRequest::findOrFail($id);

        if ($leave->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Status perizinan ini sudah diproses sebelumnya dan tidak dapat diubah lagi.',
            ], 422);
        }

        $leave->update([
            'status' => 'rejected',
            'approved_by' => $user->id,
            'verified_at' => Carbon::now('Asia/Jakarta'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan izin guru berhasil ditolak.',
            'data' => $leave->fresh([
                'teacher:id,name,nis_nip',
                'approvedBy:id,name,nis_nip',
            ]),
        ], 200);
    }
}
