# 의존성 추가 진단

> 역사 기록: 이 문서는 승인 전 정상 로컬 캐시 진단 범위를 보존한다. 이후 사용자 승인으로 공식 npm 설치와 별도 npm ci가 성공했으며 Three도 확보됐다. 현재 lock/설치 상태는 [DEPENDENCY_INSTALL.md](DEPENDENCY_INSTALL.md)를 따른다. 아래 Three 미발견·설치 미검증은 이 캐시 진단 당시의 범위를 뜻한다.

진단일: 2026-10-26 (UTC)

## 결론과 범위

정상적인 로컬 pnpm store에서 **VexFlow 5.0.0의 완전한 293개 패키지 파일을 발견했고**, 모든 파일의 SHA-512를 원본 index와 대조한 뒤 이 프로젝트의 `node_modules/vexflow`로 복사하고 복사본도 다시 검증했다. 총 21,275,468바이트이며 누락·해시 불일치·위험 경로는 없었다. 이전 최상위 의존성 검색의 “미발견”은 이 추가 범위에서 해결되었다.

Three.js는 아래 검사 범위에서 실제 패키지/번들을 찾지 못했다. 전체 컴퓨터·모든 사용자·모든 가능한 캐시에 없다고 단정하지 않는다. 원본 프로젝트, pnpm/npm/Yarn 캐시를 수정하지 않았다. 네트워크, 설치 명령, DNS/CIM 재조회, 소켓, 권한 확대, 인증/설정/세션 파일 조회는 하지 않았다.

## 정상 캐시 경로 점검

| 경로 | 실제 결과 |
| --- | --- |
| `C:\Users\kimyo\AppData\Local\pnpm\store` | 없음 |
| `C:\Users\kimyo\AppData\Local\pnpm-cache` | 있음. `v11/metadata` 533개, `v11/metadata-full` 149개 파일 이름 점검 |
| `C:\Users\kimyo\AppData\Local\pnpm` | 있음. 조회 시 하위 디렉터리 없음 |
| `C:\Users\kimyo\.pnpm-store` | 없음 |
| `C:\Users\kimyo\AppData\Local\pnpm-store` | 없음 |
| `C:\Users\kimyo\.local\share\pnpm\store` | 없음 |
| `D:\.pnpm-store` | 있음. 실제 `v11/index.db`와 content-addressed `v11/files` 발견 |
| `C:\Users\kimyo\AppData\Local\Yarn\Cache` | 없음 |
| `C:\Users\kimyo\AppData\Local\Yarn\Berry\cache` | 없음 |
| `C:\Users\kimyo\.yarn\berry\cache` | 없음 |
| `C:\Users\kimyo\.cache\yarn` | 없음 |

pnpm metadata에서 `vexflow.jsonl` 한 개를 찾았다. 190,794바이트, SHA-256 `8fd5c9224198fdb71de1069ddacdcc5fbd6d8c48eac11221e4a4607e1a666a1c`이며 125개 version metadata를 포함한다. 이것만으로 실행 패키지가 존재한다고 판단하지 않았다. 이름 검색으로 Three metadata는 찾지 못했다.

새 metadata의 VexFlow 4.2.5와 5.0.0의 실제 `dist.integrity`를 사용하여 표준 `cacache.get.byDigest`로 실제 사용자 npm `_cacache`를 각각 한 번 확인했다. 둘 다 `ENOENT`였다. 인덱스 이름 미발견을 content 부재의 증거로 대체하지 않았고 raw content 전체를 순회하지 않았다.

## pnpm 실제 파일 검증과 복사

`D:\.pnpm-store\v11\index.db`는 SQLite 형식이다. `mode=ro&immutable=1` 연결로 package_index metadata만 읽었다. 577개 항목 중 `vexflow@5.0.0` 한 항목이 있었고 Three/opensheetmusicdisplay 이름에는 일치 항목이 없었다.

대상 index key는 캐시 metadata의 다음 실제 tarball integrity와 `vexflow@5.0.0`의 조합이다.

