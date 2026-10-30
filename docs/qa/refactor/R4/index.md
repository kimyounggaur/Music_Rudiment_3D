# R4 잉크 그림 시스템 + 음가 그림 — 캡처와 측정

| 항목 | 내용 |
|---|---|
| 단계 | R4 (V22), 설계서 §6 R4, 프롬프트 §3.4 R4-a–d |
| before | [R3 after](../R3/index.md) — 색 블록(MeshLambert) 음가 그림, 세로 scale로 자라는 등장 |
| after (ink) | `after/*_ink.jpg` 18장 + 그림 연속 캡처(등장 12프레임·글로·분할 4장, 3 viewport) |
| 비교 (legacy) | `after/*_legacy.jpg` 12장 — 착수 커밋 고정 사본(`?renderer=legacy`) |
| 명령 | `node scripts/refactor-capture.ts --stage R4 --phase after --renderer ink --quality high`<br>`node scripts/refactor-capture.ts --stage R4 --phase after --renderer legacy --states spread1,turn50,spread2,2d`<br>`node scripts/figure-capture.ts --viewport W×H --out docs/qa/refactor/R4`<br>`node scripts/book-v3-e2e.ts --viewport W×H --out docs/qa/refactor/R4/e2e-W×H.json` |
| 환경 | Linux 컨테이너, Node 22.23.4, Playwright 1.60, headless Chromium 1243(SwiftShader WebGL), DPR 1, 외부 요청 차단 |

headless 캡처는 실기기 통과가 아니다. SwiftShader는 소프트웨어 GL이라 실시간 애니메이션을 프레임마다 찍을 수 없어서, 등장 12프레임은 앱이 실제로 재생하는 것과 같은 시간표 함수(`figureEntryFrame`)를 inspector로 고정해 찍었고, 분할 획은 실제 분할 단추를 누른 뒤 획 시간을 0/120/240 ms에 고정(`holdFigureStrokes`)해 찍었다.


## 무엇이 바뀌었나

- **색 블록 → 잉크 그림.** 음가 블록은 종이색 면(조명·그림자를 받는 MeshStandard + 그늘진 면에만 잉크 해칭)과 12개 모서리 잉크 선으로 그린다. 쉼표는 면 없는 점선 외곽선, 선택은 강조 잉크(`#B96335`, 2.2 px) 외곽선, 재생 중인 음표는 종이 면이 강조색으로 빛나고(emissive 0.35) 재생선이 잉크로 지나간다. 시간 축·눈금·'0, 1/2, 1'은 종이 위 잉크다(겹친 레인은 첫 레인에만 숫자를 찍는다).
- **펜으로 그려지고 종이에서 일어선다.** 첫 등장은 펜이 납작한 평면도(x, 종이, z)를 520 ms 동안 그리고, 120 ms 뒤부터 600 ms 동안 입체로 일어선다(lift). 다시 찾은 펼침면은 그림을 그대로 둔 채 200 ms 만에 일어서고, 퇴장·드래그는 눕기만 한다(펜 되감기 없음). 줄여진 움직임은 바로 끝 상태다. stage의 세로 scale 등장(`sceneAnchor.scale.y`)은 없어졌다.
- **종이 곡면을 따른다.** 펼친 쪽의 곡률(R2 `spreadHeight`)을 그림이 그대로 받아, 납작한 잉크는 종이 위에, 블록은 그 아래 종이 위에 선다. R3에서 쪽 볼록함을 피하려고 장면을 띄우던 보정(bulge)은 없어졌다.
- **분할·합치기 획.** 데이터는 바로 바뀌고(같은 revision), 새 경계는 240 ms 펜 획으로 그어진다(합치기는 사라지는 경계를 지운다).
- **장식(의미 보조).** 펼침면 1: 긴 소리·짧은 소리 '소리 띠'와 일어서는 메트로놈. 펼침면 2: 레인 아래 종이 띠에 경계마다 가위 자국, 가위, 지금 나눈 분수(`1 = 1/2 × 2` …). 장식은 고르기·채점·저장에 쓰지 않는다. 그림 창(인쇄 쪽의 figure 칸)은 장식 자리만큼 늘렸다(펼침면 1: 쪽 세로의 0.29 → 0.39, 펼침면 2: 0.13 → 0.18).
- **선 폭.** 잉크 선은 화면 픽셀 폭(거리와 무관)이고, 선 사각형을 1.5 px 넓게 그려 조각 셰이더가 정확히 1.4 px만 덮게 했다(가장자리 1 px 안티앨리어싱). 그래서 선이 화소 격자 어디에 놓여도 폭이 같다.

## 판정

