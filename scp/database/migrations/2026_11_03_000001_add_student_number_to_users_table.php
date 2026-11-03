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
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'student_number')) {
                $table->unsignedSmallInteger('student_number')->nullable()->after('nis_nip');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->index(['class_id', 'student_number'], 'users_class_student_number_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_class_student_number_idx');
            if (Schema::hasColumn('users', 'student_number')) {
                $table->dropColumn('student_number');
            }
        });
    }
};
