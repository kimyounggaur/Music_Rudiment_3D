# R5 조작부 재배치 — 캡처와 측정

| 항목 | 내용 |
|---|---|
| 단계 | R5 (V23), 설계서 §6 R5, 프롬프트 §3.5 |
| before | [R4 after](../R4/index.md) — 책갈피 단추(←/→)와 책 위 '크게 읽기·음소거·기록과 설정' 단추, '질문' 펼치기 안의 문항 |
| after (ink) | `after/*_ink.jpg` — 3 viewport × cover, spread1, stamp, flap, turn50, spread2, 2d + 568×320(압축형) + 360×740(좁은 세로) + 왼쪽 쪽 2배 크롭(도장, 덮개 0/120/240 ms) |
| 비교 (legacy) | `after/*_spread1_legacy.jpg` 3장 — 착수 커밋 고정 사본(책갈피가 그대로인 이전 조작부) |
| 명령 | `node scripts/refactor-capture.ts --stage R5 --phase after --renderer ink --quality high --states cover,spread1,stamp,flap,turn50,spread2,2d`<br>`node scripts/refactor-capture.ts --stage R5 --phase after --renderer ink --quality high --viewports 568x320 --states cover,spread1,spread2`<br>`node scripts/refactor-capture.ts --stage R5 --phase after --renderer ink --quality high --viewports 360x740 --states spread1`<br>`node scripts/refactor-capture.ts --stage R5 --phase after --renderer legacy --states spread1`<br>`node scripts/book-v3-e2e.ts --viewport W×H --out docs/qa/refactor/R5/e2e-W×H.json` (1280×720, 844×390, 390×844, 568×320) |
| 환경 | Linux 컨테이너, Node 22.23.4, Playwright 1.60, headless Chromium 1243(SwiftShader WebGL), DPR 1, 외부 요청 차단 |

headless 캡처는 실기기 통과가 아니다. SwiftShader는 한 프레임에 0.5–3 s가 걸려 240 ms 덮개 움직임을 실시간으로 찍을 수 없으므로, 덮개 시계를 inspector로 0/120/240 ms에 고정해 찍었다(`holdFlaps`). 덮개 열기·도장은 거울(보조기술 경로)로, 덮개 접기는 서 있는 종이를 포인터로 눌러(e2e) 확인했다.

## 무엇이 바뀌었나

- **조작부가 책 밖 한 줄로.** 책갈피 단추와 책 위 단추들이 없어지고, 화면 아래 한 줄 조작바(← 목차 → 쪽 번호 · 소리 · 정지 화면 · 크게 읽기 · 기록)만 남았다. 조작바 높이는 stage safe area(`--book-safe-bottom`)에 들어가 책이 조작바 위에 맞춰진다. 표지에서는 조작바를 숨기되 자리는 유지한다.
- **기록과 설정은 모달.** '기록'은 백업·내보내기·가져오기·삭제와 읽기·소리 설정을 담은 `<dialog>`를 연다. 열린 동안 책은 방향키를 받지 않고, 닫으면 초점이 '기록'으로 돌아온다.
- **문항은 쪽에 바로, 정답은 종이 덮개 아래.** 왼쪽 쪽에 질문·라디오가 바로 인쇄되고, 정답 해설 자리는 늘 예약된 채 종이 덮개로 가려진다. '정답 보기'를 누르면 3D 덮개가 윗변을 축으로 110°까지 들리고(240 ms), 덮개 뒷면의 '다시 덮기'를 누르면 내려간다.
- **도장.** 세 문항을 모두 맞히면 쪽 아래 도장 칸에 '확인' 도장이 state 레이어로 찍힌다(저장된 답에서 파생, 새 저장 필드 없음).
- **잠깐 멈춤.** 인쇄 단추 이름을 설계서대로 '‖ 잠깐 멈춤'으로 바꾸고 쪽 글꼴 서브셋을 다시 만들었다.

## 판정

