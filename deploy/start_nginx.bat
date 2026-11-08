@echo off
set NGINX_DIR=C:\laragon\bin\nginx\nginx-1.22.0
set NGINX_CONF=D:\MyUKK\SchoolClassProject\deploy\nginx\nginx.conf

cd /d "%NGINX_DIR%"
start "" "%NGINX_DIR%\nginx.exe" -p "%NGINX_DIR%" -c "%NGINX_CONF%"
timeout /t 1 /nobreak > nul
netstat -ano | findstr 8000
