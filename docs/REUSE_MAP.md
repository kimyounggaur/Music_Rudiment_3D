# v2.1 코드 재사용 감사 — V01

감사일: 2026-10-27 UTC. 고정 근거는 `4dd62db8dc46ca6468bffeeb586c1d295a38a793`다. 현재 checkout의 HEAD와 동일하며 소스 차이는 없다. 아래 줄 번호는 이 baseline을 가리킨다. 이후 구현에서 줄 번호가 바뀌면 해당 변경의 근거를 갱신한다.

실행 계약은 [IMPLEMENTATION_CONTRACT_V2.md](IMPLEMENTATION_CONTRACT_V2.md), 실제 검사 결과는 [BUILD_STATUS_V2.md](BUILD_STATUS_V2.md)를 따른다. 이번 V01은 문서 감사이며 book source를 구현하지 않았다.

## 결론과 현재 지원 범위

현재 앱에 실제 Three.js 음가 블록과 안전한 해제·context loss 대응은 있다. 반면 닫힌 커버, 책등, 곡면 양면 종이, 직접 page drag, 인접 Spread commit, 페이지별 scene lifecycle은 현재 사용자 경로에 없다. 기존 음악 의미 계층을 보존하고 패널형 표현과 탐색을 별도 book 계층으로 바꾸는 점진적 전환이 필요하다.

첫 단원의 콘텐츠는 C4, 4/4, 무부점 온음표부터 16분음표, 음표/쉼표, 단선율 한 마디다. 기본 90 BPM과 비교용 60/120을 사용한다. 기보는 VexFlow SVG와 로컬 Bravura/Academico 글꼴, 높은음자리표와 4/4, C/G key signature 범위다. `NotationView.tsx:113`은 부점을 거부하므로 domain 계산의 부점 지원을 UI 지원으로 확대하지 않는다.

`domain/music.ts:97`의 음정 함수는 철자와 반음을 함께 사용하지만 상행 1–8도 및 증/감 한 단계 범위다. 겹증/겹감·하행·완성 음정 단원 UI가 있는 것은 아니다. AudioEngine은 sine 합성음이며 샘플 악기·다성·다마디·pause/resume/seek 엔진이 아니다.

## 모듈별 판단

