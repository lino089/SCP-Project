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
            if (Schema::hasColumn('users', 'fet_staff_id')) {
                try {
                    $table->dropUnique(['fet_staff_id']);
                } catch (\Throwable $e) {
                    // Ignore if already dropped or index differs
                }
                $table->dropColumn('fet_staff_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'fet_staff_id')) {
                $table->string('fet_staff_id')->nullable()->unique();
            }
        });
    }
};
