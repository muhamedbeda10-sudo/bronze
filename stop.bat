@echo off
rem Stops Lotfy Bronze ERP (whatever listens on port 3001)
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host 'Lotfy Bronze ERP stopped.'"
pause
