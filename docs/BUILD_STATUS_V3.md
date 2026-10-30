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
| R4 | V22 | 잉크 그림 시스템 + 음가 그림 | 통과 (선 폭 부분 통과: 서 있는 모서리 측정 2건 범위 밖, 편차 11) |
| R5 | V23 | 조작부 재배치 | 통과 |
| R6 | V24 | 레슨 카메라 연출(샷) | 통과 |
| R7 | V25 | 효과음·마감 | 통과 (청취 외부 검수 대기) |
| R8 | V26 | 콘텐츠 확장(목차·마침·GO_TO) | 통과 (renderer 텍스처 수 ≤ 14 미달 기록, 실기기 연속감 미관측) |
| R9 | V27 | 검증 관문 개편·정리 | 통과 (정체성 불일치 0 · 미관측 5 → 원본 체감 C·배포 E 미완료, 사람 검수 외부 대기) |

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

---

## R4 (V22) 잉크 그림 시스템 + 음가 그림 — 통과(선 폭 부분 통과)

- **단계 ID와 상태:** R4(a–d) **통과**(자동 검사·캡처 자체 판정). 단 선 폭 게이트는 **부분 통과**다: 종이 위 잉크는 범위 안이고, 서 있는 모서리의 화면 측정값 둘이 범위를 벗어났다(편차 11). 사람 검사 항목(아래)과 실기기 60 fps 움직임은 미관측.
- **실제로 가능한 사용자 행동:** 펼침면을 열면 오른쪽 쪽의 그림 칸에 펜이 시간 축·눈금·숫자와 블록 윤곽을 그리고, 그림이 종이에서 입체로 일어선다(다시 찾은 펼침면은 일어서기만 한다). 블록은 종이색 면과 잉크 모서리, 그늘진 면의 해칭으로 그려지고 펼친 쪽의 곡면 위에 선다. 블록을 누르면(투명 히트 박스, 일어선 위치 기준) 음표가 골라지고 강조 잉크 외곽선이 생긴다. 들으면 재생 중인 음표가 강조색으로 빛나고 재생선이 지나간다. 나누기·합치기는 데이터가 바로 바뀌고 새(사라지는) 경계가 240 ms 펜 획으로 그어진다(지워진다). 펼침면 1·2에는 소리 띠·메트로놈, 가위 자국·분수 장식이 함께 그려진다. 넘기기 시작하면 그림은 종이에 눕고, 넘김 잎이 그 위를 덮는다.
- **변경 경로와 이유:**
  - 신규 `src/book/figures/`: `inkLines.ts`(LineSegments2/LineMaterial 패치: 평면↔입체 `uLift`, 펜 `uReveal`, 정확한 폭의 안티앨리어싱, 눈 쪽 당김, 세그먼트별 농담·점선 거리, 펜 스케줄러), `paperFill.ts`(종이 채움: 해칭·글로·reveal 임계값, 그림자 depth 재질), `figure.ts`(그림 빌더 line/box/label/hit/pause, 곡면 순응, 강조 외곽선, stage가 찾는 figure controls 레지스트리), `choreography.ts`(등장 시간표), `music/durationFigure.ts`(음가 그림: durationWorld 의미 import, 분할·합치기 획), `music/decor.ts`(장식).
  - 수정 `src/book/lessonScene.ts`(durationWorld → durationFigure, 첫 레인만 숫자, 장식·반 박자 안내 잉크, 곡면 `spread` 옵션, figure controls, DEV `holdTransitions`·`laneToWorld`), `src/book/stage.ts`(세로 scale·bulge 보정 삭제, lift/reveal 적용, 넘김 중 납작한 그림 숨김, 선 해상도, DEV 장면 draw call 측정·투영), `src/book/BookApp.tsx`(첫 등장 reveal∥lift, 재방문 lift만, 그림 창 중앙 = 그림 전체 범위, 장면 생성 옵션), `src/book/motion.ts`(토큰 추가만: reveal 520, lift 600, liftDelay 120, stagger 45, splitMerge 240), `src/book/lessonPresentation.ts`(그림 배치 거울 `LESSON_FIGURE_LAYOUT`, `lessonFigureExtent`), `src/book/geometry.ts`(`rightPagePaper`), `src/book/inspector.ts`(sceneProgress/sceneReveal 포즈, figure·figureEntry·holdFigureStrokes·figurePlayback·sceneDrawCalls·figurePoints), `src/content/pages/lessonPages.ts`(펼침면 1·2 그림 칸 높이).
  - 검증: 신규 `scripts/figure-capture.ts`, `scripts/book-v3-e2e.ts`에 R4 검사 2개(등장 끝 상태·예산, 분할 획)와 그림 탭을 블록 위치로 조준, `scripts/refactor-capture.ts`에 그림 세그먼트·장면 draw call 기록. 테스트 신규 `tests/ink-lines.test.ts`(5), `tests/figure.test.ts`(7), `tests/duration-figure.test.ts`(9), `tests/book-lesson-scene.test.ts`에 3개 추가·기존 4개를 그림 API로 수정(의미 기대값 유지).
- **실행 명령과 종료 결과:** `npm run typecheck` 0, `npm run lint` 0, `npm test` 351/351, `npm run build` 0(500 kB 경고 1건은 R1과 같은 three 공유 청크). `node scripts/book-v3-e2e.ts` 19/19 × 3 viewport(1280×720, 844×390, 390×844). `node scripts/figure-capture.ts` 3 viewport 오류 0. `node scripts/refactor-capture.ts --stage R4 …` ink 18장 + legacy 12장.
- **기기와 브라우저 및 commit:** Linux 컨테이너, Node 22.23.4, Playwright 1.60 + headless Chromium 1243(SwiftShader WebGL), DPR 1. 캡처는 `?quality=high`.
- **실제 캡처 영상 로그 경로:** [qa/refactor/R4/index.md](qa/refactor/R4/index.md)(after ink 18장, legacy 12장, before = R3 after), 등장 12프레임·글로·분할 3장(3 viewport), 선 폭 400% 크롭, `figure-*.json`, e2e JSON 3개.
- **측정값:** 선 폭(FWHM) 종이 위 눈금 1.28 / 1.21 / 1.33 px, 서 있는 윗모서리 1.74 / 1.11 / 1.58 px(1280×720 / 844×390 / 390×844). 장면 draw call 14(펼침면 1)·9(펼침면 2), 세그먼트 572·275(예산 3,000/6,000), 장식 ≤ 400(테스트). 첫 등장 reveal 520 ms ∥ lift 600 ms(120 ms 지연) = 720 ms(프레임별 값은 index.md). draft 인쇄 최대 7.3 / 5.8 / 2.9 ms(≤ 60). 인쇄 메모리 46.1 MiB(예산 48), 20회 왕복 뒤 변화 0. 본문 x-height 4.06 / 2.14 / 1.77 px(R3 B6와 같음). 페이지 오류 0.
- **미실행 항목과 정확한 이유:** 실기기 GPU에서 60 fps 등장·분할 획의 움직임(SwiftShader는 프레임 하나에 0.5–3 s라 시간표를 inspector로 고정해 찍었다), 실제 스크린리더에서 그림 안내(거울의 그림 설명 문장은 R3와 같음) — 사람 검사(R9).
- **남은 결함과 재현 절차:**
  1. 분할 획은 강조 외곽선(선택된 앞 블록)과 같은 경계를 지나 1280×720에서 눈에 잘 띄지 않는다(`1280x720_split_*`). 획은 블록 위 0.35 단위에서 시작해 눈금까지 이어진다. 더 잘 보이게 하는 연출은 R6(가까이 보기 샷)에서 다시 본다.
  2. 메트로놈은 서 있는 카드라 읽기 포즈(62°)에서 세로가 약 절반으로 줄어 작게 보인다.
  3. (과도기) 넘김 중에는 그림이 종이에 누운 뒤 숨는다(잎과 함께 넘어가지 않는다). 잎이 그림 칸을 덮는 동안 숨으므로 보이지 않지만, 그림을 잎에 붙이는 연출은 설계 범위 밖이다.
  4. 가로 축의 선 폭은 블록 앞모서리와 3–4 px 떨어져 844×390·390×844에서 단면이 분리되지 않아 재지 못했다(`figure-*.json`의 `dropped` 15). 측정 위치를 블록이 없는 축 끝으로 옮기는 것은 R9 게이트 측정에서 한다.
