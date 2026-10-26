# 최신 진행 상태와 재개 지점

첫 릴리스 A는 실제 배포됐다. 운영 주소는 [https://music-rudiment-3d.vercel.app/](https://music-rudiment-3d.vercel.app/)이며, main 커밋 `c91e7ebb92304e95b44ff7d12820824cdeb0018b`의 원격 SHA 일치·GitHub CI success·Vercel production READY·공개 HTTPS200과 실제 브라우저8검사 통과를 확인했다. [릴리스 기록](RELEASE.md), [API 증거](qa/evidence/release-first.json), [운영 화면 증거](qa/evidence/deployment-smoke-first.json).

후속 B `a8c10094e225add88e8fcdf0f90a8b89dc5b3351`은 운영 주소·런타임 MIT·Node24 major 상한의 실질적 수정이다. main push만으로 Vercel `dpl_9qrmQkYn9fvZoSW44usshp4LzQJp`가 자동 생성되어 production READY가 됐다. 원격/배포 SHA 일치, GitHub CI #40384757352 success, 공개 운영 브라우저8검사 통과를 확인했다. 이 커밋에는 수동 배포 API를 호출하지 않았다. 증거는 `docs/qa/evidence/auto-deploy-verified.json`과 `deployment-smoke-auto.json`이다. clean65파일·96검사와 index6d4c는 유지되며, 실제 기기·청취·수동 검수는 별도 미완료다.

작업 폴더는 `C:\Users\kimyo\Documents\Codex\2026-10-27\task\music-theory-lab`이다. React/TypeScript 음가 여섯 장면에 실제 VexFlow SVG 악보, 실제 Three.js WebGL2 블록, Web Audio 단일 시간축, 교사 보기와 로컬 저장/JSON 교환을 연결했다. 기존 원본 음악·영상·다른 프로젝트는 덮어쓰지 않았다.

승인 후 공식 Three0.186.1/types0.186.0 설치와 별도 clean-install의 npm ci가181packages/exit0으로 실행됐다. 현재15정확선언·228lock·15manifest 해시를 검증했다. 이전 npm/DNS/localhost 승인 대기는 해결 이력이며 현재 장애로 반복하지 않는다. 원본 입력 MD 두 개의 로컬 materialization 실패는 여전히 별도 미해결이다. 전체 본문을 읽어 진행한 구현과 원형 보관 상태를 구분한다.

현재 부모가 실행한 typecheck·lint·content validation·build는 통과했고 단위/통합은96검사 통과다. 별도 clean 환경에서 npm ci 181개를 다시 실행해 exit0이며,typecheck/lint/unit96/content/build 모두 exit0,현재65소스파일 해시가 일치하고 main/clean index는 동일하다. 초기64파일 비교는 A의 이력이다. 최초복사경로오류는테스트전실패이력이며수정후통과와구분한다. 최종 index SHA256은 `6d4ca09b0288cdd5bdf376fbdc7168e13e432bdb919f6b6151d7f348ad08383d`, 독립 HTML은1,821,442바이트·SHA256 `3638adefdcf32113307c7c093d3b82d3c36802934f2d8af0a59085b51f490a9f`다.

현재6d4c에서 실제 Three HTTP9검사와 복구 HTTP7검사가 통과했다. 최종6d4c에서도 실제 7,383바이트 JSON saveAs를 확인했고 생성 파일 SHA256은 `8b9f7c07bddc17a5c1fa003913f33b7dbcac85a6885bda346ab052cfaf395693`이다. 최종6d4c main HTTP는19통과/1blocked·exit1이다. 네이티브about:blank pagehide에서 미래Loop예약source.stop을즉시호출하는 검사는 통과했으며, 실제headless 탭숨김관찰은blocked다. 현재독립HTML3638에서퀴즈7·키보드9·장애7의23검사가통과했다. file main19는현재artifact에서재실행하지않았으므로현재file42통과라고쓰지않는다.

확인한 수정에는 실제 Three context loss/모듈 실패의2D 복구, 손상된 시작 기록의 자동 덮어쓰기 차단, 원자적 import, 새 학습자 퀴즈 초기화, 음소거·volume0의 청취 기록 방지가 포함된다. 실제기기·청취·SR·음악 교육자·교사/학습자 관찰은 수행하지 않았다. 현재기보23·font복구1을재실행통과했다. A4 6쪽/9악보의이전79cfPDF는화면렌더에서검토했다. 새c5b54ae2 PDF6쪽·58,368바이트를Poppler100dpi로렌더하고부모가6페이지이미지를모두확인해화면문제를발견하지못했다. 인수PDF도같은해시다. 실제프린터시험은아니다.

15분 headless 안정성은 실제 900,030.0102ms·30회 반복·exit0으로 통과했다. native AudioContext 최대1개, 각 Stop 뒤 live oscillator0·2D Canvas0, 페이지/콘솔/실패·외부요청0이며 시작·끝 index는6d4c다. heap/DOM은 기록만 했고 forced GC·heap 임계값 검사는 하지 않았다. 실제 모바일 발열·FPS 검증은 아니다. 첫 GitHub/Vercel 릴리스 A는 실제 성공했다. 다음 부모 작업은 확인된 B 자동 Git 배포·동일 SHA·CI·공개8검사 증거를 보존하는 것이다. 해당 자동 배포 검증은 완료했다. 현재 clean65파일 재현과 현재 PDF 전체렌더검토는 통과했다. 운영 HTML fetch의 index6d4c 일치도 확인했다. 현재 로컬 실행 방법은 [README](../README.md)를 따른다.

자세한 상태: [BUILD_STATUS](BUILD_STATUS.md), [QA_SUMMARY](QA_SUMMARY.md), [OPEN_ISSUES](qa/OPEN_ISSUES.md), [PERFORMANCE](qa/PERFORMANCE.md). 과거 CSS3D/file-only·90검사 snapshot은 [4f097829 이력](../output/baseline-4f097829/final-cohort.json)으로 보존하며 현재 결과와 혼합하지 않는다.
