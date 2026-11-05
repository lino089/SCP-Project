<?php

namespace App\Services;

use App\Models\Schedule;
use App\Models\TeacherAssignment;
use App\Models\TeacherLeaveRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class TeacherLeaveAuthorityResolver
{
    /**
     * Menentukan daftar ID pengguna (Waka Kurikulum atau Guru BK/Kesiswaan)
     * yang berwenang memverifikasi pengajuan izin mengajar tertentu.
     *
     * @param TeacherLeaveRequest $leave
     * @return array<int>
     */
    public function getAuthorizedApproverIds(TeacherLeaveRequest $leave): array
    {
        $applicantId = (int) $leave->teacher_id;
        $applicant = $leave->relationLoaded('teacher') ? $leave->teacher : User::find($applicantId);
        $wakaIds = User::where('role', 'vice_principal')->pluck('id')->map(fn($id) => (int)$id)->toArray();

        // ATURAN 1 (Anti-Self-Approval & Eskalasi Kesiswaan):
        // Jika guru pemohon adalah anggota Tim Kesiswaan / BK, wewenang verifikasi
        // wajib dieskalasikan khusus ke Waka Kurikulum (tidak boleh peer-approval sesama kesiswaan).
        if ($applicant && $applicant->isKesiswaan()) {
            return array_values(array_diff($wakaIds, [$applicantId]));
        }

        // ATURAN 2 (Resolusi Berdasarkan Rombel Kelas Jadwal Mengajar):
        // Ambil kelas-kelas dari jadwal mengajar yang ditinggalkan pada hari tersebut
        $approverIds = [];

        if (!empty($leave->schedule_ids) && is_array($leave->schedule_ids)) {
            $classIds = Schedule::whereIn('id', $leave->schedule_ids)
                ->pluck('class_id')
                ->filter()
                ->unique()
                ->map(fn($id) => (int)$id)
                ->values()
                ->toArray();

            if (!empty($classIds)) {
                // Petugas BK/Kesiswaan AKTIF yang membina rombel kelas-kelas tersebut
                $bkUserIds = TeacherAssignment::query()
                    ->where('type', 'kesiswaan')
                    ->where('is_active', true)
                    ->where(function ($q) use ($classIds) {
                        $q->whereIn('class_id', $classIds)
                          ->orWhereNull('class_id'); // Dukung penugasan global legacy
                    })
                    ->pluck('user_id')
                    ->map(fn($id) => (int)$id)
                    ->toArray();

                $approverIds = array_merge($approverIds, $bkUserIds);
            }
        } else {
            // Jika izin tidak memiliki schedule_ids (misal dinas luar umum),
            // petugas kesiswaan AKTIF dengan penugasan global (legacy) tetap didukung selain Waka
            $globalBkUserIds = TeacherAssignment::query()
                ->where('type', 'kesiswaan')
                ->where('is_active', true)
                ->whereNull('class_id')
                ->pluck('user_id')
                ->map(fn($id) => (int)$id)
                ->toArray();

            $approverIds = array_merge($approverIds, $globalBkUserIds);
        }

        // ATURAN 3 (Waka Kurikulum sebagai Supervisor Sentral):
        // Waka Kurikulum selalu memiliki wewenang untuk seluruh perizinan guru di sekolah
        $allApprovers = array_unique(array_merge($approverIds, $wakaIds));

        // ATURAN 4 (Anti-Self-Approval Terakhir):
        // Pemohon tidak pernah boleh menyetujui izinnya sendiri dalam kondisi apa pun
        $finalApprovers = array_values(array_diff($allApprovers, [$applicantId]));

        // ATURAN 5 (Universal Fallback):
        // Jika tidak ada petugas kesiswaan terpetakan (misal izin dinas tanpa jam mengajar KBM),
        // wewenang fallback otomatis ke seluruh Waka Kurikulum
        if (empty($finalApprovers)) {
            $finalApprovers = array_values(array_diff($wakaIds, [$applicantId]));
        }

        return $finalApprovers;
    }

    /**
     * Memeriksa apakah seorang pengguna memiliki kewenangan untuk memverifikasi izin tertentu.
     *
     * @param User $user
     * @param TeacherLeaveRequest $leave
     * @return bool
     */
    public function canUserApprove(User $user, TeacherLeaveRequest $leave): bool
    {
        $authorizedIds = $this->getAuthorizedApproverIds($leave);
        return in_array((int) $user->id, $authorizedIds, true);
    }

    /**
     * Memfilter query TeacherLeaveRequest pending yang berhak diverifikasi oleh pengguna tertentu.
     *
     * @param Builder $query
     * @param User $user
     * @param string|null $status
     * @return Builder
     */
    public function scopePendingRequestsForUser(Builder $query, User $user, ?string $status = 'pending'): Builder
    {
        if ($status !== null) {
            $query->where('status', $status);
        }

        // Waka Kurikulum dapat melihat dan memverifikasi seluruh pengajuan pending guru
        if ($user->role === 'vice_principal') {
            return $query->where('teacher_id', '!=', $user->id);
        }

        // Guru BK / Kesiswaan hanya dapat melihat pengajuan dari kelas binaannya
        // dan bukan permohonan dari sesama anggota Tim Kesiswaan
        if ($user->role === 'teacher' && $user->isKesiswaan()) {
            $assignedClassIds = $user->getKesiswaanClassIds();
            $hasGlobalAssignment = $user->assignments()->where('type', 'kesiswaan')->whereNull('class_id')->exists();
            $includePersonalVerifiedHistory = ($status !== 'pending');

            return $query->where('teacher_id', '!=', $user->id)
                ->where(function ($outer) use ($user, $assignedClassIds, $hasGlobalAssignment, $includePersonalVerifiedHistory) {
                    $outer->where(function ($activeScope) use ($assignedClassIds, $hasGlobalAssignment) {
                        $activeScope->whereDoesntHave('teacher.assignments', function ($q) {
                            // Hindari izin dari rekan guru kesiswaan aktif (karena harus dieskalasikan ke waka)
                            $q->where('type', 'kesiswaan')->where('is_active', true);
                        })->where(function ($sub) use ($assignedClassIds, $hasGlobalAssignment) {
                            if ($hasGlobalAssignment) {
                                return; // Jika assignment global, izinkan seluruh guru non-kesiswaan
                            }

                            if (empty($assignedClassIds)) {
                                $sub->whereRaw('1 = 0'); // Belum punya kelas binaan
                                return;
                            }

                            // Ambil jadwal yang memiliki class_id sesuai kelas binaan petugas
                            $validScheduleIds = Schedule::whereIn('class_id', $assignedClassIds)->pluck('id')->toArray();

                            if (empty($validScheduleIds)) {
                                $sub->whereRaw('1 = 0');
                                return;
                            }

                            // Cocokkan apakah schedule_ids pada izin beririsan dengan validScheduleIds
                            foreach ($validScheduleIds as $schedId) {
                                $sub->orWhereJsonContains('schedule_ids', (int)$schedId)
                                    ->orWhereJsonContains('schedule_ids', (string)$schedId);
                            }
                        });
                    });

                    // Keputusan 1 Opsi A: Tetap tampilkan riwayat izin yang pernah diverifikasi sendiri
                    if ($includePersonalVerifiedHistory) {
                        $outer->orWhere('approved_by', $user->id);
                    }
                });
        }

        // Guru reguler tanpa penugasan kesiswaan tidak memiliki akses verifikasi apa pun
        return $query->whereRaw('1 = 0');
    }
}
