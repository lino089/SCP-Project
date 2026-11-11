<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use App\Models\TeacherLeaveRequest;
use App\Services\AcademicCalendarExclusionService;
use App\Services\TeacherLeaveAuthorityResolver;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TeacherLeaveRequestController extends Controller
{
    public function __construct(
        protected TeacherLeaveAuthorityResolver $authorityResolver,
        protected AcademicCalendarExclusionService $exclusionService
    ) {}

    /**
     * Menampilkan daftar pengajuan perizinan guru dengan role-scoping dan filter.
     * GET /api/teacher-leave-requests
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role === 'vice_principal') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Waka Kurikulum tidak memiliki wewenang untuk melihat perizinan guru.',
            ], 403);
        }

        $query = TeacherLeaveRequest::query()->with([
            'teacher:id,name,nis_nip',
            'approvedBy:id,name,nis_nip',
        ]);

        $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());
        $isVerifier = $isKesiswaan;

        $scope = $request->input('scope');
        $isMine = ($scope === 'mine' || $request->boolean('mine'));
        $isVerification = ($scope === 'verification');

        if ($isMine) {
            // Konteks Riwayat Izin Pribadi (untuk seluruh guru, termasuk guru kesiswaan)
            $query->where('teacher_id', $user->id);
        } elseif ($isVerification) {
            // Konteks Antrean Verifikasi (Khusus Waka & Guru Kesiswaan, atau riwayat verifikasi pejabat lama)
            if (!$isVerifier) {
                $requestedStatus = $request->filled('status') ? $request->input('status') : 'pending';
                if ($requestedStatus !== 'pending') {
                    // Keputusan 1 Opsi A: Mantan petugas Kesiswaan tetap dapat melihat riwayat verifikasi pribadinya
                    $query->where('approved_by', $user->id);
                } else {
                    $query->whereRaw('1 = 0');
                }
            } elseif ($isWaka) {
                // Waka melihat seluruh izin yang membutuhkan verifikasi (kecuali izin dirinya sendiri)
                $query->where('teacher_id', '!=', $user->id);
                if ($request->filled('teacher_id')) {
                    $query->where('teacher_id', $request->integer('teacher_id'));
                }
            } else {
                // Guru Kesiswaan: scoped ke kelas binaannya menggunakan authority resolver
                $this->authorityResolver->scopePendingRequestsForUser(
                    $query,
                    $user,
                    $request->filled('status') ? $request->input('status') : 'pending'
                );
                if ($request->filled('teacher_id')) {
                    $query->where('teacher_id', $request->integer('teacher_id'));
                }
            }
        } else {
            // Default (Kompatibilitas saat parameter scope tidak dikirim)
            if ($isWaka) {
                if ($request->filled('teacher_id')) {
                    $query->where('teacher_id', $request->integer('teacher_id'));
                }
            } elseif ($isKesiswaan) {
                if ($request->filled('teacher_id')) {
                    $targetTeacherId = $request->integer('teacher_id');
                    if ($targetTeacherId === (int) $user->id) {
                        $query->where('teacher_id', $user->id);
                    } else {
                        $hasGlobal = $user->assignments()->where('type', 'kesiswaan')->whereNull('class_id')->exists();
                        if (!$hasGlobal) {
                            $this->authorityResolver->scopePendingRequestsForUser(
                                $query,
                                $user,
                                $request->filled('status') ? $request->input('status') : null
                            );
                        }
                        $query->where('teacher_id', $targetTeacherId);
                    }
                } else {
                    $hasGlobal = $user->assignments()->where('type', 'kesiswaan')->whereNull('class_id')->exists();
                    if ($hasGlobal) {
                        // Global assignment legacy
                        $query->where('teacher_id', '!=', $user->id);
                    } else {
                        $this->authorityResolver->scopePendingRequestsForUser(
                            $query,
                            $user,
                            $request->filled('status') ? $request->input('status') : null
                        );
                    }
                }
            } else {
                // Guru reguler dan wali kelas hanya dapat melihat izin miliknya sendiri
                // serta izin yang pernah diverifikasi sendiri saat dulu menjabat Kesiswaan (Keputusan 1 Opsi A)
                $query->where(function ($q) use ($user) {
                    $q->where('teacher_id', $user->id)
                      ->orWhere('approved_by', $user->id);
                });
            }
        }

        // Filtering
        if ($request->filled('status') && !$isVerification) {
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

        if ($user->role === 'vice_principal') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Waka Kurikulum tidak memiliki wewenang untuk melihat detail perizinan guru.',
            ], 403);
        }

        $isOwner = ((int) $leaveRequest->teacher_id === (int) $user->id);
        $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());

        $hasAccess = false;

        if ($isOwner) {
            $hasAccess = true;
        } elseif ($leaveRequest->approved_by !== null && (int) $leaveRequest->approved_by === (int) $user->id) {
            // Keputusan 1 Opsi A: Pernah disetujui / diproses sendiri oleh user ini
            $hasAccess = true;
        } elseif ($isKesiswaan) {
            // Guru Kesiswaan dapat melihat izin guru reguler, walas, maupun sesama kesiswaan
            $hasAccess = $this->authorityResolver->canUserApprove($user, $leaveRequest);
        }

        if (!$hasAccess) {
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
        $targetDate = Carbon::parse($request->input('date'))->toDateString();

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

            // Validasi: Cegah izin untuk jadwal yang sudah dikecualikan oleh kalender akademik
            $schedules = Schedule::with('schoolClass')->whereIn('id', $scheduleIds)->get();
            foreach ($schedules as $sched) {
                $classLevel = $sched->schoolClass?->level;
                if ($classLevel !== null) {
                    $disablingEvent = $this->exclusionService->getActiveDisablingEvent($sched->class_id, $classLevel, $targetDate);
                    if ($disablingEvent !== null) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Jadwal ' . ($sched->schoolClass?->name ?? 'Kelas') . ' pada tanggal tersebut sudah dibebaskan dari KBM karena agenda sekolah (' . $disablingEvent->title . '). Tidak perlu mengajukan izin untuk jadwal ini.',
                            'error_code' => 'TEACHING_DISABLED_BY_EVENT',
                        ], 422);
                    }
                }
            }
        }

        // 2. Pencegahan Pengajuan Duplikat: Cegah pengajuan ganda pending/approved pada tanggal yang sama

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
     * Menyetujui perizinan guru (Khusus Tim Kesiswaan/BK).
     * Menerapkan prinsip First-Responder atomik dengan pessimistic row locking.
     * Sesuai aturan bisnis: Setelah menyetujui, sesi KBM otomatis dibebankan ke user Kesiswaan tersebut sebagai Guru Pengganti.
     * PATCH /api/teacher-leave-requests/{id}/approve
     */
    public function approve(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());

        if (!$isKesiswaan) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya Tim Kesiswaan yang berhak memverifikasi perizinan guru.',
            ], 403);
        }

        return DB::transaction(function () use ($user, $id, $isKesiswaan) {
            $leave = TeacherLeaveRequest::where('id', $id)->lockForUpdate()->firstOrFail();

            if ($leave->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Status perizinan ini sudah diproses sebelumnya dan tidak dapat diubah lagi.',
                ], 422);
            }

            // Anti-Self-Approval: Pemohon tidak boleh menyetujui izinnya sendiri
            if ((int) $leave->teacher_id === (int) $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akses ditolak. Anda tidak dapat menyetujui permohonan izin Anda sendiri.',
                ], 403);
            }

            // Validasi Otoritas Dinamis
            if (!$this->authorityResolver->canUserApprove($user, $leave)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akses ditolak. Anda tidak memiliki wewenang untuk memverifikasi perizinan ini.',
                ], 403);
            }

            $leave->update([
                'status' => 'approved',
                'approved_by' => $user->id,
                'verified_at' => Carbon::now('Asia/Jakarta'),
            ]);

            // Otomatisasi Pembebanan Jurnal Pengganti:
            // Sesi mengajar yang ditinggalkan langsung dibebankan ke Guru Kesiswaan yang menyetujui
            if ($isKesiswaan && !empty($leave->schedule_ids) && is_array($leave->schedule_ids)) {
                $targetDateStr = Carbon::parse($leave->date)->toDateString();
                foreach ($leave->schedule_ids as $schedId) {
                    \App\Models\Journal::updateOrCreate(
                        [
                            'schedule_id' => (int) $schedId,
                            'date' => $targetDateStr,
                        ],
                        [
                            'substitute_teacher_id' => $user->id,
                            'status' => 'ongoing',
                        ]
                    );
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Pengajuan izin guru berhasil disetujui.',
                'data' => $leave->fresh([
                    'teacher:id,name,nis_nip',
                    'approvedBy:id,name,nis_nip',
                ]),
            ], 200);
        });
    }

    /**
     * Menolak perizinan guru (Khusus Tim Kesiswaan/BK atau Waka).
     * Menerapkan prinsip First-Responder atomik dengan pessimistic row locking.
     * PATCH /api/teacher-leave-requests/{id}/reject
     */
    public function reject(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());

        if (!$isKesiswaan) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya Tim Kesiswaan yang berhak memverifikasi perizinan guru.',
            ], 403);
        }

        return DB::transaction(function () use ($user, $id) {
            $leave = TeacherLeaveRequest::where('id', $id)->lockForUpdate()->firstOrFail();

            if ($leave->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Status perizinan ini sudah diproses sebelumnya dan tidak dapat diubah lagi.',
                ], 422);
            }

            // Anti-Self-Approval: Pemohon tidak boleh menolak izinnya sendiri
            if ((int) $leave->teacher_id === (int) $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akses ditolak. Anda tidak dapat menolak permohonan izin Anda sendiri.',
                ], 403);
            }

            // Validasi Otoritas Dinamis
            if (!$this->authorityResolver->canUserApprove($user, $leave)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akses ditolak. Anda tidak memiliki wewenang untuk memverifikasi perizinan ini.',
                ], 403);
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
        });
    }
}
