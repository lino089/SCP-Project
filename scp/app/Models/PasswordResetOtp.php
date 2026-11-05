<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PasswordResetOtp extends Model
{
    use HasFactory;

    protected $table = 'password_reset_otps';

    protected $fillable = [
        'user_id',
        'identifier_input',
        'target',
        'channel',
        'code_hash',
        'reset_token',
        'attempts',
        'expires_at',
        'token_expires_at',
        'is_verified',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'token_expires_at' => 'datetime',
        'is_verified' => 'boolean',
        'attempts' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Memeriksa apakah kode OTP telah kedaluwarsa (10 menit)
     */
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Memeriksa apakah reset token telah kedaluwarsa (15 menit)
     */
    public function isTokenExpired(): bool
    {
        return $this->token_expires_at === null || $this->token_expires_at->isPast();
    }

    /**
     * Memeriksa kecocokan kode OTP menggunakan perbandingan waktu konstan (hash_equals)
     */
    public function checkCode(string $code): bool
    {
        return hash_equals($this->code_hash, hash('sha256', trim($code)));
    }
}
