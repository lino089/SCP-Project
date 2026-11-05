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
        // 1. Tambahkan kolom siklus hidup penugasan pada tabel teacher_assignments
        Schema::table('teacher_assignments', function (Blueprint $table) {
            if (!Schema::hasColumn('teacher_assignments', 'academic_year')) {
                $table->string('academic_year', 50)->nullable()->after('class_id');
            }
            if (!Schema::hasColumn('teacher_assignments', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('academic_year');
            }
            if (!Schema::hasColumn('teacher_assignments', 'started_at')) {
                $table->timestamp('started_at')->nullable()->after('is_active');
            }
            if (!Schema::hasColumn('teacher_assignments', 'ended_at')) {
                $table->timestamp('ended_at')->nullable()->after('started_at');
            }
            if (!Schema::hasColumn('teacher_assignments', 'assigned_by')) {
                $table->foreignId('assigned_by')->nullable()->after('ended_at')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('teacher_assignments', 'revoked_by')) {
                $table->foreignId('revoked_by')->nullable()->after('assigned_by')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('teacher_assignments', 'notes')) {
                $table->string('notes', 500)->nullable()->after('revoked_by');
            }

            $table->index(['type', 'class_id', 'is_active'], 'idx_ta_type_class_active');
            $table->index(['user_id', 'type', 'is_active'], 'idx_ta_user_type_active');
        });

        // Backfill data existing teacher_assignments
        $activeAcademicYear = null;
        if (Schema::hasTable('system_configurations') && Schema::hasColumn('system_configurations', 'academic_year')) {
            $activeAcademicYear = DB::table('system_configurations')->value('academic_year');
        }
        $activeAcademicYear = $activeAcademicYear ?: '2026/2027';

        DB::table('teacher_assignments')
            ->whereNull('started_at')
            ->update([
                'is_active' => true,
                'academic_year' => $activeAcademicYear,
                'started_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)'),
            ]);

        // 2. Tambahkan snapshot class_id dan academic_year pada tabel leave_requests
        Schema::table('leave_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('leave_requests', 'class_id')) {
                $table->foreignId('class_id')->nullable()->after('student_id')->constrained('classes')->nullOnDelete();
            }
            if (!Schema::hasColumn('leave_requests', 'academic_year')) {
                $table->string('academic_year', 50)->nullable()->after('class_id');
            }

            $table->index(['class_id', 'status_approval'], 'idx_lr_class_status');
        });

        // Backfill snapshot class_id & academic_year untuk leave_requests yang sudah ada
        $existingLeaves = DB::table('leave_requests')
            ->whereNull('class_id')
            ->select('id', 'student_id')
            ->get();

        if ($existingLeaves->isNotEmpty()) {
            $studentClassMap = DB::table('users')
                ->whereIn('id', $existingLeaves->pluck('student_id')->unique()->filter())
                ->pluck('class_id', 'id');

            foreach ($existingLeaves as $lr) {
                $studentClassId = $studentClassMap[$lr->student_id] ?? null;
                DB::table('leave_requests')
                    ->where('id', $lr->id)
                    ->update([
                        'class_id' => $studentClassId,
                        'academic_year' => $activeAcademicYear,
                    ]);
            }
        }

        // 3. Buat tabel student_class_histories untuk mencatat riwayat kenaikan kelas / kelulusan siswa
        if (!Schema::hasTable('student_class_histories')) {
            Schema::create('student_class_histories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('from_class_id')->nullable()->constrained('classes')->nullOnDelete();
                $table->foreignId('to_class_id')->nullable()->constrained('classes')->nullOnDelete();
                $table->string('academic_year', 50);
                $table->string('action_type', 30); // promoted, held_back, graduated, transferred
                $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('processed_at')->useCurrent();
                $table->timestamps();

                $table->index(['student_id', 'academic_year'], 'idx_sch_student_year');
                $table->index(['from_class_id', 'academic_year'], 'idx_sch_from_class_year');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_class_histories');

        Schema::table('leave_requests', function (Blueprint $table) {
            $table->dropIndex('idx_lr_class_status');
            if (Schema::hasColumn('leave_requests', 'class_id')) {
                $table->dropConstrainedForeignId('class_id');
            }
            if (Schema::hasColumn('leave_requests', 'academic_year')) {
                $table->dropColumn('academic_year');
            }
        });

        Schema::table('teacher_assignments', function (Blueprint $table) {
            $table->dropIndex('idx_ta_type_class_active');
            $table->dropIndex('idx_ta_user_type_active');

            if (Schema::hasColumn('teacher_assignments', 'assigned_by')) {
                $table->dropConstrainedForeignId('assigned_by');
            }
            if (Schema::hasColumn('teacher_assignments', 'revoked_by')) {
                $table->dropConstrainedForeignId('revoked_by');
            }

            $colsToDrop = array_filter(
                ['academic_year', 'is_active', 'started_at', 'ended_at', 'notes'],
                fn ($col) => Schema::hasColumn('teacher_assignments', $col)
            );
            if (!empty($colsToDrop)) {
                $table->dropColumn($colsToDrop);
            }
        });
    }
};
