# Music_Rudiment_3D v2.1 진행 기록

최초 기록일: 2026-10-27 UTC. 최신 체크포인트: 2026-10-28 1차 후보 검증. 실행 환경: Windows PC, Node v24.18.0, npm 11.16.0. 기준 계약: [IMPLEMENTATION_CONTRACT_V2.md](IMPLEMENTATION_CONTRACT_V2.md).

현재 **G1-A/B와 V09·V10 기술 계약 통과**, V11·V12의 첫 두 펼침면 보강 검증 중이다. 스크롤 인쇄와 입력 영역/모서리 충돌 수정 후 **13:46 UTC 고정 소스257/257·lint·build·typecheck**,78파일 검사 전후 일치를 확인했다. 실제 인쇄·왕복·JSON 초안 유지와 입력 클릭 우선권 증거는 [V11 기록](qa/V11_SURFACES.md)에 구분한다. 수정한 모서리의 직접 드래그 요청은 실행 도구가 거부해 통과로 기록하지 않는다. 모바일/접근성 전수·스트레스 검수와 실제 파일 내려받기 전달 확인도 남는다. 최신 사용자 지시는 [첫 두 펼침면 QA 후 먼저 배포](qa/FIRST_RELEASE_SCOPE.md)하고 운영 확인 뒤 나머지 네 펼침면을 진행하는 순서다. 과거 전체 완료 후 공개 조건은 이 범위에서 대체된다. G1-C·주관적 수용·물리 touch·실제 청취·실제 보조기술/교육자 검수는 여전히 미완료이며 commit/push/새 배포는 아직 실행하지 않았다.

## 시작 상태와 증거 범위

- 저장소 `main`, HEAD `4dd62db8dc46ca6468bffeeb586c1d295a38a793`. V00 쓰기 전 porcelain 상태와 diff는 비어 있었다. 감사 기준과 차이가 없다.
- 이전 클라우드 미커밋 56파일 작업과 `book-experience-v2.1` 브랜치의 전송 가능한 사본은 현재 확보되지 않았다. 제한된 로컬 탐색에서도 동일 작업을 발견하지 못했다. 기존 파일을 덮어쓰지 않은 새 checkout이다.
- 최신 두 v2.1 문서는 승인된 Google Drive 원본 전달 경로로 확보했다. 로컬 경로·bytes·SHA는 구현 계약에 기록했다. Library helper Windows 오류는 역사적 실패이며 새 Drive 원본을 Library materialization 결과라고 주장하지 않는다.
- 기존 코드와 과거 QA 자료는 보존한다. 과거 200 테스트 또는 CPU mock 29개의 통과 기록을 새 작업의 결과로 승계하지 않는다.

## 이번 Windows baseline

직접 보존된 실행 요약: `../../evidence/baseline/summary.json`. 아래 로그도 같은 디렉터리다. 상세 준비 기록: `../../PREPARATION_STATUS_V2.1.md`. 이는 로컬 작업공간 증거이며 원격 저장소에 포함되었다는 뜻이 아니다.

| 명령 | 이번 실제 결과 | 증거 |
|---|---|---|
| `npm.cmd ci --ignore-scripts --no-audit --no-fund` | 최초 sandbox DNS 실패 후 승인된 네트워크 재시도 성공, 181 packages | `install.log`, `summary.json` |
| `npm.cmd run typecheck` | exit 0 | `typecheck.log` |
| `npm.cmd run lint` | exit 0 | `lint.log` |
| `npm.cmd run content:validate` | exit 0, 6 scenes / 9 lanes | `content-validate.log` |
| `npm.cmd test` | exit 0, **96 passed / 0 failed / 0 skipped** | `test.log` |
| `npm.cmd run build` | exit 0, 147 modules | `build.log` |
| `npm.cmd run test:e2e` | 미실행: 기존 `output/preview.html`와 구형 UI에 묶인 script, v2.1 검증 아님 | V01에서 expectation 교체 범위 감사 |

package/lock 변경 없음. 최초 설치 실패의 EPERM cleanup 경고 후 재시도는 성공했다. npm 자체는 업그레이드하지 않았다. 기존 VexFlow/Three minified chunk의 500kB 초과 경고가 있으며 V15 분석 대상으로 남긴다. 이 baseline은 **기존 앱** 결과이고 신규 책 구현 검증이 아니다.

## 실제 브라우저 환경 확인

부모 작업은 `http://127.0.0.1:4173/`를 실제 Edge extension 브라우저에서 열었다. 구형 2D 화면에서 기존 3D 조작을 선택한 뒤 실제 음가 블록 screenshot과 다음 DOM 계측을 관찰했다: canvas 1개, 1006×230, DPR=1, `renderer=three-webgl`, `engine=three.js r186`, `threeRevision=186`, `threeReady=true`, `renderCount=2`, `geometryCount=3`, `eventCount=1`. 해당 확인의 browser error/warning 로그는 비어 있었다. 브라우저 전체 버전과 별도 영상 파일은 아직 기록되지 않았다.

이는 이 PC/Edge에서 기존 Three WebGL 실행이 가능하다는 환경 증거다. 책 렌더, 모서리 drag, 실제 Web Audio 실행·시간·정지, 실제 청취, 휴대전화 터치, 원본 체감 비교 또는 G1 통과 증거가 아니다. 이 환경 확인에서 재생을 시작하지 않았다. 확인에 사용한 dev server는 종료되었다.

## 단계 상태

공통 수용 조건 `CI01–03`, `BO01`, `EN01–02`, `AX21`은 구현 계약의 단계 매핑에 따라 증거를 누적한다. 아래의 문서 완료는 제품 동작 완료와 구별한다.

