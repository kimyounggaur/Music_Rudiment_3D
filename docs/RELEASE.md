# GitHub와 Vercel 릴리스

운영 주소: **https://music-rudiment-3d.vercel.app/**

저장소는 [kimyounggaur/Music_Rudiment_3D](https://github.com/kimyounggaur/Music_Rudiment_3D)이며 운영 브랜치는 `main`이다. 비어 있는 저장소를 확인한 뒤 새 독립 프로젝트의 소스·문서·선택한 테스트 증거만 정상 push했다. 기존 이력 삭제·force push·의존성/임시 파일·비밀 설정 커밋은 하지 않았다.

## 처음 확인한 릴리스

| 항목 | 실제 확인 결과 |
| --- | --- |
| 소스 커밋 | `c91e7ebb92304e95b44ff7d12820824cdeb0018b` |
| 원격 | `main`의 실제 SHA 일치 |
| GitHub CI | [Verify music lab #1](https://github.com/kimyounggaur/Music_Rudiment_3D/actions/runs/40382693913) success |
| Vercel 프로젝트 | `music-rudiment-3d`, `prj_rnWJfdGwpKbfCpjqfHupBAsQb8jd` |
| 팀 | `kimyounggaurs-projects`, `team_LVPR6NYP0tQeNt45mw0XXfH0` |
| 배포 | `dpl_5crNfa8NBPeUeEfpiRxvXtCYs8Fd`, READY, target `production` |
| 배포의 Git 메타데이터 | 같은 저장소·main·동일 c91e7eb SHA |
| 빌드 | Node24.x, 공식 npm ci181개, typecheck/lint/test/content/build 후 Deployment completed |
| 운영 화면 | 공개 HTTPS200, 실제 SVG·Three·오디오·작곡·저장·회전·MIT 고지·오류/외부요청 없음의8검사 통과 |

초기 생성 도구의 안내 문구는 preview였으나, 후속 실제 배포 API의 target은 production이었다. 위 판정은 실제 API 상태를 따른다. 팀의 기본 SSO/배포 보호는 변경하지 않았다. 정상 운영 별칭은 인증 없는 브라우저에서200이었으며, 임시 share link·bypass/OIDC 토큰·OAuth grant를 만들지 않았다.

## 자동 배포 연결

기존 같은 저장소 연결0개·예정 프로젝트 이름404·관련 프로젝트 목록을 확인한 뒤 `create_git_project`가 GitHub 연결과 운영 브랜치main을 반환했다. 같은 프로젝트를 사용한다. **main push는 production, 나머지 브랜치 push는 preview**가 되는 Git 통합을 사용하며 별도 수동 배포 워크플로나 새 자격 증명은 추가하지 않았다. [Vercel 공식 Git 동작](https://vercel.com/docs/git/vercel-for-github).

후속 커밋에는 실제 운영 주소·검증 기록·런타임 라이선스 안내와 Node24 major 범위 제한을 반영한다. 첫 빌드가 지적한 `>=24.14.0`의 향후 major 자동 선택 가능성을 `>=24.14.0 <25`로 제한했다. 이 실질적 수정의 push 뒤 자동 생성 배포와 SHA/CI를 다시 확인하고 최종 실행 보고서에 남긴다. 검증만을 위한 빈 코드 커밋은 만들지 않는다.

[첫 API 증거](qa/evidence/release-first.json) · [운영 브라우저8검사](qa/evidence/deployment-smoke-first.json) · [단계 상태](BUILD_STATUS.md) · [남은 수동 검수](KNOWN_LIMITATIONS.md)

실제 기기·출력 청취·음악교사·보조기술·배경 탭 hidden은 완료로 표시하지 않는다. 입력 MD의 지원 로컬 원형 전송 실패도 원격 읽기/실제 앱 구현과 별도 상태다. P00~P23 전체 수용이 모두 끝났다는 주장은 하지 않는다.
