# v3 계약 개정 (CONTRACT_V3)

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-30, 구현 에이전트(R0 = V3-00) |
| 설계 근거 | [REFACTOR_DESIGN_V3.md](REFACTOR_DESIGN_V3.md) §6 R0, [REFACTOR_PROMPTS_V3.md](REFACTOR_PROMPTS_V3.md) §1 P00 |
| 설계 기준 커밋 | `4f3111a5de4c40bad2ac6f79aaabe96727e90a96` (두 펼침면) |
| 실제 착수 커밋 | `5f2f7bb2b12820f955fc1fdb7503ba017c858641` (2026-10-29 14:05 KST, "complete six interactive music textbook spreads") |
| 작업 브랜치 | `refactor/v3-ink-book` |

v2.1 계약([design-v2.1](source/design-v2.1.md), [prompt-v2.1](source/prompt-v2.1.md)) 중 아래 C1–C12로 개정하지 않은 조항은 그대로 유효하다. v2.1 원문은 수정하지 않는다.

## 1 개정 조항 C1–C12

| ID | v2.1 원문 위치 | v3 개정문 | 근거 | 적용 단계 |
|---|---|---|---|---|
| C1 | BOOK-ONLY "책 바깥 navigation·toolbar·재생바 금지", §6.1 "외부 UI 0개", §4-8 | **BOOK-FIRST**: 책 밖에는 **하단 한 줄 조작바**만 허용. HUD·토스트·대시보드·탭·상시 재생바 금지는 유지. 조작바 높이 ≤ 56 px, safe-area 안. 기록·설정 대화상자는 조작바에서 여는 모달로 C1 범위에 포함 | D4. 원본은 외부 하단 조작부(REF09 관측). 44 px 버튼을 페이지 안에 넣으면 인쇄물이 될 수 없음 | R5 |
| C2 | BOOK-ONLY "배경은 무늬 없는 중립색과 접촉 그림자만, 책상 소품·장식 모델 없음" | 책상 면·매트·환경 조명 반사 허용. 책 외 **소품(펜·컵 등) 금지** 유지 | D8. 원본 책상·매트 관측(REF10). 종이 조명은 환경 반사 없이는 밋밋함 | R2 |
| C3 | §12.2 "정지한 펼침면에서는 page-local DOM/SVG로 표시", "DOM을 네 모서리 homography로 정합" | **모든 페이지는 인쇄 텍스처**. DOM은 시각 숨김 **접근성 거울**로만 존재. §12.3(접근성 정본·읽기 순서·focus 안정)은 유지 | D1·D2·D3의 공통 원인이 HTML 겹침 | R3 |
| C4 | §6.3 "학습 카메라는 고정 사선", "자동 카메라 회전 금지" | **읽기 포즈 고정 + 사용자가 시작한 연출 샷 허용**. 넘김·드래그·닫기 중 샷 금지 유지. 샷 종료 포즈 = 읽기 포즈(오차 0). 재생 시작 자동 샷은 설정 옵션, 기본 끔(결정 5) | D7. 원본 레슨별 카메라 샷(설계서 부록 A) | R6 |
| C5 | §6.3 "perspective FOV 약 30–38도"(제안) / `BOOK_VISUAL_SPEC.md` "Use an orthographic camera" | **원근 카메라 필수**, FOV 30–34°, 고도각 52–62°. 직교 카메라 금지를 명시 | D1 | R1 |
| C6 | §15.1 "DurationScene3D·durationWorld 재사용: renderer를 책 stage로" | 재사용 범위를 **의미(`durationBounds`, raycast 대상, setEvents/setHighlight/setPosition 계약)**로 한정. 표현은 잉크 그림 시스템 | D5 | R4 |
| C7 | §7.4 "후처리는 장식 옵션", §6.2 "종이 질감은 약한 변화만" | 종이 재질·조명·AO·비네트를 **정체성 항목**으로 승격. 저사양 티어에서 단계적 축소 허용 | D2·D8 | R2 |
| C8 | §13.3 "효과음 기본 없음" | 절차 합성 효과음 **기본 켬**(결정 2), 조작바 '소리'로 끔. 학습 음악 음소거와 같은 스위치로 함께 끄고, 세부 분리는 기록·설정에서. 음악 재생 중 효과음은 종이·표지만(펜 소리 억제). 첫 사용자 제스처 전 무음 | D9 | R7 |
| C9 | EDGE-NAV "책에 부착된 책갈피 버튼" | 조작바 이전/다음으로 **대체**(결정 1). **모서리 직접 드래그는 그대로 필수**. ArrowLeft/Right 동일. 첫 펼침면 이전 = 표지로(CLOSE_BOOK), 마지막 다음 = disabled 유지 | 책갈피+조작바 중복은 혼란 | R5 |
| C10 | §19 "C는 체감 유사도, 미검증이어도 A/B 통과로 진행" | **G1-C 차단 관문**: 설계서 부록 B 13항목 중 정체성 5항목(원근 카메라, 종이 조명·곡면, 잉크 그림·떠오름, 조작부 위치, 연출 샷)이 `불일치`이면 확장·배포 금지. `미관측`은 통과가 아니다 | D11 | R9 |
| C11 | §6.1 "펼침면 투영 폭 88–94%" | 원근 기준 **70–85%**(책상 여백 포함) | 원근+책상 | R1 |
| C12 | §8.5 "음가 블록은 종이 도식에서 접혀 올라온 듯" | "**평면 투영에서 입체로 보간 + 펜 그리기**"로 구체화. 세로 scale 금지 | D6 | R4 |