| 기준 (설계서·프롬프트 R5) | 결과 | 근거 |
|---|---|---|
| 3D 모드에서 `main.book-app` 안의 단추는 조작바·거울·표지 단추뿐 | **통과** | e2e 'R5: one toolbar outside the book…'(거울 제외 바깥 단추 0), 캡처 `extra.chrome.outsideButtons`: 3D 캡처(cover·spread1·stamp·flap·turn50·spread2) 모두 0개. `2d` 상태(크게 읽기 = HTML 2D 책)는 쪽 안 HTML 단추가 정상이라 11개(기준은 3D 모드) |
| 844×390에서 조작바와 책 bounds 교차 0 | **통과** | 아래 '조작바와 책' 표(교차 px², 책 아래 → 조작바 위 거리), e2e 'R5: the book never sits under the toolbar' |
| 조작바 높이 ≤ 56 px, 단추 44×44(568×320 압축형 36) | **통과** | 아래 표의 높이·가장 작은 단추 |
| 플랩·도장 캡처 | **통과** | `*_flap_*ms_left2x_ink.jpg`, `*_stamp_left2x_ink.jpg`, e2e 'R5: answer flap…', 'R5: three right answers…' |
| keyboard-e2e(방향키 넘김, 모달 중 방향키 무시) | **통과** | e2e 'R5: ArrowRight / ArrowLeft…', 'R5: records dialog is modal…' |
| 첫 펼침면 이전 = 표지로(CLOSE_BOOK), 마지막 다음 = 비활성 | **통과** | e2e 'R5: prev on the first spread…', 'R5: next is disabled…' |
| 조작바 pointerdown이 모서리 드래그를 시작하지 않음 | **통과** | `tests/book-turn-hit.test.ts`(조작바·기록 대화상자 소유권) |

## 사람 검사 항목

- 쪽 안에 HTML 단추가 없고 인쇄된 단추와 덮개만 있는가.
- 하단 조작바가 책을 가리지 않고 한 줄로 작은가(≤ 56 px).
- 책갈피가 사라져도 모서리 드래그로 넘기기가 그대로 되는가(실기기 터치).
- 덮개가 종이처럼 들리고, 서 있는 덮개를 눌러 다시 덮을 수 있는가. 도장이 찍히는가.
- 선 덮개가 바로 위 셋째 질문의 보기를 가리는 것이 거슬리지 않는가(`*_flap_240ms_left2x_ink.jpg`).

## 측정과 캡처

### 캡처 (before = R4 after)

