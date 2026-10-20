<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Quiz;
use App\Models\QuizQuestion;
use App\Models\QuizSubmission;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class QuizSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_quiz_schema_supports_multi_attempts_and_question_types(): void
    {
        $teacher = User::create([
            'name' => 'Guru Pengajar',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012010011005',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $class = Classes::create([
            'name' => 'XI RPL 1',
            'level' => 11,
        ]);

        $student = User::create([
            'name' => 'Siswa Pintar',
            'email' => 'siswa@example.com',
            'nis_nip' => '12345679',
            'role' => 'student',
            'class_id' => $class->id,
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        // 1. Create Quiz
        $quiz = Quiz::create([
            'teacher_id' => $teacher->id,
            'class_id' => $class->id,
            'title' => 'Kuis Pemrograman Web',
            'status' => 'published',
            'due_date' => now()->addDays(2),
            'max_attempts' => 2,
        ]);

        $this->assertDatabaseHas('ai_quizzes', [
            'id' => $quiz->id,
            'teacher_id' => $teacher->id,
            'class_id' => $class->id,
            'max_attempts' => 2,
        ]);

        // 2. Create Questions (Multiple choice and Essay)
        $q1 = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'question_text' => 'Apa tag HTML untuk paragraf?',
            'options' => ['A' => '<p>', 'B' => '<div>', 'C' => '<span>', 'D' => '<h1>'],
            'correct_answer' => 'A',
            'question_type' => 'multiple_choice',
        ]);

        $q2 = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'question_text' => 'Jelaskan cara kerja MVC di Laravel!',
            'options' => null,
            'correct_answer' => 'Model menangani data, View menangani tampilan, Controller menangani logika bisnis.',
            'question_type' => 'essay',
        ]);

        $this->assertCount(2, $quiz->questions);
        $this->assertEquals('essay', $q2->question_type);

        // 3. Multi-attempt submissions for the same student
        $sub1 = QuizSubmission::create([
            'quiz_id' => $quiz->id,
            'student_id' => $student->id,
            'attempt_number' => 1,
            'answers_payload' => [
                ['question_id' => $q1->id, 'answer' => 'A'],
                ['question_id' => $q2->id, 'answer' => 'MVC adalah arsitektur web.'],
            ],
            'grading_status' => 'graded',
            'ai_score' => 75.00,
            'ai_feedback' => 'Penjelasan esai kurang lengkap.',
        ]);

        $sub2 = QuizSubmission::create([
            'quiz_id' => $quiz->id,
            'student_id' => $student->id,
            'attempt_number' => 2,
            'answers_payload' => [
                ['question_id' => $q1->id, 'answer' => 'A'],
                ['question_id' => $q2->id, 'answer' => 'Model untuk database, View untuk UI, Controller penghubung.'],
            ],
            'grading_status' => 'graded',
            'ai_score' => 90.00,
            'ai_feedback' => 'Jawaban esai sangat baik.',
        ]);

        $this->assertDatabaseHas('quiz_submissions', ['id' => $sub1->id, 'attempt_number' => 1]);
        $this->assertDatabaseHas('quiz_submissions', ['id' => $sub2->id, 'attempt_number' => 2]);
        $this->assertCount(2, $quiz->submissions);

        // 4. Duplicate attempt_number must throw QueryException
        $this->expectException(QueryException::class);
        QuizSubmission::create([
            'quiz_id' => $quiz->id,
            'student_id' => $student->id,
            'attempt_number' => 1,
            'answers_payload' => [],
        ]);
    }
}
