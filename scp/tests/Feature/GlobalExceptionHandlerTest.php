<?php

namespace Tests\Feature;

use Tests\TestCase;

class GlobalExceptionHandlerTest extends TestCase
{
    /**
     * Test 422 Unprocessable Content saat validasi gagal.
     */
    public function test_validation_error_returns_custom_422_json(): void
    {
        $response = $this->postJson('/api/login', []);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Validasi gagal.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'errors' => [
                    'nis_nip',
                    'password',
                    'device_name'
            ]
            ]);
    }

    /**
     * Test 401 Unauthorized saat endpoint dilindungi diakses tanpa token.
     */
    public function test_unauthenticated_returns_custom_401_json(): void
    {
        $response = $this->getJson('/api/me');

        $response->assertStatus(401)
            ->assertExactJson([
                'success' => false,
                'message' => 'Anda belum login atau sesi sudah berakhir.',
                'errors' => null,
            ]);
    }

    /**
     * Test 404 Not Found saat route API tidak ditemukan.
     */
    public function test_route_not_found_returns_custom_404_json(): void
    {
        $response = $this->getJson('/api/non-existent-route-endpoint');

        $response->assertStatus(404)
            ->assertExactJson([
                'success' => false,
                'message' => 'Data tidak ditemukan',
                'errors' => null,
            ]);
    }

    /**
     * Test 405 Method Not Allowed untuk method HTTP yang salah pada route API.
     */
    public function test_method_not_allowed_returns_custom_405_json(): void
    {
        $response = $this->getJson('/api/login');

        $response->assertStatus(405)
            ->assertJson([
                'success' => false,
                'errors' => null,
            ]);
    }

    /**
     * Test route non-api tidak menggunakan format json error api.
     */
    public function test_non_api_route_does_not_return_api_json(): void
    {
        $response = $this->get('/non-api-not-found');

        $response->assertStatus(404);
        $this->assertStringNotContainsString('"success":false', (string) $response->getContent());
    }
}
