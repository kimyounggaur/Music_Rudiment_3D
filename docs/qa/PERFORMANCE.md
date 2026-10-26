# 성능과 장애 검수

현재 환경: Windows, Node24.14.0, Vite5.4.21 production build, 실제 Three0.186.1, Chromium148.0.7778.96 headless, 승인된localhost4174 HTTP. CPU/network throttle 없음. 실제 저가형 휴대전화·실제 모바일GPU 시험이 아니다.

현재 `dist/index.html` SHA256은 `6d4ca09b0288cdd5bdf376fbdc7168e13e432bdb919f6b6151d7f348ad08383d`다. 독립 HTML은1,821,442바이트·SHA256 `3638adefdcf32113307c7c093d3b82d3c36802934f2d8af0a59085b51f490a9f`이다. 이 문서 담당자가 실제 파일을 읽어 크기와 두 해시를 재확인했다.

## 운영 릴리스의 검사 범위

첫 실제 릴리스 A는 main `c91e7ebb92304e95b44ff7d12820824cdeb0018b`와 연결된 Vercel production READY이며 [운영 주소](https://music-rudiment-3d.vercel.app/)의 공개200·브라우저8검사를 통과했다. [실제 운영 화면 증거](evidence/deployment-smoke-first.json)는 기능 확인이며,운영 네트워크 지연·FPS·실제 모바일 성능 측정이 아니다. Node major 범위를`>=24.14.0 <25`로 제한한 현재65파일의 clean 재현은 공식 npm ci181개·typecheck/lint/unit96/content/build각exit0으로 통과했다. 후속 B push 뒤 자동 Git 배포는 아직 대기다. [공개 운영 HTML 해시](evidence/production-index-first.json)도 index6d4c와 일치하며 아래 자원 측정은 유지된다. 운영 기능 smoke8통과를 FPS·latency 측정으로 바꾸지 않는다.

## 빌드 자원 측정

아래는 현재 파일 bytes와 Node zlib.gzipSync로 계산한 압축 크기다. 서버가 실제로 압축 전송한 양·초기 네트워크 payload·캐시 성능을 뜻하지 않는다. sourcemap은 아래 JS/CSS 표와 별도 생성 파일이다.

| 빌드 파일 | 실제 bytes | 계산 gzip bytes | 용도 |
| --- | --- | --- | --- |
| index-Ca2y-oL_.js |288,677|92,535|React/학습 UI·엔진 |
| index-BAGu6o6O.css |12,984|3,671|반응형·인쇄 스타일 |
| DurationScene3D-DzaAgZdJ.js |9,579|4,212|지연 로딩3D 표현 wrapper |
| three.module-DOzBRDFc.js |746,922|191,790|실제 Three renderer |
| vexflow-bravura-B1hF8ZV_.js |728,244|389,651|악보 renderer·내장 음악 글꼴 |

Three와 VexFlow chunk는500kB 경고 기준을 넘는다. 경고를 숨기지 않았으며 실제 사용 범위와 lazy로딩을 유지했다. 초기 compressed3MB 목표에 대한 실제 네트워크 조건·전송량 측정과3초 조작 가능 판정은 아직 수행하지 않았다. sourcemap을 자동으로 초기 전송에 합하거나 제외한 가상수치로 목표 통과를 주장하지 않는다.

## 목표와 관찰 결과

| 목표/검사 | 현재 실제 관찰·판정 | 증거·남은 조치 |
| --- | --- | --- |
| 유휴 시 불필요한 렌더 중단 | 실제 Three 안정화 후600ms 동안 render-count2에서 추가 증가0 | [최종HTTPThree](../../output/http/three/results.json). 그600ms 조건의 유휴 확인이며FPS 보장 아님 |
| 시간축·기하 | 온음표너비10,2분음표x/width0/5와5/5, 높이0.38·깊이0.9, DPR1.5 | 실제Three객체6검사와최종HTTP검사. 음가 길이를44px로왜곡하지 않음 |
| 반복 전환 자원 정리 |6회 mount/unmount와빠른 취소 뒤Canvas0개 | 최종HTTP검사. GPU드라이버 메모리 전수측정과동일하지 않음 |
| context loss·WebGL부재·chunk실패 복구 | 재생 정지·Canvas정리·같은리듬2D전환 확인 | 실제context loss 및 별도장애주입 성공. [Three검수](Three_REVIEW.md) |
| 오디오·저장 복구 | 예약 취소/무음/일관성 단위검사, 실제AudioContext 재생·정지·Loop·nativepagehide즉시stop, 손상저장보존·음량0기록회귀통과 | [최종recovery7](../../output/playwright/recovery-http-6d4ca09b/recovery-http-results.json),[최종main19통과/1blocked](../../output/playwright/http-6d4ca09b/results.json). native탭숨김blocked별도 |
| 입력 후100ms | 미측정 | 지정 입력·타이밍측정 필요 |
| 지속 모바일30fps·데스크톱60fps | 미측정 |16블록·재생·편집의 frame-time/장시간프로필 필요 |
| 유선 오디오·시각50ms | 미측정 | 실제출력장치·측정절차 필요. mock예약/OfflineAudioContext/실제AudioContext UI동작이청취·출력지연을입증하지 않음 |
| 모바일네트워크3초·초기압축3MB | 실환경 미측정 | network/CPU/cache조건·반복횟수정의 필요 |
|15분 headless 안정성 |실제900,030.0102ms·30회 반복·exit0 | [실제 요약](evidence/stability-summary.json),시작/종료 index6d4c. native AudioContext최대1·각Stop뒤live oscillator0·2D Canvas0,페이지/콘솔/실패·외부요청0 |
|실제 모바일15분·발열·장시간FPS |미측정 |headless15분을실제휴대전화·발열·FPS시험으로확대하지않음 |

15분 실행의 heap/DOM 값은 관찰용으로 기록했다. 첫/끝 JSHeapUsedSize는 각각9,954,788/11,700,724바이트였으며 Documents는1/1이었다. forced GC를 실행하지 않았고 nondeterministic heap 임계값을 assertion으로 사용하지 않았다. 이 숫자로 메모리 누수 부재를 입증했다고 하지 않는다. 전체 결과는 [원본 실행 보고서](../../output/http/stability-6d4ca09b-2026-10-26T18-37-54-280Z/results.json)와 위 요약을 따른다.

DPR상한·단순메시·공유Geometry/Material·고정직교시점·demand rendering·lazy3D·수동2D/모션감소를 구현했다. 자동으로 성능 목표를 달성했다는 뜻은 아니다. 유휴0추가프레임을0fps실패로오해하지 않으며, 무음·낮은모션·2D에서도같은학습데이터와핵심명령을사용한다.

이전CSS3D·1,067,251바이트독립HTML의측정은 [4f097829이력](../../output/baseline-4f097829/final-cohort.json)이다. 현재실제Three측정에과거수치를승계하지 않는다. 실제기기·청취·SR·음악교육자검수는별도대기다.
