<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Hash;

class PhoneAuthOtp extends Model
{
    use HasFactory;

    protected $table = 'phone_auth_otps';

    protected $fillable = [
        'user_id',
        'phone_number',
        'channel',
        'code_hash',
        'purpose',
        'session_token',
        'selection_token',
        'attempts',
        'is_verified',
        'expires_at',
        'resend_available_at',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'is_verified' => 'boolean',
        'attempts' => 'integer',
        'expires_at' => 'datetime',
        'resend_available_at' => 'datetime',
    ];

    /**
     * Batas maksimal kegagalan memasukkan kode OTP
     */
    public const MAX_ATTEMPTS = 5;

    /**
     * Relasi ke akun User (nullable, jika verifikasi sebelum login multi-akun)
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Memeriksa apakah sesi OTP telah kedaluwarsa
     */
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Memeriksa apakah pengguna sudah boleh meminta pengiriman ulang OTP
     */
    public function canResend(): bool
    {
        return $this->resend_available_at->isPast();
    }

    /**
     * Memeriksa apakah batas percobaan gagal telah terlampaui
     */
    public function hasExceededAttempts(): bool
    {
        return $this->attempts >= self::MAX_ATTEMPTS;
    }

    /**
     * Memverifikasi kode input dengan hash tersimpan (Zero Plaintext Security)
     */
    public function verifyCode(string $code): bool
    {
        return Hash::check(trim($code), $this->code_hash);
    }
}
