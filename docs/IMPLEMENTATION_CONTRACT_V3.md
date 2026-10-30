# v3 구현 실행 계약 (IMPLEMENTATION_CONTRACT_V3)

이 파일은 [IMPLEMENTATION_CONTRACT_V2.md](IMPLEMENTATION_CONTRACT_V2.md)를 대체하지 않으며, v3 리팩토링 세션(R0–R9)에만 추가로 적용된다. 원문은 [REFACTOR_PROMPTS_V3.md](REFACTOR_PROMPTS_V3.md) §1 P00이다.

착수 기준과 편차(여섯 펼침면 선행 구현, legacy 고정 사본, Node 22 로컬 검사, 과거 e2e 보존, 인쇄 핫스폿 최소 크기)는 [CONTRACT_V3.md](CONTRACT_V3.md) §3에 있다. 2026-10-30 사용자 지시에 따라 단계 판정과 부록 C 결정은 구현 에이전트가 자체 승인한다. 되돌릴 수 없는 결정(사용자 데이터 삭제, 저장 스키마 이관, 외부 배포)은 계약 13항에 따라 근거를 남기고 보수적으로 처리한다.

## P00 원문

~~~text
P00을 적용하라. 이것은 단계가 아니라 이 세션 전체에 걸리는 고정 계약이다. 적용했다고 보고한 뒤 다음 메시지의 단계 블록을 기다려라.

[읽기] 실제 파일을 읽고 추정으로 채우지 마라.
- docs/REFACTOR_DESIGN_V3.md (리팩토링 설계서 v3.0) — 이번 단계의 §6 절과 §2 진단표, §4 보존/수정/교체/삭제 표, 부록 B·C·D
- docs/REFACTOR_PROMPTS_V3.md §1, §5, §6, §7
- docs/CONTRACT_V3.md, docs/IMPLEMENTATION_CONTRACT_V3.md, docs/BUILD_STATUS_V3.md (R0 이후 존재)
- docs/source/design-v2.1.md, docs/source/prompt-v2.1.md 중 이번 단계가 개정하거나 유지하는 조항
- git status, git log -1, git diff --stat. 기준 커밋 4f3111a5de4c40bad2ac6f79aaabe96727e90a96과 다르면 차이를 요약하고 사용자 변경을 보존하라.
- node -v, npm -v. package.json engines(>=24.14.0 <25)와 다르면 기록만 하고 engines를 바꾸지 마라. 의존성은 lockfile 기준 npm ci. 설치 불가면 docs/DEPENDENCY_INSTALL.md를 읽고 미실행으로 남겨라.
- 세션 시작 baseline: npm run typecheck && npm run lint && npm test && npm run build 를 실행해 결과를 기록하라. 이미 실패하는 것과 이 세션에서 새로 깨지는 것을 구분하기 위한 기준이다.

