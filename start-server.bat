@echo off
setlocal
cd /d "%~dp0"
title Sahqmo Language Blog - Dev Server

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Download it from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Starting dev server at http://localhost:5173
echo Code changes reload automatically. Press Ctrl+C to stop.
echo.
call npm run dev -- --open

pause
