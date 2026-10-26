# 로컬 의존성 확보 기록

> 역사 기록: 아래 21개 source/cache manifest 해시와 177개 잠정 lock 상태는 네트워크 승인 전·초기 로컬 확보 단계의 증거다. 값을 덮어쓰지 않고 보존한다. 승인 후 공식 npm lock 설치의 현재 15개 선언·228개 lock 항목과 verifier는 [DEPENDENCY_INSTALL.md](DEPENDENCY_INSTALL.md), [DEPENDENCY_SNAPSHOT.json](DEPENDENCY_SNAPSHOT.json)을 따른다. 아래의 “현재”·미검증 상태 표현은 이 역사 기록 작성 시점을 뜻한다.

기록일: 2026-10-26 (UTC)

네트워크 설치 없이 기존 로컬 개발 패키지의 필요한 트리만 새 프로젝트의 `node_modules`로 복사했다. 원본 프로젝트를 실행하거나 수정하지 않았고, 원본 음악 파일·작업 자료를 변경하지 않았다. junction 또는 원본 폴더를 가리키는 링크를 만들지 않았다. 패키지의 포함된 라이선스 파일은 패키지 트리와 함께 유지했다.

## 원본 위치와 선택 범위

| 원본 위치 | 복사한 주요 패키지 |
| --- | --- |
| `D:\256G 1\01 레슨디자이너-반응형 웹사이트\악보 디자이너\교육용 악보작업 웹앱17\node_modules` | `react`/`react-dom` 19.2.5, `scheduler` 0.27.0 |
| `D:\256G 1\01 레슨디자이너-반응형 웹사이트\신디사이저\node_modules` | TypeScript 5.9.3, Vite 5.4.21, esbuild 0.21.5, Rollup 4.60.2, React 타입, 관련 의존성과 Windows 네이티브 패키지 |
| `D:\256G 1\01 레슨디자이너-반응형 웹사이트\바이브 코딩(게임)\슈퍼마리오 응용 게임(Codex)\node_modules` | ESLint 9.39.4, `@eslint/js` 9.39.4, typescript-eslint 및 parser/plugin 8.59.4, `@types/node` 22.19.19, `undici-types` 6.21.0, 관련 의존성 |
| `D:\256G 1\01 레슨디자이너-반응형 웹사이트\국악기 교육 전자도서관\node_modules` | `eslint-plugin-react-hooks` 7.1.1 및 관련 의존성 |
| `C:\Users\kimyo\AppData\Local\npm-cache\_npx\420ff84f11983ee5\node_modules` | `@playwright/test`, `playwright`, `playwright-core` 각 1.60.0 |
| `D:\.pnpm-store\v11\index.db` 및 `files` | VexFlow 5.0.0 전체 293개 파일·21,275,468바이트. index에 기록된 모든 SHA-512를 원본과 복사본에서 검증하고 LICENSE·내장 폰트를 보존 |

첫 번째 원본 `node_modules`는 11,086개 파일·338,535,645바이트였지만 Next/Stripe 등 이 앱에 필요 없는 패키지를 복사하지 않았다. 선택한 패키지의 `dependencies`를 로컬 원본 경로에서 해석해 복사했으며, 버전 충돌이 있는 하위 의존성은 요청 패키지의 내부 `node_modules`에 두었다. Windows에서 없는 선택 의존성 `fsevents`는 복사하지 않았다. 패키지 설치 스크립트는 실행하지 않았다.

대상은 `C:\Users\kimyo\Documents\Codex\2026-10-27\task\music-theory-lab\node_modules`이다. `package.json`과 앱 소스는 부모 구현 담당자가 관리한다. 이 작업에서 npm 레지스트리 재시도, 권한 확대, 외부 다운로드 또는 공개 배포를 하지 않았다.

## 실제 실행 확인

다음 명령은 대상 프로젝트에서 성공했다.

