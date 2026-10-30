# R3 캔버스 페이지 인쇄 시스템 — 캡처와 측정

| 항목 | 내용 |
|---|---|
| 단계 | R3 (V21), 설계서 §6 R3, 프롬프트 §3.3 R3-a–e |
| before | [R2 after](../R2/index.md) — 정지 쪽은 HTML 겹침, 넘김 잎만 DOM→SVG→캔버스 스냅샷 |
| after (ink) | `after/*_ink.jpg` 18장 — 모든 쪽이 인쇄 텍스처, 접근성 거울, 임시 조작바 |
| 비교 (legacy) | `after/*_legacy.jpg` 12장 — 착수 커밋 고정 사본(`?renderer=legacy`) |
| 명령 | `node scripts/refactor-capture.ts --stage R3 --phase after --renderer ink --quality high`<br>`node scripts/refactor-capture.ts --stage R3 --phase after --renderer legacy --states spread1,turn50,spread2,2d`<br>`node scripts/book-v3-e2e.ts --viewport W×H --out docs/qa/refactor/R3/e2e-W×H.json` |
| 환경 | Linux 컨테이너, Node 22.23.4, Playwright 1.60, headless Chromium 1243(SwiftShader WebGL), DPR 1, 외부 요청 차단 |

headless 캡처는 실기기 통과가 아니다. SwiftShader는 소프트웨어 GL이라 프레임 하나가 0.8–3 s 걸린다(편집→화면 지연은 실 GPU를 대표하지 않는다).

## 무엇이 바뀌었나

- **3D 쪽은 모두 인쇄 텍스처다.** 3D DOM에 `.book-page`/`.book-paper-dom` 요소가 0개다(3 viewport). 글자·오선·인쇄형 단추·라디오·접힘 탭·도장 칸이 쪽마다 하나의 CanvasTexture에 인쇄되고, R2의 조명 받는 종이 셰이더가 종이색·섬유를 곱한다. R1의 matrix3d로 기운 HTML 글자와 R2 known-offset(곡면을 따르지 않는 HTML 글자)은 사라졌다: 글자는 곡면 쪽에 그대로 인쇄된다.
- **상태 레이어.** 선택 음표(호박색 마커), 재생 음표(파란 점선), 마우스 올림, 누름, 키보드 초점 링은 인쇄를 다시 하지 않고 512 px RGBA 레이어에 그려 종이 셰이더가 곱한다.
- **입력.** 종이 위 포인터는 곡면 쪽 메시에 raycast해 쪽 좌표로 바꾼 뒤 인쇄 핫스폿을 찾는다(인쇄 조작 → 모서리 드래그 → 그림 선택 순). 키보드·보조기술은 시각 숨김 접근성 거울이 같은 명령을 보낸다.
- **조작바(임시).** 크게 읽기·음소거·기록과 설정이 책 밖 오른쪽 위로 옮겨졌다(R5에서 하단 한 줄 조작바로 완성).
- **legacy와 비교.** 착수 커밋은 직교 위에서 본 큰 HTML 쪽이라 글자가 크다(1280×720에서 본문 14 px, 쪽 안 스크롤). 인쇄 책은 원근 사선 포즈에서 쪽 하나가 약 300×437 px라 본문이 7.7 px다. 이것이 B6(x-height 미달)의 원인이며, 읽기는 '크게 읽기' 2D 책과 R6 가까이 보기 샷으로 보완한다.

## 판정

| 기준 (설계서·프롬프트 R3) | 결과 | 근거 |
|---|---|---|
| 3D DOM에 `.book-page` 시각 요소 0개 | **통과** | metrics `htmlPageElements` 0 (3 viewport), e2e |
| 본문 x-height ≥ 7 px(1280×720), ≥ 5.5 px(844×390) | **미달 → B6 처리** | 4.1 px / 2.1 px. 모든 왼쪽 쪽에 '크게 읽기' 안내 인쇄 |
| 분할 10회 연속 draft 갱신 ≤ 60 ms | **통과** | `print:draft` 측정 최대 5.2 ms(3 viewport; 배치+그리기 명령). 클릭→화면 프레임은 SwiftShader 소프트웨어 GL에서 0.03–3.3 s(환경 한계, 대표값 아님) |
| settled 교체 jump 0 | **통과** | draft 프레임과 settled 프레임의 잉크 교차상관 최적 오프셋 (0, 0), 같은 내용 재인쇄는 픽셀 동일(MAD 0). 프레임: `jump-1280x720-*.png` |
| 퀴즈·키보드·악보 조작이 거울 기준으로 동작 | **통과** | `scripts/book-v3-e2e.ts`(과거 e2e 스크립트는 B4대로 보존) |
| 인쇄 핫스폿 44 px | **불가 → B5 재개정** | 최소 10.5 / 5.5 / 4.6 px. 동등 조작(2D 책 44 px, 키보드 거울) |
| 텍스처 메모리 ≤ 48 MB, 왕복 증가 0 | **통과** | 46.1 MiB(6쪽 창), 20회 왕복 뒤 46.1 MiB |
| 같은 revision 파생 / BK12 / AC05 | **통과** | 단위 테스트, e2e 프레임 표본 |

