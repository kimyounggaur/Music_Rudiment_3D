# v3 리팩토링 진행 기록 (BUILD_STATUS_V3)

설계: [REFACTOR_DESIGN_V3.md](REFACTOR_DESIGN_V3.md) · 실행 계약: [IMPLEMENTATION_CONTRACT_V3.md](IMPLEMENTATION_CONTRACT_V3.md) · 개정 조항: [CONTRACT_V3.md](CONTRACT_V3.md) · 캡처 규약: [qa/refactor/README.md](qa/refactor/README.md)

"코드를 작성함", "자동 검사가 통과함", "사람이 승인함"을 구분한다. headless 캡처는 실기기 통과가 아니고, 무음 캡처는 청취 증거가 아니다.

## 단계 지도

| ID | 지도 번호 | 이름 | 상태 |
|---|---|---|---|
| R0 | V3-00 | 계약 개정 | 통과 |
| R1 | V19 | 원근 카메라 리그 | 통과 |
| R2 | V20 | 종이·조명·환경·후처리 | 통과 |
| R3 | V21 | 캔버스 페이지 인쇄 시스템 | 일부 완료 (x-height B6, 핫스폿 B5, 보조기술 외부 검수 대기) |
| R4 | V22 | 잉크 그림 시스템 + 음가 그림 | 미착수 |
| R5 | V23 | 조작부 재배치 | 미착수 |
| R6 | V24 | 레슨 카메라 연출(샷) | 미착수 |
| R7 | V25 | 효과음·마감 | 미착수 |
| R8 | V26 | 콘텐츠 확장(목차·마침·GO_TO) | 미착수 |
| R9 | V27 | 검증 관문 개편·정리 | 미착수 |

v2.1 단계 지도와의 대응: R1→V19, R2→V20, R3→V21, R4→V22, R5→V23, R6→V24, R7→V25, R8→V26, R9→V27. v2 기록은 [BUILD_STATUS_V2.md](BUILD_STATUS_V2.md)에 그대로 있다.

## 보고 양식

~~~text
단계 ID와 상태: 통과 / 실패 / 일부 완료 / 외부 검수 대기
실제로 가능한 사용자 행동:
변경 경로와 이유:
실행 명령과 종료 결과:
기기와 브라우저 및 commit:
실제 캡처 영상 로그 경로:
미실행 항목과 정확한 이유:
남은 결함과 재현 절차:
객관적 게이트와 선택적 사용자 피드백 상태:
다음 허용 단계와 막힌 단계:
전후 캡처 경로와 metrics.json 요약:
renderer 플래그 상태:
설계서 대비 편차와 사유:
G1-C 체크리스트(부록 B) 영향 항목과 현재 판정:
~~~

---

## R0 (V3-00) 계약 개정 — 통과

- **단계 ID와 상태:** R0 통과(문서 단계, 자체 승인).
- **실제로 가능한 사용자 행동:** 변화 없음. 앱 코드는 바뀌지 않았다.
- **변경 경로와 이유:** `docs/REFACTOR_DESIGN_V3.md`, `docs/REFACTOR_PROMPTS_V3.md`(설계서·프롬프트 사본), `docs/CONTRACT_V3.md`(C1–C12, 결정 기록, 착수 편차 B1–B5, 불변식 검사 위치), `docs/IMPLEMENTATION_CONTRACT_V3.md`(P00 원문), `docs/BUILD_STATUS_V3.md`(이 파일), `docs/qa/refactor/README.md`(캡처 규약). `docs/BUILD_STATUS_V2.md` 끝에 이어짐 안내 한 줄.
- **실행 명령과 종료 결과(세션 시작 baseline, 착수 커밋 `5f2f7bb`):** `npm ci --ignore-scripts` 성공(EBADENGINE 경고: Node 22.23.4). `npm run typecheck` exit 0, `npm run lint` exit 0, `npm test` 288/288 통과(실패·skip 0), `npm run build` exit 0(main 청크 1,097.50 kB, 500 kB 초과 경고 기존 그대로).
- **기기와 브라우저 및 commit:** Linux 컨테이너, Node 22.23.4, npm 10.9.9. 브랜치 `refactor/v3-ink-book`.
- **실제 캡처 영상 로그 경로:** 없음(문서 단계).
- **미실행 항목과 정확한 이유:** Node 24.14.0 로컬 실행은 컨테이너에서 바이너리를 받을 수 없어 미실행. push 후 GitHub Actions 결과로 대신 기록한다.
- **남은 결함과 재현 절차:** 없음.
- **객관적 게이트와 선택적 사용자 피드백 상태:** 결정 6항목은 사용자 위임에 따른 자체 승인. 6번(원본 녹화)은 미제공.
- **다음 허용 단계와 막힌 단계:** R1 허용.
- **전후 캡처 경로와 metrics.json 요약:** 해당 없음.
- **renderer 플래그 상태:** 아직 없음(R1에서 도입).
- **설계서 대비 편차와 사유:** CONTRACT_V3 §3 B1–B5.
- **G1-C 체크리스트 영향 항목과 현재 판정:** 13항목 모두 미판정(R9).

