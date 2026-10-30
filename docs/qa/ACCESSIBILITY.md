# 접근성 검수

실제 file-origin Chromium148.0.7778.96에서 키보드48행동만으로 여섯 장면을 완료했다. pointerdown/mousedown/touchstart/AudioContext 생성0,9레인 관찰 text 기록, 저장 복구 확인. 별도로 modal Tab/ShiftTab/Escape·초점복귀, Enter 편집, OS reduced motion·설정, mode/viewport 전환,44px transport를 검사했다.

실제 악보 SVG에 순서·분수·음표/쉼표·pitch 텍스트 목록과 충분한 DOM 선택을 제공한다. SVG 내부 좌표를 정답으로 쓰지 않고 현재 이벤트 강조는 같은 ID를 소비한다. 글꼴 실패 시 텍스트 경로와44px retry, 성공 후 viewport 초점을 유지한다. 재생선을 매 프레임 aria-live로 읽지 않는다.

기본 HTML radio/checkbox/button/select/dialog를 사용하며 전체 전역 단축키가 글쓰기를 가로채지 않는다. 작은16분 블록의 길이를44px로 왜곡하지 않고 별도 목록을 쓴다. 무음 경로를 청음 능력 인증으로 표시하지 않는다.

대기: 실제 SR 읽기 순서, 터치 실기기,200% 확대 전체 경로, 전체 대비 수치,softkeyboard/safe-area 실제 동작. WCAG/AAA 인증을 주장하지 않는다. 증거는 output/playwright/keyboard-results.json과main/failure/quiz JSON 및스크린샷이다.

## v3 R3 인쇄 책과 접근성 거울 (2026-10-30)

v3 R3부터 3D 책의 페이지는 WebGL 인쇄 텍스처다(CONTRACT_V3 C3). 화면의 글자·버튼은 DOM이 아니므로, 활성 펼침면의 같은 내용과 같은 명령은 시각 숨김 **접근성 거울**(`src/book/print/AccessibleMirror.tsx`, `.book-mirror`)이 제공한다. 2D '크게 읽기' 책은 이전과 같은 HTML(`LessonPages.tsx`)이다.

**읽기 순서(펼침면마다).** 왼쪽 쪽 → 오른쪽 쪽. 각 쪽은 인쇄 순서 그대로다: `h1`(장면 제목, `tabIndex=-1`, 펼침면 진입 시 초점) → 질문·박자 정보 → 레인마다 악보 설명 문장(“위: 온음표 1개 악보: 1번째 온음표…”)과 음표 선택 목록(`ol > li > button[aria-pressed]`) → 조건·자기 확인 → ‘생각을 확인해요’ 접힘 단추(`aria-expanded`)와 펼쳤을 때 문항(`fieldset > legend` + `input[type=radio]`) → (오른쪽) 듣기 단추 묶음 → `h2` 실험 제목 → 그림 설명 → 장면 조작 묶음 → 상태 문장(`role=status`: 선택 음표, 평가 메시지, 피드백, 소리 오류) → ‘소리 없이 살펴보기’ 접힘.

**조작 규칙.** 거울의 모든 단추·라디오·체크박스는 인쇄 핫스폿과 **같은 명령 객체**를 실행한다(LessonCommand/재생 호출, `BookApp.runHotspot`). 비활성 조건(재생 중 편집·응답 금지 등)도 같은 배치 결과에서 나온다. 2D의 `data-testid`(`play-{lane}`, `pause-resume-audio`, `stop-audio`, `split-note`, `add-*`, `compose-*`, `tempo-timing`)를 거울 요소가 물려받는다. 악보 위 인쇄 음표는 포인터 전용 중복 대상이며(같은 명령), 키보드 경로는 음표 선택 목록이다.

**초점.** 거울 요소에 초점이 오면 그 핫스폿 둘레에 종이 위 초점 링(호박색 4 logical px, state 레이어)을 그린다(AX21: 초점은 보이는 책 안 목표에 귀속). 누른 단추가 스스로 비활성이 되면(예: 16분음표에서 ‘둘로 나누기’) 같은 조작 묶음의 다음 활성 요소로 초점을 옮긴다. 음표 목록·조작 묶음은 `data-book-instrument`로 방향키를 소유하고, 듣기 묶음과 제목에서는 ←/→가 쪽 넘김이다(2D와 같음).

**수명.** 거울은 `spreadIdle`의 활성 펼침면에만 있고, 넘김·닫기 중에는 DOM에서 사라진다(BK12). 장면 진입 중에는 `inert`. 2D 책에서는 거울이 없다.

**자동 검사.** `tests/hotspots.test.ts`(인쇄 조작 = 거울 조작, 2D test id 보존, 제목·라이브 문장·instrument 묶음), `scripts/book-v3-e2e.ts`(거울로 문항 응답, Tab 초점 링, 거울로 분할 10회, BK12 프레임 표본). 결과는 `docs/qa/refactor/R3/e2e-*.json`.

**미실행(사람 검사, R9).** 실제 스크린리더(NVDA·VoiceOver·TalkBack)의 읽기 순서와 숨김 거울 탐색, 200% 확대, 터치 실기기. 인쇄 핫스폿 크기는 기본 읽기 포즈에서 24 px 미만이며(CONTRACT_V3 B5 개정), 같은 기능을 44 px 조작(조작바, 2D 책)과 키보드 거울로 제공한다.
