[CmdletBinding()]
param([string]$InstallRoot = 'D:\yuanbai')
$ErrorActionPreference = 'Stop'
$live = Join-Path $InstallRoot 'public'
$pattern = '(/yuanbai/assets/[A-Za-z0-9_.-]+\.js)\?v=[a-fA-F0-9]+'
$utf8 = [Text.UTF8Encoding]::new($false)
$plan = @()
foreach ($name in @('index.html','explore\index.html','dialogue\index.html')) {
    $path = Join-Path $live $name
    if (!(Test-Path -LiteralPath $path)) { throw "Missing page: $path" }
    $before = [IO.File]::ReadAllText($path)
    $after = [regex]::Replace($before,$pattern,'$1')
    if ($before -ne $after) {
        $plan += [PSCustomObject]@{ Name=$name; Path=$path; Content=$after }
    }
}
if (!$plan.Count) { Write-Host 'Entry module URLs already consistent. No changes.'; return }
$backup = Join-Path $InstallRoot ('backups\module-urls-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
foreach ($page in $plan) {
    $saved = Join-Path $backup $page.Name
    New-Item -ItemType Directory -Path (Split-Path $saved -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $page.Path -Destination $saved
}
try {
    foreach ($page in $plan) {
        [IO.File]::WriteAllText($page.Path,$page.Content,$utf8)
        if ([IO.File]::ReadAllText($page.Path) -ne $page.Content) { throw "Verification failed: $($page.Name)" }
    }
    Write-Host "Fixed $($plan.Count) entry pages. Backup: $backup"
    Write-Host 'Refresh the normal page. No build or service restart is needed.'
} catch {
    $failure = $_
    foreach ($page in $plan) {
        Copy-Item -LiteralPath (Join-Path $backup $page.Name) -Destination $page.Path -Force
    }
    throw $failure
}