---

## R1 (V19) 원근 카메라 리그 — 통과

- **단계 ID와 상태:** R1 통과(자동 검사 통과, 캡처 자체 판정).
- **실제로 가능한 사용자 행동:** 기존과 같은 표지 진입·열기·직접 드래그·넘김·2D 전환이 원근 카메라로 동작한다. 책은 사다리꼴로 보이고(먼 변이 좁음), 표지는 화면 중앙에 정확히 놓인다. `?renderer=legacy`로 착수 커밋의 직교 화면을 그대로 볼 수 있다.
- **변경 경로와 이유:**
  - 신규 `src/book/render/cameraRig.ts`(포즈, 닫힌 형식 fit, `balancedAnchor`, rig 카메라), `src/book/render/bookFraming.ts`(닫힌/열린 책 fit 점집합 — stage와 테스트가 공유), `src/book/render/homography.ts`(사각형↔단위정사각형 사영 변환, CSS matrix3d), `src/book/profile.ts`(renderer·품질 티어), `src/book/entry.tsx`, `src/legacy/**`(착수 커밋 책 셸 고정 사본, B2), `scripts/refactor-capture.ts`.
  - 수정 `src/main.tsx`(renderer 선택 지연 로드), `src/book/stage.ts`(OrthographicCamera 제거, rig 적용, fit 캐시, layout.camera에 fov·distance·worldPerPixelAtAnchor), `src/book/pageProjection.ts`(affine → homography matrix3d, `quadSize`), `src/book/turnHit.ts`(원근 사다리꼴 모서리·히트), `src/book/BookApp.tsx`(인쇄 크기 = 사다리꼴의 긴 변), `src/book/navigationPlacement.ts`(바깥 변 중점).
  - 테스트: 신규 `tests/book-camera-rig.test.ts`(7개), `tests/book-page-projection.test.ts` 재작성(3개), `tests/book-turn-hit.test.ts` 사다리꼴 케이스 추가 + 접힌 사각형 케이스로 교체(아래 편차 3).
