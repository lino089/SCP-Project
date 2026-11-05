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
use App\Models\Room;
use App\Models\Classes;
use App\Models\Schedule;
use App\Services\ScheduleConflictService;
use App\Services\TeacherMatcherService;
use Symfony\Component\Process\Process;
use Illuminate\Support\Facades\DB;
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

        if (!empty($process->getErrorOutput())) {
            Log::info('Python Parser Warnings: ' . $process->getErrorOutput());
        }

        $outputString = $process->getOutput();
        $parseData = json_decode($outputString, true);

        if (!is_array($parseData)) {
            $import->update(['status' => 'failed']);
            Log::error('Python Parser Output is not valid JSON array.');
            return;
        }

        // Auto-register Master Data (Rooms, Subjects, Fallback Classes)
        $this->autoRegisterMasterData($parseData);

        // Preload / Reload master data to ensure all newly registered entities are in-memory
        $allClasses = Classes::all();
        $allTeachers = User::where('role', 'teacher')->get();
        $allSubjects = Subject::all();
        $allRooms = Room::all();

        // Ensure clean state if import is re-parsed
        $import->rows()->delete();

        $conflictService = new ScheduleConflictService();

        // Identify all classes present in this import batch (schedules of these classes are being replaced/updated)
        $batchClassIds = [];
        foreach ($parseData as $row) {
            $cls = $this->findClass($allClasses, $row['kelas_mentah'] ?? null);
            if ($cls) {
                $batchClassIds[$cls->id] = $cls->id;
            }
        }
        $batchClassIds = array_values($batchClassIds);

        // Track intra-batch slots for conflict detection: key = "day-period"
        $batchSlots = [];
        $teacherMatcher = new TeacherMatcherService();

        foreach ($parseData as $row) {
            $matchedClass = $this->findClass($allClasses, $row['kelas_mentah'] ?? null);
            
            $rawTeacher = $row['guru_mentah'] ?? $row['teacher'] ?? null;
            $teacherResult = $teacherMatcher->match($allTeachers, $rawTeacher);
            $matchedTeacher = $teacherResult['matched_teacher'];
            if (!empty($teacherResult['candidates'])) {
                $row['teacher_candidates'] = $teacherResult['candidates'];
            }

            $teacherForSubject = $matchedTeacher ?? (!empty($teacherResult['candidates']) ? $allTeachers->firstWhere('id', $teacherResult['candidates'][0]['id']) : null);
            $matchedSubject = $this->findSubject($allSubjects, $row['mapel_mentah'] ?? null, $teacherForSubject);
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
                $isSharedRoom = ScheduleConflictService::isSharedRoom($matchedRoom);

                // 1. Check intra-batch collisions
                for ($p = $startPeriod; $p <= $endPeriod; $p++) {
                    $slotKey = "{$day}-{$p}";
                    if (isset($batchSlots[$slotKey])) {
                        if (
                            in_array($matchedTeacher->id, $batchSlots[$slotKey]['teachers'] ?? []) ||
                            in_array($matchedClass->id, $batchSlots[$slotKey]['classes'] ?? []) ||
                            (!$isSharedRoom && in_array($matchedRoom->id, $batchSlots[$slotKey]['rooms'] ?? []))
                        ) {
                            $hasConflict = true;
                            break;
                        }
                    }
                }

                // 2. Check collisions against existing schedules on same cycle_type
                // Note: Existing schedules belonging to classes in $batchClassIds are being replaced/updated
                // by this import, so they are excluded to allow valid schedule updates without false-positive conflicts.
                if (!$hasConflict) {
                    $existingConflicts = $conflictService->findConflicts([
                        'teacher_id' => $matchedTeacher->id,
                        'class_id' => $matchedClass->id,
                        'room_id' => $matchedRoom->id,
                        'cycle_type' => $import->cycle_type,
                        'day_of_week' => $day,
                        'period_number' => $startPeriod,
                        'duration_periods' => $duration,
                    ], ignoreClassIds: $batchClassIds);

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
                        if (!isset($batchSlots[$slotKey])) {
                            $batchSlots[$slotKey] = ['teachers' => [], 'classes' => [], 'rooms' => []];
                        }
                        $batchSlots[$slotKey]['teachers'][] = $matchedTeacher->id;
                        $batchSlots[$slotKey]['classes'][] = $matchedClass->id;
                        if (!$isSharedRoom) {
                            $batchSlots[$slotKey]['rooms'][] = $matchedRoom->id;
                        }
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
        if (!$teacherRaw) return null;
        $matcher = new TeacherMatcherService();
        return $matcher->match($teachers, $teacherRaw)['matched_teacher'];
    }

    protected function findSubject($subjects, ?string $subjectRaw, ?User $matchedTeacher = null): ?Subject
    {
        if (!$subjectRaw) return null;
        $raw = strtoupper(trim($subjectRaw));

        // 1. Exact match
        $match = $subjects->first(fn ($s) => strtoupper(trim($s->name)) === $raw);
        if ($match) return $match;

        // 2. Canonical Subject Dictionary / Aliases
        $canonicalMap = [
            'PENDIDIKAN JASMANI, OLAHRAGA DAN KESEHATAN' => 'PJOK',
            'PENDIDIKAN JASMANI OLAHRAGA DAN KESEHATAN' => 'PJOK',
            'PENDIDIKAN JASMANI' => 'PJOK',
            'PENJASORKES' => 'PJOK',
            'PENJAS' => 'PJOK',
            'PENDIDIKAN PANCASILA DAN KEWARGANEGARAAN' => 'PENDIDIKAN PANCASILA',
            'PPKN' => 'PENDIDIKAN PANCASILA',
            'BIMBINGAN DAN KONSELING' => 'BIMBINGAN KONSELING',
            'BK' => 'BIMBINGAN KONSELING',
            'BAHASA JAWA' => 'MULOK BAHASA JAWA',
            'PROJEK IPAS' => 'IPAS',
            'ILMU PENGETAHUAN ALAM DAN SOSIAL' => 'IPAS',
            'SENI MUSIK' => 'SENI BUDAYA',
        ];

        // Penanganan khusus mapel agama berdasarkan guru pengampu
        if (preg_match('/^PENDIDIKAN AGAMA/i', $raw) || preg_match('/^PEND\.?\s*AGAMA/i', $raw)) {
            $isCatholic = false;
            if ($matchedTeacher) {
                $tName = strtoupper($matchedTeacher->name);
                if (stripos($tName, 'KRISTIANI') !== false || stripos($tName, 'RETNO') !== false) {
                    $isCatholic = true;
                }
            }
            $targetAgama = $isCatholic ? 'PEND. AG. KATHOLIK' : 'PEND. AG. ISLAM';
            $agamaMatch = $subjects->first(fn ($s) => strtoupper(trim($s->name)) === $targetAgama);
            if ($agamaMatch) return $agamaMatch;
        }

        if (isset($canonicalMap[$raw])) {
            $targetName = $canonicalMap[$raw];
            $match = $subjects->first(fn ($s) => strtoupper(trim($s->name)) === $targetName);
            if ($match) return $match;
        }

        // 3. Strict Phrase Substring Match (whole phrase containment, min 4 chars)
        // Mencegah generic words seperti "PENDIDIKAN" atau "DDPK" memicu false match ke mapel lain
        $match = $subjects->first(function ($s) use ($raw) {
            $sName = strtoupper(trim($s->name));
            if ($sName === '' || $raw === '') return false;
            if (in_array($sName, ['PENDIDIKAN', 'PRODUKTIF', 'DDPK', 'KK', 'MAPEL'])) {
                return false;
            }
            return (stripos($sName, $raw) !== false || stripos($raw, $sName) !== false);
        });
        if ($match) return $match;

        return null;
    }

    protected function findRoom($rooms, ?string $roomCode): ?Room
    {
        if (!$roomCode) return null;
        $code = strtoupper(trim($roomCode));

        // 1. Exact match
        $match = $rooms->first(fn ($r) => strtoupper(trim($r->name)) === $code);
        if ($match) return $match;

        // 2. Numeric room (e.g. "12" -> "Ruang 12", "Ruang Teori 12", "R. 12")
        // CRITICAL: Numeric rooms must NEVER match lab rooms (e.g. "16" must NOT match "L.16")
        if (is_numeric($code)) {
            $numMatch = $rooms->first(function ($r) use ($code) {
                $rName = strtoupper(trim($r->name));
                if (preg_match('/^(?:LAB|L\.)/i', $rName)) {
                    return false;
                }
                return preg_match('/^(?:RUANG(?:\s+TEORI)?|R\.?)\s*' . preg_quote($code, '/') . '$/i', $rName)
                    || $rName === $code;
            });
            if ($numMatch) return $numMatch;

            // Pure numeric code with no exact/theory match must NOT fall through to substring matching
            return null;
        }

        // 3. Lab with number (e.g. "L.16", "LAB 16" -> "Lab Komputer 16", "L.16")
        // CRITICAL: Lab rooms must NEVER match pure numeric rooms
        if (preg_match('/^(?:LAB\.?|L\.)\s*(\d+)$/i', $code, $m)) {
            $num = $m[1];
            $labMatch = $rooms->first(function ($r) use ($num) {
                $rName = strtoupper(trim($r->name));
                return preg_match('/^(?:LAB(?:ORATORIUM)?(?:\s+KOMPUTER)?|L\.?)\s*' . $num . '$/i', $rName);
            });
            if ($labMatch) return $labMatch;

            // Lab code with no matching lab room must NOT fall through to match a theory room
            return null;
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

        // 5. Fallback substring (only for descriptive names, avoiding lab vs numeric cross-matches)
        return $rooms->first(function ($r) use ($code) {
            $rName = strtoupper(trim($r->name));
            if (is_numeric($code) || is_numeric($rName)) {
                return false;
            }
            if (preg_match('/^(?:LAB|L\.)/i', $code) xor preg_match('/^(?:LAB|L\.)/i', $rName)) {
                return false;
            }
            return stripos($rName, $code) !== false || stripos($code, $rName) !== false;
        });
    }

    /**
     * Pra-registrasi otomatis master data (Rooms, Subject, Classes) dari berkas PDF.
     */
    public function autoRegisterMasterData(array $parseData): void
    {
        DB::transaction(function () use ($parseData) {
            $this->autoRegisterRooms($parseData);
            $this->autoRegisterSubjects($parseData);
            $this->autoRegisterClasses($parseData);
        });
    }

    /**
     * Auto-create Room fisik unik dengan kapasitas default 36.
     */
    public function autoRegisterRooms(array $parseData): void
    {
        $existingRooms = Room::all();

        $uniqueRooms = collect($parseData)
            ->map(function ($row) {
                $code = $row['ruang_final'] ?? $row['ruang_kelas'] ?? null;
                return $code ? trim((string) $code) : null;
            })
            ->filter(fn ($code) => !empty($code))
            ->unique();

        foreach ($uniqueRooms as $roomCode) {
            // Periksa via findRoom untuk mencegah duplikasi (misal "12" vs "Ruang 12")
            if (!$this->findRoom($existingRooms, $roomCode)) {
                $newRoom = Room::create([
                    'name' => $roomCode,
                    'capacity' => 36,
                ]);
                $existingRooms->push($newRoom);
            }
        }
    }

    /**
     * Auto-create Subject unik dari data parsing PDF.
     */
    public function autoRegisterSubjects(array $parseData): void
    {
        $existingSubjects = Subject::all();

        $blacklistedPlaceholders = ['-x-', '---', '-', 'null', 'none'];

        $uniqueSubjects = collect($parseData)
            ->map(fn ($row) => isset($row['mapel_mentah']) ? trim((string) $row['mapel_mentah']) : null)
            ->filter(function ($subject) use ($blacklistedPlaceholders) {
                if (empty($subject)) {
                    return false;
                }
                return !in_array(strtolower($subject), $blacklistedPlaceholders);
            })
            ->unique();

        foreach ($uniqueSubjects as $subjectName) {
            // Periksa via findSubject untuk mencegah duplikasi
            if (!$this->findSubject($existingSubjects, $subjectName)) {
                $newSubject = Subject::create([
                    'name' => $subjectName,
                ]);
                $existingSubjects->push($newSubject);
            }
        }
    }

    /**
     * Fallback auto-create Classes unik dari data parsing PDF.
     */
    public function autoRegisterClasses(array $parseData): void
    {
        $existingClasses = Classes::all();

        $uniqueClasses = collect($parseData)
            ->map(fn ($row) => isset($row['kelas_mentah']) ? trim(preg_replace('/\s+/', ' ', (string) $row['kelas_mentah'])) : null)
            ->filter(fn ($class) => !empty($class))
            ->unique();

        foreach ($uniqueClasses as $cleanClassName) {
            // Periksa via findClass untuk mencegah duplikasi
            if (!$this->findClass($existingClasses, $cleanClassName)) {
                // Deteksi level kelas (selaras dengan Fase 4 di StudentController)
                if (preg_match('/^XII(\s|-|_|$)/i', $cleanClassName)) {
                    $level = '12';
                } elseif (preg_match('/^XI(\s|-|_|$)/i', $cleanClassName)) {
                    $level = '11';
                } elseif (preg_match('/^X(\s|-|_|$)/i', $cleanClassName)) {
                    $level = '10';
                } elseif (preg_match('/^12(\s|-|_|$)/', $cleanClassName)) {
                    $level = '12';
                } elseif (preg_match('/^11(\s|-|_|$)/', $cleanClassName)) {
                    $level = '11';
                } elseif (preg_match('/^10(\s|-|_|$)/', $cleanClassName)) {
                    $level = '10';
                } else {
                    $level = '10'; // Fallback default
                }

                $newClass = Classes::create([
                    'name' => $cleanClassName,
                    'level' => $level,
                    'next_class_id' => null,
                ]);
                $existingClasses->push($newClass);
            }
        }
    }
}
