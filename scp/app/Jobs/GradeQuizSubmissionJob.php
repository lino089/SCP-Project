<?php

namespace App\Jobs;

use App\Models\QuizSubmission;
use App\Services\AIService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class GradeQuizSubmissionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 120;

    protected int $submissionId;

    /**
     * Create a new job instance.
     */
    public function __construct(int $submissionId)
    {
        $this->submissionId = $submissionId;
    }

    /**
     * Execute the job.
     */
    public function handle(AIService $aiService): void
    {
        $submission = QuizSubmission::with(['quiz.questions'])->find($this->submissionId);

        if (!$submission || !$submission->quiz) {
            Log::warning("GradeQuizSubmissionJob: Submission ID {$this->submissionId} not found.");
            return;
        }

        $quiz = $submission->quiz;
        $questions = $quiz->questions->keyBy('id');
        $rawAnswers = $submission->answers_payload;

        // Petakan jawaban siswa berdasarkan question_id
        $studentAnswers = [];
        if (is_array($rawAnswers)) {
            foreach ($rawAnswers as $ans) {
                if (isset($ans['question_id'])) {
                    $studentAnswers[$ans['question_id']] = $ans['answer'] ?? $ans['selected_option'] ?? '';
                }
            }
        }

        $totalQuestions = $questions->count();
        if ($totalQuestions === 0) {
            $submission->update([
                'ai_score' => 0,
                'ai_feedback' => 'Kuis tidak memiliki butir soal.',
                'grading_status' => 'graded',
            ]);
            return;
        }

        $accumulatedScore = 0.0;
        $feedbackParts = [];

        foreach ($questions as $qId => $question) {
            $studentAns = trim((string) ($studentAnswers[$qId] ?? ''));
            $qNum = count($feedbackParts) + 1;

            if ($question->question_type === 'multiple_choice') {
                $isCorrect = (strtoupper($studentAns) === strtoupper(trim($question->correct_answer)));
                $score = $isCorrect ? 100.0 : 0.0;
                $accumulatedScore += $score;

                if ($isCorrect) {
                    $feedbackParts[] = "Soal #{$qNum} (Pilihan Ganda): Benar ({$studentAns}).";
                } else {
                    $feedbackParts[] = "Soal #{$qNum} (Pilihan Ganda): Salah (Jawaban: {$studentAns}, Kunci: {$question->correct_answer}).";
                }
            } else {
                // Soal Esai dievaluasi oleh AI
                try {
                    $eval = $aiService->gradeEssay(
                        questionText: $question->question_text,
                        rubric: $question->correct_answer,
                        studentAnswer: $studentAns
                    );
                    $essayScore = (float) $eval['score'];
                    $accumulatedScore += $essayScore;
                    $feedbackParts[] = "Soal #{$qNum} (Esai): Nilai {$essayScore}/100. Evaluasi: {$eval['feedback']}";
                } catch (Throwable $e) {
                    Log::error("GradeQuizSubmissionJob Error on Essay #{$qId}: " . $e->getMessage());
                    // Fallback skor default jika AI gagal saat evaluasi butir tertentu
                    $feedbackParts[] = "Soal #{$qNum} (Esai): Penilaian otomatis terkendala, menunggu review manual guru.";
                }
            }
        }

        $finalScore = round($accumulatedScore / $totalQuestions, 2);
        $finalFeedback = implode("\n", $feedbackParts);

        $submission->update([
            'ai_score' => $finalScore,
            'ai_feedback' => $finalFeedback,
            'grading_status' => 'graded',
        ]);

        Log::info("GradeQuizSubmissionJob: Submission ID {$submission->id} graded with score {$finalScore}.");
    }
}