- **실행 명령과 종료 결과:** `npm run typecheck` 0, `npm run lint` 0, `npm test` 297/297, `npm run build` 0(진입 청크 분리로 index 195.81 kB; 500 kB 초과 경고 1건은 three 공유 청크).
- **기기와 브라우저 및 commit:** Linux 컨테이너, Node 22.23.4, Playwright 1.60 + headless Chromium 1243(SwiftShader WebGL), DPR 1.
- **실제 캡처 영상 로그 경로:** [qa/refactor/R1/index.md](qa/refactor/R1/index.md) — before 18장(legacy), after 18장(ink), `metrics.json`.
- **측정값(after):** 표지 중앙 오차 0 px(3 viewport). far/near 0.847(1280×720), 0.851(844×390), 0.938(390×844). 책 폭 비율 0.625 / 0.499 / 0.884. 오른쪽 쪽 화면 높이 438 / 231 / 190 px. held drag 진행도 0.32–0.36에서 넘김 실루엣이 화면 안.
- **미실행 항목과 정확한 이유:** 실기기 터치, 비대칭 safe-area의 실제 노치 기기, 200% 확대는 미실행(headless 에뮬레이션만). 비대칭 safe-area는 단위 테스트로만 확인.
- **남은 결함과 재현 절차:** (과도기) HTML 쪽 겹침이 matrix3d로 원근 변환되어 글자가 약간 기울어 보인다 → R3에서 인쇄 텍스처로 해소.
- **객관적 게이트와 선택적 사용자 피드백 상태:** CI01(표지 중앙 0 px), CI02(5 viewport + 비대칭 safe-area에서 모든 넘김 자세가 safe 안: 단위 테스트), 드래그 중 카메라 불변(`suspendFit` 유지) 통과.
- **다음 허용 단계와 막힌 단계:** R2·R3·R4 허용.
- **전후 캡처 경로와 metrics.json 요약:** 위 측정값. before의 far/near는 1(직교).
- **renderer 플래그 상태:** 기본 `ink`, `?renderer=legacy`는 `src/legacy/entry.tsx` 고정 사본(정상 동작, 캡처 18장).
- **설계서 대비 편차와 사유:**
  1. 포즈 초기값 58°/32° → **62°/30°**(C5 범위 안). 58°/32°에서 far/near 0.819–0.824로 목표 0.86–0.92와 멀어, 계약 범위에서 원근을 가장 약하게 하는 끝값을 택했다. 그래도 0.847–0.851로 목표 하한에 못 미친다. 화면을 채우는 책에서 FOV ≥ 30°이면 이 비가 기하학적으로 제한되므로 목표값 자체가 과대 추정이었다고 판단하고 R9 비교표에 기록한다.
  2. 책 폭 비율 목표 70–85%를 가로 화면에서 **미달**(0.625 / 0.499). 원인은 CI02(넘김 실루엣 잘림 금지): 넘김 잎 궤적을 fit에 넣으면 카메라 거리가 책만 넣을 때보다 1.39배(10.99 대 7.93, 1280×720) 멀어진다. 계약 우선순위(v2.1 CI02는 개정되지 않음)에 따라 CI02를 지키고 목표 미달을 기록한다. 가독성은 R3 인쇄 크기와 R6 샷에서 다룬다.
  3. 이분 탐색 28회 대신 **닫힌 형식 최소 거리**: 고정 방향에서 각 점의 화면 오차가 거리에 대해 단조 감소하므로 정확한 최소값을 바로 계산한다. 테스트가 최소성(1% 가까우면 잘림)을 확인한다.
  4. `book-turn-hit`의 "비아핀 사각형은 무효" 케이스는 C5(원근 필수)와 모순되어 **접힌(자기 교차) 사각형** 케이스로 바꿨다. 원근 사다리꼴이 유효하다는 양성 테스트를 추가했다.
  5. B2: legacy는 같은 파일 안 분기 대신 `src/legacy/` 고정 사본. 사본의 전역 타입 충돌을 피하려고 `src/legacy/book/inspector.ts`의 `declare global` 블록만 지역 타입 단언으로 바꿨다(동작 동일).
- **G1-C 체크리스트 영향 항목과 현재 판정:** 1번(원근 카메라와 입체감) — 원근 적용, far/near 0.85(목표 0.86–0.92 근접 미달), 원본 실동작 비교는 미관측.

---

## R2 (V20) 종이·조명·환경·후처리 — 통과

