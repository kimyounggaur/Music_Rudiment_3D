# Music_Rudiment_3D 리팩토링 설계서 v3.0

부제: "책 모양 웹앱"에서 "Every Joule급 3D 책"으로

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-10-29 |
| 기준 코드 | `main` 커밋 `4f3111a5de4c40bad2ac6f79aaabe96727e90a96` (2026-10-29 01:40 KST, "deliver first two interactive book spreads") |
| 선행 문서 | 상세설계서 v2.1, 바이브코딩 프롬프트 v2.1, `docs/BOOK_VISUAL_SPEC.md`, `docs/qa/BOOK_EXPERIENCE_GATE.md`, `docs/reference/MOTION_REFERENCE.md` |
| 권장 저장 위치 | `docs/REFACTOR_DESIGN_V3.md` |
| 독자 | 구현 에이전트, 검수자, 기획자(김영걸) |
| 이 문서가 아닌 것 | 코드 변경·배포·승인이 아니다. 원본 Every Joule의 코드·자산을 복사하라는 지시가 아니다. |

---

## 0 결론 요약

**진단.** 2026-10-29 분석에서 확인한 원본과의 차이는 네 가지 원인에서 나왔다. (1) v2.1 문서가 원본의 '동작 순서'만 분석하고 '그리는 방식'은 요구로 옮기지 않았다. (2) 문서의 필수 요구(정지 페이지=HTML, 화면에는 책만, 기존 음가 블록 재사용, 학습 카메라 고정)가 원본 스타일과 정면 충돌했다. (3) 구현이 그 충돌을 가장 평평한 쪽(직교 카메라, 조명 없는 평면 종이, HTML 겹침)으로 풀었다. (4) 원본 닮음을 재는 관문 G1-C가 선택 항목이라 아무도 확인하지 않았다.

**처방.** 계약 개정 1단계(R0) + 코드 8단계(R1–R8) + 검증 관문 개편 1단계(R9). 음악·오디오·학습 상태·저장·기보·책 상태 머신은 그대로 둔다. 바꾸는 것은 **보는 방식(카메라·종이·조명·후처리), 페이지를 만드는 방식(HTML 겹침→캔버스 인쇄), 그림을 그리는 방식(상자→잉크 그림), 조작부의 위치(페이지 안→책 밖 조작바), 카메라 연출(고정→샷)** 다섯 가지다.

**순서 원칙.** 프롬프트 v2.1 R03의 지시("가장 큰 핵심 차이부터 한 번에 하나의 가설")를 따른다. 가장 싸고 체감이 큰 카메라(R1)부터 시작해, 구조 변경이 큰 인쇄 시스템(R3)과 그림 시스템(R4)을 병렬로 진행하고, 조작부(R5)·연출(R6)·효과음(R7)·콘텐츠 확장(R8)으로 간다.

| 단계 | 이름 | 규모 | 선행 | 사용자 체감 효과 |
|---|---|---|---|---|
| R0 | 계약 개정 | S | — | 없음(문서). 이후 모든 단계의 근거 |
| R1 | 원근 카메라 리그 | M | R0 | **가장 큼.** 도면 같던 책이 입체로 보임 |
| R2 | 종이·조명·환경·후처리 | M | R1 | 종이가 빛을 받고, 책상 위에 놓임 |
| R3 | 캔버스 페이지 인쇄 시스템 | XL | R1 | HTML 버튼이 사라지고 '인쇄물'이 됨. 접근성은 거울 DOM으로 유지 |
| R4 | 잉크 그림 시스템 + 음가 그림 | XL | R1 (R3과 병렬 가능) | 색 상자가 종이에서 그려지며 떠오르는 잉크 그림으로 바뀜 |
| R5 | 조작부 재배치 | M | R3 | 페이지가 깨끗해지고 책 밖 조작바가 생김 |
| R6 | 레슨 카메라 연출 | M | R1, R4, R5 | 카메라가 그림 속으로 들어가는 원본의 핵심 연출 |
| R7 | 효과음·마감 | S | R5 | 종이 소리, 표지 소리, 펜 소리 |
| R8 | 콘텐츠 확장(6 펼침면+목차) | L | R3, R4, R5 | 2 펼침면 → 책 한 권 |
| R9 | 검증 관문 개편·정리 | M | 전 단계 | G1-C(원본 비교)가 차단 관문이 됨, 레거시 삭제 |

규모: S ≤ 2 작업 세션, M 3–5, L 6–9, XL 10+ (에이전트 작업 세션 기준 추정치, 실측 아님).

---

## 1 범위·전제·금지

### 1.1 범위

- 대상 저장소: `kimyounggaur/Music_Rudiment_3D`, 기준 커밋 4f3111a. 이후 커밋은 착수 시 재비교한다.
- 대상 경로: `src/book/**`, `src/scenes/**`, `src/styles/**`, `src/content/**`(페이지 DSL 추가), `docs/**`, `tests/**`, `scripts/**`.
- 제외: `src/domain/**`, `src/audio/**`(효과음 채널 추가 제외), `src/lesson/**`, `src/persistence/**`, `src/notation/**`의 의미 로직. 이 영역은 회귀 테스트 대상이지 수정 대상이 아니다.

### 1.2 전제

- 순수 Three.js 0.186.1 + React 19.2.5 + VexFlow 5.0.0 + Vite 5.4 유지. R3F·GSAP·XState·WebGPU 도입 없음(v2.1 §15 유지).
- Three `examples/jsm`의 `Line2/LineMaterial/LineSegmentsGeometry`, `RoomEnvironment`, `EffectComposer/RenderPass/GTAOPass/SMAAPass/OutputPass`, `VignetteShader`는 설치된 패키지 안의 모듈이므로 새 의존성이 아니다.
- Node 엔진 범위 `>=24.14.0 <25`는 유지한다(package.json).

### 1.3 금지

- 원본 Every Joule 번들·텍스처·모델·폰트·음원·문장을 내려받아 넣거나 변환해 쓰지 않는다. 부록 A의 관측값은 **구조와 수치 범위를 참고**하기 위한 것이며 그대로 옮겨 적는 목표값이 아니다.
- 음악 의미(기약분수 음가·onset·C4·4/4·90 BPM·정확한 기보)를 시각 효과에 맞추려고 바꾸지 않는다.
- 2D 읽기 경로(`fallback2D`, `.book-app--2d`)의 학습 동등성을 줄이지 않는다.
- 사용자 요청 없는 push·배포·외부 공유를 하지 않는다.

---

## 2 진단: 차이의 원인과 코드 위치

| # | 원본과 다른 점 | 현재 코드 위치 | 왜 그렇게 됐나 | 고치는 단계 |
|---|---|---|---|---|
| D1 | 직교 투영. 원근감·깊이가 없음 | `src/book/stage.ts:115` `new OrthographicCamera(...)`, `fitCamera()` | `pageProjection.ts`의 affine `matrix()`로 HTML 페이지를 종이에 정확히 겹치려면 직교가 단순함(`BOOK_VISUAL_SPEC.md` "A fixed orthographic direction permits an exact affine mapping") | R1 |
| D2 | 종이가 조명을 받지 않음, 완전 평면 | `stage.ts:135–138` `MeshBasicMaterial({toneMapped:false})`, `geometry.ts:34` `createFlatPageGeometry` | HTML 겹침과 넘김 텍스처의 색을 똑같이 맞추려면 조명을 끄는 것이 가장 쉬움(`stage.ts:133–134` 주석) | R2, R3 |
| D3 | 페이지 내용이 HTML 버튼·라디오·스크롤 영역 | `LessonPages.tsx`, `BookApp.tsx:591–600`, `usePagePrints.ts`+`pageSnapshot.ts`(DOM→SVG foreignObject→캔버스) | v2.1 §12.2 "정지한 펼침면에서는 page-local DOM/SVG" 필수 요구 | R3 |
| D4 | 조작부가 페이지 안에 있음(재생·일시정지·정지·음소거·크게 읽기·나누기·합치기·기록 도구) | `LessonPages.tsx` `Transport`, `SplitControls`, `BookProgressTools.tsx` | v2.1 BOOK-ONLY("책 바깥 UI 0개") + 44px 규칙. 원본은 조작부가 책 밖(`MOTION_REFERENCE.md` REF09) | R0, R5 |
| D5 | 3D 그림이 색 상자 막대 | `src/scenes/durationWorld.ts`(`MeshLambertMaterial` 상자), `src/book/lessonScene.ts`가 그대로 종이 위에 올림 | v2.1 §15.1 "DurationScene3D/durationWorld 재사용" 요구 | R0, R4 |
| D6 | 장면 등장이 '세로 늘리기' | `stage.ts:431–432` `sceneAnchor.scale.set(1, growth, 1)` | 임시 구현. 원본은 평면 투영↔입체 보간 + 펜 그리기 | R4 |
| D7 | 카메라가 학습 중 고정, 연출 없음 | `BookApp.tsx` tween은 intro/cover/turn만. 샷 개념 없음 | v2.1 §6.3 "학습 카메라 고정 사선", "자동 카메라 회전 금지" | R0, R6 |
| D8 | 배경 단색, 책상·매트 없음, 후처리 없음 | `stage.ts:114` `scene.background = '#d9d1c4'`, `ContactShadowDesk`만 | BOOK-ONLY "책상 소품·장식 모델 없음" | R0, R2 |
| D9 | 효과음 없음 | `AudioEngine.ts:463` 효과음 채널 미지원 | v2.1 §13.3 "효과음 기본 없음" | R0, R7 |
| D10 | 분량 2 펼침면 | `manifest.ts` `BOOK_MANIFEST` 2개 | G1 게이트 범위 | R8 |
| D11 | 닮음을 재는 관문 없음 | `BOOK_EXPERIENCE_GATE.md` G1-C "미검증"으로 통과 | v2.1 §19 "C는 A/B 통과로 자동 승계하지 않음"이 차단 조건이 아니었음 | R9 |

---

## 3 목표 상태: 측정 가능한 정의

### 3.1 완료 그림(1280×720, DPR 1, 표지를 연 뒤 첫 펼침면)

- 화면 중앙에 펼친 책. 책 폭이 가용 폭의 **70–85%**(원근이므로 먼 변이 가까운 변보다 **8–14%** 좁다). 책 주위로 책상(절차 생성 질감)과 매트가 보인다.
- 종이는 빛을 받는다. 펼침면 좌우 끝과 책등 사이 휘도 차 **3–8%**, 책등 쪽에 홈(dip) 음영, 앞쪽 가장자리에 접촉 그림자.
- 페이지 글자·오선은 **인쇄물**이다. HTML 요소가 종이 위에 겹쳐 있지 않다. 본문 x-height ≥ **7 px**(1280×720), 잉크 대비 ≥ **7:1**.
- 오른쪽 페이지의 음가 그림은 **잉크 선(1.2–1.6 px, 거리 무관)**과 종이색 면+해칭으로 그려져 있고, 펼침면 안착 후 **펜이 그리듯** 나타나며 **평면에서 입체로** 떠오른다.
- 책 밖 하단에 한 줄 조작바(이전·목차·다음·소리·정지 화면·크게 읽기·기록). 페이지 안에는 인쇄형 버튼(듣기, 나누기 등)과 플랩만 있다.
- 조작바 '자세히 보기' 또는 페이지의 인쇄형 '가까이 보기'를 누르면 카메라가 그림 쪽으로 이동했다가 돌아온다. 넘김 중에는 카메라가 움직이지 않는다.

