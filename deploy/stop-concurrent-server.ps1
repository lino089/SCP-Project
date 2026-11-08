# ==============================================================================
# Script: stop-concurrent-server.ps1
# Deskripsi: Menghentikan Nginx & PHP FastCGI Workers
# ==============================================================================

$nginxExe = "C:\laragon\bin\nginx\nginx-1.22.0\nginx.exe"

Write-Host "== [SCP CONCURRENT SERVER] Menghentikan Nginx & FastCGI Workers ==" -ForegroundColor Yellow

# Hentikan Nginx
& $nginxExe -s stop 2>$null
Get-Process -Name "nginx" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Hentikan FastCGI
Get-Process -Name "php-cgi" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Hentikan Queue Worker
& "$PSScriptRoot\stop-queue-worker.ps1"

Write-Host "Server konkuren telah dihentikan secara bersih." -ForegroundColor Green