- **단계 ID와 상태:** R2 통과(자동 검사 통과, 캡처 자체 판정).
- **실제로 가능한 사용자 행동:** 기존 동작 그대로, 책이 리넨 책상과 매트 위에 놓이고 종이가 빛과 그림자를 받는다. 넘기는 잎이 아래 쪽과 책상에 그림자를 드리운다. 쪽은 거터 쪽으로 꺼지고 가운데가 부풀며 바깥 끝이 처진다.
- **변경 경로와 이유:**
  - 신규 `src/book/render/paperMaterial.ts`(인쇄를 잉크로 곱하는 MeshStandardMaterial 확장: 종이색·절차 섬유·RGBA 상태 레이어), `src/book/render/environment.ts`(절차 리넨 책상·매트·RoomEnvironment PMREM·스폿·반구광·안개), `src/book/render/postPipeline.ts`(Render→GTAO→SMAA→Vignette→Output, 품질 티어).
  - 수정 `src/book/geometry.ts`(SPREAD_PROFILE·spreadHeight·spreadAmplitude, 곡면 쪽·곡면 묶음 기하, 넘김 잎 양 끝 곡면 블렌드 `curvedLeafPoint`), `src/book/stage.ts`(재작성: 조명 받는 재질, 곡면 쪽·묶음, 책등이 힌지를 따라 낮아짐, 안쪽 면지, Neutral 톤매핑, 후처리, draw call 측정), `src/book/BookApp.tsx`(품질 티어 전달, drawCalls·quality 데이터 속성, 인쇄 배경 흰색), `src/book/usePagePrints.ts`(인쇄 배경 옵션), `src/styles/book.css`(3D에서 쪽 HTML 배경 투명).
  - 테스트: 신규 `tests/book-spread-surface.test.ts`(7개).
- **실행 명령과 종료 결과:** typecheck 0, lint 0, `npm test` 304/304, build 0.
- **기기와 브라우저 및 commit:** 위와 같음. 캡처는 `?quality=high`(GTAO 포함).
- **실제 캡처 영상 로그 경로:** [qa/refactor/R2/index.md](qa/refactor/R2/index.md) (after 18장, before = R1 after), [known-offset.md](qa/refactor/R2/known-offset.md).
- **측정값:** 종이 음영 폭 4.4–5.3%(1280×720·844×390 정지, 목표 3–8%), held drag 중 거터 쪽 그림자로 13.6%(1280×720). draw calls 87–114(후처리 포함, 예산 ≤ 150). 표지 색 ΔE76 3.8–4.1(목표 ≤ 6). 넘김 잎 handoff: p=0/p=1에서 곡면 쪽과 25×5 표본 오차 ≤ 1e-6(단위 테스트).
- **미실행 항목과 정확한 이유:** WebGL 컨텍스트에서 composer 생성·dispose 뒤 `renderer.info.memory` 증가 0 확인은 R9 `scripts/perf-budget.ts`로 미룬다(노드 단위 테스트에는 WebGL이 없다). 실기기 GPU 성능 미측정. 실제 모바일에서 low 티어 자동 선택 미확인(UA 규칙만 단위 테스트).
- **남은 결함과 재현 절차:** (과도기) 정지 쪽의 HTML 글자는 곡면을 따르지 않아 쪽 가운데에서 최대 약 5 px 떠 보인다(known-offset.md). 장면 블록은 곡면 위로 0.05×진폭 띄워 두었다(R4에서 종이를 따르는 잉크 그림으로 교체). SwiftShader에서 첫 인쇄 준비가 20–60초 걸린다(HTML→SVG→캔버스 경로, R3에서 교체).
- **객관적 게이트와 선택적 사용자 피드백 상태:** handoff ≤ 1 px(단위 테스트로 수치 일치), depth test 기본 유지(그림자를 depthTest=false로 덮지 않음), CI01 표지 중앙 0 px 유지.
- **다음 허용 단계와 막힌 단계:** R3·R4 허용.
- **전후 캡처 경로와 metrics.json 요약:** 위 측정값, index.md 표.
- **renderer 플래그 상태:** 기본 `ink`. legacy 사본은 영향 없음.
- **설계서 대비 편차와 사유:**
  1. PCFSoftShadowMap은 three r186에서 제거되어 **PCFShadowMap + shadow.radius 2.5**를 쓴다. 스폿 강도 3.0은 decay 0(거리 감쇠 없음) 기준이다. 설계서 3.4는 물리 단위가 아닌 원본 관측값이라 그대로 옮기지 않고 캡처로 맞췄다. 환경 0.38, 반구 0.22, 노출 0.92도 캡처 기준 조정값이다.
  2. 곡면 프로필은 설계서 식의 꺾임(1.12u 클램프)을 없앤 매끈한 식으로 바꾸고, 진폭을 묶음 두께에 비례시켰다(거터 dip이 묶음의 60%를 넘지 않음). 설계서의 `rotation.z = π`로 왼쪽 쪽을 같은 함수로 만든다는 설명은 힌지의 π 회전과 겹쳐 거터 위치가 반대가 되므로, 쪽 기하에 거터 쪽(`start|end`)을 인자로 받게 했다.
  3. 바닥 접촉 그림자 평면(ShadowMaterial)은 책상·매트가 직접 그림자를 받으므로 제거했다. 앞 가장자리 12–16겹 단차는 기하 대신 묶음 측면의 종이결 텍스처로 표현했다.
  4. 표지 원화 재질은 조명을 받는 MeshStandardMaterial(roughness 0.62)이며 Neutral 톤매핑을 받는다(ΔE ≤ 6 확인).
  5. 종이 음영 측정은 설계서의 "좌우 끝과 책등 사이 휘도 차"를 네 여백 표본의 폭으로 정의했다. 광원 방향 때문에 오른쪽 거터는 빛을 향해 더 밝다.
