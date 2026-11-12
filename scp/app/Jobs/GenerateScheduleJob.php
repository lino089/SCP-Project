<?php

namespace App\Jobs;

use App\Models\ScheduleGenerationBatch;
use App\Services\ScheduleGeneratorService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GenerateScheduleJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        protected int $batchId,
        protected array $targetCycles,
        protected int $userId
    ) {
    }

    /**
     * Execute the job.
     */
    public function handle(ScheduleGeneratorService $generatorService): void
    {
        $batch = ScheduleGenerationBatch::find($this->batchId);
        if (!$batch) {
            return;
        }

        try {
            $batch->update(['status' => 'processing']);
            $generatorService->generate($this->targetCycles, $this->userId);
        } catch (\Throwable $e) {
            Log::error('GenerateScheduleJob failed: ' . $e->getMessage(), [
                'batch_id' => $this->batchId,
                'trace' => $e->getTraceAsString(),
            ]);
            $batch->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);
        }
    }
}
