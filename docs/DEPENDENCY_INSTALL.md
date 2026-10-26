# 승인 후 공식 lock 설치와 현재 의존성 검증

기록일: 2026-10-26 UTC. 현재 snapshot 생성 시각은 `2026-10-26T18:21:33.405Z`다.

## 현재 설치 근거

사용자의 네트워크 실행 승인이 도착한 뒤 부모 실행자가 공식 npm 레지스트리의 Three `0.186.1`(MIT) 조회 및 설치를 수행했다. 부모 실행자는 별도 `output/clean-install` 폴더의 `npm ci`가 **181 packages added, 종료 코드 0**으로 완료됐음을 전달했다. 이 담당자는 설치나 네트워크 요청을 재실행하지 않았다.

현재 `package.json`은 runtime 4개와 development 11개, 합계 **15개의 정확한 버전 선언**을 가진다. 실제 버전과 설치 manifest SHA-256은 [DEPENDENCY_SNAPSHOT.json](DEPENDENCY_SNAPSHOT.json)에 기록했다. Three는 `0.186.1`, VexFlow는 `5.0.0`이다.

| 확인 항목 | 실제 관찰 |
| --- | --- |
| package-lock 형식 | npm lockfileVersion 3 |
| lock의 패키지 항목 | root를 제외한 228개 |
| 현재 환경에 존재하는 lock 항목 | 181개, 실제 package.json 버전 일치 |
| 존재하지 않는 optional 항목 | 47개. 현재 플랫폼에 설치되지 않은 선택 의존성으로 별도 집계 |
| 직접 선언한 설치 manifest | 15/15개 버전·SHA-256 snapshot 확인 |
| 본 프로젝트/clean-install lock | SHA-256 동일 |
| 본 프로젝트/clean-install 직접 선언 manifest | SHA-256 15/15개 동일 |
| current lock SHA-256 | `ad55f1c25618641e0dc66cbd51927393457d3005955907e89095db8df2c8c8a3` |

이전 로컬 캐시 조합의 13개 선언·21개 manifest 해시·177개 잠정 lock 항목은 **당시 상태의 이력**이다. 현재 공식 lock 설치를 그 숫자로 검증하지 않는다. [LOCAL_DEPENDENCIES.md](LOCAL_DEPENDENCIES.md)의 21개 원본 해시와 [DEPENDENCY_DIAGNOSIS.md](DEPENDENCY_DIAGNOSIS.md)의 pnpm 검증 기록은 변경하지 않고 보존한다.

## verifier 사용

프로젝트 루트에서 읽기 전용 검증:

```powershell
node scripts/verify-local-dependencies.ts
```

의도적으로 검토한 새 설치/lock 변경을 snapshot에 반영할 때만 명시적으로 실행한다.

```powershell
node scripts/verify-local-dependencies.ts --write-snapshot
node scripts/verify-local-dependencies.ts
```

현재 두 실행 모두 종료 코드 0이었다. 새 verifier 파일의 ESLint도 종료 코드 0이었다. 기본 실행은 파일을 쓰거나 설치·네트워크 요청을 수행하지 않는다. snapshot 갱신 옵션은 lock/실제 설치의 일치 검사를 먼저 수행한 뒤 `docs/DEPENDENCY_SNAPSHOT.json`만 쓴다.

검사 범위:

- root package.json의 dependencies/devDependencies와 lock root 선언 일치.
- 직접 선언한 15개 패키지의 실제 이름·버전 및 설치 manifest SHA-256.
- lock 전체 바이트 SHA-256과 항목 수가 검토된 snapshot과 일치.
- 각 lock 경로가 이 프로젝트의 node_modules 안에 머무르는지, 실제 설치 버전과 registry resolved/integrity metadata가 있는지 확인.
- 누락된 optional 항목과 누락된 필수 항목을 구분. 후자는 실패로 처리.

## 무결성과 clean build의 범위

이번 설치는 npm의 registry integrity 검증 기능을 사용하는 설치 결과다. 이 담당자가 압축 tarball 228개 전부의 SHA-512를 수동 재계산했다고 주장하지 않는다. snapshot은 **lock 전체와 선택된 설치 package.json 파일**의 SHA-256이며 모든 설치 파일의 전수 내용 검사는 아니다. 이전 pnpm VexFlow 복사의 293개 파일 SHA-512 검증은 그 캐시 확보 단계의 독립 증거로 남는다.

이 담당자가 비교한 것은 본 프로젝트와 clean-install의 lock 및 15개 직접 선언 manifest다. clean 폴더의 TypeScript/Vite로 동일 source를 검사·빌드하는 검증은 부모 실행자가 담당하며, 실제 실행 결과는 [BUILD_STATUS.md](BUILD_STATUS.md)와 QA 로그를 따른다. npm ci 설치 성공을 clean source build·실제 서비스·배포 성공으로 확대하지 않는다.

네트워크 승인 이전의 ENOTFOUND/DNS 접근 거부·오프라인 ENOTCACHED 기록은 과거 진단으로 보존한다. 현재 승인이 없거나 공식 lock 설치가 아직 실패 상태라고 설명하지 않는다. 이 담당자는 추가 승인 요청, token/auth/env 조회, 새로운 설치, remote 변경 또는 배포를 수행하지 않았다.