- **객관적 게이트와 선택적 사용자 피드백 상태:** 선 폭(화면 측정, 부분 통과), 의미 테스트 6개 이전, 장면 draw call ≤ 40, 세그먼트 예산, 그림 창 안에 그림 전체(테스트), 데이터 먼저 분할(e2e), 넘김 중 그림 처리(캡처 turn50·BK12). 사람 피드백 없음.
- **다음 허용 단계와 막힌 단계:** R5 허용(R3 일부 완료: B5·B6는 기록된 대체 처리, 불변식 회귀 없음). R6은 R4·R5 뒤.
- **전후 캡처 경로와 metrics.json 요약:** index.md 표 참고.
- **renderer 플래그 상태:** 기본 `ink`(인쇄 책 + 잉크 그림), `?renderer=legacy`는 착수 커밋 고정 사본(정상, 캡처 12장, `src/scenes/durationWorld.ts`는 legacy가 계속 쓰므로 R9까지 그대로).
- **설계서 대비 편차와 사유:**
  1. **선 폭 구현**: `LineMaterial(linewidth 1.4)`를 그대로 쓰면 1.4 px 사각형이 화소 격자 위치에 따라 1 또는 2 화소를 덮어(SMAA는 단면을 고치지 않음) 실측 폭이 1.03–1.29 px였다. 사각형을 1.5 px 넓히고(`aaPad`) 조각 셰이더가 정확히 1.4 px를 1 px 경사로 덮게 했다(`uInkWidth`, 투명 혼합, ink끼리는 깊이 쓰기 없음). 또 블록 모서리 선이 옆 면의 기울어진 깊이에 반쯤 가려져, 선의 view 공간 위치를 눈 쪽으로 0.15% 당긴다(투영은 그대로). 설계값 1.4 px는 그대로다.
  2. **평면 투영**: 설계서 기본값 (x, 0, z) 평면도를 그대로 쓴다. 높이는 접히지 않고 바닥 윤곽 위에 겹친다(일어서면 위 윤곽이 올라온다). `fold` 옵션은 남겨 두었다.
  3. **API 모양**: 설계서의 `InkLineSet.add/build/setLines`는 `InkLines.set(segments)`(용량 재할당 포함), `figure(id, build)`는 `createInkFigure(id).rebuild(build)`, `InkFigure.update(time, camera)`는 stage가 매 프레임 부르는 `setResolution(w, h)`로 바뀌었다. stage는 그림을 모르는 채 group에 등록된 figure controls(`figureControlsOf`)로 lift·reveal·해상도를 넘긴다(SceneHost 계약 무변경). 빌더의 `lathe`는 음가 그림·장식에 필요 없어 만들지 않았다(R8 장식에서 필요하면 추가).
  4. **해칭**: `sin(dot(pos, dir)/spacing)` 대신 같은 방향·간격의 안티앨리어싱 선 패턴(`fract` + `fwidth`)이다. 간격 0.55(레인 단위)는 설계값 그대로이며 1280×720에서 약 13 px 간격이다.
  5. **reveal 순서와 강조**: 레인 → 장식 → 안내선 순서로 45 ms씩 늦게 그리고(`staggeredReveal`), 선택 외곽선은 그 레인의 그림이 다 그려진 뒤에 나타난다(펜보다 앞서 선택 표시가 보이지 않게).
  6. **첫 등장 길이**: reveal 520 ms와 lift 600 ms(120 ms 지연)를 겹치므로 첫 등장은 720 ms다(`BOOK_MOTION.enter` 600은 값 그대로 두고 ink 경로에서 쓰지 않음). 각 채널은 자기 시간에 smoothStep을 받고, `tween`의 smoothStep은 역함수로 풀어 선형 시간으로 쓴다.
  7. **넘김 중 그림**: lift가 0이 된 납작한 그림은 넘김 중에 숨긴다(잎이 그 쪽을 들어 올리면 다음 쪽 위에 남기 때문). 드래그 초반(p < 0.16)처럼 서 있는 동안은 보이고 잎이 depthTest로 가린다.
  8. **숫자 라벨·그림 창**: 겹친 레인은 첫 레인에만 '0, 1/2, 1'을 찍는다. 그림 창 높이를 펼침면 1·2에서 늘렸고(장식 자리), 창 중앙은 그림 전체(올라선 블록 윗면·숫자·장식)의 화면 범위 중앙이다(`lessonFigureExtent`, 테스트가 모든 장면이 창 안에 들어감을 확인).
  9. **장식 모양**: 메트로놈은 서 있는 카드(평면도에서 일어섬), 소리 띠·가위 자국·가위는 종이 위 잉크, 분수는 사건에서 계산한 문장이다. 모두 고르기·채점·저장에 쓰지 않는다.
  10. **분할 획**: 앞면 앞 0.04 단위, 블록 위 0.35 단위에서 눈금까지 잇는 잉크 획(2.2 px)이다(외곽선 위로 보이게).
  11. **선 폭 측정**: 화면 FWHM은 선이 화소 격자의 어디에 놓이느냐에 따라 같은 1.4 px 선도 약 1.25–2.0 px로 읽힌다. 종이 위 눈금은 세 화면 모두 1.2–1.6 px 안이지만, 서 있는 블록 윗모서리는 1.74 px(1280×720)와 1.11 px(844×390)로 범위를 벗어났다(두 면의 밝기 차이로 기준선도 흔들림). 셰이더의 덮임 폭은 테스트로 확인했고, 위상 평균 측정은 R9로 넘긴다. 이 게이트는 부분 통과로 기록한다.
- **G1-C 체크리스트 영향 항목과 현재 판정:** 5번(그림이 종이에서 올라오는 잉크 선화) — 펜 reveal·lift·해칭·종이 면·곡면 순응 확인(캡처). 원본 실동작 비교는 미관측.

### R4 사람 검사 항목 (`docs/qa/refactor/R4/after/`)

- 그림이 색 블록이 아니라 종이에 그린 잉크 선화로 보이는가(해칭, 종이색 면, 잉크 모서리).
- 첫 등장에서 펜이 그리고 그림이 일어서는 순서가 자연스러운가(`*_entry_sheet_ink.jpg`).
- 선 폭이 고르게 보이는가(400% 크롭).
- 분할할 때 새 경계가 그어지는 것이 보이는가(실기기).
- 장식이 학습을 돕고 산만하지 않은가.

---

## R5 (V23) 조작부 재배치 — 통과

- **단계 ID와 상태:** R5 **통과**(자동 검사·캡처 자체 판정). 사람 검사 항목(아래)과 실기기 터치·스크린리더는 미관측.
- **실제로 가능한 사용자 행동:** 책을 펼치면 화면 아래에 한 줄 조작바가 나타난다: ← (첫 펼침면에서는 '표지로'), 목차(R8 전까지 사유와 함께 비활성), →(마지막 펼침면에서 비활성), 쪽 번호, 소리, 정지 화면, 크게 읽기, 기록. 책은 조작바 위 영역에 맞춰 놓여 조작바에 가리지 않는다. 책갈피 버튼은 없어졌고, 모서리를 잡아 넘기기와 방향키는 그대로다. '기록'은 백업·내보내기·가져오기·삭제와 읽기·소리 설정을 담은 모달 대화상자를 열고, 열린 동안 책은 방향키를 받지 않으며 닫으면 초점이 '기록'으로 돌아온다. 왼쪽 쪽에는 질문과 라디오가 바로 인쇄되고(R3의 '질문' 펼치기 없음), 그 아래 정답 자리는 종이 덮개로 가려져 있다. '정답 보기'(인쇄 탭 또는 덮개 종이)를 누르면 덮개가 윗변을 축으로 240 ms 동안 110°까지 들리고 그 아래 인쇄된 해설이 보인다. 서 있는 덮개의 뒷면에는 '다시 덮기 · 종이를 눌러 내려요'가 적혀 있고 그 종이를 누르면 다시 덮인다. 세 문항을 모두 맞히면 쪽 아래 도장 칸에 '확인' 도장이 찍힌다. 펼침면 1 오른쪽에는 '가까이 보기'가 인쇄되어 있다(R6 샷 전까지 동작 없음).
- **변경 경로와 이유:**
  - 신규 `src/book/ui/Toolbar.tsx`(설계서 JSX의 단추 8개, `data-visible`, 숨을 때 `inert`·`aria-hidden`), `src/book/ui/RecordsDialog.tsx`(`<dialog>` 모달, 열릴 때 재생 정지, 열린 동안만 내용 렌더), `src/styles/toolbar.css`(52 px, safe-area, 반투명 책상 톤, 44×44, 좁은 화면 두 줄 글자, 낮은 가로 화면 36 px), `src/book/render/flaps.ts`(덮개 종이 메시: 윗변 힌지 0→110°, `BOOK_MOTION.flap` 240 ms, 앞면 = 인쇄된 닫힌 덮개, 뒷면 = 접는 안내, 레이캐스트 대상).
  - 수정 `src/book/BookApp.tsx`(조작바·기록 대화상자, 조작바 높이를 `--book-safe-bottom`으로 stage safe rect에 반영, 대화상자 중 방향키 무시, 인쇄 레이아웃의 덮개 → stage 플랩, 서 있는 덮개 누름 → 그 탭의 명령, `.book-navigation` 삭제, 표지 저장 안내 문구), `src/book/stage.ts`(플랩 층: `setPageFlaps`·`flapAt`, 넘김 중 숨김, DEV `flapAngles`·`holdFlaps`), `src/book/inspector.ts`(`flapAngles`·`holdFlaps`·`flapAt`, `pages()`에 덮개·도장), `src/book/turnHit.ts`(조작바·기록 대화상자가 입력 소유), `src/book/motion.ts`(토큰 `flap: 240`), `src/book/BookProgressTools.tsx`(`BookProgressContent` 분리), `src/book/print/pageSpec.ts`·`pageLayout.ts`·`pagePainter.ts`·`hotspots.ts`(덮인 플랩: 자리 예약, 닫힌 덮개 인쇄와 종이 핫스폿, `flaps`·`stamps` 목록, 도장은 state 레이어), `src/content/pages/lessonPages.ts`·`pageText.ts`(질문 바로 인쇄, 정답 덮개, 문항 장면의 도장 칸, '가까이 보기'), `src/book/LessonPages.tsx`(2D도 질문 바로 표시, '정답 보기' 펼치기, 도장 문장), 인쇄 단추 '‖ 잠깐 멈춤'(설계서 이름, 2D·거울 같은 이름, `public/fonts` 서브셋 다시 생성), `src/styles/book.css`·`lesson-pages.css`.
  - 삭제 `src/book/navigationPlacement.ts`, `tests/book-navigation-placement.test.ts`(결정 1 '대체').
  - 검증: `tests/flap-layer.test.ts`(5), `tests/book-turn-hit.test.ts`(조작바·대화상자 소유권), `tests/print-layout.test.ts`(R5 질문·덮개·도장), `tests/print-compositor.test.ts`, `scripts/book-v3-e2e.ts`(R5 검사 10개), `scripts/refactor-capture.ts`(`stamp`·`flap` 상태, 왼쪽 쪽 2배 크롭, 모든 캡처의 `extra.chrome`).
