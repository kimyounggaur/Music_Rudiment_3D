# R6 레슨 카메라 연출(샷) — 캡처와 측정

| 항목 | 내용 |
|---|---|
| 단계 | R6 (V24), 설계서 §6 R6, CONTRACT_V3 C4, 결정 5, 프롬프트 §3.6 |
| before | [R5 after](../R5/index.md) — 인쇄된 '가까이 보기'가 동작하지 않던 상태(DEV 기록만) |
| after (ink) | `after/*_ink.jpg` — 1280×720·844×390 × spread1, 샷(진입 0/300/600/900 ms, 유지, 복귀 0/300/600 ms, 복귀 뒤), 샷 중 인쇄 조작, spread2, 샷 중 ArrowRight → 복귀 뒤 넘김(3장) |
| 명령 | `node scripts/refactor-capture.ts --stage R6 --phase after --renderer ink --quality high --viewports 1280x720,844x390 --states spread1,shot,shotHotspot,spread2,shotTurn`<br>`node scripts/book-v3-e2e.ts --viewport W×H --out docs/qa/refactor/R6/e2e-W×H.json` (1280×720, 844×390, 390×844, 568×320) |
| 환경 | Linux 컨테이너, Node 22.23.4, Playwright 1.60, headless Chromium 1243(SwiftShader WebGL), DPR 1, 외부 요청 차단 |

headless 캡처는 실기기 통과가 아니다. SwiftShader는 한 프레임에 0.5–3 s가 걸려 900 ms 진입과 600 ms 복귀를 실시간으로 찍을 수 없으므로, 샷 시계를 inspector로 고정해(`holdShot(ms)`, 지금 단계가 시작된 뒤의 ms) 연속 장면을 찍었다. 복귀 오차는 복귀가 끝나고 stage가 읽기 포즈를 그린 뒤의 카메라를 샷 전 카메라와 비교했다.

## 무엇이 바뀌었나

- **샷은 영역 + 각도.** `src/book/render/shots.ts`의 `ShotSpec`은 영역(그림 `figure:duration-lanes`·`figure:duration-strip` 또는 쪽 UV 사각형)과 자세(앙각·방위각·화각), 여유, 진입 시간이다. 영역의 월드 점을 읽기 포즈와 같은 리그 fitter(`fitRig`)에 넣어 viewport마다 카메라를 구한다. 절대 카메라 좌표는 없다.
- **정확한 복귀.** `cameraRig.blendTo(reading, shot, t)`는 smoothStep으로 위치·target을 lerp, 쿼터니언을 slerp하고, t ≤ 0이면 읽기 포즈 fit 결과 객체 자체를 돌려준다. 그래서 복귀 오차는 0이다.
- **컨트롤러 최소 변경.** `CameraState`에 `'shot'`, 이벤트 `SHOT_START`·`SHOT_END`. 샷 중 NEXT·PREV·CLOSE는 한 칸 대기열(`pendingIntent`)에 들어가 복귀(`SHOT_END`) 뒤 실행되고, 드래그 시작은 거부된다. 숨김·2D 전환은 샷을 즉시 해제한다.
- **독자가 시작하는 샷.** 펼침면 1 오른쪽 '가까이 보기'(그림 '두 줄', 앙각 36°·방위 −14°·화각 32°)와 펼침면 2 오른쪽 '가까이 보기'(종이 띠, 34°·10°·32°). 샷 중 같은 단추는 '돌아오기'로 인쇄되고, 다시 누르거나 Escape·넘기기·닫기를 하면 600 ms에 걸쳐 읽기 포즈로 돌아온다. 샷 중에도 인쇄 핫스폿과 그림 고르기가 된다. 조작바에는 샷 단추가 없다.

## 판정

