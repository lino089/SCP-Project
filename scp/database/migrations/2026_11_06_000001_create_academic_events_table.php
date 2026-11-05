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
        Schema::create('academic_events', function (Blueprint $table) {
            $table->id();
            $table->string('title', 150);
            $table->text('description')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('type', 30); // holiday, school_event, class_event, exam
            $table->string('scope_type', 20)->default('all'); // all, grade, class
            $table->json('scope_targets')->nullable();
            $table->boolean('disables_teaching')->default(true);
            $table->string('academic_year', 20)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['start_date', 'end_date'], 'idx_academic_events_dates');
            $table->index(['disables_teaching', 'scope_type'], 'idx_academic_events_scope_teaching');
            $table->index('academic_year', 'idx_academic_events_academic_year');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('academic_events');
    }
};
