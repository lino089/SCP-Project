<?php

namespace App\Services;

use App\Models\AcademicEvent;
use App\Models\Classes;
use App\Models\SystemConfiguration;
use App\Services\AcademicCalendarExclusionService;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use OpenSpout\Reader\XLSX\Reader;

class AcademicEventImportService
{
    private const PREVIEW_TTL_MINUTES = 60;

    /**
     * Peta nama bulan bahasa Indonesia ke nomor bulan (1-12).
     */
    protected array $monthMap = [
        'januari' => 1, 'jan' => 1,
        'februari' => 2, 'pebruari' => 2, 'feb' => 2,
        'maret' => 3, 'mar' => 3,
        'april' => 4, 'apr' => 4,
        'mei' => 5,
        'juni' => 6, 'jun' => 6,
        'juli' => 7, 'jul' => 7,
        'agustus' => 8, 'agu' => 8, 'agt' => 8,
        'september' => 9, 'sept' => 9, 'sep' => 9,
        'oktober' => 10, 'okt' => 10,
        'november' => 11, 'nopember' => 11, 'nov' => 11,
        'desember' => 12, 'des' => 12,
    ];

    public function __construct(
        protected AcademicCalendarExclusionService $exclusionService
    ) {}

    /**
     * Memproses berkas Excel Kaldik dan menghasilkan pratinjau analisis agenda kalender akademik.
     * Tidak mengubah data di database sama sekali.
     *
     * @param UploadedFile|string $file
     * @param int $actorId
     * @return array
     */
    public function generatePreview($file, int $actorId): array
    {
        $filePath = $file instanceof UploadedFile ? $file->getRealPath() : $file;

        if (!file_exists($filePath)) {
            throw ValidationException::withMessages([
                'file' => ['Berkas Excel tidak ditemukan pada server.'],
            ]);
        }

        try {
            $reader = new Reader();
            $reader->open($filePath);
        } catch (\Throwable $e) {
            throw ValidationException::withMessages([
                'file' => ['Format berkas tidak valid atau berkas spreadsheet rusak: ' . $e->getMessage()],
            ]);
        }

        // Ambil baris dari Sheet 'SMK' (atau sheet pertama yang memuat data kalender)
        $targetSheetRows = [];
        $sheetFound = false;

        foreach ($reader->getSheetIterator() as $sheet) {
            $sheetName = strtolower(trim($sheet->getName()));
            if ($sheetName === 'smk') {
                foreach ($sheet->getRowIterator() as $row) {
                    $targetSheetRows[] = $row->toArray();
                }
                $sheetFound = true;
                break;
            }
        }

        // Jika sheet 'SMK' tidak ditemukan secara eksplisit, coba baca sheet pertama
        if (!$sheetFound) {
            $reader->close();
            $reader = new Reader();
            $reader->open($filePath);
            foreach ($reader->getSheetIterator() as $sheet) {
                foreach ($sheet->getRowIterator() as $row) {
                    $targetSheetRows[] = $row->toArray();
                }
                break;
            }
        }
        $reader->close();

        if (empty($targetSheetRows)) {
            throw ValidationException::withMessages([
                'file' => ['Lembar kerja (sheet) pada berkas Excel kosong atau tidak dapat dibaca.'],
            ]);
        }

        // 1. Ekstrak Tahun Ajaran dari Baris Header Atas
        $academicYear = null;
        for ($i = 0; $i < min(5, count($targetSheetRows)); $i++) {
            foreach ($targetSheetRows[$i] as $val) {
                if (is_string($val) && preg_match('/TAHUN\s+(?:AJARAN|PELAJARAN)\s+(\d{4}\s*\/\s*\d{4})/i', $val, $m)) {
                    $academicYear = str_replace(' ', '', $m[1]);
                    break 2;
                }
            }
        }

        if (!$academicYear) {
            $sysConfig = SystemConfiguration::first();
            $academicYear = $sysConfig?->academic_year ?? '2026/2027';
        }

        // 2. Scan blok bulan horizontal (Kolom A = 0, Kolom I = 8, Kolom Q = 16)
        $monthNameRegex = implode('|', array_keys($this->monthMap));
        $blockCols = [0, 8, 16];
        $monthBlocks = [];

        for ($r = 0; $r < count($targetSheetRows); $r++) {
            foreach ($blockCols as $c) {
                $val = trim((string)($targetSheetRows[$r][$c] ?? ''));
                if (preg_match('/^(' . $monthNameRegex . ')\s+(\d{4})$/i', $val, $m)) {
                    $mName = strtolower($m[1]);
                    $monthBlocks[] = [
                        'row' => $r,
                        'col' => $c,
                        'month_num' => $this->monthMap[$mName],
                        'year' => (int)$m[2],
                        'month_name' => ucfirst($mName),
                    ];
                }
            }
        }

        if (empty($monthBlocks)) {
            throw ValidationException::withMessages([
                'file' => ['Format visual Kalender Pendidikan tidak terdeteksi. Pastikan sheet berisi blok bulan (misal: JULI 2026, AGUSTUS 2026, dst.).'],
            ]);
        }

        // Urutkan blok bulan berdasarkan baris lalu kolom
        usort($monthBlocks, function ($a, $b) {
            return $a['row'] === $b['row'] ? $a['col'] <=> $b['col'] : $a['row'] <=> $b['row'];
        });

        // 3. Ekstrak baris keterangan agenda di bawah setiap blok bulan
        $rawExtractedEntries = [];

        for ($idx = 0; $idx < count($monthBlocks); $idx++) {
            $block = $monthBlocks[$idx];
            $startRow = $block['row'] + 1;
            $col = $block['col'];

            // Batas bawah baris untuk blok ini
            $endRow = count($targetSheetRows);
            foreach ($monthBlocks as $other) {
                if ($other['row'] > $block['row']) {
                    $endRow = min($endRow, $other['row']);
                }
            }

            $eventLines = [];
            for ($r = $startRow; $r < $endRow; $r++) {
                $cellVal = trim((string)($targetSheetRows[$r][$col] ?? ''));
                if ($cellVal === '') {
                    continue;
                }

                // Abaikan header nama hari
                if (preg_match('/^(AHAD|SENIN|SELASA|RABU|KAMIS|JUMAT|JUM\'AT|SABTU)$/i', $cellVal)) {
                    continue;
                }

                // Abaikan jika cell hanya berisi angka tanggal tunggal (1..31)
                if (is_numeric($cellVal) && (int)$cellVal >= 1 && (int)$cellVal <= 31) {
                    continue;
                }

                // Abaikan tanda tangan
                if (preg_match('/^(Kepala Sekolah|Bantul,|NIP\.)/i', $cellVal)) {
                    continue;
                }

                $eventLines[] = $cellVal;
            }

            // Gabungkan baris sambungan (multi-row continuation, misal diawali '&' atau tidak ada ':')
            $mergedLines = [];
            foreach ($eventLines as $t) {
                if (empty($mergedLines)) {
                    $mergedLines[] = $t;
                } else {
                    if (preg_match('/^(&|\+)/', $t) || (!str_contains($t, ':') && !preg_match('/^\d/', $t))) {
                        $lastIdx = count($mergedLines) - 1;
                        $mergedLines[$lastIdx] .= ' ' . $t;
                    } else {
                        $mergedLines[] = $t;
                    }
                }
            }

            foreach ($mergedLines as $rawText) {
                if (!str_contains($rawText, ':')) {
                    continue;
                }

                $parts = explode(':', $rawText, 2);
                $dateExpr = trim($parts[0]);
                $titleExpr = trim($parts[1]);

                if (empty($dateExpr) || empty($titleExpr)) {
                    continue;
                }

                $rawExtractedEntries[] = [
                    'block_month' => $block['month_num'],
                    'block_year' => $block['year'],
                    'raw_text' => $rawText,
                    'date_expr' => $dateExpr,
                    'title' => $titleExpr,
                ];
            }
        }

        // 4. Parsing Tanggal, Penanganan Anomali (Opsi A), Koma (Opsi A), Klasifikasi Scope (Opsi A), & Cek Duplikasi
        $items = [];
        $itemCounter = 0;
        $validCount = 0;
        $warningCount = 0;
        $duplicateCount = 0;
        $holidayCount = 0;
        $examCount = 0;
        $schoolEventCount = 0;

        foreach ($rawExtractedEntries as $entry) {
            $parsedDates = $this->parseDateExpression(
                $entry['date_expr'],
                $entry['block_month'],
                $entry['block_year']
            );

            $classification = $this->classifyEvent($entry['title']);

            foreach ($parsedDates as $pd) {
                $itemCounter++;
                $warnings = $pd['warnings'] ?? [];
                $startDate = $pd['start_date'];
                $endDate = $pd['end_date'];

                // Validasi integritas tanggal
                $isDateValid = false;
                if ($startDate && $endDate) {
                    try {
                        $cStart = Carbon::parse($startDate);
                        $cEnd = Carbon::parse($endDate);
                        $isDateValid = $cEnd->greaterThanOrEqualTo($cStart);
                    } catch (\Throwable) {
                        $isDateValid = false;
                    }
                }

                if (!$isDateValid) {
                    $warnings[] = 'Rentang tanggal tidak valid atau format tanggal tidak terbaca.';
                }

                // Cek Duplikasi terhadap database existing
                $existing = null;
                $isDuplicate = false;
                if ($isDateValid) {
                    $existing = AcademicEvent::where('title', $entry['title'])
                        ->where('start_date', $startDate)
                        ->where('end_date', $endDate)
                        ->first();

                    if ($existing) {
                        $isDuplicate = true;
                        $warnings[] = "Agenda serupa sudah ada di database (ID #{$existing->id}).";
                        $duplicateCount++;
                    }
                }

                $status = 'valid';
                if (!$isDateValid) {
                    $status = 'error';
                } elseif (!empty($warnings)) {
                    $status = 'needs_review';
                    $warningCount++;
                } else {
                    $validCount++;
                }

                // Hitung KPI tipe event
                match ($classification['type']) {
                    AcademicEvent::TYPE_HOLIDAY => $holidayCount++,
                    AcademicEvent::TYPE_EXAM => $examCount++,
                    default => $schoolEventCount++,
                };

                $items[] = [
                    'id' => 'item_' . $itemCounter,
                    'title' => $entry['title'],
                    'description' => null,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'type' => $classification['type'],
                    'scope_type' => $classification['scope_type'],
                    'scope_targets' => $classification['scope_targets'],
                    'disables_teaching' => $classification['disables_teaching'],
                    'academic_year' => $academicYear,
                    'raw_text' => $entry['raw_text'],
                    'status' => $status,
                    'warnings' => $warnings,
                    'is_duplicate' => $isDuplicate,
                    'existing_event_id' => $existing?->id,
                    'is_selected' => $status !== 'error',
                ];
            }
        }

        // 5. Simpan Hasil Preview ke Cache selama 60 menit
        $previewToken = (string) Str::uuid();
        $cachePayload = [
            'token' => $previewToken,
            'academic_year' => $academicYear,
            'actor_id' => $actorId,
            'items' => $items,
            'created_at' => now()->toIso8601String(),
        ];

        Cache::put("academic_event_import_preview:{$previewToken}", $cachePayload, now()->addMinutes(self::PREVIEW_TTL_MINUTES));

        return [
            'preview_token' => $previewToken,
            'academic_year' => $academicYear,
            'summary' => [
                'total_events' => count($items),
                'valid_count' => $validCount,
                'warning_count' => $warningCount,
                'duplicate_count' => $duplicateCount,
                'holiday_count' => $holidayCount,
                'exam_count' => $examCount,
                'school_event_count' => $schoolEventCount,
            ],
            'items' => $items,
        ];
    }

