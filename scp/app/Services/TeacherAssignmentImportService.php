<?php

namespace App\Services;

use App\Models\Classes;
use App\Models\TeacherAssignment;
use App\Models\User;
use App\Services\TeacherMatcherService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Spatie\SimpleExcel\SimpleExcelReader;

class TeacherAssignmentImportService
{
    private const PREVIEW_TTL_MINUTES = 60;
    private const SIMILARITY_THRESHOLD = 75.0; // Persentase ambang batas kemiripan nama

    /**
     * Memproses berkas Excel penugasan dan menghasilkan pratinjau analisis pemetaan.
     * Tidak mengubah data di database sama sekali.
     *
     * @param UploadedFile|string $file
     * @return array
     */
    public function generatePreview($file): array
    {
        $filePath = $file instanceof UploadedFile ? $file->getRealPath() : $file;

        if (!file_exists($filePath)) {
            throw ValidationException::withMessages([
                'file' => ['Berkas Excel tidak ditemukan pada server.'],
            ]);
        }

        // 1. Muat seluruh Master Kelas dan Master Guru dari Database
        $dbClasses = Classes::all();
        $classMap = [];
        foreach ($dbClasses as $c) {
            $classMap[$this->normalizeClassName($c->name)] = $c;
        }

        $dbTeachers = User::where('role', 'teacher')->get();

        // 2. Baca baris Excel menggunakan SimpleExcelReader
        try {
            $reader = SimpleExcelReader::create($filePath, 'xlsx')->noHeaderRow();
            $rows = $reader->getRows();
        } catch (\Throwable $e) {
            throw ValidationException::withMessages([
                'file' => ['Format berkas tidak valid atau berkas spreadsheet rusak: ' . $e->getMessage()],
            ]);
        }

        $previewRows = [];
        $rowCounter = 0;
        $exactCount = 0;
        $fuzzyCount = 0;
        $ambiguousCount = 0;
        $unmatchedCount = 0;

        foreach ($rows as $r) {
            $rowCounter++;

            $c0 = trim((string)($r[0] ?? ''));
            $c1 = trim((string)($r[1] ?? ''));
            $c2 = trim((string)($r[2] ?? ''));
            $c3 = trim((string)($r[3] ?? ''));

            // Filter baris data: hanya baris yang memiliki nomor urut integer 1..100 dan nama kelas & guru
            if (!is_numeric($c0) || (int)$c0 < 1 || empty($c1) || empty($c2) || empty($c3)) {
                continue;
            }

            $cleanClass = $this->normalizeClassName($c1);
            $matchedClass = $classMap[$cleanClass] ?? null;

            // Pencocokan Wali Kelas
            $waliMatch = $this->matchTeacher($c2, $dbTeachers);
            // Pencocokan Guru BK
            $bkMatch = $this->matchTeacher($c3, $dbTeachers);

            // Klasifikasi statistik
            if ($waliMatch['status'] === 'matched' && $bkMatch['status'] === 'matched') {
                $exactCount++;
            } elseif ($waliMatch['status'] === 'not_found' || $bkMatch['status'] === 'not_found' || !$matchedClass) {
                $unmatchedCount++;
            } elseif ($waliMatch['status'] === 'ambiguous' || $bkMatch['status'] === 'ambiguous') {
                $ambiguousCount++;
            } else {
                $fuzzyCount++;
            }

            $previewRows[] = [
                'row_number' => $rowCounter,
                'no' => (int)$c0,
                'raw_class' => $c1,
                'clean_class' => $cleanClass,
                'class_id' => $matchedClass?->id,
                'class_status' => $matchedClass ? 'matched' : 'not_found',
                'wali_kelas' => $waliMatch,
                'guru_bk' => $bkMatch,
            ];
        }

        if (empty($previewRows)) {
            throw ValidationException::withMessages([
                'file' => ['Tidak ditemukan baris data penugasan kelas yang valid pada berkas Excel ini.'],
            ]);
        }

        // 3. Simpan data preview di Cache dengan preview_token
        $previewToken = (string) Str::uuid();
        $expiresAt = now()->addMinutes(self::PREVIEW_TTL_MINUTES);

        $payload = [
            'token' => $previewToken,
            'summary' => [
                'total_rows' => count($previewRows),
                'exact_matched' => $exactCount,
                'fuzzy_matched' => $fuzzyCount,
                'ambiguous' => $ambiguousCount,
                'unmatched' => $unmatchedCount,
                'ready_to_commit' => ($unmatchedCount === 0 && $ambiguousCount === 0),
            ],
            'rows' => $previewRows,
            'created_at' => now()->toIso8601String(),
            'expires_at' => $expiresAt->toIso8601String(),
        ];

        Cache::put("teacher_assignment_preview_{$previewToken}", $payload, $expiresAt);

        return [
            'preview_token' => $previewToken,
            'expires_at' => $expiresAt->toIso8601String(),
            'summary' => $payload['summary'],
            'data' => $previewRows,
        ];
    }

