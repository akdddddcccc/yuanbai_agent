@echo off
cd /d "%~dp0"
if exist "runtime\node.exe" (
  "runtime\node.exe" "scripts\local-backup-server.mjs"
) else (
  node "scripts\local-backup-server.mjs"
)
pause