    /**
     * Menyimpan data agenda hasil konfirmasi preview ke database secara atomik.
     *
     * @param string $previewToken
     * @param array $confirmedItems
     * @param int $actorId
     * @param string $duplicateMode 'skip' | 'update'
     * @return array
     */
    public function commit(string $previewToken, array $confirmedItems, int $actorId, string $duplicateMode = 'skip'): array
    {
        $cacheKey = "academic_event_import_preview:{$previewToken}";
        $cachedData = Cache::get($cacheKey);

        if (!$cachedData) {
            throw ValidationException::withMessages([
                'preview_token' => ['Sesi pratinjau import telah kedaluwarsa atau tidak valid. Silakan unggah ulang file Excel.'],
            ]);
        }

        // Lock Idempotency untuk mencegah double-submit
        $lockKey = "academic_event_import_commit_lock:{$previewToken}";
        if (!Cache::add($lockKey, true, now()->addSeconds(30))) {
            throw ValidationException::withMessages([
                'preview_token' => ['Permintaan import sedang diproses. Mohon tunggu beberapa saat.'],
            ]);
        }

        try {
            $createdCount = 0;
            $updatedCount = 0;
            $skippedCount = 0;

            DB::transaction(function () use ($confirmedItems, $actorId, $duplicateMode, &$createdCount, &$updatedCount, &$skippedCount) {
                foreach ($confirmedItems as $item) {
                    $isSelected = filter_var($item['is_selected'] ?? true, FILTER_VALIDATE_BOOLEAN);
                    if (!$isSelected) {
                        $skippedCount++;
                        continue;
                    }

                    $title = trim((string)($item['title'] ?? ''));
                    $startDate = trim((string)($item['start_date'] ?? ''));
                    $endDate = trim((string)($item['end_date'] ?? ''));
                    $type = trim((string)($item['type'] ?? 'school_event'));
                    $scopeType = trim((string)($item['scope_type'] ?? 'all'));
                    $scopeTargets = $item['scope_targets'] ?? null;
                    $disablesTeaching = filter_var($item['disables_teaching'] ?? false, FILTER_VALIDATE_BOOLEAN);
                    $academicYear = trim((string)($item['academic_year'] ?? ''));
                    $description = isset($item['description']) && trim((string)$item['description']) !== ''
                        ? trim((string)$item['description'])
                        : null;

                    // Validasi Dasar per Item
                    if (empty($title) || empty($startDate) || empty($endDate)) {
                        continue;
                    }

                    if (!in_array($type, AcademicEvent::TYPES, true)) {
                        $type = AcademicEvent::TYPE_SCHOOL_EVENT;
                    }

                    if (!in_array($scopeType, AcademicEvent::SCOPES, true)) {
                        $scopeType = AcademicEvent::SCOPE_ALL;
                        $scopeTargets = null;
                    }

                    // Normalisasi scope_targets
                    if ($scopeType === AcademicEvent::SCOPE_ALL) {
                        $scopeTargets = null;
                    } elseif ($scopeType === AcademicEvent::SCOPE_GRADE) {
                        $normalizedGrades = [];
                        foreach ((array)$scopeTargets as $target) {
                            $norm = $this->exclusionService->normalizeGrade((string)$target);
                            if (in_array($norm, ['10', '11', '12'], true)) {
                                $normalizedGrades[] = $norm;
                            }
                        }
                        $scopeTargets = !empty($normalizedGrades) ? array_values(array_unique($normalizedGrades)) : ['10', '11', '12'];
                    } elseif ($scopeType === AcademicEvent::SCOPE_CLASS) {
                        $intTargets = array_values(array_unique(array_map('intval', (array)$scopeTargets)));
                        $scopeTargets = !empty($intTargets) ? $intTargets : null;
                        if (empty($scopeTargets)) {
                            $scopeType = AcademicEvent::SCOPE_ALL;
                        }
                    }

                    $isDuplicate = filter_var($item['is_duplicate'] ?? false, FILTER_VALIDATE_BOOLEAN);
                    $existingEventId = !empty($item['existing_event_id']) ? (int)$item['existing_event_id'] : null;

                    if ($isDuplicate && $existingEventId) {
                        if ($duplicateMode === 'skip') {
                            $skippedCount++;
                            continue;
                        }

                        // Mode Update (Overwrite)
                        $existingEvent = AcademicEvent::find($existingEventId);
                        if ($existingEvent) {
                            $existingEvent->update([
                                'title' => $title,
                                'description' => $description,
                                'start_date' => $startDate,
                                'end_date' => $endDate,
                                'type' => $type,
                                'scope_type' => $scopeType,
                                'scope_targets' => $scopeTargets,
                                'disables_teaching' => $disablesTeaching,
                                'academic_year' => $academicYear ?: $existingEvent->academic_year,
                            ]);
                            $updatedCount++;
                            continue;
                        }
                    }

                    // Buat Record Baru
                    AcademicEvent::create([
                        'title' => $title,
                        'description' => $description,
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'type' => $type,
                        'scope_type' => $scopeType,
                        'scope_targets' => $scopeTargets,
                        'disables_teaching' => $disablesTeaching,
                        'academic_year' => $academicYear ?: null,
                        'created_by' => $actorId,
                    ]);
                    $createdCount++;
                }
            });

            // Bersihkan cache eksklusi kalender agar seluruh perubahan langsung berdampak ke KBM
            AcademicCalendarExclusionService::clearCache();

            // Hapus preview session dari Cache
            Cache::forget($cacheKey);

            return [
                'created' => $createdCount,
                'updated' => $updatedCount,
                'skipped' => $skippedCount,
                'total' => $createdCount + $updatedCount + $skippedCount,
            ];
        } finally {
            Cache::forget($lockKey);
        }
    }

