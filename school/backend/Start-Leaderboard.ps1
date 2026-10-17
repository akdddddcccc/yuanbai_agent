$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$node = (Get-Command node.exe -ErrorAction Stop).Source
& $node '.\services\leaderboard\deploy\windows\start.mjs' '.\college-config.json'
exit $LASTEXITCODE