| 기준 (설계서·프롬프트 R6) | 결과 | 근거 |
|---|---|---|
| 5 viewport(844×390, 667×375, 568×320, 390×844, 360×640)에서 두 샷의 fit 성공 | **통과** | `tests/shots.test.ts`(두 샷 × 5 viewport: fit 불가 점 0, 영역 중심 = safe 중심(오차 < 1e-6), 영역은 safe 안, 책 전체는 safe 검사 대상이 아님 — 의도적 근접, 샷 카메라는 읽기보다 낮음) |
| 복귀 포즈 == 읽기 포즈(위치·target·쿼터니언 차 ≤ 1e-6) | **통과(차 0)** | `tests/shots.test.ts`, e2e 'R6: the same button returns exactly…'(4 viewport `maxDifference` 0), 캡처 `shotReturned.extra.error` 위치·쿼터니언 0(아래 표) |
| 샷 중 NEXT는 pending, SHOT_END 뒤 실행 | **통과** | `tests/book-controller.test.ts`(R6), e2e 'R6: ArrowRight during a shot returns to reading, then turns'(프레임 표본에서 샷 상태로 넘긴 프레임 0), 캡처 `shotTurn` 3장 |
| 샷 중 드래그 시작 거부 | **통과** | `tests/book-controller.test.ts`(TURN_DRAG_START 무시), BookApp: 샷 중 모서리 누름 → 읽기 자리로 복귀 |
| hidden에서 해제 | **통과** | `tests/book-controller.test.ts`(HIDE_DOCUMENT → camera suspended, 샷 해제 후 기존 hidden 정책) |
| settled가 아닐 때 SHOT_START 무시 | **통과** | `tests/book-controller.test.ts` |
| 넘김 중 카메라 불변 유지 | **통과** | `tests/book-camera-rig.test.ts`(suspendFit), 샷은 넘김 전에 항상 끝남(대기열) |
| 샷 중 핫스폿 조작 | **통과** | e2e 'R6: a printed control works during the shot', 캡처 `shotHotspot`(▶ 위 줄 듣기 → playing) |
| 진입 0/300/600/900 ms · 유지 · 복귀 0/300/600 ms 연속 캡처(1280×720, 844×390) | **통과** | 아래 '샷 연속 캡처' 표(샷 시계 고정) |

## 사람 검사 항목

- '가까이 보기'를 누르면 카메라가 그림 쪽으로 들어가고, 다시 누르면 정확히 원래 자리로 돌아오는가(복귀 전후 캡처 `*_spread1_ink.jpg` ↔ `*_shotReturned_ink.jpg`가 겹치는가).
- 샷 중에 페이지를 넘기면 먼저 돌아온 뒤 넘기는가(`*_shotTurn_1_returning` → `_2_turning` → `*_shotTurn_ink.jpg`).
- 넘김 중에는 카메라가 움직이지 않는가.
- 900 ms 진입·600 ms 복귀의 속도감이 실기기에서 어지럽지 않은가(SwiftShader에서는 실시간으로 볼 수 없었다).

## 측정과 캡처

### 캡처 (before = R5 after)

| viewport | 상태 | before (R5) | after (R6) |
|---|---|---|---|
| 1280x720 | spread1 | [1280x720_spread1_ink.jpg](../R5/after/1280x720_spread1_ink.jpg) | [1280x720_spread1_ink.jpg](after/1280x720_spread1_ink.jpg) |
| 1280x720 | shot | — | [1280x720_shot_ink.jpg](after/1280x720_shot_ink.jpg) |
| 1280x720 | shotReturned | — | [1280x720_shotReturned_ink.jpg](after/1280x720_shotReturned_ink.jpg) |
| 1280x720 | shotHotspot | — | [1280x720_shotHotspot_ink.jpg](after/1280x720_shotHotspot_ink.jpg) |
| 1280x720 | spread2 | [1280x720_spread2_ink.jpg](../R5/after/1280x720_spread2_ink.jpg) | [1280x720_spread2_ink.jpg](after/1280x720_spread2_ink.jpg) |
| 1280x720 | shotTurn | — | [1280x720_shotTurn_ink.jpg](after/1280x720_shotTurn_ink.jpg) |
| 844x390 | spread1 | [844x390_spread1_ink.jpg](../R5/after/844x390_spread1_ink.jpg) | [844x390_spread1_ink.jpg](after/844x390_spread1_ink.jpg) |
| 844x390 | shot | — | [844x390_shot_ink.jpg](after/844x390_shot_ink.jpg) |
| 844x390 | shotReturned | — | [844x390_shotReturned_ink.jpg](after/844x390_shotReturned_ink.jpg) |
| 844x390 | shotHotspot | — | [844x390_shotHotspot_ink.jpg](after/844x390_shotHotspot_ink.jpg) |
| 844x390 | spread2 | [844x390_spread2_ink.jpg](../R5/after/844x390_spread2_ink.jpg) | [844x390_spread2_ink.jpg](after/844x390_spread2_ink.jpg) |
| 844x390 | shotTurn | — | [844x390_shotTurn_ink.jpg](after/844x390_shotTurn_ink.jpg) |