    /**
     * Menyimpan hasil konfirmasi penugasan ke database secara atomik.
     *
     * @param string $previewToken
     * @param array $items Array of ['class_id' => int, 'wali_teacher_id' => int, 'bk_teacher_id' => int]
     * @return array
     */
    public function commit(string $previewToken, array $items): array
    {
        // 1. Verifikasi Idempotency Lock
        $lockKey = "teacher_assignment_lock_{$previewToken}";
        $isLocked = Cache::get($lockKey);
        if ($isLocked) {
            abort(409, 'Token preview ini sedang diproses atau sudah pernah di-commit sebelumnya.');
        }

        // 2. Ambil data preview dari Cache
        $cacheKey = "teacher_assignment_preview_{$previewToken}";
        $previewData = Cache::get($cacheKey);

        if (!$previewData) {
            abort(410, 'Sesi preview telah kedaluwarsa atau tidak valid. Silakan unggah ulang berkas Excel.');
        }

        if (empty($items)) {
            throw ValidationException::withMessages([
                'items' => ['Daftar pemetaan penugasan tidak boleh kosong.'],
            ]);
        }

        // Pasang lock sementara (5 menit)
        Cache::put($lockKey, true, now()->addMinutes(5));

        try {
            return DB::transaction(function () use ($items, $previewToken, $cacheKey) {
                // 3. Validasi Integritas Data Items
                $classesCount = count($items);
                $waliTeacherIds = [];
                $classIds = [];

                foreach ($items as $index => $item) {
                    $classId = (int)($item['class_id'] ?? 0);
                    $waliId = (int)($item['wali_teacher_id'] ?? 0);
                    $bkId = (int)($item['bk_teacher_id'] ?? 0);

                    if (!$classId || !$waliId || !$bkId) {
                        throw ValidationException::withMessages([
                            "items.{$index}" => ['Setiap baris wajib memiliki class_id, wali_teacher_id, dan bk_teacher_id yang valid.'],
                        ]);
                    }

                    // Cek duplikasi Wali Kelas di dalam payload
                    if (in_array($waliId, $waliTeacherIds, true)) {
                        $teacherName = User::find($waliId)?->name ?? "ID #{$waliId}";
                        throw ValidationException::withMessages([
                            "items.{$index}.wali_teacher_id" => ["Guru '{$teacherName}' ditugaskan sebagai Wali Kelas di lebih dari satu kelas pada data import."],
                        ]);
                    }
                    $waliTeacherIds[] = $waliId;

                    // Cek duplikasi Kelas di dalam payload
                    if (in_array($classId, $classIds, true)) {
                        throw ValidationException::withMessages([
                            "items.{$index}.class_id" => ["Terdapat duplikasi kelas ID {$classId} di dalam data import."],
                        ]);
                    }
                    $classIds[] = $classId;
                }

                // 4. Verifikasi Keberadaan Kelas dan Guru di Database
                $validClassCount = Classes::whereIn('id', $classIds)->count();
                if ($validClassCount !== count($classIds)) {
                    throw ValidationException::withMessages([
                        'items' => ['Beberapa kelas di dalam data import tidak ditemukan di database.'],
                    ]);
                }

                $allTeacherIds = array_unique(array_merge($waliTeacherIds, array_column($items, 'bk_teacher_id')));
                $validTeacherCount = User::where('role', 'teacher')->whereIn('id', $allTeacherIds)->count();
                if ($validTeacherCount !== count($allTeacherIds)) {
                    throw ValidationException::withMessages([
                        'items' => ['Beberapa ID guru di dalam data import tidak ditemukan di master guru aktif.'],
                    ]);
                }

                // 5. Validasi Aturan Bisnis 1 Guru 1 Wali Kelas terhadap Database
                // Cek apakah ada guru di $waliTeacherIds yang sudah menjadi wali kelas di kelas LAIN di luar data yang di-commit
                $conflictingTeacherWali = TeacherAssignment::where('type', 'wali_kelas')
                    ->whereIn('user_id', $waliTeacherIds)
                    ->whereNotIn('class_id', $classIds)
                    ->with('teacher:id,name')
                    ->first();

                if ($conflictingTeacherWali) {
                    $tName = $conflictingTeacherWali->teacher?->name ?? "Guru ID #{$conflictingTeacherWali->user_id}";
                    throw ValidationException::withMessages([
                        'items' => ["Guru '{$tName}' sudah menjadi wali kelas di kelas lain di luar data import ini."],
                    ]);
                }

                // 6. Eksekusi Penyimpanan Atomik Penugasan per Kelas
                $waliCount = 0;
                $bkCount = 0;

                foreach ($items as $item) {
                    $classId = (int)$item['class_id'];
                    $waliId = (int)$item['wali_teacher_id'];
                    $bkId = (int)$item['bk_teacher_id'];

                    // A. Penugasan Wali Kelas:
                    // Hapus penugasan wali kelas lama pada kelas ini jika ada guru lain yang menjabat
                    TeacherAssignment::where('type', 'wali_kelas')
                        ->where('class_id', $classId)
                        ->where('user_id', '!=', $waliId)
                        ->delete();

                    // Simpan / Perbarui wali kelas aktif
                    TeacherAssignment::updateOrCreate(
                        ['type' => 'wali_kelas', 'class_id' => $classId],
                        ['user_id' => $waliId]
                    );
                    $waliCount++;

                    // B. Penugasan Guru BK / Kesiswaan:
                    // Pastikan penugasan kesiswaan untuk kelas ini tersimpan
                    TeacherAssignment::firstOrCreate([
                        'user_id' => $bkId,
                        'type' => 'kesiswaan',
                        'class_id' => $classId,
                    ]);
                    $bkCount++;
                }

                // Hapus data cache preview setelah sukses commit
                Cache::forget($cacheKey);

                return [
                    'total_classes_processed' => $classesCount,
                    'wali_kelas_assigned' => $waliCount,
                    'bk_assigned' => $bkCount,
                ];
            });
        } catch (\Throwable $e) {
            // Hapus lock jika terjadi error saat transaksi
            Cache::forget($lockKey);
            throw $e;
        }
    }