| 단계 | 상태 | 산출물/판정 | 다음 조건 |
|---|---|---|---|
| V00 | 완료 — 문서 계약 | `IMPLEMENTATION_CONTRACT_V2.md`, 이 기록 | V01 코드/문서 감사 |
| V01 | 완료 — 코드/재사용 감사 | source 감사·reuse/trace·baseline 완료; v1 원문 대조는 별도 미실행 제한 | V02 관측/시각 명세 |
| V02 | 완료 — 잠정 시각 명세 | `BOOK_VISUAL_SPEC.md`, `reference/MOTION_REFERENCE.md`; 원본 열린 책/Previous 관측, 연속 비교 미검증 | V03 순수 상태 검증; 실제 제품 수용은 후속 단계 |
| V03 | 완료 — 순수 상태/manifest | `controller.ts`, `manifest.ts`; 새 controller 테스트 21개 통과 보고 | 실제 렌더 통합은 V04 이후 별도 검증 |
| V04 | 초기 G1 범위 구현·검증 완료 | 표지/intro/skip·중앙·반응형·close 증거를 G1에 연결 | 후속 실제 기기 검증은 별도 |
| V05 | 초기 G1 곡면·직접 조작 검증 완료 | 실제25/50/75·hold·reverse·cancel/commit·print 정합과330프레임 전체 흐름 | V11 세부 인쇄 품질 개선 |
| V06 | 초기 G1 lifecycle 검증 완료 | 한 owner·cleanup·context fallback/retry·visibility barrier 기술 경로 | native hide 및 전체 RC 스트레스 별도 |
| V07 | 초기 G1 두 음악 장면 검증 완료 | 실제 두 레인·분할/병합/이력·동일 IDs 재방문·Web Audio start/time/stop | 실제 청취/교육자 검수 별도 |
| V08 | 초기 G1 입력·대체 경로 검증 완료 | keyboard·2D/200%·reduced·pointer 예외·단일 연속 영상; G1 고정 코드174/174 | 물리 touch·실제 보조기술 별도 |
| G1-A/B | **통과 — 첫 두 펼침면·명시 브라우저 범위** | [게이트 판정](qa/BOOK_EXPERIENCE_GATE.md),330프레임 전체 흐름·ready 이후 frame·무결성 확인 | 이미 허용된 V09 진행; 전체 제품 완료와 구분 |
| G1-C | 미검증 | 원본 열린 책·Previous 일부 관측; 일치 입력의 연속 영상/체감 비교 없음 | 동일 시퀀스 관측과 비교 증거 |
| V09 | **기술 계약 통과 — 명시 환경** | [V09 검증표](qa/V09_TRANSPORT.md),210/210+정적검사, 실제 buffer offset·stop·race/복구 증거 | 실제 청취/다른 환경/native interruption 검수는 별도 |
| V10 | **기술 계약 통과 — 명시 환경** | [저장 검증표](qa/V10_PROGRESS.md),251/251+정적검사·실제 저장/복원/가져오기/삭제·원문 보호 | 실제 파일 내려받기 전달 결과는 불확실. literal2→3→2는 V13 |
| V11 | 진행 — 첫 두 펼침면 보강 | 오류/재시도·revision·스크롤/JSON 인쇄·실제 왕복 확인;257개 소스 검사 | 새 모서리 직접 드래그 요청 거부 상태. 후속 회귀 완료 필요 |
| V12 | 일부 검증 | 입력 클릭/화살표와 hidden page 의미 검사 | 모바일/확대/터치 및 접근성 전수 대기 |
| V13 | 대기 — 1차 운영 확인 및 V09–V12 필수 계약 후 | 펼침면 3–6 | 음악 회귀와 책 계약 |
| V14 | 대기 | 교사·힌트·목차 | 책 안 보조 UI |
| V15 | 대기 | 성능/메모리/복구 | 실제 전이 측정·50회 왕복 |
| V16 | 대기 | 원본 비교/시각 정리 | 미관측을 근거 없이 통과 금지 |
| V17/G2 | 대기 | 종합 QA/음악·청취 검수 | 차단 결함 해결·제한 분리 |
| V18 | 대기 | 인수 문서 | 재현 가능한 실행/검증 |
| commit/push/CI/Vercel | 대기 — 첫 두 펼침면 필수 QA 완료 후 1차 배포 | 아직 실행하지 않음; 운영 확인 뒤 펼침면3–6 진행 | 정상 commit/push·정확한 원격 SHA·CI·READY·실제 운영 흐름 |

## V00 기록

- 확인한 범위: 최신 v2.1 고정 계약, 첫 두 펼침면, 보존 지도 원칙, 단계 의존성과 실제 증거 규칙, 기존 clean baseline 및 현재 scripts/lock.
- 변경 경로: `docs/IMPLEMENTATION_CONTRACT_V2.md`, `docs/BUILD_STATUS_V2.md`만. 소스·의존성·기존 QA·v1 자료 변경 없음.
- 확인 방법: 원본 SHA-256 대조, 현재 HEAD/status, 보존된 baseline summary/log 검토, Markdown readback/diff 확인. 문서 변경에 새로운 runtime 테스트를 만들지 않는다.
- 새 구현 테스트/브라우저 결과: 없음. V00은 실행 제품을 만들지 않는다.
- 검증되지 않은 항목: 공통 CI/BO/EN/AX 제품 테스트 전부, 실제 책 G1, Web Audio 기술 경로, 청취, 휴대전화 터치, 보조기술, 교육자 검수, 원본 실동작 비교.
- 알려진 한계: v1 원본 설계서/프롬프트가 checkout에 없다. 기존 provenance와 v2의 회고는 원문 직접 열람의 대체 증거가 아니다. 표지 원본은 확보됐으나 texture의 완전 렌더/실제 적용 여부는 V02/V04에서 따로 기록한다.
- 환경 중단 이력: 앞선 읽기 중 Windows 실행 환경이 끊겼다. 재연결 후 clean baseline과 V00 파일 부재를 확인한 뒤 다시 시작했다. 중단된 쓰기가 완료됐다고 간주하지 않았다.
- V00 완료 당시 다음 단계는 V01이었다. V01 기록은 아래에 따로 누적한다. 별도 선택적 디자인 승인 대기 없음.

## V01 기록

