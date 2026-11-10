<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClassPromotionTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher;

    protected function setUp(): void
    {
        parent::setUp();

        $this->waka = User::create([
            'name' => 'Waka Kurikulum',
            'email' => 'waka@example.com',
            'nis_nip' => '197001011990011001',
            'role' => 'vice_principal',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->teacher = User::create([
            'name' => 'Guru Pengajar',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012010011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);
    }

    public function test_waka_can_configure_next_class_id(): void
    {
        Sanctum::actingAs($this->waka);

        $class11 = Classes::create(['name' => 'XI RPL 1', 'level' => 11]);
        $class10 = Classes::create(['name' => 'X RPL 1', 'level' => 10]);

        $response = $this->putJson('/api/classes/' . $class10->id, [
            'name' => 'X RPL 1',
            'level' => 10,
            'next_class_id' => $class11->id,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $class10->id,
                    'next_class_id' => $class11->id,
                ],
            ]);

        $this->assertDatabaseHas('classes', [
            'id' => $class10->id,
            'next_class_id' => $class11->id,
        ]);
    }

    public function test_configuring_next_class_id_fails_if_same_as_current_class(): void
    {
        Sanctum::actingAs($this->waka);

        $class10 = Classes::create(['name' => 'X RPL 1', 'level' => 10]);

        $response = $this->putJson('/api/classes/' . $class10->id, [
            'name' => 'X RPL 1',
            'level' => 10,
            'next_class_id' => $class10->id,
        ]);

        $response->assertStatus(422);
    }

    public function test_configuring_next_class_id_fails_if_target_level_is_not_next_level(): void
    {
        Sanctum::actingAs($this->waka);

        $class10 = Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        $class12 = Classes::create(['name' => 'XII RPL 1', 'level' => 12]);

        // Attempt mapping level 10 directly to level 12
        $response = $this->putJson('/api/classes/' . $class10->id, [
            'name' => 'X RPL 1',
            'level' => 10,
            'next_class_id' => $class12->id,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_bulk_class_promotion_promotes_holds_back_and_graduates_students(): void
    {
        Sanctum::actingAs($this->waka);

        $class12 = Classes::create(['name' => 'XII RPL 1', 'level' => 12, 'next_class_id' => null]);
        $class11 = Classes::create(['name' => 'XI RPL 1', 'level' => 11, 'next_class_id' => $class12->id]);
        $class10 = Classes::create(['name' => 'X RPL 1', 'level' => 10, 'next_class_id' => $class11->id]);

        // Student 1: regular promotion from 10 to 11
        $student1 = User::create([
            'name' => 'Siswa Naik',
            'nis_nip' => '1001',
            'role' => 'student',
            'class_id' => $class10->id,
            'is_held_back' => false,
            'password' => Hash::make('password123'),
        ]);

        // Student 2: held back in class 10
        $student2 = User::create([
            'name' => 'Siswa Tinggal Kelas',
            'nis_nip' => '1002',
            'role' => 'student',
            'class_id' => $class10->id,
            'is_held_back' => true,
            'password' => Hash::make('password123'),
        ]);

        // Student 3: graduating from class 12
        $student3 = User::create([
            'name' => 'Siswa Lulus',
            'nis_nip' => '1003',
            'role' => 'student',
            'class_id' => $class12->id,
            'is_held_back' => false,
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/class-promotions');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'total_students' => 3,
                    'promoted' => 1,
                    'held_back' => 1,
                    'graduated' => 1,
                ],
            ]);

        // Assert Student 1 is promoted to class 11
        $student1->refresh();
        $this->assertEquals($class11->id, $student1->class_id);

        // Assert Student 2 remains in class 10 and is_held_back reset to false
        $student2->refresh();
        $this->assertEquals($class10->id, $student2->class_id);
        $this->assertFalse($student2->is_held_back);

        // Assert Student 3 graduated: class_id is null and graduation_date is set
        $student3->refresh();
        $this->assertNull($student3->class_id);
        $this->assertEquals(now()->toDateString(), $student3->graduation_date->toDateString());
    }

    public function test_non_waka_cannot_trigger_class_promotions(): void
    {
        Sanctum::actingAs($this->teacher);

        $response = $this->postJson('/api/class-promotions');
        $response->assertStatus(403);
    }

    public function test_auto_map_classes_correctly_maps_parallel_classes(): void
    {
        Sanctum::actingAs($this->waka);

        $c12 = Classes::create(['name' => 'XII RPL 1', 'level' => 12]);
        $c11 = Classes::create(['name' => 'XI RPL 1', 'level' => 11]);
        $c10 = Classes::create(['name' => 'X RPL 1', 'level' => 10]);

        $response = $this->postJson('/api/classes/auto-map');
        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $c10->refresh();
        $c11->refresh();
        $c12->refresh();

        $this->assertEquals($c11->id, $c10->next_class_id);
        $this->assertEquals($c12->id, $c11->next_class_id);
        $this->assertNull($c12->next_class_id);
    }

    public function test_promote_classes_fails_if_non_final_class_has_no_next_class_id(): void
    {
        Sanctum::actingAs($this->waka);

        $c10 = Classes::create(['name' => 'X RPL 1', 'level' => 10, 'next_class_id' => null]);
        User::create([
            'name' => 'Siswa Unmapped',
            'nis_nip' => '9999',
            'role' => 'student',
            'class_id' => $c10->id,
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/class-promotions');
        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }
}
