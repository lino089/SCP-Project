<?php

namespace Tests\Feature;

use App\Models\PeriodTemplate;
use App\Models\SystemConfiguration;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_initializes_waka_system_config_and_period_templates(): void
    {
        $this->seed(DatabaseSeeder::class);

        // 1. Waka exists
        $waka = User::where('role', 'vice_principal')->first();
        $this->assertNotNull($waka);
        $this->assertEquals('12345678', $waka->nis_nip);

        // 2. SystemConfiguration exists
        $config = SystemConfiguration::first();
        $this->assertNotNull($config);
        $this->assertEquals(1, $config->active_cycle);
        $this->assertTrue((bool) $config->monday_is_upacara);

        // 3. PeriodTemplate has 48 records (10 JP x 4 tipe hari + 8 JP Jumat)
        $this->assertEquals(48, PeriodTemplate::count());

        // 4. Verify Friday short period duration and dismissal time (8 JP, max 13:50)
        $jumatP1 = PeriodTemplate::where('day_type', 'jumat')->where('period_number', 1)->first();
        $this->assertNotNull($jumatP1);
        $this->assertEquals('07:15:00', $jumatP1->start_time);
        $this->assertEquals('07:55:00', $jumatP1->end_time);

        $jumatP8 = PeriodTemplate::where('day_type', 'jumat')->where('period_number', 8)->first();
        $this->assertNotNull($jumatP8);
        $this->assertEquals('13:15:00', $jumatP8->start_time);
        $this->assertEquals('13:50:00', $jumatP8->end_time);

        // 5. Verify Senin Upacara starts at 08:00 and ends at 08:35 (35 menit)
        $seninP1 = PeriodTemplate::where('day_type', 'senin_upacara')->where('period_number', 1)->first();
        $this->assertNotNull($seninP1);
        $this->assertEquals('08:00:00', $seninP1->start_time);
        $this->assertEquals('08:35:00', $seninP1->end_time);
    }
}
