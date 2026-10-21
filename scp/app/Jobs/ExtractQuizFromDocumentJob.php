<?php

namespace App\Jobs;

use App\Models\Quiz;
use App\Models\QuizQuestion;
use App\Services\AIService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class ExtractQuizFromDocumentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 90;

    protected int $quizId;
    protected string $documentText;

    /**
     * Create a new job instance.
     */
    public function __construct(int $quizId, string $documentText)
    {
        $this->quizId = $quizId;
        $this->documentText = $documentText;
    }

    /**
     * Execute the job.
     */
    public function handle(AIService $aiService): void
    {
        $quiz = Quiz::find($this->quizId);
        if (!$quiz) {
            Log::warning("ExtractQuizFromDocumentJob: Quiz with ID {$this->quizId} not found.");
            return;
        }

        try {
            $questions = $aiService->extractFromDocumentText($this->documentText);

            foreach ($questions as $q) {
                QuizQuestion::create([
                    'quiz_id' => $quiz->id,
                    'question_text' => $q['question_text'] ?? 'Pertanyaan dari dokumen',
                    'question_type' => $q['question_type'] ?? 'multiple_choice',
                    'options' => $q['options'] ?? null,
                    'correct_answer' => $q['correct_answer'] ?? '',
                ]);
            }

            $quiz->update(['status' => 'draft_review']);
            Log::info("ExtractQuizFromDocumentJob: Successfully extracted " . count($questions) . " questions for Quiz {$quiz->id}.");
        } catch (Throwable $e) {
            Log::error("ExtractQuizFromDocumentJob Error for Quiz {$quiz->id}: " . $e->getMessage());
            $quiz->update(['status' => 'draft_review']);
            throw $e;
        }
    }
}
