# v2.1 릴리스 사전 조회

2026-10-28 16:14 UTC 재조회: 로컬 HEAD와 `origin/main`은 모두 아래 기준 SHA이며 충돌이 없다. 기존 Vercel 프로젝트·팀·production 배포의 Git SHA도 일치했다. [원본 통합 결과](FIRST_RELEASE_INTEGRATION.md)는 272개 검사와 사용자 확인을 기록한다. 이 시점에는 아직 새 commit/push·원격 CI·새 READY를 주장하지 않는다.

2026-10-28 읽기 전용으로 확인했다. v2.1은 구현 중이며 commit·push·배포·설정 변경은 수행하지 않았다.

## 기존 대상

정확한 저장소 URL `https://github.com/kimyounggaur/Music_Rudiment_3D`로 Vercel 프로젝트를 조회했으며 일치한 프로젝트는 한 개였다.

| 항목 | 현재 응답 |
|---|---|
| 프로젝트 | `music-rudiment-3d` / `prj_rnWJfdGwpKbfCpjqfHupBAsQb8jd` |
| 팀 | `team_LVPR6NYP0tQeNt45mw0XXfH0` |
| 프레임워크 / Node | Vite / 24.x |
| 최신 배포 | `dpl_5SAdoeFcu4neHaPSGxbpsLmEAHWv` |
| 상태 / 대상 / 생성 경로 | READY / production / git |
| Git 저장소 / 브랜치 | `kimyounggaur/Music_Rudiment_3D` / `main` |
| 배포 SHA | `4dd62db8dc46ca6468bffeeb586c1d295a38a793` |
| 운영 별칭 | `music-rudiment-3d.vercel.app` |

기존 운영 배포는 v2.1 작업의 기준 커밋이며 현재 미커밋 개발 결과가 아니다. Git 자동 배포를 이미 검증한 이전 이력은 [RELEASE.md](../RELEASE.md)에 있다. 이번 조회는 향후 push 성공이나 새 v2.1 배포 성공을 보장하지 않는다.

## 로컬 배포 검사

`.github/workflows/ci.yml`은 push와 pull_request에 typecheck·lint·test·build를 실행한다. `vercel.json`은 같은 검사를 buildCommand에 포함하며 `dist`를 배포한다. 기존 Git 연동을 재사용하며 새 프로젝트·자격 증명·배포 워크플로를 만들지 않았다.

최신 사용자 지시에 따라 [첫 두 펼침면 범위](FIRST_RELEASE_SCOPE.md)의 필수 검증 완료 후 먼저 배포한다. 새 정상 커밋의 원격 SHA, CI, Vercel Git 메타데이터와 실제 운영 화면을 확인한 다음 나머지 네 펼침면을 구현한다. 현재의 보호 설정은 변경하지 않았으며 보호된 주소에 대한 우회 링크나 토큰을 만들지 않았다.