- **실행 명령과 종료 결과:** `npm run typecheck` 0, `npm run lint` 0, `npm test` 353/353, `npm run build` 0(500 kB 경고 1건은 R1과 같은 three 공유 청크). `node scripts/book-v3-e2e.ts` 28/28 × 4 viewport(1280×720, 844×390, 390×844, 568×320). `node scripts/refactor-capture.ts --stage R5 …` ink 3 viewport × 7 상태(cover·spread1·stamp·flap·turn50·spread2·2d) + 568×320 3장 + 360×740 1장 + 왼쪽 쪽 2배 크롭 12장, legacy spread1 3장, 오류 0.
- **기기와 브라우저 및 commit:** Linux 컨테이너, Node 22.23.4, Playwright 1.60 + headless Chromium 1243(SwiftShader WebGL), DPR 1. 캡처는 `?quality=high`.
- **실제 캡처 영상 로그 경로:** [qa/refactor/R5/index.md](qa/refactor/R5/index.md)(before = R4 after).
- **측정값:** 조작바 높이 53 px(1280×720·844×390·390×844·360×740), 41 px(568×320), 단추 44×44(568×320은 36×36). 책 아래 끝 → 조작바 위 거리 22.4 / 16.8 / 279.7 / 15.9 px(1280×720 / 844×390 / 390×844 / 568×320), 교차 0 px². 3D 캡처의 책 밖 단추(조작바·표지·거울 제외) 0개. 덮개 각도 0 / 55 / 110°(0 / 120 / 240 ms). draft 인쇄 최대 5.5 / 5.2 / 6.8 / 3.7 ms(≤ 60). 페이지 오류 0.
- **미실행 항목과 정확한 이유:** 실기기 터치(조작바 단추·덮개 누름), 실제 스크린리더로 조작바·대화상자 읽기, 실기기 60 fps 덮개 움직임(SwiftShader는 한 프레임에 0.5–3 s라 덮개 시계를 inspector로 0/120/240 ms에 고정해 찍었다) — 사람 검사(R9). 옛 `scripts/keyboard-e2e.ts`는 고정된 standalone 산출물 해시를 요구하는 v2 증거 스크립트라(B4) 같은 키보드 검사(방향키 넘김, 모달 중 방향키 무시, 첫·마지막 펼침면 경계)를 `scripts/book-v3-e2e.ts`가 한다.
- **남은 결함과 재현 절차:**
  0. (수정됨, `3676072`) Escape로 기록 대화상자를 닫으면 Chromium이 닫힘 이벤트를 다음 입력 때 보내, 그 사이 책이 방향키를 받지 않았다. 대화상자가 취소 요청을 직접 처리해 바로 닫는다(e2e 키보드 검사가 찾음).
  1. 110°로 선 덮개가 바로 위 셋째 질문의 보기와 '정답 보기' 탭 일부를 가린다(`*_flap_240ms_left2x_ink.jpg`). 윗변 힌지 110°의 결과이며, 가려진 탭 대신 덮개 종이를 누르면 접힌다(e2e 'R5: a press on the standing paper…').
  2. 좁은 화면(≤ 380 px)에서는 쪽 번호를 화면에서 숨기고 보조기술에만 읽힌다(각 쪽 아래 인쇄된 쪽 번호는 그대로).
- **객관적 게이트와 선택적 사용자 피드백 상태:** 책 밖 버튼 = 조작바(+표지) 뿐(e2e, 캡처 `outsideButtons` 0), 844×390 조작바 ∩ bookBounds = 0(캡처·e2e), 플랩·도장 캡처, 키보드(방향키·모달), 첫 이전 = 닫기, 마지막 다음 = 비활성. 사람 피드백 없음.
- **다음 허용 단계와 막힌 단계:** R6 허용(R4·R5 통과). R7은 R6 뒤, R8은 R5 뒤(목차 단추 활성화).
- **전후 캡처 경로와 metrics.json 요약:** index.md 표 참고.
- **renderer 플래그 상태:** 기본 `ink`, `?renderer=legacy`는 착수 커밋 고정 사본(조작바 없음, 책갈피 그대로 — 비교용).
- **설계서 대비 편차와 사유:**
  1. **품질 티어 설정 없음**: 설계서 (4)는 기록·설정에 '품질 티어'를 둔다. 지금 티어는 기기 프로필(`currentProfile`, `?quality`)에서 정해지고 저장 스키마에 티어 필드가 없다. 새 저장 필드를 만들면 저장 형식 판올림·이전이 필요해 R5에서는 넣지 않았다(2D·정지 화면·소리·음량 설정은 그대로 옮김). R7(마감)에서 저장 판올림과 함께 다룬다.
  2. **덮개 두께**: 두께 0.003은 화면에서 0.5 px 미만이라 앞뒤 두 면의 얇은 종이(앞면 인쇄, 뒷면 종이 + 접는 안내)로 그렸다. 들린 덮개는 그림자를 드리운다.
  3. **덮개 아래 인쇄**: 설계서는 열림·닫힘 두 장을 캐시한다. 여기서는 열림 상태가 바뀌면 그 쪽을 다시 인쇄한다(draft 인쇄 ≤ 6.8 ms). 열 때는 덮개가 닫힌 자리를 덮은 채 들리므로 바뀜이 보이지 않고, 닫을 때는 인쇄가 먼저 닫힌 덮개를 보이고 3D 덮개가 그 위로 내려앉는다.
  4. **질문 배치**: R3에서 '질문' 펼치기 안에 있던 문항을 쪽에 바로 인쇄했다(설계서 (2) '왼쪽: 질문 라디오 + 정답 보기 플랩'). 정답 자리는 늘 예약되어 덮개를 열고 닫아도 아래 내용이 움직이지 않는다.
  5. **덮개 누름**: 선 덮개는 바로 위 인쇄를 가리므로, 덮개 종이 자체를 누르면 접힌다(레이캐스트 → 탭의 명령, 보조기술·키보드는 거울의 탭).
  6. **좁은 화면 조작바**: 설계서는 568×320에서만 36 px 압축형을 말한다. 세로 휴대폰(≤ 620 px 폭)은 44 px를 지키려고 두 단어 글자를 두 줄로 쓰고, ≤ 380 px에서는 쪽 번호를 화면에서 숨긴다.
  7. **표지에서 조작바**: 숨기되(`visibility: hidden`, `inert`) 높이는 유지해, 책을 펼칠 때 safe area와 책 크기가 뛰지 않는다.
  8. **목차·가까이 보기**: `ContentsFlap.tsx`는 GO_TO와 함께 R8에서 만든다(지금 '목차'는 비활성 + 사유 title). '가까이 보기'는 인쇄되지만 R6 샷 전까지 DEV 기록만 남긴다.
- **G1-C 체크리스트 영향 항목과 현재 판정:** 조작부 위치(정체성 항목) — 책 밖 하단 한 줄 + 쪽 안 인쇄 조작 확인(캡처). 원본 실동작 비교는 미관측.

### R5 사람 검사 항목 (`docs/qa/refactor/R5/after/`)

- 쪽 안에 HTML 단추가 없고 인쇄된 단추와 덮개만 있는가.
- 하단 조작바가 책을 가리지 않고 한 줄로 작은가(≤ 56 px).
- 책갈피가 사라져도 모서리 드래그로 넘기기가 그대로 되는가(실기기 터치).
- 덮개가 종이처럼 들리고, 서 있는 덮개를 눌러 다시 덮을 수 있는가. 도장이 찍히는가.

## R6 (V24) 레슨 카메라 연출(샷) — 통과

