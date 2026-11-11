<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Tambahkan kolom status verifikasi nomor HP pada tabel users
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('phone_verified_at')->nullable()->after('phone_number');
            $table->index('phone_verified_at');
        });

        // 2. Buat tabel penyimpanan OTP & sesi autentikasi nomor HP
        Schema::create('phone_auth_otps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('phone_number', 20);
            $table->string('channel', 20)->default('whatsapp'); // 'whatsapp'
            $table->string('code_hash', 255);
            $table->string('purpose', 30); // 'login', 'link_phone', 'change_phone'
            $table->string('session_token', 64)->unique();
            $table->string('selection_token', 64)->nullable()->unique();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->boolean('is_verified')->default(false);
            $table->timestamp('expires_at');
            $table->timestamp('resend_available_at');
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();

            // Indexes untuk query cepat & rate limiting
            $table->index(['phone_number', 'purpose', 'is_verified']);
            $table->index(['phone_number', 'expires_at']);
            $table->index('session_token');
            $table->index('selection_token');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('phone_auth_otps');

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['phone_verified_at']);
            $table->dropColumn('phone_verified_at');
        });
    }
};