    /**
     * Mem-parsing string ekspresi tanggal menjadi array rentang tanggal terformat (Y-m-d).
     * Menerapkan Keputusan 1 (Opsi A) dan Keputusan 2 (Opsi A).
     */
    public function parseDateExpression(string $dateExpr, int $blockMonth, int $blockYear): array
    {
        $expr = trim($dateExpr);
        $warnings = [];

        // Deteksi jika ada angka tahun tertulis di dalam teks
        $yearInText = null;
        if (preg_match('/\b(20\d{2})\b/', $expr, $ym)) {
            $yearInText = (int)$ym[1];
            if ($yearInText !== $blockYear) {
                // Keputusan 1: Opsi A - Tetap gunakan tahun dari Header Blok Bulan, sertakan peringatan
                $warnings[] = "Tahun tertulis '{$yearInText}' berbeda dengan tahun blok kalender '{$blockYear}'. Menggunakan tahun '{$blockYear}'.";
            }
        }

        $targetYear = $blockYear;

        // Deteksi bulan di dalam teks jika ada
        $monthInText = null;
        foreach ($this->monthMap as $mName => $mNum) {
            if (preg_match('/\b' . preg_quote($mName, '/') . '\b\.?/i', $expr)) {
                $monthInText = $mNum;
                break;
            }
        }
        $targetMonth = $monthInText ?? $blockMonth;
        if ($yearInText === null) {
            $warnings[] = "Tahun tidak dicantumkan pada teks agenda. Menggunakan tahun blok kalender '{$blockYear}'.";
        }

        // Bersihkan nama bulan dan tahun dari string agar tersisa angka dan pemisah
        $cleanExpr = $expr;
        if ($yearInText) {
            $cleanExpr = preg_replace('/\b' . $yearInText . '\b/', '', $cleanExpr);
        }
        foreach (array_keys($this->monthMap) as $mName) {
            $cleanExpr = preg_replace('/\b' . preg_quote($mName, '/') . '\b\.?/i', '', $cleanExpr);
        }
        $cleanExpr = trim(preg_replace('/\s+/', ' ', $cleanExpr));

        // Case 1: Terpisah koma non-kontigu, misal "26, 28" (Keputusan 2: Opsi A - pecah jadi 2 event terpisah)
        if (preg_match('/^(\d{1,2})\s*,\s*(\d{1,2})$/', $cleanExpr, $m)) {
            $d1 = (int)$m[1];
            $d2 = (int)$m[2];
            $date1 = sprintf('%04d-%02d-%02d', $targetYear, $targetMonth, $d1);
            $date2 = sprintf('%04d-%02d-%02d', $targetYear, $targetMonth, $d2);
            return [
                [
                    'start_date' => $date1,
                    'end_date' => $date1,
                    'warnings' => array_merge($warnings, ["Dipecah dari tanggal koma '{$m[1]} & {$m[2]}' agar tanggal di antaranya tidak ikut diliburkan."]),
                ],
                [
                    'start_date' => $date2,
                    'end_date' => $date2,
                    'warnings' => array_merge($warnings, ["Dipecah dari tanggal koma '{$m[1]} & {$m[2]}' agar tanggal di antaranya tidak ikut diliburkan."]),
                ],
            ];
        }

        // Case 2: Rentang tanda hubung "1 - 10" atau "27-31"
        if (preg_match('/^(\d{1,2})\s*-\s*(\d{1,2})$/', $cleanExpr, $m)) {
            $dStart = (int)$m[1];
            $dEnd = (int)$m[2];
            return [[
                'start_date' => sprintf('%04d-%02d-%02d', $targetYear, $targetMonth, $dStart),
                'end_date' => sprintf('%04d-%02d-%02d', $targetYear, $targetMonth, $dEnd),
                'warnings' => $warnings,
            ]];
        }

        // Case 3: Rentang "s.d" atau "s/d", misal "14 s.d 18"
        if (preg_match('/^(\d{1,2})\s*(?:s\.?d\.?|s\/d)\s*(\d{1,2})$/i', $cleanExpr, $m)) {
            $dStart = (int)$m[1];
            $dEnd = (int)$m[2];
            return [[
                'start_date' => sprintf('%04d-%02d-%02d', $targetYear, $targetMonth, $dStart),
                'end_date' => sprintf('%04d-%02d-%02d', $targetYear, $targetMonth, $dEnd),
                'warnings' => $warnings,
            ]];
        }

        // Case 4: Tanggal tunggal, misal "13"
        if (preg_match('/^(\d{1,2})$/', $cleanExpr, $m)) {
            $d = (int)$m[1];
            $date = sprintf('%04d-%02d-%02d', $targetYear, $targetMonth, $d);
            return [[
                'start_date' => $date,
                'end_date' => $date,
                'warnings' => $warnings,
            ]];
        }

        // Fallback: Tidak dapat dipetakan secara otomatis
        return [[
            'start_date' => null,
            'end_date' => null,
            'warnings' => array_merge($warnings, ["Format tanggal '{$dateExpr}' tidak dapat diurai secara otomatis."]),
        ]];
    }

