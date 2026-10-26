# 네트워크 진단: 확인된 접근 오류와 미확정 원인

## 승인 후 현재 결과

사용자가 기존 요청 `manager:b8aa1c490bab437a84a0a178e0a2997d:1`에 네트워크 실행을 명시적으로 승인했다. 지원되는 `require_escalated` 경로에서 공식 npm 조회·설치와 지정 loopback HTTP 검증을 재개했다. 별도 질문·토큰·OAuth·방화벽 변경·다른 포트/미러는 사용하지 않았다. 요청 큐를 조회하는 전용 도구는 없으므로 UI 내부 상태 대신 각 실제 실행 결과로 판정했다.

- `npm view three ... --registry=https://registry.npmjs.org`: exit0, `0.186.1`, MIT. 타입은 `@types/three@0.186.0`.
- 공식 npm `install --save-exact three@0.186.1 --ignore-scripts`와 타입 설치: 모두 exit0.
- 독립 `output/clean-install`의 `npm ci --ignore-scripts --no-audit --no-fund`: exit0,181개 패키지. 현재 lock228항목·선언15개 검증 통과. [설치 기록](DEPENDENCY_INSTALL.md).
- `npm run preview -- --host 127.0.0.1 --port 4174 --strictPort`와 같은 승인 경로의 Node fetch: HTTP200. 실제 HTTP 브라우저·Three/WebGL·JSON 저장 검사도 실행했다. [QA](QA_SUMMARY.md).
- 기본 Chromium148 WebGL2 지원 확인, 보안 우회 플래그 없음. 실제 Three0.186.1 렌더·raycast·context loss 검사 통과.

이 결과는 승인된 프로세스의 성공이다. 이전 제한 프로필의 DNS/CIM/접속 제한이 시스템 전체에서 해제됐다는 뜻이 아니다. 아래는 **승인 전 진단 이력**으로 보존한다. 당시 오류를 지금도 진행 중인 npm/HTTP 장애로 보고하지 않는다.

## 승인 전 진단 이력

기록일: 2026-10-26 UTC. 결론: **localhost 접속의 접근 오류는 확인됐지만, 특정 샌드박스 규칙·Windows 방화벽 규칙·포트 바인딩 원인까지 확정하지 않았다.** 현재 증거는 단순 포트 충돌이나 서버 시작 지연만으로 설명된다는 판단도 뒷받침하지 않는다.

이 문서는 기존 도구 실행 기록과 저장된 진단을 검토한 결과다. 작성 과정에서 추가 소켓 접속, 다른 포트, DNS 재조회, CIM·대체 네트워크 API, 방화벽·비밀 설정 조회, 프로세스 종료를 실행하지 않았다. 안전한 로컬 오류 상수 조회와 공개 공식 문서 읽기만 추가했다.

## 확인된 증거

주 증거: [dependency-network-diagnosis.json](../output/qa/dependency-network-diagnosis.json), 관측 시각 `2026-10-26T16:52:33Z`. 이 JSON은 부모 실행자의 실제 명령·결과와 앞선 localhost 실행 기록을 정리한 것이다. Vite readiness와 원래 fetch stack의 별도 원문 로그·동일 시각 listener snapshot은 확보되지 않았다.

| 동작과 정확한 대상 | 관측 결과 | 확정 가능한 범위 |
| --- | --- | --- |
| Vite preview 자식 프로세스 | `Local: http://127.0.0.1:4174/` 출력 | 프로그램이 해당 주소를 안내했다. 이 줄만으로 이후의 실제 listener 수명이나 다른 프로세스의 접근 성공을 입증하지 않는다 |
| Node fetch → `127.0.0.1:4174` | `connect EACCES 127.0.0.1:4174`, errno `-4092` | 실패 위치는 클라이언트 connect이며 접근 오류다. HTTP 응답 성공·bind 성공·서버 기능 검증은 아니다 |
| 공식 npm metadata → `https://registry.npmjs.org/three` | 종료1, `ENOTFOUND`, `getaddrinfo ENOTFOUND registry.npmjs.org` | 해당 실행환경의 이름 조회 실패. Three가 없거나 잘못된 패키지라는 뜻은 아니다 |
| 공식 npm metadata → `https://registry.npmjs.org/vexflow` | 종료1, 같은 `ENOTFOUND` | VexFlow metadata·버전·호환성을 원격 확인하지 못함. 설치는 하지 않았다 |
| `Resolve-DnsName -Name registry.npmjs.org -Type A -DnsOnly` | 종료1, `액세스가 거부되었습니다.` | 이 DNS 진단 동작은 명시적으로 거부됐다. DNS 서버의 NXDOMAIN 응답이나 인터넷 전체 장애로 단정하지 않는다 |
| `Get-NetTCPConnection -State Listen -LocalPort 4173,4174` | 종료1, `클라이언트에서 CIM 리소스에 대한 액세스를 사용할 수 없습니다.` | listener 목록을 조회하지 못했다. 포트가 열림·닫힘·사용 중·비어 있음 중 어느 상태도 이 결과만으로 확인되지 않는다 |