| 기준 (설계서·프롬프트 R4) | 결과 | 근거 |
|---|---|---|
| 선 폭 1.2–1.6 px(거리 무관), 1280×720·844×390 400% 확대 측정 | **부분 통과** | 종이 위 눈금(세로) 평균 1.28 / 1.21 / 1.33 px로 세 화면 모두 범위 안. 서 있는 블록 윗모서리는 1.74 / 1.11 / 1.58 px로 두 화면에서 범위를 벗어났고, 가로 축은 블록 앞모서리와 붙어 1280×720에서만 표본 2개(1.21 px)를 얻었다. 아래 '선 폭' 표의 측정 한계 참고 |
| 펜 reveal + 평면→입체 lift가 연속 캡처 12프레임에서 보임 | **통과** | `*_entry_sheet_ink.jpg`(3 viewport): 0 ms 빈 쪽 → 60–300 ms 축·눈금·숫자·블록 윤곽 → 360–660 ms 일어섬 |
| 기존 duration-world 의미 테스트 6개가 duration-figure에서 통과 | **통과** | `tests/duration-figure.test.ts` 9개(의미 6 + 분할 획·축/배치 거울·장식). lift 0/1 히트 박스 동일, 쉼표 면 없음 |
| 장면 draw call ≤ 40 | **통과** | 고품질 캡처: 펼침면 1 14(전체 101 − 장면 없음 87), 펼침면 2 9(96 − 87), 세 화면 같음(`figure-*.json`). e2e(자동 품질) 첫 등장 끝 9(53 − 44) |
| 그림 ≤ 3,000 세그먼트, 장면 ≤ 6,000, 장식 ≤ 400 | **통과** | 펼침면 1 572(잉크 480 + 강조 92, 채움 5, 라벨 3), 펼침면 2 275(183 + 92). 장식 한 장 ≤ 400은 `tests/duration-figure.test.ts`(`DECOR_BUDGET`) |
| 분할 보간 캡처 3장(0/120/240 ms) | **통과** | `*_split_000ms/120ms/240ms_ink.jpg`, e2e 'R4: split draws…' |
| 재생 글로·재생선 캡처 1장 | **통과** | `*_glow_ink.jpg` |
| 회귀: pickEvent(eventId), 넘김 잎이 그림을 가림(depthTest), 활성 장면 1개, SceneHost 토큰 테스트 무변경 | **통과** | `tests/book-lesson-scene.test.ts`, `tests/book-scene-host.test.ts`(무변경), e2e 그림 탭 선택·BK12, 캡처 turn50 |

## 사람 검사 항목

- 그림이 색 블록이 아니라 종이에 그린 잉크 선화로 보이는가(그늘진 면의 해칭, 종이색 면, 잉크 모서리).
- 첫 등장에서 펜이 먼저 그리고 그림이 종이에서 일어서는 순서가 자연스러운가(`*_entry_sheet_ink.jpg`, 실기기 60 fps는 미관측).
- 선 폭이 거리·화면 크기와 무관하게 고르게 보이는가(400% 크롭).
- 분할할 때 새 경계가 펜으로 그어지는 것이 보이는가(240 ms, 실기기 미관측).
- 장식(소리 띠·메트로놈·가위 자국·분수)이 학습 내용을 돕고 산만하지 않은가.

## 측정과 캡처

### 캡처

| viewport | 상태 | legacy (착수 커밋) | ink (R4) |
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

### 잉크 그림 측정 (ink, 펼침면 1·2)

| viewport | 상태 | 장식 | 세그먼트 (잉크/점선/강조) | 채움 | 라벨 | 장면 draw calls (전체 − 장면 없음) | 인쇄 메모리 MiB | HTML 쪽 요소 |
|---|---|---|---|---|---|---|---|---|
| 1280x720 | spread1 | sound | 572 (480/0/92) | 5 | 3 | 14 (101 − 87) | 37.27 | 0 |
| 1280x720 | spread2 | scissors | 275 (183/0/92) | 1 | 3 | 9 (96 − 87) | 46.1 | 0 |
| 844x390 | spread1 | sound | 572 (480/0/92) | 5 | 3 | 14 (101 − 87) | 37.27 | 0 |
| 844x390 | spread2 | scissors | 275 (183/0/92) | 1 | 3 | 9 (96 − 87) | 46.1 | 0 |
| 390x844 | spread1 | sound | 572 (480/0/92) | 5 | 3 | 14 (101 − 87) | 37.27 | 0 |
| 390x844 | spread2 | scissors | 275 (183/0/92) | 1 | 3 | 9 (96 − 87) | 46.1 | 0 |

### 종이·카메라 (ink spread1, R3와 비교용)

| viewport | 책 폭 비율 | far/near | 종이 음영 % | 본문 x-height px |
|---|---|---|---|---|
| 1280x720 | 0.6251 | 0.8469 | 4.4 | 4.06 |
| 844x390 | 0.4989 | 0.8506 | 4.82 | 2.14 |
| 390x844 | 0.8835 | 0.9377 | 11.06 | 1.77 |

