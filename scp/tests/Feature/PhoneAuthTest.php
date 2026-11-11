<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\PhoneAuthOtp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PhoneAuthTest extends TestCase
{
    use RefreshDatabase;

    private User $verifiedTeacher;
    private User $unverifiedStudent;
    private User $multiAccountParent;
    private User $multiAccountStudent;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('services.fonnte.driver', 'log');

        // 1. Guru dengan nomor terverifikasi
        $this->verifiedTeacher = User::create([
            'name' => 'Siti Nurhaliza, S.Pd.',
            'role' => 'teacher',
            'nis_nip' => '198801012015012001',
            'email' => 'siti@smkn1bantul.sch.id',
            'phone_number' => '081234567890',
            'phone_verified_at' => now(),
            'password' => Hash::make('PasswordGuru123!'),
            'must_change_password' => false,
            'is_active' => true,
        ]);

        // 2. Siswa dengan nomor belum diverifikasi (hasil import Dapodik)
        $this->unverifiedStudent = User::create([
            'name' => 'Rizky Pratama',
            'role' => 'student',
            'nis_nip' => '202601',
            'email' => 'rizky@siswa.sch.id',
            'phone_number' => '085712345678',
            'phone_verified_at' => null,
            'password' => Hash::make('PasswordSiswa123!'),
            'must_change_password' => true,
            'is_active' => true,
        ]);

        // 3. Pasangan Multi-Akun (Orang Tua & Siswa dengan 1 nomor WhatsApp bersama)
        $class = Classes::create([
            'name' => 'X RPL 1',
            'level' => 10,
        ]);

        $this->multiAccountStudent = User::create([
            'name' => 'Bintang Ramadhan',
            'role' => 'student',
            'nis_nip' => '202602',
            'class_id' => $class->id,
            'phone_number' => '089988776655',
            'phone_verified_at' => now(),
            'password' => Hash::make('PasswordBintang123!'),
            'must_change_password' => false,
            'is_active' => true,
        ]);

        $this->multiAccountParent = User::create([
            'name' => 'Agus Ramadhan (Ayah Bintang)',
            'role' => 'parent',
            'nis_nip' => 'ORTU-202602',
            'linked_student_id' => $this->multiAccountStudent->id,
            'phone_number' => '089988776655', // Nomor bersama!
            'phone_verified_at' => now(),
            'password' => Hash::make('PasswordAyah123!'),
            'must_change_password' => false,
            'is_active' => true,
        ]);
    }

    /**
     * Test 1: Permintaan OTP gagal jika nomor belum terdaftar sama sekali
     */
    public function test_login_request_fails_if_number_not_registered(): void
    {
        $response = $this->postJson('/api/auth/phone/login-request', [
            'phone_number' => '081999999999',
        ]);

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'status' => 'not_found',
            ]);
    }

    /**
     * Test 2: Permintaan OTP gagal jika nomor terdaftar tetapi belum diverifikasi
     */
    public function test_login_request_fails_if_number_unverified(): void
    {
        $response = $this->postJson('/api/auth/phone/login-request', [
            'phone_number' => '085712345678',
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'status' => 'unverified',
            ]);
    }

    /**
     * Test 3: Permintaan OTP berhasil untuk nomor yang sudah terverifikasi
     */
    public function test_login_request_succeeds_for_verified_number(): void
    {
        $response = $this->postJson('/api/auth/phone/login-request', [
            'phone_number' => '081234567890',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'data' => [
                    'session_token',
                    'masked_phone',
                    'expires_in_seconds',
                    'cooldown_seconds',
                    'account_count',
                ],
            ]);

        $this->assertDatabaseHas('phone_auth_otps', [
            'phone_number' => '081234567890',
            'purpose' => 'login',
            'is_verified' => false,
        ]);
    }

    /**
     * Test 4: Verifikasi OTP akun tunggal langsung menerbitkan token Sanctum
     */
    public function test_login_verify_succeeds_single_account(): void
    {
        // 1. Request OTP
        $req = $this->postJson('/api/auth/phone/login-request', [
            'phone_number' => '081234567890',
        ]);
        $sessionToken = $req->json('data.session_token');

        // Ambil OTP dari database dan pasang kode 123456
        $otp = PhoneAuthOtp::where('session_token', $sessionToken)->first();
        $otp->update(['code_hash' => Hash::make('123456')]);

        // 2. Coba kode salah
        $wrong = $this->postJson('/api/auth/phone/login-verify', [
            'session_token' => $sessionToken,
            'code' => '999999',
            'device_name' => 'Test Mobile',
        ]);
        $wrong->assertStatus(422)
            ->assertJson([
                'success' => false,
                'status' => 'wrong_code',
            ]);

        // 3. Masukkan kode benar
        $success = $this->postJson('/api/auth/phone/login-verify', [
            'session_token' => $sessionToken,
            'code' => '123456',
            'device_name' => 'Test Mobile',
        ]);

        $success->assertStatus(200)
            ->assertJson([
                'success' => true,
                'multiple_accounts' => false,
            ])
            ->assertJsonStructure([
                'data' => [
                    'token',
                    'expires_at',
                    'user' => [
                        'id',
                        'name',
                        'role',
                    ],
                ],
            ]);

        $this->assertEquals($this->verifiedTeacher->id, $success->json('data.user.id'));
    }

    /**
     * Test 5: Verifikasi OTP untuk nomor bersama (Multi-Account) mengembalikan daftar akun & token pemilih
     */
    public function test_login_verify_handles_multi_account_and_selection(): void
    {
        // 1. Request OTP ke nomor bersama
        $req = $this->postJson('/api/auth/phone/login-request', [
            'phone_number' => '089988776655',
        ]);
        $req->assertStatus(200);
        $sessionToken = $req->json('data.session_token');

        $otp = PhoneAuthOtp::where('session_token', $sessionToken)->first();
        $otp->update(['code_hash' => Hash::make('654321')]);

        // 2. Verifikasi OTP
        $verify = $this->postJson('/api/auth/phone/login-verify', [
            'session_token' => $sessionToken,
            'code' => '654321',
            'device_name' => 'Family Tablet',
        ]);

        $verify->assertStatus(200)
            ->assertJson([
                'success' => true,
                'multiple_accounts' => true,
            ])
            ->assertJsonStructure([
                'data' => [
                    'selection_token',
                    'accounts',
                ],
            ]);

        $selectionToken = $verify->json('data.selection_token');
        $accounts = $verify->json('data.accounts');
        $this->assertCount(2, $accounts);

        // 3. Pilih akun Orang Tua
        $select = $this->postJson('/api/auth/phone/login-select', [
            'selection_token' => $selectionToken,
            'user_id' => $this->multiAccountParent->id,
            'device_name' => 'Family Tablet',
        ]);

        $select->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'data' => [
                    'token',
                    'user' => [
                        'id',
                        'name',
                        'role',
                    ],
                ],
            ]);

        $this->assertEquals($this->multiAccountParent->id, $select->json('data.user.id'));
    }

    /**
     * Test 6: Penautan nomor WhatsApp baru di profil pengguna
     */
    public function test_profile_link_phone_and_verify_flow(): void
    {
        $token = $this->unverifiedStudent->createToken('TestDevice')->plainTextToken;

        // 1. Request OTP penautan nomor baru
        $req = $this->withToken($token)->postJson('/api/me/phone', [
            'phone_number' => '087811223344',
        ]);

        $req->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $sessionToken = $req->json('data.session_token');
        $otp = PhoneAuthOtp::where('session_token', $sessionToken)->first();
        $otp->update(['code_hash' => Hash::make('112233')]);

        // 2. Verifikasi OTP penautan
        $verify = $this->withToken($token)->postJson('/api/me/phone/verify', [
            'session_token' => $sessionToken,
            'code' => '112233',
        ]);

        $verify->assertStatus(200);

        // Pastikan kolom phone_number dan phone_verified_at terisi
        $this->unverifiedStudent->refresh();
        $this->assertEquals('087811223344', $this->unverifiedStudent->phone_number);
        $this->assertNotNull($this->unverifiedStudent->phone_verified_at);
    }

    /**
     * Test 7: Melepas nomor WhatsApp memerlukan kata sandi yang valid
     */
    public function test_profile_unlink_phone_requires_password(): void
    {
        $token = $this->verifiedTeacher->createToken('TestDevice')->plainTextToken;

        // Password salah
        $wrong = $this->withToken($token)->postJson('/api/me/phone/unlink', [
            'current_password' => 'KataSandiNgawur123!',
        ]);
        $wrong->assertStatus(422);

        // Password benar
        $success = $this->withToken($token)->postJson('/api/me/phone/unlink', [
            'current_password' => 'PasswordGuru123!',
        ]);
        $success->assertStatus(200);

        $this->verifiedTeacher->refresh();
        $this->assertNull($this->verifiedTeacher->phone_number);
        $this->assertNull($this->verifiedTeacher->phone_verified_at);
    }
}
