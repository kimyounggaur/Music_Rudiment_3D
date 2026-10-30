# R9 검증 관문 개편·정리 — 기준선 매트릭스, 성능 예산, 레거시 삭제

**정체성 5항목: 불일치 0 · 의도적 차이 0 · 미관측 5(원본 녹화 없음).** 관문 판정은 [책 경험 관문 v3](../../BOOK_EXPERIENCE_GATE_V3.md)에 있다. 미관측은 통과가 아니다.

| 항목 | 내용 |
|---|---|
| 단계 | R9 (V27) a–b, 설계서 §6 R9 · 부록 B, 프롬프트 §3.9 |
| before | [R8](../R8/index.md) — 책 한 권(목차 · 레슨 1–6 · 마침), `?renderer=legacy` 비교 경로와 v1 실험실 셸이 남아 있음 |
| after (R9-a) | `after/*_{legacy,ink}.jpg` — 기준선 매트릭스 3 viewport × {cover, opening50, spread1, turn50, spread2, shot, 2d} × {legacy, ink} = 42칸(legacy에는 레슨 샷이 없어 3칸은 해당 없음, 39장), [baseline/matrix.json](baseline/matrix.json), [perf-budget.json](perf-budget.json) |
| after (R9-b) | 레거시 삭제 뒤 [perf-budget-after-cleanup.json](perf-budget-after-cleanup.json), [e2e-1280x720.json](e2e-1280x720.json) · [844x390](e2e-844x390.json) · [390x844](e2e-390x844.json) · [568x320](e2e-568x320.json) |
| 명령 | `node scripts/visual-baseline.ts`(R9-a: legacy·ink, R9-b부터 `--renderers ink`가 기본)<br>`node scripts/perf-budget.ts [--out …]`<br>`node scripts/book-v3-e2e.ts --viewport W×H --out docs/qa/refactor/R9/e2e-W×H.json` |
| 환경 | Linux 컨테이너, Node 22.23.4, Playwright 1.60, headless Chromium 1243(SwiftShader WebGL), DPR 1, 외부 요청 차단 |

headless 캡처·시간 측정은 실기기 통과가 아니다. 기준선은 **같은 앱의 전후 비교**에만 쓰며 원본과 픽셀 일치를 목표로 하지 않는다(V16).

## 판정 — R9-a 관문·스크립트

| 기준 (설계서 §6 R9 · 프롬프트 R9-a) | 결과 | 근거 |
|---|---|---|
| 부록 B 13항목을 일치 / 의도적 차이 / 불일치 / 미관측으로 판정, 증거 연결 | **완료** | [BOOK_EXPERIENCE_GATE_V3.md](../../BOOK_EXPERIENCE_GATE_V3.md) — 13항목 모두 **미관측**(원본 녹화 없음), 항목마다 v3 자체 기준 측정과 증거 경로 |
| 정체성 5항목 불일치 0 | **통과(미관측 5)** | 불일치 0이므로 R9-b를 막지 않는다. 미관측은 통과가 아니어서 C(원본 체감)·E(배포 판단)는 미완료 |
| 원본 녹화(결정 6)로 같은 시퀀스 나란히 비교 | **미관측** | 녹화가 제공되지 않았다. `docs/reference/original/`에 두면 관문 문서의 절차대로 다시 판정 |
| 모션 비교표(V16: 공개 코드 확인값 · 실제 영상 측정값 · v3 채택값, 차이 이유) | **완료** | [MOTION_COMPARISON.md](../../MOTION_COMPARISON.md) — '실제 영상 측정값' 열은 모두 '미측정'(추정으로 채우지 않음) |
| 사람 검수 패킷(X07) | **외부 검수 대기** | [HUMAN_REVIEW_V3.md](../../HUMAN_REVIEW_V3.md) — 원본 비교 13, 실기기 14, 청취 8, 접근성 7, 음악 교육자 8항목, 모두 '대기' |
| `visual-baseline.ts`: 3 viewport × 7 상태 × {legacy, ink}, 지금까지의 모든 수치 | **통과** | [baseline/matrix.json](baseline/matrix.json) 39/39장(해당 없음 3칸). 칸마다 먼/가까운 변 비율·책 폭·종이 음영·x-height 입력·3D 쪽 HTML 요소·draw calls·텍스처 수·인쇄 메모리 |
| `perf-budget.ts`: draw calls ≤ 150, 장면 ≤ 40, 텍스처 ≤ 48 MB, 넘김 p95 ≤ 33 ms(참고), 50회 왕복 증가 0, 실패 시 exit 1 | **통과(첫 실행 실패 → 원인 수정 뒤 7/7)** | [perf-budget.json](perf-budget.json) — 아래 '성능 예산' 표 |

## 성능 예산의 첫 실패와 수정

첫 실행([perf-budget-first-run.json](perf-budget-first-run.json))은 관문 7개 중 6개를 통과하고 **'textures after 50 round trips' 29 → 31로 실패**했다(exit 1). 기준을 바꾸지 않고 원인을 찾았다.