### 선 폭 (400% 확대 크롭과 화면 측정)

측정: 캡처 PNG에서 선에 수직인 밝기 단면(±3 px, 0.1 px 간격, 쌍선형)의 반값 폭(FWHM)을 선을 따라 15곳에서 재어 평균했다. 양 끝 배경이 12% 넘게 다른 단면(이웃 선·그림자)은 버렸다.

| viewport | 선 | 평균 px | 최소–최대 px | 표본 (버림) | 400% 크롭 |
|---|---|---|---|---|---|
| 1280x720 | tick (ink on the paper, vertical) | 1.28 | 1.15–1.62 | 15 (0) | [linewidth-1280x720-tick-400pct.png](linewidth-1280x720-tick-400pct.png) |
| 1280x720 | axis (ink on the paper, horizontal) | 1.21 | 1.2–1.22 | 2 (13) | [linewidth-1280x720-axis-400pct.png](linewidth-1280x720-axis-400pct.png) |
| 1280x720 | block top back edge (standing) | 1.74 | 1.26–1.95 | 15 (0) | [linewidth-1280x720-edge-400pct.png](linewidth-1280x720-edge-400pct.png) |
| 844x390 | tick (ink on the paper, vertical) | 1.21 | 1.15–1.36 | 15 (0) | [linewidth-844x390-tick-400pct.png](linewidth-844x390-tick-400pct.png) |
| 844x390 | axis (ink on the paper, horizontal) | — | — | 0 (15) | [linewidth-844x390-axis-400pct.png](linewidth-844x390-axis-400pct.png) |
| 844x390 | block top back edge (standing) | 1.11 | 1.06–1.19 | 15 (0) | [linewidth-844x390-edge-400pct.png](linewidth-844x390-edge-400pct.png) |
| 390x844 | tick (ink on the paper, vertical) | 1.33 | 1.24–1.64 | 15 (0) | [linewidth-390x844-tick-400pct.png](linewidth-390x844-tick-400pct.png) |
| 390x844 | axis (ink on the paper, horizontal) | — | — | 0 (15) | [linewidth-390x844-axis-400pct.png](linewidth-390x844-axis-400pct.png) |
| 390x844 | block top back edge (standing) | 1.58 | 1.48–1.71 | 15 (0) | [linewidth-390x844-edge-400pct.png](linewidth-390x844-edge-400pct.png) |

측정 한계: 이 FWHM은 화소 격자 위의 위치(위상)에 민감하다. 정확히 1.4 px를 덮는 선도 화소 가운데에 놓이면 약 1.25 px, 두 화소 경계에 놓이면 약 2.0 px로 읽힌다. 세로 눈금은 종이 위 한 가지 배경이라 가장 믿을 만하고(1.21–1.33 px), 서 있는 모서리는 두 면(윗면·뒤 종이)의 밝기가 달라 기준선이 흔들린다(1.11–1.74 px). 셰이더가 덮는 폭 자체는 `tests/ink-lines.test.ts`가 확인한다. 위상을 평균하는 측정(기울인 선, 덮임 적분)은 R9 게이트에서 다시 한다.

### 등장·글로·분할 연속 캡처

| viewport | 등장 12프레임 (0–660 ms) | 재생 글로·재생선 | 분할 전 | 분할 0 ms | 120 ms | 240 ms |
|---|---|---|---|---|---|---|
| 1280x720 | [1280x720_entry_sheet_ink.jpg](after/1280x720_entry_sheet_ink.jpg) | [1280x720_glow_ink.jpg](after/1280x720_glow_ink.jpg) | [1280x720_split_before_ink.jpg](after/1280x720_split_before_ink.jpg) | [1280x720_split_000ms_ink.jpg](after/1280x720_split_000ms_ink.jpg) | [1280x720_split_120ms_ink.jpg](after/1280x720_split_120ms_ink.jpg) | [1280x720_split_240ms_ink.jpg](after/1280x720_split_240ms_ink.jpg) |
| 844x390 | [844x390_entry_sheet_ink.jpg](after/844x390_entry_sheet_ink.jpg) | [844x390_glow_ink.jpg](after/844x390_glow_ink.jpg) | [844x390_split_before_ink.jpg](after/844x390_split_before_ink.jpg) | [844x390_split_000ms_ink.jpg](after/844x390_split_000ms_ink.jpg) | [844x390_split_120ms_ink.jpg](after/844x390_split_120ms_ink.jpg) | [844x390_split_240ms_ink.jpg](after/844x390_split_240ms_ink.jpg) |
| 390x844 | [390x844_entry_sheet_ink.jpg](after/390x844_entry_sheet_ink.jpg) | [390x844_glow_ink.jpg](after/390x844_glow_ink.jpg) | [390x844_split_before_ink.jpg](after/390x844_split_before_ink.jpg) | [390x844_split_000ms_ink.jpg](after/390x844_split_000ms_ink.jpg) | [390x844_split_120ms_ink.jpg](after/390x844_split_120ms_ink.jpg) | [390x844_split_240ms_ink.jpg](after/390x844_split_240ms_ink.jpg) |

