<?php

namespace App\Console\Commands;

use App\Models\Classes;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanMasterAndSchedulesCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'scp:clean-master-and-schedules {--confirm : Explicitly confirm database wipe}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Safely cleans all Master Data and Schedules while preserving Waka Kurikulum and core system configurations';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        if (!$this->option('confirm')) {
            $this->error('Operation aborted. You must provide the --confirm flag to wipe Master Data and Schedules.');
            return 1;
        }

        $this->info('Starting safe bottom-up cleanup of Master Data and Schedules...');

        try {
            DB::transaction(function () {
                // 1. attendances
                $delAttendances = DB::table('attendances')->delete();
                $this->line("- Deleted attendances: {$delAttendances}");

                // 2. journals
                $delJournals = DB::table('journals')->delete();
                $this->line("- Deleted journals: {$delJournals}");

                // 3. quiz_answers (if table exists)
                if (DB::getSchemaBuilder()->hasTable('quiz_answers')) {
                    $delQA = DB::table('quiz_answers')->delete();
                    $this->line("- Deleted quiz_answers: {$delQA}");
                }

                // 4. quiz_submissions
                if (DB::getSchemaBuilder()->hasTable('quiz_submissions')) {
                    $delQS = DB::table('quiz_submissions')->delete();
                    $this->line("- Deleted quiz_submissions: {$delQS}");
                }

                // 5. quiz_questions
                if (DB::getSchemaBuilder()->hasTable('quiz_questions')) {
                    $delQQ = DB::table('quiz_questions')->delete();
                    $this->line("- Deleted quiz_questions: {$delQQ}");
                }

                // 6. quizzes
                if (DB::getSchemaBuilder()->hasTable('quizzes')) {
                    $delQuizzes = DB::table('quizzes')->delete();
                    $this->line("- Deleted quizzes: {$delQuizzes}");
                }

                // 7. leave_requests
                if (DB::getSchemaBuilder()->hasTable('leave_requests')) {
                    $delLR = DB::table('leave_requests')->delete();
                    $this->line("- Deleted leave_requests: {$delLR}");
                }

                // 8. teacher_leave_requests
                if (DB::getSchemaBuilder()->hasTable('teacher_leave_requests')) {
                    $delTLR = DB::table('teacher_leave_requests')->delete();
                    $this->line("- Deleted teacher_leave_requests: {$delTLR}");
                }

                // 9. teacher_assignments
                $delTA = DB::table('teacher_assignments')->delete();
                $this->line("- Deleted teacher_assignments: {$delTA}");

                // 10. schedule_import_rows
                if (DB::getSchemaBuilder()->hasTable('schedule_import_rows')) {
                    $delSIR = DB::table('schedule_import_rows')->delete();
                    $this->line("- Deleted schedule_import_rows: {$delSIR}");
                }

                // 11. schedule_imports
                if (DB::getSchemaBuilder()->hasTable('schedule_imports')) {
                    $delSI = DB::table('schedule_imports')->delete();
                    $this->line("- Deleted schedule_imports: {$delSI}");
                }

                // 12. schedules
                $delSchedules = DB::table('schedules')->delete();
                $this->line("- Deleted schedules: {$delSchedules}");

                // 13. personal_access_tokens for non-waka users
                $nonWakaUserIds = DB::table('users')->where('role', '!=', 'vice_principal')->pluck('id');
                $delTokens = DB::table('personal_access_tokens')
                    ->where('tokenable_type', User::class)
                    ->whereIn('tokenable_id', $nonWakaUserIds)
                    ->delete();
                $this->line("- Deleted personal_access_tokens: {$delTokens}");

                // 14. users (parents)
                $delParents = DB::table('users')->where('role', 'parent')->delete();
                $this->line("- Deleted parent users: {$delParents}");

                // 15. users (teachers and students) - PRESERVE WAKA KURIKULUM
                $delTeachersStudents = DB::table('users')->whereIn('role', ['teacher', 'student'])->delete();
                $this->line("- Deleted teacher and student users: {$delTeachersStudents}");

                // 16. classes - first break self-referential next_class_id
                DB::table('classes')->update(['next_class_id' => null]);
                $delClasses = DB::table('classes')->delete();
                $this->line("- Deleted classes: {$delClasses}");

                // 17. rooms & subjects
                $delRooms = DB::table('rooms')->delete();
                $this->line("- Deleted rooms: {$delRooms}");

                $delSubjects = DB::table('subjects')->delete();
                $this->line("- Deleted subjects: {$delSubjects}");
            });

            $this->info('Cleanup completed successfully!');

            // Verify Waka Kurikulum exists
            $wakaCount = User::where('role', 'vice_principal')->count();
            $this->info("Waka Kurikulum users preserved: {$wakaCount}");

            return 0;
        } catch (\Throwable $e) {
            $this->error('Cleanup failed: ' . $e->getMessage());
            return 1;
        }
    }
}
