# Run once in an Administrator PowerShell after the foreground test succeeds.
$ErrorActionPreference = 'Stop'
$taskName = 'YuanbaiSchoolAgentV7'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { throw 'Task already exists. Inspect it; do not overwrite a running service.' }
$release = Split-Path $PSScriptRoot -Parent
$node = (Get-Command node.exe -ErrorAction Stop).Source
$server = Join-Path $release 'agent\server.mjs'
$config = Join-Path $release 'agent\agent-config.json'
if (!(Test-Path $config)) { throw 'Missing agent-config.json' }
$action = New-ScheduledTaskAction -Execute $node -Argument ('"{0}" "{1}"' -f $server,$config) -WorkingDirectory $release
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User 'SYSTEM' -RunLevel Highest | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host 'Started YuanbaiSchoolAgentV7. Check http://127.0.0.1:4175/health on the server.'
