<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PeriodTemplateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * Mengikuti waktu operasional resmi pada Jadwal_Ruangan.pdf (SMKN 1 Bantul).
     */
    public function run(): void
    {
        $now = now();

        $templates = [
            // 1. Senin Upacara (Upacara 07:00 - 08:00, JP 1-6 & 8-10: 35 mnt, JP 7: 40 mnt, Pulang: 15:10)
            ['day_type' => 'senin_upacara', 'period_number' => 1, 'start_time' => '08:00:00', 'end_time' => '08:35:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 2, 'start_time' => '08:35:00', 'end_time' => '09:10:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 3, 'start_time' => '09:10:00', 'end_time' => '09:45:00'],
            // Istirahat 1: 09:45 - 10:00 (15 menit)
            ['day_type' => 'senin_upacara', 'period_number' => 4, 'start_time' => '10:00:00', 'end_time' => '10:35:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 5, 'start_time' => '10:35:00', 'end_time' => '11:10:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 6, 'start_time' => '11:10:00', 'end_time' => '11:45:00'],
            // Istirahat 2 (Dhuhur): 11:45 - 12:45 (60 menit)
            ['day_type' => 'senin_upacara', 'period_number' => 7, 'start_time' => '12:45:00', 'end_time' => '13:25:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 8, 'start_time' => '13:25:00', 'end_time' => '14:00:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 9, 'start_time' => '14:00:00', 'end_time' => '14:35:00'],
            ['day_type' => 'senin_upacara', 'period_number' => 10, 'start_time' => '14:35:00', 'end_time' => '15:10:00'],

            // 2. Senin Reguler / Upacara Nonaktif (Pola reguler 40 mnt/JP, Pulang: 15:10)
            ['day_type' => 'senin_reguler', 'period_number' => 1, 'start_time' => '07:15:00', 'end_time' => '07:55:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 2, 'start_time' => '07:55:00', 'end_time' => '08:35:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 3, 'start_time' => '08:35:00', 'end_time' => '09:15:00'],
            // Istirahat 1: 09:15 - 09:30 (15 menit)
            ['day_type' => 'senin_reguler', 'period_number' => 4, 'start_time' => '09:30:00', 'end_time' => '10:10:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 5, 'start_time' => '10:10:00', 'end_time' => '10:50:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 6, 'start_time' => '10:50:00', 'end_time' => '11:30:00'],
            // Istirahat 2 (Dhuhur): 11:30 - 12:30 (60 menit)
            ['day_type' => 'senin_reguler', 'period_number' => 7, 'start_time' => '12:30:00', 'end_time' => '13:10:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 8, 'start_time' => '13:10:00', 'end_time' => '13:50:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 9, 'start_time' => '13:50:00', 'end_time' => '14:30:00'],
            ['day_type' => 'senin_reguler', 'period_number' => 10, 'start_time' => '14:30:00', 'end_time' => '15:10:00'],

            // 3. Selasa (Literasi 07:00 - 07:30, JP 1-7: 40 mnt, JP 8-10: 35 mnt, Pulang: 15:10)
            ['day_type' => 'selasa', 'period_number' => 1, 'start_time' => '07:30:00', 'end_time' => '08:10:00'],
            ['day_type' => 'selasa', 'period_number' => 2, 'start_time' => '08:10:00', 'end_time' => '08:50:00'],
            ['day_type' => 'selasa', 'period_number' => 3, 'start_time' => '08:50:00', 'end_time' => '09:30:00'],
            // Istirahat 1: 09:30 - 09:45 (15 menit)
            ['day_type' => 'selasa', 'period_number' => 4, 'start_time' => '09:45:00', 'end_time' => '10:25:00'],
            ['day_type' => 'selasa', 'period_number' => 5, 'start_time' => '10:25:00', 'end_time' => '11:05:00'],
            ['day_type' => 'selasa', 'period_number' => 6, 'start_time' => '11:05:00', 'end_time' => '11:45:00'],
            // Istirahat 2 (Dhuhur): 11:45 - 12:45 (60 menit)
            ['day_type' => 'selasa', 'period_number' => 7, 'start_time' => '12:45:00', 'end_time' => '13:25:00'],
            ['day_type' => 'selasa', 'period_number' => 8, 'start_time' => '13:25:00', 'end_time' => '14:00:00'],
            ['day_type' => 'selasa', 'period_number' => 9, 'start_time' => '14:00:00', 'end_time' => '14:35:00'],
            // Catatan: Di Jadwal_Ruangan.pdf tertulis 14.45 - 15.10 (terdapat jeda 10 menit tanpa sesi).
            // Berdasarkan konfirmasi Opsi A, diselaraskan ke 14:35 - 15:10 agar menyambung kronologis dari JP 9.
            ['day_type' => 'selasa', 'period_number' => 10, 'start_time' => '14:35:00', 'end_time' => '15:10:00'],

            // 4. Rabu & Kamis (KBM mulai 07:15, 10 JP @ 40 mnt, Pulang: 15:10)
            ['day_type' => 'rabu_kamis', 'period_number' => 1, 'start_time' => '07:15:00', 'end_time' => '07:55:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 2, 'start_time' => '07:55:00', 'end_time' => '08:35:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 3, 'start_time' => '08:35:00', 'end_time' => '09:15:00'],
            // Istirahat 1: 09:15 - 09:30 (15 menit)
            ['day_type' => 'rabu_kamis', 'period_number' => 4, 'start_time' => '09:30:00', 'end_time' => '10:10:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 5, 'start_time' => '10:10:00', 'end_time' => '10:50:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 6, 'start_time' => '10:50:00', 'end_time' => '11:30:00'],
            // Istirahat 2 (Dhuhur): 11:30 - 12:30 (60 menit)
            ['day_type' => 'rabu_kamis', 'period_number' => 7, 'start_time' => '12:30:00', 'end_time' => '13:10:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 8, 'start_time' => '13:10:00', 'end_time' => '13:50:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 9, 'start_time' => '13:50:00', 'end_time' => '14:30:00'],
            ['day_type' => 'rabu_kamis', 'period_number' => 10, 'start_time' => '14:30:00', 'end_time' => '15:10:00'],

            // 5. Jumat (Mulai 07:15, JP 1-5 @ 40 mnt, JP 6 @ 35 mnt, JP 7-8 @ 35 mnt, Pulang: 13:50)
            ['day_type' => 'jumat', 'period_number' => 1, 'start_time' => '07:15:00', 'end_time' => '07:55:00'],
            ['day_type' => 'jumat', 'period_number' => 2, 'start_time' => '07:55:00', 'end_time' => '08:35:00'],
            ['day_type' => 'jumat', 'period_number' => 3, 'start_time' => '08:35:00', 'end_time' => '09:15:00'],
            // Istirahat 1: 09:15 - 09:30 (15 menit)
            ['day_type' => 'jumat', 'period_number' => 4, 'start_time' => '09:30:00', 'end_time' => '10:10:00'],
            ['day_type' => 'jumat', 'period_number' => 5, 'start_time' => '10:10:00', 'end_time' => '10:50:00'],
            ['day_type' => 'jumat', 'period_number' => 6, 'start_time' => '10:50:00', 'end_time' => '11:25:00'],
            // Sholat Jumat / Ishoma: 11:25 - 12:40 (75 menit)
            ['day_type' => 'jumat', 'period_number' => 7, 'start_time' => '12:40:00', 'end_time' => '13:15:00'],
            ['day_type' => 'jumat', 'period_number' => 8, 'start_time' => '13:15:00', 'end_time' => '13:50:00'],
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

        // Hapus slot JP 9 dan 10 pada hari Jumat jika ada (hari Jumat resmi hanya 8 JP)
        DB::table('period_templates')
            ->where('day_type', 'jumat')
            ->whereIn('period_number', [9, 10])
            ->delete();
    }
}
