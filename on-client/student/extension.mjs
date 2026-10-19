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
  const code = decision || 'unknown';
  if (decision === 'allow') {
    return {
      text: `접근 허용(${code})`,
      isAllow: true,
      note: '서버가 이 앱 접속을 허용했습니다.'
    };
  }
  if (decision === 'deny') {
    return {
      text: `접근 거부(${code})`,
      isAllow: false,
      note: '서버가 이 앱 접속을 거부(차단)했습니다.'
    };
  }
  if (decision === 'challenge') {
    return {
      text: `추가 확인 필요(${code})`,
      isAllow: false,
      note: '추가 인증 또는 확인이 필요합니다. 앱이 확인 절차를 대신하지 않습니다.'
    };
  }
  return {
    text: `확인 불가(${code})`,
    isAllow: false,
    note: '판정을 확인할 수 없습니다 (접근 허용되지 않음).'
  };
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
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