| 명령 | 결과 |
| --- | --- |
| `node node_modules/typescript/bin/tsc --version` | `Version 5.9.3` |
| `node node_modules/vite/bin/vite.js --version` | `vite/5.4.21 win32-x64 node-v24.14.0` |
| `node node_modules/esbuild/bin/esbuild --version` | `0.21.5` |
| `node node_modules/eslint/bin/eslint.js --version` | `v9.39.4` |
| `node node_modules/@playwright/test/cli.js --version` | `Version 1.60.0` |
| `require('eslint-plugin-react-hooks')` | 모듈 읽기 성공, rules 29개 |

이 결과는 도구 실행 확인이며, 앱의 타입 검사·린트·빌드·브라우저 테스트 통과를 뜻하지 않는다. 해당 검증은 부모 구현 담당자가 별도로 기록한다.

초기 Node `fs.cpSync` 복사는 프로세스 종료 코드 `-1073740791`로 중단되었다. 이후 동일한 허용 대상에 PowerShell `Copy-Item`을 사용하여 복사를 완료했다. 접근 거부를 우회한 것은 아니며 접근 거부가 발생한 복사 파일은 없었다. 기본 Python 경로의 별칭 문제와 npm DNS 장애에 관한 이전 기록은 현재 로컬 의존성 확보 결과와 구분해야 한다.

## 남은 범위와 재현성 제한

- 최초 저장 프로젝트·npm 인덱스 검색에서는 Three/VexFlow를 찾지 못했다. 이후 범위를 넓힌 정상 pnpm 캐시 검색에서 VexFlow 5.0.0 실제 바이트를 찾고 검증·복사를 완료했다. Three는 검사한 범위에서 실제 패키지를 찾지 못했으며 전체 컴퓨터에 없다고 단정하지 않는다. 자세한 추가 범위는 `DEPENDENCY_DIAGNOSIS.md`에 기록한다.
- `package-lock.json`은 원본 프로젝트의 `package-lock.json`과 `node_modules/.package-lock.json`에서 정확히 일치한 176개 항목에 실제 pnpm 캐시의 VexFlow 5.0.0 metadata 한 항목을 더한 177개 패키지의 잠정 기록이다. 기존 176개는 이름·버전·manifest SHA-256이 원본과 일치했고, VexFlow는 293개 파일의 SHA-512를 검증했다. 원본·캐시의 실제 `resolved`/`integrity`를 보존했으며 integrity를 생성하거나 추정하지 않았다.
- `npm install --package-lock-only --offline --ignore-scripts --no-audit --no-fund`는 잠정 lock 작성 전과 후 모두 `ENOTCACHED` (`@types/estree`)로 실패했다. npm의 오프라인 재조정 또는 `npm ci` 성공은 확인되지 않았다. 이 lock을 검증된 표준 설치 절차로 설명하면 안 된다.
- 아래 표는 현재 로컬 패키지 manifest의 버전과 SHA-256을 기록한 스냅샷이다. 모든 패키지 파일의 내용 또는 출처를 검증한 공급망 서명은 아니다.
- `node_modules`를 제거하면 현재 네트워크 장애 중에는 이 기록에 나온 로컬 원본에서 다시 확보해야 한다. 원본 폴더의 향후 존재·내용은 보장하지 않는다.
- 입력 설계 문서의 원본 바이트 로컬 전송 실패는 별도의 남은 장애다. 원격에서 읽은 요구사항에 따른 독립 구현과 구분한다.

`node scripts/verify-local-dependencies.ts`는 직접 선언한 13개 버전, 아래 21개 manifest 해시, 존재할 경우 잠정 lock 177개 항목의 실제 설치 버전과 원본/캐시 metadata를 확인한다. npm 설치 재현성 검증은 포함하지 않는다.

