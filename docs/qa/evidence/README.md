# 보존한 검증 증거

최종 HTTP index SHA256은 `6d4ca09b0288cdd5bdf376fbdc7168e13e432bdb919f6b6151d7f348ad08383d`, 독립 HTML은 `3638adefdcf32113307c7c093d3b82d3c36802934f2d8af0a59085b51f490a9f`다.

- `clean-reproduction.json`, `source-match.json`, `unit-results.txt`, `build-results.txt`: 공식 npm ci 후 동일65소스의 타입/린트/96테스트/콘텐츠/빌드 통과와 동일 index.
- `http-results.json`: 주요19통과, native document.hidden1개 blocked. 실제 pagehide 정지는 통과. suite의 exit1은 이 blocked를 숨기지 않기 위한 결과다.
- `three-results.json`: 실제 Three/WebGL2·선택·유휴·회전·정리·context loss·미지원/로딩 실패 대체9통과.
- `recovery-results.json`: 손상 원문 보호·확인된 초기화/가져오기·문항 초기화·음소거 청취 기록7통과.
- `quiz-results.json`, `keyboard-results.json`, `failure-results.json`: 현재 독립 파일의7+9+7검사. 반복한 과거 후보 수를 합산하지 않는다.
- `notation-results.json`, `font-retry-results.json`: 실제 기보23검사와 글꼴 실패 후 명시적 복구1검사.
- `print-results.json`: 현재6쪽 A4/9SVG PDF. 전 페이지 Poppler 화면 검수 기록은 `../PRINT_REVIEW.md`.
- `export-http-results.json`: 실제7,383bytes JSON 파일 저장·해시·현재 패턴·화면 원문 일치.

각 JSON은 실제 로컬 실행 결과의 복사본이다. 내부 PNG/trace/다운로드 절대 경로는 이 컴퓨터의 원본 `output/`을 가리킨다. 전체 원본과 과거 후보는 Git에서 제외하고 로컬에 보존한다. 선택한 스크린샷과 활동지 PDF는 `docs/qa/`에 함께 보존했다. 실제 휴대전화·청취·교육자·스크린리더 검사는 이 자동 검증에 포함하지 않는다.
