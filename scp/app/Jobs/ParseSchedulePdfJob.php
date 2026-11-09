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

        try {
            $import->update(['status' => 'parsing', 'error_message' => null]);

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
                $errOut = $process->getErrorOutput() ?: 'Format berkas PDF tidak dapat diekstraksi.';
                $import->update([
                    'status' => 'failed',
                    'error_message' => 'Gagal mengekstrak PDF FET: ' . trim($errOut),
                ]);
                Log::error('Python Parser Error: ' . $errOut);
                return;
            }

            if (!empty($process->getErrorOutput())) {
                Log::info('Python Parser Warnings: ' . $process->getErrorOutput());
            }

            $outputString = $process->getOutput();
            $parseData = json_decode($outputString, true);

            if (!is_array($parseData)) {
                $import->update([
                    'status' => 'failed',
                    'error_message' => 'Hasil ekstraksi PDF tidak valid (bukan array jadwal JSON).',
                ]);
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

            // Preload existing schedules in-memory to prevent N+1 queries in the loop
            $existingSchedules = Schedule::query()
                ->where('cycle_type', $import->cycle_type)
                ->when(!empty($batchClassIds), fn ($q) => $q->whereNotIn('class_id', $batchClassIds))
                ->with([
                    'teacher:id,name',
                    'class:id,name',
                    'room:id,name',
                    'subject:id,name',
                ])
                ->get(['id', 'teacher_id', 'class_id', 'room_id', 'subject_id', 'cycle_type', 'day_of_week', 'period_number', 'duration_periods']);

            $teacherMatcher = new TeacherMatcherService();

            // ==========================================
            // PASS 1: Entity Resolution & Global Batch Slot Gathering
            // ==========================================
            $preparedRows = [];
            $globalBatchSlots = [];
            $classTheoryRoomCounts = [];

            foreach ($parseData as $idx => $row) {
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

                // Track theory room count per class to discover the class Home Room
                if ($matchedClass && $matchedRoom && ScheduleConflictService::getRoomCategory($matchedRoom->name) === 'theory') {
                    $cId = $matchedClass->id;
                    $rId = $matchedRoom->id;
                    $classTheoryRoomCounts[$cId][$rId] = ($classTheoryRoomCounts[$cId][$rId] ?? 0) + 1;
                }

                $preparedRows[$idx] = [
                    'row' => $row,
                    'matched_class' => $matchedClass,
                    'matched_teacher' => $matchedTeacher,
                    'matched_subject' => $matchedSubject,
                    'matched_room' => $matchedRoom,
                    'day' => $day,
                    'start_period' => $startPeriod,
                    'duration' => $duration,
                    'end_period' => $endPeriod,
                    'room_source_conflict' => $roomSourceConflict,
                    'raw_teacher' => $rawTeacher,
                ];

                // Register into globalBatchSlots
                $isSharedRoom = ScheduleConflictService::isSharedRoom($matchedRoom);
                for ($p = $startPeriod; $p <= $endPeriod; $p++) {
                    $slotKey = "{$day}-{$p}";
                    if (!isset($globalBatchSlots[$slotKey])) {
                        $globalBatchSlots[$slotKey] = ['teachers' => [], 'classes' => [], 'rooms' => [], 'entries' => []];
                    }
                    if ($matchedTeacher) $globalBatchSlots[$slotKey]['teachers'][] = $matchedTeacher->id;
                    if ($matchedClass) $globalBatchSlots[$slotKey]['classes'][] = $matchedClass->id;
                    if ($matchedRoom && !$isSharedRoom) {
                        $globalBatchSlots[$slotKey]['rooms'][] = $matchedRoom->id;
                    }
                    $globalBatchSlots[$slotKey]['entries'][] = [
                        'row_index' => $idx,
                        'teacher_id' => $matchedTeacher?->id,
                        'teacher_name' => $matchedTeacher?->name ?? $row['guru_mentah'] ?? 'Guru',
                        'class_id' => $matchedClass?->id,
                        'class_name' => $matchedClass?->name ?? $row['kelas_mentah'] ?? 'Kelas',
                        'room_id' => $matchedRoom?->id,
                        'room_name' => $matchedRoom?->name ?? $row['ruang_final'] ?? 'Ruangan',
                        'subject_name' => $matchedSubject?->name ?? $row['mapel_mentah'] ?? 'Mata Pelajaran',
                    ];
                }
            }

            // Identify dominant Home Room for each class
            $classHomeRooms = [];
            foreach ($classTheoryRoomCounts as $cId => $counts) {
                arsort($counts);
                $topRoomId = array_key_first($counts);
                $classHomeRooms[$cId] = $allRooms->firstWhere('id', $topRoomId);
            }

            // ==========================================
            // PASS 2: Collision Detection, Recommendation Generation & Row Creation
            // ==========================================
            foreach ($preparedRows as $idx => $prep) {
                $row = $prep['row'];
                $matchedClass = $prep['matched_class'];
                $matchedTeacher = $prep['matched_teacher'];
                $matchedSubject = $prep['matched_subject'];
                $matchedRoom = $prep['matched_room'];
                $day = $prep['day'];
                $startPeriod = $prep['start_period'];
                $duration = $prep['duration'];
                $endPeriod = $prep['end_period'];
                $roomSourceConflict = $prep['room_source_conflict'];
                $rawTeacher = $prep['raw_teacher'];

                // Build batchSlots for this row by excluding entries belonging to this exact row index
                $batchSlots = [];
                for ($p = $startPeriod; $p <= $endPeriod; $p++) {
                    $slotKey = "{$day}-{$p}";
                    if (isset($globalBatchSlots[$slotKey])) {
                        $slot = $globalBatchSlots[$slotKey];
                        $filteredEntries = array_values(array_filter($slot['entries'], fn ($e) => ($e['row_index'] ?? null) !== $idx));
                        $batchSlots[$slotKey] = [
                            'teachers' => array_column($filteredEntries, 'teacher_id'),
                            'classes' => array_column($filteredEntries, 'class_id'),
                            'rooms' => array_column($filteredEntries, 'room_id'),
                            'entries' => $filteredEntries,
                        ];
                    }
                }

                $hasMissingEntity = !$matchedClass || !$matchedTeacher || !$matchedSubject || !$matchedRoom;
                $issueDetail = null;
                $recommendations = null;

                if ($hasMissingEntity || $roomSourceConflict) {
                    $matchStatus = 'unmatched';

                    if ($roomSourceConflict) {
                        $roomKelasObj = $this->findRoom($allRooms, $row['ruang_kelas'] ?? null);
                        $roomJadwalObj = $this->findRoom($allRooms, $row['ruang_jadwal'] ?? null);
                        $diag = $conflictService->diagnoseRoomSourceConflict(
                            $roomKelasObj,
                            $roomJadwalObj,
                            $day,
                            $startPeriod,
                            $duration,
                            $existingSchedules,
                            $batchSlots
                        );
                        $altRooms = $conflictService->findAlternativeRooms(
                            $day,
                            $startPeriod,
                            $duration,
                            $allRooms,
                            $existingSchedules,
                            $batchSlots,
                            $matchedRoom ?? $roomJadwalObj ?? $roomKelasObj
                        );
                        $issueDetail = [
                            'type' => 'room_source_conflict',
                            'title' => 'Ketidaksinkronan Alokasi Ruang',
                            'description' => "Terdapat perbedaan alokasi ruang antara PDF Jadwal Kelas ('" . ($row['ruang_kelas'] ?? '-') . "') dan PDF Matriks Ruangan ('" . ($row['ruang_jadwal'] ?? '-') . "'). " . $diag['recommendation_text'],
                            'data' => $diag,
                        ];
                        $recommendations = [
                            'room_source_options' => $diag,
                            'alternative_rooms' => $altRooms,
                            'action_hint' => 'Pilih salah satu ruangan yang valid (PDF Ruangan atau PDF Kelas) atau gunakan ruangan alternatif.',
                        ];
                    } elseif (!$matchedTeacher) {
                        $issueDetail = [
                            'type' => 'missing_teacher',
                            'title' => 'Guru Belum Terdaftar / Tidak Cocok',
                            'description' => "Nama atau inisial guru '" . ($rawTeacher ?: 'Kosong') . "' tidak cocok dengan master data guru aktif di sistem.",
                        ];
                        $recommendations = [
                            'teacher_candidates' => $row['teacher_candidates'] ?? [],
                            'action_hint' => 'Pilih salah satu kandidat guru yang sesuai, atau daftarkan guru baru di Master Data.',
                        ];
                    } elseif (!$matchedClass) {
                        $issueDetail = [
                            'type' => 'missing_class',
                            'title' => 'Kelas Tidak Dikenali',
                            'description' => "Kode kelas '" . ($row['kelas_mentah'] ?? '-') . "' tidak ditemukan di master data kelas.",
                        ];
                        $recommendations = [
                            'action_hint' => 'Sesuaikan kelas ke salah satu kelas master data atau buat kelas baru di Master Data.',
                        ];
                    } elseif (!$matchedSubject) {
                        $issueDetail = [
                            'type' => 'missing_subject',
                            'title' => 'Mata Pelajaran Belum Terpetakan',
                            'description' => "Mata pelajaran '" . ($row['mapel_mentah'] ?? '-') . "' tidak dapat dipetakan secara otomatis.",
                        ];
                        $recommendations = [
                            'action_hint' => 'Pilih mata pelajaran yang sesuai dari dropdown resolusi.',
                        ];
                    } elseif (!$matchedRoom) {
                        $issueDetail = [
                            'type' => 'missing_room',
                            'title' => 'Ruangan Belum Terdaftar',
                            'description' => "Ruangan '" . ($row['ruang_final'] ?? '-') . "' tidak ditemukan di sistem.",
                        ];
                        $altRooms = $conflictService->findAlternativeRooms(
                            $day,
                            $startPeriod,
                            $duration,
                            $allRooms,
                            $existingSchedules,
                            $batchSlots
                        );
                        $recommendations = [
                            'alternative_rooms' => $altRooms,
                            'action_hint' => 'Pilih salah satu ruangan alternatif yang tersedia.',
                        ];
                    }
                } else {
                    // Anti-collision checking: intra-batch and existing schedules
                    $hasConflict = false;
                    $isSharedRoom = ScheduleConflictService::isSharedRoom($matchedRoom);

                    // 1. Check intra-batch collisions against all other rows in globalBatchSlots
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

                    // 2. Check collisions against existing schedules on same cycle_type using In-Memory lookup
                    if (!$hasConflict) {
                        $hasConflict = $conflictService->hasConflictInMemory($existingSchedules, [
                            'teacher_id' => $matchedTeacher->id,
                            'class_id' => $matchedClass->id,
                            'room_id' => $matchedRoom->id,
                            'cycle_type' => $import->cycle_type,
                            'day_of_week' => $day,
                            'period_number' => $startPeriod,
                            'duration_periods' => $duration,
                        ]);
                    }

                    if ($hasConflict) {
                        $matchStatus = 'conflict';
                        $conflictInfo = $conflictService->findConflictDetailsInMemory($existingSchedules, [
                            'teacher_id' => $matchedTeacher->id,
                            'teacher_name' => $matchedTeacher->name,
                            'class_id' => $matchedClass->id,
                            'class_name' => $matchedClass->name,
                            'room_id' => $matchedRoom->id,
                            'room_name' => $matchedRoom->name,
                            'cycle_type' => $import->cycle_type,
                            'day_of_week' => $day,
                            'period_number' => $startPeriod,
                            'duration_periods' => $duration,
                        ], $batchSlots);

                        $issueDetail = $conflictInfo ?? [
                            'type' => 'conflict',
                            'title' => 'Konflik Jadwal',
                            'description' => "Jadwal ini bertabrakan dengan jadwal lain pada hari " . ScheduleConflictService::getDayName($day) . " Jam Ke-{$startPeriod}.",
                        ];

                        $recommendations = [];
                        if (($conflictInfo['type'] ?? '') === 'room_collision') {
                            // Check if class has Home Room to provide document comparison option
                            $homeRoom = $matchedClass ? ($classHomeRooms[$matchedClass->id] ?? null) : null;
                            if ($homeRoom && (int) $homeRoom->id !== (int) $matchedRoom->id) {
                                $diag = $conflictService->diagnoseRoomSourceConflict(
                                    $homeRoom,
                                    $matchedRoom,
                                    $day,
                                    $startPeriod,
                                    $duration,
                                    $existingSchedules,
                                    $batchSlots,
                                    'Ruang Pangkalan Rombel',
                                    'PDF Matriks Ruang'
                                );
                                $recommendations['room_source_options'] = $diag;
                                $issueDetail['data'] = $diag;
                            }

                            $altRooms = $conflictService->findAlternativeRooms(
                                $day,
                                $startPeriod,
                                $duration,
                                $allRooms,
                                $existingSchedules,
                                $batchSlots,
                                $matchedRoom
                            );
                            $recommendations['alternative_rooms'] = $altRooms;
                            $recommendations['action_hint'] = count($altRooms) > 0
                                ? 'Pilih salah satu ruangan alternatif yang terbukti kosong di bawah ini.'
                                : 'Tidak ada ruangan alternatif kosong pada jam ini. Pertimbangkan untuk memindahkan jam/hari pelajaran.';
                        } elseif (($conflictInfo['type'] ?? '') === 'teacher_collision') {
                            $recommendations['action_hint'] = 'Guru pengampu memiliki jadwal mengajar paralel di kelas lain pada jam yang sama. Sesuaikan jadwal guru atau ganti guru pengampu.';
                        } elseif (($conflictInfo['type'] ?? '') === 'class_collision') {
                            $recommendations['action_hint'] = 'Kelas ini sudah memiliki jadwal KBM lain pada jam tersebut. Sesuaikan alokasi jam pelajaran kelas.';
                        }
                    } else {
                        $matchStatus = 'matched';
                    }
                }

                if ($issueDetail) {
                    $row['issue_detail'] = $issueDetail;
                }
                if ($recommendations) {
                    $row['recommendations'] = $recommendations;
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

            $import->update([
                'status' => 'preview_ready',
                'error_message' => null,
            ]);
        } catch (\Throwable $e) {
            Log::error("Schedule import {$this->importId} failed: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            $import->update([
                'status' => 'failed',
                'error_message' => 'Gagal memproses berkas PDF: ' . $e->getMessage(),
            ]);
        }
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
        return ScheduleConflictService::findRoom($rooms, $roomCode);
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
