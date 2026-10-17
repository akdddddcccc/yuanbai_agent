$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content (Join-Path $root 'SHA256-MANIFEST.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($entry in $manifest.files.PSObject.Properties) {
  $file = Join-Path $root $entry.Name
  if (!(Test-Path $file)) { throw "Missing: $($entry.Name)" }
  $actual = (Get-FileHash $file -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $entry.Value) { throw "Hash mismatch: $($entry.Name)" }
}
Write-Host 'Package files verified.'