### 3.2 바뀌지 않아야 하는 것(회귀 금지)

- v2.1 CI01–03(표지 UV 중앙 오차 ≤ 2 CSS px, 안전영역, skip/reduced/hide/실패 복구), EN02(키 예외·큐), BK05–07/13–16(직접 드래그·hold·reverse·commit/cancel), MU01–08, AU01–07, RC01–05.
- `bookReducer`의 상태 전이와 `SceneHost`의 토큰·정리 규칙.
- 2D 읽기 경로의 기능 동등성.

---

## 4 설계 원칙

1. **보존 우선.** 아래 표의 '보존' 모듈은 서명(export)을 바꾸지 않는다. 약 270개 단위 테스트 중 렌더링 전용 테스트(`book-page-projection`, `book-page-snapshot`, `book-notation-preparation`, `duration-world`) 외에는 그대로 통과해야 한다.
2. **플래그로 공존.** `src/book/profile.ts`에 `BOOK_PROFILE.renderer: 'legacy' | 'ink'`를 두고 URL `?renderer=legacy`로 전환한다. R9 전까지 두 경로가 모두 빌드된다. 같은 입력·viewport의 전후 비교 캡처는 이 플래그로 만든다.
3. **한 번에 하나의 가설.** 각 단계는 하나의 시각 가설만 바꾸고, 같은 viewport(1280×720, 844×390, 390×844)의 전후 캡처를 `docs/qa/refactor/R{n}/`에 남긴다.
4. **정본은 음악 데이터.** 인쇄 텍스처·잉크 그림·소리는 모두 같은 `LessonState.revision`에서 파생한다. 픽셀이나 투영 좌표로 정답을 계산하지 않는다.
5. **접근성은 거울로.** 시각 페이지는 텍스처이지만, 활성 펼침면의 텍스트·버튼·선택지는 시각적으로 숨긴 DOM 거울(`AccessibleMirror`)로 같은 명령을 보낸다. 포커스 위치는 종이 위 하이라이트로 그린다.

| 구분 | 모듈 | 처리 |
|---|---|---|
| 보존 | `domain/*`, `content/lesson.ts`, `content/types.ts`, `content/validation.ts`, `lesson/controller.ts`, `lesson/assessment.ts`, `audio/*`, `persistence/*`, `book/controller.ts`, `book/SceneHost.ts`, `book/gesture.ts`, `book/turnHit.ts`, `book/manifest.ts`(확장만), `book/useBookAudio.ts`, `book/useBookProgress.ts`, `book/BookProgressSession.ts`, `book/learningProgress.ts`, `book/audioOwnership.ts`, `book/motion.ts`(토큰 추가만) | 서명 유지 |
| 수정 | `book/stage.ts`, `book/geometry.ts`, `book/BookApp.tsx`, `book/lessonScene.ts`, `book/navigationPlacement.ts`, `book/BookNotation.tsx`(비React 렌더 함수 분리), `styles/book.css` | 단계별 |
| 교체 | `book/pageProjection.ts`(R1에서 homography, R3에서 제거), `book/usePagePrints.ts`+`book/pageSnapshot.ts`+`book/notationPreparation.ts`(→ `book/print/*`), `scenes/durationWorld.ts`의 표현부(→ `book/figures/*`), `LessonPages.tsx`의 3D 모드 역할(→ 페이지 DSL + 거울) | R3/R4 |
| 신규 | `book/profile.ts`, `book/render/*`, `book/print/*`, `book/figures/*`, `book/ui/*`, `book/sfx/*`, `content/pages/*` | 단계별 |
| 삭제(R9) | `App.tsx`, `scenes/DurationScene3D.tsx`, `scenes/DurationScene2D.tsx`(타입만 이전), `components/ConceptQuiz.tsx`, `notation/NotationView.tsx`, `styles/app.css`, `styles/adapters.css`, `book/pageProjection.ts`, `book/pageSnapshot.ts`, `book/usePagePrints.ts`, `book/notationPreparation.ts`, `book/inspector.ts`(새 inspector로 대체) | 레거시 |

---

## 5 목표 아키텍처

### 5.1 모듈 구조(변경 후)

~~~text
src/book/
  BookApp.tsx                 조정자(React). 상태 머신·훅·입력 라우팅만. 렌더 세부 없음
  controller.ts               (보존) 책 상태 머신
  SceneHost.ts                (보존) 장면 소유권
  profile.ts                  renderer 플래그, 품질 티어, 디바이스 휴리스틱
  stage.ts                    WebGLRenderer·장면 그래프·프레임 루프. 카메라/재질/환경/후처리는 render/*에 위임
  geometry.ts                 (수정) 펼침면 곡면 프로필 + 넘김 잎 곡선
  render/
    cameraRig.ts              원근 카메라, 읽기 포즈, fitPerspective, 샷 보간
    paperMaterial.ts          인쇄 텍스처를 잉크로 곱하는 조명 종이 재질
    spreadSurface.ts          정지 펼침면의 곡면 메시(책등 홈·배부름·가장자리 처짐)
    environment.ts            책상·매트·RoomEnvironment PMREM·조명
    postPipeline.ts           EffectComposer(RenderPass→GTAO→SMAA→Vignette→Output), 품질 티어
    shots.ts                  펼침면별 카메라 샷 정의와 실행
  print/
    pageSpec.ts               페이지 DSL 타입(블록·핫스폿·플랩·도장)
    pageLayout.ts             블록 → 배치(줄바꿈·그리드)
    pagePainter.ts            배치 → 캔버스 2D 페인트(잉크·종이 투명)
    notationRaster.ts         VexFlow SVG → 캔버스 래스터 + 음표 히트 영역
    pageCompositor.ts         (pageId, revision, size) → {print, state} 텍스처, 캐시·LRU·2해상도
    hotspots.ts               uv 히트 테스트, pressed/hover/focus 상태 레이어
    usePageCompositor.ts      React 훅. usePagePrints 대체
    AccessibleMirror.tsx      시각 숨김 DOM 거울(읽기 순서·버튼·라디오)
  figures/
    inkLines.ts               배치 폴리라인(LineSegmentsGeometry 확장): widthPx·lift·reveal
    paperFill.ts              종이 채움 + 해칭 셰이더 + lift
    figure.ts                 InkFigure 빌더(line/box/lathe/label), hitTargets, glow
    music/durationFigure.ts   음가 레인·블록·재생선 잉크 그림 (durationWorld 의미 재사용)
    music/decor.ts            펼침면별 장식 잉크 그림(의미 보조)
  ui/
    Toolbar.tsx               책 밖 하단 조작바
    ContentsFlap.tsx          목차(페이지 핫스폿 + 거울)
    RecordsDialog.tsx         기록/설정 대화상자(BookProgressTools 이전)
  sfx/
    synthSfx.ts               절차 합성 효과음(종이·표지·펜)
    useBookSfx.ts             상태 전이 → 효과음 매핑
  lessonScene.ts              (수정) durationFigure 사용, API 유지
  LessonPages.tsx             2D 읽기 경로 전용으로 축소
src/content/pages/
  spread-1.ts … spread-N.ts   페이지 DSL(인쇄 내용·핫스폿·그림 영역)
  index.ts                    manifest와 결합
~~~

### 5.2 프레임 파이프라인(변경 후)

1. `BookApp`이 상태(`book`, `lesson`, `playback`)를 `stage.update(visual)`로 전달한다(현재와 같음).
2. `stage.render()`: `applyObjects()`(책 포즈) → `cameraRig.apply()`(읽기 포즈 또는 샷 보간, fitPerspective) → `postPipeline.render()`.
3. 종이 재질은 `pageCompositor`가 만든 `print`(불변, revision별) + `state`(선택·포커스·pressed·도장, 자주 변함) 두 텍스처를 받는다.
4. 포인터: `turnHit`(모서리) → `hotspots.hitTest`(페이지 uv) → `stage.pickScene`(그림) 순서. 명령은 모두 기존 `LessonCommand`/`BookEvent`.

---

## 6 단계별 계획

각 단계는 **목표 → 변경 파일 → 상세 설계 → 유지할 불변식 → 완료 기준 → 위험과 완화** 순서로 적는다. 완료 기준은 자동 검사(코드)와 사람 검사(캡처)를 구분한다.

---

### R0 계약 개정(문서)

**목표.** 코드가 따라간 문서를 먼저 고친다. 아래 조항을 바꾸지 않으면 R1 이후가 v2.1 위반이 된다.

**변경 파일.** `docs/source/design-v2.1.md`·`prompt-v2.1.md`는 보존. 새로 `docs/CONTRACT_V3.md`(개정 조항만), `docs/IMPLEMENTATION_CONTRACT_V3.md`, `docs/BUILD_STATUS_V3.md`(단계 보고 양식은 프롬프트 §2 그대로).

**상세 설계 — 개정 조항.**

| ID | v2.1 원문(위치) | v3 개정 | 근거 |
|---|---|---|---|
| C1 | BOOK-ONLY "책 바깥 navigation·toolbar·재생바 금지", §6.1 "외부 UI 0개", §4-8 | **BOOK-FIRST**: 책 밖에는 **하단 한 줄 조작바**만 허용. HUD·토스트·대시보드·탭·상시 재생바 금지는 유지. 조작바 높이 ≤ 56 px, safe-area 안 | 원본은 외부 하단 조작부(REF09 관측). 44px 버튼을 페이지 안에 넣으면 인쇄물이 될 수 없음 |
| C2 | BOOK-ONLY "배경은 무늬 없는 중립색과 접촉 그림자만, 책상 소품·장식 모델 없음" | 책상 면·매트·환경 조명 반사 허용. 책 외 **소품(펜·컵 등) 금지** 유지 | 원본 책상·매트 관측(REF10). 종이 조명은 환경 반사 없이는 밋밋함 |
| C3 | §12.2 "정지한 펼침면에서는 page-local DOM/SVG로 표시", "DOM을 네 모서리 homography로 정합" | **모든 페이지는 인쇄 텍스처**. DOM은 시각 숨김 **접근성 거울**로만 존재. §12.3(접근성 정본·읽기 순서·focus 안정)은 유지 | HTML 겹침이 D1·D2·D3의 공통 원인 |
| C4 | §6.3 "학습 카메라는 고정 사선", "자동 카메라 회전 금지" | **읽기 포즈 고정 + 사용자가 시작한 연출 샷 허용**. 넘김·드래그·닫기 중 샷 금지 유지. 샷 종료 포즈 = 읽기 포즈(오차 0) | 원본 레슨별 카메라 샷(부록 A) |
| C5 | §6.3 "perspective FOV 약 30–38도"(제안) / `BOOK_VISUAL_SPEC.md` "Use an orthographic camera" | **원근 카메라 필수**, FOV 30–34°, 고도각 52–62°. 직교 금지를 명시 | D1 |
| C6 | §15.1 "DurationScene3D·durationWorld 재사용: renderer를 책 stage로" | 재사용 범위를 **의미(`durationBounds`, raycast 대상, setEvents/setHighlight/setPosition 계약)**로 한정. 표현은 잉크 그림 시스템 | D5 |
| C7 | §7.4 "후처리는 장식 옵션", §6.2 "종이 질감은 약한 변화만" | 종이 재질·조명·AO·비네트를 **정체성 항목**으로 승격. 저사양 티어에서 단계적 축소 허용 | D2·D8 |
| C8 | §13.3 "효과음 기본 없음" | 절차 합성 효과음 **기본 켬**, 조작바에서 끔. 학습 음악 음소거와 독립. 음악 재생 중 효과음은 종이·표지만 | D9. 사용자 결정 필요(부록 C) |
| C9 | EDGE-NAV "책에 부착된 책갈피 버튼" | 조작바 이전/다음으로 대체. **모서리 직접 드래그는 그대로 필수**. ArrowLeft/Right 동일 | 책갈피+조작바 중복은 혼란. 사용자 결정 필요(부록 C) |
| C10 | §19 "C는 체감 유사도, 미검증이어도 A/B 통과로 진행" | **G1-C 차단 관문**: 부록 B 체크리스트 13항목 중 정체성 항목(카메라·종이·그림·조작부 위치·연출) 불일치 시 확장 금지 | D11 |
| C11 | §6.1 "펼침면 투영 폭 88–94%" | 원근 기준 **70–85%**(책상 여백 포함) | 원근+책상 |
| C12 | §8.5 "음가 블록은 종이 도식에서 접혀 올라온 듯" | "**평면 투영에서 입체로 보간 + 펜 그리기**"로 구체화. 세로 scale 금지 | D6 |

**완료 기준.** `docs/CONTRACT_V3.md`에 위 12조항과 사용자 결정 항목(부록 C)의 답이 기록됨. 프롬프트 §2 단계 지도에 R1–R9가 V19–V27로 등록됨.

---

### R1 원근 카메라 리그

**목표.** 직교 → 원근. 책이 입체로 보이게 하는 가장 큰 단일 변경. 기존 HTML 페이지 겹침은 과도기용 homography로 유지해 R3 전까지 기능을 잃지 않는다.

**변경 파일.**
- 신규 `src/book/render/cameraRig.ts`
- 수정 `src/book/stage.ts`(카메라 생성·`fitCamera`·`fitOpenScale`·`fitScale`·`fitPoints` 교체), `src/book/pageProjection.ts`(affine → homography), `src/book/BookApp.tsx`(`printSize` 계산), `src/book/navigationPlacement.ts`(사다리꼴 대응), `src/book/profile.ts` 신규
- 테스트 수정 `tests/book-page-projection.test.ts`, 신규 `tests/book-camera-rig.test.ts`

**상세 설계.**

(1) 포즈 정의. 방향은 고정 쿼터니언, 거리만 fit한다(v2.1 6-A "quaternion 회전 없음" 유지).

~~~ts
// src/book/render/cameraRig.ts
export type RigPose = Readonly<{ elevationDeg: number; azimuthDeg: number; fovDeg: number }>;
export const READING_POSE: RigPose = Object.freeze({ elevationDeg: 58, azimuthDeg: 0, fovDeg: 32 });
export const COVER_POSE: RigPose = READING_POSE; // 6-A: 표지와 펼침면은 같은 방향

export interface CameraRig {
  readonly camera: PerspectiveCamera;
  /** anchor를 화면점 target에 정확히 투영하고 points가 safe 안에 들어오는 최소 거리로 맞춘다. */
  fit(input: { points: readonly Vector3[]; anchor: Vector3; target: StagePoint; safe: StageRect;
    viewport: { width: number; height: number }; pose: RigPose; introBlend?: number }): FitResult;
  /** R6: 샷 보간. 읽기 포즈로 복귀는 returnToReading */
  blendTo(pose: RigPose, position: Vector3, target: Vector3, t: number): void;
}
export type FitResult = Readonly<{ distance: number; cameraTarget: Vector3; worldPerPixelAtAnchor: number; anchorErrorPx: number }>;
~~~