- **G1-C 체크리스트 영향 항목과 현재 판정:** 2번(종이 조명·곡면·그림자) — 정지 음영 4–5%, 거터 dip·처짐·잎 그림자 확인. 원본 실동작 비교는 미관측.

---

## R3 (V21) 캔버스 페이지 인쇄 시스템 — 일부 완료

- **단계 ID와 상태:** R3 **일부 완료**. 인쇄 경로·핫스폿·접근성 거울·상태 레이어는 자동 검사와 e2e를 통과했다. 본문 x-height 기준(1280×720 ≥ 7 px)은 **미달**로 측정되어 설계서가 허용한 '크게 읽기' 안내 인쇄로 처리했고(CONTRACT_V3 B6), 인쇄 핫스폿 크기는 B5 재개정으로 처리했다. 실제 보조기술 검수는 **외부 검수 대기**(R9 사람 항목).
- **실제로 가능한 사용자 행동:** 3D 책의 두 쪽이 종이에 인쇄된 그림으로 보인다(글자·오선·인쇄형 단추·라디오·접힘 탭·도장 칸). 종이 위 인쇄 단추를 눌러 듣기·일시정지·정지·나누기·합치기·추가·되돌리기·문항 응답·접힘 열기를 한다(누르는 동안 종이가 눌린 듯 어두워짐, 마우스를 올리면 엷게 표시). 인쇄된 악보 음표나 음표 목록 칸을 눌러 음표를 고른다. 키보드는 숨은 접근성 거울로 같은 조작을 하며 Tab 초점이 종이 위 호박색 링으로 보인다. 책 밖 오른쪽 위 임시 조작바에서 '크게 읽기', 음소거, '기록과 설정'을 쓴다. 모서리 드래그·화살표 넘김·2D 전환은 그대로다.
- **변경 경로와 이유:**
  - 신규 `src/book/print/`: `pageSpec.ts`(인쇄 DSL), `pageLayout.ts`(순수 배치·줄바꿈·핫스폿·거울 노드·figureRects), `pagePainter.ts`(흰 바탕 잉크 인쇄), `notationRaster.ts`(VexFlow CanvasContext로 쪽 캔버스에 직접 판각), `pageFonts.ts`·`pageFonts.generated.ts`(번들 글꼴), `pageCompositor.ts`(쪽마다 텍스처 1개, draft→settled, 예산), `usePageCompositor.ts`(React 소유자), `hotspots.ts`(상태 레이어·거울 순서), `AccessibleMirror.tsx`(시각 숨김 거울).
  - 신규 `src/content/pages/`: `lessonPages.ts`(12쪽 PageSpec), `pageText.ts`(2D·3D 공용 문장), `index.ts`.
  - 수정 `src/book/BookApp.tsx`(3D에서 `.book-paper-dom` 제거, 컴포지터 텍스처·상태 텍스처 연결, 핫스폿·그림 창·모서리 입력 라우팅, 거울, 임시 조작바, inspector 확장), `src/book/stage.ts`(state 텍스처 4면, `pagePointer` 곡면 raycast, `pagePoint`), `src/book/render/paperMaterial.ts`(상태 레이어를 곱하기 마커로 합성), `src/book/LessonPages.tsx`(공용 문장 사용), `src/book/lessonPresentation.ts`·`lessonScene.ts`(그림 창 보정 상수), `src/book/inspector.ts`, `src/styles/book.css`, `src/legacy/book/inspector.ts`(전역 타입 단언만).
  - 글꼴: `scripts/extract-page-fonts.mjs`, `scripts/rename-subset-font.py`, `public/fonts/book-{sans-regular,sans-semibold,serif-bold}.subset.woff2`(합 153 KB, 546자), `public/licenses/book-page-fonts.txt`.
  - 검증: `scripts/book-v3-e2e.ts`(B4의 v3 e2e), `scripts/refactor-capture.ts`(R3 인쇄 측정 추가). 테스트 신규 `tests/print-layout.test.ts`(10), `tests/print-compositor.test.ts`(6), `tests/hotspots.test.ts`(4), `tests/page-fonts.test.ts`(2), `tests/book-lesson-scene.test.ts`에 1개 추가, 공용 스텁 `tests/support/`.
