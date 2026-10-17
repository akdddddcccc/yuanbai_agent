$ErrorActionPreference = 'Stop'
$name = 'YuanbaiSchoolLeaderboard'
if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) { throw 'Task exists; inspect it before changing.' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$config = Join-Path $PSScriptRoot 'college-config.json'
$server = Join-Path $PSScriptRoot 'services\leaderboard\deploy\windows\start.mjs'
if (!(Test-Path (Join-Path $PSScriptRoot 'data\school-leaderboard.sqlite'))) { throw 'Initialize the school database first.' }
$action = New-ScheduledTaskAction -Execute $node -Argument ('"{0}" "{1}"' -f $server,$config) -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -User 'SYSTEM' -RunLevel Highest | Out-Null
Start-ScheduledTask -TaskName $name
