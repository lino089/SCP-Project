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
        Schema::table('schedule_imports', function (Blueprint $table) {
            if (!Schema::hasColumn('schedule_imports', 'error_message')) {
                $table->text('error_message')->nullable()->after('parser_version');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('schedule_imports', function (Blueprint $table) {
            if (Schema::hasColumn('schedule_imports', 'error_message')) {
                $table->dropColumn('error_message');
            }
        });
    }
};
