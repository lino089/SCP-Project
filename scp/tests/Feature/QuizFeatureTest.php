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
use App\Services\AIService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QuizFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected User $teacher;
    protected User $otherTeacher;
    protected User $student;
    protected User $otherStudent;
    protected User $parent;
    protected Classes $schoolClass;
    protected Classes $otherClass;

    protected function setUp(): void
    {
        parent::setUp();

        $this->schoolClass = Classes::create([
            'name' => 'XII RPL 1',
            'level' => 12,
        ]);

        $this->otherClass = Classes::create([
            'name' => 'XII TKJ 1',
            'level' => 12,
        ]);

        $this->teacher = User::create([
            'name' => 'Pak Budi Guru',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012010011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->otherTeacher = User::create([
            'name' => 'Ibu Siti Guru',
            'email' => 'siti@example.com',
            'nis_nip' => '198505052010012002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->student = User::create([
            'name' => 'Ahmad Siswa',
            'email' => 'ahmad@example.com',
            'nis_nip' => '1001',
            'role' => 'student',
            'class_id' => $this->schoolClass->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->otherStudent = User::create([
            'name' => 'Bambang Siswa',
            'email' => 'bambang@example.com',
            'nis_nip' => '1002',
            'role' => 'student',
            'class_id' => $this->otherClass->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->parent = User::create([
            'name' => 'Pak Joko Ortu',
            'email' => 'ortu@example.com',
            'nis_nip' => 'P-1001',
            'role' => 'parent',
            'linked_student_id' => $this->student->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
    }

    public function test_teacher_can_create_quiz_draft(): void
    {
        Sanctum::actingAs($this->teacher);

        $response = $this->postJson('/api/quizzes', [
            'title' => 'Kuis Pemrograman Objek',
            'class_id' => $this->schoolClass->id,
            'due_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'max_attempts' => 2,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'title' => 'Kuis Pemrograman Objek',
                    'class_id' => $this->schoolClass->id,
                    'status' => 'draft_review',
                    'max_attempts' => 2,
                ],
            ]);

        $this->assertDatabaseHas('ai_quizzes', [
            'title' => 'Kuis Pemrograman Objek',
            'status' => 'draft_review',
            'teacher_id' => $this->teacher->id,
        ]);
    }

    public function test_non_teacher_cannot_create_quiz(): void
    {
        Sanctum::actingAs($this->student);

        $response = $this->postJson('/api/quizzes', [
            'title' => 'Kuis Ilegal',
            'class_id' => $this->schoolClass->id,
            'due_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'max_attempts' => 1,
        ]);

        $response->assertStatus(403);
    }

    public function test_teacher_can_add_edit_and_delete_manual_questions(): void
    {
        Sanctum::actingAs($this->teacher);

        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Manual',
            'status' => 'draft_review',
            'due_date' => now()->addDays(2),
            'max_attempts' => 1,
        ]);

        // 1. Tambah soal Pilihan Ganda
        $resMc = $this->postJson("/api/quizzes/{$quiz->id}/questions", [
            'question_text' => 'Apa itu class dalam OOP?',
            'question_type' => 'multiple_choice',
            'options' => [
                'A' => 'Blueprint objek',
                'B' => 'Fungsi global',
                'C' => 'Variabel konstan',
                'D' => 'Database table',
            ],
            'correct_answer' => 'A',
        ]);

        $resMc->assertStatus(201);
        $mcId = $resMc->json('data.id');

        // 2. Tambah soal Esai
        $resEssay = $this->postJson("/api/quizzes/{$quiz->id}/questions", [
            'question_text' => 'Jelaskan konsep Polymorphism!',
            'question_type' => 'essay',
            'options' => null,
            'correct_answer' => 'Banyak bentuk, method overriding, method overloading, interface implementation.',
        ]);

        $resEssay->assertStatus(201);
        $essayId = $resEssay->json('data.id');

        // 3. Preview Soal (GET)
        $resPreview = $this->getJson("/api/quizzes/{$quiz->id}/questions");
        $resPreview->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'total_questions' => 2,
                ],
            ]);

        // 4. Update Soal
        $resUpdate = $this->putJson("/api/quizzes/{$quiz->id}/questions/{$mcId}", [
            'question_text' => 'Apa definisi class dalam paradigma OOP?',
            'correct_answer' => 'A',
        ]);
        $resUpdate->assertStatus(200)
            ->assertJsonPath('data.question_text', 'Apa definisi class dalam paradigma OOP?');

        // 5. Delete Soal
        $resDel = $this->deleteJson("/api/quizzes/{$quiz->id}/questions/{$essayId}");
        $resDel->assertStatus(200);

        $this->assertDatabaseMissing('quiz_questions', ['id' => $essayId]);
        $this->assertEquals(1, $quiz->questions()->count());
    }

    public function test_generate_prompt_validates_required_configuration_strictly(): void
    {
        Sanctum::actingAs($this->teacher);

        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Prompt',
            'status' => 'draft_review',
            'due_date' => now()->addDays(2),
            'max_attempts' => 1,
        ]);

        // Gagal: jumlah kombinasi tidak seimbang (total 5, tetapi mc 3 + essay 1 = 4)
        $resInvalid = $this->postJson("/api/quizzes/{$quiz->id}/generate-prompt", [
            'prompt' => 'Buatkan soal tentang Flutter Widgets',
            'total_questions' => 5,
            'question_types' => 'combination',
            'mc_count' => 3,
            'essay_count' => 1,
        ]);

        $resInvalid->assertStatus(422);

        // Gagal: prompt terlalu pendek
        $resShort = $this->postJson("/api/quizzes/{$quiz->id}/generate-prompt", [
            'prompt' => 'ab',
            'total_questions' => 5,
            'question_types' => 'multiple_choice',
        ]);

        $resShort->assertStatus(422);
    }

    public function test_teacher_can_trigger_prompt_generation_and_job_processes(): void
    {
        Sanctum::actingAs($this->teacher);
        Queue::fake([GenerateQuizFromPromptJob::class]);

        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Prompt Sukses',
            'status' => 'draft_review',
            'due_date' => now()->addDays(2),
            'max_attempts' => 1,
        ]);

        $response = $this->postJson("/api/quizzes/{$quiz->id}/generate-prompt", [
            'prompt' => 'Buatkan soal tentang dasar-dasar Flutter',
            'total_questions' => 2,
            'question_types' => 'combination',
            'mc_count' => 1,
            'essay_count' => 1,
            'difficulty' => 'sedang',
        ]);

        $response->assertStatus(202)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'generating',
                ],
            ]);

        Queue::assertPushed(GenerateQuizFromPromptJob::class);

        // Mock Http 9router AI response untuk eksekusi Job
        $mockQuestions = [
            [
                'question_text' => 'Apa fungsi StatefulWidget?',
                'question_type' => 'multiple_choice',
                'options' => ['A' => 'Mutable state', 'B' => 'Immutable state', 'C' => 'Routing', 'D' => 'Database'],
                'correct_answer' => 'A',
            ],
            [
                'question_text' => 'Jelaskan lifecycle State pada Flutter!',
                'question_type' => 'essay',
                'options' => null,
                'correct_answer' => 'initState, didChangeDependencies, build, dispose.',
            ],
        ];

        Http::fake([
            'https://9router.wekanz.id/v1/chat/completions' => Http::response([
                'id' => 'chatcmpl-test',
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => json_encode($mockQuestions),
                        ],
                    ],
                ],
            ], 200),
        ]);

        // Eksekusi Job
        $job = new GenerateQuizFromPromptJob($quiz->id, [
            'prompt' => 'Buatkan soal tentang dasar-dasar Flutter',
            'total_questions' => 2,
            'question_types' => 'combination',
            'mc_count' => 1,
            'essay_count' => 1,
            'difficulty' => 'sedang',
        ]);
        $job->handle(app(AIService::class));

        $this->assertEquals('draft_review', $quiz->fresh()->status);
        $this->assertEquals(2, $quiz->questions()->count());
        $this->assertDatabaseHas('quiz_questions', [
            'quiz_id' => $quiz->id,
            'question_text' => 'Apa fungsi StatefulWidget?',
            'question_type' => 'multiple_choice',
            'correct_answer' => 'A',
        ]);
    }

    public function test_teacher_can_extract_questions_from_document(): void
    {
        Sanctum::actingAs($this->teacher);
        Queue::fake([ExtractQuizFromDocumentJob::class]);

        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Dokumen',
            'status' => 'draft_review',
            'due_date' => now()->addDays(2),
            'max_attempts' => 1,
        ]);

        $fakeDoc = UploadedFile::fake()->createWithContent('soal_uts.txt', "1. Apa kepanjangan dari PHP?\nA. PHP Hypertext Preprocessor\nB. Personal Home Page\nC. Private Host Page\nD. Program Hosting PHP\nKunci: A");

        $response = $this->postJson("/api/quizzes/{$quiz->id}/extract-document", [
            'document' => $fakeDoc,
        ]);

        $response->assertStatus(202)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'generating',
                ],
            ]);

        Queue::assertPushed(ExtractQuizFromDocumentJob::class);

        $mockExtracted = [
            [
                'question_text' => 'Apa kepanjangan dari PHP?',
                'question_type' => 'multiple_choice',
                'options' => [
                    'A' => 'PHP Hypertext Preprocessor',
                    'B' => 'Personal Home Page',
                    'C' => 'Private Host Page',
                    'D' => 'Program Hosting PHP',
                    'needs_review' => false,
                ],
                'correct_answer' => 'A',
            ],
        ];

        Http::fake([
            'https://9router.wekanz.id/v1/chat/completions' => Http::response([
                'id' => 'chatcmpl-test-doc',
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => json_encode($mockExtracted),
                        ],
                    ],
                ],
            ], 200),
        ]);

        // Eksekusi Job
        $job = new ExtractQuizFromDocumentJob($quiz->id, "1. Apa kepanjangan dari PHP?...");
        $job->handle(app(AIService::class));

        $this->assertEquals('draft_review', $quiz->fresh()->status);
        $this->assertEquals(1, $quiz->questions()->count());
        $this->assertDatabaseHas('quiz_questions', [
            'quiz_id' => $quiz->id,
            'question_text' => 'Apa kepanjangan dari PHP?',
            'correct_answer' => 'A',
        ]);
    }

    public function test_quiz_cannot_be_published_without_questions(): void
    {
        Sanctum::actingAs($this->teacher);

        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Kosong',
            'status' => 'draft_review',
            'due_date' => now()->addDays(2),
            'max_attempts' => 1,
        ]);

        $response = $this->patchJson("/api/quizzes/{$quiz->id}/publish");
        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Kuis belum memiliki butir soal. Harap tambahkan atau generate soal terlebih dahulu sebelum mempublikasikan.',
            ]);
    }

    public function test_teacher_can_publish_quiz_and_student_sees_questions_without_correct_answer(): void
    {
        Sanctum::actingAs($this->teacher);

        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Siap Publish',
            'status' => 'draft_review',
            'due_date' => now()->addDays(2),
            'max_attempts' => 1,
        ]);

        QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'question_text' => 'Apa nama ibukota Indonesia?',
            'question_type' => 'multiple_choice',
            'options' => ['A' => 'Jakarta', 'B' => 'Surabaya', 'C' => 'Bandung', 'D' => 'Medan'],
            'correct_answer' => 'A',
        ]);

        // Guru publish kuis
        $pubRes = $this->patchJson("/api/quizzes/{$quiz->id}/publish");
        $pubRes->assertStatus(200)
            ->assertJsonPath('data.status', 'published');

        // Siswa membuka kuis
        Sanctum::actingAs($this->student);
        $studentRes = $this->getJson("/api/quizzes/{$quiz->id}");

        $studentRes->assertStatus(200)
            ->assertJsonPath('data.title', 'Kuis Siap Publish')
            ->assertJsonMissing(['correct_answer' => 'A']);
    }

    public function test_student_from_other_class_cannot_access_quiz(): void
    {
        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Khusus RPL',
            'status' => 'published',
            'due_date' => now()->addDays(2),
            'max_attempts' => 1,
        ]);

        Sanctum::actingAs($this->otherStudent); // Siswa TKJ

        $response = $this->getJson("/api/quizzes/{$quiz->id}");
        $response->assertStatus(403);
    }

    public function test_student_cannot_access_draft_quiz(): void
    {
        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Masih Draft',
            'status' => 'draft_review',
            'due_date' => now()->addDays(2),
            'max_attempts' => 1,
        ]);

        Sanctum::actingAs($this->student);

        $response = $this->getJson("/api/quizzes/{$quiz->id}");
        $response->assertStatus(403);
    }

    public function test_student_can_submit_quiz_and_async_grading_scores_hybrid(): void
    {
        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Hybrid Pengerjaan',
            'status' => 'published',
            'due_date' => now()->addDays(2),
            'max_attempts' => 1,
        ]);

        $q1 = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'question_text' => '1 + 1 = ?',
            'question_type' => 'multiple_choice',
            'options' => ['A' => '1', 'B' => '2', 'C' => '3', 'D' => '4'],
            'correct_answer' => 'B',
        ]);

        $q2 = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'question_text' => 'Jelaskan enkapsulasi!',
            'question_type' => 'essay',
            'options' => null,
            'correct_answer' => 'Data hiding, getter, setter, private access.',
        ]);

        Sanctum::actingAs($this->student);
        Queue::fake([GradeQuizSubmissionJob::class]);

        $response = $this->postJson("/api/quizzes/{$quiz->id}/submissions", [
            'answers' => [
                ['question_id' => $q1->id, 'answer' => 'B'],
                ['question_id' => $q2->id, 'answer' => 'Enkapsulasi adalah pembungkusan data dengan private dan getter setter.'],
            ],
        ]);

        $response->assertStatus(202)
            ->assertJson([
                'success' => true,
                'data' => [
                    'attempt_number' => 1,
                    'grading_status' => 'pending',
                ],
            ]);

        Queue::assertPushed(GradeQuizSubmissionJob::class);

        $submission = QuizSubmission::first();
        $this->assertEquals('pending', $submission->grading_status);

        // Mock AI untuk penilaian esai
        Http::fake([
            'https://9router.wekanz.id/v1/chat/completions' => Http::response([
                'id' => 'chatcmpl-grade-test',
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => json_encode([
                                'score' => 90.0,
                                'feedback' => 'Penjelasan konsep sangat tepat dan mencakup kata kunci utama.',
                            ]),
                        ],
                    ],
                ],
            ], 200),
        ]);

        // Eksekusi Job Penilaian
        $gradeJob = new GradeQuizSubmissionJob($submission->id);
        $gradeJob->handle(app(AIService::class));

        $submission->refresh();
        $this->assertEquals('graded', $submission->grading_status);
        // Rata-rata skor: (100 [PG] + 90 [Esai]) / 2 = 95.0
        $this->assertEquals(95.0, $submission->ai_score);
        $this->assertStringContainsString('Soal #1 (Pilihan Ganda): Benar', $submission->ai_feedback);
        $this->assertStringContainsString('Soal #2 (Esai): Nilai 90', $submission->ai_feedback);
    }

    public function test_student_cannot_submit_after_due_date(): void
    {
        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Kedaluwarsa',
            'status' => 'published',
            'due_date' => now()->subDay(), // Kemarin
            'max_attempts' => 1,
        ]);

        $q = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'question_text' => 'Test',
            'question_type' => 'essay',
            'correct_answer' => 'Rubrik',
        ]);

        Sanctum::actingAs($this->student);

        $response = $this->postJson("/api/quizzes/{$quiz->id}/submissions", [
            'answers' => [
                ['question_id' => $q->id, 'answer' => 'Jawaban'],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Batas waktu pengerjaan kuis telah berakhir.',
            ]);
    }

    public function test_student_cannot_exceed_max_attempts(): void
    {
        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Max 1 Attempt',
            'status' => 'published',
            'due_date' => now()->addDays(2),
            'max_attempts' => 1,
        ]);

        $q = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'question_text' => 'Soal 1',
            'question_type' => 'essay',
            'correct_answer' => 'Rubrik',
        ]);

        // Attempt 1 sudah ada
        QuizSubmission::create([
            'quiz_id' => $quiz->id,
            'student_id' => $this->student->id,
            'attempt_number' => 1,
            'answers_payload' => [['question_id' => $q->id, 'answer' => 'Pertama']],
            'grading_status' => 'graded',
            'ai_score' => 80.0,
        ]);

        Sanctum::actingAs($this->student);

        // Attempt 2 harus ditolak
        $response = $this->postJson("/api/quizzes/{$quiz->id}/submissions", [
            'answers' => [
                ['question_id' => $q->id, 'answer' => 'Kedua'],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Batas percobaan kuis telah habis (maksimal 1 kali).',
            ]);
    }

    public function test_student_can_submit_multiple_attempts_up_to_max(): void
    {
        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis 2 Attempts',
            'status' => 'published',
            'due_date' => now()->addDays(2),
            'max_attempts' => 2,
        ]);

        $q = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'question_text' => 'Soal 1',
            'question_type' => 'essay',
            'correct_answer' => 'Rubrik',
        ]);

        Sanctum::actingAs($this->student);

        // Attempt 1
        $res1 = $this->postJson("/api/quizzes/{$quiz->id}/submissions", [
            'answers' => [['question_id' => $q->id, 'answer' => 'Attempt 1']],
        ]);
        $res1->assertStatus(202)->assertJsonPath('data.attempt_number', 1);

        // Attempt 2
        $res2 = $this->postJson("/api/quizzes/{$quiz->id}/submissions", [
            'answers' => [['question_id' => $q->id, 'answer' => 'Attempt 2']],
        ]);
        $res2->assertStatus(202)->assertJsonPath('data.attempt_number', 2);

        // Attempt 3 (Ditolak)
        $res3 = $this->postJson("/api/quizzes/{$quiz->id}/submissions", [
            'answers' => [['question_id' => $q->id, 'answer' => 'Attempt 3']],
        ]);
        $res3->assertStatus(422);
    }

    public function test_teacher_can_review_submissions_and_override_score_with_audit_trail(): void
    {
        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Override',
            'status' => 'published',
            'due_date' => now()->addDays(2),
            'max_attempts' => 1,
        ]);

        $submission = QuizSubmission::create([
            'quiz_id' => $quiz->id,
            'student_id' => $this->student->id,
            'attempt_number' => 1,
            'answers_payload' => [],
            'grading_status' => 'graded',
            'ai_score' => 60.0,
            'ai_feedback' => 'Perlu belajar lagi.',
        ]);

        Sanctum::actingAs($this->teacher);

        // Review submissions list
        $resList = $this->getJson("/api/quizzes/{$quiz->id}/submissions");
        $resList->assertStatus(200)
            ->assertJsonPath('data.total_submissions', 1);

        // Guru override nilai menjadi 88.5
        $resOverride = $this->patchJson("/api/quiz-submissions/{$submission->id}", [
            'score' => 88.5,
            'feedback' => 'Nilai disesuaikan setelah verifikasi jawaban esai secara manual.',
        ]);

        $resOverride->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $submission->id,
                    'ai_score' => 88.5,
                    'is_overridden' => true,
                ],
            ]);

        $submission->refresh();
        $this->assertEquals(88.5, $submission->ai_score);
        $this->assertTrue($submission->is_overridden);
        $this->assertEquals($this->teacher->id, $submission->overridden_by);
        $this->assertNotNull($submission->overridden_at);
    }

    public function test_student_and_parent_cannot_see_results_before_published_result(): void
    {
        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Belum Rilis Hasil',
            'status' => 'published',
            'due_date' => now()->addDays(2),
            'max_attempts' => 1,
        ]);

        QuizSubmission::create([
            'quiz_id' => $quiz->id,
            'student_id' => $this->student->id,
            'attempt_number' => 1,
            'answers_payload' => [],
            'grading_status' => 'graded',
            'ai_score' => 90.0,
        ]);

        Sanctum::actingAs($this->student);
        $resStudent = $this->getJson("/api/quizzes/{$quiz->id}/submissions/me");

        $resStudent->assertStatus(200)
            ->assertJson([
                'success' => false,
                'message' => 'Hasil penilaian kuis belum dipublikasikan oleh guru pengajar.',
            ]);
    }

    public function test_student_and_parent_can_see_final_results_after_published_result(): void
    {
        $quiz = Quiz::create([
            'teacher_id' => $this->teacher->id,
            'class_id' => $this->schoolClass->id,
            'title' => 'Kuis Sudah Rilis Hasil',
            'status' => 'published_result',
            'due_date' => now()->subDay(),
            'max_attempts' => 2,
        ]);

        QuizSubmission::create([
            'quiz_id' => $quiz->id,
            'student_id' => $this->student->id,
            'attempt_number' => 1,
            'answers_payload' => [],
            'grading_status' => 'graded',
            'ai_score' => 70.0,
            'ai_feedback' => 'Bagus',
        ]);

        QuizSubmission::create([
            'quiz_id' => $quiz->id,
            'student_id' => $this->student->id,
            'attempt_number' => 2,
            'answers_payload' => [],
            'grading_status' => 'graded',
            'ai_score' => 92.5,
            'ai_feedback' => 'Sangat bagus',
        ]);

        // Siswa cek hasil
        Sanctum::actingAs($this->student);
        $resStudent = $this->getJson("/api/quizzes/{$quiz->id}/submissions/me");

        $resStudent->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'best_score' => 92.5,
                    'attempts_used' => 2,
                ],
            ]);

        // Orang tua cek hasil anaknya
        Sanctum::actingAs($this->parent);
        $resParent = $this->getJson("/api/quizzes/{$quiz->id}/submissions/me");

        $resParent->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'best_score' => 92.5,
                ],
            ]);
    }
}
