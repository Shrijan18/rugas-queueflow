@echo off
title QueueFlow - Automated Video Recording Demo
color 0B

echo ================================================================================
echo    QueueFlow: Smart Queue Management System - Automated Video Recording Demo
echo ================================================================================
echo.

:: 1. Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH. Please install Node.js to run this demo.
    pause
    exit /b 1
)

:: 2. Check if servers are running, if not start them automatically
echo [*] Checking QueueFlow local services...
powershell -Command "try { (Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] QueueFlow servers are not detected.
    echo [*] Starting QueueFlow Backend and Frontend servers in background...
    start "QueueFlow Backend" /min cmd /c "npm run server"
    start "QueueFlow Frontend" /min cmd /c "npm run client"
    echo [*] Waiting 6 seconds for servers to initialize...
    timeout /t 6 /nobreak >nul
) else (
    echo [OK] QueueFlow servers are online at http://localhost:5173.
)

echo.
echo ================================================================================
echo    DEMO WALKTHROUGH READY - ALL 8 ASSIGNMENT REQUIREMENTS COVERED
echo ================================================================================
echo    1. Manager Login & Session Management (JWT HTTP-Only Cookie)
echo    2. Operational Dashboard (6 KPI Cards & Synchronized Counts)
echo    3. Create Queue with Custom Prefix Code
echo    4. Add Person to Queue (Auto-Generated Sequential Token)
echo    5. Token Table with Waiting Priority & Wait Times
echo    6. Move Tokens Up / Down (Atomically via DB Transactions & Boundary Checks)
echo    7. Call Next Token for Service (Strict Single Serving Token Rule & Timer)
echo    8. Complete Service (Duration Metrics) & Cancel Token (Confirmation Modal)
echo    9. Analytics Dashboard (Historical Snapshot Trends, Doughnut, Throughput)
echo   10. Usability Help Guide Banner & Manager Profile
echo.
echo ================================================================================
echo    INSTRUCTIONS FOR SCREEN RECORDING:
echo ================================================================================
echo    1. Start your screen recorder now:
echo       - Windows Built-in: Press  Win + Alt + R  (Xbox Game Bar)
echo       - Or start Loom / OBS / Camtasia
echo.
echo    2. When your recording is ACTIVE, press ANY KEY below to begin the demo.
echo       (Chrome will launch maximized and perform all actions smoothly)
echo ================================================================================
echo.
pause
echo.
echo [*] Launching automated walkthrough in 2 seconds...
timeout /t 2 /nobreak >nul

node scripts/recordDemo.js

echo.
echo ================================================================================
echo    🎉 DEMO COMPLETED! You can now stop your screen recording.
echo ================================================================================
echo.
pause
