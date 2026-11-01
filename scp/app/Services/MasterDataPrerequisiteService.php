<?php

namespace App\Services;

use App\Models\Classes;
use App\Models\Room;
use App\Models\Subject;
use App\Models\User;

class MasterDataPrerequisiteService
{
    /**
     * Memeriksa kelayakan Master Data untuk input jadwal manual (/api/schedules).
     * Wajib memiliki: classes, teachers, subjects, rooms.
     *
     * @return array{is_valid: bool, missing: array, errors: array}
     */
    public function validateForManualSchedule(): array
    {
        return $this->evaluateManual([
            'classes' => Classes::whereNull('deleted_at')->exists(),
            'teachers' => User::where('role', 'teacher')->whereNull('deleted_at')->exists(),
            'subjects' => Subject::whereNull('deleted_at')->exists(),
            'rooms' => Room::whereNull('deleted_at')->exists(),
        ]);
    }

    /**
     * Memeriksa kelayakan Master Data untuk upload & import PDF FET (/api/schedule-imports).
     * Pada SCP v4.5, hanya mensyaratkan:
     * 1. Minimal 1 siswa aktif (role=student, deleted_at is null)
     * 2. Minimal 1 guru aktif (role=teacher, deleted_at is null)
     * 3. Minimal 1 guru aktif memiliki fet_staff_id (fet_staff_id is not null and != '')
     * Kelas dibuat otomatis saat impor siswa, sedangkan Ruangan & Mata Pelajaran
     * didaftarkan otomatis oleh worker ParseSchedulePdfJob pada Fase 6.
     *
     * @return array{is_valid: bool, missing: array, errors: array}
     */
    public function validateForPdfImport(): array
    {
        $hasStudents = User::where('role', 'student')->whereNull('deleted_at')->exists();
        $hasTeachers = User::where('role', 'teacher')->whereNull('deleted_at')->exists();
        $hasTeachersWithFetId = User::where('role', 'teacher')
            ->whereNull('deleted_at')
            ->whereNotNull('fet_staff_id')
            ->where('fet_staff_id', '!=', '')
            ->exists();

        $missing = [];
        $errors = [];

        if (!$hasStudents) {
            $missing[] = 'students';
            $errors['students'] = ['Master data siswa masih kosong. Waka wajib mengimpor data siswa terlebih dahulu.'];
        }

        if (!$hasTeachers) {
            $missing[] = 'teachers';
            $errors['teachers'] = ['Master data guru masih kosong. Waka wajib mengimpor data guru terlebih dahulu.'];
        } elseif (!$hasTeachersWithFetId) {
            $missing[] = 'fet_staff_id';
            $errors['fet_staff_id'] = ['Belum ada guru yang memiliki nomor staf FET (fet_staff_id). Waka wajib melengkapi fet_staff_id guru untuk import PDF.'];
        }

        return [
            'is_valid' => empty($missing),
            'missing' => $missing,
            'errors' => $errors,
        ];
    }

    /**
     * Evaluasi kondisi ketersediaan 4 master data untuk pembuatan jadwal manual.
     */
    private function evaluateManual(array $checks): array
    {
        $missing = [];
        $errors = [];

        if (!$checks['classes']) {
            $missing[] = 'classes';
            $errors['classes'] = ['Master data kelas masih kosong. Waka wajib mendaftarkan kelas terlebih dahulu.'];
        }

        if (!$checks['teachers']) {
            $missing[] = 'teachers';
            $errors['teachers'] = ['Master data guru masih kosong. Waka wajib mendaftarkan guru terlebih dahulu.'];
        }

        if (!$checks['subjects']) {
            $missing[] = 'subjects';
            $errors['subjects'] = ['Master data mata pelajaran masih kosong. Waka wajib mendaftarkan mata pelajaran terlebih dahulu.'];
        }

        if (!$checks['rooms']) {
            $missing[] = 'rooms';
            $errors['rooms'] = ['Master data ruangan masih kosong. Waka wajib mendaftarkan ruangan terlebih dahulu.'];
        }

        return [
            'is_valid' => empty($missing),
            'missing' => $missing,
            'errors' => $errors,
        ];
    }
}
