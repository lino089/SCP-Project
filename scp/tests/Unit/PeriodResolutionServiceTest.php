<?php

namespace Tests\Unit;

use App\Models\PeriodTemplate;
use App\Models\Schedule;
use App\Models\SystemConfiguration;
use App\Services\PeriodResolutionService;
use Carbon\Carbon;
use Database\Seeders\PeriodTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PeriodResolutionServiceTest extends TestCase
{
    use RefreshDatabase;

    private PeriodResolutionService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PeriodTemplateSeeder::class);
        $this->service = new PeriodResolutionService();
    }

    public function test_resolve_day_type_monday_upacara_vs_reguler(): void
    {
        // Monday: 2026-10-19 is a Monday
        $monday = Carbon::parse('2026-10-19 10:00:00');

        SystemConfiguration::create([
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        $dayTypeUpacara = $this->service->resolveDayType($monday);
        $this->assertEquals('senin_upacara', $dayTypeUpacara);

        SystemConfiguration::first()->update(['monday_is_upacara' => false]);
        $dayTypeReguler = $this->service->resolveDayType($monday);
        $this->assertEquals('senin_reguler', $dayTypeReguler);
    }

    public function test_resolve_day_type_other_weekdays_and_weekend(): void
    {
        SystemConfiguration::create([
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        $tuesday = Carbon::parse('2026-10-20');
        $wednesday = Carbon::parse('2026-10-21');
        $thursday = Carbon::parse('2026-10-22');
        $friday = Carbon::parse('2026-10-23');
        $saturday = Carbon::parse('2026-10-24');
        $sunday = Carbon::parse('2026-10-25');

        $this->assertEquals('selasa', $this->service->resolveDayType($tuesday));
        $this->assertEquals('rabu_kamis', $this->service->resolveDayType($wednesday));
        $this->assertEquals('rabu_kamis', $this->service->resolveDayType($thursday));
        $this->assertEquals('jumat', $this->service->resolveDayType($friday));
        $this->assertNull($this->service->resolveDayType($saturday));
        $this->assertNull($this->service->resolveDayType($sunday));
    }

    public function test_get_schedule_times_for_single_and_multi_period(): void
    {
        SystemConfiguration::create([
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        $monday = Carbon::parse('2026-10-19');

        // Schedule JP 1 single period on Senin Upacara -> 08:00 to 08:45
        $scheduleSingle = new Schedule([
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 1,
        ]);

        $timesSingle = $this->service->getScheduleTimes($scheduleSingle, $monday);
        $this->assertEquals('08:00:00', $timesSingle['start_time']);
        $this->assertEquals('08:45:00', $timesSingle['end_time']);

        // Schedule JP 1 duration 2 on Senin Upacara -> 08:00 to 09:30 (JP 1 start to JP 2 end)
        $scheduleMulti = new Schedule([
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 2,
        ]);

        $timesMulti = $this->service->getScheduleTimes($scheduleMulti, $monday);
        $this->assertEquals('08:00:00', $timesMulti['start_time']);
        $this->assertEquals('09:30:00', $timesMulti['end_time']);
    }

    public function test_get_schedule_times_for_friday_short_periods(): void
    {
        SystemConfiguration::create([
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        $friday = Carbon::parse('2026-10-23');

        // Friday JP 1 duration 1: 07:15:00 to 07:55:00 (40 min)
        $scheduleFriday = new Schedule([
            'day_of_week' => 5,
            'period_number' => 1,
            'duration_periods' => 1,
        ]);

        $times = $this->service->getScheduleTimes($scheduleFriday, $friday);
        $this->assertEquals('07:15:00', $times['start_time']);
        $this->assertEquals('07:55:00', $times['end_time']);
    }

    public function test_is_schedule_past_tolerance_threshold(): void
    {
        SystemConfiguration::create([
            'active_cycle' => 1,
            'monday_is_upacara' => true,
        ]);

        // Monday JP 1 ends at 08:45:00
        $schedule = new Schedule([
            'day_of_week' => 1,
            'period_number' => 1,
            'duration_periods' => 1,
        ]);

        // At 09:00:00 (+15 mins): still within 30 mins grace period -> false
        $withinTolerance = Carbon::parse('2026-10-19 09:00:00');
        $this->assertFalse($this->service->isSchedulePastTolerance($schedule, $withinTolerance));

        // At 09:15:00 (+30 mins exact threshold): not past -> false
        $atTolerance = Carbon::parse('2026-10-19 09:15:00');
        $this->assertFalse($this->service->isSchedulePastTolerance($schedule, $atTolerance));

        // At 09:15:01 (+30 mins and 1 sec): past tolerance -> true
        $pastTolerance = Carbon::parse('2026-10-19 09:15:01');
        $this->assertTrue($this->service->isSchedulePastTolerance($schedule, $pastTolerance));
    }
}