등장 프레임의 lift / reveal (1280×720, `__bookInspector.figureEntry(ms)`):

| ms | 0 | 60 | 120 | 180 | 240 | 300 | 360 | 420 | 480 | 540 | 600 | 660 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| reveal | 0 | 0.013 | 0.084 | 0.229 | 0.428 | 0.642 | 0.827 | 0.948 | 0.996 | 1 | 1 | 1 |
| lift | 0 | 0 | 0 | 0.009 | 0.058 | 0.163 | 0.317 | 0.5 | 0.683 | 0.837 | 0.942 | 0.991 |

### 페이지 오류

- 1280x720 ink: 0건 []
- 844x390 ink: 0건 []
- 390x844 ink: 0건 []
- 1280x720 legacy: 0건 []
- 844x390 legacy: 0건 []
- 390x844 legacy: 0건 []
- figure-capture 1280x720: 0건
- figure-capture 844x390: 0건
- figure-capture 390x844: 0건

### e2e 1280x720 — 19/19 통과 ([e2e-1280x720.json](e2e-1280x720.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| R4: entry ends drawn and standing; scene ≤ 40 draw calls, ≤ 6,000 segments | 통과 | `{"lift": 1, "reveal": 1, "segments": 572, "calls": {"total": 53, "withoutScene": 44, "scene": 9, "figure": {"segments": 572, "ink": 480, "dashed": 0, "accent…` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio"]` |
| mirror flap opens the printed questions | 통과 | `null` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:flap:questions", "root": "page-1:flap:questions", "stateBefore": 6, "stateAfter": 7}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 7.3, "draftMeasures": [4.4, 0.2, 0.5, 0.2, 1.1, 0.3, 0.4, 0.2, 0.4, 0.3, 7.3, 0.3, 0.4, 0.2, 0.5, 0.3, 0.6, 0.3, 2.5, 0.3, 0.4, 0.2, 0.6, 0.2,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 21, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.07, "max": 121.7}, "bestOffsetPx": {"dx": 0, "dy": 0}, "corr…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 27, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "26", "rootRevision": "26"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| no page errors | 통과 | `[]` |

### e2e 390x844 — 19/19 통과 ([e2e-390x844.json](e2e-390x844.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| R4: entry ends drawn and standing; scene ≤ 40 draw calls, ≤ 6,000 segments | 통과 | `{"lift": 1, "reveal": 1, "segments": 572, "calls": {"total": 53, "withoutScene": 44, "scene": 9, "figure": {"segments": 572, "ink": 480, "dashed": 0, "accent…` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio"]` |
| mirror flap opens the printed questions | 통과 | `null` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:flap:questions", "root": "page-1:flap:questions", "stateBefore": 6, "stateAfter": 7}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 2.9, "draftMeasures": [0.4, 0.2, 0.4, 0.1, 0.5, 0.2, 0.3, 0.4, 0.5, 0.1, 0.4, 0.3, 0.5, 0.2, 0.4, 0.2, 0.6, 0.1, 0.6, 0.3, 0.5, 1.6, 0.9, 0.3,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 21, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.025, "max": 66.7}, "bestOffsetPx": {"dx": 0, "dy": 0}, "corr…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 29, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "26", "rootRevision": "26"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| no page errors | 통과 | `[]` |

### e2e 844x390 — 19/19 통과 ([e2e-844x390.json](e2e-844x390.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| R4: entry ends drawn and standing; scene ≤ 40 draw calls, ≤ 6,000 segments | 통과 | `{"lift": 1, "reveal": 1, "segments": 572, "calls": {"total": 53, "withoutScene": 44, "scene": 9, "figure": {"segments": 572, "ink": 480, "dashed": 0, "accent…` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio"]` |
| mirror flap opens the printed questions | 통과 | `null` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:flap:questions", "root": "page-1:flap:questions", "stateBefore": 6, "stateAfter": 7}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 5.8, "draftMeasures": [1.7, 0.4, 1.9, 5.8, 0.7, 0.3, 0.4, 0.3, 0.6, 0.3, 4.8, 0.2, 1, 0.1, 0.5, 0.3, 0.3, 0.2, 0.6, 0.1, 0.5, 0.2, 0.5, 0.2, 1…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 21, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.03, "max": 74.3}, "bestOffsetPx": {"dx": 0, "dy": 0}, "corre…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 29, "phases": ["preparingTurn", "turningForward", "settling"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "26", "rootRevision": "26"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| no page errors | 통과 | `[]` |
