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
        // 1. Tambah kolom category pada subjects jika belum ada
        if (Schema::hasTable('subjects') && !Schema::hasColumn('subjects', 'category')) {
            Schema::table('subjects', function (Blueprint $table) {
                $table->string('category', 20)->default('normada')->after('name');
                $table->index('category');
            });
        }

        // 2. Tambah kolom type pada rooms jika belum ada
        if (Schema::hasTable('rooms') && !Schema::hasColumn('rooms', 'type')) {
            Schema::table('rooms', function (Blueprint $table) {
                $table->string('type', 20)->default('theory')->after('capacity');
                $table->index('type');
            });
        }

        // 3. Buat tabel curriculum_teaching_assignments (Beban Mengajar Kurikulum)
        if (!Schema::hasTable('curriculum_teaching_assignments')) {
            Schema::create('curriculum_teaching_assignments', function (Blueprint $table) {
                $table->id();
                $table->string('academic_year', 50)->default('2025/2026 Ganjil');
                $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
                $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
                $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
                $table->integer('total_jp')->default(2);
                $table->string('preferred_cycle', 20)->default('auto'); // 'cycle_1', 'cycle_2', 'both', 'auto'
                $table->foreignId('preferred_room_id')->nullable()->constrained('rooms')->nullOnDelete();
                $table->integer('max_block_jp')->default(4);
                $table->timestamps();
                $table->softDeletes();

                $table->index(['class_id', 'academic_year'], 'idx_cta_class_year');
                $table->index(['teacher_id', 'academic_year'], 'idx_cta_teacher_year');
                $table->index(['preferred_cycle'], 'idx_cta_preferred_cycle');
            });
        }

        // 4. Buat tabel schedule_generation_batches (Staging Batch)
        if (!Schema::hasTable('schedule_generation_batches')) {
            Schema::create('schedule_generation_batches', function (Blueprint $table) {
                $table->id();
                $table->uuid('batch_uuid')->unique();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->json('target_cycles');
                $table->string('status', 30)->default('pending'); // 'pending', 'processing', 'completed', 'failed', 'applied', 'discarded'
                $table->integer('total_classes_processed')->default(0);
                $table->integer('total_slots_generated')->default(0);
                $table->float('execution_time_seconds')->default(0);
                $table->text('error_message')->nullable();
                $table->timestamps();

                $table->index('batch_uuid');
                $table->index('status');
            });
        }

        // 5. Buat tabel schedule_generation_drafts (Staging Slots)
        if (!Schema::hasTable('schedule_generation_drafts')) {
            Schema::create('schedule_generation_drafts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('batch_id')->constrained('schedule_generation_batches')->cascadeOnDelete();
                $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
                $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
                $table->foreignId('room_id')->constrained('rooms')->cascadeOnDelete();
                $table->integer('day_of_week'); // 1 = Senin s.d. 5 = Jumat
                $table->integer('period_number'); // 1 s.d. 10
                $table->integer('duration_periods')->default(1);
                $table->integer('cycle_type'); // 1 atau 2
                $table->string('category', 20)->default('normada');
                $table->boolean('has_conflict')->default(false);
                $table->text('conflict_note')->nullable();
                $table->timestamps();

                $table->index(['batch_id', 'cycle_type'], 'idx_sgd_batch_cycle');
                $table->index(['batch_id', 'class_id'], 'idx_sgd_batch_class');
                $table->index(['batch_id', 'teacher_id'], 'idx_sgd_batch_teacher');
            });
        }

        // 6. Auto-Tagging Awal untuk Subjects
        $subjects = DB::table('subjects')->get();
        foreach ($subjects as $s) {
            $name = strtoupper(trim($s->name));
            $isJurusan = preg_match('/\b(DDPK|DDK|KK|KONSENTRASI|KEJURUAN|MAPEL PILIHAN|PRODUK KREATIF|PRODUKTIF|PKK)\b/i', $name)
                || preg_match('/(RPL|TKJ|DKV|MP|BD|AK|BR|LPS|KARYA UI|FOTOGRAFI|VIDEOGRAFI|ANIMASI|PEMROGRAMAN|JARINGAN|BIGDATA|MACHINE LEARNING|BASIS DATA|SISTEM JARINGAN)/i', $name);
            
            DB::table('subjects')->where('id', $s->id)->update([
                'category' => $isJurusan ? 'jurusan' : 'normada'
            ]);
        }

        // 7. Auto-Tagging Awal untuk Rooms
        $rooms = DB::table('rooms')->get();
        foreach ($rooms as $r) {
            $name = strtoupper(trim($r->name));
            if (in_array($name, ['OR', 'OR1', 'OR2', 'OR3', 'LAPANGAN', 'LAPANGAN OLAHRAGA']) || preg_match('/\b(OR|LAPANGAN)\b/i', $name)) {
                $type = 'field';
            } elseif (in_array($name, ['HALL', 'AULA']) || preg_match('/\b(HALL|AULA)\b/i', $name)) {
                $type = 'hall';
            } elseif (preg_match('/^L\.IPA$|^LAB IPA$/i', $name)) {
                $type = 'lab_science';
            } elseif (preg_match('/^L\.\d+|^LAB/i', $name)) {
                $type = 'lab_computer';
            } else {
                $type = 'theory';
            }

            DB::table('rooms')->where('id', $r->id)->update([
                'type' => $type
            ]);
        }

        // 8. Seeding Awal curriculum_teaching_assignments dari tabel schedules aktif
        $activeYear = '2025/2026 Ganjil';
        if (Schema::hasTable('system_configurations')) {
            $cfgYear = DB::table('system_configurations')->value('academic_year');
            if ($cfgYear) $activeYear = $cfgYear;
        }

        if (Schema::hasTable('schedules') && DB::table('schedules')->whereNull('deleted_at')->exists()) {
            $allocations = DB::table('schedules')
                ->select(
                    'class_id',
                    'subject_id',
                    'teacher_id',
                    'cycle_type',
                    DB::raw('sum(duration_periods) as total_jp'),
                    DB::raw('max(duration_periods) as max_block_jp'),
                    DB::raw('min(room_id) as sample_room_id')
                )
                ->whereNull('deleted_at')
                ->groupBy('class_id', 'subject_id', 'teacher_id', 'cycle_type')
                ->get();

            $now = now();
            $batchData = [];

            foreach ($allocations as $alloc) {
                $preferredCycle = $alloc->cycle_type == 1 ? 'cycle_1' : 'cycle_2';
                $batchData[] = [
                    'academic_year' => $activeYear,
                    'class_id' => $alloc->class_id,
                    'subject_id' => $alloc->subject_id,
                    'teacher_id' => $alloc->teacher_id,
                    'total_jp' => (int) $alloc->total_jp,
                    'preferred_cycle' => $preferredCycle,
                    'preferred_room_id' => $alloc->sample_room_id,
                    'max_block_jp' => max(2, (int) $alloc->max_block_jp),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            // Insert in chunks of 200
            foreach (array_chunk($batchData, 200) as $chunk) {
                DB::table('curriculum_teaching_assignments')->insert($chunk);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('schedule_generation_drafts');
        Schema::dropIfExists('schedule_generation_batches');
        Schema::dropIfExists('curriculum_teaching_assignments');

        if (Schema::hasTable('rooms') && Schema::hasColumn('rooms', 'type')) {
            Schema::table('rooms', function (Blueprint $table) {
                $table->dropColumn('type');
            });
        }

        if (Schema::hasTable('subjects') && Schema::hasColumn('subjects', 'category')) {
            Schema::table('subjects', function (Blueprint $table) {
                $table->dropColumn('category');
            });
        }
    }
};
