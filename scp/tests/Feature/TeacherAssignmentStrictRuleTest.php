<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\TeacherAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeacherAssignmentStrictRuleTest extends TestCase
{
    use RefreshDatabase;

    private User $waka;
    private User $teacher1;
    private User $teacher2;
    private User $counselor;
    private Classes $classA;
    private Classes $classB;

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

        $this->teacher1 = User::create([
            'name' => 'Guru Satu',
            'email' => 'guru1@example.com',
            'nis_nip' => '198501012010011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->teacher2 = User::create([
            'name' => 'Guru Dua',
            'email' => 'guru2@example.com',
            'nis_nip' => '198501012010011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->counselor = User::create([
            'name' => 'Guru BK Candra',
            'email' => 'bk@example.com',
            'nis_nip' => '198501012010011003',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        $this->classA = Classes::create(['name' => 'X RPL 1', 'level' => 10]);
        $this->classB = Classes::create(['name' => 'X RPL 2', 'level' => 10]);
    }

    public function test_wali_kelas_can_be_assigned_to_class(): void
    {
        Sanctum::actingAs($this->waka);

        $res = $this->postJson("/api/teachers/{$this->teacher1->id}/assignments", [
            'type' => 'wali_kelas',
            'class_id' => $this->classA->id,
        ]);

        $res->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertTrue($this->teacher1->isWaliKelas($this->classA->id));
        $this->assertEquals($this->classA->id, $this->teacher1->getWaliKelasClassId());
    }

    public function test_teacher_cannot_be_assigned_as_wali_kelas_to_multiple_classes(): void
    {
        Sanctum::actingAs($this->waka);

        // 1. Berikan tugas wali kelas di Kelas A
        $this->postJson("/api/teachers/{$this->teacher1->id}/assignments", [
            'type' => 'wali_kelas',
            'class_id' => $this->classA->id,
        ])->assertStatus(201);

        // 2. Coba berikan tugas wali kelas kedua di Kelas B -> Wajib Ditolak 422
        $res = $this->postJson("/api/teachers/{$this->teacher1->id}/assignments", [
            'type' => 'wali_kelas',
            'class_id' => $this->classB->id,
        ]);

        $res->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Guru ini sudah menjadi wali kelas di kelas lain. Setiap guru hanya diperbolehkan mengampu maksimal 1 rombel kelas sebagai Wali Kelas.',
            ]);

        // Pastikan hanya 1 penugasan tersimpan
        $count = TeacherAssignment::where('user_id', $this->teacher1->id)->where('type', 'wali_kelas')->count();
        $this->assertEquals(1, $count);
    }

    public function test_class_cannot_have_more_than_one_active_wali_kelas(): void
    {
        Sanctum::actingAs($this->waka);

        // 1. Guru 1 menjadi wali kelas di Kelas A
        $this->postJson("/api/teachers/{$this->teacher1->id}/assignments", [
            'type' => 'wali_kelas',
            'class_id' => $this->classA->id,
        ])->assertStatus(201);

        // 2. Guru 2 mencoba ditugaskan ke Kelas A yang sama -> Wajib Ditolak 422
        $res = $this->postJson("/api/teachers/{$this->teacher2->id}/assignments", [
            'type' => 'wali_kelas',
            'class_id' => $this->classA->id,
        ]);

        $res->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Kelas ini sudah memiliki wali kelas aktif.',
            ]);
    }

    public function test_counselor_can_be_assigned_to_multiple_classes(): void
    {
        Sanctum::actingAs($this->waka);

        // Guru BK membina Kelas A
        $resA = $this->postJson("/api/teachers/{$this->counselor->id}/assignments", [
            'type' => 'kesiswaan',
            'class_id' => $this->classA->id,
        ]);
        $resA->assertStatus(201);

        // Guru BK membina Kelas B juga
        $resB = $this->postJson("/api/teachers/{$this->counselor->id}/assignments", [
            'type' => 'kesiswaan',
            'class_id' => $this->classB->id,
        ]);
        $resB->assertStatus(201);

        // Pastikan guru BK terdaftar membina kedua kelas
        $this->assertTrue($this->counselor->isKesiswaan());
        $this->assertTrue($this->counselor->isKesiswaan($this->classA->id));
        $this->assertTrue($this->counselor->isKesiswaan($this->classB->id));

        $classIds = $this->counselor->getKesiswaanClassIds();
        $this->assertCount(2, $classIds);
        $this->assertContains($this->classA->id, $classIds);
        $this->assertContains($this->classB->id, $classIds);
    }

    public function test_get_assignment_matrix_endpoint_returns_structured_data(): void
    {
        Sanctum::actingAs($this->waka);

        // Tugaskan Guru 1 sebagai wali kelas A, dan Guru BK ke kelas A & B
        TeacherAssignment::create([
            'user_id' => $this->teacher1->id,
            'type' => 'wali_kelas',
            'class_id' => $this->classA->id,
        ]);
        TeacherAssignment::create([
            'user_id' => $this->counselor->id,
            'type' => 'kesiswaan',
            'class_id' => $this->classA->id,
        ]);
        TeacherAssignment::create([
            'user_id' => $this->counselor->id,
            'type' => 'kesiswaan',
            'class_id' => $this->classB->id,
        ]);

        $res = $this->getJson('/api/teachers/assignments/matrix');
        $res->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'class_id',
                        'class_name',
                        'level',
                        'wali_kelas',
                        'kesiswaan',
                    ],
                ],
                'summary' => [
                    'total_classes',
                    'classes_with_wali',
                    'classes_with_kesiswaan',
                ],
            ]);

        $matrix = collect($res->json('data'));
        $itemA = $matrix->firstWhere('class_id', $this->classA->id);
        $this->assertNotNull($itemA['wali_kelas']);
        $this->assertEquals($this->teacher1->id, $itemA['wali_kelas']['id']);
        $this->assertCount(1, $itemA['kesiswaan']);
        $this->assertEquals($this->counselor->id, $itemA['kesiswaan'][0]['id']);
    }
}
