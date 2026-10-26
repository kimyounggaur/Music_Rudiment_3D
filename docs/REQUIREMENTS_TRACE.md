# 요구사항 추적표 — 현재 구현과 검증 증거

갱신일: 2026-10-26 UTC. 새 독립 작업공간: `C:\Users\kimyo\Documents\Codex\2026-10-27\task\music-theory-lab`.

첫 공개운영주소는 [music-rudiment-3d.vercel.app](https://music-rudiment-3d.vercel.app/)이며 A릴리스가 실제 확인됐다. 후속B자동production/CI/SHA/공개8검사도실제통과했다.

현재 production HTTP 진입 문서 `dist/index.html` SHA256은 **`6d4ca09b0288cdd5bdf376fbdc7168e13e432bdb919f6b6151d7f348ad08383d`**다. 실제 HTTP 응답 바이트와 clean 복제 빌드가 이 값과 일치한다. 현재 standalone 파일 SHA는 `3638adefdcf32113307c7c093d3b82d3c36802934f2d8af0a59085b51f490a9f`다. 이전4f097829·9453·002 등의 file-only 결과는 역사 기록으로 보존하며 서로 다른 빌드의 결과를 합쳐 현재 전체 통과로 표시하지 않는다.

React/TypeScript·실제 VexFlow 악보·Three WebGL·Web Audio·여섯 장면·교사/로컬기록을 구현했다. 현재 단위96·clean5단계·Three HTTP9·복구HTTP7·파일23·기보23/글꼴복구1·PDF6쪽·실제7383바이트내보내기·자동15분30cycle 검증이 있다. **주 HTTP 검사는19통과/1차단/0실패이며 종료1**이다. 실제 native `document.hidden` 전환을 headless에서 만들지 못한 차단을 보존했다. native pagehide 이동의 실제 App stop 검증은 별도 통과다. 입력 문서 로컬 보관과 필수 사람 검수는 남아 있어 P00~P23 전체 완료라고 판정하지 않는다.

## 입력 및 실행 증거

| 코드 | 실제 확인·증거 경로 | 범위와 한계 |
|---|---|---|
| E-DESIGN | Library `libfile_ab98b472786081919873a2dba2053527`, 상세설계서v1.0,54,225바이트·1~793행 원격 전체 읽기 | 로컬 입력 파일·바이트 해시/identity/로컬읽기 검증은 미완료 |
| E-PROMPT | Library `libfile_7143bfa2339c81919b926aadfb2cc3e2`, 구현프롬프트v1.0,111,872바이트·1~1268행 원격 전체 읽기 | 문서의 테스트 서술 자체는 실행 결과가 아님 |
| E-TRANSFER | [INPUT_PROVENANCE](INPUT_PROVENANCE.md): 두 입력을 task/inputs로 지원 전송, 최초와 허용된1회 재시도 모두 exit1 `download failed`, 파일 없음 | 원인을 접근 거부라고 확정하지 않음. 임의 재구성/다운로드 우회/추가재시도 없음. npm/HTTP 승인을 이 실패의 해소로 간주 안 함 |
| E-ENV | [REPO_AUDIT](REPO_AUDIT.md), 초기 환경 오류 기록: 처음 빈 폴더·상위지침 조사, Node24.14.0/npm11.9.0/Python3.14.3 | 기존 원본 프로젝트·음악 파일은 수정하지 않고 새 폴더 사용 |
| E-DEPS | 공식npm Three0.186.1/types0.186.0·VexFlow5,15정확선언/228lock항목. B작업트리 Node범위 `>=24.14.0 <25`와현재lock SHA `9c381bfb0bf2c0d8954e9f72b5c721ce6a90eba8c6c819ac918579931d3e1138`,snapshot19:05:09.709Z·두번째공식npm ci181설치exit0 확인. DEPENDENCY_INSTALL/SNAPSHOT 참조 | 이전ad55lock·64source와오프라인/DNS진단은A/초기역사다. 현재공식설치검증과구별. B후속push/자동production/CI/SHA/공개8검사확인완료 |
| E-CHECK | 부모 최종 source의 typecheck/lint/content/build exit0. 현재 콘텐츠 schema2.0.0/content1.0.0,6장면9레인 | 실제 전송/기기성능/청취와 구별. 자세한 명령/로그는 BUILD_STATUS |
| E-CLEAN | [현재clean results](../output/qa/clean-reproduction/results.json):B설정으로type/lint/unit96/content/build **5단계exit0**,mainbuild도exit0. [source-match](../output/qa/clean-reproduction/source-match.json):**65개exact·mismatch0**,main/clean index6d4c동일,공식npm ci181exit0 | A의64개검증은역사로보존. B작업트리의로컬재현통과이며B원격CI/자동배포통과를앞당겨주장하지않음 |
| E-CONTENT | `content:validate`:duration-basics6scenes9lanes, schema2.0.0/content1.0.0 | 구조/의미 검증이며 교육자 승인과 다름 |
| E-UNIT | 부모 실제 `npm test`와 clean unit.log: **96pass/0fail**, 기존90개+Three 순수모델6개. 이전90/file42는별도baseline | 분수/도수/기보의미/명령/평가/예약/저장/퀴즈/geometry. 모의API가 실제 청취를 대체하지 않음 |
| E-HTTP | [main HTTP results](../output/playwright/http-6d4ca09b/results.json):실제127.0.0.1:4174 production응답 SHA6d4c·Chromium148.0.7778.96, **19pass/1blocked/0fail,exit1**. 무음6장면→nativeAudio60/90/120·Stop/Loop/자연종료·Three·실제파일교환·교사/복구·8viewport×6장면. native pagehide에서 future8source에 App의 `stop(10.48)` 호출을 late observer가 기록,복귀자동소리0 | blocked는 실제document.hidden을headless탭으로재현못함. 가짜visibility이벤트로통과시키지않음. pagehide통과를hidden통과로대체하지않음. 오류/예상밖외부요청0,실제기기/청취/SR아님. 초기EACCES는역사이며 승인 후 같은loopback의실제검증과구분 |
| E-THREE | [Three HTTP9](../output/http/three/results.json):같은6d4c,9/9pass·추가보안flags없음. 실제revision186/WebGL2·시간비례world폭/DPR1.5·idle600ms추가render0·raycast와drag구별·44px키보드/회전·쉼표·nativecontextloss stop/2D·6회수명·불가/lazychunk오류대체 | **현재는 CSS3D-only가 아님.** Three0.186.1 직접어댑터이며 R3F는필수도입안함. headless실제API/렌더이지 실제휴대전화GPU·교육적효과 증명아님 |
| E-HTTP-RECOVERY | [current recovery7](../output/playwright/recovery-http-6d4ca09b/recovery-http-results.json):6d4c7/7pass. malformed/future/reference오염원본보존·명시import복구·새학습자quiz리셋/취소보존·muted/volume0는listened기록제외 | nativeAudioContext계측을포함하며 실제사람청취아님. older aff330/이전cohort도별도이력 |
| E-EXPORT | E-HTTP의 실제Blob download/saveAs·fileinput preview취소/확정·exact복구 통과(SHA e064ffa…와별도시나리오). [현재6d4c export5검사](qa/evidence/export-http-results.json):**7383바이트 실제파일생성·schema/현재2half패턴/화면일치**,SHA256 `8b9f7c07bddc17a5c1fa003913f33b7dbcac85a6885bda346ab052cfaf395693`,failure=null·5pass | older9bcdb9b1의7383바이트와file-origin canceled는역사로보존. 현재HTTP성공이과거실패원인을하나로확정하지않음. 실제모바일파일관리미검증 |
| E-BROWSER | 현재 standalone3638은 quiz7+keyboard9+failure7 =**파일23pass**. [quiz](../output/playwright/quiz-results-3638adef.json)·[keyboard](../output/playwright/keyboard-results-3638adef.json)·[failure](../output/playwright/failure-results.json). 이전4f의main19+failure7+quiz7+keyboard9=file42와unit90는baseline | **현재3638에서 file main19를 다시 실행했다고 하지않음.** 현재주요흐름은E-HTTP에서실행. file/HTTP/각빌드의결과를섞어전체인증하지않음 |
| E-FAILURE | 현재3638 file failure7pass, E-HTTP-RECOVERY의실제HTTP7pass와구분. 초기실패trace·캡처·former002/527/9cd/9453/4f 결과보존 | UIfocus/저장/소리없음/삭제/import등의선택회귀. 전체수동접근성검사아님 |
| E-QUIZ | 현재3638 file quiz7pass:사전5/사후5·명시확인만시도기록·편집시stale해제·복구; HTTP복구7에서새학습자후quiz초기화도확인 | 문항응답요약이며교육효과·순위·자유서술자동판정이아님 |
| E-KEYBOARD | 현재3638 file keyboard9pass:48키행동으로6장면완료/복구·9레인text/listened0·포인터/마우스/터치/AudioContext0·실제SVG | semantic focus 후Enter/Space/Home/End 경로. 전체Tab순서·실제SR·실기기/청음은별도 |
| E-NOTATION | [VexFlow5 results](../output/notation/vexflow5/results.json):15fixture포함 **23/23pass**, 실제Bravura/Academico·온~16분음표/쉼표·빔·C4덧줄·온쉼표선/정렬·철자/G장조·선택/재생강조·resize·SVG인쇄/PDF,HTTP요청0 | 현재source재실행통과를부모확인. 음악교육자·실제기기미검수 |
| E-FONT-RETRY | [font retry](../output/notation/font-retry/results.json):**1/1pass**, one-shot로컬폰트실패→명시44px재시도→단일SVG·4quarterevent불변·focus보존,오류/HTTP0 | 실제file fixture회귀이며App HTTP19개와별도. 사람기보승인아님 |
| E-FONTS | [실제고지](../public/licenses/README.md)·font-metadata.json·audit log:내장WOFF2 name table의OFL1.1/저작권/RFN 전체,Academico Bold연도차이도보존. VexFlow/React/ReactDOM/Three MIT도별도보존 | 패키지MIT로내장폰트OFL을대체하지않음. 기술/고지확인과공개결정·음악승인은분리 |
| E-PRINT | 현재 [정본PDF](qa/activity-sheet-six-scenes.pdf)와 [output PDF](../output/qa/print-final/activity-sheet-six-scenes.pdf) SHA **`c5b54ae203de97661d21c0375852a3b04dd99e8d279ea53bfa3304f549df1635`**,6쪽/9SVG,현재6개native Poppler이미지를부모가모두실제화면검수PASS. [결과](../output/qa/print-final/results.json)·[PRINT_REVIEW](qa/PRINT_REVIEW.md) | 이전79cf PDF6쪽검수/5→7→6쪽수정이력도보존하며새PDF에승인을소급하지않음. actualPrinter=false·실제종이/흑백/SR PDF·교사검수미실행 |
| E-STABILITY | [15분요약](qa/evidence/stability-summary.json), [전체결과](../output/http/stability-6d4ca09b-2026-10-26T18-37-54-280Z/results.json):**PASS/exit0**,18:37:54.280Z→18:52:57.191Z,측정900030.0102ms·30cycles. start/end HTTPindex6d4c동일·max nativecontext1·stop후 liveoscillator0·2D canvas0·page/console/요청오류0 | headlessChromium148의자동반복안정성이다. forcedGC=false,heap/DOM수치는기록만하고임의threshold로무누수/모바일성능을주장안함. 실제기기/청취/열시험아님 |
| E-RELEASE-A | **첫실제릴리스확인:** [운영앱](https://music-rudiment-3d.vercel.app/)·[Git저장소](https://github.com/kimyounggaur/Music_Rudiment_3D),main `c91e7ebb92304e95b44ff7d12820824cdeb0018b`원격일치·[CI40382693913](https://github.com/kimyounggaur/Music_Rudiment_3D/actions/runs/40382693913)success. Vercel `dpl_5crNfa8NBPeUeEfpiRxvXtCYs8Fd` READY/production·Git SHA동일. [API증거](qa/evidence/release-first.json),[HTTPS smoke](qa/evidence/deployment-smoke-first.json) **8/8pass**, [운영HTML](qa/evidence/production-index-first.json)200/SHA6d4c | 실제SVG/Three/nativeAudio/작곡/저장/회전/MIT/오류0 확인. 보호변경·새credentials없음. headlessChromium검사이며실제기기·청취·음악승인아님 |
| E-RELEASE-B | [RELEASE](RELEASE.md):운영URL/릴리스근거·runtimeMIT안내·Node24major상한의실질수정,공식npm ci181·main/clean5단계·65source일치·index6d4c유지 | **B a8c10094 push뒤Git자동production READY/CI success/SHA일치/공개8검사실제통과.** 빈테스트커밋이나수동성공으로위장하지않음. A성공을B에자동승계하지않음 |
| E-MANUAL | 실제모바일·SR·스피커/헤드폰청취·유선AV지연·음악교육자·교사/학습자 관찰은대기. 자동15분은E-STABILITY에서확인 | 실제기기/청취승인과첫공개릴리스A의관측은별개다. B자동배포통과를수동검수완료로바꾸지않음 |

현재 root가 명시적으로 실행한 브라우저/네트워크 결과만 기록했다. 이 문서 갱신 담당자는 추가 브라우저·서버·npm·네트워크 요청을 실행하지 않았다. 원본 음악·다른 프로젝트는 수정하지 않았고, 새 폴더와 별도 clean 폴더만 사용했다. 사용자승인범위밖로그인·결제·무제한권한확대·유료계약은수행하지않는다. 별도승인된첫Git/Vercel공개릴리스A의실제결과는E-RELEASE-A에구분했다.

“자동검증 통과”는 해당 증거의 기기/브라우저/빌드/경로에 한정한다. 아래 검증방법 열은 전체 수용 기준이며 모두 실행했다는 뜻이 아니다. 필수 미검증은 통과로 바꾸지 않는다.

## 핵심 추적표

| ID | 원설계서 절 | 요구사항 | 담당 단계 | 현재 파일 / 후속 경계 | 구체적 검증 방법 | 상태 | 현재 증거 |
|---|---|---|---|---|---|---|---|
| QA-001 | 1, 4, 21, 26 | 음가 파일럿 1개·여섯 장면만 범위에 포함, 금지사항·단계 게이트 보존 | P00~P01 | docs/IMPLEMENTATION_CONTRACT.md, docs/BUILD_STATUS.md | 문서 범위·선수 조건·실제 결과 대조, P00~P23 개별 상태 | 부분: 범위·금지사항과 독립 구현 기록 있음; 입력 로컬 확보 게이트 미충족 | E-DESIGN, E-PROMPT, E-TRANSFER, E-CHECK |
| QA-002 | 21, 28 | 기존 저장소·지침·사용자 변경 조사 후 독립 작업공간 사용 | P01 | docs/REPO_AUDIT.md, docs/LOCAL_DEPENDENCIES.md | 경로·AGENTS·git·패키지·lockfile·기준선 실제 조회 | 조사 확인·부분: 새 독립 폴더 사용, 기존 원본은 읽기/선별 복사; P01 전체 게이트 미통과 | E-ENV, E-DEPS |
| PRIV-001 | 2, 16, 24 | 원본과 파생본 분리, 미확인 자산 사용 금지, 원본 파일 불변 | P02 | src/scenes/*, src/audio/AudioEngine.ts; 자산 등록표는 후속 | 권리·내용·해시·청취 각각 기록; ZIP 이탈/실행 요소 검사 | 부분: 독자 블록·prototype-synth 사용; 원본 권리·내용·청취 미검수 자산 보류 | E-DESIGN, E-PROMPT, E-ENV |
| EDU-001 | 2, 3 | 한국어 입문 학습자, 4/4·4분음표 한 박 기준 명시, 인증·효과 주장 금지 | P00, P05, P15 | src/content/lesson.ts, src/App.tsx | 용어·기준 표기 검수, 근거 없는 성과 문구 검색 | 구현·자동검증: 한국어·4/4·4분음표 한 박·C4 표시; 교육자 승인 미실행 | E-CONTENT, E-UNIT, E-BROWSER, E-MANUAL |
| EDU-002 | 3, 9 | 길이·동치·마디·템포·높이/음량 구별 5개 목표와 사전/사후 각5문항 | P05, P15 | src/lesson/assessment.ts, src/components/ConceptQuiz.tsx, tests/assessment.test.ts, scripts/quiz-e2e.ts | 다른 표현의 사전·사후 문항 fixture, 자동/서술 평가 경계 확인 | 구현·자동검증: 사전5/사후5·순수10테스트와 file UI7검사 통과. 시도는 명시 확인만 저장·복구; 교육 효과/관찰 미검증 | E-UNIT, E-CHECK, E-QUIZ, E-MANUAL |
| EDU-003 | 4, 7, 8 | 수준1~3 앱 활동, 수준4~5 교사 확장, 후속 단원 무단 확대 없음 | P15~P16, P23 | src/App.tsx, src/content/lesson.ts, src/lesson/controller.ts | 수준 변경 데이터 보존; 앱 한마디/종이 두마디 경계 확인 | 부분: 지원수준1~3 선택·힌트 노출 차이, 교사 수준4~5 안내 구현; 상세 지원효과/확장 관찰 미실행 | E-CONTENT, E-UNIT, E-BROWSER, E-MANUAL |
| UX-001 | 5 | 가로 모바일 우선, 세로 대체에서 전체 과제 수행, 방향잠금·강제 fullscreen 금지 | P06, P18, P20 | src/App.tsx, src/styles/app.css | 844×390·667×375·568×320 및 390×844·360×640, 회전 후 리듬 보존 | 자동검증: 실제HTTP8뷰포트·Three/2D·회전 후 리듬보존, currentfile23. 실제폰/SR/주소창은 미검증 | E-HTTP, E-THREE, E-BROWSER, E-MANUAL |
| UX-002 | 5, 18 | 질문→실험→악보→조작 위계, 작은 높이·safe-area·주소창·키보드 대응 | P06, P18 | src/styles/app.css, src/App.tsx | 주요 행동 잘림·겹침, dvh fallback, 문서/악보 스크롤 소유권 확인 | 부분: 파일 렌더의 작은 높이·320폭·본문 넘침 검사 통과; 실제 주소창·노치·소프트키보드 대기 | E-BROWSER, E-MANUAL |
| A11Y-001 | 5, 18 | 44×44 CSS px 주 조작, 작은 블록의 DOM 대체 선택, 드래그 필수 금지 | P06, P08, P10, P18 | src/scenes/DurationScene2D.tsx, DurationScene3D.tsx, src/App.tsx, scripts/keyboard-e2e.ts | 키보드·터치로 선택/분할/병합/추가/삭제/정지; hit area 겹침 검사 | 부분: DOM 대체·44px transport·focus-assisted 키보드6장면/48키/포인터0 통과. 전체 Tab 순서·터치 수동 감사 대기 | E-BROWSER, E-FAILURE, E-KEYBOARD, E-MANUAL |
| MUS-001 | 6, 11, 14 | 한 의미 snapshot에서 2D·3D·악보·오디오·평가 파생, 좌표 역산 금지 | P04~P10, P20 | src/domain/*, src/content/validation.ts, src/lesson/controller.ts, src/audio/AudioEngine.ts, src/scenes/*, src/notation/NotationView.tsx | revision·eventId·합계 통합 비교; domain import 의존성 검사 | 자동검증: 동일 의미 snapshot의 2D·실제 VexFlow·오디오·Three WebGL 구현, HTTP/단위 일관성 검사. 교육자 승인은 미실행 | E-UNIT, E-CONTENT, E-HTTP, E-NOTATION, E-THREE, E-MANUAL |
| MUS-002 | 6 | X축=상대 시간, 높이/깊이 일정, 쉼표 폭 유지, 색 외 문자·형태 | P06, P10 | src/scenes/DurationScene2D.tsx, DurationScene3D.tsx, src/styles/adapters.css | duration별 폭 비율·onset 매핑, 범례·선택·쉼표 대체 확인 | 자동검증: 실제Three 시간비례폭·고정높이/깊이·쉼표·범례·DOM목록과 canvasraycast/회전보존. 교육적해석 검수 대기 | E-HTTP, E-THREE, E-MANUAL |
| MUS-003 | 6, 11 | 정확한 2D 악보: C4 덧줄·stem·flag·beam·rest·박자, 이모지 근사 악보 금지 | P03, P07, P20 | src/notation/NotationView.tsx, output/notation/vexflow5/*, public/licenses/* | 온~16분 음표/쉼표·혼합·빈/미완성·조표 fixture 실제 렌더 검수 | 정상 렌더 자동검증 23통과: C4 덧줄·4/4·음표/쉼표·빔·whole-rest 수정·철자·resize·선택·인쇄. 글꼴 실패복구 1회귀 통과; 교육자 승인은 대기 | E-NOTATION, E-FONT-RETRY, E-FONTS, E-KEYBOARD, E-MANUAL |
| PERF-001 | 6, 19, 24 | 고정 카메라·단순 geometry, 효과 최소화, idle demand·3D lazy load·DPR 제한 | P10, P19 | src/scenes/DurationScene3D.tsx, durationWorld.ts, tests/duration-world.test.ts | production 리소스·idle/재생 프레임·리소스 수명 측정 | 부분: 실제 Three0.186.1·단순geometry·lazy·DPR1.5·유휴600ms 렌더정지·6회 수명 회귀 통과. 실기기 fps/발열 미측정 | E-THREE, E-CHECK, E-MANUAL |
| EDU-004 | 9 장면1 | 두 레인의 총길이 같음·어택1/4회·높이/음량 설정 유지, 한 레인씩 비교 | P05, P11 | src/content/lesson.ts, src/lesson/controller.ts, src/App.tsx, src/notation/NotationView.tsx | QA-L01/L02: 각8/3초, 아래 onset 0·2/3·4/3·2초; 대체열람/청취 구분 | 기능 자동검증: 레인별 길이·어택·텍스트·문항·SVG와 키보드 진행. 실제 청취·음악교육자 검수 미실행 | E-UNIT, E-CONTENT, E-BROWSER, E-NOTATION, E-KEYBOARD, E-MANUAL |
| EDU-005 | 9 장면2 | 선택 블록 절반 분할, 최소1/16, 동종·동길이·인접 블록 병합, 관찰/응답 완료 | P05, P08~P10 | src/lesson/controller.ts, src/scenes/*, src/notation/NotationView.tsx, tests/lesson.test.ts | QA-S01~S03: 16분음표16개 합1; 추가 분할 거부; split/merge/undo/redo | 기능 자동검증: 분할·한계·병합·undo/redo·SVG·키보드 진행. 글꼴 장애 회귀 통과; 교육자 검수 대기 | E-UNIT, E-BROWSER, E-NOTATION, E-KEYBOARD, E-MANUAL |
| EDU-006 | 9 장면3 | 목표1/2: 4분2개·8분4개·2종 이상 동치 조합, 정확한 부족/초과 | P05, P12 | src/lesson/controller.ts, src/content/lesson.ts, tests/lesson.test.ts | QA-L03/L04: 1/4+1/4는 C 종류실패, 1/4+1/8+1/8 통과 | 기능 자동검증: 동등답·부족/초과·A/B/C 키보드·실제SVG 확인. 교육자 검수 대기 | E-UNIT, E-CONTENT, E-BROWSER, E-NOTATION, E-KEYBOARD, E-MANUAL |
| EDU-007 | 9 장면4 | note↔rest 길이 보존, 무음도 시간 차지, 질문 응답과 쉼표 포함 합1 | P05, P12 | src/lesson/controller.ts, src/audio/AudioEngine.ts, src/notation/NotationView.tsx, tests/audio.test.ts | QA-L05: note source2개, 두번째4/3초; rest.pitch 없음; 연속 playhead | 기능 자동검증: note/rest·source 제외·4/3초·쉼표SVG·키보드 toggle/응답. 실제 무음 청취·교육자 대기 | E-UNIT, E-BROWSER, E-NOTATION, E-KEYBOARD, E-MANUAL |
| EDU-008 | 9 장면5 | 60/120 정지 중 변경, 분수 불변·초만 변경, 비율/시간 두 질문 | P05, P13 | src/App.tsx, src/domain/music.ts, tests/audio.test.ts, tests/lesson.test.ts | QA-L06: 한마디4/2초, 4분1/0.5초, 비율4:1; 재생중 변경 차단 | 기능 자동검증: 60/120·4/2초·분수불변·재생 가드·키보드 템포/응답. 실제 출력·교육자 대기 | E-UNIT, E-BROWSER, E-KEYBOARD, E-MANUAL |
| EDU-009 | 9 장면6 | 빈 draft에서 합1·음가2종 이상·rest1개 이상, 설명은 자기확인/교사검토 | P05, P14 | src/lesson/controller.ts, src/App.tsx, src/notation/NotationView.tsx, tests/lesson.test.ts | QA-L07~L09: 예시통과, 온음표/1종실패, 성공 후 삭제·undo 재판정 | 기능 자동검증: 합1·2종·쉼표·설명 자기확인·현재성공·키보드 카드/Space·SVG. 실제 수업/음악 승인은 대기 | E-UNIT, E-BROWSER, E-NOTATION, E-KEYBOARD, E-MANUAL |
| EDU-010 | 10 | 로그인 없는 교사 보기, 질문·오개념·정답 숨김/공개·프로젝터·2D 인쇄 | P16 | src/App.tsx, src/styles/print.css, docs/qa/activity-sheet-six-scenes.pdf | 학생 복귀시 정답 숨김; 점프시 stop; 학생기록 불변; 실제 인쇄 렌더 | 부분: 교사/프로젝터·정답해제와 현재6쪽PDFc5b5 전체6개 native 이미지 화면검수PASS. 실제프린터·교사10분 이해·수업 검수 대기 | E-HTTP, E-NOTATION, E-PRINT, E-MANUAL |
| UX-003 | 10, 14 | 현재 장면 초기화와 전체 기록 삭제 구별, 취소 가능한 확인 | P08, P16~P17 | src/App.tsx, src/persistence/progress.ts | 취소시 상태불변·초점복귀, 확정시 지정범위만 삭제 | 자동검증: 장면 초기화와 새 학습자 삭제 확인·취소/확정·focus/Escape·백업 삭제 회귀 통과; 실기기 미검증 | E-UNIT, E-FAILURE, E-MANUAL |
| MUS-004 | 11, 20 | 정확한 기약분수 n/d, BigInt 등 안전 연산, 분모0/비정수/오버플로 거부 | P04 | src/domain/fraction.ts, errors.ts, tests/domain.test.ts | M01~M06/M11; 1/3×3=1; 교환·결합·normalize 멱등·split 합 보존 | 순수 자동검증 통과: 기약분수·BigInt 중간곱·정수 경계·오버플로 거부·불변식 | E-UNIT |
| MUS-005 | 11, 20 | 박자 길이·groups·템포 기준 분리, 초 변환 최종경계만 number | P04, P09 | src/domain/music.ts, tests/domain.test.ts | M03/M04/M09, 3/4와6/8 길이같고 groups 다름; 90의8분=1/3초 | 순수 자동검증 통과: 박자 길이/groups·템포 기준·초 변환 고정값 | E-UNIT |
| MUS-006 | 11, 20 | pitch spelling 보존, C4=MIDI60, 최종 alter 중복 적용 금지 | P04, P07 | src/domain/music.ts, tests/domain.test.ts | M07/M08, C→D# 증2도/C→Eb 단3도, G장조F# alter1 1회 적용 | 순수 자동검증 통과: C4/MIDI·최종alter·철자 구별. 상행 단순음정 범위 외는 typed error | E-UNIT |
| MUS-007 | 11, 25 | notation·duration·연주 구별, 점/tuplet/tie 의미를 총길이에서 추정 금지 | P04~P05, P23 | src/domain/music.ts, tests/domain.test.ts | 점4분3/8, tuplet8분1/12×3=1/4; 미지원 tie 명시적 거부/지원경계 | 부분: 점음표·tuplet 음가 계산 통과; tie 연주/확장 기보·외부 형식 어댑터는 미구현 범위 | E-UNIT, E-NOTATION |
| DATA-001 | 12 | 구조+의미 런타임 검증, note/rest union·ID·분수·notation·레인 비중첩 | P05 | src/content/types.ts, validation.ts, tests/lesson.test.ts | QA-D01/D02/D04; rest.pitch·중복ID·분모0·음수·겹침·범위·notation 무효 fixture | 구조·의미 자동검증 통과: 유효/무효 fixture와 콘텐츠 6장면9레인; 지원 범위 밖 데이터 명시 거부 | E-CONTENT, E-UNIT |
| DATA-002 | 12 | Lesson→Scene→Lane→Event, ID namespace, 장면1 두레인 시간 중복 허용 | P05 | src/content/types.ts, lesson.ts, validation.ts | 레인 내부 검증, 레인합2마디 오판 금지; 타입/스키마 일치검사 | 자동검증 통과: scene/lane·ID 범위, schemaVersion2.0.0/contentVersion1.0.0·비교 레인 보존 | E-CONTENT, E-UNIT |
| DATA-003 | 12, 17 | draft/playable/assessment 분리, 빈·미완성 답은 합법 초안이며 정답 아님 | P05, P07, P14 | src/content/validation.ts, src/lesson/controller.ts, src/notation/NotationView.tsx | QA-D03; 빈 draft 렌더·재생거부/명시 접두재생, 자동 rest 삽입 금지 | 자동검증: 빈/미완성 draft·playable·평가 분리와 실제SVG fixture, 자동 쉼표 삽입 없음. 음악 교육자 검수 대기 | E-CONTENT, E-UNIT, E-NOTATION |
| QA-003 | 13, 27 | 공식 문서·패키지 metadata·peer·라이선스 확인 후 정확버전 lock | P03 | package.json, package-lock.json, docs/DEPENDENCY_INSTALL.md, output/qa/clean-reproduction/* | 실제 install-from-lockfile·typecheck·최소test·build; 추정버전 금지 | 로컬실행환경검증:공식lock15/228·두번째npm ci181·B설정source65exact·5단계exit0·main/clean index6d4c일치. B원격CI/자동배포/SHA/공개8검사실제통과 | E-DEPS, E-CLEAN, E-HTTP, E-RELEASE-A, E-RELEASE-B |
| DATA-004 | 14 | domain은 React/DOM/Three/저장 비의존, command reducer 원자 변경 | P04, P08, P15, P22 | src/domain/*, src/lesson/controller.ts, tests/lesson.test.ts | 실패명령 이력 미추가; undo후 편집 redo폐기; adapter snapshot revision 일치 | 자동검증: 비의존 domain·원자명령·실패보존·undo/redo와 Three 순수모델6개 포함 unit96 통과 | E-UNIT, E-CHECK |
| UX-004 | 14, 20 | Lesson/UI/Transport/Persistence 상태 분리, 선택·초점 복구, 현재성공 재계산 | P08, P14~P17 | src/lesson/controller.ts, src/App.tsx | split첫자식/merge결과 초점; 성공→undo→실패→redo→성공 | 부분 자동검증: 현재 성공 재계산·선택·undo/redo·dialog 초점 회귀 통과; 전체 화면/SR 초점 감사 미실행 | E-UNIT, E-BROWSER, E-FAILURE, E-MANUAL |
| AUDIO-001 | 15 | 사용자 제스처 unlock, AudioContext.currentTime 단일 예약시계, 자동재생 금지 | P09 | src/audio/AudioEngine.ts, src/App.tsx, tests/audio.test.ts | QA-A01, Fraction→초 예약·화면역변환; 새로고침 소리없음 | 자동검증: HTTP 첫진입/복구 context0, 제스처 후 실제 nativeAPI·무음/음량0은 listened로 기록하지 않음. 실제 청취 대기 | E-UNIT, E-HTTP, E-HTTP-RECOVERY, E-MANUAL |
| AUDIO-002 | 14~15 | 단일활성세션·비동기 resume 취소·미래 source 실제 stop/정리 | P09, P20 | src/audio/AudioEngine.ts, tests/audio.test.ts | QA-A02~A05; 연타/resume중이동/예약직후stop/숨김/unmount/50회반복 | 자동검증: unit 토큰경쟁/미래stop/50회와 HTTP play/stop/loop·nativepagehide의 미래8source 즉시stop 통과. 실제 hidden 전환은 차단 | E-UNIT, E-HTTP, E-MANUAL |
| AUDIO-003 | 14~15 | 정지·자연종료 위치0, 일시정지 없음, 재생중 편집·템포변경 금지 | P09, P13 | src/audio/AudioEngine.ts, src/App.tsx, tests/audio.test.ts | QA-A06; 마지막 rest까지 logicalDuration; stop후 다시처음 | 부분: HTTP 논리종료·position0·tempo60/90/120·편집가드·nativepagehide 통과. 실제 document.hidden 재현은 headless 차단 | E-UNIT, E-HTTP, E-MANUAL |
| AUDIO-004 | 15 | note만 source·rest시간 유지, release는 쉼표 침범 금지, 채널분리·mute/volume | P09, P12 | src/audio/AudioEngine.ts, tests/audio.test.ts, src/App.tsx | mock/OfflineAudioContext onset·무음; 실제청취 별도, 합성음 명시 | 부분: HTTP native90 rest source0·4/3초 다음어택·nativeenvelope/gain, mute/volume0 청취기록 제외 통과. 스피커/AV지연 미검증 | E-UNIT, E-HTTP, E-HTTP-RECOVERY, E-MANUAL |
| PRIV-002 | 16 | 자산별 source ID·hash·mtime·size·license·파생·검수상태 기록 | P02, P22 | docs/INPUT_PROVENANCE.md; 원본 자산 등록표는 보류 | 파일명/metadata와 내용/청취/권리 구분; 미확인 null/보류 | 보류: 문서/자산 위치 metadata와 실제 내용·권리·청취·원본 hash를 구별. 미확인 녹음/영상 미연결 | E-ENV, E-DESIGN, E-MANUAL |
| EDU-011 | 17 | 동등답·구조화 피드백 우선순위·힌트 단계·자유서술 자동판정 금지 | P12, P14~P15 | src/lesson/controller.ts, src/content/lesson.ts, src/App.tsx, src/lesson/assessment.ts | 잘못된값→부족초과→rest→종류→성공; 키워드/AI 판정 없음 | 부분: 구조화 판정·동등답·설명 자기확인 구현·테스트; 오류 횟수별 세 단계 힌트의 전체 수용은 미검증 | E-UNIT, E-BROWSER, E-MANUAL |
| DATA-005 | 17, 25 | 최소 진행 envelope·버전검증·순수 migration·정상상태 원자보존 | P17 | src/persistence/progress.ts, tests/persistence.test.ts | malformed/future/content불일치/위험키/용량/개수/문자열 제한; 실패전후 상태비교 | 자동검증: envelope/버전·원본변조 거부와 HTTP malformed/future/reference 오염 원본 보존·명시복구/새학습자 흐름 통과 | E-UNIT, E-HTTP-RECOVERY |
| PRIV-003 | 17, 24 | 이름·이메일·위치·기기지문·녹음·분석 추적 미수집, free text 기본 미저장 | P15, P17, P20 | src/persistence/progress.ts, src/App.tsx, src/lesson/assessment.ts | 저장 JSON 필드 whitelist·네트워크 요청 검사·설명저장 별도선택 | 실행 범위 자동검증: 최소 필드·개인정보/런타임 필드 거부, file 브라우저 외부 요청0; 원격 운영 감사는 범위 밖 | E-UNIT, E-BROWSER, E-FAILURE |
| DATA-006 | 17 | 가져오기 validate→preview→confirm→commit, 취소/거부시 기존 기록 보존 | P17 | src/persistence/progress.ts, src/App.tsx | QA-R03; 1MiB/64이벤트/ID80자/설명2000자 경계 최종정책 명시 후 테스트 | 자동검증: 현재 HTTP에서 실제 Blob JSON 저장·실제 파일선택→preview→취소/확정, exact pattern 복구 통과. 다른기기/브라우저 미검증 | E-UNIT, E-HTTP, E-EXPORT, E-MANUAL |
| PRIV-004 | 17 | 새 학습자·전체삭제는 앱 namespace와 백업만, 외부 내보낸 파일 별개 안내 | P17 | src/persistence/progress.ts, src/App.tsx | QA-R04; 삭제취소/확정/재접속, localStorage.clear 금지 | 자동검증: 앱key/backup만 삭제·실패안내·공용기기 새학습자 quiz초기화·취소보존, HTTP 실제파일 내보내기/가져오기 통과 | E-UNIT, E-HTTP, E-HTTP-RECOVERY, E-EXPORT |
| A11Y-002 | 18 | Canvas 밖 ordered event목록·name/role/state·일관된 초점·과잉 live알림 금지 | P06~P10, P18 | src/scenes/*, src/notation/NotationView.tsx, src/App.tsx, scripts/keyboard-e2e.ts | Tab/ShiftTab/Enter/Space/Escape, 화면제목·목록 읽기순서; 실제SR 별도 | 부분: DOM 목록·native state·dialog Tab/Escape·focus-assisted6장면 통과. 실제 SR 읽기 순서·전체 Tab 탐색은 미검증 | E-BROWSER, E-FAILURE, E-KEYBOARD, E-MANUAL |
| A11Y-003 | 18 | 2D·무음·세로·버튼만으로 모든 개념 과제, 청취와 대체기록 구분 | P11~P18 | src/scenes/DurationScene2D.tsx, src/lesson/controller.ts, src/App.tsx, scripts/keyboard-e2e.ts | QA-U01/U03, 처음진입→장면6 완료; 청취성과 허위표시 없음 | 기능 자동검증: 무음2D+키보드 focus/Enter/Space로6장면 완료·복구,9레인 text/청취 구분. 실제 SR/청음 인증 아님 | E-BROWSER, E-FAILURE, E-KEYBOARD, E-MANUAL |
| A11Y-004 | 18 | reduced-motion 감지/선택, 대비·200%줌·320폭 reflow, 시간제한 없음 | P06, P18 | src/styles/*, src/App.tsx, src/scenes/* | 본문4.5:1/큰글3:1·중요UI3:1 검사, 확대/모션없는 대체; 인증주장 금지 | 부분: reduced-motion·320폭·native 조작 자동검증; 정식 대비/200% 확대/실제 SR·모바일 감사는 미실행 | E-BROWSER, E-FAILURE, E-MANUAL |
| PERF-002 | 19 | 3초·3MB·모바일30fps/데스크톱60fps·입력100ms·유선AV50ms는 목표 | P19 | output/qa/build.log, docs/qa/TEST_MATRIX.md | 정확환경·DPR·네트워크·CPU·cache·production·반복조건 측정; 숫자 추정 금지 | 부분 측정: production 번들/gzip 파일 크기만 확보. 실제 전송·3초·fps·입력100ms·유선AV50ms 미측정 | E-CHECK, E-MANUAL |
| PERF-003 | 19, 24 | 실제 유효1마디 최소음가1/16의16이벤트, 엔진64상한은 stress 경계 | P05, P19 | src/content/validation.ts, src/domain/fraction.ts, tests/domain.test.ts, tests/lesson.test.ts | 16유효·64stress 구별, 과대입력 거부와 15분 학습 관찰 | 범위검증: 한마디16/엔진64구별·unit통과. HTTP15분/30cycle안정성실행통과;64stress 성능·실기기발열은별도미측정 | E-UNIT, E-STABILITY, E-MANUAL |
| PERF-004 | 24 | WebGL/context loss·저성능·오디오·저장실패에 데이터 보존 fallback | P10, P17, P19 | src/scenes/DurationScene3D.tsx, src/audio/AudioEngine.ts, src/persistence/progress.ts, src/App.tsx | QA-R01/R02, 각각 오류주입→2D/무음/세션학습·export 지속 | 자동검증: 실제 HTTP Three context loss/불가/lazy chunk 실패→stop/2D·리듬보존, Audio/저장 오류 복구 통과. 실기기 성능 미측정 | E-THREE, E-HTTP-RECOVERY, E-STABILITY, E-MANUAL |
| QA-004 | 20 | 순수단위·통합·브라우저·실기기·청취·음악승인·관찰 분리 | P20~P22 | output/qa/clean-reproduction/unit.log, output/playwright/http-6d4ca09b/results.json, output/http/three/results.json, output/playwright/recovery-http-6d4ca09b/recovery-http-results.json | 명령·종료코드·build·fixture·trace·화면 연결; A~C가 D~F 대체 금지 | 증거분리: unit96/clean5·HTTP19pass1blocked·Three9·recovery7·file23·notation23/font1·자동15분30cyclePASS. 이전90/file42는baseline | E-UNIT, E-CLEAN, E-HTTP, E-THREE, E-HTTP-RECOVERY, E-BROWSER, E-NOTATION, E-FONT-RETRY, E-STABILITY, E-MANUAL |
| QA-005 | 20~21 | Chromium/WebKit 가능한 행렬, 가로/세로/태블릿/데스크톱 화면 실제검토 | P20 | scripts/http-e2e.ts, scripts/three-http-e2e.ts, output/playwright/http-6d4ca09b/*, output/http/three/* | 844×390,667×375,568×320,390×844,360×640,320폭,1024×768,1366×768 | 자동검증: 실제 HTTP8viewport×6scene/44px와 회전·Three 캡처. Chromium148만 검사, WebKit/실제폰/주소창·터치 미검증 | E-HTTP, E-THREE, E-MANUAL |
| QA-006 | 20~22 | 실제기기 Android/iOS/Windows/macOS, 음악교육자·청취·교사/학생 검수 | P20~P22 | docs/qa/TEST_MATRIX.md, docs/qa/OPEN_ISSUES.md | 기종·OS·브라우저·출력장치·날짜·검수자·결과; 15분 실제경로; 연락/모집은 별도허용 | 외부 검수 미실행: 실제 기기·청취·음악교육자·교사/학습자·15분 사용. 인원 확보/성과 주장 없음 | E-MANUAL |
| QA-007 | 21 | 실패게이트 숨기지 않음, 재현→최소회귀→수정→영향검증, assertion 약화 금지 | P21 | scripts/failure-e2e.ts, output/playwright/failure-initial-results.json, failure-results.json, output/notation/vexflow5/* | 심각도·재현·수정·회귀 증거; 차단/중요0 또는 정확 외부차단 | 부분: focus/저장/export/whole-rest/font/오염복구/음소거 청취기록 회귀 통과. 실제hidden·입력archive/필수수동검수 남음 | E-FAILURE, E-NOTATION, E-FONT-RETRY, E-HTTP, E-THREE, E-HTTP-RECOVERY, E-MANUAL |
| QA-008 | 22 | 음악·개발·교육 검수 역할과 책임 구분, 화면표시는 음악승인 아님 | P16, P20, P22 | src/content/lesson.ts, docs/qa/TEST_MATRIX.md, docs/BUILD_STATUS.md | 각각 승인/수정/대기 상태·담당역할·증거; 미모집은 대기 | 검수 역할/대기 구분: 개발 자동검증 있음, 음악·청취·수업 관찰 승인 없음 | E-CHECK, E-MANUAL |
| PRIV-005 | 23 | 비용·일정은 추정, 유료서비스·권한확대·계정·외부배포·push 금지 | P00, P03, P22 | package.json private:true, docs/IMPLEMENTATION_CONTRACT.md, output/playwright/results.json | 비용/서비스 변경 이력·네트워크/배포명령 대조; 허가 없는 변경 없음 | 별도릴리스실행결과:첫공개HTTPS/Git/CI/Vercel A성공. 보호설정변경/새자격증명없음. 로그인·결제·학생서버/추적·유료계약없음 | E-RELEASE-A, E-DEPS, E-HTTP, 사용자 승인 기록 |
| DATA-007 | 25 | 앱/콘텐츠/의미스키마/진행/자산 버전 구분, 외부형식은 후속 adapter | P05, P17, P23 | src/content/lesson.ts, src/persistence/progress.ts, tests/persistence.test.ts | incompatible version 명시거부·migration fixture; MIDI에서 철자추정 금지 | 부분: 콘텐츠/스키마/진행/앱 버전 구분과 비호환 거부 통과; MusicXML 등 일반 입출력·후속 migration 미구현 | E-CONTENT, E-UNIT, E-NOTATION |
| QA-009 | 26 | 착수 checklist 실제증거로 확인, 미충족을 체크완료로 처리하지 않음 | P00~P03, P22 | docs/INPUT_PROVENANCE.md, docs/BUILD_STATUS.md, docs/qa/OPEN_ISSUES.md | 원본접근·의미·기보·오디오·대체·교사·청취 항목 근거 대조 | 남은게이트: 입력로컬archive·nativehidden재현·필수실기기/음악검수. Three/HTTP/clean source/현재PDF/자동15분은실제증거로해소 | E-TRANSFER, E-CLEAN, E-HTTP, E-THREE, E-PRINT, E-STABILITY, E-MANUAL |
| QA-010 | 27 | 공식 근거는 후보 API·호환성 확인용, 실제 설치/실행과 구별 | P03, P07, P09, P18~P20 | docs/LOCAL_DEPENDENCIES.md, package.json, package-lock.json, public/licenses/* | 확인일·URL·실제버전·API·라이선스 기록, 문서작성자의 과거확인을 현재검증으로 쓰지않음 | 공식 npm Three0.186.1/types0.186.0 승인 조회·설치, lock228/15manifest와 npm ci 설치 확인. VexFlow293파일/OFL 고지 보존 | E-DEPS, E-NOTATION, E-FONTS |
| QA-011 | 28 | 장면2 의미→2D악보→조작 검증 후 오디오, 마지막3D 교육적효용 관찰 | P08~P10, P20 | src/lesson/controller.ts, src/scenes/*, src/audio/AudioEngine.ts, src/notation/NotationView.tsx | 한절편게이트·같은 snapshot 일치·2D/3D 비교 관찰, 대량전환 없음 | 자동검증: 장면2 의미·2D·실제악보·Web Audio·실제Three와 키보드. 3D 교육적효과·음악 승인은 대기 | E-UNIT, E-HTTP, E-NOTATION, E-KEYBOARD, E-THREE, E-MANUAL |
| QA-012 | 7, 21, 25 | 후속단원 하나만 계획, 첫파일럿 QA·선택 필요, 기존회귀 유지 | P23 | docs/NEXT_LESSON_TEMPLATE.md, src/domain/* 재사용 후보 | 단원 선택/목표/신규음악규칙/축범례/새version/작은2D절편 계획; 구현과 구별 | 템플릿/재사용분석 산출물 있음. 다음단원 선택·파일럿 검토 후 별도 작은절편 계획, 후속단원 구현 없음 | E-PROMPT, docs/NEXT_LESSON_TEMPLATE.md, E-MANUAL |
| QA-013 | 21~22 | 재현 가능한 인수패키지와 개발검증/수업시험준비/공개판단 구분 | P22 | README.md, docs/BUILD_STATUS.md, docs/qa/*, output/preview.html, dist/* | lock install→typecheck→lint→content validate→unit/integration→build→E2E 실제 실행 | 첫릴리스A:원격main정확SHA·CI success·VercelproductionREADY·공개HTTPS8검사PASS. B실질수정로컬clean65통과,B push/CI/자동production/SHA/공개8검사확인완료. 입력archive/hidden/필수수동한계유지 | E-CLEAN, E-RELEASE-A, E-RELEASE-B, E-HTTP, E-STABILITY, E-MANUAL |

## 설계서 28절 누락 점검

다음은 절 범위의 요구사항 연결이다. 표의 행이 있다는 사실은 해당 요구사항 통과를 뜻하지 않는다.

| 원설계서 절 | 연결 ID |
|---|---|
| 1 설계 결론 | QA-001, MUS-001 |
| 2 참고 자료와 확인 범위 | PRIV-001, EDU-001 |
| 3 학습 목표와 성공 지표 | EDU-001, EDU-002, QA-006 |
| 4 제품 범위와 우선순위 | QA-001, EDU-003 |
| 5 전체 학습 경험 | UX-001, UX-002, A11Y-001 |
| 6 시각 표현 원칙 | MUS-001~MUS-003, PERF-001 |
| 7 교육과정 확장 로드맵 | EDU-003, QA-012 |
| 8 학습 수준1~5 | EDU-003 |
| 9 파일럿 상세 수업안 | EDU-004~EDU-009 |
| 10 교사용 수업 운영 | EDU-010, UX-003 |
| 11 음악 의미 데이터 | MUS-004~MUS-007 |
| 12 파일럿 단원 데이터 | DATA-001~DATA-003 |
| 13 권장 기술 구성 | QA-003 |
| 14 모듈과 상태 관리 | MUS-001, DATA-004, UX-004, AUDIO-002~AUDIO-003 |
| 15 오디오와 애니메이션 동기화 | AUDIO-001~AUDIO-004 |
| 16 영상과 ZIP 재사용 | PRIV-001, PRIV-002 |
| 17 평가와 학습 기록 | EDU-011, DATA-005~DATA-006, PRIV-003~PRIV-004 |
| 18 접근성과 대체 경로 | A11Y-001~A11Y-004 |
| 19 성능과 품질 예산 | PERF-001~PERF-003 |
| 20 테스트 명세 | MUS-004~MUS-006, QA-004~QA-006 |
| 21 단계별 개발·완료 기준 | QA-001, QA-004~QA-007, QA-012~QA-013 |
| 22 역할과 산출물 | QA-008, QA-013 |
| 23 일정과 비용 | PRIV-005 |
| 24 위험과 대응 | PRIV-001, PRIV-003, PERF-004 |
| 25 형식 교환과 장기 확장 | MUS-007, DATA-007, QA-012 |
| 26 제작 착수 전 checklist | QA-001, QA-009 |
| 27 공식 참고 자료 | QA-010 |
| 28 바로 시작할 첫 작업 | QA-011 |

## 단계별 현재 판정

| 단계 | 실제 산출물·증거 | 판정과 남은 게이트 |
|---|---|---|
| P00 | 계약·BUILD_STATUS·두문서원격전체읽기 | 부분: 입력문서의지원로컬보관/identity/읽기게이트미충족 |
| P01 | 새독립폴더조사·59추적표·28절map·결정기록 | 조사/추적완료범위확인,입력로컬게이트별도유지 |
| P02 | 원본metadata수준분리·독자블록/합성음·MIT/OFL고지 | 부분: 원본ZIP/영상·음원내용·권리·청취미검수자산보류,미사용 |
| P03 | 공식npm lock15선언/228항목·clean npmci181·65source일치·5단계exit0·동일HTTPindex6d4c | 실행환경자동검증통과. 입력로컬보관/실기기승인은별도 |
| P04 | 정확분수/pitch/도수/notation엔진25테스트 | 순수엔진범위통과;M10 source와M12 ID는통합에도연결 |
| P05 | schema2.0/content1.0·6장면9레인·유효/무효fixture·lesson25 | 구조/의미자동검증통과,음악교육자승인미실행 |
| P06 | 가로/세로React셸·HTTP8viewport×6장면·44px | 자동레이아웃통과,실제주소창/notch/softkeyboard/터치미검증 |
| P07 | 실제VexFlow5 SVG23·폰트복구1·OFL고지·PDF | 정상/오류복구자동검증통과,교육자/실기기승인대기 |
| P08 | 분할/병합/undo/redo/1/16·실제SVG·키보드 | 기능자동검증통과,수업/음악검수대기 |
| P09 | nativeWebAudio·Stop/Loop/60/90/120/자연종료·실제pagehide미래8source즉시stop | 부분: native document.hidden전환은headless차단,실제출력청취대기 |
| P10 | 실제Three0.186.1/WebGL2·raycast·geometry·DPR·demand·contextloss/불가/chunk실패2D | HTTP9회귀와순수모델6통과. 실제모바일GPU/교육적효용미검증 |
| P11 | 두레인·총길이/어택/속성·텍스트/실제소리·SVG | 기능/HTTP통과,실청취·음악교육자대기 |
| P12 | A/B/C동치와쉼표·부족초과·native어택4/3초·SVG | 기능/HTTP통과,실청취·음악교육자대기 |
| P13 |60/120·비율/초·정지중tempo·nativeplay/stop | 기능/HTTP통과,실제출력측정·교육자대기 |
| P14 | 빈draft·합1/2종/rest·설명자기확인·성공undo/redo | 기능/HTTP통과,음악/수업검수대기 |
| P15 |6장면·지원1~3·교사4~5·사전5/사후5·기록/리셋 | 부분: 파일/HTTP흐름통과,적응힌트전체/실제관찰대기 |
| P16 | 교사/정답숨김·프로젝터·수준4/5·현재c5b5 PDF6쪽전체이미지검수 | 화면검수통과,실제프린터·교사10분이해·수업대기 |
| P17 | envelope·위험/오염보존·실제HTTP파일download/import취소/확정·새학습자quiz리셋 | 정의한기능자동검증통과. 다른기기/브라우저파일관리미검증 |
| P18 |48키행동6장면·0pointer·44px·dialog Tab/Escape·reducedmotion·320폭 | 부분: focus-assisted키보드통과,전체Tab순서/SR/대비200%/실제터치미검증 |
| P19 | 실제Three idle600ms추가render0·DPR1.5·6수명회귀·안전대체·번들분리·HTTP15분900030.0102ms/30cycles PASS | 부분:자동안정성완료,실기기fps/입력100ms/AV50ms/발열은미측정 |
| P20 |unit96/clean5단계·HTTP19pass1blocked·Three9·recovery7·currentfile23·notation23/font1·PDF6·실제export·자동15분PASS | 부분:실제hidden차단·실기기/SR/청취/교육검수대기 |
| P21 |font/rest/focus/저장·오염복구·음소거청취기록·Three오류최소수정/회귀 | 확인된회귀·자동15분통과,입력archive·hidden/외부검수남음 |
| P22 |README·source/dist·clean65·검증/제한·PDF·첫실제Git/CI/Vercel공개운영A | 첫릴리스A관측완료,후속B자동배포/CI/SHA/공개8검사통과. 입력archive·hidden·실기기/청취/교육자등미완료는유지 |
| P23 |NEXT_LESSON_TEMPLATE·공통모듈재사용분석 | 계획템플릿있음,다음단원선택/파일럿검토후작은범위착수. 후속단원구현없음 |

P03/P07/P10/HTTP의 이전 차단을 현재 상태로 그대로 반복하지 않는다. 각각 실제 승인·설치·실행 증거로 갱신했으며 이전 실패와 baseline은 지우지 않았다. 입력 materialization의 실패는 별개의 남은 게이트다.

## 필수 E2E 수용 시나리오

| 시나리오 | 현재 실행·결과 | 남은 한계 |
|---|---|---|
| E2E-01 |현재HTTP에서AudioContext없이text/2D6장면완료·currentfile에서48키만으로6장면완료/복구 |focus-assisted키보드와모든Tab순서/SR·실제터치를구별 |
| E2E-02 |현재HTTPnativeAudio scene1/2/3/4/6와60/90/120·Stop·Loop·자연종료·위치0 |실제스피커/헤드폰청취·AV지연미측정 |
| E2E-03 |unit경쟁/50회취소와실제pagehide에서future8source즉시stop,복귀autoplay0 |native document.hidden전환은차단;pagehide로대체통과안함 |
| E2E-04 |native90 rest source0·다음note4/3초·끝쉼표논리종료와SVG |실제무음청취/시청각동기미측정 |
| E2E-05 |HTTP60/120·4/2초·tempo재생중잠금과정지후변경 |실제출력시간/기기차이미검증 |
| E2E-06 |HTTP장면6성공→undo해제→redo복구·실제SVG |음악교육자승인대기 |
| E2E-07 |실제Three/2D·portrait/landscape·contextloss stop/fallback·6수명·chunk실패보존 |실제모바일회전/하드웨어미검증 |
| E2E-08 |HTTP교사정답공개→학생복귀숨김·보존 |실제교사수업관찰없음 |
| E2E-09 |HTTP-origin저장/새로고침·AudioContext생성0·원패턴복구 |다른브라우저/기기의저장정책미검증 |
| E2E-10 |실제HTTP다운로드파일·fileinput preview취소/확정·exact복구·손상/future/reference오염보존 |기타교환형식/MusicXML일반import미구현범위 |
| E2E-11 |HTTP새학습자취소/확정·앱key/backup·quiz응답/점수리셋·타앱값보존 |실제공용기기관찰/외부내보낸파일삭제는별개 |
| E2E-12 |실제WebGLcontextloss/불가/chunk실패2D·Audio/저장불가·삭제실패·오염복구 |기기fps/열화·실제SR/청취/숨김전환의추가확인필요 |

## 남은 재개 조건

1. 두 입력의 지원되는 로컬 materialization·identity·읽기 요건은 여전히 미충족이다. 최초+허용된1회재시도를 반복하거나 임의 재구성하지 않는다.
2. native `document.hidden` 전환을 실제 브라우저/기기로 재현한다. headless 차단1건과 실제 pagehide통과를 명확히 구별한다.
3. 실제완료한 자동15분900030.0102ms/30cycle의source고정·무오류·수명기록을보존한다. 실기기15분·발열/배터리관찰은별도로미검증이다.
4. 실제모바일·SR·스피커/헤드폰·AV지연·음악교육자·교사/학습자·실제프린터 검수를 기록한다. 없으면대기상태를유지한다.
5. clean5단계/65source/동일index와실제Three/HTTP/현재PDF의통과증거를보존한다. 첫공개A와B자동연결검증을구별하며,사용자승인범위밖원격작업으로확대하지않는다.
6. P22 인수수준과P23 다음단원 선택을 검토한다. 전체단원대량전환은 시작하지 않는다.

정확한 실행 명령·최신 결과·남은 결정은 [BUILD_STATUS](BUILD_STATUS.md)와 [TEST_MATRIX](qa/TEST_MATRIX.md)를 함께 확인한다.