- 변경 경로: `docs/REUSE_MAP.md`, `docs/REQUIREMENTS_TRACE_V2.md`를 추가하고 이 진행 기록을 갱신했다. 음악 소스·의존성·기존 test와 QA는 변경하지 않았다.
- 확인한 범위: App의 기본 2D/즉시 navigate/외부 nav·question·sticky footer, 정확한 domain/validation/lesson 명령, VexFlow와 400px 최소폭, AudioEngine의 실제 stop/token 및 pause 부재, Three의 lazy/demand/DPR/context loss/cleanup, strict persistence schema와 import 보호, 구형 E2E expectations.
- 실제 근거: baseline `4dd62db8dc46ca6468bffeeb586c1d295a38a793`의 파일·줄을 REUSE_MAP과 REQUIREMENTS_TRACE에 연결했다. 6개 test 파일 선언은 25+18+25+12+6+10=96이며, 실제 96/96 결과는 위 Windows baseline 로그에서 확인했다. 선언 집계 자체를 실행 결과로 쓰지 않았다.
- 별도 재실행: 없음. source 변경 없는 문서 감사이므로 이미 통과한 baseline을 중복 실행하지 않았다. 기존 UI E2E는 계속 미실행이며 v2.1에 필요한 기대값 교체를 기록했다.
- 미실행 이유: v1 원본 설계서/프롬프트가 checkout에 없어 지정 절의 직접 대조를 하지 못했다. v2.1의 회고와 현재 source 관측을 구별했다. 이 항목은 실패·승인 거부가 아니라 원문 검증 미실행이다.
- 발견한 위험: 기존 playhead `depthTest:false`, 한 active lane 표시, 완료로 잠긴 next 버튼, 유휴 32ms interval, strict v1 envelope, 고정 400px 기보 폭을 책에 그대로 붙이면 요구를 깨뜨린다. 반대로 기존 cleanup·오디오 stop·원문 보호는 보존해야 한다.
- 현재 상태: V01 코드 감사/문서/기준검사 완료. v1 원문 직접 대조는 자료 미확보로 별도 미실행이며 부모 작업의 판단에 따라 V02 진행을 막지 않는다. 다음 단계는 V02 원본 관측과 잠정 책 시각 명세다. 제품 구현/G1/청취/터치 완료와 구별한다.
- 부모 작업은 V00/V01 이후 로컬 작업 브랜치 `book-experience-v2.1`을 생성했다. baseline HEAD는 그대로이며 commit/push는 실행하지 않았다. 위 `main` 기록은 checkout 시작 시점의 상태다.

## V02와 G1 준비 기록

- 부모 작업의 `BOOK_VISUAL_SPEC.md`, `reference/MOTION_REFERENCE.md`를 확인했다. 제공 AI 원본은 PDF1.5/A4 1페이지이며, 완전 decode·픽셀 검수한 새 변환 PNG는 1273×1800이다. 중단됐던 불완전 PNG를 실제 자산 증거로 사용하지 않는다.
- 원본 Every Joule는 연결된 Windows Edge에서 실제 열린 책·책등·종이·페이지 인쇄·올라온 선화 도형이 관측됐다. Previous 조작으로 Lesson1에서 Contents로 이동했고 중간 별도 캡처에서 도형이 낮아진 모습을 보았다. 최초 Lesson1 상태의 원인은 확인하지 않았다.
- 위 원본 관측은 연속 영상·시간 실측·직접 drag/hold/reverse/cancel·청취·휴대전화 터치 검증이 아니다. 원본의 정적 번들 확인값, 새 제안 토큰과 실제 관측을 구별했고 G1-C는 계속 미검증이다.
- V02 잠정 명세는 앞표지 비율, book-local 구성, 동일 quaternion의 camera 연결, 양면 곡면 leaf, 같은 revision의 semantic/texture, 한 renderer와 제안 모션 토큰을 정했다. V02 작성 당시에는 실제 제품 V04–V08 수용 결과가 없었으며, 이후 V04의 제한된 관측은 아래 실행 기록에 추가했다.
- `qa/BOOK_EXPERIENCE_GATE.md`에 첫 두 펼침면의 대표 연속 시퀀스와 CI/BO/EN/AX·pointer/audio·원본 대조 증거 표를 준비했다. 모든 제품 행은 미실행이며 G1-A/B 미통과로 후속 확장을 차단한다. V03 source/test 결과는 이 문서 준비만으로 갱신하지 않았다.

## V03–V05 이전 실행 기록 (2026-10-27 당시)

- V03: `src/book/controller.ts`, `manifest.ts`의 순수 전이/guard/소유권 계층을 구현했고 담당 실행 보고에서 `tests/book-controller.test.ts` **21개 통과**를 확인했다. 문서 담당자가 새로 재실행한 결과가 아니며 별도 보존 로그 경로는 아직 전달되지 않았다.
- V04: BookApp/BookStage/geometry/motion과 실제 제공 표지 적용의 초기 구현 및 typecheck 완료가 보고됐다. 연결된 실제 Edge의 **1912×901** viewport에서 닫힌 표지 중심 오차 **4.55e-13 CSS px**, OPEN/CLOSE 동안 quaternion 유지, 표지 열기·닫기의 실제 시각 동작을 부모가 관측했다. 이 단일 desktop 측정/관측은 CI01–03 전체 통과가 아니다. 전체 브라우저 버전·DPR·해당 수치의 보존 JSON 경로는 이 업데이트에 전달되지 않았다.
- V04 남은 증거: intro/cover의 0/25/50/75/100%와 모든 body bounds, 지정 가로·세로 viewport/비대칭 safe-area/address-bar/resize, skip/reduced/hide/load failure 및 duplicate OPEN, 사용자 확대/focus 보존. `qa/BOOK_EXPERIENCE_GATE.md`의 대기 항목은 실제 증거 확보 전 통과시키지 않는다.
- V04 녹화 시도는 browser runtime reset으로 파일 저장을 완료하지 못했다. 보존된 연속 영상이 있다고 주장하지 않으며, 이 관측만으로 직접 page drag·Web Audio·G1·청취·휴대전화 터치를 통과시키지 않는다.
- QA 보조: `scripts/qa-evidence.ts`와 `tests/qa-evidence.test.ts`의 **새 helper 테스트 5개 통과**가 별도로 보고됐다. 이는 증거 helper 검증이며 실제 브라우저나 G1 테스트가 아니다.
- 테스트 구분: 기존 baseline **96/96**(보존된 baseline 로그), 새 controller **21개**, QA helper **5개**는 서로 다른 실행 범위다. 이번 문서 갱신에서 이들을 전체 통합 회귀 122개 통과로 합산하지 않는다. 이전 클라우드 200개/CPU mock29개도 승계하지 않는다.
- 현재 V05는 구현 진행 중이며 pass를 선언하지 않는다. G1-A/B는 계속 대기, V09 이후 확장은 계속 차단이다. HEAD는 `4dd62db8dc46ca6468bffeeb586c1d295a38a793`, 작업 브랜치는 `book-experience-v2.1`이며 미커밋 구현을 검증 중이다.

## 기록 원칙 (후속 갱신)

