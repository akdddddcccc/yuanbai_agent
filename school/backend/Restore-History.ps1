$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$node = (Get-Command node.exe -ErrorAction Stop).Source
if ([int]((& $node --version).TrimStart('v').Split('.')[0]) -lt 24) { throw 'Node.js 24 or newer is required.' }
& $node '.\services\leaderboard\database-transfer.mjs' restore '.\snapshot\yuanbai-history.sqlite' '.\data\school-leaderboard.sqlite'
if ($LASTEXITCODE -ne 0) { throw 'Restore failed. Existing database was not overwritten. Do not delete it; inspect existing school data first.' }
Write-Host 'History restored. Expected: scores=21, death_scores=21, runs=428, nickname_claims=21.'
