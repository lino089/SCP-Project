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

class GenerateQuizFromPromptJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 90;

    protected int $quizId;
    protected array $config;

    /**
     * Create a new job instance.
     */
    public function __construct(int $quizId, array $config)
    {
        $this->quizId = $quizId;
        $this->config = $config;
    }

    /**
     * Execute the job.
     */
    public function handle(AIService $aiService): void
    {
        $quiz = Quiz::find($this->quizId);
        if (!$quiz) {
            Log::warning("GenerateQuizFromPromptJob: Quiz with ID {$this->quizId} not found.");
            return;
        }

        try {
            $questions = $aiService->generateFromPrompt(
                prompt: $this->config['prompt'],
                total: (int) $this->config['total_questions'],
                type: $this->config['question_types'],
                essayCount: (int) ($this->config['essay_count'] ?? 0),
                mcCount: (int) ($this->config['mc_count'] ?? 0),
                difficulty: $this->config['difficulty'] ?? null,
                notes: $this->config['additional_notes'] ?? null
            );

            foreach ($questions as $q) {
                QuizQuestion::create([
                    'quiz_id' => $quiz->id,
                    'question_text' => $q['question_text'] ?? 'Pertanyaan',
                    'question_type' => $q['question_type'] ?? 'multiple_choice',
                    'options' => $q['options'] ?? null,
                    'correct_answer' => $q['correct_answer'] ?? '',
                ]);
            }

            $quiz->update(['status' => 'draft_review']);
            Log::info("GenerateQuizFromPromptJob: Successfully generated " . count($questions) . " questions for Quiz {$quiz->id}.");
        } catch (Throwable $e) {
            Log::error("GenerateQuizFromPromptJob Error for Quiz {$quiz->id}: " . $e->getMessage());
            // Tetap pastikan status kuis berada di draft_review agar tidak menggantung di 'generating'
            $quiz->update(['status' => 'draft_review']);
            throw $e;
        }
    }
}
