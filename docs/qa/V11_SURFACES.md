# V11 페이지 인쇄·입력 보강 기록

최신 체크포인트: [원본 통합 검증](FIRST_RELEASE_INTEGRATION.md). 15:49 UTC 사용자 잡기·끌어서 넘기기 확인, 실제 JSON 다운로드 대조, 272개 검사 및 390px 책갈피 경계 회귀가 추가됐다. 아래의 이전 소스·대기 기록은 삭제하지 않고 이력으로 보존한다. 자동 드래그 거부 경로는 재실행하지 않았다.

2026-10-28. **진행 중이며 배포 전 전체 QA 통과 판정이 아니다.** 최신 소스 검사는13:46 UTC257/257·lint·build·typecheck exit0,78개 파일의 검사 전후 일치다. 실제 실행은 Windows의 전용 IAB localhost:4183에서 했으며, 원본 G1의 옛 소스 결과를 현재의 모든 기능에 승계하지 않는다.

## 수정과 실제 확인

- 기보 렌더 요청의 identity/revision/재시도 epoch를 연결했다. 이전 요청의 늦은 성공/실패는 새 revision의 결과가 되지 않는다. 현재 렌더 실패는 인쇄 준비의 무기한 대기와 구분해 기존2D 복구로 보낸다.
- `Stave.draw` 예외를 명시적으로 주입한 실제844×390 화면에서2D 안내와 정지 상태, 원래 renderer 복원 뒤 같은 화면 크기의3D 재시도 성공을 확인했다. 초기1200×720 시도는 렌더가 재실행되지 않아 유효 실패 재현에서 제외했다. 예외 주입은 실제 폰트 손상이나 물리 기기 실패의 증거가 아니다.
- 열린 기록/JSON/가져오기 영역을 인쇄에서 제외하지 않는다. 입력·변경·세부 펼침·스크롤을 무효화 조건에 포함하고, 배경·상위 표시 상태도 print key에 포함했다.2D 전환의 소유 texture는 교체 후 해제 경로로 보낸다.
- **실제 픽셀에서 찾은 오류:** 인쇄 key는 root scroll1026을 담았지만 SVG 이미지에는 페이지 상단이 나왔다. Inline SVG의 상대 top 위치 계측과 이미지 결과가 달랐다. 클립 내부를 명시적인 transform으로 이동하도록 수정했다. Native textarea의 anonymous control tree는 중첩 HTML 이동을 반영하지 않으므로 스크롤된 textarea는 같은 글꼴/패딩/크기의 정적 텍스트 viewport로 인쇄한다.
- 수정 후 root scroll953과 JSON 내부 scroll75의 화면/인쇄에서 같은 `lessonId` 줄 및 초안을 확인했다. 선택 색·focus outline은 입력 affordance라 인쇄에서 제외한다. JSON 데이터 자체는 바꾸지 않는다.
- 실제 버튼 next→previous 추적330프레임에서 두 전환이 종료됐다. 전환 중 `0<p<1`인 표본에서 live DOM의 aria-hidden/inert 누출은0이었다. 왕복 뒤 열린 도구,7598자 JSON과23자 초안의 SHA256, root scroll894·textarea scroll75가 유지됐다. 약3.36/3.60초 기록은 이 계측 환경의 시퀀스이며 별도 성능 벤치마크가 아니다.
- **입력 충돌 재현:** 기존44px 손잡이가 보이는 textarea의 오른쪽17px를 덮었다. 실제 해당 좌표 클릭은 입력 focus 대신 페이지 제스처를 시작했다. 손잡이의 가로 위치를 인쇄 영역 바깥 책 여백으로 옮겼다. 같은 입력 좌표에서 겹침0, 최상위 hit=TEXTAREA, 입력 focus와 `spreadIdle/spread-1` 유지가 실제 재확인됐다. 손잡이 크기는44px 그대로다.
- 읽기 검사에서 C4의 실제 SVG note y84, 오선 바닥 y74, 로컬 폰트 준비=true를 확인했다. 활성 제목은 접근성 트리에1개, 비활성 펼침면 제목은 제외됐다. 실제 보조기술 청취 판정은 아니다.

## 증거

로컬 `output/qa-v2.1/`의 파일을 보존한다.