- **조사.** WebGL `createTexture`/`deleteTexture`와 텍스처 크기를 기록하는 탐침으로 같은 왕복을 다시 돌렸다. 늘어난 2개는 **768×1130 draft 쪽 텍스처**(펼침면 3의 두 쪽)였다. 첫 왕복에서 31이 되고 50회까지 31 그대로라 왕복마다 쌓이는 누수는 아니었다. 다만 펼침면 3을 settled 인쇄가 끝나기 전에 떠나면(빠른 넘김) 그 쪽이 보여 주던 draft의 GPU 사본이 이웃이 된 뒤에도 남았다. settled 인쇄가 끝난 뒤 떠나면 크기 변화(1280 → 768)로 GPU 사본이 풀리므로, **GPU 상주량이 독자가 얼마나 빨리 넘기는지에 따라 달랐다.**
- **수정.** `src/book/print/pageCompositor.ts`: 쪽이 열린 펼침면을 떠날 때(want settled → draft) 크기 변화로 이미 풀리지 않았다면 그 GPU 사본을 푼다. 캔버스는 그대로 두고, 다시 보일 때 올린다(settled → draft 교체 때와 같은 경로). 단위 테스트 `tests/print-compositor.test.ts` 'v3 R9: a page leaving the open spread releases its GPU copy once, whether or not its settled print landed'.
- **재실행.** 수정 뒤 [perf-budget.json](perf-budget.json): 관문 **7/7 통과** — 50회 왕복 뒤 textures 29 → 29, geometries 17 → 17, programs 20 → 20, 첫 펼침면 draw calls 101, 레슨 장면 14, 인쇄 46.1 MiB, 페이지 오류 0. 넘김 p95(참고)는 SwiftShader 프레임 2장뿐이라 5.5 s로, 실기기 값이 아니다.

## 기준선에서 다시 잰 수치 (설계 기준 대비, ink · 펼침면 1 → 2)

R1–R8의 단계별 수치는 그 단계의 화면에서 쟀다. R5에서 조작바가 생겨 책 fit이 바뀌었으므로 아래가 지금 책의 값이다. 기준을 채우지 못한 값은 그대로 적는다([KNOWN_LIMITATIONS](../../../KNOWN_LIMITATIONS.md)).

| 수치 | 기준 | 1280×720 | 844×390 | 390×844 | 판정 |
|---|---|---|---|---|---|
| 먼/가까운 변 비율 | 0.86–0.92 | 0.857 | 0.869 | 0.938 | 일부 미달(1280×720 하한 아래, 390×844 상한 위) |
| 책 폭 비율 | 0.70–0.85 | 0.577 | 0.427 | 0.884 | 미달(조작바·safe area 안에 쌓인 쪽까지 맞추는 fit) |
| 종이 음영(네 여백 표본의 폭) | 3–8% | 4.3 / 4.3% | 5.0 / 5.4% | 11.2 / 11.2% | 390×844 밖 — 아래 |
| 본문 x-height | ≥ 7 px / ≥ 5.5 px | 3.0 / 3.7 px | 1.5 / 1.8 px | 1.4 / 1.8 px | 미달(계약 B6) |
| 가장 작은 인쇄 핫스폿 | — (계약 B5) | 7.7 / 9.7 px | 3.7 / 4.7 px | 3.7 / 4.6 px | B5: 포인터 편의, 44 px는 2D 책·거울·조작바 |
| 3D 쪽 HTML 요소 | 0 | 0 | 0 | 0 | 통과 |
| draw calls(첫 펼침면) | ≤ 150 | 101 / 96 | 101 / 96 | 101 / 96 | 통과 |
| renderer 텍스처 수 | (R8 문장 ≤ 14) | 27–32(모든 ink 캡처) | | | 기록(R8 편차 7) |
| 인쇄 메모리 | ≤ 48 MiB | 46.1 MiB | 46.1 MiB | 46.1 MiB | 통과 |

**390×844 종이 음영.** high 티어 캡처에서 책이 화면 폭의 88%를 차지해 바깥 여백 표본(쪽 가장자리에서 2.5%)이 화면 가장자리의 비네트와 쪽 끝 GTAO로 어두워진다. 같은 펼침면을 티어만 바꿔 다시 쟀다(탐침, 저장소에 남기지 않음): low(후처리 없음) **4.4%**, medium(GTAO 없음) 8.9%, high 11.2%. 1280×720은 3.7 / 4.2 / 4.3%. 휴대전화는 자동으로 low 티어라 실제 세로 화면의 값은 low 쪽이지만, high 값이 기준 밖이라는 사실은 그대로 기록한다. R2 기록의 '과도기 HTML 글자 탓' 설명은 틀렸다(R3 이후 HTML이 없는데도 R5 10.9%, R9 11.2%).

## 판정 — R9-b 레거시 삭제·문서·라이선스

