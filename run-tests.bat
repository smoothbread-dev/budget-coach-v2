@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get it from https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  call npm run setup
)

:menu
echo.
echo   Budget Coach v2 - Tests
echo   ------------------------
echo   1. Run all tests
echo   2. Desktop only
echo   3. Mobile only
echo   4. Watch in a browser
echo   5. Interactive UI
echo   6. View last report
echo   7. Serve the app only
echo   8. Exit
echo.
set /p choice="Choose: "

if "%choice%"=="1" call npm test
if "%choice%"=="2" call npm run test:desktop
if "%choice%"=="3" call npm run test:mobile
if "%choice%"=="4" call npm run test:headed
if "%choice%"=="5" call npm run test:ui
if "%choice%"=="6" call npm run report
if "%choice%"=="7" call npm run serve
if "%choice%"=="8" exit /b 0
goto menu
