# Music_Rudiment_3D v2.1 구현 계약

작성: 2026-10-27 UTC · 단계: V00 · 상태: 계약 확정, 제품 구현 미완료

## 기준 문서와 출처

| 원본 | 이번 작업의 읽기 가능한 사본 | 검증 |
|---|---|---|
| [상세 설계서 v2.1](https://drive.google.com/file/d/1XUhB4FisvfdMizll3FcpcC1WMqrMDoWJ/view) | `../../reference-documents/design-v2.1.md` | UTF-8, 101616 bytes, 775행, SHA-256 `fc1d89110b17505f3596de17818c285d25f0d0b4f7eee59b50cae86427e670a8` |
| [바이브코딩 프롬프트 v2.1](https://drive.google.com/file/d/1lU0z17FW6xmd6oBzdai6opePeTeSpouf/view) | `../../reference-documents/prompt-v2.1.md` | UTF-8, 89435 bytes, 864행, SHA-256 `9718a45725d94d60e90c77a25685c450523ee1034bf06dac726effc0bf2166f3` |

두 파일은 부모 작업이 승인한 Google Drive 원본 전달 경로로 확보했다. 상대 경로는 이번 Windows 작업공간에 대한 로컬 참조이며 저장소 배포 자산이 아니다. Library 문서 ID는 각각 `libfile_2c5a181971e4819187101e1b2ddc9e8b`, `libfile_6b85d1f2219c819185170364690e1394`다. Windows Library helper의 `os.setxattr` 미지원 오류와 지원 재시도 실패는 별도 이력이며, 이 사본을 Library materialization 성공이라고 기록하지 않는다. 해당 오류를 해결하려고 helper나 메타데이터를 변조하지 않았다.

최신 설계서 전체와 동반 프롬프트는 작업팀에서 끝까지 읽었고, 이번 V00에서는 로컬 사본의 v2.1 고정 계약과 V00/V01 실행 계약을 다시 확인했다. 예전 v2 프롬프트를 실행 기준으로 사용하지 않는다. 기존 v1 원본 문서는 이번 checkout에 없으므로 직접 원문 대조 완료를 주장하지 않는다.

## 보존과 승인 범위

- 시작 저장소: `https://github.com/kimyounggaur/Music_Rudiment_3D`, `main`, HEAD `4dd62db8dc46ca6468bffeeb586c1d295a38a793`. 문서 작성 전 `git status --short`와 `git diff --stat`는 비어 있었고 제공된 감사 기준과 동일했다.
- 제한된 로컬 탐색에서 기존 v2.1 checkout이나 명확히 연관된 checkpoint를 찾지 못했다. 부모도 전송 가능한 클라우드 사본을 확보하지 못했다고 보고하여 새 지속 작업공간에서의 재구현을 승인했다. 이는 전체 PC 검색이나 영구 유실 판정이 아니다.
- 기존 사용자 변경, v1 문서, 기존 음악 코드와 검증을 보존한다. 파괴적 reset, 강제 push, 무관한 전면 재작성, 사용자 파일 삭제는 하지 않는다. 저장소 `AGENTS.md`/`.agents`는 없었고, 제공되지 않은 개인 기억 경로를 추측하여 검색하지 않았다.
- 사용자 지시는 전체 구현과 검증이 끝난 뒤 정상 commit/push 및 기존 연동 Vercel 배포 확인까지 승인한다. **전체 완료 전 commit/push/배포 금지**를 유지한다. 새 서버·유료 기능·분석 추적·학생 녹음·권한 확대·비밀정보 노출·접근 제한 우회는 범위 밖이다.
- 반복적인 선택적 디자인 승인 질문을 개발 게이트로 추가하지 않는다. 객관적 증거로 단계별 판정한다. 실제로 확보하지 못한 청취·휴대전화·교육자·원본 관측 증거는 미검증으로 남긴다.

충돌은 새 사용자 지시 → v2.1 추가 고정 계약 → v2 책 경험 계약 → 보존할 v1 음악 의미 순서로 해결하고 이유를 기록한다. 구형 문서의 패널 셸, 외부 UI 점유 예외, 3D 후순위, 임의 가로 표지 비율은 채택하지 않는다.

## 제품과 첫 구현 범위

목표는 처음부터 보이는 닫힌 책을 열고 실제 곡면 종이를 직접 넘길 때 페이지에 속한 3D 음악 장면이 등장하는 가로 우선 웹 교재다. 손 모델 추가는 요구가 아니다. 지원 WebGL의 기본 경로는 3D 책이며, 동등한 ReadingView2D와 reduced motion도 제공한다.

G1 이전 범위는 실제 표지와 다음 두 펼침면으로 제한한다.

1. `spread-duration-01`: C4 온음표 하나와 C4 4분음표 네 개. 4/4, 4분음표=90, 두 레인 길이 각각 8/3초, 아래 onset 0·2/3·4/3·2초, 어택 1회 대 4회. 정확한 두 줄 악보와 개별 재생을 제공하고 동시 재생은 막는다. 같은 높이·깊이·음높이·음량 설정을 유지한다.
2. `spread-duration-02`: 선택 블록만 절반 분할, 최저 1/16, 끝까지 16개·합 1. 인접한 동종·동길이·동음높이 병합, undo/redo, 44px DOM 선택 대체, 이전/다음 재방문 데이터 보존을 제공한다.

두 펼침면은 자리표시자가 아닌 기존 의미 데이터·VexFlow·합성음으로 동작해야 한다. 탐색은 과제 성공·청취 완료를 강제하지 않는다. G1-A/B 객관적 통과 전 장면 3–6, 교사 기능 또는 배포로 확장하지 않는다.

## 화면·표지·카메라 고정 계약

- BOOK-ONLY: intro/open/learn/turn/cancel/settle/back/close 모든 정상 상태에서 책과 그에 속한 내용만 보인다. 외부 navigation, sidebar, HUD, toolbar, 고정 재생바, dashboard, toast는 0개다. 배경은 중립 단색과 접촉 그림자다. 보이는 설정·목차·읽기·교사 도구는 책 안 페이지/플랩에 귀속한다.
- 실제 [제공 표지](https://drive.google.com/file/d/1IJhuTm6mP05iyDQFikpdVMUhRg5FI2v2/view)의 승인된 변환 사본만 앞표지 texture에 사용한다. 원본 AI는 보존하며 실제 픽셀 확인과 변환 파일의 완전한 decode를 선행한다. 원화의 제목·로고·삽화·테두리를 자르거나 다시 쓰지 않는다.
- front-face 비율은 595.276:841.89다. Cw=3일 때 Ch≈4.243이며 페이지 치수는 표지 치수에서 여백을 빼서 파생한다. 별도 원화가 없는 책등/뒤표지는 중립 단색이며 앞표지를 복제하지 않는다.
- 첫 paint부터 정적 닫힌 책 또는 승인된 preview가 보인다. 카메라가 900–1400ms 초기 제안의 실제 위치/target 보간으로 표지에 안착하며 책이 날아들거나 자동으로 열리지 않는다. 표지 UV(0.5,0.5)의 투영 좌표와 실제 visual viewport 중심의 거리 ≤2 CSS px를 수치로 검증한다.
- safe-area+12px 내부에 두께·책등·뒷표지·종이·책갈피까지 포함한 bounds를 fit하되 목표 중심을 safe-area 중심으로 옮기지 않는다. NDC/near/far clipping도 확인한다.
- `bootLoading → introReady → introMoving → coverIdle → opening → spreadIdle`와 별도 CameraState를 사용한다. OPEN은 coverIdle+camera.settled+firstSpreadReady+intro 입력 소비 완료일 때 한 번만 수락한다.
- coverIdle과 spreadIdle의 camera quaternion은 같다. OPEN/CLOSE에서는 위치·거리·target의 단일 reframe과 커버 hinge 완료를 join한 뒤만 commit/sceneEnter한다. 페이지 drag/turn 중 카메라 회전은 없다.
- skip/표지 탭/Escape는 intro endpoint에만 안착하고 같은 입력으로 OPEN까지 실행하지 않는다. reduced motion은 즉시 endpoint다. hide 후 복귀는 endpoint와 정지 상태다.
- resize/orientation/address-bar 변화는 재측정하고 현재 pose에서 이어간다. drag 중 회전은 cancel한다. 사용자 200% 확대·pinch·입력 키보드 focus를 자동 fit으로 상쇄하지 않는다. 가로 강제, CSS 90도 회전, 강제 fullscreen/orientation lock, 전역 touch-action:none은 금지한다.

## 종이·입력·장면 소유권

- Book/Spread/Scene/PaperLeaf ID는 별개다. forward leaf front=R(i), back=L(i+1), 아래 static=R(i+1); backward는 정확한 역매핑이다. 표지/마지막 경계를 manifest에 명시한다.
- 표지는 두꺼운 rigid hinge mesh, 종이는 실제 곡면 분할 mesh다. 약 24×4 분할에서 시작하고 p=0/.25/.5/.75/1의 양면 UV·normal·bounds·edge·그림자·depth occlusion을 검증한다. rigid 카드 flip, 거울 글자, 동일 양면 그림, depthTest=false로 관통 은폐를 허용하지 않는다.
- pointerdown에서 button/modal → scene control → page corner → 빈 면 순으로 owner를 정하고 종료까지 바꾸지 않는다. 모서리 grab 좌표를 leaf-local에 고정하고 pointer를 drag plane에 투영한다. hold/reverse에 따라 동일 종이의 pose가 즉시 연속 변하며 시간 easing을 덧씌우지 않는다.
- 드래그 수락 시 snapshot과 audio stop을 먼저 수행한다. 낮은 p에 scene exit를 scrub 연결하여 고정 exit 시간 때문에 손 추적이 늦지 않게 한다. release 거리/속도로 commit 또는 cancel을 한 번 결정한다. cancel은 동일 경로 복귀이며 데이터와 쪽수는 불변, 소리는 정지다.
- preparingTurn에서도 pointerup/cancel/lost capture/두 번째 pointer/회전/unmount를 처리한다. gestureId·최신 샘플·pointerActive·releaseDecision을 보존하여 늦은 준비 callback이 유령 drag를 시작하지 못하게 한다. pinch 확대와 세로 scroll의 대체 경로를 보존한다.
- 좌우 끝 책갈피는 책 투영을 따라가는 44×44 CSS px 조작이다. 버튼과 ArrowLeft/Right는 같은 인접 Spread 명령이다. 첫 이전은 표지로, 마지막 다음은 aria-disabled, 닫힌 표지에서는 숨긴다. 별도 모서리 grab 영역을 남긴다.
- input/textarea/select/contenteditable/slider/listbox/combobox/악기 keyboard/modal owner, IME, modifier, repeat, defaultPrevented는 전역 방향키에서 제외한다. 소비한 이벤트만 preventDefault하며 synthetic click 중복을 방지한다.
- currentSpread는 도착 확정 후 한 번 commit한다. destination/progress는 별도다. pendingIntent 최대 1개·마지막 유효 입력 우선, 완료 후 경계 재평가다. close/hide/fallback이 일반 queue보다 우선한다.
- BookMotion/SceneEntrance/MusicTransport 시계를 분리한다. 활성 학습 scene과 audio session은 각각 최대 1개다. bookEpoch/navigationToken/sceneInstanceId/AbortSignal로 stale callback을 무효화하며 timeout은 성공이 아니다.
- lifecycle load/enter/ready/exit/dispose를 분리하고 loading/entering 도중에도 취소·해제한다. dispose는 멱등적이며 listener/timer/RAF/pointer/audio/GPU 자원과 공유 ownership을 정리한다.

## 음악·표현·저장·접근성

- 정확한 분수, 음악 validation, lesson 의미 명령·undo/redo, VexFlow, 안전한 audio stop, 저장 원문 보호를 재사용한다. 동일 validated revision에서 악보·3D·소리·평가를 만든다. 화면 좌표 또는 MIDI 차이만으로 정답을 계산하지 않는다.
- 안정 페이지는 page-local DOM/SVG, 턴은 같은 revision의 인쇄 texture다. 네 모서리 투영 정합을 계산하고 전이 중 DOM은 숨김·inert 처리한다. 도착 후 동일 위치에 복귀하며 초기 정합 목표는 1–2px다. 숨은 페이지는 focus/읽기 순서에서도 제외한다.
- 앱 수준 단일 AudioContext를 사용한다. 표지/entry/turn은 자동 소리를 내지 않는다. stop/exit/close/hide/fallback에서 미래 예약 source까지 stop하고 stale resume를 차단한다. 자연 종료는 끝 쉼표를 포함한 논리 길이로 판단한다.
- G1에서 pause가 없으면 재생/정지만 정직하게 제공한다. 전체 확장 전 V09에서 실제 logicalOffset pause/resume를 구현한다. 파형이나 기술 실행을 실제 청취라고 부르지 않는다.
- 마지막 안정 spread와 검증된 draft/답안/힌트/현재·과거 성취/설정만 저장한다. 전이 p·재생 중 상태·GPU/AudioNode/promise는 저장하지 않는다. v1→v2 이관은 원본 백업·검증 후 새 key에 쓰며 손상 데이터를 정상 저장에 덮어쓰지 않는다.
- 2D/세로/무음/reduced motion/200%에서도 같은 의미 명령과 학습 데이터를 사용한다. WebGL loss는 소리 정지 후 마지막 committed snapshot의 ReadingView2D로 복구한다. 44px 조작, 책 안 focus, 키보드·스크린리더 경로와 읽기 확대를 유지한다.
- 현재 잠금 버전의 React+순수 Three.js를 출발점으로 한다. R3F/GSAP/XState 도입은 공식 호환성·이득·이관 비용 ADR 이후에만 검토한다. 한 Canvas/context, demand rendering, 제한된 인접 texture cache와 명시적인 자원 해제를 유지한다.
- Every Joule는 독립 구현의 관측 대상이다. 코드·브랜드·문장·모델·texture·font·음원을 권리 확인 없이 복제하지 않는다. 정적 코드 확인값·실측값·v2 제안값을 분리한다.

## 공통 필수 게이트

모든 단계는 아래 계약에 연결되며 해당 항목을 미구현/미실행 상태에서 통과로 올리지 않는다. V03은 순수 guard·mapping 증거, V04–V08은 실제 화면·입력 증거, V09 이후는 회귀 증거를 누적한다.

| ID | 실제 통과 기준 | 주요 검증 단계 |
|---|---|---|
| CI01 | intro 0/25/50/75/100%, 모든 본체 safe bounds, cover UV중심 오차≤2px | V03–V04, V08, G1, V15–V17 |
| CI02 | 844×390/667×375/568×320/390×844/360×640, notch/resize/address-bar, 무왜곡·무crop | V04–V05, V08, V12, V15–V17 |
| CI03 | skip/reduced motion/hide/load failure, 단일 endpoint, OPEN 중복·자동 소리 없음 | V03–V04, V06, V08, V12, V17 |
| BO01 | open/learn/turn/cancel/settle/back/close 전 상태 외부 UI 0개 | V02–V08, V11–V17 |
| EN01 | 양쪽 책갈피와 방향키가 동일 인접 Spread 이동·경계 처리 | V03, V08, V12, V17 |
| EN02 | 입력·slider·modal·hold·연타·drag 중첩에서 도난/중복/무한 queue 없음 | V03, V06, V08, V12, V17 |
| AX21 | keyboard/screen reader/200%/2D/reduced motion, 보이는 책 안 focus와 읽기 | V08, V11–V12, V17 |

G1-A는 실제 작동하는 WebGL에서 grab/hold/reverse/release/cancel과 실제 Web Audio 시작·시간·정지 증거를 요구한다. G1-B는 사용자 요구와 원본에서 확인된 구조의 추적표다. A/B 모두 통과하기 전 V09 이후로 확장하지 않는다. G1-C 원본 체감 유사도는 실제 원본 관측이 없으면 미검증이다. 화면 녹화·중간 캡처·좌표 JSON·시각별 상태/scene/session 로그에 baseline SHA, uncommitted diff 상태, URL, 브라우저, viewport/DPR, 입력 방식, 날짜를 연결한다.

96개 baseline 테스트 또는 이전 클라우드의 200개 테스트/CPU mock 29개는 G1을 대신하지 않는다. 마우스·자동 주입·휴대전화 터치·viewport emulation을 구분한다. 실제 청취·실제 휴대전화 가로 터치·교육자 검수는 최종 수업 시험 준비의 별도 필수 검수다. 실제 수행하지 않았다면 완료로 적지 않는다.

## 순차 진행과 현재 상태

V00 → V01 → V02 → V03 → V04 → V05 → V06 → V07 → V08 → G1-A/B → V09–V12 → V13 → V14–V18 순으로 진행한다. 현 단계의 실패를 다음 단계나 문서 문구로 덮지 않는다. 전체 완료 후에만 정상 commit/push, 원격 SHA/CI 및 기존 Vercel 자동 배포 연결·배포 결과를 확인한다.

V00 산출물은 이 계약과 [BUILD_STATUS_V2.md](BUILD_STATUS_V2.md)다. 제품 구현, G1, 실제 청취, 휴대전화 검수, commit/push/배포 완료를 뜻하지 않는다.
