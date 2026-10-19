// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
function formatMode(mode) {
  if (mode === 'demo') return '예제 자료';
  if (mode === 'disconnected') return '연결 없음';
  if (mode === 'unknown') return '확인 불가';
  if (mode === 'connected') return '연결됨';
  return mode ? `확인 불가 (${mode})` : '확인 불가';
}

function formatDeviceStatus(status) {
  const code = status || 'unknown';
  if (status === 'compliant') return `보안 기준 충족(${code})`;
  if (status === 'noncompliant') return `보안 기준 미충족(${code})`;
  if (status === 'unknown') return `확인 불가(${code})`;
  return `확인 불가(${code})`;
}

function formatSessionStatus(status) {
  const code = status || 'unknown';
  if (status === 'active') return `활성(${code})`;
  if (status === 'expired') return `만료(${code})`;
  if (status === 'revoked') return `철회됨(${code})`;
  if (status === 'unknown') return `확인 불가(${code})`;
  return `확인 불가(${code})`;
}

function formatDecision(decision) {
  if (decision === 'allow') {
    return {
      text: '접근 허용(allow)',
      isAllow: true,
      note: '서버가 이 앱 접속을 허용했습니다.'
    };
  }
  if (decision === 'deny') {
    return {
      text: '접근 거부(deny)',
      isAllow: false,
      note: '서버가 이 앱 접속을 거부(차단)했습니다.'
    };
  }
  if (decision === 'challenge') {
    return {
      text: '추가 확인 필요(challenge)',
      isAllow: false,
      note: '추가 인증 또는 확인이 필요합니다. 앱이 확인 절차를 대신하지 않습니다.'
    };
  }
  return {
    text: '확인 불가(unknown)',
    isAllow: false,
    note: '판정을 확인할 수 없습니다 (접근 허용되지 않음).'
  };
}

function formatAccessState(access) {
  const code = access || 'unknown';
  if (access === 'allowed') return `허용됨(${code})`;
  if (access === 'denied') return `거부됨(${code})`;
  if (access === 'unknown') return `확인 불가(${code})`;
  return `확인 불가(${code})`;
}

function formatEventKind(kind) {
  if (kind === 'access') return '접속(access)';
  if (kind === 'xdr') return 'XDR 경보(xdr)';
  return kind ? `${kind}(${kind})` : '확인 불가(unknown)';
}

