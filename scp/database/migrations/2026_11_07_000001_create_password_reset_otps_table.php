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
        Schema::create('password_reset_otps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('identifier_input');
            $table->string('target');
            $table->string('channel')->default('email');
            $table->string('code_hash');
            $table->string('reset_token', 64)->nullable()->unique();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('token_expires_at')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'is_verified']);
            $table->index(['target', 'channel']);
            $table->index('reset_token');
            $table->index('expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('password_reset_otps');
    }
};