| 기준 (프롬프트 R9-b) | 결과 | 근거 |
|---|---|---|
| R9-a에서 정체성 불일치 0 확인 뒤 시작 | **충족** | 위 R9-a 판정 |
| 삭제 목록 보고와 사용자 확인(P00 13항) | **스스로 승인** | 사용자가 "묻지 말고 스스로 승인하며 진행"하라고 지시했다. 목록은 [BUILD_STATUS_V3](../../../BUILD_STATUS_V3.md) R9-b '삭제 목록'에 있고, 지운 파일은 모두 Git 기록(`d25fe06` 이전)에 남아 있다. 앱 진입점에서 정적 import로 닿지 않는 파일만 지웠다(삭제 뒤 닿지 않는 `src` 파일: 테스트 전용 `src/lesson/assessment.ts` — 보호 영역이라 둠 — 와 타입 선언 `vite-env.d.ts`뿐) |
| `main.tsx`가 책만 마운트, `profile.ts` renderer = `'ink'`, URL 파라미터는 오류 없이 무시 | **통과** | `src/main.tsx`(책 `entry.tsx`만), `tests/book-spread-surface.test.ts`(`?renderer=legacy` → ink), `scripts/refactor-capture.ts`(renderer = ink 확인) |
| typecheck · lint · test · build 전부 exit 0 | **통과** | `npm run typecheck` 0, `npm run lint` 0, `npm test` 362/362(삭제와 함께 지운 테스트 23개: 385 → 362), `npm run build` 0(경고 0), `npm run license:audit` 0 |
| 빌드 500 kB 경고: three/vexflow 분리 청크로 해소하거나 사유 기록 | **해소** | `vite.config.ts` `manualChunks`(three · react). three 694.6 kB 한 덩어리라 `chunkSizeWarningLimit` 720 kB, 경고 0. vexflow는 이미 따로 지연 로드(`vexflow-core` 330.8 kB, 기보 글꼴 396.8 kB). 앱 entry 234.9 kB |
| README · ARCHITECTURE · vercel.json · 한글 폰트 OFL · 라이선스 감사를 빌드 조건으로 | **통과(vercel.json 변경 없음)** | README(지원 범위, 실행, 3D 기본·2D, 첫 표지 행동, renderer 플래그 제거), ARCHITECTURE(render/print/figures/ui/sfx 계층, 프레임 파이프라인 §5.2). 한글 쪽 글꼴 OFL은 R3부터 `public/licenses/book-page-fonts.txt`. `npm run build` = 내용 검증 → `license:audit` → vite build. `vercel.json`의 빌드 명령은 이미 typecheck · lint · test · build라 바꿀 것이 없었다 |
| KNOWN_LIMITATIONS: 미관측, 실기기·청취·보조기술 미검수, 저티어 축소 | **통과** | [KNOWN_LIMITATIONS](../../../KNOWN_LIMITATIONS.md) — 미관측(원본), 미검수(실기기·청취·보조기술·교육), 기준에 못 미친 수치(R9 기준선 값), 품질 티어 표 |
| 최종 diff에 사용자 변경·비밀값·대용량 영상·무관한 생성 파일 없음 | **통과** | R8 증거 `f1c061d` 이후(R9-a + R9-b) 추가 90 · 삭제 51 · 수정 22 · 이름 바꿈 1 파일. 가장 큰 파일은 e2e의 넘김 비교 PNG(약 0.56 MB, R3–R8과 같은 종류의 증거). 영상·압축 파일·`dist/`·`output/`·의존성 0, 키·토큰·비밀번호 패턴 0. 원격 브랜치 끝이 이 작업의 앞 커밋(`d25fe06`)이라 사용자 변경이 섞이지 않았다 |
| 삭제 뒤 e2e·성능 예산 | **통과** | [perf-budget-after-cleanup.json](perf-budget-after-cleanup.json) 7/7(50회 왕복 textures 29 → 29), e2e 41/41 × 4 viewport(1280×720, 844×390, 390×844, 568×320) — 아래 표 |
| 완료 수준(V17) | A 완료 · B 부분 · C/D/E 미완료 | [BOOK_EXPERIENCE_GATE_V3](../../BOOK_EXPERIENCE_GATE_V3.md) '완료 수준'. A만으로 B–E를 완료로 쓰지 않는다 |

## 측정

### 기준선 매트릭스 (3 viewport × 7 상태 × legacy·ink)

