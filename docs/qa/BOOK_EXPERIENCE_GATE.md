# G1 — 첫 두 펼침면 책 경험 검증표

갱신: 2026-10-28T06:42:34.621Z. **초기 G1-A/B 통과 — 명시된 Windows IAB Chromium 환경과 첫 두 펼침면 범위.** 실제 WebGL/Web Audio, 기본 입력·복구·접근성 경로에 더해 표지 열기→직접 드래그→분할→재방문의 단일 연속 녹화와 최종 ready 이후 프레임을 확인했다. 이미 승인된 V09 이후 구현을 진행할 수 있다. G1-C 원본 체감·사용자 주관적 수용·실제 휴대전화 터치·실제 청취·실제 보조기술 검증은 별도 미완료다.

기준: [구현 계약](../IMPLEMENTATION_CONTRACT_V2.md), [요구 추적](../REQUIREMENTS_TRACE_V2.md), [시각 명세](../BOOK_VISUAL_SPEC.md), [원본 관측](../reference/MOTION_REFERENCE.md). 원본 설계서§19–20, 프롬프트V08/G1에 따른다. 아래 짧은 파일명은 `output/qa-v2.1/v08-1793163292932-` 접두사를 생략했다.

## 실행 환경과 검사 기준

| 항목 | 확인된 범위 |
|---|---|
| 코드 / 대상 | HEAD `4dd62db8dc46ca6468bffeeb586c1d295a38a793`, `book-experience-v2.1`, 미커밋 v2.1 코드. 실제 실행 대상은 첫 두 펼침면 |
| 브라우저 / URL | Windows DESKTOP-FVHJSEO, 실제 IAB Chromium156, `http://127.0.0.1:4183/`, 기본1280×720·DPR1. 이전 V06 Edge1912×946과 구분 |
| 입력 / 장치 | CUA locator 버튼·키 입력 및 CDP mouse, 실제 WebGL/Web Audio. 일부 pointercancel·두 번째 pointer·visibility는 이벤트/환경 에뮬레이션. 실제 휴대전화 터치·실제 청취는 미실행 |
| 최신 통합 검사 | [055212 summary](../../output/qa-v2.1/g1-integrated-20261028-055212-summary.json): 05:54:13 UTC 완료, **174/174**, lint·build·typecheck exit0. queued print refresh 수정 후 검사; 로그 해시와 BookApp/controller 지문 포함 |
| 검사 한계 | main1038.33kB·gzip288.26kB, 500kB 초과 경고 유지. 콘텐츠 검증6 scenes/9 lanes는 baseline 데이터이며 여섯 펼침 구현 완료가 아님. baseline96/96·이전 cloud200·CPU mock을 실제 브라우저 검증으로 승계하지 않음 |

## G1-A 요구 / 결과 / 증거 / 한계

“확인”은 해당 파일에 기록된 경로만 의미한다. 물리 기기·native browser 조작·모든 입력 조합을 확인했다는 뜻이 아니다.