    /**
     * Mengklasifikasikan kategori agenda, cakupan tingkat (scope_type), dan dampak KBM.
     * Menerapkan Keputusan 3 (Opsi A).
     */
    public function classifyEvent(string $title): array
    {
        $t = strtolower($title);

        $type = AcademicEvent::TYPE_SCHOOL_EVENT;
        $disablesTeaching = false;
        $scopeType = AcademicEvent::SCOPE_ALL;
        $scopeTargets = null;

        // 1. Kategori & Dampak KBM
        if (preg_match('/\b(libur|cuti bersama|hari raya|tahun baru|kemerdekaan|maulid|isra mi\'raj|imlek|nyepi|idul fitri|idul adha|waisak|wafat|kebangkitan|kenaikan isa|hari buruh|lahir pancasila)\b/i', $t)) {
            $type = AcademicEvent::TYPE_HOLIDAY;
            $disablesTeaching = true;
        } elseif (preg_match('/\b(psts|psas|usek|ukk|tka|an|toeic|simulasi|gladi bersih|ujian|tes susulan)\b/i', $t)) {
            $type = AcademicEvent::TYPE_EXAM;
            $disablesTeaching = true;
        } elseif (preg_match('/\b(hari pertama|hari i masuk|awal masuk|mpls|hari guru|rapor|penerjunan|penarikan|pkl|hari jadi|kelulusan)\b/i', $t)) {
            $type = AcademicEvent::TYPE_SCHOOL_EVENT;
            $disablesTeaching = false;
        }

        // 2. Cakupan Tingkat (Scope Type - Keputusan 3: Opsi A)
        $hasX = preg_match('/\b(?:kelas|kls)?\s*x\b(?!i)/i', $t);
        $hasXI = preg_match('/\b(?:kelas|kls)?\s*xi\b/i', $t);
        $hasXII = preg_match('/\b(?:kelas|kls)?\s*xii\b/i', $t);

        $matchedGrades = [];
        if ($hasX) $matchedGrades[] = '10';
        if ($hasXI) $matchedGrades[] = '11';
        if ($hasXII) $matchedGrades[] = '12';

        if (count($matchedGrades) === 3) {
            $scopeType = AcademicEvent::SCOPE_ALL;
            $scopeTargets = null;
        } elseif (count($matchedGrades) > 0) {
            $scopeType = AcademicEvent::SCOPE_GRADE;
            $scopeTargets = $matchedGrades;
        } else {
            $scopeType = AcademicEvent::SCOPE_ALL;
            $scopeTargets = null;
        }

        return [
            'type' => $type,
            'disables_teaching' => $disablesTeaching,
            'scope_type' => $scopeType,
            'scope_targets' => $scopeTargets,
        ];
    }
}
