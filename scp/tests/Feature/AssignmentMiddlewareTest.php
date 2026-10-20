<?php

namespace Tests\Feature;

use App\Models\TeacherAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AssignmentMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Route::middleware(['auth:sanctum', 'assignment:kesiswaan'])->get('/test-kesiswaan-assignment', function () {
            return response()->json(['success' => true, 'message' => 'Akses diterima']);
        });
    }

    public function test_teacher_without_assignment_is_rejected_with_403_and_correct_format(): void
    {
        $teacher = User::create([
            'name' => 'Guru Biasa',
            'email' => 'guru@example.com',
            'nis_nip' => '198001012010011001',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        Sanctum::actingAs($teacher);

        $response = $this->getJson('/test-kesiswaan-assignment');

        $response->assertStatus(403)
            ->assertExactJson([
                'success' => false,
                'message' => 'Akses ditolak, anda tidak memiliki izin.',
                'errors' => [
                    'assignment' => ['Membutuhkan penugasan kesiswaan.'],
                ],
            ]);
    }

    public function test_teacher_with_assignment_is_allowed(): void
    {
        $teacher = User::create([
            'name' => 'Guru Kesiswaan',
            'email' => 'kesiswaan@example.com',
            'nis_nip' => '198001012010011002',
            'role' => 'teacher',
            'password' => Hash::make('password123'),
            'must_change_password' => false,
        ]);

        TeacherAssignment::create([
            'user_id' => $teacher->id,
            'type' => 'kesiswaan',
        ]);

        Sanctum::actingAs($teacher);

        $response = $this->getJson('/test-kesiswaan-assignment');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Akses diterima',
            ]);
    }
}
