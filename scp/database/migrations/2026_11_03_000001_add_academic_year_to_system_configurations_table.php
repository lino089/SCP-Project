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
        Schema::table('system_configurations', function (Blueprint $table) {
            $table->string('academic_year', 50)->default('2025/2026 Ganjil')->after('monday_is_upacara');
            $table->string('semester', 20)->default('Ganjil')->after('academic_year');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('system_configurations', function (Blueprint $table) {
            $table->dropColumn(['academic_year', 'semester']);
        });
    }
};