각 후속 단계마다 실제 파일, 실행 명령/exit/result, baseline SHA와 uncommitted 변경, URL/기기/브라우저/viewport/DPR/입력 방식, screenshot/video/log, 미실행 이유와 다음 단계를 갱신한다. 상태는 통과/실패/미실행/환경 제약/외부 검수 대기를 구분한다. 테스트 수·정지 목업·2D fallback·CPU mock으로 실제 3D/오디오/터치를 통과시키지 않는다. 실제 듣지 않은 소리를 청취 완료로 기록하지 않는다.

## 2026-10-28 재개 체크포인트 — V06/V07 통합과 부분 실제 검증

### 복구와 실행 환경

- 재연결 후 파일·Git·프로세스를 먼저 확인했다. 작업 브랜치는 `book-experience-v2.1`, HEAD는 `4dd62db8dc46ca6468bffeeb586c1d295a38a793` 그대로이며 v2.1 변경은 미커밋이다. 이전 source와 증거를 보존했다.
- 중단 당시 성공 반환 뒤 미검증이었던 BookApp V06 연결을 점검했다. SceneHost의 준비 완료 직후 stale 토큰 경로에서 pending/loading이 남는 문제, stale cleanup 예외 후 loading 잔류, 오디오 정지 예외가 terminal cleanup을 건너뛰는 문제를 재현·수정했다. 해당 집중 테스트는 18/18 통과했다.
- 현재 dev URL은 `http://127.0.0.1:4183/`다. sandbox의 loopback 접근 실패 후 정상 호스트 실행으로 시작했고, 이 체크포인트의 실행 세션은 `90580`이다. 이전 4173 origin에는 무관한 service worker 캐시가 있어 새 포트를 사용했다. 다른 앱 파일이나 프로세스를 변경하지 않았다. 재개 때에는 이 세션의 생존 여부를 다시 확인한다.
- V06 생명주기 기록은 실제 Edge 156, 1912×946, DPR=1이다. V07 음악 확인은 새 ChatGPT in-app browser, Chrome/156.0.0.0, 1280×720, 측정 DPR=1이다. audio/split/prev/next는 CUA Playwright locator 버튼 입력이며 새 음악 drag는 CDP mouse 입력이다. 실제 휴대전화가 아니다. 오래된 Edge 자동화 응답 지연과 새 IAB 정상 실행을 구분한다.
- 최신 v2.1 원문과 표지 원본은 이미 확보되어 있다. Library materialization을 반복하지 않았다.

### 현재 통합 코드 검사

| 검사 | 이번 재개 후 실제 결과 | 범위/제한 |
|---|---|---|
| `npm test` | **163/163 passed**, exit 0 | 부모 실행자의 이번 통합 실행 보고. 과거 96/200개 또는 개별 테스트 수의 단순 합산이 아님 |
| `npm run typecheck` | exit 0 | V06/V07 통합 및 stage clipping 변경 후 실행 보고 |
| `npm run lint` | exit 0 | 같은 통합 코드 검사 |
| `npm run build` | exit 0, 154 modules | main chunk 1033.59 kB의 크기 경고가 남음; 성능 통과로 간주하지 않음 |

문서 담당자는 위 명령을 중복 실행하지 않았다. 명령별 별도 영구 로그 경로는 이 체크포인트에 전달되지 않았으므로 임의 파일을 증거로 만들지 않았다. 이후 source 변경에는 필요한 회귀를 다시 수행한다.

### 실제 브라우저 증거

아래 경로는 로컬 `output/qa-v2.1/`에 보존되어 있으며, 원격 Git/배포에 포함됐다는 뜻이 아니다.

| 검증 범위 | 확인된 사실 | 보존 증거 |
|---|---|---|
| V04 이전 시각 검증 | 표지 중앙·고정 quaternion, cover 25/50/75%, 두 가로 viewport의 closed/open bounds | `v04-1793092991195-poses.json`, `-responsive.json`, `-open-responsive.json` 및 PNG |
| V05 이전 검사 페이지 | 실제 mouse drag 25/50/75%, 정지·역방향·취소·안착, 양면/가림·wireframe. 실제 휴대전화 터치 아님 | `v05-1793093186454-drag.json`, `-wireframes.json`, `-next-frames.json`, `-next.mp4`, `-next-playback.mp4` |
| V06 정상 장면 교체 | scene1 exit 뒤 scene2 load/attached/ready. 기록 내 activeCount≤1, 도착 시 preparedCount=2/disposedCount=1/cleanupFailures=0 | [lifecycle JSON](../output/qa-v2.1/v06-resume-lifecycle-1793161941473.json) |
| V07 실제 Web Audio 두 레인 | C4 예약 주파수 261.6255653005986 Hz. 위 온음표 8/3초; 아래 onset 0·2/3·4/3·2초와 총 8/3초. 종료 후 source 0, natural-end | [두 레인 JSON](../output/qa-v2.1/v07-audio-real-two-lanes-1793162614122.json) |
| V07 재생 중 navigation stop | 아래 레인의 현재·미래 예약 source 4개 모두 audio clock 29.13233560090703에서 stop 호출, 최종 activeSourceCount=0/sessionId=null | [전환 정지 JSON](../output/qa-v2.1/v07-audio-turn-stop-1793162651365.json) |
| V07 분할·재방문 | 분할 두 번 후 quarter/quarter/half. prev→next 후 동일 3개 event ID와 음가 보존. 전체 lesson revision은 탐색으로 3→5; 숫자가 그대로라고 주장하지 않음 | [revisit JSON](../output/qa-v2.1/v07-1793162663103-revisit.json), [분할 PNG](../output/qa-v2.1/v07-1793162663103-split-twice.png), [재방문 PNG](../output/qa-v2.1/v07-1793162663103-revisit.png) |

`v07-audio-first-path-1793162484829.json`은 HMR로 이벤트 기록이 유실된 **불완전/무효 증거**다. 원본은 보존하지만 음악 timing·pitch·G1 통과 근거로 사용하지 않는다. 이후 두 레인 JSON의 실제 frequency 예약 기록이 이를 대체한다. V05 영상은 검사 페이지의 기록이며 새 음악 페이지의 연속 검증을 대신하지 않는다. 영상 파일의 실제 브라우저 재생 확인도 별도 미검증이다.

새 음악 페이지의 CDP mouse drag에서 진행률 **0.361518** hold, source 불변과 audio0을 확인했다. `v07-1793162663103-music-drag-half.png`는 이름만 근사 표현이며 p=0.5 증거가 아니다. 전체 음악 grab/hold/reverse/release/cancel 영상은 아직 대기다.

