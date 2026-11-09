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
     * Menentukan daftar ID pengguna (Guru BK/Kesiswaan aktif)
     * yang berwenang memverifikasi pengajuan izin mengajar tertentu.
     * Sesuai aturan bisnis terbaru:
     * - Waka hanya sebagai monitoring (bukan approver perizinan harian).
     * - Izin Guru Reguler & Wali Kelas disetujui oleh Kesiswaan/BK.
     * - Izin Guru Kesiswaan disetujui oleh sesama Guru Kesiswaan aktif lainnya.
     * - Anti-Self-Approval: Pemohon tidak boleh menyetujui izinnya sendiri.
     *
     * @param TeacherLeaveRequest $leave
     * @return array<int>
     */
    public function getAuthorizedApproverIds(TeacherLeaveRequest $leave): array
    {
        $applicantId = (int) $leave->teacher_id;
        $applicant = $leave->relationLoaded('teacher') ? $leave->teacher : User::find($applicantId);
        $wakaIds = User::where('role', 'vice_principal')->pluck('id')->map(fn($id) => (int)$id)->toArray();

        // Ambil seluruh ID Guru Kesiswaan aktif di sekolah
        $allActiveKesiswaanIds = TeacherAssignment::query()
            ->where('type', 'kesiswaan')
            ->where('is_active', true)
            ->pluck('user_id')
            ->unique()
            ->map(fn($id) => (int)$id)
            ->toArray();

        // ATURAN 1 (Guru Kesiswaan Izin):
        // Jika pemohon adalah anggota Tim Kesiswaan, wewenang verifikasi
        // diserahkan ke sesama Guru Kesiswaan aktif lainnya (peer-approval) dan Waka sebagai supervisor.
        if ($applicant && $applicant->isKesiswaan()) {
            $peerKesiswaanIds = array_diff($allActiveKesiswaanIds, [$applicantId]);
            $allApprovers = array_unique(array_merge($peerKesiswaanIds, $wakaIds));
            return array_values(array_diff($allApprovers, [$applicantId]));
        }

        // ATURAN 2 (Guru Reguler & Walas):
        // Resolusi berdasarkan rombel kelas jadwal mengajar yang ditinggalkan
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
                $bkUserIds = TeacherAssignment::query()
                    ->where('type', 'kesiswaan')
                    ->where('is_active', true)
                    ->where(function ($q) use ($classIds) {
                        $q->whereIn('class_id', $classIds)
                          ->orWhereNull('class_id'); // Penugasan global
                    })
                    ->pluck('user_id')
                    ->map(fn($id) => (int)$id)
                    ->toArray();

                $approverIds = array_merge($approverIds, $bkUserIds);
            }
        }

        // Fallback: Jika tidak terpetakan kelas spesifik, dukung petugas kesiswaan global
        if (empty($approverIds)) {
            $globalBkUserIds = TeacherAssignment::query()
                ->where('type', 'kesiswaan')
                ->where('is_active', true)
                ->whereNull('class_id')
                ->pluck('user_id')
                ->map(fn($id) => (int)$id)
                ->toArray();
            $approverIds = array_merge($approverIds, $globalBkUserIds);
        }

        // Waka Kurikulum selalu disertakan sebagai supervisor sentral / monitoring
        $allApprovers = array_unique(array_merge($approverIds, $wakaIds));

        // ATURAN 3: Anti-Self-Approval
        $finalApprovers = array_values(array_diff($allApprovers, [$applicantId]));

        if (empty($finalApprovers)) {
            $finalApprovers = array_values(array_diff($wakaIds, [$applicantId]));
        }

        return $finalApprovers;
    }

    /**
     * Memeriksa apakah seorang pengguna memiliki kewenangan untuk memverifikasi izin tertentu.
     */
    public function canUserApprove(User $user, TeacherLeaveRequest $leave): bool
    {
        $authorizedIds = $this->getAuthorizedApproverIds($leave);
        return in_array((int) $user->id, $authorizedIds, true);
    }

    /**
     * Memfilter query TeacherLeaveRequest yang berhak diverifikasi / dipantau oleh pengguna tertentu.
     */
    public function scopePendingRequestsForUser(Builder $query, User $user, ?string $status = 'pending'): Builder
    {
        if ($status !== null) {
            $query->where('status', $status);
        }

        // Waka Kurikulum: Monitoring seluruh pengajuan guru (read-only)
        if ($user->role === 'vice_principal') {
            return $query->where('teacher_id', '!=', $user->id);
        }

        // Guru BK / Kesiswaan: Berhak melihat pengajuan dari Guru Reguler, Walas, dan sesama Kesiswaan
        if ($user->role === 'teacher' && $user->isKesiswaan()) {
            $assignedClassIds = $user->getKesiswaanClassIds();
            $hasGlobalAssignment = $user->assignments()->where('type', 'kesiswaan')->whereNull('class_id')->exists();
            $includePersonalVerifiedHistory = ($status !== 'pending');

            return $query->where('teacher_id', '!=', $user->id)
                ->where(function ($outer) use ($user, $assignedClassIds, $hasGlobalAssignment, $includePersonalVerifiedHistory) {
                    $outer->where(function ($activeScope) use ($assignedClassIds, $hasGlobalAssignment) {
                        if ($hasGlobalAssignment || empty($assignedClassIds)) {
                            return; // Assignment global atau umum: lihat seluruh antrean
                        }

                        $validScheduleIds = Schedule::whereIn('class_id', $assignedClassIds)->pluck('id')->toArray();

                        // Dukung permohonan dari sesama rekan kesiswaan ATAU jadwal pada kelas binaan
                        $activeScope->whereHas('teacher.assignments', function ($q) {
                            $q->where('type', 'kesiswaan')->where('is_active', true);
                        })->orWhere(function ($sub) use ($validScheduleIds) {
                            if (empty($validScheduleIds)) {
                                return;
                            }
                            foreach ($validScheduleIds as $schedId) {
                                $sub->orWhereJsonContains('schedule_ids', (int)$schedId)
                                    ->orWhereJsonContains('schedule_ids', (string)$schedId);
                            }
                        });
                    });

                    if ($includePersonalVerifiedHistory) {
                        $outer->orWhere('approved_by', $user->id);
                    }
                });
        }

        // Guru reguler tanpa penugasan kesiswaan tidak memiliki akses verifikasi
        return $query->whereRaw('1 = 0');
    }
}