추가로 Node24.14.0의 `node:util`에서 `getSystemErrorName(-4092)`를 읽기만 하는 코드로 확인했으며 결과는 `EACCES`였다. 이 조회는 네트워크 접근이나 정책 변경을 하지 않는다. 숫자는 플랫폼·정규화 계층에 따라 달라질 수 있으므로 Winsock 원시 오류 번호와 동일하다고 취급하지 않는다.

## 포트 바인딩 문제와의 구별

Node 공식 문서는 `EADDRINUSE`를 로컬 주소의 bind 충돌, `ECONNREFUSED`를 대상의 접속 거절, `ENOTFOUND`를 DNS 조회 실패로 구분한다. 이번 localhost 기록에는 `EADDRINUSE`나 `ECONNREFUSED`가 없고 **connect의 `EACCES`가 있다**. 따라서 현재 기록을 “포트가 이미 사용 중이어서 생긴 일반적인 bind 충돌” 또는 “서버가 아직 켜지지 않아서 발생한 접속 거절”로 바꾸어 보고하면 안 된다. 반대로 이 둘의 부재만으로 서버 바인딩·시작 시각이 완전히 정상이라고 증명한 것도 아니다. [실행 버전의 Node 오류 정의](https://nodejs.org/download/release/v24.14.0/docs/api/errors.html#common-system-errors)

Microsoft의 소켓 오류 정의에서 접근 거부는 허용되지 않은 소켓 사용을 뜻하며 오류명 자체가 특정 방화벽 제품·규칙·샌드박스 구현을 식별해 주지는 않는다. 이번 실행환경은 개발자 지침에서 네트워크 제한을 명시하고 있어 제한된 실행 프로필과 **일치하는 증상**이지만, 정확한 집행 지점이 샌드박스인지 OS 방화벽·보안 구성인지 판단할 증거는 없다. 관련 설정·정책이나 보안 로그를 읽지 않았다. [Windows 소켓 오류 정의](https://learn.microsoft.com/en-us/windows/win32/winsock/windows-sockets-error-codes-2)

## 중지한 동작과 독립적으로 확인된 범위

- localhost connect, DNS 진단, CIM listener 조회의 거부를 다른 포트·브라우저·대체 API로 우회하지 않았다. mirror·직접 IP·proxy·인증 키·권한 확대도 사용하지 않았다.
- 자동 승인 심사가 거부한 사례는 아니다. 명령이 반환한 접근 오류와 실행환경 제한을 기록한 것이다.
- `scripts/e2e.ts`와 `scripts/failure-e2e.ts`의 현재 브라우저 검수 대상은 `file:` HTML이다. 실패 경로 스크립트는 HTTP(S) 요청을 전송 전에 차단한다. 이 파일 화면 검수·정적 빌드·단위/통합 테스트 성공은 일반 웹 서버 접속 성공의 증거가 아니다.
- Library 전송의 일반적인 `download failed`와 headless 파일 다운로드의 `canceled`는 별도로 기록했다. 그것들이 이 DNS 또는 localhost 접근 오류와 반드시 같은 원인이라고 단정하지 않는다.

## 재개에 필요한 최소 실행 범위

다음은 지원되는 실행환경을 고를 때 필요한 범위이며, 현재 환경을 자동으로 변경하라는 명령이나 이미 부여된 허가가 아니다.

1. **공개 npm 조회·설치:** 해당 Node/npm 프로세스에서 `registry.npmjs.org` 이름 조회와 HTTPS443의 공식 metadata·패키지 경로 접근이 허용된 소비 실행 프로필. metadata가 별도 호스트를 반환한다면 실제 대상부터 확인한다. 임의 mirror나 직접 IP로 바꾸지 않는다.
2. **로컬 웹 검수:** 같은 작업환경의 Node 서버와 브라우저 검수 도구가 명시적으로 선택한 loopback 포트에 listen·connect할 수 있어야 한다. 현재 계획은 `127.0.0.1:4174`, 기본 preview를 쓸 때만4173이다. 전체 인터페이스 공개나 모든 포트 개방은 필요하지 않다. 이 문서를 이유로 다른 포트를 시험하지 않는다.
3. **허용 방식:** 위 범위를 지원하는 네트워크 허용 실행환경을 제공하거나 사용자가 해당 범위 변경을 별도로 명시적으로 허용한 뒤 지원되는 경로로 적용한다. OAuth·새 계정·토큰·유료 서비스·공개 배포·광범위한 관리자 권한이나 방화벽 해제는 요구하지 않는다.

허용된 환경이 실제로 준비되면 공식 metadata 확인→정확 버전·호환성·라이선스 검증→설치/lockfile→기존 테스트/빌드→같은 loopback 주소의 HTTP 검수 순으로 진행한다. 이 전제 전에는 서버 E2E와 Three/VexFlow 설치를 통과·완료로 표시하지 않는다.
