<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PeriodTemplateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $now = now();

        $templates = [
            // 1. Senin Upacara (Upacara 07:00 - 08:00, JP 1 mulai 08:00, 45 mnt/JP)
            ['day_type' => 'senin_upacara', 'period_number' => 1, 'start_time' => '08:00:00', 'end_time' => '08:45:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 2, 'start_time' => '08:45:00', 'end_time' => '09:30:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 3, 'start_time' => '09:30:00', 'end_time' => '10:15:00'],
            // Istirahat 1: 10:15 - 10:45
            ['day_type' => 'senin_upacara', 'period_number' => 4, 'start_time' => '10:45:00', 'end_time' => '11:30:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 5, 'start_time' => '11:30:00', 'end_time' => '12:15:00'],
            // Istirahat 2 (Dhuhur): 12:15 - 13:00
            ['day_type' => 'senin_upacara', 'period_number' => 6, 'start_time' => '13:00:00', 'end_time' => '13:45:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 7, 'start_time' => '13:45:00', 'end_time' => '14:30:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 8, 'start_time' => '14:30:00', 'end_time' => '15:15:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 9, 'start_time' => '15:15:00', 'end_time' => '16:00:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 10, 'start_time' => '16:00:00', 'end_time' => '16:45:00'],

            // 2. Senin Reguler (Tadarus 07:00 - 07:15, JP 1 mulai 07:15, 45 mnt/JP)
            ['day_type' => 'senin_reguler', 'period_number' => 1, 'start_time' => '07:15:00', 'end_time' => '08:00:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 2, 'start_time' => '08:00:00', 'end_time' => '08:45:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 3, 'start_time' => '08:45:00', 'end_time' => '09:30:00'],
            // Istirahat 1: 09:30 - 10:00
            ['day_type' => 'senin_reguler', 'period_number' => 4, 'start_time' => '10:00:00', 'end_time' => '10:45:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 5, 'start_time' => '10:45:00', 'end_time' => '11:30:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 6, 'start_time' => '11:30:00', 'end_time' => '12:15:00'],
            // Istirahat 2 (Dhuhur): 12:15 - 13:00
            ['day_type' => 'senin_reguler', 'period_number' => 7, 'start_time' => '13:00:00', 'end_time' => '13:45:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 8, 'start_time' => '13:45:00', 'end_time' => '14:30:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 9, 'start_time' => '14:30:00', 'end_time' => '15:15:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 10, 'start_time' => '15:15:00', 'end_time' => '16:00:00'],

            // 3. Selasa (Literasi 07:00 - 07:30, JP 1 mulai 07:30, 45 mnt/JP)
            ['day_type' => 'selasa', 'period_number' => 1, 'start_time' => '07:30:00', 'end_time' => '08:15:00'],
            ['day_type' => 'selasa', 'period_number' => 2, 'start_time' => '08:15:00', 'end_time' => '09:00:00'],
            ['day_type' => 'selasa', 'period_number' => 3, 'start_time' => '09:00:00', 'end_time' => '09:45:00'],
            // Istirahat 1: 09:45 - 10:15
            ['day_type' => 'selasa', 'period_number' => 4, 'start_time' => '10:15:00', 'end_time' => '11:00:00'],
            ['day_type' => 'selasa', 'period_number' => 5, 'start_time' => '11:00:00', 'end_time' => '11:45:00'],
            // Istirahat 2 (Dhuhur): 11:45 - 12:30
            ['day_type' => 'selasa', 'period_number' => 6, 'start_time' => '12:30:00', 'end_time' => '13:15:00'],
            ['day_type' => 'selasa', 'period_number' => 7, 'start_time' => '13:15:00', 'end_time' => '14:00:00'],
            ['day_type' => 'selasa', 'period_number' => 8, 'start_time' => '14:00:00', 'end_time' => '14:45:00'],
            ['day_type' => 'selasa', 'period_number' => 9, 'start_time' => '14:45:00', 'end_time' => '15:30:00'],
            ['day_type' => 'selasa', 'period_number' => 10, 'start_time' => '15:30:00', 'end_time' => '16:15:00'],

            // 4. Rabu & Kamis (Tadarus/Pendalaman Iman 07:00 - 07:15, JP 1 mulai 07:15, 45 mnt/JP)
            ['day_type' => 'rabu_kamis', 'period_number' => 1, 'start_time' => '07:15:00', 'end_time' => '08:00:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 2, 'start_time' => '08:00:00', 'end_time' => '08:45:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 3, 'start_time' => '08:45:00', 'end_time' => '09:30:00'],
            // Istirahat 1: 09:30 - 10:00
            ['day_type' => 'rabu_kamis', 'period_number' => 4, 'start_time' => '10:00:00', 'end_time' => '10:45:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 5, 'start_time' => '10:45:00', 'end_time' => '11:30:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 6, 'start_time' => '11:30:00', 'end_time' => '12:15:00'],
            // Istirahat 2 (Dhuhur): 12:15 - 13:00
            ['day_type' => 'rabu_kamis', 'period_number' => 7, 'start_time' => '13:00:00', 'end_time' => '13:45:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 8, 'start_time' => '13:45:00', 'end_time' => '14:30:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 9, 'start_time' => '14:30:00', 'end_time' => '15:15:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 10, 'start_time' => '15:15:00', 'end_time' => '16:00:00'],

            // 5. Jumat (Mulai 07:15, durasi 40 mnt/JP)
            ['day_type' => 'jumat', 'period_number' => 1, 'start_time' => '07:15:00', 'end_time' => '07:55:00'],
            ['day_type' => 'jumat', 'period_number' => 2, 'start_time' => '07:55:00', 'end_time' => '08:35:00'],
            ['day_type' => 'jumat', 'period_number' => 3, 'start_time' => '08:35:00', 'end_time' => '09:15:00'],
            // Istirahat 1: 09:15 - 09:45
            ['day_type' => 'jumat', 'period_number' => 4, 'start_time' => '09:45:00', 'end_time' => '10:25:00'],
            ['day_type' => 'jumat', 'period_number' => 5, 'start_time' => '10:25:00', 'end_time' => '11:05:00'],
            ['day_type' => 'jumat', 'period_number' => 6, 'start_time' => '11:05:00', 'end_time' => '11:45:00'],
            // Sholat Jumat: 11:45 - 13:00
            ['day_type' => 'jumat', 'period_number' => 7, 'start_time' => '13:00:00', 'end_time' => '13:40:00'],
            ['day_type' => 'jumat', 'period_number' => 8, 'start_time' => '13:40:00', 'end_time' => '14:20:00'],
            ['day_type' => 'jumat', 'period_number' => 9, 'start_time' => '14:20:00', 'end_time' => '15:00:00'],
            ['day_type' => 'jumat', 'period_number' => 10, 'start_time' => '15:00:00', 'end_time' => '15:40:00'],
        ];

        $records = array_map(function ($t) use ($now) {
            return array_merge($t, [
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }, $templates);

        DB::table('period_templates')->upsert(
            $records,
            ['day_type', 'period_number'],
            ['start_time', 'end_time', 'updated_at']
        );
    }
}
