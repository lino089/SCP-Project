# ==============================================================================
# Script: start-concurrent-server.ps1
# Deskripsi: Menjalankan Nginx + PHP FastCGI Multi-Worker untuk SCP Backend
# Kapasitas: 6 worker paralel (Port 9001-9006) di balik Nginx Reverse Proxy (Port 8000)
# ==============================================================================

$nginxExe = "C:\laragon\bin\nginx\nginx-1.22.0\nginx.exe"
$nginxDir = "C:\laragon\bin\nginx\nginx-1.22.0"
$nginxConf = "D:\MyUKK\SchoolClassProject\deploy\nginx\nginx.conf"
$phpCgi = "C:\php\php-cgi.exe"
$workerPorts = 9001..9006

Write-Host "== [SCP CONCURRENT SERVER] Memulai Server Konkuren Nginx + FastCGI ==" -ForegroundColor Cyan

# 1. Hentikan proses yang sedang menduduki port 8000
$conns = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    $procId = $c.OwningProcess
    try {
        $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($p -and $p.ProcessName -ne "System") {
            Write-Host "Menghentikan proses lama di port 8000 (PID: $procId - $($p.ProcessName))..." -ForegroundColor Yellow
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}

# 2. Hentikan nginx dan php-cgi lama jika ada
try {
    Start-Process -FilePath $nginxExe -ArgumentList "-p", "`"$nginxDir`"", "-s", "stop" -Wait -WindowStyle Hidden -ErrorAction SilentlyContinue
} catch {}
Get-Process -Name "nginx" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "php-cgi" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 600

# 3. Jalankan 6 FastCGI Workers dengan WMI Win32_Process (detached)
$wmi = [wmiclass]"Win32_Process"
Write-Host "Menjalankan $($workerPorts.Count) PHP FastCGI workers (port $($workerPorts[0])-$($workerPorts[-1]))..." -ForegroundColor Green
foreach ($port in $workerPorts) {
    $cmd = "`"$phpCgi`" -b 127.0.0.1:$port"
    $res = $wmi.Create($cmd)
    if ($res.ReturnValue -eq 0) {
        Write-Host "  Worker FastCGI port $port started (PID: $($res.ProcessId))" -ForegroundColor DarkGray
    } else {
        Write-Host "  Gagal memulai worker port $port (Code: $($res.ReturnValue))" -ForegroundColor Red
    }
}

Start-Sleep -Milliseconds 800

# 4. Jalankan Nginx (detached)
Write-Host "Menjalankan Nginx reverse proxy pada port 8000..." -ForegroundColor Green
$nginxCmd = "`"$nginxExe`" -p `"$nginxDir`" -c `"$nginxConf`""
$nRes = $wmi.Create($nginxCmd, $nginxDir, $null)
if ($nRes.ReturnValue -eq 0) {
    Write-Host "  Nginx started (PID: $($nRes.ProcessId))" -ForegroundColor DarkGray
} else {
    Write-Host "  Gagal memulai Nginx (Code: $($nRes.ReturnValue))" -ForegroundColor Red
}

# 5. Jalankan Queue Worker (detached)
Write-Host "Menjalankan Laravel Queue Worker..." -ForegroundColor Green
& "$PSScriptRoot\start-queue-worker.ps1"

Start-Sleep -Milliseconds 1000

# 6. Uji probe kesehatan
try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/ping" -Method Get -TimeoutSec 5
    Write-Host "`n== [SUKSES] Nginx & FastCGI Cluster Aktif & Sehat! ==" -ForegroundColor Green
    Write-Host "Respons API /api/ping: $($resp | ConvertTo-Json -Compress)" -ForegroundColor White
} catch {
    Write-Host "`nPERINGATAN: Probe ke http://127.0.0.1:8000/api/ping belum menjawab: $($_.Exception.Message)" -ForegroundColor Red
}
