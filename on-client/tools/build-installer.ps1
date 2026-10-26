[CmdletBinding()]
param(
  [string]$IsccPath
)

Set-StrictMode -Version 3
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $root 'installer\keshev.iss'
$package = Join-Path $root 'dist\keshev-package'
$output = Join-Path $root 'dist\installer'

if (-not (Test-Path -LiteralPath $package)) {
  & node (Join-Path $root 'tools\package-app.mjs')
  if ($LASTEXITCODE -ne 0) { throw '설치 묶음 생성에 실패했습니다.' }
}

if ([string]::IsNullOrWhiteSpace($IsccPath)) {
  $command = Get-Command ISCC.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($command) { $IsccPath = $command.Source }
}
if ([string]::IsNullOrWhiteSpace($IsccPath)) {
  foreach ($candidate in @(
    'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
    'C:\Program Files\Inno Setup 6\ISCC.exe'
  )) {
    if (Test-Path -LiteralPath $candidate) { $IsccPath = $candidate; break }
  }
}
if ([string]::IsNullOrWhiteSpace($IsccPath) -or -not (Test-Path -LiteralPath $IsccPath)) {
  throw 'Inno Setup Compiler(ISCC.exe)를 찾지 못했습니다. Inno Setup 설치 후 다시 실행하거나 -IsccPath로 ISCC.exe 경로를 지정하세요.'
}

New-Item -ItemType Directory -Path $output -Force | Out-Null
& $IsccPath $script
if ($LASTEXITCODE -ne 0) { throw "Inno Setup 컴파일에 실패했습니다. 종료 코드: $LASTEXITCODE" }

$setup = Get-ChildItem -LiteralPath $output -Filter 'KeshevSetup-*.exe' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $setup) { throw '컴파일은 끝났지만 setup.exe를 찾지 못했습니다.' }
$hash = Get-FileHash -LiteralPath $setup.FullName -Algorithm SHA256
Write-Output "설치 프로그램: $($setup.FullName)"
Write-Output "SHA-256: $($hash.Hash)"
