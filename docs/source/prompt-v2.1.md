# 3D 음악이론 책 경험 중심 바이브코딩 프롬프트 v2.1

작성일 2026년 10월 27일  
버전 2.1  
기준 문서 3D음악이론_책경험중심_상세설계서_v2.1.md  
대상 기존 Music_Rudiment_3D를 책 중심 웹 교재로 재구축하는 구현 에이전트  
용도 다음 구현 작업에서 단계별로 복사해 사용하는 실행 계약

## v2.1 추가 고정 계약 — 화면에는 언제나 책만

2026-10-27 추가 사용자 요구를 반영한다. 이 개정은 문서 변경이며 앱 구현·배포 완료가 아니다. v2.0 원본은 변경하지 않는다.

- **BOOK-ONLY:** 최초 진입뿐 아니라 표지 안착, 열기, 학습, 페이지 넘김, 안착, 이전 쪽 복귀, 닫기까지 정상 앱 화면에는 책과 그 책에 속한 내용만 보인다. 책 바깥 navigation, sidebar, HUD, floating toolbar, 고정/상시 재생바, 대시보드, 토스트를 만들지 않는다. 외부 UI 점유 15% 같은 예외도 없다.
- “책만”은 악보·교육 문장·문항·3D 장면을 없애라는 뜻이 아니다. 모두 종이 면·플랩·책 안 조작에 귀속한다. 배경은 무늬 없는 중립색과 책의 접촉 그림자만 허용하며 책상 소품·장식 모델은 없다.
- **COVER-INTRO:** 접속 시 닫힌 책을 이미 화면 안에 보여 주고, 카메라가 짧게 이동해 표지 중앙을 실제 앱 viewport 중앙에 안착시킨다. 책이 바깥에서 날아들거나 자동으로 펼쳐지는 연출이 아니다. 이후 사용자가 표지를 터치/키보드로 열고 페이지 모서리를 직접 드래그한다.
- **EDGE-NAV:** 열린 책의 왼쪽 바깥 끝에는 이전, 오른쪽 바깥 끝에는 다음 **책에 부착된 책갈피 모양 버튼**을 둔다. 터치·클릭과 ArrowLeft/ArrowRight는 동일 페이지 넘김 명령을 실행한다. 직접 모서리 드래그도 그대로 필수다.
- 모든 보조 기능은 책 안 목차 페이지·플랩·책 안 설정 페이지로 연다. 시각 외부 패널을 접근성 핑계로 추가하지 않는다. DOM 시맨틱, 스크린리더 대체 텍스트, 키보드 조작, 페이지 위 focus 표시는 유지한다. 브라우저 주소창·OS 키보드·브라우저 권한창은 앱이 숨길 수 있는 UI가 아니며 강제 전체화면/권한 우회로 숨기지 않는다.

### 제공된 실제 표지 자산 확인