```text
sha512-rjB7TV4ygKE5Fl3W5OlG+0dHv22CFufUJdMG6oNgvcn0zp34u+sOboZsadQXnF1O3tZ3myXThaUIaLkJlpNM2Q==
```

선택한 53,774바이트의 index record는 MessagePack record 구조였고 전체 바이트를 소비하여 manifest/파일 목록을 해석했다. 원본 compressed tarball은 확보하지 않았으므로 tarball 자체의 SHA-512를 다시 계산했다고 주장하지 않는다. 대신 정상 store index의 **각 파일**을 해당 digest로 찾아 크기와 SHA-512를 검증했다.

| 확인 항목 | 결과 |
| --- | --- |
| index record SHA-256 | `e4d8e361c87a73505a110c3b338238dbc90ca686e65f8ada9979d0ac8362b19d` |
| 정렬된 파일-index manifest SHA-256 | `5ef5871b656cac7b9be35c219e17de9f219f730332083f0ce7cae121f2c7fbcf` |
| index 파일 수 / 검증 수 | 293 / 293 |
| 합계 바이트 | 21,275,468 |
| 누락 / 해시 불일치 / 위험 경로 | 0 / 0 / 0 |
| 복사 위치 | `C:\Users\kimyo\Documents\Codex\2026-10-27\task\music-theory-lab\node_modules\vexflow` |
| 실제 package.json 이름·버전·license | `vexflow` / `5.0.0` / `MIT` |
| runtime dependencies / engines | 둘 다 빈 객체 |
| pnpm requiresBuild | false |
| 실제 package.json SHA-256 | `ef9ffb83088fef329617e29281ac2df365778c9478b5df7259c2e364d072db3f` |
| LICENSE SHA-256 | `5522a52057a68b081dd3e06a878584b565c6a3f7e7ddb154dd24f25b5630216f` |

파일-index manifest 해시는 이름순으로 `경로 + NUL + SHA512-hex + NUL + 크기`를 만들고 LF로 연결한 UTF-8 바이트의 SHA-256이다. 복사 전 모든 경로가 상대 경로인지, `..`·역슬래시·드라이브 문자가 없는지 확인했다. 복사 대상의 해석된 절대 경로가 새 패키지 폴더 안에 있는지 확인했다. 기존의 비어 있지 않은 대상은 덮어쓰지 않도록 했으며 각 복사본의 SHA-512를 다시 대조했다.

패키지의 main은 `build/cjs/vexflow.js`, ESM은 `build/esm/entry/vexflow.js`, types는 `build/types/entry/vexflow.d.ts`다. exports는 `.`, `./core`, `./bravura`를 제공한다. LICENSE와 내장 폰트·타입을 포함한 전체 index 파일을 보존했다.

Bravura/Academico 등 6개 폰트 JS 모듈과 대응 타입이 있다. 직접 확인한 Bravura와 Academico 모듈은 WOFF2 data URL의 base64 바이트를 포함하며 HTTP(S) URL literal은 없었다. 폰트 로딩 API를 외부 URL로 호출하지 않는 실제 renderer 연결과 브라우저 검수는 담당 구현자의 별도 작업이다. 패키지 확보만으로 기보 정확성을 수용 완료했다고 선언하지 않는다.

폰트 고유 사용권 고지는 별도 범위다. 이 담당자의 제한된 후속 점검에서 store index의 `@vexflow-fonts/bravura`/`academico` 패키지 일치는 0개였고, pnpm metadata 두 트리의 해당 scope 경로 및 인코딩된 파일명 검색도 일치가 없었다. 실제 사용자 npm 캐시의 font 관련 key도 0개였다. 따라서 VexFlow의 MIT 메타데이터만으로 내장 폰트의 사용권까지 확인되었다고 주장하지 않는다. 내장 WOFF2의 저작권·license metadata 추출과 공식 font 고지 확인은 다른 담당자에게 인계했으며, 이 담당자의 캐시 점검은 여기서 중단했다.