### 아직 남은 G1과 제한

- 현재 음악 페이지로 끊기지 않은 대표 영상, 직접 음악 drag/hold/reverse/cancel에서 같은 revision의 live DOM/SVG와 인쇄 texture 픽셀 정합을 확인해야 한다.
- keyboard·reduced motion·2D fallback·200% zoom, 나머지 가로/세로 반응형·safe-area, touch 및 입력 소유권 충돌을 실제 수행해야 한다. 부분 경로 성공으로 CI/BO/EN/AX 전체를 통과시키지 않는다.
- 분할 1/16 제한·최종 16개/합1·병합·undo/redo·작은 음표 선택, 늦은 resume/연타/hide/context loss 등 실제 음악·복구 경로도 검증표의 남은 범위를 수행해야 한다.
- **실제 청취 false**, 실제 휴대전화 터치·실제 보조기술·교육자 검수·G1-C 원본 체감 비교는 미검증/별도 검수 대기다. Web Audio 실행 시각과 oscillator 로그는 사람이 들었다는 증거가 아니다.
- 현재 환경 접근 차단은 보고되지 않았다. 제한은 남은 구현/검증이며 승인 거부가 아니다. G1-A/B 미통과, V09 이후/펼침면 3–6 확장 금지, commit/push/원격 CI/Vercel 검증은 전체 완료 후 대기다.

## 2026-10-28 05:12 UTC — V08 추가 증거와 현재 결함

04:45 체크포인트를 삭제하지 않고 이후 결과를 누적한다. 아래의 최신 코드 검사는 부모 실행 보고의 **168/168 통과**, test session `73079` exit0이다. snapshot/controller 회귀가 추가된 통합 실행이며 과거 개별 개수를 더해 만든 수가 아니다. 이전 163/163과 build 결과는 당시 기록으로 유지한다. 현재 진행 중인 close 수정 이후 결과로 이 실행을 승계하지 않는다.

새 증거 접두사는 `output/qa-v2.1/v08-1793163292932-`다. 실제 IAB Chromium156, DPR1이며 모바일 크기는 desktop viewport emulation이다.

| 확인 범위 | 결과와 제한 | 증거 suffix |
|---|---|---|
| 닫힌 표지 5개 viewport | 844×390, 667×375, 568×320, 390×844, 360×640 모두 `coverIdle`, visualScale1, UV중앙 오차<2px 및 전체 body가 safeRect 안. 열린 음악·주소창·노치 조건까지 통과한 것은 아님 | `closed-responsive.json`, `closed-{width}x{height}.png` 5개 |
| 작은 화면 조작부 | 844×390에서 보이는 조작 모두 실제44px 이상. 568×320은 2열 변경 후 수평 도구 잘림 없음; 일부 도구는 세로 scroll 필요 | `844x390-compact-controls.png`, `568x320-narrow-tools.png` |
| live/print p0 비교 | snapshot 담당 비교 보고: 배경 RGB(244,238,220) 일치, 오선 기준선0px, 오른쪽 heading1px 차이. 미세 잉크는 print가 더 부드러우며 V11 정밀도 개선 대상으로 남음 | `color-fixed-live.png`, `color-fixed-print-p0.png` |
| 직접 음악 drag/hold/reverse/cancel | p=0.2500000056 / 0.5000000056 / 0.7500000503. 2200ms hold 요청 후 같은 p 유지(전후 trace 간격2306ms), p=0.0800000299까지 reverse 후 spread1/revision0으로 cancel. focus는 제목으로 복귀 | `direct-drag-trace.json`, `direct-drag-frames.json`, `direct-drag-playback.mp4` |
| 정확한 절반 pose bounds | p=.5에서 top27.70065>safeTop12, bottom693.61465<safeBottom708 | `held-exact-half-bounds.png` |
| 마지막 경계와 오디오 | spread2/main 재생 중 ArrowRight는 이동·정지를 만들지 않음. 같은 session1/source1, position0.095612→0.275567, lastStopReason=null 유지 | `last-boundary-audio.json` |
| 방향키 입력 예외 | 실제 Ctrl+Left와 instrument focus Left는 spread2 유지. synthetic repeat/isComposing도 spread2 유지. 제목 focus의 실제 Left는 spread2→1 commit 후 제목 focus 복귀 | `keyboard-input-exceptions.json` |

잘못된 통과 근거 제외: `568x320-controls.png`는 HMR 때문에 조작부가 아닌 **표지**를 찍은 캡처다. 파일을 보존하지만 조작부 가독성/44px/잘림 통과 근거로 사용하지 않는다. 실제 조작부 근거는 이후 `568x320-narrow-tools.png`다.

직접 drag 영상은 원래35프레임·1280×720·원래 PTS를 보존했다. 캡처 간격37.904584초, 마지막1µs 샘플 포함37.904585초이며 처음28.406499초 정지 구간을 자르지 않았다. 무손실본은 정규화 source와 모든 decoded frame 해시가 같고, 재생용 사본도 프레임 수·크기·PTS 오차0µs다. `direct-drag-video-verification.json`, `direct-drag-playback-verification.json`에 기록했으며 **실제 브라우저 영상 재생은 아직 미검증**이다. 무음 영상이므로 청취 증거가 아니다. intro부터 두 음악 펼침면을 포함한 전체 대표 영상은 별도 대기다.

현재 알려진 결함은 **closing 중 camera resize에 따라 print를 다시 캡처하여 close가 매우 느려지는 barrier 문제**다. snapshot 담당자가 수정 중이며 이 체크포인트에서 해결·close 통과를 선언하지 않는다. direct-drag trace에도 일부 구간 `printsReady=false`가 있고 cancel-settled의 `visual.sceneProgress=0`과 lifecycle ready가 함께 기록되어 있다. 따라서 이번 trace는 곡면·hold·cancel의 데이터/focus 복귀 증거로 한정하며 안정된 print 준비나 장면의 완전 시각 복원을 단독 증명하지 않는다.

G1-A/B는 계속 미통과다. close 수정/회귀, intro 영상, 전체 음악 연속 시퀀스, 2D fallback·200%·reduced motion, remaining input/cancel variants와 touch 검증을 수행해야 한다. 실제 청취=false, 물리 휴대전화 touch=false이며 V09 이후·commit/push·배포는 계속 대기다.

## 2026-10-28 05:20 UTC — close 복귀와 음악 대표 영상

