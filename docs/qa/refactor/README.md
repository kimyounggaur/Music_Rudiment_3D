# v3 리팩토링 캡처·증거

각 단계의 전후 캡처와 수치를 이 폴더에 둔다. 판정과 보고는 [BUILD_STATUS_V3.md](../../BUILD_STATUS_V3.md)에 있다.

## 폴더 구조

~~~text
docs/qa/refactor/
  README.md              이 파일
  R1/ … R9/              단계(서브세션은 R3-d/처럼 따로)
    index.md             캡처 표, metrics 요약, before 링크
    before/              직전 통과 단계의 after에 대한 링크(복사 금지). R1의 before는 ?renderer=legacy 캡처
    after/               이번 단계 캡처 {W}x{H}_{state}_{renderer}.png
    metrics.json         캡처별 수치
~~~

## 캡처·증거 규약(REFACTOR_PROMPTS_V3 §5)

| 항목 | 규약 |
|---|---|
| 폴더 | `docs/qa/refactor/R{n}/before/`, `after/`, `metrics.json`, `index.md`. 서브세션은 `R3-d/`처럼 폴더를 나눈다. before는 직전 통과 단계의 after를 **링크**한다(복사 금지) |
| viewport | 1280×720(DPR 1), 844×390, 390×844. R1·R6 단위 테스트는 5 viewport(844×390, 667×375, 568×320, 390×844, 360×640) |
| 상태 | cover, opening50, spread1, turn50, spread2, shot(R6+), 2d. `window.__bookInspector.pose()`로 만들고 rAF 두 번 뒤 촬영 |
| renderer | legacy, ink 둘 다(R9 전). 파일명 `{W}x{H}_{state}_{renderer}.png` |
| metrics.json | 캡처마다 `farNearRatio`, `bookWidthRatio`, `coverCenterErrorPx`, `luminance{left,right,spine}`, `camera`, 단계별 추가 수치(`htmlPageElements`, `xHeightPx`, `draftMs`, `drawCalls`, `textures`, `textureMB`) |
| 측정 방법 | 레이아웃 수치는 inspector `snapshot().layout`. 휘도는 PNG를 페이지에 data URL로 올려 2D 캔버스 getImageData(새 의존성 없음). x-height·선 폭은 400% 확대 캡처에서 사람이 재고 수치를 적는다 |
| 연속 캡처 | 등장(12프레임), 샷(진입 4·복귀 3), 분할 보간(3), 다중 잎(8). 프레임 간격을 파일명에 ms로 적는다 |
| 금지 | 원본 Every Joule 화면을 저장소에 넣지 않는다(사용자 녹화는 저장소 밖 `docs/reference/original/` 경로만 기록). baseline 자동 갱신으로 실패를 덮지 않는다. headless 캡처를 실기기 통과로 쓰지 않는다 |

---



## 명령

두 스크립트 모두 dev 서버(`npm run dev`, 기본 `http://127.0.0.1:4173/`)가 떠 있어야 하며 `--base`로 바꿀 수 있다. 실행 중에 `src/`를 고치면 HMR이 페이지를 다시 읽어 측정이 깨지므로 끝날 때까지 손대지 않는다.

| 용도 | 명령 |
|---|---|
| 단계 캡처·metrics | `node scripts/refactor-capture.ts --stage R{n} --phase after --renderer ink [--quality high]`<br>`node scripts/refactor-capture.ts --stage R{n} --phase after --renderer legacy --states spread1,turn50,spread2,2d` |
| v3 e2e (R3부터) | `node scripts/book-v3-e2e.ts --viewport 1280x720 --out docs/qa/refactor/R{n}/e2e-1280x720.json` (844x390, 390x844도 같은 방식) |
| 잉크 그림 연속 캡처·선 폭 (R4부터) | `node scripts/figure-capture.ts --viewport 1280x720 --out docs/qa/refactor/R{n}` (등장 12프레임, 글로, 분할 0/120/240 ms, 선 폭 FWHM과 400% 크롭, 장면 draw call) |
| 조작바·도장·플랩 (R5부터) | `node scripts/refactor-capture.ts --stage R{n} --phase after --renderer ink --quality high --states cover,spread1,stamp,flap,turn50,spread2`(왼쪽 쪽 2배 크롭, 플랩 0/120/240 ms, 모든 캡처에 `extra.chrome` = 조작바 rect·책 교차·바깥 버튼)<br>`node scripts/refactor-capture.ts --stage R{n} --phase after --renderer ink --quality high --viewports 568x320 --states cover,spread1,spread2`(압축형 조작바) |
| 레슨 샷 (R6부터) | `node scripts/refactor-capture.ts --stage R{n} --phase after --renderer ink --quality high --viewports 1280x720,844x390 --states spread1,shot,shotHotspot,spread2,shotTurn`(진입 0/300/600/900 ms, 유지, 복귀 0/300/600 ms — 샷 시계 고정, 복귀 뒤 카메라와 읽기 포즈 차이, 샷 중 인쇄 조작, 샷 중 ArrowRight → 복귀 뒤 넘김) |
| 효과음 렌더 (R7부터) | `node scripts/sfx-render.ts --out docs/qa/refactor/R{n}/sfx-render.json`(브라우저 OfflineAudioContext 48 kHz로 앱의 `synthSfx.ts`를 렌더: 들리는 길이 −60 dBFS 위, 피크 dBFS, 설계 길이 ±10%·피크 ≤ −6 dBFS 판정) |
| 책 한 권·GO_TO (R8부터) | `node scripts/refactor-capture.ts --stage R{n} --phase after --renderer ink --quality high --viewports 1280x720,844x390,390x844 --states spread1,spread2,contents,spread3,spread4,spread5,spread6,closing`(목차·레슨 3–6·마침은 동작 줄이기로 넘겨 도착한 뒤 찍음, 캡처마다 인쇄 창 통계 `extra.printStats`)<br>`node scripts/refactor-capture.ts --stage R{n} --phase after --renderer ink --quality high --viewports 1280x720 --states goto`(목차 → 레슨 4 GO_TO 8장: 넘김 진행 0, 1/7 … 1을 `holdTurn`으로 고정하고 그려진 뒤 잎별 진행 `extra.frames[].leaves`를 읽음, 넘김 중 인쇄 창 `extra.printStatsDuring`) |
