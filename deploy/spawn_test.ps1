$p = Start-Process -FilePath "C:\php\php-cgi.exe" -ArgumentList "-b 127.0.0.1:9001" -WindowStyle Hidden -PassThru
Start-Sleep -Milliseconds 800
$alive = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
if ($alive) {
    Write-Host "SUCCESS: php-cgi is running with PID $($p.Id)"
} else {
    Write-Host "FAILED: php-cgi exited immediately"
}
