<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Jobs\ExtractQuizFromDocumentJob;
use App\Jobs\GenerateQuizFromPromptJob;
use App\Jobs\GradeQuizSubmissionJob;
use App\Models\Classes;
use App\Models\Quiz;
use App\Models\QuizQuestion;
use App\Models\QuizSubmission;
use App\Models\QuizAttempt;
use App\Services\AIService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            // Guru biasa hanya melihat kuis miliknya
            $query->where('teacher_id', $user->id);
        } elseif ($user->role === 'student') {
            // Siswa hanya melihat kuis kelasnya yang published atau published_result
            $query->where('class_id', $user->class_id)
                ->whereIn('status', ['published', 'published_result'])
                ->with(['submissions' => function ($sq) use ($user) {
                    $sq->where('student_id', $user->id)->orderByDesc('attempt_number');
                }]);
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
        } elseif ($user->role === 'vice_principal' || $user->role === 'waka') {
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
        if ($user->role !== 'teacher' && $user->role !== 'vice_principal' && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya guru atau waka yang dapat membuat kuis.',
            ], 403);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'class_id' => ['required_without:class_ids', 'nullable', 'integer', 'exists:classes,id'],
            'class_ids' => ['nullable', 'array', 'min:1'],
            'class_ids.*' => ['integer', 'exists:classes,id'],
            'due_date' => ['required', 'date', 'after:now'],
            'max_attempts' => ['required', 'integer', 'min:1'],
            'duration_minutes' => ['nullable', 'integer', 'min:1', 'max:300'],
        ]);

        $targetClassIds = [];
        if ($request->filled('class_ids')) {
            $targetClassIds = array_values(array_unique(array_map('intval', $request->input('class_ids'))));
        } elseif (!empty($validated['class_id'])) {
            $targetClassIds = [(int) $validated['class_id']];
        }

        if (empty($targetClassIds)) {
            return response()->json([
                'success' => false,
                'message' => 'Pilih minimal satu kelas target.',
                'errors' => ['class_id' => ['Kelas target wajib dipilih.']],
            ], 422);
        }

        // Validasi hak mengajar guru terhadap kelas yang dipilih
        if ($user->role === 'teacher') {
            $scheduleClassIds = \App\Models\Schedule::where('teacher_id', $user->id)->pluck('class_id')->filter()->toArray();
            $asgnClassIds = $user->assignments()->whereNotNull('class_id')->pluck('class_id')->toArray();
            $allowedClassIds = array_values(array_unique(array_merge($scheduleClassIds, $asgnClassIds)));

            $unauthorized = array_diff($targetClassIds, $allowedClassIds);
            if (!empty($unauthorized)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akses ditolak. Anda hanya dapat membuat kuis untuk kelas yang Anda ajar.',
                    'errors' => [
                        'class_id' => ['Satu atau lebih kelas yang dipilih bukan merupakan kelas ajar Anda.'],
                    ],
                ], 422);
            }
        }

        $primaryClassId = $targetClassIds[0];

        $quiz = Quiz::create([
            'teacher_id' => $user->id,
            'class_id' => $primaryClassId,
            'title' => $validated['title'],
            'status' => 'draft_review',
            'due_date' => $validated['due_date'],
            'max_attempts' => $validated['max_attempts'],
            'duration_minutes' => $validated['duration_minutes'] ?? 30,
        ]);

        $quiz->load(['teacher:id,name,nis_nip', 'schoolClass:id,name,level']);

        return response()->json([
            'success' => true,
            'message' => 'Kuis berhasil dibuat dalam status draft review.',
            'data' => $quiz,
            'target_class_ids' => $targetClassIds,
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
            if ($quiz->teacher_id !== $user->id) {
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

        if ($quiz->teacher_id !== $user->id && $user->role !== 'vice_principal' && $user->role !== 'waka') {
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

        // Dispatch job pembuatan butir soal AI secara asinkron ke background queue
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

        if ($quiz->teacher_id !== $user->id && $user->role !== 'vice_principal' && $user->role !== 'waka') {
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

        // Dispatch job ekstraksi dokumen AI secara asinkron ke background queue
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

        if ($quiz->teacher_id !== $user->id && $user->role !== 'vice_principal' && $user->role !== 'waka') {
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

        if ($quiz->teacher_id !== $user->id && $user->role !== 'vice_principal' && $user->role !== 'waka') {
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

        if ($quiz->teacher_id !== $user->id && $user->role !== 'vice_principal' && $user->role !== 'waka') {
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

        if ($quiz->teacher_id !== $user->id && $user->role !== 'vice_principal' && $user->role !== 'waka') {
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
     * Membatalkan & menghapus kuis secara permanen (Keputusan 1: Alt C & Keputusan 2: Alt A).
     */
    public function destroy($id, Request $request): JsonResponse
    {
        $quiz = Quiz::withCount('submissions')->findOrFail($id);
        $user = $request->user();

        if ($quiz->teacher_id !== $user->id && $user->role !== 'vice_principal' && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda bukan pembuat kuis ini.',
            ], 403);
        }

        $submissionsCount = $quiz->submissions_count;

        // Cascade delete kuis beserta questions & submissions
        $quiz->delete();

        return response()->json([
            'success' => true,
            'message' => "Kuis '{$quiz->title}' berhasil dibatalkan dan dihapus permanen" . ($submissionsCount > 0 ? " beserta {$submissionsCount} jawaban siswa yang terdampak." : "."),
            'data' => [
                'quiz_id' => (int) $id,
                'deleted_submissions_count' => $submissionsCount,
            ],
        ], 200);
    }

    /**
     * Konfirmasi & Publikasikan Kuis (draft_review -> published).
     */
    public function publish($id, Request $request): JsonResponse
    {
        $quiz = Quiz::with('questions')->findOrFail($id);
        $user = $request->user();

        if ($quiz->teacher_id !== $user->id && $user->role !== 'vice_principal' && $user->role !== 'waka') {
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

        // Duplikasi ke kelas paralel lainnya jika dipilih (Keputusan 3: Alternatif B)
        if ($request->filled('duplicate_to_class_ids') && is_array($request->input('duplicate_to_class_ids'))) {
            $otherClassIds = array_values(array_unique(array_map('intval', $request->input('duplicate_to_class_ids'))));
            $otherClassIds = array_filter($otherClassIds, fn($cid) => (int)$cid !== (int)$quiz->class_id);

            if (!empty($otherClassIds)) {
                $questions = $quiz->questions()->get();

                foreach ($otherClassIds as $otherId) {
                    $clonedQuiz = Quiz::create([
                        'teacher_id' => $quiz->teacher_id,
                        'class_id' => $otherId,
                        'title' => $quiz->title,
                        'status' => 'published',
                        'due_date' => $quiz->due_date,
                        'max_attempts' => $quiz->max_attempts,
                    ]);

                    foreach ($questions as $q) {
                        QuizQuestion::create([
                            'quiz_id' => $clonedQuiz->id,
                            'question_text' => $q->question_text,
                            'question_type' => $q->question_type,
                            'options' => $q->options,
                            'correct_answer' => $q->correct_answer,
                        ]);
                    }
                }
            }
        }

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

        if ($quiz->teacher_id !== $user->id && $user->role !== 'vice_principal' && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'class_id' => ['sometimes', 'required', 'integer', 'exists:classes,id'],
            'due_date' => ['sometimes', 'required', 'date'],
            'max_attempts' => ['sometimes', 'required', 'integer', 'min:1'],
            'duration_minutes' => ['sometimes', 'integer', 'min:1', 'max:300'],
            'status' => ['sometimes', 'required', 'string', Rule::in(['draft_review', 'published', 'published_result'])],
        ]);

        if (isset($validated['class_id']) && $user->role === 'teacher') {
            $scheduleClassIds = \App\Models\Schedule::where('teacher_id', $user->id)->pluck('class_id')->filter()->toArray();
            $asgnClassIds = $user->assignments()->whereNotNull('class_id')->pluck('class_id')->toArray();
            $allowedClassIds = array_values(array_unique(array_merge($scheduleClassIds, $asgnClassIds)));

            if (!empty($allowedClassIds) && !in_array((int) $validated['class_id'], $allowedClassIds, true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akses ditolak. Anda hanya dapat memilih kelas yang Anda ajar.',
                    'errors' => [
                        'class_id' => ['Kelas yang dipilih bukan merupakan kelas ajar Anda.'],
                    ],
                ], 422);
            }
        }

        if (isset($validated['status']) && $validated['status'] === 'published') {
            if ($quiz->questions()->count() === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Kuis belum memiliki butir soal. Tambahkan atau generate soal terlebih dahulu sebelum mempublikasikan.',
                ], 422);
            }

            // Duplikasi ke kelas paralel lainnya jika dipilih (Keputusan 3: Alternatif B)
            if ($request->filled('duplicate_to_class_ids') && is_array($request->input('duplicate_to_class_ids'))) {
                $otherClassIds = array_values(array_unique(array_map('intval', $request->input('duplicate_to_class_ids'))));
                $otherClassIds = array_filter($otherClassIds, fn($cid) => (int)$cid !== (int)$quiz->class_id);

                if (!empty($otherClassIds)) {
                    $questions = $quiz->questions()->get();

                    foreach ($otherClassIds as $otherId) {
                        $clonedQuiz = Quiz::create([
                            'teacher_id' => $quiz->teacher_id,
                            'class_id' => $otherId,
                            'title' => $validated['title'] ?? $quiz->title,
                            'status' => 'published',
                            'due_date' => $validated['due_date'] ?? $quiz->due_date,
                            'max_attempts' => $validated['max_attempts'] ?? $quiz->max_attempts,
                        ]);

                        foreach ($questions as $q) {
                            QuizQuestion::create([
                                'quiz_id' => $clonedQuiz->id,
                                'question_text' => $q->question_text,
                                'question_type' => $q->question_type,
                                'options' => $q->options,
                                'correct_answer' => $q->correct_answer,
                            ]);
                        }
                    }
                }
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
    /**
     * Memulai attempt kuis siswa: mencatat started_at dan batas expired di server.
     */
    public function start(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'student') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya siswa yang dapat memulai kuis.',
            ], 403);
        }

        $quiz = Quiz::withCount('questions')->findOrFail($id);

        if ((int) $quiz->class_id !== (int) $user->class_id) {
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

        if ($quiz->questions_count === 0) {
            return response()->json([
                'success' => false,
                'message' => 'Kuis ini belum memiliki butir soal.',
            ], 422);
        }

        $now = now();

        if ($now->greaterThan($quiz->due_date)) {
            return response()->json([
                'success' => false,
                'message' => 'Batas waktu pengumpulan kuis telah berakhir.',
            ], 422);
        }

        $attempts = QuizAttempt::where('quiz_id', $quiz->id)
            ->where('student_id', $user->id)
            ->count();

        if ($attempts >= (int) $quiz->max_attempts) {
            return response()->json([
                'success' => false,
                'message' => "Batas percobaan kuis telah habis (maksimal {$quiz->max_attempts} kali).",
            ], 422);
        }

        $active = QuizAttempt::where('quiz_id', $quiz->id)
            ->where('student_id', $user->id)
            ->whereNull('submitted_at')
            ->latest('id')
            ->first();

        if ($active && ! $active->isExpired()) {
            return response()->json([
                'success' => true,
                'message' => 'Melanjutkan pengerjaan kuis yang sedang berjalan.',
                'data' => $this->serializeAttempt($active, $quiz),
            ]);
        }

        if ($active && $active->isExpired()) {
            // attempt lama hangus & belum dikumpulkan → tutup agar tidak dihitung ulang
            $active->update(['submitted_at' => $now]);
        }

        $duration = (int) ($quiz->duration_minutes ?: 30);
        $expiresAt = $now->copy()->addMinutes($duration);
        if ($expiresAt->greaterThan($quiz->due_date)) {
            $expiresAt = $quiz->due_date->copy();
        }

        $attempt = QuizAttempt::create([
            'quiz_id' => $quiz->id,
            'student_id' => $user->id,
            'attempt_number' => $attempts + 1,
            'started_at' => $now,
            'expires_at' => $expiresAt,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Kuis dimulai. Waktu pengerjaan berjalan.',
            'data' => $this->serializeAttempt($attempt, $quiz),
        ], 201);
    }

    private function serializeAttempt(QuizAttempt $attempt, Quiz $quiz): array
    {
        $remaining = max(0, now()->diffInSeconds($attempt->expires_at, false));

        return [
            'attempt_id' => $attempt->id,
            'attempt_number' => $attempt->attempt_number,
            'started_at' => $attempt->started_at?->toIso8601String(),
            'expires_at' => $attempt->expires_at?->toIso8601String(),
            'remaining_seconds' => (int) $remaining,
            'server_time' => now()->toIso8601String(),
            'duration_minutes' => (int) ($quiz->duration_minutes ?: 30),
            'questions_count' => $quiz->questions()->count(),
        ];
    }

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

        if ((int) $quiz->class_id !== (int) $user->class_id) {
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

        $now = now();

        // Attempt aktif (dibuat oleh endpoint start). Bila belum ada, buat sekarang
        // agar pengumpulan tetap sah dan aturan kelengkapan dapat ditegakkan.
        $attempt = QuizAttempt::where('quiz_id', $quiz->id)
            ->where('student_id', $user->id)
            ->whereNull('submitted_at')
            ->latest('id')
            ->first();

        if (! $attempt) {
            if ($now->greaterThan($quiz->due_date)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Batas waktu pengerjaan kuis telah berakhir.',
                ], 422);
            }

            $duration = (int) ($quiz->duration_minutes ?: 30);
            $expiresAt = $now->copy()->addMinutes($duration);
            if ($expiresAt->greaterThan($quiz->due_date)) {
                $expiresAt = $quiz->due_date->copy();
            }

            $attempt = QuizAttempt::create([
                'quiz_id' => $quiz->id,
                'student_id' => $user->id,
                'attempt_number' => QuizAttempt::where('quiz_id', $quiz->id)
                    ->where('student_id', $user->id)
                    ->count() + 1,
                'started_at' => $now,
                'expires_at' => $expiresAt,
            ]);
        }

        $isAutoSubmit = $request->boolean('auto_submitted') || $request->boolean('is_auto_submit');
        $isExpired = $now->greaterThan($attempt->expires_at) || ($isAutoSubmit && $now->copy()->addSeconds(15)->greaterThan($attempt->expires_at));

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
            'answers.*.student_answer' => ['nullable', 'string'],
            'answers.*.answer' => ['nullable', 'string'],
            'answers.*.selected_option' => ['nullable', 'string'],
        ]);

        // --- Validasi kelengkapan jawaban (tidak bisa dilewati dari frontend) ---
        $questionIds = $quiz->questions->pluck('id')->map(fn ($qid) => (int) $qid)->all();

        $answeredIds = collect($validated['answers'])
            ->filter(function ($row) {
                $value = $row['student_answer'] ?? $row['answer'] ?? $row['selected_option'] ?? null;
                return $value !== null && trim((string) $value) !== '';
            })
            ->pluck('question_id')
            ->map(fn ($qid) => (int) $qid)
            ->unique()
            ->all();

        $missing = array_values(array_diff($questionIds, $answeredIds));

        if (! empty($missing) && ! $isExpired) {
            return response()->json([
                'success' => false,
                'message' => 'Masih ada ' . count($missing) . ' soal yang belum dijawab. Lengkapi sebelum mengumpulkan.',
                'missing_questions' => $missing,
                'unanswered_count' => count($missing),
            ], 422);
        }

        // Saat waktu habis: jawaban terisi dipertahankan, soal kosong dianggap tidak dijawab.
        $answers = collect($validated['answers'])->keyBy(fn ($row) => (int) $row['question_id']);

        if ($isExpired) {
            $answers = collect($questionIds)->map(function ($qid) use ($answers) {
                $row = $answers->get($qid);
                $value = $row['student_answer'] ?? $row['answer'] ?? $row['selected_option'] ?? '';

                return [
                    'question_id' => $qid,
                    'student_answer' => (string) ($row['student_answer'] ?? $value),
                    'answer' => (string) ($row['answer'] ?? $value),
                    'selected_option' => $row['selected_option'] ?? null,
                ];
            });
        }

        $attemptNumber = $currentAttempts + 1;

        try {
            $submission = DB::transaction(function () use ($quiz, $user, $attempt, $answers, $attemptNumber, $now) {
                $lockedAttempt = QuizAttempt::where('id', $attempt->id)->lockForUpdate()->first();
                if ($lockedAttempt && $lockedAttempt->submitted_at !== null) {
                    throw new \RuntimeException('Percobaan kuis ini sudah dikumpulkan sebelumnya.');
                }

                $sub = QuizSubmission::create([
                    'quiz_id' => $quiz->id,
                    'student_id' => $user->id,
                    'attempt_number' => $attemptNumber,
                    'answers_payload' => $answers->values()->all(),
                    'grading_status' => 'pending',
                    'ai_score' => null,
                    'ai_feedback' => null,
                ]);

                if ($lockedAttempt) {
                    $lockedAttempt->update(['submitted_at' => $now]);
                }

                return $sub;
            });
        } catch (\RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        // Dispatch job penilaian evaluasi AI secara asinkron ke antrean queue / background
        try {
            GradeQuizSubmissionJob::dispatchAfterResponse($submission->id);
        } catch (\Throwable $e) {
            GradeQuizSubmissionJob::dispatch($submission->id);
        }

        return response()->json([
            'success' => true,
            'message' => $isExpired
                ? 'Waktu pengerjaan habis. Jawaban dikumpulkan otomatis.'
                : 'Jawaban kuis berhasil dikumpulkan dan sedang dinilai oleh sistem evaluasi AI.',
            'data' => [
                'submission_id' => $submission->id,
                'quiz_id' => $quiz->id,
                'student_id' => $user->id,
                'attempt_number' => $attemptNumber,
                'grading_status' => 'pending',
                'auto_submitted' => $isExpired,
            ],
        ], 202);
    }

    /**
     * Guru mereview seluruh submission siswa pada kuis terkait.
     */
    public function submissions($id, Request $request): JsonResponse
    {
        $quiz = Quiz::with('questions')->findOrFail($id);
        $user = $request->user();

        if ($quiz->teacher_id !== $user->id && $user->role !== 'vice_principal' && $user->role !== 'waka') {
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

        $questions = $quiz->questions->keyBy('id');

        $enrichedSubmissions = $submissions->map(function ($sub) use ($questions) {
            $rawAnswers = $sub->answers_payload;
            $answersMap = [];
            if (is_array($rawAnswers)) {
                foreach ($rawAnswers as $ans) {
                    if (isset($ans['question_id'])) {
                        $answersMap[$ans['question_id']] = $ans['student_answer'] ?? $ans['answer'] ?? $ans['selected_option'] ?? '';
                    }
                }
            }

            $answersList = [];
            foreach ($questions as $qId => $q) {
                $studentAns = trim((string) ($answersMap[$qId] ?? ''));
                $isCorrect = false;
                $points = 0;

                if ($q->question_type === 'multiple_choice') {
                    $isCorrect = (strtoupper($studentAns) === strtoupper(trim($q->correct_answer)));
                    $points = $isCorrect ? 100 : 0;
                }

                $answersList[] = [
                    'question_id' => $q->id,
                    'question_type' => $q->question_type,
                    'question_text' => $q->question_text,
                    'options' => $q->options,
                    'student_answer' => $studentAns !== '' ? $studentAns : '(Tidak dijawab)',
                    'correct_answer' => $q->correct_answer,
                    'is_correct' => $isCorrect,
                    'points_awarded' => $points,
                    'ai_feedback' => null,
                ];
            }

            $subData = $sub->toArray();
            $subData['answers'] = $answersList;
            $subData['submitted_at'] = $sub->created_at ? $sub->created_at->toIso8601String() : null;
            $subData['formatted_submitted_at'] = $sub->created_at ? $sub->created_at->format('d M Y, H:i \W\I\B') : '-';
            $subData['teacher_feedback'] = $sub->ai_feedback;

            return $subData;
        });

        return response()->json([
            'success' => true,
            'message' => 'Data submission siswa berhasil diambil.',
            'data' => [
                'quiz_id' => $quiz->id,
                'title' => $quiz->title,
                'status' => $quiz->status,
                'total_submissions' => $enrichedSubmissions->count(),
                'submissions' => $enrichedSubmissions,
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

        if ($submission->quiz->teacher_id !== $user->id && $user->role !== 'vice_principal' && $user->role !== 'waka') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak berhak mengubah nilai submission ini.',
            ], 403);
        }

        $validated = $request->validate([
            'score' => ['required', 'numeric', 'min:0', 'max:100'],
            'feedback' => ['nullable', 'string', 'max:1000'],
            'teacher_feedback' => ['nullable', 'string', 'max:1000'],
        ]);

        $feedbackText = $request->input('teacher_feedback') ?? $request->input('feedback') ?? $submission->ai_feedback;

        $submission->update([
            'ai_score' => round((float) $validated['score'], 2),
            'ai_feedback' => $feedbackText,
            'is_overridden' => true,
            'overridden_by' => $user->id,
            'overridden_at' => now(),
            'grading_status' => 'graded',
        ]);

        $fresh = $submission->fresh(['student:id,name,nis_nip', 'overrider:id,name']);
        $freshData = $fresh->toArray();
        $freshData['teacher_feedback'] = $fresh->ai_feedback;
        $freshData['submitted_at'] = $fresh->created_at ? $fresh->created_at->toIso8601String() : null;
        $freshData['formatted_submitted_at'] = $fresh->created_at ? $fresh->created_at->format('d M Y, H:i \W\I\B') : '-';

        return response()->json([
            'success' => true,
            'message' => 'Nilai kuis berhasil di-override oleh guru.',
            'data' => $freshData,
        ], 200);
    }

    /**
     * Siswa atau Orang Tua melihat hasil evaluasi akhir setelah status published_result.
     */
    public function mySubmission($id, Request $request): JsonResponse
    {
        $quiz = Quiz::with('questions')->findOrFail($id);
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

        $questions = $quiz->questions->keyBy('id');
        $enrichedSubmissions = $submissions->map(function ($sub) use ($questions) {
            $rawAnswers = $sub->answers_payload;
            $answersMap = [];
            if (is_array($rawAnswers)) {
                foreach ($rawAnswers as $ans) {
                    if (isset($ans['question_id'])) {
                        $answersMap[$ans['question_id']] = $ans['student_answer'] ?? $ans['answer'] ?? $ans['selected_option'] ?? '';
                    }
                }
            }

            $answersList = [];
            foreach ($questions as $qId => $q) {
                $studentAns = trim((string) ($answersMap[$qId] ?? ''));
                $isCorrect = false;
                $points = 0;

                if ($q->question_type === 'multiple_choice') {
                    $isCorrect = (strtoupper($studentAns) === strtoupper(trim($q->correct_answer)));
                    $points = $isCorrect ? 100 : 0;
                }

                $answersList[] = [
                    'question_id' => $q->id,
                    'question_type' => $q->question_type,
                    'question_text' => $q->question_text,
                    'options' => $q->options,
                    'student_answer' => $studentAns !== '' ? $studentAns : '(Tidak dijawab)',
                    'correct_answer' => $q->correct_answer,
                    'is_correct' => $isCorrect,
                    'points_awarded' => $points,
                    'ai_feedback' => null,
                ];
            }

            $subData = $sub->toArray();
            $subData['answers'] = $answersList;
            $subData['submitted_at'] = $sub->created_at ? $sub->created_at->toIso8601String() : null;
            $subData['formatted_submitted_at'] = $sub->created_at ? $sub->created_at->format('d M Y, H:i \W\I\B') : '-';
            $subData['teacher_feedback'] = $sub->ai_feedback;

            return $subData;
        });

        $bestScore = $enrichedSubmissions->max('ai_score');

        return response()->json([
            'success' => true,
            'message' => 'Hasil kuis berhasil diambil.',
            'data' => [
                'quiz_id' => $quiz->id,
                'title' => $quiz->title,
                'best_score' => $bestScore,
                'attempts_used' => $enrichedSubmissions->count(),
                'max_attempts' => $quiz->max_attempts,
                'submissions' => $enrichedSubmissions,
            ],
        ], 200);
    }
}
