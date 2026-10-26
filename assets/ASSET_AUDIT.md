# 자산 점검 기록

기록일: 2026-10-26 (UTC)

## 실제 사용 자산

| 구분 | 출처와 사용 범위 |
| --- | --- |
| 화면·시간 블록 | 이 독립 프로젝트에서 작성한 React/CSS와 데이터 기반 2D·CSS 입체 도형. 외부 이미지나 원본 영상 프레임을 추출하지 않음 |
| 학습 음원 | Web Audio oscillator/gain으로 생성하는 `prototype-synth`. 원본 음악 파일·샘플·SoundFont·내레이션·배경음악을 사용하지 않음 |
| 콘텐츠 | 두 설계 문서 전체의 원격 읽기를 바탕으로 별도로 작성한 첫 단원 데이터와 교사 안내. 원본 문서 로컬 아카이브 확보는 실패 상태 |
| MusicXML fixture | `scripts/musescore-fixtures.mjs`에서 독립 작성한 기본 음표/쉼표 및 혼합 예제 11개. 결과 위치 `output/notation`; 원본 악보 파일을 수정하거나 변환한 것이 아님 |
| 런타임 라이브러리 | 기존 로컬 설치 패키지의 필요한 코드와 포함 라이선스 파일을 새 `node_modules`에 복사. 버전·출처·manifest 해시는 `docs/LOCAL_DEPENDENCIES.md` 참조 |
| 실제 기보 라이브러리 | pnpm store에서 전체 293개 파일을 SHA-512 검증해 복사한 VexFlow 5.0.0. 실제 SVG 악보에 사용하며 프로그램 MIT·저자 고지를 `public/licenses`에 보존 |
| 실제 내장 글꼴 | VexFlow의 data-URL WOFF2 Bravura Regular, Academico Regular/Bold. 외부 폰트 파일을 다운로드하지 않았으며 실제 name table에서 읽은 저작권·OFL 1.1 전체 고지를 `public/licenses`에 보존 |

콘텐츠의 `narrationAssetId`와 `backgroundMusicAssetId`는 `null`, `instrument`는 `prototype-synth`다. 합성음을 실제 악기 녹음이나 고품질 악기 음색으로 설명하지 않는다.

## 원본 Drive 자료의 확인 범위

부모 실행 담당자가 원본 Drive 폴더의 제한된 메타데이터를 읽었고 해당 응답에서 SNS 문서 한 개가 반환되었다. 이는 폴더에 그 파일만 존재한다는 증거가 아니다. 전체 목록 완전성, MP4/ZIP의 실제 바이트·내용, 음악/영상/폰트 사용권은 확인하지 않았다.

원본 MP4·ZIP·음악·악보 자료를 앱에서 사용하지 않았고 다운로드·수정·재인코딩·추출·이름 변경·이동하지 않았다. 권리 검사가 완료되지 않은 자산을 배포 가능 자산 목록에 넣지 않았다. 향후 실제 원본 자산을 사용하려면 정확한 파일·버전·권리 범위·출처와 필요한 사용자 허용을 별도로 확인해야 한다.

## 프로그램과 내장 글꼴 고지

VexFlow 프로그램의 MIT를 폰트 라이선스로 대체하지 않았다. 내장 Bravura 1.392와 Academico Regular/Bold 0.902의 nameID13에는 실제 저작권·Reserved Font Name·OFL 1.1 전체 조항이 포함되어 있었고 그대로 보존했다. Academico Bold의 nameID0에는 다른 연도가 있어 별도 고지도 함께 보존했다. 실제 바이트 해시·기록·고지 파일은 `public/licenses/font-metadata.json` 및 `public/licenses/README.md`를 따른다. 이 기록은 현재 외부 저장소의 글꼴과 바이트가 같다는 주장이 아니다.

## 미완료 및 검증 구분

- 정확한 2D 악보와 음악 폰트는 로컬에서 확보·연결했다. 실제 VexFlow SVG fixture 23개 확인과 폰트 일시 실패 후 재시도 1개 확인이 통과했다. 이 범위와 음악교사의 기보 승인·실제 종이 인쇄를 구분한다.
- MusicXML fixture 11개의 의미 검사는 수행했으나 독립 외부 기준 생성용 MuseScore 실행은 `0xC0000409`로 실패하여 중단했다. 해당 MusicXML의 MuseScore SVG 렌더·외부 기준 이미지 비교·교사 검수는 완료하지 않았다. 앱과 VexFlow fixture의 SVG가 생성된 사실과 혼동하지 않는다.
- 브라우저 화면 캡처·인쇄 PDF·trace는 로컬 QA 산출물이다. 원본 사용자의 자료이거나 외부에 공개 배포된 자산이라는 뜻이 아니다.
- 로그인·결제·유료 서비스·공개 배포를 수행하지 않았다. 새 사용자 허용은 모든 작업 완료 뒤 지정 GitHub 저장소 push/Vercel 배포이며, 현재 Three/HTTP/기관·교사 QA 완료 조건 때문에 보류 중이다. 서명된 Library 전송 주소·토큰은 자산 목록에 포함하지 않는다.