VexFlow의 runtime `dependencies`와 `engines`는 비어 있고 pnpm index의 `requiresBuild`는 false다. `build/esm/src/fonts/bravura.js`와 `academico.js`는 WOFF2를 `data:font/woff2;charset=utf-8;base64,...`로 포함한다. 이 폰트 모듈에서 HTTP(S) URL literal은 없었다. 실제 renderer 연결·브라우저 글리프 검수 결과는 별도 QA로 기록한다. VexFlow 추가 뒤 npm 설치/오프라인 재조정은 다시 시도하지 않았다.

## 주요 로컬 manifest 스냅샷

아래 해시는 대상 `node_modules/<패키지>/package.json`에서 직접 계산했다.

| 패키지 | 실제 버전 | package.json SHA-256 |
| --- | --- | --- |
| `react` | 19.2.5 | `ce01a280a6109d1a837e88ce99784f318785079dbffda086a870aad61adc94e1` |
| `react-dom` | 19.2.5 | `92aa96480eaab724565c5bb8a4b1dd355114506e5babd36c48c783407ff9937d` |
| `scheduler` | 0.27.0 | `393bb96b7e481bf50189a1a02c7e0e7f4d01acba5abc6fbe7d214638624462fc` |
| `typescript` | 5.9.3 | `822ef7ca6452205657b6288b066481ecf508bfbf43455d715cf7d3ec457561e6` |
| `vite` | 5.4.21 | `e9802045cdc313b6da55ec2e2dd79312074645816089d64f6021f567c10c0a03` |
| `esbuild` | 0.21.5 | `0f35e0d63bd60a43ed85879604a40f7e9688b321904cf28a95be5b1bc629559c` |
| `rollup` | 4.60.2 | `6f080b212d0087b89d332492897fc4768bf75a51d727f4d4d5037f1d2af5ee35` |
| `@types/react` | 19.2.14 | `e8beff67b2575112eff5757dc8e9310a78fc6e7d2d44d9d7a8204026f4ab81b7` |
| `@types/react-dom` | 19.2.3 | `bf90986beaec5f757c164bf1d374f3038dc41b0b06673de4a55fd975d1e5deca` |
| `@types/node` | 22.19.19 | `ba8f6326a685af9e7dce89a99f55e0dc3cef450046acf00a20f7cb673562f581` |
| `undici-types` | 6.21.0 | `11f873b423b96a5ad444a099685ca6b9de1379dcd83fd8d368e757ddb53658e4` |
| `eslint` | 9.39.4 | `80a7caf2adf34963e47b32a1e75157de6d6814c3ae5a9d90358ddd9364833fe7` |
| `@eslint/js` | 9.39.4 | `c68baf2c859b03e43de607b9f1e392008e678a982baed3c93ab52f89843af260` |
| `typescript-eslint` | 8.59.4 | `57913fc91eac96e6d4b41849890b69442bbdbf09cfe174f7200afcb49c82bcf6` |
| `@typescript-eslint/parser` | 8.59.4 | `e91107f32fa3a1fd9a41741a8bbc39de7b634950856070af7adfae74304ede14` |
| `@typescript-eslint/eslint-plugin` | 8.59.4 | `7a54edb1e73421532ea67f7329afcd1e84a21d5d2fa17cf83db392444de4b99d` |
| `eslint-plugin-react-hooks` | 7.1.1 | `c745f6ec0ce838f395eb5da17e3f907094fcd14c87c30b94810f217fe5e7b476` |
| `@playwright/test` | 1.60.0 | `cf92117ef1d8cbf1e4b2dffb63a0da552c0173bd6052f0f45711c0f00b79dc99` |
| `playwright` | 1.60.0 | `8be9edc5642a8c761b677e7af8b9937f36c0443a91e14765877716d70034e5bf` |
| `playwright-core` | 1.60.0 | `6f7b58cc55449321279f11ca97d4e451c391738b77db32cdbcedf02851e3f097` |
| `vexflow` | 5.0.0 | `ef9ffb83088fef329617e29281ac2df365778c9478b5df7259c2e364d072db3f` |
