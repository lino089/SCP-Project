<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_quizzes', function (Blueprint $table) {
            if (! Schema::hasColumn('ai_quizzes', 'duration_minutes')) {
                $table->integer('duration_minutes')->default(30)->after('max_attempts');
            }
        });

        if (! Schema::hasTable('quiz_attempts')) {
            Schema::create('quiz_attempts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('quiz_id')->constrained('ai_quizzes')->cascadeOnDelete();
                $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
                $table->integer('attempt_number')->default(1);
                $table->dateTime('started_at');
                $table->dateTime('expires_at');
                $table->dateTime('submitted_at')->nullable();
                $table->timestamps();

                $table->index(['quiz_id', 'student_id']);
                $table->index(['quiz_id', 'student_id', 'submitted_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_attempts');

        Schema::table('ai_quizzes', function (Blueprint $table) {
            if (Schema::hasColumn('ai_quizzes', 'duration_minutes')) {
                $table->dropColumn('duration_minutes');
            }
        });
    }
};
