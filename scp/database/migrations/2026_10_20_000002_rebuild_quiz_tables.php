<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Drop legacy tables if they exist
        Schema::dropIfExists('quiz_submisions');
        Schema::dropIfExists('quiz_submissions');
        Schema::dropIfExists('quiz_questions');
        Schema::dropIfExists('quizzes');
        Schema::dropIfExists('ai_quizzes');

        // 1. ai_quizzes
        Schema::create('ai_quizzes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->string('title');
            $table->enum('status', ['generating', 'draft_review', 'published', 'published_result'])->default('generating');
            $table->dateTime('due_date');
            $table->integer('max_attempts')->default(1);
            $table->timestamps();

            $table->index(['teacher_id', 'status']);
            $table->index(['class_id', 'status']);
        });

        // 2. quiz_questions
        Schema::create('quiz_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained('ai_quizzes')->cascadeOnDelete();
            $table->text('question_text');
            $table->json('options')->nullable();
            $table->text('correct_answer');
            $table->enum('question_type', ['multiple_choice', 'essay'])->default('multiple_choice');
            $table->timestamps();

            $table->index('quiz_id');
        });

        // 3. quiz_submissions
        Schema::create('quiz_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained('ai_quizzes')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->integer('attempt_number')->default(1);
            $table->json('answers_payload');
            $table->enum('grading_status', ['pending', 'graded'])->default('pending');
            $table->decimal('ai_score', 5, 2)->nullable();
            $table->text('ai_feedback')->nullable();
            $table->boolean('is_overridden')->default(false);
            $table->foreignId('overridden_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('overridden_at')->nullable();
            $table->timestamps();

            $table->unique(['quiz_id', 'student_id', 'attempt_number']);
            $table->index(['quiz_id', 'student_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quiz_submissions');
        Schema::dropIfExists('quiz_questions');
        Schema::dropIfExists('ai_quizzes');
    }
};
