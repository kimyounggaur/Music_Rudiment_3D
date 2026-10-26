# 남은 사항과 해결 이력

현재 실제 Three.js WebGL2와 승인된 npm/HTTP 경로는 동작한다. 과거의 미구현·접근 실패를 현재 차단 상태로 반복하지 않는다. 아래 미확인은 성공으로 바꾸지 않는다.

| ID | 현재 상태·정확한 근거 | 다음 최소 조치 |
| --- | --- | --- |
| INPUT-01 | 미해결·추가 동일 재시도 중지. 두 Library MD 지원 전송 initial+1retry exit1 download failed, local Test-PathFalse. 전체793/1268줄 원격 읽기는 완료 | 지원 materialization 가능한 소비 환경에서 원형 존재·읽기·identity 검증. 이 문제와 허용된 독립 코드 구현 상태를 분리 |
| QA-BACKGROUND | 환경blocked. 최종6d4c main HTTP19통과/1blocked·exit1에서 실제headless 탭hidden을관찰하지못함 | nativepagehide의즉시source.stop은별도통과. 실제OS백그라운드와동일한검수라고쓰지않음 |
| QA-FINAL | 현재6d4c actualThree9·recovery7·main19통과/1blocked,정적/빌드96unit통과. 현재독립HTML3638의퀴즈/키보드/장애23통과 | main의blocked를숨기지않음. file main19는현재재실행하지않았으므로file42현재통과로합산하지않음. currentPDF6이미지화면검토는통과했으며실제프린터검수별도 |
| QA-DEVICE | 실제Android/iOS/macOS Safari·실제touch/주소창/notch/softkeyboard/SR·청취 미실행 | 기기/OS/browser/출력장치/담당/날짜/절차/증거 확보 |
| QA-MUSIC | 음악 교육자·교사/학습자 관찰 대기 | 기보·용어·문항·동등답·오개념·수업 흐름 검토. 코드검사를 교육 효과로 확대하지 않음 |
| PERF-01 | 지속fps·100ms입력·50ms유선동기·모바일네트워크3초·발열 미측정. 15분 headless 안정성은 아래 STABILITY-01로 해결 | 지정 환경에서 실측. 빌드 bytes·600ms유휴·mock예약을 실제 기기 성능으로 대체하지 않음 |
| RELEASE-02 해결 | 후속 B a8c10094의 main push로 자동 production READY·SHA 일치·CI success·공개8검사 통과 | auto-deploy-verified.json / deployment-smoke-auto.json. 수동 기기·음악 검수와 구별 |

## 해결된 현재 항목

- **RELEASE-01 첫 실제 릴리스 해결:** main `c91e7ebb92304e95b44ff7d12820824cdeb0018b` push와 원격 SHA 일치,GitHub CI40382693913 success,Vercel `dpl_5crNfa8NBPeUeEfpiRxvXtCYs8Fd` production READY·동일 Git SHA,운영[https://music-rudiment-3d.vercel.app/](https://music-rudiment-3d.vercel.app/)의 공개200·실제 브라우저8검사 통과. [API 증거](evidence/release-first.json),[화면 증거](evidence/deployment-smoke-first.json),[릴리스 문서](../RELEASE.md). [공개 운영 HTML 해시](evidence/production-index-first.json)도 index6d4c와 일치한다. SSO/보호·임시 공유 링크·새 자격 증명은 변경/생성하지 않았다.

- **THREE-01 해결:** 공식 Three0.186.1/types0.186.0 설치, 실제 WebGL2 Canvas·Raycaster·context loss·2D복구. 실제 Three 객체6검사와 [최종6d4c HTTP9검사](../../output/http/three/results.json) 통과. 이전 CSS3D 대체를 실제 Three라고 표시한 것이 아니다.
- **NET-01 현재 지정 범위 해결:** 신뢰된 사용자 승인 후 공식 npm과 지정localhost4174 실행이 성공했다. 예전 ENOTFOUND/DNS 거부·localhostEACCES는 [과거 진단](../DEPENDENCY_DIAGNOSIS.md)으로 보존한다. 정확한 Windows 방화벽 규칙/포트 점유 원인을 조사 완료했다고 하지 않는다.
- **LOCK-01 설치 재현 해결:** 공식lock228·15정확선언/manifest·npm ci181packages/exit0. [설치 기록](../DEPENDENCY_INSTALL.md). 현재 clean 전체 source 재현도 아래 LOCK-REPRO로 해결했다.
- **LOCK-REPRO 해결:** [clean재현각명령](../../output/qa/clean-reproduction/results.json)typecheck/lint/unit96/content/build가exit0이다. [현재65소스파일비교](../../output/qa/clean-reproduction/source-match.json)는mismatches[]·main/clean index6d4c일치를 확인했다. 공식 npm ci181개 재실행도 exit0,Node범위는`>=24.14.0 <25`,현재lock SHA256은`9c381bfb0bf2c0d8954e9f72b5c721ce6a90eba8c6c819ac918579931d3e1138`이다. 초기64파일 비교는 이력이다. 최초복사경로오류는테스트전실패했고수정후전체실행통과했다.
- **SCORE-01 해결:** 실제 VexFlow5 SVG, 정상pnpm캐시293파일무결성·글꼴OFL고지·현재3638기보23/font복구1재실행exit0. 현재c5b54ae2 PDF6쪽9악보를Poppler100dpi로렌더하고부모가6이미지를실제확인해화면문제를발견하지못했다. [인수PDF](activity-sheet-six-scenes.pdf)는같은해시이며이전79cf검토는[이력](PRINT_REVIEW.md)이다. 교육자승인은별도다.
- **EXPORT-01 현재 HTTP 성공:** [최종6d4c 실제JSON](evidence/export-http-results.json)을 7,383바이트로 실제 saveAs 저장했다. 파일 SHA256 `8b9f7c07bddc17a5c1fa003913f33b7dbcac85a6885bda346ab052cfaf395693`,스키마·리듬 일치. 과거 file-origin download canceled는 원인 미확정 이력으로 보존한다.
- **STABILITY-01 해결:** [15분 headless 실제 결과](evidence/stability-summary.json)는900,030.0102ms·30회 반복·exit0,시작/종료 index6d4c다. native AudioContext최대1,각 Stop뒤live oscillator0·2D Canvas0,페이지/콘솔/실패·외부요청0. heap/DOM은 기록만 했으며 forced GC·heap 임계값·실제 기기 발열을 검증하지 않았다.
- **RECOVERY-01~03 해결:** 손상 시작기록 자동 덮어쓰기 차단, 새 학습자 퀴즈초기화, muted/volume0의잘못된 listened 기록을 수정하고 [최종recovery7검사](../../output/playwright/recovery-http-6d4ca09b/recovery-http-results.json) 통과.
- **CHUNK-01 해결:** 실제3D 지연 모듈 로딩 실패를 SceneBoundary가 처리하여 같은 리듬의2D 경로 유지. 실제WebGL 성공 경로와 장애주입 검사를 따로 기록했다.

## 보존할 실패와 제한

MuseScore 실행0xC0000409, Chromium1248 실행0xC0000022는 해당 바이너리 시도를 중단한 이력이다. 현재 기보는 MuseScore 실행에 의존하지 않으며 기존에 정상 실행을 검증한 headless-shell1223을 사용했다. 이 문서 담당자는 설치·브라우저·네트워크를 새로 재시도하지 않았다.

이전 [002afbaf](../../output/baseline-002afbaf/), [4f097829](../../output/baseline-4f097829/final-cohort.json)와 현재 hash를 구분한다. 실제 기기·음악·청취·사용자 검수 미실행을 “남은 결함 없음”으로 숨기지 않는다.
