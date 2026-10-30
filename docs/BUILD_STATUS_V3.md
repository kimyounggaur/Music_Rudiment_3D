# v3 리팩토링 진행 기록 (BUILD_STATUS_V3)

설계: [REFACTOR_DESIGN_V3.md](REFACTOR_DESIGN_V3.md) · 실행 계약: [IMPLEMENTATION_CONTRACT_V3.md](IMPLEMENTATION_CONTRACT_V3.md) · 개정 조항: [CONTRACT_V3.md](CONTRACT_V3.md) · 캡처 규약: [qa/refactor/README.md](qa/refactor/README.md)

"코드를 작성함", "자동 검사가 통과함", "사람이 승인함"을 구분한다. headless 캡처는 실기기 통과가 아니고, 무음 캡처는 청취 증거가 아니다.

## 단계 지도

| ID | 지도 번호 | 이름 | 상태 |
|---|---|---|---|
| R0 | V3-00 | 계약 개정 | 통과 |
| R1 | V19 | 원근 카메라 리그 | 통과 |
| R2 | V20 | 종이·조명·환경·후처리 | 미착수 |
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
