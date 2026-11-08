# ==============================================================================
# Script: stop-queue-worker.ps1
# Deskripsi: Menghentikan Laravel Queue Worker SCP secara aman
# ==============================================================================

Write-Host "== [SCP QUEUE WORKER] Menghentikan Queue Worker ==" -ForegroundColor Cyan

$stopped = 0
$existingWorkers = Get-CimInstance Win32_Process -Filter "Name = 'php.exe'" | Where-Object { $_.CommandLine -like "*artisan*queue:work*" }
foreach ($worker in $existingWorkers) {
    Write-Host "Menghentikan worker (PID: $($worker.ProcessId))..." -ForegroundColor Yellow
    Stop-Process -Id $worker.ProcessId -Force -ErrorAction SilentlyContinue
    $stopped++
}

$pidFile = "D:\MyUKK\SchoolClassProject\deploy\queue-worker.pid"
if (Test-Path $pidFile) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

if ($stopped -gt 0) {
    Write-Host ">> $stopped Queue Worker berhasil dihentikan." -ForegroundColor Green
} else {
    Write-Host ">> Tidak ada Queue Worker yang sedang berjalan." -ForegroundColor DarkGray
}
