# v2.1 요구사항 추적 — V01

기준: 최신 [설계서](https://drive.google.com/file/d/1XUhB4FisvfdMizll3FcpcC1WMqrMDoWJ/view)와 [프롬프트](https://drive.google.com/file/d/1lU0z17FW6xmd6oBzdai6opePeTeSpouf/view), baseline `4dd62db8dc46ca6468bffeeb586c1d295a38a793`, 2026-10-27 UTC. 로컬 원본 identity/hash는 [구현 계약](IMPLEMENTATION_CONTRACT_V2.md)에 있다.

이 표의 “계획”은 존재하는 구현 파일이나 통과 결과가 아니다. 현재 book source는 미구현이다. 기존 단위 테스트의 통과와 실제 제품 검증을 별도 열로 유지하며, 후속 단계에서 실제 경로·로그·영상으로 갱신한다.

| 요구/설계 근거 | 현재 source와 부족한 부분 | 구현 단계/책임 계획 | 필요한 증거 | 현재 판정 |
|---|---|---|---|---|
| BOOK-ONLY / BO01, v2.1 상단 | `App.tsx:174–228` 외부 header/nav/aside/cards/sticky footer/notices | V02 구도, V04 BookStage, V07–V08 책 내부 UI | open/learn/turn/cancel/settle/back/close 연속 영상, Canvas HUD 포함 시각 검사 | 미구현·미실행 |
| 실제 앞표지 원화·A4 front-face | 기존 repo에 책 표지 적용 경로 없음; 원본 AI는 외부 reference-documents에 확보 | V02 자산 검증, V04 CoverRig/AssetRegistry | 원본 보존/hash, 완전 decode한 변환본, 무crop/무왜곡 front-face | 원본 확보·픽셀 관측 보고 있음; 제품 적용 미구현 |
| CI01 진입과 중앙≤2px | 기본 `mode='2d'` (`App.tsx:27`), cover/intro 없음 | V03 상태/guard, V04 camera fit | UV 중심 투영 JSON, intro 0/25/50/75/100% 캡처+영상 | 미구현·미실행 |
| CI02 안전영역·반응형 | 기존 3D resize/DPR 대응은 있음; book bounds 없음 | V04–V05 geometry/camera, V08/V12 입력·확대 | 844×390, 667×375, 568×320, 390×844, 360×640, 비대칭 safe-area/address-bar/resize | 기존 환경 관측만 있음; 요구 미검증 |
| CI03 skip/reduced/hide/failure | `defaults`, 기존 2D fallback/stop은 재사용 후보 | V03–V04 intro token, V06 lifecycle, V08 fallback | 단일 endpoint, skip→OPEN 중복 없음, 자동 소리 없음, 복구 | 미구현·미실행 |
| OPEN/CLOSE camera join, 상단 6-A | 현재 sceneId 즉시 교체 (`App.tsx:82`) | V03 coordinator, V04 동일 quaternion reframe | 커버+카메라 모두 완료 뒤 한 번 commit, 중간 프레임 jump 없음 | 미구현 |
| 사용자 확대 보존, 상단 6-B / AC02 | 기존 화면 레이아웃은 book fit과 별개 | V04 viewport 정책, V12 읽기/focus | 실제 200% browser zoom, pinch/keyboard에서 재축소 없이 조작 | 미실행 |
| BK02 커버 두께·책등 hinge | DurationScene3D는 시간 블록 renderer | V04 CoverRig/Spine/PageStack | closed와 open25/50/75/100% 실제 WebGL | 미구현 |
| BK03/BK12 양면 곡면·인쇄면 | 물리 leaf와 page mapping 없음 | V03 manifest, V05 TurningLeaf, V11 semantic surface | p=0/.25/.5/.75/1 wireframe/최종, 앞뒤 page ID·글자·normal·depth | 미구현 |
| BK13/BK14 직접 drag/hold/reverse/release | `DurationScene3D.tsx:121–136`는 클릭 선택, 8px 이동으로 취소 | V03 제스처 상태, V05 geometry, V08 owner | 실제 WebGL pointer sequence와 2초 hold, release 임계 전후 | 미구현·미실행 |
| BK15/BK16 준비 중 종료·lostcapture·multitouch | 기존 cancel은 pointerStart 해제 수준 | V03/V06 token, V08/V12 owner arbiter | 준비 중 즉시 up/cancel, 화면 밖, 두 포인터, scroll/pinch | 미구현 |
| EN01 책갈피·방향키·경계 / BK09 | `App.tsx:225`의 외부 이전/다음은 완료 조건에 묶임 | V03 인접 Spread 명령, V08 attached bookmarks | 44px 목표, 첫 이전=CLOSE, 마지막 다음 disabled, 동일 명령/결과 | 미구현 |
| EN02 입력 소유권·queue / BK08 | input/modal 경로는 있지만 book global hotkey 없음 | V03 pending1, V08/V12 focus 예외 | modifier/IME/repeat/modal/slider/input, 버튼+drag 중첩, 10회 교차 입력 | 미구현 |
| BK04/BK05 scene anchor·leave→turn→arrive | `durationWorld.ts:41`의 Group은 재사용 가능; page lifecycle 없음 | V06 SceneHost, V07 두 음악 scene | 장면 퇴장/페이지 가림/도착 후 enter, audio 즉시 stop | 미구현 |
| BK06/BK07/BK10 snapshot/revisit/cancel | `controller.ts:212,224`와 persistence 의미 복원 존재 | V03/V06 snapshot, V07 분할, V10 저장 | 분할2회→prev→next 동일 데이터, cancel 불변, 자동 소리 없음 | 기존 의미 baseline 통과; 책 통합 미검증 |
| scene/session 최대1, RC05 stale callback | `AudioEngine.ts:165,286` request/stop은 존재 | V03 bookEpoch/navigationToken, V06 lifecycle, V09 audio race | entry 중 next/exit 중 prev/hide/close/stale load, dispose 이후 변화 없음 | 기존 audio 안전성 baseline; 새 coordinator 미구현 |
| MU01–04 정확 분수·철자·분할 | `fraction.ts`, `music.ts`, `controller.ts:164` | 기존 모듈 유지, V07 adapter | 1/3×3=1, 최종16개 합1, 증2도/단3도 유지 | 기존 baseline 96개 중 관련 unit 통과; 통합 미검증 |
| MU05 첫 펼침면 실제 음악 | `lesson.ts:35,40,44,45` 데이터/오디오 있음; 한 active lane만 표시 | V07 두 레인/두 줄 악보/개별 듣기 | 각8/3초, onset0·2/3·4/3·2, 어택1/4, 동일 revision | 기존 의미 기반 존재; 실제 책/오디오 G1 미실행 |
| 분할/병합/undo/redo/DOM 선택 | `controller.ts:143,164,176`, `NotationView.tsx:191` | V07 page UI, V12 44px 접근성 | 선택만 분할, 동종 인접 병합, 최소1/16, 재방문 보존 | 기존 baseline 통과; 책 통합 미검증 |
| 정확한 기보와 texture/DOM 정합 / BK12 | VexFlow·로컬 font·SVG 있음, minWidth400 (`NotationView:101`) | V07 최소 surface, V11 same-revision 렌더 | 네 모서리/오선 baseline 1–2px, font/glyph, turn 중 inert, 거울/공중 글자 없음 | renderer 재사용 확인; book 정합 미구현 |
| AU01–03/06/07 실제 audio start/time/stop | 단일 context/request token/미래 source stop/논리 종료 있음 | V07 실제 경로, V09 경계 강화 | resume 대기 중 next, 예약 직후 stop, play20회, hide, 끝 쉼표 | unit baseline 통과; 이번 Edge audio 미실행 |
| AU04/AU05 실제 pause/resume | AudioEngine에는 pause/resume/seek API 없음 | G1 이후 V09 TransportAdapter | 음표 중간·경계·쉼표·끝 쉼표 offset 유지, 새 source, 단일 session | 미구현; UI에 pause라고 노출 금지 |
| V10/RC03 저장 원문 보호·이관 | strict v1 envelope (`progress.ts:158`), preview/commit 분리 | V10 version 분리·명시 scene→spread 매핑 | 백업 후 새 key, 손상/unknown version 정상 저장 보호, quota 실패 | 기존 저장 baseline 통과; v2 이관 미구현 |
| AX21/AC01–05 동등 읽기/조작 | 기존 DOM 목록·무음 설명·focus 경로 일부 존재 | V08 기본 경로, V11–V12 강화 | keyboard 전체 경로, 보조기술, 200%, portrait, reduced, 무음 구별 | 새 책 경로 미실행; 실제 보조기술/기기 미검증 |
| RC01/RC02 WebGL/font/texture 복구 | 기존 context loss→2D와 font retry 존재 | V06/V08 stable snapshot fallback, V15 복구 | turn/재생 중 context loss, 자산 실패, 명시 재시도, 무자동소리 | 기존 안전장치 확인; 책 통합 미실행 |
| RC04 자원 수명·성능 | lazy Three/DPR1.5/demand RAF/world dispose 존재 | V15 cache/ownership/frame 측정 | 50회 왕복을 5회 묶음으로 GPU/listener/timer/source, p95/기기 | 기존 실제 Edge 렌더만 확인; 부하·모바일 미검증 |
| MU06–08 및 펼침면3–6 | 기존 lesson scenes3–6와 평가 있음 | G1 및 V09–V12 이후 V13 이식 | 60/120=4초/2초, 비율4:1, rest onset, 현재 성공 해제 | 기존 의미 baseline; 책 이식 대기 |
| 교사/힌트/목차, BO01 | `App.tsx:195` 외부 교사 영역 | V14 book-local flap/pages | 정답 공개≠성공, focus 복귀, 외부 dashboard 없음 | 후속 단계 대기 |
| RG01/RG02 회귀 | 기존6 test files, 구형 UI E2E | 모든 구현 단계, V17 종합 | 음악 기대값 유지, 외부 nav/panel/transport 회귀 없음 | baseline 96/96; 새 구현 회귀 미실행 |
| 원본 REF01–10 / G1-C | v2 설계서 §3.3의 정적 번들 감사 기록 | V02/MOTION_REFERENCE, V16 비교 | 실제 영상/동일 입력/환경/오차 또는 미관측 | 원본 실동작 미검증; 수치 실측 승계 금지 |
| commit/push/CI/Vercel | 이 작업에서 실행 없음 | 전체 구현·검증·인수 완료 이후 | 정상 원격 commit SHA, CI, 기존 연동 자동 배포 확인 | 승인 범위 있음; 시점 미도달 |

## 단계별 문서 증거와 검증 공백

- V00 계약과 진행 기록은 작성·readback 완료했다. 이 V01에서 현재 source/line·package/lock·test 선언과 새 baseline 결과를 연결했다.
- 요구 출처는 최신 두 v2.1 문서를 우선한다. [REUSE_MAP.md](REUSE_MAP.md)의 v1 문서 설명은 v2의 감사 회고와 현재 소스를 구별한다. v1 원문 설계서 5/14/21/28절과 프롬프트 P00/P06/P10의 직접 대조는 원문 로컬 부재로 **미실행**이다.
- baseline 실행 로그는 `../../evidence/baseline/`다. 96/96는 이번 Windows의 실제 기존 코드 결과다. 클라우드의 200/29 기록은 새 통과로 쓰지 않는다.
- 실제 Edge 관측은 기존 block WebGL 환경 확인이다. G1의 cover/curved leaf/pointer/audio 시퀀스는 아직 없다. 음소거 영상·CPU mock·정지 fixture를 제품 동작 근거로 사용하지 않는다.
- G1-A/B 필수 실패 또는 미실행은 확장 차단이다. 원본 체감 비교 C, 실제 휴대전화 가로 터치, 실제 청취, 음악 교육자와 보조기술 검수는 서로 독립한 상태로 기록한다. 선택적인 디자인 승인 질문을 기본 잠금으로 추가하지 않는다.

V01 이후에는 V02의 관측·잠정 시각 명세를 준비한다. 아직 없는 구현·테스트·캡처 경로를 실제 산출물처럼 링크하지 않는다. 다음 단계가 생성한 증거를 이 표의 해당 행에 연결하고 이전 실패 기록은 보존한다.
