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
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
