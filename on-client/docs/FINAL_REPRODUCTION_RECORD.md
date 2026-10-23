# 최종 커밋 재현 기록

이 문서는 22단계에서 수행한 재현 기록입니다. 서버의 AI가 이 문서를 읽을 수 있도록 실제 명령의 결과, 코드·문서 확인, 학생 진술, 미확인 범위를 분리합니다. 이 기록 자체는 실제 운영 인증이나 22단계 통과를 뜻하지 않습니다.

## 1. 재현 대상과 보존 상태

| 항목 | 기록 |
|---|---|
| 저장소 | `https://github.com/seohyosang95-spec/keshev-defense` |
| 브랜치 | `master` |
| 재현 대상 커밋 | `7a3a50d60627f2688c83ca9cb5bf1a94e3556ab2` |
| 커밋 제목 | `21단계: 학생 실행 설명서와 구성도 추가` |
| 재현 시각 | `2026-10-23 15:40:33 +09:00` 기준 |
| 원래 작업 폴더 | `C:\Users\서효상\AppData\Local\ALEPH\Workbench\projects\케셰브-방어전` |
| 새 재현 폴더 | `C:\Users\서효상\AppData\Local\Temp\keshev-22-repro-20261023\repo` |

재현 전에 원래 작업 폴더의 `git status --short`가 비어 있는 것을 확인했습니다. 재현은 새 임시 폴더의 clone에서 수행했고, 원래 폴더의 코드·Git 기록·설정 파일은 복사하거나 변경하지 않았습니다. 새 재현 폴더에는 원래 폴더의 인증 파일이나 비밀 설정을 복사하지 않았습니다.

이번 기록을 포함하는 22단계 최종 제출 커밋을 만들 때는 이 문서의 재현 대상과 실제 제출 커밋이 혼동되지 않도록 커밋 값을 다시 대조합니다. 이 재현에서 실행 파일은 위 커밋의 내용을 사용했고, 이후에는 문서만 추가했습니다. 문서 외의 코드 변경이 생기면 같은 절차를 다시 수행해야 합니다.

## 2. 새 폴더에서 받은 절차

새 임시 폴더가 존재하지 않는 것을 확인한 뒤 다음 명령을 실행했습니다.

```powershell
New-Item -ItemType Directory -Path 'C:\Users\서효상\AppData\Local\Temp\keshev-22-repro-20261023'
git clone --branch master --single-branch --no-tags https://github.com/seohyosang95-spec/keshev-defense 'C:\Users\서효상\AppData\Local\Temp\keshev-22-repro-20261023\repo'
Set-Location 'C:\Users\서효상\AppData\Local\Temp\keshev-22-repro-20261023\repo\on-client'
git rev-parse HEAD
```

`git rev-parse HEAD` 결과는 `7a3a50d60627f2688c83ca9cb5bf1a94e3556ab2`였고, 원래 기록한 커밋과 일치했습니다. clone은 공개 저장소의 `master`에서 받았으며, 비공개 인증이나 별도 자격 증명 입력은 하지 않았습니다.

## 3. 런타임·검사·실행 재현

### 3.1 런타임과 문법 검사

새 clone의 `on-client`에서 확인한 값입니다.

| 항목 | 실제 결과 | 근거 |
|---|---|---|
| Node.js | `v24.20.0` | `node --version` |
| npm | `11.19.0` | `npm --version` |
| 프로젝트 선언 Node.js | `24.19.0` | `package.json`의 `engines.node` |
| 프로젝트 버전 | `0.2.11` | `package.json` |
| 문법 검사 | 통과 | `npm run check` 실행, `node --check student/extension.mjs` 출력 확인 |
| 의존성 설치 | 실행하지 않음 | 현재 `package.json`에 `dependencies`가 없고 lock 파일을 확인하지 못함 |

### 3.2 서버 시작

먼저 21단계 설명서의 기본 명령을 그대로 실행했습니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1
```

결과는 다음과 같았습니다.

```text
포트 5189 를 다른 프로그램이 쓰고 있습니다. 그 프로그램은 그대로 두고, 다른 번호로 실행해 주세요. 예: -Port 5190
```

다른 프로그램을 종료하지 않고 문서에 적은 복구 명령을 실행했습니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -Port 5190
```

