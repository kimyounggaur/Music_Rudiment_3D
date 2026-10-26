# 인수인계

프로젝트: `C:\Users\kimyo\Documents\Codex\2026-10-27\task\music-theory-lab`. 새 독립 작업공간을 사용했고 기존 프로젝트·음악·입력 자료는 수정하지 않았다. 범위는 duration-basics의 여섯 장면이며 다음 단원은 템플릿만 작성했다.

## 재현과 실행

Node24.14 이상인24.x에서 `npm ci --ignore-scripts --no-audit --no-fund` → `npm run build` → `npm run preview`. 검증된 주소는 http://127.0.0.1:4174/ 이다. 개발 서버 기본 포트는4173이다. 제한 환경의 최초 접속 실패와 사용자 승인 후 지원 경로의 성공을 구별한다.

`output/clean-install`에서 공식 npm ci181개와 typecheck/lint/96 tests/content/build가 실제 통과했다. 65개 소스·설정·공개 고지 파일이 원본과 일치하고 main/clean 빌드 index SHA256은 모두 `6d4ca09b0288cdd5bdf376fbdc7168e13e432bdb919f6b6151d7f348ad08383d`다. [재현 기록](../output/qa/clean-reproduction/results.json).

`node scripts/build-standalone.ts`로 같은 소스의 독립 HTML을 다시 만들 수 있다. 현재 `output/preview.html`은1,821,442bytes/SHA256 `3638adefdcf32113307c7c093d3b82d3c36802934f2d8af0a59085b51f490a9f`다. 파일 origin의 저장소와 HTTP origin을 합쳐 설명하지 않는다.

## 구현과 검증

React/TypeScript, VexFlow5 실제 SVG, Three0.186.1 실제 WebGL2, audio clock 기반 재생, immutable 편집·평가, 교사·인쇄·JSON 저장이 연결됐다. React Three Fiber는 사용하지 않고 단순 Three 어댑터를 React 효과에서 관리한다. CSS3D 대체판은 역사 기록이며 현재 구현을 대신하지 않는다.

최신 결과는 [BUILD_STATUS](BUILD_STATUS.md), [QA_SUMMARY](QA_SUMMARY.md), [TEST_MATRIX](qa/TEST_MATRIX.md)를 따른다. 96개 순수/통합, HTTP주요19개 통과/배경탭1개 미검증, 실제Three9개, 저장회귀7개, 파일UI23개, 기보23개+글꼴복구1개를 각각 구분한다. 동일 검사의 과거 반복을 합산하지 않는다. 실제 pagehide에서는 미래 source.stop을 즉시 호출한 것을 확인했다.

최종 활동지 `docs/qa/activity-sheet-six-scenes.pdf`는58,368bytes/6쪽/9SVG이며 SHA256 `c5b54ae203de97661d21c0375852a3b04dd99e8d279ea53bfa3304f549df1635`다. Poppler100dpi로 여섯 페이지를 모두 다시 보고 레이블·기입 줄·보표의 잘림과 겹침을 찾지 못했다. 실제 프린터·Tagged PDF 인증은 아니다.

## 데이터와 복구

앱의 자체 localStorage 키와 백업만 사용한다. JSON 가져오기는 미리보기·명시 확인 후 적용한다. 손상/지원하지 않는 저장 데이터는 원문을 보존하며 임시 학습으로 계속하고, 확인된 새 학습자 시작이나 정상 JSON 가져오기 후에만 저장을 재개한다. 새 학습자는 문항 응답과 점수도 지운다. 음소거/음량0의 재생 완료는 청취로 기록하지 않는다. 원문·저장소 오류 대체 경로와 실제 HTTP 파일 저장을 확인했다.

전체 trace·임시 다운로드·이전 후보·패키지는 로컬 output/node_modules에 남겨 Git에서 제외한다. 서명 URL·토큰·비밀 설정은 읽거나 인계하지 않았다. 라이선스 원문은 public/licenses에 보존했다.

## 남은 수동 검수와 릴리스

운영 주소는 https://music-rudiment-3d.vercel.app/ 이다. 소스 c91e7ebb의 정상 push/CI/production 배포 후, 후속 a8c10094 push만으로 별도 production 배포가 자동 생성되는 것을 확인했다. 해당 배포/원격 SHA 일치·CI success·공개 운영8검사도 통과했다. 상세는 [RELEASE](RELEASE.md)와 보존한 API/브라우저 증거를 따른다. 새 OAuth·토큰·보호 설정 변경 없이 기존 통합을 사용했다.

실제 기기·청취·iOS/Safari·스크린리더·200% 전체 접근성·음악교사/학습자 파일럿은 미검증이다. headless에서 native document.hidden 전환을 만들지 못했다. 장시간 headless 안정성 결과와 실제 모바일 발열/FPS/출력 지연은 구별한다. 입력 원형 MD의 로컬 지원 전송 실패는 남아 있고 전체 원격 읽기/구현과 분리한다.

사용자는 지정 GitHub 저장소 commit/push, 이후 Vercel 배포·Git 자동 연동과 범위 내 네트워크 실행을 명시적으로 승인했다. 새 OAuth·토큰·지속 권한 확대·유료 변경은 승인 범위가 아니다. 원격 결과는 실제 SHA/CI/배포 상태를 확인한 뒤 별도로 기록한다. 강제 push나 기존 이력 삭제를 사용하지 않는다.
