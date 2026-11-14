@echo off
title QueueFlow - Automated Video Recording Demo
color 0B

cd /d "%~dp0"

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

:: 2. Check if Backend and Frontend services are running
echo [*] Checking QueueFlow local services...

powershell -Command "try { $b = (Invoke-WebRequest -Uri 'http://localhost:5002/api/health' -UseBasicParsing -TimeoutSec 2).StatusCode; if ($b -ne 200) { exit 1 } } catch { exit 1 }" >nul 2>&1
set BACKEND_STATUS=%errorlevel%

powershell -Command "try { $f = (Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 2).StatusCode; if ($f -ne 200) { exit 1 } } catch { exit 1 }" >nul 2>&1
set FRONTEND_STATUS=%errorlevel%

if %BACKEND_STATUS% neq 0 (
    echo [!] Backend server (port 5002) is not running. Starting in background...
    start "QueueFlow Backend" cmd /c "cd /d "%~dp0server" && node server.js"
) else (
    echo [OK] Backend server (port 5002) is already online.
)

if %FRONTEND_STATUS% neq 0 (
    echo [!] Frontend client (port 5173) is not running. Starting in background...
    start "QueueFlow Frontend" cmd /c "cd /d "%~dp0client" && npm run dev"
) else (
    echo [OK] Frontend client (port 5173) is already online.
)

:: If either had to be started, wait up to 15 seconds until both are verified online
if %BACKEND_STATUS% neq 0 goto WAIT_SERVICES
if %FRONTEND_STATUS% neq 0 goto WAIT_SERVICES
goto SERVICES_READY

:WAIT_SERVICES
echo [*] Waiting for QueueFlow backend and frontend services to be fully ready...
powershell -Command "$b=0; $f=0; for($i=1; $i -le 15; $i++){ try{ if((Invoke-WebRequest -Uri 'http://localhost:5002/api/health' -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200){ $b=1 } }catch{}; try{ if((Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200){ $f=1 } }catch{}; if($b -eq 1 -and $f -eq 1){ exit 0 }; Start-Sleep -Seconds 1 }; exit 1" >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Services are taking longer than usual to initialize. Proceeding to launch check...
) else (
    echo [OK] Both Backend (port 5002) and Frontend (port 5173) are fully online!
)

:SERVICES_READY
echo.
echo ================================================================================
echo    DEMO WALKTHROUGH READY - ALL 8 ASSIGNMENT REQUIREMENTS COVERED
echo ================================================================================
echo    1. Manager Login and Session Management (JWT HTTP-Only Cookie)
echo    2. Operational Dashboard (6 KPI Cards and Synchronized Counts)
echo    3. Create Queue with Custom Prefix Code
echo    4. Add Person to Queue (Auto-Generated Sequential Token)
echo    5. Token Table with Waiting Priority and Wait Times
echo    6. Move Tokens Up / Down (Atomically via DB Transactions and Boundary Checks)
echo    7. Call Next Token for Service (Strict Single Serving Token Rule and Timer)
echo    8. Complete Service (Duration Metrics) and Cancel Token (Confirmation Modal)
echo    9. Analytics Dashboard (Historical Snapshot Trends, Doughnut, Throughput)
echo   10. Usability Help Guide Banner and Manager Profile
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
