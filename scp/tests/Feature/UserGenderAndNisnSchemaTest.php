<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserGenderAndNisnSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_table_has_gender_and_nisn_columns(): void
    {
        $this->assertTrue(Schema::hasColumn('users', 'gender'), 'Column gender should exist on users table.');
        $this->assertTrue(Schema::hasColumn('users', 'nisn'), 'Column nisn should exist on users table.');
    }

    public function test_user_can_be_created_with_male_gender_and_leading_zero_nisn(): void
    {
        $user = User::create([
            'name' => 'Ahmad Santoso',
            'email' => 'ahmad@example.com',
            'nis_nip' => '1001',
            'role' => 'student',
            'gender' => 'L',
            'nisn' => '0012345678',
            'password' => Hash::make('secret123'),
        ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Ahmad Santoso',
            'gender' => 'L',
            'nisn' => '0012345678',
        ]);

        $fresh = User::findOrFail($user->id);
        $this->assertSame('0012345678', $fresh->nisn, 'Leading zeros in NISN must be preserved.');
        $this->assertSame('L', $fresh->gender);
    }

    public function test_user_can_be_created_with_female_gender(): void
    {
        $user = User::create([
            'name' => 'Siti Nurhaliza',
            'email' => 'siti@example.com',
            'nis_nip' => '1002',
            'role' => 'student',
            'gender' => 'P',
            'nisn' => '0098765432',
            'password' => Hash::make('secret123'),
        ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Siti Nurhaliza',
            'gender' => 'P',
            'nisn' => '0098765432',
        ]);

        $fresh = User::findOrFail($user->id);
        $this->assertSame('0098765432', $fresh->nisn);
        $this->assertSame('P', $fresh->gender);
    }

    public function test_nisn_must_be_unique_for_non_null_values(): void
    {
        User::create([
            'name' => 'Siswa Pertama',
            'email' => 'siswa1@example.com',
            'nis_nip' => '1003',
            'role' => 'student',
            'gender' => 'L',
            'nisn' => '0012345678',
            'password' => Hash::make('secret123'),
        ]);

        $this->expectException(QueryException::class);

        // Percobaan membuat siswa kedua dengan NISN yang sama persis
        User::create([
            'name' => 'Siswa Kedua Duplikat',
            'email' => 'siswa2@example.com',
            'nis_nip' => '1004',
            'role' => 'student',
            'gender' => 'P',
            'nisn' => '0012345678',
            'password' => Hash::make('secret123'),
        ]);
    }

    public function test_multiple_users_can_have_null_nisn_and_gender(): void
    {
        $waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '198001012005011001',
            'role' => 'vice_principal',
            'password' => Hash::make('secret123'),
        ]);

        $teacher = User::create([
            'name' => 'Guru Pengajar',
            'email' => 'guru@example.com',
            'nis_nip' => '198502022010011002',
            'role' => 'teacher',
            'password' => Hash::make('secret123'),
        ]);

        $studentWithoutNisn = User::create([
            'name' => 'Siswa Tanpa NISN',
            'email' => 'student_nonisn@example.com',
            'nis_nip' => '1005',
            'role' => 'student',
            'password' => Hash::make('secret123'),
        ]);

        $this->assertNull($waka->nisn);
        $this->assertNull($teacher->nisn);
        $this->assertNull($studentWithoutNisn->nisn);

        $this->assertNull($waka->gender);
        $this->assertNull($teacher->gender);
        $this->assertNull($studentWithoutNisn->gender);

        $this->assertDatabaseCount('users', 3);
        $this->assertSame(3, User::whereNull('nisn')->count());
        $this->assertSame(3, User::whereNull('gender')->count());
    }

    public function test_mass_assignment_protection_allows_gender_and_nisn(): void
    {
        $attributes = [
            'name' => 'Mass Assignment Test',
            'email' => 'mass@example.com',
            'nis_nip' => '1006',
            'role' => 'student',
            'gender' => 'L',
            'nisn' => '0055555555',
            'password' => Hash::make('secret123'),
        ];

        $user = User::create($attributes);

        $this->assertSame('L', $user->gender);
        $this->assertSame('0055555555', $user->nisn);

        $user->update([
            'gender' => 'P',
            'nisn' => '0066666666',
        ]);

        $fresh = $user->fresh();
        $this->assertSame('P', $fresh->gender);
        $this->assertSame('0066666666', $fresh->nisn);
    }

    public function test_migration_can_be_rolled_back_and_reapplied_cleanly(): void
    {
        // Pastikan kolom awal ada
        $this->assertTrue(Schema::hasColumn('users', 'gender'));
        $this->assertTrue(Schema::hasColumn('users', 'nisn'));

        // Rollback migration add_gender_and_nisn_to_users_table secara spesifik
        Artisan::call('migrate:rollback', [
            '--path' => 'database/migrations/2026_10_30_000001_add_gender_and_nisn_to_users_table.php',
        ]);

        $this->assertFalse(Schema::hasColumn('users', 'gender'), 'Gender column should be dropped after rollback.');
        $this->assertFalse(Schema::hasColumn('users', 'nisn'), 'NISN column should be dropped after rollback.');

        // Reapply migration
        Artisan::call('migrate', [
            '--path' => 'database/migrations/2026_10_30_000001_add_gender_and_nisn_to_users_table.php',
        ]);

        $this->assertTrue(Schema::hasColumn('users', 'gender'), 'Gender column should exist after re-applying migration.');
        $this->assertTrue(Schema::hasColumn('users', 'nisn'), 'NISN column should exist after re-applying migration.');
    }
}
