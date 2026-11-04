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
    'email_verified_at',
    'password',
    'role',
    'nis_nip',
    'student_number',
    'gender',
    'nisn',
    'must_change_password',
    'class_id',
    'linked_student_id',
    'google_id',
    'phone_number',
    'graduation_date',
    'is_held_back',
    'subject_id',
    'is_active',
    'archived_at',
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
            'student_number' => 'integer',
            'is_held_back' => 'boolean',
            'is_active' => 'boolean',
            'archived_at' => 'datetime',
        ];
    }

    /**
     * Normalisasi nomor telepon ke format standar nasional Indonesia (08...)
     */
    public static function normalizePhoneNumber(?string $number): ?string
    {
        if ($number === null || trim($number) === '') {
            return null;
        }

        // Hapus karakter selain angka
        $digits = preg_replace('/[^0-9]/', '', $number);

        if (empty($digits)) {
            return null;
        }

        // Konversi awalan 628... -> 08...
        if (str_starts_with($digits, '628')) {
            $digits = '0' . substr($digits, 2);
        } elseif (str_starts_with($digits, '8')) {
            // Konversi awalan 8... -> 08...
            $digits = '0' . $digits;
        }

        return $digits;
    }

    public function setPhoneNumberAttribute($value): void
    {
        $this->attributes['phone_number'] = static::normalizePhoneNumber($value);
    }

    public function getTelpAttribute(): ?string
    {
        return $this->phone_number;
    }

    public function setTelpAttribute($value): void
    {
        $this->attributes['phone_number'] = static::normalizePhoneNumber($value);
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
     * Memeriksa apakah guru memiliki penugasan Kesiswaan (opsional: untuk kelas binaan tertentu)
     */
    public function isKesiswaan(?int $classId = null): bool
    {
        if ($this->role !== 'teacher') {
            return false;
        }

        $query = $this->assignments()->where('type', 'kesiswaan');
        if ($classId !== null) {
            $query->where(function ($q) use ($classId) {
                $q->where('class_id', $classId)
                  ->orWhereNull('class_id'); // Dukung penugasan global legacy
            });
        }

        return $query->exists();
    }

    /**
     * Mengambil daftar ID kelas yang dibina oleh Guru BK / Kesiswaan ini
     *
     * @return array<int>
     */
    public function getKesiswaanClassIds(): array
    {
        if ($this->role !== 'teacher') {
            return [];
        }

        return $this->assignments()
            ->where('type', 'kesiswaan')
            ->whereNotNull('class_id')
            ->pluck('class_id')
            ->map(fn($id) => (int) $id)
            ->unique()
            ->values()
            ->toArray();
    }

    /**
     * Mengambil ID kelas di mana guru ini bertindak sebagai Wali Kelas aktif
     */
    public function getWaliKelasClassId(): ?int
    {
        if ($this->role !== 'teacher') {
            return null;
        }

        $classId = $this->assignments()
            ->where('type', 'wali_kelas')
            ->value('class_id');

        return $classId !== null ? (int) $classId : null;
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
     * Relasi guru ke mata pelajaran yang diampu
     */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class, 'subject_id');
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

    /**
     * Relasi ke kode OTP verifikasi kontak pengguna
     */
    public function otpCodes(): HasMany
    {
        return $this->hasMany(OtpCode::class, 'user_id');
    }

    /**
     * Relasi ke riwayat perizinan mengajar yang diajukan oleh guru
     */
    public function teacherLeaveRequests(): HasMany
    {
        return $this->hasMany(TeacherLeaveRequest::class, 'teacher_id');
    }

    public function quizzes(): HasMany
    {
        return $this->hasMany(Quiz::class, 'teacher_id');
    }

    public function quizSubmissions(): HasMany
    {
        return $this->hasMany(QuizSubmission::class, 'student_id');
    }

    /**
     * Mengembalikan daftar class_id yang dibina sebagai wali kelas aktif
     *
     * @return array<int>
     */
    public function homeroomClassIds(): array
    {
        if ($this->role !== 'teacher') {
            return [];
        }

        return $this->assignments()
            ->where('type', 'wali_kelas')
            ->pluck('class_id')
            ->filter()
            ->values()
            ->toArray();
    }
}
