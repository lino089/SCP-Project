<?php

namespace App\Console\Commands;

use App\Models\OtpCode;
use Illuminate\Console\Command;
use Symfony\Component\Console\Command\Command as SymfonyCommand;

class PruneExpiredOtps extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'scp:prune-expired-otps';

    /**
     * The console command description.
     */
    protected $description = 'Membersihkan seluruh kode OTP verifikasi kontak yang telah kedaluwarsa.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $deleted = OtpCode::where('expires_at', '<', now())->delete();

        $this->info("Berhasil membersihkan {$deleted} kode OTP kedaluwarsa.");

        return SymfonyCommand::SUCCESS;
    }
}
