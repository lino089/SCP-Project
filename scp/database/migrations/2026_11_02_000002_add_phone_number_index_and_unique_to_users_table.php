<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->index(['phone_number', 'role'], 'users_phone_number_role_index');
        });

        // Partial unique index for active teachers
        try {
            DB::statement('CREATE UNIQUE INDEX users_teacher_phone_unique ON users (phone_number) WHERE role = \'teacher\' AND deleted_at IS NULL AND phone_number IS NOT NULL');
        } catch (\Throwable) {
            // Handled gracefully if database dialect does not support partial indexes
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        try {
            DB::statement('DROP INDEX IF EXISTS users_teacher_phone_unique');
        } catch (\Throwable) {
            // Ignore
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_phone_number_role_index');
        });
    }
};