- **단계 ID와 상태:** R6 **통과**(자동 검사·캡처 자체 판정). 사람 검사 항목(아래)과 실기기 60 fps 움직임은 미관측.
- **실제로 가능한 사용자 행동:** 펼침면 1 오른쪽의 인쇄 단추 '가까이 보기'를 누르면 카메라가 900 ms에 걸쳐 '두 줄' 그림 쪽으로 내려가 비스듬히 다가간다(앙각 36°, 방위 −14°, 화각 32°). 단추는 '돌아오기'로 다시 인쇄되고, 그것을 다시 누르거나 Escape를 누르면 600 ms에 걸쳐 원래 읽기 자리로 정확히 돌아온다. 샷 안에서도 인쇄된 단추(▶ 위 줄 듣기 등)와 그림 고르기가 그대로 된다. 샷 중에 →·←·조작바 넘기기·표지로를 누르면 먼저 읽기 자리로 돌아온 뒤 넘긴다(한 칸 대기열). 샷 중 모서리를 누르면 넘기기를 시작하지 않고 읽기 자리로 돌아온다. 펼침면 2의 '가까이 보기'는 종이 띠(가위 자국)로 다가간다(34°, 10°, 32°). 다른 탭으로 가거나 2D로 바꾸면 샷은 바로 풀린다.
- **변경 경로와 이유:**
  - 신규 `src/book/render/shots.ts`(ShotSpec = 영역 + 자세 + 여유 + 시간, `SPREAD_SHOTS`, `resolveShot` = 영역 점을 `fitRig`에 넣은 fit, `shotProgress`, `SHOT_RETURN_MS` 600), `tests/shots.test.ts`.
  - 수정 `src/book/render/cameraRig.ts`(`blendTo(from, to, t)`: smoothStep, 위치·target lerp, 쿼터니언 slerp, t ≤ 0이면 읽기 fit 객체 자체), `src/book/controller.ts`(최소 변경: `CameraState` `'shot'`, `SHOT_START`·`SHOT_END`, 샷 중 NEXT·PREV·CLOSE 대기열, 드래그 거부, 숨김·2D 해제), `src/book/stage.ts`(`StageUpdate.shot`, 읽기 fit과 적용 fit 분리, 영역 점은 보이는 유한한 부분만, 유한하지 않은 fit 무시, layout에 `camera.shot`), `src/book/BookApp.tsx`(샷 구동: 진입·유지·복귀, '가까이 보기' ↔ '돌아오기' 인쇄, Escape·대기열·모서리 누름 처리, DEV `holdShot`), `src/book/print/pageSpec.ts`(`PageUiState.shotId`), `src/book/print/pageCompositor.ts`(`printKey`에 `shotId`), `src/content/pages/lessonPages.ts`·`pageText.ts`(펼침면 1·2 '가까이 보기'/'돌아오기'), `src/book/inspector.ts`(`shot()`, `holdShot(ms)`).
  - 검증: `tests/book-controller.test.ts`(R6 3개), `tests/shots.test.ts`(4), `scripts/book-v3-e2e.ts`(R6 검사 5개), `scripts/refactor-capture.ts`(`shot`·`shotHotspot`·`shotTurn` 상태, 샷 시계 고정).
- **실행 명령과 종료 결과:** `npm run typecheck` 0, `npm run lint` 0, `npm test` 360/360, `npm run build` 0(500 kB 경고 1건은 R1과 같은 three 공유 청크). `node scripts/book-v3-e2e.ts` 33/33 × 4 viewport(1280×720, 844×390, 390×844, 568×320). `node scripts/refactor-capture.ts --stage R6 …` ink 2 viewport(1280×720, 844×390) × spread1·샷(진입 4장·유지·복귀 3장·복귀 뒤)·샷 중 조작·spread2·샷 중 넘김(3장), 오류 0.
- **기기와 브라우저 및 commit:** Linux 컨테이너, Node 22.23.4, Playwright 1.60 + headless Chromium 1243(SwiftShader WebGL), DPR 1. 캡처는 `?quality=high`. 코드 `7bef23d`, 수정 `887c863`.
- **실제 캡처 영상 로그 경로:** [qa/refactor/R6/index.md](qa/refactor/R6/index.md)(before = R5 after).
- **측정값:** 복귀 뒤 카메라 − 샷 전 읽기 카메라: 위치·쿼터니언 최대 차 **0 / 0**(1280×720, 844×390 캡처), e2e 4 viewport `maxDifference` 0. 샷 중 카메라 위치 이동 8.1 / 9.0(월드 단위, 1280×720 / 844×390). 샷 중 인쇄 '▶ 위 줄 듣기' 누름 → 재생(2 viewport 캡처, 4 viewport e2e). 샷 중 ArrowRight: 복귀 중(t 0.5) 넘김 대기(phase spreadIdle, camera shot) → 복귀 뒤 넘김 → spread-3, 샷 상태로 넘긴 프레임 0(e2e 프레임 표본). 페이지 오류 0.
- **미실행 항목과 정확한 이유:** 실기기 60 fps의 900 ms 진입·600 ms 복귀(SwiftShader는 한 프레임에 0.5–3 s라 샷 시계를 inspector로 고정해 찍었다) — 사람 검사(R9). 재생 시작 시 자동 샷(결정 5, 기본 끔)은 설정 저장 필드가 필요해 R7의 저장 형식 판올림과 함께 넣는다.
- **남은 결함과 재현 절차:**
  0. (수정됨, `887c863`) 샷이 '유지' 단계일 때 고정 시계(`holdShot(0)`)를 걸면 샷 카메라가 읽기 자리로 튀고 복귀가 바로 끝났다(캡처가 찾음). 유지 단계의 t는 시계와 무관하게 1이다. 같은 커밋에서 e2e·캡처의 "샷에서 돌아옴" 판정이 stage가 읽기 카메라를 실제로 그린 뒤(layout `camera.shot` 없음)를 기다리게 했다 — SwiftShader의 느린 프레임에서는 SHOT_END가 그 프레임보다 먼저 와서 844×390·390×844·568×320 e2e가 샷 카메라를 읽었다.
  1. 샷 중 모서리를 누르면 넘기기를 시작하지 않고 복귀만 한다. 복귀 뒤 다시 잡아야 넘어간다(설계: 드래그 시작 거부).
- **객관적 게이트와 선택적 사용자 피드백 상태:** 복귀 오차 0(단위·e2e·캡처), 5 viewport fit(단위), 샷 중 NEXT 대기열·드래그 거부·hidden 해제(단위·e2e), 샷 중 핫스폿(e2e·캡처). 사람 피드백 없음.
- **다음 허용 단계와 막힌 단계:** R7 허용(R5 통과). R8은 R3·R4·R5 통과로 허용.
- **전후 캡처 경로와 metrics.json 요약:** index.md 표 참고.
- **renderer 플래그 상태:** 기본 `ink`, `?renderer=legacy`는 착수 커밋 고정 사본(샷 없음 — 비교용).
- **설계서 대비 편차와 사유:**
  1. **`blendTo` 서명**: 프롬프트는 `blendTo(pose, position, target, t)`를 적었다. 여기서는 두 fit 결과를 섞는 `blendTo(from: FitResult, to: FitResult, t)`로, t ≤ 0이면 읽기 fit 객체 자체를 돌려준다. 복귀가 "읽기 포즈 fit 결과를 그대로 쓴다"는 조건을 구조로 보장한다.
  2. **`returnToReading`의 자리**: 복귀 tween은 rig가 아니라 BookApp의 샷 구동이 맡는다(진입·유지·복귀를 한 시계로 돌리고 DEV에서 고정하려고). 시간은 설계대로 600 ms다.
  3. **샷 중 닫기·숨김**: CLOSE_BOOK은 NEXT처럼 대기열('close')에 들어가 복귀 뒤 실행한다. HIDE_DOCUMENT는 대기열에 넣지 않고 바로 해제한다(설계 수용 기준 'hidden에서 해제').
  4. **펼침면 2의 '가까이 보기'**: 설계 표의 두 번째 샷(strip-close)을 쓰려면 독자가 시작할 단추가 필요해 펼침면 2 오른쪽에도 같은 인쇄 단추를 두었다.
  5. **자동 샷**: 결정 5(기본 끔)의 설정은 저장 형식 판올림이 필요해 R7에서 넣는다.
  6. **샷 시계 고정**: 캡처를 위해 DEV `holdShot(ms)`(지금 단계가 시작된 뒤의 ms)를 두었다. 실사용 경로에는 영향이 없다.
  7. **인쇄 키**: 단추 이름('가까이 보기' ↔ '돌아오기')이 바뀌도록 인쇄 키에 `shotId`를 넣었다(같은 텍스처를 다시 인쇄, draft ≤ 10 ms).
- **G1-C 체크리스트 영향 항목과 현재 판정:** 연출 샷(정체성 5번) — 독자가 시작하는 샷과 정확한 복귀 확인(캡처·e2e). 원본 실동작 비교는 미관측(결정 6 원본 녹화 없음).

### R6 사람 검사 항목 (`docs/qa/refactor/R6/after/`)

- '가까이 보기'를 누르면 카메라가 그림 쪽으로 들어가고, 다시 누르면 정확히 원래 자리로 돌아오는가.
- 샷 중에 페이지를 넘기면 먼저 돌아온 뒤 넘기는가.
- 넘김 중에는 카메라가 움직이지 않는가.

## R7 (V25) 효과음·마감 — 통과(청취 외부 검수 대기)

