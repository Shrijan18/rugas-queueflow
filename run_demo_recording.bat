@echo off
title QueueFlow - Automated Video Recording Demo
color 0B
cd /d "%~dp0"

node scripts\recordDemo.js
if %errorlevel% neq 0 (
    echo.
    echo [!] An error occurred during the demo walkthrough.
    pause
)