(2) `fit` 알고리즘.
- 뷰 방향 `dir`은 pose에서 계산(고도각 e, 방위각 a: `dir = (sin a·cos e, sin e, cos a·cos e)`). 카메라 쿼터니언은 `lookAt(-dir)`로 한 번 만들어 고정.
- 거리 d에 대해 `worldPerPixel(d) = 2·d·tan(fov/2) / viewport.height`.
- `cameraTarget = anchor − right·(target.x − W/2)·wpp(d) + up·(target.y − H/2)·wpp(d)` (anchor와 같은 깊이 평면에서 옆으로 미끄러뜨림 → anchor가 정확히 target 픽셀에 떨어진다. 직교 시절의 식과 같은 형태이며 원근에서도 정확하다).
- `camera.position = cameraTarget + dir·d`.
- d를 `[0.5·책 대각선, 60]`에서 **이분 탐색 28회**: 모든 points를 `project`해 safe 안이면 d를 줄이고, 밖이면 늘린다. 원근에서는 단조이므로 수렴한다. 결과에 `1.018` 여유 유지.
- intro(0→1)는 현재처럼 anchor 오프셋·거리 배율을 섞는다(`stage.ts:457–467` 로직 이전).
- `near = max(0.05, d − 책대각선)`, `far = d + 책대각선·2`로 재계산(v2.1 §추가 계약 4항 "near/far 재계산").

(3) `stage.ts` 변경점.
- `OrthographicCamera` 제거. `project()`·`pageQuad()`·`pointerProjection()`·`pickScene()`은 `camera.project`/`Raycaster.setFromCamera`를 쓰므로 그대로 동작한다.
- `openProjected`(직교 전용 뷰평면 박스)는 삭제하고, 펼침 상태 fit 점집합 `openPoints`(책 bounds 8점 + 넘김 잎 궤적 65×5×25점 중 **외곽 샘플 ≤ 400점**)를 미리 만들어 `fit`에 넘긴다.
- `layout.camera.span` 대신 `layout.camera.fov`, `distance`, `worldPerPixelAtAnchor`를 노출한다.

(4) 과도기 HTML 정합(R3에서 제거).

~~~ts
// src/book/pageProjection.ts — 4점 homography → CSS matrix3d
export function pageStyle(quad: StageQuad, width: number, height: number): CSSProperties {
  const h = homography([[0,0],[width,0],[width,height],[0,height]], [quad.tl, quad.tr, quad.br, quad.bl]); // 3×3, h[8]=1
  if (!h) return { width: 0, height: 0, visibility: 'hidden', pointerEvents: 'none' };
  const m = [h[0], h[3], 0, h[6],  h[1], h[4], 0, h[7],  0, 0, 1, 0,  h[2], h[5], 0, 1]; // column-major
  return { width, height, transformOrigin: '0 0', transform: `matrix3d(${m.map(v => v.toFixed(6)).join(',')})` };
}
~~~
`homography`는 8×8 선형계(DLT)를 가우스 소거로 푼다. 퇴화(행렬식 < 1e-9)면 null.

(5) `printSize`(BookApp.tsx:114–120)는 사다리꼴이므로 `width = max(|tr−tl|, |br−bl|)`, `height = max(|bl−tl|, |br−tr|)`로 바꾼다. `navigationPlacement.ts`는 바깥 변의 중점을 쓰도록 수정한다.

**유지할 불변식.** 표지 UV 중앙 오차 ≤ 2 px(CI01), 넘김 25/50/75% 실루엣이 safe 안(CI02), pinch 확대 시 fit 중지(6-B), 드래그 중 카메라 불변.

**완료 기준.**
- 자동: `book-camera-rig.test.ts` — 5개 viewport(844×390, 667×375, 568×320, 390×844, 360×640)+비대칭 safe-area에서 `anchorErrorPx ≤ 0.5`, 모든 fit 점이 safe 안, 이분 탐색 수렴. `book-page-projection.test.ts` — homography가 네 모서리를 정확히(≤ 1e-6) 매핑하고 내부 점(0.5,0.5)이 쌍선형 보간이 아닌 원근 보간 위치에 있음.
- 사람: 1280×720·844×390 캡처에서 먼 변/가까운 변 폭 비율 0.86–0.92, 책 폭 비율 70–85%. 기존 G1 연속 시퀀스(표지→열기→드래그→분할→복귀) 영상 재녹화, 상태 전이 동일.

**위험과 완화.** (a) HTML 겹침 글자가 원근 변환으로 약간 흐려짐 → 과도기 허용, R3에서 해소. (b) 종이 평면이 아직 평면이므로 homography 정합은 정확함. R2의 곡면 도입 후에는 내부 오차 수 px 허용(R3 전까지). (c) 이분 탐색 비용: 프레임당 ≤ 400점×28회 투영 ≈ 11k 연산, 무시 가능. resize/intro 외에는 결과를 캐시한다.

---

### R2 종이·조명·환경·후처리

**목표.** 종이가 빛을 받고 휘어 있으며 책이 책상 위에 놓인 것처럼 보이게 한다.

**변경 파일.** 신규 `render/paperMaterial.ts`, `render/spreadSurface.ts`, `render/environment.ts`, `render/postPipeline.ts`. 수정 `stage.ts`(재질·조명·배경·렌더 호출), `geometry.ts`(곡면 프로필·잎 양 끝 블렌드), `profile.ts`(품질 티어). 신규 `tests/book-spread-surface.test.ts`.

**상세 설계.**

(1) 종이 재질 — 인쇄를 '잉크'로 곱한다.

