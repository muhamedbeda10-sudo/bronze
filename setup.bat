@echo off
rem ============================================================
rem  Lotfy Bronze ERP - first-time setup on this computer
rem  1) checks Node.js   2) writes .env (database + first admin)
rem  3) installs packages   4) creates the database and tables
rem  5) loads the demo data   6) builds the app
rem  Run it again any time: it skips what is already done.
rem ============================================================
cd /d "%~dp0"
title Lotfy Bronze ERP - setup

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Install the LTS version from https://nodejs.org then run setup.bat again.
  pause
  exit /b 1
)

if exist ".env" (
  echo [1/5] .env already exists - keeping it.
) else (
  echo [1/5] Database and first admin
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-env.ps1"
  if not exist ".env" ( echo [ERROR] .env was not written. & pause & exit /b 1 )
)

echo [2/5] Installing packages (a few minutes the first time)...
call npm install
if errorlevel 1 ( echo [ERROR] npm install failed - see above. & pause & exit /b 1 )

echo [3/5] Creating the database and its tables...
call npx prisma migrate deploy
if errorlevel 1 (
  echo [ERROR] Could not reach PostgreSQL. Is it running? Are the user and password in .env right?
  echo         Fix .env ^(or delete it and run setup.bat again^).
  pause
  exit /b 1
)

echo [4/5] Loading the demo data (skipped when the database already has orders)...
call npm run seed
if errorlevel 1 ( echo [ERROR] Loading the demo data failed - see above. & pause & exit /b 1 )

echo [5/5] Building the app (1-2 minutes)...
call npm run build
if errorlevel 1 ( echo [ERROR] The build failed - see above. & pause & exit /b 1 )

echo.
echo ============================================================
echo   Done. Start the app with run.bat  -  http://localhost:3001
echo   Sign in with the admin email and password you just chose.
echo   Demo users (same password): planner@, qc@, melting@, store@,
echo   gm@, tech@lotfybronze.com
echo ============================================================
pause