| 현재 파일·근거 | 판단 | 보존할 내용 | v2.1에 필요한 작업 |
|---|---|---|---|
| `src/domain/fraction.ts:43,67,85,104` | 그대로 유지 | 기약분수·안전한 정수 연산·정확한 합 | 화면 폭이나 부동소수점으로 학습 정답을 다시 계산하지 않는다 |
| `src/domain/music.ts:26,41,87,97,124` | 그대로 유지 | tempo.unit 기반 초 변환, meter, 철자 보존 MIDI/음정, notation 길이 계산 | UI 지원 범위를 늘려 주장하지 않는다; 기존 domain 회귀 유지 |
| `src/content/types.ts`, `src/content/lesson.ts:24,35,40,57` | 유지 + adapter | scene/음악 데이터와 C4·4/4·90 BPM, 첫 두 장면 문항 | BookManifest의 spread/page/leaf ID를 별도로 정의하고 명시 scene 매핑 |
| `src/content/validation.ts:28,79,100` | 그대로 유지 | draft/playable/assessment 구별, 정확한 평가와 콘텐츠 검증 | book manifest validation을 별도 추가; 빈 draft를 완료로 처리하지 않음 |
| `src/lesson/controller.ts:85,96,143,164,176` | 유지 + navigation adapter | validated commit, 선택 분할, 병합 조건, undo/redo, 현재 평가 | 음악 reducer 아래에 모션을 넣지 않음; book settle 이후에만 의미 navigate commit |
| `src/lesson/controller.ts:206,212,224` | 유지 + snapshot adapter | 학습 직렬화와 검증 복원 | scene snapshot/content revision 연결; hover/capture/오디오 노드 제외 |
| `src/notation/NotationView.tsx:11,95,101,113,152,191` | 유지 + page surface adapter | VexFlow SVG, 글꼴 완료/실패 재시도, 의미 선택 목록, 44px 대체 조작 | 400px 최소폭을 작은 종이에 강요하지 않음; page-local DOM와 동일 revision texture, homography/inert/읽기 확대 |
| `src/audio/AudioEngine.ts:155,165,225,286,324,347` | 유지 + TransportAdapter | gesture unlock, 단일 시작 요청, stale token 방지, 예약 source stop, 논리 길이 완료, dispose | G1에서는 실제 start/stop 기술 검증; V09에서 offset pause/resume와 경계/race 검증 |
| `src/scenes/durationWorld.ts:14,41,83,106` | 유지 + SceneAdapter | 의미 길이 기반 시간축, 고정 높이/깊이, renderer와 분리된 Group, 공유 geometry/material, 멱등 dispose | BookStage anchor 자식으로 연결; 두 레인 동시 배치; enter/exit와 선택 연결 |
| `src/scenes/durationWorld.ts:60,65` | 검증 후 결정 | 현재 playhead의 가시성 의도 | `depthTest:false`, renderOrder 2가 종이를 관통하지 않도록 book depth/occlusion 정책으로 바꾸고 실검증 |
| `src/scenes/DurationScene3D.tsx:52,54,56,85,102,137,142` | renderer 소유권 이동 | 지연 import, 한 WebGLRenderer, DPR 1.5 상한, demand RAF, ResizeObserver, context loss, cleanup | renderer는 BookStage 한 곳에 유지; 페이지마다 canvas/context를 만들지 않음; scene resource ownership과 취소 확대 |
| `src/scenes/DurationScene3D.tsx:121,126,129,136` | 입력 adapter 교체 | raycast 기반 클릭 선택과 cancel 안전성 | 기존 코드는 8px 이동 시 클릭을 취소하며 page drag가 아님; gesture owner/capture/hold/reverse/release/cancel 추가 |
| `src/scenes/DurationScene2D.tsx` | 의미 경로 유지 + 표현 재배치 | 동일 이벤트 선택·재생 위치와 reduced-motion 대체 표현 | 정식 책 내부 ReadingView2D로 재구성; 구형 dashboard 그대로 fallback하지 않음 |
| `src/persistence/progress.ts:2,78,158,220,234,241,253` | 유지 + schema migration | strict fields, import preview/commit 분리, 검증 후 쓰기, 원문 보호, 앱 backup 삭제 | bookUiVersion/lessonSchemaVersion/contentVersion 구분, v1 원문 백업 후 새 key, 안정 spread만 복원 |
| `src/App.tsx:27,82,174,181,186,197,224` | 표현/탐색 교체 | 의미 명령·오디오 stop·학습 데이터 연결 | 기본 closed 3D book, 즉시 sceneId 교체 제거, 외부 header/nav/question/card/sticky footer를 book-local UI로 교체 |
| `src/App.tsx:140` | 검증 후 개선 | 현재 재생 상태 UI 동기화 | 유휴 중에도 32ms interval을 사용함; BookStage demand rendering/transport 구독과 불필요한 React 갱신을 검토 |
| `src/App.tsx:200,225` | 제품 동작 교체 | lane별 소리 소유권 | scene 1의 두 레인을 함께 보여 주고 개별 듣기 유지; 과제 완료로 다음 탐색을 막지 않음 |
| `src/styles/app.css`의 `.steps/.lesson-grid/.transport` | book 셸로 교체 | 글자/터치/접근성의 유효한 기본값 | 기존 `.transport`는 `fixed`가 아니라 `position:sticky`; v2에서는 외부 sticky/fixed 모두 제거 |
| `tests/domain.test.ts`, `assessment.test.ts`, `lesson.test.ts`, `audio.test.ts`, `persistence.test.ts`, `duration-world.test.ts` | 회귀 유지 + 필요한 확장 | 기존 의미 기대값·오디오 취소·저장·world 해제 | 숫자를 맞추기 위해 삭제/완화하지 않음; book state/lifecycle/input 검증은 별도 |
| `scripts/e2e.ts:11,24,27,31` | UI expectations 교체 | 실제 실행을 검증하려는 목적과 오디오/저장 회귀 항목 | `output/preview.html`, nav button index, 최초 canvas=0, 완료 후 next 기준은 book 계약으로 교체 |
| `package.json`, `package-lock.json` | 잠금 버전 유지 | React 19.2.5, Three 0.186.1, VexFlow 5.0.0, Vite 5.4.21, Playwright 1.60.0 | R3F/Drei/XState/GSAP 전제 도입 없음; 필요 시 공식 호환성·비용 ADR 선행 |
| `docs/KNOWN_LIMITATIONS.md`, 기존 QA/evidence | 원본 보존 | 이전 실행 범위/미검증 기록 | 과거 결과를 새 v2.1의 실행·청취·G1 증거로 승계하지 않음 |

