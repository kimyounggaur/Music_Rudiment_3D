# 첫 두 펼침면 1차 배포 범위

최신 체크포인트: [2026-10-28 16:14 UTC 원본 통합 검증](FIRST_RELEASE_INTEGRATION.md). 아래의 14:07 이전 소스·다운로드·수동 드래그 대기 기록은 이력이며, 최신 결과는 연결된 문서와 증거 JSON을 따른다. 원격 릴리스 성공은 실제 SHA·CI·READY 확인 전에는 선언하지 않는다.

2026-10-28 사용자가 배포 순서를 변경했다. **첫 두 펼침면의 필수 기능·회귀·실제 브라우저 QA를 완료한 뒤 GitHub commit/push와 기존 Vercel 1차 배포를 먼저 확인하고, 그다음 나머지 네 펼침면을 구현한다.** 이전 날짜의 ‘전체 여섯 펼침면 완료 후 공개’ 기록은 이 범위에서 대체된다. P0/P1 오류나 미확인 핵심 기능을 통과로 간주하지 않는다.

## 이번 버전

- 실제 제공 표지, 카메라 정렬, 열기/닫기, 실제 곡면 페이지와 책갈피·화살표·모서리 조작.
- 펼침면1: 온음표1개와 4분음표4개의 길이·시작 횟수 비교.
- 펼침면2: 온~16분음표 분할, 인접 병합, 선택, undo/redo, 재방문 시 같은 데이터.
- 책 내부 재생/일시정지/재개/정지·음소거·음량, 생명주기별 정지, 2D·움직임 줄이기.
- strict 저장·이관, 표지 이어보기/처음부터 둘러보기, 원문 보호, 미리보기/확정 가져오기, 앱 전용 삭제, JSON 텍스트 내보내기.

## 배포 전 진행 상태

| 범위 | 확인 상태 |
|---|---|
| G1-A/B 첫 두 펼침면 | 명시한 실제 Windows IAB 범위 통과; 과거 소스 체크포인트와 연결 |
| V09 오디오 / V10 저장 | 기술 계약 통과. 실제 청취와 주입한 예외는 구분 |
| 현재 V11/모서리 수정 소스 | 13:46 UTC257/257·lint·build·typecheck 통과,78파일 검사 전후 일치 |
| 기보 실패 복구 | 실제 renderer 실패 주입 후 2D 안내 및 같은 크기3D 재시도 성공 |
| 인쇄·입력·접근성·성능 회귀 | 스크롤 인쇄·실제 버튼 왕복·JSON/초안/스크롤 유지·native 입력 클릭 우선권 확인. 새 모서리 직접 드래그는 도구의 실행 거부로 대기, 모바일/접근성 전수·스트레스도 대기 |
| 파일 내려받기 전달 | CUA 연결 중단으로 불확실. 같은 요청을 중복 실행하지 않음; 유효한 JSON 텍스트 및 전체 선택은 별도 검증 |
| GitHub commit/push, 원격 CI, 새 Vercel READY/운영 흐름 | 미실행; 위 필수 QA 완료 후 수행 |

최신 검사 증거는 로컬 `output/qa-v2.1/r1-integrated-20261028-134614-summary.json`이며 fail/skipped/cancelled/todo는0이다. 앞선10:21 검사는 스크롤 수정 전,13:24 검사는 모서리 수정 전 이력이다. [표면·입력 기록](V11_SURFACES.md)에 실제 검사와 거부 상태를 구분했다. 원격 검증 결과나 미래 커밋 SHA를 미리 기입하지 않는다. 기존 기준 운영 배포는 [사전 조회](RELEASE_PREFLIGHT_V2.md)에 구분했다.

## 다음 배포 이후

음가 조합·쉼표·템포 비교·조건에 맞는 작곡의 펼침면3–6, 전체 책 목차/교사용 도구와 종합 QA를 이어서 구현한다. 기존 여섯 장면의 도메인과 저장 데이터는 이식 전에도 보존한다. 물리 기기 터치, 실제 청취, 실제 보조기술·교육자 수용 및 원본 체감 비교는 미완료 항목으로 명시한다.


## 2026-10-28 14:07 UTC - independent checks and manual handoff

The current source includes a new keyboard focus repair in LessonPages.tsx. A real merge/redo could disable its initiating button and drop native focus to BODY. After repair, native Enter follows merge -> enabled Undo, undo -> enabled Redo, redo -> enabled Split. This does not steal focus moved outside the control group.

Current full-source summary: output/qa-v2.1/r1-integrated-20261028-140635-summary.json, completed14:07:01.818 UTC:257/257, zero fail/skipped/cancelled/todo, lint/build/typecheck exit0,78 source fingerprints unchanged. The13:46 summary and13:54 ZIP are now historical, before this focus repair.

New actual UI evidence prefix r1-1793196104305 covers whole-to16 balanced splits, all16 real C4 noteheads/stems/ledger lines and four groups of two beam paths, last-note keyboard selection, merge/undo/redo and16 saved IDs after reload/resume.390x844 CSS viewport emulation has root width390/scroll width390 and44px event-list targets; native keyboard selection and editing worked. This is one emulated size, not the complete responsive matrix, native desktop zoom or physical phone touch.

MANUAL_DRAG_CHECK.md gives the user a minimal hold/reverse-cancel/complete/revisit check. The existing4183 server responds. The retained IAB is back at normal1280x720, first3D spread, spreadIdle/scene ready/prints ready/turn null/audio0. No automated drag retry was made after JavaScript execution was denied. Specific cause/reviewer identity absent; retry question and manual results pending. Existing JSON file-download delivery remains uncertain. No commit/push/remote CI/new deployment. Additional responsive/keyboard/audio/resource stress QA and the current moved-corner manual result remain before first deployment. Spreads3-6 remain deferred until that deployment.
