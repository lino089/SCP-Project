<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Classes;
use App\Models\TeacherAssignment;
use App\Models\Schedule;
use App\Models\Rooms;
use App\Models\Subject;
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

        // 6. Data Master Awal Kelas
        $classXRPL1 = Classes::firstOrCreate(
            ['name' => 'X-RPL-1'],
            ['level' => 'X', 'created_at' => $now, 'updated_at' => $now]
        );
        $classXIRPL1 = Classes::firstOrCreate(
            ['name' => 'XI-RPL-1'],
            ['level' => 'XI', 'created_at' => $now, 'updated_at' => $now]
        );
        Classes::firstOrCreate(
            ['name' => 'XII-RPL-1'],
            ['level' => 'XII', 'created_at' => $now, 'updated_at' => $now]
        );

        // Hubungkan kenaikan kelas jika belum
        if ($classXRPL1->next_class_id !== $classXIRPL1->id) {
            $classXRPL1->update(['next_class_id' => $classXIRPL1->id]);
        }

        // 7. Akun Guru Pengampu & Wali Kelas
        $teacher = User::firstOrCreate(
            ['nis_nip' => '197803122005011002'],
            [
                'role' => 'teacher',
                'name' => 'Drs. Ahmad Fauzi, M.Pd.',
                'email' => 'ahmad.fauzi@sekolah.sch.id',
                'fet_staff_id' => 'AFAUZI',
                'password' => Hash::make('password123'),
                'must_change_password' => false,
            ]
        );

        // Penugasan Wali Kelas X-RPL-1
        TeacherAssignment::firstOrCreate(
            ['user_id' => $teacher->id, 'type' => 'wali_kelas'],
            ['class_id' => $classXRPL1->id]
        );

        // 8. Akun Guru Kesiswaan (Piket)
        $kesiswaan = User::firstOrCreate(
            ['nis_nip' => '198211102008011005'],
            [
                'role' => 'teacher',
                'name' => 'Budi Santoso, M.Kom.',
                'email' => 'budi.santoso@sekolah.sch.id',
                'fet_staff_id' => 'BSANTOSO',
                'password' => Hash::make('password123'),
                'must_change_password' => false,
            ]
        );

        // Penugasan Kesiswaan
        TeacherAssignment::firstOrCreate(
            ['user_id' => $kesiswaan->id, 'type' => 'kesiswaan'],
            ['class_id' => null]
        );

        // 9. Akun Siswa (Kelas X-RPL-1)
        $student = User::firstOrCreate(
            ['nis_nip' => '2024001'],
            [
                'role' => 'student',
                'name' => 'Aisyah Putri Ramadhani',
                'email' => 'aisyah.putri@siswa.sch.id',
                'class_id' => $classXRPL1->id,
                'password' => Hash::make('password123'),
                'must_change_password' => false,
            ]
        );

        // 10. Akun Orang Tua (Wali Siswa Aisyah)
        User::firstOrCreate(
            ['nis_nip' => 'W-2024001'],
            [
                'role' => 'parent',
                'name' => 'Bambang Sulistyo',
                'email' => 'bambang.s@gmail.com',
                'linked_student_id' => $student->id,
                'password' => Hash::make('password123'),
                'must_change_password' => false,
            ]
        );

        // 11. Data Jadwal Pelajaran Awal untuk KBM
        $subPWeb = DB::table('subjects')->where('name', 'Pemrograman Web')->first();
        $subBData = DB::table('subjects')->where('name', 'Basis Data')->first();
        $roomLab1 = DB::table('rooms')->where('name', 'Lab Komputer 1')->first();
        $roomLab2 = DB::table('rooms')->where('name', 'Lab Komputer 2')->first();

        if ($subPWeb && $roomLab1) {
            Schedule::firstOrCreate(
                [
                    'teacher_id' => $teacher->id,
                    'class_id' => $classXRPL1->id,
                    'day_of_week' => 1, // Senin
                    'period_number' => 1,
                    'cycle_type' => 1,
                ],
                [
                    'subject_id' => $subPWeb->id,
                    'room_id' => $roomLab1->id,
                    'duration_periods' => 2,
                    'source' => 'manual',
                ]
            );

            Schedule::firstOrCreate(
                [
                    'teacher_id' => $teacher->id,
                    'class_id' => $classXRPL1->id,
                    'day_of_week' => 2, // Selasa
                    'period_number' => 2,
                    'cycle_type' => 1,
                ],
                [
                    'subject_id' => $subBData ? $subBData->id : $subPWeb->id,
                    'room_id' => $roomLab2 ? $roomLab2->id : $roomLab1->id,
                    'duration_periods' => 3,
                    'source' => 'manual',
                ]
            );
        }
    }
}
