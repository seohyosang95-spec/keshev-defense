import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist', 'keshev-package');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const directory of ['public', 'src', 'student', 'tools', 'vendor', 'docs']) {
  await cp(join(root, directory), join(output, directory), { recursive: true });
}

for (const file of ['.env.example', '.on-starter-manifest.json', 'README.md', 'package.json']) {
  await cp(join(root, file), join(output, file));
}

await writeFile(join(output, 'launch-keshev.ps1'), `
[CmdletBinding()]
param([int]$Port = 5189)
Set-StrictMode -Version 3
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$start = Join-Path $root 'tools\\start-alekov.ps1'
if (-not (Test-Path -LiteralPath $start)) { throw "실행 파일을 찾을 수 없습니다: $start" }
& powershell -NoProfile -ExecutionPolicy Bypass -File $start -Port $Port -Background
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Start-Process ("http://127.0.0.1:{0}/" -f $Port)
`, 'utf8');

await writeFile(join(output, 'INSTALL.md'), `# 케셰브 설치·실행 안내

## 필요한 실행 환경

- Windows
- Node.js 22~24 계열(수업 기준 24.19.0)
- 별도 npm 패키지 설치 없음

## 설치 묶음으로 실행

1. 이 폴더를 원하는 경로에 둡니다.
2. \`launch-keshev.ps1\`을 실행하거나 설치 프로그램이 만든 「케셰브」 바로가기를 엽니다.
3. 브라우저에서 \`http://127.0.0.1:5189/\`가 열리는지 확인합니다.
4. 상단 상태가 「연결 없음」이면 서버는 실행됐지만 운영 계정·SDP 연결은 아직 준비되지 않은 상태입니다.

PowerShell에서 직접 실행할 때:

\`\`\`powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\\launch-keshev.ps1
\`\`\`

## 종료

백그라운드로 실행된 Node.js 프로세스는 작업 관리자에서 해당 프로세스 번호를 확인해 종료합니다. 다른 프로그램이나 포트를 임의로 종료하지 않습니다.

## 표시 범위

이 앱의 「내 PC 상태」는 등록된 기기와 현재 검증된 세션을 표시합니다. CPU·메모리·디스크·방화벽을 측정하지 않으며 예시 수치를 실제 측정값으로 표시하지 않습니다.

## 문제 발생 시

Node.js 버전·포트·오류 메시지 전체를 확인합니다. 보안 설정을 끄거나 인증서·토큰·API 키를 이 폴더나 채팅에 넣지 않습니다.
`, 'utf8');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(absolute));
    else files.push(relative(output, absolute).replaceAll('\\', '/'));
  }
  return files;
}

const contents = (await listFiles(output)).sort();
const manifest = {
  schema: 'keshev.app-package.v1',
  name: '케셰브',
  packageName: packageJson.name,
  packageVersion: packageJson.version,
  runtime: packageJson.engines?.node || '22~24',
  entrypoint: 'launch-keshev.ps1',
  installerMode: 'inno-setup-per-user',
  contents,
};
await writeFile(join(output, 'APP_PACKAGE_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`케셰브 설치 묶음을 만들었습니다: ${output}`);
console.log(`포함 파일: ${contents.length}개`);