| viewport | 상태 | before (R4) | after (R5) | 왼쪽 쪽 2배 |
|---|---|---|---|---|
| 1280x720 | cover | [1280x720_cover_ink.jpg](../R4/after/1280x720_cover_ink.jpg) | [1280x720_cover_ink.jpg](after/1280x720_cover_ink.jpg) | — |
| 1280x720 | spread1 | [1280x720_spread1_ink.jpg](../R4/after/1280x720_spread1_ink.jpg) | [1280x720_spread1_ink.jpg](after/1280x720_spread1_ink.jpg) | — |
| 1280x720 | stamp | — | [1280x720_stamp_ink.jpg](after/1280x720_stamp_ink.jpg) | [1280x720_stamp_left2x_ink.jpg](after/1280x720_stamp_left2x_ink.jpg) |
| 1280x720 | flap | — | [1280x720_flap_ink.jpg](after/1280x720_flap_ink.jpg) | — |
| 1280x720 | turn50 | [1280x720_turn50_ink.jpg](../R4/after/1280x720_turn50_ink.jpg) | [1280x720_turn50_ink.jpg](after/1280x720_turn50_ink.jpg) | — |
| 1280x720 | spread2 | [1280x720_spread2_ink.jpg](../R4/after/1280x720_spread2_ink.jpg) | [1280x720_spread2_ink.jpg](after/1280x720_spread2_ink.jpg) | — |
| 1280x720 | 2d | [1280x720_2d_ink.jpg](../R4/after/1280x720_2d_ink.jpg) | [1280x720_2d_ink.jpg](after/1280x720_2d_ink.jpg) | — |
| 844x390 | cover | [844x390_cover_ink.jpg](../R4/after/844x390_cover_ink.jpg) | [844x390_cover_ink.jpg](after/844x390_cover_ink.jpg) | — |
| 844x390 | spread1 | [844x390_spread1_ink.jpg](../R4/after/844x390_spread1_ink.jpg) | [844x390_spread1_ink.jpg](after/844x390_spread1_ink.jpg) | — |
| 844x390 | stamp | — | [844x390_stamp_ink.jpg](after/844x390_stamp_ink.jpg) | [844x390_stamp_left2x_ink.jpg](after/844x390_stamp_left2x_ink.jpg) |
| 844x390 | flap | — | [844x390_flap_ink.jpg](after/844x390_flap_ink.jpg) | — |
| 844x390 | turn50 | [844x390_turn50_ink.jpg](../R4/after/844x390_turn50_ink.jpg) | [844x390_turn50_ink.jpg](after/844x390_turn50_ink.jpg) | — |
| 844x390 | spread2 | [844x390_spread2_ink.jpg](../R4/after/844x390_spread2_ink.jpg) | [844x390_spread2_ink.jpg](after/844x390_spread2_ink.jpg) | — |
| 844x390 | 2d | [844x390_2d_ink.jpg](../R4/after/844x390_2d_ink.jpg) | [844x390_2d_ink.jpg](after/844x390_2d_ink.jpg) | — |
| 390x844 | cover | [390x844_cover_ink.jpg](../R4/after/390x844_cover_ink.jpg) | [390x844_cover_ink.jpg](after/390x844_cover_ink.jpg) | — |
| 390x844 | spread1 | [390x844_spread1_ink.jpg](../R4/after/390x844_spread1_ink.jpg) | [390x844_spread1_ink.jpg](after/390x844_spread1_ink.jpg) | — |
| 390x844 | stamp | — | [390x844_stamp_ink.jpg](after/390x844_stamp_ink.jpg) | [390x844_stamp_left2x_ink.jpg](after/390x844_stamp_left2x_ink.jpg) |
| 390x844 | flap | — | [390x844_flap_ink.jpg](after/390x844_flap_ink.jpg) | — |
| 390x844 | turn50 | [390x844_turn50_ink.jpg](../R4/after/390x844_turn50_ink.jpg) | [390x844_turn50_ink.jpg](after/390x844_turn50_ink.jpg) | — |
| 390x844 | spread2 | [390x844_spread2_ink.jpg](../R4/after/390x844_spread2_ink.jpg) | [390x844_spread2_ink.jpg](after/390x844_spread2_ink.jpg) | — |
| 390x844 | 2d | [390x844_2d_ink.jpg](../R4/after/390x844_2d_ink.jpg) | [390x844_2d_ink.jpg](after/390x844_2d_ink.jpg) | — |
| 568x320 | cover | — | [568x320_cover_ink.jpg](after/568x320_cover_ink.jpg) | — |
| 568x320 | spread1 | — | [568x320_spread1_ink.jpg](after/568x320_spread1_ink.jpg) | — |
| 568x320 | spread2 | — | [568x320_spread2_ink.jpg](after/568x320_spread2_ink.jpg) | — |
| 360x740 | spread1 | — | [360x740_spread1_ink.jpg](after/360x740_spread1_ink.jpg) | — |

비교(legacy, 착수 커밋 고정 사본 — 책갈피 단추가 그대로인 이전 조작부): [1280x720_spread1_legacy.jpg](after/1280x720_spread1_legacy.jpg), [844x390_spread1_legacy.jpg](after/844x390_spread1_legacy.jpg), [390x844_spread1_legacy.jpg](after/390x844_spread1_legacy.jpg)


### 조작바와 책 (모든 ink 캡처의 `extra.chrome`)

