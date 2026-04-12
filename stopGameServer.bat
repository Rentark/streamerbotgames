@echo off
cd /d "%~dp0"

if not exist myapp.pid exit /b

set /p PID=<myapp.pid
taskkill /PID %PID% /F >nul 2>&1
del myapp.pid