| 파일 | 의미 |
|---|---|
| `v11-renderer-failure-before-effective.json`, `v11-renderer-failure-recovery.json` | 실패 재현,2D 복구 및 같은 크기 재시도 |
| `r1-1793182974688-tools-print.png`, `tools-scroll-live-before.png` (같은 접두사) | 수정 전 실제 스크롤 불일치 |
| `r1-1793182974688-scroll-fixed.png`, `scroll-fixed-live.png` (같은 접두사) | root953/textarea75 수정 후 인쇄와 live 픽셀 |
| `r1-1793194131677-tools-roundtrip.json` | 실제 양방향 버튼 전환, 입력 해시·스크롤·hidden/inert 추적. SHA256 `7cd649811563cfb4640fdce45700db338429897d3e2156423683bb97283d9ce1` |
| `r1-1793194131677-corner-input-before.json`, `corner-input-after.json` (같은 접두사) | 실제 입력 hit/focus 충돌의 전후 비교 |
| `r1-integrated-20261028-134614-summary.json` | 스크롤과 모서리 수정 후 최신257개 검사 및78파일 지문 |

## 거부/대기 상태

수정한 손잡이를 실제로25%·50%까지 드래그하고 PNG를 저장하려던 CUA 요청이 **`JavaScript execution was denied`**를 반환했다. 도구는 구체적 사유나 reviewer 식별 정보를 제공하지 않았다. 이 요청의 새 드래그 이미지 파일은 없으며 성공으로 집계하지 않는다. 재연결 후 읽기 전용 확인은 `spreadIdle`, `turn:null`, 입력 focus의 정지 화면이었다. 활성 넘김을 남겨 둔 상태가 아니다.

동일 드래그를 재시도하거나 다른 제어 방식으로 바꾸지 않았다. 해당 localhost 드래그/캡처 요청에 대한 구체적 재시도 허용 질문이 대기 중이다. 이 거부는 PC가 unavailable로 바뀌었던 앞선 환경 중단과 구분한다. 기존 JSON 파일 내려받기 전달 결과도 불확실하며 중복 요청하지 않는다.13시 재개 시 기본 Downloads 디렉터리는 읽기 가능했고 해당 파일명 일치 파일은0개였다; 다른 경로의 파일 존재까지 부정하는 증거는 아니다.

모바일/200%/터치·키보드 전수,16분음표 선택과 세부 SVG,수명/성능 스트레스 및 최신 코드의 직접 드래그 검증을 마무리한 뒤 첫 두 펼침면을 배포한다. 실제 청취·실기기·실제 보조기술·교육자 수용은 따로 미완료로 남긴다. commit/push/새 CI/새 Vercel 배포는 아직 없다.


## 2026-10-28 14:07 UTC - independent checks and manual handoff

The current source includes a new keyboard focus repair in LessonPages.tsx. A real merge/redo could disable its initiating button and drop native focus to BODY. After repair, native Enter follows merge -> enabled Undo, undo -> enabled Redo, redo -> enabled Split. This does not steal focus moved outside the control group.

Current full-source summary: output/qa-v2.1/r1-integrated-20261028-140635-summary.json, completed14:07:01.818 UTC:257/257, zero fail/skipped/cancelled/todo, lint/build/typecheck exit0,78 source fingerprints unchanged. The13:46 summary and13:54 ZIP are now historical, before this focus repair.

New actual UI evidence prefix r1-1793196104305 covers whole-to16 balanced splits, all16 real C4 noteheads/stems/ledger lines and four groups of two beam paths, last-note keyboard selection, merge/undo/redo and16 saved IDs after reload/resume.390x844 CSS viewport emulation has root width390/scroll width390 and44px event-list targets; native keyboard selection and editing worked. This is one emulated size, not the complete responsive matrix, native desktop zoom or physical phone touch.

MANUAL_DRAG_CHECK.md gives the user a minimal hold/reverse-cancel/complete/revisit check. The existing4183 server responds. The retained IAB is back at normal1280x720, first3D spread, spreadIdle/scene ready/prints ready/turn null/audio0. No automated drag retry was made after JavaScript execution was denied. Specific cause/reviewer identity absent; retry question and manual results pending. Existing JSON file-download delivery remains uncertain. No commit/push/remote CI/new deployment. Additional responsive/keyboard/audio/resource stress QA and the current moved-corner manual result remain before first deployment. Spreads3-6 remain deferred until that deployment.