## 하위 의존성 검색

아래 저장된 개발 루트 73개에서 각 `node_modules`의 package.json을 확인하고 package별 하위 `node_modules`, scope 폴더와 `.pnpm` 연결 구조만 따라갔다. 일반 원본 자료·설정·세션을 재귀 검색하지 않았다.

- 1,161개 node_modules 위치, 9,512개 package manifest를 읽었다.
- 대상 이름: `three`, `vexflow`, `opensheetmusicdisplay`, `@types/three`.
- 해당 검색 결과 0개, 오류 0개.
- 같은 73개 루트의 `.yarn/cache`는 모두 없었다.

다음 4개의 새 하위 개발 루트를 별도로 확인했다. 49개 node_modules 위치, 902개 manifest에서 대상 패키지는 0개이고 오류는 없었다.

공통 상대 경로의 기준: `D:\256G 1\01 레슨디자이너-반응형 웹사이트\`

```text
A-Score\A-Score
A-Score\web
악보 디자이너\mxl-studio09\mxl-studio09
뮤즈스코어 카피 웹앱\scoreforge
```

저장된 73개 고유 루트의 정확한 범위는 다음과 같다. `C:\`로 시작하는 항목 외에는 위 공통 기준에 덧붙인 경로다.

```text
신디사이저
바이브 코딩(게임)\슈퍼마리오 응용 게임(Codex)
바이브 코딩(게임)\슈퍼마리오 응용 게임(Codex)[음악이론]
클래식 악기 교육 전자도서관
국악기 교육 전자도서관
바이브 코딩(게임)\칼림바 게임 웹앱
바이브 코딩(게임)\텅드럼 게임 개발(두더지)
신디사이저 배우기 웹앱
음악이론_바다_항해_게임
메트로놈 웹앱
틴휘슬 운지법 배우기 애니메이션 웹앱
트럼펫 운지법 배우기 애니메션 웹앱
클라리넷 운지법 배우기 애니메이션 웹앱
플룻 운지법 배우기 애니메이션 웹앱
오카리나 운지법 배우기 애니메션 웹앱
클라리미니 운지법 배우기 애니메이션 웹앱
음악이론 모바일 게임 웹앱\리듬 천국 미라클 스타즈 응용 게임\04_분할_로켓
색소폰 운지법 배우기 애니메이션 웹앱
리코더 운지법 배우기 애니메션 웹앱
음악이론 모바일 게임 웹앱\리듬 천국 미라클 스타즈 응용 게임\03_쉼표_숲
음악이론 모바일 게임 웹앱\리듬 천국 미라클 스타즈 응용 게임\02_마디_레시피_공방
음악이론 모바일 게임 웹앱\음악기호 어드벤처 게임
음악이론 모바일 게임 웹앱\리듬 천국 미라클 스타즈 응용 게임\01_박자_고리_점프
Guitarpro 8 카피 웹앱
음악속도체인저 카피 모바일 웹앱
음악이론 모바일 게임 웹앱\12음계 모바일 게임 웹앱
Tuning_모바일_웹앱
텅드럼 VSTi 카피 웹앱
한국생활음악강사협회 홈페이지(모바일앱)
한국타악예술원
A-Score
색소폰 운지 교정 웹앱
클라리미니 운지 교정 웹앱
우쿨렐레 코드 운지 교정 웹앱
플룻 운지 교정 웹앱
기타 코드 운지 교정 웹앱
바이브 코딩(게임)\음악의 마블(보드게임)[Codex]
바이브 코딩(게임)\음악의 마블(보드게임)[Claude]
바이브 코딩(게임)\젬베 리듬 게임(master)[Chat GPT]
바이브 코딩(게임)\카혼 리듬 게임(master)[Chat GPT]
Lesson Designer
기타&우쿨렐레 스트럼 웹앱
첼로 배우기 웹앱
바이올린 배우기 웹앱
클라리미니 연주 웹앱
드럼세트 연주 웹앱
오카리나 배우기 웹앱
리코더 배우기 웹앱
팬플룻 연주 웹앱
색소폰 연주 웹앱
뮤즈스코어 카피 웹앱
미니하프 연주 웹앱
칼림바 연주 뷰어 웹앱
한국생활음악강사협회 홈페이지(웹사이트)
기타 코드 뷰어 웹사이트
우쿨렐레 코드 뷰어 웹사이트
바이브 코딩(게임)\음악 리노 히어로_슈퍼 배틀 변형게임
바이브 코딩(게임)\음악 리듬 캠프파이어 보드게임
바이브 코딩(게임)\02
바이브 코딩(게임)\음정이론 보드게임(음정 정거장)[Claude-Desktop]
바이브 코딩(게임)\음악 스케일 스텝(Claude-Desktop)
바이브 코딩(게임)\음악 반디도&반디다 음용게임(보드게임)[Codex]
바이브 코딩(게임)\음악 우노&젝스님트
악보 디자이너\mxl-studio09
Garageband
악보 디자이너\교육용 악보작업 웹앱17(변형)
보컬 레코딩
신디사이저(사운드폰트)
멀티 이펙터
기타 이펙터
반주 디자이너02
악보 디자이너\교육용 악보작업 웹앱17
C:\Users\kimyo\Documents\Codex\2026-07-08\new-chat
```

## 로컬 vendor 및 project Yarn 범위

별도 담당자가 다음 9개 승인된 음악 개발 루트에서 `vendor`, `vendors`, `public`, `lib`, `libs`, `.yarn/cache`를 점검했다.

```text
A-Score
Guitarpro 8 카피 웹앱
악보 디자이너\교육용 악보작업 웹앱17
악보 디자이너\교육용 악보작업 웹앱17(변형)
악보 디자이너\mxl-studio09
뮤즈스코어 카피 웹앱
음악이론_바다_항해_게임
신디사이저
Lesson Designer
```

추가로 위 새 하위 루트 4개에서는 그 여섯 경로와 `assets/vendor`, `assets/libs`, `src/vendor`, `src/lib`, `src/libs`를 확인했다. 합계 98개 정확한 디렉터리 후보 중 9개가 존재했고, 그 안의 124개 파일/폴더 이름에서 `three`, `vexflow`, `vex.min`, `opensheetmusicdisplay` 일치 번들이 없었다. node_modules·.git·symlink는 이 vendor 검색에서 제외했다. 오류·거부·검색 한도 도달은 없었다.

존재한 범위는 project17 및 변형의 public/lib, 신디사이저 public, Lesson Designer public, A-Score/web의 public/lib, scoreforge/vendor다. 13개 프로젝트의 Yarn 후보는 모두 없었다. 이 vendor 검색은 위 73개 Yarn 점검과 일부 겹치므로 별도의 새로운 파일 수로 합산하지 않는다.

## 재현성 상태와 미해결

루트 담당자가 package.json에 `vexflow: '5.0.0'`를 추가한 뒤, 이 담당자는 잠정 package-lock의 root 의존성 및 VexFlow 항목을 실제 cached `dist.tarball`·`dist.integrity`·설치 manifest license로 갱신했다. 레지스트리 주소를 접속하거나 integrity를 추정하지 않았다. verifier의 스냅샷은 21개이며 선언은 13개, 원본/캐시 lock 항목은 177개다.

기존 npm 오프라인 재조정의 `ENOTCACHED @types/estree`와 `npm ci` 미검증 한계는 유지된다. 이번 추가 뒤 설치·오프라인 재조정·네트워크 재시도는 하지 않았다. Three는 현재 검사 범위의 미발견으로 남으며 CSS 입체 표현을 Three/WebGL 구현으로 바꾸어 설명하지 않는다. 원본 입력 MD 로컬 아카이브 전송 실패는 이 캐시 진단과 독립된 항목이다.