- **실행 명령과 종료 결과:** `npm run typecheck` 0, `npm run lint` 0, `npm test` 327/327, `npm run build` 0(500 kB 경고 1건은 R1과 같은 three 공유 청크). `node scripts/book-v3-e2e.ts` 17/17 통과 × 3 viewport(1280×720, 844×390, 390×844). `node scripts/refactor-capture.ts --stage R3 …` ink 18장 + legacy 12장.
- **기기와 브라우저 및 commit:** Linux 컨테이너, Node 22.23.4, Playwright 1.60 + headless Chromium 1243(SwiftShader WebGL), DPR 1. 캡처는 `?quality=high`.
- **실제 캡처 영상 로그 경로:** [qa/refactor/R3/index.md](qa/refactor/R3/index.md)(after ink 18장, legacy 12장, before = R2 after), e2e JSON 3개, settled 교체 전후 프레임 3장.
- **측정값:** 3D DOM의 HTML 쪽 요소 **0개**(3 viewport). 본문 글자 7.7 / 4.0 / 3.3 px, x-height **4.1 / 2.1 / 1.8 px**(1280×720 / 844×390 / 390×844; 목표 7 / 5.5 px 미달 → CONTRACT_V3 B6). 가장 작은 인쇄 핫스폿 10.5 / 5.5 / 4.6 px(→ B5). 인쇄 텍스처 37.3 MiB(첫 펼침면, 4쪽) / 46.1 MiB(6쪽 창), 예산 48 MiB, 20회 왕복 뒤 증가 0. `print:draft` 측정 최대 5.2 ms(3 viewport, 1280×720은 1.4 ms; 배치+그리기 명령, 래스터화는 업로드 때), settled 인쇄 ≤ 23 ms. 클릭→렌더 프레임 0.03–3.3 s(SwiftShader 소프트웨어 GL, 대표값 아님). settled 교체: draft·settled 프레임 잉크 교차상관 최적 오프셋 (0,0), 같은 내용 재인쇄 픽셀 동일. draw calls 114(spread1, R2와 같음) / 93(spread2). 책 폭 0.625 / 0.499 / 0.884, far/near 0.847 / 0.851 / 0.938, 종이 음영 4.4 / 4.9 %(R2와 같은 범위). 페이지 오류 0. 글꼴 153 KB.
- **미실행 항목과 정확한 이유:** 실제 스크린리더(NVDA·VoiceOver·TalkBack) 읽기 순서와 숨은 거울 탐색, 실기기 터치로 인쇄 핫스폿 누르기, 200% 확대 — 사람 검사(R9). 실 GPU에서 편집→화면 지연(SwiftShader는 프레임 하나에 0.8–3 s라 대표값이 아님). 아래 사람 검사 항목.
- **남은 결함과 재현 절차:**
  1. 본문 x-height 미달(B6): 1280×720에서 spread1을 열면 본문이 약 7.7 px 글자로 인쇄된다. 왼쪽 쪽 아래 '크게 읽기' 안내, R6 가까이 보기 샷으로 보완 예정.
  2. 인쇄 핫스폿이 24 px 미만(B5): 같은 조작을 조작바 '크게 읽기'(2D, 44 px)와 키보드 거울로 제공.
  3. (과도기) 그림은 아직 R2 색 블록이다(R4에서 잉크 그림). 블록 윗면이 원근으로 떠 보이는 만큼 그림 창을 보정했다.
  4. (과도기) 접힘 탭은 인쇄된 탭 + 쐐기 표시다. 접힌 종이 메시는 R5.
  5. (과도기) 조작바는 오른쪽 위 임시 배치, 이전/다음 단추는 아직 쪽 바깥 변에 있다(R5에서 하단 한 줄 조작바로).