~~~ts
// src/book/render/paperMaterial.ts
export function createPaperMaterial(options: { paper?: string; roughness?: number }): PaperMaterial {
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: options.roughness ?? 0.94, metalness: 0 });
  material.map = placeholderWhite;            // USE_MAP·vMapUv 확보용
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uState = { value: transparent1x1 };
    shader.uniforms.uFiber = { value: fiberTexture };   // 256² 타일, 값 노이즈 2옥타브, 절차 생성
    shader.uniforms.uPaper = { value: new Color(options.paper ?? '#f4eedc') };
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 ink   = texture2D(map, vMapUv).rgb;            // 1=종이, 0=잉크 (print는 흰 바탕)
      vec4 st    = texture2D(uState, vMapUv);             // 선택·포커스·pressed·도장 (RGBA)
      float fib  = texture2D(uFiber, vMapUv * 7.0).r;     // 0..1
      vec3 albedo = uPaper * mix(0.965, 1.0, fib) * ink;
      albedo = mix(albedo, st.rgb, st.a);
      diffuseColor.rgb *= albedo;`);
  };
  return Object.assign(material, { setPrint(t: Texture | null) {...}, setState(t: Texture | null) {...} });
}
~~~
- `toneMapped: false`를 **제거**한다. 종이도 다른 물체와 같은 톤매핑을 받는다. 잉크 가독성은 print 텍스처가 흰 바탕·검정 잉크라 보장된다.
- 책 종이·넘김 잎 앞뒤·표지 안쪽은 모두 이 재질. 표지 앞면(`VerifiedFrontArtwork`)은 원화 보존을 위해 `MeshStandardMaterial({map: cover, roughness 0.6})`로 조명만 받고 잉크 곱은 하지 않는다.

(2) 정지 펼침면 곡면.

~~~ts
// src/book/geometry.ts (추가)
export const SPREAD_PROFILE = Object.freeze({ spineDip: 0.022, bulge: 0.034, edgeDroop: 0.006, columns: 32, rows: 8 });
/** u: 책등 0 → 바깥 1. 책등 홈 → 중간 배부름 → 가장자리 미세 처짐. */
export function spreadHeight(u: number): number {
  const p = SPREAD_PROFILE;
  return -p.spineDip * Math.exp(-u * u / 0.012) + p.bulge * Math.sin(Math.PI * Math.min(1, u * 1.12)) * (1 - u * 0.35) - p.edgeDroop * u * u;
}
~~~
- `createFlatPageGeometry` → `createSpreadPageGeometry(width, height)`(32×8 그리드, Y = `spreadHeight(u)`, 법선 재계산). 왼쪽 페이지는 `rotation.z = π`이므로 같은 함수를 쓴다.
- 넘김 잎: `leafPoint`에 `y += spreadHeight(u) · window(p)`를 더한다. `window(p) = 1 − smoothstep(0, 0.06, p)`(출발 쪽) 및 도착 쪽은 `smoothstep(0.94, 1, p)`로 **양 끝에서 정지 페이지와 정확히 일치**시킨다. 폭 방향 호 길이 보존은 중간 구간에서만 필요하므로 기존 적분은 그대로 둔다.
- 페이지 묶음(`RightPageStack`/`LeftPageStack`) 위 표면도 같은 프로필을 따라야 하므로 `BoxGeometry` 상면을 곡면 그리드로 바꾼 `createStackGeometry`를 추가한다. 앞 가장자리(fore-edge)는 7줄 선 대신 **얇은 층 12–16개의 미세 단차 + 밝기 교차**로 종이 묶음을 표현한다.

(3) 환경과 조명.
- `scene.background = '#b8b0a3'`(책상 뒤 벽 톤). `scene.environment = PMREMGenerator.fromScene(new RoomEnvironment(), 0.04).texture`, `environmentIntensity = 0.55`.
- 책상: 30×30 평면, `MeshStandardMaterial({ map: deskTexture(1024, 절차 생성: 나뭇결 또는 리넨 중 R0 결정), roughness 0.8 })`. 매트: `ExtrudeGeometry(둥근 사각형 1.25×책 크기, 두께 0.02)`, 색 `#6f6a62`, roughness 0.95.
- 주광 `SpotLight('#fff4e4', 3.4)`, 위치 `(-3.2, 7.5, 3.0)`, `angle 0.6`, `penumbra 0.7`, 그림자 맵 2048(데스크톱)/1024(모바일), `normalBias 0.02`, `radius 2.5`, `PCFSoftShadowMap`. 보조 `HemisphereLight('#dfe8f4', '#cbb08c', 0.35)`. `AmbientLight` 제거.
- 톤매핑 `NeutralToneMapping`, `exposure 1.0`. 기존 ACES는 종이를 누렇게 만든다.
- 기존 `ContactShadowDesk`(ShadowMaterial)는 매트 위 접촉 그림자로 유지하되 opacity 0.14.

(4) 후처리.
- `postPipeline.ts`: `EffectComposer(renderer)`에 `RenderPass → GTAOPass(radius 0.18·책 단위, distanceExponent 1, scale 1, samples 12) → SMAAPass → ShaderPass(VignetteShader, offset 0.95, darkness 0.38) → OutputPass`.
- 품질 티어(`profile.ts`): `high`(모두), `medium`(GTAO 제외), `low`(후처리 없음, `renderer.antialias` 유지, 그림자 1024). 초기 티어 = `dpr·canvasPx > 2.4M` 또는 `hardwareConcurrency ≤ 4`이면 medium, 모바일 UA면 low. 조작바 '기록·설정'에서 변경 가능.
- demand 렌더링 유지: `invalidate()` 호출 때만 composer 렌더.

**유지할 불변식.** 정지 페이지↔넘김 잎 handoff에서 네 모서리·오선 baseline 점프 ≤ 1 px(v2.1 §12.2). depth test/write 기본(§7.4). 그림자 acne를 `depthTest=false`로 덮지 않음.

**완료 기준.**
- 자동: `book-spread-surface.test.ts` — `leafPoint(p=0)`과 `createSpreadPageGeometry` 표면의 25×5 샘플 차이 ≤ 1e-6, `p=1`도 동일(좌측 미러). 종이 법선이 모두 +Y 반구. 세 티어에서 composer 초기화·dispose 후 `renderer.info.memory` 증가 0.
- 사람: 1280×720 캡처에서 펼침면 좌우 휘도 차 3–8%(캡처 픽셀 평균으로 측정), 책등 홈 음영 보임, 넘김 50% 프레임에 잎 그림자가 아래 페이지에 떨어짐, 책상·매트 보임. 과도기 HTML 겹침의 색 차이는 기록만 하고 통과 조건에서 제외.

**위험과 완화.** (a) 곡면 도입으로 R1의 homography 내부 오차 발생(최대 `bulge`×투영 ≈ 3–5 px) → R3 전까지 허용, `docs/qa/refactor/R2/known-offset.md`에 수치 기록. (b) GTAO는 모바일에서 비쌈 → 티어로 제외. (c) 톤매핑 변경으로 표지 원화 색이 달라짐 → 표지 재질은 `toneMapped` 유지하되 캡처로 원화 대비 ΔE ≤ 6 확인.

---

### R3 캔버스 페이지 인쇄 시스템

**목표.** 페이지를 HTML 겹침이 아니라 **항상 텍스처**로 만든다. 조작은 인쇄형 핫스폿과 접근성 거울로 제공한다. D1·D2·D3의 뿌리를 제거하는 가장 큰 구조 변경이다.

**변경 파일.**
- 신규 `print/pageSpec.ts`, `print/pageLayout.ts`, `print/pagePainter.ts`, `print/notationRaster.ts`, `print/pageCompositor.ts`, `print/hotspots.ts`, `print/usePageCompositor.ts`, `print/AccessibleMirror.tsx`, `content/pages/spread-1.ts`, `content/pages/spread-2.ts`, `content/pages/index.ts`
- 수정 `BookNotation.tsx` → 비React 함수 `renderNotation(events, width, options): NotationDrawing` 추출(기존 React 컴포넌트는 2D 경로에서 이를 사용), `BookApp.tsx`(3D 모드에서 `.book-paper-dom` 제거, 핫스폿 라우팅), `stage.ts`(`setPageTextures`에 state 텍스처 추가), `styles/book.css`
- 폰트: `public/fonts/`에 OFL 한글 서체 2종(본문 산세리프 Pretendard, 제목 세리프 Noto Serif KR 중 R0 결정) + `scripts/extract-notation-fonts.mjs`와 같은 방식의 번들 스크립트 `scripts/extract-page-fonts.mjs`, `scripts/font-license-audit.ts` 확장
- 삭제 예정(R9): `usePagePrints.ts`, `pageSnapshot.ts`, `notationPreparation.ts`, `pageProjection.ts`

**상세 설계.**

(1) 페이지 DSL.

~~~ts
// src/book/print/pageSpec.ts
export type UvRect = Readonly<{ x: number; y: number; w: number; h: number }>; // 0..1 page-local
export type PageBlock =
  | { kind: 'runningHead'; text: string }
  | { kind: 'heading'; text: string; level: 1 | 2 }
  | { kind: 'paragraph'; text: string; style?: 'lead' | 'body' | 'caption' | 'meta' }
  | { kind: 'rule' } | { kind: 'spacer'; em: number }
  | { kind: 'notation'; laneId: string; caption?: string }                 // VexFlow 래스터 + 음표 핫스폿
  | { kind: 'figure'; figureId: string; heightRatio: number }              // 3D 잉크 그림 영역(인쇄 비움)
  | { kind: 'buttonRow'; buttons: readonly PrintedButton[] }
  | { kind: 'question'; questionId: string }                               // 인쇄형 라디오 + 핫스폿
  | { kind: 'eventList'; laneId: string }                                  // 음표 선택 목록(16분음표 대체 조작)
  | { kind: 'flap'; id: string; label: string; reveals: readonly string[] } // 정답 플랩
  | { kind: 'stampSlot'; id: string }
  | { kind: 'folio'; number: number };
export type PrintedButton = Readonly<{ id: string; label: string; icon?: 'play' | 'pause' | 'stop' | 'split' | 'merge' | 'undo' | 'redo' | 'look';
  command: HotspotCommand; enabledWhen?: 'always' | 'stopped' | 'playing' | 'selected' }>;
export type HotspotCommand =
  | { type: 'lesson'; command: LessonCommand } | { type: 'play'; laneId: string } | { type: 'pause' } | { type: 'resume' } | { type: 'stop' }
  | { type: 'flap'; id: string } | { type: 'shot'; shotId: string } | { type: 'contents'; spreadId: SpreadId };
export type PageSpec = Readonly<{ pageId: PageId; side: 'left' | 'right'; blocks: readonly PageBlock[] }>;
~~~

(2) 배치(`pageLayout.ts`). 입력: `PageSpec`, 동적 상태(`LessonState`, playback, hints), 캔버스 크기. 출력: `PageLayout = { items: LaidOutItem[]; hotspots: PageHotspot[]; figureRects: Record<figureId, UvRect> }`.
- 단 1열 흐름. 여백 `6%/7%/8%`(상/좌우/하), 본문 크기 = 페이지 세로의 **1.55%**(1448 px 기준 22.4 px → 1280×720 화면에서 약 9.5 px x-height 확보), 제목 2.3%, 러닝헤드 1.0%.
- 한글 줄바꿈: `Intl.Segmenter('ko', {granularity: 'word'})` → 단어 단위로 채우고 넘치면 자소 단위 분할(`keep-all` 대응). 영문·숫자는 단어 단위.
- `figure` 블록은 비운 사각형과 `figureRects[figureId]`를 남긴다. 이 uv 사각형이 `stage.setSceneWindow`와 R4 그림 배치의 기준이다(현재 `.book-popup-window` DOM 측정 대체).
- `question`: 선택지는 원형 라디오(잉크 원 + 선택 시 채움) + 라벨, 각 선택지가 핫스폿(role `option`).
- `eventList`: 음표 수만큼 작은 인쇄 칸(번호+이름), 각 칸이 핫스폿(role `note`). 16분음표 16개도 44 px(화면) 이상이 되도록 2열 그리드.

(3) 페인트(`pagePainter.ts`). `OffscreenCanvas`(지원 시) 2D 컨텍스트. 배경 **흰색**(종이색은 셰이더가 곱함), 잉크 `#252721`, 보조 잉크 `#436C7B`, 강조 `#B96335`. 인쇄형 버튼은 1.5 px 잉크 둥근 사각형 + 아이콘(SVG path 상수) + 라벨. 플랩은 닫힘 상태에서 접힌 종이 모양(두 겹 음영)으로 인쇄한다.

(4) 기보 래스터(`notationRaster.ts`). `renderNotation()`이 만든 self-contained SVG(폰트 data URL 포함, 기존 `serializeDrawing` 재사용)를 `Image`로 디코드해 `drawImage`. 음표별 `RenderedEvent{x,y,w,h}`를 페이지 uv로 변환해 핫스폿(role `note`)으로 등록. 선택/재생 강조는 print가 아니라 **state 레이어**에 그린다(아래 (6)).