| 요구 | 관찰 결과 | 실제 증거 | 검증 한계 |
|---|---|---|---|
| CI01–02: 표지·camera 이동·중앙·반응형 bounds | 여섯 intro trace의 유효909표본 bounds 초과0, 최종 중앙오차<0.001 CSS px. 5 viewport×0/25/50/75/100% 실제 renderer 포즈25장. 정상1280×720 intro58프레임 | [intro 검토](G1_INTRO_EVIDENCE.md), [정확한 포즈](../../output/qa-v2.1/v08-1793163292932-intro-exact-live-renderer-poses.json), [normal trace](../../output/qa-v2.1/v08-1793163292932-intro-full-1280x720-trace.json), [영상](../../output/qa-v2.1/v08-1793163292932-intro-full-1280x720-playback.mp4) | 정지포즈는 timed motion이 아님. 초기 여섯 screencast는1280×720 위젯 축소본이며 portrait 전체 viewport 영상이 아님. 비대칭 inset은 에뮬레이션. A4/full-turn 우선과88–94% 폭 목표의 양립 불가 조건은 시각 명세에 기록 |
| CI03: skip·reduced·hide·실패 복구 | skip 클릭/Escape는 coverIdle p1/audio0; 별도Enter만 OPEN. reduced intro11프레임 모두p1, reduced 이동은 동일commit. 실제 표지 요청 차단→2D→retry | [skip](../../output/qa-v2.1/v08-1793163292932-intro-skip-fixed.json), [reduced intro](../../output/qa-v2.1/v08-1793163292932-reduced-intro-trace.json), [reduced 이동](../../output/qa-v2.1/v08-1793163292932-reduced-motion-navigation.json), [표지 실패](../../output/qa-v2.1/v08-1793163292932-cover-load-failure-recovery.json), [visibility](../../output/qa-v2.1/v08-1793163292932-visibility-path-emulation.json) | visibility는 live browser property/event 에뮬레이션. IAB 탭 변경은 native visibility를 바꾸지 않아 native hide는 미검증. 해당 복귀 경로의 no-autoplay와 ready barrier 확인 |
| BO01 / BK01–04·10–12: 책만·곡률·인쇄·scene 전이 | 표지·열림·두 음악 펼침·turn·cancel·close의 개별 실제 시각 증거. print/live 배경RGB244/238/220·오선0px·heading1px 비교. close는 coverIdle/active0/audio0/OPEN focus | [음악 영상](../../output/qa-v2.1/v08-1793163292932-music-sequence-playback.mp4), [drag 영상](../../output/qa-v2.1/v08-1793163292932-direct-drag-playback.mp4), [close](../../output/qa-v2.1/v08-1793163292932-close-fixed.json), [live](../../output/qa-v2.1/v08-1793163292932-color-fixed-live.png), [print](../../output/qa-v2.1/v08-1793163292932-color-fixed-print-p0.png) | 전체 필수 행동은 아래330프레임 단일 연속 영상으로 확인. 픽셀 수치는 해당 표본만의 비교; 모든 글자·scroll·revision 정밀도 통과가 아님. 미세 잉크 부드러움은 V11 개선 |
| EN01–02 / BK08–09: nav·키 예외·경계·큐 | 버튼/제목 화살표 이동, 마지막Right 무이동·재생 유지. input/range/dialog-close key가 navigation을 훔치지 않음. prev10회는2→1→close, 방향반전은2→1→2 | [경계](../../output/qa-v2.1/v08-1793163292932-last-boundary-audio.json), [키 예외](../../output/qa-v2.1/v08-1793163292932-keyboard-input-exceptions.json), [owner fixtures](../../output/qa-v2.1/v08-1793163292932-keyboard-owner-fixtures.json), [prev10회 수정 후](../../output/qa-v2.1/v08-1793163292932-ten-prev-clicks-print-fixed.json), [반전](../../output/qa-v2.1/v08-1793163292932-real-navigation-reversal-queue.json) | input/range/dialog은 임시 DOM fixture 후 제거; 제품 대화상자 완료를 뜻하지 않음. repeat/isComposing은 synthetic.16음표 preparingTurn804.1ms는 해당 관찰값이며 전체 전이나 원본 실측값이 아님 |
| BK05–07·13–16: 직접 drag·hold·reverse·commit/cancel·해제 | p=.25/.5/.75, 계측2306ms hold 동안 동일p, reverse.08→cancel. 별도 backward p=.575668→commit1→revisit2. lostcapture·resize·second pointer·pointercancel 후 source spread/ready 회복 | [drag](../../output/qa-v2.1/v08-1793163292932-direct-drag-trace.json), [backward/revisit](../../output/qa-v2.1/v08-1793163292932-normal-backward-commit-revisit.json), [capture loss](../../output/qa-v2.1/v08-1793163292932-pointer-loss-recovery.json), [충돌](../../output/qa-v2.1/v08-1793163292932-pointer-conflicts.json) | 실제 WebGL+주입 mouse. second pointer/pointercancel은 synthetic이며 물리 멀티터치/pinch가 아님. 아래 단일 연속 영상에 실제 직접 drag·hold·reverse·release/cancel 포함 |
| 첫 음악 / MU05 / AU 기술 경로 | C4 261.625565Hz,4/4·90BPM, 온음표1/4분음표4. 각8/3초, 아래 onset0·2/3·4/3·2. 사용자 재생·자연 종료·turn 시 현재/미래 source stop | [두 레인 audio](../../output/qa-v2.1/v07-audio-real-two-lanes-1793162614122.json), [turn stop](../../output/qa-v2.1/v07-audio-turn-stop-1793162651365.json), [음악 trace](../../output/qa-v2.1/v08-1793163292932-music-sequence-trace.json) | 실제 AudioContext 기술 증거이며 청취가 아님. pause/resume·late resume·play20 등 전체 AU 스트레스는 V09 이후. 없는 pause를 stop으로 표기하지 않음 |
| 둘째 음악 / MU03 / BK06: 분할·병합·이력·재방문 | 16분음표16개·합1/1·추가split 비활성. 병합/undo/redo, backward commit 후 동일16 event IDs·선택 보존·audio0 | [16개 한계](../../output/qa-v2.1/v08-1793163292932-music-all-sixteenths.json), [병합 이력](../../output/qa-v2.1/v08-1793163292932-music-sixteenth-merge-history.json), [재방문](../../output/qa-v2.1/v08-1793163292932-normal-backward-commit-revisit.json) | 수정 중 printsReady=false 표본을 안정 완료로 오인하지 않음. 정상 재방문 ready/printsReady=true와 최신 print-refresh 회귀를 사용 |
| AX21 기본: keyboard·2D·portrait·200%·reduced | 390×844 2D 재생/분할/undo. scale2 Enter merge revision25→26(15개), undo→27(16개). 별도 CDP mouse split 결과revision29·16개. 3D 확대에서camera 불변 | [2D 기능](../../output/qa-v2.1/v08-1793163292932-2d-portrait-functional.json), [200% keyboard](../../output/qa-v2.1/v08-1793163292932-zoom-200-reading-keyboard-edit.json), [200% pointer](../../output/qa-v2.1/v08-1793163292932-zoom-200-verified-pointer-split.json), [읽기 캡처](../../output/qa-v2.1/v08-1793163292932-zoom-200-visible-reading.png), [3D camera](../../output/qa-v2.1/v08-1793163292932-3d-zoom-preserved.json) | 실제 Chromium CDP pageScale2·2D 읽기 경로. native Ctrl zoom·물리pinch·3D 확대 편집·실제 screen reader 사용은 미검증. pointer 파일에 before가 없어28→29 변화량 근거로 쓰지 않음 |
| lifecycle / RC01–02·05 기본 | context loss에서 같은revision2의2D·audio0·old group정리; retry는ready/active1/no-autoplay. 표지 network 차단 복구와 visibility enter/ready barrier | [context loss/retry](../../output/qa-v2.1/v08-1793163292932-context-loss-recovery-fixed.json), [표지 실패](../../output/qa-v2.1/v08-1793163292932-cover-load-failure-recovery.json), [visibility](../../output/qa-v2.1/v08-1793163292932-visibility-path-emulation.json) | context 파일 eventsBefore가 비어 있어 전체 event identity 보존을 이 파일만으로 주장하지 않음. font/storage·50회 memory plateau 등 전체 RC 행렬은 후속 검증 |