다음 시작 신호를 실제로 확인했습니다.

```text
케셰브가 켜졌습니다. 브라우저에서 http://127.0.0.1:5190/ 을 여세요.
서버가 응답한 것만 확인했습니다. AI 연결 상태는 화면에서 따로 확인해 주세요.
끄려면 이 창에서 Ctrl+C 를 누르세요.
```

### 3.3 로컬 HTTP 관찰

브라우저 자동화 표면이 제공되지 않아 시각적 브라우저 화면은 확인하지 못했습니다. 대신 실행 중인 clone 서버에 `Invoke-WebRequest`로 HTTP 응답을 확인했습니다.

| 주소 | 결과 | 의미 |
|---|---:|---|
| `http://127.0.0.1:5190/` | 200, `text/html` | 앱 문서 응답 확인 |
| `/app.js` | 200, `text/javascript` | 제공 화면 스크립트 응답 확인 |
| `/student/extension.mjs` | 200, `text/javascript` | 학생 모듈 응답 확인 |
| `/api/me` | 503 | 기본 연결·신원 자료가 준비되지 않은 상태 |
| `/api/apps` | 503 | 기본 연결·앱 자료가 준비되지 않은 상태 |
| `/api/events` | 503 | 기본 연결·기록 자료가 준비되지 않은 상태 |
| `/api/vulnerabilities` | 200, `ok: true`, `data.status: not_configured`, 패키지 0개 | 승인된 공개 조회 설정이 없는 조회 결과 |
| `/api/diagnostics` | 200, JSON 자료 반환 | 제공 화면이 전달할 진단 응답 경계 확인; 비밀값은 출력하지 않음 |

서버 실행 중에는 AI 연결·사건 설명·실제 조치 요청을 보내지 않았습니다. `/api/ai/check`, `/api/ai/explain`, 조치 POST 요청은 유료 요청이나 실제 집행을 발생시킬 수 있어 재현 대상으로 호출하지 않았습니다.

### 3.4 종료와 재실행

실행 중인 서버 PowerShell 세션에서 `Ctrl+C`를 보냈고 서버 프로세스를 종료했습니다. 종료 뒤 `http://127.0.0.1:5190/`에 다시 요청했을 때 응답 시간이 초과되어 서버가 더 이상 응답하지 않는 것을 확인했습니다.