05:12 기록의 close 지연 결함에 대해 snapshot 수정본의 typecheck가 확인됐다는 담당 보고를 받았고, 실제 [close-fixed.json](../output/qa-v2.1/v08-1793163292932-close-fixed.json)을 확인했다. spread1/ready에서 `coverIdle`, scene unmounted, sceneHost active0/pending0/disposed1, audio source0으로 돌아왔고 focus는 **책 펼치기**다. 측정 2874.100ms는 UI 준비를 포함한 전체 관찰 간격으로 순수 닫기 애니메이션 시간이라고 부르지 않는다. 이 경로의 정상 복귀는 확인했지만 hide/취소/동시 입력 등 모든 close 변형이 검증됐다는 뜻은 아니다. 이전168/168은 수정 전 실행 기록이며 수정 이후 전체 회귀를 새로 통과한 것으로 승계하지 않는다.

이전 direct-drag 영상은 실제 브라우저에서 끝까지 재생됐다. [direct-drag-browser-playback.json](../output/qa-v2.1/v08-1793163292932-direct-drag-browser-playback.json): duration/currentTime37.904585초, ended=true, error=null, decodedFrames35, droppedVideoFrames0, 1280×720. 이는 당시 인코더의 `browserPlaybackVerified:false` 이후에 확보한 별도 결과다. 과거 인코딩 보고서를 소급 수정하지 않는다.

새 [music-sequence-trace.json](../output/qa-v2.1/v08-1793163292932-music-sequence-trace.json)과353개 원본 프레임은 IAB Chromium156, 1280×720, DPR1, 실제 WebGL/Web Audio, CDP mouse 입력의 한 연속 실행을 담는다:

1. 이미 닫힌 coverIdle에서 OPEN 후 scene1 ready.
2. upper session1/source1 재생→자연 종료(source0), lower session2/source4 재생→자연 종료(source0).
3. NEXT→scene2, 선택 분할2회→quarter/quarter/half.
4. PREV→scene1→NEXT→scene2. 전후 `edit-scene-2-main-2-1`, `edit-scene-2-main-2-2`, `edit-scene-2-main-1-2` 및 음가/시작 위치가 같다. revision은3→5이며 자동 재생 없이 source0이다.

| 새 인코딩 결과 | 값 |
|---|---|
| 원본 manifest | `v08-1793163292932-music-sequence-frames.json`, SHA256 `191910f0514179456f96679d596be6d7872930965d65209f06131a0245d75e08` |
| [무손실본](../output/qa-v2.1/v08-1793163292932-music-sequence.mp4) | 8,078,089 bytes; SHA256 `8f40132b49247f0e9cd6039e40dc1f56325c25bee73c2ffe2522e2fd6c4080d7` |
| [재생용 사본](../output/qa-v2.1/v08-1793163292932-music-sequence-playback.mp4) | 1,912,314 bytes; SHA256 `d6912f8669b6cb30c829384b77c7a04c3d746ea3c3b6ac36e95c247143494cc5` |
| 무결성·시각 | 원본/decoded353프레임,1280×720. 무손실본의 정규화 source 해시 전부 일치. 양쪽 PTS 오차0µs |
| 길이 | 캡처39.834460초, 마지막1µs 포함39.834461초. 처음 닫힌 정지 구간을 포함해 trim/재배열/resize/보간/프레임 추가·삭제 없음 |
| 검증 기록 | `-music-sequence-video-verification.json`, `-music-sequence-playback-verification.json`; 기존 encoder exit0 |
| 실제 브라우저 재생 | **새 music-sequence 영상은 아직 미검증**. direct-drag 영상 결과를 승계하지 않음 |

새 화면 녹화는 무음이고 `actualListening=false`, `physicalTouch=false`다. trace에는 stable page에서 `printsReady=false`인 준비 구간도 남아 있으므로 모든 snapshot barrier/인쇄 품질 완료를 선언하지 않는다. 이 영상은 coverIdle부터 시작하므로 초기 intro 전체 영상도 대신하지 않는다.

G1-A/B는 계속 미통과다. 남은 범위는 intro와 safe-area/복구, reduced motion·200%·2D fallback, 나머지 입력/cancel variants·touch, 음악 조작/인쇄 정밀도와 새 영상의 실제 재생 확인이다. 전체 완료 전 commit/push/배포 금지는 유지한다.

## 2026-10-28 06:12 UTC — 최신 통합 검사와 전체 흐름 녹화 대기

이 체크포인트는 위 날짜별 기록을 보존하면서 현재 판정을 갱신한다. 구현 범위는 첫 두 펼침면이며 **G1-A/B는 아직 미통과**다. 현재 필수 미확보 증거는 초기 intro부터 책/음악/편집/탐색을 이어가는 끊기지 않은 전체 흐름 영상이다. 부분 영상과 자동 검사는 이를 대체하지 않는다.

### 최신 고정 코드 검사

[통합 검사 요약](../output/qa-v2.1/g1-integrated-20261028-055212-summary.json)은 마지막 BookApp 대기 탐색의 print 재시작 수정 이후 실행이며 2026-10-28 05:54:13 UTC에 완료됐다. `npm.cmd test` → `npm.cmd run lint` → `npm.cmd run build` → `npm.cmd run typecheck` 순서로 실행했고 각각 exit0이다. 테스트는 **174/174 passed, failed/skipped/cancelled0**, lint 경고0이다. build는154 modules, main chunk1038.33kB/gzip288.26kB이며 **500kB 초과 경고는 남아 있다**. content validation의6 scenes/9 lanes는 기존 content 데이터 범위이고 구현을6개 펼침면으로 확장했다는 뜻이 아니다.

각 명령의 로그·SHA256과 검사 종료 시 BookApp/controller SHA256은 같은 요약 JSON에 보존되어 있다. branch는 `book-experience-v2.1`, HEAD는 `4dd62db8dc46ca6468bffeeb586c1d295a38a793`이고 구현은 미커밋이다. 이번 문서 갱신은 검사 재실행이나 소스 수정을 하지 않았다.

### 추가 확인과 증거 제한

