<?php

namespace App\Services;

use App\Models\User;

class TeacherMatcherService
{
    public const SIMILARITY_THRESHOLD = 65.0; // Minimal 65% kemiripan untuk ditampilkan sebagai kandidat

    /**
     * Pemetaan nama panggilan / alias dokumen jadwal atau penugasan
     * ke nama resmi pegawai di Master Data (Dapodik / Karis).
     */
    private const KNOWN_TEACHER_ALIASES = [
        'TATIK HERAWATI' => 'WARASTITIN ILMIAWATI',
    ];

    private array $memoryCache = [];

    /**
     * Cari kecocokan pasti atau kandidat kemiripan nama guru dari master data guru.
     *
     * @param iterable<User> $dbTeachers
     * @param string|null $rawName
     * @return array{
     *     matched_teacher: User|null,
     *     candidates: array<array{id: int, name: string, nis_nip: string|null, similarity: float, match_reason: string}>,
     *     status: 'exact'|'candidates_found'|'not_found'
     * }
     */
    public function match(iterable $dbTeachers, ?string $rawName): array
    {
        if (!$rawName || trim($rawName) === '') {
            return [
                'matched_teacher' => null,
                'candidates' => [],
                'status' => 'not_found',
            ];
        }

        $cleanRaw = trim($rawName);
        if (isset($this->memoryCache[$cleanRaw])) {
            return $this->memoryCache[$cleanRaw];
        }

        $upperRaw = mb_strtoupper($cleanRaw);

        // 1. Tier 1: Exact Match (Case-insensitive pada teks penuh)
        foreach ($dbTeachers as $t) {
            if (mb_strtoupper(trim($t->name)) === $upperRaw) {
                $result = [
                    'matched_teacher' => $t,
                    'candidates' => [],
                    'status' => 'exact',
                ];
                $this->memoryCache[$cleanRaw] = $result;
                return $result;
            }
        }

        // 2. Jika tidak exact match: ekstrak Core Name & cari kandidat
        // Sesuai konfirmasi Waka: perbedaan gelar/ejaan tetap meminta Waka memilih/konfirmasi
        // sehingga matched_teacher = null, tetapi kandidat disediakan.
        $targetCore = $this->extractCoreName($cleanRaw);
        $targetPhonetic = $this->normalizePhonetic($targetCore);
        $upperCore = mb_strtoupper($targetCore);

        // Periksa apakah nama input terdaftar pada kamus alias resmi
        $aliasDbTarget = null;
        foreach (self::KNOWN_TEACHER_ALIASES as $aliasFrom => $aliasTo) {
            if ($upperCore === mb_strtoupper($aliasFrom) || stripos($upperCore, mb_strtoupper($aliasFrom)) !== false) {
                $aliasDbTarget = mb_strtoupper($aliasTo);
                break;
            }
        }

        $candidates = [];

        foreach ($dbTeachers as $t) {
            $dbName = trim($t->name);
            $dbCore = $this->extractCoreName($dbName);
            $dbPhonetic = $this->normalizePhonetic($dbCore);

            $similarity = 0.0;
            $reason = '';

            // A0. Alias Resmi (misal: TATIK HERAWATI -> WARASTITIN ILMIAWATI, S.Pd)
            if ($aliasDbTarget && (mb_strtoupper($dbCore) === $aliasDbTarget || stripos(mb_strtoupper($t->name), $aliasDbTarget) !== false)) {
                $similarity = 98.0;
                $reason = "Padanan nama resmi di Master Data: {$t->name} (dari alias '{$cleanRaw}')";
            }
            // A. Core Name Identik (Hanya beda gelar, misal M.S.I vs S.Pd.)
            elseif ($targetCore !== '' && mb_strtoupper($targetCore) === mb_strtoupper($dbCore)) {
                $similarity = 98.0;
                $reason = "Nama dasar identik, perbedaan pada gelar (misal: S.Pd. vs M.S.I.)";
            }
            // B. Phonetic / Normalized Ejaan Identik (misal: MUHAMMAD vs MUHAMAD, ACHMAD vs AHMAD)
            elseif ($targetPhonetic !== '' && $targetPhonetic === $dbPhonetic) {
                $similarity = 95.0;
                $reason = "Kemiripan variasi ejaan nama dasar (misal: Muhammad/Muhamad)";
            }
            // C. Fuzzy Similarity (Levenshtein, similar_text, Jaccard token overlap)
            else {
                // similar_text pada phonetic
                similar_text($targetPhonetic, $dbPhonetic, $simPhonetic);
                // similar_text pada core name
                similar_text(mb_strtolower($targetCore), mb_strtolower($dbCore), $simCore);

                // Levenshtein pada core name
                $maxLen = max(mb_strlen($targetCore), mb_strlen($dbCore));
                $levDist = levenshtein(mb_strtolower($targetCore), mb_strtolower($dbCore));
                $levScore = $maxLen > 0 ? max(0, (1 - ($levDist / $maxLen)) * 100) : 0;

                // Jaccard Token / Word similarity: |A ∩ B| / |A ∪ B|
                // Mencegah subset nama 1 kata (misal "WAHYUNI") mendapatkan skor 100% dari nama 3 kata
                $targetWords = array_values(array_filter(explode(' ', mb_strtolower($targetCore))));
                $dbWords = array_values(array_filter(explode(' ', mb_strtolower($dbCore))));
                $commonWords = array_intersect($targetWords, $dbWords);
                $unionWords = array_unique(array_merge($targetWords, $dbWords));
                $tokenRatio = count($unionWords) > 0 ? (count($commonWords) / count($unionWords)) * 100 : 0;

                // Ambil skor kemiripan tertinggi yang representatif
                $similarity = max($simPhonetic, $simCore, $levScore, $tokenRatio);

                if ($similarity >= self::SIMILARITY_THRESHOLD) {
                    $reason = "Kemiripan nama (" . round($similarity, 1) . "%)";
                }
            }

            if ($similarity >= self::SIMILARITY_THRESHOLD) {
                $candidates[] = [
                    'id' => $t->id,
                    'name' => $t->name,
                    'nis_nip' => $t->nis_nip ?? null,
                    'similarity' => round($similarity, 1),
                    'match_reason' => $reason,
                ];
            }
        }

        // Urutkan dari skor similarity tertinggi
        usort($candidates, fn($a, $b) => $b['similarity'] <=> $a['similarity']);

        // Batasi 5 kandidat teratas
        $candidates = array_slice($candidates, 0, 5);

        $result = [
            'matched_teacher' => null,
            'candidates' => $candidates,
            'status' => count($candidates) > 0 ? 'candidates_found' : 'not_found',
        ];

        $this->memoryCache[$cleanRaw] = $result;
        return $result;
    }

