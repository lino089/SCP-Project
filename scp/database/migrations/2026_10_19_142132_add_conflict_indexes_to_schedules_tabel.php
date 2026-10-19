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
        Schema::table('schedules', function (Blueprint $table) {
            $table->index(['cycle_type', 'day_of_week']);
            $table->index('teacher_id');
            $table->index('class_id');
            $table->index('room_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropIndex(['cycle_type', 'day_of_week']);
            $table->dropIndex(['teacher_id']);
            $table->dropIndex(['class_id']);
            $table->dropIndex(['room_id']);
        });
    }
};
