# 단계별 개발 상태

갱신일: 2026-10-26 UTC. 현재 앱은 React/TypeScript, VexFlow 5.0.0의 정확한 2D SVG 악보, 실제 Three.js 0.186.1 WebGL2 장면, Web Audio 및 로컬 저장을 연결한 음가 여섯 장면이다. **구현과 자동 검증의 통과 범위, 수동·실기기 검수 대기를 분리한다.**

이전의 “CSS3D 대체만 있음”, “npm/HTTP 승인 대기”, “clean npm ci 미실행”은 당시 이력이다. 신뢰된 네트워크 실행 승인 후 공식 Three 패키지 설치와 지정 HTTP 검사가 실행됐다. 원본 입력 MD의 로컬 materialization 실패는 아직 별도 미해결이며, 전체 요구사항 원격 읽기를 마친 뒤 허용된 독립 구현은 계속했다.

## 현재 빌드 식별과 의존성

| 대상 | 확인한 값 |
| --- | --- |
| `dist/index.html` | 457바이트, SHA-256 `6d4ca09b0288cdd5bdf376fbdc7168e13e432bdb919f6b6151d7f348ad08383d` |
| `output/preview.html` | 1,821,442바이트, SHA-256 `3638adefdcf32113307c7c093d3b82d3c36802934f2d8af0a59085b51f490a9f` |
| 직접 의존성 / lock | 정확 버전 선언15개, lock root 제외228항목. 실제181항목, 현재 플랫폼 미설치 optional47항목 |
| 공식 설치 재현 | 별도 `output/clean-install`의 `npm ci`: 181 packages added, exit0 |
| manifest 검증 | 직접 선언15/15개의 버전·SHA-256, 본 프로젝트와 clean-install lock/manifest 일치. 최신 snapshot:2026-10-26T19:05:09.709Z |
| 현재 lock SHA256 | `9c381bfb0bf2c0d8954e9f72b5c721ce6a90eba8c6c819ac918579931d3e1138` |
| 현재 clean source 전체 재현 | 공식 npm ci 181개를 다시 실행해 exit0. typecheck/lint/unit96/content/build 각 exit0,65파일 해시 일치·mismatches[],main/clean index 모두6d4c. 64파일 비교는 초기 A의 이력 |

의존성 상세와 실제 lock hash는 [DEPENDENCY_INSTALL](DEPENDENCY_INSTALL.md), [DEPENDENCY_SNAPSHOT](DEPENDENCY_SNAPSHOT.json)을 따른다.

## 첫 실제 릴리스와 후속 검증

