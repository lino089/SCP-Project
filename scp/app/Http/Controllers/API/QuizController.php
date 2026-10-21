<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Jobs\ExtractQuizFromDocumentJob;
use App\Jobs\GenerateQuizFromPromptJob;
use App\Jobs\GenerateQuizJob;
use App\Jobs\GradeQuizSubmissionJob;
use App\Models\Classes;
use App\Models\Journal;
use App\Models\Quiz;
use App\Models\QuizQuestion;
use App\Models\QuizSubmission;
use App\Services\AIService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Throwable;

class QuizController extends Controller
{
    /**
     * Menampilkan daftar kuis dengan auto-scoping per peran.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Quiz::with(['teacher:id,name,nis_nip', 'schoolClass:id,name,level'])
            ->withCount(['questions', 'submissions']);

        if ($user->role === 'teacher') {
            $isWaka = $user->assignments()->where('type', 'waka')->exists();
            if (!$isWaka) {
                // Guru biasa hanya melihat kuis miliknya
                $query->where('teacher_id', $user->id);
            }
        } elseif ($user->role === 'student') {
            // Siswa hanya melihat kuis kelasnya yang published atau published_result
            $query->where('class_id', $user->class_id)
                ->whereIn('status', ['published', 'published_result']);
        } elseif ($user->role === 'parent') {
            // Orang tua melihat kuis kelas anak yang sudah published_result
            $linkedStudent = $user->linkedStudent;
            if (!$linkedStudent) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akun orang tua belum terhubung dengan data siswa.',
                ], 422);
            }
            $query->where('class_id', $linkedStudent->class_id)
                ->where('status', 'published_result');
        } elseif ($user->role === 'waka') {
            // Waka melihat semua kuis
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        // Filter opsional
        if ($request->filled('class_id')) {
            $query->where('class_id', $request->class_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $perPage = (int) $request->input('per_page', 15);
        $quizzes = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Data kuis berhasil diambil.',
            'data' => $quizzes->items(),
            'meta' => [
                'current_page' => $quizzes->currentPage(),
                'per_page' => $quizzes->perPage(),
                'total' => $quizzes->total(),
                'last_page' => $quizzes->lastPage(),
            ],
        ], 200);
    }

    /**
     * Membuat kuis baru (Metode Mandiri / Inisialisasi Kuis).
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'teacher' && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya guru yang dapat membuat kuis.',
            ], 403);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'due_date' => ['required', 'date', 'after:now'],
            'max_attempts' => ['required', 'integer', 'min:1'],
        ]);

        $quiz = Quiz::create([
            'teacher_id' => $user->id,
            'class_id' => $validated['class_id'],
            'title' => $validated['title'],
            'status' => 'draft_review',
            'due_date' => $validated['due_date'],
            'max_attempts' => $validated['max_attempts'],
        ]);

        $quiz->load(['teacher:id,name,nis_nip', 'schoolClass:id,name,level']);

        return response()->json([
            'success' => true,
            'message' => 'Kuis berhasil dibuat dalam status draft review.',
            'data' => $quiz,
        ], 201);
    }

    /**
     * Menampilkan detail kuis & butir soal.
     */
    public function show($id, Request $request): JsonResponse
    {
        $quiz = Quiz::with(['questions', 'schoolClass:id,name,level', 'teacher:id,name,nis_nip'])->findOrFail($id);
        $user = $request->user();

        if ($user->role === 'student') {
            if ($quiz->class_id !== $user->class_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akses ditolak. Kuis bukan untuk kelas Anda.',
                ], 403);
            }

            if (!in_array($quiz->status, ['published', 'published_result'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Kuis belum dibuka atau sedang dalam tahap review oleh guru.',
                ], 403);
            }

