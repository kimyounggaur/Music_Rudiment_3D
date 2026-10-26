# 저장소 및 실행환경 점검

> 최신 보완: 초기 조사는 현재 폴더와 바로 위 폴더 범위였다. 이후 saved projects를 읽기 전용 조사하여 다른 로컬 개발 프로젝트의 의존성을 발견했고 새 music-theory-lab/node_modules로 복사·실행 검증했다. 기존 프로젝트 코드는 변경하지 않았다. 출처·버전·해시는 LOCAL_DEPENDENCIES.md, 새 대상 GitHub/Vercel 읽기 전용 확인은 RELEASE_TARGET_AUDIT.md를 따른다.

점검일: 2026-10-26 (UTC)

## 작업 위치와 기존 프로젝트

- 소비 실행환경 작업 폴더: `C:\Users\kimyo\Documents\Codex\2026-10-27\task`
- 최초 점검에서 이 폴더는 비어 있었다.
- 바로 위 `C:\Users\kimyo\Documents\Codex\2026-10-27`에는 `task` 폴더만 있었다.
- 따라서 현재 작업 폴더 또는 바로 위 폴더에서 재사용할 기존 저장소나 프로젝트를 발견하지 못했다. 다른 사용자 프로젝트 전체를 검색한 것은 아니다.
- 새 독립 작업 위치: `C:\Users\kimyo\Documents\Codex\2026-10-27\task\music-theory-lab`
- 이 보고서 작성 직전 위 새 작업 위치가 존재하지 않음을 확인했다. 기존 프로젝트와 원본 음악 자료를 수정하지 않았다.

## 저장소 지침

다음 각 경로의 `AGENTS.md`와 `.agents` 존재 여부를 확인했으며 모두 없었다.

```text
C:\Users\kimyo\Documents\Codex\2026-10-27\task
C:\Users\kimyo\Documents\Codex\2026-10-27
C:\Users\kimyo\Documents\Codex
C:\Users\kimyo\Documents
C:\Users\kimyo
C:\Users
C:\
```

존재하지 않는 `.agents/skills` 지침은 읽지 못했다. 비밀 값, 인증 설정, 제한된 세션 저장소는 읽지 않았다.

## 확인한 도구

| 항목 | 관찰 결과 |
| --- | --- |
| Node.js | `node --version` 성공: `v24.14.0` |
| npm | `npm --version` 성공: `11.9.0` |
| Git | `C:\Program Files\Git\cmd\git.exe` 명령 경로 확인. 저장소 생성·변경은 하지 않음 |
| 기본 Python/py 명령 | WindowsApps 별칭으로 연결되며 실행 시 `ResourceUnavailable` 발생 |
| 실제 Python | `C:\Users\kimyo\AppData\Local\Python\pythoncore-3.14-64\python.exe --version` 성공: `Python 3.14.3` |
| 전역 Node 패키지 | `C:\Users\kimyo\AppData\Roaming\npm\node_modules`에서 `pnpm`만 확인 |
| npm 패키지 캐시 | `npm cache ls` 결과에 React/TypeScript/Vite/Three/VexFlow/Playwright 검색 일치 항목이 없었음. 모든 가능한 오프라인 저장소가 없다는 뜻은 아님 |
| npm 캐시 위치 조회 | `npm config get cache` 실패: `The cache option is protected, and cannot be retrieved in this way`. 재시도·설정 파일 조회 없음 |
| Playwright 브라우저 파일 | Chromium 1217/1223/1243/1248 및 headless shell, Firefox/WebKit 캐시 디렉터리 존재 |

다음 브라우저 실행 파일의 존재와 크기는 확인했지만 실행하지 않았다.

```text
C:\Users\kimyo\AppData\Local\ms-playwright\chromium-1248\chrome-win64\chrome.exe
C:\Users\kimyo\AppData\Local\ms-playwright\chromium_headless_shell-1248\chrome-headless-shell-win64\chrome-headless-shell.exe
```

## 주요 점검 명령

PowerShell에서 다음 명령 또는 동일한 목적의 경로 배열을 사용했다. `rg`는 설치되어 있지 않아 최초 검색이 실패했고, 이후 `Get-ChildItem`과 `Get-Item`으로 확인했다.

```powershell
Get-ChildItem -Force -LiteralPath 'C:\Users\kimyo\Documents\Codex\2026-10-27\task'
Get-ChildItem -Force -LiteralPath 'C:\Users\kimyo\Documents\Codex\2026-10-27'
Get-Command py,python,node,npm,npx,git -ErrorAction SilentlyContinue
py -0p
node --version
npm --version
Get-ChildItem -LiteralPath 'C:\Users\kimyo\AppData\Local\Python','C:\Users\kimyo\AppData\Local\uv' -Filter python.exe -Recurse -ErrorAction SilentlyContinue
& 'C:\Users\kimyo\AppData\Local\Python\pythoncore-3.14-64\python.exe' --version
Get-ChildItem -LiteralPath 'C:\Users\kimyo\AppData\Local\ms-playwright'
npm root -g
npm cache ls
npm config get cache
```

## 현재 결론

독립 프로젝트 문서 보관 위치는 확보했다. 실제 앱 소스, 패키지 설치, 빌드 또는 테스트 성공은 확인되지 않았다. 입력 문서의 로컬 전송 및 npm 네트워크 장애는 [ENVIRONMENT_BLOCKERS.md](qa/ENVIRONMENT_BLOCKERS.md)에 기록했다.
