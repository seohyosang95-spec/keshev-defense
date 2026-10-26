[CmdletBinding()]
param(
  [string]$IsccPath
)

Set-StrictMode -Version 3
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $root 'installer\keshev.iss'
$sourcePackage = Join-Path $root 'dist\keshev-package'
$stagingRoot = Join-Path $root 'dist\installer-staging'
$package = Join-Path $stagingRoot 'keshev-package'
$output = Join-Path $root 'dist\installer'

if (-not (Test-Path -LiteralPath $sourcePackage)) {
  & node (Join-Path $root 'tools\package-app.mjs')
  if ($LASTEXITCODE -ne 0) { throw '설치 묶음 생성에 실패했습니다.' }
}
if (-not (Test-Path -LiteralPath $sourcePackage)) { throw '기존 설치 묶음을 찾지 못했습니다.' }

Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
Copy-Item -LiteralPath $sourcePackage -Destination $package -Recurse -Force

if ([string]::IsNullOrWhiteSpace($IsccPath)) {
  $command = Get-Command ISCC.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($command) { $IsccPath = $command.Source }
}
if ([string]::IsNullOrWhiteSpace($IsccPath)) {
  foreach ($candidate in @(
    'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
    'C:\Program Files\Inno Setup 6\ISCC.exe',
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 7\ISCC.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe')
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
$hashFile = Join-Path $output ("{0}.sha256.txt" -f $setup.BaseName)
$guideFile = Join-Path $output 'INSTALLER-GUIDE.md'
@"
케셰브 설치 프로그램 검증 안내

설치 프로그램: $($setup.Name)
SHA-256: $($hash.Hash)

설치 프로그램은 Inno Setup 사용자 단위 설치로 만들어졌습니다. 설치 후 시작 메뉴의 케셰브 바로가기로 실행하고, Windows의 앱 제거 화면 또는 설치 폴더의 제거 프로그램으로 제거합니다.
실행에 필요한 Node.js 22~24 계열은 받는 PC에 별도로 준비해야 합니다.
"@ | Set-Content -LiteralPath $guideFile -Encoding UTF8
"$($setup.Name)`nSHA-256: $($hash.Hash)`n" | Set-Content -LiteralPath $hashFile -Encoding UTF8
$startHereFile = Join-Path $output 'START-HERE.md'
@"
# 케셰브 처음 설치 안내

설치 파일: $($setup.Name)
SHA-256: $($hash.Hash)

## 순서

1. Node.js 22~24 계열을 먼저 설치합니다. 수업 기준 권장 버전은 24.19.0입니다. 공식 다운로드: https://nodejs.org/en/download
2. 이 폴더의 `$($setup.Name)`를 실행합니다.
3. 설치가 끝나면 바탕화면 또는 시작 메뉴의 「케셰브」 바로가기를 엽니다.
4. 브라우저에서 `http://127.0.0.1:5189/`가 열리고 「보호 현황」이 보이는지 확인합니다.

설치 프로그램은 앱 파일과 실행 안내를 담아 옮깁니다. Node.js는 받는 PC에 별도로 준비해야 합니다. 보안 기능을 끄지 말고, 설치가 막히면 차단 메시지 전체를 담당자에게 전달합니다.

앱을 실행한 뒤에는 화면 상단의 「케셰브 실행 안내」 카드에서도 이 순서를 다시 볼 수 있습니다.
"@ | Set-Content -LiteralPath $startHereFile -Encoding UTF8
Write-Output "설치 프로그램: $($setup.FullName)"
Write-Output "SHA-256: $($hash.Hash)"