export function createStudentView() {
  return {
    renderIdentity(input = {}) {
      const { me, devices, sessions } = input;
      const container = document.createElement('div');
      container.className = 'student-identity';

      // 1. loading 상태 처리
      if (!me || me.status === 'loading') {
        const loadingP = document.createElement('p');
        loadingP.textContent = '불러오는 중';
        container.appendChild(loadingP);

        if (me?.mode) {
          const modeP = document.createElement('p');
          modeP.textContent = `모드: ${formatMode(me.mode)}`;
          container.appendChild(modeP);
        }
        return container;
      }

      // 2. error 상태 처리 (오류 시 이전 사용자 정보 제거)
      if (me.status === 'error') {
        const errorP = document.createElement('p');
        const message = me.error?.message || '서버에 연결하지 못했습니다.';
        errorP.textContent = `연결 실패: ${message}`;
        container.appendChild(errorP);

        if (me.mode) {
          const modeP = document.createElement('p');
          modeP.textContent = `모드: ${formatMode(me.mode)}`;
          container.appendChild(modeP);
        }
        return container;
      }

      // 3. ok 상태 처리
      if (me.status === 'ok') {
        if (me.mode) {
          const modeP = document.createElement('p');
          modeP.textContent = `모드: ${formatMode(me.mode)}`;
          container.appendChild(modeP);
        }

        const userLabel = me.data?.user?.label || me.data?.user?.id || '확인 불가';
        const userP = document.createElement('p');
        userP.textContent = `사용자: ${userLabel}`;
        container.appendChild(userP);

        const deviceLabel = me.data?.device?.label || me.data?.device?.id || '확인 불가';
        const deviceStatus = formatDeviceStatus(me.data?.device?.status);
        const deviceP = document.createElement('p');
        deviceP.textContent = `기기: ${deviceLabel} (상태: ${deviceStatus})`;
        container.appendChild(deviceP);

        const sessionStatus = formatSessionStatus(me.data?.session?.status);
        const sessionP = document.createElement('p');
        const sessionId = me.data?.session?.id ? `${me.data.session.id} · ` : '';
        sessionP.textContent = `세션: ${sessionId}${sessionStatus}`;
        container.appendChild(sessionP);

        // 기기·세션 오류 보충 표시
        if (devices?.status === 'error') {
          const devErrP = document.createElement('p');
          devErrP.textContent = `기기 연결 실패: ${devices.error?.message || '확인 불가'}`;
          container.appendChild(devErrP);
        }
        if (sessions?.status === 'error') {
          const sessErrP = document.createElement('p');
          sessErrP.textContent = `세션 연결 실패: ${sessions.error?.message || '확인 불가'}`;
          container.appendChild(sessErrP);
        }

        return container;
      }

      // 4. 기타 확인 불가 상태
      const fallbackP = document.createElement('p');
      fallbackP.textContent = '확인 불가';
      container.appendChild(fallbackP);
      return container;
    },
    renderDecision(input = {}) {
      const { status, mode, data, error, appId } = input;
      const container = document.createElement('div');
      container.className = 'student-decision';

      // 1. 요청 전 (idle)
      if (!status || status === 'idle') {
        const p = document.createElement('p');
        p.textContent = '앱을 골라 접속을 요청하세요.';
        container.appendChild(p);
        return container;
      }

      // 2. 요청 중 (loading)
      if (status === 'loading') {
        const p = document.createElement('p');
        p.textContent = '판정 확인 중';
        container.appendChild(p);
        return container;
      }

      // 3. 요청 실패 (error) - 거부 판정과 구분, 허용으로 보이지 않게 처리
      if (status === 'error') {
        const message = error?.message || '서버에 연결하지 못했습니다.';
        const p1 = document.createElement('p');
        p1.textContent = `요청 실패: ${message}`;
        container.appendChild(p1);

        const p2 = document.createElement('p');
        p2.textContent = '판정 요청이 실패했습니다 (접근 허용되지 않음 / 차단 또는 거부 판정이 아님).';
        container.appendChild(p2);

        if (mode) {
          const modeP = document.createElement('p');
          modeP.textContent = `모드: ${formatMode(mode)}`;
          container.appendChild(modeP);
        }
        return container;
      }

      // 4. 판정 수신 (ok)
      if (status === 'ok') {
        const targetAppId = data?.appId || appId || '알 수 없음';
        const decisionInfo = formatDecision(data?.decision);

        const decisionP = document.createElement('p');
        decisionP.textContent = `판정: ${decisionInfo.text}`;
        container.appendChild(decisionP);

        if (decisionInfo.note) {
          const noteP = document.createElement('p');
          noteP.textContent = decisionInfo.note;
          container.appendChild(noteP);
        }

        const appP = document.createElement('p');
        appP.textContent = `대상 앱: ${targetAppId}`;
        container.appendChild(appP);

        const reasonP = document.createElement('p');
        reasonP.textContent = `판정 이유: ${data?.reason || '이유 정보 없음'}`;
        container.appendChild(reasonP);

        const timeP = document.createElement('p');
        timeP.textContent = `판정 시각: ${data?.checkedAt || '시각 정보 없음'}`;
        container.appendChild(timeP);

        if (mode) {
          const modeP = document.createElement('p');
          modeP.textContent = `모드: ${formatMode(mode)}`;
          container.appendChild(modeP);
        }

        return container;
      }

      // 5. 기타 확인 불가 상태
      const fallbackP = document.createElement('p');
      fallbackP.textContent = '확인 불가(unknown) - 접근 허용되지 않음';
      container.appendChild(fallbackP);
      return container;
    },
    renderEvents(input = {}) {
      const { status, mode, data, error } = input;
      const root = document.createElement('div');
      root.className = 'student-events-container';

      // 1. loading
      if (!status || status === 'loading') {
        const p = document.createElement('p');
        p.textContent = '기록을 불러오는 중...';
        root.appendChild(p);
        if (mode) {
          const modeP = document.createElement('p');
          modeP.textContent = `모드: ${formatMode(mode)}`;
          root.appendChild(modeP);
        }
        return root;
      }

      // 2. error
      if (status === 'error') {
        const p = document.createElement('p');
        p.textContent = `기록을 불러오지 못했습니다: ${error?.message || '확인 불가'}`;
        root.appendChild(p);
        if (mode) {
          const modeP = document.createElement('p');
          modeP.textContent = `모드: ${formatMode(mode)}`;
          root.appendChild(modeP);
        }
        return root;
      }

      // 3. ok
      if (status === 'ok') {
        if (!Array.isArray(data) || data.length === 0) {
          const p = document.createElement('p');
          p.textContent = '표시할 기록이 없습니다.';
          root.appendChild(p);
          if (mode) {
            const modeP = document.createElement('p');
            modeP.textContent = `모드: ${formatMode(mode)}`;
            root.appendChild(modeP);
          }
          return root;
        }

        // 원본 배열 복사 및 at 기준 최신순(내림차순) 정렬
        const events = [...data].sort((a, b) => {
          const timeA = new Date(a.at).getTime();
          const timeB = new Date(b.at).getTime();
          return timeB - timeA;
        });

        // 상단 필터 선택 상자 3개
        const filterBar = document.createElement('div');
        filterBar.className = 'student-filter-bar';

        let currentKind = 'all';
        let currentApp = 'all';
        let currentAccess = 'all';

        // 1) 기록 종류 필터
        const kindWrapper = document.createElement('label');
        kindWrapper.textContent = '기록 종류: ';
        const selectKind = document.createElement('select');
        selectKind.setAttribute('aria-label', '기록 종류');
        const optKindAll = document.createElement('option');
        optKindAll.value = 'all';
        optKindAll.textContent = '전체(all)';
        selectKind.appendChild(optKindAll);
        const uniqueKinds = [...new Set(events.map(e => e.kind).filter(Boolean))];
        uniqueKinds.forEach(k => {
          const opt = document.createElement('option');
          opt.value = k;
          opt.textContent = formatEventKind(k);
          selectKind.appendChild(opt);
        });
        kindWrapper.appendChild(selectKind);
        filterBar.appendChild(kindWrapper);

        // 2) 업무 앱 필터
        const appWrapper = document.createElement('label');
        appWrapper.textContent = '업무 앱: ';
        const selectApp = document.createElement('select');
        selectApp.setAttribute('aria-label', '업무 앱');
        const optAppAll = document.createElement('option');
        optAppAll.value = 'all';
        optAppAll.textContent = '전체(all)';
        selectApp.appendChild(optAppAll);
        const uniqueApps = [...new Set(events.map(e => e.appId).filter(Boolean))];
        uniqueApps.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a;
          opt.textContent = a;
          selectApp.appendChild(opt);
        });
        appWrapper.appendChild(selectApp);
        filterBar.appendChild(appWrapper);

        // 3) 접속 상태 필터
        const accessWrapper = document.createElement('label');
        accessWrapper.textContent = '접속 상태: ';
        const selectAccess = document.createElement('select');
        selectAccess.setAttribute('aria-label', '접속 상태');
        const optAccessAll = document.createElement('option');
        optAccessAll.value = 'all';
        optAccessAll.textContent = '전체(all)';
        selectAccess.appendChild(optAccessAll);
        const uniqueAccesses = [...new Set(events.map(e => e.state?.access).filter(Boolean))];
        uniqueAccesses.forEach(acc => {
          const opt = document.createElement('option');
          opt.value = acc;
          opt.textContent = formatAccessState(acc);
          selectAccess.appendChild(opt);
        });
        accessWrapper.appendChild(selectAccess);
        filterBar.appendChild(accessWrapper);

        root.appendChild(filterBar);

        if (mode) {
          const modeP = document.createElement('p');
          modeP.textContent = `모드: ${formatMode(mode)}`;
          root.appendChild(modeP);
        }

        // 목록 컨테이너 & 상세 컨테이너
        const listContainer = document.createElement('div');
        listContainer.className = 'student-events-list';
        root.appendChild(listContainer);

        const detailContainer = document.createElement('div');
        detailContainer.className = 'student-event-detail-area';
        root.appendChild(detailContainer);

        function showDetail(event) {
          detailContainer.setAttribute('data-student-event-detail', event.id);
          while (detailContainer.firstChild) {
            detailContainer.removeChild(detailContainer.firstChild);
          }

          const detailTitle = document.createElement('h3');
          detailTitle.textContent = `${event.id} 상세`;
          detailContainer.appendChild(detailTitle);

          const idP = document.createElement('p');
          idP.textContent = `사건 ID: ${event.id}`;
          detailContainer.appendChild(idP);

          const appP = document.createElement('p');
          appP.textContent = `업무 앱: ${event.appId || '앱 없음(확인 불가)'}`;
          detailContainer.appendChild(appP);

          const kindP = document.createElement('p');
          kindP.textContent = `기록 종류: ${formatEventKind(event.kind)}`;
          detailContainer.appendChild(kindP);

          const timeP = document.createElement('p');
          timeP.textContent = `시각: ${event.at}`;
          detailContainer.appendChild(timeP);

          const summaryP = document.createElement('p');
          summaryP.textContent = `요약: ${event.summary || '요약 없음'}`;
          detailContainer.appendChild(summaryP);

          // 상태 (state)
          const stateTitle = document.createElement('h4');
          stateTitle.textContent = '상태 (state)';
          detailContainer.appendChild(stateTitle);

          const stateList = document.createElement('ul');
          const liAccess = document.createElement('li');
          liAccess.textContent = `접속 상태: ${formatAccessState(event.state?.access)}`;
          stateList.appendChild(liAccess);

          const liSession = document.createElement('li');
          liSession.textContent = `세션 상태: ${formatSessionStatus(event.state?.session)}`;
          stateList.appendChild(liSession);

          const liDevice = document.createElement('li');
          liDevice.textContent = `기기 상태: ${formatDeviceStatus(event.state?.device)}`;
          stateList.appendChild(liDevice);
          detailContainer.appendChild(stateList);

          // 근거 (evidence)
          const evTitle = document.createElement('h4');
          evTitle.textContent = '근거 (evidence)';
          detailContainer.appendChild(evTitle);

          if (Array.isArray(event.evidence) && event.evidence.length > 0) {
            const evList = document.createElement('ul');
            event.evidence.forEach(ev => {
              const li = document.createElement('li');
              li.textContent = `[${ev.id}] ${ev.text}`;
              evList.appendChild(li);
            });
            detailContainer.appendChild(evList);
          } else {
            const evEmpty = document.createElement('p');
            evEmpty.textContent = '근거 없음';
            detailContainer.appendChild(evEmpty);
          }

          // 규칙 (rules)
          const ruleTitle = document.createElement('h4');
          ruleTitle.textContent = '규칙 (rules)';
          detailContainer.appendChild(ruleTitle);

          if (Array.isArray(event.rules) && event.rules.length > 0) {
            const ruleList = document.createElement('ul');
            event.rules.forEach(r => {
              const li = document.createElement('li');
              li.textContent = `[${r.id}] ${r.text}`;
              ruleList.appendChild(li);
            });
            detailContainer.appendChild(ruleList);
          } else {
            const ruleEmpty = document.createElement('p');
            ruleEmpty.textContent = '규칙 없음';
            detailContainer.appendChild(ruleEmpty);
          }

          if (Array.isArray(event.supportedActions) && event.supportedActions.length > 0) {
            const actionTitle = document.createElement('h4');
            actionTitle.textContent = '미지원 조치';
            detailContainer.appendChild(actionTitle);

            const actionNotice = document.createElement('p');
            actionNotice.textContent = '아직 지원하지 않는 조치입니다. 조치 실행 연결은 준비 중이며 요청을 보내지 않습니다.';
            detailContainer.appendChild(actionNotice);

            event.supportedActions.forEach((action) => {
              const actionButton = document.createElement('button');
              actionButton.type = 'button';
              actionButton.disabled = true;
              actionButton.textContent = `${action} 미지원`;
              actionButton.setAttribute('aria-label', `${action} 미지원`);
              detailContainer.appendChild(actionButton);
            });
          }
        }

        function renderFilteredList() {
          while (listContainer.firstChild) {
            listContainer.removeChild(listContainer.firstChild);
          }

          const filtered = events.filter(e => {
            if (currentKind !== 'all' && e.kind !== currentKind) return false;
            if (currentApp !== 'all' && e.appId !== currentApp) return false;
            if (currentAccess !== 'all' && e.state?.access !== currentAccess) return false;
            return true;
          });

          if (filtered.length === 0) {
            const emptyP = document.createElement('p');
            emptyP.textContent = '표시할 기록이 없습니다.';
            listContainer.appendChild(emptyP);
            return;
          }

          filtered.forEach(event => {
            const row = document.createElement('div');
            row.className = 'student-event-row';
            row.setAttribute('data-student-event-id', event.id);

            const infoSpan = document.createElement('span');
            const kindText = formatEventKind(event.kind);
            const appText = event.appId || '앱 없음(확인 불가)';
            const summaryText = event.summary || '요약 없음';
            infoSpan.textContent = `[${event.id}] ${event.at} · ${kindText} · 앱: ${appText} · ${summaryText} `;
            row.appendChild(infoSpan);

            const detailBtn = document.createElement('button');
            detailBtn.type = 'button';
            detailBtn.setAttribute('aria-label', `${event.id} 상세`);
            detailBtn.textContent = `${event.id} 상세`;
            detailBtn.onclick = () => showDetail(event);
            row.appendChild(detailBtn);

            listContainer.appendChild(row);
          });
        }

        selectKind.onchange = () => {
          currentKind = selectKind.value;
          renderFilteredList();
        };
        selectApp.onchange = () => {
          currentApp = selectApp.value;
          renderFilteredList();
        };
        selectAccess.onchange = () => {
          currentAccess = selectAccess.value;
          renderFilteredList();
        };

        renderFilteredList();

        return root;
      }

      // 4. 기타 fallback
      const fallbackP = document.createElement('p');
      fallbackP.textContent = '확인 불가(unknown)';
      root.appendChild(fallbackP);
      return root;
    },
    renderStatus(input = {}) {
      const { devices, sessions, notifications, diagnostics, mode } = input;
      const container = document.createElement('div');
      container.className = 'student-status';
      container.setAttribute('aria-live', 'polite');

      const appendHeading = (text) => {
        const heading = document.createElement('h3');
        heading.textContent = text;
        container.appendChild(heading);
      };

      const appendParagraph = (text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        container.appendChild(paragraph);
        return paragraph;
      };

      const errorMessage = (resource) => resource?.error?.message || '확인 불가';
      const isTimeout = (resource) => {
        const code = resource?.error?.code;
        const message = errorMessage(resource);
        return code === 'TIMEOUT' || code === 'REQUEST_TIMEOUT' || /시간 초과|timeout/i.test(message);
      };

      const appendResource = ({ resource, title, objectName, emptyText, rowText }) => {
        appendHeading(title);
        if (!resource || resource.status === 'loading') {
          appendParagraph(`${objectName} 불러오는 중입니다.`);
          return;
        }
        if (resource.status === 'error') {
          const failure = isTimeout(resource) ? `${title} 불러오기가 시간 초과되었습니다` : `${objectName} 불러오지 못했습니다`;
          appendParagraph(`${failure}: ${errorMessage(resource)}`);
          appendParagraph('다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요.');
          return;
        }
        if (resource.status !== 'ok' || !Array.isArray(resource.data)) {
          appendParagraph(`${title} 상태를 확인할 수 없습니다.`);
          return;
        }
        if (resource.data.length === 0) {
          appendParagraph(emptyText);
          return;
        }
        resource.data.forEach((item) => appendParagraph(rowText(item)));
      };

      appendResource({
        resource: devices,
        title: '기기',
        objectName: '기기를',
        emptyText: '등록된 기기가 없습니다.',
        rowText: (device) => `기기: ${device?.label || device?.id || '확인 불가'} · 상태: ${formatDeviceStatus(device?.status)}`,
      });

      appendResource({
        resource: sessions,
        title: '세션',
        objectName: '세션을',
        emptyText: '현재 연결이 없습니다.',
        rowText: (session) => `세션: ${session?.id || '확인 불가'} · 상태: ${formatSessionStatus(session?.status)}`,
      });
      appendParagraph('세션은 현재 검증된 연결 하나만 표시하며 지난 세션 목록이 아닙니다.');

      appendHeading('알림');
      if (!Array.isArray(notifications) || notifications.length === 0) {
        appendParagraph('알림 없음');
      } else {
        notifications.forEach((notification) => {
          const item = document.createElement('div');
          const resourceP = document.createElement('p');
          resourceP.textContent = `자료(resource): ${notification?.resource || '확인 불가'}`;
          item.appendChild(resourceP);
          const codeP = document.createElement('p');
          codeP.textContent = `코드(code): ${notification?.code || '확인 불가'}`;
          item.appendChild(codeP);
          const messageP = document.createElement('p');
          messageP.textContent = `메시지(message): ${notification?.message || '확인 불가'}`;
          item.appendChild(messageP);
          container.appendChild(item);
        });
      }

      appendHeading('진단 정보');
      if (!diagnostics || diagnostics.status === 'idle') {
        appendParagraph('진단 정보가 아직 불러와지지 않았습니다.');
      } else if (diagnostics.status === 'loading') {
        appendParagraph('진단 정보를 불러오는 중입니다.');
      } else if (diagnostics.status === 'error') {
        const failure = isTimeout(diagnostics) ? '진단 정보 불러오기가 시간 초과되었습니다' : '진단 정보를 불러오지 못했습니다';
        appendParagraph(`${failure}: ${errorMessage(diagnostics)}`);
        appendParagraph('다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요.');
      } else if (diagnostics.status === 'ok') {
        const data = diagnostics.data || {};
        const engine = data.engine || {};
        const safeFields = [
          ['requestId', data.requestId],
          ['component', data.component],
          ['version', data.version],
          ['checkedAt', data.checkedAt],
          ['engine.mode', engine.mode],
          ['engine.code', engine.code],
        ];
        safeFields.forEach(([name, value]) => appendParagraph(`${name}: ${value ?? '확인 불가'}`));

        const copyText = safeFields.map(([name, value]) => `${name}: ${value ?? '확인 불가'}`).join('\n');
        appendParagraph('도움 요청에 사용하기 전에 위의 진단 정보에 비밀번호·토큰·API 키가 없는지 직접 확인하세요.');
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.textContent = '도움정보 복사';
        const copyStatus = document.createElement('p');
        copyButton.addEventListener('click', async () => {
          try {
            if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
              throw new Error('clipboard unavailable');
            }
            await navigator.clipboard.writeText(copyText);
            copyStatus.textContent = '도움정보를 클립보드에 복사했습니다.';
          } catch {
            copyStatus.textContent = '도움정보를 클립보드에 복사하지 못했습니다.';
          }
        });
        container.appendChild(copyButton);
        container.appendChild(copyStatus);
      } else {
        appendParagraph('진단 정보 상태를 확인할 수 없습니다.');
      }

      if (mode) appendParagraph(`모드: ${formatMode(mode)}`);
      return container;
    },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection(input = {}) {
      const { status, mode, data, error, checkedAt } = input;
      const container = document.createElement('div');
      container.className = 'student-ai-connection';
      container.setAttribute('aria-live', 'polite');

      const appendParagraph = (text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        container.appendChild(paragraph);
      };

      const displayMode = mode || input.meta?.mode;
      const appendMode = () => {
        if (displayMode) appendParagraph(`모드: ${formatMode(displayMode)}`);
      };

      const describeError = (code) => {
        if (['ON_AI_PROVISIONING_PENDING', 'ON_AI_TRANSPORT_PENDING', 'ON_AI_AUTHORIZATION_CHANGED', 'AI_REQUEST_UNVERIFIED'].includes(code)) {
          return '권한 준비 중 또는 확인 불가입니다. 담당자에게 계정 연결과 앱 권한 확인을 요청하세요.';
        }
        if (code === 'WB_CLCO_AUTH_REQUIRED') return '인증에 실패했습니다. 계정 연결을 다시 확인하고 담당자에게 확인을 요청하세요.';
        if (code === 'WB_CLCO_ACCESS_BLOCKED') return '앱 접근이 제한되었습니다. 계정 연결과 앱 권한을 담당자에게 확인하세요.';
        if (['WB_CLCO_COHORT_BUDGET_EXHAUSTED', 'WB_CLCO_LIMIT_REACHED'].includes(code)) {
          return 'AI 사용량 또는 이용 한도에 도달했습니다. 담당자에게 확인하세요.';
        }
        if (code === 'WB_CLCO_SESSION_CLOSED') return '현재 AI 이용 시간이 아닙니다. 이용 시간을 확인하세요.';
        if (code === 'WB_CLCO_RATE_LIMITED') return 'AI 요청이 제한되었습니다. 잠시 뒤 직접 다시 점검하세요.';
        if (['WB_CLCO_TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT', 'TIMEOUT', 'WB_CLCO_NETWORK_ERROR', 'WB_CLCO_SERVER_UNAVAILABLE', 'WB_CLCO_INVALID_RESPONSE'].includes(code)) {
          return '요청 제한·시간 초과·네트워크 문제입니다. 잠시 뒤 직접 다시 점검하세요.';
        }
        if (['WB_CLCO_CANCELLED', 'CANCELLED', 'REQUEST_CANCELLED'].includes(code)) {
          return 'AI 연결 점검이 취소되었습니다. 이전 결과는 현재 결과가 아닙니다.';
        }
        if (['ON_AI_MODEL_LIST_EMPTY', 'MODEL_NOT_CONFIGURED'].includes(code)) {
          return '사용할 수 있는 AI 모델이 없습니다. 담당자에게 모델 허용 설정을 확인해 달라고 요청하세요.';
        }
        return 'AI 연결 점검 원인을 확인할 수 없습니다. 담당자에게 현재 연결 상태를 확인해 달라고 요청하세요.';
      };

      if (!status || status === 'idle') {
        appendParagraph('AI 연결 점검 전입니다. 연결 점검은 사용자가 위쪽 버튼을 직접 눌러 시작하세요.');
        appendMode();
        return container;
      }

      if (status === 'loading') {
        appendParagraph('AI 연결 점검 중입니다.');
        appendMode();
        return container;
      }

      if (status === 'error') {
        const code = typeof error?.code === 'string' && error.code ? error.code : 'AI_REQUEST_UNVERIFIED';
        const message = typeof error?.message === 'string' && error.message ? error.message : 'AI 연결 점검 결과를 확인할 수 없습니다.';
        appendParagraph(`오류 코드: ${code}`);
        appendParagraph(`오류 메시지: ${message}`);
        appendParagraph(describeError(code));
        appendParagraph('자동으로 다시 점검하지 않습니다. 다시 점검은 사용자가 위쪽의 현재 API 연결 점검 버튼을 직접 누르세요.');
        appendMode();
        return container;
      }

      if (status === 'ok') {
        let authorizationText = '앱 권한 상태 확인 불가';
        if (data?.audienceAuthorization === 'test') authorizationText = '시험 연결 점검(test)';
        if (data?.audienceAuthorization === 'verified') authorizationText = '앱 권한 확인 후 점검(verified)';
        appendParagraph(authorizationText);
        appendParagraph(`모델 수(modelCount): ${data?.modelCount ?? '확인 불가'}`);
        appendParagraph(`점검 시각(checkedAt): ${checkedAt ?? input.meta?.checkedAt ?? '확인 불가'}`);
        appendParagraph('연결만 점검했습니다. 사건 설명은 아직 실행하지 않았습니다.');
        appendMode();
        return container;
      }

      appendParagraph('AI 연결 점검 상태를 확인할 수 없습니다.');
      appendMode();
      return container;
    },
    renderExplanation(input = {}) {
      const { event, explanation } = input;
      const container = document.createElement('div');
      container.className = 'student-explanation';
      container.setAttribute('aria-live', 'polite');

      const appendParagraph = (text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        container.appendChild(paragraph);
      };

      if (!explanation || explanation.status === 'idle') {
        appendParagraph('사건 설명을 아직 요청하지 않았습니다.');
        return container;
      }

      if (explanation.status === 'loading') {
        appendParagraph('사건 설명을 불러오는 중입니다.');
        return container;
      }

      if (explanation.status === 'error') {
        const code = typeof explanation.error?.code === 'string' && explanation.error.code
          ? explanation.error.code
          : 'AI_REQUEST_UNVERIFIED';
        const message = typeof explanation.error?.message === 'string' && explanation.error.message
          ? explanation.error.message
          : '사건 설명 결과를 확인할 수 없습니다.';
        appendParagraph(`오류 코드: ${code}`);
        appendParagraph(`오류 메시지: ${message}`);
        appendParagraph('기록은 그대로 유지됩니다. 사건 설명 실패가 기록 자체의 변경이나 삭제를 뜻하지 않습니다.');
        return container;
      }

      if (explanation.status === 'ok') {
        if (event?.id) container.setAttribute('data-student-explanation-event', event.id);
        appendParagraph(`사건 ID: ${event?.id || '확인 불가'}`);
        appendParagraph(`설명 요약: ${explanation.data?.summary || '확인 불가'}`);
        return container;
      }

      appendParagraph('사건 설명 상태를 확인할 수 없습니다.');
      return container;
    },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
