@echo off
cd /d "%~dp0"

:: Remove stale PID if exists
if exist myapp.pid del myapp.pid

:: Start Node minimized, with window title "MyCoolNodeApp"
start "custom-twitch-bot" /min node index.js > node.log 2>&1

:: Optional: wait a second for Node to start, then get its PID
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH') do (
    echo %%i > myapp.pid
    goto done
)
:done