## 2 사용자 결정 기록

2026-10-30 11:09 KST 사용자 지시: "마크다운 파일 속의 설계 내용 그대로 단계적으로, 나한테 물어보지 말고 스스로 승인하면서 개발해줘." 따라서 설계서 부록 C의 권장값을 **자체 승인**으로 채택한다. 사용자가 나중에 다른 답을 주면 해당 단계의 토큰·조항만 바꾼다.

| # | 질문 | 채택 | 상태 | 반영 위치 |
|---|---|---|---|---|
| 1 | 책갈피(EDGE-NAV)를 조작바 이전/다음으로 대체? | 대체 | 자체 승인(사용자 위임) | C9, R5 |
| 2 | 효과음 기본 켬? | 켬. 조작바 '소리'가 음악·효과음을 함께 끔 | 자체 승인(사용자 위임) | C8, R7 |
| 3 | 책상 질감 | 리넨(절차 생성). 원본의 나뭇결과 의도적 차이 | 자체 승인(사용자 위임) | R2 |
| 4 | 서체 | 본문 Pretendard(OFL-1.1, npm `pretendard@1.3.9`), 제목 Noto Serif CJK KR(OFL-1.1). 둘 다 사용 문자 서브셋 WOFF2로 번들. 서브셋은 OFL상 수정본이라 예약 글꼴 이름을 쓰지 않도록 **Book Sans**(Pretendard 파생)·**Book Serif**(Noto Serif CJK KR 파생)로 이름을 바꿔 번들한다(R3, 원 저작권·라이선스 레코드 유지, `public/licenses/book-page-fonts.txt`) | 자체 승인(사용자 위임) | R3 |
| 5 | 재생 시작 시 자동 샷 | 끔(설정 옵션) | 자체 승인(사용자 위임) | C4, R6 |
| 6 | 원본 화면 녹화 제공 | **미제공**. G1-C 정체성 항목 중 원본 실동작 비교가 필요한 부분은 `미관측`으로 남는다 | 사용자 자료 없음 | R9 |

## 3 착수 기준과 설계서 사이의 편차

설계서는 `4f3111a`(두 펼침면) 기준이다. 착수 시 `main`은 `5f2f7bb`로 한 커밋 앞서 있었다(같은 저자, 2026-10-29 14:05 KST). 차이와 처리:

| # | 편차 | 처리 |
|---|---|---|
| B1 | `5f2f7bb`에서 이미 여섯 펼침면(장면 1–6)이 HTML 경로로 구현됨(`manifest.ts` 6개, `LessonPages.tsx` 장면별 조작, `book-v13.test.ts` 323행) | R3·R4는 처음부터 여섯 펼침면 전체를 대상으로 한다. R8의 범위는 **목차·마침 펼침면 + GO_TO 다중 잎 + 장식 그림**으로 줄어든다 |
| B2 | 설계서 §4 원칙 2는 `renderer: 'legacy' \| 'ink'` 두 경로를 같은 파일 안에서 분기하도록 적었다 | 분기 대신 **`src/legacy/`에 착수 커밋의 책 셸을 고정 사본**으로 두고 `?renderer=legacy`일 때 그 사본을 지연 로드한다. 새 경로는 사본을 건드리지 않고 자유롭게 바뀐다. 전후 비교 캡처의 before는 이 사본으로 만든다. R9에서 `src/legacy/`를 통째로 삭제한다 |
| B3 | 작업 컨테이너의 Node는 22.23.4, `package.json` engines는 `>=24.14.0 <25` | engines는 바꾸지 않는다. 로컬 검사는 Node 22(타입 제거 기본 켬)로 실행하고, 브랜치 push 시 GitHub Actions(Node 24.14.0)의 typecheck·lint·test·build 결과를 함께 기록한다 |
| B4 | 기존 e2e 스크립트(`keyboard-e2e.ts`, `quiz-e2e.ts`, `http-e2e.ts` 등)는 특정 산출물 SHA256과 Windows Chromium 경로에 고정된 과거 증거 스크립트다 | 수정하지 않고 과거 증거로 보존한다. v3 동작 검증은 새 `scripts/refactor-capture.ts`(R1, R9에서 `visual-baseline.ts`로 확장)와 `scripts/book-v3-e2e.ts`가 맡는다 |
| B5 | 설계서 R3는 페이지 핫스폿을 "모든 화면에서 44 px 이상"으로 적었다. R0에서 "1280×720 44 px 목표, 모든 지원 크기 24 px 이상"으로 1차 개정했다 | **R3 실측으로 재개정.** 기본 읽기 포즈에서 펼친 쪽 하나의 화면 크기는 약 300×437 px(1280×720), 160×230 px(844×390), 140×190 px(390×844)다. 활성 인쇄 핫스폿의 가장 작은 변은 10.5 / 5.5 / 4.6 px로 24 px에도 못 미친다(`docs/qa/refactor/R3/metrics.json`). 2D와 같은 내용·조작을 한 쪽에 인쇄하는 한 물리적으로 확보할 수 없다. 그래서 인쇄 핫스폿은 **최소 크기를 요구하지 않는 포인터 편의 대상**으로 두고, WCAG 2.2 2.5.8의 '동등한 조작' 예외에 따라 같은 기능을 같은 화면에서 항상 함께 제공한다: ① 조작바(책 밖, 44 px) '크게 읽기'로 여는 2D 책 — 모든 조작 44 px, ② 접근성 거울의 키보드·보조기술 조작, ③ R6 '쪽 가까이 보기' 샷(계획). 표지·이전/다음·조작바 단추는 44 px다. 모드 전환으로 제공하는 동등 조작이라는 해석은 R9 사람 검수 항목이다 |
| B6 | 설계서 §3.1과 R3 완료 기준은 본문 x-height ≥ 7 px(1280×720), ≥ 5.5 px(844×390)이고, "본문 = 쪽 세로의 1.55% → 1280×720에서 약 9.5 px x-height"로 계산했다 | **실측 미달, 기록 후 안내 인쇄.** 본문 26 logical(쪽 세로의 1.77%), Book Sans(Pretendard) x-height 0.530 em에서 본문 글자는 7.7 / 4.0 / 3.3 px, x-height는 **4.1 px(1280×720), 2.1 px(844×390), 1.8 px(390×844)**다. 설계서의 9.5 px는 쪽이 화면에서 약 1,170 px 높이일 때만 성립하는 계산 오류다(실제 쪽 화면 높이 약 437 px). 7 px에는 본문을 약 1.7배(쪽 세로의 3%)로 키워야 하고, 그러면 한 쪽 내용이 2–3쪽 분량이 된다. 프롬프트의 실패 시 규칙대로 해상도(settled 1280)·anisotropy(8)·여백을 먼저 검토했으나 이들은 선명도만 바꾸고 화면 크기를 바꾸지 못한다. 설계서가 허용한 대로 **모든 왼쪽 쪽 아래 여백에 '크게 읽기' 안내를 인쇄**하고(`READING_HINT`), 3D에서의 읽기 크기는 R6 '쪽 가까이 보기' 샷으로 확보한 뒤 다시 측정한다 |

