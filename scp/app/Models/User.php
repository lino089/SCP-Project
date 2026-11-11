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
    'google_email',
    'google_linked_at',
    'phone_number',
    'phone_verified_at',
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
            'phone_verified_at' => 'datetime',
            'google_linked_at' => 'datetime',
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
     * Relasi ke penugasan tambahan guru yang SEDANG AKTIF (Kesiswaan / Wali Kelas)
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(TeacherAssignment::class, 'user_id')
            ->where('is_active', true);
    }

    /**
     * Relasi ke seluruh riwayat penugasan tambahan guru (aktif maupun lampau/nonaktif)
     */
    public function assignmentHistories(): HasMany
    {
        return $this->hasMany(TeacherAssignment::class, 'user_id')
            ->orderByDesc('started_at')
            ->orderByDesc('id');
    }

    /**
     * Relasi riwayat kenaikan/perpindahan kelas siswa
     */
    public function classHistories(): HasMany
    {
        return $this->hasMany(StudentClassHistory::class, 'student_id')
            ->orderByDesc('processed_at')
            ->orderByDesc('id');
    }

    /**
     * Cache penugasan guru per instance User (P-17: memoize authorization helper)
     *
     * @var \Illuminate\Database\Eloquent\Collection|null
     */
    protected ?\Illuminate\Database\Eloquent\Collection $cachedAssignments = null;

    /**
     * Mengambil koleksi penugasan aktif dengan memoization per-instance
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getCachedAssignments(): \Illuminate\Database\Eloquent\Collection
    {
        if ($this->cachedAssignments !== null) {
            return $this->cachedAssignments;
        }

        if ($this->relationLoaded('assignments')) {
            return $this->cachedAssignments = $this->getRelation('assignments');
        }

        return $this->cachedAssignments = $this->assignments()->get();
    }

    /**
     * Reset memoized assignments
     */
    public function clearCachedAssignments(): void
    {
        $this->cachedAssignments = null;
        $this->unsetRelation('assignments');
    }

    /**
     * Memeriksa apakah guru memiliki penugasan tertentu
     */
    public function hasAssignment(string $type): bool
    {
        return $this->role === 'teacher' && $this->getCachedAssignments()->contains('type', $type);
    }

    /**
     * Memeriksa apakah guru memiliki penugasan Kesiswaan (opsional: untuk kelas binaan tertentu)
     */
    public function isKesiswaan(?int $classId = null): bool
    {
        if ($this->role !== 'teacher') {
            return false;
        }

        return $this->getCachedAssignments()->contains(function ($a) use ($classId) {
            if ($a->type !== 'kesiswaan') {
                return false;
            }
            if ($classId === null) {
                return true;
            }
            return $a->class_id === null || (int) $a->class_id === (int) $classId;
        });
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

        return $this->getCachedAssignments()
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

        $assignment = $this->getCachedAssignments()->firstWhere('type', 'wali_kelas');

        return $assignment && $assignment->class_id !== null ? (int) $assignment->class_id : null;
    }

    /**
     * Memeriksa apakah guru adalah Wali Kelas (opsional: untuk kelas tertentu)
     */
    public function isWaliKelas(?int $classId = null): bool
    {
        if ($this->role !== 'teacher') {
            return false;
        }

        return $this->getCachedAssignments()->contains(function ($a) use ($classId) {
            if ($a->type !== 'wali_kelas') {
                return false;
            }
            if ($classId === null) {
                return true;
            }
            return (int) $a->class_id === (int) $classId;
        });
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
     * Mengambil seluruh siswa yang terhubung dengan akun orang tua ini.
     * Mendukung anak tunggal maupun multi-anak dari akun wali dengan kontak/identitas yang sama.
     *
     * @return \Illuminate\Support\Collection<int, User>
     */
    public function getLinkedStudents(): \Illuminate\Support\Collection
    {
        if ($this->role !== 'parent') {
            return collect();
        }

        $students = collect();
        if ($this->linked_student_id) {
            $primary = $this->linkedStudent;
            if ($primary) {
                $students->push($primary);
            }
        }

        // Cari akun wali lain yang memiliki phone_number, email, atau google_id yang sama dan valid
        $hasIdentifier = false;
        $query = static::where('role', 'parent')
            ->where('id', '!=', $this->id)
            ->whereNotNull('linked_student_id');

        $query->where(function ($sub) use (&$hasIdentifier) {
            if (!empty($this->phone_number)) {
                $sub->orWhere('phone_number', $this->phone_number);
                $hasIdentifier = true;
            }
            if (!empty($this->email)) {
                $sub->orWhere('email', $this->email);
                $hasIdentifier = true;
            }
            if (!empty($this->google_id)) {
                $sub->orWhere('google_id', $this->google_id);
                $hasIdentifier = true;
            }
        });

        if ($hasIdentifier) {
            $otherParentStudentIds = $query->pluck('linked_student_id')->filter()->unique();
            if ($otherParentStudentIds->isNotEmpty()) {
                $siblings = static::whereIn('id', $otherParentStudentIds)
                    ->where('role', 'student')
                    ->with('schoolClass:id,name,level')
                    ->get();
                foreach ($siblings as $sib) {
                    if (!$students->contains('id', $sib->id)) {
                        $students->push($sib);
                    }
                }
            }
        }

        // Pastikan relasi schoolClass termuat
        $students->each(function ($student) {
            $student->loadMissing('schoolClass:id,name,level');
        });

        return $students->values();
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

        return $this->getCachedAssignments()
            ->where('type', 'wali_kelas')
            ->pluck('class_id')
            ->filter()
            ->map(fn($id) => (int) $id)
            ->values()
            ->toArray();
    }
}
