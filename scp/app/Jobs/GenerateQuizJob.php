<?php

namespace App\Jobs;

use App\Models\Journal;
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

class GenerateQuizJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 90;

    protected $targetId;
    protected ?string $topic;

    /**
     * Create a new job instance.
     */
    public function __construct($targetId, ?string $topic = null)
    {
        $this->targetId = $targetId;
        $this->topic = $topic;
    }

    /**
     * Execute the job.
     */
    public function handle(AIService $aiService): void
    {
        // Cek apakah targetId adalah Quiz ID atau Journal ID
        $quiz = Quiz::find($this->targetId);

        if (!$quiz) {
            $journal = Journal::find($this->targetId);
            if ($journal) {
                $topic = $this->topic ?? $journal->topic_description ?? 'Materi Pembelajaran';
                $quiz = Quiz::create([
                    'teacher_id' => $journal->schedule?->teacher_id ?? auth()->id() ?? 1,
                    'class_id' => $journal->schedule?->class_id ?? 1,
                    'title' => 'Kuis: ' . $topic,
                    'status' => 'generating',
                    'due_date' => now()->addDays(2),
                    'max_attempts' => 1,
                ]);
            }
        }

        if (!$quiz) {
            Log::warning("GenerateQuizJob: Quiz or Journal not found for ID {$this->targetId}.");
            return;
        }

        $topic = $this->topic ?? $quiz->title ?? 'Materi Pembelajaran';

        try {
            $questions = $aiService->generateFromPrompt(
                prompt: $topic,
                total: 5,
                type: 'combination',
                essayCount: 2,
                mcCount: 3
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
            Log::info("GenerateQuizJob: Generated " . count($questions) . " questions for Quiz {$quiz->id}.");
        } catch (Throwable $e) {
            Log::error("GenerateQuizJob Error for Quiz {$quiz->id}: " . $e->getMessage());
            $quiz->update(['status' => 'draft_review']);
        }
    }
}