(5) 합성·캐시(`pageCompositor.ts`).
- 키: `(pageId, lessonRevision, presentationKey, size)`. print 텍스처는 불변. 캐시 LRU 8장.
- 두 해상도: **draft 768×1086**(편집 직후·넘김 중·인접 페이지), **settled 1536×2172**(데스크톱 현재 펼침면) / 1280×1810(모바일). 텍스처 메모리 예산 **≤ 48 MB**(settled 2장 ≈ 27 MB + draft 4장 ≈ 13 MB + 여유). `generateMipmaps` 켬, `anisotropy 8`.
- 편집(split/merge/undo) → draft를 동기적으로(목표 ≤ 60 ms) 갱신하고 settled는 `requestIdleCallback`/다음 프레임에 비동기 교체. 교체 순간 jump가 없도록 같은 레이아웃 좌표를 쓴다(해상도만 다름).
- 넘김 준비 barrier: 현재 `prints.ready`와 같은 의미의 `compositor.ready(spreadId)`를 제공한다. `BookApp`의 `waitingForPrint`·`printMotionReady` 로직은 그대로 두고 소스만 바꾼다.

(6) 상태 레이어(`hotspots.ts`). 페이지당 RGBA 캔버스 512×724(가벼움). 그리는 것: 선택 음표 테두리, 재생 중 음표 점선, 포커스 링(키보드), pressed 눌림(0.12 알파 잉크), 라디오 채움, 플랩 열림(정답 영역 노출은 print를 두 장—닫힘/열림—으로 캐시), 도장. `hitTest(pageId, uv)`는 핫스폿 사각형(최소 44 px 화면 환산을 배치 단계에서 보장)을 검사한다.
- 입력 경로: `BookApp.onPointerDownCapture`에서 모서리(`turnCornerAtPoint`) → 아니면 `stage.pointerProjection(x, y)`로 u,v(오른쪽) 또는 왼쪽 페이지용 `pointerProjectionLeft` → `hitTest` → `pressed` 표시 → `pointerup` 8 px 이내면 `HotspotCommand` 실행. 그림 영역 안이면 기존 `pickScene`.

(7) 접근성 거울(`AccessibleMirror.tsx`). 활성 펼침면의 `PageLayout`을 DOM으로 복제: 제목(`h1 tabIndex=-1`), 본문(`p`), 버튼(`button`), 라디오(`input type=radio`), 음표 목록(`ol>li>button aria-pressed`). 시각적으로 숨김(`position:absolute; width:1px; clip`)이되 `inert`가 아니며 포커스 가능. 포커스 이동 시 해당 핫스폿을 state 레이어에 포커스 링으로 그린다(AX21 "focus는 보이는 책 안 목표에 귀속"). 비활성 펼침면은 렌더하지 않는다(읽기 순서 제외). 기존 `data-testid`(`play-upper`, `split-note`, `book-next` 등)는 거울의 버튼이 물려받아 e2e 스크립트가 살아남는다.

(8) 2D 읽기 경로는 `LessonPages.tsx` HTML을 그대로 쓴다(`book.mode === '2d'`). 두 경로가 같은 `PageSpec`을 소비하도록 `LessonPages`를 DSL 해석기로 점진 전환한다(R8에서 완료).

**유지할 불변식.** 인쇄·그림·소리·평가가 같은 `lesson.revision`에서 파생. 넘김 중 DOM 없음(BK12). 정지 페이지와 넘김 잎이 **같은 텍스처 객체**를 쓰므로 교체 jump 0. 음표 선택의 44 px 대체 조작(AC05).

**완료 기준.**
- 자동: `tests/print-layout.test.ts`(줄바꿈·핫스폿 최소 크기·figureRects), `tests/print-compositor.test.ts`(캐시 키·LRU·메모리 예산·draft/settled 좌표 일치), `tests/hotspots.test.ts`(hitTest 경계·pressed 상태). 기존 `quiz-e2e`, `keyboard-e2e`, `notation-e2e`를 거울 기준으로 수정해 통과.
- 사람: 3D 모드 DOM에 `.book-page` 시각 요소 0개. 1280×720에서 본문 x-height ≥ 7 px, 844×390에서 ≥ 5.5 px(미달 시 '크게 읽기' 2D 안내 인쇄). 분할 10회 연속 시 draft 갱신 ≤ 60 ms(Performance 마크), settled 교체 시 jump 없음(연속 캡처).

**위험과 완화.** (a) 한글 폰트 번들 용량(서브셋 전 2–4 MB) → KS X 1001 2,350자 + 사용 문자 서브셋(`pyftsubset`)으로 ≤ 400 KB. (b) 캔버스 텍스트 품질이 DOM보다 낮다는 인상 → settled 해상도와 `anisotropy`로 보완, 캡처 비교로 판단. (c) 스크린리더 사용성 → 거울의 읽기 순서를 `docs/qa/ACCESSIBILITY.md`에 기록, 실제 보조기술 검수는 R9 사람 항목. (d) 구조 변경이 커서 R1·R2와 병행 금지. 반드시 `renderer: 'ink'` 플래그 안에서만 활성화.

---

### R4 잉크 그림 시스템 + 음가 그림

**목표.** 색 상자 대신 **잉크 선 + 종이 면 + 해칭**으로 그린 입체 그림이, 종이 평면에서 펜으로 그려지듯 나타나 입체로 떠오르게 한다. R3와 독립 모듈이므로 병렬 개발 가능(통합은 R3 뒤).

**변경 파일.** 신규 `figures/inkLines.ts`, `figures/paperFill.ts`, `figures/figure.ts`, `figures/music/durationFigure.ts`, `figures/music/decor.ts`. 수정 `lessonScene.ts`(`createDurationWorld` → `createDurationFigure`, API 유지), `stage.ts`(`sceneAnchor.scale.y` 제거 → `uLift`, 그림자·클리핑 연결), `motion.ts`(토큰 추가: `reveal 520`, `lift 600`, `stagger 45`). 테스트 신규 `tests/ink-lines.test.ts`, `tests/duration-figure.test.ts`(기존 `duration-world.test.ts`의 의미 기대값 이전).

**상세 설계.**

(1) 잉크 선 배치(`inkLines.ts`). Three `LineSegmentsGeometry` + `LineMaterial`(`worldUnits: false`, `linewidth: 1.4` px, `resolution` 갱신, `dashed` 지원, 클리핑 평면 지원) 기반. 재질을 상속해 vertex/fragment에 다음을 추가한다.

~~~glsl
// vertex 추가 (instance 속성)
attribute vec3 instanceFlatStart, instanceFlatEnd;  // 종이 평면(y=0)에 눕힌 위치
attribute vec2 instanceReveal;                       // (t0, dur), 그림 로컬 0..1
uniform float uLift;                                  // 0 납작 → 1 입체
uniform float uReveal;                                // 펜 진행 0..1
vec3 s = mix(instanceFlatStart, instanceStart, uLift);
vec3 e = mix(instanceFlatEnd,   instanceEnd,   uLift);
// fragment 추가
float local = (uReveal - vReveal.x) / max(vReveal.y, 1e-4);
if (local < vSegmentT) discard;                       // 아직 안 그린 구간
~~~
- `InkLineSet.add(points, {closed, width, t0, dur})`, `build()`, `setLines()`(재구성), `capacity` 사전 할당(그림당 ≤ 3,000 세그먼트). `flat` 위치는 기본 `(x, 0, z)`(평면 투영). 색은 잉크 `#252721`에 선별 `bias`(0.3–0.6)로 농담.
- 펜 스케줄러 `Pen`: `next(length)` → `{t0, dur}`을 누적해 돌려준다(긴 선일수록 dur 큼, 기본 0.3). 그림 전체 reveal 길이는 1로 정규화.

(2) 종이 채움(`paperFill.ts`). `MeshStandardMaterial` 확장: 색 `#fbf6ec`, `onBeforeCompile`로 해칭을 추가한다. 해칭 = 객체 공간 방향 `hatchA`, `hatchB`(단위 벡터)에 대한 `sin(dot(pos, dir)/spacing)` 줄무늬를 `(1 − NdotL)`로 가중해 어두운 면에만 잉크 줄이 보이게. `uLift`는 `position`과 `flat` 속성을 morph target(`morphTargetInfluences[0]`)으로 처리해 커스텀 셰이더 없이 구현한다.

(3) 그림 빌더(`figure.ts`).

~~~ts
export interface InkFigure extends PreparedScene {
  readonly figureId: string;
  readonly hitTargets: Mesh[];               // 투명 피킹 메시(기존 pickTargets 계약)
  setLift(t: number): void;                  // sceneProgress와 연결
  setReveal(t: number): void;
  setGlow(id: string, amount: number): void; // 재생 중 음표 강조(emissive 강조색)
  update(time: number, camera: Camera): void; // 선 폭 해상도 갱신 등
}
export function figure(id: string, build: (f: FigureBuilder) => void): InkFigure;
// FigureBuilder: line(points, opts) · box(size, pos, opts) · lathe(profile, opts) · label(text, pos, opts) · hit(id, box)
~~~

(4) 음가 그림(`music/durationFigure.ts`). `durationWorld.ts`에서 `durationBounds`·`BAR_WIDTH`·`BLOCK_HEIGHT`·`BLOCK_DEPTH`·`clampedPosition`을 **그대로 import**하고 표현만 바꾼다.
- 레인 = 잉크 시간 축(기준선 + 0/¼/½/¾/1 눈금 + 작은 숫자 라벨 '0, 1/2, 1').
- 음표 = `box`(종이 채움+해칭) + 12개 모서리 잉크 선. 선택 = 강조 잉크(`#B96335`) 두께 2.2 px 외곽선. 재생 중 = `setGlow`(채움 emissive 0.35, 강조색) + 재생선(잉크 1.6 px, 축 높이 0.72, `setPosition` 그대로).
- 쉼표 = 점선 잉크 외곽선만(채움 없음, 기존 의미 유지), 피킹 메시는 투명 유지.
- 분할 애니메이션(`splitMerge 240 ms`): 새 경계선이 먼저 그려지고(reveal) 두 블록으로 나뉜다. 데이터는 즉시 바뀌고 그림만 보간한다(v2.1 §8.5).
- `createDurationFigure(events)`는 `{ group, hitTargets, setEvents, setHighlight, setPosition, setLift, setReveal, dispose }`를 돌려주어 `lessonScene.ts`의 호출부 변경을 최소화한다.

(5) 등장·퇴장 연결. `BookApp`의 `draw({sceneProgress})`는 유지하고, `stage.ts`가 `sceneProgress`를 `uLift`로 넘긴다(`scale.y` 제거). 첫 등장: `reveal`(0→1, 520 ms)과 `lift`(0→1, 600 ms, 120 ms 지연)를 겹쳐 실행. 재방문: reveal 1 고정, lift만 200 ms. 퇴장/드래그 p<0.16: lift만 1→0(펜 되감기 없음). 그림자는 lift ≥ 0.3부터 `castShadow` 활성.

(6) 장식 그림(`music/decor.ts`). 펼침면 1: 긴 소리/짧은 소리를 표현한 잉크 '소리 띠'와 작은 메트로놈 추 선화. 펼침면 2: 가위 자국·분수 표기. 모두 의미 보조이며 학습 정본이 아니다. 각 ≤ 400 세그먼트.

**유지할 불변식.** `x = onset×10`, `width = duration×10`(길이 비율 보존). 블록 높이·깊이 고정(음량으로 오해 금지, v2.1 §8.5). 피킹 결과 `eventId`는 기존 `pickEvent` 계약. 넘김 잎이 그림을 실제로 가림(depthTest, 클리핑 창 `setSceneWindow` 유지).

