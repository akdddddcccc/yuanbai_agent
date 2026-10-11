@echo off
cd /d "%~dp0"
if not exist "runtime\node.exe" (
  echo Please copy the supplied Node 24 runtime into runtime first.
  pause
  exit /b 1
)
"runtime\node.exe" "services\leaderboard\deploy\windows\start.mjs" "%~dp0college-config.json"
pause