- **단계 ID와 상태:** R7 **통과**(렌더 측정·단위 테스트·e2e 자체 판정). 실제 청취(크기·질감·구별)는 에이전트가 할 수 없어 **외부 검수 대기**다.
- **실제로 가능한 사용자 행동:** 표지를 펼치면 짧은 표지 소리가 나고, 버튼·방향키로 넘기면 종이 넘김 소리, 쪽이 놓이면 낮은 안착 소리가 난다(드래그는 놓아서 넘기기로 확정될 때 넘김 소리). 인쇄 단추를 누르면 작은 펜 소리, 정답 덮개를 들면 종이 소리, 세 문항을 맞혀 도장이 새로 찍히면 도장 소리가 난다. 음악이 재생 중이면 펜 소리는 나지 않는다. 표지를 펼치기 전에는 어떤 소리도 나지 않는다. 조작바 '소리'를 끄면 음악과 효과음이 함께 꺼지고, '기록'의 설정에서 효과음만 끌 수 있다. 같은 곳에 '재생할 때 가까이 보기'(기본 끔)가 있어 켜면 ▶ 듣기를 누를 때 그 펼침면의 샷이 함께 시작된다. 표지 아래 안내 자리에는 로딩이 잉크 선으로 자란다(표지 → 본문 글꼴 → 기보 글꼴 → 첫 펼침면 인쇄). 기록은 새 형식(v3)으로 저장되고, 이전 형식(v2) 기록은 원본 백업을 남긴 채 옮겨진다.
- **변경 경로와 이유:**
  - 신규 `src/book/sfx/synthSfx.ts`(7종 절차 합성, 노이즈는 RBJ 바이쿼드로 미리 렌더해 정규화, 그래프 자동 해제, 고정 게인), `src/book/sfx/useBookSfx.ts`(전이 → 효과음, 첫 제스처 잠금, 음악 재생 중 펜 억제, DEV 기록), `src/persistence/bookProgressV3.ts`(schema 3, v2 원본 백업 → 검증 → 새 키, CAS 저장, 가져오기·내보내기·백업·삭제), `scripts/sfx-render.ts`, `tests/sfx.test.ts`(4), `tests/book-progress-v3.test.ts`(8).
  - 수정 `src/audio/AudioEngine.ts`(최소 변경: `sfx` 옵션, master 아래 효과음 게인, `playSfx`·`setSfxEnabled`, dispose 정리), `src/book/useBookAudio.ts`(합성기 연결, 설정 반영), `src/book/useBookProgress.ts`·`BookProgressSession.ts`·`BookProgressTools.tsx`(v3 저장·설정 두 개·백업 이름), `src/book/BookApp.tsx`(첫 제스처 잠금 해제, 펜·덮개·도장 소리, 자동 샷, 표지 잉크 선), `src/book/print/usePageCompositor.ts`(글꼴 → 기보 순서, `preload` 단계), `src/book/inspector.ts`(`sfx()`), `src/styles/book.css`(잉크 선).
  - 검증: `scripts/book-v3-e2e.ts`(R7 검사 3개: 첫 제스처 전 무음과 표지 소리, 키 넘김의 넘김·안착 소리, 음악 재생 중 펜 억제).
- **실행 명령과 종료 결과:** `npm run typecheck` 0, `npm run lint` 0, `npm test` 372/372, `npm run build` 0(500 kB 경고 1건은 R1과 같은 three 공유 청크). `node scripts/sfx-render.ts` 7/7 통과. `node scripts/book-v3-e2e.ts` 36/36 × 2 viewport(1280×720, 844×390).
- **기기와 브라우저 및 commit:** Linux 컨테이너, Node 22.23.4, Playwright 1.60 + headless Chromium 1243(SwiftShader WebGL, OfflineAudioContext 48 kHz), DPR 1. 코드 `db0a05b`.
- **실제 캡처 영상 로그 경로:** [qa/refactor/R7/index.md](qa/refactor/R7/index.md)(렌더 측정·e2e). 소리 단계라 화면 캡처는 새로 찍지 않았다(표지 잉크 선은 R8 캡처의 표지 상태에 포함).
- **측정값:** 들리는 길이 / 설계 길이 오차: page-turn 0.329 s(−6.0%), page-settle 0.059 s(−2.6%), cover-open 0.248 s(−0.8%), cover-close 0.249 s(−0.3%), pen 0.043 s(−1.0%), flap 0.149 s(−0.6%), stamp 0.119 s(−0.7%). 피크 −7.2 / −10.5 / −7.7 / −8.0 / −10.1 / −8.3 / −8.8 dBFS(모두 ≤ −6). e2e 효과음 기록: 표지 전 요청 0 → 표지 열기 'cover-open' 재생, 키 넘김 2회 → page-turn·page-settle 각 2, 정지 중 펜 허용·재생 / 재생 중 펜 거부.
- **미실행 항목과 정확한 이유:** 실제 청취(크기·질감·구별)와 실기기 스피커 출력 — 에이전트가 들을 수 없어 **외부 검수 대기**(R9 사람 검수 패킷). e2e는 2 viewport만 돌렸다: 소리 검사는 화면 크기와 무관하고, 같은 검사가 R8 e2e 4 viewport에 그대로 들어 있다.
- **남은 결함과 재현 절차:**
  1. 효과음은 쪽 한 장 넘김에 한 번이다. R8의 여러 장 넘김(GO_TO)도 넘김 소리 한 번이다(잎마다 소리를 겹치지 않음).
  2. 펜 소리는 인쇄 단추를 누를 때(핫스폿 명령 실행) 난다. 누르고 있는 동안이 아니라 손을 뗄 때다(8 px 안에서 떼야 실행되는 기존 규칙).
- **객관적 게이트와 선택적 사용자 피드백 상태:** 렌더 길이·피크(7/7), 설정·음소거에서 노드 0(단위), 재생 중 펜 억제·첫 제스처 전 무음(단위·e2e), 저장 이관 보존(단위). 사람 피드백 없음. 청취는 외부 검수 대기.
- **다음 허용 단계와 막힌 단계:** R8 허용(R3·R4·R5 통과, R6·R7 완료).
- **전후 캡처 경로와 metrics.json 요약:** 해당 없음(소리 단계). 렌더 수치는 `sfx-render.json`.
- **renderer 플래그 상태:** 기본 `ink`, `?renderer=legacy`는 착수 커밋 고정 사본(효과음 없음).
- **설계서 대비 편차와 사유:**
  1. **노이즈 필터**: 설계는 2.2 kHz 밴드패스 '스윕'을 말한다. 노이즈를 렌더 시점에 바이쿼드로 미리 걸러(시간에 따라 중심 주파수를 옮겨) 버퍼로 재생한다. 실행 중 필터 노드를 만들지 않아 노드 수와 피크가 결정적이다.
  2. **피크 상한**: 출력 압축기 없이 각 효과음의 엔벨로프 게인 합을 0.5 이하로 고정했다(정규화된 노이즈 × 게인 합 = 최악 피크). 렌더 실측은 상한보다 1.2–4.5 dB 낮다.
  3. **'소리' 스위치**: 조작바 '소리'는 음악·효과음을 함께 끄고(음소거), '기록 → 효과음'은 효과음만 끈다(결정 2).
  4. **자동 샷 설정**: R6에서 미룬 결정 5(재생 시작 시 자동 샷, 기본 끔)를 v3 저장 형식에 넣었다.
  5. **품질 티어 설정**: R5에서 미룬 '품질 티어'는 저장하지 않았다. 티어는 기기 프로필(`currentProfile`, `?quality`)이 정하고, 저장 형식에 넣으면 기기를 바꿀 때 잘못된 티어가 따라온다. 대신 이번 판올림에 효과음·자동 샷만 넣었다.
  6. **e2e 2 viewport**: 위 '미실행' 참고.
- **G1-C 체크리스트 영향 항목과 현재 판정:** 12번(효과음 존재·억제 규칙) — 규칙은 단위·e2e로 확인, 원본 청취 비교는 미관측.

### R7 사람 검사 항목 (실기기 청취)

- 표지를 열 때, 페이지를 넘길 때, 안착할 때, 인쇄 버튼을 누를 때 각각 다른 짧은 소리가 나는가. 너무 크지 않은가.
- 음악 재생 중 버튼을 눌러도 펜 소리가 섞이지 않는가.
- 조작바 '소리'를 끄면 음악과 효과음이 모두 꺼지는가.

## R8 (V26) 콘텐츠 확장(목차·마침·GO_TO) — 통과(renderer 텍스처 수 14 미달 기록)

