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
     * Pada SCP v4.6, mensyaratkan:
     * 1. Minimal 1 siswa aktif (role=student, deleted_at is null)
     * 2. Minimal 1 guru aktif (role=teacher, deleted_at is null)
     * Kelas dibuat otomatis saat impor siswa, sedangkan Ruangan & Mata Pelajaran
     * didaftarkan otomatis oleh worker ParseSchedulePdfJob.
     *
     * @return array{is_valid: bool, missing: array, errors: array}
     */
    public function validateForPdfImport(): array
    {
        $hasStudents = User::where('role', 'student')->whereNull('deleted_at')->exists();
        $hasTeachers = User::where('role', 'teacher')->whereNull('deleted_at')->exists();

        $missing = [];
        $errors = [];

        if (!$hasStudents) {
            $missing[] = 'students';
            $errors['students'] = ['Master data siswa masih kosong. Waka wajib mengimpor data siswa terlebih dahulu.'];
        }

        if (!$hasTeachers) {
            $missing[] = 'teachers';
            $errors['teachers'] = ['Master data guru masih kosong. Waka wajib mengimpor data guru terlebih dahulu.'];
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
