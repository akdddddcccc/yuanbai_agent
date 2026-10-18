[CmdletBinding()]
param([string]$InstallRoot = 'D:\yuanbai')
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$live = Join-Path $InstallRoot 'public'
$agentDir = Join-Path $InstallRoot 'backend\agent'
$server = Join-Path $agentDir 'server.mjs'
$config = Join-Path $agentDir 'agent-config.json'
$taskName = 'YuanbaiSchoolAgentV7'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$major = [int]((& $node --version).TrimStart('v').Split('.')[0])
if ($major -lt 24) { throw 'Node.js 24+ is required.' }
foreach ($path in @($live,$server,$config)) {
    if (!(Test-Path -LiteralPath $path)) { throw "Missing existing deployment: $path" }
}
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
if (!(($task.Actions.Arguments -join ' ') -like "*$server*")) {
    throw 'Agent scheduled task points to another installation. Stop and inspect its Actions.'
}
function Copy-Tree([string]$From,[string]$To,[string[]]$Extra=@()) {
    & robocopy.exe $From $To /E /R:2 /W:1 /NFL /NDL /NJH /NJS @Extra | Out-Host
    if ($LASTEXITCODE -ge 8) { throw "Copy failed: $From -> $To" }
}
function Stop-Agent {
    Stop-ScheduledTask -TaskName $taskName
    for ($i=0; $i -lt 15; $i++) {
        $connections = @(Get-NetTCPConnection -LocalPort 4175 -State Listen -ErrorAction SilentlyContinue)
        if (!$connections.Count) { return }
        Start-Sleep -Seconds 1
    }
    throw 'Agent port 4175 did not stop. No process was force-killed.'
}
function Wait-Agent([bool]$RequireNew) {
    for ($i=0; $i -lt 20; $i++) {
        try {
            # Bypass any machine-wide proxy for loopback checks.
            $raw = & curl.exe --noproxy '*' -fsS --max-time 2 http://127.0.0.1:4175/health 2>$null
            if ($LASTEXITCODE -eq 0) {
                $health = ($raw -join '') | ConvertFrom-Json
                if ($health.ok -and (!$RequireNew -or ($health.edition -eq 'school-v8' -and $health.speech_async))) { return }
            }
        } catch {}
        Start-Sleep -Seconds 1
    }
    throw 'Agent health check failed.'
}
Push-Location $repo
$backup = $null
$serviceTouched = $false
$pagesTouched = $false
try {
    Write-Host '1/5 Build and validate before changing the running site.'
    if (!(Test-Path 'node_modules\vite')) {
        & npm.cmd ci --registry=https://registry.npmmirror.com --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed; running site untouched.' }
    }
    & npm.cmd run school:build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed; running site untouched.' }
    & $node scripts/build-school-backend.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed; running site untouched.' }
    & $node --check dist-backend/agent/server.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Backend syntax check failed.' }
    Write-Host '2/5 Back up public files and Agent code. Database and keys are not copied or changed.'
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $backup = Join-Path $InstallRoot "backups\upgrade-$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    Copy-Tree $live (Join-Path $backup 'public')
    Copy-Item -LiteralPath $server -Destination (Join-Path $backup 'server.mjs')
    $keyHash = (Get-FileHash -LiteralPath $config -Algorithm SHA256).Hash
    Write-Host '3/5 Upload resources first; keep the current entry pages.'
    Copy-Tree (Join-Path $repo 'dist-school\public') $live @('/XF','*.html')
    Write-Host '4/5 Replace Agent code and verify startup.'
    $serviceTouched = $true
    Stop-Agent
    Copy-Item -LiteralPath (Join-Path $repo 'dist-backend\agent\server.mjs') -Destination $server -Force
    Start-ScheduledTask -TaskName $taskName
    Wait-Agent $true
    Write-Host '5/5 Publish entry pages.'
    $pagesTouched = $true
    & robocopy.exe (Join-Path $repo 'dist-school\public') $live '*.html' /S /R:2 /W:1 /NFL /NDL /NJH /NJS | Out-Host
    if ($LASTEXITCODE -ge 8) { throw 'Entry page deployment failed.' }
    if ((Get-FileHash -LiteralPath $config -Algorithm SHA256).Hash -ne $keyHash) { throw 'Agent configuration changed unexpectedly.' }
    Write-Host "Deployment complete. Backup: $backup"
    Write-Host 'Nginx, leaderboard service, data, and API keys were not modified.'
    Write-Host 'Refresh /yuanbai/dialogue/ and test a text question, voice playback and replay.'
} catch {
    $failure = $_
    if ($serviceTouched -and $backup) {
        try {
            Stop-Agent
            Copy-Item -LiteralPath (Join-Path $backup 'server.mjs') -Destination $server -Force
            Start-ScheduledTask -TaskName $taskName
            Wait-Agent $false
            Write-Host 'Previous Agent code restored.'
        } catch { Write-Warning "Automatic Agent rollback failed: $($_.Exception.Message). Backup: $backup" }
    }
    if ($pagesTouched -and $backup) {
        try { Copy-Tree (Join-Path $backup 'public') $live; Write-Host 'Previous public files restored.' }
        catch { Write-Warning "Public rollback failed. Backup: $backup" }
    }
    throw $failure
} finally { Pop-Location }