재실행 명령은 다음과 같습니다. 이 기록에서는 종료 후 실제 두 번째 시작까지는 수행하지 않았으므로 재실행은 미확인으로 남깁니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -Port 5190
```

## 4. 13~21단계 기능 대조

아래 표는 같은 학생 코드와 문서를 기준으로 한 확인 기록입니다. “코드/원문 확인”은 파일을 읽은 결과이고, “실제 실행”은 이번 clone에서 명령 또는 HTTP를 실행한 결과입니다. 모의 자료나 기본 연결 끊김 응답을 실제 운영 성공으로 해석하지 않습니다.

| 단계 | 학생 기능·자료 | 확인 시각 | 근거 | 결과와 미확인 범위 |
|---:|---|---|---|---|
| 13 | `student/extension.mjs`의 `renderIdentity` | 2026-10-23 | 학생 코드 | 상태 표시 코드는 원문 확인. 실제 계정 신원 확인은 미확인. |
| 14 | `renderDecision` | 2026-10-23 | 학생 코드와 제공 API 경계 | 접근 판정 표시 코드는 원문 확인. 실제 정책 판정 연결은 미확인. |
| 15 | `renderEvents` | 2026-10-23 | 학생 코드의 목록·상세·근거·규칙 표시 | 코드 구조 확인. 실제 XDR 기록·다중 이벤트 화면은 미확인. |
| 16 | `renderStatus`와 기록 상세의 미지원 조치 안내 | 2026-10-23 | 학생 코드, `data-student-event-detail` | loading/빈 값/error/진단·알림 표시 코드 확인. 실제 새로고침·복사 버튼 동작은 미확인. |
| 17 | `renderAiConnection`, `renderExplanation` 기초 | 2026-10-23 | 학생 코드, 제공 서버 경계 | `test`·`verified`와 사건 설명 분리 코드는 확인. 실제 계정 권한·모델 호출은 미확인. |
| 18 | 근거·규칙·unknown 상태·제안 표시 | 2026-10-23 | `renderExplanation` | 근거 ID 대조·성공 속성 제한·실행하지 않음 표시를 코드로 확인. 실제 설명 응답은 미확인. |
| 19 | `renderAction` | 2026-10-23 | 학생 코드와 제공 조치 API 경계 | ACK·효과 관측·unknown 분리 코드는 확인. 실제 집행기와 효과 확인은 미확인. |
| 20 | `renderVulnerabilities` | 2026-10-23 | 학생 코드 및 clone의 `/api/vulnerabilities` | 정확한 버전·조회 상태 표시 코드는 확인. 실제 OSV 조회는 `not_configured`, 패키지 0개로 확인되어 미수행. |
| 21 | `docs/STUDENT_RUNBOOK.md` | 2026-10-23 | 학생 문서와 clone 실행 | 경로·명령·구성도·경계 문서와 실제 시작/HTTP 결과를 대조. 브라우저 시각 확인은 미확인. |

## 5. 보존·백업·복원 계획

### 보존

- 원래 작업 폴더와 기존 Git 기록을 작업 대상으로 유지합니다.
- 제출할 커밋은 저장소 URL·브랜치·40자리 hash를 함께 기록합니다.
- 원문 제출 도구를 사용할 때는 커밋된 원문만 묶고, `.env`·토큰·비밀번호·API 키를 문서나 화면에 넣지 않습니다.
- 새 clone은 별도 폴더에서만 실행하고 원래 폴더의 인증·설정 파일을 복사하지 않습니다.

### 백업

- GitHub의 해당 커밋과 원래 작업 폴더를 서로 다른 보존 지점으로 사용합니다.
- 재현 폴더에는 공개 저장소 clone만 두고, 운영 자격 증명이나 비밀 설정은 저장하지 않습니다.
- 22단계 결과가 달라지면 서로 다른 커밋의 결과를 합치지 않고, 새 커밋과 새 재현 기록을 만듭니다.

### 복원

```powershell
git clone --branch master --single-branch https://github.com/seohyosang95-spec/keshev-defense '<새 폴더>\repo'
Set-Location '<새 폴더>\repo\on-client'
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -Port 5190
```

복원된 앱이 시작되었다는 사실은 AI 권한, XDR 연결, 사건 설명, 조치 효과를 복원했다는 뜻이 아닙니다. 운영 연결은 제공된 안전한 설정과 권한이 있을 때 별도로 확인합니다.

## 6. 최종 지원 범위와 미해결 사항

현재 재현에서 확인된 것은 동일 커밋의 clone, Node/npm 런타임, 학생 모듈 문법 검사, 로컬 정적 파일 응답, 연결 끊김 기본 API 응답, 취약점 조회의 `not_configured` 상태입니다.

다음은 여전히 검증 중인 항목입니다.

- 브라우저에서 `보호 현황`, AI 연결, 보안 기록 탭을 실제로 보고 버튼을 누르는 확인
- 운영 계정의 `verified` AI 연결과 실제 사건 설명 모델 응답
- 19단계 보안 조치의 실제 전달·ACK·효과 관측
- package-lock과 설치된 `node_modules`의 대조 및 OSV 공개 조회
- SDP·XDR·네이티브 호스트의 운영 권한 연결
- 서버가 반환한 503 연결 오류 뒤 실제 계정 연결 복구

따라서 이번 기록은 “같은 커밋을 별도 폴더에서 실행 절차에 따라 점검한 재현 기록”이며, 22단계 원문 검토나 로컬 서버 응답을 실제 운영 인증·v1.0 자동 인증·보안 조치 성공으로 표현하지 않습니다.
