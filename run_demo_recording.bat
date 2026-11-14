@echo off
title QueueFlow - Automated Video Recording Demo
echo ======================================================================
echo    QueueFlow: Smart Queue Management System - Automated Demo
echo ======================================================================
echo.
echo [INFO] Ready your screen recorder (OBS, Loom, Xbox Game Bar: Win + Alt + R)
echo [INFO] Chrome/Edge will open automatically and execute the full walkthrough.
echo.
echo Starting in 3 seconds...
timeout /t 3 /nobreak >nul
node scripts/recordDemo.js
echo.
echo ======================================================================
echo    Demo completed! You can now stop your screen recording.
echo ======================================================================
pause

