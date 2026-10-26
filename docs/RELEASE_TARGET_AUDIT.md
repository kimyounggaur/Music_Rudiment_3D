# 릴리스 대상 읽기 전용 점검

점검일: 2026-10-26 (UTC)

## 최신 재조회 - 18:16 UTC, 기존 네트워크 실행 승인 반영

부모 실행자는 사용자의 네트워크 실행 승인이 도착했으며 기존 승인 범위로 공식 npm의 Three 조회가 성공해 `0.186.1`, `MIT`를 확인했다고 전달했다. 이 감사는 중복 승인을 요청하지 않았고 네트워크 진단·DNS·설치·CLI 인증을 추가 실행하지 않았다. 승인 도착 전 실패/대기 기록은 과거 이력이며 현재도 승인이 없다고 설명하지 않는다.

이 시점의 GitHub 저장소 재조회에서 확인한 필드는 다음과 같다. 전체 응답에서 관련 metadata만 발췌한 것이며 계정 인증 정보를 포함하지 않는다.

```json
{
  "id": "1434543491",
  "repository_full_name": "kimyounggaur/Music_Rudiment_3D",
  "visibility": "public",
  "archived": false,
  "size": 0,
  "default_branch": "main",
  "permissions": { "admin": true, "maintain": true, "pull": true, "push": true, "triage": true }
}
```

branch 조회는 아래에 기록된 동일 입력(owner/repo, 빈 query, page_size 20)으로 다시 실행했고 응답은 정확히 `{ "branches": [], "cursor": null }`이었다. content 확인을 위해 기본 ref의 `README.md`를 한 번 읽었으며 응답은 다음과 같다.

```json
{
  "error_code": "NOT_FOUND",
  "error_data": {
    "message": "This repository is empty.",
    "documentation_url": "https://docs.github.com/v3/repos/contents/#get-contents",
    "status": "404"
  }
}
```

따라서 이번 content 실패는 인증 거부가 아니라 API가 명시한 빈 저장소 상태다. 다른 파일명·ref로 재시도하지 않았다. `main`은 여전히 기본 이름 metadata이며 실제 ref/commit을 확인한 것은 아니다.

Vercel의 `list_teams(limit=100)`를 새로 호출한 결과도 아래 원래 기록과 같았다. 반환 팀은 `team_LVPR6NYP0tQeNt45mw0XXfH0` / `kimyounggaurs-projects` 한 개, pagination은 count 1과 prev `1776773358496`이며 next는 없었다. 정확한 repoUrl 필터와 limit 20으로 **기본 범위 및 이 반환 팀 범위**를 각각 재조회했고 두 응답 모두 다음과 같았다.

```json
{ "result": { "projects": [], "pagination": { "count": 0 } } }
```

확인한 범위에서 재사용할 연결 프로젝트 ID는 없었다. 다른 URL 표기나 접근 범위 밖의 프로젝트 부재까지 단정하지 않는다. 실제 Vercel Git 연결·production branch·자동 배포 설정이 이미 존재한다고 주장하지 않는다.

## 현재 connector의 정확한 쓰기 capability - 호출하지 않음

metadata 조회와 아래 **도구 스키마 확인만** 수행했다. 쓰기 도구는 실행하지 않았다.

| 도구 | 현재 스키마 및 의미 |
| --- | --- |
| `vercel_create_git_project` | 필수 `repo`, `teamId`; 선택 `projectName`, `provider`, `rootDirectory`, `deploy`. 접근 가능한 원격 Git 저장소에 연결된 프로젝트를 만들거나 **이미 그 저장소에 연결된 프로젝트를 재사용**한다. 로컬 source를 읽지 못하고, 같은 이름의 기존 미연결 프로젝트를 재연결하지 않는다 |
| `vercel_create_git_project.deploy` | 기본값 true이며 production branch에서 초기 **preview** 배포도 만든다. 단순 조회로 호출하면 안 된다. false는 사용자가 link-only를 명시한 경우의 옵션으로 문서화되어 있다. 이번 사용자가 link-only를 요청했다고 해석하거나 이 감사에서 설정하지 않았다 |
| `vercel_create_project` | `requestBody.name`과 선택 `requestBody.gitRepository: {repo, type, ...}`로 새 프로젝트에 Git 원본을 지정할 수 있다. `rootDirectory`, `buildCommand`, `installCommand`, `outputDirectory` 등의 생성 설정도 노출된다. 프로젝트 생성 작업이므로 이 감사에서 호출하지 않았다 |
| `vercel_update_project` | `idOrName`, `requestBody`, 선택 teamId/slug. 현재 명시된 schema는 빌드·설치·출력·rootDirectory·framework·nodeVersion·일부 Git 보호 설정 등을 제공하지만 **gitRepository 또는 productionBranch 필드는 노출하지 않는다** |
| production branch 직접 설정 | 현재 검색한 callable tool schema에서 `productionBranch` 직접 쓰기 필드를 발견하지 못했다. `create_git_project`에도 branch 이름 인자는 없다. 임의로 필드를 추가하거나 deployment ref와 지속적인 production branch 설정을 같은 것으로 취급하지 않는다 |