            // Sembunyikan kunci jawaban untuk siswa
            $quiz->questions->makeHidden(['correct_answer']);
        } elseif ($user->role === 'parent') {
            $linkedStudent = $user->linkedStudent;
            if (!$linkedStudent || $quiz->class_id !== $linkedStudent->class_id || $quiz->status !== 'published_result') {
                return response()->json([
                    'success' => false,
                    'message' => 'Akses ditolak atau hasil kuis belum dipublikasikan.',
                ], 403);
            }
        } elseif ($user->role === 'teacher') {
            $isWaka = $user->assignments()->where('type', 'waka')->exists();
            if ($quiz->teacher_id !== $user->id && !$isWaka) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akses ditolak. Anda bukan pemilik kuis ini.',
                ], 403);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Data kuis berhasil diambil.',
            'data' => $quiz,
        ], 200);
    }

    /**
     * Metode 1: Generate Soal via Prompt AI dengan Konfigurasi Wajib.
     */
    public function generatePrompt(Request $request, $id): JsonResponse
    {
        $quiz = Quiz::findOrFail($id);
        $user = $request->user();

        if ($quiz->teacher_id !== $user->id && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda bukan pembuat kuis ini.',
            ], 403);
        }

        if ($quiz->status === 'published' || $quiz->status === 'published_result') {
            return response()->json([
                'success' => false,
                'message' => 'Kuis yang sudah dipublikasikan tidak dapat digenerate ulang.',
            ], 422);
        }

        $validated = $request->validate([
            'prompt' => ['required', 'string', 'min:3'],
            'total_questions' => ['required', 'integer', 'min:1', 'max:50'],
            'question_types' => ['required', 'string', Rule::in(['multiple_choice', 'essay', 'combination'])],
            'essay_count' => ['nullable', 'integer', 'min:0'],
            'mc_count' => ['nullable', 'integer', 'min:0'],
            'difficulty' => ['nullable', 'string', Rule::in(['mudah', 'sedang', 'sulit'])],
            'additional_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $total = (int) $validated['total_questions'];
        $type = $validated['question_types'];
        $mcCount = (int) ($validated['mc_count'] ?? 0);
        $essayCount = (int) ($validated['essay_count'] ?? 0);

        // Validasi konsistensi konfigurasi soal
        if ($type === 'multiple_choice') {
            $mcCount = $total;
            $essayCount = 0;
        } elseif ($type === 'essay') {
            $essayCount = $total;
            $mcCount = 0;
        } elseif ($type === 'combination') {
            if (($mcCount + $essayCount) !== $total) {
                return response()->json([
                    'success' => false,
                    'message' => "Untuk jenis kombinasi, jumlah soal pilihan ganda ({$mcCount}) dan esai ({$essayCount}) harus berjumlah sama dengan total soal ({$total}).",
                    'errors' => [
                        'total_questions' => ["Total soal ({$total}) tidak sesuai dengan penjumlahan pilihan ganda ({$mcCount}) dan esai ({$essayCount})."],
                    ],
                ], 422);
            }
            if ($mcCount < 1 || $essayCount < 1) {
                return response()->json([
                    'success' => false,
                    'message' => 'Untuk jenis kombinasi, soal pilihan ganda dan esai masing-masing minimal 1.',
                ], 422);
            }
        }

        $validated['mc_count'] = $mcCount;
        $validated['essay_count'] = $essayCount;

        // Tandai status kuis menjadi generating
        $quiz->update(['status' => 'generating']);

        // Dispatch job asinkron
        GenerateQuizFromPromptJob::dispatch($quiz->id, $validated);

        return response()->json([
            'success' => true,
            'message' => 'Permintaan pembuatan soal kuis sedang diproses oleh AI di latar belakang.',
            'data' => [
                'quiz_id' => $quiz->id,
                'status' => 'generating',
                'config' => [
                    'prompt' => $validated['prompt'],
                    'total_questions' => $total,
                    'question_types' => $type,
                    'mc_count' => $mcCount,
                    'essay_count' => $essayCount,
                ],
            ],
        ], 202);
    }

    /**
     * Metode 2: Ekstraksi Soal dari Dokumen (PDF/TXT) via AI.
     */
    public function extractDocument(Request $request, $id, AIService $aiService): JsonResponse
    {
        $quiz = Quiz::findOrFail($id);
        $user = $request->user();

        if ($quiz->teacher_id !== $user->id && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda bukan pembuat kuis ini.',
            ], 403);
        }

        if ($quiz->status === 'published' || $quiz->status === 'published_result') {
            return response()->json([
                'success' => false,
                'message' => 'Kuis yang sudah dipublikasikan tidak dapat diubah soalnya.',
            ], 422);
        }

        $request->validate([
            'document' => ['required', 'file', 'mimes:pdf,txt', 'max:5120'], // Max 5MB
        ]);

        $file = $request->file('document');
        $storedPath = $file->store('temp_documents', 'local');
        $fullPath = Storage::disk('local')->path($storedPath);

        try {
            $extractedText = $aiService->extractTextFromDocument($fullPath, $file->getClientOriginalExtension());
            Storage::disk('local')->delete($storedPath);
        } catch (Throwable $e) {
            Storage::disk('local')->delete($storedPath);
            return response()->json([
                'success' => false,
                'message' => 'Gagal membaca berkas dokumen: ' . $e->getMessage(),
            ], 422);
        }

        if (empty(trim($extractedText))) {
            return response()->json([
                'success' => false,
                'message' => 'Dokumen tidak memuat teks yang dapat diekstrak.',
            ], 422);
        }

        $quiz->update(['status' => 'generating']);

        ExtractQuizFromDocumentJob::dispatch($quiz->id, $extractedText);

        return response()->json([
            'success' => true,
            'message' => 'Ekstraksi soal dari dokumen sedang diproses oleh AI di latar belakang.',
            'data' => [
                'quiz_id' => $quiz->id,
                'status' => 'generating',
                'document_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize(),
            ],
        ], 202);
    }

    /**
     * Tahap Preview: Melihat seluruh butir soal draft untuk diperiksa guru.
     */
    public function questions($id, Request $request): JsonResponse
    {
        $quiz = Quiz::with('questions')->findOrFail($id);
        $user = $request->user();

        if ($quiz->teacher_id !== $user->id && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya pemilik kuis atau Waka yang dapat melihat butir soal lengkap.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'message' => 'Daftar butir soal kuis berhasil diambil untuk preview.',
            'data' => [
                'quiz_id' => $quiz->id,
                'title' => $quiz->title,
                'status' => $quiz->status,
                'total_questions' => $quiz->questions->count(),
                'questions' => $quiz->questions,
            ],
        ], 200);
    }

    /**
     * Metode 3: Tambah Butir Soal Manual.
     */
    public function storeQuestion(Request $request, $id): JsonResponse
    {
        $quiz = Quiz::findOrFail($id);
        $user = $request->user();

        if ($quiz->teacher_id !== $user->id && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        if ($quiz->status === 'published' || $quiz->status === 'published_result') {
            return response()->json([
                'success' => false,
                'message' => 'Tidak dapat menambahkan soal pada kuis yang sudah dipublikasikan.',
            ], 422);
        }

        $validated = $request->validate([
            'question_text' => ['required', 'string'],
            'question_type' => ['required', 'string', Rule::in(['multiple_choice', 'essay'])],
            'options' => ['nullable', 'array'],
            'options.A' => ['required_if:question_type,multiple_choice', 'string'],
            'options.B' => ['required_if:question_type,multiple_choice', 'string'],
            'options.C' => ['required_if:question_type,multiple_choice', 'string'],
            'options.D' => ['required_if:question_type,multiple_choice', 'string'],
            'correct_answer' => ['required', 'string'],
        ]);

        $question = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'question_text' => $validated['question_text'],
            'question_type' => $validated['question_type'],
            'options' => $validated['question_type'] === 'multiple_choice' ? $validated['options'] : null,
            'correct_answer' => $validated['correct_answer'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Butir soal manual berhasil ditambahkan.',
            'data' => $question,
        ], 201);
    }

    /**
     * Koreksi / Edit Butir Soal (Tahap Preview).
     */
    public function updateQuestion(Request $request, $id, $question_id): JsonResponse
    {
        $quiz = Quiz::findOrFail($id);
        $user = $request->user();

        if ($quiz->teacher_id !== $user->id && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        if ($quiz->status === 'published' || $quiz->status === 'published_result') {
            return response()->json([
                'success' => false,
                'message' => 'Tidak dapat mengedit butir soal pada kuis yang sudah dipublikasikan.',
            ], 422);
        }

        $question = QuizQuestion::where('quiz_id', $quiz->id)->where('id', $question_id)->firstOrFail();

        $validated = $request->validate([
            'question_text' => ['sometimes', 'required', 'string'],
            'question_type' => ['sometimes', 'required', 'string', Rule::in(['multiple_choice', 'essay'])],
            'options' => ['nullable', 'array'],
            'correct_answer' => ['sometimes', 'required', 'string'],
        ]);

        $question->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Butir soal berhasil diperbarui.',
            'data' => $question,
        ], 200);
    }

    /**
     * Hapus Butir Soal pada Tahap Preview.
     */
    public function destroyQuestion($id, $question_id, Request $request): JsonResponse
    {
        $quiz = Quiz::findOrFail($id);
        $user = $request->user();

        if ($quiz->teacher_id !== $user->id && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        if ($quiz->status === 'published' || $quiz->status === 'published_result') {
            return response()->json([
                'success' => false,
                'message' => 'Tidak dapat menghapus butir soal pada kuis yang sudah dipublikasikan.',
            ], 422);
        }

        $question = QuizQuestion::where('quiz_id', $quiz->id)->where('id', $question_id)->firstOrFail();
        $question->delete();

        return response()->json([
            'success' => true,
            'message' => 'Butir soal berhasil dihapus dari kuis.',
        ], 200);
    }

    /**
     * Konfirmasi & Publikasikan Kuis (draft_review -> published).
     */
    public function publish($id, Request $request): JsonResponse
    {
        $quiz = Quiz::with('questions')->findOrFail($id);
        $user = $request->user();

        if ($quiz->teacher_id !== $user->id && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda bukan pemilik kuis ini.',
            ], 403);
        }

        if ($quiz->questions()->count() === 0) {
            return response()->json([
                'success' => false,
                'message' => 'Kuis belum memiliki butir soal. Harap tambahkan atau generate soal terlebih dahulu sebelum mempublikasikan.',
            ], 422);
        }

        $quiz->update(['status' => 'published']);

        return response()->json([
            'success' => true,
            'message' => 'Kuis berhasil dipublikasikan dan siap dikerjakan siswa.',
            'data' => $quiz->fresh(['teacher', 'schoolClass', 'questions']),
        ], 200);
    }

    /**
     * Update metadata kuis atau ubah status (misal: published_result).
     */
    public function update(Request $request, $id): JsonResponse
    {
        $quiz = Quiz::findOrFail($id);
        $user = $request->user();

        if ($quiz->teacher_id !== $user->id && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'due_date' => ['sometimes', 'required', 'date'],
            'max_attempts' => ['sometimes', 'required', 'integer', 'min:1'],
            'status' => ['sometimes', 'required', 'string', Rule::in(['draft_review', 'published', 'published_result'])],
        ]);

        if (isset($validated['status']) && $validated['status'] === 'published') {
            if ($quiz->questions()->count() === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Kuis belum memiliki butir soal. Tambahkan atau generate soal terlebih dahulu sebelum mempublikasikan.',
                ], 422);
            }
        }

        $quiz->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Data kuis berhasil diperbarui.',
            'data' => $quiz->fresh(['teacher', 'schoolClass']),
        ], 200);
    }

    /**
     * Pengumpulan Jawaban Siswa (Multi-Attempt & Batas Due Date) -> Penilaian Asinkron.
     */
    public function submit(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'student') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya siswa yang dapat mengumpulkan jawaban kuis.',
            ], 403);
        }

        $quiz = Quiz::with('questions')->findOrFail($id);

        if ($quiz->class_id !== $user->class_id) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Kuis ini bukan untuk kelas Anda.',
            ], 403);
        }

        if ($quiz->status !== 'published') {
            return response()->json([
                'success' => false,
                'message' => 'Kuis tidak aktif atau belum dibuka.',
            ], 422);
        }

        // Validasi Deadline
        if (now()->greaterThan($quiz->due_date)) {
            return response()->json([
                'success' => false,
                'message' => 'Batas waktu pengerjaan kuis telah berakhir.',
            ], 422);
        }

        // Validasi Max Attempts
        $currentAttempts = QuizSubmission::where('quiz_id', $quiz->id)
            ->where('student_id', $user->id)
            ->count();

        if ($currentAttempts >= $quiz->max_attempts) {
            return response()->json([
                'success' => false,
                'message' => "Batas percobaan kuis telah habis (maksimal {$quiz->max_attempts} kali).",
            ], 422);
        }

        $validated = $request->validate([
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.question_id' => ['required', 'integer', 'exists:quiz_questions,id'],
            'answers.*.answer' => ['nullable', 'string'],
            'answers.*.selected_option' => ['nullable', 'string'],
        ]);

        $attemptNumber = $currentAttempts + 1;

        $submission = QuizSubmission::create([
            'quiz_id' => $quiz->id,
            'student_id' => $user->id,
            'attempt_number' => $attemptNumber,
            'answers_payload' => $validated['answers'],
            'grading_status' => 'pending',
            'ai_score' => null,
            'ai_feedback' => null,
        ]);

        // Dispatch job penilaian hybrid asinkron
        GradeQuizSubmissionJob::dispatch($submission->id);

        return response()->json([
            'success' => true,
            'message' => 'Jawaban kuis berhasil dikumpulkan dan sedang dinilai oleh sistem evaluasi AI.',
            'data' => [
                'submission_id' => $submission->id,
                'quiz_id' => $quiz->id,
                'student_id' => $user->id,
                'attempt_number' => $attemptNumber,
                'grading_status' => 'pending',
            ],
        ], 202);
    }

    /**
     * Guru mereview seluruh submission siswa pada kuis terkait.
     */
    public function submissions($id, Request $request): JsonResponse
    {
        $quiz = Quiz::findOrFail($id);
        $user = $request->user();

        if ($quiz->teacher_id !== $user->id && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya pembuat kuis yang dapat melihat seluruh submission.',
            ], 403);
        }

        $submissions = QuizSubmission::with(['student:id,name,nis_nip,class_id', 'overrider:id,name'])
            ->where('quiz_id', $quiz->id)
            ->orderBy('student_id')
            ->orderBy('attempt_number')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Data submission siswa berhasil diambil.',
            'data' => [
                'quiz_id' => $quiz->id,
                'title' => $quiz->title,
                'status' => $quiz->status,
                'total_submissions' => $submissions->count(),
                'submissions' => $submissions,
            ],
        ], 200);
    }

    /**
     * Guru melakukan override nilai / feedback AI dengan audit trail.
     */
    public function overrideSubmission(Request $request, $id): JsonResponse
    {
        $submission = QuizSubmission::with('quiz')->findOrFail($id);
        $user = $request->user();

        if ($submission->quiz->teacher_id !== $user->id && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak berhak mengubah nilai submission ini.',
            ], 403);
        }

        $validated = $request->validate([
            'score' => ['required', 'numeric', 'min:0', 'max:100'],
            'feedback' => ['nullable', 'string', 'max:1000'],
        ]);

        $submission->update([
            'ai_score' => round((float) $validated['score'], 2),
            'ai_feedback' => $validated['feedback'] ?? $submission->ai_feedback,
            'is_overridden' => true,
            'overridden_by' => $user->id,
            'overridden_at' => now(),
            'grading_status' => 'graded',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Nilai kuis berhasil di-override oleh guru.',
            'data' => $submission->fresh(['student:id,name,nis_nip', 'overrider:id,name']),
        ], 200);
    }

    /**
     * Siswa atau Orang Tua melihat hasil evaluasi akhir setelah status published_result.
     */
    public function mySubmission($id, Request $request): JsonResponse
    {
        $quiz = Quiz::findOrFail($id);
        $user = $request->user();

        $studentId = null;
        if ($user->role === 'student') {
            if ($quiz->class_id !== $user->class_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akses ditolak.',
                ], 403);
            }
            $studentId = $user->id;
        } elseif ($user->role === 'parent') {
            $linked = $user->linkedStudent;
            if (!$linked || $quiz->class_id !== $linked->class_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akses ditolak atau akun orang tua belum terhubung.',
                ], 403);
            }
            $studentId = $linked->id;
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        // Jika hasil kuis belum dipublikasikan oleh guru
        if ($quiz->status !== 'published_result') {
            return response()->json([
                'success' => false,
                'message' => 'Hasil penilaian kuis belum dipublikasikan oleh guru pengajar.',
                'data' => [
                    'quiz_id' => $quiz->id,
                    'title' => $quiz->title,
                    'status' => $quiz->status,
                ],
            ], 200);
        }

        $submissions = QuizSubmission::where('quiz_id', $quiz->id)
            ->where('student_id', $studentId)
            ->orderBy('attempt_number')
            ->get();

        $bestScore = $submissions->max('ai_score');

        return response()->json([
            'success' => true,
            'message' => 'Hasil kuis berhasil diambil.',
            'data' => [
                'quiz_id' => $quiz->id,
                'title' => $quiz->title,
                'best_score' => $bestScore,
                'attempts_used' => $submissions->count(),
                'max_attempts' => $quiz->max_attempts,
                'submissions' => $submissions,
            ],
        ], 200);
    }

    /**
     * Endpoint legacy untuk generate kuis via jurnal (Backward Compatibility).
     */
    public function generate(Request $request, $journalId): JsonResponse
    {
        $journal = Journal::with('schedule')->findOrFail($journalId);
        $userId = $request->user()->id;

        $isTeacher = ($journal->schedule->teacher_id === $userId);
        $isSubstitute = ($journal->substitute_teacher_id === $userId);

        if (!$isTeacher && !$isSubstitute) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        if (empty($journal->topic_description)) {
            return response()->json([
                'success' => false,
                'message' => 'Jurnal belum memiliki materi pembahasan untuk dijadikan kuis.',
            ], 422);
        }

        GenerateQuizJob::dispatch($journal->id);

        return response()->json([
            'success' => true,
            'message' => 'Pembuatan kuis otomatis sedang diproses di latar belakang.',
        ], 202);
    }
}
