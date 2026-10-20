<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Models\ScheduleImport;
use App\Models\ScheduleImportRow;
use App\Models\Subject;
use App\Models\User;
use App\Models\Rooms;
use App\Models\Classes;
use App\Models\Schedule;
use App\Services\ScheduleConflictService;
use Symfony\Component\Process\Process;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ParseSchedulePdfJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $importId;

    public function __construct($importId)
    {
        $this->importId = $importId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $import = ScheduleImport::find($this->importId);

        if (!$import) {
            return;
        }

        $import->update(['status' => 'parsing']);

        $fullPathKelas = file_exists($import->file_path_kelas)
            ? $import->file_path_kelas
            : (Storage::disk('local')->exists($import->file_path_kelas)
                ? Storage::disk('local')->path($import->file_path_kelas)
                : storage_path('app/private/' . $import->file_path_kelas));

        $fullPathRuangan = file_exists($import->file_path_ruangan)
            ? $import->file_path_ruangan
            : (Storage::disk('local')->exists($import->file_path_ruangan)
                ? Storage::disk('local')->path($import->file_path_ruangan)
                : storage_path('app/private/' . $import->file_path_ruangan));

        $scriptPath = base_path('script/pdf_parser.py');

        $pythonBinary = 'python';
        $venvWindows = base_path('.venv/Scripts/python.exe');
        $venvUnix = base_path('.venv/bin/python');

        if (file_exists($venvWindows)) {
            $pythonBinary = $venvWindows;
        } elseif (file_exists($venvUnix)) {
            $pythonBinary = $venvUnix;
        }

        $process = new Process([$pythonBinary, $scriptPath, $fullPathKelas, $fullPathRuangan]);
        $process->setTimeout(180);
        $process->run();

        if (!$process->isSuccessful()) {
            $import->update(['status' => 'failed']);
            Log::error('Python Parser Error: ' . $process->getErrorOutput());
            return;
        }

        $outputString = $process->getOutput();
        $parseData = json_decode($outputString, true);

        if (!is_array($parseData)) {
            $import->update(['status' => 'failed']);
            Log::error('Python Parser Output is not valid JSON array.');
            return;
        }

        // Preload master data to optimize memory and queries
        $allClasses = Classes::all();
        $allTeachers = User::where('role', 'teacher')->get();
        $allSubjects = Subject::all();
        $allRooms = Rooms::all();

        $conflictService = new ScheduleConflictService();

        // Track intra-batch slots for conflict detection: key = "day-period"
        $batchSlots = [];

        foreach ($parseData as $row) {
            $matchedClass = $this->findClass($allClasses, $row['kelas_mentah'] ?? null);
            $matchedTeacher = $this->findTeacher(
                $allTeachers,
                $row['fet_staff_id'] ?? null,
                $row['guru_mentah'] ?? null
            );
            $matchedSubject = $this->findSubject($allSubjects, $row['mapel_mentah'] ?? null);
            $matchedRoom = $this->findRoom($allRooms, $row['ruang_final'] ?? null);

            $day = (int) ($row['day_of_week'] ?? 1);
            $startPeriod = (int) ($row['period_number'] ?? 1);
            $duration = (int) ($row['duration_periods'] ?? 1);
            $endPeriod = $startPeriod + $duration - 1;

            $roomSourceConflict = (bool) ($row['room_source_conflict'] ?? false);

            $hasMissingEntity = !$matchedClass || !$matchedTeacher || !$matchedSubject || !$matchedRoom;

            if ($hasMissingEntity || $roomSourceConflict) {
                $matchStatus = 'unmatched';
            } else {
                // Anti-collision checking: intra-batch and existing schedules
                $hasConflict = false;

                // 1. Check intra-batch collisions
                for ($p = $startPeriod; $p <= $endPeriod; $p++) {
                    $slotKey = "{$day}-{$p}";
                    if (isset($batchSlots[$slotKey])) {
                        if (
                            in_array($matchedTeacher->id, $batchSlots[$slotKey]['teachers']) ||
                            in_array($matchedClass->id, $batchSlots[$slotKey]['classes']) ||
                            in_array($matchedRoom->id, $batchSlots[$slotKey]['rooms'])
                        ) {
                            $hasConflict = true;
                            break;
                        }
                    }
                }

                // 2. Check collisions against existing schedules on same cycle_type
                if (!$hasConflict) {
                    $existingConflicts = $conflictService->findConflicts([
                        'teacher_id' => $matchedTeacher->id,
                        'class_id' => $matchedClass->id,
                        'room_id' => $matchedRoom->id,
                        'cycle_type' => $import->cycle_type,
                        'day_of_week' => $day,
                        'period_number' => $startPeriod,
                        'duration_periods' => $duration,
                    ]);

                    if ($existingConflicts->isNotEmpty()) {
                        $hasConflict = true;
                    }
                }

                if ($hasConflict) {
                    $matchStatus = 'conflict';
                } else {
                    $matchStatus = 'matched';

                    // Register slot occupation in this batch
                    for ($p = $startPeriod; $p <= $endPeriod; $p++) {
                        $slotKey = "{$day}-{$p}";
                        $batchSlots[$slotKey]['teachers'][] = $matchedTeacher->id;
                        $batchSlots[$slotKey]['classes'][] = $matchedClass->id;
                        $batchSlots[$slotKey]['rooms'][] = $matchedRoom->id;
                    }
                }
            }

            ScheduleImportRow::create([
                'import_id' => $import->id,
                'raw_data' => $row,
                'matched_class_id' => $matchedClass?->id,
                'matched_teacher_id' => $matchedTeacher?->id,
                'matched_room_id' => $matchedRoom?->id,
                'matched_subject_id' => $matchedSubject?->id,
                'day_of_week' => $day,
                'period_number' => $startPeriod,
                'duration_periods' => $duration,
                'match_status' => $matchStatus,
                'room_source_conflict' => $roomSourceConflict,
                'resolved_by_waka' => false,
            ]);
        }

        $import->update(['status' => 'preview_ready']);
    }

    protected function findClass($classes, ?string $classRaw): ?Classes
    {
        if (!$classRaw) return null;
        $norm = strtoupper(trim($classRaw));
        $normNoSpace = str_replace(' ', '', $norm);

        return $classes->first(function ($c) use ($norm, $normNoSpace) {
            $cName = strtoupper(trim($c->name));
            return $cName === $norm || str_replace(' ', '', $cName) === $normNoSpace;
        });
    }

    protected function findTeacher($teachers, ?string $fetStaffId, ?string $teacherRaw): ?User
    {
        // Priority 1: Primary lookup via fet_staff_id
        if ($fetStaffId !== null && $fetStaffId !== '') {
            $match = $teachers->first(fn ($t) => (string) $t->fet_staff_id === (string) $fetStaffId);
            if ($match) {
                return $match;
            }
        }

        // Priority 2: Fallback to teacher name matching
        if ($teacherRaw) {
            $cleanRaw = strtoupper(trim($teacherRaw));

            // Exact match
            $match = $teachers->first(fn ($t) => strtoupper(trim($t->name)) === $cleanRaw);
            if ($match) return $match;

            // Substring match
            $match = $teachers->first(
                fn ($t) => stripos($t->name, $cleanRaw) !== false || stripos($cleanRaw, $t->name) !== false
            );
            if ($match) return $match;

            // Strip academic titles/degrees (S.Pd, M.Pd, etc.)
            $cleanNoTitle = preg_replace('/,\s*(?:S\.[A-Za-z]+|M\.[A-Za-z]+|Drs\.|Dr\.|Ir\.|M\.T|S\.T|S\.Kom|M\.Kom).*$/i', '', $cleanRaw);
            $cleanNoTitle = trim($cleanNoTitle);
            if ($cleanNoTitle && $cleanNoTitle !== $cleanRaw) {
                $match = $teachers->first(function ($t) use ($cleanNoTitle) {
                    $tNameNoTitle = preg_replace('/,\s*(?:S\.[A-Za-z]+|M\.[A-Za-z]+|Drs\.|Dr\.|Ir\.|M\.T|S\.T|S\.Kom|M\.Kom).*$/i', '', strtoupper($t->name));
                    return stripos($tNameNoTitle, $cleanNoTitle) !== false || stripos($cleanNoTitle, $tNameNoTitle) !== false;
                });
                if ($match) return $match;
            }
        }

        return null;
    }

    protected function findSubject($subjects, ?string $subjectRaw): ?Subject
    {
        if (!$subjectRaw) return null;
        $raw = strtoupper(trim($subjectRaw));

        // Exact match
        $match = $subjects->first(fn ($s) => strtoupper(trim($s->name)) === $raw);
        if ($match) return $match;

        // Substring match
        $match = $subjects->first(
            fn ($s) => stripos($s->name, $raw) !== false || stripos($raw, $s->name) !== false
        );
        if ($match) return $match;

        // Check significant words (>= 4 chars)
        $words = array_filter(explode(' ', $raw), fn ($w) => strlen($w) >= 4);
        foreach ($words as $word) {
            $match = $subjects->first(fn ($s) => stripos($s->name, $word) !== false);
            if ($match) return $match;
        }

        return null;
    }

    protected function findRoom($rooms, ?string $roomCode): ?Rooms
    {
        if (!$roomCode) return null;
        $code = strtoupper(trim($roomCode));

        // 1. Exact match
        $match = $rooms->first(fn ($r) => strtoupper(trim($r->name)) === $code);
        if ($match) return $match;

        // 2. Numeric room (e.g. "12" -> "Ruang 12", "Ruang Teori 12")
        if (is_numeric($code)) {
            $numMatch = $rooms->first(function ($r) use ($code) {
                $rName = strtoupper($r->name);
                return preg_match('/(?:RUANG(?:\s+TEORI)?\s+|^)' . preg_quote($code, '/') . '$/i', $rName);
            });
            if ($numMatch) return $numMatch;
        }

        // 3. Lab with number (e.g. "L.16", "LAB 16" -> "Lab Komputer 16", "L.16")
        if (preg_match('/^(?:LAB\.?|L\.)\s*(\d+)$/i', $code, $m)) {
            $num = $m[1];
            $labMatch = $rooms->first(function ($r) use ($num) {
                $rName = strtoupper($r->name);
                return preg_match('/(?:LAB(?:ORATORIUM)?(?:\s+KOMPUTER)?|L\.?)\s*' . $num . '$/i', $rName);
            });
            if ($labMatch) return $labMatch;
        }

        // 4. Special rooms
        if (in_array($code, ['OR', 'OR1', 'OR2', 'OR3', 'LAPANGAN'])) {
            $orMatch = $rooms->first(fn ($r) => preg_match('/(?:OR|LAPANGAN)/i', $r->name));
            if ($orMatch) return $orMatch;
        }

        if (in_array($code, ['L.IPA', 'LAB IPA', 'LAB.IPA'])) {
            $ipaMatch = $rooms->first(fn ($r) => preg_match('/(?:IPA)/i', $r->name));
            if ($ipaMatch) return $ipaMatch;
        }

        if (in_array($code, ['L.PB', 'LAB PB', 'LAB.PB'])) {
            $pbMatch = $rooms->first(fn ($r) => preg_match('/(?:PB|PENATAAN)/i', $r->name));
            if ($pbMatch) return $pbMatch;
        }

        if (in_array($code, ['HALL'])) {
            $hallMatch = $rooms->first(fn ($r) => preg_match('/(?:HALL|MENARI)/i', $r->name));
            if ($hallMatch) return $hallMatch;
        }

        // 5. Fallback substring
        return $rooms->first(
            fn ($r) => stripos($r->name, $code) !== false || stripos($code, $r->name) !== false
        );
    }
}
