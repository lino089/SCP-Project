<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $now = now();

        // 1. Inisialisasi Akun Waka Kurikulum pertama
        User::firstOrCreate(
            ['nis_nip' => '12345678'],
            [
                'role' => 'vice_principal',
                'password' => Hash::make('password'),
                'must_change_password' => false,
                'name' => 'Waka Kurikulum',
                'email' => 'waka@smkn1bantul.sch.id',
            ]
        );

        // 2. Inisialisasi record konfigurasi sistem id=1
        DB::table('system_configurations')->upsert(
            [
                'id' => 1,
                'active_cycle' => 1,
                'monday_is_upacara' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            ['id'],
            ['active_cycle', 'monday_is_upacara', 'updated_at']
        );

        // 3. Seeder Period Templates lengkap 10 JP (Senin-Jumat)
        $this->call(PeriodTemplateSeeder::class);

        // 4. Data Master Awal Ruangan
        $rooms = [
            ['name' => 'Ruang Teori 1', 'capacity' => 36],
            ['name' => 'Ruang Teori 2', 'capacity' => 36],
            ['name' => 'Lab Komputer 1', 'capacity' => 36],
            ['name' => 'Lab Komputer 2', 'capacity' => 36],
            ['name' => 'Lab IPA', 'capacity' => 36],
        ];

        foreach ($rooms as $r) {
            DB::table('rooms')->updateOrInsert(
                ['name' => $r['name']],
                ['capacity' => $r['capacity'], 'created_at' => $now, 'updated_at' => $now]
            );
        }

        // 5. Data Master Awal Mata Pelajaran
        $subjects = [
            'Matematika',
            'Bahasa Indonesia',
            'Bahasa Inggris',
            'Pendidikan Agama',
            'Pemrograman Web',
            'Basis Data',
            'Pemrograman Berorientasi Objek',
        ];

        foreach ($subjects as $s) {
            DB::table('subjects')->updateOrInsert(
                ['name' => $s],
                ['created_at' => $now, 'updated_at' => $now]
            );
        }
    }
}
