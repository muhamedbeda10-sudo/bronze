@echo off
rem ============================================================
rem  Lotfy Bronze ERP - start it on this computer
rem  http://localhost:3001  (Production-Control keeps 3000)
rem  Keep this window open while you work; stop.bat stops it.
rem ============================================================
cd /d "%~dp0"
title Lotfy Bronze ERP - http://localhost:3001
set PORT=3001

rem --- a portable PostgreSQL (as on the Production-Control machine): start it if it is not running ---
set PGBIN=D:\SYS\pgsql\bin
set PGDATA=D:\SYS\pgdata
if exist "%PGBIN%\pg_ctl.exe" (
  "%PGBIN%\pg_ctl.exe" status -D "%PGDATA%" >nul 2>&1
  if errorlevel 1 "%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -l "%PGDATA%\server.log" -w start >nul 2>&1
)

where node >nul 2>nul
if errorlevel 1 ( echo [ERROR] Node.js is not installed - run setup.bat first. & pause & exit /b 1 )
if not exist ".env" ( echo [ERROR] No .env yet - run setup.bat first. & pause & exit /b 1 )

rem --- already running? just open the browser ---
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if errorlevel 1 ( start "" http://localhost:%PORT% & exit /b 0 )

rem --- new tables from an update, then rebuild when the code is newer than the build ---
call npx prisma migrate deploy >nul
if errorlevel 1 ( echo [ERROR] Could not reach PostgreSQL - is it running? & pause & exit /b 1 )
powershell -NoProfile -Command "$b = Get-Item '.next\BUILD_ID' -ErrorAction SilentlyContinue; if (-not $b) { exit 1 }; $s = Get-ChildItem app,components,lib,prisma,package.json -Recurse -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($s -and $s.LastWriteTime -gt $b.LastWriteTime) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo Building the latest version ^(1-2 minutes^)...
  call npm run build
)
if not exist ".next\BUILD_ID" ( echo [ERROR] The build failed - see above. & pause & exit /b 1 )

rem --- open the browser once the server answers ---
start "" /min powershell -NoProfile -Command "for ($i = 0; $i -lt 60; $i++) { if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { Start-Process 'http://localhost:%PORT%'; break }; Start-Sleep -Seconds 1 }"
echo ============================================================
echo   Lotfy Bronze ERP  -  http://localhost:%PORT%
echo   Keep this window open. Close it (or run stop.bat) to stop.
echo ============================================================
call npx next start -p %PORT%
pause