| viewport | 상태 | 조작바 보임 | 높이 px | 단추 (가장 작은 w×h) | 책 아래 → 조작바 위 px | 교차 px² | 바깥 단추 | 표지 단추 |
|---|---|---|---|---|---|---|---|---|
| 1280x720 | cover | 아니오 | 53 | 0 | None | None | 0 | 1 |
| 1280x720 | spread1 | 예 | 53 | 7 (44×44) | 22.4 | 0 | 0 | 0 |
| 1280x720 | stamp | 예 | 53 | 7 (44×44) | 22.4 | 0 | 0 | 0 |
| 1280x720 | flap | 예 | 53 | 7 (44×44) | 22.4 | 0 | 0 | 0 |
| 1280x720 | turn50 | 예 | 53 | 7 (44×44) | 22.4 | 0 | 0 | 0 |
| 1280x720 | spread2 | 예 | 53 | 7 (44×44) | 22.4 | 0 | 0 | 0 |
| 1280x720 | 2d | 예 | 53 | 7 (44×44) | 22.4 | 0 | 11 | 0 |
| 844x390 | cover | 아니오 | 53 | 0 | None | None | 0 | 1 |
| 844x390 | spread1 | 예 | 53 | 7 (44×44) | 16.8 | 0 | 0 | 0 |
| 844x390 | stamp | 예 | 53 | 7 (44×44) | 16.8 | 0 | 0 | 0 |
| 844x390 | flap | 예 | 53 | 7 (44×44) | 16.8 | 0 | 0 | 0 |
| 844x390 | turn50 | 예 | 53 | 7 (44×44) | 16.8 | 0 | 0 | 0 |
| 844x390 | spread2 | 예 | 53 | 7 (44×44) | 16.8 | 0 | 0 | 0 |
| 844x390 | 2d | 예 | 53 | 7 (44×44) | 16.8 | 0 | 11 | 0 |
| 390x844 | cover | 아니오 | 53 | 0 | None | None | 0 | 1 |
| 390x844 | spread1 | 예 | 53 | 7 (44×44) | 279.7 | 0 | 0 | 0 |
| 390x844 | stamp | 예 | 53 | 7 (44×44) | 279.7 | 0 | 0 | 0 |
| 390x844 | flap | 예 | 53 | 7 (44×44) | 279.7 | 0 | 0 | 0 |
| 390x844 | turn50 | 예 | 53 | 7 (44×44) | 279.7 | 0 | 0 | 0 |
| 390x844 | spread2 | 예 | 53 | 7 (44×44) | 279.7 | 0 | 0 | 0 |
| 390x844 | 2d | 예 | 53 | 7 (44×44) | 279.7 | 0 | 11 | 0 |
| 568x320 | cover | 아니오 | 41 | 0 | None | None | 0 | 1 |
| 568x320 | spread1 | 예 | 41 | 7 (36×36) | 15.9 | 0 | 0 | 0 |
| 568x320 | spread2 | 예 | 41 | 7 (36×36) | 15.9 | 0 | 0 | 0 |
| 360x740 | spread1 | 예 | 53 | 7 (44×44) | 235 | 0 | 0 | 0 |

### 정답 덮개 (덮개 시계를 0/120/240 ms에 고정, 왼쪽 쪽 2배)

| viewport | 0 ms | 120 ms | 240 ms (열림) |
|---|---|---|---|
| 1280x720 | [0°](after/1280x720_flap_000ms_left2x_ink.jpg) | [55°](after/1280x720_flap_120ms_left2x_ink.jpg) | [110°](after/1280x720_flap_240ms_left2x_ink.jpg) |
| 844x390 | [0°](after/844x390_flap_000ms_left2x_ink.jpg) | [55°](after/844x390_flap_120ms_left2x_ink.jpg) | [110°](after/844x390_flap_240ms_left2x_ink.jpg) |
| 390x844 | [0°](after/390x844_flap_000ms_left2x_ink.jpg) | [55°](after/390x844_flap_120ms_left2x_ink.jpg) | [110°](after/390x844_flap_240ms_left2x_ink.jpg) |

### 종이·카메라 (spread1, R4와 비교)