**완료 기준.**
- 자동: `ink-lines.test.ts` — reveal 속성 단조, flat 위치 y=0, capacity 초과 시 `setLines` 폴백, dispose 후 geometry/material 0. `duration-figure.test.ts` — 기존 6개 의미 테스트(좌표·raycast 16개 선택·쉼표 투명) 통과 + lift 0/1에서 hit box 위치 동일.
- 사람: 1280×720과 844×390에서 선 폭 1.2–1.6 px(캡처 확대로 측정), 펜 그리기와 떠오름이 연속 캡처 12프레임에서 확인, 재생 중 글로우·재생선 동작, 분할 240 ms 보간. 장면 draw call ≤ 40(`renderer.info.render.calls`).

**위험과 완화.** (a) `LineMaterial`의 `resolution`을 resize마다 갱신해야 함 → `stage.render()`에서 일괄 갱신. (b) 잉크 선이 종이와 z-fighting → 납작 상태에서 `polygonOffset` 및 y+0.004 lift 바닥. (c) 모바일 fill-rate → 그림 세그먼트 예산(장면 ≤ 6,000)과 저티어에서 해칭 off.

---

### R5 조작부 재배치

**목표.** 페이지에서 HTML 조작을 모두 걷어내고, 원본처럼 **책 밖 하단 조작바**와 **페이지 안 인쇄형 핫스폿·플랩·도장**으로 나눈다.

**변경 파일.** 신규 `ui/Toolbar.tsx`, `ui/RecordsDialog.tsx`, `ui/ContentsFlap.tsx`(R8에서 목차 페이지와 결합), `styles/toolbar.css`. 수정 `BookApp.tsx`(내비게이션 버튼·책갈피 제거, 조작바 마운트, `navigate`/`open`/`changeReadingMode` 연결), `BookProgressTools.tsx`(페이지 안 → 대화상자 본문으로 이동), `content/pages/*`(인쇄 버튼·플랩·도장 블록), `styles/book.css`(`.book-navigation` 제거). 테스트 수정 `tests/book-navigation-placement.test.ts`(삭제 또는 조작바 배치로 대체), e2e 셀렉터.

**상세 설계.**

(1) 조작바.
~~~tsx
<nav className="book-toolbar" aria-label="책 조작" data-visible={book.isOpen}>
  <button data-testid="book-prev" aria-label={first ? '표지로' : '이전 펼침면'} onClick={() => navigate('prev','button')}>←</button>
  <button data-testid="book-contents" onClick={openContents}>목차</button>
  <button data-testid="book-next" aria-label="다음 펼침면" disabled={last} onClick={() => navigate('next','button')}>→</button>
  <span className="book-toolbar-folio" aria-live="polite">{folio}</span>
  <button aria-pressed={!muted} onClick={toggleSound}>소리</button>
  <button aria-pressed={reducedMotion} onClick={toggleStill}>정지 화면</button>
  <button data-testid="reading-mode" onClick={changeReadingMode}>{mode==='3d' ? '크게 읽기' : '3D로 보기'}</button>
  <button data-testid="records" onClick={openRecords}>기록</button>
</nav>
~~~
- 높이 52 px, `padding-bottom: env(safe-area-inset-bottom)`, 배경 반투명 책상 톤, 버튼 44×44. 표지 상태(`coverIdle`)에서는 숨기고 표지 안 힌트만 둔다(COVER-INTRO 유지). `stage`의 safe rect 하단에 조작바 높이를 더해 책이 가려지지 않게 한다(`--book-safe-bottom` 변수 재사용).
- '소리'는 학습 음악 음소거와 효과음을 **함께** 끈다(단일 스위치, 세부는 기록·설정에서).
- '정지 화면'은 `SET_REDUCED_MOTION` + 저장 설정(`reducedMotion`)과 동일 경로.

(2) 페이지 안 조작(인쇄형). 펼침면 1 오른쪽: `▶ 위 줄 듣기`, `▶ 아래 줄 듣기`, `■ 정지`, `가까이 보기`(R6 샷). 펼침면 2 오른쪽: `▶ 내 리듬 듣기`, `■ 정지`, `둘로 나누기`, `앞과 합치기`, `뒤와 합치기`, `되돌리기`, `다시 하기`. 일시정지는 조작바가 아니라 인쇄 버튼 `‖ 잠깐 멈춤`(playing일 때만 활성 표시). 왼쪽: 질문 라디오 + `정답 보기` 플랩. 플랩을 열면 해설이 보이고, 세 문항을 맞히면 `stampSlot`에 도장(`확인`)이 찍힌다(state 레이어, 저장은 기존 `answers`/`hints`에서 파생—새 저장 필드 없음).

(3) 플랩 메시. 종이 위 작은 직사각형 메시(종이 재질, 두께 0.003)가 윗변 힌지로 0→110° 열린다(240 ms). 열림 상태는 `hints[\`${sceneId}/answer\`]`에 저장(기존 `onHint` 경로). 플랩 아래 인쇄는 print 텍스처에 포함(열림/닫힘 두 장 캐시).

(4) 기록 대화상자. 기존 `BookProgressTools`의 백업·내보내기·가져오기·삭제·설정(2D/모션/음량/품질 티어)을 `<dialog>`로 옮긴다. 책 밖 모달이므로 C1 개정에 포함. 열려 있는 동안 책은 `inert`, Arrow 키 가로채기 중지(EN02 유지).

**유지할 불변식.** 조작바 버튼 pointerdown은 모서리 드래그를 시작하지 않음(`turnTargetOwnsInput`에 `.book-toolbar` 추가). 첫 펼침면 이전 = CLOSE_BOOK, 마지막 다음 = disabled(BK09). 키보드 ArrowLeft/Right 동일.

**완료 기준.**
- 자동: 3D 모드에서 `main.book-app` 안의 `button`은 조작바·거울·표지 버튼뿐(테스트로 count 검사). `keyboard-e2e` 통과. `tests/book-turn-hit.test.ts`에 조작바 소유권 케이스 추가.
- 사람: 844×390에서 조작바가 책을 가리지 않음(책 bounds와 조작바 rect 교차 0), 플랩 열림 캡처, 도장 캡처.

**위험과 완화.** 조작바 때문에 세로 가용 높이가 52 px 줄어 책이 작아짐 → safe rect 반영 후 R1 fit이 자동 처리. 568×320에서는 조작바를 36 px 압축형으로.

---

### R6 레슨 카메라 연출(샷)

**목표.** 원본의 핵심 연출인 '카메라가 그림 속으로 들어감'을 **사용자가 시작하고, 읽기 포즈로 정확히 돌아오는** 샷으로 구현한다.

**변경 파일.** 신규 `render/shots.ts`, `content/pages/*`에 `shotId` 참조. 수정 `cameraRig.ts`(`blendTo`, `returnToReading`), `BookApp.tsx`(샷 시작·취소 라우팅), `controller.ts`(**이벤트 2개 추가**: `SHOT_START`, `SHOT_END`; `camera: 'shot'` 상태 추가), `stage.ts`(샷 중 fit 중지). 테스트 `tests/book-controller.test.ts`에 샷 케이스 추가, 신규 `tests/shots.test.ts`.

**상세 설계.**

(1) 샷 정의는 절대 좌표가 아니라 **영역+각도**다. viewport가 달라도 같은 fitter로 포즈를 계산한다.
~~~ts
export type ShotSpec = Readonly<{ id: string; region: { pageId: PageId; rect: UvRect } | 'figure:duration-lanes';
  pose: RigPose; margin: number; duration: number; holdMs?: number }>;
export const SPREAD_SHOTS: Readonly<Record<SpreadId, readonly ShotSpec[]>> = {
  'spread-1': [{ id: 'lanes-close', region: 'figure:duration-lanes', pose: { elevationDeg: 36, azimuthDeg: -14, fovDeg: 32 }, margin: 0.14, duration: 900 }],
  'spread-2': [{ id: 'strip-close', region: 'figure:duration-strip', pose: { elevationDeg: 34, azimuthDeg: 10, fovDeg: 32 }, margin: 0.14, duration: 900 }],
};
~~~
- 실행: `region`의 월드 bounds(그림이면 `figure.group` bounds, lift=1 기준)를 `cameraRig.fit`에 넣어 목표 `{position, target}`을 구하고, 현재 포즈에서 `smoothStep` 보간(위치·target·쿼터니언 slerp). 샷 중에는 `fitCamera` 중지(`state.suspendFit` 재사용).
- 트리거: 페이지 인쇄 버튼 `가까이 보기`(`{type:'shot'}`), 조작바에는 두지 않는다(원본은 레슨 흐름에 종속). 재생 시작 시 자동 샷은 **설정 옵션**(기본 끔).
- 종료: 같은 버튼 재누름, Escape, 임의 내비게이션·드래그 시작·닫기·hidden → `returnToReading(duration 600)`. 넘김은 샷 복귀가 **완료된 뒤** 시작한다(`preparingTurn` 진입 조건에 `camera !== 'shot'` 추가).
- 복귀 포즈는 읽기 포즈 fit 결과를 그대로 쓰므로 오차 0. reduced motion: 즉시 컷.

(2) 상태 머신 변경(최소).
- `CameraState`에 `'shot'` 추가. `SHOT_START`(token)는 `bookCanInteract && camera==='settled'`일 때만 `camera:'shot'`. `SHOT_END`(token)는 `camera:'settled'`. `NEXT/PREV/TURN_DRAG_START/CLOSE_BOOK/HIDE_DOCUMENT`는 `camera==='shot'`이면 `pendingIntent`에 저장하고 BookApp이 복귀 tween 완료 후 재전송(기존 pendingIntent 정책과 동일 형태).
- `bookCanInteract`는 `camera === 'settled' || camera === 'shot'`으로 확장(샷 중 핫스폿·피킹 허용).

**유지할 불변식.** 넘김·드래그 중 카메라 불변(§6.3 유지). 샷 중에도 표지·책 bounds는 safe 검사 대상이 아니다(의도적 근접). 복귀 후 CI01/CI02 재성립.

**완료 기준.**
- 자동: reducer 테스트 — 샷 중 NEXT는 pending, SHOT_END 후 실행; 샷 중 드래그 시작 거부; hidden에서 샷 해제. `shots.test.ts` — 5 viewport에서 샷 포즈 fit 성공, 복귀 포즈 == 읽기 포즈(≤ 1e-6).
- 사람: 샷 진입·유지·복귀 연속 캡처, 샷 중 핫스폿 조작 가능, 샷 중 ArrowRight → 복귀 후 넘김.

---

### R7 효과음·마감

**목표.** 종이·표지·펜 소리와 로딩·표지 마감.

**변경 파일.** 신규 `sfx/synthSfx.ts`, `sfx/useBookSfx.ts`. 수정 `audio/AudioEngine.ts`(**효과음 채널 추가**: `playSfx(name, when?)`, 단일 AudioContext 공유, 학습 재생과 별도 gain), `BookApp.tsx`(훅 마운트), `persistence/bookProgress.ts`(`preferences.sfx: boolean`, 스키마 버전 상승 + 이관). 테스트 `tests/audio.test.ts` 확장, 신규 `tests/sfx.test.ts`.

