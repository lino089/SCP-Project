# ==============================================================================
# Script: start-queue-worker.ps1
# Deskripsi: Menjalankan Laravel Queue Worker untuk School Class Progress (SCP)
# Parameter: connection=database, sleep=2, tries=3, timeout=180
# ==============================================================================

$phpExe = "C:\php\php.exe"
$artisanPath = "D:\MyUKK\SchoolClassProject\scp\artisan"
$workingDir = "D:\MyUKK\SchoolClassProject\scp"

Write-Host "== [SCP QUEUE WORKER] Memeriksa status Queue Worker ==" -ForegroundColor Cyan

# 1. Hentikan worker lama jika ada
$existingWorkers = Get-CimInstance Win32_Process -Filter "Name = 'php.exe'" | Where-Object { $_.CommandLine -like "*artisan*queue:work*" }
foreach ($worker in $existingWorkers) {
    Write-Host "Menghentikan worker lama (PID: $($worker.ProcessId))..." -ForegroundColor Yellow
    Stop-Process -Id $worker.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 500

# 2. Jalankan Queue Worker menggunakan WMI Win32_Process (detached)
$wmi = [wmiclass]"Win32_Process"
$cmd = "`"$phpExe`" `"$artisanPath`" queue:work --sleep=2 --tries=3 --timeout=180"

Write-Host "Menjalankan Laravel Queue Worker background..." -ForegroundColor Green
$res = $wmi.Create($cmd, $workingDir, $null)
if ($res.ReturnValue -eq 0) {
    Write-Host ">> Queue Worker berhasil dijalankan! (PID: $($res.ProcessId))" -ForegroundColor Cyan
    Set-Content -Path "D:\MyUKK\SchoolClassProject\deploy\queue-worker.pid" -Value $res.ProcessId -Force
} else {
    Write-Host ">> Gagal menjalankan Queue Worker! (Code: $($res.ReturnValue))" -ForegroundColor Red
    exit 1
}