| viewport | 상태 | legacy | ink |
|---|---|---|---|
| 1280x720 | cover | [1280x720_cover_legacy.jpg](after/1280x720_cover_legacy.jpg) | [1280x720_cover_ink.jpg](after/1280x720_cover_ink.jpg) |
| 1280x720 | opening50 | [1280x720_opening50_legacy.jpg](after/1280x720_opening50_legacy.jpg) | [1280x720_opening50_ink.jpg](after/1280x720_opening50_ink.jpg) |
| 1280x720 | spread1 | [1280x720_spread1_legacy.jpg](after/1280x720_spread1_legacy.jpg) | [1280x720_spread1_ink.jpg](after/1280x720_spread1_ink.jpg) |
| 1280x720 | turn50 | [1280x720_turn50_legacy.jpg](after/1280x720_turn50_legacy.jpg) | [1280x720_turn50_ink.jpg](after/1280x720_turn50_ink.jpg) |
| 1280x720 | spread2 | [1280x720_spread2_legacy.jpg](after/1280x720_spread2_legacy.jpg) | [1280x720_spread2_ink.jpg](after/1280x720_spread2_ink.jpg) |
| 1280x720 | shot | 해당 없음 | [1280x720_shot_ink.jpg](after/1280x720_shot_ink.jpg) |
| 1280x720 | 2d | [1280x720_2d_legacy.jpg](after/1280x720_2d_legacy.jpg) | [1280x720_2d_ink.jpg](after/1280x720_2d_ink.jpg) |
| 844x390 | cover | [844x390_cover_legacy.jpg](after/844x390_cover_legacy.jpg) | [844x390_cover_ink.jpg](after/844x390_cover_ink.jpg) |
| 844x390 | opening50 | [844x390_opening50_legacy.jpg](after/844x390_opening50_legacy.jpg) | [844x390_opening50_ink.jpg](after/844x390_opening50_ink.jpg) |
| 844x390 | spread1 | [844x390_spread1_legacy.jpg](after/844x390_spread1_legacy.jpg) | [844x390_spread1_ink.jpg](after/844x390_spread1_ink.jpg) |
| 844x390 | turn50 | [844x390_turn50_legacy.jpg](after/844x390_turn50_legacy.jpg) | [844x390_turn50_ink.jpg](after/844x390_turn50_ink.jpg) |
| 844x390 | spread2 | [844x390_spread2_legacy.jpg](after/844x390_spread2_legacy.jpg) | [844x390_spread2_ink.jpg](after/844x390_spread2_ink.jpg) |
| 844x390 | shot | 해당 없음 | [844x390_shot_ink.jpg](after/844x390_shot_ink.jpg) |
| 844x390 | 2d | [844x390_2d_legacy.jpg](after/844x390_2d_legacy.jpg) | [844x390_2d_ink.jpg](after/844x390_2d_ink.jpg) |
| 390x844 | cover | [390x844_cover_legacy.jpg](after/390x844_cover_legacy.jpg) | [390x844_cover_ink.jpg](after/390x844_cover_ink.jpg) |
| 390x844 | opening50 | [390x844_opening50_legacy.jpg](after/390x844_opening50_legacy.jpg) | [390x844_opening50_ink.jpg](after/390x844_opening50_ink.jpg) |
| 390x844 | spread1 | [390x844_spread1_legacy.jpg](after/390x844_spread1_legacy.jpg) | [390x844_spread1_ink.jpg](after/390x844_spread1_ink.jpg) |
| 390x844 | turn50 | [390x844_turn50_legacy.jpg](after/390x844_turn50_legacy.jpg) | [390x844_turn50_ink.jpg](after/390x844_turn50_ink.jpg) |
| 390x844 | spread2 | [390x844_spread2_legacy.jpg](after/390x844_spread2_legacy.jpg) | [390x844_spread2_ink.jpg](after/390x844_spread2_ink.jpg) |
| 390x844 | shot | 해당 없음 | [390x844_shot_ink.jpg](after/390x844_shot_ink.jpg) |
| 390x844 | 2d | [390x844_2d_legacy.jpg](after/390x844_2d_legacy.jpg) | [390x844_2d_ink.jpg](after/390x844_2d_ink.jpg) |

### 기준선 수치 (spread1: legacy → ink)

| viewport | far/near | 책 폭 비율 | 종이 음영 % | 3D 쪽 HTML 요소 | 본문 x-height px | draw calls | renderer 텍스처 | 인쇄 MiB |
|---|---|---|---|---|---|---|---|---|
| 1280x720 | 1 → 0.8569 | 0.6396 → 0.5774 | 0.11 → 4.33 | — → 0 | — → 2.99 | — → 101 | 6 → 30 | — → 46.1 |
| 844x390 | 1 → 0.8694 | 0.5101 → 0.4265 | 12.56 → 5.01 | — → 0 | — → 1.45 | — → 101 | 6 → 30 | — → 46.1 |
| 390x844 | 1 → 0.9377 | 0.885 → 0.8835 | 13.81 → 11.15 | — → 0 | — → 1.42 | — → 101 | 6 → 30 | — → 46.1 |

### 성능 예산 ([perf-budget.json](perf-budget.json), 1280x720)

| 항목 | 값 | 한도 | 판정 |
|---|---|---|---|
| first spread draw calls | `101` | ≤ 150 | 통과 |
| lesson scene draw calls | `14` | ≤ 40 | 통과 |
| print textures (page compositor window) | `46.1` | ≤ 48 MiB | 통과 — 6 pages: 2 settled, 4 draft, 2 state layers |
| turn p95 frame interval | `5500` | ≤ 33 ms | 참고(관문 아님) — headless SwiftShader reference only (2 frames); real devices are a human check |
| geometries after 50 round trips | `{"before": 17, "after": 17}` | growth 0 | 통과 |
| textures after 50 round trips | `{"before": 29, "after": 29}` | growth 0 | 통과 |
| programs after 50 round trips | `{"before": 20, "after": 20}` | growth 0 | 통과 |
| page errors | `0` | 0 | 통과 |

### 성능 예산 — 레거시 삭제 뒤 ([perf-budget-after-cleanup.json](perf-budget-after-cleanup.json), 1280x720)

| 항목 | 값 | 한도 | 판정 |
|---|---|---|---|
| first spread draw calls | `101` | ≤ 150 | 통과 |
| lesson scene draw calls | `14` | ≤ 40 | 통과 |
| print textures (page compositor window) | `46.1` | ≤ 48 MiB | 통과 — 6 pages: 2 settled, 4 draft, 2 state layers |
| turn p95 frame interval | `6283` | ≤ 33 ms | 참고(관문 아님) — headless SwiftShader reference only (2 frames); real devices are a human check |
| geometries after 50 round trips | `{"before": 17, "after": 17}` | growth 0 | 통과 |
| textures after 50 round trips | `{"before": 29, "after": 29}` | growth 0 | 통과 |
| programs after 50 round trips | `{"before": 20, "after": 20}` | growth 0 | 통과 |
| page errors | `0` | 0 | 통과 |