[사용자 제공 표지](https://drive.google.com/file/d/1IJhuTm6mP05iyDQFikpdVMUhRg5FI2v2/view)는 `음악이론 교과서_표지(크몽) 01.ai`, 11,076,323 bytes, 수정시각 `2026-10-27T03:58:22.147Z`, 부모 `14m-1MK1CgMovBx0ssWSm35CZQRmQ6Fns`다. Drive MIME은 application/postscript이나 실제 원본 바이트는 PDF 1.5 호환 Illustrator 파일이며 A4 세로 595.276×841.89pt, 1페이지다. 실제 렌더에서 ‘한국생활음악강사협회 / 아주 쉽게 배우는 음악이론 교과서’와 청색 계열 악보·책·악기 삽화를 확인했다. 이 파일은 설계서가 아니라 표지 원화다. 이것만으로 3D 모델·페이지 애니메이션이 제공됐다고 하지 않는다.

원본 AI는 보존한다. 구현에서는 승인된 변환 사본을 앞표지 texture로 사용하고 제목·로고·삽화·테두리를 자르거나 재작성하지 않는다. A4 세로 종횡비를 유지하고 **앞표지 front-face 자체**의 폭:높이를 595.276:841.89로 맞춘다. 종이와 앞표지에 같은 치수를 준 뒤 임의 여백을 더하는 방식은 금지한다. 앞표지 치수에서 종이 여백을 빼 페이지 치수를 파생한다. 가로 웹앱이라는 이유로 표지를 가로로 늘리지 않는다. 기존 W=3,H=3.4 제안보다 이 표지 비율을 우선한다. 뒤표지/책등의 별도 원화는 확인하지 못했으므로 앞표지를 복제하거나 임의 문구를 지어 넣지 않는다. 원화가 없는 면은 중립 단색으로 설계하고 미제공 상태를 기록한다. PDF 미리보기는 편집가능 AI 레이어·폰트·권리 전체를 검증한 증거가 아니다.

### 진입 카메라와 중앙 정합 계약

1. `bootLoading → introReady → introMoving → coverIdle → opening → spreadIdle`로 구분한다. 기존 `closed`는 `coverIdle`의 책 상태 명칭으로 호환한다. 카메라는 별도 `loading/intro/settled/reframing/suspended` 상태다. `coverIdle + camera.settled + firstSpreadReady`에서만 OPEN을 한 번 수락한다. 표지 렌더 이전 검은 빈 화면 대신 Three 지연 import나 11MB 원본 AI 로딩에 선행하는 정적 HTML/CSS 닫힌 책 silhouette 또는 허가된 소형 preview를 첫 paint에 그리며 로딩 상태는 표지 안에만 둔다.
2. 정면에 가까운 읽기 가능한 표지 구도로 약 900–1400ms의 단조 ease-in-out 카메라 위치·target 보간을 초기 제안한다. 이 시간은 원본 실측이 아니다. 일반 모션에서는 시작 pose와 endpoint 사이에 가시적인 카메라 위치·각도 또는 투영 크기 차이를 두고 0/50/100% 연속 영상으로 실제 이동을 증명한다. 동일 pose를 시간만 기다리는 구현은 실패다. reduced-motion/skip은 의도적 예외다. 책 자체를 자동 회전하지 않고 표지 제목을 끝까지 읽을 수 있게 한다. 도입 카메라 연출은 첫 진입 전용이며 OPEN/CLOSE 재구도는 6-A를 따른다. 페이지 드래그/넘김 도중 카메라를 돌리지 않는다.
3. **중앙의 정의:** CSS pixel 단위 앱 visual viewport의 크기를 Wv,Hv라 하면 목표 T=(Wv/2,Hv/2)다. 캔버스 client rect와 visualViewport offset을 같은 좌표계로 변환한다. 표지 front-face UV (0.5,0.5)를 월드행렬→view→projection으로 투영한 C를 사용한다. 책등 원점·BookRoot 원점·전체 펼침면 중심으로 대체하지 않는다. 원근 사각형 꼭짓점 평균도 표지 UV중심 투영과 같다고 가정하지 않는다. 중앙 오차 ||C−T||≤2 CSS px를 안착 수용 기준으로 한다.
4. safe-area inset과 추가 12px 여백으로 안전 사각형을 만든다. **safe-area 중앙으로 목표를 슬쩍 이동하지 않는다.** 실제 화면 중앙 T를 유지한 상태에서 책 전체가 안전 사각형에 들어가도록 카메라 거리를 증가시키거나 FOV를 확대하거나 모델의 균일 scale을 감소시키고 near/far를 재계산한다. 비대칭 노치에서도 이 기준을 유지한다. 표지 네 꼭짓점뿐 아니라 두께·책등·뒷표지·종이묶음·책갈피 bounds를 검사한다. NDC와 near/far clipping도 검사한다. 배경 그림자는 필수 본체 bounds에 포함하지 않아도 된다.
5. 844×390, 667×375, 568×320, 390×844, 360×640 및 비대칭 safe-area에서 intro 전 구간과 최종 상태를 검증한다. portrait에서 cover를 가로로 변형하거나 CSS 90도 회전시키지 않는다. 가로 우선이지만 세로 접근을 막지 않는다. 확대/가독성에 따라 열린 교재는 페이지 안 읽기/스크롤 경로를 제공한다.
6. resize·orientation·주소창 변화는 ResizeObserver와 visual viewport 변화로 재측정한다. 현재 pose에서 새 endpoint로 재보간하며 intro를 처음부터 재시작하지 않는다. 터치 드래그 중 회전은 기존 TURN_CANCEL 정책으로 안정 페이지를 복원한 후 재구도한다. intro 완료 후 열린 책에는 펼침면과 턴 최고점 전체 bounds를 사용한다. 단순히 닫힌 앞표지 중심을 모든 열린 상태에도 강제하지 않는다.
6-A. **표지↔학습 카메라 연결:** 최초 버전은 coverIdle과 spreadIdle의 카메라 방향/quaternion을 동일하게 선택한다(학습 사선 후보 중 표지 글자도 읽히는 각도). intro 출발 pose만 다를 수 있다. OPEN 수락 후 `opening + camera.reframing`에서 커버 힌지와 함께 카메라 위치·거리·target을 제어된 단일 전이로 보간해 펼침면 중심/bounds에 맞춘다. quaternion 회전은 하지 않는다. 사용자가 페이지를 드래그할 때 자동 재구도하는 것과 구분한다. 커버와 카메라가 모두 settled된 뒤만 sceneEnter/학습 입력을 활성화한다. CLOSE는 sceneExit→cover closing+동일 방향 reframe→앞표지 UV중앙 재정합 순서이며 두 완료 후 coverIdle로 commit한다. 완전히 다른 학습 각도가 필요하면 별도 설계 변경으로 다루고 순간 카메라 점프를 허용하지 않는다.
6-B. **확대는 재구도와 별개다:** visualViewport.scale이 사용자 pinch/브라우저 확대를 나타내면 자동 fit·재중앙화를 중지하여 200% 확대를 카메라 축소로 상쇄하지 않는다. 확대 이전 stage layout을 유지하고 브라우저 pan/scroll 및 책 안 읽기 대체를 허용한다. 확대 해제 뒤 안정 viewport에서만 fit을 다시 한다. orientation·주소창만 바뀐 경우와 scale 변화를 구분해 로그한다. visualViewport.scale 하나로 데스크톱 브라우저 page zoom까지 모두 탐지할 수 있다고 가정하지 않는다. 확대 정책은 DPR·layout viewport 변화도 참고하되 불확실한 경우 재축소보다 사용자 확대 보존을 우선하고 실제 브라우저 200% 검수로 확인한다. 텍스트 입력 소프트키보드가 나타나면 focus와 커서를 유지하며 책 전체를 무조건 축소하지 않는다. 필요한 최소 scroll/읽기 영역 이동으로 입력을 드러내고 키보드가 닫힌 뒤 안정 재구도한다. 접근성 확대 상태에서는 전체 책 동시 가시성보다 확대·읽기 가능성이 우선이며 CI02의 무crop과 CI01 중앙 정합은 사용자 pinch/pan·키보드 focus 작업이 없는 자동 연출/비확대 기본 구도에서 평가한다. 사용자 조작을 취소해 억지로 중앙 오차를 맞추지 않는다.
7. 표지 안 작은 ‘바로 보기’ 영역과 Escape로 intro를 건너뛰면 동일 endpoint로 즉시 안착한다. 이는 책을 자동으로 여는 명령이 아니다. 임의 표지 탭은 intro 중 skip으로만 소비하고 같은 pointerup이 OPEN으로 중복 전달되지 않게 한다. 다음 명시 입력에서 연다. reduced-motion은 처음부터 endpoint로 렌더하며 자동 pan/zoom은 없다. Tab focus·스크린리더 이름은 표지 안 위치와 연결한다.
8. visibility hide에서는 intro clock을 중지하고 복귀 시 endpoint에 안착시킨다. 로딩 실패는 책 안 재시도/정적 2D 표지 경로로 보이고 오류를 완료로 처리하지 않는다. PDF/AI가 브라우저에서 직접 texture가 된다고 가정하지 않는다. 변환 산출물 불가 시 원화 미적용 상태로 남기며 다른 표지를 원본이라고 표시하지 않는다. WebGL 실패는 동일 표지 비율의 2D 책을 제공한다. 정상 상태에서 외부 오류 패널을 계속 남기지 않는다.

### 책갈피 이전/다음과 입력 충돌 계약

- ‘페이지 넘김’ 명령 한 번은 왼쪽·오른쪽 한 쌍인 **인접 Spread 이동**이다. 물리 PaperLeaf가 넘어가고 앞뒤 인쇄면이 바뀌며, 양쪽 버튼이 각각 별도의 반쪽 페이지를 교체하는 방식이 아니다.
- 좌우 책갈피는 책 가장자리에 붙고 책 변형·투영을 따라 움직인다. 화면 가장자리에 fixed로 고정하지 않는다. 시각형은 작게 하되 최소 44×44 CSS px 목표영역을 확보하고 safe-area 안에 둔다. 다른 페이지/장면에 가려진 버튼은 hit-test와 tabindex에서도 비활성화한다. 눌림·focus 표현도 책 안/책에 부착된 범위에 머문다.
- accessible name은 ‘이전 펼침면’, ‘다음 펼침면’, 첫 펼침면의 이전은 ‘표지로’다. 첫 펼침면에서 이전은 CLOSE_BOOK, 마지막 펼침면의 다음은 aria-disabled이며 빈 페이지로 가지 않는다. 닫힌 표지에서 책갈피는 숨긴다. 표지 열기는 표지 자체 버튼/Enter/Space로 한다.
- button pointerdown은 책갈피가 제스처 소유권을 가져 모서리 curl을 시작하지 않는다. 인접 drag hit zone과 겹치면 버튼 우선이고 단일 입력에 한 번의 명령만 발생한다. 페이지 본문/악기 조작은 기존 gesture owner 분기를 지킨다. 책갈피와 별개의 모서리 grab 영역을 예약해 버튼 hit-zone이 모든 드래그 시작 영역을 덮지 않도록 한다. 44px 목표를 확보할 수 없는 작은 화면에서는 책 안 조작 배치를 재조정하며 직접 드래그를 삭제하지 않는다.
- ArrowLeft/Right는 책 읽기 컨텍스트에서만 PREV/NEXT로 처리한다. 목차/설정 플랩 등 modal owner가 활성화되고 배경이 inert이면, focus가 단순 닫기 버튼이더라도 전역 페이지 hotkey를 중지한다. 해당 플랩의 명시적 탐색 명령만 허용하고 닫은 뒤 책 컨텍스트를 복원한다. input/textarea/select/contenteditable, slider, listbox, combobox, 악기 키보드 등 자체 방향키가 필요한 조작에 focus가 있으면 가로채지 않는다. Ctrl/Alt/Meta 조합, IME 조합 중, 이미 defaultPrevented인 이벤트도 무시한다. 브라우저 뒤로가기 단축키를 바꾸지 않는다. 소비한 이벤트만 preventDefault한다. key repeat는 무시해 길게 누름이 연속 넘김으로 쌓이지 않게 한다.
- 전환 중 실제 새 터치/keydown은 기존 최대1개 pendingIntent 정책에 통합한다. 방향 반전도 현재 전이를 완료한 뒤 마지막 유효1개만 평가한다. 버튼 disabled 스타일을 적용할 경우 이벤트도 차단하며 큐를 받는 상태와 혼용하지 않는다. 표지/마지막 경계 guard를 commit 후 다시 평가한다. 모션 줄이기·2D에도 동일 의미를 유지한다.

### v2.1 추가 필수 증거와 완료 조건

| ID | 검증 | 통과 기준 |
|---|---|---|
| CI01 | 진입 0/25/50/75/100% 및 coverIdle | 책만 표시, 본체 모든 bounds 안전영역 내, 최종 표지 UV중앙 오차≤2 CSS px |
| CI02 | portrait/landscape/노치/주소창/resize | 실제 viewport 중앙 유지, 비율 왜곡·표지 crop·페이지 턴 잘림 없음 |
| CI03 | skip/reduced motion/탭숨김/로딩실패 | 단일 endpoint, OPEN 중복 없음, 자동 소리 없음, 정상 복구 |
| BO01 | opening/학습/turn/cancel/settle/back/close 영상 | 모든 상태에 외부 UI 0개, 책 내용은 유지 |
| EN01 | 좌우 책갈피 터치 및 ArrowLeft/Right | 같은 이동 명령/결과, 실제 넘김, 경계 정확 |
| EN02 | slider/input focus·modal 닫기버튼 focus·연타·hold·버튼/drag 중첩 | 방향키 도난/중복이동/무한큐/숨은 버튼 클릭 없음 |
| AX21 | keyboard/스크린리더/200%/2D/reduced motion | 조작 가능, focus는 보이는 책 안 목표에 귀속, 외부 패널 없이 읽기 가능 |

좌표 검사는 자동화 수치 JSON, 상태별 screenshot, 연속 녹화를 함께 남긴다. DOM selector가 없다는 검사만으로 외부 UI가 없다고 증명하지 않는다. Canvas로 그린 외부 HUD도 영상 검수한다. 앱 뷰포트와 브라우저 chrome을 구분해 기록한다. 문서 작성 시점에 위 테스트가 실행됐다고 주장하지 않는다.


## 1 이 프롬프트의 목적과 사용법

**탭형 음악 학습 앱을 예쁘게 꾸미는 작업이 아니다. 닫힌 책 표지를 열고, 종이를 넘기며, 해당 페이지의 3D 음악 장면이 등장하고 퇴장하는 경험을 다시 만드는 작업이다.** 기존 음악 의미·기보·오디오·저장·테스트는 가능한 한 보존한다. 손가락 또는 마우스로 모서리를 잡아 끌고 멈추고 되돌리는 직접 조작이 필수이며, 실제 손 모형 표시는 요구되지 않았다.

v1 설계서와 프롬프트는 원본으로 보관한다. 이번 v2를 코드 구현에 사용할 때는 v2의 책 경험 계약을 우선하고 v1의 음악 규칙·자산 권리·평가 원칙을 계승한다. v1의 패널형 셸과 “2D UI 완성 후 마지막으로 3D 추가” 순서는 적용하지 않는다.

이 파일을 작성했다는 것은 코드 변경이나 배포를 실행했다는 뜻이 아니다. 아래 명령은 후속 구현 범위가 허용되었을 때 사용한다. 현재 문서 작성 요청만으로 저장소 push·외부 배포·권한 변경·사용자 PC 설정 변경을 시작하지 않는다.

### 1.1 실행 순서

1. 기준 설계서 v2와 이 파일을 함께 제공한다. 구현 에이전트는 실제 파일을 읽고 누락된 입력을 추정하지 않는다.
2. 새 작업마다 V00을 먼저 적용한다. 이후 한 단계의 프롬프트만 실행한다.
3. V01–V08로 표지와 실제 음악이 있는 두 펼침면만 만든다.
4. G1에서 실제 시제품의 책 동작과 직접 드래그를 객관적으로 판정하고 원본의 확인된 구조와 대조한다. 원본 실동작을 볼 수 없으면 체감 유사도는 별도 미검증이다. 선택적인 사용자 디자인 승인을 반복 요구하지 않는다.
5. G1의 객관적 A/B 게이트 통과 후, 이미 허용된 구현 범위 안에서 V09–V12로 runtime 계약을 강화한다. 그다음 V13에서 나머지 네 펼침면을 확장한다.
6. V14–V18로 보조 도구·성능·시각 비교·음악 검수·인수를 완성한다. 배포는 별도 사용자 요청을 따른다.
7. 실패하면 각 단계의 수정 프롬프트로 원인을 해결한다. 다음 단계나 문서 문구를 바꿔 실패를 감추지 않는다.

### 1.2 현재 확인된 출발점

감사 기준은 [고정 커밋 4dd62db8dc46ca6468bffeeb586c1d295a38a793](https://github.com/kimyounggaur/Music_Rudiment_3D/tree/4dd62db8dc46ca6468bffeeb586c1d295a38a793)이다. 현재 작업 저장소가 다르면 먼저 diff를 확인한다.

- 앱은 React + 순수 Three.js + VexFlow + Web Audio다. R3F·Drei·XState·GSAP는 설치되어 있다고 가정하지 않는다.
- App.tsx는 기본 2D, 여섯 장면 nav, 질문 패널, 분리된 실험·기보·문항, sticky footer를 사용한다.
- navigate는 재생을 정지하고 sceneId를 즉시 바꾼다. 실제 표지·책등·페이지 곡면·앞뒷면·전이 상태는 현재 실행 경로에 없다.
- Three.js 음가 블록, demand 성격의 렌더링, DPR 제한, context loss 후 2D, 자원 정리는 이미 있다.
- tests 아래 6개 파일의 96개 test 선언을 읽었다. 이번 문서 작성 중 실행한 결과는 아니다.
- 음정 함수는 상행 1–8도·증감 1단계, 기보 UI는 높은음자리표·4/4·C/G·무부점 온~16분음표, 오디오는 단선율 한 마디 sine 합성음이다. pause/resume/seek는 없다.

이 제한을 초과하는 다성·다마디·음정 계산기·샘플 악기 플레이어가 이미 있다고 쓰지 않는다. v2 시제품은 현재 지원 음악 범위 안에서 만든다.

### 1.3 원본 관찰의 한계

원본 [Every Joule](https://iamtechartist.com/every-joule/)와 기존 앱의 클라우드 브라우저 확인에서는 WebGL context 생성이 실패했다. 원본 공식 포스터·설명과 제작 앱 2D 대체 화면만 확인했다. 원본의 실제 체감 모션·힌지·직접 드래그·플랩·재방문 동작은 미검증이다. 추가 공개 번들 조사에서는 책·페이지 shader, 표지 분기, 넘김 전 퇴장과 도착 후 활성화, queue, 기본 1.1/1.15초 및 ease-in-out 계열을 정적으로 확인했다. 이는 실제 기기 관측과 다르다. 사용자 설명은 명시 요구사항으로 채택하되 기술 구현을 본 것처럼 주장하지 않는다.

사용자가 “원본 스타일을 그대로 적용”하고 싶다는 요구는 독립 코드와 음악 콘텐츠로 상호작용·모션 문법을 재현하는 목표다. 원본 코드나 자산의 복사 허가는 아니다. 관측 없이 100% 동일하다고 약속하지 않는다.

## 2 단계 지도와 보고 계약

| ID | 실행 범위 | 핵심 산출물 | 다음 단계의 문턱 |
|---|---|---|---|
| V00 | 고정 실행 계약 | IMPLEMENTATION_CONTRACT_V2 | 허용 범위와 원본 보존 |
| V01 | 실제 코드·문서 감사 | REUSE_MAP, REQUIREMENTS_TRACE_V2 | 사실과 미확인 구분 |
| V02 | 원본 레퍼런스와 구도 | MOTION_REFERENCE, BOOK_VISUAL_SPEC | 제안 수치와 관측 분리 |
| V03 | 상태 머신·의존성 최소 검증 | book reducer, invariants tests | 순수 전이 테스트 |
| V04 | 정적 책과 커버 | CoverRig, BookStage | 실제 두께·힌지·책등 |
| V05 | 양면 곡면 페이지 | TurningLeaf, page mapping | 앞뒷면·곡률·가림 |
| V06 | 장면 생명주기 연결 | SceneHost, transition coordinator | stale callback·cleanup |
| V07 | 실제 두 펼침면 | 장면1·2, 기보·음·복귀 | placeholder 없는 절편 |
| V08 | 첫 입력·대체·증거 | 가로 조작, 2D, G1 영상 | 기본 안전·실제 화면 |
| G1 | 객관적 책 경험 판정 | BOOK_EXPERIENCE_GATE | A/B 실패·미검증이면 확장 금지 |
| V09 | transport pause와 race | audio adapter와 테스트 | 전체 재생 계약 |
| V10 | 진행 저장·이관 | v2 snapshot migration | 원문 보호·재방문 |
| V11 | 페이지와 정확한 악보 | semantic/texture layer | 글자 관통·기호 오류 없음 |
| V12 | 터치·모바일·접근성 | owner arbiter, access audit | 비드래그·세로·확대 |
| V13 | 펼침면3–6 이식 | 완성 음가 한 단원 | 음악 회귀와 책 경험 유지 |
| V14 | 교사·힌트·책갈피 | 보조 도구와 읽기 순서 | 주 화면 대시보드 회귀 없음 |
| V15 | 성능·메모리·장애 | 측정과 복구 기록 | 지원 범위 실측 |
| V16 | 원본 비교와 시각 교정 | motion comparison | 관측 근거가 있는 판정 |
| V17 | 통합 QA와 결함 수정 | QA_SUMMARY_V2 | 차단 결함 해결·대기 분리 |
| V18 | 인수 | HANDOFF_V2 | 실행 가능·배포 별도 |

각 단계의 결과는 아래 형식으로 docs/BUILD_STATUS_V2.md에 남긴다. “코드를 작성함”과 “테스트가 통과함”과 “사람이 승인함”을 구분한다.

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
~~~

문서에 테스트를 작성했으면 작성됨·미실행이다. headless 또는 viewport 에뮬레이션만 했으면 실기기 통과가 아니다. 무음 영상은 청취 증거가 아니다. 현재 WebGL 실패 환경에서 나온 2D 캡처를 3D 검증으로 제출하지 않는다.

## 3 V00 공통 실행 계약

**산출물:** docs/IMPLEMENTATION_CONTRACT_V2.md, docs/BUILD_STATUS_V2.md.  
**수용 기준:** 아직 전체 앱을 만들지 않고 범위·보존·게이트가 기록된다.

~~~text
V00만 수행하라. v2.1 추가 고정 계약 전체를 먼저 읽고 CI01–03, BO01, EN01–02, AX21을 각 단계의 통과 조건으로 등록하라. 다음 두 문서를 실제로 읽어라.
- 3D음악이론_책경험중심_상세설계서_v2.1.md
- 3D음악이론_책경험중심_바이브코딩프롬프트_v2.1.md

목표는 닫힌 책의 커버를 펼치고, 물리적인 곡면 종이를 넘기면 그 페이지의 3D 음악 장면이 등장하는 가로 모바일 웹 교재다. 기존 탭·패널 UI에 책 배경만 붙이는 작업이 아니다.

다음 고정 계약을 저장하라.
1. v1 원본 문서와 기존 사용자 코드 변경을 보존한다. git status, diff, 지침과 lockfile을 먼저 읽는다. reset --hard, 사용자 파일 삭제, 무관한 전면 재작성 금지.
2. 첫 범위는 표지와 두 펼침면이다. 첫 장은 긴 소리1개 대 짧은 소리4개, 두 번째는 음가 분할이다. 실제 C4·4/4·90 BPM·정확한 악보·합성음이 있어야 한다. 모서리 직접 drag·중간 정지·역방향 당김·release·cancel을 G1 필수로 둔다.
3. G1 객관적 책 경험 A/B 통과 전에 나머지 장면·교사 기능으로 확장하지 않는다. 사용자의 반복 질문 없는 진행 선호에 따라 허용 범위 안에서는 스스로 단계 판정한다. 새 구현·배포·권한 범위까지 자동 허용되는 것은 아니다. 기능 수나 테스트 수로 시각 실패를 상쇄하지 않는다.
4. 음악 도메인·검증·학습 reducer·기보·오디오 정지·저장 안전장치는 재사용한다. 책 셸·페이지 전이·scene lifecycle만 새 계층으로 분리한다.
5. 기본 지원 WebGL 경로는 닫힌 3D 책이다. 정식 2D 읽기 경로와 reduced motion을 함께 제공한다. 2D 대체가 있다는 이유로 3D 책을 생략하지 않는다.
6. 페이지·장면·오디오 상태를 구별하고 활성 scene과 audio session은 최대 1개다. 이동·닫기·숨김·장애에서는 미래 예약 소리까지 취소한다.
7. 2D 기보가 정본이다. 같은 validated music revision에서 블록·악보·소리·평가를 만든다. 좌표와 MIDI 차이만으로 음악 정답을 정하지 않는다.
8. Every Joule의 동작과 스타일은 독립 구현 목표다. 원본 코드·자산·브랜드·문장을 허가 없이 복사하지 않는다. 실제 관측하지 않은 값은 제안값으로 쓴다.
9. 가로 우선, 세로 차단 금지. 44px 목표, 키보드, 확대, 무음, context loss 대체를 보존한다. 강제 fullscreen·orientation lock·전역 touch-action:none 금지.
10. 현재 순수 Three.js 기반과 잠금 버전을 우선한다. R3F·GSAP·XState 등을 도입하려면 공식 API·호환성·이관 비용을 확인한 ADR을 먼저 쓴다. 알파/WebGPU를 필수로 만들지 않는다.
11. 사용자 요청 없이 push·공개 배포·외부 공유·권한 변경·유료 서비스·서버·분석 추적·녹음·자동화 작업을 하지 않는다.
12. 실제 화면·실기기·청취·교육자 검수·원본 관측을 각각 증명한다. 실행하지 않은 항목을 완료로 채우지 않는다.

문서 충돌은 새 사용자 지시, v2.1 추가 고정 계약, v2 책 경험 계약, 보존할 v1 음악 의미 순서로 검토하고 결정 이유를 남겨라. 사용자 명시 요구를 조용히 삭제하지 마라. 지금은 공통 계약과 상태 문서만 만들고 다음 단계는 V01로 남겨라.
~~~

**잘못 진행했을 때**

~~~text
앱 전체 생성과 배포를 멈추고 V00 범위로 돌아가라. 이미 바뀐 파일을 사용자 변경과 구분해 목록화하되 파괴적으로 되돌리지 마라. 승인 없는 외부 변경이 있으면 실제 결과를 확인하고 알리라. 계약과 현재 상태를 정확히 복구하라.
~~~

## 4 V01 기존 문서와 코드의 재사용 감사

**선수:** V00.  
**산출물:** docs/REUSE_MAP.md, docs/REQUIREMENTS_TRACE_V2.md, baseline 결과.  
**수용 기준:** 책 부재와 기존 3D/안전장치의 존재를 동시에 정확히 설명한다.

~~~text
V01만 수행하라. 실제 저장소의 현재 commit과 감사 기준 4dd62db8dc46ca6468bffeeb586c1d295a38a793의 차이를 확인하라. 저장소 상태를 임의로 옛 commit으로 되돌리지 마라.

읽을 경로는 실제 존재를 확인한 뒤 다음을 중심으로 한다.
src/App.tsx, src/styles/app.css
src/domain/fraction.ts, src/domain/music.ts
src/content/types.ts, lesson.ts, validation.ts
src/lesson/controller.ts
src/notation/NotationView.tsx
src/audio/AudioEngine.ts
src/scenes/DurationScene3D.tsx, durationWorld.ts
src/persistence/progress.ts
tests 아래 도메인·오디오·학습·저장·3D world·평가 테스트
scripts/e2e.ts, package.json, lockfile, docs/KNOWN_LIMITATIONS.md

모듈별로 그대로 유지 / 어댑터 추가 / 교체 / 검증 후 결정 표를 작성하라. App의 탭·question-panel·sticky footer와 sceneId 즉시 교체는 교체 대상이다. 분수·기보·오디오 stop·검증·학습 상태·저장 원문 보호는 보존 후보다. 기존 3D renderer의 자원 정리와 context loss 대응이 있다는 사실을 반영하라.

v1 설계서 5·14·21·28절과 v1 P00·P06·P10을 읽고 문서가 패널 UI와 3D 후순위 구조를 직접 유도한 근거를 적어라. 문서 잘못과 구현 누락을 한 문장으로 뭉뚱그리지 마라.

현재 음악 지원 범위를 기록하라. 음정 함수 존재를 완성 음정 단원으로, sine 합성음을 원본 악기 샘플로, 계산 함수의 부점을 기보 지원으로 확대하지 마라.

환경이 허용되면 실제 package scripts를 기준으로 baseline typecheck, lint, content:validate, test, build, E2E를 실행한다. 의존성 설치가 필요하면 lockfile 기반으로 하고 환경 제약을 먼저 확인한다. 감사 기준의 명령은 npm run typecheck, npm run lint, npm run content:validate, npm test, npm run build, npm run test:e2e지만 현재 scripts를 먼저 읽는다. 실행 불가 항목은 미실행으로 남긴다.

기존 UI E2E의 nav 버튼 인덱스와 최초 canvas=0 기대는 v2에 맞게 교체할 항목으로 표시한다. 음악 기대값을 바꾸거나 테스트를 지워 통과시키지 않는다. 이번 단계에서는 책 UI 구현을 시작하지 않는다.
~~~

**실패 시 수정**

~~~text
재사용표의 각 주장에 실제 경로와 줄 또는 테스트 근거를 연결하라. 3D나 cleanup이 전혀 없다는 표현을 실제 코드와 대조해 정정하라. 테스트 선언 수와 실행 결과를 분리하고, baseline에서 원래 실패한 것과 새 변경으로 깨진 것을 구별하라.
~~~

## 5 V02 원본 관측과 책 시각 명세

**선수:** V01.  
**산출물:** docs/reference/MOTION_REFERENCE.md, docs/BOOK_VISUAL_SPEC.md, 독자적인 정적 구도.  
**수용 기준:** 원본 관측과 추정이 섞이지 않고, 커버·펼침면·턴 중간 구도가 정해진다.

~~~text
V02만 수행하라. 설계서 3·5·6·8절을 읽고 Every Joule의 책 인터랙션을 관찰 가능한 범위에서 기록하라. 현재 권한과 WebGL 가능한 환경을 확인하되 사용자 PC 설정·환경 권한을 임의로 바꾸지 마라. 원본을 실제로 조작할 수 없으면 그 사실을 적고 사용자 제공 영상 또는 허가된 환경 관측을 대기 항목으로 둔다. 포스터를 동작 검증으로 대신하지 않는다.

REF01–REF10 표를 만든다. 각 항목에 URL, 기기, viewport, 브라우저, 입력 순서, 녹화 타임코드, 관측값, 오차, 미관측, v2 제안값, 채택값을 따로 적어라.
필수 관찰은 닫힌 표지, 열기/닫기, 앞/뒤 페이지, drag 취소, 장면 입장/퇴장, 재방문, 페이지 내 조작, 모바일 회전이다.

원본의 라이브러리·수식·easing을 화면만 보고 확정하지 마라. 설계서 3.3절의 공개 번들 확인값은 정적 근거로 인용하고 실기 관측값과 분리한다. 1.1/1.15초가 모든 사용자 동작의 실측 지속시간이라고 확대하지 않는다. 코드·texture·모델·폰트·음원을 추출해 제품에 넣지 마라. 공개된 원본 이미지를 우리 앱 자산처럼 사용하지 않는다.

독자 미술로 다음 구도를 설계하라.
A 닫힌 커버: 제목·책등·두께·책상 접촉 그림자.
B 펼침면1: 왼쪽 정확한 악보와 짧은 질문, 오른쪽 종이에서 올라온 두 음가 레인.
C 펼침면2: 선택 분할 가능한 음가 띠.
D 넘김 25/50/75%: 종이 앞뒷면·곡률·가림.
E 2D/세로/모션 줄이기 대체.

초기 색·치수·시간은 설계서 제안값에서 시작하고 원본 실측값이라고 쓰지 마라. 844×390, 667×375에서 글자와 44px 버튼이 책보다 화면을 지배하지 않는지 확인한다. 주 화면에 상단 6개 탭·좌측고정패널·하단재생바를 다시 그리지 않는다.

결과는 구현 전 시각 명세다. 목업을 실제 앱 캡처라고 하지 말고, 관측 대기 항목이 G1-C 원본 체감 유사도 판정을 제한한다는 사실을 남겨라.
~~~

**실패 시 수정**

~~~text
원본 수치처럼 쓴 모든 값을 관측 자료와 대조하라. 근거 없는 값은 v2 초기 제안으로 옮겨라. 구도가 여전히 카드형 대시보드이면 색·radius를 손보지 말고 책이 화면의 구조가 되도록 재설계하라. 정확한 기보가 읽히는지 함께 확인하라.
~~~

## 6 V03 책 상태 머신과 기술 최소 검증

**선수:** V01, V02의 잠정 시각 명세.  
**산출물:** book state reducer, page manifest, 전이 단위 테스트, ADR.  
**수용 기준:** UI 없이도 취소·연속 입력·오래된 callback을 안전하게 처리한다.

~~~text
V03만 수행하라. 설계서 9·15·16절을 기준으로 BookState, SceneState, TransportState를 분리하라. 기존 LessonState와 평가 reducer는 유지한다.

BookState는 최소 bootLoading, introReady, introMoving, coverIdle(=closed), opening, spreadIdle, preparingTurn, turningForward, turningBack, settling, cancelSettling, closing, fallback2D, recoverableError를 구별한다. CameraState는 loading/intro/settled/reframing/suspended를 구분하고 OPEN_BOOK은 coverIdle+camera.settled+firstSpreadReady+intro입력소비완료에서만 수락한다. 한 enum에 모든 음악·모션 조합을 억지로 넣지 말고 명확한 병렬 영역과 guard로 설계하라.

BookManifest에 spreadId, leftPageId, rightPageId, sceneId를 둔다. TurningLeaf는 front/back 페이지를 명시한다. 앞으로 넘길 때 앞면 R(i), 뒷면 L(i+1), 아래 R(i+1)를 테스트한다. 표지·마지막 쪽 경계를 명시하라.

currentSpreadId는 도착 확정 때 한 번 commit한다. destination과 preview progress는 별도다. 최대 1개의 pendingIntent, last valid intent wins 정책을 구현하고 무한 queue를 만들지 않는다. 반대 입력은 현재 확정 전이를 끝낸 후 재평가한다. 실제 drag cancel만 기존 페이지로 역 settle한다. preparingTurn에서도 pointerup/cancel/lostcapture를 처리하고 최신 샘플·pointerActive·releaseDecision을 저장한다. 취소 뒤 늦은 load/exit 완료가 유령 drag를 시작하지 못하게 한다.

navigationToken, bookEpoch, sceneInstanceId와 abort 규칙을 정하라. 이전 load·resume·enter 완료가 새 장면을 덮지 못하게 한다. visibility hide, context loss, close는 우선순위가 높다. 마지막 committed 페이지로 안전 복귀하는 규칙을 테스트한다.

필수 단위 테스트:
- closed에서 next 무효, open 2회는 1회만 수락.
- next→complete는 index+1 한 번, stale complete는 변화 없음.
- drag cancel은 index와 데이터 불변.
- next10회는 무한 예약이 아니며 범위 밖 이동 없음.
- forward 중 prev는 정의된 한 번의 역이동.
- scene/audio owner 최대 1개.
- 오류·hide 후 입력 잠금 잔류 없음.
- reduced motion 즉시 전이도 동일 commit 이벤트 사용.

현재 순수 Three.js로 가능한지 확인하라. R3F·XState·GSAP 도입은 필수 아니다. 도입을 제안하면 정확한 공식 버전 호환·이득·전환 비용을 ADR로 비교하되 이번 단계에서 기존 전체 앱을 옮기지 마라. 테스트 가능한 reducer와 최소 manifest까지만 완료하라.
~~~

**실패 시 수정**

~~~text
여러 boolean이 서로 모순되거나 setTimeout이 페이지 index를 직접 바꾸는 경로를 찾아 없애라. 수락·preview·commit을 분리하고 reducer의 단일 결정 경로로 통합하라. race를 재현하는 최소 이벤트 시퀀스를 먼저 테스트로 만든 뒤 수정하라.
~~~

## 7 V04 책 모델과 실제 커버 열기

**선수:** V03.  
**산출물:** BookStage, CoverRig, Spine, PageStack, 실제 렌더 캡처.  
**수용 기준:** 닫힌 책과 힌지로 열리는 두꺼운 커버가 실제 3D로 보인다.

~~~text
V04만 수행하라. 제공 AI 표지의 검증된 변환 사본과 A4 비율, COVER-INTRO 상태/중앙좌표/안전영역/skip/reduced-motion 계약을 구현하라. 구현하지 않은 자산 변환을 완료로 기록하지 마라. 기존 renderer를 버리기 전에 BookStage가 한 Canvas 한 context를 소유하도록 최소 확장하라. 설계서 6·7절의 좌표계와 초기 치수로 시작한다. 책은 XZ 평면, Y 위, 책등은 Z 방향이다.

FrontCover, BackCover, Spine, Left/RightPageStack을 만들고 material·geometry 소유권을 기록하라. 커버는 두께 있는 rigid mesh, 페이지는 별도 종이 표면이다. 앞표지 pivot은 책등 모서리에 있어야 한다. 카드 중심 회전과 책등과 떨어지는 커버는 허용하지 않는다.

기본 새 방문에서 닫힌 책을 보여주고 책 펼치기 DOM 버튼 및 커버 hit area가 같은 OPEN_BOOK 이벤트를 보낸다. 자동 소리는 없다. 커버 열기 약 1000ms와 단조 easing은 초기 제안값이며 토큰으로 관리한다. 커버가 반대면으로 넘어갈 때 정상 culling·UV·안쪽 면이 보여야 한다.

책상 접촉 그림자와 얇은 종이 묶음 면을 넣는다. 후처리 bloom·glass·무한 회전은 넣지 않는다. 그림자는 형태를 읽는 수준으로 절제한다. 진입 intro와 구분하여 페이지 드래그/턴 중 카메라 회전을 금지하고, OPEN/CLOSE에서는 상단 6-A의 동일 quaternion 위치·거리 reframe만 허용하며 책과 높은 페이지 턴을 포함한 bounds로 구도를 계획한다.

정지 상태에서 불필요한 RAF를 돌리지 않는다. unmount 시 listener·observer·RAF·전용 geometry/material/renderer를 올바르게 해제한다. 공유 자원은 마지막 owner만 해제한다.

실제 브라우저에서 closed, open 25/50/75%, open settled 캡처를 남긴다. 844×390과 667×375를 확인한다. WebGL 불가 환경이면 기본 도형이 보였다고 하지 말고 실행 검증 대기를 남겨라. 이번 단계는 아직 완성 교재가 아니다.
~~~

**실패 시 수정**

~~~text
커버가 평면 카드처럼 보이는 원인을 두께·pivot·안쪽 면·책등·접촉 그림자로 나눠 확인하라. 더 화려한 texture로 덮지 마라. 카메라 잘림과 뒤집힌 면을 중간 프레임으로 재현하고 고친다. 닫힌 책 캡처 한 장으로 open 애니메이션을 통과시키지 마라.
~~~

## 8 V05 양면 곡면 페이지 넘김

**선수:** V04.  
**산출물:** TurningLeaf, leaf mapping, 변형·UV·occlusion 테스트.  
**수용 기준:** 실제 종이가 휘며 넘어가고 앞뒷면이 올바르다.

~~~text
V05만 수행하라. 페이지의 front/back과 source/target spread를 V03 manifest에서 가져오고 임의 index 계산을 여러 컴포넌트에 복제하지 마라.

폭 방향 약24, 높이 방향 약4 분할의 재사용 BufferGeometry 또는 검증된 shader 변형으로 시작하라. p=0과1은 정지 페이지와 연속이고 s=0 책등은 고정된다. p=.25/.5/.75에서 종이 곡률이 실루엣과 조명에 보여야 한다. 직사각형 전체 rotateY만으로 완료하지 마라.

양면은 서로 다른 pageId와 texture를 갖고 뒷면 글자가 거울처럼 보이지 않아야 한다. edge mesh, normals, UV, bounds, front-face winding을 점검한다. 현재 오른쪽 앞면과 다음 왼쪽 뒷면의 대응을 실제 번호 인쇄로 먼저 검증한다.

현재 왼쪽과 다음 오른쪽의 static page, 움직이는 leaf의 depth 관계를 정하라. 종이가 뒤의 페이지를 실제로 가려야 한다. z-index만 높이거나 depthTest=false로 관통을 감추지 않는다. 턴 동안 종이 묶음 두께와 hinge 높이는 연속적으로 바뀌어야 한다.

click next/prev 전이는 원본 공개 코드의 기본값을 참고한 약1100–1150ms 비교 출발점과 overshoot 없는 단조 easing으로 시작한다. 이는 실제 체감 실측값이 아니다. p를 외부에서 0~1로 설정할 수 있어 드래그와 결정적 시각 테스트가 같은 geometry를 사용하게 하라. 매 프레임 새로운 geometry·texture를 만들지 않는다.

검증할 것:
- forward와 backward의 pageId 대응.
- p=0/.25/.5/.75/1의 실제 wireframe 및 최종 화면.
- 한쪽 글자 누락·거울 반사·z-fighting·그림자 acne·culling 없음.
- 카메라 밖으로 나가는 모서리 없음.
- 취소 시 같은 페이지로 자연스럽게 복귀, commit 안 됨.
- 각종 viewport에서 동일 한 장의 소유권.

모서리 grab 지점을 leaf-local 좌표로 고정하고 화면 pointer를 drag plane에 투영하라. 손을 멈추면 p와 곡률도 멈추고 반대로 움직이면 연속적으로 되돌아가야 한다. 시간 easing으로 손을 뒤늦게 따라가게 하지 않는다. 위/아래 모서리의 curl 방향·그림자·가림도 함께 변해야 한다.

음악 장면은 아직 붙이지 않아도 된다. 그러나 페이지 번호만 있는 이 단계가 G1을 통과한 완성 시제품은 아니다.
~~~

**실패 시 수정**

~~~text
pageId 매핑 문제와 기하 변형 문제를 분리하라. 먼저 단색 앞/뒤 번호로 mapping을 고정하고 그다음 normals·UV·bounds를 확인하라. 곡면이 불안정하면 분할 수를 무작정 늘리지 말고 p endpoints, hinge, 면 길이, 역방향 수식을 검증하라. 원본과 같다는 표현은 관측 전 제거하라.
~~~

## 9 V06 페이지와 장면의 생명주기 연결

**선수:** V03–V05.  
**산출물:** SceneHost, transition coordinator, cleanup instrumentation.  
**수용 기준:** 떠나는 장면이 정리되고 도착한 페이지에서만 장면이 살아난다.

~~~text
V06만 수행하라. 설계서 8–10절을 기준으로 enter/ready/play/pause/exit/dispose의 책임을 분리하라. 먼저 단순한 종이 팝업 도형으로 lifecycle을 확인한 뒤 V07에서 실제 음악 world를 연결한다.

SceneRegistry는 spreadId에서 scene definition을 찾는다. load는 입력·소리를 켜지 않고 자산을 준비한다. enter는 페이지 anchor에서 장면을 올린다. ready 이후에만 학습 입력을 허용한다. exit 시작 즉시 입력 차단과 audio stop을 수행하고 약 180ms 초기 퇴장 모션 후 종이 턴을 허용한다. entry 초기 약 600ms, 재방문 약 200ms는 제안 토큰으로 분리한다.

버튼 전이의 정상 순서는 request navigation→snapshot→audio stop→scene exit→leaf turn→commit→old scene cleanup→new scene enter→ready다. 직접 드래그는 설계서8.4절처럼 국소 corner curl과 낮은 p 구간의 scrubbable scene exit를 연결해 고정 exit 시간이 끝날 때까지 손 추적을 지연하지 않는다. cancel은 같은 경로를 되돌리고 scene을 snapshot에서 다시 펴되 소리는 정지한다. loading/entering 중 exit·abort·dispose도 정상 경로다. 실제 renderer는 계속 유지하고 장면의 리소스만 교체한다. 새로운 페이지가 아직 가려져 있는데 다음 장면이 뚫고 나오지 못하게 한다.

navigationToken·sceneInstanceId·AbortSignal을 검사하라. 늦은 load/enter/exit callback은 현재 owner가 아니면 무시한다. Promise timeout을 정상 완료로 간주하지 않는다. fallback으로 안전 복구하고 오류 원인을 기록한다.

dispose는 멱등적이어야 한다. frame callback, timer, event listener, pointer owner, 전용 geometry/material/texture와 audio node를 정리한다. 공유 자원은 ref count 또는 명시 owner를 사용한다. object를 scene에서 remove한 것만으로 dispose 완료라고 하지 않는다.

테스트는 entry 도중 next, exit 도중 prev, close 중 오래된 load 완료, hide 중 turn, context loss 중 enter를 포함한다. 활성 scene과 재생 session이 둘이 되는 순간이 없어야 한다. 개발 instrumentation은 시간·ID·이벤트만 기록하고 학습자 개인정보를 추가하지 않는다.
~~~

**실패 시 수정**

~~~text
겹쳐 살아 있는 scene을 눈으로 숨기지만 말고 owner와 callback 권한을 추적하라. 가장 짧은 재현 시퀀스로 token 무효화와 cleanup 횟수를 검사한다. setTimeout 시간을 늘려 race를 감추지 말고 transition completion과 cancellation을 명시적으로 처리하라.
~~~

## 10 V07 실제 음악이 있는 두 펼침면

**선수:** V06, 기존 의미·기보·오디오 baseline.  
**산출물:** 첫 두 펼침면의 실제 음악 절편.  
**수용 기준:** 책을 열고 듣고 나누고 넘겼다 돌아오는 동작이 된다.

~~~text
V07만 수행하라. 기존 첫 두 scene의 의미 데이터를 재사용하고 책 화면에 맞는 어댑터를 연결하라. 기존 App 전체를 책 안 texture로 붙여 넣지 마라.

펼침면1:
왼쪽은 질문과 두 줄의 VexFlow SVG, 오른쪽은 페이지에서 올라오는 두 음가 레인이다. 위 C4 온음표1개, 아래 C4 4분음표4개. 4/4, 4분음표=90, 두 줄 각각8/3초, 아래 onset0·2/3·4/3·2초. 각각 듣기 버튼을 페이지 안에 두고 동시 재생은 막는다. 길이 같음·어택1대4·음높이와 음량설정 불변을 다룬다.

펼침면2:
온음표1개에서 선택 블록만 절반씩 분할한다. 1/16에서 제한, 끝까지16개·합 1이다. 인접 동종·동길이·동음높이 병합과 undo/redo를 기존 의미 명령으로 연결한다. 작은 음표는 DOM 목록으로도 선택한다. 8분음표8개가 온음표1개와 같다는 질문을 둔다.

기존 durationWorld를 책의 scene anchor 자식으로 연결하되 별도 renderer/Canvas를 페이지마다 만들지 않는다. 음악 X축 시간 규칙은 유지하고 책 좌표 변환은 표현 adapter에서 한다. 음악 블록의 높이·깊이를 음가에 따라 바꾸지 않는다.

정지 페이지의 정확한 기보와 문장은 page-local DOM/SVG로 보이게 하고 턴 때는 같은 revision의 인쇄 texture로 전환한다. 전이 중 live DOM이 공중에 떠 있지 않게 숨기고 inert 처리한다. 안착 후 동일 위치로 복귀한다. 악보 minWidth 400을 그냥 작은 페이지에 강제하지 말고 읽기 확대/분량 조절로 해결한다.

오디오는 기존 사용자 제스처·예약·stop 계약을 유지한다. entry와 page turn은 자동 소리를 내지 않는다. pause는 아직 없다면 노출하지 말고 V09 대기라고 적는다. 정지 버튼을 pause라고 부르지 마라.

두 번째 페이지의 분할 데이터를 메모리 snapshot으로 보존하고 next/prev 후 복원한다. 영속 저장 이관은 V10에서 강화한다. 책갈피 대규모 기능이나 장면 3–6은 지금 만들지 않는다.

필수 실제 시퀀스:
closed→open→scene1 enter→위/아래 재생→next→scene2 enter→분할2회→prev→next→분할상태보존.
각 단계의 audio session·lesson revision·currentSpreadId가 일치하는지 확인한다.
~~~

**실패 시 수정**

~~~text
책 모델과 음악 데이터 사이에서 복제된 상태를 찾아 없애라. SVG·3D·소리·평가가 같은 revision인지 로그로 확인한다. 책 밖 카드·고정 재생바로 편하게 해결한 부분은 페이지 안의 읽기/실험 구조로 다시 연결한다. 음악 없는 placeholder로 G1을 신청하지 마라.
~~~

## 11 V08 첫 터치 대체 경로와 G1 증거

**선수:** V07.  
**산출물:** G1 시제품, 가로·세로·fallback 증거.  
**수용 기준:** 실제 사용자가 두 펼침면을 안전하게 조작할 수 있다.

~~~text
V08만 수행하라. EDGE-NAV 좌우 책갈피 버튼과 ArrowLeft/Right, 포커스 예외·경계·큐·drag 충돌 계약을 함께 구현하고 EN01–02 증거를 남겨라. G1에 필요한 기본 입력과 대체 경로를 완성하고 증거를 만든다. 세부 접근성 확장은 V12지만 지금도 사용할 수 없는 시제품을 통과 처리하지 않는다.

이전/다음은 좌우 책 가장자리에 부착된 책갈피형 44px DOM 버튼과 ArrowLeft/ArrowRight로 가능해야 한다. DOM 버튼의 시각 투영은 책에 정합한다. page edge drag는 선택 옵션이 아니라 필수다. 모서리에서만 시작하고 scene 선택·버튼·대화상자와 owner를 공유하지 않는다. pointerdown owner를 고정하고 pointercancel/lostcapture/회전에서 해제한다. synthetic click 중복을 막는다. 다음 버튼 연타는 V03의 최대 1 pending 정책을 따른다.

WebGL 생성 실패·context loss에서는 동일 데이터의 ReadingView2D를 보여준다. 3D 앱 전체를 오류로 비우지 않는다. reduced motion은 큰 회전 없이 같은 commit 경로를 사용한다. 세로에서 회전 강제 없이 두 장면의 학습이 가능해야 한다.

844×390, 667×375, 568×320과 주소창 표시 조건, 390×844 세로를 확인한다. target44px, 안전 영역, 음소거/정지 접근성, 오선 가독성을 확인한다. 실기기가 없으면 에뮬레이션이라고 기록한다. preparingTurn 중 즉시 손 떼기, 화면 밖 이동과 lost capture, 멀티터치, 세로 scroll 충돌도 재현한다.

실제 앱에서 다음을 저장하라.
- 닫힌 커버와 열림25/50/75%.
- 첫 펼침면과 실제 재생.
- 모서리 잡기→25/50/75% 직접 끌기→중간2초 정지→역방향 당김→release와 cancel. 앞뒷면 번호·텍스트 방향·곡률·그림자·가림을 함께 확인.
- 두 번째 펼침면 분할, 뒤로 갔다 돌아온 동일 상태.
- 위 행동을 연결한 끊기지 않은 영상.
- keyboard, reduced motion, 2D fallback의 별도 캡처.
- commit, viewport, DPR, 브라우저, 실행 URL, 로그 경로.

원본 실제 영상이 없으면 미관측 표를 유지하고 공개 코드 정적 확인과 구분한다. 목업·AI 생성 이미지를 실행 증거로 쓰지 않는다. G1에는 실제 작동하는 WebGL 브라우저의 pointer 시퀀스와 실제 Web Audio 시작·시간·정지 경로 증거가 필요하다. mock이나 정지 목업만으로 통과하지 않는다. 마우스·자동 입력 주입·휴대전화 실제 터치를 구분한다. 초기 G1은 명시된 브라우저 환경에서 판정할 수 있지만 실제 휴대전화 터치와 실제 청취는 최종 수업 시험 준비의 필수 검수로 남긴다. 무음 영상이나 출력 파형 분석만 있으면 청취 미검증이다. G1 준비 보고서를 만들고 이 단계에서 멈춰라.
~~~

**실패 시 수정**

~~~text
G1 차단 항목을 하나씩 재현하고 수정하라. 페이지 넘김이 안 보이는 영상, 2D fallback을 3D로 적은 캡처, 실제 악보·음이 없는 장면은 증거에서 제외한다. viewport 변경으로 문제가 사라졌다고 원래 실패 환경을 삭제하지 마라.
~~~

## 12 G1 객관적 책 경험 시제품 게이트

G1은 자동 테스트 수만 확인하는 단계가 아니다. 실제 화면과 입력 증거로 책의 정체성을 판정한다. 사용자의 반복 질문 없는 진행 선호에 따라 구현 에이전트가 허용 범위 안에서 자체 판정한다. 주관적인 사용자 유사도 평가는 선택 피드백으로 별도 기록한다.

~~~text
G1 검토만 수행하라. V08의 실제 시제품을 기준 설계서 및 원본의 확인된 구조와 비교하라. 아직 장면 3–6을 구현하지 마라.

G1-A 실제 제품 필수 항목:

추가 선행 필수: CI01–03(진입/중앙/반응형/skip), BO01(전 상태 책-only), EN01–02(책갈피/방향키/충돌)를 실제 실행 증거로 통과해야 한다. 상단 계약에 적혀 있다는 것만으로 통과 처리하지 않는다. AX21 접근성 기본 경로도 초기 게이트에 포함하고 실기 검증 제한은 별도 표시한다.
1. 새 진입은 닫힌 실제 책이고 커버 두께·책등 힌지·안쪽 면이 보인다.
2. 종이는 곡면으로 넘어가고 앞뒷면·occlusion·그림자가 맞다.
3. 모서리를 직접 잡아 끌고 중간에 멈추고 되돌릴 수 있다. 클릭 flip만 있으면 실패다.
4. 손을 놓으면 거리/속도 기준으로 완료 또는 복귀하고 pointercancel·lostcapture·멀티터치가 안전하다.
5. 장면은 페이지에서 등장하고 떠날 때 접힌다. 재방문 데이터는 남고 소리는 멈춘다.
6. 실제 두 음악 장면의 악보·소리·분할이 동작한다.
7. 기보와 설명이 읽히며 페이지 입력과 학습 입력이 충돌하지 않는다. 실제 WebGL과 Web Audio 경로에서 검증했고 mock 또는 목업만 사용하지 않았다.
8. 상단 6개 탭·상시좌측패널·고정하단재생바로 회귀하지 않는다.

G1-B 요구와 원본 구조 대조:
각 요구를 실제 코드와 영상에 연결하고, 원본의 공개 코드 확인값·공식 소개·사용자 설명 중 어떤 근거인지 표시한다. 표지/일반 페이지 구분, 곡면·인쇄면, leave→turn→arrive, queue, 모션 정책을 대조한다. 실측하지 않은 타이밍은 코드 기본값 또는 v2 제안값으로 적는다.

G1-C 원본 실동작 체감 비교:
원본과 같은 입력 시퀀스의 실제 영상을 확보했으면 카메라·모션·손 조작·재방문을 나란히 비교한다. 원본 WebGL 관측이 없으면 C는 미검증이다. A/B 통과로 C를 자동 통과시키지 않는다. 사용자의 최종 주관적 수용도 미확인이면 그대로 둔다.

A/B의 필수 항목에 실패 또는 실행 미검증이 있으면 확장하지 말고 첫 두 펼침면을 수정한다. A/B가 객관적 증거로 통과하면 이미 허용된 개발 범위에서 V09로 진행한다. 선택적인 사용자 디자인 승인 질문을 반복하며 멈추지 마라. 다만 새 구현·외부 배포·기기 접근·권한·비용에 필요한 별도 허용은 생략하지 않는다.

실제 3D 시제품 영상, 중간 프레임, commit, 환경, 테스트 로그, 원본 대조표를 docs/qa/BOOK_EXPERIENCE_GATE.md에 연결하라. 목업이나 2D fallback으로 A를 통과시키지 않는다. 결과와 남은 C 항목을 짧게 보고하라.
~~~

**불합격 후 수정 프롬프트**

~~~text
G1에서 실패한 [정확한 항목]만 고쳐라. 핵심 동작을 숨기는 카드·도움말·장식을 추가하지 마라. 동일 입력·viewport·모션 시점의 전후 영상을 비교하고 객관적 항목을 다시 판정하라. 이전 실패 증거는 지우지 마라. C의 원본 미관측을 A/B 수정으로 해소했다고 쓰지 마라.
~~~

## 13 V09 오디오 일시정지와 전이 경쟁 조건

**선수:** G1-A/B 객관적 통과와 기존 구현 허용 범위, 기존 오디오 baseline.  
**산출물:** TransportAdapter, pause/resume 테스트, 실제 청취 대기 또는 결과.  
**수용 기준:** pause는 실제 위치 유지이며 stop과 다르다.

~~~text
V09만 수행하라. 기존 AudioEngine의 안전한 단일 context·세션 취소·미래 source stop을 보존하고 v2 pause/resume 계약을 추가하라. 아직 구현되지 않은 pause를 버튼 이름으로만 제공하지 마라.

설계서13절에 따라 musical timeline과 entry animation을 분리한다. playing은 AudioContext 기반이며 pause는 logicalOffset을 저장하고 현재/예약 source를 실제로 정지한다. resume는 같은 snapshot·tempo·revision의 offset부터 시작한다. Stop과 page exit는 offset 0으로 돌아간다. 자연 종료도 끝의 쉼표를 포함한 logicalDuration 완료 후 offset 0과 ready/stopped로 돌아간다. source.onended 하나만으로 단원 재생 완료를 판정하지 않는다. 숨김·모드전환·책닫기는 자동재개 금지다.

한 마디 synth의 검증된 timeline을 AudioBuffer로 렌더해 offset 재생하는 방법과 기존 oscillator를 남은 이벤트로 재예약하는 방법을 비교하라. 초당시간·정확한 onset 계산은 기존 domain을 재사용한다. 기본 권고는 buffer 재사용과 재개 때 새 AudioBufferSourceNode 생성이다. 한번 start한 node를 다시 start하지 않는다. 공식 API·브라우저 범위를 실제 버전에 맞게 확인하라.

음표 중간·경계·쉼표·끝의 쉼표에서 pause/resume를 테스트하라. 중간 재개를 새 음악 이벤트 어택으로 집계하지 않는다. fade-in은 클릭 억제를 위한 출력 처리이며 음악 duration을 바꾸지 않는다. 어택 횟수 청취 완료는 중단 없는 재생으로 구분한다.

재생 버튼 연타20회, resume promise 대기 중 next, 예약 직후 stop, pause 후 tempo 변경 요청, close 중 source.onended, context suspended/closed/interrupted 상태를 검증하라. 현재 API에서 지원하지 않는 상태 이름을 무조건 타입에 추가하지 말고 실제 환경과 문서를 확인하라.

테스트 로그에는 sessionId·start/stop·logicalOffset·snapshot revision을 남기되 개인정보는 넣지 않는다. 실제 청취는 기기·출력장치·음량·클릭/중복 어택 여부를 따로 기록한다. 전체 확장 전 필수 계약이므로 미구현을 완료로 처리하지 마라.
~~~

**실패 시 수정**

~~~text
pause 뒤 처음부터 시작되거나 이전 페이지 소리가 늦게 나오는 최소 시퀀스를 재현하라. logicalOffset, 새 node 생성, start 호출 여부, stale request token, 미래 source stop, onended 소유권을 차례로 확인하라. 음소거만 하고 노드를 방치하지 마라. 수정 후 기존 audio 테스트와 새 pause 회귀를 모두 실행하라.
~~~

## 14 V10 학습 진행 저장과 v1 이관

**선수:** G1-A/B 통과, V09.  
**산출물:** v2 저장 schema, migration, 복구·삭제 테스트.  
**수용 기준:** 페이지 복귀·새로고침·이관 실패에서 학습 데이터가 안전하다.

~~~text
V10만 수행하라. 기존 progress.ts의 strict schema·원문 보호·미리보기/확정 가져오기·앱 전용 삭제를 유지한다. 기존 JSON에 필드를 몰래 더하고 검증을 느슨하게 만들지 마라.

bookUiVersion, lessonSchemaVersion, contentVersion을 구별한다. 저장 항목은 마지막 committed spreadId, scene별 draft와 답안, 힌트 상태, 현재/과거 성취, 사용자 접근성·음량 선호다. pointer, transition p, RAF, promise, Three object, AudioContext, 재생 중 상태는 저장하지 않는다.

v1 currentSceneId→v2 spreadId 매핑을 명시한다. 먼저 v1 원문을 보존하고 새 schema로 검증한 결과만 새 key에 쓴다. 실패하면 기존 정상 데이터를 덮지 않고 이유·내보내기 선택을 보여준다. 임의 구버전을 자동 호환으로 처리하지 않는다.

분할→next→prev, 답안→새로고침→이어서 펼치기, 첫 페이지로 둘러보기, 손상 JSON, quota/security 오류, 지원하지 않는 버전, 전체 삭제 후 재실행을 테스트한다. 처음부터 둘러보기는 삭제가 아니다. 전체 삭제는 앱 백업 키까지 포함하되 다른 사이트 데이터는 건드리지 않는다.

재방문은 짧은 entry와 정지 상태다. 현재 평가는 복원 데이터로 다시 계산한다. 과거 성공을 현재 정답으로 고정하지 않는다. 브라우저 history 또는 URL hash를 사용한다면 stable commit만 반영하고 back/forward를 같은 coordinator로 보내되 브라우저 밖 탐색을 가로채지 않는다.

여기서 로그인·서버 동기화·학급 분석·개인 식별·녹음을 추가하지 마라.
~~~

**실패 시 수정**

~~~text
실패한 저장 입력을 보존한 fixture로 만들고 기존 정상 저장을 먼저 보호하라. schema를 느슨하게 바꿔 오류를 숨기지 마라. migration의 검증→새 키 쓰기→commit 순서와 원본 복구 경로를 수정하고 중간 실패를 주입해 재시험하라.
~~~

## 15 V11 페이지 인쇄와 정확한 기보의 결합 강화

**선수:** G1-A/B 통과, V09–V10.  
**산출물:** PageSemanticLayer, NotationTextureAdapter, 시각·의미 회귀.  
**수용 기준:** 턴 중에도 글자와 악보가 종이에 속하고 정지 시 선명하다.

~~~text
V11만 수행하라. 기존 VexFlow의 검증된 음악 변환과 폰트 로딩을 보존하고 페이지 표면 통합을 강화하라. 일반 Unicode 음표나 생성 이미지로 정확한 기보를 대체하지 마라.

정지 페이지 DOM/SVG와 턴 중 texture는 같은 validated revision에서 나온다. texture key는 pageId+contentRevision+renderScale+fontVersion 등 실제 무효화 조건을 포함한다. 데이터가 변하면 stale texture를 쓰지 않는다. font load 전 잘못된 기호를 굽지 않는다.

전이 전 현재/다음 앞뒷면 texture를 준비한다. 준비 실패 시 현재 페이지를 유지하고 재시도/2D를 제공한다. 전이 중 DOM은 시각적으로 숨기고 inert 처리한다. commit 후 같은 위치의 live DOM과 교체하여 flash·위치 jump·이중 글자가 없어야 한다.

page-local UV 사각형→월드→screen 매핑과 안전 영역을 명시한다. 네 모서리의 카메라 투영으로 homography 또는 동등 변환을 정하고 폰트·CSS pixel ratio·texture 해상도를 일치시킨다. 단순 축 정렬 bounding box에 DOM을 놓고 정합됐다고 하지 않는다. 전이 전후 모서리·오선 baseline의 위치와 scale jump를 검사한다. live DOM은 3D 물체와 겹치지 않는 배치를 기본으로 하며 불가피한 겹침은 명시 occlusion 검사를 한다. z-index 최고값으로 종이를 관통시키지 않는다. 뒤 페이지 DOM은 tabindex와 스크린리더에서 제외한다.

오선·음표·쉼표·덧줄·줄기·빔의 실제 SVG를 검수한다. C4·4/4·무부점 온음표부터 16분음표 범위를 우선하고 미지원 기호는 명확히 거부한다. notation minWidth 400을 페이지에 그대로 밀어 넣지 말고 확대 모드와 적절한 줄 배치를 사용한다. page turn texture의 뒷면이 거울인지도 검사한다.

키보드용 이벤트 목록은 한 번만 읽히고 원근 악보와 별도로 의미를 설명해야 한다. 정확한 기보와 시각 도식의 의미 일치, touch selection, 재생 강조, 200% 확대, texture/cache 해제를 회귀 검증하라.
~~~

**실패 시 수정**

~~~text
악보 의미 오류와 표면 배치 오류를 분리하라. 먼저 동일 revision SVG 자체를 정면에서 검사하고, 그 다음 UV·projection·font-ready·DOM swap을 점검하라. 텍스트가 떠 있거나 가려져야 할 글자가 보이면 페이지 전이 중 live DOM 노출부터 수정하라.
~~~

## 16 V12 모바일 터치와 접근성 전수 검수

**선수:** V09–V11.  
**산출물:** gesture owner 구현, 접근성 보고, 실제 기기 대기 목록.  
**수용 기준:** 페이지 넘김·실험·브라우저 제스처가 구분된다.

~~~text
V12만 수행하라. 설계서 11·17절의 owner 우선순위를 구현하고 실제 모바일 또는 명시된 에뮬레이션 환경에서 검증하라.

DOM 대화상자/입력/버튼 > scene 조작물 > page edge > 빈 면 순으로 첫 pointerdown owner를 고정한다. scene drag가 page edge로 가도 owner를 넘기지 않는다. pointerup/cancel/lostcapture/unmount/회전에서 반드시 해제한다. 두 번째 pointer는 앱 gesture를 취소해 pinch zoom을 방해하지 않게 한다.

초기값 edge 44–56px, activation 8px, 방향 우세 1.3, commit 페이지 폭 22% 또는 안쪽 속도 0.45px/ms는 제안값이다. 현재 viewport의 실제 투영 페이지 폭을 기준으로 보정하고 실기기에서 측정한다. 극단 screen edge와 safe-area는 브라우저 history 제스처에 양보한다.

전역 touch-action:none, user-scalable=no, 최대 확대 제한, 강제 fullscreen, orientation lock, CSS 90도 회전 금지. 필요한 로컬 touch-action은 공식 지원 범위를 확인한다. R3F를 도입했다면 capture가 DOM식 독점이 아님을 반영하고, 순수 Three라면 직접 raycast/DOM 소유권을 정리한다.

검수표:
- 844×390·667×375·568×320 가로, 주소창 있음/없음.
- 390×844·360×640 세로, 회전 없이 과제 완료.
- 200% 확대, 320 CSS px 상당 reflow, 악보 확대.
- keyboard only, ShiftTab, Escape, 입력 중 화살표.
- screen reader 읽기 순서, 페이지 commit focus, 숨은 페이지 제외.
- reduced motion 도중 설정 변경, 즉시 전이와 데이터 보존.
- 무음, 2D, 드래그 없이 분할, 작은 16분음표 선택.
- drag 중 회전·브라우저 scroll·pinch·pointercancel.

오류마다 기기/브라우저/viewport/행동/기대/실제/증거를 기록한다. 자동 접근성 검사 통과를 실제 보조기술 검수와 같다고 하지 마라. 실패를 글꼴과 버튼 축소로 해결하지 마라.
~~~

**실패 시 수정**

~~~text
가장 작은 실패 환경을 고정하고 owner, hit area 겹침, touch-action, scroll container, safe-area 중복, focus 복귀를 차례로 점검하라. browser 확대나 세로 사용을 막는 방식으로 충돌을 해결하지 마라. 동일 행동의 수정 전후 기록을 남겨라.
~~~

## 17 V13 나머지 네 펼침면 이식

**선수:** G1-A/B 객관적 통과 및 V09–V12 필수 계약.  
**산출물:** 펼침면 3–6과 음악 회귀.  
**수용 기준:** 책 구조를 유지한 음가 한 단원이 완성된다.

~~~text
V13만 수행하라. G1-A/B와 runtime 계약 통과를 실제 파일에서 확인한 뒤 기존 scene 3–6을 한 펼침면씩 이식하라. 이름만 페이지로 바꾼 탭 화면을 붙이지 마라. 기존 음악 reducer와 평가를 재사용하고 페이지별 입장·조작·퇴장·재방문을 명시한다.

펼침면 3: 목표는 1/2다. A는 4분음표만 2개, B는 8분음표만 4개, C는 2종류 이상이다. C의 1/4+1/4는 총 길이만 맞아 미완료이고, 1/4+1/8+1/8은 통과다. 동등한 답을 모두 인정한다. 부족·초과량은 기약분수로 표시한다.

펼침면 4: note/rest/note/rest 각각 1/4다. 쉼표도 시간 폭을 유지하고 재생선은 멈추지 않는다. 90 BPM 어택은 0과 4/3초다. note↔rest는 duration을 보존한다. 실험 중 내레이션이나 효과음이 쉼표를 덮지 않는다.

펼침면 5: 4분음표=60/120이다. 한 마디는 4초/2초이고 온음표:4분음표는 4:1이다. 정지 중에만 템포를 변경한다. 블록의 상대 폭과 음가 데이터는 변하지 않는다.

펼침면 6: 빈 4/4 draft에서 합 1, 음가 종류 2 이상, 쉼표 1 이상을 만족시킨다. 1/2 note+1/4 rest+1/8 note+1/8 note는 통과다. 4분음표와 4분쉼표만 있으면 종류는 1이다. 성공 후 조건을 깨뜨리면 현재 성공을 해제한다. 자유 설명을 자동으로 의미 채점하지 않는다.

각 펼침면은 짧은 질문, 페이지 인쇄 악보, 페이지에서 올라오는 실험, 페이지 안 조작, 보충 플랩으로 구성한다. 상시 좌측 패널·고정 하단 재생바·다중 카드를 복구하지 마라. 공간이 부족하면 설명 분량·페이지 내 확대·보조 열기를 조정한다.

완료는 학습 성과이지 다음 페이지 이동 허가가 아니다. 학습자가 앞뒤로 둘러볼 수 있어야 한다. 각 장면의 의미 테스트, entry→play→pause→exit, 재방문, 2D 동등성, 작은 가로 화면을 검증한 후 다음 장면을 이식하라. 기존 두 펼침면 G1 영상과 비교해 회귀가 없는지 확인하라. 원본 실동작 체감 비교가 아직 미검증이면 그 상태를 유지한다.
~~~

**실패 시 수정**

~~~text
새 펼침면을 추가하며 음악 규칙이나 책 셸이 변한 부분을 찾으라. 공통 구조와 scene 전용 데이터를 분리하고 기존 정답 기대값을 유지하라. 공간 문제를 대시보드 회귀로 해결했다면 해당 장면만 책 내부 구성으로 재배치한 뒤 G1 회귀를 확인하라.
~~~

## 18 V14 책갈피 힌트 교사 도구

**선수:** V13.  
**산출물:** 요청 시 열리는 보조 도구, 교사 안내, 의미 있는 완료 기록.  
**수용 기준:** 기능을 늘려도 책이 주인공이다.

~~~text
V14만 수행하라. 외부 모달 대신 책 안 보조 페이지·플랩을 사용하라. 목차·힌트·설정·교사 안내를 책 경험을 방해하지 않는 보조 경로로 연결하라. 상단 여섯 탭을 항상 보이게 하는 방식은 금지다.

목차 전용 책 안 인쇄 버튼은 요청할 때 목차 페이지를 연다. 좌우 가장자리 책갈피 이전/다음 버튼을 목차 버튼과 혼동하지 않는다. 현재 쪽과 완료 여부를 구분한다. 먼 쪽으로 이동할 때 여러 페이지를 무한히 연속 재생하지 말고 명시적인 짧은 jump 전이 정책을 문서화하라. 목적지 commit과 audio 정지 규칙은 일반 이동과 같다.

힌트 플랩은 페이지의 소형 종이가 힌지로 열리는 시각 표현과 DOM button을 같이 갖는다. reduced motion에서는 즉시 내용을 보인다. 플랩을 열었다고 정답 완료로 처리하지 않는다. 질문·힌트·정답 공개·교사 보기의 역할과 기록을 구분한다.

교사 보기에는 학습 목표·오개념·동등 정답·예상 질문·수업 운영을 제공한다. 로그인 없는 교사 보기는 보안 인증이 아니다. 학생 개인정보나 서버 분석을 추가하지 않는다. 교사가 정답을 공개해도 학생의 성취 기록이 올라가지 않게 한다.

책 안 설정/목차 플랩을 대화상자 시맨틱으로 구현할 때는 focus trap, Escape, 닫기 후 원래 책 안 버튼으로 복귀, 배경 inert를 갖는다. 시각적인 외부 오버레이는 만들지 않는다. 플랩 중 재생 기본은 정지다. 외부 UI는 크기와 무관하게 금지하며 모든 조작을 책 안으로 통합한다. 원본 플랩의 코드 구조와 실제 관측을 구별하고 아직 실기 동작을 보지 못했으면 그대로 적는다.

키보드·스크린리더·모션 줄이기·세로에서 모든 보조 기능을 확인하고 기본 책 화면 캡처를 다시 검수하라.
~~~

**실패 시 수정**

~~~text
보조 기능 때문에 외부 카드와 메뉴가 생겼는지 확인하라. 외부 관리 UI를 제거하고 책 안에 통합하되 접근 가능한 이름과 목표 크기는 유지하라. 교사 보기와 학생 성취가 섞인 경로를 회귀 테스트로 차단하라.
~~~

## 19 V15 성능 메모리와 장애 복구

**선수:** V13–V14.  
**산출물:** 실제 측정표, 자원 registry, 장애 회귀.  
**수용 기준:** 같은 페이지를 반복해도 자원이 무한히 늘지 않는다.

~~~text
V15만 수행하라. 설계서 18절의 초기 예산을 실제 기기·네트워크·build 조건과 함께 측정하라. FPS·전송량·지연 목표를 측정 전 달성값으로 쓰지 마라.

기본 한 Canvas와 한 context, 현재 scene 한 개, 인접 페이지 인쇄 texture 중심 prefetch를 유지한다. 모든 단원의 live mount는 금지한다. texture와 geometry/material은 소유권·캐시 상한·해제 정책을 갖는다. material.dispose가 texture까지 해제한다고 가정하지 마라. ImageBitmap을 사용하면 close도 확인한다.

idle에서는 RAF와 불필요한 poll을 쉬고 모션·오디오 재생 중 필요한 프레임만 요청한다. 매 프레임 전역 setState·VexFlow 전체 렌더·새 geometry 생성을 제거한다. DPR 1–1.5, 그림자 해상도·범위, texture 1024/2048 등을 실측 비교한다. 중요한 종이 곡률·앞뒷면을 제거해 성능 통과로 만들지 마라.

50회 왕복을 5회 묶음으로 반복하며 renderer.info의 geometry·texture·program과 앱 listener·timer·audio source 수를 기록하라. 내부 캐시가 남는 것과 왕복마다 계속 늘어나는 것을 구분한다. JS heap API가 없으면 미측정으로 표시한다.

실패 주입:
- WebGL 생성 실패, turn 중 context loss, play 중 context loss.
- 다음 페이지 texture 실패, 음악 font 실패, 오디오 resume 실패.
- 저장 quota/security 실패.
- 느린 prefetch 완료 전에 연속 next/prev/close.

모든 경우 audio 정지, 마지막 committed 학습 데이터 보존, 명확한 읽기 대체를 확인한다. 복구 루프를 무한 반복하지 말고 사용자 재시도를 제공한다. 복구 후 자동 소리는 금지한다. 3D 성능 지원 범위가 제한되면 정직하게 기록한다.
~~~

**실패 시 수정**

~~~text
누수와 캐시를 분리해 소유자별 생성·해제 수를 비교하라. 더 긴 timeout·강제 새로고침·무제한 캐시로 감추지 마라. 동일 반복 시퀀스에서 자원 수가 안정화되는 근거를 남기고 context loss 뒤 학습 상태와 소리 정지 여부를 재검증하라.
~~~

## 20 V16 원본 스타일 비교와 모션 교정

**선수:** 원본 관측 자료 또는 명시된 잠정 비교 기준, V15.  
**산출물:** docs/qa/MOTION_COMPARISON.md, 토큰 변경과 전후 영상.  
**수용 기준:** 원본과 같은 부분·다른 부분·미확인 부분을 설명할 수 있다.

~~~text
V16만 수행하라. V02의 관측표를 현재 자료로 업데이트하고 같은 입력 시퀀스의 원본과 v2를 나란히 비교하라. 원본 실동작을 아직 볼 수 없으면 동일하다고 결론 내리지 말고 G1-C 미검증을 유지한다. 승인 없는 사용자 PC 조작이나 원본 자산 추출은 하지 마라.

시퀀스는 closed→open→entry→page interaction→next→entry→prev→revisit이다. 직접 grab→drag→중간 정지→역방향→release/cancel도 별도로 확인한다. 원본이 그 직접 조작을 제공하는지 확인되지 않았다면 사용자 추가 요구의 구현 검증으로 구분한다. 같은 viewport 비율·캡처 fps·입력 방식을 가능한 맞추되 물리학과 음악의 콘텐츠 차이는 인정한다.

표지 힌지, cover stiffness, 페이지 곡률, 앞뒷면, 종이 두께, occlusion, contact shadow, 카메라 anchor, 입력 응답, 전이 시간감, easing 추정, entry/exit 연동, revisit을 각각 평가하라. 공개 코드 확인값과 실제 영상에서 측정한 값을 다른 열에 적는다. 캡처만으로 원본의 정확한 shader 수식을 확정하지 마라.

BookMotionProfile의 값을 한 번에 하나의 가설로 교정한다. 예를 들어 cover가 가볍게 보이면 duration/easing뿐 아니라 pivot·두께·camera·그림자의 영향을 분리한다. 음악 길이나 템포를 원본 모션에 맞추려고 바꾸지 마라.

자동 스크린샷은 같은 앱의 회귀에 사용하고 다른 콘텐츠인 원본과의 pixel 완전 일치를 목표로 삼지 않는다. 차이가 독자 콘텐츠, 접근성, 모바일 가독성, 권리, 성능, 불일치 중 어떤 이유인지 기록한다. 사용자의 주관적 수용이 확인되지 않았으면 그대로 남긴다.

실제 영상이 없는 동작은 정적 코드 확인 또는 초기 제안으로 표시한다. 최종 보고에서 독립 재현, 원본 코드 복사, 100% 동일을 혼용하지 마라.
~~~

**실패 시 수정**

~~~text
예쁘다는 주관적 칭찬 대신 실패한 책 동작 항목과 프레임을 특정하라. 원본과 다른 내용 때문인 차이와 실제 상호작용 차이를 분리하고 후자부터 모션 토큰·geometry·lifecycle로 고쳐라. 미관측 항목을 통과로 채우지 마라.
~~~

## 21 V17 통합 검수와 결함 종결

**선수:** V09–V16.  
**산출물:** QA_SUMMARY_V2, 결함 원장, 실제 테스트 증거.  
**수용 기준:** 필수 실패와 대기를 숨기지 않는다.

~~~text
V17만 수행하라. 설계서 20절의 BK/MU/AU/AC/RC/RG 전체 항목을 요구사항 추적표에 연결하라. 각 항목은 구현 경로, 테스트, 실행 환경, 결과, 증거, 담당 검수를 갖는다.

현재 package scripts를 확인한 뒤 lockfile 재현 조건에서 typecheck, lint, content:validate, unit/integration, build, E2E를 실행한다. 기존 음악 정답 기대값은 보존하고 v2로 인해 의도적으로 바뀐 UI 기대만 근거와 함께 갱신한다. 실패하는 테스트를 삭제하거나 skip해서 완료하지 마라.

실제 화면에는 커버 닫힘·열림, 턴 중간 프레임, 직접 drag의 정지·역방향·취소, 모든 펼침면의 ready/play/pause/exit, 뒤로 복귀, 세로·확대·모션 줄이기·2D를 포함한다. 실제 터치 기기, Safari/iOS, Android, speaker/headphone 청취, screen reader, 음악 교육자 검수를 각각 구분한다. 확보하지 못한 환경은 미실행이다.

심각도:
P0 데이터 손실·멈추지 않는 소리·진행 불가·심각한 기보/정답 오류.
P1 책 핵심 경험 부재·페이지 관통·직접 드래그 부재·입력 충돌·접근성 핵심 경로 실패·지원 기기 반복 중단.
P2 비핵심 미술·경미한 타이밍/문구 문제.

P0/P1은 완료 판정을 막는다. 재현→원인→최소 수정→회귀→동일 조건 재확인 순서로 처리하고 baseline 이미지 자동 갱신으로 실패를 감추지 마라. 외부 검수가 필요하면 정확한 기기·행동·증거를 준비하고 대기로 남긴다.

완료 수준을 분리하라.
A 개발 검증: 자동 검사와 허용 환경의 기능.
B 책 경험 검증: 실제 3D·직접 드래그 연속 시퀀스와 G1-A/B.
C 원본 체감 유사도: 실제 원본 관측 비교의 통과·불일치·미검증.
D 수업 시험 준비: 음악 교육자·실기기·청취·접근성 필수 검수.
E 공개 배포 가능 판단: 권리·지원 범위·위험 검토의 별도 결정.
A만으로 B/C/D/E 완료라고 보고하지 마라. 선택적 디자인 피드백을 반복해서 묻지는 않되 필요한 외부 권한은 생략하지 않는다.
~~~

**실패 시 수정**

~~~text
실패 로그와 현재 commit을 고정하고 영향이 가장 큰 결함부터 고쳐라. 전체 리팩터링과 무관한 버전 업그레이드를 피하라. 수정 후 같은 행동·기기·viewport에서 재확인하고 관련 음악·상태·시각 회귀를 실행하라. 미실행을 통과로 바꾸지 마라.
~~~

## 22 V18 인수와 다음 범위

**선수:** V17, 미해결 상태의 정확한 기록.  
**산출물:** 실행 가능한 인수 패키지.  
**수용 기준:** 다른 개발자가 실제 상태를 재현할 수 있다.

~~~text
V18만 수행하라. 배포하지 말고 인수 문서를 정리하라.

README: 실제 지원 범위, 로컬 실행, 기본 3D와 2D, 첫 표지 행동.
ARCHITECTURE_V2: Book/Scene/Transport/Lesson 분리, commit 경계, owner, cleanup.
CONTENT_AUTHORING_V2: spread/page/leaf/scene 매핑, 음악 schema, texture 캐시, 검증 명령.
MOTION_PROFILE: 관측/코드 기본값/v2 제안/채택값, 원본 차이와 이유.
QA_SUMMARY_V2: 실제 통과·실패·미실행·외부 검수 대기, 환경과 증거.
KNOWN_LIMITATIONS: 지원 기기·pause·기보·원본 미관측 등 실제 남은 범위.
ASSET_ATTRIBUTION: 독자 제작과 허가 자산의 출처·라이선스. Every Joule 자산을 안 썼으면 썼다고 기재하지 않는다.
HANDOFF_V2: 객관적 게이트, 선택적 사용자 피드백, 남은 차단 사항, 다음 최소 작업, 배포 별도 요청.

기존 v1 문서와 원본 자산은 보존하고 v2 경로를 명시한다. 테스트 수 증가·빌드 성공·URL 존재를 책 경험 완성의 근거로 대신하지 마라. 마지막 git diff에 사용자 변경, 비밀값, 대용량 임시 영상, 무관한 생성 파일이 섞이지 않았는지 확인한다.

최종 보고는 실제로 가능한 책 행동, 객관적 검증 범위, 음악·기술 증거, 원본 체감 미확인, 남은 외부 검수, 실행 방법 순으로 짧게 쓴다. 배포 URL을 지어내지 마라. 새 단원·서버·대량 영상 변환은 새 범위를 확정한 후에만 계획한다.
~~~

**실패 시 수정**

~~~text
인수 문서의 명령과 기능 설명을 실제 저장소에 대조하라. 구현 안 된 기능과 미실행 검수를 완료 목록에서 옮기고 정확한 제한을 써라. 다른 개발자가 로컬에서 책 시퀀스를 재현할 수 있는 증거와 명령을 보완하라. 외부 배포로 검증 부족을 덮지 마라.
~~~

## 23 반복해서 쓰는 보조 프롬프트

### R01 새 대화에서 이어가기

~~~text
v2 책 경험 작업을 이어간다. V00 계약을 다시 적용하고 실제 파일을 읽어라.
기준 설계서 v2와 프롬프트 v2
docs/IMPLEMENTATION_CONTRACT_V2.md
docs/BUILD_STATUS_V2.md
docs/REUSE_MAP.md
docs/REQUIREMENTS_TRACE_V2.md
docs/reference/MOTION_REFERENCE.md
docs/qa/BOOK_EXPERIENCE_GATE.md
docs/qa/ 아래 최신 결함과 증거

계속 구현할 권한 범위가 있는지 먼저 확인한다. git status와 diff를 확인하고 기존 사용자 변경을 보존하라. 이전 대화의 완료 문장보다 현재 코드·실제 테스트·객관적 게이트를 우선한다.
현재 실행할 단계: [V번호]
추가 사용자 지시: [내용 또는 없음]

마지막 통과 단계, 실패·대기 게이트, 다음 최소 작업을 복구하라. G1-A/B 증거가 없으면 확장을 멈추고 첫 두 펼침면 범위만 진행한다. C의 원본 체감 비교는 별도 상태다. 선택적 디자인 승인을 반복 질문하지 않는다. 이미 통과한 것을 다시 전체 생성하거나 의존성을 무조건 재설치하지 마라.
~~~

### R02 대시보드로 회귀했을 때

~~~text
현재 화면이 책 중심 요구를 어겼는지 감사하라. 상단 여섯 탭, 상시 좌측 설명 패널, 독립 실험·악보 카드, 고정 하단 재생바, 즉시 sceneId 전환을 찾아라.

색상과 radius만 바꾸지 말고 BookStage/SpreadSurface/SceneHost/PageSemanticLayer에 책임을 재배치하라. 음악 도메인·정답·오디오 시간·저장은 변경하지 않는다. 실제 커버→직접 페이지 drag→entry→play→exit→revisit 영상으로 개선을 증명하라. 책 배경 이미지만 넣은 수정은 완료가 아니다.
~~~

### R03 원본과 닮지 않았다는 피드백을 받았을 때

~~~text
사용자 피드백: [원문]
실패한 구간: [표지/페이지/장면/카메라/입력/전체]
참고 영상 또는 타임코드: [있으면 기입]

원본의 정적 코드 확인과 실제 관측을 구분해 v2 구현과 비교하라. 관측이 없으면 한계를 알리고 필요한 최소 영상이나 허가된 환경을 제안한다. 없는 자료가 없어도 수행할 수 있는 객관적 검증은 계속한다. 관측하지 않은 모션을 봤다고 말하지 마라.

핵심 경험 차이, 독자 콘텐츠 차이, 의도적 접근성 차이를 분리한다. 가장 큰 핵심 차이부터 한 번에 하나의 가설로 수정하고 같은 입력·viewport의 전후 영상을 제시한다. 원본 코드·에셋 복사로 빠르게 맞추려 하지 마라. 객관적 G1 실패가 생겼으면 관련 확장을 멈추고 고친다. 새 작업 범위를 만들지 않고 기존 허용 범위 안에서 진행한다.
~~~

### R04 재생이나 페이지 전이 오류를 받았을 때

~~~text
실패 행동: [정확한 순서]
환경과 commit: [값]
기대와 실제: [값]
로그 또는 영상: [경로]

같은 순서로 재현하고 BookState, SceneState, TransportState, owner, token, revision을 시간순으로 비교하라. 늦은 resume·load 완료, preparingTurn 중 손 떼기, 중복 commit, pointer capture 잔류, 미래 source 미정지, dispose 후 callback을 우선 검사한다.

재현 테스트→최소 수정→동일 시퀀스→관련 전체 회귀 순서로 진행한다. setTimeout 늘리기·상태 강제 초기화·데이터 삭제로 증상을 감추지 마라. 원인이 확정되지 않으면 가설과 다음 실험을 분리해 보고하라.
~~~

### R05 사람이 해야 하는 검수 패킷

~~~text
외부 연락·초대·공유 없이 검수 패킷만 준비하라.
음악 교육자: 여섯 펼침면의 질문·기보·정답·동등 답·오개념·판정식.
실기기 담당: cover/open/drag/hold/reverse/release/cancel/rotation/safe-area/scroll/pinch/context loss 시퀀스.
청취 담당: 1대4 어택, 쉼표, 60/120, stop 잔향, 늦은 음, pause/resume, 출력 장치.
접근성 담당: keyboard, screen reader, 200% 확대, reduced motion, 2D, 무음.
원본 비교 담당: 원본과 v2 나란히 보기, 정적 근거·실동작 차이·의도적 차이·미관측.

각 항목은 담당 역할, 입력, 절차, 기대, 실제 결과 빈칸, 증거, 날짜, 통과/수정/대기를 갖는다. 빈칸을 통과로 채우지 마라. 필요한 참가자 연락·개인정보·공개 공유는 별도 허용 범위를 확인해야 한다. 선택적 디자인 선호를 반복 질문하지 않는다는 원칙이 외부 권한을 대신하지 않는다.
~~~

## 24 고정 기대값과 퇴행 방지 요약

아래 항목은 구현을 편하게 하려고 바꾸지 않는다. 상세 테스트 ID는 설계서 20절과 연결한다.

| 구분 | 고정 기대 |
|---|---|
| 첫 진입 | 지원 WebGL 환경에서 닫힌 책, 자동 소리 없음 |
| 페이지 | front/back이 다른 실제 곡면, 도착 때 한 번 commit |
| lifecycle | 버튼은 exit 뒤 turn, 직접 drag는 충돌 없는 scrub exit 연동, audio stop은 먼저 |
| 빠른 입력 | 무한 queue 없음, 현재 scene/audio 최대 1개 |
| 뒤로 복귀 | 학습 데이터 보존, 소리 자동 재개 없음 |
| 음가 | 온음표 기준 1, 분수 정확 연산 |
| 분할 | 온음표→16개 16분음표, 합 1 |
| 첫 비교 | 90 BPM 각 8/3초, onset 0·2/3·4/3·2, 어택 1대4 |
| 쉼표 | 시간 진행, source 없음, 다음 onset 유지 |
| 템포 | 60/120 한 마디 4초/2초, 비율 4:1 |
| 음정 회귀 | C→D♯ 증2도, C→E♭ 단3도 |
| pause | 위치 유지, stop은 0, 미구현을 이름으로 감춤 금지 |
| 기보 | 동일 validated revision, 정확한 SVG, 원근 악보만 강요 금지 |
| 접근성 | 세로·키보드·2D·무음·확대·모션 줄이기 |
| 증거 | 실제 앱 영상·프레임·기기·commit, 미실행 분리 |
| 원본 | 관측 없는 수치 확정 금지, 코드/자산 복사 권한 추정 금지 |
| 확장 | G1-A/B 객관적 통과 전 나머지 장면 확장 금지, 새 범위·배포는 별도 허용 |

## 25 공식 기술 자료와 문서 상태

기술 검토일은 2026년 10월 27일이다. 구현 당일 현재 lockfile과 공식 문서를 다시 확인한다. 현재 저장소가 순수 Three.js인 사실을 존중하며, 아래 R3F 자료는 선택적 이관 또는 이벤트·성능 검토용이다.

- [Every Joule 공개 main 번들](https://iamtechartist.com/Apps/every-joule/assets/main-CpVTDnX_.js)과 [sound 모듈](https://iamtechartist.com/Apps/every-joule/assets/sound-vOpPkm07.js): 정적 구조·기본값 확인 근거. 원본 코드나 음원의 재사용 허가는 확인되지 않았다.
- [Every Joule 공식 소개](https://iamtechartist.com/every-joule/): 경험의 참고. 포스터와 소개만으로 실제 전이 검증을 대체하지 않는다.
- [Three.js BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html), [Material](https://threejs.org/docs/pages/Material.html), [자원 해제](https://threejs.org/manual/pages/how-to-dispose-of-objects.html): 종이 geometry·면·메모리 수명.
- [R3F 호환 안내](https://r3f.docs.pmnd.rs/getting-started/introduction), [이벤트](https://r3f.docs.pmnd.rs/api/events), [성능](https://r3f.docs.pmnd.rs/advanced/scaling-performance): 도입 시 실제 major 호환·전파·demand 렌더를 확인한다.
- [VexFlow 공식 API](https://vexflow.github.io/vexflow-docs/api/5.0.0/): 정확한 기보와 폰트 로딩. 예제의 alpha 문자열을 현재 버전이라고 가정하지 않는다.
- [Web Audio 권장 사항](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [currentTime](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime), [stop](https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/stop), [AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode): 사용자 시작·시간·취소·offset 재생.
- [Pointer capture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture), [touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action), [WebGL context loss](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event): 터치 소유권과 장애 복구.
- [동적 viewport 단위](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length), [모션 환경 설정](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion), [W3C 상호작용 모션](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html): 모바일과 동등 접근 경로.

이 문서는 후속 구현을 위한 실행 지시이며, 현재 앱의 수정 완료 보고서가 아니다. 원본 실제 상호작용 관측, G1-A/B 객관적 시제품 검증, 실제 기기·청취·음악 교육자 검수는 아직 수행해야 할 게이트로 남는다. 선택적 디자인 승인 질문을 반복하지 않으며, 원본 체감 유사도와 사용자 최종 수용의 미확인은 별도 기록한다.