- **200% 2D 핵심 편집:** [키보드 merge/undo](../output/qa-v2.1/v08-1793163292932-zoom-200-reading-keyboard-edit.json)는 Chromium의390×844 viewport 에뮬레이션, DPR1, 실제 page scale2에서 focus 후 Enter로 merge(revision25→26), undo(→27)를 수행했다. [확인된 pointer split](../output/qa-v2.1/v08-1793163292932-zoom-200-verified-pointer-split.json)은 visualViewport offset을 적용한 실제 CDP mouse 입력으로 둘로 나누기를 수행했고 revision29와 새 split IDs를 보존했다. 두 경로의 audio source는0이다. 물리 pinch나 desktop Ctrl zoom 검증은 아니다.
- **잘못 이름 붙은 자료 제외:** `v08-1793163292932-zoom-200-visible-pointer-merge.json`은 좌표 오류로 redo를 클릭한 시도이며 merge 통과 근거에서 제외한다. 실패한 locator 경로 역시 성공한 실제 키보드/CDP 입력과 구분한다.
- **음악 영상 실제 재생:** [353프레임 재생 결과](../output/qa-v2.1/v08-1793163292932-music-sequence-browser-playback.json)는 ended=true, error=null, duration/currentTime39.834461초,1280×720, decoded353, **dropped17**이다. 이전의 미검증 상태는 해소됐지만 dropped0으로 쓰지 않는다. 인코더는 원본353프레임과 PTS를 모두 보존했으며 브라우저 재생 중 drop과는 다른 측정이다.
- **intro 자료:** 실제 CSS viewport와 캡처가 모두1280×720인 `v08-1793163292932-intro-full-1280x720-frames.json`의58프레임을 원본 PTS로 인코딩했다. 캡처1.998291초/최종 sample 포함1.998292초, 무손실 정규화 frame hash 전부 일치, 양쪽 PTS 오차0µs이다. `-intro-full-1280x720.mp4`, `-intro-full-1280x720-playback.mp4`와 검증 JSON을 보존했다. 이 독립 intro 영상은 전체 흐름 영상이 아니며 이 문서 갱신에서 실제 영상 재생을 새로 확인하지 않았다. 이전 responsive CDP 캡처는 widget과 emulated viewport가 달라 portrait 전체 하단의 증거로 쓰지 않는다.
- **복구/입력 범위:** [intro skip](../output/qa-v2.1/v08-1793163292932-intro-skip-fixed.json)에서 실제 cover click/Escape는 coverIdle·intro1·책 펼치기 focus로 끝나며 별도 Enter로 연다. [context 복구](../output/qa-v2.1/v08-1793163292932-context-loss-recovery-fixed.json)는 재생 중2D 전환 후 source0, retry 후 같은 spread2/revision2, notice 해제와 ready를 기록한다. 담당 실행 보고의 reduced-motion 정적 경로, 실제 pointer capture loss/resize와 합성 second-pointer/pointercancel은 입력 방식을 구분한다. hide/show 새 owner 준비 barrier는 visibility API 환경 에뮬레이션으로 확인됐으며, native IAB 탭은 계속 visible이므로 실제 탭 비가시성 확인으로 승계하지 않는다.

### 미완료 녹화와 다음 재개 위치

전체 흐름 녹화1은 [unusable JSON](../output/qa-v2.1/v08-1793163292932-g1-whole-attempt1-unusable.json)에1프레임/steps0만 남았다. Browser Use가 paused document response를 처리 중이어서 raw CDP를 사용할 수 없었던 실행 실패다. 담당 실행 보고상 시도2는 CUA61초 timeout으로 RAM 프레임이 유실되어 유효 영상을 확보하지 못했다. 현재 실행자는 재시도 전 실제 상태를 확인하고 증거를 점진 저장하는 녹화를 준비 중이며, 완료 또는 마지막 화면 상태를 추정하지 않는다.

**승인 대기는 없다.** 현재 작업은 전용 IAB에서 진행하며 공유 Edge를 조작하지 않았다. 녹화 실패는 승인 거부가 아니다. 원본 Drive 문서 확보는 완료됐으므로 Library 전달을 재시도하지 않는다. 물리 휴대전화 touch, 실제 소리 청취, 전체 보조기술 검수와 교육자 검수는 별도 미검증이다. G1-C 원본 체감 비교도 완료하지 않았다. 유효 전체 흐름 영상과 최종 증거 감사를 마친 뒤 G1을 판정하며, 그 전에는 V09 이후 확장·commit/push·CI/Vercel 완료를 주장하지 않는다.


## 2026-10-28 06:39 UTC — G1-A/B 통과, V09 구현 시작

이 체크포인트가 위 미통과/녹화 대기 상태를 갱신한다. 과거 항목은 삭제하거나 소급 통과로 바꾸지 않았다. [G1 최종 판정](qa/BOOK_EXPERIENCE_GATE.md)은 초기 첫 두 펼침면과 명시된 IAB Chromium 환경의 **A/B 통과**이며 G1-C·최종 수업 시험 준비 완료를 의미하지 않는다.

- [새 전체 영상](../output/qa-v2.1/g1-complete-1793168908925-playback.mp4), [trace](../output/qa-v2.1/g1-complete-1793168908925-trace.json), [manifest](../output/qa-v2.1/g1-complete-1793168908925-frames.json): 한 번의 start/stop으로330프레임,156.326265초. OPEN→실제 음악 재생→direct25/50/75→2312.7ms hold→reverse/cancel→유효 release→분할2회→이전→재방문을 연결했다. 동일3 event IDs/선택이 보존되고 마지막ready/printsReady=true/audio0이다.
- ready 확인 뒤 실제 Tab 입력과 focus ring을 확인했다. 마지막 frame은 해당ready 표본보다11.435184초 뒤다.330파일 bytes/SHA256·엄격한 timestamp 순서와 [인코딩 검증](../output/qa-v2.1/g1-complete-1793168908925-video-verification.json)의330decoded·전체 normalized hash 일치·PTS오차0µs를 확인했다. 후속 [실제 브라우저 재생](../output/qa-v2.1/g1-complete-1793168908925-browser-playback.json)은 ended=true/error=null, decoded330/total330, duration156.326266초, **dropped10**을 기록했다. 인코딩에서의 누락0과 재생drop10을 구별하며 영상에 오디오 트랙은 없고 실제 청취도 미실행이다.
- 앞선326프레임 g1-final 기록은 마지막ready tail 근거가 부족해 부분 자료로 보존한다. 초기 half-frame 잘림 의심은 [픽셀/geometry 감사](../output/qa-v2.1/g1-camera-envelope-audit.json)로 철회했다: 상단12행15360픽셀은 모두 배경, 첫 종이y29, mesh 투영top27.700654px. camera 소스 수정은 없었다.
- [174/174 고정 코드 검사](../output/qa-v2.1/g1-integrated-20261028-055212-summary.json)는 G1 수용 당시의 test/lint/build/typecheck 결과다. V09 engine+UI 구현이 이제 진행 중이므로 이후 변경의 검증 완료로 승계하지 않는다. V09 변경 후 pause/resume offset·snapshot/tempo/revision·경쟁 조건과 실제 Web Audio를 다시 확인해야 한다.
- V10 이후는 아직 시작하지 않았다. G1-C 원본 동일 입력 비교와 주관적 수용, 물리 휴대전화 touch, 실제 청취, 실제 보조기술 및 교육자 검수는 미완료다. 전체 구현/필수 검증 전 commit/push 금지는 유지하며 이번 작업에서 commit/push·원격 CI·Vercel 배포 검증은 하지 않았다.