    /**
     * Normalisasi string nama kelas agar seragam dengan database.
     * Contoh: "X AK1" -> "X AK 1", "X  DKV   2" -> "X DKV 2"
     */
    public function normalizeClassName(string $name): string
    {
        $n = trim($name);
        // Sisipkan spasi jika ada huruf langsung diikuti angka (misal "AK1" -> "AK 1")
        $n = preg_replace('/([A-Za-z]+)(\d+)/', '$1 $2', $n);
        // Hapus spasi berlebih
        return preg_replace('/\s+/', ' ', trim($n));
    }

    /**
     * Normalisasi nama guru untuk keperluan perbandingan.
     * Menghapus tanda baca, gelar standar, dan mengubah ke lowercase.
     */
    public function normalizeTeacherName(string $name): string
    {
        $n = mb_strtolower($name);
        // Hapus tanda baca titik dan koma
        $n = preg_replace('/[.,]/', ' ', $n);
        // Hapus spasi ganda
        return preg_replace('/\s+/', ' ', trim($n));
    }

    /**
     * Pencocokan cerdas 3-Tier antara nama guru dari Excel dengan Master Guru database.
     *
     * @param string $rawName
     * @param iterable $dbTeachers
     * @return array
     */
    private function matchTeacher(string $rawName, $dbTeachers): array
    {
        $matcher = new TeacherMatcherService();
        $result = $matcher->match($dbTeachers, $rawName);

        if ($result['status'] === 'exact' && $result['matched_teacher']) {
            $t = $result['matched_teacher'];
            return [
                'raw_name' => $rawName,
                'status' => 'matched',
                'matched_teacher' => [
                    'id' => $t->id,
                    'name' => $t->name,
                    'nis_nip' => $t->nis_nip,
                ],
                'candidates' => [],
                'confidence' => 1.0,
                'match_reason' => 'Cocok pasti nama dan gelar',
            ];
        }

        $candidates = $result['candidates'];

        if (count($candidates) === 1) {
            $top = $candidates[0];
            return [
                'raw_name' => $rawName,
                'status' => 'fuzzy_match',
                'matched_teacher' => [
                    'id' => $top['id'],
                    'name' => $top['name'],
                    'nis_nip' => $top['nis_nip'],
                ],
                'candidates' => [
                    [
                        'id' => $top['id'],
                        'name' => $top['name'],
                        'nis_nip' => $top['nis_nip'],
                    ]
                ],
                'confidence' => round($top['similarity'] / 100, 2),
                'match_reason' => $top['match_reason'] ?? "Rekomendasi kemiripan nama ({$top['similarity']}%)",
            ];
        }

        if (count($candidates) > 1) {
            $top = $candidates[0];
            $second = $candidates[1];
            // Jika kandidat pertama memiliki skor dominan (misal >= 95% dan selisih >= 15% dari kandidat kedua),
            // tetapkan status fuzzy_match dengan auto-select kandidat pertama
            $isDominantWinner = ($top['similarity'] >= 95.0 && ($top['similarity'] - $second['similarity']) >= 15.0);

            $formattedCandidates = array_map(fn($c) => [
                'id' => $c['id'],
                'name' => $c['name'],
                'nis_nip' => $c['nis_nip'],
            ], $candidates);

            return [
                'raw_name' => $rawName,
                'status' => $isDominantWinner ? 'fuzzy_match' : 'ambiguous',
                'matched_teacher' => $isDominantWinner ? [
                    'id' => $top['id'],
                    'name' => $top['name'],
                    'nis_nip' => $top['nis_nip'],
                ] : null,
                'candidates' => $formattedCandidates,
                'confidence' => round($top['similarity'] / 100, 2),
                'match_reason' => $isDominantWinner
                    ? ($top['match_reason'] ?? "Rekomendasi kemiripan nama ({$top['similarity']}%)")
                    : ('Ditemukan ' . count($candidates) . ' kandidat dengan kemiripan nama'),
            ];
        }

        // Tier 3: Data Tidak Ditemukan -> not_found (Merah)
        return [
            'raw_name' => $rawName,
            'status' => 'not_found',
            'matched_teacher' => null,
            'candidates' => [],
            'confidence' => 0.0,
            'match_reason' => 'Nama guru tidak ditemukan pada master guru aktif',
        ];
    }
}
