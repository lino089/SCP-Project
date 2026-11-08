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
        Schema::table('journals', function (Blueprint $table) {
            $table->index('date', 'idx_journals_date');
        });

        Schema::table('attendances', function (Blueprint $table) {
            $table->index('journal_id', 'idx_attendances_journal_id');
            $table->unique(['journal_id', 'student_id'], 'idx_attendances_journal_student_unique');
        });

        Schema::table('schedules', function (Blueprint $table) {
            // Drop redundant inverted index (day_of_week, cycle_type is retained)
            $table->dropIndex('schedules_cycle_type_day_of_week_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('journals', function (Blueprint $table) {
            $table->dropIndex('idx_journals_date');
        });

        Schema::table('attendances', function (Blueprint $table) {
            $table->dropUnique('idx_attendances_journal_student_unique');
            $table->dropIndex('idx_attendances_journal_id');
        });

        Schema::table('schedules', function (Blueprint $table) {
            $table->index(['cycle_type', 'day_of_week'], 'schedules_cycle_type_day_of_week_index');
        });
    }
};