## 확인한 기존 안전장치

`DurationScene3D.tsx`는 실패/부분 초기화에서 renderer/world를 해제하고, RAF를 중복 예약하지 않으며, resize 때 DPR 상한을 적용한다. context loss handler와 unmount는 listener, observer, RAF, world, renderer를 정리한다. `durationWorld.ts:106`은 dispose 중복 호출을 막고 geometry와 material을 해제한다. 따라서 “3D나 cleanup이 전혀 없다”는 설명은 틀리다.

`AudioEngine.ts:165`는 starting 중 pending 시작 요청을 재사용하고 request token이 바뀌면 stale resume 결과를 무시한다. `stop:286`은 token을 증가시키고 진행 중/미래 예약 source를 취소한다. `App.tsx:80,82,84`는 장면/모드/3D 실패에서 stop을 연결한다. 새 book coordinator는 이 동작을 scene exit보다 먼저 호출해야 한다.

`progress.ts`는 unknown field와 schema mismatch를 거부한다. 기존 envelope에 book 필드를 그대로 추가하면 거부되므로 V10에서 명시적 migration이 필요하다. 기존 정상 저장 보호를 제거해 쉽게 통과시키지 않는다.

## 문서 유도와 구현 부재의 구분

| 근거 | 이번 확인 수준 | 판단 |
|---|---|---|
| v2.1 설계서 §2.2의 v1 설계서 5/14/21/28절 및 v1 P00/P06/P10 회고 | 최신 v2.1 원문을 직접 읽음; v1 원문 자체는 로컬에 없음 | 패널 배치와 3D 후순위 순서가 구형 문서에서 유도됐다는 **v2 작성자의 감사 기록**으로 인용 가능 |
| `App.tsx:174–226`의 header/nav/aside/experiment/notation/questions/footer | 현재 baseline source 직접 확인 | 실제 UI가 패널형 구조이며 물리적 책 계약과 다름 |
| `DurationScene3D.tsx`, `durationWorld.ts` | 현재 source와 실제 Edge 실행 환경 확인 | 실제 Three 블록과 cleanup은 이미 존재; 이를 보존하면서 책 renderer와 lifecycle 연결 필요 |

v1 원본 미확보 때문에 v1 해당 절을 이번 PC에서 직접 읽었다고 쓰지 않는다. 원문 참조는 [v1 설계서](https://drive.google.com/file/d/1Ov_VxG2Z_sZwIuwO6yYYqd4zS_X2R1t5/view), [v1 프롬프트](https://drive.google.com/file/d/1lHtV2lEpRnzHT2d10hk_JvlVn4eh7_c8/view)다. 이 문서의 역사적 책임 판단은 v2의 회고와 현재 코드 관측을 구별한다. 누락 원문을 추정해 복원하지 않는다.

## baseline 실행과 한계

이번 Windows에서 typecheck/lint/content:validate/test/build가 모두 exit 0였다. `test`는 96/96이며 선언 수는 domain 25, audio 18, lesson 25, persistence 12, duration-world 6, assessment 10으로 합 96이다. 선언 집계는 실행 증거를 대신하지 않으며 실제 결과는 `../../evidence/baseline/test.log`와 `summary.json`에서 확인했다.

기존 `test:e2e`는 이번에 실행하지 않았다. 실제 Edge에서 기존 Three 블록이 보인 것은 환경 확인일 뿐 새로운 책, Web Audio, 터치 또는 G1 통과가 아니다. v2 테스트를 추가하기 전에 먼저 기존 소스 계약을 유지하며 첫 두 펼침면 수직 절편을 만든다.

V01 코드 감사·reuse/trace 문서·baseline은 완료했다. v1 원문 대조는 자료 미확보로 별도 미실행이며 부모 작업의 판단에 따라 V02 진행을 막지 않는다. 다음 실행은 V02의 원본 관측과 잠정 책 시각 명세다. 이 문서로 G1 또는 구현 완료를 선언하지 않는다.
