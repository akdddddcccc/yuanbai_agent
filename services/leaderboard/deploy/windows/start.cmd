@echo off
setlocal
cd /d "%~dp0"
if not exist "runtime\node.exe" (
  echo Missing runtime\node.exe. See DEPLOYMENT.md.
  pause
  exit /b 1
)
"runtime\node.exe" "services\leaderboard\deploy\windows\start.mjs" "college-config.json"
pause