### 샷 연속 캡처 (샷 시계를 inspector로 고정)

| viewport | 진입 0 / 300 / 600 / 900 ms | 유지 | 복귀 0 / 300 / 600 ms | 복귀 뒤 |
|---|---|---|---|---|
| 1280x720 | [t=0.000](after/1280x720_shot_enter_000ms_ink.jpg) · [t=0.333](after/1280x720_shot_enter_300ms_ink.jpg) · [t=0.667](after/1280x720_shot_enter_600ms_ink.jpg) · [t=1.000](after/1280x720_shot_enter_900ms_ink.jpg) | [hold](after/1280x720_shot_ink.jpg) | [t=1.000](after/1280x720_shot_return_000ms_ink.jpg) · [t=0.500](after/1280x720_shot_return_300ms_ink.jpg) · [t=0.000](after/1280x720_shot_return_600ms_ink.jpg) | [1280x720_shotReturned_ink.jpg](after/1280x720_shotReturned_ink.jpg) |
| 844x390 | [t=0.000](after/844x390_shot_enter_000ms_ink.jpg) · [t=0.333](after/844x390_shot_enter_300ms_ink.jpg) · [t=0.667](after/844x390_shot_enter_600ms_ink.jpg) · [t=1.000](after/844x390_shot_enter_900ms_ink.jpg) | [hold](after/844x390_shot_ink.jpg) | [t=1.000](after/844x390_shot_return_000ms_ink.jpg) · [t=0.500](after/844x390_shot_return_300ms_ink.jpg) · [t=0.000](after/844x390_shot_return_600ms_ink.jpg) | [844x390_shotReturned_ink.jpg](after/844x390_shotReturned_ink.jpg) |

### 복귀 오차 (복귀 뒤 카메라 − 읽기 포즈, 캡처 `shotReturned.extra.error`)

| viewport | 위치 최대 차 | 쿼터니언 최대 차 | 샷 중 카메라 이동 (위치 최대 차) |
|---|---|---|---|
| 1280x720 | 0 | 0 | 8.109 |
| 844x390 | 0 | 0 | 8.969 |

### 샷 중 인쇄 조작

| viewport | 누른 조작 | pressed 핫스폿 | 재생 상태 |
|---|---|---|---|
| 1280x720 | play-upper | `page-2:listen:play-upper` | playing |
| 844x390 | play-upper | `page-2:listen:play-upper` | playing |

### 샷 중 ArrowRight → 복귀 뒤 넘김

| viewport | 1 복귀 중 | 2 넘김 | 3 도착(spread-3) | 복귀 중 상태 |
|---|---|---|---|---|
| 1280x720 | [1280x720_shotTurn_1_returning_ink.jpg](after/1280x720_shotTurn_1_returning_ink.jpg) | [1280x720_shotTurn_2_turning_ink.jpg](after/1280x720_shotTurn_2_turning_ink.jpg) | [1280x720_shotTurn_ink.jpg](after/1280x720_shotTurn_ink.jpg) | phase spreadIdle, camera shot, shot {"id": "strip-close", "phase": "return", "t": 0.5} |
| 844x390 | [844x390_shotTurn_1_returning_ink.jpg](after/844x390_shotTurn_1_returning_ink.jpg) | [844x390_shotTurn_2_turning_ink.jpg](after/844x390_shotTurn_2_turning_ink.jpg) | [844x390_shotTurn_ink.jpg](after/844x390_shotTurn_ink.jpg) | phase spreadIdle, camera shot, shot {"id": "strip-close", "phase": "return", "t": 0.5} |

