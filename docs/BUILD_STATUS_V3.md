# v3 리팩토링 진행 기록 (BUILD_STATUS_V3)

설계: [REFACTOR_DESIGN_V3.md](REFACTOR_DESIGN_V3.md) · 실행 계약: [IMPLEMENTATION_CONTRACT_V3.md](IMPLEMENTATION_CONTRACT_V3.md) · 개정 조항: [CONTRACT_V3.md](CONTRACT_V3.md) · 캡처 규약: [qa/refactor/README.md](qa/refactor/README.md)

"코드를 작성함", "자동 검사가 통과함", "사람이 승인함"을 구분한다. headless 캡처는 실기기 통과가 아니고, 무음 캡처는 청취 증거가 아니다.

## 단계 지도

| ID | 지도 번호 | 이름 | 상태 |
|---|---|---|---|
| R0 | V3-00 | 계약 개정 | 통과 |
| R1 | V19 | 원근 카메라 리그 | 통과 |
| R2 | V20 | 종이·조명·환경·후처리 | 통과 |
| R3 | V21 | 캔버스 페이지 인쇄 시스템 | 미착수 |
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
