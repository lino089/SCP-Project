<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_source_check;");
        DB::statement("ALTER TABLE schedules ADD CONSTRAINT schedules_source_check CHECK (source IN ('manual', 'imported', 'auto_generated'));");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_source_check;");
        DB::statement("ALTER TABLE schedules ADD CONSTRAINT schedules_source_check CHECK (source IN ('manual', 'imported'));");
    }
};