| viewport | 책 폭 비율 R4 → R5 | 책 높이 비율 R5 | 본문 x-height px R4 → R5 |
|---|---|---|---|
| 1280x720 | 0.6251 → 0.5774 | 0.6056 | 4.06 → 2.99 |
| 844x390 | 0.4989 → 0.4265 | 0.5431 | 2.14 → 1.45 |
| 390x844 | 0.8835 → 0.8835 | 0.2466 | 1.77 → 1.42 |
| 568x320 | — → 0.5166 | 0.5401 | — → 1.18 |
| 360x740 | — → 0.8783 | 0.2576 | — → 1.3 |

### 페이지 오류

- 1280x720 ink: 0건 []
- 844x390 ink: 0건 []
- 390x844 ink: 0건 []
- 568x320 ink: 0건 []
- 360x740 ink: 0건 []
- 1280x720 legacy: 0건 []
- 844x390 legacy: 0건 []
- 390x844 legacy: 0건 []

### e2e 1280x720 — 28/28 통과 ([e2e-1280x720.json](e2e-1280x720.json))

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
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 13, "stateAfter": 14}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 5.5, "draftMeasures": [0.4, 0.2, 0.4, 0.1, 0.5, 0.2, 2, 0.3, 1.8, 0.1, 0.5, 0.2, 0.5, 0.2, 0.6, 0.1, 1.3, 0.2, 0.8, 5.5, 0.5, 0.2, 0.8, 0.3, 0…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 24, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.189, "max": 135.3}, "bestOffsetPx": {"dx": 0, "dy": 0}, "cor…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 28, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "29", "rootRevision": "29"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5: next is disabled on the last spread | 통과 | `{"disabled": true}` |
| R5: prev on the first spread (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |

### e2e 390x844 — 28/28 통과 ([e2e-390x844.json](e2e-390x844.json))

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
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 11, "stateAfter": 12}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 6.8, "draftMeasures": [0.4, 0.2, 0.5, 0.2, 0.6, 0.3, 0.4, 0.3, 0.6, 0.1, 0.5, 0.2, 0.7, 0.3, 0.4, 0.2, 6.8, 0.3, 1, 0.2, 1.3, 0.2, 1.2, 0.2, 0…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 24, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.164, "max": 67}, "bestOffsetPx": {"dx": 0, "dy": 0}, "correl…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 30, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "29", "rootRevision": "29"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5: next is disabled on the last spread | 통과 | `{"disabled": true}` |
| R5: prev on the first spread (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |

### e2e 568x320 — 28/28 통과 ([e2e-568x320.json](e2e-568x320.json))

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
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 11, "stateAfter": 12}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 3.7, "draftMeasures": [0.3, 0.3, 0.3, 0.1, 0.6, 0.2, 0.6, 0.4, 0.7, 0.2, 0.4, 0.4, 0.8, 0.2, 0.4, 0.1, 0.5, 0.3, 3.7, 0.1, 2.6, 0.3, 0.5, 0.3,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 24, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.231, "max": 103.3}, "bestOffsetPx": {"dx": 0, "dy": 0}, "cor…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 31, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "29", "rootRevision": "29"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5: next is disabled on the last spread | 통과 | `{"disabled": true}` |
| R5: prev on the first spread (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |

### e2e 844x390 — 28/28 통과 ([e2e-844x390.json](e2e-844x390.json))

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
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 13, "stateAfter": 14}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 5.2, "draftMeasures": [0.4, 0.3, 0.5, 0.1, 0.6, 0.2, 0.5, 0.3, 0.6, 0.2, 0.3, 0.3, 0.6, 0.2, 0.5, 0.2, 0.4, 0.2, 4.7, 0.3, 0.6, 0.3, 0.5, 0.3,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 24, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.007, "max": 77}, "bestOffsetPx": {"dx": 0, "dy": 0}, "correl…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 30, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "29", "rootRevision": "29"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5: next is disabled on the last spread | 통과 | `{"disabled": true}` |
| R5: prev on the first spread (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |
