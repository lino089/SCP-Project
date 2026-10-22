<?php

namespace Tests\Feature;

use App\Jobs\ExtractQuizFromDocumentJob;
use App\Jobs\GenerateQuizFromPromptJob;
use App\Jobs\GradeQuizSubmissionJob;
use App\Models\Classes;
use App\Models\Quiz;
use App\Models\QuizQuestion;
use App\Models\QuizSubmission;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * FASE 9 - Tugas 9.1: Verifikasi Kriteria 10 (Kuis Berbantuan AI Asinkron)
 * PRD Bagian 10 & MASTER_IMPROVEMENT_PLAN.md:
 * - Mendukung 3 metode pembuatan soal (Prompt AI, Ekstraksi Dokumen PDF/TXT, Manual).
 * - Wajib melalui tahap draft_review (preview & konfirmasi) sebelum publish.
 * - Penilaian asinkron (GradeQuizSubmissionJob).
 * - Batas percobaan (max_attempts) & deadline ditegakkan.
 * - Guru dapat melakukan override nilai dengan audit trail lengkap.
 */
class QuizWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;
    private User $student;
    private Classes $class;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Queue::fake();

        $this->class = Classes::create(['name' => 'XII RPL 1', 'level' => 12]);

        $this->teacher = User::create([
            'name' => 'Pak Guru Kuis',
            'email' => 'guru_kuis@example.com',
            'nis_nip' => '198101012010011003',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
        ]);

        $this->student = User::create([
            'name' => 'Siswa Penguji Kuis',
            'email' => 'siswa_kuis@example.com',
            'nis_nip' => '3001',
            'role' => 'student',
            'class_id' => $this->class->id,
            'password' => Hash::make('password123'),
        ]);
    }

    public function test_three_question_creation_methods_are_supported(): void
    {
        Sanctum::actingAs($this->teacher);

        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'title' => 'Kuis Metodologi AI',
            'status' => 'draft_review',
            'due_date' => now()->addDays(2),
        ]);

        // Metode 1: Manual Question Creation (Multiple Choice & Essay)
        $manualRes = $this->postJson("/api/quizzes/{$quiz->id}/questions", [
            'question_type' => 'multiple_choice',
            'question_text' => 'Apa kepanjangan dari AI?',
            'options' => [
                'A' => 'Artificial Intelligence',
                'B' => 'Apple Intelligence',
                'C' => 'Automated Interface',
                'D' => 'Auto Index',
            ],
            'correct_answer' => 'A',
            'points' => 10,
        ]);
        $manualRes->assertStatus(201);
        $this->assertDatabaseHas('quiz_questions', ['quiz_id' => $quiz->id, 'question_type' => 'multiple_choice']);

        // Metode 2: Prompt AI Generation (Asinkron 202)
        $promptRes = $this->postJson("/api/quizzes/{$quiz->id}/generate-prompt", [
            'prompt' => 'Buatkan 5 soal pilihan ganda tentang Machine Learning untuk siswa SMK jurusan RPL dengan detail',
            'total_questions' => 5,
            'question_types' => 'multiple_choice',
            'difficulty' => 'sedang',
        ]);
        $promptRes->assertStatus(202);
        Queue::assertPushed(GenerateQuizFromPromptJob::class);

        // Metode 3: Document Extraction PDF/TXT (Asinkron 202)
        $fakeDoc = UploadedFile::fake()->createWithContent(
            'materi_ai.txt',
            "1. Apa itu Machine Learning?\nA. Pembelajaran Mesin\nB. Hardware Komputer\nC. Jaringan Kabel\nD. Power Supply\nKunci: A"
        );
        $docRes = $this->postJson("/api/quizzes/{$quiz->id}/extract-document", [
            'document' => $fakeDoc,
        ]);
        $docRes->assertStatus(202);
        Queue::assertPushed(ExtractQuizFromDocumentJob::class);
    }

    public function test_quiz_must_be_published_before_student_submission(): void
    {
        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'title' => 'Kuis Status Draft Review',
            'status' => 'draft_review',
            'due_date' => now()->addDays(2),
        ]);

        $q1 = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'question_type' => 'multiple_choice',
            'question_text' => 'Soal 1',
            'options' => ['A', 'B'],
            'correct_answer' => 'A',
            'points' => 10,
        ]);

        // Siswa mencoba submit saat status masih draft_review -> harus ditolak
        Sanctum::actingAs($this->student);
        $resDraft = $this->postJson("/api/quizzes/{$quiz->id}/submissions", [
            'answers' => [
                ['question_id' => $q1->id, 'answer' => 'A'],
            ],
        ]);
        $resDraft->assertStatus(422);

        // Guru mempublikasikan kuis
        Sanctum::actingAs($this->teacher);
        $pubRes = $this->patchJson("/api/quizzes/{$quiz->id}/publish");
        $pubRes->assertStatus(200)
            ->assertJsonPath('data.status', 'published');

        // Siswa sekarang dapat submit secara asinkron (202 Accepted)
        Sanctum::actingAs($this->student);
        $resPublish = $this->postJson("/api/quizzes/{$quiz->id}/submissions", [
            'answers' => [
                ['question_id' => $q1->id, 'answer' => 'A'],
            ],
        ]);
        $resPublish->assertStatus(202);
        Queue::assertPushed(GradeQuizSubmissionJob::class);
    }

    public function test_max_attempts_and_due_date_limits_are_enforced(): void
    {
        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'title' => 'Kuis Terbatas',
            'status' => 'published',
            'max_attempts' => 1,
            'due_date' => now()->addDays(1),
        ]);

        $q1 = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'question_type' => 'multiple_choice',
            'question_text' => 'Soal Batas',
            'options' => ['A', 'B'],
            'correct_answer' => 'A',
            'points' => 10,
        ]);

        Sanctum::actingAs($this->student);

        // Attempt 1: Berhasil disubmit secara asinkron (202)
        $res1 = $this->postJson("/api/quizzes/{$quiz->id}/submissions", [
            'answers' => [
                ['question_id' => $q1->id, 'answer' => 'A'],
            ],
        ]);
        $res1->assertStatus(202);

        // Attempt 2: Ditolak karena max_attempts = 1
        $res2 = $this->postJson("/api/quizzes/{$quiz->id}/submissions", [
            'answers' => [
                ['question_id' => $q1->id, 'answer' => 'A'],
            ],
        ]);
        $res2->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Batas percobaan kuis telah habis (maksimal 1 kali).',
            ]);

        // Kuis kedaluwarsa (past due date)
        $expiredQuiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'title' => 'Kuis Telat',
            'status' => 'published',
            'max_attempts' => 3,
            'due_date' => now()->subDay(), // Kemarin
        ]);

        $resExpired = $this->postJson("/api/quizzes/{$expiredQuiz->id}/submissions", [
            'answers' => [
                ['question_id' => $q1->id, 'answer' => 'A'],
            ],
        ]);
        $resExpired->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Batas waktu pengerjaan kuis telah berakhir.',
            ]);
    }

    public function test_teacher_can_override_scores_with_audit_trail(): void
    {
        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->class->id,
            'title' => 'Kuis Penilaian',
            'status' => 'published',
            'due_date' => now()->addDays(2),
        ]);

        $submission = QuizSubmission::create([
            'quiz_id' => $quiz->id,
            'student_id' => $this->student->id,
            'attempt_number' => 1,
            'answers_payload' => [
                ['question_id' => 1, 'answer' => 'A'],
            ],
            'grading_status' => 'graded',
            'ai_score' => 60,
            'ai_feedback' => 'Penjelasan esai kurang lengkap.',
        ]);

        Sanctum::actingAs($this->teacher);

        $response = $this->patchJson("/api/quiz-submissions/{$submission->id}", [
            'score' => 85,
            'ai_feedback' => 'Guru memberikan nilai tambahan setelah koreksi manual.',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Nilai kuis berhasil di-override oleh guru.',
                'data' => [
                    'id' => $submission->id,
                    'ai_score' => 85,
                    'is_overridden' => true,
                    'overridden_by' => $this->teacher->id,
                ],
            ]);

        $submission->refresh();
        $this->assertEquals(85, $submission->ai_score);
        $this->assertTrue((bool) $submission->is_overridden);
        $this->assertEquals($this->teacher->id, $submission->overridden_by);
        $this->assertNotNull($submission->overridden_at);
    }
}
