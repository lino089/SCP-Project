<?php

namespace App\Services;

use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class AIService
{
    protected string $baseUrl;
    protected ?string $apiKey;
    protected string $model;
    protected int $timeout;

    protected bool $verifySsl;

    public function __construct()
    {
        $this->baseUrl = config('services.ai.base_url', 'https://9router.wekanz.id/v1');
        $this->apiKey = config('services.ai.api_key');
        $this->model = config('services.ai.model', 'ag/gemini-3.8-flash');
        $this->timeout = (int) config('services.ai.timeout', 45);
        $this->verifySsl = (bool) config('services.ai.verify_ssl', false);
    }

    /**
     * Generate soal kuis berdasarkan prompt dan konfigurasi terstruktur guru (Metode 1).
     *
     * @return array<int, array{question_text: string, question_type: string, options: ?array, correct_answer: string}>
     */
    public function generateFromPrompt(
        string $prompt,
        int $total,
        string $type,
        int $essayCount,
        int $mcCount,
        ?string $difficulty = null,
        ?string $notes = null
    ): array {
        $systemPrompt = <<<SYS
Anda adalah asisten AI pembuat soal ujian sekolah kejuruan (SMK) yang profesional, akurat, dan berstandar kurikulum nasional.
Hasilkan output HANYA berupa array JSON valid tanpa teks pengantar, penutup, atau penjelasan lainnya di luar array JSON.

Format setiap elemen soal dalam array:
- "question_text" (string): Teks pertanyaan yang jelas, lugas, dan relevan.
- "question_type" (string): 'multiple_choice' atau 'essay'.
- "options" (object atau null):
  * Jika 'multiple_choice', objek dengan 4 opsi: {"A": "teks opsi A", "B": "teks opsi B", "C": "teks opsi C", "D": "teks opsi D"}.
  * Jika 'essay', wajib bernilai null.
- "correct_answer" (string):
  * Jika 'multiple_choice', huruf opsi yang benar: 'A', 'B', 'C', atau 'D'.
  * Jika 'essay', rubrik penilaian atau kata kunci konsep penting yang harus ada dalam jawaban siswa.
SYS;

        $userPrompt = "Topik / Instruksi Soal:\n{$prompt}\n\n";
        $userPrompt .= "Konfigurasi Wajib:\n";
        $userPrompt .= "- Total Soal: {$total}\n";
        $userPrompt .= "- Jenis Soal: {$type}\n";
        $userPrompt .= "- Jumlah Pilihan Ganda: {$mcCount}\n";
        $userPrompt .= "- Jumlah Esai: {$essayCount}\n";

        if ($difficulty) {
            $userPrompt .= "- Tingkat Kesulitan: {$difficulty}\n";
        }
        if ($notes) {
            $userPrompt .= "- Catatan Tambahan: {$notes}\n";
        }

        $userPrompt .= "\nATURAN KETAT: Anda WAJIB membuat tepat {$total} butir soal, terdiri dari {$mcCount} soal multiple_choice dan {$essayCount} soal essay. Jangan mengubah komposisi ini.";

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userPrompt],
        ];

        $rawResponse = $this->sendChatCompletion($messages, 0.4);
        $questions = $this->cleanAndParseJson($rawResponse);

        if (!is_array($questions) || empty($questions)) {
            throw new Exception("AI tidak menghasilkan butir soal dalam format JSON yang valid.");
        }

        return $questions;
    }

    /**
     * Ekstraksi soal dari teks dokumen (Metode 2).
     *
     * @return array<int, array{question_text: string, question_type: string, options: ?array, correct_answer: string}>
     */
    public function extractFromDocumentText(string $documentText): array
    {
        $systemPrompt = <<<SYS
Anda adalah asisten AI yang bertugas mengekstrak dan menstrukturkan butir soal dari isi dokumen teks ke dalam format data aplikasi.
Tujuan utama Anda adalah MEMINDAHKAN soal yang sudah ada di dokumen, BUKAN mengarang soal baru.
Pertahankan kalimat pertanyaan asli, konteks soal, pilihan opsi, dan kunci jawaban asli semaksimal mungkin.

Hasilkan output HANYA berupa array JSON valid tanpa teks lain di luar array JSON.

Format setiap elemen soal dalam array:
- "question_text" (string): Teks pertanyaan asli dari dokumen.
- "question_type" (string): 'multiple_choice' atau 'essay'.
- "options" (object atau null):
  * Jika multiple choice: {"A": "...", "B": "...", "C": "...", "D": "..."}.
  * Jika ada bagian opsi/pertanyaan/kunci yang ambigu, tidak terbaca, atau hilang di dokumen, tambahkan key "needs_review": true dan "review_note": "catatan penjelasan bagian yang meragukan".
  * Jika essay tanpa opsi: null (atau {"needs_review": true, "review_note": "..."} jika ambigu).
- "correct_answer" (string): Kunci jawaban yang tertera di dokumen. Jika kunci tidak ditemukan di dokumen, isi dengan estimasi terbaik atau kosongkan, dan tandai needs_review pada options.
SYS;

        $userPrompt = "Berikut adalah isi teks dari dokumen soal:\n\n{$documentText}\n\n";
        $userPrompt .= "Tugas Anda: Ekstrak seluruh butir soal yang terdapat di teks di atas sesuai instruksi. JANGAN mengarang soal baru yang tidak ada pada dokumen.";

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userPrompt],
        ];

        $rawResponse = $this->sendChatCompletion($messages, 0.2);
        $questions = $this->cleanAndParseJson($rawResponse);

        if (!is_array($questions) || empty($questions)) {
            throw new Exception("AI tidak berhasil mengekstrak butir soal dari dokumen ke dalam format JSON.");
        }

        return $questions;
    }

    /**
     * Evaluasi jawaban esai siswa terhadap rubrik kata kunci.
     *
     * @return array{score: float, feedback: string}
     */
    public function gradeEssay(string $questionText, string $rubric, string $studentAnswer): array
    {
        if (trim($studentAnswer) === '') {
            return [
                'score' => 0.0,
                'feedback' => 'Jawaban esai kosong.',
            ];
        }

        $systemPrompt = <<<SYS
Anda adalah guru penilai jawaban esai ujian siswa sekolah menengah kejuruan.
Tugas Anda adalah mengevaluasi kesesuaian dan kelengkapan jawaban siswa terhadap rubrik atau kata kunci yang diberikan.
Berikan skor numerik objektif antara 0.0 sampai 100.0, serta umpan balik (feedback) edukatif dan konstruktif dalam Bahasa Indonesia.

Hasilkan output HANYA berupa objek JSON valid dengan struktur persis:
{"score": 85.5, "feedback": "Penjelasan konsep sangat baik dan mencakup kata kunci utama, namun perlu diperjelas pada aspek implementasinya."}
SYS;

        $userPrompt = "Pertanyaan Esai: {$questionText}\n";
        $userPrompt .= "Rubrik / Kata Kunci Penilaian: {$rubric}\n";
        $userPrompt .= "Jawaban Siswa: {$studentAnswer}\n\n";
        $userPrompt .= "Evaluasi jawaban siswa di atas dan hasilkan JSON skor dan feedback.";

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userPrompt],
        ];

        $rawResponse = $this->sendChatCompletion($messages, 0.2);
        $result = $this->cleanAndParseJson($rawResponse);

        $score = isset($result['score']) ? (float) $result['score'] : 0.0;
        $score = max(0.0, min(100.0, $score));
        $feedback = isset($result['feedback']) ? (string) $result['feedback'] : 'Telah dievaluasi oleh sistem AI.';

        return [
            'score' => round($score, 2),
            'feedback' => $feedback,
        ];
    }

    /**
     * Ekstraksi teks dari file fisik (.txt native atau .pdf via script python pdfplumber).
     */
    public function extractTextFromDocument(string $filePath, string $extension): string
    {
        $ext = strtolower($extension);

        if (in_array($ext, ['txt', 'text', 'md'])) {
            $content = file_get_contents($filePath);
            if ($content === false) {
                throw new Exception("Gagal membaca berkas teks: {$filePath}");
            }
            return trim($content);
        }

        if ($ext === 'pdf') {
            $scriptPath = base_path('script/pdf_doc_extractor.py');
            $process = new Process(['python', $scriptPath, $filePath]);
            $process->setTimeout(60);
            $process->run();

            if (!$process->isSuccessful()) {
                Log::error('PDF Extractor Error: ' . $process->getErrorOutput());
                throw new Exception("Gagal mengekstrak berkas PDF: " . $process->getErrorOutput());
            }

            $output = $process->getOutput();
            $decoded = json_decode($output, true);

            if (isset($decoded['success']) && $decoded['success'] === true && !empty($decoded['text'])) {
                return trim($decoded['text']);
            }

            $err = $decoded['error'] ?? 'PDF tidak memuat teks yang dapat diekstrak.';
            throw new Exception("Gagal mengekstrak teks PDF: {$err}");
        }

        throw new Exception("Format berkas .{$ext} tidak didukung. Format yang didukung adalah .txt dan .pdf.");
    }

    /**
     * Kirim permintaan ke 9router AI endpoint.
     */
    protected function sendChatCompletion(array $messages, float $temperature = 0.5): string
    {
        $url = rtrim($this->baseUrl, '/') . '/chat/completions';

        $payload = [
            'model' => $this->model,
            'stream' => false,
            'temperature' => $temperature,
            'messages' => $messages,
        ];

        $httpRequest = Http::withToken($this->apiKey)
            ->timeout($this->timeout);

        if (!$this->verifySsl) {
            $httpRequest = $httpRequest->withoutVerifying();
        }

        $response = $httpRequest->post($url, $payload);

        if ($response->failed()) {
            $status = $response->status();
            $body = $response->body();
            Log::error("9router AI Request Failed ({$status}): {$body}");
            throw new Exception("Gagal berkomunikasi dengan layanan AI ({$status}): {$body}");
        }

        $content = $response->json('choices.0.message.content');

        if (empty($content)) {
            Log::warning("9router AI Response empty content: " . $response->body());
            throw new Exception("Layanan AI mengembalikan respons kosong.");
        }

        return (string) $content;
    }

    /**
     * Membersihkan pembungkus markdown code block dan mem-parsing JSON.
     */
    public function cleanAndParseJson(string $rawContent): mixed
    {
        $cleaned = trim($rawContent);

        // Hapus pembungkus markdown ```json ... ``` atau ``` ... ```
        if (preg_match('/^```(?:json)?\s*(.*?)\s*```$/s', $cleaned, $matches)) {
            $cleaned = trim($matches[1]);
        }

        // Jika masih terdapat teks di luar JSON array [...] atau object {...}
        if (preg_match('/(\[.*\]|\{.*\})/s', $cleaned, $extracted)) {
            $cleaned = trim($extracted[1]);
        }

        $decoded = json_decode($cleaned, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::error("JSON Parse Error in AIService: " . json_last_error_msg() . " | Raw: " . substr($rawContent, 0, 500));
            throw new Exception("Gagal mem-parsing format JSON dari AI: " . json_last_error_msg());
        }

        return $decoded;
    }
}