- 2026-10-28T06:41:08.111Z 실행 빌드 보존: [g1-pass-20261028-dist.zip](../output/qa-v2.1/g1-pass-20261028-dist.zip),2,608,816 bytes,SHA256 `fd8f440070144051c8ca1c0671ea409f30a1c85f0fe342132609ded940ae39b1`.174개 검사가 통과한 기존 dist를 V09 build 전에 보존한 복구 가능한 G1 실행 기준이다. 전체 소스 백업이나 새 소스 snapshot이 아니다.


## 2026-10-28 07:13 UTC — V09 기술 통과, V10 저장 구현 시작

[V09 기술 판정](qa/V09_TRANSPORT.md)과 [ADR](adr/V09_AUDIO_TRANSPORT.md)을 최신 실행 증거에 맞췄다. [통합210/210 검사](../output/qa-v2.1/v09-integrated-20261028-065009-summary.json)는 V09 source freeze 결과이며 G1의174개 검사와 별개다. test/lint/build/typecheck exit0,157 modules/main1045.89kB·gzip290.30kB,500kB 초과 경고는 남는다.

- 실제 앱에서 같은buffer·새source로offset0.876383 재개,20회play의context1/추가source1, paused next/2D/drag/close의offset0·source0을 확인했다. 실제context suspend/close와닫힌context의명시Play 안내도 확인했다. 지연resume/hidden/latecallback은 명시한에뮬레이션이다.
- [실제48000Hz API 실험](../output/qa-v2.1/v09-1793170091718-real-context-rests.json)은 near-boundary.677·쉼표.9036667·끝쉼표2.205에서 같은buffer/새node·offset유지·논리종료를 확인했다. 정확경계는unit 검사다. 예약start27.987 전stop27.952 호출과source0도 확인했다. 실제청취는 전부미실행이다.
- 편집 정책은 **사용자가 Stop 후 편집**이다. paused 상태에서 자동stop/edit가 일어난다는 이전 ADR 문구를 바로잡았다. 현재 tempo UI는 없고 V13에서 추가하며, paused owner의tempo/revision 변경 거부는unit근거다.
- V10은 core와책 UI가 구현 진행 중이며 아직수용검증하지 않았다. 원문 strictschema/preview-confirm import를 보존하고 새schema/newkey 이관·last committed spread·표지 이어보기·실패 시 메모리 학습 지속·앱전용삭제를 구현한다. V11 이후는 시작하지 않았다.
- V10 시작 전 [V09 source checkpoint](../output/qa-v2.1/v09-source-checkpoint-20261028.zip)와 [식별 요약](../output/qa-v2.1/v09-source-checkpoint-20261028.json)을 보존했다.2,205,369bytes,SHA256 `388b5958ef4876063acbe4074dcdb2db159d490a5060aeaa6646277fe9f79d67`.182개 working 파일+_checkpoint-manifest.json=ZIP183항목; tracked/untracked source를 포함하고 .git/dependencies/QA media/build output은 제외한다. 크기·해시·항목 수를 직접 확인했다. [추가 archive 검증](../output/qa-v2.1/v09-source-checkpoint-verification.json)은 ZIP CRC 정상과 통합 요약의 7개 V09 소스 지문이 모두 archive 내용과 일치함을 확인했다. V10 파일은 포함하지 않는다. 앞선 G1 dist ZIP은 실행 빌드 기준이며 이 소스 체크포인트와 구분한다.
- G1-C·주관적 수용·물리기기 touch·실제청취·실제보조기술·교육자검수는 여전히미완료다. source snapshot 보존은commit이 아니다. commit/push·원격CI·Vercel배포는 이번 작업에서 실행하지 않았고 전체완료 전금지조건을 유지한다.


## 2026-10-28 14:07 UTC - independent checks and manual handoff

The current source includes a new keyboard focus repair in LessonPages.tsx. A real merge/redo could disable its initiating button and drop native focus to BODY. After repair, native Enter follows merge -> enabled Undo, undo -> enabled Redo, redo -> enabled Split. This does not steal focus moved outside the control group.

Current full-source summary: output/qa-v2.1/r1-integrated-20261028-140635-summary.json, completed14:07:01.818 UTC:257/257, zero fail/skipped/cancelled/todo, lint/build/typecheck exit0,78 source fingerprints unchanged. The13:46 summary and13:54 ZIP are now historical, before this focus repair.

New actual UI evidence prefix r1-1793196104305 covers whole-to16 balanced splits, all16 real C4 noteheads/stems/ledger lines and four groups of two beam paths, last-note keyboard selection, merge/undo/redo and16 saved IDs after reload/resume.390x844 CSS viewport emulation has root width390/scroll width390 and44px event-list targets; native keyboard selection and editing worked. This is one emulated size, not the complete responsive matrix, native desktop zoom or physical phone touch.

MANUAL_DRAG_CHECK.md gives the user a minimal hold/reverse-cancel/complete/revisit check. The existing4183 server responds. The retained IAB is back at normal1280x720, first3D spread, spreadIdle/scene ready/prints ready/turn null/audio0. No automated drag retry was made after JavaScript execution was denied. Specific cause/reviewer identity absent; retry question and manual results pending. Existing JSON file-download delivery remains uncertain. No commit/push/remote CI/new deployment. Additional responsive/keyboard/audio/resource stress QA and the current moved-corner manual result remain before first deployment. Spreads3-6 remain deferred until that deployment.

## v3 리팩토링으로 이어짐

2026-10-30부터의 v3 리팩토링(R0–R9) 보고는 [BUILD_STATUS_V3.md](BUILD_STATUS_V3.md)로 이어진다.