**상세 설계.**
- 절차 합성(자산 없음): `page-turn`(0.35 s 핑크 노이즈 + 2.2 kHz 밴드패스 스윕, 게인 envelope 10/120/200 ms), `page-settle`(짧은 저역 탭 60 ms), `cover-open/close`(80 Hz 사인 + 노이즈 burst 0.25 s), `pen`(3 ms 클릭 + 1.8 kHz 감쇠 40 ms), `flap`(종이 짧게 0.15 s), `stamp`(저역 탭 + 노이즈 0.12 s).
- 매핑(`useBookSfx`): `TURN_PREPARED`→`page-turn`(드래그는 release commit 시), `SETTLED`→`page-settle`, `opening`/`closing` 시작→`cover-*`, 핫스폿 pressed→`pen`, 플랩→`flap`, 도장→`stamp`. 음악 재생 중에는 `pen`을 내지 않는다(어택 혼동 방지, AU 계약).
- 첫 사용자 제스처(표지 열기) 이전에는 소리 없음. `AudioContext`는 기존 엔진의 단일 컨텍스트를 쓰고 `resume`은 기존 정책을 따른다.
- 마감: 표지 로딩 진행을 표지 하단 힌트 영역에 잉크 선으로 그림(현재 텍스트 유지), 폰트·텍스처 프리로드 순서(표지 → 본문 폰트 → 기보 폰트 → 첫 펼침면 print), `index.html` 정적 표지는 유지.

**완료 기준.** 자동: 효과음 OfflineAudioContext 렌더 길이·피크 ≤ −6 dBFS, `preferences.sfx=false`에서 노드 생성 0, 음악 playing 중 `pen` 호출 무시. 사람: 실제 청취 1회(기록만, 청취 검수는 R9 사람 항목).

---

### R8 콘텐츠 확장(6 펼침면 + 목차 + 마침)

**목표.** 책 한 권. `content/lesson.ts`에 이미 있는 scene-3~6 데이터를 페이지 DSL과 그림으로 잇는다.

**변경 파일.** `manifest.ts`(`SpreadId` 확장: `contents`, `spread-1`…`spread-6`, `closing`; `PageId` 일반화 `page-{n}`), `content/pages/contents.ts`, `spread-3..6.ts`, `closing.ts`, `figures/music/*`(장면 3–6 그림: 합산 가이드선·쉼표 비움 구간·템포 눈금·자유 마디), `useBookProgress.ts`(`supportsStoredSpread` 확장), `controller.ts`(**다중 잎 이동** `GO_TO(spreadId)`: 잎 수 n을 `turningForward` 동안 순차 처리, 잎 간 stagger 45 ms, 전체 ≤ 1.6 s), `stage.ts`(동시 잎 ≤ 3장 렌더: `TurningLeaf` 풀 3개), `geometry.ts`(`stackHeights`는 spreadCount만 바뀌므로 그대로).

**상세 설계 요점.**
- 목차 페이지: 레슨 제목 6개 + 쪽수 인쇄, 각 항목 핫스폿 `{type:'contents', spreadId}` → `GO_TO`. 조작바 '목차'는 `GO_TO('contents')`.
- 장면 3(조합): 1/4·1/8·1/16 인쇄 버튼으로 추가, 목표 1/2 가이드선 잉크. 장면 4(쉼표): note↔rest 토글 버튼, 쉼표 구간 비움+점선. 장면 5(템포): 60/120 라디오, 초 눈금 잉크 라벨 변화(블록 길이 불변). 장면 6(자유 마디): 음표·쉼표 추가·삭제 버튼, 조건 3개 인쇄 체크, 성공 도장.
- 프리페치: 현재 ±1 펼침면 draft print, 그림은 현재만(활성 장면 1개 불변식).
- 저장 이관: `bookUiVersion` 상승, 기존 `spread-1/2` 값은 그대로 유효.

**완료 기준.** MU01–08·AU01–07 전부 통과(이미 있는 테스트가 장면 3–6 의미를 덮음). BK08(next 10회·prev 교차) 6 펼침면으로 재실행. 목차→레슨 4 다중 잎 이동 연속 캡처. 텍스처 예산 ≤ 48 MB 유지(`renderer.info.memory.textures` ≤ 14).

---

### R9 검증 관문 개편·정리

**목표.** 원본 닮음을 차단 관문으로 만들고 레거시를 지운다.

**변경 파일.** `docs/qa/BOOK_EXPERIENCE_GATE_V3.md`, `docs/qa/MOTION_COMPARISON.md`(프롬프트 V16 양식), `scripts/visual-baseline.ts`(Playwright 캡처 매트릭스), `scripts/perf-budget.ts`. 삭제 목록은 §4 표.

**상세 설계.**
- **G1-C 체크리스트(부록 B)** 13항목을 각각 `일치 / 의도적 차이 / 불일치 / 미관측`으로 판정. 정체성 5항목(원근 카메라, 종이 조명·곡면, 잉크 그림·떠오름, 조작부 위치, 연출 샷) 중 하나라도 `불일치`면 R8 확장·배포 금지.
- 원본 관측 자료: 에이전트가 원본 WebGL을 볼 수 없으므로 **사용자가 Windows PC에서 같은 시퀀스(열린 책→레슨 1→그림 등장→샷→Next→Previous)를 화면 녹화**해 `docs/reference/original/`(저장소 밖 보관, 경로만 기록)에 둔다. 녹화 없이는 해당 항목 `미관측` 유지(프롬프트 §1.3).
- 캡처 매트릭스: 3 viewport × {표지, 열림 50%, 펼침면 1, 넘김 50%, 펼침면 2, 샷, 2D} × {renderer: legacy, ink} = 42장. 회귀는 같은 앱 전후 비교에만 쓰고 원본과 픽셀 일치를 목표로 삼지 않는다(V16).
- 성능 예산(`perf-budget.ts`): 초기 draw calls ≤ 150, 장면 ≤ 40, 텍스처 ≤ 48 MB, 넘김 중 p95 frame ≤ 33 ms(데스크톱 headless는 참고치), 50회 왕복 후 `geometries/textures/programs` 증가 0.
- 정리: `renderer: 'legacy'` 경로·레거시 파일 삭제, `vercel.json`·`README.md`·`docs/ARCHITECTURE.md` 갱신, 라이선스 `public/licenses/`에 한글 폰트 OFL 추가.

**완료 기준.** 체크리스트 정체성 5항목 `불일치` 0, 미관측은 사유 기록. 빌드 `main` 청크 경고(500 kB 초과)는 three/vexflow 분리 청크로 해소하거나 사유 기록.

---

## 7 파일 변경 매트릭스

| 경로 | 처리 | 단계 | 비고 |
|---|---|---|---|
| `src/book/profile.ts` | 신규 | R1 | renderer 플래그·품질 티어 |
| `src/book/render/cameraRig.ts` | 신규 | R1 | fitPerspective, 포즈, 샷 보간(R6) |
| `src/book/pageProjection.ts` | 수정→삭제 | R1→R9 | affine→homography(과도기) |
| `src/book/stage.ts` | 수정(대) | R1, R2, R3, R4 | 카메라·재질·환경·후처리 위임, `scale.y` 제거, state 텍스처 |
| `src/book/geometry.ts` | 수정 | R2 | 곡면 프로필·잎 양 끝 블렌드·스택 상면 |
| `src/book/render/paperMaterial.ts` | 신규 | R2 | 잉크 곱 종이 재질 |
| `src/book/render/spreadSurface.ts` | 신규 | R2 | 정지 펼침면 곡면 메시 |
| `src/book/render/environment.ts` | 신규 | R2 | 책상·매트·PMREM·조명 |
| `src/book/render/postPipeline.ts` | 신규 | R2 | composer·티어 |
| `src/book/print/*` (8파일) | 신규 | R3 | DSL·배치·페인트·래스터·합성·핫스폿·훅·거울 |
| `src/content/pages/*` | 신규 | R3, R8 | 페이지 DSL |
| `src/book/BookNotation.tsx` | 수정 | R3 | `renderNotation()` 추출 |
| `src/book/usePagePrints.ts`, `pageSnapshot.ts`, `notationPreparation.ts` | 삭제 | R9 | R3 뒤 legacy 전용 |
| `src/book/LessonPages.tsx` | 축소 | R3, R8 | 2D 경로 전용, DSL 해석기로 |
| `src/book/figures/*` (6파일) | 신규 | R4 | 잉크 그림 시스템 |
| `src/scenes/durationWorld.ts` | 축소 | R4 | 의미 함수만 남김(`durationBounds` 등) |
| `src/book/lessonScene.ts` | 수정 | R4 | figure 사용, API 유지 |
| `src/book/motion.ts` | 수정 | R4, R6 | 토큰 추가 |
| `src/book/ui/*` (3파일) | 신규 | R5, R8 | 조작바·기록 대화상자·목차 |
| `src/book/BookProgressTools.tsx` | 이동 | R5 | 대화상자 본문 |
| `src/book/navigationPlacement.ts` | 삭제 | R5 | 조작바로 대체 |
| `src/book/controller.ts` | 수정(소) | R6, R8 | `camera:'shot'`, `SHOT_*`, `GO_TO` |
| `src/book/render/shots.ts` | 신규 | R6 | 샷 정의·실행 |
| `src/book/sfx/*` | 신규 | R7 | 합성 효과음 |
| `src/audio/AudioEngine.ts` | 수정(소) | R7 | 효과음 채널 |
| `src/persistence/bookProgress.ts` | 수정(소) | R7, R8 | `sfx`, `quality`, spread 확장, 이관 |
| `src/book/manifest.ts` | 확장 | R8 | N 펼침면·목차·마침 |
| `src/book/BookApp.tsx` | 수정(대) | R1–R8 | 렌더 세부 제거, 라우팅만 |
| `src/App.tsx`, `scenes/DurationScene3D.tsx`, `components/ConceptQuiz.tsx`, `notation/NotationView.tsx`, `styles/app.css`, `styles/adapters.css`, `book/inspector.ts` | 삭제 | R9 | 미사용 레거시(`main.tsx`는 `BookApp`만 마운트) |
| `scripts/visual-baseline.ts`, `scripts/perf-budget.ts`, `scripts/extract-page-fonts.mjs` | 신규 | R3, R9 | |
| `docs/CONTRACT_V3.md`, `IMPLEMENTATION_CONTRACT_V3.md`, `BUILD_STATUS_V3.md`, `qa/BOOK_EXPERIENCE_GATE_V3.md`, `qa/MOTION_COMPARISON.md`, `qa/refactor/R*/` | 신규 | R0, R9 | |

---

## 8 테스트·검증 이관