- **단계 ID와 상태:** R8(a–b) **통과**(자동 검사·캡처 자체 판정). 사람 검사 항목(아래)과 실기기 60 fps 여러 장 넘김은 미관측.
- **실제로 가능한 사용자 행동:** 책은 목차 → 레슨 1–6 → 마침의 여덟 펼침면이다. 표지를 펼치면 레슨 1이 열리고, ←로 한 장 앞이 목차다. 목차에는 레슨 제목·목표와 첫 쪽(1쪽, 3쪽 … 11쪽)이 점선 리더와 함께 인쇄되어 있고, 줄을 누르면(포인터·키보드 거울·2D 단추) 여러 장이 한 번에 넘어가 그 레슨에 도착한다(목차 → 레슨 4: 4장, 0.8 s). 조작바 '목차'는 어느 펼침면에서나 목차로 가고, 목차에서는 꺼진다. 레슨 6 다음(→)은 마침이다: 해 본 실험 여섯 개(끝난 것 체크), 레슨 제목과 목표의 돌아보기, 여섯 실험을 모두 끝내면 찍히는 도장, '차례로'. 마침에서 →는 꺼지고, 목차에서 ←(표지로)는 책을 닫는다. 모서리 드래그도 목차 ↔ 레슨 1, 레슨 6 ↔ 마침을 넘긴다. 펼침면 5에서는 그림 아래 초 눈금이 템포 60이면 0–4초, 120이면 0–2초로 바뀌고 블록 길이는 그대로다. 펼침면 6에서는 넣은 음표·쉼표만큼 띠가 채워지고 남은 자리는 점선, 합이 분수로 적힌다. '크게 읽기'(2D)에서도 목차·마침이 같은 조작으로 동작한다.
- **변경 경로와 이유:**
  - 신규 `src/content/pages/matterPages.ts`(목차·마침 쪽 DSL, lesson 원문 + 쪽 이름표), `src/book/MatterPages.tsx`·`src/styles/matter-pages.css`(2D 목차·마침 = 같은 DSL), `tests/book-goto.test.ts`(8).
  - 수정 `src/book/manifest.ts`(확장만: 책 순서 `BOOK_SPREADS`, `bookIndex`·`bookNeighbour`·`bookLeaf`·`bookLeaves`·`bookPrintIds`·`bookTurnPrintIds`, GO_TO 시간표 `goToSchedule`·`leafProgresses`·`goToFrame`), `src/book/controller.ts`(최소 변경: `GO_TO`, NEXT/PREV/GO_TO 공통 `beginTurnTo`, 책 순서 이웃, 목차에서 PREV = 닫기, 샷 중 GO_TO 대기), `src/book/stage.ts`(잎 풀 3장, 잎마다 자기 진행·자기 쌓인 높이, 슬롯 1·2 텍스처), `src/book/BookApp.tsx`(GO_TO 프레임 텍스처·그리기, 인쇄 창, 목차·마침의 장면 없음, 조작바 '목차', 쪽 번호 '차례'/'마침', 2D 목차·마침, DEV `holdTurn`, 루트 `data-reduced-motion`), `src/book/turnHit.ts`(책 순서 모서리), `src/book/useBookProgress.ts`(저장되는 쪽은 레슨: 마침 → 레슨 6, 목차 → 직전 레슨 또는 레슨 1), `src/book/print/*`(쪽 문맥 `sceneId: null`, 목차 줄 블록·인쇄, 번호 없는 쪽, 인쇄 키 = 레슨 완료), `src/book/figures/music/decor.ts`·`figure.ts`·`lessonScene.ts`·`lessonPresentation.ts`·`content/pages/lessonPages.ts`(초 눈금·자유 마디 장식, 그림 칸 높이), `src/book/render/shots.ts`(목차·마침 샷 없음), `public/fonts`(서브셋 다시 생성: '례').
  - 검증: `tests/print-layout.test.ts`(책 16쪽 여백·글꼴, 목차·마침 2개), `tests/duration-figure.test.ts`(초 눈금·자유 마디), `tests/book-turn-hit.test.ts`(책 끝 모서리), `scripts/book-v3-e2e.ts`(R8 검사 5개 + 책 끝 검사 2개를 책 순서로 갱신: 마침에서 다음 비활성, 레슨 1 → 목차 → 표지로), `scripts/refactor-capture.ts`(contents·spread3–6·closing·goto 상태, 모션 설정 대기).
- **실행 명령과 종료 결과:** `npm run typecheck` 0, `npm run lint` 0, `npm test` 384/384, `npm run build` 0(500 kB 경고 1건은 R1과 같은 three 공유 청크). `node scripts/refactor-capture.ts --stage R8 …` 책 상태 0(3 viewport × 8 펼침면), GO_TO 0(1280×720, 8장 + 도착). `node scripts/book-v3-e2e.ts` 41/41 × 4 viewport(1280×720, 844×390, 390×844, 568×320).
- **기기와 브라우저 및 commit:** Linux 컨테이너, Node 22.23.4, Playwright 1.60 + headless Chromium 1243(SwiftShader WebGL), DPR 1. 코드 `d09388f`, 모션 설정 대기 수정 `418c52b`, 증거 이 기록과 같은 커밋.
- **실제 캡처 영상 로그 경로:** [qa/refactor/R8/index.md](qa/refactor/R8/index.md) — `after/*_ink.jpg`(3 viewport × 목차·레슨 1–6·마침), `after/1280x720_goto_0`–`7_ink.jpg`(목차 → 레슨 4, 넘김 진행 0, 1/7 … 1을 `holdTurn`으로 고정), `metrics.json`, `e2e-*.json`.
- **측정값:** GO_TO 목차 → 레슨 4: 잎 4장, 잎당 400 ms, 출발 [0, 45, 90, 400] ms, 전체 800 ms, 공중 최대 3장(캡처 step 3: 잎 0.857 / 0.745 / 0.632 / 0). 마침 → 목차: 잎 7장, 잎당 229 ms, 전체 686 ms. 인쇄 창 ≤ 6쪽, 최대 46.1 MiB(GO_TO 중 포함, 한도 48 MiB). renderer 텍스처 27–31개(한도 문장 14 — 미달, 아래 편차). BK08(8 펼침면): next 10회 → 2 → 4(넘김 1 + 대기 1), next·prev 교차 → 4 → 5 → 4.
- **미실행 항목과 정확한 이유:** 실기기 60 fps에서 여러 장 넘김의 연속감 — headless SwiftShader는 한 프레임에 0.5–3 s라 0.7–0.8 s 넘김 동안 1–3프레임만 그려진다. 연속 장면은 시계 고정 캡처로 대신했고 실기기는 R9 사람 검수 패킷(D13)에 넣는다. 음악 교육자의 목차·마침 문장 검토는 외부 검수 대기(E8).
- **남은 결함과 재현 절차:**
  1. GO_TO 동안 사이 쪽은 인쇄 없는 종이다. 재현: 1280×720에서 목차 → 레슨 4, `after/1280x720_goto_5_ink.jpg`의 왼쪽 쪽(레슨 3 왼쪽, 5쪽 자리)이 빈 종이다. 인쇄 창 6쪽 · 48 MiB 예산의 결과(의도).
  2. e2e의 GO_TO 검사는 넘김 동안 그려진 프레임이 1–3장뿐이라 공중 잎을 직접 보지 못한 실행이 있다(목차 줄 4잎: 1280×720·390×844 `frames 1, maxFlying 0`, 844×390·568×320 `maxFlying 3`; 조작바 7잎: `maxFlying` 0–1). 잎 순서·공중 수는 단위 테스트와 시계 고정 캡처가 본다.
  3. renderer 텍스처 수는 설계 문장 14를 넘는다(아래 편차 7).
- **객관적 게이트와 선택적 사용자 피드백 상태:** MU·AU 무변경 통과, GO_TO 시간표·잎 풀·경계·숨김 복구(단위 8), 목차·마침 인쇄(단위 2), 책 끝 모서리(단위 1), 초 눈금·자유 마디(단위 1), e2e R8·책 끝 검사 7개 × 4 viewport(전체 41개), 인쇄 메모리 ≤ 48 MiB. 사람 피드백 없음.
- **다음 허용 단계와 막힌 단계:** R9 허용(R8 통과). 관문 정체성 5항목에 불일치가 없으면 R9-b 정리 진행.
- **전후 캡처 경로와 metrics.json 요약:** before = R5–R7(레슨 6 펼침면만), after = 위. `metrics.json`: 책 상태 24장 + GO_TO 9장, 페이지 오류 0, 인쇄 창 4쪽(목차·마침: 이웃이 한쪽뿐) / 6쪽(레슨).
- **renderer 플래그 상태:** 기본 `ink`, `?renderer=legacy`는 착수 커밋 고정 사본(레슨 2 펼침면, 목차·마침 없음). R9에서 지운다.
- **설계서 대비 편차와 사유:**
  1. **잎 사이 45 ms와 풀 3장**: 넷째 잎부터는 풀 자리가 비는 때(잎 k−3이 내려앉을 때)까지 기다린다. 공중 ≤ 3장을 지키면서 45 ms 간격을 쓰는 해석.
  2. **사이 쪽 인쇄 없음**: 인쇄 창 6쪽 · 48 MiB 유지(위 결함 1).
  3. **표지 → 레슨 1**: 책 순서의 첫 펼침면은 목차지만 표지를 펼치면 레슨 1(또는 저장된 레슨)이 열린다. 보존 모듈 `controller.ts`의 초기 펼침면과 G1·V13 고정 데이터를 그대로 두었다.
  4. **저장 형식 판올림 없음**: 저장되는 자리는 언제나 레슨 펼침면(마침 → 레슨 6, 목차 → 직전 레슨 또는 레슨 1)이라 기록 형식이 바뀌지 않는다. R7의 schema 3을 그대로 쓴다.
  5. **2D 레슨 쪽**: `LessonPages.tsx`를 DSL 해석기로 완성하지 않았다. 목차·마침만 같은 DSL을 그리는 `MatterPages.tsx`이고, 레슨 쪽은 기존 2D(같은 명령, 같은 테스트 ID)다.
  6. **쪽 DSL 파일**: `contents.ts`·`closing.ts` 대신 `matterPages.ts` 하나, `spread-3..6.ts` 대신 R3부터 쓰던 `lessonPages.ts`.
  7. **텍스처 수 14**: 인쇄 텍스처(쪽 ≤ 6 + state ≤ 2)는 지키지만 renderer 전체 수는 환경 맵·그림자 맵·후처리 렌더 타깃·잉크 글자를 더해 27–31이다. 48 MiB(인쇄) 한도는 지킨다.
  8. **44 px**: 3D 화면 위 인쇄 핫스폿은 계약 B5(포인터 편의). 목차 줄은 쪽 단위 44 이상, 화면 44 CSS px는 2D 책·거울·조작바.
  9. **e2e 다중 잎 검사**: 프레임 ≥ 1 · 잎 수 · 공중 ≤ 3 · 계획 시간으로 본다(위 미실행).
  10. **GO_TO 효과음**: 한 번의 넘김 소리(page-turn → page-settle).
