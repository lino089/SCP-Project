<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ChangePasswordTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Budi Guru',
            'nis_nip' => '198001012010011002',
            'email' => 'budi@sekolah.sch.id',
            'role' => 'teacher',
            'password' => Hash::make('oldPassword123'),
            'must_change_password' => true,
        ]);
    }

    public function test_unauthenticated_user_cannot_access_change_password(): void
    {
        $response = $this->patchJson('/api/me/password', [
            'current_password' => 'oldPassword123',
            'new_password' => 'newPassword123',
            'new_password_confirmation' => 'newPassword123',
        ]);

        $response->assertUnauthorized();
    }

    public function test_change_password_validation_fails_when_fields_are_empty(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson('/api/me/password', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['current_password', 'new_password', 'new_password_confirmation']);
    }

    public function test_change_password_fails_if_new_password_less_than_8_chars(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson('/api/me/password', [
                'current_password' => 'oldPassword123',
                'new_password' => 'short',
                'new_password_confirmation' => 'short',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['new_password']);
    }

    public function test_change_password_fails_if_confirmation_does_not_match(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson('/api/me/password', [
                'current_password' => 'oldPassword123',
                'new_password' => 'newPassword123',
                'new_password_confirmation' => 'differentPassword123',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['new_password']);
    }

    public function test_change_password_fails_if_new_password_same_as_current(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson('/api/me/password', [
                'current_password' => 'oldPassword123',
                'new_password' => 'oldPassword123',
                'new_password_confirmation' => 'oldPassword123',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['new_password']);
    }

    public function test_change_password_fails_when_current_password_is_incorrect(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson('/api/me/password', [
                'current_password' => 'wrongCurrentPassword',
                'new_password' => 'newPassword123',
                'new_password_confirmation' => 'newPassword123',
            ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Kata sandi saat ini yang Anda masukkan tidak sesuai.',
            ])
            ->assertJsonValidationErrors(['current_password']);
    }

    public function test_change_password_successful_updates_hash_and_resets_flag(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson('/api/me/password', [
                'current_password' => 'oldPassword123',
                'new_password' => 'newPassword123',
                'new_password_confirmation' => 'newPassword123',
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'message' => 'Kata sandi akun Anda berhasil diperbarui.',
                'data' => [
                    'must_change_password' => false,
                ],
            ]);

        $this->user->refresh();

        $this->assertFalse($this->user->must_change_password);
        $this->assertTrue(Hash::check('newPassword123', $this->user->password));
        $this->assertFalse(Hash::check('oldPassword123', $this->user->password));
    }

    public function test_user_can_login_with_new_password_after_change(): void
    {
        // 1. Ubah password
        $this->actingAs($this->user)
            ->patchJson('/api/me/password', [
                'current_password' => 'oldPassword123',
                'new_password' => 'brandNewPassword2026',
                'new_password_confirmation' => 'brandNewPassword2026',
            ])
            ->assertOk();

        // 2. Login dengan password lama harus gagal
        $oldLoginResponse = $this->postJson('/api/login', [
            'nis_nip' => $this->user->nis_nip,
            'password' => 'oldPassword123',
            'device_name' => 'Web Browser',
        ]);
        $oldLoginResponse->assertStatus(401);

        // 3. Login dengan password baru harus berhasil
        $newLoginResponse = $this->postJson('/api/login', [
            'nis_nip' => $this->user->nis_nip,
            'password' => 'brandNewPassword2026',
            'device_name' => 'Web Browser',
        ]);
        $newLoginResponse->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.must_change_password', false);
    }
}