## 사람 검사 항목

- 쪽의 글자·오선이 종이에 인쇄된 것처럼 보이는가(HTML 단추·라디오·스크롤 영역이 없음).
- 400% 확대 캡처에서 글자가 흐리지 않은가(x-height 미달은 B6로 기록).
- 분할 단추를 10번 눌렀을 때 쪽이 깜빡이거나 튀지 않는가.
- 키보드 Tab으로 조작을 옮길 때 종이 위에 초점 링이 보이는가.
- 2D(크게 읽기) 책이 이전과 같은 내용·조작을 주는가.
- 실제 스크린리더로 거울을 읽었을 때 순서가 [ACCESSIBILITY.md](../../ACCESSIBILITY.md) R3 절과 같은가(미실행).

## 측정과 캡처

x-height는 쪽 투영 사각형(`data-layout`)의 화면 px/logical과 본문 글꼴의 OS/2 sxHeight(0.530 em)로 계산했다(400% 확대 확인: [1280×720](xheight-1280x720-400pct.png), [844×390](xheight-844x390-400pct.png)). settled 교체 전후 프레임: [settled 이전](jump-1280x720-1-settled-before.png) · [draft](jump-1280x720-2-draft.png) · [settled 이후](jump-1280x720-3-settled-after.png).

### 캡처

| viewport | 상태 | legacy (착수 커밋) | ink (R3) |
|---|---|---|---|
| 1280x720 | cover | — | [1280x720_cover_ink.jpg](after/1280x720_cover_ink.jpg) |
| 1280x720 | opening50 | — | [1280x720_opening50_ink.jpg](after/1280x720_opening50_ink.jpg) |
| 1280x720 | spread1 | [1280x720_spread1_legacy.jpg](after/1280x720_spread1_legacy.jpg) | [1280x720_spread1_ink.jpg](after/1280x720_spread1_ink.jpg) |
| 1280x720 | turn50 | [1280x720_turn50_legacy.jpg](after/1280x720_turn50_legacy.jpg) | [1280x720_turn50_ink.jpg](after/1280x720_turn50_ink.jpg) |
| 1280x720 | spread2 | [1280x720_spread2_legacy.jpg](after/1280x720_spread2_legacy.jpg) | [1280x720_spread2_ink.jpg](after/1280x720_spread2_ink.jpg) |
| 1280x720 | 2d | [1280x720_2d_legacy.jpg](after/1280x720_2d_legacy.jpg) | [1280x720_2d_ink.jpg](after/1280x720_2d_ink.jpg) |
| 844x390 | cover | — | [844x390_cover_ink.jpg](after/844x390_cover_ink.jpg) |
| 844x390 | opening50 | — | [844x390_opening50_ink.jpg](after/844x390_opening50_ink.jpg) |
| 844x390 | spread1 | [844x390_spread1_legacy.jpg](after/844x390_spread1_legacy.jpg) | [844x390_spread1_ink.jpg](after/844x390_spread1_ink.jpg) |
| 844x390 | turn50 | [844x390_turn50_legacy.jpg](after/844x390_turn50_legacy.jpg) | [844x390_turn50_ink.jpg](after/844x390_turn50_ink.jpg) |
| 844x390 | spread2 | [844x390_spread2_legacy.jpg](after/844x390_spread2_legacy.jpg) | [844x390_spread2_ink.jpg](after/844x390_spread2_ink.jpg) |
| 844x390 | 2d | [844x390_2d_legacy.jpg](after/844x390_2d_legacy.jpg) | [844x390_2d_ink.jpg](after/844x390_2d_ink.jpg) |
| 390x844 | cover | — | [390x844_cover_ink.jpg](after/390x844_cover_ink.jpg) |
| 390x844 | opening50 | — | [390x844_opening50_ink.jpg](after/390x844_opening50_ink.jpg) |
| 390x844 | spread1 | [390x844_spread1_legacy.jpg](after/390x844_spread1_legacy.jpg) | [390x844_spread1_ink.jpg](after/390x844_spread1_ink.jpg) |
| 390x844 | turn50 | [390x844_turn50_legacy.jpg](after/390x844_turn50_legacy.jpg) | [390x844_turn50_ink.jpg](after/390x844_turn50_ink.jpg) |
| 390x844 | spread2 | [390x844_spread2_legacy.jpg](after/390x844_spread2_legacy.jpg) | [390x844_spread2_ink.jpg](after/390x844_spread2_ink.jpg) |
| 390x844 | 2d | [390x844_2d_legacy.jpg](after/390x844_2d_legacy.jpg) | [390x844_2d_ink.jpg](after/390x844_2d_ink.jpg) |

### 인쇄 측정 (ink, spread1 / spread2)

