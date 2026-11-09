<?php

namespace App\Services;

use App\Models\Room;
use App\Models\Schedule;
use Illuminate\Database\Eloquent\Collection;

class ScheduleConflictService
{
    /**
     * Determine if a room or room code/name is a shared facility (e.g. Lapangan Olahraga / OR)
     * where multiple classes and teachers can be scheduled simultaneously without room collision.
     */
    public static function isSharedRoom(mixed $room): bool
    {
        if (!$room) {
            return false;
        }

        $name = '';
        if ($room instanceof Room) {
            $name = $room->name;
        } elseif (is_object($room) && isset($room->name)) {
            $name = (string) $room->name;
        } elseif (is_array($room) && isset($room['name'])) {
            $name = (string) $room['name'];
        } elseif (is_numeric($room)) {
            $roomModel = Room::find($room);
            $name = $roomModel ? $roomModel->name : '';
        } elseif (is_string($room)) {
            $name = $room;
        }

        $upper = strtoupper(trim($name));
        if (!$upper) {
            return false;
        }

        if (in_array($upper, ['OR', 'OR1', 'OR2', 'OR3', 'LAPANGAN', 'LAPANGAN OLAHRAGA'])) {
            return true;
        }

        if (preg_match('/\b(OR|LAPANGAN)\b/i', $upper)) {
            return true;
        }

        if (preg_match('/^OR\d*$/i', $upper)) {
            return true;
        }

        return false;
    }

    /**
     * Find conflicting active schedules for given resource allocation.
     *
     * @param array $data ['cycle_type', 'day_of_week', 'period_number', 'duration_periods', 'teacher_id', 'class_id', 'room_id']
     * @param int|null $ignoreId Single schedule ID to ignore (e.g. during manual update)
     * @param array|null $ignoreClassIds Array of class IDs whose existing schedules are being replaced in this batch
     * @return Collection
     */
    public function findConflicts(
        array $data,
        ?int $ignoreId = null,
        ?array $ignoreClassIds = null
    ): Collection {
        $duration = (int) ($data['duration_periods'] ?? 1);
        $start = (int) $data['period_number'];
        $end = $start + $duration - 1;

        $roomId = $data['room_id'] ?? null;
        if ($roomId && self::isSharedRoom($roomId)) {
            $roomId = null;
        }

        $resources = array_filter([
            'teacher_id' => $data['teacher_id'] ?? null,
            'class_id' => $data['class_id'] ?? null,
            'room_id' => $roomId
        ], fn ($value) => $value !== null);

        if (empty($resources)) {
            return new Collection();
        }

        return Schedule::query()
            ->where('cycle_type', $data['cycle_type'])
            ->where('day_of_week', $data['day_of_week'])
            ->where('period_number', '<=', $end)
            ->whereRaw('(period_number + duration_periods - 1) >= ?', [$start])
            ->where(function ($query) use ($resources) {
                $first = true;

                foreach ($resources as $column => $value) {
                    $first 
                        ? $query->where($column, $value)
                        : $query->orWhere($column, $value);

                    $first = false;
                }
            })
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->when(!empty($ignoreClassIds), fn ($query) => $query->whereNotIn('class_id', $ignoreClassIds))
            ->get();
    }

