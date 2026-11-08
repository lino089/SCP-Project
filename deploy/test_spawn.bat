@echo off
start "" /B "C:\php\php-cgi.exe" -b 127.0.0.1:9001
start "" /B "C:\php\php-cgi.exe" -b 127.0.0.1:9002
start "" /B "C:\php\php-cgi.exe" -b 127.0.0.1:9003
start "" /B "C:\php\php-cgi.exe" -b 127.0.0.1:9004
start "" /B "C:\php\php-cgi.exe" -b 127.0.0.1:9005
start "" /B "C:\php\php-cgi.exe" -b 127.0.0.1:9006
timeout /t 1 /nobreak > nul
netstat -ano | findstr "9001 9002 9003 9004 9005 9006"
