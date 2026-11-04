<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\PeriodTemplate;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\User;
use Database\Seeders\PeriodTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PeriodResolutionBenchmarkTest extends TestCase
{
    use RefreshDatabase;

    public function test_schedule_index_executes_minimal_queries(): void
    {
        $this->seed(PeriodTemplateSeeder::class);

        $waka = User::factory()->create(['role' => 'vice_principal', 'nis_nip' => '197001011990011001']);
        $teacher = User::factory()->create(['role' => 'teacher', 'nis_nip' => '198001012005011001']);
        $class = Classes::create(['name' => 'X RPL 1', 'level' => '10']);
        $room = Room::create(['name' => '12', 'capacity' => 36]);
        $subject = Subject::create(['name' => 'Matematika']);

        // Create 20 schedules
        for ($i = 1; $i <= 20; $i++) {
            Schedule::create([
                'cycle_type' => 1,
                'day_of_week' => ($i % 5) + 1,
                'period_number' => ($i % 8) + 1,
                'duration_periods' => 2,
                'teacher_id' => $teacher->id,
                'class_id' => $class->id,
                'room_id' => $room->id,
                'subject_id' => $subject->id,
                'source' => 'manual',
            ]);
        }

        DB::enableQueryLog();

        $req = Request::create('/api/schedules', 'GET', ['all' => 1, 'cycle' => 1]);
        $req->setUserResolver(fn() => $waka);

        $start = microtime(true);
        $res = app(\App\Http\Controllers\API\ScheduleController::class)->index($req);
        $time = microtime(true) - $start;

        $queries = DB::getQueryLog();
        $queryCount = count($queries);

        // Before: 1 + (20 * 2) = 41+ queries. Now: Only 6 queries total!
        $this->assertLessThanOrEqual(8, $queryCount);
        $this->assertTrue($res->getData()->success);
        $this->assertCount(20, $res->getData()->data);
    }
}