### e2e 1280x720 — 레거시 삭제 뒤 41/41 통과 ([e2e-1280x720.json](e2e-1280x720.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| R7: no effect before the first gesture; opening the cover sounds cover-open | 통과 | `{"before": 0, "effects": ["cover-open:ok"]}` |
| R4: entry ends drawn and standing; scene ≤ 40 draw calls, ≤ 6,000 segments | 통과 | `{"lift": 1, "reveal": 1, "segments": 572, "calls": {"total": 53, "withoutScene": 44, "scene": 9, "figure": {"segments": 572, "ink": 480, "dashed": 0, "accent…` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio", "close-look"]` |
| R5: one toolbar outside the book (≤ 56 px, in view, no other outside buttons) | 통과 | `{"visible": "true", "height": 53, "inViewport": true, "outside": [], "buttons": ["book-prev:44", "book-contents:44", "book-next:44", "sound:44", "still:44", …` |
| R5: the book never sits under the toolbar (bookBounds ∩ toolbar = 0) | 통과 | `{"overlap": 0, "bounds": {"left": 270.48737526649865, "right": 1009.5126247335014, "top": 208.51998058470386, "bottom": 644.5793630044461}, "toolbar": {"top"…` |
| R5: questions are printed on the page without a flap | 통과 | `{"radios": 6}` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| R5: three right answers stamp the printed page | 통과 | `{"stampBefore": false, "stampMirror": true}` |
| R5: answer flap lifts 0 → 110° on its hinge (stage clock 0/120/240 ms); explanations printed beneath | 통과 | `{"at0": 0, "at120": 55, "at240": 110, "explained": true}` |
| R5: a press on the standing paper folds the flap down | 통과 | `{"sheetPoint": {"x": 480.96889762695264, "y": 502.7214641131089}}` |
| R5: records dialog is modal, the book ignores arrows, focus returns to 기록 | 통과 | `{"inDialog": true, "spread": "spread-1", "phase": "spreadIdle", "returned": "records"}` |
| R7: a keyboard turn sounds page-turn, then page-settle | 통과 | `{"effects": ["pen", "stamp", "flap", "flap", "page-turn", "page-settle", "page-turn", "page-settle"]}` |
| R5: ArrowRight / ArrowLeft turn the book with the toolbar in place | 통과 | `{"keyNext": true, "keyPrev": true}` |
| R6: 가까이 보기 takes the camera into the figure (user-started shot) | 통과 | `{"camera": "shot", "label": "돌아오기", "moved": 8.131}` |
| R7: pen on a printed control, but not while music plays | 통과 | `{"pens": [{"allowed": true, "played": true}, {"allowed": false, "played": false}]}` |
| R6: a printed control works during the shot | 통과 | `{"control": "play-upper", "pressed": "page-2:listen:play-upper", "playing": true}` |
| R6: the same button returns exactly to the reading pose (≤ 1e-6) | 통과 | `{"maxDifference": 0}` |
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 4, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 22, "stateAfter": 23}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 5.4, "draftMeasures": [0.5, 0.2, 0.5, 0.2, 0.5, 0.1, 0.7, 0.3, 5.4, 0.2, 0.4, 0.3, 0.5, 0.3, 0.4, 0.3, 0.4, 0.7, 0.9, 0.4, 0.7, 0.3, 0.8, 0.2,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 26, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.218, "max": 122}, "bestOffsetPx": {"dx": 0, "dy": 0}, "corre…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 27, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "31", "rootRevision": "31"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5/R8: next is disabled on the last spread (the closing) | 통과 | `{"disabled": true}` |
| R8: the closing prints the six experiments and its stamp slot, and leads back to the contents | 통과 | `{"headings": ["마침", "돌아보기"], "stamps": [{"id": "book", "stamped": false, "rect": {"x": 834, "y": 681.25, "w": 96, "h": 96}, "center": {"x": 903.5125894312389…` |
| R8: 목차 (toolbar) flies seven leaves from the closing to the contents, at most three in the air, planned ≤ 1.6 s | 통과 | `{"frames": 1, "leaves": 7, "maxFlying": 0, "wallMs": 0, "plannedMs": 686, "note": "wallMs includes SwiftShader frame time (0.5–3 s per frame)"}` |
| R8: a printed contents row turns four leaves to lesson 4 (pointer) | 통과 | `{"row": "page-14:toc:spread-4", "frames": 1, "leaves": 4, "maxFlying": 0, "wallMs": 0, "plannedMs": 800, "contentsButton": {"prev": "표지로", "contents": true}}` |
| R8: the contents in the mirror jump too (keyboard / assistive path); on the contents prev reads 표지로 and 목차 is off | 통과 | `{"mirrorJump": true, "mirrorLanded": true, "prev": "표지로", "contents": true}` |
| R8 BK08: ten quick nexts turn once plus one queued (2 → 4); next then prev comes back (4 → 5 → 4) | 통과 | `{"afterTen": "spread-4", "afterReversal": "spread-4"}` |
| R5/R8: prev from lesson 1 opens the contents; prev on the contents (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |

### e2e 390x844 — 레거시 삭제 뒤 41/41 통과 ([e2e-390x844.json](e2e-390x844.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| R7: no effect before the first gesture; opening the cover sounds cover-open | 통과 | `{"before": 0, "effects": ["cover-open:ok"]}` |
| R4: entry ends drawn and standing; scene ≤ 40 draw calls, ≤ 6,000 segments | 통과 | `{"lift": 1, "reveal": 1, "segments": 572, "calls": {"total": 53, "withoutScene": 44, "scene": 9, "figure": {"segments": 572, "ink": 480, "dashed": 0, "accent…` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio", "close-look"]` |
| R5: one toolbar outside the book (≤ 56 px, in view, no other outside buttons) | 통과 | `{"visible": "true", "height": 53, "inViewport": true, "outside": [], "buttons": ["book-prev:44", "book-contents:44", "book-next:44", "sound:44", "still:44", …` |
| R5: the book never sits under the toolbar (bookBounds ∩ toolbar = 0) | 통과 | `{"overlap": 0, "bounds": {"left": 22.713981953676868, "right": 367.28601804632314, "top": 303.22035392632796, "bottom": 511.32300369214613}, "toolbar": {"top…` |
| R5: questions are printed on the page without a flap | 통과 | `{"radios": 6}` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| R5: three right answers stamp the printed page | 통과 | `{"stampBefore": false, "stampMirror": true}` |
| R5: answer flap lifts 0 → 110° on its hinge (stage clock 0/120/240 ms); explanations printed beneath | 통과 | `{"at0": 0, "at120": 55, "at240": 110, "explained": true}` |
| R5: a press on the standing paper folds the flap down | 통과 | `{"sheetPoint": {"x": 118.88403430307963, "y": 444.5901131478764}}` |
| R5: records dialog is modal, the book ignores arrows, focus returns to 기록 | 통과 | `{"inDialog": true, "spread": "spread-1", "phase": "spreadIdle", "returned": "records"}` |
| R7: a keyboard turn sounds page-turn, then page-settle | 통과 | `{"effects": ["pen", "stamp", "flap", "flap", "page-turn", "page-settle", "page-turn", "page-settle"]}` |
| R5: ArrowRight / ArrowLeft turn the book with the toolbar in place | 통과 | `{"keyNext": true, "keyPrev": true}` |
| R6: 가까이 보기 takes the camera into the figure (user-started shot) | 통과 | `{"camera": "shot", "label": "돌아오기", "moved": 17.204}` |
| R7: pen on a printed control, but not while music plays | 통과 | `{"pens": [{"allowed": true, "played": true}, {"allowed": false, "played": false}]}` |
| R6: a printed control works during the shot | 통과 | `{"control": "play-upper", "pressed": "page-2:listen:play-upper", "playing": true}` |
| R6: the same button returns exactly to the reading pose (≤ 1e-6) | 통과 | `{"maxDifference": 0}` |
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 5, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 21, "stateAfter": 22}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 5.2, "draftMeasures": [0.5, 0.2, 0.4, 0.2, 1.3, 1.8, 0.4, 0.2, 0.5, 0.2, 0.5, 0.2, 0.7, 0.3, 0.9, 0.2, 0.5, 0.3, 1.3, 0.3, 0.8, 4.5, 1.3, 0.3,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 26, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.261, "max": 47}, "bestOffsetPx": {"dx": 0, "dy": 0}, "correl…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 30, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "31", "rootRevision": "31"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5/R8: next is disabled on the last spread (the closing) | 통과 | `{"disabled": true}` |
| R8: the closing prints the six experiments and its stamp slot, and leads back to the contents | 통과 | `{"headings": ["마침", "돌아보기"], "stamps": [{"id": "book", "stamped": false, "rect": {"x": 834, "y": 681.25, "w": 96, "h": 96}, "center": {"x": 324.5511143638857…` |
| R8: 목차 (toolbar) flies seven leaves from the closing to the contents, at most three in the air, planned ≤ 1.6 s | 통과 | `{"frames": 2, "leaves": 7, "maxFlying": 3, "wallMs": 783, "plannedMs": 686, "note": "wallMs includes SwiftShader frame time (0.5–3 s per frame)"}` |
| R8: a printed contents row turns four leaves to lesson 4 (pointer) | 통과 | `{"row": "page-14:toc:spread-4", "frames": 2, "leaves": 4, "maxFlying": 3, "wallMs": 1083, "plannedMs": 800, "contentsButton": {"prev": "표지로", "contents": true}}` |
| R8: the contents in the mirror jump too (keyboard / assistive path); on the contents prev reads 표지로 and 목차 is off | 통과 | `{"mirrorJump": true, "mirrorLanded": true, "prev": "표지로", "contents": true}` |
| R8 BK08: ten quick nexts turn once plus one queued (2 → 4); next then prev comes back (4 → 5 → 4) | 통과 | `{"afterTen": "spread-4", "afterReversal": "spread-4"}` |
| R5/R8: prev from lesson 1 opens the contents; prev on the contents (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |

### e2e 568x320 — 레거시 삭제 뒤 41/41 통과 ([e2e-568x320.json](e2e-568x320.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| R7: no effect before the first gesture; opening the cover sounds cover-open | 통과 | `{"before": 0, "effects": ["cover-open:ok"]}` |
| R4: entry ends drawn and standing; scene ≤ 40 draw calls, ≤ 6,000 segments | 통과 | `{"lift": 1, "reveal": 1, "segments": 572, "calls": {"total": 53, "withoutScene": 44, "scene": 9, "figure": {"segments": 572, "ink": 480, "dashed": 0, "accent…` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio", "close-look"]` |
| R5: one toolbar outside the book (≤ 56 px, in view, no other outside buttons) | 통과 | `{"visible": "true", "height": 41, "inViewport": true, "outside": [], "buttons": ["book-prev:36", "book-contents:36", "book-next:36", "sound:36", "still:36", …` |
| R5: the book never sits under the toolbar (bookBounds ∩ toolbar = 0) | 통과 | `{"overlap": 0, "bounds": {"left": 137.2936209988995, "right": 430.70637900110046, "top": 90.26355321973216, "bottom": 263.1088447038236}, "toolbar": {"top": …` |
| R5: questions are printed on the page without a flap | 통과 | `{"radios": 6}` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| R5: three right answers stamp the printed page | 통과 | `{"stampBefore": false, "stampMirror": true}` |
| R5: answer flap lifts 0 → 110° on its hinge (stage clock 0/120/240 ms); explanations printed beneath | 통과 | `{"at0": 0, "at120": 55, "at240": 110, "explained": true}` |
| R5: a press on the standing paper folds the flap down | 통과 | `{"sheetPoint": {"x": 220.5699658864267, "y": 204.31555599607663}}` |
| R5: records dialog is modal, the book ignores arrows, focus returns to 기록 | 통과 | `{"inDialog": true, "spread": "spread-1", "phase": "spreadIdle", "returned": "records"}` |
| R7: a keyboard turn sounds page-turn, then page-settle | 통과 | `{"effects": ["pen", "stamp", "flap", "flap", "page-turn", "page-settle", "page-turn", "page-settle"]}` |
| R5: ArrowRight / ArrowLeft turn the book with the toolbar in place | 통과 | `{"keyNext": true, "keyPrev": true}` |
| R6: 가까이 보기 takes the camera into the figure (user-started shot) | 통과 | `{"camera": "shot", "label": "돌아오기", "moved": 9.047}` |
| R7: pen on a printed control, but not while music plays | 통과 | `{"pens": [{"allowed": true, "played": true}, {"allowed": false, "played": false}]}` |
| R6: a printed control works during the shot | 통과 | `{"control": "play-upper", "pressed": "page-2:listen:play-upper", "playing": true}` |
| R6: the same button returns exactly to the reading pose (≤ 1e-6) | 통과 | `{"maxDifference": 0}` |
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 6, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 22, "stateAfter": 23}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 3.2, "draftMeasures": [0.7, 0.3, 3.2, 0.3, 0.5, 1, 0.5, 0.2, 0.6, 0.3, 0.6, 0.4, 0.8, 0.2, 0.6, 0.4, 0.7, 0.2, 0.8, 0.2, 0.8, 0.2, 0.8, 0.3, 0…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 26, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 0.946, "max": 61}, "bestOffsetPx": {"dx": 0, "dy": 0}, "correl…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 31, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "31", "rootRevision": "31"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5/R8: next is disabled on the last spread (the closing) | 통과 | `{"disabled": true}` |
| R8: the closing prints the six experiments and its stamp slot, and leads back to the contents | 통과 | `{"headings": ["마침", "돌아보기"], "stamps": [{"id": "book", "stamped": false, "rect": {"x": 834, "y": 681.25, "w": 96, "h": 96}, "center": {"x": 390.1902478087833…` |
| R8: 목차 (toolbar) flies seven leaves from the closing to the contents, at most three in the air, planned ≤ 1.6 s | 통과 | `{"frames": 3, "leaves": 7, "maxFlying": 3, "wallMs": 1767, "plannedMs": 686, "note": "wallMs includes SwiftShader frame time (0.5–3 s per frame)"}` |
| R8: a printed contents row turns four leaves to lesson 4 (pointer) | 통과 | `{"row": "page-14:toc:spread-4", "frames": 3, "leaves": 4, "maxFlying": 1, "wallMs": 567, "plannedMs": 800, "contentsButton": {"prev": "표지로", "contents": true}}` |
| R8: the contents in the mirror jump too (keyboard / assistive path); on the contents prev reads 표지로 and 목차 is off | 통과 | `{"mirrorJump": true, "mirrorLanded": true, "prev": "표지로", "contents": true}` |
| R8 BK08: ten quick nexts turn once plus one queued (2 → 4); next then prev comes back (4 → 5 → 4) | 통과 | `{"afterTen": "spread-4", "afterReversal": "spread-4"}` |
| R5/R8: prev from lesson 1 opens the contents; prev on the contents (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |

### e2e 844x390 — 레거시 삭제 뒤 41/41 통과 ([e2e-844x390.json](e2e-844x390.json))

| 검사 | 결과 | 요약 |
|---|---|---|
| no HTML page elements in 3D | 통과 | `{"pages": 0}` |
| R7: no effect before the first gesture; opening the cover sounds cover-open | 통과 | `{"before": 0, "effects": ["cover-open:ok"]}` |
| R4: entry ends drawn and standing; scene ≤ 40 draw calls, ≤ 6,000 segments | 통과 | `{"lift": 1, "reveal": 1, "segments": 572, "calls": {"total": 53, "withoutScene": 44, "scene": 9, "figure": {"segments": 572, "ink": 480, "dashed": 0, "accent…` |
| mirror h1 takes page focus | 통과 | `{"heading": "같은 끝, 다른 시작"}` |
| mirror keeps 2D test ids | 통과 | `["play-upper", "play-lower", "pause-resume-audio", "stop-audio", "close-look"]` |
| R5: one toolbar outside the book (≤ 56 px, in view, no other outside buttons) | 통과 | `{"visible": "true", "height": 53, "inViewport": true, "outside": [], "buttons": ["book-prev:44", "book-contents:44", "book-next:44", "sound:44", "still:44", …` |
| R5: the book never sits under the toolbar (bookBounds ∩ toolbar = 0) | 통과 | `{"overlap": 0, "bounds": {"left": 242.0015741974302, "right": 601.9984258025698, "top": 108.43684126567757, "bottom": 320.2497315991948}, "toolbar": {"top": …` |
| R5: questions are printed on the page without a flap | 통과 | `{"radios": 6}` |
| mirror radio answers the quiz | 통과 | `{"checked": true, "feedback": "두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다."}` |
| pointer press on a printed radio answers | 통과 | `{"pressed": "page-1:q:attacks:1-4"}` |
| R5: three right answers stamp the printed page | 통과 | `{"stampBefore": false, "stampMirror": true}` |
| R5: answer flap lifts 0 → 110° on its hinge (stage clock 0/120/240 ms); explanations printed beneath | 통과 | `{"at0": 0, "at120": 55, "at240": 110, "explained": true}` |
| R5: a press on the standing paper folds the flap down | 통과 | `{"sheetPoint": {"x": 344.19591434320466, "y": 249.28034245127583}}` |
| R5: records dialog is modal, the book ignores arrows, focus returns to 기록 | 통과 | `{"inDialog": true, "spread": "spread-1", "phase": "spreadIdle", "returned": "records"}` |
| R7: a keyboard turn sounds page-turn, then page-settle | 통과 | `{"effects": ["pen", "stamp", "flap", "flap", "page-turn", "page-settle", "page-turn", "page-settle"]}` |
| R5: ArrowRight / ArrowLeft turn the book with the toolbar in place | 통과 | `{"keyNext": true, "keyPrev": true}` |
| R6: 가까이 보기 takes the camera into the figure (user-started shot) | 통과 | `{"camera": "shot", "label": "돌아오기", "moved": 8.991}` |
| R7: pen on a printed control, but not while music plays | 통과 | `{"pens": [{"allowed": true, "played": true}, {"allowed": false, "played": false}]}` |
| R6: a printed control works during the shot | 통과 | `{"control": "play-upper", "pressed": "page-2:listen:play-upper", "playing": true}` |
| R6: the same button returns exactly to the reading pose (≤ 1e-6) | 통과 | `{"maxDifference": 0}` |
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 6, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 21, "stateAfter": 22}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 4.4, "draftMeasures": [0.9, 0.3, 0.5, 0.2, 0.4, 0.2, 0.5, 0.2, 0.6, 0.2, 0.6, 0.2, 0.6, 4.4, 0.7, 0.3, 0.6, 0.3, 0.6, 0.3, 0.6, 0.3, 0.7, 0.2,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 26, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.19, "max": 87.3}, "bestOffsetPx": {"dx": 0, "dy": 0}, "corre…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 29, "phases": ["preparingTurn", "turningForward", "settling"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "31", "rootRevision": "31"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5/R8: next is disabled on the last spread (the closing) | 통과 | `{"disabled": true}` |
| R8: the closing prints the six experiments and its stamp slot, and leads back to the contents | 통과 | `{"headings": ["마침", "돌아보기"], "stamps": [{"id": "book", "stamped": false, "rect": {"x": 834, "y": 681.25, "w": 96, "h": 96}, "center": {"x": 552.0262114377953…` |
| R8: 목차 (toolbar) flies seven leaves from the closing to the contents, at most three in the air, planned ≤ 1.6 s | 통과 | `{"frames": 2, "leaves": 7, "maxFlying": 2, "wallMs": 1417, "plannedMs": 686, "note": "wallMs includes SwiftShader frame time (0.5–3 s per frame)"}` |
| R8: a printed contents row turns four leaves to lesson 4 (pointer) | 통과 | `{"row": "page-14:toc:spread-4", "frames": 2, "leaves": 4, "maxFlying": 3, "wallMs": 1033, "plannedMs": 800, "contentsButton": {"prev": "표지로", "contents": true}}` |
| R8: the contents in the mirror jump too (keyboard / assistive path); on the contents prev reads 표지로 and 목차 is off | 통과 | `{"mirrorJump": true, "mirrorLanded": true, "prev": "표지로", "contents": true}` |
| R8 BK08: ten quick nexts turn once plus one queued (2 → 4); next then prev comes back (4 → 5 → 4) | 통과 | `{"afterTen": "spread-4", "afterReversal": "spread-4"}` |
| R5/R8: prev from lesson 1 opens the contents; prev on the contents (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |
