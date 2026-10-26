# 현재 QA 요약

현재 개발 구현에는 실제 Three.js0.186.1 WebGL2와 VexFlow5 SVG 악보가 포함된다. CSS3D만 구현됐다는 이전 상태는 해소됐다. 자동 검사 통과와 실제 기기·청취·음악 교육 검수는 서로 다른 결과다.

## 빌드와 실행 환경

- Windows, Node24.14.0, npm11.9.0, Chromium148.0.7778.96 headless.
- 공식 설치15정확선언·228lock항목·15manifest 확인, clean-install npm ci181packages/exit0. [설치 기록](DEPENDENCY_INSTALL.md).
- 현재 `dist/index.html` SHA256: `6d4ca09b0288cdd5bdf376fbdc7168e13e432bdb919f6b6151d7f348ad08383d`.
- 현재 독립 HTML:1,821,442바이트, SHA256 `3638adefdcf32113307c7c093d3b82d3c36802934f2d8af0a59085b51f490a9f`.
- HTTP 검수 대상은 승인된 `http://127.0.0.1:4174/`다. 자동화 WebGL은 실제 모바일 GPU·Safari 인증이 아니다.

## 실제 결과의 범위

| 검수 | 실제 결과 | 대상·증거 |
| --- | --- | --- |
| 현재 정적·콘텐츠·빌드 |typecheck/lint/content:validate/build통과 | 부모현재명령과[clean각명령exit0](../output/qa/clean-reproduction/results.json),6장면9레인 |
| 현재 단위/통합 |96통과·0실패·0skip | 기존90+실제Three6,[clean unit.log](../output/qa/clean-reproduction/unit.log). 과거90TAP와구분 |
| 최종 실제 Three HTTP |9/9통과 | [현재6d4c 결과](../output/http/three/results.json) |
| 최종 복구 HTTP |7통과·0실패·0blocked | [현재6d4c 결과](../output/playwright/recovery-http-6d4ca09b/recovery-http-results.json) |
| 최종 main HTTP |19통과·1blocked, suite exit1 | [6d4c 결과](../output/playwright/http-6d4ca09b/results.json),runner native-pagehide-v1. native pagehide검사통과,탭숨김blocked |
| 현재 실제 JSON 파일 다운로드 |7,383바이트 실제 saveAs·스키마·리듬 일치 | [6d4c 결과](qa/evidence/export-http-results.json),파일 SHA256 `8b9f7c07bddc17a5c1fa003913f33b7dbcac85a6885bda346ab052cfaf395693`. 과거 file-origin 취소 이력은 별도 |
| 현재 악보 fixture/글꼴 복구 |23검사+1복구검사 재실행 통과·exit0 | 현재독립HTML3638,[기보 결과](../output/notation/vexflow5/results.json),[복구 결과](../output/notation/font-retry/results.json) |
| 현재 file-origin 키보드·퀴즈·장애 |퀴즈7·키보드9·장애7, 합23통과 | 독립HTML3638,부모실행exit0. file main19는현재재실행하지않았으며옛42cohort와구분 |
| 현재인쇄화면 |6쪽·58,368바이트·9악보,6이미지전체검토통과 | 현재SHA`c5b54ae203de97661d21c0375852a3b04dd99e8d279ea53bfa3304f549df1635`,[Poppler100dpi렌더](../output/qa/print-final/rendered-current/),[인수PDF](qa/activity-sheet-six-scenes.pdf). 실제프린터·Tagged PDF·교사승인아님 |
| clean 전체source재현 |typecheck/lint/unit96/content/build각exit0 | [결과](../output/qa/clean-reproduction/results.json),[64파일해시일치·양쪽index6d4c](../output/qa/clean-reproduction/source-match.json). 최초복사상대경로오류는테스트전실패,수정후통과 |
|15분 headless 안정성 |900,030.0102ms·30회 반복·exit0 | [실제 요약](qa/evidence/stability-summary.json). 시작/종료 index6d4c,Context최대1·Stop뒤live oscillator0·2D Canvas0,페이지/콘솔/실패·외부요청0 |

실제 Three 검사는 정확한 길이/고정 높이·깊이, 실제 Raycaster 선택과 드래그 취소,44px DOM 선택·회전 보존, 점선 빈 쉼표, context loss 중 정지·2D전환, Canvas 자원 정리, WebGL부재·lazy chunk 실패를 확인했다. 600ms 유휴 render-count가2에서 증가하지 않았다는 결과는 그 조건의 유휴 검사이며 지속 FPS 보장은 아니다. [Three 검수](qa/Three_REVIEW.md).

복구 회귀는 malformed/future/reference-tamper 원문이 삭제나 유효 import 확인 전 덮어써지지 않음, 새 학습자 시작의 퀴즈 답/점수 초기화, 음소거·volume0이 listened 기록이 되지 않음을 확인했다. JSON import는 validate→preview→confirm→semantic validate→storage commit 경계를 따른다.

네이티브background visibility 검사는최종6d4c에서도실제hidden을관찰하지못해blocked였다. 별도nativeabout:blank pagehide검사는미래Loop예약source.stop을즉시호출하고복귀후자동재생하지않음을확인해통과했다. 모의visibility·pagehide·실제탭비활성화·실제OS백그라운드복귀를같은검수로합치지않는다.

## 아직 완료하지 않은 검수

실제 Android/iOS·macOS Safari, 주소창/notch/homebar·touch·softkeyboard·실제 SR·200% 확대 전체 경로, 스피커/헤드폰 청취, 유선 오디오·시각50ms, 지속30/60fps·입력100ms·모바일네트워크3초, 교육자·교사/학습자 관찰은 미실행 또는 미측정이다. [성능](qa/PERFORMANCE.md), [남은 사항](qa/OPEN_ISSUES.md).

두 입력 MD 원형의 로컬 확보는 실패 상태로 남아 있다. 원본 Library 전체793/1268줄 읽기와 실제 구현은 진행했으나 local materialization 성공으로 바꾸지 않는다. 원본 영상/ZIP·음원 재사용/권리 검수도 하지 않았으며 독자 도식·합성 학습음을 사용했다.

15분 안정성의 heap/DOM 값은 관찰 기록이며 nondeterministic heap 임계값이나 forced GC 검사를 사용하지 않았다. 이 결과를 실제 모바일 발열·지속 FPS·청취 결과로 확대하지 않는다.

현 판정은 “구현과 명시한 자동 경로·clean 재현·15분 headless 안정성 통과,일부 환경 및 수동 검수 대기”다. 전체 기기 검증·실제 청취·음악 승인·학습 효과·공개 배포 완료를 주장하지 않는다. 지정 GitHub/Vercel 결과는 부모의 별도 실제 실행 기록을 따른다.
