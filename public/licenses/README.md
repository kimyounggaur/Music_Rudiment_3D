# VexFlow와 내장 글꼴 고지

앱 런타임의 [Three.js MIT](Three-MIT.txt), [React MIT](React-MIT.txt), [ReactDOM MIT](ReactDOM-MIT.txt) 원문도 함께 보존한다. 아래 글꼴 조사는 이들 프로그램의 라이선스와 별도로 수행했다.

확인일: 2026-10-26 UTC. 대상은 로컬에서 무결성이 검증된 VexFlow5.0.0의 `vexflow/bravura` 경로에 포함된 WOFF2 글꼴이다. 외부 글꼴 파일을 내려받거나 글꼴 바이트를 수정하지 않았다.

VexFlow 프로그램의 [MIT 고지](VexFlow-MIT.txt)와 [저자 목록](VexFlow-AUTHORS.md)을 원본 그대로 보존했다. **MIT라는 패키지 표기만으로 내장 글꼴도 MIT라고 판단하지 않았다.**

| 실제 내장 글꼴 | 이름 테이블의 버전 | 내장 저작권 고지 | 글꼴 라이선스·보존 파일 |
| --- | --- | --- | --- |
| Bravura Regular | 1.392 | Steinberg Media Technologies GmbH ©2021, Reserved Font Name `Bravura` | SIL OFL1.1, [Bravura-OFL.txt](Bravura-OFL.txt) |
| Academico Regular | 0.902 | Steinberg Media Technologies GmbH ©2022, Reserved Font Name `Academico` | SIL OFL1.1, [Academico-OFL.txt](Academico-OFL.txt) |
| Academico Bold | 0.902 | nameID13은 ©2022, nameID0은 ©2020. 같은 Reserved Font Name `Academico` | SIL OFL1.1, [Academico-Bold-OFL.txt](Academico-Bold-OFL.txt) 및 [서로 다른 nameID0 고지](Academico-Bold-nameID0-notice.txt) 둘 다 보존 |

세 글꼴 모두 nameID13에 저작권·Reserved Font Name·OFL1.1의 전체 조항이 실제로 포함돼 있었다. standalone 고지는 Unicode platform3 레코드에서 그대로 읽은 텍스트에 마지막 줄바꿈만 추가했다. Academico Bold의 서로 다른 연도를 임의 교정하거나 최신 연도로 바꾸지 않았다. Bravura의 다른 플랫폼 문자열 표현도 삭제하지 않고 메타데이터에 별도로 남겼다.

[font-metadata.json](font-metadata.json)은 source JS와 WOFF2 바이트 SHA256, 크기, 디렉터리, 이름 테이블 레코드와 고지 파일 해시를 기록한다. 재현 명령은 프로젝트 루트의 `node scripts/font-license-audit.ts`이다. 스크립트는 정적 data URL→WOFF2 directory→Node Brotli 해제→name table 읽기만 수행하며 글꼴 JS를 실행하거나 glyph를 재작성하지 않는다. 전체 글꼴 렌더링·형태 정확성은 이 라이선스 조사와 별개의 검수다.

## 고지 유지 범위

글꼴을 앱에 번들·임베드하거나 함께 배포할 때 실제 저작권 고지와 OFL 전체 문서를 함께 유지한다. 글꼴 자체를 단독 판매하지 않으며, 변경본은 Reserved Font Name과 OFL 조건을 따른다. 원저작자의 후원·보증으로 표시하지 않는다. 이 조건을 VexFlow MIT로 치환하지 않는다. 이는 보존한 OFL 본문의 요약이며 실제 조항은 위 원문을 따른다. [OFL 공식 원문](https://openfontlicense.org/open-font-license-official-text/)

공식 Bravura 저장소의 현재 master 고지는2026년이지만 이번 패키지의 실제 내장본은2021년 고지를 갖는다. 현재 master를 내장본의 버전·저작권 증거로 대체하지 않았다. [Bravura 공식 고지](https://github.com/steinbergmedia/bravura/blob/master/LICENSE.txt)

Academico의 OFL 적용은 Steinberg 공식 포럼 안내와도 일치한다. 공식 공개 소스 저장소의 존재나 이번 WOFF2와 특정 외부 파일의 바이트 동일성을 확인했다고 주장하지 않는다. [Steinberg Academico 안내](https://forums.steinberg.net/t/academico-open-font-license/114847)

외부 출처 조사 중 `web.click`으로 요청한 `https://github.com/vexflow/vexflow-fonts/tree/main/academico`와 `https://github.com/vexflow/vexflow-fonts/tree/main/bravura`는 각각 `Failed to fetch restricted URL`로 읽기 실패했다. 두 경로는 재시도하거나 다른 경로로 우회하지 않았다. 위 고지는 그 외부 경로에서 받은 내용이 아니라 이미 로컬에 검증돼 있던 패키지의 실제 WOFF2 이름 테이블에서 추출한 전체 원문이다. 따라서 이 조사로 외부 글꼴 저장소 내용까지 확인했다고 보고하지 않는다.

이 기록은 글꼴 고지 조사와 보존 범위다. 앱의 실제 배포·검증 상태는 프로젝트 README와 배포 기록에서 별도로 확인한다. 라이선스 조사를 음악교사 승인이나 교육 효과 검증으로 표시하지 않는다.

## 인쇄 쪽 글꼴 (v3 R3)

3D 책 쪽에 인쇄되는 한국어 글꼴은 [book-page-fonts.txt](book-page-fonts.txt)에 고지와 OFL 1.1 전문을 둔다. 앱에 들어가는 파일은 원 글꼴의 글자 부분집합(WOFF2)이라 OFL의 수정본(Modified Version)이며, 조건 3(Reserved Font Name)에 따라 이름을 바꿨다.

| 앱 안 이름 | 원 글꼴 | 파일 |
| --- | --- | --- |
| Book Sans 400·600 | Pretendard 1.3.9 Regular·SemiBold (RFN `Pretendard`) | `fonts/book-sans-regular.subset.woff2`, `fonts/book-sans-semibold.subset.woff2` |
| Book Serif 700 | Noto Serif CJK KR Bold (RFN `Source`) | `fonts/book-serif-bold.subset.woff2` |

원 저작권·상표·라이선스 이름 레코드는 각 파일 안에 그대로 남겼다. 재현 명령은 `node scripts/extract-page-fonts.mjs`(pyftsubset + `scripts/rename-subset-font.py`)이고, `tests/page-fonts.test.ts`가 예약 이름이 남지 않았는지와 크기·해시를 매번 검사한다.