- **객관적 게이트와 선택적 사용자 피드백 상태:** 3D DOM의 `.book-page`/`.book-paper-dom` 0개(3 viewport), BK12(넘김 중 거울 없음, 프레임 표본), draft 인쇄 ≤ 60 ms, settled 교체 jump 0(교차상관 최적 오프셋 (0,0)), 메모리 ≤ 48 MiB(20회 왕복 뒤 증가 0), 같은 revision 파생(단위 테스트·e2e). 사람 피드백 없음.
- **다음 허용 단계와 막힌 단계:** R4 허용(그림 창은 `figureRects`, 상태 레이어·컴포지터 준비됨). R5는 R4 뒤.
- **전후 캡처 경로와 metrics.json 요약:** index.md 표 참고.
- **renderer 플래그 상태:** 기본 `ink`(인쇄 책), `?renderer=legacy`는 착수 커밋 고정 사본(정상, 캡처 12장).
- **R1 과도기 결함과 R2 known-offset:** 3D에 HTML 쪽이 없으므로 R1의 matrix3d 기울어진 HTML 글자와 R2의 곡면과 어긋나는 HTML 글자(최대 약 5 px)는 **해소**됐다. 글자는 곡면 쪽 텍스처에 인쇄된다.
- **설계서 대비 편차와 사유:**
  1. **DSL 모양**: 설계서 (1)의 13종 블록 대신 여섯 장면(B1)에 필요한 블록(heading 1–3, buttons(열·compact), checklist, checkbox, flap(중첩·hintKey), secondsAxis, when, stampSlot)과 상태에 따른 값(Dynamic)을 쓴다. 러닝헤드·쪽번호는 PageSpec 필드다.
  2. **콘텐츠 파일**: spread-1/spread-2 대신 `content/pages/lessonPages.ts` 하나가 여섯 펼침면 12쪽을 만든다(B1). 2D와 3D가 같은 문장을 쓰도록 공용 문장은 `pageText.ts`로 모았다(완전한 DSL 해석기는 R8). 2D에 있던 재생 도움말을 인쇄 쪽에도 넣고, 인쇄 일시정지 단추 이름을 2D와 같은 '일시정지'로 맞췄다.
  3. **악보 래스터**: `renderNotation()` SVG를 Image로 디코드하는 대신 VexFlow `CanvasContext`로 쪽 캔버스에 직접 그린다(같은 판각 규칙). 인쇄가 동기식이 되어 넘김 barrier가 디코드를 기다리지 않는다. VexFlow는 그릴 때 음표머리 x를 정하므로, 음표 상자는 보이지 않는 측정 캔버스에 한 번 그린 뒤 읽는다(먼저 읽으면 상자가 오선 시작점으로 늘어나는 결함을 캡처에서 찾아 수정).
  4. **해상도·예산**: settled 1280(low 1024) / draft 768(low 640) / state 512. 설계서의 1536 settled와 512×724 state는 밉맵(×4/3)을 빼고 48 MB를 계산했다. 밉맵을 넣은 6쪽 창은 46.1 MiB다.
  5. **같은 텍스처 객체**: 쪽마다 CanvasTexture 하나를 창 안에서 유지하고 해상도만 바꾼다(크기가 바뀌면 GPU 저장소를 해제 후 재업로드). 정지 쪽과 넘김 잎이 같은 객체라 넘김 시작에 교체가 없다.
  6. **입력 우선순위**: 설계서는 모서리 → 핫스폿 순서였으나, 1280×720에서 44 px 모서리가 오른쪽 쪽 위 듣기 단추를 덮는다. v2 불변식("투명 hit overlay가 조작을 빼앗지 않는다", `turnTargetOwnsInput`)에 따라 **인쇄 조작(비활성 포함) → 모서리 드래그 → 그림 선택** 순서로 했다.
  7. **인쇄 외관**: 인쇄는 항상 상호작용 가능한 외관으로 찍는다. 넘김·진입 중 입력 차단은 `bookCanInteract`와 거울 `inert`가 맡는다. 넘김 시작에 버튼이 흐려지며 다시 인쇄되는 일을 막는다(v2의 "ready appearance" 규칙).
  8. **상태 레이어 합성**: mix 대신 곱하기(마커). 선택 칠 아래 잉크가 바래지 않는다(`v3-paper-2`).
  9. **e2e**: 과거 증거 스크립트(quiz/keyboard/notation-e2e)는 B4대로 보존하고, 같은 검사(문항·키보드·악보 선택·분할)를 `scripts/book-v3-e2e.ts`가 거울과 인쇄 핫스폿으로 한다.
  10. **글꼴 이름**: 서브셋은 OFL의 수정본이라 예약 글꼴 이름(Pretendard)을 쓸 수 없다. 서브셋 이름을 **Book Sans**(Pretendard 파생)·**Book Serif**(Noto Serif CJK KR 파생)로 바꾸고 원 저작권·상표·라이선스 레코드는 유지했다(`tests/page-fonts.test.ts`). 결정 4(서체 선택)는 그대로다. `font-license-audit.ts` 확장 대신 이 테스트가 매 CI에서 검사한다.
  11. 줄바꿈은 `Intl.Segmenter` 대신 공백 단위 keep-all + 넘치는 한 단어만 글자 분할(한국어 어절 = 공백 단위). 음표 목록은 2열 대신 4열(16개가 4줄): 44 px 칸이 물리적으로 불가능해 B5로 처리.
- **G1-C 체크리스트 영향 항목과 현재 판정:** 3번(페이지가 인쇄물로 보임) — HTML 겹침 0, 종이 조명을 받는 인쇄 텍스처. 4번(조작부 위치) — 전역 조작은 책 밖 임시 조작바로 이동(R5에서 완성). 원본 실동작 비교는 미관측.

### R3 사람 검사 항목 (`docs/qa/refactor/R3/after/`)

- 쪽의 글자·오선이 종이에 인쇄된 것처럼 보이는가(HTML 단추·라디오·스크롤 영역이 없음).
- 400% 확대 캡처에서 글자가 흐리지 않은가(x-height 미달은 B6로 기록).
- 분할 단추를 10번 눌렀을 때 쪽이 깜빡이거나 튀지 않는가(e2e 프레임 비교 jump 0).
- 키보드 Tab으로 조작을 옮길 때 종이 위에 초점 링이 보이는가.
- 2D(크게 읽기) 책이 이전과 같은 내용·조작을 주는가.
- 실제 스크린리더로 거울을 읽었을 때 순서가 [ACCESSIBILITY.md](qa/ACCESSIBILITY.md) R3 절과 같은가(미실행).