## 최종 연속 실행과 독립 감사

- [단일 연속 영상](../../output/qa-v2.1/g1-complete-1793168908925-playback.mp4), [실제 trace](../../output/qa-v2.1/g1-complete-1793168908925-trace.json), [원본 frame manifest](../../output/qa-v2.1/g1-complete-1793168908925-frames.json), [최종 화면](../../output/qa-v2.1/g1-complete-1793168908925-final.png): fresh reload 후 closed→OPEN→위/아래 재생→재생 중 grab→p=.25/.5/.75→동일p **2312.7ms hold**→reverse .08→cancel→p=.72 release/commit→두 번 분할→편집 리듬 재생→prev→revisit. 한 번의 screencast start/stop이며 복구·영상 접합 없이330프레임을 저장했다. tool 대기와 정지 구간도 원래 시간축 그대로다.
- grab에서 session3/source4가 page-exit/audio0으로 정지. cancel은 spread1/revision0/sceneProgress1/ready로 복원. 분할 결과 quarter/quarter/half의 동일3 event IDs·선택이 revision3→5 재방문에서도 일치한다. 모든23 trace 표본에서 active scene≤1, pending0, cleanupFailures0이며 마지막ready/printsReady=true/audio0이다. 이 샘플 사실을 미관측 모든 순간의 계측이라고 표현하지 않는다.
- 전체23표본이 녹화 시간 범위 안이다. revisit-ready-before-proof-interaction=1793169053.839700 뒤 실제 Tab으로 첫 음표에 포커스했다. frame0328=1793169053.888222(**+48.522ms**), 마지막0329=1793169065.274884(**+11.435184초**)를 저장했고,0329에서 선택 음표의 보이는 focus ring을 직접 확인했다. 이전326프레임 녹화의 final-ready tail 부족은 이 새 실행으로 해소했다.
- 두 독립 읽기 검토에서330개 파일의 bytes/SHA256·고유path/timestamp·엄격한 시간 순서를 확인했다. [무손실 검증](../../output/qa-v2.1/g1-complete-1793168908925-video-verification.json)은 decoded330/1280×720, capture span**156.326265초**, 전체 정규화 frame hash 일치·PTS오차0µs를 기록한다. [재생 사본 검증](../../output/qa-v2.1/g1-complete-1793168908925-playback-verification.json)도330프레임·PTS오차0이며 후속 [실제 브라우저 재생](../../output/qa-v2.1/g1-complete-1793168908925-browser-playback.json)은 ended=true/error=null, decoded330/total330, duration/currentTime156.326266초, **dropped10**을 확인했다. 인코더의0프레임 누락과 브라우저 재생 중drop10은 다른 측정이며 오디오 트랙/실제 청취는 없다.
- 직접 열어 본 새 원본 frame:0010(열림),0033(첫 음악),0145/0146(half 부근),0148(75% 부근),0158(cancel 복원),0182/0189(둘째 장면/분할),0284(이전),0329(재방문 후focus). trace 가까운 frame을 정확히 같은 progress라고 자동 명명하지 않는다. 정확한25/50/75 수치와 기존 중간 캡처도 위 증거에 유지한다.

