# Music_Rudiment_3D 리팩토링 바이브코딩 프롬프트 v3.0

부제: 리팩토링 설계서 v3.0을 코드로 옮기는 단계별 실행 계약

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-10-30 |
| 버전 | 3.0 |
| 기준 문서 | `Music_Rudiment_3D_리팩토링_설계서_v3.0.md`(저장소 권장 위치 `docs/REFACTOR_DESIGN_V3.md`). 이 프롬프트는 설계서의 절 번호(§2 진단표 D1–D11, §6 R0–R9, 부록 A–D)를 그대로 가리킨다 |
| 계승 문서 | 상세설계서 v2.1, 바이브코딩 프롬프트 v2.1(`docs/source/design-v2.1.md`, `docs/source/prompt-v2.1.md`에 보존). v2.1의 계약 중 R0에서 개정하지 않은 조항은 그대로 유효하다 |
| 기준 커밋 | `4f3111a5de4c40bad2ac6f79aaabe96727e90a96` (`main`, "deliver first two interactive book spreads") |
| 권장 저장 위치 | `docs/REFACTOR_PROMPTS_V3.md` |
| 대상 | 저장소 `kimyounggaur/Music_Rudiment_3D`에서 R0–R9를 수행하는 구현 에이전트(Claude Code 등) |
| 용도 | 세션마다 블록 하나를 복사해 붙이는 실행 계약 |
| 이 문서가 아닌 것 | 코드 변경·배포·승인이 아니다. 원본 Every Joule의 코드·자산을 복사하라는 지시가 아니다. 이 문서를 작성한 시점에 아래 명령이 실행된 것은 아니다 |

---

## 0 사용법

### 0.1 한 세션에 블록 하나

1. 새 세션의 첫 메시지는 항상 **§1 P00(공통 실행 계약)** 이다.
2. 두 번째 메시지로 **단계 블록 하나**(§3)를 붙인다. XL 단계(R3, R4)와 L 단계(R8)와 R9는 서브세션(R3-a … R3-e 등)으로 나뉘어 있다. 한 세션에 서브세션 하나다.
3. 에이전트가 한 세션에서 두 단계를 묶어 하겠다고 하면 거부하고 블록 하나로 되돌린다. 단계가 커서 한 세션에 끝나지 않으면 X01(이어가기)로 다음 세션을 연다.
4. 단계가 끝나면 에이전트의 `docs/BUILD_STATUS_V3.md` 보고와 `docs/qa/refactor/R{n}/` 캡처를 사람이 본다. 사람 검사 항목이 통과하기 전에는 다음 단계 블록을 주지 않는다.
5. 실패하면 각 단계의 **실패 시 수정** 블록을 쓴다. 문서 문구나 기대값을 바꿔 실패를 감추는 수정은 거부한다.

### 0.2 세션 시작 전에 사람이 준비하는 것

- 설계서 v3.0과 이 프롬프트를 저장소 `docs/REFACTOR_DESIGN_V3.md`, `docs/REFACTOR_PROMPTS_V3.md`로 넣는다(에이전트는 외부 파일을 내려받지 못한다).
- §7 **사용자 결정 기록표** 6항목에 답을 적는다. 비워 두면 에이전트는 권장값을 잠정 채택하고 `잠정`으로 표시한다. 6번(원본 화면 녹화)은 기본값이 없다.
- 작업 PC에 Node `>=24.14.0 <25`, `npm ci`로 설치된 의존성, Playwright Chromium(기존 `scripts/http-e2e.ts`와 같은 경로 규칙)을 둔다. 에이전트는 `package.json`의 `engines`를 바꾸지 않는다.

### 0.3 세션 종료 체크리스트(에이전트가 보고 전에 반드시 통과)

~~~text
[ ] npm run typecheck && npm run lint && npm test && npm run build 모두 exit 0 (build는 content:validate 포함)
[ ] 세션 시작 baseline과 비교해 새로 실패한 테스트 0개. 실패 테스트의 삭제·skip·기대값 변경 없음(의도적 변경은 사유 기록)
[ ] renderer=legacy 경로가 여전히 빌드·동작(R9 전까지). legacy 대상 e2e(scripts/keyboard-e2e.ts, quiz-e2e.ts, notation-e2e.ts 중 해당) 재실행 결과 기록
[ ] 단계의 전후 캡처가 docs/qa/refactor/R{n}/{before,after}/ 에 있고 metrics.json이 있음(§5 규약)
[ ] docs/BUILD_STATUS_V3.md에 §0.4 양식으로 항목 추가. 미실행·외부 검수 대기 항목을 통과로 쓰지 않음
[ ] git status에 비밀값·대용량 영상·무관한 생성물·사용자 변경 덮어쓰기 없음. push·배포·외부 공유 없음
[ ] 설계서와 다르게 구현한 지점이 있으면 "설계서 대비 편차" 줄에 사유와 함께 기록
~~~

### 0.4 보고 양식(`docs/BUILD_STATUS_V3.md`)

v2.1 프롬프트 §2 양식 10줄을 그대로 쓰고 아래 4줄을 더한다. "코드를 작성함", "테스트가 통과함", "사람이 승인함"을 구분한다.

~~~text
단계 ID와 상태: 통과 / 실패 / 일부 완료 / 외부 검수 대기
실제로 가능한 사용자 행동:
변경 경로와 이유:
실행 명령과 종료 결과:
기기와 브라우저 및 commit:
실제 캡처 영상 로그 경로:
미실행 항목과 정확한 이유:
남은 결함과 재현 절차:
객관적 게이트와 선택적 사용자 피드백 상태:
다음 허용 단계와 막힌 단계:
전후 캡처 경로와 metrics.json 요약(폭 비율·휘도 차·x-height 등 해당 수치):
renderer 플래그 상태(기본값, legacy 경로 e2e 결과):
설계서 대비 편차와 사유:
G1-C 체크리스트(부록 B) 영향 항목과 현재 판정:
~~~

### 0.5 번호 체계

- 단계는 설계서와 같은 **R0–R9**다. 설계서 R0 완료 기준에 따라 v2.1 단계 지도에는 R1→V19 … R9→V27로 등록한다. R0는 V3-00이다.
- 보조 프롬프트는 **X01–X07**이다. v2.1의 보조 프롬프트 R01–R05와 글자가 겹치므로 v3에서는 R이 항상 단계를 뜻한다.
- 서브세션은 `R3-a`처럼 소문자를 붙인다. 보고서의 단계 ID도 서브세션 단위로 쓴다.

### 0.6 설계서 v3.0 대비 이 프롬프트의 보완 사항

설계서와 충돌하지 않는 범위에서 실행 편의를 위해 네 가지를 보완했다. 충돌이 보이면 설계서가 아니라 **이 표를 먼저 의심**하고 BUILD_STATUS에 기록한다.

| # | 보완 | 이유 |
|---|---|---|
| 1 | 캡처 스크립트 `scripts/refactor-capture.ts`를 **R1에서** 먼저 만든다. R9의 `scripts/visual-baseline.ts`는 이 스크립트를 42장 매트릭스로 확장·개명한 것이다 | 설계서 §4 원칙 3(단계마다 전후 캡처)을 R1부터 지키려면 도구가 먼저 필요하다 |
| 2 | R3를 5개, R4를 4개, R8·R9를 2개 서브세션으로 나눈다 | 한 세션에 끝나지 않는 XL 단계의 중간 상태를 보고 가능하게 한다 |
| 3 | 캡처 수치(먼/가까운 변 비율, 책 폭 비율, 휘도 차)를 기존 DEV 전용 `window.__bookInspector`의 `snapshot().layout`으로 자동 계산해 `metrics.json`에 남긴다 | 설계서의 "사람 검사" 수치를 사람이 눈대중으로 재지 않게 한다 |
| 4 | R0에 §7 결정 기록표를 포함하고, 비어 있으면 권장값을 `잠정` 채택한다 | 결정 대기로 세션이 멈추지 않게 한다. 되돌릴 수 없는 결정은 예외(P00 13항) |

---

## 1 P00 공통 실행 계약 v3

모든 세션의 첫 메시지. 단계가 아니다.

~~~text
P00을 적용하라. 이것은 단계가 아니라 이 세션 전체에 걸리는 고정 계약이다. 적용했다고 보고한 뒤 다음 메시지의 단계 블록을 기다려라.

[읽기] 실제 파일을 읽고 추정으로 채우지 마라.
- docs/REFACTOR_DESIGN_V3.md (리팩토링 설계서 v3.0) — 이번 단계의 §6 절과 §2 진단표, §4 보존/수정/교체/삭제 표, 부록 B·C·D
- docs/REFACTOR_PROMPTS_V3.md §1, §5, §6, §7
- docs/CONTRACT_V3.md, docs/IMPLEMENTATION_CONTRACT_V3.md, docs/BUILD_STATUS_V3.md (R0 이후 존재)
- docs/source/design-v2.1.md, docs/source/prompt-v2.1.md 중 이번 단계가 개정하거나 유지하는 조항
- git status, git log -1, git diff --stat. 기준 커밋 4f3111a5de4c40bad2ac6f79aaabe96727e90a96과 다르면 차이를 요약하고 사용자 변경을 보존하라.
- node -v, npm -v. package.json engines(>=24.14.0 <25)와 다르면 기록만 하고 engines를 바꾸지 마라. 의존성은 lockfile 기준 npm ci. 설치 불가면 docs/DEPENDENCY_INSTALL.md를 읽고 미실행으로 남겨라.
- 세션 시작 baseline: npm run typecheck && npm run lint && npm test && npm run build 를 실행해 결과를 기록하라. 이미 실패하는 것과 이 세션에서 새로 깨지는 것을 구분하기 위한 기준이다.

