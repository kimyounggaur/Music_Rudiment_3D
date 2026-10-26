# 실행한 검증과 대기 — 현재 HTTP/Three cohort

현재 production HTTP index SHA256: `6d4ca09b0288cdd5bdf376fbdc7168e13e432bdb919f6b6151d7f348ad08383d`. 실제127.0.0.1:4174 응답과clean빌드동일.
현재 standalone HTML: `3638adefdcf32113307c7c093d3b82d3c36802934f2d8af0a59085b51f490a9f`.
이전90/file42·4f097829·9453·002 등의 결과는 역사다. 현재3638에서main19를재실행했다고하지않는다.

| 층 | 실제 결과 | 증거·판정 한계 |
|---|---|---|
| 현재정적검사 |typecheck/lint/content/build exit0 |부모현재source실행기록·clean결과. 실제기기/청취와구별 |
| 단위/통합 |**96pass/0fail**,domain25·lesson25·audio18·persistence12·assessment10·Three모델6 |clean-reproduction/unit.log. 이전90로그는baseline |
| 콘텐츠 |schema2.0.0/content1.0.0,6scenes9lanes |content:validate |
| 공식의존성 |승인후Three0.186.1/types0.186.0·VexFlow5·15정확선언/228lock·설치181/optional47 |DEPENDENCY_INSTALL/SNAPSHOT. 이전DNS/오프라인잠금오류는역사 |
| clean재현 |fresh npmci181설치exit0 후 type/lint/unit/content/build **5단계exit0** |[clean results](../../output/qa/clean-reproduction/results.json). source/test/scripts/public/config64개일치,mismatches0,main/clean index6d4c일치 |
| 주 HTTP E2E |**19pass/1blocked/0fail,exit1** |[HTTP results](../../output/playwright/http-6d4ca09b/results.json). Chromium148.0.7778.96,실제productionHTTP. 차단을무시해exit0으로하지않음 |
| native pagehide |신뢰된실제aboutblank이동,App이future8source에현재audio시간10.48의stop호출,lateobserver기록,복귀context0·패턴보존 |주HTTP결과의pagehideEvidence. 브라우저자동unload와JS stop호출을구별. 실제hidden검증을대체하지않음 |
| native background hidden |**차단**:headless탭전환으로document.hidden재현안됨 |가짜visibilitychange나property변경으로통과시키지않음. 실제브라우저/기기검수필요 |
| 실제Three/WebGL |**HTTP9pass**,실제revision186/WebGL2·world폭/DPR1.5·idle600ms추가render0·raycast/drag·DOM44px/회전·쉼표·contextloss stop/2D·6회수명·불가/chunk실패 |[Three results](../../output/http/three/results.json),index6d4c,추가보안flags0. 실제모바일GPU성능아님 |
| HTTP복구 |**7pass**,malformed/future/reference원본보존·명시import/새학습자·quiz리셋/취소·mute/volume0 listened제외 |[recovery7](../../output/playwright/recovery-http-6d4ca09b/recovery-http-results.json),같은6d4c·실제nativeAudio계측 |
| HTTP오디오 |60/90/120·Play/Stop/Loop·자연끝/위치0·재생중tempo잠금·rest source0/다음4/3초 |주HTTPnativeAPI기록. 실제스피커/헤드폰청취/유선AV지연미측정 |
| 실제JSON파일교환 |HTTP Blob download→saveAs→실제fileinput취소/확정·exact복구통과. 현재6d4c별도export5검사:7383바이트·schema/2half패턴/화면일치 |[현재export증거](evidence/export-http-results.json),SHA `8b9f7c07bddc17a5c1fa003913f33b7dbcac85a6885bda346ab052cfaf395693`. 기존e064ffa…다른scenario와older9bc/filecanceled는역사로구분 |
| 현재file검사 |quiz7+keyboard9+failure7=**23pass**,각SHA3638확인 |output/playwright/*results.json. 이전4f의main19까지더해현재42라고하지않음 |
| 정확기보 |15fixture포함**23pass**,실제SVG/폰트/ledger·whole-rest수정·철자·빔·resize/highlight/인쇄 |output/notation/vexflow5/results.json. 음악교육자승인대기 |
| 글꼴복구 |one-shot실패→명시44pxretry→같은4quarter/단일SVG·focus복구**1pass** |output/notation/font-retry/results.json |
| 전체키보드 |semantic focus+Enter/Space/Home/End48행동으로6장면완료/복구·9text관찰·pointer/mouse/touch/context0 |현재file keyboard9. 전체Tab순서·실제SR인증아님 |
| 가로/세로·회전 |실제HTTP8viewport×6scene·bodyoverflow없음·transport44px·Three/2D·회전데이터보존 |844×390/667×375/568×320/390×844/360×640/320×640/1024×768/1366×768. 실제주소창/notch/softkeyboard/터치아님 |
| 교사/저장 |정답공개후학생복귀숨김·HTTP-origin복구후context0·삭제/backup/타앱보존 |실제교사수업관찰없음 |
| 인쇄 |현재PDF6쪽/9SVG·현재6개native Poppler이미지부모실제화면검수PASS |정본아래SHAc5b5. actualPrinter=false·실제종이/흑백/SR PDF/교사승인미실행 |
| 15분안정성 |**PASS/exit0,900030.0102ms·30cycles**·start/endindex6d4c동일·nativecontext최대1·stop후liveosc0·2Dcanvas0·오류0 |[curated요약](evidence/stability-summary.json)·[전체로그](../../output/http/stability-6d4ca09b-2026-10-26T18-37-54-280Z/results.json). forcedGC없음·heapthreshold주장없음,실제모바일열/청취시험아님 |
| 성능목표 |bundle/lazy/DPR/idle증거있음;fps/입력100ms/AV50ms미측정 |일반목표를달성값으로채우지않음 |
| 실기기/SR/청취/음악/관찰 |대기 |기종·출력장치·검수자·날짜확보사실을만들지않음 |
| 입력로컬archive |지원materialization최초+1retry실패·원격전체읽기완료 |INPUT_PROVENANCE. 현재npm/HTTP승인으로자동해결된것아님 |

현재 PDF 정본은 [docs/qa/activity-sheet-six-scenes.pdf](activity-sheet-six-scenes.pdf)와동일바이트의[output PDF](../../output/qa/print-final/activity-sheet-six-scenes.pdf)다.
SHA256 `c5b54ae203de97661d21c0375852a3b04dd99e8d279ea53bfa3304f549df1635`.
이전79cf PDF의6쪽검수·5→7→6쪽수정이력도보존하며현재PDF의검토와혼동하지않는다.

승인된npm/loopback 범위 안에서실제실행한결과만기록한다. 현재HTTP/Three/clean을“미구현·미승인”으로반복하지않으며,1개hidden차단과입력archive·필수사람검수를“문제없음”으로숨기지않는다.
공개release와P22완료판정은대기다. [BUILD_STATUS](../BUILD_STATUS.md),[요구사항추적](../REQUIREMENTS_TRACE.md)을함께확인한다.
