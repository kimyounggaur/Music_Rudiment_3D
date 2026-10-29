# 음악이론 교과서 · 소리의 길이를 펼치다

현재 책 UI는 **여섯 학습 펼침면**을 지원합니다. 실제 제공된 표지에서 책을 열고, 길이 비교·음표 분할·음가 조합·쉼표·템포 비교·한 마디 창작을 책 안에서 수행합니다. 정확한 분수 모델·VexFlow SVG·Three.js 곡면 페이지와 입체 블록·Web Audio가 같은 학습 데이터를 사용합니다.

첫 두 펼침면의 1차 배포 커밋 `4f3111a`를 보존한 후 나머지 네 펼침면을 이식했습니다. 음악 도메인과 저장 형식은 유지하고, 인쇄면은 현재 펼침면과 이웃만 준비해 최대 6개로 제한합니다. [1차 배포 범위와 검증 상태](docs/qa/FIRST_RELEASE_SCOPE.md)는 당시의 이력이며, [V13 검증 기록](docs/qa/V13_LOCAL_VERIFICATION.json)이 이후 네 펼침면과 준비 루프 수정의 확인 범위를 구분합니다.

**실행: [음가 블록 실험실](https://music-rudiment-3d.vercel.app/)** · [배포와 Git 연동 기록](docs/RELEASE.md)

## 실행

Node.js 24.14 이상인 24.x에서 다음 순서로 실행합니다.

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run preview
```

기본 개발 서버는 `npm run dev`로 실행합니다. 이 작업의 명시적 QA 주소는 `npm run dev -- --host 127.0.0.1 --port 4183 --strictPort`의 http://127.0.0.1:4183/ 입니다. 미리보기 서버의 실제 주소는 명령 출력에서 확인하세요.

기존 `build-standalone.ts`와 구형 `test:e2e`는 이전 실험실 UI용입니다. 현재 책 UI의 배포·검증 대신 사용하지 않습니다. 파일 URL과 HTTP URL의 저장소도 서로 구분됩니다.

## 구현과 확인

- 첫 펼침면: 온음표 하나와 4분음표 네 개의 길이·소리 시작 횟수 비교.
- 둘째 펼침면: 온~16분음표 분할·인접 병합·undo/redo, 음표 선택과 정지 후 편집.
- 셋째 펼침면: 서로 다른 세 과제에서 합 1/2과 음가 종류 조건 판정.
- 넷째 펼침면: 같은 길이 음표↔쉼표 전환, 무음 구간의 시간·시작점 유지.
- 다섯째 펼침면: 정지 상태의 60/120 비교, 한 마디 4초/2초와 음가 비율 4:1 유지.
- 여섯째 펼침면: 음표·쉼표로 한 마디 창작, 현재 세 조건·명시적 설명 자기 확인, 성공 해제와 undo 복원. 자유 설명은 자동 채점하지 않습니다.
- 실제 SVG 기보와 내장 Bravura/Academico, C4 덧줄·온~16분 음표/쉼표·빔·철자·선택 강조.
- 실제 Three/WebGL2, 시간에 비례한 폭과 고정 높이/깊이, 빈 쉼표 윤곽, raycast 선택, 요구 시 렌더, 자원 정리·2D 복귀.
- 명시적 소리 시작·일시정지·같은 지점 재개·정지, 장면 이탈/복구 시 안전 정지.
- 로컬 저장과 JSON 파일 내보내기/가져오기. 손상 원문 보호, 가져오기 확인, 새 학습자 기록·백업·문항 초기화.

검증 명령은 `npm run typecheck`, `npm run lint`, `npm test`, `npm run content:validate`, `npm run build`입니다. 2026-10-28 16:07 UTC 원본 통합 소스는 **272개 테스트·타입검사·lint·build를 통과**했습니다. 종이 안쪽 모서리 입력과 44px 책갈피 경계를 수정했으며, 사용자는 수정본의 잡기·끌어서 넘기기를 확인했습니다. [최신 통합 검증과 한계](docs/qa/FIRST_RELEASE_INTEGRATION.md)에 실제 확인 범위와 미검증 항목을 구분합니다. 날짜별 과거 QA는 [현재 단계 기록](docs/BUILD_STATUS_V2.md)에 보존합니다.

이후 V13 복사본은 **288개 테스트·타입검사·lint·build를 통과**했습니다. 빈 창작 악보의 준비 문구가 스크롤바를 토글해 폭을 바꾸던 반복 취소를 고정 스크롤바 공간으로 수정했습니다. 첫 두 펼침면의 기존 테스트 기대값은 삭제하거나 약화하지 않았습니다. G1-A/B, V09 오디오 기술 계약과 V10 저장 기술 계약의 Windows IAB 확인 범위 및 미검증 항목을 유지하며, 이전 실험실의 96개 테스트나 구형 화면 QA를 새 책의 통과 증거로 승계하지 않습니다.

[현재 단계별 상태](docs/BUILD_STATUS_V2.md) · [G1](docs/qa/BOOK_EXPERIENCE_GATE.md) · [오디오](docs/qa/V09_TRANSPORT.md) · [저장](docs/qa/V10_PROGRESS.md) · [폰트·라이선스](public/licenses/README.md)

이전 여섯 장면 실험실의 [QA 기록](docs/QA_SUMMARY.md)과 [활동지](docs/qa/activity-sheet-six-scenes.pdf)는 이력 자료이며, 새 책의 실화면 검증이나 실제 프린터 검수의 증거로 사용하지 않습니다.

## 검수 경계

실제 휴대전화·Safari/iOS·스피커/헤드폰 청취·보조기술·수업 파일럿 검수는 수행하지 않았습니다. 자동·에뮬레이션 검사를 이 항목의 통과나 교육 효과 인증으로 해석하지 않습니다. 최신 v2.1 문서와 실제 표지 픽셀의 출처·무결성은 [구현 계약](docs/IMPLEMENTATION_CONTRACT_V2.md)에 기록했습니다.

전체 trace·PNG·SVG·다운로드와 이전 후보는 로컬 `output/`에 보존합니다. 이 폴더와 의존성·비밀 설정은 Git에서 제외합니다. GitHub/Vercel 릴리스 결과는 인수인계 문서에 별도로 기록합니다.