    /**
     * Cek apakah terdapat konflik dengan koleksi jadwal yang sudah dimuat ke memori (In-Memory).
     * Mencegah N+1 query saat memproses impor ratusan baris jadwal sekaligus.
     *
     * @param iterable $schedules Koleksi jadwal yang sudah dimuat ke memori
     * @param array $data ['day_of_week', 'period_number', 'duration_periods', 'teacher_id', 'class_id', 'room_id']
     * @return bool
     */
    public function hasConflictInMemory(iterable $schedules, array $data): bool
    {
        $duration = (int) ($data['duration_periods'] ?? 1);
        $start = (int) $data['period_number'];
        $end = $start + $duration - 1;
        $day = (int) $data['day_of_week'];

        $teacherId = $data['teacher_id'] ?? null;
        $classId = $data['class_id'] ?? null;
        $roomId = $data['room_id'] ?? null;

        if ($roomId && self::isSharedRoom($roomId)) {
            $roomId = null;
        }

        foreach ($schedules as $s) {
            if ((int) $s->day_of_week !== $day) {
                continue;
            }

            $sStart = (int) $s->period_number;
            $sDuration = (int) ($s->duration_periods ?? 1);
            $sEnd = $sStart + $sDuration - 1;

            // Periksa tumpang tindih waktu (overlap interval)
            if ($sStart <= $end && $sEnd >= $start) {
                // Periksa tabrakan resource
                if ($teacherId && (int) $s->teacher_id === (int) $teacherId) {
                    return true;
                }
                if ($classId && (int) $s->class_id === (int) $classId) {
                    return true;
                }
                if ($roomId && (int) $s->room_id === (int) $roomId) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Konversi angka hari menjadi nama hari dalam bahasa Indonesia.
     */
    public static function getDayName(int $day): string
    {
        return match ($day) {
            1 => 'Senin',
            2 => 'Selasa',
            3 => 'Rabu',
            4 => 'Kamis',
            5 => 'Jumat',
            6 => 'Sabtu',
            default => 'Hari ' . $day,
        };
    }

    /**
     * Cari detail benturan secara spesifik (apakah guru, kelas, atau ruangan)
     * baik dari slot intra-batch draf maupun koleksi jadwal aktif di database.
     */
    public function findConflictDetailsInMemory(
        iterable $schedules,
        array $data,
        array $batchSlots = []
    ): ?array {
        $duration = (int) ($data['duration_periods'] ?? 1);
        $start = (int) $data['period_number'];
        $end = $start + $duration - 1;
        $day = (int) $data['day_of_week'];
        $dayName = self::getDayName($day);

        $teacherId = $data['teacher_id'] ?? null;
        $classId = $data['class_id'] ?? null;
        $roomId = $data['room_id'] ?? null;
        $teacherName = $data['teacher_name'] ?? 'Guru';
        $className = $data['class_name'] ?? 'Kelas';
        $roomName = $data['room_name'] ?? 'Ruangan';

        $isShared = $roomId && self::isSharedRoom($roomId);

        // 1. Cek benturan intra-batch
        for ($p = $start; $p <= $end; $p++) {
            $slotKey = "{$day}-{$p}";
            if (isset($batchSlots[$slotKey])) {
                $slot = $batchSlots[$slotKey];

                // a. Benturan guru
                if ($teacherId && in_array($teacherId, $slot['teachers'] ?? [])) {
                    $otherEntry = collect($slot['entries'] ?? [])->firstWhere('teacher_id', $teacherId);
                    $otherClass = $otherEntry['class_name'] ?? 'kelas lain';
                    $otherSubject = $otherEntry['subject_name'] ?? 'mapel lain';

                    return [
                        'type' => 'teacher_collision',
                        'entity_type' => 'teacher',
                        'title' => 'Tabrakan Jadwal Guru',
                        'description' => "Guru {$teacherName} sudah memiliki jadwal mengajar ({$otherSubject}) di kelas {$otherClass} pada hari {$dayName} Jam Ke-{$p}.",
                        'conflicting_with' => [
                            'entity_id' => $teacherId,
                            'entity_name' => $teacherName,
                            'class_name' => $otherClass,
                            'subject_name' => $otherSubject,
                            'day_of_week' => $day,
                            'period_number' => $p,
                        ],
                    ];
                }

                // b. Benturan kelas
                if ($classId && in_array($classId, $slot['classes'] ?? [])) {
                    $otherEntry = collect($slot['entries'] ?? [])->firstWhere('class_id', $classId);
                    $otherTeacher = $otherEntry['teacher_name'] ?? 'guru lain';
                    $otherSubject = $otherEntry['subject_name'] ?? 'mapel lain';

                    return [
                        'type' => 'class_collision',
                        'entity_type' => 'class',
                        'title' => 'Tabrakan Jadwal Kelas',
                        'description' => "Kelas {$className} sudah memiliki jadwal KBM ({$otherSubject}) bersama {$otherTeacher} pada hari {$dayName} Jam Ke-{$p}.",
                        'conflicting_with' => [
                            'entity_id' => $classId,
                            'entity_name' => $className,
                            'teacher_name' => $otherTeacher,
                            'subject_name' => $otherSubject,
                            'day_of_week' => $day,
                            'period_number' => $p,
                        ],
                    ];
                }

                // c. Benturan ruangan (jika bukan shared room)
                if (!$isShared && $roomId && in_array($roomId, $slot['rooms'] ?? [])) {
                    $otherEntry = collect($slot['entries'] ?? [])->firstWhere('room_id', $roomId);
                    $otherClass = $otherEntry['class_name'] ?? 'kelas lain';
                    $otherTeacher = $otherEntry['teacher_name'] ?? 'guru lain';
                    $otherSubject = $otherEntry['subject_name'] ?? 'mapel lain';

                    return [
                        'type' => 'room_collision',
                        'entity_type' => 'room',
                        'title' => 'Tabrakan Pemakaian Ruangan',
                        'description' => "Ruangan '{$roomName}' sedang digunakan oleh kelas {$otherClass} ({$otherSubject}, {$otherTeacher}) pada hari {$dayName} Jam Ke-{$p}.",
                        'conflicting_with' => [
                            'entity_id' => $roomId,
                            'entity_name' => $roomName,
                            'class_name' => $otherClass,
                            'teacher_name' => $otherTeacher,
                            'subject_name' => $otherSubject,
                            'day_of_week' => $day,
                            'period_number' => $p,
                        ],
                    ];
                }
            }
        }

        // 2. Cek benturan terhadap jadwal aktif di database
        foreach ($schedules as $s) {
            if ((int) $s->day_of_week !== $day) {
                continue;
            }

            $sStart = (int) $s->period_number;
            $sDuration = (int) ($s->duration_periods ?? 1);
            $sEnd = $sStart + $sDuration - 1;

            if ($sStart <= $end && $sEnd >= $start) {
                $otherTeacherName = $s->teacher?->name ?? 'Guru Aktif';
                $otherClassName = $s->class?->name ?? 'Kelas Aktif';
                $otherSubjectName = $s->subject?->name ?? 'Mata Pelajaran Aktif';
                $otherRoomName = $s->room?->name ?? 'Ruangan Aktif';

                if ($teacherId && (int) $s->teacher_id === (int) $teacherId) {
                    return [
                        'type' => 'teacher_collision',
                        'entity_type' => 'teacher',
                        'title' => 'Tabrakan Jadwal Guru (Jadwal Aktif)',
                        'description' => "Guru {$teacherName} sudah memiliki jadwal aktif mengajar ({$otherSubjectName}) di kelas {$otherClassName} pada hari {$dayName} Jam Ke-{$sStart}–{$sEnd}.",
                        'conflicting_with' => [
                            'entity_id' => $teacherId,
                            'entity_name' => $teacherName,
                            'class_name' => $otherClassName,
                            'subject_name' => $otherSubjectName,
                            'day_of_week' => $day,
                            'period_number' => $sStart,
                        ],
                    ];
                }

                if ($classId && (int) $s->class_id === (int) $classId) {
                    return [
                        'type' => 'class_collision',
                        'entity_type' => 'class',
                        'title' => 'Tabrakan Jadwal Kelas (Jadwal Aktif)',
                        'description' => "Kelas {$className} sudah memiliki jadwal aktif ({$otherSubjectName}) bersama {$otherTeacherName} pada hari {$dayName} Jam Ke-{$sStart}–{$sEnd}.",
                        'conflicting_with' => [
                            'entity_id' => $classId,
                            'entity_name' => $className,
                            'teacher_name' => $otherTeacherName,
                            'subject_name' => $otherSubjectName,
                            'day_of_week' => $day,
                            'period_number' => $sStart,
                        ],
                    ];
                }

                if (!$isShared && $roomId && (int) $s->room_id === (int) $roomId) {
                    return [
                        'type' => 'room_collision',
                        'entity_type' => 'room',
                        'title' => 'Tabrakan Pemakaian Ruangan (Jadwal Aktif)',
                        'description' => "Ruangan '{$roomName}' terisi oleh jadwal aktif kelas {$otherClassName} ({$otherSubjectName}, {$otherTeacherName}) pada hari {$dayName} Jam Ke-{$sStart}–{$sEnd}.",
                        'conflicting_with' => [
                            'entity_id' => $roomId,
                            'entity_name' => $roomName,
                            'class_name' => $otherClassName,
                            'teacher_name' => $otherTeacherName,
                            'subject_name' => $otherSubjectName,
                            'day_of_week' => $day,
                            'period_number' => $sStart,
                        ],
                    ];
                }
            }
        }

        return null;
    }

    /**
     * Cari daftar ruangan yang tersedia dan bebas benturan pada slot waktu tertentu.
     *
     * @param int $day Hari (1-5)
     * @param int $startPeriod Jam mulai
     * @param int $duration Durasi JP
     * @param iterable $allRooms Seluruh koleksi master ruangan
     * @param iterable $existingSchedules Jadwal aktif di database
     * @param array $batchSlots Slot terpakai dalam batch draf saat ini
     * @param Room|int|null $currentRoom Ruangan saat ini (untuk prioritas tipe)
     * @param int $limit Maksimal rekomendasi yang ditampilkan
     * @return array
     */
    /**
     * Mencocokkan kode/nama ruangan mentah ke model Room master data.
     */
    public static function findRoom(iterable $rooms, ?string $roomCode): ?Room
    {
        if (!$roomCode) return null;
        $code = strtoupper(trim($roomCode));

        $col = collect($rooms);

        // 1. Exact match
        $match = $col->first(fn ($r) => strtoupper(trim($r->name)) === $code);
        if ($match) return $match;

        // 2. Numeric room (e.g. "12" -> "Ruang 12", "Ruang Teori 12", "R. 12")
        if (is_numeric($code)) {
            $numMatch = $col->first(function ($r) use ($code) {
                $rName = strtoupper(trim($r->name));
                if (preg_match('/^(?:LAB|L\.)/i', $rName)) {
                    return false;
                }
                return preg_match('/^(?:RUANG(?:\s+TEORI)?|R\.?)\s*' . preg_quote($code, '/') . '$/i', $rName)
                    || $rName === $code;
            });
            if ($numMatch) return $numMatch;
            return null;
        }

        // 3. Lab with number (e.g. "L.16", "LAB 16", "LAB 5" -> "L.5")
        if (preg_match('/^(?:LAB\.?|L\.)\s*(\d+)$/i', $code, $m)) {
            $num = $m[1];
            $labMatch = $col->first(function ($r) use ($num) {
                $rName = strtoupper(trim($r->name));
                return preg_match('/^(?:LAB(?:ORATORIUM)?(?:\s+KOMPUTER)?|L\.?)\s*' . $num . '$/i', $rName);
            });
            if ($labMatch) return $labMatch;
            return null;
        }

        // 4. Special rooms
        if (in_array($code, ['OR', 'OR1', 'OR2', 'OR3', 'LAPANGAN'])) {
            $orMatch = $col->first(fn ($r) => preg_match('/(?:OR|LAPANGAN)/i', $r->name));
            if ($orMatch) return $orMatch;
        }

        if (in_array($code, ['L.IPA', 'LAB IPA', 'LAB.IPA'])) {
            $ipaMatch = $col->first(fn ($r) => preg_match('/(?:IPA)/i', $r->name));
            if ($ipaMatch) return $ipaMatch;
        }

        if (in_array($code, ['L.PB', 'LAB PB', 'LAB.PB'])) {
            $pbMatch = $col->first(fn ($r) => preg_match('/(?:PB|PENATAAN)/i', $r->name));
            if ($pbMatch) return $pbMatch;
        }

        if (in_array($code, ['HALL'])) {
            $hallMatch = $col->first(fn ($r) => preg_match('/(?:HALL|MENARI)/i', $r->name));
            if ($hallMatch) return $hallMatch;
        }

        return null;
    }

    /**
     * Mengkategorikan ruangan untuk pencocokan tipe yang akurat.
     */
    public static function getRoomCategory(?string $roomName): string
    {
        if (!$roomName) return 'theory';
        $n = strtoupper(trim($roomName));

        if (in_array($n, ['OR', 'OR1', 'OR2', 'OR3', 'AULA', 'SINIAR', 'MASJID', 'LAPANGAN'])) {
            return 'common';
        }

        if (preg_match('/^(?:LAB|L\.)\s*(?:IPA|PB|KIMIA|FISIKA|BIOLOGI)/i', $n)) {
            return 'specialized_lab';
        }

        if (preg_match('/^(?:LAB|L\.)\s*\d+$/i', $n)) {
            return 'computer_lab';
        }

        if (preg_match('/^\d+$/', $n)) {
            return 'theory';
        }

        return 'theory';
    }

    /**
     * Mencari ruangan alternatif yang benar-benar kosong pada jam tertentu.
     * Memperhitungkan slot terpakai dari existing database dan batch import.
     *
     * @param int $day Hari (1-5)
     * @param int $startPeriod Jam mulai
     * @param int $duration Durasi JP
     * @param iterable $allRooms Seluruh koleksi master ruangan
     * @param iterable $existingSchedules Jadwal aktif di database
     * @param array $batchSlots Slot terpakai dalam batch draf saat ini
     * @param Room|int|null $currentRoom Ruangan saat ini (untuk prioritas tipe)
     * @param int $limit Maksimal rekomendasi yang ditampilkan
     * @return array
     */
    public function findAlternativeRooms(
        int $day,
        int $startPeriod,
        int $duration,
        iterable $allRooms,
        iterable $existingSchedules,
        array $batchSlots = [],
        mixed $currentRoom = null,
        int $limit = 4
    ): array {
        $endPeriod = $startPeriod + $duration - 1;
        $dayName = self::getDayName($day);

        $currRoomName = '';
        $currRoomId = null;
        if ($currentRoom instanceof Room) {
            $currRoomName = $currentRoom->name;
            $currRoomId = $currentRoom->id;
        } elseif (is_numeric($currentRoom)) {
            $currRoomId = (int) $currentRoom;
            $m = collect($allRooms)->firstWhere('id', $currRoomId);
            $currRoomName = $m ? $m->name : '';
        }

        $currCategory = self::getRoomCategory($currRoomName);

        $availableRooms = [];

        foreach ($allRooms as $r) {
            // Abaikan ruangan yang sama persis jika sedang konflik
            if ($currRoomId && (int) $r->id === (int) $currRoomId) {
                continue;
            }

            // Abaikan shared room dari rekomendasi ruangan eksklusif
            if (self::isSharedRoom($r)) {
                continue;
            }

            $targetCategory = self::getRoomCategory($r->name);

            // JANGAN menyarankan Lab Komputer jika ruangan aslinya adalah Ruang Teori atau Lab IPA umum,
            // untuk mencegah kelas teori merebut Lab Komputer produktif kejuruan.
            if ($currCategory !== 'computer_lab' && $targetCategory === 'computer_lab') {
                continue;
            }

            // 1. Cek terhadap batchSlots
            $occupiedInBatch = false;
            for ($p = $startPeriod; $p <= $endPeriod; $p++) {
                $slotKey = "{$day}-{$p}";
                if (isset($batchSlots[$slotKey]) && in_array($r->id, $batchSlots[$slotKey]['rooms'] ?? [])) {
                    $occupiedInBatch = true;
                    break;
                }
            }
            if ($occupiedInBatch) {
                continue;
            }

            // 2. Cek terhadap existingSchedules
            $occupiedInDb = false;
            foreach ($existingSchedules as $s) {
                if ((int) $s->day_of_week !== $day || (int) $s->room_id !== (int) $r->id) {
                    continue;
                }
                $sStart = (int) $s->period_number;
                $sDuration = (int) ($s->duration_periods ?? 1);
                $sEnd = $sStart + $sDuration - 1;

                if ($sStart <= $endPeriod && $sEnd >= $startPeriod) {
                    $occupiedInDb = true;
                    break;
                }
            }
            if ($occupiedInDb) {
                continue;
            }

            // Ruangan ini kosong dan bebas benturan!
            $isSameType = ($currCategory === $targetCategory);
            $typeLabel = match ($targetCategory) {
                'computer_lab' => 'Laboratorium Komputer',
                'specialized_lab' => 'Laboratorium Khusus',
                'common' => 'Fasilitas Bersama',
                default => 'Ruang Teori',
            };

            $availableRooms[] = [
                'room_id' => $r->id,
                'room_name' => $r->name,
                'capacity' => $r->capacity ?? 36,
                'is_same_type' => $isSameType,
                'type_label' => $typeLabel,
                'category' => $targetCategory,
                'reason' => "Ruangan {$typeLabel} kosong dan bebas konflik pada {$dayName} Jam Ke-{$startPeriod} ({$duration} JP).",
            ];
        }

        // Urutkan: Ruangan dengan kategori serupa diutamakan, kemudian urut nama numerik
        usort($availableRooms, function ($a, $b) {
            if ($a['is_same_type'] !== $b['is_same_type']) {
                return $a['is_same_type'] ? -1 : 1;
            }
            return strnatcasecmp($a['room_name'], $b['room_name']);
        });

        return array_slice($availableRooms, 0, $limit);
    }

    /**
     * Menganalisis ketersediaan opsi ruangan saat terjadi room_source_conflict
     * antara berkas PDF Jadwal Kelas dan PDF Matriks Ruangan (atau Ruang Teori Pangkalan).
     */
    public function diagnoseRoomSourceConflict(
        ?Room $roomKelas,
        ?Room $roomJadwal,
        int $day,
        int $startPeriod,
        int $duration,
        iterable $existingSchedules,
        array $batchSlots = [],
        string $labelKelas = 'PDF Jadwal Kelas',
        string $labelJadwal = 'PDF Matriks Ruang'
    ): array {
        $endPeriod = $startPeriod + $duration - 1;

        $checkAvailabilityWithDetail = function (?Room $room) use ($day, $startPeriod, $endPeriod, $existingSchedules, $batchSlots) {
            if (!$room) return ['available' => false, 'occupied_by' => null];
            if (self::isSharedRoom($room)) return ['available' => true, 'occupied_by' => null];

            // Cek batch slots
            for ($p = $startPeriod; $p <= $endPeriod; $p++) {
                $slotKey = "{$day}-{$p}";
                if (isset($batchSlots[$slotKey]) && in_array($room->id, $batchSlots[$slotKey]['rooms'] ?? [])) {
                    // Cari entitas yang menempati slot
                    $entry = collect($batchSlots[$slotKey]['entries'] ?? [])->firstWhere('room_id', $room->id);
                    $occ = $entry ? ($entry['class_name'] ?? 'Kelas lain') : 'Jadwal lain di batch';
                    return ['available' => false, 'occupied_by' => $occ];
                }
            }

            // Cek existing schedules
            foreach ($existingSchedules as $s) {
                if ((int) $s->day_of_week !== $day || (int) $s->room_id !== (int) $room->id) {
                    continue;
                }
                $sStart = (int) $s->period_number;
                $sDuration = (int) ($s->duration_periods ?? 1);
                $sEnd = $sStart + $sDuration - 1;
                if ($sStart <= $endPeriod && $sEnd >= $startPeriod) {
                    $occ = $s->classRoom?->name ?? 'Jadwal tersimpan di DB';
                    return ['available' => false, 'occupied_by' => $occ];
                }
            }

            return ['available' => true, 'occupied_by' => null];
        };

        $kelasRes = $checkAvailabilityWithDetail($roomKelas);
        $jadwalRes = $checkAvailabilityWithDetail($roomJadwal);

        $kelasAvailable = $kelasRes['available'];
        $jadwalAvailable = $jadwalRes['available'];

        $kelasName = $roomKelas ? $roomKelas->name : 'Tidak Terdefinisi';
        $jadwalName = $roomJadwal ? $roomJadwal->name : 'Tidak Terdefinisi';

        $recommendedChoice = null;
        $reason = '';

        if ($jadwalAvailable && !$kelasAvailable) {
            $recommendedChoice = 'jadwal';
            $reason = "Ruangan '{$jadwalName}' ({$labelJadwal}) kosong dan siap digunakan, sedangkan '{$kelasName}' ({$labelKelas}) terisi oleh " . ($kelasRes['occupied_by'] ?? 'jadwal lain') . ".";
        } elseif ($kelasAvailable && !$jadwalAvailable) {
            $recommendedChoice = 'kelas';
            $reason = "Ruangan '{$kelasName}' ({$labelKelas}) kosong dan siap digunakan, sedangkan '{$jadwalName}' ({$labelJadwal}) terisi oleh " . ($jadwalRes['occupied_by'] ?? 'jadwal lain') . ".";
        } elseif ($jadwalAvailable && $kelasAvailable) {
            $recommendedChoice = 'jadwal';
            $reason = "Kedua ruangan ('{$jadwalName}' dan '{$kelasName}') sama-sama tersedia kosong. Disarankan menggunakan '{$jadwalName}' sesuai ketetapan kurikulum.";
        } else {
            $recommendedChoice = 'alternative';
            $reason = "Kedua ruangan ('{$jadwalName}' dan '{$kelasName}') sama-sama sedang terisi oleh jadwal lain pada jam tersebut. Silakan pilih ruangan alternatif.";
        }

        return [
            'room_kelas' => [
                'id' => $roomKelas?->id,
                'name' => $kelasName,
                'label' => $labelKelas,
                'is_available' => $kelasAvailable,
                'occupied_by' => $kelasRes['occupied_by'],
            ],
            'room_jadwal' => [
                'id' => $roomJadwal?->id,
                'name' => $jadwalName,
                'label' => $labelJadwal,
                'is_available' => $jadwalAvailable,
                'occupied_by' => $jadwalRes['occupied_by'],
            ],
            'recommended_choice' => $recommendedChoice,
            'recommendation_text' => $reason,
        ];
    }
}
