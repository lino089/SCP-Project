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
        Schema::dropIfExists('substitute_assignments');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('substitute_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('schedule_id')->constrained('schedules');
            $table->foreignId('original_teacher_id')->constrained('users');
            $table->foreignId('substitute_teacher_id')->constrained('users');
            $table->foreignId('assigned_by')->constrained('users');
            $table->date('date');
            $table->text('reason')->nullable();
            $table->timestamps();
        });
    }
};
