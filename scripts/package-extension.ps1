param([string]$Destination = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $projectRoot 'extension'
$manifest = Get-Content -LiteralPath (Join-Path $sourceRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.version -ne '1.0.0') { throw 'Update the packaging version alongside manifest version.' }
if (-not $Destination) { $Destination = Join-Path $projectRoot 'public/blog-auto-write-extension-v1.0.0.zip' }
$allowlist = @('manifest.json','config.json','document.mjs','bridge.js','popup.html','popup.css','popup.js','background.js','image-upload.js','README.md')
$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('blog-extension-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stagingRoot | Out-Null
foreach ($entry in $allowlist) {
  Copy-Item -LiteralPath (Join-Path $sourceRoot $entry) -Destination (Join-Path $stagingRoot $entry)
}
# Only explicitly allowed runtime files are staged. No env, tokens, or profiles.
Compress-Archive -LiteralPath ($allowlist | ForEach-Object { Join-Path $stagingRoot $_ }) -DestinationPath $Destination -Force
Write-Output $Destination