| viewport | 상태 | HTML 쪽 요소 | 거울 조작 수 | 쪽 | 화면 px/logical (세로) | 본문 글자 px | 본문 x-height px | 최소 인쇄 핫스폿 px | layout scale | 인쇄 메모리 MiB (settled/draft/state) | draw calls |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1280x720 | spread1 | 0 | 6 | page-1 | 0.2948 | 7.66 | 4.06 | 10.5 | 1 | 37.27 (2/2/2) | 114 |
| 1280x720 | spread1 |  |  | page-2 | 0.2969 | 7.72 | 4.09 | 14.3 | 1 |  |  |
| 1280x720 | spread2 | 0 | 11 | page-3 | 0.2952 | 7.67 | 4.07 | 10.5 | 1 | 46.1 (2/4/2) | 93 |
| 1280x720 | spread2 |  |  | page-4 | 0.2964 | 7.71 | 4.09 | 14.2 | 1 |  |  |
| 844x390 | spread1 | 0 | 6 | page-1 | 0.1553 | 4.04 | 2.14 | 5.5 | 1 | 37.27 (2/2/2) | 114 |
| 844x390 | spread1 |  |  | page-2 | 0.1564 | 4.07 | 2.16 | 7.5 | 1 |  |  |
| 844x390 | spread2 | 0 | 11 | page-3 | 0.1555 | 4.04 | 2.14 | 5.5 | 1 | 46.1 (2/4/2) | 93 |
| 844x390 | spread2 |  |  | page-4 | 0.1561 | 4.06 | 2.15 | 7.5 | 1 |  |  |
| 390x844 | spread1 | 0 | 6 | page-1 | 0.1286 | 3.34 | 1.77 | 4.6 | 1 | 37.27 (2/2/2) | 114 |
| 390x844 | spread1 |  |  | page-2 | 0.1289 | 3.35 | 1.78 | 6.2 | 1 |  |  |
| 390x844 | spread2 | 0 | 11 | page-3 | 0.1287 | 3.34 | 1.77 | 4.6 | 1 | 46.1 (2/4/2) | 93 |
| 390x844 | spread2 |  |  | page-4 | 0.1288 | 3.35 | 1.78 | 6.2 | 1 |  |  |

### 종이·카메라 (ink spread1, R2와 비교용)

| viewport | 책 폭 비율 | far/near | 종이 음영 % | 표지 중앙 오차 px |
|---|---|---|---|---|
| 1280x720 | 0.6251 | 0.8469 | 4.35 | 0 |
| 844x390 | 0.4989 | 0.8506 | 4.87 | 0 |
| 390x844 | 0.8835 | 0.9377 | 10.86 | 0 |

### 페이지 오류

- 1280x720 ink: 0건 []
- 844x390 ink: 0건 []
- 390x844 ink: 0건 []
- 1280x720 legacy: 0건 []
- 844x390 legacy: 0건 []
- 390x844 legacy: 0건 []

### e2e 1280x720 — 17/17 통과 ([e2e-1280x720.json](e2e-1280x720.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio"]` |
| mirror flap opens the printed questions | 통과 | `null` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:flap:questions", "root": "page-1:flap:questions", "stateBefore": 6, "stateAfter": 7}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 1.4, "draftMeasures": [0.3, 0.3, 0.4, 0.2, 1.1, 0.2, 1.4, 0.3, 0.5, 0.2, 0.8, 0.1, 0.7, 0.2, 0.5, 0.2, 0.3, 0.4, 0.6, 0.2, 0.8, 0.2, 0.5, 0.3,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 18, "notes": 12}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.055, "max": 137}, "bestOffsetPx": {"dx": 0, "dy": 0}, "corre…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-11-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 28, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "23", "rootRevision": "23"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| no page errors | 통과 | `[]` |

### e2e 390x844 — 17/17 통과 ([e2e-390x844.json](e2e-390x844.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio"]` |
| mirror flap opens the printed questions | 통과 | `null` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:flap:questions", "root": "page-1:flap:questions", "stateBefore": 7, "stateAfter": 8}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 5.2, "draftMeasures": [3.9, 0.5, 0.4, 0.2, 0.5, 0.2, 0.5, 0.2, 0.8, 0.1, 0.5, 0.2, 0.6, 0.2, 0.5, 0.2, 0.5, 0.2, 0.5, 0.3, 4.7, 0.3, 5.2, 0.2,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 18, "notes": 12}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.049, "max": 66.7}, "bestOffsetPx": {"dx": 0, "dy": 0}, "corr…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-11-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 30, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "23", "rootRevision": "23"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| no page errors | 통과 | `[]` |

### e2e 844x390 — 17/17 통과 ([e2e-844x390.json](e2e-844x390.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio"]` |
| mirror flap opens the printed questions | 통과 | `null` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:flap:questions", "root": "page-1:flap:questions", "stateBefore": 6, "stateAfter": 7}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 1.1, "draftMeasures": [0.3, 0.2, 0.3, 0.2, 0.5, 0.2, 0.5, 0.3, 0.6, 0.1, 0.5, 0.1, 0.4, 0.2, 0.4, 0.1, 0.6, 0.3, 0.9, 0.2, 0.4, 0.3, 0.7, 0.2,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 18, "notes": 12}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.038, "max": 71.3}, "bestOffsetPx": {"dx": 0, "dy": 0}, "corr…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-11-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 28, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "23", "rootRevision": "23"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| no page errors | 통과 | `[]` |