## 4 유지 불변식과 검사 위치

| ID | 내용 | 검사 |
|---|---|---|
| CI01 | 표지 UV 중앙 오차 ≤ 2 CSS px | `tests/book-camera-rig.test.ts`(R1, anchorErrorPx ≤ 0.5), 캡처 `metrics.json`의 `coverCenterErrorPx` |
| CI02 | 안전영역·반응형, 넘김 실루엣 crop 없음 | `tests/book-camera-rig.test.ts`(5 viewport + 비대칭 safe-area), 캡처 turn50 |
| CI03 | skip/reduced/hide/실패 복구, OPEN 중복 없음 | `tests/book-controller.test.ts`(SKIP_INTRO, HIDE_DOCUMENT, WEBGL_LOST) |
| EN02 | 방향키 소유권·큐·modifier/IME/repeat | `tests/book-gesture.test.ts`(arrowNavigationDirection), `tests/book-controller.test.ts`(pendingIntent) |
| BK05–07 | leave→turn→arrive, snapshot/revisit | `tests/book-scene-host.test.ts`, `tests/book-controller.test.ts`, `tests/book-v13.test.ts` |
| BK13–16 | 직접 drag·hold·reverse·release·cancel·lostcapture | `tests/book-controller.test.ts`, `tests/book-turn-hit.test.ts`, `tests/book-gesture.test.ts`, 사람 검사(실기기 터치) |
| MU01–08 | 정확 분수·분할·조합·쉼표·템포·작곡 | `tests/domain.test.ts`, `tests/lesson.test.ts`, `tests/book-v13.test.ts`, `tests/duration-world.test.ts`(legacy 세계), `tests/duration-figure.test.ts`(R4 잉크 그림: 의미 6개 이전) |
| AU01–07 | 단일 context·예약·정지·pause/resume | `tests/audio.test.ts`, `tests/audio-transport.test.ts`, `tests/book-audio-ownership.test.ts` |
| RC01–05 | context loss·자산 실패·자원 수명·저장 | `tests/book-controller.test.ts`(WEBGL_LOST), `tests/book-scene-host.test.ts`, `tests/book-progress.test.ts`, `tests/persistence.test.ts`; 50회 왕복 누수는 R9 `scripts/perf-budget.ts` |
| AX21 | 키보드·스크린리더·200%·2D·reduced, focus는 보이는 책 안 | `tests/hotspots.test.ts`(인쇄 조작 = 거울 조작, 2D test id, 제목·라이브 문장), `scripts/book-v3-e2e.ts`(Tab 초점 링이 state 레이어에 그려짐), 사람 검사(보조기술 실기는 `외부 검수 대기`) |
| BK12 | 넘김·닫기 중 쪽 DOM 없음 | `scripts/book-v3-e2e.ts`(넘김 프레임 표본에서 거울 0) |
| C3 | 3D 쪽은 인쇄 텍스처, HTML 겹침 0 | `scripts/book-v3-e2e.ts`·캡처 `metrics.json`(`htmlPageElements` = 0) |
| AC05 | 16분음표 16개도 고를 수 있는 대체 조작 | `tests/print-layout.test.ts`(16칸 음표 목록), 거울 `ol > li > button` |
| 같은 revision | 인쇄·그림·소리·평가가 같은 `LessonState`에서 파생 | `tests/print-layout.test.ts`(분할 뒤 인쇄 음표 = `sceneEvents`), `tests/print-compositor.test.ts`(인쇄 키 = 장면 상태 식별) |
| 인쇄 메모리 | 인쇄 창 텍스처 ≤ 48 MiB, 왕복 누수 0 | `tests/print-compositor.test.ts`(티어별 예산, 20회 왕복), `scripts/book-v3-e2e.ts`(실제 앱 20회 왕복) |
| 활성 1개 | 활성 장면·오디오 세션 최대 1개 | `tests/book-scene-host.test.ts`, `tests/book-audio-ownership.test.ts` |
| C6·C12 잉크 그림 | 의미는 `durationWorld`에서 import(x = onset×10, 폭 = 길이×10, 높이·깊이 고정), 피킹은 일어선 위치의 투명 상자(lift 0/1 동일), 쉼표는 면 없는 점선, 세로 scale 없이 평면도→입체 보간 + 펜 그리기 | `tests/duration-figure.test.ts`, `tests/figure.test.ts`, `tests/book-lesson-scene.test.ts` |
| 데이터 먼저 | 분할·합치기는 데이터가 바로 바뀌고 그림만 240 ms 획으로 보간 | `tests/duration-figure.test.ts`, `scripts/book-v3-e2e.ts`('R4: split draws…') |
| 잉크 선 폭 | 화면 1.2–1.6 px, 거리 무관(정확한 폭의 안티앨리어싱) | `tests/ink-lines.test.ts`(셰이더), `scripts/figure-capture.ts`(캡처에서 FWHM 측정, 400% 크롭) |
| 그림 예산 | 그림 ≤ 3,000 세그먼트, 장면 ≤ 6,000, 장식 ≤ 400, 장면 draw call ≤ 40 | `tests/book-lesson-scene.test.ts`, `tests/duration-figure.test.ts`, `scripts/book-v3-e2e.ts`, 캡처 `metrics.json`(`figure.calls`) |
| 그림 창 | 레인·숫자·장식을 합친 그림이 인쇄 쪽의 그림 칸 안에 들어감 | `tests/book-lesson-scene.test.ts`(여섯 장면, 읽기 포즈의 올라선 윗면 포함) |
| C1 조작바 | 책 밖 버튼은 하단 조작바(와 표지 조작)뿐, 높이 ≤ 56 px, 책 화면 범위(bookBounds)와 교차 0, 표지에서는 숨기되 자리는 유지 | `scripts/book-v3-e2e.ts`('R5: one toolbar…', 'R5: the book never sits under…'), 캡처 `metrics.json`(`extra.chrome`) |
| C9 넘기기 | 첫 펼침면 이전 = 표지로(CLOSE_BOOK), 마지막 다음 = 비활성, 조작바 위 누름은 모서리 드래그를 시작하지 않음, ArrowLeft/Right | `tests/book-turn-hit.test.ts`(조작바·기록 대화상자 소유권), `scripts/book-v3-e2e.ts`('R5: next is disabled…', 'R5: prev on the first spread…', 'R5: ArrowRight / ArrowLeft…') |
| EN02 모달 | 기록 대화상자가 열린 동안 책은 방향키를 받지 않고, 닫으면 초점이 '기록'으로 돌아옴 | `scripts/book-v3-e2e.ts`('R5: records dialog is modal…') |
| 플랩·도장 파생 | 정답 플랩 열림 = `hints[\`${sceneId}/answer\`]`, 도장 = 저장된 답이 모두 정답. 새 저장 필드 없음. 덮인 자리는 열림·닫힘과 무관하게 같은 자리 | `tests/print-layout.test.ts`, `tests/flap-layer.test.ts`, `scripts/book-v3-e2e.ts`('R5: three right answers…', 'R5: answer flap lifts…', 'R5: a press on the standing paper…') |
| 넘김 중 카메라 불변 | 드래그·넘김·닫기 중 카메라 이동 없음 | `tests/book-camera-rig.test.ts`(suspendFit), R6 `tests/shots.test.ts` |

## 5 고정 수치(설계서 부록 D, 제안값)

부록 D의 초기값으로 시작한다. 캡처로 측정한 뒤 범위 안에서 조정하며, 조정값과 이유는 [BUILD_STATUS_V3.md](BUILD_STATUS_V3.md)에 기록한다.