    /**
     * Ekstrak nama inti (Core Name) dengan membuang gelar akademik dan keagamaan.
     */
    public function extractCoreName(string $name): string
    {
        $n = trim($name);

        // 0. Hapus angka urut di awal string (misal: "14. TATIK ...", "29.TATIK ...", "01. ...")
        $n = preg_replace('/^\d+[\.\s\-]+\s*/u', '', $n);

        // 1. Hapus gelar depan umum berulang kali (misal: "H. Drs. ...", "Dra. Hj. ...")
        $prefixPattern = '/^(?:Drs|Dra|Dr|Prof|Ir|H|Hj|KH|K\.H|Ust|Ustadz|Raden|R)\.?\s+/iu';
        while (preg_match($prefixPattern, $n)) {
            $n = preg_replace($prefixPattern, '', $n);
        }

        // 2. Hapus gelar belakang setelah koma atau spasi
        // Contoh: ", S.Pd.", ", M.S.I.", ", S.Kom", " S.Pd", " M.Pd.I", " S.Ag."
        $suffixPattern = '/(?:,\s*|\s+)(?:S|M)\.(?:Pd(?:\.I)?|Kom|T|Si|E|Sos|Ag|Sn|Psi|H|S\.I|Stat|IP|Ked|Pt|Farm)\.?/iu';
        $n = preg_replace($suffixPattern, '', $n);

        // Pola gelar belakang umum lain tanpa titik: Gr, CPS, MM, MSI, MPd, SPd, ST, SE, SAg, MKom
        $otherSuffixPattern = '/(?:,\s*|\s+)(?:Gr|CPS|MM|MSI|MPd|SPd|SKom|ST|SE|SAg|MKom)\b\.?/iu';
        $n = preg_replace($otherSuffixPattern, '', $n);

        // Hapus sisa koma atau titik di akhir
        $n = rtrim($n, ',. ');

        return trim($n);
    }

    /**
     * Normalisasi fonetik dan variasi ejaan umum bahasa Indonesia.
     */
    public function normalizePhonetic(string $name): string
    {
        $s = mb_strtolower($name);

        // Hapus tanda baca
        $s = preg_replace('/[.,\-_]/u', ' ', $s);

        // Normalisasi variasi kata awal populer
        // Muhammad / Muhamad / Mohammad / Mohamad / Moh / Muh -> muhamad
        $s = preg_replace('/\b(?:muham+ad|moham+ad|moh|muh)\b/u', 'muhamad', $s);

        // Achmad / Akhmad / Ahmad -> ahmad
        $s = preg_replace('/\b(?:achmad|akhmad|ahmad|ach|akhm)\b/u', 'ahmad', $s);

        // Syaiful / Saiful -> saiful
        $s = preg_replace('/\bsyaiful\b/u', 'saiful', $s);

        // Khairul / Chairul -> chairul
        $s = preg_replace('/\bkhairul\b/u', 'chairul', $s);

        // Dwi / Dvi -> dwi
        $s = preg_replace('/\bdvi\b/u', 'dwi', $s);

        // Reduksi konsonan rangkap (misal: "ff" -> "f", "ll" -> "l", "mm" -> "m", "tt" -> "t", "ss" -> "s")
        $s = preg_replace('/([a-z])\1+/u', '$1', $s);

        // Hapus spasi ganda
        $s = preg_replace('/\s+/u', ' ', trim($s));

        return $s;
    }
}
