<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\MasterDataDependencyService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Console\Command\Command as SymfonyCommand;

class PurgeSoftDeletedUsersCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'scp:purge-soft-deleted-users {--days=30 : Ambang batas hari di tempat sampah}';

    /**
     * The console command description.
     */
    protected $description = 'Membersihkan secara cerdas (auto-purge / anonymize) akun pengguna yang berada di tempat sampah lebih dari 30 hari.';

    public function __construct(
        private MasterDataDependencyService $dependencyService
    ) {
        parent::__construct();
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $days = (int) $this->option('days') ?: 30;
        $cutoffDate = Carbon::now()->subDays($days);

        $expiredUsers = User::onlyTrashed()
            ->where('deleted_at', '<=', $cutoffDate)
            ->get();

        if ($expiredUsers->isEmpty()) {
            $this->info("Tidak ada akun pengguna yang kedaluwarsa di tempat sampah (> {$days} hari).");
            return SymfonyCommand::SUCCESS;
        }

        $purgedCount = 0;
        $anonymizedCount = 0;

        foreach ($expiredUsers as $user) {
            $hasHistory = $this->dependencyService->hasLegalHistory($user->role, $user->id);

            if (!$hasHistory) {
                // Kasus 1: Data bersih tanpa riwayat transaksi -> Hard delete fisik
                $user->tokens()->delete();
                $user->forceDelete();
                $purgedCount++;
            } else {
                // Kasus 2: Memiliki riwayat transaksi legal -> Anonimisasi data & arsipkan
                $timestamp = Carbon::now()->timestamp;
                $originalId = $user->id;
                $originalIdentifier = $user->nis_nip ?: ($user->nisn ?: $originalId);

                $user->tokens()->delete();
                $user->email = "deleted_{$originalId}_{$timestamp}@archived.local";
                $user->nis_nip = "DEL_{$originalId}_{$originalIdentifier}";
                $user->name = "[Arsip] {$user->name}";
                $user->google_id = null;
                $user->phone_number = null;
                $user->is_active = false;
                $user->archived_at = Carbon::now();
                $user->save();

                $anonymizedCount++;
            }
        }

        $message = "Selesai memproses auto-purge tempat sampah: {$purgedCount} dihapus permanen, {$anonymizedCount} dianonimkan & diarsipkan.";
        $this->info($message);
        Log::info($message);

        return SymfonyCommand::SUCCESS;
    }
}