`create_git_project`는 원격 production branch에 의도한 source가 이미 push된 상황에 쓰도록 명시되어 있다. 새 프로젝트 생성/기존 연결 재사용 및 초기 preview라는 의미는 [공식 도구 문서](https://vercel.com/docs/agent-resources/vercel-mcp/tools/projects/create_git_project)와 일치한다. Git 연결 뒤 실제 프로젝트 응답에서 repo·team·production branch를 다시 확인해야 하며, GitHub의 default_branch가 자동으로 Vercel의 검증된 설정이 되는 것은 아니다.

공식 Git 안내의 production branch 선택/변경과 Branch Tracking은 아래 일반 정책 절을 따른다. 도구의 필드 부재를 확인했다고 해서 공식 대시보드 기능까지 불가능하다고 단정하지 않는다. 새로운 OAuth·토큰·권한이 필요해지는 작업은 기존 금지 범위와 구분해야 한다.

## 로컬 CLI 존재 확인 범위

`Get-Command vercel`은 경로를 반환하지 않았다. 다음 정상적인 manifest 경로도 없었다.

```text
C:\Users\kimyo\AppData\Roaming\npm\node_modules\vercel\package.json
C:\Program Files\nodejs\node_modules\vercel\package.json
C:\Users\kimyo\Documents\Codex\2026-10-27\task\music-theory-lab\node_modules\vercel\package.json
```

모든 디스크/캐시에서 CLI가 없다는 뜻은 아니다. CLI 설치·실행·인증 명령은 수행하지 않았고 token, auth 설정, 환경 변수, `.env`는 읽지 않았다.

## 사용자 허용과 보류 조건

부모 스레드가 전달한 새 사용자 허용은 **모든 작업이 완료된 뒤** 이 프로젝트를 `https://github.com/kimyounggaur/Music_Rudiment_3D`에 git commit/push하고, Vercel 배포 및 Git push 자동 연동을 진행하는 것이다. 이 명명된 대상에 관한 새 허용은 이전의 일반적인 push/배포 금지를 갱신한다. OAuth, 토큰 발급·조회, 새 권한, 유료 변경은 허용하지 않는다.

이 최초 대상 점검 시점에는 정확한 악보 renderer 연결도 미완료였지만, 이후 정상 pnpm cache에서 VexFlow 5를 확보하고 실제 악보 연결·기보 23개·폰트 재시도 1개 확인을 완료했다. 이전 릴리스 보류 항목은 Three 구현·HTTP 경로·실기기/교사·기관 QA의 남은 완료 조건이었다. 네트워크 승인 도착 후 부모의 새 구현/검증이 진행되므로 이 metadata 감사만으로 그 항목의 현재 완료 또는 미완료를 다시 확정하지 않는다. 오래된 악보 패키지 부재나 승인 미도착을 현재 보류 이유로 쓰지 않는다. 사용자 허용의 “모든 작업 완료 뒤” 조건 충족은 부모의 최신 검증 기록으로 판단한다. 이 읽기 전용 대상 점검에서는 로컬 Git 생성·commit·remote/ref 변경·push, GitHub 원격 생성, Vercel 프로젝트 생성·설정 변경·배포를 실행하지 않았다. 배포가 거부되거나 성공한 것으로 기록하지 않는다.

## GitHub 대상

대상: `kimyounggaur/Music_Rudiment_3D`.

부모 실행자가 이미 조회해 전달한 저장소 메타데이터의 확인된 부분은 다음과 같다. 이는 이 담당자가 받은 필드 요약이며 전체 응답을 재구성한 것이 아니다.

```json
{
  "id": 1434543491,
  "visibility": "public",
  "size": 0,
  "default_branch": "main",
  "permissions": { "push": true, "admin": true }
}
```

이 담당자의 실제 branch 조회 입력:

```json
{
  "owner": "kimyounggaur",
  "repo_name": "Music_Rudiment_3D",
  "query": "",
  "page_size": 20
}
```

성공 응답의 `structuredContent` 전체:

```json
{ "branches": [], "cursor": null }
```

조회 응답에 기존 branch ref는 없었다. 저장소 메타데이터의 기본 브랜치 이름 `main`만으로 실제 `refs/heads/main`이나 commit이 존재한다고 판단하지 않는다. 이 조회는 앞으로의 실제 push 인증·정책 통과를 시험한 것이 아니다.

## Vercel 조회 범위와 응답

사용 가능한 기존 프로젝트를 먼저 확인했다. 환경 변수·토큰·인증 설정·결제 정보를 읽지 않았다.

### 접근 가능한 팀 목록

입력: `{ "limit": 100 }`.

성공 응답의 JSON 결과 전체:

```json
{
  "result": {
    "teams": [
      {
        "name": "kimyounggaur's projects",
        "slug": "kimyounggaurs-projects",
        "id": "team_LVPR6NYP0tQeNt45mw0XXfH0",
        "saml": {}
      }
    ],
    "pagination": { "count": 1, "prev": 1776773358496 }
  }
}
```

이 응답은 팀 한 개를 반환했고 다음 페이지 토큰은 포함하지 않았다. 반환된 팀 범위와 기본 범위를 각각 아래와 같이 확인했다.

### 기본 범위의 저장소 URL 필터

```json
{
  "repoUrl": "https://github.com/kimyounggaur/Music_Rudiment_3D",
  "limit": "20"
}
```

### 반환된 팀 범위의 동일 필터

```json
{
  "repoUrl": "https://github.com/kimyounggaur/Music_Rudiment_3D",
  "limit": "20",
  "teamId": "team_LVPR6NYP0tQeNt45mw0XXfH0"
}
```

두 호출 각각의 성공 응답은 동일했다.

```json
{
  "result": {
    "projects": [],
    "pagination": { "count": 0 }
  }
}
```

따라서 **조회한 기본 범위와 반환된 팀 범위에서, 위 정확한 저장소 URL 필터에 일치하는 기존 프로젝트는 발견하지 못했다.** 다른 URL 표기·다른 계정·응답 밖 범위의 모든 프로젝트가 없다고 단정하지 않는다. 기존 Vercel 프로젝트 ID, 실제 Git 연결 설정, production branch, 자동 배포 설정은 확보하지 못했으며 설정 완료로 기록하지 않는다. 새 프로젝트도 만들지 않았다.

## 일반 Git 배포 정책과 실제 설정의 구분

Vercel의 공식 문서에서 Git 연결은 branch push에 따른 자동 배포를 제공하며, 설정된 production branch의 새 commit은 production 배포 대상이고 나머지 branch는 기본적으로 preview 또는 지정된 custom environment의 대상이다. Production branch는 변경할 수 있다. 예컨대 그 branch가 `main`으로 설정되어 있을 때 다른 branch는 기본 preview 대상이 된다. 이는 일반 정책이며 이 저장소에 그 설정이 적용되어 있다는 확인은 아니다. [Vercel: Deploying Git Repositories with Vercel](https://vercel.com/docs/git)

## 재개 시 확인할 사실

완료 조건을 충족한 뒤 허용된 기존 연결로 저장소 refs와 Vercel 프로젝트 검색 결과를 다시 확인하고, 실제 commit·대상 팀·프로젝트·production branch·빌드 설정을 확정해야 한다. 기존 대상을 재사용할 수 있으면 먼저 재사용한다. 새 OAuth/토큰/권한/유료 변경이 요구되면 그 작업을 진행하지 않고 정확한 요구와 상태를 보고한다. 이 점검은 향후 쓰기 작업의 성공을 보증하지 않는다.