| 테스트 파일 | 처리 | 단계 |
|---|---|---|
| `domain`, `lesson`, `assessment`, `audio`, `audio-transport`, `persistence`, `book-progress`, `book-progress-session`, `book-audio-ownership`, `book-scene-host`, `book-gesture`, `book-turn-hit`, `qa-evidence` | **유지**(무변경 통과 필수) | 전 단계 |
| `book-controller` | 유지 + 케이스 추가(샷, GO_TO) | R6, R8 |
| `book-geometry` | 유지 + 곡면 블렌드 케이스 | R2 |
| `book-page-projection` | 재작성(homography) → 삭제 | R1 → R9 |
| `book-page-snapshot`, `book-notation-preparation` | legacy 전용 → 삭제 | R9 |
| `book-navigation-placement` | 삭제(조작바) | R5 |
| `book-lesson-scene` | 수정(figure API) | R4 |
| `duration-world` | 의미 케이스를 `duration-figure`로 이전 | R4 |
| 신규 `book-camera-rig`, `book-spread-surface`, `print-layout`, `print-compositor`, `hotspots`, `ink-lines`, `duration-figure`, `shots`, `sfx` | 추가 | 각 단계 |
| e2e `scripts/*-e2e.ts` | 셀렉터를 거울·조작바 `data-testid`로 수정 | R3, R5 |

단위 테스트는 현재처럼 `node --test tests/*.test.ts`(Three 객체는 CPU에서 생성 가능). WebGL 의존 검사는 Playwright HTTP 스크립트(`scripts/three-http-e2e.ts` 양식)로 분리한다.

---

## 9 위험과 롤백

| 위험 | 영향 | 완화·롤백 |
|---|---|---|
| R3가 커서 중간에 기능이 깨짐 | 학습 조작 불가 | `renderer:'legacy'`가 R9까지 살아 있음. 각 단계 종료 시 legacy 경로 e2e 재실행 |
| 캔버스 텍스트가 DOM보다 흐림 | 가독성 불만 | settled 해상도 상향(2048) 옵션, '크게 읽기' 2D 유지 |
| 모바일 성능(후처리·해칭·그림자) | 30fps 미달 | 품질 티어 자동 강등, 저티어 캡처 별도 기록 |
| 한글 폰트 권리 | 배포 불가 | OFL 서체만, `font-license-audit.ts` 통과를 빌드 조건으로 |
| 원본 관측 불가 | G1-C 미관측 | 사용자 녹화 요청, 미관측은 통과로 바꾸지 않음 |
| 저장 스키마 변경 | 기존 진행 손실 | 기존 strict 이관 경로(백업→검증→새 키) 재사용, `book-progress` 36개 테스트 유지 |
| 스크린리더 경험 저하 | AX21 | 거울 DOM 읽기 순서 테스트 + R9 사람 검수 항목 |

---

## 10 일정·의존 그래프

~~~text
R0 ─► R1 ─┬─► R2 ─────────────┐
          │                    ├─► R5 ─► R6 ─► R7 ─┐
          ├─► R3 ──────────────┤                   ├─► R8 ─► R9
          └─► R4 (R3과 병렬) ──┘                   │
~~~

- 임계 경로: R0 → R1 → R3 → R5 → R8 → R9.
- 병렬 가능: R2 ∥ R3 ∥ R4(모듈 독립). 단, `stage.ts`를 동시에 고치므로 R2는 `render/*`에, R4는 `figures/*`에 코드를 두고 `stage.ts` 통합은 순서대로(R2 → R4) 한다.
- 각 단계 종료 조건: 전후 캡처 42장 중 해당 단계 묶음 + `npm run typecheck && npm run lint && npm test && npm run build` exit 0 + `BUILD_STATUS_V3.md` 보고(프롬프트 §2 양식).
- 중단 규칙: 어떤 단계든 CI01–03/EN02/BK13–16/MU/AU 회귀가 생기면 다음 단계로 가지 않는다.

---

## 부록 A 원본 관측 요약(정적 번들, 2026-10-29, 복제 금지)

공개 번들(`main-CpVTDnX_.js`, `stores-CVfpJjy0.js`, `index-BcX2LtBz.js`, `mannequin-DWn60bau.js`)의 정적 분석이다. 실측 영상이 아니며, 원본 소스·설계 파일을 확보한 것이 아니다. 본 설계의 수치는 이 표를 **범위 참고**로만 썼다.

| 영역 | 관측 | v3 대응 |
|---|---|---|
| 카메라 | PerspectiveCamera(fov 30, near 20, far 9000). 레슨 데이터에 `watchShots`(wide/close/cutaway/angle/handover)와 코드에 `watch` 단계(pos/look/follow + show/cutAway) | R1 원근 32°, R6 샷(영역+각도) |
| 페이지 곡면 | CPU 계산. 파라미터 `BULGE 1.6, HOLLOW 1.2, SPINE 1.3, CURL .3, CURL_Z .5, DIP_N 2.5, DROOP .002`, 넘김 중 `CURL·sin(2πu)` | R2 `SPREAD_PROFILE`(책등 홈·배부름·처짐), 기존 잎 적분 유지 |
| 종이 재질 | 표준 재질을 `onBeforeCompile`로 패치(키 `ej-page`): 잉크·인쇄·spill 텍스처 슬롯 + 키라이트 역광 | R2 `paperMaterial`(잉크 곱 + state + 섬유) |
| 페이지 텍스처 | 캔버스 생성, 저해상도(1.6 px)·고해상도(6 px) 2패스. 서체 `Source Serif 4 Variable` | R3 draft/settled 2해상도, OFL 한글 서체 |
| 환경·조명 | 절차 방 PMREM, 배경 `#b9b0a2`, `environmentIntensity .75`, 스폿(`#f3f7ff` 4.2, 그림자 2048, normalBias .8, radius 2.4), 반구광 .35, 절차 참나무 책상 + 패드 | R2 환경·조명 |
| 후처리 | AO(radius 14, intensity 2, samples 8) → SMAA HIGH → Vignette(.28/.42) → Neutral tone map → 사용자 정의 Hue tone map(exposure, desat). antialias off, DPR ≤ 1.5 | R2 GTAO·SMAA·Vignette·Neutral, 티어 |
| 그림(잉크) | 배치 폴리라인 집합(`capacity` 사전 할당, `add(points,{closed,t0,dur,width})`, `build`), `ink({widthPx 1.1–1.5, bias})`, `paper({color '#fbf6ec', hatchA, hatchB, spacing, seed, shade})`, Lathe/Sphere 종이 면, 펜 스케줄 `{t0, dur .3}`, 평면 투영↔입체 보간(`i`, `_flat`), 매 6프레임 재투영 | R4 `inkLines`(widthPx·reveal·lift), `paperFill`(해칭) |
| 에너지 표현 | `setPower`, `glowObjects`, `lit` 가중, 색 흐름 | R4 `setGlow`(재생 중 음표) |
| 조작 | `press/hover/cursor/targets/tap('pen')/a11y('Show the X store')`, `hitTest`(페이지 메시 레이캐스트), `goTo(L,{duration,beforeTurn})`, 잎 지연 `we·se`, 외부 하단 조작부(관측) | R3 핫스폿·거울, R5 조작바, R8 `GO_TO` |
| 소리 | `sound.js` 지연 로드, `setEnabled/hold/unlock`, `tap('pen')` | R7 합성 효과음 |
| 분량 | 10 레슨, `folios [2n+2, 2n+3]`, runningHead, 용어집·출처·교사 노트 | R8 6 펼침면 + 목차 + 마침 |

직접 모서리 드래그는 번들에서 확인되지 않았다(`MOTION_REFERENCE.md` 동일). 사용자 필수 요구이므로 유지한다.

---

## 부록 B G1-C 원본 비교 체크리스트(v3)

| # | 항목 | 정체성 | 판정 기준 |
|---|---|---|---|
| 1 | 원근 카메라와 책의 입체감 | ● | 먼/가까운 변 비율 0.86–0.92, 두께·책등 깊이 읽힘 |
| 2 | 종이 조명·곡면·그림자 | ● | 휘도 차 3–8%, 책등 홈, 잎 그림자 |
| 3 | 잉크 그림의 그려짐·떠오름 | ● | 펜 reveal + 평면→입체, 선 폭 1.2–1.6 px |
| 4 | 조작부 위치(책 밖 바 + 인쇄형 핫스폿) | ● | 페이지 안 HTML 0 |
| 5 | 연출 샷과 정확한 복귀 | ● | 복귀 오차 0, 넘김 중 불변 |
| 6 | 표지 힌지·두께·열림 중간 프레임 | | BK02 |
| 7 | 넘김 잎 곡률·앞뒷면·가림 | | BK03 |
| 8 | 장면이 페이지에 종속(등장·퇴장 연동) | | BK04·BK05 |
| 9 | 전이 시간감·easing | | 토큰 비교표 |
| 10 | 입력 응답(≤ 100 ms 피드백) | | pressed 레이어 |
| 11 | 재방문 상태 보존 | | BK06 |
| 12 | 효과음 존재·억제 규칙 | | R7 |
| 13 | 모바일 가독성(844×390) | | x-height, 44 px |

---

## 부록 C 사용자 결정이 필요한 항목

| # | 질문 | 권장 | 영향 |
|---|---|---|---|
| 1 | 책에 부착된 책갈피(EDGE-NAV)를 없애고 조작바 이전/다음으로 대체할까? | 대체(C9) | R5 |
| 2 | 효과음 기본 켬? | 켬, 조작바 '소리'로 끔(C8) | R7 |
| 3 | 책상 질감: 나뭇결 vs 리넨(모두 절차 생성) | 리넨(음악 교재 톤, 원본과 의도적 차이) | R2 |
| 4 | 본문 서체: Pretendard(산세리프) + Noto Serif KR(제목) 조합 | 권장 | R3 |
| 5 | 재생 시작 시 자동 샷 | 끔(설정 옵션) | R6 |
| 6 | 원본 화면 녹화 제공(Windows PC, 동일 시퀀스) | 필요. 없으면 G1-C 정체성 항목 일부가 `미관측`으로 남음 | R9 |

---

## 부록 D 토큰 초기값(제안값, 실측 아님)

| 토큰 | 값 | 단계 |
|---|---|---|
| 카메라 | fov 32°, 고도각 58°, 방위각 0°, fit 여유 1.018 | R1 |
| 샷 | 고도각 34–38°, 방위각 ±10–14°, margin 0.14, 900 ms in / 600 ms out | R6 |
| 종이 | paper `#f4eedc`, roughness 0.94, 섬유 0.965–1.0, spineDip 0.022, bulge 0.034, droop 0.006 | R2 |
| 조명 | 스폿 `#fff4e4` 3.4 @(-3.2, 7.5, 3.0), 반구 0.35, env 0.55, Neutral/exposure 1.0 | R2 |
| 후처리 | GTAO r 0.18 s 12, SMAA, vignette 0.95/0.38 | R2 |
| 인쇄 | draft 768×1086, settled 1536×2172(모바일 1280×1810), 본문 1.55%H, 제목 2.3%H, 잉크 `#252721` | R3 |
| 잉크 | 선 폭 1.4 px(강조 2.2), bias 0.3–0.6, 해칭 spacing 0.55, 그림 ≤ 3,000 세그먼트, 장면 ≤ 6,000 | R4 |
| 모션(기존 유지) | intro 1100, cover 1000, turn 1120, enter 600, revisit 200, exit 180, settle 100 | — |
| 모션(추가) | reveal 520, lift 600(지연 120), stagger 45, splitMerge 240, flap 240 | R4, R5 |
| 효과음 | page-turn 0.35 s, settle 60 ms, cover 0.25 s, pen 40 ms, 피크 ≤ −6 dBFS | R7 |
| 예산 | draw calls 초기 ≤ 150 / 장면 ≤ 40, 텍스처 ≤ 48 MB, 넘김 p95 ≤ 33 ms | R9 |