[고정 계약]
1. 목표는 "책 모양 웹앱"을 "원근·조명·인쇄 텍스처·잉크 그림·책 밖 조작바·연출 샷을 가진 3D 책"으로 바꾸는 것이다. 음악 의미(기약분수 음가, onset, C4=MIDI 60, 4/4, 90 BPM, 정확한 기보), 오디오 정지 규칙, 학습 상태·undo/redo, 저장 원문 보호, 책 상태 머신(bookReducer), SceneHost의 토큰·정리 규칙은 바꾸지 않는다.
2. 범위는 src/book/**, src/scenes/**, src/styles/**, src/content/pages/**, docs/**, tests/**, scripts/** 다. src/domain/**, src/lesson/**, src/notation/**의 의미 로직과 src/audio/**(R7 효과음 채널 제외), src/persistence/**(R7·R8 스키마 이관 제외)는 수정하지 않는다. 이 영역의 테스트는 무변경 통과가 필수다.
3. 보존 모듈(설계서 §4 표 '보존' 행: controller.ts, SceneHost.ts, gesture.ts, turnHit.ts, manifest.ts(확장만), useBookAudio.ts, useBookProgress.ts, BookProgressSession.ts, learningProgress.ts, audioOwnership.ts, motion.ts(토큰 추가만))의 export 서명을 바꾸지 마라. 설계서가 명시한 최소 변경(R6 SHOT_*, R8 GO_TO)만 예외다.
4. 플래그 공존: src/book/profile.ts의 BOOK_PROFILE.renderer는 'legacy' | 'ink' 이며 URL ?renderer=legacy 로 바꾼다. R1부터 기본값은 'ink'다. R9 전까지 두 경로가 모두 빌드되고 legacy 경로의 e2e가 통과해야 한다. 새 렌더 코드는 renderer==='ink' 분기 안에만 둔다.
5. 한 번에 하나의 가설. 이번 단계가 바꾸는 시각 가설 하나만 바꾼다. 같은 viewport(1280×720, 844×390, 390×844)·같은 상태·같은 renderer의 전후 캡처를 docs/qa/refactor/R{n}/before/ 와 after/ 에 남기고 metrics.json을 만든다(§5 규약). 캡처 없이 "보기 좋아졌다"고 쓰지 마라.
6. 정본은 음악 데이터다. 인쇄 텍스처·잉크 그림·소리·평가는 모두 같은 LessonState.revision에서 파생한다. 픽셀이나 투영 좌표로 정답을 계산하지 마라.
7. 접근성은 거울로 유지한다. 시각 페이지가 텍스처가 되어도 활성 펼침면의 텍스트·버튼·선택지는 시각 숨김 DOM 거울(AccessibleMirror)로 같은 명령을 보낸다. 2D 읽기 경로(fallback2D, .book-app--2d)의 학습 동등성을 줄이지 마라.
8. 금지: 원본 Every Joule의 번들·텍스처·모델·폰트·음원·문장을 내려받거나 변환해 넣지 마라(설계서 부록 A는 범위 참고일 뿐 목표값이 아니다). 사용자 요청 없는 push·배포·외부 공유·권한 변경 금지. 실패 테스트의 삭제·skip·기대값 수정으로 통과시키지 마라. 미실행을 통과로, headless를 실기기로, 무음 캡처를 청취로 쓰지 마라. 새 런타임 의존성(R3F·GSAP·XState·WebGPU 등) 금지. three/examples/jsm 모듈은 설치된 패키지 안이므로 허용.
9. 유지할 불변식(회귀 금지): v2.1 CI01–03, EN02, BK05–07, BK13–16, MU01–08, AU01–07, RC01–05, AX21. 넘김·드래그 중 카메라 불변. 활성 장면·오디오 세션 최대 1개. 이 중 하나라도 회귀하면 단계를 통과로 쓰지 말고 먼저 고쳐라.
10. 수치는 설계서 부록 D의 초기값으로 시작한다. 제안값이지 실측이 아니므로 캡처 측정 뒤 조정할 수 있고, 조정값과 이유를 BUILD_STATUS에 남긴다.
11. 문서 충돌은 다음 순서로 푼다: 이 세션의 새 사용자 지시 > docs/CONTRACT_V3.md(R0 개정 C1–C12와 결정 기록) > 설계서 v3.0 > v2.1 계약 중 개정되지 않은 조항 > v1 음악 의미. 결정 이유를 남기고 사용자 명시 요구를 조용히 삭제하지 마라.
12. 보고는 docs/BUILD_STATUS_V3.md에 §0.4 양식(14줄)으로 쓴다. "작성됨·미실행", "headless 통과", "실기기 통과", "사람 승인"을 구분한다.
13. 질문 정책: 선택적 디자인 승인을 반복해서 묻지 마라. §7 결정 기록표가 비어 있으면 권장값을 '잠정'으로 채택하고 기록하라. 되돌릴 수 없는 결정(파일 삭제, 저장 스키마 이관, 폰트 라이선스 채택, 사용자 PC 설정 변경)만 멈추고 물어라.
14. 세션 종료 전 §0.3 체크리스트를 모두 통과하라. 통과하지 못한 항목이 있으면 상태를 '일부 완료'로 쓰고 다음 단계로 가지 마라.
~~~

**잘못 적용했을 때**

~~~text
P00 적용 전에 코드를 바꿨으면 멈추고 git diff를 사용자 변경과 구분해 목록화하라. 파괴적으로 되돌리지 마라. baseline을 지금 실행해 기록하고, 이미 바꾼 것이 이번 단계 범위 밖이면 별도 커밋 후보로 분리해 보고하라.
~~~

---

## 2 단계 지도와 보고 계약

| ID | 지도 번호 | 이름 | 규모·세션 | 선행 | 핵심 산출물 | 다음 단계의 문턱 |
|---|---|---|---|---|---|---|
| R0 | V3-00 | 계약 개정 | S·1 | — | CONTRACT_V3, IMPLEMENTATION_CONTRACT_V3, BUILD_STATUS_V3, 결정 기록 | 12조항·6결정 기록 |
| R1 | V19 | 원근 카메라 리그 | M·3–5 | R0 | profile.ts, render/cameraRig.ts, homography, 캡처 스크립트 | anchorErrorPx ≤ 0.5, 먼/가까운 변 0.86–0.92 |
| R2 | V20 | 종이·조명·환경·후처리 | M·3–5 | R1 | render/paperMaterial·spreadSurface·environment·postPipeline | 휘도 차 3–8%, handoff 점프 ≤ 1 px |
| R3 | V21 | 캔버스 페이지 인쇄 시스템 | XL·a–e | R1 | print/* 8파일, content/pages/*, AccessibleMirror | 3D 모드 페이지 안 HTML 0, x-height ≥ 7 px |
| R4 | V22 | 잉크 그림 시스템 + 음가 그림 | XL·a–d | R1 (R3과 병렬) | figures/* 6파일, lessonScene 교체 | 선 폭 1.2–1.6 px, 펜 reveal + lift, 의미 테스트 통과 |
| R5 | V23 | 조작부 재배치 | M·3–5 | R3 | ui/Toolbar·RecordsDialog, 인쇄형 버튼·플랩·도장 | 책 안 button은 거울·표지·조작바뿐 |
| R6 | V24 | 레슨 카메라 연출(샷) | M·3–4 | R1, R4, R5 | render/shots.ts, controller camera:'shot' | 복귀 오차 0, 샷 중 NEXT는 pending |
| R7 | V25 | 효과음·마감 | S·2 | R5 | sfx/*, AudioEngine playSfx, preferences.sfx | 피크 ≤ −6 dBFS, sfx=false에서 노드 0 |
| R8 | V26 | 콘텐츠 확장 | L·a–b | R3, R4, R5 | 6 펼침면 + 목차 + 마침, GO_TO 다중 잎 | MU/AU 전부 통과, 텍스처 ≤ 48 MB |
| R9 | V27 | 검증 관문 개편·정리 | M·a–b | 전 단계 | BOOK_EXPERIENCE_GATE_V3, visual-baseline, perf-budget, 레거시 삭제 | 정체성 5항목 불일치 0 |

의존 그래프와 병렬 규칙은 설계서 §10과 같다. 임계 경로 R0 → R1 → R3 → R5 → R8 → R9. R2 ∥ R3 ∥ R4는 모듈이 독립이므로 병렬 가능하지만 `stage.ts` 통합은 R2 → R4 순서로만 한다(X05 참조). **중단 규칙:** 어떤 단계든 P00 9항의 불변식이 회귀하면 다음 단계로 가지 않는다.

---

## 3 단계별 프롬프트

각 단계는 **선수 → 산출물 → 수용 기준 → 메인 프롬프트 → 사람 검사 항목 → 실패 시 수정** 순서다. 메인 프롬프트의 번호 순서는 작업 순서다.

---

### 3.0 R0 (V3-00) 계약 개정

**선수:** 없음. 설계서·프롬프트 파일이 `docs/`에 있음.
**산출물:** `docs/CONTRACT_V3.md`, `docs/IMPLEMENTATION_CONTRACT_V3.md`, `docs/BUILD_STATUS_V3.md`, `docs/qa/refactor/README.md`.
**수용 기준:** 코드 변경 0. 12조항과 6결정이 기록되고 v2.1 단계 지도에 V19–V27이 등록된다.

~~~text
R0만 수행하라. 이 단계는 문서 단계다. src/ 아래를 바꾸지 마라. docs/source/design-v2.1.md 와 prompt-v2.1.md 는 수정하지 말고 보존하라.

1. docs/CONTRACT_V3.md 를 만들어라. 내용은 다음 순서다.
   a. 머리말: 기준 커밋, 설계서 v3.0 경로, "v2.1 계약 중 아래 C1–C12로 개정하지 않은 조항은 그대로 유효"라는 문장.
   b. 개정 조항 C1–C12: 설계서 §6 R0 표를 그대로 옮기되 각 조항에 [v2.1 원문 위치] [v3 개정문] [근거(D번호)] [적용 단계] 네 칸을 둔다. 요약하지 말고 설계서 표의 문장을 그대로 써라.
      C1 BOOK-ONLY → BOOK-FIRST(하단 한 줄 조작바 ≤ 56 px만 허용, HUD·토스트·대시보드·탭·상시 재생바 금지 유지)
      C2 책상 면·매트·환경 반사 허용, 소품 금지 유지
      C3 모든 페이지는 인쇄 텍스처, DOM은 접근성 거울로만
      C4 읽기 포즈 고정 + 사용자가 시작한 샷 허용, 넘김·드래그·닫기 중 샷 금지, 복귀 오차 0
      C5 원근 카메라 필수 FOV 30–34°, 고도각 52–62°, 직교 금지
      C6 durationWorld 재사용 범위를 의미(durationBounds, raycast, setEvents/setHighlight/setPosition)로 한정
      C7 종이 재질·조명·AO·비네트를 정체성 항목으로 승격, 저사양 티어 축소 허용
      C8 절차 합성 효과음 기본 켬(결정 2에 따름)
      C9 EDGE-NAV 책갈피를 조작바로 대체, 모서리 직접 드래그 필수 유지(결정 1에 따름)
      C10 G1-C 차단 관문: 정체성 5항목 불일치 시 확장·배포 금지
      C11 펼침면 투영 폭 70–85%
      C12 음가 블록 등장 = 평면 투영→입체 보간 + 펜 그리기, 세로 scale 금지
   c. 사용자 결정 기록: docs/REFACTOR_PROMPTS_V3.md §7 표의 6항목을 옮겨 적고 사용자가 적은 답을 넣어라. 비어 있으면 권장값을 '잠정'으로 적고 "사용자 미확인"이라고 표시하라. 6번(원본 녹화)은 기본값이 없으므로 '미제공'으로 쓴다. 결정 1·2·3·4·5의 답이 C8·C9·R2·R3·R6의 문장에 반영되게 조항 본문을 고쳐라.
   d. 유지 불변식 목록: P00 9항을 ID별로 나열하고 각 ID가 어느 테스트 파일로 검사되는지 tests/ 를 실제로 읽어 연결하라. 테스트가 없는 ID는 "사람 검사"로 표시하라.

2. docs/IMPLEMENTATION_CONTRACT_V3.md 를 만들어라. docs/REFACTOR_PROMPTS_V3.md §1 P00 본문을 그대로 넣고, 맨 위에 "이 파일은 IMPLEMENTATION_CONTRACT_V2.md를 대체하지 않으며 v3 리팩토링 세션에만 추가 적용된다"고 써라.

3. docs/BUILD_STATUS_V3.md 를 만들어라. 머리에 §2 단계 지도 표(R0=V3-00, R1=V19 … R9=V27, 서브세션 포함)를 넣고, 각 행에 상태 칸(미착수/진행/통과/실패/일부 완료/외부 검수 대기)을 둔다. 그 아래 §0.4 보고 양식 14줄을 빈 템플릿으로 한 번 적고, R0 항목을 실제로 채워라. docs/BUILD_STATUS_V2.md 끝에는 "v3 리팩토링 보고는 BUILD_STATUS_V3.md로 이어진다"는 한 줄만 추가하라.

4. docs/qa/refactor/README.md 를 만들어라. 내용은 docs/REFACTOR_PROMPTS_V3.md §5 캡처·증거 규약 전문과 폴더 구조(R1/ … R9/, 각 before/ after/ metrics.json, index.md)다. 폴더는 R1에서 만든다.

5. 보고하라. 코드 변경 0, 테스트 실행 결과(baseline), 결정 기록 중 잠정 항목 수, 다음 허용 단계 R1.
~~~

**사람 검사 항목**
- `CONTRACT_V3.md`의 C1–C12 문장이 설계서와 같은가(요약·완화되지 않았는가).
- 결정 기록표의 답이 내가 적은 대로인가. 잠정 항목이 있으면 지금 답을 적어 R1 전에 확정한다.

**실패 시 수정**

~~~text
R0 산출물만 고쳐라. 조항을 요약하거나 완화한 곳을 설계서 §6 R0 표의 원문으로 되돌려라. src/ 변경이 있었으면 사용자 변경과 구분해 보고하고 되돌릴지 물어라. 결정 항목을 에이전트가 임의로 '확정'이라고 쓴 곳은 '잠정'으로 고쳐라.
~~~

---

### 3.1 R1 (V19) 원근 카메라 리그

**선수:** R0 통과.
**산출물:** `src/book/profile.ts`, `src/book/render/cameraRig.ts`, `src/book/pageProjection.ts`(homography), `stage.ts`·`BookApp.tsx`·`navigationPlacement.ts` 수정, `tests/book-camera-rig.test.ts`, `tests/book-page-projection.test.ts` 재작성, `scripts/refactor-capture.ts`, `docs/qa/refactor/R1/`.
**수용 기준:** 5 viewport에서 `anchorErrorPx ≤ 0.5`, 모든 fit 점이 safe 안, 1280×720·844×390 캡처에서 먼/가까운 변 비율 0.86–0.92, 책 폭 비율 70–85%. CI01–03 회귀 없음.

~~~text
R1만 수행하라. 바꾸는 시각 가설은 하나다: 직교 카메라 → 원근 카메라. 종이 재질·조명·페이지 내용·조작부는 건드리지 마라. 설계서 §6 R1과 §2의 D1을 읽어라.

0. 먼저 캡처 도구를 만들어라(설계서 §4 원칙 3을 R1부터 지키기 위한 보완 1).
   scripts/refactor-capture.ts: Playwright chromium, 기존 scripts/http-e2e.ts와 같은 로컬 전용 규칙(127.0.0.1, 외부 요청 차단, executablePath 환경변수)을 따른다. CLI 인자 --stage R1 --phase before|after --renderer legacy|ink --base http://127.0.0.1:4173/ .
   상태 전이는 UI를 실제로 조작하지 말고 DEV 전용 window.__bookInspector.pose(...)로 만든다: cover={coverProgress:0, introProgress:1}, opening50={coverProgress:0.5}, spread1={coverProgress:1, currentSpreadIndex:0, turn:null}, turn50={turn:{direction:'forward', progress:0.5, corner:'bottom'}}, spread2={currentSpreadIndex:1}. pose 호출 뒤 requestAnimationFrame 두 번을 기다리고 찍어라(inspector 주석대로 즉시 layout은 이전 프레임일 수 있다). 2d 상태는 ?mode=2d 또는 reading-mode 버튼으로 만든다.
   viewport 3개: 1280×720, 844×390, 390×844. 파일명 {W}x{H}_{state}_{renderer}.png, 저장 위치 docs/qa/refactor/R1/{phase}/.
   metrics.json: 각 캡처마다 __bookInspector.snapshot().layout에서 farWidth=|right.tr.x−left.tl.x|, nearWidth=|right.br.x−left.bl.x|, farNearRatio, bookWidthRatio=(bookBounds.right−bookBounds.left)/width, coverCenterErrorPx, camera 를 기록한다. 휘도는 캡처 PNG를 같은 페이지에 data URL로 올려 2D 캔버스 getImageData로 읽는다(새 의존성 없음): 왼쪽 quad 중심·오른쪽 quad 중심·책등(left.tr/left.br과 right.tl/right.bl 중점의 평균) 9×9 px 평균 휘도(Rec.709). R1에서는 기록만 하고 판정하지 않는다.
   이 스크립트는 lint·typecheck 대상이다. 먼저 현재 코드(직교)로 --phase before --renderer legacy 를 찍어라. 이것이 R1의 before다.

1. src/book/profile.ts 를 만들어라.
   export type RendererKind = 'legacy' | 'ink'; export type QualityTier = 'high' | 'medium' | 'low';
   export const BOOK_PROFILE: Readonly<{ renderer: RendererKind; quality: QualityTier }> — URL ?renderer=legacy 가 있으면 legacy, 없으면 ink. quality는 R2에서 채우되 지금은 설계서 §6 R2 (4)의 휴리스틱(dpr·canvasPx > 2.4M 또는 hardwareConcurrency ≤ 4 → medium, 모바일 UA → low)을 함수 pickQualityTier()로 미리 구현하고 기본값은 high.
   테스트 가능하도록 URL·navigator를 인자로 받는 순수 함수 resolveProfile(search: string, nav: {hardwareConcurrency?, userAgent}, dpr, canvasPx)를 export하라.

2. src/book/render/cameraRig.ts 를 만들어라. 설계서 §6 R1 (1)(2)의 서명과 알고리즘을 그대로 구현하라.
   - RigPose {elevationDeg, azimuthDeg, fovDeg}, READING_POSE = {58, 0, 32}, COVER_POSE = READING_POSE (v2.1 6-A: 표지와 펼침면 같은 방향).
   - createCameraRig(): CameraRig { camera: PerspectiveCamera; fit(input): FitResult; blendTo(...) }. blendTo는 R6용 자리만 만들고 지금은 throw 하지 말고 no-op + TODO 주석.
   - fit: dir=(sin a·cos e, sin e, cos a·cos e). 쿼터니언은 lookAt(-dir)로 한 번 만들고 고정(드래그·넘김 중 회전 없음). worldPerPixel(d)=2·d·tan(fov/2)/viewport.height. cameraTarget = anchor − right·(target.x−W/2)·wpp(d) + up·(target.y−H/2)·wpp(d). position = cameraTarget + dir·d. d는 [0.5·책 대각선, 60]에서 이분 탐색 28회(모든 points를 project해 safe 안이면 줄이고 밖이면 늘림), 결과에 1.018 여유. near = max(0.05, d − 책대각선), far = d + 책대각선·2. introBlend(0→1)는 stage.ts:457–467의 현재 오프셋·거리 배율 로직을 옮겨라.
   - FitResult {distance, cameraTarget, worldPerPixelAtAnchor, anchorErrorPx}. anchorErrorPx는 fit 후 anchor를 다시 project해 target과의 거리로 계산하라.
   - 순수 계산이므로 node --test에서 Three 객체만으로 돌아가야 한다. DOM·WebGL 참조 금지.

3. src/book/stage.ts 를 수정하라. renderer==='ink'일 때만 cameraRig를 쓰고, 'legacy'는 현재 OrthographicCamera 경로를 그대로 둔다(R9에서 삭제).
   - 현재 new OrthographicCamera(-5,5,3,-3,0.1,40) 생성부(stage.ts:115 부근)와 fitCamera/fitOpenScale/fitScale/fitPoints를 분기하라. 직교 전용 openProjected 박스는 ink 경로에서 쓰지 말고 openPoints(책 bounds 8점 + 넘김 잎 궤적 65×5×25 샘플 중 외곽 샘플 ≤ 400점)를 미리 만들어 fit에 넘겨라. 점집합은 resize·intro 외에는 캐시하라.
   - project()·pageQuad()·pointerProjection()·pickScene()은 camera.project / Raycaster.setFromCamera 를 쓰므로 그대로 두되 카메라 객체만 분기 결과로 바꿔라.
   - StageLayout.camera에 fov, distance, worldPerPixelAtAnchor를 추가하라(span은 legacy 호환으로 남겨라).
   - 드래그 중·넘김 중에는 fit을 호출하지 않는 현재 규칙(suspendFit)을 유지하라. pinch 확대(visualViewport.scale) 시 fit 중지도 유지하라(6-B).

4. src/book/pageProjection.ts 를 homography로 바꿔라(과도기, R3에서 제거). 설계서 §6 R1 (4)의 pageStyle(quad, width, height) → matrix3d 구현. homography()는 DLT 8×8 선형계를 가우스 소거로 풀고 행렬식 < 1e-9면 null. null이면 visibility:hidden. legacy 경로는 기존 affine matrix()를 유지하라(함수를 둘로 두고 profile로 선택).

5. src/book/BookApp.tsx 의 printSize(114–120행 부근)를 사다리꼴 기준으로 바꿔라: width = max(|tr−tl|, |br−bl|), height = max(|bl−tl|, |br−tr|). src/book/navigationPlacement.ts 는 바깥 변의 중점을 쓰도록 고쳐라(R5에서 삭제되므로 최소 수정).

6. 테스트.
   - tests/book-camera-rig.test.ts (신규): viewport 844×390, 667×375, 568×320, 390×844, 360×640 각각 + 비대칭 safe-area(left 44, right 0, top 0, bottom 34)에서 anchorErrorPx ≤ 0.5, 모든 fit 점이 safe 안, 이분 탐색이 28회 안에 수렴(상·하한 차 < 1e-4), near < far, introBlend 0과 1에서 결과가 연속(거리 차 < 1e-6 · blend 차). 책 대각선·anchor·points는 geometry.ts의 BOOK_DIMENSIONS에서 만든다.
   - tests/book-page-projection.test.ts (재작성): homography가 네 모서리를 ≤ 1e-6으로 매핑, 내부점 (0.5,0.5)의 상이 쌍선형 보간이 아니라 원근 보간 위치(대각선 교점)에 있음, 퇴화 입력(세 점 일직선)에서 null, legacy affine 함수는 기존 기대 그대로.
   - 기존 book-geometry, book-controller, book-turn-hit, book-gesture 등은 무변경 통과.

7. 캡처: --phase after --renderer ink 와 --renderer legacy 를 모두 찍어라. metrics.json의 farNearRatio가 1280×720·844×390의 spread1·spread2에서 0.86–0.92, bookWidthRatio 0.70–0.85, coverCenterErrorPx ≤ 2 인지 확인하라. 벗어나면 READING_POSE의 fovDeg(30–34)·elevationDeg(52–62) 범위 안에서만 조정하고 값을 기록하라. 범위 밖이 필요하면 조정하지 말고 보고하라.

8. 회귀: npm test 전부, scripts/keyboard-e2e.ts·quiz-e2e.ts 를 renderer=legacy와 ink 둘 다로 실행(환경이 허용하면). CI01(표지 UV 중앙 오차 ≤ 2 px)·CI02(넘김 25/50/75% 실루엣 safe 안)·드래그 중 카메라 불변을 ink 경로에서 확인하라.

9. 보고하라. 설계서 대비 편차 줄에 "HTML 겹침 글자가 원근 변환으로 흐려짐(R3에서 해소)"을 알려진 과도기 결함으로 적어라.
~~~

**사람 검사 항목(캡처 `docs/qa/refactor/R1/after/`)**
- `1280x720_spread1_ink.png`: 책이 도면이 아니라 입체로 보이는가. 먼 변이 가까운 변보다 좁은가(metrics farNearRatio 0.86–0.92).
- `844x390_spread1_ink.png`: 책이 잘리지 않고 폭 70–85%인가.
- `*_turn50_ink.png`: 넘김 잎이 safe 밖으로 나가지 않는가.
- 표지(cover)가 화면 중앙에 있는가(coverCenterErrorPx ≤ 2).
- 과도기 HTML 글자 흐림은 **통과 조건이 아님**(R3 해소).

**실패 시 수정**

~~~text
R1에서 실패한 [정확한 항목: anchorErrorPx / safe 밖 점 / 비율 범위 / CI01 / 드래그 중 카메라 이동]만 고쳐라. fit 실패를 FOV를 범위 밖으로 키우거나 safe rect를 줄여서 감추지 마라. 이분 탐색 상·하한과 points 집합을 먼저 검사하라. 수정 후 같은 viewport·상태·renderer로 다시 찍고 metrics.json을 갱신하라. before 캡처는 지우지 마라.
~~~

---

### 3.2 R2 (V20) 종이·조명·환경·후처리

**선수:** R1 통과.
**산출물:** `src/book/render/paperMaterial.ts`, `spreadSurface.ts`, `environment.ts`, `postPipeline.ts`, `geometry.ts`·`stage.ts`·`profile.ts` 수정, `tests/book-spread-surface.test.ts`, `docs/qa/refactor/R2/`, `docs/qa/refactor/R2/known-offset.md`.
**수용 기준:** 1280×720 캡처에서 펼침면 좌우 휘도 차 3–8%, 책등 홈 음영, 넘김 50%에서 잎 그림자, 책상·매트 보임. handoff 점프 ≤ 1 px. 세 티어에서 composer 초기화·dispose 후 `renderer.info.memory` 증가 0.

~~~text
R2만 수행하라. 바꾸는 가설은 "종이가 빛을 받고 휘어 있으며 책상 위에 놓여 있다"이다. 페이지 내용·조작부·그림은 건드리지 마라. 설계서 §6 R2, §2 D2·D8, 부록 D의 종이·조명·후처리 행을 읽어라. 결정 3(책상 질감)의 답을 CONTRACT_V3에서 읽어라.

전부 renderer==='ink' 분기 안에서만 한다. legacy는 MeshBasicMaterial·AmbientLight·단색 배경 그대로.

1. src/book/render/paperMaterial.ts: 설계서 §6 R2 (1) 코드대로 createPaperMaterial({paper, roughness}). MeshStandardMaterial(color '#ffffff', roughness 0.94, metalness 0), map=placeholderWhite(1×1 흰색, vMapUv 확보), onBeforeCompile로 map_fragment를 교체해 albedo = uPaper·mix(0.965,1,fiber)·ink, albedo = mix(albedo, state.rgb, state.a). uFiber는 256² 값 노이즈 2옥타브 절차 생성 타일(RepeatWrapping). setPrint(t)·setState(t)를 붙여 돌려줘라. state 기본은 투명 1×1. toneMapped:false를 제거하라. 표지 앞면(VerifiedFrontArtwork)은 MeshStandardMaterial({map: cover, roughness 0.6})로 조명만 받고 잉크 곱은 하지 않는다.
   print 텍스처가 아직 HTML 스냅샷(usePagePrints)이므로 흰 바탕·검정 잉크 가정이 맞는지 pageSnapshot의 배경색을 확인하라. 바탕이 종이색이면 R2에서는 스냅샷 배경을 흰색으로 바꾸고 종이색은 셰이더가 곱하게 하라(R3에서 어차피 교체).

2. src/book/geometry.ts: SPREAD_PROFILE {spineDip 0.022, bulge 0.034, edgeDroop 0.006, columns 32, rows 8}과 spreadHeight(u)를 설계서 식 그대로 추가. createSpreadPageGeometry(width, height): 32×8 그리드, Y=spreadHeight(u), computeVertexNormals. 왼쪽 페이지는 rotation.z=π이므로 같은 함수. leafPoint에 y += spreadHeight(u)·window(p), window(p) = 1 − smoothstep(0,0.06,p) (출발 쪽) 와 smoothstep(0.94,1,p) (도착 쪽)로 양 끝에서 정지 페이지와 정확히 일치. 중간 구간의 호 길이 보존 적분은 그대로. createStackGeometry: 페이지 묶음 상면을 같은 프로필 그리드로, 앞 가장자리(fore-edge)는 얇은 층 12–16개 미세 단차 + 밝기 교차. createFlatPageGeometry는 legacy용으로 남겨라.

3. src/book/render/spreadSurface.ts: 정지 펼침면 좌·우 메시 + 스택 메시를 만들고 paperMaterial을 붙이는 조립 모듈. stage.ts가 지금 직접 만드는 정지 페이지 메시 생성부를 여기로 옮겨라(ink 분기).

4. src/book/render/environment.ts: scene.background '#b8b0a3'. scene.environment = PMREMGenerator.fromScene(new RoomEnvironment(), 0.04).texture, environmentIntensity 0.55. 책상 30×30 평면 MeshStandardMaterial({map: deskTexture(1024, 절차 생성 — 결정 3: 리넨 또는 나뭇결), roughness 0.8}). 매트: ExtrudeGeometry 둥근 사각형 1.25×책 크기, 두께 0.02, '#6f6a62', roughness 0.95. 주광 SpotLight('#fff4e4', 3.4) @(-3.2, 7.5, 3.0), angle 0.6, penumbra 0.7, shadow map 2048(데스크톱)/1024(모바일·low), normalBias 0.02, radius 2.5, PCFSoftShadowMap. 보조 HemisphereLight('#dfe8f4','#cbb08c',0.35). AmbientLight 제거(ink). 톤매핑 NeutralToneMapping, exposure 1.0(현재 ACES 1.1은 legacy에만). ContactShadowDesk는 매트 위 접촉 그림자로 유지, opacity 0.14. 책 외 소품(펜·컵 등)은 만들지 마라(C2).

5. src/book/render/postPipeline.ts: EffectComposer(renderer) → RenderPass → GTAOPass(radius 0.18·책 단위, distanceExponent 1, scale 1, samples 12) → SMAAPass → ShaderPass(VignetteShader offset 0.95, darkness 0.38) → OutputPass. 티어: high 전부, medium GTAO 제외, low 후처리 없음(renderer.antialias 유지, 그림자 1024). setSize(width, height, dpr)·dispose()를 제공하고 demand 렌더링(invalidate 때만 composer.render)을 유지하라. profile.ts의 quality를 실제로 연결하라.

6. stage.ts: ink 분기에서 render() = applyObjects → cameraRig.apply → postPipeline.render. resize 시 composer·GTAO·SMAA setSize. dispose에서 composer·PMREM·텍스처 해제.

7. 테스트 tests/book-spread-surface.test.ts: leafPoint(p=0)와 createSpreadPageGeometry 표면의 25×5 샘플 차이 ≤ 1e-6, p=1도 동일(좌측 미러). 모든 종이 법선이 +Y 반구(normal.y > 0). createStackGeometry 상면이 spreadHeight와 일치. 세 티어에서 postPipeline 생성·setSize·dispose 후 renderer.info.memory.{geometries,textures} 증가 0 — WebGL이 없는 node에서는 composer 생성이 불가하므로 이 검사는 scripts/stability-http-e2e.ts 양식의 Playwright 검사로 분리하고 단위 테스트에서는 티어 선택 함수만 검사하라. 분리했다는 사실을 보고하라.

8. 캡처: R2 before = R1 after(복사하지 말고 경로를 index.md에 링크). after를 ink로 찍고 metrics.json 휘도 항목으로 좌우 휘도 차 3–8%를 확인하라. 범위 밖이면 조명 강도·환경 강도만 조정(종이 색·톤매핑은 고정)하고 값을 기록하라. turn50 캡처에서 잎 그림자가 아래 페이지에 보이는지 사람 검사 항목으로 넘겨라.

9. known-offset: 곡면 도입으로 R1 homography 내부 오차가 생긴다(최대 bulge×투영 ≈ 3–5 px). spread1에서 페이지 중앙 글자의 HTML 위치와 종이 위치 차이를 캡처 확대로 재서 docs/qa/refactor/R2/known-offset.md에 수치로 적어라. R3 전까지 허용이며 통과 조건이 아니다.

10. 표지 원화 색: 톤매핑 변경 후 표지 캡처와 원화(public/cover 변환 사본)의 평균 색 차이를 기록하라(ΔE ≤ 6 목표). 표지 재질은 toneMapped 유지.

11. 회귀: handoff(정지 페이지 ↔ 넘김 잎) 네 모서리·오선 baseline 점프 ≤ 1 px을 turn 0.0/0.02/0.98/1.0 캡처로 확인. depthTest/depthWrite 기본 유지, 그림자 acne를 depthTest=false로 덮지 마라. legacy e2e 재실행.
~~~

**사람 검사 항목(`docs/qa/refactor/R2/after/`)**
- 종이가 빛을 받는가. 책등 쪽이 살짝 어둡고(홈), 중간이 배부른가.
- `*_turn50_ink.png`: 넘어가는 잎의 그림자가 아래 페이지에 떨어지는가.
- 책상과 매트가 보이되 소품이 없는가. 배경이 단색 벽 톤인가.
- 표지 색이 원화와 크게 달라지지 않았는가.
- HTML 글자가 종이에서 몇 px 떠 있는 것은 **알려진 과도기 결함**(known-offset.md)이며 통과 조건이 아님.

**실패 시 수정**

~~~text
R2에서 실패한 [항목: 휘도 차 범위 / 책등 홈 안 보임 / handoff 점프 / 메모리 증가 / 표지 색 / 티어]만 고쳐라. 휘도 차를 맞추려고 종이 색이나 톤매핑을 바꾸지 말고 조명·환경 강도만 조정하라. handoff 점프는 window(p) 양 끝 블렌드와 createStackGeometry 상면을 먼저 검사하라. 수정 후 같은 상태로 다시 찍어라.
~~~

---

### 3.3 R3 (V21) 캔버스 페이지 인쇄 시스템 — 서브세션 a–e

**선수:** R1 통과(R2와 병렬 가능하나 `stage.ts` 통합(R3-d)은 R2 뒤).
**산출물:** `src/book/print/*` 8파일, `src/content/pages/{spread-1,spread-2,index}.ts`, `BookNotation.tsx`에서 `renderNotation()` 추출, 폰트 번들 스크립트, `BookApp.tsx`·`stage.ts` 통합, 거울 DOM, e2e 셀렉터 수정, `docs/qa/refactor/R3/`.
**수용 기준:** 3D 모드 DOM에 `.book-page` 시각 요소 0개. 1280×720 본문 x-height ≥ 7 px, 844×390 ≥ 5.5 px. 분할 10회 연속 draft 갱신 ≤ 60 ms. settled 교체 jump 0. 기존 quiz/keyboard/notation e2e가 거울 기준으로 통과.

#### R3-a 페이지 DSL · 배치 · 페인트(통합 없음)

~~~text
R3-a만 수행하라. 이 서브세션은 순수 모듈만 만든다. stage.ts·BookApp.tsx를 건드리지 마라. 설계서 §6 R3 (1)(2)(3)과 §2 D3을 읽어라. 결정 4(서체)의 답을 CONTRACT_V3에서 읽어라.

1. src/book/print/pageSpec.ts: 설계서 (1)의 타입을 그대로 선언하라(UvRect, PageBlock 13종, PrintedButton, HotspotCommand 8종, PageSpec). LessonCommand·SpreadId·PageId는 기존 타입을 import하라. 타입만 두고 로직을 넣지 마라.

2. src/content/pages/spread-1.ts, spread-2.ts, index.ts: 현재 LessonPages.tsx가 렌더하는 두 펼침면의 문장·질문·버튼·기보 레인을 PageSpec으로 옮겨 적어라. 문장은 src/content/lesson.ts의 원문을 참조하고 새 문장을 짓지 마라. 오른쪽 페이지에 figure 블록(figureId 'duration-lanes' / 'duration-strip', heightRatio는 현재 .book-popup-window 높이 비율을 측정해 적어라)을 둔다. index.ts는 BOOK_MANIFEST의 pageId와 PageSpec을 결합하는 pageSpecFor(pageId)를 export하라. 버튼은 R5에서 추가하므로 지금은 현재 HTML에 있는 조작(듣기·정지·나누기·합치기·되돌리기·다시하기·일시정지)만 PrintedButton으로 옮겨라.

3. src/book/print/pageLayout.ts: layoutPage(spec, dynamic: {lesson: LessonState; playback; hints; answers}, canvas: {width, height}) → PageLayout {items: LaidOutItem[]; hotspots: PageHotspot[]; figureRects: Record<string, UvRect>}. 단 1열 흐름. 여백 상 6% / 좌우 7% / 하 8%. 본문 크기 = 페이지 세로의 1.55%, 제목 2.3%, 러닝헤드 1.0%. 한글 줄바꿈은 Intl.Segmenter('ko', {granularity:'word'})로 단어 단위 채움, 넘치면 자소 단위 분할. 영문·숫자는 단어 단위. 글자 폭 측정은 measureText 콜백을 인자로 받아라(node 테스트에서는 고정 폭 스텁). question 블록은 원형 라디오+라벨, 선택지마다 hotspot(role 'option'). eventList는 음표 수만큼 칸, 2열 그리드, 각 칸 hotspot(role 'note'). 모든 hotspot은 화면 환산 44 px 이상이 되도록 최소 크기를 uv로 계산해 보장하라(canvas 크기와 예상 화면 크기를 인자로). figure 블록은 비운 사각형과 figureRects[figureId]를 남겨라.

4. src/book/print/pagePainter.ts: paintPage(layout, ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, fonts). 배경 흰색(종이색은 셰이더가 곱한다). 잉크 '#252721', 보조 잉크 '#436C7B', 강조 '#B96335'. 인쇄형 버튼은 1.5 px 잉크 둥근 사각형 + 아이콘(SVG path 상수: play/pause/stop/split/merge/undo/redo/look) + 라벨. 플랩은 닫힘 상태에서 접힌 종이 모양(두 겹 음영). notation 블록은 R3-b가 채우므로 자리만 비워 두고 콜백 인자로 받아라. 라디오·eventList·stampSlot 인쇄.

5. 폰트: 결정 4에 따라 OFL 한글 서체 2종을 public/fonts/에 둘 준비를 하되, 파일을 이 세션에서 내려받지 못하면 scripts/extract-page-fonts.mjs(기존 scripts/extract-notation-fonts.mjs 양식, pyftsubset 또는 동등 도구로 KS X 1001 2,350자 + 사용 문자 서브셋, 목표 ≤ 400 KB)와 scripts/font-license-audit.ts 확장만 만들고 "폰트 파일 미확보"를 보고하라. 서체 파일을 사용자에게 요청하라(되돌릴 수 없는 결정: 라이선스).

6. 테스트 tests/print-layout.test.ts: 긴 한글 문단이 여백 안에서 줄바꿈됨(모든 item의 x+w ≤ 1−0.07), 모든 hotspot의 화면 환산 크기 ≥ 44 px(1280×720과 844×390 두 가정), figureRects에 'duration-lanes'가 있고 heightRatio와 일치, question 선택지 수 = hotspot(option) 수, eventList 16개 음표가 2열로 모두 배치됨, 같은 입력에 같은 출력(결정적). 페인트는 node에서 캔버스가 없으므로 호출 기록 스텁 ctx로 "배경 흰색 fillRect가 첫 호출"과 "figure 영역에 그리지 않음"만 검사하라.

7. 보고하라. 통합 없음, 폰트 상태, 다음 R3-b.
~~~

#### R3-b 기보 래스터 · `renderNotation()` 추출

~~~text
R3-b만 수행하라. 설계서 §6 R3 (4)를 읽어라.

1. src/book/BookNotation.tsx에서 비React 함수 renderNotation(events, width, options): NotationDrawing {svg: string; events: RenderedEvent[]; width; height} 를 추출하라. 기존 serializeDrawing(self-contained SVG, 폰트 data URL 포함)을 재사용하라. 기존 React 컴포넌트는 이 함수를 호출하게 바꾸고 2D 경로(LessonPages)에서 계속 쓴다. VexFlow 호출 결과와 RenderedEvent{x,y,w,h, eventId}가 이전과 같은지 tests/book-notation-preparation.test.ts의 기대값으로 확인하라(이 테스트는 legacy 전용이므로 R9까지 살아 있다).

2. src/book/print/notationRaster.ts: rasterNotation(drawing, target: {ctx, rect: UvRect, canvasSize}) — SVG를 Blob/data URL → Image 디코드 → drawImage. 음표별 RenderedEvent를 페이지 uv로 변환해 hotspot(role 'note', eventId)으로 돌려줘라. 선택·재생 강조는 여기서 그리지 말고(R3-c state 레이어) 위치만 돌려줘라. 폰트 준비는 기존 ensureBookNotationReady()를 그대로 쓴다.

3. pagePainter의 notation 콜백에 연결하라. 아직 stage 통합은 없다.

4. 테스트: tests/print-notation-raster.test.ts — uv 변환이 rect 안에 있음, eventId 순서가 onset 순서, drawing.width 비율이 유지됨(비율 왜곡 없음). 디코드는 node에서 불가하므로 Image 로더를 주입 인자로 받아 스텁으로 검사하라.

5. 보고하라.
~~~

#### R3-c 합성기 · 핫스폿 · 상태 레이어

~~~text
R3-c만 수행하라. 설계서 §6 R3 (5)(6)을 읽어라. stage·BookApp 통합은 아직 하지 마라.

1. src/book/print/pageCompositor.ts: createPageCompositor({renderer?: WebGLRenderer; measureText; imageLoader}) → { request(pageId, lessonRevision, presentationKey, size: 'draft'|'settled'): PageTextures; ready(spreadId): boolean; refresh(); dispose() }.
   - 키 (pageId, lessonRevision, presentationKey, size). print 텍스처는 불변. 캐시 LRU 8장.
   - 해상도: draft 768×1086, settled 1536×2172(데스크톱) / 1280×1810(모바일·low 티어). generateMipmaps 켬, anisotropy 8(renderer.capabilities.getMaxAnisotropy()로 상한).
   - 텍스처 메모리 예산 ≤ 48 MB: 추정식 width×height×4×1.33(밉맵)을 합산해 초과 시 LRU 제거. 현재 사용량을 stats()로 노출.
   - 편집(split/merge/undo) → draft를 동기(목표 ≤ 60 ms)로 갱신, settled는 requestIdleCallback(없으면 setTimeout 0)에서 비동기 교체. 두 해상도는 같은 PageLayout 좌표를 쓴다(해상도만 다름). 교체 시 Texture 객체를 바꾸지 말고 같은 CanvasTexture의 image를 바꾸고 needsUpdate — 정지 페이지와 넘김 잎이 같은 텍스처 객체를 공유하므로 교체 jump가 0이다.
   - ready(spreadId): 해당 펼침면 두 페이지의 draft 이상이 준비됐는지. BookApp의 waitingForPrint·printMotionReady는 R3-d에서 이 값으로 바꾼다.
   - Performance.mark('print:draft:start'/'end')를 남겨라.

2. src/book/print/hotspots.ts: 페이지당 RGBA 상태 캔버스 512×724. drawState(pageId, state: {selected, playing, focus, pressed, radio, flapOpen, stamps}) → CanvasTexture. hitTest(pageId, uv) → PageHotspot | null (배치 단계가 보장한 44 px 사각형). pressed는 0.12 알파 잉크, 포커스 링 2 px 강조색, 선택 음표 테두리, 재생 중 음표 점선, 라디오 채움, 도장. 플랩 열림 상태의 인쇄는 print 두 장(닫힘/열림)을 캐시 키 presentationKey로 구분한다.

3. src/book/print/usePageCompositor.ts: React 훅. usePagePrints와 같은 반환 모양 {textures, stateTextures, ready, generation, refresh}를 유지해 R3-d에서 BookApp의 소비처 변경을 최소화하라. 입력은 {lesson, playback, hints, answers, presentationKey, size, enabled}. 편집 revision 변화 → draft 동기 갱신 → settled 비동기.

4. 테스트 tests/print-compositor.test.ts: 캐시 키 구분, LRU 9번째 요청에서 가장 오래된 것 제거, 예산 초과 시 제거, draft와 settled의 layout 좌표 동일, 같은 revision 재요청은 캐시 히트(페인트 호출 0). tests/hotspots.test.ts: hitTest 경계(사각형 안/밖/모서리), pressed 상태 그리기 호출, 두 페이지 상태 독립. WebGL이 없는 node에서는 CanvasTexture 생성을 주입 팩토리로 대체하라.

5. 보고하라.
~~~

#### R3-d stage·BookApp 통합 · 접근성 거울 · e2e

~~~text
R3-d만 수행하라. 설계서 §6 R3 (6) 입력 경로, (7) 거울, (8) 2D 경로를 읽어라. R2가 통과했는지 확인하라(paperMaterial.setState가 필요하다). renderer==='ink' 분기 안에서만 통합한다.

1. stage.ts: setPageTextures(pageId, print, state)로 확장해 paperMaterial.setPrint/setState에 연결하라. 그림 창(setSceneWindow)은 .book-popup-window DOM 측정 대신 PageLayout.figureRects[figureId]를 uv→월드로 바꿔 쓰도록 하라. 왼쪽 페이지용 pointerProjectionLeft(x, y)를 추가하라.

2. BookApp.tsx: ink 분기에서 usePagePrints → usePageCompositor로 교체하고 .book-paper-dom(정지 페이지 HTML 겹침)을 렌더하지 마라. 넘김 준비 barrier(waitingForPrint, printMotionReady)는 compositor.ready(spreadId)로 소스만 바꿔라. 입력 라우팅: onPointerDownCapture에서 turnCornerAtPoint(모서리) → 아니면 stage.pointerProjection / pointerProjectionLeft → hotspots.hitTest → pressed 표시 → pointerup이 8 px 이내면 HotspotCommand 실행(lesson → dispatch LessonCommand, play/pause/resume/stop → 기존 useBookAudio 경로, flap/shot/contents는 R5/R6/R8까지 no-op + 로그). 그림 영역 안이면 기존 pickScene. 명령은 모두 기존 LessonCommand/BookEvent다 — 새 상태 경로를 만들지 마라.

3. src/book/print/AccessibleMirror.tsx: 활성 펼침면의 PageLayout을 DOM으로 복제. h1 tabIndex=-1, p, button, input type=radio, ol>li>button aria-pressed(음표 목록). 시각 숨김(position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%))이되 inert가 아니고 포커스 가능. 포커스 이동 시 해당 핫스폿을 state 레이어 포커스 링으로 그려라(AX21). 비활성 펼침면은 렌더하지 마라. 기존 data-testid(play-{laneId}, split-note, stop-audio, pause-resume-audio, reading-mode, book-next, book-prev)를 거울 버튼이 물려받아라. 넘김 중(BK12)에는 거울도 비워라.

4. 2D 읽기 경로(book.mode==='2d')는 LessonPages.tsx HTML을 그대로 쓴다. 두 경로가 같은 PageSpec을 읽도록 LessonPages가 pageSpecFor(pageId)에서 문장·버튼을 가져오게 최소 변경하라(완전한 DSL 해석기는 R8).

5. styles/book.css: ink 분기에서 .book-paper-dom 관련 규칙을 renderer 데이터 속성(data-renderer="ink")으로 비활성화하라. legacy는 그대로.

6. e2e: scripts/quiz-e2e.ts, keyboard-e2e.ts, notation-e2e.ts의 셀렉터가 거울 DOM에서 동작하도록 수정하라. 음악 기대값은 바꾸지 마라. renderer=legacy로도 같은 스크립트가 통과해야 한다(셀렉터가 두 경로 모두를 찾도록).

7. 회귀: 인쇄·그림·소리·평가가 같은 lesson.revision에서 파생됨을 split 후 revision 비교 테스트로 확인. BK12(넘김 중 DOM 없음). AC05(음표 선택 44 px 대체 조작 = eventList).

8. 캡처: R3 before = R2 after(링크). after를 ink로 찍고, 3D 모드 DOM에서 document.querySelectorAll('.book-page, .book-paper-dom') 시각 요소 수 0을 metrics.json에 기록하라. spread1 캡처를 400% 확대해 본문 x-height(px)를 재서 기록하라(1280×720 ≥ 7, 844×390 ≥ 5.5; 미달이면 '크게 읽기' 2D 안내 인쇄를 추가하고 기록). 분할 10회 연속 Performance 측정값(draft ≤ 60 ms)과 settled 교체 전후 연속 캡처(jump 0)를 기록하라.

9. 보고하라. R1의 과도기 결함(HTML 흐림)과 R2의 known-offset이 ink 경로에서 해소됐는지 명시하라.
~~~

#### R3-e 검수·측정·보고

~~~text
R3-e만 수행하라. 코드는 R3-d의 결함 수정만 허용한다.

1. docs/qa/refactor/R3/index.md에 캡처 42장 중 R3 묶음(3 viewport × {spread1, turn50, spread2, 2d} × {legacy, ink})을 표로 정리하고 metrics.json 요약(x-height, HTML 요소 수, draft ms, jump)을 붙여라.
2. docs/qa/ACCESSIBILITY.md에 거울 DOM의 읽기 순서(펼침면별 h1 → 본문 → 버튼 → 라디오 → 음표 목록)와 포커스 링 규칙을 추가하라. 실제 보조기술 검수는 R9 사람 항목이므로 '미실행'으로 남겨라.
3. legacy·ink 둘 다로 quiz/keyboard/notation e2e를 실행해 결과를 기록하라.
4. 텍스처 메모리 stats()를 spread1·spread2 왕복 20회 뒤 기록하라(≤ 48 MB, 증가 0).
5. BUILD_STATUS_V3에 R3 전체 항목을 '통과 / 일부 완료 / 외부 검수 대기' 중 하나로 쓰고, 사람 검사 항목을 명시하라.
~~~

**사람 검사 항목(`docs/qa/refactor/R3/after/`)**
- 페이지 글자·오선이 종이에 **인쇄된 것**처럼 보이는가(HTML 버튼·라디오·스크롤 영역이 없음).
- 400% 확대 캡처에서 글자가 흐리지 않고 x-height가 기준 이상인가.
- 분할 버튼을 10회 눌렀을 때 페이지가 깜빡이거나 튀지 않는가(연속 캡처).
- 키보드 Tab으로 버튼을 옮길 때 종이 위에 포커스 링이 그려지는가.
- 2D(크게 읽기) 모드가 이전과 같은 내용·조작을 제공하는가.

**실패 시 수정(R3 공통)**

~~~text
R3에서 실패한 [서브세션-항목: 줄바꿈 / 44 px / x-height / draft ms / jump / 거울 포커스 / e2e 셀렉터 / 메모리]만 고쳐라. x-height 미달을 본문 크기 비율을 바꿔서가 아니라 settled 해상도·anisotropy·여백으로 먼저 검토하고, 그래도 미달이면 비율 조정값을 기록하라. 테스트를 거울 대신 캔버스 픽셀로 바꾸지 마라. legacy 경로를 깨뜨려 ink를 통과시키지 마라.
~~~

---

### 3.4 R4 (V22) 잉크 그림 시스템 + 음가 그림 — 서브세션 a–d

**선수:** R1 통과. R3과 병렬 가능(모듈 독립). `stage.ts` 통합(R4-d)은 R2 뒤, R3-d와 같은 세션에서 하지 않는다.
**산출물:** `src/book/figures/{inkLines,paperFill,figure}.ts`, `figures/music/{durationFigure,decor}.ts`, `lessonScene.ts`·`stage.ts`·`motion.ts` 수정, `tests/ink-lines.test.ts`, `tests/duration-figure.test.ts`, `docs/qa/refactor/R4/`.
**수용 기준:** 선 폭 1.2–1.6 px(거리 무관), 펜 reveal + 평면→입체 lift가 연속 캡처 12프레임에서 확인, 기존 duration-world 의미 테스트 6개가 duration-figure에서 통과, 장면 draw call ≤ 40.

#### R4-a 잉크 선 배치 + 펜 스케줄러

~~~text
R4-a만 수행하라. 설계서 §6 R4 (1), §2 D5·D6, 부록 D 잉크 행을 읽어라. stage·lessonScene은 건드리지 마라.

1. src/book/figures/inkLines.ts: three/examples/jsm의 LineSegmentsGeometry + LineMaterial(worldUnits:false, linewidth 1.4, dashed 지원, 클리핑 평면 지원)을 확장한다. 재질을 상속(또는 onBeforeCompile)해 설계서 GLSL을 추가하라: instance 속성 instanceFlatStart/instanceFlatEnd(종이 평면 y=0에 눕힌 위치), instanceReveal(t0, dur); uniform uLift(0 납작→1 입체), uReveal(펜 진행 0..1). vertex에서 s=mix(flatStart, start, uLift), e=mix(flatEnd, end, uLift). fragment에서 local=(uReveal−vReveal.x)/max(vReveal.y,1e-4); if (local < vSegmentT) discard.
   InkLineSet { add(points: Vector3[], {closed?, width?, t0, dur, bias?}); build(); setLines(sets)(재구성); setLift(t); setReveal(t); setResolution(w,h); dispose() }. capacity 사전 할당(그림당 ≤ 3,000 세그먼트), 초과 시 setLines가 재할당 폴백. flat 기본 (x, 0, z). 색 잉크 '#252721'에 bias(0.3–0.6) 농담. 납작 상태 z-fighting 방지: polygonOffset + flat y+0.004.

2. Pen 스케줄러: createPen({baseDur: 0.3}) → next(length) → {t0, dur}. 긴 선일수록 dur 큼, 누적. finalize()가 전체를 0..1로 정규화.

3. 테스트 tests/ink-lines.test.ts: reveal 속성이 add 순서로 단조 증가, finalize 후 마지막 t0+dur = 1, flat 위치 y = 0.004(바닥 lift 포함) 또는 0(옵션), capacity 초과 시 setLines 폴백이 세그먼트 수를 보존, dispose 후 geometry·material 참조 해제(dispose 호출 횟수). 셰이더 문자열에 uLift·uReveal 선언이 포함됨.

4. 보고하라.
~~~

#### R4-b 종이 채움 + 그림 빌더

~~~text
R4-b만 수행하라. 설계서 §6 R4 (2)(3)을 읽어라.

1. src/book/figures/paperFill.ts: MeshStandardMaterial 확장, 색 '#fbf6ec'. onBeforeCompile로 해칭: 객체 공간 방향 hatchA, hatchB(단위 벡터), sin(dot(pos, dir)/spacing) 줄무늬를 (1 − NdotL)로 가중해 어두운 면에만 잉크 줄. spacing 기본 0.55. uLift는 position과 flat 속성을 morph target(morphTargetInfluences[0])으로 처리해 커스텀 vertex 셰이더 없이 구현하라. low 티어에서 해칭 off 플래그.

2. src/book/figures/figure.ts: InkFigure extends PreparedScene { figureId; hitTargets: Mesh[]; setLift(t); setReveal(t); setGlow(id, amount); update(time, camera) }. figure(id, build: (f: FigureBuilder) => void). FigureBuilder: line(points, opts) · box(size, pos, opts: {fill, edges}) · lathe(profile, opts) · label(text, pos, opts) · hit(id, box). box는 paperFill 면 + 12개 모서리 잉크 선. lathe는 LatheGeometry + paperFill. label은 R3 pagePainter의 폰트로 작은 캔버스 텍스처 스프라이트(잉크색). hit는 투명 피킹 메시(기존 pickTargets 계약, eventId를 userData에). setGlow는 paperFill emissive 0.35 강조색. update는 LineMaterial.resolution 갱신.

3. 테스트 tests/figure.test.ts: box가 12 세그먼트를 add함, hit 메시가 visible=false 또는 투명이고 raycast 가능, setLift(0)/setLift(1)에서 hit box 위치가 동일(피킹은 입체 기준 고정), dispose 후 group이 비고 material·geometry dispose 호출.

4. 보고하라.
~~~

#### R4-c 음가 그림 + lessonScene

~~~text
R4-c만 수행하라. 설계서 §6 R4 (4)와 CONTRACT_V3 C6을 읽어라.

1. src/book/figures/music/durationFigure.ts: src/scenes/durationWorld.ts에서 durationBounds, BAR_WIDTH(10), BLOCK_HEIGHT(0.38), BLOCK_DEPTH(0.9), clampedPosition을 그대로 import하라(복사하지 말고 import). createDurationFigure(events) → { group, hitTargets, setEvents, setHighlight, setPosition, setLift, setReveal, dispose } — lessonScene.ts의 호출부가 거의 바뀌지 않게 기존 createDurationWorld의 반환 모양을 유지하라.
   - 레인 = 잉크 시간 축(기준선 + 0/¼/½/¾/1 눈금 + 라벨 '0', '1/2', '1').
   - 음표 = box(paperFill + 해칭) + 12 모서리 잉크 선. x = onset×10, width = duration×10, 높이·깊이 고정(음량 오해 금지).
   - 선택 = 강조 잉크 '#B96335' 2.2 px 외곽선. 재생 중 = setGlow 0.35 + 재생선(잉크 1.6 px, 축 높이 0.72, setPosition 그대로).
   - 쉼표 = 점선 잉크 외곽선만, 채움 없음, 피킹 메시는 투명 유지.
   - 분할 애니메이션 splitMerge 240 ms: 데이터는 즉시 바뀌고 그림만 보간. 새 경계선이 먼저 reveal되고 두 블록으로 나뉜다.

2. src/book/lessonScene.ts: createDurationWorld → createDurationFigure. LANE_Z, PAPER_LIFT 0.008, API 유지. renderer==='legacy'면 기존 durationWorld를 계속 쓴다(분기).

3. src/scenes/durationWorld.ts는 의미 함수만 남기는 축소를 R9로 미루고 지금은 건드리지 마라(legacy가 쓴다).

4. 테스트 tests/duration-figure.test.ts: 기존 tests/duration-world.test.ts의 의미 케이스 6개(좌표 x=onset×10·width=duration×10, raycast로 16개 16분음표 각각 선택, 쉼표 투명, setHighlight, setPosition 범위, dispose)를 figure API로 옮겨 통과. 추가: lift 0과 1에서 hit box 위치 동일, 쉼표에 paperFill 메시 없음. tests/book-lesson-scene.test.ts를 figure API에 맞게 수정하되 기대 의미는 유지.

5. 보고하라.
~~~

#### R4-d stage 통합 · 등장 연출 · 장식 그림 · 캡처

~~~text
R4-d만 수행하라. 설계서 §6 R4 (5)(6)을 읽어라. R2 통과를 확인하라(stage.ts의 ink 분기 조명·후처리가 있어야 그림자가 보인다). R3-d와 같은 세션에서 하지 마라.

1. stage.ts(ink 분기): sceneAnchor.scale.set(1, growth, 1)(stage.ts:431–432)을 제거하고 sceneProgress를 figure.setLift로 넘겨라. 그림자는 lift ≥ 0.3부터 castShadow. 클리핑 창(setSceneWindow)은 R3-d의 figureRects 기준을 쓴다(R3-d 미완이면 현재 DOM 측정 유지하고 기록). render()에서 모든 InkFigure.update(time, camera)로 LineMaterial.resolution을 일괄 갱신하라.

2. motion.ts에 토큰 추가(기존 값 변경 금지): reveal 520, lift 600(지연 120), stagger 45, splitMerge 240. BookApp의 draw({sceneProgress})는 유지하고, 첫 등장에서 reveal(0→1, 520 ms)과 lift(0→1, 600 ms, 120 ms 지연)를 겹쳐 실행, 재방문은 reveal 1 고정 + lift 200 ms, 퇴장/드래그 p<0.16은 lift 1→0만(펜 되감기 없음). reduced motion은 즉시 컷.

3. src/book/figures/music/decor.ts: 펼침면 1 — 긴 소리/짧은 소리 잉크 '소리 띠'와 작은 메트로놈 추 선화. 펼침면 2 — 가위 자국·분수 표기. 각 ≤ 400 세그먼트. 의미 보조이며 학습 정본이 아니다(정답·평가에 쓰지 마라).

4. 예산: 그림 ≤ 3,000 세그먼트, 장면 ≤ 6,000, 장면 draw call ≤ 40(renderer.info.render.calls를 DEV inspector snapshot에 추가). low 티어 해칭 off.

5. 캡처: R4 before = 직전 통과 단계 after(링크). after: spread1·spread2 ink, 그리고 등장 연속 캡처 12프레임(0, 60, 120 … 660 ms; inspector로 sceneProgress를 직접 넣거나 실제 등장에서 Playwright 연속 캡처). 1280×720·844×390에서 선 폭을 400% 확대로 재서 1.2–1.6 px인지 기록. 재생 중 글로우·재생선 캡처 1장. 분할 보간 캡처 3장(0/120/240 ms).

6. 회귀: pickEvent 계약(eventId) 유지, 넘김 잎이 그림을 실제로 가림(depthTest), 활성 장면 최대 1개, SceneHost 토큰 테스트 무변경 통과.

7. 보고하라. R3-d 이전에 통합했다면 "그림 창은 DOM 측정 기준(R3-d 뒤 figureRects로 교체 예정)"을 편차로 기록하라.
~~~

**사람 검사 항목(`docs/qa/refactor/R4/after/`)**
- 음가 블록이 색 상자가 아니라 **잉크 선 + 종이색 면 + 해칭**으로 보이는가.
- 12프레임 연속 캡처에서 선이 펜으로 그려지듯 나타나고, 납작한 도식에서 입체로 떠오르는가(세로로 늘어나는 것이 아님).
- 재생 중 블록이 밝아지고 재생선이 움직이는가.
- 쉼표가 점선 외곽선만인가.
- 선 폭이 멀어도 가까워도 비슷한가(844×390에서도 1.2–1.6 px).

**실패 시 수정(R4 공통)**

~~~text
R4에서 실패한 [서브세션-항목: 선 폭 / reveal 순서 / lift와 hit box / 의미 테스트 / z-fighting / draw call / 그림자]만 고쳐라. 선 폭을 worldUnits:true로 바꿔 해결하지 마라(거리 무관 조건 위반). 의미 테스트 실패를 기대값 변경으로 풀지 마라. z-fighting은 polygonOffset과 바닥 lift를 먼저 조정하라.
~~~

---

### 3.5 R5 (V23) 조작부 재배치

**선수:** R3 통과(R4 통합 여부 무관).
**산출물:** `src/book/ui/Toolbar.tsx`, `RecordsDialog.tsx`, `ContentsFlap.tsx`(자리), `styles/toolbar.css`, `BookApp.tsx`·`BookProgressTools.tsx`·`content/pages/*`·`book.css` 수정, `navigationPlacement.ts`와 그 테스트 삭제, e2e 셀렉터, `docs/qa/refactor/R5/`.
**수용 기준:** 3D 모드에서 `main.book-app` 안의 `button`은 조작바·거울·표지 버튼뿐. 844×390에서 조작바와 책 bounds 교차 0. 플랩·도장 캡처. keyboard-e2e 통과.

~~~text
R5만 수행하라. 설계서 §6 R5, CONTRACT_V3 C1·C9, 결정 1·2를 읽어라. 바꾸는 가설은 "조작부가 책 밖 하단 조작바 + 페이지 안 인쇄형 핫스폿"이다.

1. src/book/ui/Toolbar.tsx: 설계서 JSX 그대로 — nav.book-toolbar aria-label="책 조작" data-visible={book.isOpen}; 버튼 book-prev(첫 펼침면이면 aria-label '표지로' → CLOSE_BOOK), book-contents(목차, R8 전까지 GO_TO 없음 → disabled + 사유 title), book-next(마지막이면 disabled, BK09), folio aria-live, 소리(aria-pressed, 학습 음악 음소거 + 효과음을 함께 끄는 단일 스위치 — 효과음은 R7에서 연결), 정지 화면(SET_REDUCED_MOTION + 저장 reducedMotion 동일 경로), reading-mode(크게 읽기 / 3D로 보기), records(기록). 높이 52 px, padding-bottom env(safe-area-inset-bottom), 배경 반투명 책상 톤, 버튼 44×44, 568×320에서는 36 px 압축형. coverIdle에서는 숨기고 표지 안 힌트만 둔다(COVER-INTRO 유지).

2. stage safe rect: 하단에 조작바 높이를 더해 책이 가려지지 않게 하라(--book-safe-bottom 재사용). R1 fit이 자동으로 책을 줄인다.

3. 책갈피(EDGE-NAV) 제거: 결정 1이 '대체'면 BookApp의 .book-navigation 버튼과 navigationPlacement.ts, tests/book-navigation-placement.test.ts를 삭제하라(되돌릴 수 없는 삭제이므로 결정 1 답이 '잠정'이면 삭제하지 말고 숨김 처리 후 보고). 모서리 직접 드래그·ArrowLeft/Right는 그대로 필수. turnTargetOwnsInput에 .book-toolbar를 추가해 조작바 pointerdown이 모서리 드래그를 시작하지 않게 하라.

4. 페이지 안 인쇄형 조작(content/pages/*): 펼침면 1 오른쪽 ▶ 위 줄 듣기, ▶ 아래 줄 듣기, ■ 정지, 가까이 보기(R6 샷, 지금은 no-op + 로그). 펼침면 2 오른쪽 ▶ 내 리듬 듣기, ■ 정지, 둘로 나누기, 앞과 합치기, 뒤와 합치기, 되돌리기, 다시 하기, ‖ 잠깐 멈춤(playing일 때만 활성 표시). 왼쪽: 질문 라디오 + '정답 보기' 플랩. enabledWhen에 따라 pagePainter가 비활성 버튼을 흐린 잉크로 인쇄하고 hitTest는 비활성을 무시.

5. 플랩 메시: 종이 위 작은 직사각형 메시(paperMaterial, 두께 0.003), 윗변 힌지 0→110°, 240 ms(motion 토큰 flap 240). 열림 상태는 hints[`${sceneId}/answer`]에 저장(기존 onHint 경로, 새 저장 필드 없음). 플랩 아래 인쇄는 print 두 장(닫힘/열림) 캐시.

6. 도장: 세 문항을 맞히면 stampSlot에 '확인' 도장을 state 레이어에 그린다. 저장은 기존 answers에서 파생(새 필드 없음).

7. src/book/ui/RecordsDialog.tsx: BookProgressTools의 백업·내보내기·가져오기·삭제·설정(2D/모션/음량/품질 티어)을 <dialog>로 이동. 열려 있는 동안 책은 inert, Arrow 키 가로채기 중지(EN02). 책 밖 모달이므로 C1 범위 안이다.

8. LessonPages.tsx(2D 경로)에서도 같은 조작이 유지되는지 확인하라. 2D는 HTML 버튼 그대로다.

9. 테스트: 3D 모드에서 main.book-app 안 button 집합이 조작바·거울·표지 버튼뿐(count 검사, Playwright). tests/book-turn-hit.test.ts에 조작바 소유권 케이스 추가. keyboard-e2e(ArrowLeft/Right, 모달 중 가로채기 중지) 통과. 첫 펼침면 이전 = CLOSE_BOOK, 마지막 다음 = disabled.

10. 캡처: 3 viewport spread1·spread2 ink(조작바 포함), 844×390에서 조작바 rect와 bookBounds 교차 0을 metrics.json에 기록, 플랩 열림 캡처, 도장 캡처, 568×320 압축형 캡처.

11. 보고하라.
~~~

**사람 검사 항목(`docs/qa/refactor/R5/after/`)**
- 페이지 안에 HTML 버튼이 없고, 인쇄된 버튼과 플랩만 있는가.
- 하단 조작바가 책을 가리지 않고 한 줄로 작은가(≤ 56 px).
- 책갈피가 사라졌어도 모서리 드래그가 그대로 되는가.
- 플랩이 종이처럼 열리고, 도장이 찍히는가.

**실패 시 수정**

~~~text
R5에서 실패한 [항목: 책 가림 / 드래그 소유권 / 모달 중 Arrow / 플랩 저장 / 도장 파생 / e2e]만 고쳐라. 조작바를 책 안으로 넣거나 토스트·HUD를 추가해 풀지 마라. 플랩·도장을 새 저장 필드로 풀지 말고 기존 hints/answers 파생으로 유지하라.
~~~

---

### 3.6 R6 (V24) 레슨 카메라 연출(샷)

**선수:** R1, R4, R5 통과.
**산출물:** `src/book/render/shots.ts`, `cameraRig.blendTo/returnToReading`, `controller.ts` 최소 변경(`camera:'shot'`, `SHOT_START`, `SHOT_END`), `BookApp.tsx` 라우팅, `tests/book-controller.test.ts` 케이스, `tests/shots.test.ts`, `docs/qa/refactor/R6/`.
**수용 기준:** 5 viewport에서 샷 포즈 fit 성공, 복귀 포즈 == 읽기 포즈(≤ 1e-6). 샷 중 NEXT는 pending, 드래그 시작 거부, hidden에서 해제. 넘김 중 카메라 불변 유지.

~~~text
R6만 수행하라. 설계서 §6 R6, CONTRACT_V3 C4, 결정 5를 읽어라. 바꾸는 가설은 "사용자가 시작한 카메라 샷이 그림 속으로 들어갔다가 읽기 포즈로 정확히 돌아온다"이다.

1. src/book/render/shots.ts: ShotSpec {id; region: {pageId; rect: UvRect} | 'figure:duration-lanes' | 'figure:duration-strip'; pose: RigPose; margin; duration; holdMs?}. SPREAD_SHOTS = spread-1 [{lanes-close, figure:duration-lanes, {36, -14, 32}, 0.14, 900}], spread-2 [{strip-close, figure:duration-strip, {34, 10, 32}, 0.14, 900}]. resolveShot(spec, world: {figureBounds(lift=1) | pageRectWorld}, viewport, safe) → {position, target, quaternion} — cameraRig.fit에 region bounds를 넣어 계산한다. 절대 좌표를 하드코딩하지 마라.

2. cameraRig.ts: blendTo(pose, position, target, t)와 returnToReading(duration 600). 보간은 smoothStep, 위치·target lerp, 쿼터니언 slerp. 샷 중 fit 중지(state.suspendFit 재사용). 복귀 포즈는 읽기 포즈 fit 결과를 그대로 써서 오차 0. reduced motion은 즉시 컷.

3. controller.ts 최소 변경: CameraState에 'shot' 추가. SHOT_START(token)는 bookCanInteract && camera==='settled'일 때만 camera:'shot'. SHOT_END(token) → camera:'settled'. NEXT/PREV/TURN_DRAG_START/CLOSE_BOOK/HIDE_DOCUMENT는 camera==='shot'이면 pendingIntent에 저장(기존 최대 1개 정책과 같은 형태)하고 BookApp이 복귀 tween 완료 후 재전송. bookCanInteract는 camera==='settled' || camera==='shot'. preparingTurn 진입 조건에 camera !== 'shot'. 다른 전이는 바꾸지 마라.

4. BookApp.tsx: HotspotCommand {type:'shot', shotId} → SHOT_START → shots.resolveShot → blendTo. 종료는 같은 버튼 재누름, Escape, 내비게이션·드래그 시작·닫기·hidden → returnToReading → 완료 시 SHOT_END → pendingIntent 재전송. 재생 시작 시 자동 샷은 설정 옵션(기본 끔, 결정 5). 조작바에는 샷 버튼을 두지 마라.

5. 테스트: tests/book-controller.test.ts — 샷 중 NEXT는 pending이고 SHOT_END 후 실행, 샷 중 TURN_DRAG_START 거부, HIDE_DOCUMENT에서 샷 해제 후 기존 hidden 정책, settled가 아닐 때 SHOT_START 무시. tests/shots.test.ts — 5 viewport(844×390, 667×375, 568×320, 390×844, 360×640)에서 두 샷 fit 성공, 복귀 포즈 == 읽기 포즈(위치·target·쿼터니언 차 ≤ 1e-6), region bounds가 safe 검사 대상이 아님(의도적 근접).

6. 캡처: 샷 진입 0/300/600/900 ms, 유지, 복귀 0/300/600 ms 연속 캡처(1280×720, 844×390). 샷 중 핫스폿 조작 캡처 1장. 샷 중 ArrowRight → 복귀 후 넘김 캡처 3장. 복귀 후 metrics.json의 camera가 spread1 읽기 포즈 값과 일치함을 기록.

7. 회귀: 넘김·드래그 중 카메라 불변(§6.3 유지), 복귀 후 CI01/CI02 재성립, SceneHost 토큰 무변경.

8. 보고하라.
~~~

**사람 검사 항목(`docs/qa/refactor/R6/after/`)**
- '가까이 보기'를 누르면 카메라가 그림 쪽으로 들어가고, 다시 누르면 정확히 원래 자리로 돌아오는가(복귀 전후 캡처가 겹치는가).
- 샷 중에 페이지를 넘기면 먼저 돌아온 뒤 넘기는가.
- 넘김 중에는 카메라가 움직이지 않는가.

**실패 시 수정**

~~~text
R6에서 실패한 [항목: 복귀 오차 / pending 처리 / 드래그 거부 / hidden / fit 실패 viewport]만 고쳐라. 복귀 오차를 '충분히 가깝다'로 완화하지 말고 읽기 포즈 fit 결과를 그대로 쓰는지 검사하라. 샷 중 넘김을 허용해서 pending 문제를 피하지 마라.
~~~

---

### 3.7 R7 (V25) 효과음·마감

**선수:** R5 통과.
**산출물:** `src/book/sfx/synthSfx.ts`, `useBookSfx.ts`, `AudioEngine.playSfx`, `persistence/bookProgress.ts`의 `preferences.sfx` + 스키마 이관, `tests/sfx.test.ts`, `tests/audio.test.ts` 확장, `docs/qa/refactor/R7/`.
**수용 기준:** OfflineAudioContext 렌더에서 각 효과음 길이·피크 ≤ −6 dBFS. `preferences.sfx=false`에서 노드 생성 0. 음악 playing 중 `pen` 무시. 첫 사용자 제스처 전 소리 없음.

~~~text
R7만 수행하라. 설계서 §6 R7, CONTRACT_V3 C8, 결정 2를 읽어라. 음원 파일을 추가하지 마라 — 모두 절차 합성이다.

1. src/audio/AudioEngine.ts(최소 변경): playSfx(name, when?) 채널 추가. 단일 AudioContext 공유, 학습 재생과 별도 GainNode(sfxGain). 기존 stop·pause·resume·정지 규칙(AU01–07)에 영향 없음을 tests/audio.test.ts 기존 케이스 무변경 통과로 보여라. resume 정책은 기존 엔진과 같다.

2. src/book/sfx/synthSfx.ts: page-turn(0.35 s 핑크 노이즈 + 2.2 kHz 밴드패스 스윕, 게인 envelope 10/120/200 ms), page-settle(저역 탭 60 ms), cover-open/cover-close(80 Hz 사인 + 노이즈 burst 0.25 s), pen(3 ms 클릭 + 1.8 kHz 감쇠 40 ms), flap(종이 0.15 s), stamp(저역 탭 + 노이즈 0.12 s). 각 함수는 (ctx, destination, when)을 받고 노드 그래프를 만든 뒤 자동 해제한다. 피크 ≤ −6 dBFS가 되도록 게인을 고정하라.

3. src/book/sfx/useBookSfx.ts: 상태 전이 → 효과음 매핑. TURN_PREPARED→page-turn(드래그는 release commit 시), SETTLED→page-settle, opening/closing 시작→cover-open/close, 핫스폿 pressed→pen, 플랩→flap, 도장→stamp. 음악 playing 중에는 pen을 내지 않는다. 첫 사용자 제스처(표지 열기) 이전에는 아무 소리도 내지 않는다. 조작바 '소리' 스위치는 음악 음소거와 sfx를 함께 끈다(세부 분리는 기록 대화상자).

4. src/persistence/bookProgress.ts: preferences.sfx: boolean(기본 결정 2), 스키마 버전 상승 + strict 이관(백업→검증→새 키, 기존 경로 재사용). tests/book-progress.test.ts 36개 무변경 통과 + 이관 케이스 추가. 되돌릴 수 없는 스키마 변경이므로 이관 경로가 기존 데이터를 보존함을 테스트로 보인 뒤에만 진행하라.

5. 마감: 표지 로딩 진행을 표지 하단 힌트 영역에 잉크 선으로 그린다(현재 텍스트 유지). 프리로드 순서 표지 → 본문 폰트 → 기보 폰트 → 첫 펼침면 print. index.html 정적 표지는 유지.

6. 테스트 tests/sfx.test.ts: OfflineAudioContext(node에 없으면 주입 스텁으로 노드 그래프 검사)에서 각 효과음 길이 ±10%, 피크 ≤ −6 dBFS(렌더 가능 환경에서만, 불가 시 '미실행'), sfx=false에서 createOscillator/createBufferSource 호출 0, playing 중 pen 호출 무시, 첫 제스처 전 호출 무시.

7. 실제 청취: 에이전트는 들을 수 없다. 청취 검수는 사람 항목으로 넘기고 '외부 검수 대기'로 써라.

8. 보고하라.
~~~

**사람 검사 항목(실기기 청취)**
- 표지를 열 때, 페이지를 넘길 때, 안착할 때, 인쇄 버튼을 누를 때 각각 다른 짧은 소리가 나는가. 너무 크지 않은가.
- 음악 재생 중 버튼을 눌러도 펜 소리가 섞이지 않는가.
- 조작바 '소리'를 끄면 음악과 효과음이 모두 꺼지는가.

**실패 시 수정**

~~~text
R7에서 실패한 [항목: 피크 / 노드 누수 / playing 중 pen / 이관 / 첫 제스처 전 소리]만 고쳐라. 피크를 맞추려고 출력 압축기를 넣지 말고 각 합성 함수의 게인을 고정하라. 이관 실패를 기존 키 삭제로 풀지 마라.
~~~

---

### 3.8 R8 (V26) 콘텐츠 확장(6 펼침면 + 목차 + 마침) — 서브세션 a–b

**선수:** R3, R4, R5 통과. R6·R7은 권장.
**산출물:** `manifest.ts` 확장, `controller.ts` `GO_TO`, `stage.ts` 잎 풀, `content/pages/{contents,spread-3..6,closing}.ts`, `figures/music/*` 장면 3–6, `useBookProgress.ts` 확장, 이관, `docs/qa/refactor/R8/`.
**수용 기준:** MU01–08·AU01–07 전부 통과. BK08(next 10회·prev 교차) 6 펼침면 재실행. 목차→레슨 4 다중 잎 이동 연속 캡처. 텍스처 ≤ 48 MB(`renderer.info.memory.textures` ≤ 14).

#### R8-a 구조(manifest · GO_TO · 다중 잎 · 저장)

~~~text
R8-a만 수행하라. 설계서 §6 R8을 읽어라. 페이지 내용은 R8-b에서 만든다.

1. manifest.ts: SpreadId를 'contents' | 'spread-1' … 'spread-6' | 'closing'으로, PageId를 'page-{n}'으로 일반화하라. 기존 'spread-1'/'spread-2' 값은 그대로 유효해야 한다. BOOK_MANIFEST에 목차·마침을 포함하되 R8-b 전까지 페이지 DSL은 자리(placeholder가 아니라 "작성 중" 러닝헤드만 인쇄).

2. controller.ts 최소 변경: GO_TO(spreadId, token). 잎 수 n = |현재 index − 목표 index|. turningForward/Back 동안 순차 처리, 잎 간 stagger 45 ms, 전체 ≤ 1.6 s(n이 커도 상한 고정: 잎당 시간 = min(turn 1120, 1600/n)). 기존 pendingIntent 정책과 경계 guard 유지. NEXT/PREV는 GO_TO(index±1)로 통일하지 말고 그대로 두되 같은 내부 경로를 쓰게 하라(서명 유지).

3. stage.ts: 동시 잎 ≤ 3장(TurningLeaf 풀 3개). 4잎 이상 이동은 앞 잎이 끝나면 풀을 재사용. 잎마다 같은 compositor 텍스처를 공유.

4. useBookProgress.ts: supportsStoredSpread 확장. persistence bookUiVersion 상승 + 이관(기존 spread-1/2 값 보존). tests/book-progress.test.ts 무변경 통과 + 이관 케이스.

5. 프리페치: 현재 ±1 펼침면 draft print, 그림은 현재만(활성 장면 1개 불변식).

6. 테스트: tests/book-controller.test.ts — GO_TO 다중 잎 순서, 중간 NEXT는 pending, 경계 guard, hidden 중단 후 복구. tests/book-geometry.test.ts — stackHeights가 spreadCount 8에서 단조. 저장 이관 테스트.

7. 캡처: 목차(자리) → spread-4 다중 잎 이동 연속 캡처 8장(1280×720). 텍스처 수·메모리 stats 기록.

8. 보고하라.
~~~

#### R8-b 내용(목차 · 장면 3–6 · 마침)

~~~text
R8-b만 수행하라. src/content/lesson.ts의 scene-3~6 데이터를 읽어라. 새 교육 문장을 짓지 말고 lesson.ts의 원문과 validation을 따르라.

1. content/pages/contents.ts: 레슨 제목 6개 + 쪽수 인쇄, 각 항목 hotspot {type:'contents', spreadId} → GO_TO. 조작바 '목차'는 GO_TO('contents')로 연결(R5의 disabled 해제).

2. spread-3.ts(조합): 1/4·1/8·1/16 인쇄 버튼으로 추가, 목표 1/2 가이드선 잉크. spread-4.ts(쉼표): note↔rest 토글 버튼, 쉼표 구간 비움+점선. spread-5.ts(템포): 60/120 라디오, 초 눈금 잉크 라벨 변화(블록 길이 불변). spread-6.ts(자유 마디): 음표·쉼표 추가·삭제 버튼, 조건 3개 인쇄 체크, 성공 도장. closing.ts: 마침 페이지(인쇄 문장은 lesson.ts에 있는 것만).

3. figures/music/*: 장면 3–6 그림 — 합산 가이드선, 쉼표 비움 구간, 템포 눈금, 자유 마디. 모두 durationFigure 위에 얹는 보조 잉크(≤ 400 세그먼트). 음악 의미는 기존 lesson/controller·assessment에서 온다.

4. LessonPages.tsx(2D)를 PageSpec 해석기로 완성해 6 펼침면 모두 2D에서도 같은 조작이 되게 하라(기능 동등성).

5. 테스트: MU01–08·AU01–07 전부(기존 테스트가 장면 3–6 의미를 덮는다) 무변경 통과. print-layout 테스트에 6 펼침면 모두 44 px·줄바꿈 통과 추가. BK08 6 펼침면으로 재실행(e2e).

6. 캡처: 3 viewport × 6 펼침면 + 목차 + 마침 ink. 텍스처 ≤ 48 MB, textures ≤ 14 기록.

7. 보고하라.
~~~

**사람 검사 항목(`docs/qa/refactor/R8/after/`)**
- 목차에서 레슨을 고르면 여러 장이 차례로 넘어가 도착하는가(1.6 s 안).
- 여섯 펼침면이 같은 종이·잉크 톤인가. 글자가 넘치거나 겹치지 않는가.
- 2D 모드에서도 여섯 펼침면이 모두 조작되는가.

**실패 시 수정(R8 공통)**

~~~text
R8에서 실패한 [서브세션-항목: GO_TO 순서 / 잎 풀 / 이관 / 44 px / MU·AU 회귀 / 메모리]만 고쳐라. 메모리 초과를 settled 해상도 하향으로 풀기 전에 프리페치 범위(±1)와 LRU를 검사하라. MU·AU 회귀는 콘텐츠를 바꿔서가 아니라 페이지 DSL의 명령 연결을 고쳐서 해결하라.
~~~

---

### 3.9 R9 (V27) 검증 관문 개편·정리 — 서브세션 a–b

**선수:** 전 단계. 결정 6(원본 녹화) 제공 여부 확인.
**산출물:** `docs/qa/BOOK_EXPERIENCE_GATE_V3.md`, `docs/qa/MOTION_COMPARISON.md`, `scripts/visual-baseline.ts`, `scripts/perf-budget.ts`, 레거시 삭제, `README`·`ARCHITECTURE`·`vercel.json`·라이선스 갱신.
**수용 기준:** 부록 B 정체성 5항목 `불일치` 0(미관측은 사유 기록). 성능 예산 통과. legacy 경로·레거시 파일 삭제 후 전체 테스트·빌드 통과.

#### R9-a 관문·스크립트·판정

~~~text
R9-a만 수행하라. 설계서 §6 R9, 부록 B, v2.1 프롬프트 §20 V16 양식을 읽어라. 아직 아무것도 삭제하지 마라.

1. scripts/visual-baseline.ts: R1의 scripts/refactor-capture.ts를 42장 매트릭스로 확장·개명하라(3 viewport × {cover, opening50, spread1, turn50, spread2, shot, 2d} × {legacy, ink}). metrics.json에 지금까지의 모든 수치(farNearRatio, bookWidthRatio, 휘도 차, x-height 측정 입력, HTML 요소 수, draw calls, 텍스처 수·메모리)를 포함. 회귀는 같은 앱 전후 비교에만 쓰고 원본과 픽셀 일치를 목표로 삼지 마라(V16).

2. scripts/perf-budget.ts: 초기 draw calls ≤ 150, 장면 ≤ 40, 텍스처 ≤ 48 MB, 넘김 중 p95 frame ≤ 33 ms(headless는 참고치), 50회 왕복 후 geometries/textures/programs 증가 0. 실패 시 exit 1.

3. docs/qa/BOOK_EXPERIENCE_GATE_V3.md: 부록 B 13항목을 각각 일치 / 의도적 차이 / 불일치 / 미관측 으로 판정하고 증거(캡처 경로·metrics·테스트)를 연결하라. 정체성 5항목(원근 카메라, 종이 조명·곡면, 잉크 그림·떠오름, 조작부 위치, 연출 샷) 중 하나라도 불일치면 "확장·배포 금지"를 머리에 쓴다. 결정 6의 원본 녹화가 docs/reference/original/(저장소 밖, 경로만 기록)에 있으면 같은 시퀀스(열린 책→레슨 1→그림 등장→샷→Next→Previous)를 나란히 비교하고, 없으면 해당 항목을 미관측으로 두고 통과로 바꾸지 마라.

4. docs/qa/MOTION_COMPARISON.md: V16 양식 — 공개 코드 확인값·실제 영상 측정값·v3 채택값을 다른 열에, 차이의 이유(독자 콘텐츠 / 접근성 / 모바일 가독성 / 권리 / 성능 / 불일치)를 기록.

5. 사람 검수 패킷(X07)을 만들어 '외부 검수 대기'로 남겨라: 실기기(iOS Safari, Android Chrome), 청취, 스크린리더, 음악 교육자, 원본 비교 담당.

6. 보고하라. 정체성 5항목 판정 결과를 첫 줄에 써라.
~~~

#### R9-b 레거시 삭제·문서·라이선스

~~~text
R9-b만 수행하라. R9-a에서 정체성 5항목 불일치가 0임을 확인한 뒤에만 시작하라. 삭제는 되돌릴 수 없으므로 삭제 목록을 먼저 보고하고 사용자 확인을 받아라(P00 13항).

삭제 목록(설계서 §4 표): src/App.tsx, src/scenes/DurationScene3D.tsx, src/scenes/DurationScene2D.tsx(타입만 이전), src/components/ConceptQuiz.tsx, src/notation/NotationView.tsx, src/styles/app.css, src/styles/adapters.css, src/book/pageProjection.ts, src/book/pageSnapshot.ts, src/book/usePagePrints.ts, src/book/notationPreparation.ts, src/book/inspector.ts(새 inspector로 대체 — DEV 전용 snapshot/pose/metrics 유지), renderer:'legacy' 분기 전부, src/scenes/durationWorld.ts의 표현부(의미 함수 durationBounds 등은 남김), tests/book-page-projection·book-page-snapshot·book-notation-preparation·duration-world(이전 완료 확인 후).

1. 확인을 받은 뒤 삭제하라. main.tsx가 BookApp만 마운트함을 확인하라. profile.ts의 renderer 타입은 'ink'만 남기되 URL 파라미터는 무시(오류 없음).
2. npm run typecheck && npm run lint && npm test && npm run build 전부 exit 0. 빌드 main 청크 500 kB 경고는 three/vexflow 분리 청크(vite manualChunks)로 해소하거나 사유 기록.
3. README.md(실제 지원 범위, 로컬 실행, 3D 기본·2D 경로, 첫 표지 행동, renderer 플래그 제거 사실), docs/ARCHITECTURE.md(render/print/figures/ui/sfx 계층, 프레임 파이프라인 §5.2), vercel.json, public/licenses/에 한글 폰트 OFL 추가, scripts/font-license-audit.ts 통과를 빌드 조건으로.
4. docs/KNOWN_LIMITATIONS.md에 미관측 항목, 실기기·청취·보조기술 미검수, 저티어 축소 내용을 적어라.
5. 최종 git diff에 사용자 변경·비밀값·대용량 영상·무관한 생성 파일이 없는지 확인하라. push·배포는 하지 마라.
6. 보고하라. 완료 수준을 v2.1 V17 분류(A 개발 검증 / B 책 경험 / C 원본 체감 / D 수업 시험 준비 / E 배포 판단)로 나누어 쓰고 A만으로 B–E를 완료라고 쓰지 마라.
~~~

**사람 검사 항목**
- `BOOK_EXPERIENCE_GATE_V3.md`의 정체성 5항목 판정과 증거가 내가 본 캡처와 일치하는가.
- 원본 녹화를 제공했다면 나란히 비교표가 있는가. 없다면 미관측으로 남아 있는가.
- 삭제 목록에 내가 유지하고 싶은 파일이 없는가(확인 요청 시 답한다).

**실패 시 수정(R9 공통)**

~~~text
R9에서 실패한 [항목: 정체성 n번 불일치 / 성능 예산 / 삭제 후 빌드 / 라이선스]만 고쳐라. 불일치 항목은 해당 단계(R1/R2/R4/R5/R6)의 실패 시 수정 블록으로 돌아가 고치고 다시 판정하라. 판정 기준을 완화하거나 미관측을 일치로 바꾸지 마라. 삭제 후 빌드 실패는 삭제를 되돌려 legacy를 되살리지 말고 ink 경로의 누락 import를 고쳐라.
~~~

---

## 4 반복해서 쓰는 보조 프롬프트 X01–X07

### X01 새 대화에서 이어가기

~~~text
v3 리팩토링 작업을 이어간다. P00을 다시 적용하고 실제 파일을 읽어라.
docs/REFACTOR_DESIGN_V3.md, docs/REFACTOR_PROMPTS_V3.md
docs/CONTRACT_V3.md, docs/IMPLEMENTATION_CONTRACT_V3.md
docs/BUILD_STATUS_V3.md 의 마지막 항목과 단계 지도 상태
docs/qa/refactor/ 아래 최신 단계의 index.md와 metrics.json

git status와 diff를 확인하고 기존 사용자 변경을 보존하라. 이전 대화의 완료 문장보다 현재 코드·실제 테스트·캡처를 우선한다. 이미 통과한 단계를 다시 전체 생성하거나 의존성을 무조건 재설치하지 마라.
현재 실행할 단계: [R번호 또는 서브세션]
추가 사용자 지시: [내용 또는 없음]
마지막 통과 단계, 실패·대기 게이트, 다음 최소 작업을 복구한 뒤 단계 블록을 기다려라.
~~~

### X02 전후 캡처만 다시 만들기

~~~text
코드를 바꾸지 말고 docs/qa/refactor/R[n]/[before|after]/ 캡처와 metrics.json만 다시 만들어라. scripts/refactor-capture.ts(R9 이후 visual-baseline.ts)를 --stage R[n] --phase [phase] --renderer [legacy|ink] 로 실행하고, 로컬 서버(127.0.0.1)만 쓴다. 기존 캡처를 덮어쓰기 전에 이전 파일을 prev-{timestamp}/ 로 옮겨라. 수치가 설계서 §3 목표 범위를 벗어나면 벗어난 항목만 보고하고 고치지 마라.
~~~

### X03 회귀가 생겼을 때

~~~text
실패 테스트 또는 행동: [정확한 이름·순서]
세션 시작 baseline에서의 상태: [통과였음 / 원래 실패]
환경과 commit: [값]

같은 순서로 재현하라. 이번 단계가 바꾼 파일 목록과 실패 테스트가 import하는 모듈의 교집합을 먼저 본다. P00 9항 불변식(CI01–03, EN02, BK05–07, BK13–16, MU, AU, RC, AX21) 중 어느 것이 깨졌는지 ID로 써라. 재현 테스트 → 최소 수정 → 같은 시퀀스 → 관련 전체 회귀 순서다. 기대값 변경·skip·setTimeout 늘리기·상태 강제 초기화로 감추지 마라. 원인이 확정되지 않으면 가설과 다음 실험을 분리해 보고하고 단계 상태를 '일부 완료'로 둔다.
~~~

### X04 원본과 닮지 않았다는 피드백을 받았을 때

~~~text
사용자 피드백: [원문]
해당 캡처: [docs/qa/refactor/… 경로 또는 사용자 캡처]
부록 B 항목: [1–13 중 번호, 모르면 비움]

피드백을 설계서 §2 진단표 D1–D11과 부록 B 13항목에 매핑하라. 정체성 5항목(1 카메라, 2 종이·조명, 3 잉크 그림, 4 조작부 위치, 5 샷) 중 어디에 해당하는지 먼저 정하고, 해당 단계(R1/R2/R4/R5/R6)의 '실패 시 수정' 블록 범위 안에서만 고쳐라. 원본 실동작 관측이 없으면 정적 번들 관측(부록 A)과 사용자 설명을 구분해 쓰고, 관측하지 않은 모션을 봤다고 말하지 마라. 핵심 경험 차이, 독자 콘텐츠 차이, 의도적 접근성 차이를 분리한다. 가장 큰 핵심 차이부터 한 번에 하나의 가설로 수정하고 같은 입력·viewport·renderer의 전후 캡처를 제시하라. 원본 코드·자산 복사로 맞추지 마라. 부록 D 토큰 범위 밖 조정이 필요하면 조정하지 말고 설계 변경으로 보고하라.
~~~

### X05 `stage.ts` 병렬 통합 충돌(R2 ∥ R3 ∥ R4)

~~~text
stage.ts 통합 순서를 지켜라: R2(render/*) → R3-d(print/*) → R4-d(figures/*). 다른 서브세션이 stage.ts를 이미 바꿨으면 git log -p src/book/stage.ts 로 확인하고, 이번 세션은 자기 모듈 폴더(render/ 또는 print/ 또는 figures/) 안에만 코드를 두고 stage.ts에는 호출부 한 곳만 추가하라. 두 세션이 같은 함수를 고쳐야 하면 멈추고 보고하라. ink 분기 밖(legacy)을 건드리지 마라.
~~~

### X06 성능 예산 초과

~~~text
초과 항목: [draw calls / 텍스처 MB / p95 frame / 메모리 증가]
측정 환경: [headless 참고치 / 실기기]

설계서 부록 D 예산과 비교하라. 순서: (1) 누수(50회 왕복 후 증가)는 dispose 경로부터 — SceneHost 토큰·compositor LRU·InkLineSet dispose. (2) draw calls는 InkLineSet 병합과 figure 수. (3) 텍스처는 프리페치 범위·LRU·settled 해상도 순. (4) 프레임은 티어 강등(GTAO 제외 → 후처리 없음 → 해칭 off) 순. 음악 의미·안착 모션 시간·접근성 거울을 줄여서 풀지 마라. 조정값과 전후 수치를 기록하라.
~~~

### X07 사람이 해야 하는 검수 패킷

~~~text
외부 연락·초대·공유 없이 검수 패킷만 준비하라.
원본 비교 담당(김영걸): 부록 B 13항목, 같은 시퀀스의 원본 녹화(있으면)와 v3 캡처 나란히, 정체성 5항목 판정 빈칸.
실기기 담당: iOS Safari·Android Chrome에서 cover/open/drag/hold/reverse/release/cancel/rotation/safe-area/pinch/context loss, 조작바 가림 여부, 샷 복귀.
청취 담당: page-turn/settle/cover/pen/flap/stamp 존재와 크기, 음악 중 pen 억제, '소리' 스위치.
접근성 담당: 거울 DOM 읽기 순서, Tab 포커스 링이 종이 위에 그려짐, 200% 확대, reduced motion, 2D 동등성, 무음.
음악 교육자: 여섯 펼침면 문항·기보·정답·동등 답·오개념(v2.1 R05와 동일).
각 항목은 담당, 입력, 절차, 기대, 실제 결과 빈칸, 증거, 날짜, 통과/수정/대기를 갖는다. 빈칸을 통과로 채우지 마라.
~~~

---

## 5 캡처·증거 규약

| 항목 | 규약 |
|---|---|
| 폴더 | `docs/qa/refactor/R{n}/before/`, `after/`, `metrics.json`, `index.md`. 서브세션은 `R3-d/`처럼 폴더를 나눈다. before는 직전 통과 단계의 after를 **링크**한다(복사 금지) |
| viewport | 1280×720(DPR 1), 844×390, 390×844. R1·R6 단위 테스트는 5 viewport(844×390, 667×375, 568×320, 390×844, 360×640) |
| 상태 | cover, opening50, spread1, turn50, spread2, shot(R6+), 2d. `window.__bookInspector.pose()`로 만들고 rAF 두 번 뒤 촬영 |
| renderer | legacy, ink 둘 다(R9 전). 파일명 `{W}x{H}_{state}_{renderer}.png` |
| metrics.json | 캡처마다 `farNearRatio`, `bookWidthRatio`, `coverCenterErrorPx`, `luminance{left,right,spine}`, `camera`, 단계별 추가 수치(`htmlPageElements`, `xHeightPx`, `draftMs`, `drawCalls`, `textures`, `textureMB`) |
| 측정 방법 | 레이아웃 수치는 inspector `snapshot().layout`. 휘도는 PNG를 페이지에 data URL로 올려 2D 캔버스 getImageData(새 의존성 없음). x-height·선 폭은 400% 확대 캡처에서 사람이 재고 수치를 적는다 |
| 연속 캡처 | 등장(12프레임), 샷(진입 4·복귀 3), 분할 보간(3), 다중 잎(8). 프레임 간격을 파일명에 ms로 적는다 |
| 금지 | 원본 Every Joule 화면을 저장소에 넣지 않는다(사용자 녹화는 저장소 밖 `docs/reference/original/` 경로만 기록). baseline 자동 갱신으로 실패를 덮지 않는다. headless 캡처를 실기기 통과로 쓰지 않는다 |

---

## 6 고정 기대값과 퇴행 방지 요약(v3)

v2.1 프롬프트 §24 표는 그대로 유효하다. 아래는 v3에서 추가·개정된 고정 기대다.

| 구분 | 고정 기대 |
|---|---|
| 카메라 | 원근 FOV 30–34°, 고도각 52–62°, 직교 금지. 넘김·드래그 중 카메라 불변. 표지 UV 중앙 오차 ≤ 2 px 유지 |
| 종이 | 조명 받는 종이, 책등 홈·배부름·처짐 곡면, 좌우 휘도 차 3–8%. 정지 페이지↔잎 handoff 점프 ≤ 1 px |
| 페이지 | 모든 페이지는 인쇄 텍스처. 3D 모드 페이지 안 HTML 0. 본문 x-height ≥ 7 px(1280×720). 인쇄·그림·소리·평가는 같은 revision |
| 그림 | 잉크 선 1.2–1.6 px 거리 무관, 종이 면+해칭, 펜 reveal + 평면→입체 lift, 세로 scale 금지. x=onset×10, width=duration×10, 높이·깊이 고정 |
| 조작부 | 책 밖 하단 한 줄 조작바(≤ 56 px)만. 페이지 안은 인쇄형 핫스폿·플랩·도장. 모서리 직접 드래그 필수. 44 px |
| 샷 | 사용자가 시작, 읽기 포즈 복귀 오차 0, 샷 중 넘김은 복귀 후 |
| 효과음 | 절차 합성만, 피크 ≤ −6 dBFS, 첫 제스처 전 무음, 음악 중 pen 억제 |
| 접근성 | 거울 DOM 읽기 순서, 포커스 링은 종이 위, 2D 동등성, reduced motion 즉시 컷 |
| 예산 | draw calls 초기 ≤ 150 / 장면 ≤ 40, 텍스처 ≤ 48 MB, 넘김 p95 ≤ 33 ms, 50회 왕복 누수 0 |
| 관문 | G1-C 정체성 5항목 불일치 시 확장·배포 금지. 미관측은 통과가 아니다 |
| 플래그 | R9 전까지 legacy·ink 공존, 새 코드는 ink 분기 안 |
| 증거 | 단계마다 전후 캡처 + metrics.json. 캡처 없는 시각 주장 금지 |

---

## 7 사용자 결정 기록표

R0에서 `docs/CONTRACT_V3.md`로 옮긴다. 답을 적지 않으면 권장값이 `잠정`으로 채택된다.

| # | 질문 | 권장 | 영향 단계 | 답 |
|---|---|---|---|---|
| 1 | 책에 부착된 책갈피(EDGE-NAV)를 없애고 조작바 이전/다음으로 대체할까? | 대체(C9) | R5 | [ ] |
| 2 | 효과음 기본 켬? | 켬, 조작바 '소리'로 끔(C8) | R7 | [ ] |
| 3 | 책상 질감: 나뭇결 vs 리넨(모두 절차 생성) | 리넨 | R2 | [ ] |
| 4 | 본문 서체: Pretendard(산세리프) + Noto Serif KR(제목)? 파일은 사용자가 제공 | 권장 조합 | R3 | [ ] |
| 5 | 재생 시작 시 자동 샷 | 끔(설정 옵션) | R6 | [ ] |
| 6 | 원본 화면 녹화 제공(Windows PC, 열린 책→레슨 1→그림 등장→샷→Next→Previous) | 제공 권장. 없으면 G1-C 일부 `미관측` | R9 | [ 제공 / 미제공 ] |

---

## 8 문서 상태

- 이 문서는 후속 구현을 위한 실행 지시이며 수정 완료 보고서가 아니다. 작성 시점에 R0–R9 중 어느 것도 실행되지 않았다.
- 설계서 v3.0의 수치(부록 D)는 제안값이며 실측이 아니다. 캡처 측정 뒤 범위 안에서 조정하고 기록한다.
- 원본 Every Joule의 실제 WebGL 동작은 관측하지 못했다(정적 번들 분석만). 사용자 녹화가 있어야 G1-C 정체성 항목을 판정할 수 있다.
- 실기기·청취·스크린리더·음악 교육자 검수는 에이전트가 대신할 수 없는 사람 항목이며 R9에서 `외부 검수 대기`로 남는다.
- 배포·push·외부 공유는 이 문서의 어떤 단계에도 포함되지 않는다. 별도 사용자 요청을 따른다.
