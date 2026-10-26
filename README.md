# 음가 블록 실험실

첫 리듬 단원 여섯 장면을 React/TypeScript로 구현했습니다. 정확한 분수 모델에서 VexFlow 5의 SVG 악보, 실제 Three.js 0.186.1 입체 블록, Web Audio 재생과 평가를 함께 만듭니다. 가로 모바일 화면을 우선하며 세로·키보드·소리 없는 2D 경로도 제공합니다.

## 실행

Node.js 24.14 이상에서 다음 순서로 실행합니다.

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run preview
```

로컬 주소는 http://127.0.0.1:4174/ 입니다. 개발 서버는 `npm run dev`로 실행합니다. 같은 컴퓨터의 독립 프로젝트 경로는 `C:\Users\kimyo\Documents\Codex\2026-10-27\task\music-theory-lab`입니다.

`node scripts/build-standalone.ts`는 네트워크가 필요 없는 `output/preview.html`도 생성합니다. 파일 URL과 HTTP URL의 브라우저 저장소는 서로 구분됩니다.

## 구현과 확인

- 분할·인접 병합·undo/redo, 동등한 길이 조합, 쉼표, 템포 비교, 조건을 만족하는 한 마디 만들기.
- 실제 SVG 기보와 내장 Bravura/Academico, C4 덧줄·온~16분 음표/쉼표·빔·철자·선택 강조.
- 실제 Three/WebGL2, 시간에 비례한 폭과 고정 높이/깊이, 빈 쉼표 윤곽, raycast 선택, 요구 시 렌더, 자원 정리·2D 복귀.
- 명시적 소리 시작, audio clock 예약·반복·정지, 교사 보기·인쇄·사전/사후 5문항씩·지원 수준 1~3.
- 로컬 저장과 JSON 파일 내보내기/가져오기. 손상 원문 보호, 가져오기 확인, 새 학습자 기록·백업·문항 초기화.

검증 명령은 `npm run typecheck`, `npm run lint`, `npm test`, `npm run content:validate`, `npm run build`입니다. 깨끗한 설치에서 모두 통과했고 96개 단위/통합 테스트를 확인했습니다. 원본과 재현 폴더의 소스 64개 및 빌드 HTML 해시가 일치합니다.

최종 HTTP 빌드에서 주요 흐름 19개 통과·배경 탭 1개 미검증, Three 9개, 저장 회귀 7개를 확인했습니다. 별도 파일 UI 23개, 기보/글꼴 복구 24개도 통과했습니다. 실제 페이지 이탈 시 소리 정지는 확인했고, headless 탭 전환의 `document.hidden`은 만들지 못했습니다.

[단계별 상태](docs/BUILD_STATUS.md) · [검증 결과](docs/QA_SUMMARY.md) · [제한](docs/KNOWN_LIMITATIONS.md) · [활동지 PDF](docs/qa/activity-sheet-six-scenes.pdf) · [입체 화면 검수](docs/qa/Three_REVIEW.md) · [폰트·라이선스](public/licenses/README.md)

## 검수 경계

실제 휴대전화·Safari/iOS·스피커/헤드폰 청취·보조기술·수업 파일럿 검수는 수행하지 않았습니다. 자동 브라우저 검사를 이 항목의 통과나 교육 효과 인증으로 해석하지 않습니다. 입력 문서 두 개의 전체 본문은 원격으로 읽었으나, 지원되는 원형 파일 로컬 전송은 실패했습니다. 원본 음악 자료는 사용하거나 수정하지 않았습니다.

전체 trace·PNG·SVG·다운로드와 이전 후보는 로컬 `output/`에 보존합니다. 이 폴더와 의존성·비밀 설정은 Git에서 제외합니다. GitHub/Vercel 릴리스 결과는 인수인계 문서에 별도로 기록합니다.
