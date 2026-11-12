<?php

namespace App\Services;

use App\Models\Classes;
use App\Models\CurriculumTeachingAssignment;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\ScheduleGenerationBatch;
use App\Models\ScheduleGenerationDraft;
use App\Models\Subject;
use App\Models\SystemConfiguration;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ScheduleGeneratorService
{
    private array $sharedRooms = [];
    private array $allRoomIds = [];
    private array $theoryRoomIds = [];
    private array $labRoomIds = [];
    private array $fieldRoomIds = [];
    private bool $roomsLoaded = false;

    public function __construct()
    {
        // Constructor dibuat ringan untuk instansiasi cepat via Dependency Injection
    }

    /**
     * Memuat dan mengkategorikan ruangan secara lazy (hanya saat proses solve berjalan).
     */
    private function ensureRoomsLoaded(): void
    {
        if ($this->roomsLoaded) {
            return;
        }

        $rooms = Room::all();
        foreach ($rooms as $r) {
            $this->allRoomIds[] = $r->id;
            $this->sharedRooms[$r->id] = ScheduleConflictService::isSharedRoom($r);
            if ($r->type === 'theory') {
                $this->theoryRoomIds[] = $r->id;
            } elseif (in_array($r->type, ['lab_computer', 'lab_science'])) {
                $this->labRoomIds[] = $r->id;
            } elseif ($r->type === 'field') {
                $this->fieldRoomIds[] = $r->id;
            }
        }

        $this->roomsLoaded = true;
    }

    /**
     * Memeriksa kondisi jadwal aktif pada putaran target (apakah kosong atau sudah terisi).
     */
    public function checkTargetCyclesState(array $targetCycles): array
    {
        $result = [];
        foreach ($targetCycles as $cycle) {
            $count = Schedule::where('cycle_type', $cycle)->count();
            $result[$cycle] = [
                'cycle' => (int) $cycle,
                'is_empty' => $count === 0,
                'active_schedules_count' => $count,
            ];
        }
        return $result;
    }

    /**
     * Menjalankan proses generate otomatis untuk putaran yang dipilih.
     */
    public function generate(array $targetCycles, int $userId): ScheduleGenerationBatch
    {
        $startTime = microtime(true);
        $batchUuid = (string) Str::uuid();

        $batch = ScheduleGenerationBatch::create([
            'batch_uuid' => $batchUuid,
            'user_id' => $userId,
            'target_cycles' => array_map('intval', $targetCycles),
            'status' => 'processing',
            'total_classes_processed' => 0,
            'total_slots_generated' => 0,
            'execution_time_seconds' => 0,
        ]);

        try {
            $allGeneratedDrafts = [];
            $processedClassesSet = [];

            foreach ($targetCycles as $cycle) {
                $cycleInt = (int) $cycle;
                $cycleDrafts = $this->solveCycle($cycleInt);

                foreach ($cycleDrafts as $draft) {
                    $draft['batch_id'] = $batch->id;
                    $draft['created_at'] = now();
                    $draft['updated_at'] = now();
                    $allGeneratedDrafts[] = $draft;
                    $processedClassesSet[$draft['class_id']] = true;
                }
            }

            // Insert drafts in chunks of 200
            foreach (array_chunk($allGeneratedDrafts, 200) as $chunk) {
                ScheduleGenerationDraft::insert($chunk);
            }

            $executionTime = round(microtime(true) - $startTime, 3);

            $batch->update([
                'status' => 'completed',
                'total_classes_processed' => count($processedClassesSet),
                'total_slots_generated' => count($allGeneratedDrafts),
                'execution_time_seconds' => $executionTime,
            ]);

            return $batch->fresh();
        } catch (\Throwable $e) {
            $batch->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'execution_time_seconds' => round(microtime(true) - $startTime, 3),
            ]);
            throw $e;
        }
    }

    /**
     * Menyelesaikan penjadwalan CSP bebas bentrok (Zero-Conflict) untuk satu siklus (putaran).
     */
    public function solveCycle(int $cycle): array
    {
        $this->ensureRoomsLoaded();

        $cycleKey = "cycle_{$cycle}";
        $assignments = CurriculumTeachingAssignment::with(['subject', 'preferredRoom', 'schoolClass'])
            ->where(function ($q) use ($cycleKey) {
                $q->where('preferred_cycle', $cycleKey)
                    ->orWhere('preferred_cycle', 'both')
                    ->orWhere('preferred_cycle', 'auto');
            })
            ->get();

        // 1. Identifikasi base theory room per kelas
        $classBaseRoom = [];
        foreach ($assignments as $a) {
            if ($a->subject?->category === 'normada' && $a->preferred_room_id) {
                $classBaseRoom[$a->class_id] = $a->preferred_room_id;
            }
        }

        // 2. Hitung beban mengajar per guru untuk MRV Heuristic
        $teacherLoad = [];
        $teacherJurusanLoad = [];
        foreach ($assignments as $a) {
            $teacherLoad[$a->teacher_id] = ($teacherLoad[$a->teacher_id] ?? 0) + $a->total_jp;
            if ($a->subject?->category === 'jurusan') {
                $teacherJurusanLoad[$a->teacher_id] = ($teacherJurusanLoad[$a->teacher_id] ?? 0) + $a->total_jp;
            }
        }

        // 3. Dekomposisi blok modular cerdas sesuai standar KBM SMK Negeri 1 Bantul (Anti-Fragmentasi)
        $blocks = [];
        $bId = 1;
        foreach ($assignments as $a) {
            $cat = $a->subject?->category ?? 'normada';
            $name = strtoupper(trim($a->subject?->name ?? ''));
            $rem = $a->total_jp;
            $tJurLoad = $teacherJurusanLoad[$a->teacher_id] ?? 0;
            $durs = [];

            if ($cat === 'jurusan') {
                // Guru kejuruan dengan beban > 24 JP membutuhkan modular 4 JP agar muat di hari 10 JP bersama kelas lain
                if ($tJurLoad > 24 && $rem === 12) {
                    $durs = [4, 4, 4];
                    $rem = 0;
                } elseif ($rem >= 12) {
                    while ($rem >= 12) { $durs[] = 6; $rem -= 6; }
                }
                while ($rem > 0) {
                    if ($rem >= 10) { $durs[] = 6; $durs[] = 4; $rem -= 10; }
                    elseif ($rem >= 8) { $durs[] = 4; $durs[] = 4; $rem -= 8; }
                    elseif ($rem >= 6) { $durs[] = 6; $rem -= 6; }
                    elseif ($rem === 5) { $durs[] = 5; $rem = 0; }
                    elseif ($rem >= 4) { $durs[] = 4; $rem -= 4; }
                    elseif ($rem === 3) { $durs[] = 3; $rem = 0; }
                    elseif ($rem === 2) { $durs[] = 2; $rem = 0; }
                    else { $durs[] = $rem; $rem = 0; }
                }
            } else {
                if (str_contains($name, 'INFORMATIKA') || str_contains($name, 'IPAS')) {
                    while ($rem > 0) {
                        if ($rem >= 8) { $durs[] = 4; $rem -= 4; }
                        elseif ($rem === 6) { $durs[] = 3; $durs[] = 3; $rem = 0; }
                        elseif ($rem === 5) { $durs[] = 3; $durs[] = 2; $rem = 0; }
                        elseif ($rem >= 4) { $durs[] = 4; $rem -= 4; }
                        elseif ($rem === 3) { $durs[] = 3; $rem = 0; }
                        elseif ($rem === 2) { $durs[] = 2; $rem = 0; }
                        else { $durs[] = $rem; $rem = 0; }
                    }
                } elseif (str_contains($name, 'KEWIRAUSAHAAN') || str_contains($name, 'KREATIFITAS') || str_contains($name, 'PKK')) {
                    while ($rem > 0) {
                        if ($rem >= 6) { $durs[] = 3; $durs[] = 3; $rem -= 6; }
                        elseif ($rem === 5) { $durs[] = 3; $durs[] = 2; $rem = 0; }
                        elseif ($rem >= 4) { $durs[] = 4; $rem -= 4; }
                        elseif ($rem === 3) { $durs[] = 3; $rem = 0; }
                        elseif ($rem === 2) { $durs[] = 2; $rem = 0; }
                        else { $durs[] = $rem; $rem = 0; }
                    }
                } else {
                    if ($rem === 8) { $durs = [3, 3, 2]; $rem = 0; }
                    elseif ($rem === 6) { $durs = [3, 3]; $rem = 0; }
                    elseif ($rem === 4) { $durs = [2, 2]; $rem = 0; }
                    elseif ($rem === 5) { $durs = [3, 2]; $rem = 0; }
                    elseif ($rem === 3) { $durs = [3]; $rem = 0; }
                    elseif ($rem === 2) { $durs = [2]; $rem = 0; }
                    elseif ($rem === 1) { $durs = [1]; $rem = 0; }
                    else {
                        while ($rem > 0) {
                            if ($rem >= 3) { $durs[] = 3; $rem -= 3; }
                            elseif ($rem === 2) { $durs[] = 2; $rem = 0; }
                            else { $durs[] = 1; $rem = 0; }
                        }
                    }
                }
            }

            foreach ($durs as $dur) {
                $blocks[$bId] = [
                    'id' => $bId,
                    'class_id' => $a->class_id,
                    'subject_id' => $a->subject_id,
                    'teacher_id' => $a->teacher_id,
                    'preferred_room_id' => $a->preferred_room_id,
                    'category' => $cat,
                    'duration' => $dur,
                    'subject_name' => $a->subject?->name ?? '',
                    'class_name' => $a->schoolClass?->name ?? '',
                    'teacher_load' => $teacherLoad[$a->teacher_id] ?? 0,
                    'placed' => false,
                    'day' => null,
                    'period' => null,
                    'room_id' => null,
                ];
                $bId++;
            }
        }

        // 4. Multi-attempt Placement dengan Kempe Swap & Zero-Conflict Invariant
        $bestDrafts = [];
        $maxPlaced = -1;

        for ($attempt = 1; $attempt <= 2; $attempt++) {
            $runBlocks = $blocks;
            uasort($runBlocks, function ($a, $b) use ($attempt) {
                if ($a['teacher_load'] !== $b['teacher_load']) {
                    return $b['teacher_load'] <=> $a['teacher_load'];
                }
                if ($a['category'] !== $b['category']) {
                    return $a['category'] === 'jurusan' ? -1 : 1;
                }
                if ($a['duration'] !== $b['duration']) {
                    return $b['duration'] <=> $a['duration'];
                }
                return ($attempt > 1) ? mt_rand(-1, 1) : ($a['id'] <=> $b['id']);
            });

            $classGrid = [];
            $teacherGrid = [];
            $roomGrid = [];

            $isFree = function ($cid, $tid, $rid, $d, $p, $dur) use (&$classGrid, &$teacherGrid, &$roomGrid): bool {
                $isShared = !empty($this->sharedRooms[$rid]);
                for ($i = 0; $i < $dur; $i++) {
                    $s = $p + $i;
                    if (isset($classGrid[$cid][$d][$s])) return false;
                    if (isset($teacherGrid[$tid][$d][$s])) return false;
                    if (!$isShared && isset($roomGrid[$rid][$d][$s])) return false;
                }
                return true;
            };

            $placeBlock = function (&$b, $d, $p, $rid) use (&$classGrid, &$teacherGrid, &$roomGrid) {
                $cid = $b['class_id'];
                $tid = $b['teacher_id'];
                $dur = $b['duration'];
                $id = $b['id'];
                $isShared = !empty($this->sharedRooms[$rid]);

                for ($i = 0; $i < $dur; $i++) {
                    $s = $p + $i;
                    $classGrid[$cid][$d][$s] = $id;
                    $teacherGrid[$tid][$d][$s] = $id;
                    if (!$isShared) $roomGrid[$rid][$d][$s] = $id;
                }
                $b['placed'] = true;
                $b['day'] = $d;
                $b['period'] = $p;
                $b['room_id'] = $rid;
            };

            $unplaceBlock = function (&$b) use (&$classGrid, &$teacherGrid, &$roomGrid) {
                if (!$b['placed']) return;
                $cid = $b['class_id'];
                $tid = $b['teacher_id'];
                $dur = $b['duration'];
                $d = $b['day'];
                $p = $b['period'];
                $rid = $b['room_id'];
                $isShared = !empty($this->sharedRooms[$rid]);

                for ($i = 0; $i < $dur; $i++) {
                    $s = $p + $i;
                    unset($classGrid[$cid][$d][$s]);
                    unset($teacherGrid[$tid][$d][$s]);
                    if (!$isShared) unset($roomGrid[$rid][$d][$s]);
                }
                $b['placed'] = false;
                $b['day'] = null;
                $b['period'] = null;
                $b['room_id'] = null;
            };

            $getCandidateRooms = function ($b) use ($classBaseRoom) {
                $cand = [];
                if ($b['preferred_room_id']) $cand[] = $b['preferred_room_id'];
                if ($b['category'] === 'jurusan') {
                    foreach ($this->labRoomIds as $lr) if (!in_array($lr, $cand)) $cand[] = $lr;
                } elseif ($b['subject_name'] === 'PJOK') {
                    foreach ($this->fieldRoomIds as $fr) if (!in_array($fr, $cand)) $cand[] = $fr;
                } else {
                    $base = $classBaseRoom[$b['class_id']] ?? null;
                    if ($base && !in_array($base, $cand)) $cand[] = $base;
                    foreach ($this->theoryRoomIds as $tr) if (!in_array($tr, $cand)) $cand[] = $tr;
                }
                foreach ($this->allRoomIds as $ar) if (!in_array($ar, $cand)) $cand[] = $ar;
                return $cand;
            };

            $getSlots = function (int $dur) {
                $slots = [];
                for ($d = 1; $d <= 5; $d++) {
                    $maxP = ($d === 5) ? 8 : 10;
                    $starts = [];
                    if ($dur === 6) $starts = ($d === 5) ? [1] : [1, 5];
                    elseif ($dur === 5) $starts = ($d === 5) ? [4] : [1, 6];
                    elseif ($dur === 4) $starts = ($d === 5) ? [1, 5] : [1, 5, 7];
                    elseif ($dur === 3) $starts = ($d === 5) ? [1, 4, 6] : [1, 4, 6, 8];
                    elseif ($dur === 2) $starts = ($d === 5) ? [1, 3, 4, 7] : [1, 3, 4, 6, 7, 9];
                    else { for ($p = 1; $p <= $maxP; $p++) $starts[] = $p; }

                    foreach ($starts as $st) {
                        if ($st + $dur - 1 <= $maxP) $slots[] = ['day' => $d, 'period' => $st];
                    }
                    for ($p = 1; $p <= $maxP - $dur + 1; $p++) {
                        if (!in_array($p, $starts)) $slots[] = ['day' => $d, 'period' => $p];
                    }
                }
                return $slots;
            };

            // Pass 1: Penempatan Langsung
            $unplaced = [];
            foreach ($runBlocks as $key => &$b) {
                $slots = $getSlots($b['duration']);
                $candRooms = $getCandidateRooms($b);
                $placed = false;

                foreach ($slots as $slot) {
                    $d = $slot['day'];
                    $p = $slot['period'];
                    foreach ($candRooms as $rid) {
                        if ($isFree($b['class_id'], $b['teacher_id'], $rid, $d, $p, $b['duration'])) {
                            $placeBlock($b, $d, $p, $rid);
                            $placed = true;
                            break 2;
                        }
                    }
                }
                if (!$placed) {
                    $unplaced[] = $b['id'];
                }
            }
            unset($b);

            // Pass 2: 1-Step Kempe Swap / Ejection Chain
            for ($pass = 1; $pass <= 5 && !empty($unplaced); $pass++) {
                $stillUnplaced = [];
                foreach ($unplaced as $uId) {
                    $b = &$runBlocks[$uId];
                    $slots = $getSlots($b['duration']);
                    $candRooms = $getCandidateRooms($b);
                    $resolved = false;

                    foreach ($slots as $slot) {
                        $d = $slot['day'];
                        $p = $slot['period'];
                        $dur = $b['duration'];
                        $cid = $b['class_id'];
                        $tid = $b['teacher_id'];

                        $teacherFree = true;
                        for ($i = 0; $i < $dur; $i++) {
                            if (isset($teacherGrid[$tid][$d][$p + $i])) { $teacherFree = false; break; }
                        }
                        if (!$teacherFree) continue;

                        $occ = [];
                        for ($i = 0; $i < $dur; $i++) {
                            if (isset($classGrid[$cid][$d][$p + $i])) {
                                $occ[$classGrid[$cid][$d][$p + $i]] = true;
                            }
                        }

                        if (count($occ) === 1) {
                            $vId = array_key_first($occ);
                            $v = &$runBlocks[$vId];

                            $origDay = $v['day'];
                            $origPeriod = $v['period'];
                            $origRoom = $v['room_id'];

                            $unplaceBlock($v);

                            $foundRoom = null;
                            foreach ($candRooms as $rid) {
                                if ($isFree($cid, $tid, $rid, $d, $p, $dur)) {
                                    $foundRoom = $rid;
                                    break;
                                }
                            }

                            if ($foundRoom) {
                                $placeBlock($b, $d, $p, $foundRoom);

                                $vSlots = $getSlots($v['duration']);
                                $vRooms = $getCandidateRooms($v);
                                $vPlaced = false;

                                foreach ($vSlots as $vs) {
                                    foreach ($vRooms as $vr) {
                                        if ($isFree($v['class_id'], $v['teacher_id'], $vr, $vs['day'], $vs['period'], $v['duration'])) {
                                            $placeBlock($v, $vs['day'], $vs['period'], $vr);
                                            $vPlaced = true;
                                            break 2;
                                        }
                                    }
                                }

                                if ($vPlaced) {
                                    $resolved = true;
                                    unset($v);
                                    break;
                                } else {
                                    $unplaceBlock($b);
                                    $placeBlock($v, $origDay, $origPeriod, $origRoom);
                                }
                            } else {
                                $placeBlock($v, $origDay, $origPeriod, $origRoom);
                            }
                            unset($v);
                        }
                    }

                    if (!$resolved) {
                        $stillUnplaced[] = $uId;
                    }
                    unset($b);
                }
                $unplaced = $stillUnplaced;
            }

            // Pass 3: Fallback pemecahan modular (4 JP -> 2+2) untuk slot yang tersisa (bebas bentrok)
            if (!empty($unplaced)) {
                $furtherUnplaced = [];
                foreach ($unplaced as $uId) {
                    $b = &$runBlocks[$uId];
                    if ($b['duration'] === 4) {
                        $b1 = array_merge($b, ['id' => $bId++, 'duration' => 2]);
                        $b2 = array_merge($b, ['id' => $bId++, 'duration' => 2]);
                        $slots1 = $getSlots(2);
                        $rooms1 = $getCandidateRooms($b1);
                        $b1Placed = false;
                        foreach ($slots1 as $s) {
                            foreach ($rooms1 as $r) {
                                if ($isFree($b1['class_id'], $b1['teacher_id'], $r, $s['day'], $s['period'], 2)) {
                                    $placeBlock($b1, $s['day'], $s['period'], $r);
                                    $b1Placed = true;
                                    break 2;
                                }
                            }
                        }
                        if ($b1Placed) {
                            $runBlocks[$b1['id']] = $b1;
                            $b2Placed = false;
                            foreach ($slots1 as $s) {
                                foreach ($rooms1 as $r) {
                                    if ($isFree($b2['class_id'], $b2['teacher_id'], $r, $s['day'], $s['period'], 2)) {
                                        $placeBlock($b2, $s['day'], $s['period'], $r);
                                        $b2Placed = true;
                                        break 2;
                                    }
                                }
                            }
                            if ($b2Placed) {
                                $runBlocks[$b2['id']] = $b2;
                                unset($runBlocks[$uId]);
                                continue;
                            } else {
                                $unplaceBlock($b1);
                                unset($runBlocks[$b1['id']]);
                            }
                        }
                    }
                    $furtherUnplaced[] = $uId;
                    unset($b);
                }
                $unplaced = $furtherUnplaced;
            }

            // Bentuk Draft Jadwal
            $currentDrafts = [];
            foreach ($runBlocks as $b) {
                if (!$b['placed'] || empty($b['day'])) continue;
                $currentDrafts[] = [
                    'class_id' => $b['class_id'],
                    'subject_id' => $b['subject_id'],
                    'teacher_id' => $b['teacher_id'],
                    'room_id' => $b['room_id'],
                    'day_of_week' => $b['day'],
                    'period_number' => $b['period'],
                    'duration_periods' => $b['duration'],
                    'cycle_type' => $cycle,
                    'category' => $b['category'],
                    'has_conflict' => false,
                    'conflict_note' => null,
                ];
            }

            if (count($currentDrafts) > $maxPlaced) {
                $maxPlaced = count($currentDrafts);
                $bestDrafts = $currentDrafts;
            }

            if (empty($unplaced)) break;
        }

        // 5. Audit Final Konflik (Double Verification)
        $auditTeacher = [];
        $auditClass = [];
        $auditRoom = [];

        foreach ($bestDrafts as &$draft) {
            $tid = $draft['teacher_id'];
            $cid = $draft['class_id'];
            $rid = $draft['room_id'];
            $d = $draft['day_of_week'];
            $p = $draft['period_number'];
            $dur = $draft['duration_periods'];
            $isShared = !empty($this->sharedRooms[$rid]);

            $teacherConflict = false;
            $classConflict = false;
            $roomConflict = false;

            for ($i = 0; $i < $dur; $i++) {
                $s = $p + $i;
                if (isset($auditTeacher[$tid][$d][$s])) $teacherConflict = true;
                if (isset($auditClass[$cid][$d][$s])) $classConflict = true;
                if (!$isShared && isset($auditRoom[$rid][$d][$s])) $roomConflict = true;

                $auditTeacher[$tid][$d][$s] = true;
                $auditClass[$cid][$d][$s] = true;
                if (!$isShared) $auditRoom[$rid][$d][$s] = true;
            }

            if ($teacherConflict || $classConflict || $roomConflict) {
                $draft['has_conflict'] = true;
                if ($teacherConflict && $roomConflict) {
                    $draft['conflict_note'] = 'Bentrok guru dan ruangan pada slot waktu ini.';
                } elseif ($teacherConflict) {
                    $draft['conflict_note'] = 'Guru pengampu memiliki jadwal mengajar di kelas lain pada jam ini.';
                } elseif ($roomConflict) {
                    $draft['conflict_note'] = 'Ruangan sedang digunakan oleh kelas lain pada jam ini.';
                } else {
                    $draft['conflict_note'] = 'Kelas memiliki jadwal lain pada jam ini.';
                }
            } else {
                $draft['has_conflict'] = false;
                $draft['conflict_note'] = null;
            }
        }
        unset($draft);

        return $bestDrafts;
    }

    /**
     * Menerapkan jadwal hasil generate ke tabel `schedules` aktif.
     */
    public function applyBatch(string $batchUuid, int $userId): array
    {
        $batch = ScheduleGenerationBatch::where('batch_uuid', $batchUuid)->firstOrFail();

        if ($batch->status === 'applied') {
            throw new \Exception('Batch generate ini sudah pernah diterapkan.');
        }

        // Pengecekan ketat: Jangan izinkan penerapan jika masih ada slot yang bentrok
        $conflictCount = ScheduleGenerationDraft::where('batch_id', $batch->id)
            ->where('has_conflict', true)
            ->count();
        if ($conflictCount > 0) {
            throw new \Exception("Tidak dapat menerapkan jadwal karena masih terdapat {$conflictCount} slot yang bentrok. Mohon lakukan generate ulang.");
        }

        return DB::transaction(function () use ($batch) {
            $targetCycles = $batch->target_cycles;
            $deletedCount = 0;

            // 1. Hapus jadwal aktif lama pada putaran target (beserta relasi jurnal & presensi jika ada)
            foreach ($targetCycles as $cycle) {
                $oldSchedules = Schedule::where('cycle_type', $cycle)->get();
                $deletedCount += $oldSchedules->count();
                $oldScheduleIds = $oldSchedules->pluck('id')->all();

                if (!empty($oldScheduleIds)) {
                    if (Schema::hasTable('journals')) {
                        $journals = DB::table('journals')->whereIn('schedule_id', $oldScheduleIds)->get(['id', 'photo_path']);
                        $journalIds = $journals->pluck('id')->all();

                        if (!empty($journalIds)) {
                            if (Schema::hasTable('attendances')) {
                                DB::table('attendances')->whereIn('journal_id', $journalIds)->delete();
                            }
                            DB::table('journals')->whereIn('id', $journalIds)->delete();
                        }
                    }

                    if (Schema::hasTable('teacher_leave_requests')) {
                        DB::table('teacher_leave_requests')->whereNotNull('schedule_ids')->update(['schedule_ids' => null]);
                    }

                    Schedule::whereIn('id', $oldScheduleIds)->forceDelete();
                }
            }

            // 2. Ambil seluruh draft dari batch ini
            $drafts = ScheduleGenerationDraft::where('batch_id', $batch->id)->get();
            $now = now();
            $schedulesToInsert = [];

            foreach ($drafts as $d) {
                $schedulesToInsert[] = [
                    'teacher_id' => $d->teacher_id,
                    'class_id' => $d->class_id,
                    'subject_id' => $d->subject_id,
                    'room_id' => $d->room_id,
                    'day_of_week' => $d->day_of_week,
                    'period_number' => $d->period_number,
                    'duration_periods' => $d->duration_periods,
                    'cycle_type' => $d->cycle_type,
                    'source' => 'auto_generated',
                    'import_batch_id' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            foreach (array_chunk($schedulesToInsert, 200) as $chunk) {
                Schedule::insert($chunk);
            }

            $batch->update(['status' => 'applied']);

            return [
                'batch_uuid' => $batch->batch_uuid,
                'target_cycles' => $targetCycles,
                'deleted_old_schedules' => $deletedCount,
                'applied_new_schedules' => count($schedulesToInsert),
            ];
        });
    }

    /**
     * Membatalkan dan menghapus draft generate.
     */
    public function discardBatch(string $batchUuid): void
    {
        $batch = ScheduleGenerationBatch::where('batch_uuid', $batchUuid)->firstOrFail();
        ScheduleGenerationDraft::where('batch_id', $batch->id)->delete();
        $batch->update(['status' => 'discarded']);
    }
}
