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
            $table->index(['role', 'class_id', 'student_number'], 'idx_users_role_class_student');
            $table->index('name', 'idx_users_name');
        });

        Schema::table('classes', function (Blueprint $table) {
            $table->index(['name', 'deleted_at'], 'idx_classes_name_deleted');
        });

        Schema::table('rooms', function (Blueprint $table) {
            $table->index(['name', 'deleted_at'], 'idx_rooms_name_deleted');
        });

        Schema::table('subjects', function (Blueprint $table) {
            $table->index(['name', 'deleted_at'], 'idx_subjects_name_deleted');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_role_class_student');
            $table->dropIndex('idx_users_name');
        });

        Schema::table('classes', function (Blueprint $table) {
            $table->dropIndex('idx_classes_name_deleted');
        });

        Schema::table('rooms', function (Blueprint $table) {
            $table->dropIndex('idx_rooms_name_deleted');
        });

        Schema::table('subjects', function (Blueprint $table) {
            $table->dropIndex('idx_subjects_name_deleted');
        });
    }
};
