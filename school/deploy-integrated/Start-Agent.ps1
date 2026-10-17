$ErrorActionPreference = 'Stop'
$release = Split-Path $PSScriptRoot -Parent
$config = Join-Path $release 'agent\agent-config.json'
if (!(Test-Path $config)) { throw 'Copy agent-config.example.json to agent-config.json and fill API keys first.' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$major = [int]((& $node --version).TrimStart('v').Split('.')[0])
if ($major -lt 24) { throw 'Node.js 24 or newer is required.' }
Set-Location $release
& $node (Join-Path $release 'agent\server.mjs') $config
exit $LASTEXITCODE
