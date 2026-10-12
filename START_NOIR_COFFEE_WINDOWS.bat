@echo off
setlocal
cd /d "%~dp0"
echo.
echo ===============================
echo    NOIR COFFEE - START SITE
 echo ===============================
echo.
where node >nul 2>&1
if errorlevel 1 (
 echo Node.js is not installed. Install Node.js 22 LTS from https://nodejs.org and run this file again.
 pause
 exit /b 1
)
if not exist "node_modules" (
  echo Installing dependencies ...
  call npm install
  if errorlevel 1 (echo npm install failed. & pause & exit /b 1)
)
if not exist "public\animations\01_hero_01-02\frame_0001.webp" (
  echo Animation frames not yet installed.
  echo Trying to import them from your Downloads folder ...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\INSTALL_FRAMES_WINDOWS.ps1" -SourceFolder "%USERPROFILE%\Downloads"
)
echo.
echo Starting the website. Open http://localhost:5173 if browser does not open automatically.
start "" "http://localhost:5173"
call npm run dev
pause