### 페이지 오류

- 1280x720 ink: 0건 []
- 844x390 ink: 0건 []

### e2e 1280x720 — 33/33 통과 ([e2e-1280x720.json](e2e-1280x720.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| R4: entry ends drawn and standing; scene ≤ 40 draw calls, ≤ 6,000 segments | 통과 | `{"lift": 1, "reveal": 1, "segments": 572, "calls": {"total": 53, "withoutScene": 44, "scene": 9, "figure": {"segments": 572, "ink": 480, "dashed": 0, "accent…` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio", "close-look"]` |
| R5: one toolbar outside the book (≤ 56 px, in view, no other outside buttons) | 통과 | `{"visible": "true", "height": 53, "inViewport": true, "outside": [], "buttons": ["book-prev:44", "book-contents:44", "book-next:44", "sound:44", "still:44", …` |
| R5: the book never sits under the toolbar (bookBounds ∩ toolbar = 0) | 통과 | `{"overlap": 0, "bounds": {"left": 270.48737526649865, "right": 1009.5126247335014, "top": 208.51998058470386, "bottom": 644.5793630044461}, "toolbar": {"top"…` |
| R5: questions are printed on the page without a flap | 통과 | `{"radios": 6}` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| R5: three right answers stamp the printed page | 통과 | `{"stampBefore": false, "stampMirror": true}` |
| R5: answer flap lifts 0 → 110° on its hinge (stage clock 0/120/240 ms); explanations printed beneath | 통과 | `{"at0": 0, "at120": 55, "at240": 110, "explained": true}` |
| R5: a press on the standing paper folds the flap down | 통과 | `{"sheetPoint": {"x": 481.3255918624584, "y": 503.99241658652835}}` |
| R5: records dialog is modal, the book ignores arrows, focus returns to 기록 | 통과 | `{"inDialog": true, "spread": "spread-1", "phase": "spreadIdle", "returned": "records"}` |
| R5: ArrowRight / ArrowLeft turn the book with the toolbar in place | 통과 | `{"keyNext": true, "keyPrev": true}` |
| R6: 가까이 보기 takes the camera into the figure (user-started shot) | 통과 | `{"camera": "shot", "label": "돌아오기", "moved": 8.109}` |
| R6: a printed control works during the shot | 통과 | `{"control": "play-upper", "pressed": "page-2:listen:play-upper", "playing": true}` |
| R6: the same button returns exactly to the reading pose (≤ 1e-6) | 통과 | `{"maxDifference": 0}` |
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 6, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 21, "stateAfter": 22}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 10.1, "draftMeasures": [0.6, 0.3, 0.4, 0.2, 0.4, 0.2, 0.5, 0.2, 0.5, 0.2, 0.4, 0.3, 0.6, 0.2, 10.1, 0.2, 0.5, 0.3, 1.2, 0.1, 0.6, 0.2, 0.8, 0.…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 26, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.189, "max": 135.3}, "bestOffsetPx": {"dx": 0, "dy": 0}, "cor…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 28, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "31", "rootRevision": "31"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5: next is disabled on the last spread | 통과 | `{"disabled": true}` |
| R5: prev on the first spread (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |

### e2e 390x844 — 33/33 통과 ([e2e-390x844.json](e2e-390x844.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| R4: entry ends drawn and standing; scene ≤ 40 draw calls, ≤ 6,000 segments | 통과 | `{"lift": 1, "reveal": 1, "segments": 572, "calls": {"total": 53, "withoutScene": 44, "scene": 9, "figure": {"segments": 572, "ink": 480, "dashed": 0, "accent…` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio", "close-look"]` |
| R5: one toolbar outside the book (≤ 56 px, in view, no other outside buttons) | 통과 | `{"visible": "true", "height": 53, "inViewport": true, "outside": [], "buttons": ["book-prev:44", "book-contents:44", "book-next:44", "sound:44", "still:44", …` |
| R5: the book never sits under the toolbar (bookBounds ∩ toolbar = 0) | 통과 | `{"overlap": 0, "bounds": {"left": 22.713981953676868, "right": 367.28601804632314, "top": 303.22035392632796, "bottom": 511.32300369214613}, "toolbar": {"top…` |
| R5: questions are printed on the page without a flap | 통과 | `{"radios": 6}` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| R5: three right answers stamp the printed page | 통과 | `{"stampBefore": false, "stampMirror": true}` |
| R5: answer flap lifts 0 → 110° on its hinge (stage clock 0/120/240 ms); explanations printed beneath | 통과 | `{"at0": 0, "at120": 55, "at240": 110, "explained": true}` |
| R5: a press on the standing paper folds the flap down | 통과 | `{"sheetPoint": {"x": 118.95383347529186, "y": 445.3327201484174}}` |
| R5: records dialog is modal, the book ignores arrows, focus returns to 기록 | 통과 | `{"inDialog": true, "spread": "spread-1", "phase": "spreadIdle", "returned": "records"}` |
| R5: ArrowRight / ArrowLeft turn the book with the toolbar in place | 통과 | `{"keyNext": true, "keyPrev": true}` |
| R6: 가까이 보기 takes the camera into the figure (user-started shot) | 통과 | `{"camera": "shot", "label": "돌아오기", "moved": 17.182}` |
| R6: a printed control works during the shot | 통과 | `{"control": "play-upper", "pressed": "page-2:listen:play-upper", "playing": true}` |
| R6: the same button returns exactly to the reading pose (≤ 1e-6) | 통과 | `{"maxDifference": 0}` |
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 6, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 21, "stateAfter": 22}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 0.9, "draftMeasures": [0.3, 0.3, 0.4, 0.1, 0.5, 0.1, 0.5, 0.3, 0.6, 0.3, 0.6, 0.2, 0.6, 0.3, 0.7, 0.5, 0.5, 0.2, 0.9, 0.5, 0.6, 0.3, 0.8, 0.3,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 26, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.164, "max": 67}, "bestOffsetPx": {"dx": 0, "dy": 0}, "correl…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 30, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "31", "rootRevision": "31"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5: next is disabled on the last spread | 통과 | `{"disabled": true}` |
| R5: prev on the first spread (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |

### e2e 568x320 — 33/33 통과 ([e2e-568x320.json](e2e-568x320.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| R4: entry ends drawn and standing; scene ≤ 40 draw calls, ≤ 6,000 segments | 통과 | `{"lift": 1, "reveal": 1, "segments": 572, "calls": {"total": 53, "withoutScene": 44, "scene": 9, "figure": {"segments": 572, "ink": 480, "dashed": 0, "accent…` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio", "close-look"]` |
| R5: one toolbar outside the book (≤ 56 px, in view, no other outside buttons) | 통과 | `{"visible": "true", "height": 41, "inViewport": true, "outside": [], "buttons": ["book-prev:36", "book-contents:36", "book-next:36", "sound:36", "still:36", …` |
| R5: the book never sits under the toolbar (bookBounds ∩ toolbar = 0) | 통과 | `{"overlap": 0, "bounds": {"left": 137.2936209988995, "right": 430.70637900110046, "top": 90.26355321973216, "bottom": 263.1088447038236}, "toolbar": {"top": …` |
| R5: questions are printed on the page without a flap | 통과 | `{"radios": 6}` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| R5: three right answers stamp the printed page | 통과 | `{"stampBefore": false, "stampMirror": true}` |
| R5: answer flap lifts 0 → 110° on its hinge (stage clock 0/120/240 ms); explanations printed beneath | 통과 | `{"at0": 0, "at120": 55, "at240": 110, "explained": true}` |
| R5: a press on the standing paper folds the flap down | 통과 | `{"sheetPoint": {"x": 220.6976698257344, "y": 204.85549009964973}}` |
| R5: records dialog is modal, the book ignores arrows, focus returns to 기록 | 통과 | `{"inDialog": true, "spread": "spread-1", "phase": "spreadIdle", "returned": "records"}` |
| R5: ArrowRight / ArrowLeft turn the book with the toolbar in place | 통과 | `{"keyNext": true, "keyPrev": true}` |
| R6: 가까이 보기 takes the camera into the figure (user-started shot) | 통과 | `{"camera": "shot", "label": "돌아오기", "moved": 9.025}` |
| R6: a printed control works during the shot | 통과 | `{"control": "play-upper", "pressed": "page-2:listen:play-upper", "playing": true}` |
| R6: the same button returns exactly to the reading pose (≤ 1e-6) | 통과 | `{"maxDifference": 0}` |
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 10, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 20, "stateAfter": 21}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 2, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 15.5, "draftMeasures": [7.3, 0.3, 15.5, 0.1, 6.1, 0.2, 0.6, 0.3, 3.7, 0.2, 4.9, 0.2, 0.5, 0.2, 0.4, 3.3, 0.4, 0.2, 3.3, 0.2, 1.6, 0.2, 0.6, 0.…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 26, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.231, "max": 103.3}, "bestOffsetPx": {"dx": 0, "dy": 0}, "cor…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 28, "phases": ["preparingTurn", "turningForward", "settling"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "31", "rootRevision": "31"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5: next is disabled on the last spread | 통과 | `{"disabled": true}` |
| R5: prev on the first spread (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |

### e2e 844x390 — 33/33 통과 ([e2e-844x390.json](e2e-844x390.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| R4: entry ends drawn and standing; scene ≤ 40 draw calls, ≤ 6,000 segments | 통과 | `{"lift": 1, "reveal": 1, "segments": 572, "calls": {"total": 53, "withoutScene": 44, "scene": 9, "figure": {"segments": 572, "ink": 480, "dashed": 0, "accent…` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio", "close-look"]` |
| R5: one toolbar outside the book (≤ 56 px, in view, no other outside buttons) | 통과 | `{"visible": "true", "height": 53, "inViewport": true, "outside": [], "buttons": ["book-prev:44", "book-contents:44", "book-next:44", "sound:44", "still:44", …` |
| R5: the book never sits under the toolbar (bookBounds ∩ toolbar = 0) | 통과 | `{"overlap": 0, "bounds": {"left": 242.0015741974302, "right": 601.9984258025698, "top": 108.43684126567757, "bottom": 320.2497315991948}, "toolbar": {"top": …` |
| R5: questions are printed on the page without a flap | 통과 | `{"radios": 6}` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| R5: three right answers stamp the printed page | 통과 | `{"stampBefore": false, "stampMirror": true}` |
| R5: answer flap lifts 0 → 110° on its hinge (stage clock 0/120/240 ms); explanations printed beneath | 통과 | `{"at0": 0, "at120": 55, "at240": 110, "explained": true}` |
| R5: a press on the standing paper folds the flap down | 통과 | `{"sheetPoint": {"x": 344.3535661459691, "y": 249.94429147967085}}` |
| R5: records dialog is modal, the book ignores arrows, focus returns to 기록 | 통과 | `{"inDialog": true, "spread": "spread-1", "phase": "spreadIdle", "returned": "records"}` |
| R5: ArrowRight / ArrowLeft turn the book with the toolbar in place | 통과 | `{"keyNext": true, "keyPrev": true}` |
| R6: 가까이 보기 takes the camera into the figure (user-started shot) | 통과 | `{"camera": "shot", "label": "돌아오기", "moved": 8.969}` |
| R6: a printed control works during the shot | 통과 | `{"control": "play-upper", "pressed": "page-2:listen:play-upper", "playing": true}` |
| R6: the same button returns exactly to the reading pose (≤ 1e-6) | 통과 | `{"maxDifference": 0}` |
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 5, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 20, "stateAfter": 21}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 8.8, "draftMeasures": [0.5, 0.3, 0.4, 4.3, 0.6, 0.3, 0.7, 0.3, 1.5, 0.3, 0.5, 0.3, 2.1, 0.2, 4.7, 0.2, 1.1, 0.3, 0.7, 0.1, 8.8, 0.3, 0.6, 3.3,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 26, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.007, "max": 77}, "bestOffsetPx": {"dx": 0, "dy": 0}, "correl…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 29, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "31", "rootRevision": "31"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5: next is disabled on the last spread | 통과 | `{"disabled": true}` |
| R5: prev on the first spread (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |
