# R7 효과음·마감 — 렌더 측정과 e2e

| 항목 | 내용 |
|---|---|
| 단계 | R7 (V25), 설계서 §6 R7, CONTRACT_V3 C8, 결정 2, 프롬프트 §3.7 |
| before | [R6](../R6/index.md) — 효과음 없음, 저장 형식 v2(`bookUiVersion 2.x`), 표지 로딩은 글자만 |
| 명령 | `node scripts/sfx-render.ts --out docs/qa/refactor/R7/sfx-render.json`<br>`node scripts/book-v3-e2e.ts --viewport W×H --out docs/qa/refactor/R7/e2e-W×H.json` (1280×720, 844×390) |
| 환경 | Linux 컨테이너, Node 22.23.4, Playwright 1.60, headless Chromium 1243(SwiftShader WebGL, OfflineAudioContext 48 kHz), 외부 요청 차단 |

에이전트는 소리를 들을 수 없다. 아래 수치는 브라우저의 OfflineAudioContext로 앱 모듈(`synthSfx.ts`)을 그대로 렌더해 잰 길이와 피크다. 실제 청취(크기·질감·구별)는 **외부 검수 대기**다.

## 무엇이 바뀌었나

- **절차 합성 효과음 7종.** 음원 파일 없이 필터한 노이즈(미리 렌더해 정규화)와 사인으로 만든다: 페이지 넘김(0.35 s, 핑크 노이즈 + 2.2 kHz 밴드패스 스윕), 안착(0.06 s 저역 탭), 표지 열기·닫기(0.25 s, 80 Hz 사인 + 노이즈), 펜(0.043 s, 3 ms 클릭 + 1.8 kHz 감쇠), 덮개(0.15 s 종이), 도장(0.12 s 저역 탭 + 노이즈). 각 그래프는 끝나면 스스로 연결을 끊는다. 게인은 효과음마다 고정해 피크 상한(엔벨로프 게인 합) ≤ 0.5(−6 dBFS)다.
- **한 AudioContext, 별도 게인.** `AudioEngine.playSfx(name, when?)`는 학습 재생과 같은 컨텍스트의 master 아래 효과음 게인으로만 낸다. 컨텍스트를 만들거나 깨우지 않고, 음소거·설정 꺼짐·정리됨·컨텍스트가 돌지 않으면 거절한다. 학습 재생 규칙(AU01–07)은 그대로다.
- **상태 전이 → 효과음.** 표지 열기·닫기 시작, 버튼·키 넘김의 TURN_PREPARED(드래그는 놓아서 넘기기로 확정될 때), 안착(settling → spreadIdle), 인쇄 단추 누름(펜), 정답 덮개(종이), 새로 찍힌 도장. 표지를 열기 전(첫 제스처 전)에는 아무 소리도 내지 않고, 음악이 재생 중이면 펜 소리를 내지 않는다. 조작바 '소리'는 음악과 효과음을 함께 끈다.
- **저장 형식 v3.** `bookUiVersion 3.0.0`(schema 3)이 `preferences.sfx`(기본 켬)와 `preferences.autoShot`(재생 시작 시 자동 샷, 기본 끔, 결정 5)을 더한다. v2 기록은 먼저 바뀌지 않는 v2 원본 백업을 쓰고, 검증한 뒤 새 키에 쓴다. v2 키는 건드리지 않는다. 기록 대화상자에 '효과음'·'재생할 때 가까이 보기' 설정이 있다.
- **표지 로딩 잉크 선.** 표지 아래 안내 자리에 잉크 선이 표지 → 본문 글꼴 → 기보 글꼴 → 첫 펼침면 인쇄 순서로 자란다(글자 안내는 그대로).

## 판정

| 기준 (설계서·프롬프트 R7) | 결과 | 근거 |
|---|---|---|
| OfflineAudioContext 렌더에서 각 효과음 길이 ±10%, 피크 ≤ −6 dBFS | **통과** | 아래 렌더 표(7종 모두, 피크 −7.2 ~ −10.5 dBFS), `scripts/sfx-render.ts`. Node 단위 테스트는 노드 그래프 스텁으로 같은 기준(`tests/sfx.test.ts`) |
| `preferences.sfx=false`(그리고 음소거)에서 노드 생성 0 | **통과** | `tests/sfx.test.ts` 'no effect before the first gesture; the setting and mute create zero nodes'(createGain·createOscillator·createBufferSource 호출 0) |
| 음악 playing 중 `pen` 무시 | **통과** | `tests/sfx.test.ts`(전이·게이트), e2e 'R7: pen on a printed control, but not while music plays'(정지 중 허용·재생, 재생 중 거부) |
| 첫 사용자 제스처 전 소리 없음 | **통과** | `tests/sfx.test.ts`, e2e 'R7: no effect before the first gesture…'(표지 전 요청 0, 표지 열기 → cover-open 재생) |
| 넘김·안착 소리 | **통과** | e2e 'R7: a keyboard turn sounds page-turn, then page-settle'(키 넘김 2회 → page-turn, page-settle 각 2) |
| AU01–07 무변경 | **통과** | `tests/audio.test.ts`·`tests/audio-transport.test.ts`·`tests/book-audio-ownership.test.ts` 무변경 통과(372/372) |
| 저장 형식 판올림 + strict 이관, 기존 테스트 무변경 | **통과** | `tests/book-progress-v3.test.ts`(8: v2 원본 백업 → 검증 → 새 키, v2 키 무변경, v1 → v2 → v3, 손상·충돌·쓰기 실패에서 원본 보존, CAS, 가져오기·백업·삭제), `tests/book-progress.test.ts` 무변경 통과 |
| 표지 로딩 잉크 선(표지 → 본문 글꼴 → 기보 글꼴 → 첫 펼침면 인쇄) | **통과** | `usePageCompositor`의 `preload` 단계와 표지 `svg.book-cover-progress`(`data-preload`), 글자 안내는 그대로 |
| 실제 청취 | **외부 검수 대기** | 에이전트는 들을 수 없다 — 아래 사람 검사 항목 |

## 사람 검사 항목 (실기기 청취)

- 표지를 열 때, 페이지를 넘길 때, 안착할 때, 인쇄 버튼을 누를 때 각각 다른 짧은 소리가 나는가. 너무 크지 않은가.
- 음악 재생 중 버튼을 눌러도 펜 소리가 섞이지 않는가.
- 조작바 '소리'를 끄면 음악과 효과음이 모두 꺼지는가.
- 정답 덮개(종이)·도장 소리가 거슬리지 않는가.

## 측정

### 효과음 렌더 (OfflineAudioContext 48000 Hz, 모노, [sfx-render.json](sfx-render.json))

| 효과음 | 설계 길이 s | 들리는 길이 s (−60 dBFS 위) | 길이 오차 | 피크 dBFS | RMS | 판정 |
|---|---|---|---|---|---|---|
| page-turn | 0.35 | 0.3288 | -6.0% | -7.17 | 0.06385 | 통과 |
| page-settle | 0.06 | 0.0585 | -2.6% | -10.45 | 0.0367 | 통과 |
| cover-open | 0.25 | 0.248 | -0.8% | -7.74 | 0.0815 | 통과 |
| cover-close | 0.25 | 0.2492 | -0.3% | -7.98 | 0.08222 | 통과 |
| pen | 0.043 | 0.0426 | -1.0% | -10.13 | 0.01535 | 통과 |
| flap | 0.15 | 0.1492 | -0.6% | -8.3 | 0.03458 | 통과 |
| stamp | 0.12 | 0.1192 | -0.7% | -8.77 | 0.05049 | 통과 |

### e2e 1280x720 — 36/36 통과 ([e2e-1280x720.json](e2e-1280x720.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| R7: no effect before the first gesture; opening the cover sounds cover-open | 통과 | `{"before": 0, "effects": ["cover-open:ok"]}` |
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
| R7: a keyboard turn sounds page-turn, then page-settle | 통과 | `{"effects": ["pen", "stamp", "flap", "flap", "page-turn", "page-settle", "page-turn", "page-settle"]}` |
| R5: ArrowRight / ArrowLeft turn the book with the toolbar in place | 통과 | `{"keyNext": true, "keyPrev": true}` |
| R6: 가까이 보기 takes the camera into the figure (user-started shot) | 통과 | `{"camera": "shot", "label": "돌아오기", "moved": 8.109}` |
| R7: pen on a printed control, but not while music plays | 통과 | `{"pens": [{"allowed": true, "played": true}, {"allowed": false, "played": false}]}` |
| R6: a printed control works during the shot | 통과 | `{"control": "play-upper", "pressed": "page-2:listen:play-upper", "playing": true}` |
| R6: the same button returns exactly to the reading pose (≤ 1e-6) | 통과 | `{"maxDifference": 0}` |
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 4, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 21, "stateAfter": 22}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 3.9, "draftMeasures": [0.6, 0.4, 0.7, 0.4, 0.9, 0.2, 0.4, 0.2, 0.7, 3.9, 0.8, 0.3, 0.5, 0.1, 0.5, 0.2, 0.3, 0.2, 0.8, 0.1, 1.3, 0.2, 0.7, 0.2,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 26, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.189, "max": 135.3}, "bestOffsetPx": {"dx": 0, "dy": 0}, "cor…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 27, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "31", "rootRevision": "31"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5: next is disabled on the last spread | 통과 | `{"disabled": true}` |
| R5: prev on the first spread (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |

### e2e 844x390 — 36/36 통과 ([e2e-844x390.json](e2e-844x390.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| R7: no effect before the first gesture; opening the cover sounds cover-open | 통과 | `{"before": 0, "effects": ["cover-open:ok"]}` |
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
| R7: a keyboard turn sounds page-turn, then page-settle | 통과 | `{"effects": ["pen", "stamp", "flap", "flap", "page-turn", "page-settle", "page-turn", "page-settle"]}` |
| R5: ArrowRight / ArrowLeft turn the book with the toolbar in place | 통과 | `{"keyNext": true, "keyPrev": true}` |
| R6: 가까이 보기 takes the camera into the figure (user-started shot) | 통과 | `{"camera": "shot", "label": "돌아오기", "moved": 8.969}` |
| R7: pen on a printed control, but not while music plays | 통과 | `{"pens": [{"allowed": true, "played": true}, {"allowed": false, "played": false}]}` |
| R6: a printed control works during the shot | 통과 | `{"control": "play-upper", "pressed": "page-2:listen:play-upper", "playing": true}` |
| R6: the same button returns exactly to the reading pose (≤ 1e-6) | 통과 | `{"maxDifference": 0}` |
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 7, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 23, "stateAfter": 24}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 3.7, "draftMeasures": [0.5, 0.3, 0.3, 0.2, 0.7, 0.4, 0.4, 0.2, 0.5, 1.3, 0.5, 0.2, 0.5, 0.3, 0.4, 0.3, 3.7, 0.3, 0.6, 0.2, 1.7, 0.1, 0.5, 0.3,…` |
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
