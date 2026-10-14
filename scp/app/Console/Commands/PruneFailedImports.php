<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use App\Models\ScheduleImport;
use Symfony\Component\Console\Command\Command as SymfonyCommand;


class PruneFailedImports extends Command
{
    /**
     * Execute the console command.
     */
    protected $signature = 'scp:prune-failed-imports';
    protected $description = 'Membersihkan data import jadwal yang gagal lebih dari7 hari';

    public function handle(): int
    {
        $deleted = ScheduleImport::where('status', 'failed')
            ->where('created_at', '<', now()->subdays(7))
            ->delete();

        $this->info("Berhasil membersihkan {$deleted} data import yang gagal.");

        return SymfonyCommand::SUCCESS;
    }
}