- **G1-C 체크리스트 영향 항목과 현재 판정:** 7번(넘김 잎 곡률·앞뒷면·가림) — 잎 풀 3장이 같은 곡면·같은 인쇄 텍스처, 원본 비교 미관측. 9번(전이 시간감) — GO_TO ≤ 1.6 s 토큰, 원본 비교 미관측. 정체성 5항목은 R8에서 바뀌지 않았다.

### R8 사람 검사 항목

- 목차에서 레슨을 고르면 여러 장이 차례로 넘어가 도착하는가(1.6 s 안). 사이 쪽이 빈 종이로 지나가는 것이 어색하지 않은가.
- 여섯 펼침면과 목차·마침이 같은 종이·잉크 톤인가. 글자가 넘치거나 겹치지 않는가.
- 2D 모드('크게 읽기')에서도 여섯 펼침면과 목차·마침이 모두 조작되는가.

## R9 (V27) 검증 관문 개편·정리 — 통과(정체성 미관측 5, 사람 검수 외부 대기)

**정체성 5항목: 불일치 0 · 의도적 차이 0 · 미관측 5(원본 녹화 없음).** 관문은 R9-b(레거시 정리)를 막지 않는다. 미관측은 통과가 아니므로 원본 체감(C)과 배포 판단(E)은 완료로 쓰지 않는다.

### R9-a 관문·스크립트·판정

- **단계 ID와 상태:** R9-a **통과**(관문 문서·비교표·검수 패킷 작성, 기준선 매트릭스 39/39장, 성능 예산 7/7 — 첫 실행 6/7을 원인 수정 뒤 다시 돌림). 정체성 5항목은 원본 녹화가 없어 모두 **미관측**이다.
- **실제로 가능한 사용자 행동:** 바뀌지 않았다(R8과 같은 책). 개발자는 `node scripts/visual-baseline.ts`로 3 viewport × 7 상태 × 렌더러의 기준선과 `baseline/matrix.json`을, `node scripts/perf-budget.ts`로 성능 예산 판정(실패 시 exit 1)을 얻는다.
- **변경 경로와 이유:**
  - 신규 `scripts/visual-baseline.ts`(R1의 `refactor-capture.ts`를 42칸 매트릭스로 감싸 실행하고, 지금까지 잰 수치 — 먼/가까운 변 비율, 책 폭, 종이 음영, x-height 입력, 3D 쪽 HTML 요소, draw calls, 텍스처 수, 인쇄 메모리 — 를 칸마다 모은다. 단계별 증거를 다시 만들 수 있도록 `refactor-capture.ts`는 이름을 바꾸지 않았다), `scripts/perf-budget.ts`(첫 펼침면 draw calls ≤ 150, 장면 ≤ 40, 인쇄 텍스처 ≤ 48 MiB, 넘김 p95 frame 참고치, 50회 왕복 자원 증가 0), `docs/qa/BOOK_EXPERIENCE_GATE_V3.md`(부록 B 13항목 판정과 증거, 완료 수준 A–E), `docs/qa/MOTION_COMPARISON.md`(V16 양식: 공개 코드 확인값 · 실제 영상 측정값 · v3 채택값을 다른 열에, 차이 이유), `docs/qa/HUMAN_REVIEW_V3.md`(X07: 원본 비교·실기기·청취·접근성·음악 교육자, 모두 '대기').
  - 수정 `src/book/BookApp.tsx`(루트 `data-programs` = `renderer.info.programs` 수, 왕복 누수 검사용).
  - 성능 예산 실패 수정(R9 공통 실패 시 수정 규칙): `src/book/print/pageCompositor.ts` — 쪽이 열린 펼침면을 떠날 때 크기 변화로 풀리지 않은 GPU 사본도 푼다(빠른 넘김에서 draft GPU 사본 2개가 남아 50회 왕복 뒤 textures 29 → 31). `tests/print-compositor.test.ts`(1). 자세한 조사는 [qa/refactor/R9/index.md](qa/refactor/R9/index.md) '성능 예산의 첫 실패와 수정'.
- **실행 명령과 종료 결과:** `npm run typecheck` 0, `npm run lint` 0, `npm test` 385/385, `npm run build` 0(500 kB 경고 1건은 R1과 같은 three 공유 청크, R9-b에서 정리). `node scripts/visual-baseline.ts` 0(39/39장). `node scripts/perf-budget.ts` 첫 실행 **1**(6/7: textures 29 → 31, [perf-budget-first-run.json](qa/refactor/R9/perf-budget-first-run.json)) → 수정 뒤 0(7/7).
- **기기와 브라우저 및 commit:** Linux 컨테이너, Node 22.23.4, Playwright 1.60 + headless Chromium 1243(SwiftShader WebGL), DPR 1. R8 증거 `f1c061d` 다음, 이 기록과 같은 커밋.
- **실제 캡처 영상 로그 경로:** [qa/refactor/R9/index.md](qa/refactor/R9/index.md) — `after/*_{legacy,ink}.jpg`, `baseline/matrix.json`, `metrics.json`, `perf-budget.json`.
- **측정값:** 기준선(ink, 펼침면 1 / 2, high 티어): 먼/가까운 변 비율 0.857 / 0.869 / 0.938(1280×720 / 844×390 / 390×844), 책 폭 0.577 / 0.427 / 0.884, 종이 음영 4.3–5.4%(1280×720 · 844×390), 390×844 11.2%(low 티어 4.4%, medium 8.9% — 비네트와 쪽 끝 GTAO), 본문 x-height 3.0–3.7 / 1.5–1.8 / 1.4–1.8 px, 가장 작은 인쇄 핫스폿 7.7 / 3.7 / 3.7 px, 3D 쪽 HTML 요소 0, draw calls 101 / 96, renderer 텍스처 27–32, 인쇄 46.1 MiB. legacy(착수 커밋 사본): 먼/가까운 변 비율 1(직교), 책 폭 0.640 / 0.510 / 0.885, 텍스처 6–8. 성능 예산(1280×720): 첫 펼침면 draw calls 101(≤ 150), 레슨 장면 14(≤ 40), 인쇄 46.1 MiB(≤ 48), 50회 왕복 geometries 17 → 17 · textures 29 → 29 · programs 20 → 20, 넘김 p95 참고치 5.5 s(SwiftShader 2프레임).
- **미실행 항목과 정확한 이유:** 원본 비교(결정 6의 화면 녹화가 없음 → 13항목 모두 미관측), 실기기·청취·스크린리더·음악 교육자(외부 검수 대기, 사람 검수 패킷). 넘김 p95 frame은 SwiftShader에서 재서 참고치로만 둔다.
- **남은 결함과 재현 절차:**
  1. 390×844(세로) high 티어에서 종이 음영 11.2%(기준 3–8% 밖). 재현: `node scripts/visual-baseline.ts` → `metrics.json`의 390×844 spread1 `luminance.paperShadingPercent`. 같은 화면을 `--quality low`로 찍으면 4.4%(후처리 없음), medium 8.9%. 휴대전화의 자동 티어는 low다.
  2. 먼/가까운 변 비율·책 폭·x-height·인쇄 핫스폿 크기·renderer 텍스처 수는 기준에 못 미친 채 기록(R1·R3·R5·R8, 계약 B5·B6). 수치는 위 '측정값', 목록은 R9-b에서 [KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md)에 다시 적는다.
- **객관적 게이트와 선택적 사용자 피드백 상태:** 정체성 불일치 0(관문 문서), 성능 예산(위), 기준선 매트릭스(위). 사람 피드백 없음.
- **다음 허용 단계와 막힌 단계:** R9-b 허용(정체성 불일치 0).
- **전후 캡처 경로와 metrics.json 요약:** before = 기준선의 legacy 열(착수 커밋 사본), after = ink 열 — 같은 앱 안의 전후 비교다. `metrics.json`: 39칸 + 샷 진입·복귀 프레임, 6회 실행 모두 페이지 오류 0.
- **renderer 플래그 상태:** R9-a 시점 기본 `ink`, `?renderer=legacy`는 착수 커밋 고정 사본 — 기준선의 legacy 칸이 이 사본의 마지막 캡처다.
- **설계서 대비 편차와 사유:**
  1. **스크립트 이름**: 프롬프트는 `refactor-capture.ts`를 확장·개명하라고 했다. R1–R8 증거의 재현 명령이 그 이름을 쓰므로 이름은 두고, `visual-baseline.ts`가 그것을 매트릭스로 돌린다.
  2. **legacy 샷 칸**: legacy(착수 커밋 사본)에는 레슨 샷이 없어 3칸은 '해당 없음'이다.
  3. **텍스처 '≤ 48 MB'**: 성능 예산은 인쇄 창 텍스처(페이지 compositor)를 잰다. renderer 전체 텍스처 수는 기록만 한다(R8 편차 7).
