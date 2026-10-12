@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 20+ from https://nodejs.org/ then rerun this file.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (echo npm install failed. Check your internet connection, then retry.& pause & exit /b 1)
)
echo Starting SchoolWay. Keep this terminal open.
call npm run dev
pause
