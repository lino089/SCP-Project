<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ResetPasswordOtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $code
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "[SCP SMKN 1 Bantul] Kode Pemulihan Kata Sandi Anda: {$this->code}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.reset-password-otp',
        );
    }
}