[고정 계약]
1. 목표는 "책 모양 웹앱"을 "원근·조명·인쇄 텍스처·잉크 그림·책 밖 조작바·연출 샷을 가진 3D 책"으로 바꾸는 것이다. 음악 의미(기약분수 음가, onset, C4=MIDI 60, 4/4, 90 BPM, 정확한 기보), 오디오 정지 규칙, 학습 상태·undo/redo, 저장 원문 보호, 책 상태 머신(bookReducer), SceneHost의 토큰·정리 규칙은 바꾸지 않는다.
2. 범위는 src/book/**, src/scenes/**, src/styles/**, src/content/pages/**, docs/**, tests/**, scripts/** 다. src/domain/**, src/lesson/**, src/notation/**의 의미 로직과 src/audio/**(R7 효과음 채널 제외), src/persistence/**(R7·R8 스키마 이관 제외)는 수정하지 않는다. 이 영역의 테스트는 무변경 통과가 필수다.
3. 보존 모듈(설계서 §4 표 '보존' 행: controller.ts, SceneHost.ts, gesture.ts, turnHit.ts, manifest.ts(확장만), useBookAudio.ts, useBookProgress.ts, BookProgressSession.ts, learningProgress.ts, audioOwnership.ts, motion.ts(토큰 추가만))의 export 서명을 바꾸지 마라. 설계서가 명시한 최소 변경(R6 SHOT_*, R8 GO_TO)만 예외다.
4. 플래그 공존: src/book/profile.ts의 BOOK_PROFILE.renderer는 'legacy' | 'ink' 이며 URL ?renderer=legacy 로 바꾼다. R1부터 기본값은 'ink'다. R9 전까지 두 경로가 모두 빌드되고 legacy 경로의 e2e가 통과해야 한다. 새 렌더 코드는 renderer==='ink' 분기 안에만 둔다.
5. 한 번에 하나의 가설. 이번 단계가 바꾸는 시각 가설 하나만 바꾼다. 같은 viewport(1280×720, 844×390, 390×844)·같은 상태·같은 renderer의 전후 캡처를 docs/qa/refactor/R{n}/before/ 와 after/ 에 남기고 metrics.json을 만든다(§5 규약). 캡처 없이 "보기 좋아졌다"고 쓰지 마라.
6. 정본은 음악 데이터다. 인쇄 텍스처·잉크 그림·소리·평가는 모두 같은 LessonState.revision에서 파생한다. 픽셀이나 투영 좌표로 정답을 계산하지 마라.
7. 접근성은 거울로 유지한다. 시각 페이지가 텍스처가 되어도 활성 펼침면의 텍스트·버튼·선택지는 시각 숨김 DOM 거울(AccessibleMirror)로 같은 명령을 보낸다. 2D 읽기 경로(fallback2D, .book-app--2d)의 학습 동등성을 줄이지 마라.
8. 금지: 원본 Every Joule의 번들·텍스처·모델·폰트·음원·문장을 내려받거나 변환해 넣지 마라(설계서 부록 A는 범위 참고일 뿐 목표값이 아니다). 사용자 요청 없는 push·배포·외부 공유·권한 변경 금지. 실패 테스트의 삭제·skip·기대값 수정으로 통과시키지 마라. 미실행을 통과로, headless를 실기기로, 무음 캡처를 청취로 쓰지 마라. 새 런타임 의존성(R3F·GSAP·XState·WebGPU 등) 금지. three/examples/jsm 모듈은 설치된 패키지 안이므로 허용.
9. 유지할 불변식(회귀 금지): v2.1 CI01–03, EN02, BK05–07, BK13–16, MU01–08, AU01–07, RC01–05, AX21. 넘김·드래그 중 카메라 불변. 활성 장면·오디오 세션 최대 1개. 이 중 하나라도 회귀하면 단계를 통과로 쓰지 말고 먼저 고쳐라.
10. 수치는 설계서 부록 D의 초기값으로 시작한다. 제안값이지 실측이 아니므로 캡처 측정 뒤 조정할 수 있고, 조정값과 이유를 BUILD_STATUS에 남긴다.
11. 문서 충돌은 다음 순서로 푼다: 이 세션의 새 사용자 지시 > docs/CONTRACT_V3.md(R0 개정 C1–C12와 결정 기록) > 설계서 v3.0 > v2.1 계약 중 개정되지 않은 조항 > v1 음악 의미. 결정 이유를 남기고 사용자 명시 요구를 조용히 삭제하지 마라.
12. 보고는 docs/BUILD_STATUS_V3.md에 §0.4 양식(14줄)으로 쓴다. "작성됨·미실행", "headless 통과", "실기기 통과", "사람 승인"을 구분한다.
13. 질문 정책: 선택적 디자인 승인을 반복해서 묻지 마라. §7 결정 기록표가 비어 있으면 권장값을 '잠정'으로 채택하고 기록하라. 되돌릴 수 없는 결정(파일 삭제, 저장 스키마 이관, 폰트 라이선스 채택, 사용자 PC 설정 변경)만 멈추고 물어라.
14. 세션 종료 전 §0.3 체크리스트를 모두 통과하라. 통과하지 못한 항목이 있으면 상태를 '일부 완료'로 쓰고 다음 단계로 가지 마라.
~~~