**이전 잘림 의심 정정:** g1-final-1793168328926-0150.jpg가 y=0에 잘렸다는 초기 시각 판독은 틀렸으며 철회했다. [객관적 픽셀/geometry 감사](../../output/qa-v2.1/g1-camera-envelope-audit.json)와 독립 재계산에서 상단12행15360픽셀 모두 배경RGB(217,209,196), 첫 종이 픽셀(556,29), 현재 mesh/camera의 half 상단27.700654px를 확인했다. 새0145/0146 원본도 상단12행이 배경이고 첫 유의한 차이는y29다. 기존 camera를 유지했으며 이 감사로 앱 소스를 수정하지 않았다. dense geometry 계산은 CPU 근거이며 새 실제 브라우저 실행이라고 표현하지 않는다. 기존326프레임 g1-final 자료는 부분 기록으로 보존하고 최종 연속 실행 근거에는 새 g1-complete 자료를 사용한다.

## 영상 무결성과 제외 자료

- 353프레임 음악 영상: 순서·PTS 보존,39.834461초. [브라우저 재생](../../output/qa-v2.1/v08-1793163292932-music-sequence-browser-playback.json)은 decoded353, ended=true, error=null, **dropped17**. 버튼 중심 이동이므로 직접 drag를 포함한 전체 필수 영상의 대체물이 아니다.
- 35프레임 drag 영상: [브라우저 재생](../../output/qa-v2.1/v08-1793163292932-direct-drag-browser-playback.json) ended=true/error=null, decoded35/dropped0,37.904585초. 별도 hold/reverse/cancel 증거다.
- 58프레임 정상 intro: [무손실 검증](../../output/qa-v2.1/v08-1793163292932-intro-full-1280x720-video-verification.json)은1280×720, capture span1.998291초, 전 프레임 해시 일치·PTS오차0µs. [재생 사본](../../output/qa-v2.1/v08-1793163292932-intro-full-1280x720-playback-verification.json)은 브라우저 재생 미검증이며 인코딩 검증과 구분한다. 별도 재생 확인을 새 G1 요구로 만들지 않는다.
- 위 영상을 이어 붙여 “끊기지 않은 한 실행”으로 만들지 않는다. 모두 오디오 없는 화면 기록이며 청취 증거가 아니다.
- `zoom-200-visible-pointer-merge.json`은 잘못 겨냥해 redo를 누른 기록으로 **merge 근거에서 제외**한다. `g1-whole-attempt1-unusable.json`은 paused document response 중 raw CDP 불가로1프레임/steps0. `full-music-functional-trace.json`은 videoFrames0. 둘 다 전체 흐름 영상 근거가 아니다.
- `intro-png-*-near-*` 이름은 정확한 진행률이 아니다([검토](G1_INTRO_EVIDENCE.md)). `568x320-controls.png`는 표지 캡처라 조작부 근거에서 제외. `v07-audio-first-path-1793162484829.json`은 HMR 이벤트 유실. `v07-1793162663103-music-drag-half.png`는 실제p=.361518이며 half 증거가 아니다. 원본 파일은 보존한다.

