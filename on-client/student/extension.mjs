// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
function formatMode(mode) {
  if (mode === 'demo') return '예제 자료';
  if (mode === 'disconnected') return '연결 없음';
  if (mode === 'unknown') return '확인 불가';
  if (mode === 'connected') return '연결됨';
  return mode ? `확인 불가 (${mode})` : '확인 불가';
}

const SYSTEM_METRICS_SCHEMA = 'keshev.system-metrics.v1';
const SYSTEM_METRIC_LABELS = { cpu: 'CPU 사용률', memory: '메모리 사용량', disk: '디스크 남은 공간' };
const SYSTEM_METRIC_SOURCES = {
  cpu: 'Node.js os.cpus()를 250ms 간격으로 비교',
  memory: 'Node.js os.totalmem()·os.freemem()',
  disk: 'Node.js fs.statfs() · 앱 설치 드라이브',
};

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIsoDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validMetricUnavailable(metric, unit) {
  return isRecord(metric) && metric.status === 'unavailable' && metric.value === null && metric.unit === unit
    && isIsoDate(metric.measuredAt) && typeof metric.reasonCode === 'string' && typeof metric.reason === 'string';
}

function validSystemMetrics(data) {
  if (!isRecord(data) || data.schema !== SYSTEM_METRICS_SCHEMA || !isIsoDate(data.checkedAt) || data.source !== 'local-os' || !isRecord(data.metrics)) return false;
  const { cpu, memory, disk } = data.metrics;
  const validCpu = (isRecord(cpu) && cpu.status === 'measured' && typeof cpu.value === 'number' && Number.isFinite(cpu.value)
    && cpu.value >= 0 && cpu.value <= 100 && cpu.unit === '%' && isIsoDate(cpu.measuredAt) && cpu.source === 'node:os.cpus()'
    && Number.isSafeInteger(cpu.sampleMs) && cpu.sampleMs > 0) || validMetricUnavailable(cpu, '%');
  const validMemory = (isRecord(memory) && memory.status === 'measured' && Number.isSafeInteger(memory.usedBytes) && memory.usedBytes >= 0
    && Number.isSafeInteger(memory.totalBytes) && memory.totalBytes > 0 && memory.usedBytes <= memory.totalBytes
    && typeof memory.usedPercent === 'number' && Number.isFinite(memory.usedPercent) && memory.usedPercent >= 0 && memory.usedPercent <= 100
    && memory.unit === 'bytes' && isIsoDate(memory.measuredAt) && memory.source === 'node:os.totalmem/os.freemem') || validMetricUnavailable(memory, 'bytes');
  const validDisk = (isRecord(disk) && disk.status === 'measured' && Number.isSafeInteger(disk.freeBytes) && disk.freeBytes >= 0
    && Number.isSafeInteger(disk.totalBytes) && disk.totalBytes > 0 && disk.freeBytes <= disk.totalBytes
    && typeof disk.freePercent === 'number' && Number.isFinite(disk.freePercent) && disk.freePercent >= 0 && disk.freePercent <= 100
    && disk.unit === 'bytes' && isIsoDate(disk.measuredAt) && disk.source === 'node:fs.statfs' && disk.scope === '앱 설치 드라이브') || validMetricUnavailable(disk, 'bytes');
  return validCpu && validMemory && validDisk;
}

function formatGiB(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '확인 불가';
  return `${(bytes / (1024 ** 3)).toFixed(1)} GiB`;
}

function formatMetricTime(value) {
  if (!isIsoDate(value)) return '확인 불가';
  return `${new Date(value).toLocaleString('ko-KR')} (${value})`;
}

