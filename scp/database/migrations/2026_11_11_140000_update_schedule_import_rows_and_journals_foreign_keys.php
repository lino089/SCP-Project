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
        if (DB::getDriverName() !== 'sqlite') {
            Schema::table('schedule_import_rows', function (Blueprint $table) {
                $table->dropForeign('schedule_import_rows_matched_teacher_id_foreign');
                $table->dropForeign('schedule_import_rows_matched_class_id_foreign');
                $table->dropForeign('schedule_import_rows_matched_room_id_foreign');
                $table->dropForeign('schedule_import_rows_matched_subject_id_foreign');

                $table->foreign('matched_teacher_id')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();

                $table->foreign('matched_class_id')
                    ->references('id')
                    ->on('classes')
                    ->nullOnDelete();

                $table->foreign('matched_room_id')
                    ->references('id')
                    ->on('rooms')
                    ->nullOnDelete();

                $table->foreign('matched_subject_id')
                    ->references('id')
                    ->on('subjects')
                    ->nullOnDelete();
            });

            Schema::table('journals', function (Blueprint $table) {
                $table->dropForeign('journals_substitute_teacher_id_foreign');

                $table->foreign('substitute_teacher_id')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            Schema::table('schedule_import_rows', function (Blueprint $table) {
                $table->dropForeign(['matched_teacher_id']);
                $table->dropForeign(['matched_class_id']);
                $table->dropForeign(['matched_room_id']);
                $table->dropForeign(['matched_subject_id']);

                $table->foreign('matched_teacher_id')
                    ->references('id')
                    ->on('users');

                $table->foreign('matched_class_id')
                    ->references('id')
                    ->on('classes');

                $table->foreign('matched_room_id')
                    ->references('id')
                    ->on('rooms');

                $table->foreign('matched_subject_id')
                    ->references('id')
                    ->on('subjects');
            });

            Schema::table('journals', function (Blueprint $table) {
                $table->dropForeign(['substitute_teacher_id']);

                $table->foreign('substitute_teacher_id')
                    ->references('id')
                    ->on('users');
            });
        }
    }
};