첫 릴리스 A는 실제 배포됐다. 운영 주소는 [https://music-rudiment-3d.vercel.app/](https://music-rudiment-3d.vercel.app/)이며, main 커밋 `c91e7ebb92304e95b44ff7d12820824cdeb0018b`의 원격 SHA 일치·GitHub CI success·Vercel production READY·공개 HTTPS200과 실제 브라우저8검사 통과를 확인했다. [릴리스 기록](RELEASE.md), [API 증거](qa/evidence/release-first.json), [운영 화면 증거](qa/evidence/deployment-smoke-first.json).

후속 B는 실제 운영 주소·런타임 MIT 안내와 Node major 범위 `>=24.14.0 <25`를 반영하는 실질적 변경이다. B의 push 뒤 자동 Git 배포·동일 SHA·CI·공개 화면을 다시 확인하는 작업은 대기다. B의 실제 clean 재현도 공식 npm ci 181개·5개 명령 exit0,65파일 해시 일치로 통과했다. 남은 것은 B push 뒤 자동 배포 검증이다. 앱 런타임과 컴파일 index는6d4c로 유지된다.

## P00~P23 개별 상태

| 단계 | 현재 판정 | 구현·실행 증거 / 남은 범위 |
| --- | --- | --- |
| P00 | 계약 기록·입력 보관 일부 미충족 | 두 문서 전체 원격 읽기와 계약 보존. 로컬 원형 MD 존재·읽기 검증은 INPUT-01로 미해결 |
| P01 | 조사·추적표 작성 | 독립 폴더, 상위 AGENTS/.agents 조사, 기존 프로젝트 보존, 28절 요구사항 trace·결정 기록 |
| P02 | 독자 제작 경로 사용·원본 검수 대기 | 원본 영상/ZIP 미사용·미검수. 독자 블록·prototype-synth, VexFlow/Three MIT·악보 글꼴 OFL 고지 보존 |
| P03 | 실제 설치·개발 검사·clean 재현 통과 | 공식 Three0.186.1/types0.186.0, 정확 버전·lock·manifest 검증, npm ci 성공, 현재 typecheck/lint/test/build 통과,clean 환경도같은source로재현 |
| P04 | 자동 검증 통과 | domain25검사: 정확 분수·범위·tempo·pitch 철자·notation. 실제 음악 교육자 승인과 별개 |
| P05 | 자동 검증 통과 | 6장면9레인, 구조/의미·draft/playable/assessment·ID·범위·기보/음가 일치 검증 |
| P06 | 자동 화면 경로 확인 / 실기기 대기 | file 및 HTTP의8viewport 가로/세로·44px·overflow 검사. 최종6d4c main의8viewport 검사 통과 |
| P07 | 구현·자동·화면 검수 통과 / 음악 승인 대기 | 실제 VexFlow SVG15fixture/23검사·글꼴 복구1검사. C4덧줄·쉼표 위치·beam·철자·조표. 근사 오선 사용 안 함 |
| P08 | 구현·자동 검증 통과 | 장면2 선택·split·인접 동종 병합·undo/redo·16분 한계. 같은 의미 데이터를 모든 표현에 사용 |
| P09 | 구현·예약/HTTP 재생 검사 통과 / 일부 환경 검사 대기 | 실제 AudioContext Play/Stop/Loop·60/120·쉼표·자연 종료. 네이티브 pagehide에서 미래 Loop source.stop 호출 확인. 탭 숨김은blocked. 청취·유선 지연 미측정 |
| P10 | 실제 Three 구현·자동 WebGL 검증 통과 | 실제 Three 객체6검사 및 최종6d4c HTTP9검사. Raycaster·고정 직교 시점·DPR1.5·context loss·모듈 실패→2D·자원 정리 |
| P11 | 구현·자동 경로 통과 | 두 레인의 같은 총 길이·1/4어택·속성 구별, 독립 악보, 텍스트와 청취 기록 구분 |
| P12 | 구현·자동 경로 통과 | 장면3 A/B/C 동등 답, 장면4 쉼표 시간 유지·pitch 제거·기보/오디오 일치 |
| P13 | 구현·자동 경로 통과 | 60/120 초 표시·예약, 비율 불변, 재생 중 템포 변경 차단 |
| P14 | 구현·자동 경로 통과 | 장면6 세 수치 조건·설명 자기 확인, 편집/undo/redo 후 현재 성공 재계산 |
| P15 | 구현·자동 경로 통과 / 교육 효과 미검증 | 여섯 장면 진행, 수준1~3, 사전/사후 각5문항, 교사 수준4~5 확장. 새 학습자의 퀴즈 답/점수 초기화 회귀 |
| P16 | 구현·인쇄 화면 검수 / 교사·실제 프린터 대기 | 정답 숨김/공개·학생 복귀·프로젝터·2D 인쇄. 현재c5b54ae2 PDF6쪽/9악보·58,368바이트,Poppler100dpi6페이지화면검토통과. 실제프린터·교사검토별도 |
| P17 | 구현·자동 복구/실제 파일 생성 통과 | 저장·원자적 import·미리보기/확인·삭제/백업·악성 JSON. 실제 HTTP JSON7383바이트 생성. 손상 원문 자동 덮어쓰기 차단, 최종 recovery7검사 통과 |
| P18 | 일부 자동/키보드 검수 통과 / 수동 경로 대기 | 키보드만48행동·6장면, pointer/AudioContext0, modal 초점·reduced motion·DOM대체. 실제 SR·touch·200% 전체·대비 수치 대기 |
| P19 | 장애/유휴 검사 일부 통과 / 성능 측정 대기 | 실제 Three 유휴600ms 추가 render0,6회 진입/해제 후 Canvas0,2D/context loss 복구. 15분 headless 안정성은 900,030.0102ms·30회 반복으로 통과. 실제 FPS·입력/유선 지연·모바일네트워크·모바일 발열은 미측정 |
| P20 | 자동·화면 검수 일부 통과 / 수동 층 미완료 | 현재 unit/integration96통과, finalThree9·recovery7·main19통과/1blocked. 현재독립HTML의퀴즈7·키보드9·장애7통과. 실제 기기·청취·SR·교육자·사용자 관찰 대기 |
| P21 | 확인 결함 수정·회귀 검증 | 분수/명령·원자적 import·modal·whole-rest·font복구·인쇄·실제 Three·손상 저장·새 학습자 퀴즈·음소거 청취 기록·chunk 실패 복구 수정. blocked 검사를 삭제하지 않음 |
| P22 | 첫 실제 릴리스 A 완료 / 후속 B·수동 검수 대기 | source/standalone/인수 문서·고지,현재 clean65파일 재현·15분 headless 통과. c91e7ebb main push·CI success·Vercel production READY·공개200·운영8검사 확인. B 자동 Git 배포 증명과 native visibility·실기기/수동 검수는 별도 대기 |
| P23 | 다음 단원 템플릿 준비 | 새 단원 선택·계획 범위를 정의. 첫 파일럿 검토와 한 단원 선택 전 새 단원을 구현 완료로 표시하지 않음 |

## 현재 실행 결과와 서로 다른 검수 대상

- 부모 실행자의현재typecheck/lint/content/test/build통과에이어 [clean 재현](../output/qa/clean-reproduction/results.json)에서도각명령exit0. [단위/통합로그](../output/qa/clean-reproduction/unit.log)는 **96 passed,0 failed,0 skipped**다. [source-match](../output/qa/clean-reproduction/source-match.json)는 현재65파일 해시 일치·mismatches[]·양쪽 index6d4c를 기록한다. 64파일 비교는 초기 A의 이력이다. 최초clean runner의잘못된복사상대경로는테스트실행전실패했고,경로수정후실제전체검사를통과했다. 첫시도부터통과했다고기록하지않는다. 기존90검사TAP는역사기록이다.
- [최종 Three HTTP 결과](../output/http/three/results.json): 현재 index6d4c, **9/9 통과**. 실제 Three186/WebGL2, 유휴·Raycaster·회전·쉼표·context loss·반복 정리·불가/지연 로딩 실패를 확인했다.
- [최종 복구 HTTP 결과](../output/playwright/recovery-http-6d4ca09b/recovery-http-results.json): **7통과,0실패,0blocked**. 손상/미래버전/원본변조 보존, 유효 import 확인, 새 학습자 퀴즈 초기화, muted/volume0을 listened로 기록하지 않음을 확인했다.
- [최종 main HTTP 결과](../output/playwright/http-6d4ca09b/results.json): index6d4c, runner native-pagehide-v1, **19통과/1blocked**, suite exit1. 실제about:blank pagehide가미래 Loop 예약source.stop을즉시호출하고 복귀자동재생이없음을 확인했다. headless의 네이티브 탭 숨김 관찰 제한은blocked로 남겼다. [직전aff330e4의18통과/1blocked](../output/playwright/http-aff330e4/results.json)도 이력이다.
- [현재 실제 JSON 파일 생성](qa/evidence/export-http-results.json): index6d4c에서 7,383바이트 파일을 실제 saveAs로 저장하고 스키마·리듬 일치를 확인했다. 생성 파일 SHA256은 `8b9f7c07bddc17a5c1fa003913f33b7dbcac85a6885bda346ab052cfaf395693`이다. 과거 file-origin download canceled와 구분한다.
- [15분 headless 안정성](qa/evidence/stability-summary.json): 실제 900,030.0102ms,30회 반복,exit0. 시작/종료 index6d4c 일치, native AudioContext 최대1개·각 Stop 뒤 live oscillator0·2D Canvas0, 페이지/콘솔/실패·외부요청0. heap/DOM 수치는 기록만 했고 임계값·forced GC 검증은 하지 않았다.
- 현재독립HTML3638에서 file-origin 퀴즈7·키보드9·장애7, 합23검사를 다시 통과했다. file main19는 현재3638에서재실행하지않았으므로 현재42통과라고 합산하지 않는다.
- [기보23](../output/notation/vexflow5/results.json), [font 복구1](../output/notation/font-retry/results.json)는현재독립HTML에서재실행exit0. 현재6쪽PDF는 SHA256 `c5b54ae203de97661d21c0375852a3b04dd99e8d279ea53bfa3304f549df1635`,58,368바이트다. [현재렌더6쪽](../output/qa/print-final/rendered-current/)을Poppler100dpi로생성하고부모가실제6이미지를모두확인해화면문제를발견하지못했다. [인수PDF](qa/activity-sheet-six-scenes.pdf)도같은해시다. 이전79cfPDF의검토는 [인쇄이력](qa/PRINT_REVIEW.md)과구분한다. [Three 검수](qa/Three_REVIEW.md)도해당산출물범위를따른다.

브라우저는 Windows headless Chromium148.0.7778.96이며 실제 휴대전화·실제 청취·스크린리더 실행을 뜻하지 않는다. 자동 검증을 수업 효과나 음악 교육자 승인으로 확대하지 않는다.

현재 운영 URL의 실제 HTML fetch도 index6d4c와 일치했다. [공개 HTML 해시 증거](qa/evidence/production-index-first.json). 이는 후속 B의 자동 Git 배포를 대신하는 증거는 아니다.

## 남은 조치와 복구

[OPEN_ISSUES](qa/OPEN_ISSUES.md), [PERFORMANCE](qa/PERFORMANCE.md), [QA_SUMMARY](QA_SUMMARY.md)를 읽고 최종 검사 결과만 추가한다. 소스를 바꾸지 않는 문서 갱신이며 현재 두 artifact hash를 재확인했다. 허용된 실제 실행 방법은 [README](../README.md)를 따른다.

현재 npm/HTTP를 과거와 같이 계속 차단된 상태라고 설명하지 않는다. 한편 원본 MD materialization 실패는 [INPUT_PROVENANCE](INPUT_PROVENANCE.md)에 보존하고 원격 본문을 로컬 원형으로 재구성해 성공 처리하지 않는다.

이력: [002afbaf 초기 악보 전 baseline](../output/baseline-002afbaf/), [4f097829 VexFlow/CSS3D baseline](../output/baseline-4f097829/final-cohort.json), [로컬 캐시 확보](LOCAL_DEPENDENCIES.md), [과거 의존성 진단](DEPENDENCY_DIAGNOSIS.md). 역사 파일의 Three 미구현·승인 대기 수치를 현재 상태로 사용하지 않는다.