## G1-B 요구와 원본 구조 추적

| 요구 / 근거 종류 | 실제 코드 | 연결된 실행 / 판정 범위 |
|---|---|---|
| 실제 표지·책만·중앙·부착 버튼: 사용자 명시와 v2.1 계약 | [BookApp](../../src/book/BookApp.tsx), [stage](../../src/book/stage.ts), [LessonPages](../../src/book/LessonPages.tsx) | CI/BO/EN 행. 원본 외부toolbar 제거는 의도적 차이. BO 대표 전체 실행은 아래330프레임으로 확인 |
| cover/page 분리·곡률/양면·leave→turn→arrive·queue: 설계서 공개 코드 정적 분석 + V02 제한 관측 | [geometry](../../src/book/geometry.ts), [controller](../../src/book/controller.ts), [SceneHost](../../src/book/SceneHost.ts), [motion](../../src/book/motion.ts) | close/drag/queue/recovery. 원본1.1/1.15초 등은 정적 코드 출처이며 새 실측이 아님; 제품 timing은 시각 명세의 제안값 |
| 직접 grab/hold/reverse/release/cancel: 사용자 필수 | [gesture](../../src/book/gesture.ts), [controller](../../src/book/controller.ts), [BookApp](../../src/book/BookApp.tsx) | direct-drag + backward-commit + pointer-conflicts. 원본 직접drag 미관측은 제품 필수성을 낮추지 않음 |
| 두 음악 장면·revision·재방문·무자동재생: v2.1 계약·기존 domain/audio 재사용 | [lessonScene](../../src/book/lessonScene.ts), [LessonPages](../../src/book/LessonPages.tsx), [BookNotation](../../src/book/BookNotation.tsx), [pagePrint](../../src/book/pagePrint.ts), [AudioEngine](../../src/audio/AudioEngine.ts) | 실제 두 레인 timing,16분음표·병합,역방향 재방문에 연결. 같은 실행의 전체 흐름 영상 연결 확인 |
| 기본 접근성·대체 경로·소유권: v2.1 계약 | [BookApp](../../src/book/BookApp.tsx), [SceneHost](../../src/book/SceneHost.ts), [usePagePrints](../../src/book/usePagePrints.ts) | keyboard/200%/2D/reduced/context/visibility. native·물리·보조기술 한계는 따로 유지 |

[MOTION_REFERENCE](../reference/MOTION_REFERENCE.md)의 정적 분석/직접 관측/미관측 구분을 유지한다. 원본 체감 유사도·사용자 주관적 수용을 이 표로 자동 통과시키지 않는다.

## 판정과 후속 검증

| 구분 | 상태 / 다음 작업 |
|---|---|
| G1-A/B 최종 | **통과: 초기 첫 두 펼침면·명시 브라우저 범위.** CI01–03/BO01/EN01–02/AX21 기본 및 직접 조작·실제 음악·lifecycle 증거를 위 요구 추적과 연결했다. 마지막 필수 연속 영상은330프레임·실제 ready 이후frame까지 확인. 원본C와 최종 기기/청취 결과를 승계하지 않음 |
| G1-C 원본 체감 | **미검증.** 원본 열린 책·Previous→Contents만 관측. 동일 입력 연속 영상·실측 timing·직접drag 비교 없음 |
| V09 이후 | 초기 G1-A/B 통과에 따라 이미 승인된 범위에서 진행 가능. 선택적 디자인 승인 질문을 새 잠금으로 만들지 않음. 전체 구현 완료나 배포 완료를 뜻하지 않음 |
| 후속 V09/V12/최종 | 전체 AU pause/resume·경쟁/연타, RC memory/storage/font, native visibility·desktop zoom, 실제 휴대전화 가로touch·주소창/노치/회전·pinch, 실제 screen reader, 교육자 검수, 실제 청취는 각 단계에서 별도 수행. 후속 전체 행렬을 초기 G1로 당겨 잠그거나 초기 확인을 최종 완료로 확대하지 않음 |
| commit/push/배포 | 전체 구현·필수 검증 완료 전 금지. 이 문서 갱신은 승인·commit·push·배포가 아님 |
