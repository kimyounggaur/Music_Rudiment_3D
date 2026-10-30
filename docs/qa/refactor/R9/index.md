# R9 검증 관문 개편·정리 — 기준선 매트릭스, 성능 예산, 레거시 삭제

**정체성 5항목: 불일치 0 · 의도적 차이 0 · 미관측 5(원본 녹화 없음).** 관문 판정은 [책 경험 관문 v3](../../BOOK_EXPERIENCE_GATE_V3.md)에 있다. 미관측은 통과가 아니다.

| 항목 | 내용 |
|---|---|
| 단계 | R9 (V27) a–b, 설계서 §6 R9 · 부록 B, 프롬프트 §3.9 |
| before | [R8](../R8/index.md) — 책 한 권(목차 · 레슨 1–6 · 마침), `?renderer=legacy` 비교 경로와 v1 실험실 셸이 남아 있음 |
| after (R9-a) | `after/*_{legacy,ink}.jpg` — 기준선 매트릭스 3 viewport × {cover, opening50, spread1, turn50, spread2, shot, 2d} × {legacy, ink} = 42칸(legacy에는 레슨 샷이 없어 3칸은 해당 없음, 39장), [baseline/matrix.json](baseline/matrix.json), [perf-budget.json](perf-budget.json) |
| after (R9-b) | 레거시 삭제 뒤의 성능 예산·e2e(R9-b에서 이 표에 더함) |
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
