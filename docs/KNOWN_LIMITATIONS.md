# 알려진 제한과 남은 검증

첫 리듬 단원의 여섯 장면과 실제 Three/VexFlow/Web Audio 기능은 구현하고 자동 검증했다. 아래 항목은 자동 검사 통과와 별개이며 설계서 전체 수용·실제 수업 효과 완료로 표시하지 않는다.

| 항목 | 현재 범위와 제한 |
| --- | --- |
| 입력 문서 원형 | 두 문서 전체 원격 읽기는 완료했다. 지원 Library 로컬 전송은 최초+허용된1회 재시도 모두 download failed였으며 원본 바이트를 로컬 검증하지 못했다. 추가 우회 전송은 하지 않았다 |
| 실제 기기·브라우저 | Windows Chromium148 headless의 HTTP/파일·viewport/키보드 검사다. 실제 휴대전화·회전 센서·터치 하드웨어·Safari/iOS·주소창/노치/소프트키보드는 미검증 |
| 오디오 청취 | native AudioContext 생성·예약·정지·반복·음소거 기록과 pagehide를 확인했다. 스피커/헤드폰 음질·음압·유선50ms 동기·청음 능력은 미검증 |
| 배경 탭 | headless 탭 focus 전환이 document.hidden을 만들지 못해 해당 검사는 blocked다. 실제 pagehide 이탈은 예약 소리를 즉시 정지함을 확인했다. 가짜 hidden 이벤트를 통과 근거로 사용하지 않았다 |
| 교육·접근성 | 문항/정확 분수·기보 fixture·키보드 경로는 확인했다. 음악교사 승인·학습자 파일럿·교육 효과·실제 보조기술·200% 전체 접근성 감사는 미검증 |
| 성능 | 단순 geometry·DPR1.5·lazy load·demand render·자원 정리 및2D fallback을 확인했다. headless 장시간 결과와 실제 저가형 기기30/60fps·발열·입력100ms·모바일3초 시작은 구별한다.500kB 초과 renderer chunk 경고를 보존했다 |
| 외부 기준 악보 | VexFlow의 실제 SVG23개와 글꼴 복구1개를 확인했다. MuseScore fixture 의미 검사는 했으나 프로그램 실행0xC0000409로 외부 SVG 비교는 하지 못했다 |
| 인쇄 | 현재6쪽 A4/9SVG PDF 전 페이지 화면 검수다. 실제 종이 출력·프린터 비인쇄 영역·Tagged PDF 인증·음악교사 승인과 다르다 |
| 원본 자산 | 원본 MP4/ZIP/음악 내용·권리를 검수하거나 앱에서 사용하지 않았다. 독자 블록·합성 학습음과 확인된 라이선스 패키지를 사용했다 |

공식 Three 설치·HTTP4174·clean npm ci의 과거 장애는 사용자 승인 후 지원 경로에서 해소했다. 현재 Three는 실제 WebGL이며 CSS3D 대체판이 아니다. 파일 origin 다운로드의 과거 canceled와 HTTP 파일 저장 성공은 서로 다른 실행 조건으로 기록한다. 전체·현재 결과는 [검증 표](qa/TEST_MATRIX.md)와 [단계 상태](BUILD_STATUS.md)를 따른다.

GitHub/Vercel 결과는 실제 원격 상태에 따라 별도 기록한다. 로그인·결제·새 OAuth·토큰 생성·유료 변경·방화벽 변경은 수행하지 않는다.