function formatSignedPercentPoints(value) {
  if (!Number.isFinite(value)) return '확인 불가';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%p`;
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

function riskLevel(notification = {}) {
  const resource = notification.resource;
  const code = notification.code;
  if (resource === 'events' && code === 'xdr') return 'high';
  if (resource === 'devices' && code === 'noncompliant') return 'high';
  if (resource === 'sessions' && ['expired', 'revoked'].includes(code)) return 'high';
  if (code === 'TIMEOUT' || code === 'REQUEST_TIMEOUT') return 'attention';
  if (code === 'unknown' || code === 'UNVERIFIED' || resource === 'events') return 'attention';
  return 'notice';
}

function riskLevelLabel(level) {
  if (level === 'high') return '높은 주의';
  if (level === 'attention') return '확인 필요';
  return '알림';
}

function riskNextStep(resource, level) {
  if (resource === 'devices') return '기기 상태와 연결 설정을 확인하세요.';
  if (resource === 'sessions') return '세션 만료·철회 여부를 확인하고 필요하면 다시 연결하세요.';
  if (resource === 'events') return '기록의 근거와 접속·세션·기기 상태를 확인하세요.';
  if (level === 'high') return '원인과 영향을 확인한 뒤 담당자에게 전달하세요.';
  return '위쪽의 다시 불러오기 버튼을 사용해 해당 자료를 직접 확인하세요.';
}

export function createStudentView({ api, onChange } = {}) {
  let systemMetrics = { status: 'loading' };
  let previousSystemMetrics = null;
  let metricsRequestId = 0;

  const rerender = () => {
    if (typeof onChange === 'function') onChange();
  };

  const loadSystemMetrics = ({ initial = false } = {}) => {
    const requestId = ++metricsRequestId;
    if (!initial && systemMetrics.status === 'ok') previousSystemMetrics = systemMetrics.data;
    systemMetrics = { status: 'loading' };
    if (!initial) rerender();
    Promise.resolve().then(() => api?.get('/api/system-metrics')).then((result) => {
      if (requestId !== metricsRequestId) return;
      if (!result?.ok || !validSystemMetrics(result.data)) {
        systemMetrics = {
          status: 'error',
          error: result?.error || { code: 'CONTRACT_MISMATCH', message: '실측 응답 형식을 확인할 수 없습니다.' },
        };
        return;
      }
      systemMetrics = { status: 'ok', data: result.data, meta: result.meta };
    }).catch(() => {
      if (requestId === metricsRequestId) systemMetrics = { status: 'error', error: { code: 'NETWORK_ERROR', message: '내 PC 상태를 읽지 못했습니다.' } };
    }).finally(() => {
      if (requestId === metricsRequestId) rerender();
    });
  };

  const renderMetricCard = (kind, metric, previous) => {
    const card = document.createElement('article');
    card.className = 'student-system-metric-card';
    card.dataset.metric = kind;
    const heading = document.createElement('h4');
    heading.textContent = SYSTEM_METRIC_LABELS[kind];
    card.appendChild(heading);

    const value = document.createElement('p');
    value.className = 'student-system-metric-value';
    if (metric.status !== 'measured') value.textContent = '확인 불가';
    else if (kind === 'cpu') value.textContent = `${metric.value.toFixed(1)}%`;
    else if (kind === 'memory') value.textContent = `${formatGiB(metric.usedBytes)} / ${formatGiB(metric.totalBytes)} 사용 (${metric.usedPercent.toFixed(1)}%)`;
    else value.textContent = `${formatGiB(metric.freeBytes)} 남음 / ${formatGiB(metric.totalBytes)} (${metric.freePercent.toFixed(1)}%)`;
    card.appendChild(value);

    const measuredAt = document.createElement('p');
    measuredAt.className = 'muted';
    measuredAt.textContent = `측정 시각: ${formatMetricTime(metric.measuredAt)}`;
    card.appendChild(measuredAt);

    const source = document.createElement('p');
    source.className = 'muted';
    source.textContent = `근거: ${SYSTEM_METRIC_SOURCES[kind]} · 일반 권한`;
    card.appendChild(source);

    if (metric.status === 'unavailable') {
      const reason = document.createElement('p');
      reason.textContent = `사유: ${metric.reason || '측정할 수 없습니다.'}`;
      card.appendChild(reason);
    } else if (previous?.status === 'measured') {
      const comparison = document.createElement('p');
      comparison.className = 'student-system-metric-comparison';
      const currentValue = kind === 'cpu' ? metric.value : kind === 'memory' ? metric.usedPercent : metric.freePercent;
      const previousValue = kind === 'cpu' ? previous.value : kind === 'memory' ? previous.usedPercent : previous.freePercent;
      comparison.textContent = `직전 실측 대비: ${formatSignedPercentPoints(currentValue - previousValue)}`;
      card.appendChild(comparison);
    } else {
      const comparison = document.createElement('p');
      comparison.className = 'muted';
      comparison.textContent = '직전 실측 없음 · 다음 측정부터 비교합니다.';
      card.appendChild(comparison);
    }
    return card;
  };

  const renderSystemMetrics = () => {
    const section = document.createElement('section');
    section.className = 'student-system-metrics';
    const heading = document.createElement('h3');
    heading.textContent = '내 PC 상태 · 실측값';
    section.appendChild(heading);
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = '이 값은 이 앱이 실행 중인 PC에서 일반 권한으로 직접 측정했습니다. 예시 값이 아니며, 각 항목의 측정 시각과 근거를 함께 표시합니다.';
    section.appendChild(note);

    if (systemMetrics.status === 'loading') {
      const loading = document.createElement('p');
      loading.textContent = 'CPU·메모리·디스크를 측정하는 중입니다.';
      section.appendChild(loading);
    } else if (systemMetrics.status === 'error') {
      const error = document.createElement('p');
      error.textContent = `실측 결과를 불러오지 못했습니다: ${systemMetrics.error?.message || '확인 불가'}`;
      section.appendChild(error);
    } else if (systemMetrics.status === 'ok') {
      const grid = document.createElement('div');
      grid.className = 'student-system-metric-grid';
      const metrics = systemMetrics.data.metrics;
      const previous = previousSystemMetrics?.metrics || {};
      for (const kind of ['cpu', 'memory', 'disk']) grid.appendChild(renderMetricCard(kind, metrics[kind], previous[kind]));
      section.appendChild(grid);
      const checkedAt = document.createElement('p');
      checkedAt.className = 'muted';
      checkedAt.textContent = `전체 측정 묶음 시각: ${formatMetricTime(systemMetrics.data.checkedAt)}`;
      section.appendChild(checkedAt);
    }

    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'btn';
    refresh.textContent = systemMetrics.status === 'loading' ? '측정 중…' : '내 PC 다시 측정';
    refresh.disabled = systemMetrics.status === 'loading';
    refresh.addEventListener('click', () => loadSystemMetrics());
    section.appendChild(refresh);
    return section;
  };

  loadSystemMetrics({ initial: true });

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

        const summary = document.createElement('div');
        summary.className = 'student-record-summary';
        summary.setAttribute('aria-label', '보안 기록 요약');
        const xdrCount = events.filter((event) => event.kind === 'xdr').length;
        const unknownCount = events.filter((event) => Object.values(event.state || {}).includes('unknown')).length;
        const deniedCount = events.filter((event) => event.state?.access === 'denied').length;
        const summaryTitle = document.createElement('h3');
        summaryTitle.textContent = '기록 보기 요약';
        summary.appendChild(summaryTitle);
        const summaryText = document.createElement('p');
        summaryText.textContent = `현재 확인된 ${events.length}건 · XDR ${xdrCount}건 · 접속 거부 ${deniedCount}건 · 확인 불가 상태 포함 ${unknownCount}건`;
        summary.appendChild(summaryText);
        const coverageText = document.createElement('p');
        coverageText.className = 'muted';
        coverageText.textContent = '이 요약은 서버가 전달한 현재 조회 범위만 계산하며 전체 과거 기록이나 전체 PC 상태를 뜻하지 않습니다.';
        summary.appendChild(coverageText);
        root.appendChild(summary);

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
      container.appendChild(renderSystemMetrics());

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

      const scopeNote = document.createElement('p');
      scopeNote.className = 'muted student-device-scope';
      scopeNote.textContent = '기기·세션 상태는 제공된 연결 범위이며, CPU·메모리·디스크 실측은 이 앱의 로컬 OS 조회 결과입니다. 방화벽 상태는 측정하지 않습니다.';
      container.appendChild(scopeNote);

      appendHeading('위험 알림');
      if (!Array.isArray(notifications) || notifications.length === 0) {
        appendParagraph('표시할 위험 알림이 없습니다(현재 조회 범위 기준).');
      } else {
        notifications.forEach((notification) => {
          const level = riskLevel(notification);
          const item = document.createElement('article');
          item.className = `student-risk-alert student-risk-alert-${level}`;
          item.setAttribute('data-risk-level', level);
          item.setAttribute('data-risk-resource', notification?.resource || 'unknown');
          const levelP = document.createElement('p');
          levelP.className = 'student-risk-alert-level';
          levelP.textContent = riskLevelLabel(level);
          item.appendChild(levelP);
          const resourceP = document.createElement('p');
          resourceP.textContent = `자료(resource): ${notification?.resource || '확인 불가'}`;
          item.appendChild(resourceP);
          const codeP = document.createElement('p');
          codeP.textContent = `코드(code): ${notification?.code || '확인 불가'}`;
          item.appendChild(codeP);
          const messageP = document.createElement('p');
          messageP.textContent = `메시지(message): ${notification?.message || '확인 불가'}`;
          item.appendChild(messageP);
          const nextStepP = document.createElement('p');
          nextStepP.className = 'student-risk-alert-next-step';
          nextStepP.textContent = `다음 확인: ${riskNextStep(notification?.resource, level)}`;
          item.appendChild(nextStepP);
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
    renderVulnerabilities(input = {}) {
      const { status, mode, data, error } = input;
      const container = document.createElement('div');
      container.className = 'student-vulnerabilities';
      container.setAttribute('aria-live', 'polite');

      const appendParagraph = (text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        container.appendChild(paragraph);
      };

      const appendFieldTo = (parent, label, value) => {
        if (value === undefined || value === null || value === '') return;
        const paragraph = document.createElement('p');
        paragraph.textContent = `${label}: ${value}`;
        parent.appendChild(paragraph);
      };

      const appendField = (label, value) => appendFieldTo(container, label, value);

      const appendMode = () => {
        if (mode) appendParagraph(`모드: ${formatMode(mode)}`);
      };

      if (!status || status === 'idle') {
        appendParagraph('취약점 조회 전입니다(idle).');
        appendMode();
        return container;
      }

      if (status === 'loading') {
        appendParagraph('취약점 정보를 조회 중입니다(loading). 이전 조회 결과를 현재 결과로 표시하지 않습니다.');
        appendMode();
        return container;
      }

      if (status === 'error') {
        const code = typeof error?.code === 'string' && error.code ? error.code : 'VULNERABILITY_LOOKUP_UNVERIFIED';
        const message = typeof error?.message === 'string' && error.message
          ? error.message
          : '패키지 조회 결과를 확인할 수 없습니다.';
        appendParagraph(`취약점 조회 실패(error): ${message}`);
        appendParagraph(`오류 코드(error.code): ${code}`);
        appendParagraph('조회 실패는 취약점 없음이 아닙니다. 이전 조회 결과를 현재 결과로 표시하지 않습니다.');
        appendMode();
        return container;
      }

      if (status !== 'ok') {
        appendParagraph('취약점 조회 상태를 확인할 수 없습니다.');
        appendMode();
        return container;
      }

      const scanStatusText = {
        complete: '모두 조회 완료(complete)',
        partial: '일부 조회 실패(partial)',
        not_checked: '아직 조회 안 함(not_checked)',
        not_configured: '조회 준비 미완료(not_configured)',
        unverifiable: 'lock 파일 확인 불가(unverifiable)',
      };
      const scanStatus = data?.status;
      appendParagraph(scanStatusText[scanStatus] || `전체 조회 상태 확인 불가(${scanStatus || 'unknown'})`);
      appendField('lockfileVersion', data?.lockfileVersion);
      appendField('lockfileHash', data?.lockfileHash);
      appendField('checkedAt', data?.checkedAt);

      const packages = Array.isArray(data?.packages) ? data.packages : [];
      if (packages.length === 0) {
        if (scanStatus === 'not_configured') {
          appendParagraph('프로젝트 설정이 없어 조회 대상 패키지가 없습니다.');
        } else if (scanStatus === 'not_checked') {
          appendParagraph('승인된 공개 패키지 조회 대상이 없어 아직 조회하지 않았습니다.');
        } else if (scanStatus === 'unverifiable') {
          appendParagraph('lock 파일을 확인할 수 없어 패키지 조회 결과를 표시할 수 없습니다.');
        } else if (scanStatus === 'partial') {
          appendParagraph('일부 조회 실패로 확인된 패키지 결과가 없습니다. 취약점 없음으로 판단하지 않습니다.');
        } else {
          appendParagraph('표시할 패키지 조회 결과가 없습니다.');
        }
        appendMode();
        return container;
      }

      const packageStatusText = (packageStatus, vulnerabilityCount) => {
        if (packageStatus === 'known_vulnerabilities') return '알려진 항목 있음(known_vulnerabilities)';
        if (packageStatus === 'none_found') return '알려진 항목 없음(none_found) — 조회 시점 기준이며 전체 안전을 보장하지 않습니다.';
        if (packageStatus === 'unverifiable' && vulnerabilityCount > 0) return '일부 확인 · 전체 조회 확인 불가(unverifiable)';
        if (packageStatus === 'unverifiable') return '조회 확인 불가(unverifiable)';
        return `패키지 조회 상태 확인 불가(${packageStatus || 'unknown'})`;
      };

      packages.forEach((packageInfo) => {
        const row = document.createElement('div');
        row.className = 'student-package-row';
        if (typeof packageInfo?.name === 'string' && packageInfo.name) {
          row.setAttribute('data-student-package-name', packageInfo.name);
        }
        if (typeof packageInfo?.version === 'string' && packageInfo.version) {
          row.setAttribute('data-student-package-version', packageInfo.version);
        }

        appendFieldTo(row, '패키지(name)', packageInfo?.name);
        appendFieldTo(row, '설치 버전(version)', packageInfo?.version);
        const vulnerabilities = Array.isArray(packageInfo?.vulnerabilities) ? packageInfo.vulnerabilities : [];
        const statusParagraph = document.createElement('p');
        statusParagraph.textContent = `조회 상태(status): ${packageStatusText(packageInfo?.status, vulnerabilities.length)}`;
        row.appendChild(statusParagraph);
        appendFieldTo(row, '출처(source)', packageInfo?.source);
        appendFieldTo(row, '패키지 조회 시각(checkedAt)', packageInfo?.checkedAt);

        const vulnerabilityTitle = document.createElement('p');
        vulnerabilityTitle.textContent = '취약점 항목';
        row.appendChild(vulnerabilityTitle);
        if (vulnerabilities.length === 0) {
          const noFinding = document.createElement('p');
          noFinding.textContent = packageInfo?.status === 'none_found'
            ? '알려진 취약점 항목 없음(none_found). 조회 시점의 알려진 항목이 없다는 뜻이며 전체 안전을 보장하지 않습니다.'
            : '취약점 항목을 확인할 수 없습니다.';
          row.appendChild(noFinding);
        } else {
          const findingList = document.createElement('ul');
          vulnerabilities.forEach((vulnerability) => {
            const item = document.createElement('li');
            item.textContent = `id: ${vulnerability?.id || '확인 불가'} · modified: ${vulnerability?.modified || '확인 불가'}`;
            findingList.appendChild(item);
          });
          row.appendChild(findingList);
        }

        container.appendChild(row);
      });

      appendMode();
      return container;
    },
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

      const appendHeading = (tagName, text) => {
        const heading = document.createElement(tagName);
        heading.textContent = text;
        container.appendChild(heading);
      };

      const hasEvent = Boolean(event && typeof event.id === 'string' && event.id.length > 0);
      const code = typeof explanation?.error?.code === 'string' && explanation.error.code
        ? explanation.error.code
        : 'AI_REQUEST_UNVERIFIED';
      const message = typeof explanation?.error?.message === 'string' && explanation.error.message
        ? explanation.error.message
        : '사건 설명 결과를 확인할 수 없습니다.';

      // 오류는 event가 없어도 먼저 표시하여 실패 원인을 잃지 않게 한다.
      if (explanation?.status === 'error') {
        appendParagraph(`AI 설명 실패: ${message}`);
        appendParagraph(`오류 코드: ${code}`);
        if (code === 'ON_AI_INVALID_INPUT') {
          appendParagraph('실패 이유: 설명에 필요한 사건 또는 근거 자료가 부족합니다.');
        } else if (code === 'ON_AI_INVALID_OUTPUT') {
          appendParagraph('실패 이유: 근거 ID가 현재 기록과 일치하지 않거나 AI 응답을 검증할 수 없습니다.');
        } else {
          appendParagraph('실패 이유: AI 설명 요청 또는 응답 검증에 실패했습니다.');
        }
        appendParagraph('기록은 그대로 유지됩니다. 사건 설명 실패가 기록 자체의 변경이나 삭제를 뜻하지 않습니다.');
        return container;
      }

      if (!hasEvent) {
        appendParagraph('보안 기록에서 기록을 먼저 선택하세요.');
        return container;
      }

      if (!explanation || explanation.status === 'idle') {
        appendParagraph('사건 설명을 아직 요청하지 않았습니다.');
        return container;
      }

      if (explanation.status === 'loading') {
        appendParagraph('설명 요청 중입니다.');
        return container;
      }

      if (explanation.status !== 'ok') {
        appendParagraph('사건 설명 상태를 확인할 수 없습니다.');
        return container;
      }

      const data = explanation.data;
      const evidenceRows = Array.isArray(event.evidence) ? event.evidence : [];
      const evidenceById = new Map(evidenceRows.map((row) => [row?.id, row]));
      const evidenceIds = data?.evidenceIds;
      const proposals = data?.proposals;
      const topEvidenceValid = Array.isArray(evidenceIds)
        && evidenceRows.length > 0
        && evidenceIds.length === evidenceRows.length
        && new Set(evidenceIds).size === evidenceIds.length
        && evidenceIds.every((id) => typeof id === 'string' && evidenceById.has(id));
      const proposalEvidenceValid = Array.isArray(proposals)
        && proposals.every((proposal) => Array.isArray(proposal?.evidenceIds)
          && proposal.evidenceIds.length > 0
          && new Set(proposal.evidenceIds).size === proposal.evidenceIds.length
          && proposal.evidenceIds.every((id) => typeof id === 'string' && evidenceById.has(id)));
      const outputContractValid = typeof data?.summary === 'string'
        && data.summary.length > 0
        && Array.isArray(proposals)
        && data.requiresHumanConfirmation === true
        && data.executed === false;

      // 제공 코드가 검증한 응답이라도 학생 함수에 직접 전달될 수 있으므로 다시 대조한다.
      if (!topEvidenceValid || !proposalEvidenceValid || !outputContractValid) {
        appendParagraph('AI 설명 확인 불가: 현재 기록과 설명의 근거가 일치하지 않습니다.');
        if (Array.isArray(evidenceIds)) {
          const missingIds = evidenceRows
            .map((row) => row?.id)
            .filter((id) => id && !evidenceIds.includes(id));
          const unknownIds = evidenceIds.filter((id) => !evidenceById.has(id));
          if (missingIds.length > 0) appendParagraph(`누락된 근거 ID: ${missingIds.join(', ')}`);
          if (unknownIds.length > 0) appendParagraph(`현재 기록에 없는 근거 ID: ${unknownIds.join(', ')}`);
        }
        if (data?.executed === true) {
          appendParagraph('AI가 이미 실행했다고 답한 설명은 사용할 수 없습니다. 실제 조치는 실행하지 않습니다.');
        } else if (data?.requiresHumanConfirmation !== true) {
          appendParagraph('사람 확인 필요 조건을 검증할 수 없어 설명을 표시하지 않습니다.');
        } else {
          appendParagraph('근거가 맞지 않아 내용을 지어내지 않고 설명을 표시하지 않습니다.');
        }
        return container;
      }

      // 성공한 설명에만 성공 속성을 부착한다. 매 호출마다 새 요소이므로 이전 속성은 남지 않는다.
      container.setAttribute('data-student-explanation-event', event.id);
      appendHeading('h4', 'AI 설명 (참고용)');
      appendParagraph(`사건 ID: ${event.id}`);
      appendParagraph(data.summary);

      appendHeading('h5', '인용한 근거 ID와 근거 글');
      const evidenceList = document.createElement('ul');
      evidenceIds.forEach((id) => {
        const item = document.createElement('li');
        item.textContent = `${id} — ${evidenceById.get(id).text}`;
        evidenceList.appendChild(item);
      });
      container.appendChild(evidenceList);

      appendHeading('h5', '현재 규칙');
      if (Array.isArray(event.rules) && event.rules.length > 0) {
        const rulesList = document.createElement('ul');
        event.rules.forEach((rule) => {
          const item = document.createElement('li');
          item.textContent = `${rule?.id || '확인 불가'} — ${rule?.text || '규칙 글 확인 불가'}`;
          rulesList.appendChild(item);
        });
        container.appendChild(rulesList);
      } else {
        appendParagraph('규칙 없음');
      }

      appendHeading('h5', '확인되지 않은 현재 상태');
      const stateLabels = [
        ['access', '접속'],
        ['session', '세션'],
        ['device', '기기'],
      ];
      const unknownStates = stateLabels.filter(([key]) => event.state?.[key] === 'unknown');
      if (unknownStates.length === 0) {
        appendParagraph('없음');
      } else {
        const stateList = document.createElement('ul');
        unknownStates.forEach(([, label]) => {
          const item = document.createElement('li');
          item.textContent = `${label}: 확인 불가(unknown)`;
          stateList.appendChild(item);
        });
        container.appendChild(stateList);
      }

      appendHeading('h5', '조치 제안');
      if (proposals.length === 0) {
        if (Array.isArray(event.supportedActions) && event.supportedActions.length === 0) {
          appendParagraph('연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).');
        } else {
          appendParagraph('AI가 이 기록에 맞는 조치를 제안하지 않았습니다.');
        }
        appendParagraph('AI는 아무것도 실행하지 않았습니다.');
      } else {
        const proposalList = document.createElement('ul');
        proposals.forEach((proposal) => {
          const item = document.createElement('li');
          item.textContent = `${proposal.action} — ${proposal.reason} (근거: ${proposal.evidenceIds.join(', ')})`;
          proposalList.appendChild(item);
        });
        container.appendChild(proposalList);
        appendParagraph('사람 확인이 필요하며 실행되지 않았습니다. 설명·제안만으로 보안 조치는 실행되지 않습니다.');
      }

      return container;
    },
    renderAction(input = {}) {
      const {
        status = 'idle',
        event,
        actionId,
        target,
        receipt,
        observation,
        message,
        confirmationExpiresAt,
        error,
      } = input;
      const container = document.createElement('div');
      container.className = 'student-action';
      container.setAttribute('aria-live', 'polite');

      const appendParagraph = (text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        container.appendChild(paragraph);
      };

      const hasValue = (value) => value !== undefined && value !== null && value !== '';
      const safeText = (value) => typeof value === 'string' && value ? value : null;
      const appendField = (label, value) => {
        if (hasValue(value)) appendParagraph(`${label}: ${value}`);
      };

      // 새 입력마다 새 루트를 만들어 이전 대상·요청·결과를 보관하지 않는다.
      if (safeText(event?.id)) {
        container.setAttribute('data-student-action-event', event.id);
        appendField('사건 ID(event.id)', event.id);
      }
      if (safeText(receipt?.requestId)) {
        container.setAttribute('data-student-action-request', receipt.requestId);
        appendField('요청 ID(receipt.requestId)', receipt.requestId);
      }
      if (Array.isArray(event?.evidence)) {
        const evidenceIds = event.evidence
          .map((evidence) => evidence?.id)
          .filter((id) => safeText(id));
        if (evidenceIds.length > 0) appendParagraph(`근거 ID(event.evidence.id): ${evidenceIds.join(', ')}`);
      }
      appendField('조치 ID(actionId)', actionId);
      appendField('실제 대상 ID(target.id)', target?.id);
      appendField('대상 세대(target.generation)', target?.generation);
      appendField('접수 ID(receipt.receiptId)', receipt?.receiptId);
      appendField('버전(receipt.version)', receipt?.version);

      const statusLabels = {
        idle: '아직 미실행(idle)',
        loading: '조치 준비 또는 결과 조회 중(loading)',
        prepared: '준비됨·미실행(prepared)',
        executing: '서버에 전달 중(executing)',
        pending: '서버 접수·처리 중(pending)',
        denied: '거절(denied)',
        failed: '실패(failed)',
        unknown: '결과 불명(unknown)',
        expired: '확인 기한 지남(expired)',
        error: '요청이 처리되지 않았습니다(error)',
      };

      const effectConfirmed = status === 'succeeded'
        && observation?.effectApplied === true
        && safeText(observation?.observedAt)
        && safeText(receipt?.receiptId);

      if (status === 'succeeded' && !effectConfirmed) {
        appendParagraph('결과 불명(unknown): succeeded 상태만으로 효과를 확인할 수 없습니다.');
        appendParagraph('observation.effectApplied가 true이고 관측 시각·receiptId가 확인될 때만 효과로 판단합니다.');
        appendParagraph('효과 없음이나 성공으로 단정하지 말고 제공 화면의 결과 재조회 기능을 사용하세요.');
      } else if (effectConfirmed) {
        appendParagraph('효과 확인(succeeded)');
        appendField('관측 시각(observation.observedAt)', observation.observedAt);
        appendParagraph('effectApplied: true');
        appendField('접수 ID(receipt.receiptId)', receipt.receiptId);
      } else if (status === 'idle') {
        appendParagraph(statusLabels.idle);
        appendParagraph('조치 제안은 참고 정보이며 아직 실행되지 않았습니다. 조치 준비와 사람 확인은 제공 화면에서 처리합니다.');
        if (Array.isArray(event?.supportedActions) && event.supportedActions.length === 0) {
          appendParagraph('현재 기록에 연동 시스템이 지원하는 조치가 없어 조치 준비 버튼이 나오지 않는 것이 정상입니다.');
        } else {
          appendParagraph('연동 시스템이 지원하는 조치가 있을 때만 제공 화면에 조치 준비가 표시됩니다.');
        }
      } else if (status === 'loading') {
        appendParagraph(`${statusLabels.loading}. 결과가 아직 확인되지 않았습니다.`);
      } else if (status === 'prepared') {
        appendParagraph(statusLabels.prepared);
        appendField('사람 확인 기한(confirmationExpiresAt)', confirmationExpiresAt || '확인 불가');
        appendParagraph('사람 확인 후 제공 화면에서만 서버 전달을 진행합니다. 학생 화면에는 조치 버튼을 만들지 않습니다.');
      } else if (status === 'executing') {
        appendParagraph(`${statusLabels.executing}. 결과가 아직 확인되지 않았습니다. 완료나 성공으로 판단하지 않습니다.`);
      } else if (status === 'pending') {
        appendParagraph(`${statusLabels.pending}. 서버가 받았다는 ACK는 효과가 아닙니다. 결과가 아직 확인되지 않았습니다.`);
      } else if (status === 'unknown') {
        appendParagraph(`${statusLabels.unknown}. 효과 없음으로도 성공으로도 판단하지 않습니다.`);
        appendParagraph('제공 화면의 결과 재조회 기능으로 결과만 다시 확인하세요.');
      } else if (status === 'denied' || status === 'failed') {
        appendParagraph(statusLabels[status]);
        const resultMessage = safeText(message) || safeText(error?.message);
        if (resultMessage) appendParagraph(`메시지: ${resultMessage}`);
      } else if (status === 'expired') {
        appendParagraph(`${statusLabels.expired}. 다시 준비하세요.`);
        const expiryMessage = safeText(message) || safeText(error?.message);
        if (expiryMessage) appendParagraph(`메시지: ${expiryMessage}`);
      } else if (status === 'error') {
        const errorCode = safeText(error?.code) || 'ACTION_RESULT_UNVERIFIED';
        const errorMessage = safeText(error?.message) || safeText(message) || '요청 처리 결과를 확인할 수 없습니다.';
        appendParagraph(statusLabels.error);
        appendParagraph(`오류 코드(error.code): ${errorCode}`);
        appendParagraph(`오류 메시지(error.message): ${errorMessage}`);
      } else {
        appendParagraph('조치 상태를 확인할 수 없습니다. 결과를 성공이나 효과 없음으로 판단하지 마세요.');
      }

      return container;
    },
  };
}