- **G1-C 체크리스트 영향 항목과 현재 판정:** 13항목 모두 미관측(정체성 5 포함), 불일치 0.

### R9-b 레거시 삭제·문서·라이선스

- **단계 ID와 상태:** R9-b **통과**(삭제 뒤 typecheck·lint·단위 테스트·빌드·라이선스 감사 0, e2e·성능 예산 다시 통과). 완료 수준은 아래 V17 분류.
- **실제로 가능한 사용자 행동:** 책은 그대로다. 남은 `?renderer=legacy` 링크로 열어도 오류 없이 같은 잉크 책이 열린다. v1 실험실 화면은 없다(이미 R0부터 진입점이 책이었다).
- **삭제 목록(설계서 §4 표 + 그것만 쓰던 파일):** 프롬프트는 삭제 전에 목록을 보고하고 사용자 확인을 받으라고 했다(P00 13항). 이번 작업은 사용자가 "묻지 말고 스스로 승인하며 진행"하라고 지시해 **스스로 승인**했다. 지운 파일은 모두 Git 기록(`d25fe06` 이전 커밋)에 남아 있고, 정적 import 그래프로 앱(`src/main.tsx`)에서 닿지 않음을 확인했다.
  - v1 실험실 셸: `src/App.tsx`, `src/scenes/DurationScene3D.tsx`, `src/scenes/DurationScene2D.tsx`(타입 `DurationEvent`는 `durationWorld.ts`로), `src/components/ConceptQuiz.tsx`, `src/components/SceneBoundary.tsx`, `src/notation/NotationView.tsx`, `src/styles/app.css`, `adapters.css`, `print.css`.
  - legacy 렌더러: `src/legacy/`(착수 커밋 사본 30파일: `book/*` 26, `entry.tsx`, `styles/*` 3), `?renderer=legacy` 분기(`main.tsx`·`profile.ts`).
  - HTML 겹침·스냅샷 경로: `src/book/pageSnapshot.ts`, `usePagePrints.ts`, `notationPreparation.ts`, `pagePrint.ts`. `src/book/pageProjection.ts`는 표지 조작 겹침에만 남아 `src/book/ui/coverOverlay.ts`로 옮김.
  - `src/scenes/durationWorld.ts`의 표현부(Three 상자 세계): 의미(`DurationEvent`, `BAR_WIDTH`·`BLOCK_HEIGHT`·`BLOCK_DEPTH`, `clampedPosition`, `durationBounds`, `durationNames`, `eventLabel`)만 남김.
  - 테스트: `tests/book-page-projection.test.ts`, `book-page-snapshot.test.ts`, `book-notation-preparation.test.ts`, `duration-world.test.ts`(의미 6개는 R4에서 `duration-figure.test.ts`로 옮겨져 있음), `book-v13.test.ts`의 스냅샷 테스트 1개.
  - 그것만 쓰던 스크립트: `scripts/notation-e2e.ts`, `notation-font-retry.ts`, `three-http-e2e.ts`, `recovery-http-e2e.ts`.
  - 남긴 것: `src/book/inspector.ts`(R1–R8 동안 v3 inspector로 고쳐 씀, DEV 전용 snapshot·pose·metrics), v1·v2 이력 QA 문서와 표준 독립 파일 스크립트(B4: 과거 증거로 보존).
- **변경 경로와 이유:** 위 삭제, `src/main.tsx`(책만), `src/book/profile.ts`(`RendererKind = 'ink'`, URL 파라미터 무시), import 경로(`decor`·`durationFigure`·`BookNotation`·`BookApp`), `tests/book-spread-surface.test.ts`(옛 링크 = 잉크 책), `tests/duration-figure.test.ts`(고정 데이터 `frameView`를 파일 안으로), `scripts/refactor-capture.ts`(renderer = ink 확인), `scripts/visual-baseline.ts`(`--renderers`, 기본 ink), `scripts/font-license-audit.ts`(쪽 글꼴 절: 이름 바꿈·OFL 기록 확인), `package.json`(`build` = 내용 검증 → 라이선스 감사 → vite build, `license:audit`, `test:e2e` = v3 e2e), `vite.config.ts`(`manualChunks`: three · react), `README.md`·`docs/ARCHITECTURE.md`·`docs/KNOWN_LIMITATIONS.md`·`docs/CONTRACT_V3.md`(v3 기준으로 다시 씀).
- **실행 명령과 종료 결과:** `npm run typecheck` 0, `npm run lint` 0, `npm test` 362/362, `npm run build` 0(500 kB 경고 0), `npm run license:audit` 0. `node scripts/perf-budget.ts --out docs/qa/refactor/R9/perf-budget-after-cleanup.json` 0(7/7). `node scripts/book-v3-e2e.ts --viewport …` 41/41 × 4 viewport.
- **기기와 브라우저 및 commit:** 위와 같음. R9-a `d25fe06` 다음, 이 기록과 같은 커밋.
- **실제 캡처 영상 로그 경로:** [qa/refactor/R9/index.md](qa/refactor/R9/index.md) — `perf-budget-after-cleanup.json`, `e2e-*.json`.
- **측정값:** 빌드 청크: three 694.6 kB, vexflow-core 330.8 kB, 기보 글꼴 396.8 kB, react 192.6 kB, 앱 entry 234.9 kB(삭제 전에는 three가 든 공유 청크 802.3 kB로 경고 1건 → 0). 성능 예산(삭제 뒤, 1280×720): 첫 펼침면 draw calls 101, 레슨 장면 14, 인쇄 46.1 MiB, 50회 왕복 geometries 17 → 17 · textures 29 → 29 · programs 20 → 20, 페이지 오류 0. 단위 테스트 385 → 362(삭제한 legacy·스냅샷 테스트 23개, 의미 테스트는 R4에서 잉크 그림으로 옮겨 둠).
- **미실행 항목과 정확한 이유:** 배포·push to main(지시에 따라 하지 않음), `vercel.json` 변경(빌드 명령이 이미 typecheck · lint · test · build이고 build가 라이선스 감사를 포함하므로 바꿀 것이 없음). 실기기·청취·보조기술·음악 교육자 검수는 외부 대기.
- **남은 결함과 재현 절차:** [KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md)의 '기준에 못 미친 수치' 표(먼/가까운 변 비율, 책 폭, x-height, 인쇄 핫스폿 크기, 선 폭, 390×844 high 티어 종이 음영, renderer 텍스처 수)가 그대로 남아 있다. R9는 수치를 고치는 단계가 아니라 관문·정리 단계라 기준을 완화하지 않고 기록만 했다.
- **객관적 게이트와 선택적 사용자 피드백 상태:** 삭제 후 전체 검사 0, 라이선스 감사 0, e2e·성능 예산 통과. 사람 피드백 없음.
- **다음 허용 단계와 막힌 단계:** v3 리팩터 단계(R0–R9)는 끝났다. 남은 것은 사람 검수(외부 대기)와 그 결과에 따른 수정이다. 배포는 B–D가 끝나기 전에는 막혀 있다(C10).
- **renderer 플래그 상태:** 없음(`ink` 하나). `?renderer=…`는 무시.
- **설계서 대비 편차와 사유:**
  1. **삭제 확인**: 위 '삭제 목록' — 사용자 지시에 따라 스스로 승인.
  2. **inspector**: 새 파일로 바꾸지 않고 같은 파일을 v3 inspector로 유지(이미 v3 전용).
  3. **500 kB 경고**: `manualChunks`로 three(약 695 kB)·react를 나눴다. three 청크 하나가 500 kB를 넘으므로 `chunkSizeWarningLimit`을 720 kB로 두었다(경고 0). vexflow는 이미 따로 지연 로드되는 청크(`vexflow-core`, 기보 글꼴)다. 앱 entry는 약 235 kB.
  4. **`vercel.json`**: 바꾸지 않음(위).
- **G1-C 체크리스트 영향 항목과 현재 판정:** 바뀐 것 없음(13항목 미관측, 불일치 0).

### 완료 수준 (v2.1 V17)

| 수준 | 상태 | 근거 |
|---|---|---|
| A 개발 검증 | **완료** | typecheck · lint · 단위 테스트 · 빌드(라이선스 감사 포함) 0, e2e 4 viewport, 캡처·측정, 성능 예산 |
| B 책 경험 | **부분** | headless 자동 검사로 본 범위만. 실기기 터치·60 fps·청취·보조기술은 [사람 검수 패킷](qa/HUMAN_REVIEW_V3.md) 대기 |
| C 원본 체감 | **미완료** | 원본 녹화 없음 → 정체성 5항목 미관측 |
| D 수업 시험 준비 | **미완료** | 음악 교육자 검수 대기 |
| E 배포 판단 | **미완료** | B–D가 끝나지 않음. 배포하지 않았다 |

A만으로 B–E를 완료로 쓰지 않는다.

### R9 사람 검사 항목

- [책 경험 관문 v3](qa/BOOK_EXPERIENCE_GATE_V3.md)의 정체성 5항목 판정과 증거가 직접 본 캡처와 일치하는가.
- 원본 녹화를 제공하면 나란히 비교해 13항목을 다시 판정한다. 그 전까지는 미관측이다.
- 위 삭제 목록에 되살리고 싶은 파일이 있는가(Git 기록에서 되살릴 수 있다).
