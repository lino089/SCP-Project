<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\LeaveRequest;
use App\Models\SystemConfiguration;
use App\Models\User;
use App\Services\AcademicCalendarExclusionService;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class LeaveRequestController extends Controller
{
    public function __construct(
        protected AcademicCalendarExclusionService $exclusionService
    ) {}
    /**
     * Helper untuk memfilter query LeaveRequest berdasarkan snapshot class_id
     * (dengan fallback ke student.class_id untuk data lama yang class_id-nya NULL).
     */
    private function applyClassFilter($query, array|int $classIds): void
    {
        $ids = array_values(array_filter(is_array($classIds) ? $classIds : [$classIds], fn ($v) => $v !== null));
        if (empty($ids)) {
            $query->whereRaw('1 = 0');
            return;
        }

        $query->where(function ($q) use ($ids) {
            $q->whereIn('class_id', $ids)
                ->orWhere(function ($sub) use ($ids) {
                    $sub->whereNull('class_id')
                        ->whereHas('student', fn ($sq) => $sq->whereIn('class_id', $ids));
                });
        });
    }

    /**
     * Menampilkan daftar perizinan siswa dengan scoping role & filter (PRD 9.6).
     * GET /api/leave-requests
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = LeaveRequest::query()
            ->with([
                'student:id,name,nis_nip,class_id',
                'student.schoolClass:id,name,level',
                'schoolClass:id,name,level',
                'applicant:id,name,role',
                'verifier:id,name,nis_nip',
            ]);

        // Role Scoping (Keputusan 1A, 2A, 3A, 4A):
        if ($user->role === 'vice_principal') {
            // Waka Kurikulum: Melihat seluruh pengajuan izin sekolah
            if ($request->filled('class_id')) {
                $this->applyClassFilter($query, $request->integer('class_id'));
            }
        } elseif ($user->role === 'teacher') {
            $hasGlobalKesiswaan = $user->assignments()
                ->where('type', 'kesiswaan')
                ->whereNull('class_id')
                ->exists();

            if ($hasGlobalKesiswaan) {
                // Petugas Kesiswaan Global: Melihat seluruh pengajuan izin sekolah
                if ($request->filled('class_id')) {
                    $this->applyClassFilter($query, $request->integer('class_id'));
                }
            } else {
                // Gabungkan kelas binaan aktif Kesiswaan (Keputusan 4 Opsi A) dan kelas perwalian aktif Wali Kelas
                $kesiswaanClassIds = $user->getKesiswaanClassIds();
                $waliClassIds = $user->homeroomClassIds();
                $allowedClassIds = array_values(array_unique(array_merge($kesiswaanClassIds, $waliClassIds)));
                $hasVerifiedHistory = LeaveRequest::where('verified_by', $user->id)->exists();

                if (empty($allowedClassIds) && !$hasVerifiedHistory) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat daftar perizinan.',
                    ], 403);
                }

                $requestedStatus = $request->input('status') ?? $request->input('status_approval');
                $includePersonalVerifiedHistory = ($requestedStatus !== 'pending');

                $query->where(function ($scopeQ) use ($allowedClassIds, $user, $includePersonalVerifiedHistory) {
                    if (!empty($allowedClassIds)) {
                        $scopeQ->where(function ($classQ) use ($allowedClassIds) {
                            $this->applyClassFilter($classQ, $allowedClassIds);
                        });

                        if ($includePersonalVerifiedHistory) {
                            $scopeQ->orWhere('verified_by', $user->id);
                        }
                    } else {
                        // Mantan pejabat Kesiswaan yang sudah tidak memiliki kelas aktif:
                        // Hanya dapat melihat riwayat izin yang pernah diverifikasi sendiri (Keputusan 1 Opsi A)
                        if ($includePersonalVerifiedHistory) {
                            $scopeQ->where('verified_by', $user->id);
                        } else {
                            $scopeQ->whereRaw('1 = 0');
                        }
                    }
                });

                if ($request->filled('class_id')) {
                    $this->applyClassFilter($query, $request->integer('class_id'));
                }
            }
        } elseif ($user->role === 'student') {
            // Siswa: Auto-scoped hanya perizinan miliknya
            $query->where('student_id', $user->id);
        } elseif ($user->role === 'parent') {
            // Orang Tua: Auto-scoped hanya perizinan anaknya
            $query->where('student_id', $user->linked_student_id);
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat daftar perizinan.',
            ], 403);
        }

        // Filtering
        if ($request->filled('status')) {
            $query->where('status_approval', $request->input('status'));
        }

        if ($request->filled('status_approval')) {
            $query->where('status_approval', $request->input('status_approval'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }

        if ($request->filled('student_id') && in_array($user->role, ['vice_principal', 'teacher'])) {
            $query->where('student_id', $request->integer('student_id'));
        }

        if ($request->filled('date')) {
            $date = $request->input('date');
            $query->where(function ($q) use ($date) {
                $q->where(function ($sub) use ($date) {
                    $sub->where('type', 'tidak_masuk')
                        ->whereDate('start_date', '<=', $date)
                        ->whereDate('end_date', '>=', $date);
                })->orWhere(function ($sub) use ($date) {
                    $sub->where('type', 'keluar_sekolah')
                        ->whereDate('start_date', $date);
                });
            });
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('start_date', [$request->input('start_date'), $request->input('end_date')]);
        }

        $perPage = $request->integer('per_page', 15);
        $leaveRequests = $query->orderBy('created_at', 'desc')->orderBy('id', 'desc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Data perizinan berhasil diambil.',
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
     * Menampilkan detail satu perizinan siswa (PRD 9.6).
     * GET /api/leave-requests/{id}
     */
    public function show(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $leaveRequest = LeaveRequest::with([
            'student:id,name,nis_nip,class_id',
            'student.schoolClass:id,name,level',
            'schoolClass:id,name,level',
            'applicant:id,name,role',
            'verifier:id,name,nis_nip',
        ])->findOrFail($id);

        $effectiveClassId = $leaveRequest->class_id ?? $leaveRequest->student?->class_id;

        $isWaka = ($user->role === 'vice_principal');
        $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan($effectiveClassId !== null ? (int) $effectiveClassId : null));
        $isWaliKelas = ($user->role === 'teacher' && $effectiveClassId !== null && $user->isWaliKelas((int) $effectiveClassId));
        $isHistoricalVerifier = ($user->role === 'teacher' && $leaveRequest->verified_by !== null && (int) $leaveRequest->verified_by === (int) $user->id);
        $isStudentOwner = ($user->role === 'student' && (int) $leaveRequest->student_id === (int) $user->id);
        $isParentOwner = ($user->role === 'parent' && (int) $leaveRequest->student_id === (int) $user->linked_student_id);

        if (!$isWaka && !$isKesiswaan && !$isWaliKelas && !$isHistoricalVerifier && !$isStudentOwner && !$isParentOwner) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat detail perizinan ini.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail perizinan berhasil diambil.',
            'data' => $leaveRequest,
        ], 200);
    }

    /**
     * Mengajukan perizinan siswa oleh Siswa atau Orang Tua (PRD 5.10 & 9.6).
     * POST /api/leave-requests
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        // 1. Identifikasi Siswa & Pemohon
        if ($user->role === 'student') {
            $studentId = $user->id;
        } elseif ($user->role === 'parent') {
            $studentId = $user->linked_student_id;
            if (!$studentId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akun orang tua belum ditautkan ke akun siswa.',
                ], 422);
            }
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Hanya siswa atau orang tua yang berhak mengajukan perizinan.',
            ], 403);
        }

        // 2. Validasi Bersyarat (2 Tipe x 2 Kategori)
        $rules = [
            'type' => 'required|string|in:tidak_masuk,keluar_sekolah',
            'category' => 'required|string|in:sakit,lainnya',
        ];

        if ($request->input('type') === 'tidak_masuk') {
            $rules['start_date'] = 'required|date';
            $rules['end_date'] = 'required|date|after_or_equal:start_date';
        } elseif ($request->input('type') === 'keluar_sekolah') {
            $rules['date'] = 'nullable|date';
            $rules['departure_time'] = 'required|date_format:H:i';
            $rules['expected_return_time'] = 'required|date_format:H:i|after:departure_time';
        }

        // Validasi Dokumen: Kategori sakit mewajibkan dokumen (surat dokter); kategori lainnya opsional
        if ($request->input('category') === 'sakit') {
            $rules['document'] = 'required|file|mimes:jpg,jpeg,png,pdf|max:2048';
        } else {
            $rules['document'] = 'nullable|file|mimes:jpg,jpeg,png,pdf|max:2048';
        }

        $request->validate($rules);

        // 3. Simpan berkas lampiran jika diunggah
        $documentPath = null;
        $disk = config('filesystems.default', 'public');
        if ($request->hasFile('document')) {
            $docFile = $request->file('document');
            $documentPath = $docFile->store('leaves', $disk);
            if ($disk !== 'public') {
                try {
                    Storage::disk('public')->put($documentPath, file_get_contents($docFile->getRealPath()));
                } catch (\Throwable) {}
            }
        }

        // 4. Penataan Tanggal & Jam
        $today = Carbon::now('Asia/Jakarta')->toDateString();
        if ($request->type === 'tidak_masuk') {
            $startDate = $request->start_date;
            $endDate = $request->end_date;
            $departureTime = null;
            $expectedReturnTime = null;
        } else {
            // keluar_sekolah bersifat same-day
            $startDate = $request->input('date', $today);
            $endDate = $startDate;
            $departureTime = $request->departure_time;
            $expectedReturnTime = $request->expected_return_time;
        }

        // Validasi Eksklusi Kalender Akademik & Agenda Khusus KBM
        $student = User::with('schoolClass')->find($studentId);
        if ($student && $student->schoolClass) {
            $period = CarbonPeriod::create($startDate, $endDate);
            $totalDays = 0;
            $exemptedDays = 0;
            $firstExemptionTitle = null;

            foreach ($period as $d) {
                if ($d->isWeekend()) {
                    continue;
                }
                $totalDays++;
                $disablingEvent = $this->exclusionService->getActiveDisablingEvent(
                    $student->schoolClass->id,
                    $student->schoolClass->level,
                    $d
                );
                if ($disablingEvent !== null) {
                    $exemptedDays++;
                    $firstExemptionTitle = $disablingEvent->title;
                }
            }

            if ($totalDays > 0 && $exemptedDays === $totalDays) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pengajuan izin ditolak karena seluruh tanggal yang dipilih merupakan hari libur atau kegiatan khusus yang meniadakan KBM (' . $firstExemptionTitle . ').',
                    'error_code' => 'TEACHING_DISABLED_BY_EVENT',
                ], 422);
            }
        }

        // 5. Simpan record perizinan beserta snapshot class_id & academic_year
        $academicYear = SystemConfiguration::query()->value('academic_year') ?: '2026/2027';

        $leaveRequest = LeaveRequest::create([
            'student_id' => $studentId,
            'class_id' => $student?->class_id,
            'academic_year' => $academicYear,
            'applicant_id' => $user->id,
            'type' => $request->type,
            'category' => $request->category,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'departure_time' => $departureTime,
            'expected_return_time' => $expectedReturnTime,
            'status_approval' => 'pending',
            'document_path' => $documentPath,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan perizinan berhasil dikirim.',
            'data' => $leaveRequest->fresh([
                'student:id,name,nis_nip,class_id',
                'student.schoolClass:id,name,level',
                'schoolClass:id,name,level',
                'applicant:id,name,role',
            ]),
        ], 201);
    }

    /**
     * Memverifikasi izin (Kesiswaan kelas binaan/Waka) ATAU mengedit pengajuan selama pending (Siswa/Ortu) (PRD 5.10 & 9.6).
     * PATCH /api/leave-requests/{id}
     */
    public function update(Request $request, $id): JsonResponse
    {
        $leaveRequest = LeaveRequest::with('student:id,class_id')->findOrFail($id);
        $user = $request->user();

        $effectiveClassId = $leaveRequest->class_id ?? $leaveRequest->student?->class_id;

        $isWaka = ($user->role === 'vice_principal');
        $isKesiswaanForClass = ($user->role === 'teacher' && $user->isKesiswaan($effectiveClassId !== null ? (int) $effectiveClassId : null));
        $isOwner = ((int) $leaveRequest->applicant_id === (int) $user->id || (int) $leaveRequest->student_id === (int) $user->id);

        // Cabang 1: Verifikasi oleh Guru Kesiswaan Kelas Binaan (Keputusan 3A & 4A) atau Waka Kurikulum
        if ($isWaka || $isKesiswaanForClass) {
            // Jika ada payload verifikasi status
            if ($request->has('status') || $request->has('status_approval')) {
                $request->validate([
                    'status' => 'required_without:status_approval|string|in:approved,rejected',
                    'status_approval' => 'required_without:status|string|in:approved,rejected',
                ]);

                $newStatus = $request->input('status') ?? $request->input('status_approval');

                if ($leaveRequest->status_approval !== 'pending') {
                    return response()->json([
                        'success' => false,
                        'message' => 'Status perizinan ini sudah diproses sebelumnya dan tidak dapat diubah lagi.',
                    ], 422);
                }

                $leaveRequest->update([
                    'status_approval' => $newStatus,
                    'verified_by' => $user->id,
                    'verified_at' => Carbon::now('Asia/Jakarta'),
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Status perizinan berhasil diverifikasi (' . $newStatus . ').',
                    'data' => $leaveRequest->fresh([
                        'student:id,name,nis_nip,class_id',
                        'student.schoolClass:id,name,level',
                        'schoolClass:id,name,level',
                        'applicant:id,name,role',
                        'verifier:id,name,nis_nip',
                    ]),
                ], 200);
            }
        }

        // Cabang 2: Edit pengajuan oleh Siswa atau Orang Tua pemohon
        if ($isOwner) {
            if ($leaveRequest->status_approval !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Perizinan yang sudah diverifikasi tidak dapat diubah.',
                ], 422);
            }

            $rules = [
                'type' => 'nullable|string|in:tidak_masuk,keluar_sekolah',
                'category' => 'nullable|string|in:sakit,lainnya',
                'start_date' => 'nullable|date',
                'end_date' => 'nullable|date|after_or_equal:start_date',
                'departure_time' => 'nullable|date_format:H:i',
                'expected_return_time' => 'nullable|date_format:H:i',
                'document' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:2048',
            ];

            if ($request->filled('departure_time') && $request->filled('expected_return_time')) {
                $rules['expected_return_time'] .= '|after:departure_time';
            }

            $request->validate($rules);

            $dataToUpdate = [];
            if ($request->filled('type')) {
                $dataToUpdate['type'] = $request->input('type');
            }
            if ($request->filled('category')) {
                $dataToUpdate['category'] = $request->input('category');
            }
            if ($request->filled('start_date')) {
                $dataToUpdate['start_date'] = $request->input('start_date');
            }
            if ($request->filled('end_date')) {
                $dataToUpdate['end_date'] = $request->input('end_date');
            }
            if ($request->filled('departure_time')) {
                $dataToUpdate['departure_time'] = $request->input('departure_time');
            }
            if ($request->filled('expected_return_time')) {
                $dataToUpdate['expected_return_time'] = $request->input('expected_return_time');
            }

            // Ganti berkas dokumen jika ada upload baru
            if ($request->hasFile('document')) {
                $disk = config('filesystems.default', 'public');
                if ($leaveRequest->document_path) {
                    Storage::disk($disk)->delete($leaveRequest->document_path);
                    if ($disk !== 'public') {
                        try {
                            Storage::disk('public')->delete($leaveRequest->document_path);
                        } catch (\Throwable) {}
                    }
                }
                $docFile = $request->file('document');
                $dataToUpdate['document_path'] = $docFile->store('leaves', $disk);
                if ($disk !== 'public') {
                    try {
                        Storage::disk('public')->put($dataToUpdate['document_path'], file_get_contents($docFile->getRealPath()));
                    } catch (\Throwable) {}
                }
            }

            $leaveRequest->update($dataToUpdate);

            return response()->json([
                'success' => true,
                'message' => 'Data perizinan berhasil diperbarui.',
                'data' => $leaveRequest->fresh([
                    'student:id,name,nis_nip,class_id',
                    'student.schoolClass:id,name,level',
                    'applicant:id,name,role',
                ]),
            ], 200);
        }

        // Aktor tidak berhak
        return response()->json([
            'success' => false,
            'message' => 'Akses ditolak. Anda tidak memiliki wewenang untuk mengubah perizinan ini.',
        ], 403);
    }

    /**
     * Membatalkan pengajuan izin selama masih pending oleh Siswa atau Orang Tua (PRD 5.10 & 9.6).
     * DELETE /api/leave-requests/{id}
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $leaveRequest = LeaveRequest::findOrFail($id);
        $user = $request->user();

        $isOwner = ($leaveRequest->applicant_id === $user->id || $leaveRequest->student_id === $user->id);

        if (!$isOwner) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda hanya dapat membatalkan pengajuan izin milik sendiri.',
            ], 403);
        }

        if ($leaveRequest->status_approval !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Perizinan yang sudah diverifikasi tidak dapat dibatalkan.',
            ], 422);
        }

        if ($leaveRequest->document_path) {
            $disk = config('filesystems.default', 'public');
            Storage::disk($disk)->delete($leaveRequest->document_path);
            if ($disk !== 'public') {
                try {
                    Storage::disk('public')->delete($leaveRequest->document_path);
                } catch (\Throwable) {}
            }
        }

        $leaveRequest->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan perizinan berhasil dibatalkan.',
        ], 200);
    }
}
