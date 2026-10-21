<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'name',
    'email',
    'password',
    'role',
    'nis_nip',
    'must_change_password',
    'class_id',
    'linked_student_id',
    'fet_staff_id',
    'google_id',
    'phone_number',
    'graduation_date',
    'is_held_back'
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'must_change_password' => 'boolean',
            'graduation_date' => 'date',
            'is_held_back' => 'boolean'
        ];
    }

    /**
     * Relasi ke penugasan tambahan guru (Kesiswaan / Wali Kelas)
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(TeacherAssignment::class, 'user_id');
    }

    /**
     * Memeriksa apakah guru memiliki penugasan tertentu
     */
    public function hasAssignment(string $type): bool
    {
        return $this->role === 'teacher' && $this->assignments()->where('type', $type)->exists();
    }

    /**
     * Memeriksa apakah guru memiliki penugasan Kesiswaan
     */
    public function isKesiswaan(): bool
    {
        return $this->hasAssignment('kesiswaan');
    }

    /**
     * Memeriksa apakah guru adalah Wali Kelas (opsional: untuk kelas tertentu)
     */
    public function isWaliKelas(?int $classId = null): bool
    {
        if ($this->role !== 'teacher') {
            return false;
        }

        $query = $this->assignments()->where('type', 'wali_kelas');
        if ($classId !== null) {
            $query->where('class_id', $classId);
        }

        return $query->exists();
    }

    /**
     * Relasi siswa ke kelasnya
     */
    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(Classes::class, 'class_id');
    }

    /**
     * Relasi akun orang tua ke akun siswa (anaknya)
     */
    public function linkedStudent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'linked_student_id');
    }

    /**
     * Relasi akun siswa ke akun orang tuanya
     */
    public function parents(): HasMany
    {
        return $this->hasMany(User::class, 'linked_student_id');
    }

    /**
     * Relasi jadwal mengajar guru
     */
    public function schedules(): HasMany
    {
        return $this->hasMany(Schedule::class, 'teacher_id');
    }

    /**
     * Relasi riwayat presensi siswa
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class, 'student_id');
    }

    /**
     * Relasi riwayat perizinan siswa (PRD v4.4)
     */
    public function leaveRequests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class, 'student_id');
    }

    /**
     * Relasi perizinan yang diajukan user (sebagai siswa atau orang tua)
     */
    public function appliedLeaveRequests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class, 'applicant_id');
    }

    /**
     * Relasi riwayat perizinan siswa (Legacy alias)
     */
    public function permissions(): HasMany
    {
        return $this->hasMany(StudentPermision::class, 'student_id');
    }

    /**
     * Relasi jurnal yang diampu sebagai guru pengganti
     */
    public function substituteJournals(): HasMany
    {
        return $this->hasMany(Journal::class, 'substitute_teacher_id');
    }

    /**
     * Relasi riwayat pergantian putaran siklus yang dilakukan waka
     */
    public function cycleHistories(): HasMany
    {
        return $this->hasMany(CycleHistory::class, 'changed_by');
    }
}
