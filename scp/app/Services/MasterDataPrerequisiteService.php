<?php

namespace App\Services;

use App\Models\Classes;
use App\Models\Rooms;
use App\Models\Subject;
use App\Models\User;

class MasterDataPrerequisiteService
{
    /**
     * Memeriksa kelayakan Master Data untuk input jadwal manual (/api/schedules).
     *
     * @return array{is_valid: bool, missing: array, errors: array}
     */
    public function validateForManualSchedule(): array
    {
        return $this->evaluate([
            'classes' => Classes::whereNull('deleted_at')->exists(),
            'teachers' => User::where('role', 'teacher')->whereNull('deleted_at')->exists(),
            'subjects' => Subject::whereNull('deleted_at')->exists(),
            'rooms' => Rooms::whereNull('deleted_at')->exists(),
        ], isPdfImport: false);
    }

    /**
     * Memeriksa kelayakan Master Data untuk upload & import PDF FET (/api/schedule-imports).
     *
     * @return array{is_valid: bool, missing: array, errors: array}
     */
    public function validateForPdfImport(): array
    {
        $hasTeachers = User::where('role', 'teacher')->whereNull('deleted_at')->exists();
        $hasTeachersWithFetId = User::where('role', 'teacher')
            ->whereNull('deleted_at')
            ->whereNotNull('fet_staff_id')
            ->where('fet_staff_id', '!=', '')
            ->exists();

        return $this->evaluate([
            'classes' => Classes::whereNull('deleted_at')->exists(),
            'teachers' => $hasTeachers,
            'fet_staff_id' => $hasTeachersWithFetId,
            'subjects' => Subject::whereNull('deleted_at')->exists(),
            'rooms' => Rooms::whereNull('deleted_at')->exists(),
        ], isPdfImport: true);
    }

    /**
     * Evaluasi kondisi ketersediaan dan konstruksi struktur pesan error standar.
     */
    private function evaluate(array $checks, bool $isPdfImport): array
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
        } elseif ($isPdfImport && isset($checks['fet_staff_id']) && !$checks['fet_staff_id']) {
            $missing[] = 'fet_staff_id';
            $errors['fet_staff_id'] = ['Belum ada guru yang memiliki nomor staf FET (fet_staff_id). Waka wajib melengkapi fet_staff_id guru untuk import PDF.'];
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
