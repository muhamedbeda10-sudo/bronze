@echo off
rem Wipes the app's database and loads the demo data again (a test machine only!)
cd /d "%~dp0"
echo This deletes EVERYTHING in the Lotfy Bronze database and reloads the demo data.
set /p OK=Type YES to continue: 
if /I not "%OK%"=="YES" ( echo Cancelled. & pause & exit /b 0 )
call npm run seed -- --force
pause
