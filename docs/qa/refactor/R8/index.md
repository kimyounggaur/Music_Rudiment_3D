# R8 콘텐츠 확장(목차 · 레슨 6 · 마침, GO_TO) — 캡처와 측정

| 항목 | 내용 |
|---|---|
| 단계 | R8 (V26) a–b, 설계서 §6 R8, 프롬프트 §3.8 |
| before | [R7](../R7/index.md)·[R6](../R6/index.md) — 레슨 펼침면 6개만(첫 펼침면 이전 = 표지, 마지막 = 레슨 6), 조작바 '목차' 비활성 |
| after (ink) | `after/*_ink.jpg` — 3 viewport(1280×720, 844×390, 390×844) × 목차·레슨 1–6·마침, 1280×720 목차 → 레슨 4 GO_TO 8장(`goto_0`–`goto_7`) + 도착 |
| 명령 | `node scripts/refactor-capture.ts --stage R8 --phase after --renderer ink --quality high --viewports 1280x720,844x390,390x844 --states spread1,spread2,contents,spread3,spread4,spread5,spread6,closing`<br>`node scripts/refactor-capture.ts --stage R8 --phase after --renderer ink --quality high --viewports 1280x720 --states goto`<br>`node scripts/book-v3-e2e.ts --viewport W×H --out docs/qa/refactor/R8/e2e-W×H.json` (1280×720, 844×390, 390×844, 568×320) |
| 환경 | Linux 컨테이너, Node 22.23.4, Playwright 1.60, headless Chromium 1243(SwiftShader WebGL), DPR 1, 외부 요청 차단 |

headless 캡처는 실기기 통과가 아니다. 목차·레슨 3–6·마침은 동작 줄이기(reduced motion)로 빠르게 넘어가 찍었고, GO_TO 연속 장면은 넘김 진행을 inspector로 0, 1/7, … 1에 고정해(`holdTurn`) 찍었다.

## 무엇이 바뀌었나

- **책 한 권.** 책 순서는 목차 → 레슨 1–6 → 마침이다(`BOOK_SPREADS`, 쪽 ID `page-1`…`page-16`). 레슨만 다루는 기존 함수(G1·V13 고정 데이터와 저장 형식)는 그대로 두고, 책 순서 함수(`bookIndex`·`bookNeighbour`·`bookLeaf`·`bookLeaves`·`bookPrintIds`)를 더했다. 표지를 펼치면 레슨 1이 열리고, 그 앞 펼침면(←)이 목차, 목차에서 ←(표지로)는 책을 닫는다. 마지막은 마침이며 그다음(→)은 비활성이다. 모서리 드래그도 책 순서를 따른다.
- **목차.** 레슨 제목 6개와 첫 쪽 번호가 점선 리더와 함께 인쇄되고, 줄 전체가 인쇄 핫스폿이다. 줄을 누르면(포인터·거울·2D 단추) 그 레슨으로 여러 장을 넘겨 간다. 끝난 레슨은 번호 앞에 체크가 인쇄된다(학습 상태에서 파생, 저장 안 함). 조작바 '목차'는 어디서나 목차로 간다.
- **GO_TO 다중 잎.** 잎 n장은 45 ms 간격으로 떠나고, 공중에는 최대 3장(stage의 잎 풀 3개)이며, 4번째 잎은 첫 잎이 내려앉은 뒤 그 자리를 다시 쓴다. 잎마다 min(1120, 1600/n) ms라 전체는 1.6 s를 넘지 않는다(목차 → 레슨 4는 4장, 0.8 s). 잎과 쪽은 같은 인쇄 텍스처를 나눠 쓴다. 인쇄 창은 넘김 동안에도 6쪽(출발 펼침면, 첫 잎의 먼 면, 마지막 잎의 가까운 면, 도착 펼침면)이라 그 사이를 지나가는 쪽은 인쇄 없는 종이다.
- **마침.** 왼쪽: '마침', 레슨 제목, 해 본 실험 6개(끝난 것 체크). 오른쪽: 돌아보기(레슨 제목과 목표 — `content/lesson.ts` 원문 그대로), 여섯 실험을 모두 끝내면 찍히는 도장, '차례로'(목차로). 목차·마침은 쪽 번호 없는 앞뒤 면이다.
- **2D.** 목차·마침은 같은 페이지 DSL을 DOM으로 그리는 `MatterPages.tsx`로 2D 책에서도 같은 명령(GO_TO)을 쓴다.
- **그림.** 펼침면 5: 레인 아래 초 눈금 — 템포 60에서 0–4초, 120에서 0–2초로 잉크 글자만 바뀌고 블록 길이는 그대로. 펼침면 6: 자유 마디 — 넣은 음표·쉼표만큼 채워진 띠와 남은 자리 점선, 합계 분수. (펼침면 3의 1/2 가이드선과 펼침면 4의 면 없는 점선 쉼표는 R4부터 있었다.)

## 판정

| 기준 (설계서 §6 R8 · 프롬프트 §3.8) | 결과 | 근거 |
|---|---|---|
| MU01–08 · AU01–07 전부 통과(기존 테스트가 장면 3–6 의미를 덮음) | **통과** | `npm test` 384/384. MU: `tests/domain.test.ts`·`lesson.test.ts`·`book-v13.test.ts`·`duration-world.test.ts`·`duration-figure.test.ts`, AU: `tests/audio.test.ts`·`audio-transport.test.ts`·`book-audio-ownership.test.ts` — R8은 이 파일들의 기존 줄을 바꾸지 않았다(`duration-figure.test.ts`에 R8 장식 테스트 1개 추가만) |
| BK08(next 10회 · prev 교차)을 책 한 권(8 펼침면)으로 재실행 | **통과** | e2e 'R8 BK08: ten quick nexts turn once plus one queued (2 → 4); next then prev comes back (4 → 5 → 4)' — 4 viewport 모두 ten nexts → spread-4, next·prev 교차 → spread-4 |
| 목차 → 레슨 4 다중 잎 이동 연속 캡처(8장, 1280×720) | **통과** | 아래 'GO_TO 연속 캡처' 8장(`goto_0`–`goto_7`) + 도착. 잎 4장, 공중 최대 3장, 넷째 잎은 첫 잎이 내려앉은 뒤 그 풀 자리(슬롯 0)를 다시 쓴다 |
| GO_TO: 잎 수 n = 목표까지 펼침면 수, 잎 사이 45 ms, 잎당 min(1120, 1600/n) ms, 전체 ≤ 1.6 s, 공중 ≤ 3장 | **통과** | `tests/book-goto.test.ts` 'R8: the GO_TO schedule staggers leaves by 45 ms, never flies more than three, and ends within 1.6 s'(n = 1…7), 'R8: GO_TO turns n leaves in one turn (≤ 1.6 s) and lands on the target', e2e 'R8: 목차 (toolbar) flies seven leaves …'·'R8: a printed contents row turns four leaves to lesson 4 (pointer)' |
| 경계 guard · 중간 NEXT는 대기 · 숨김 중단 뒤 복구 | **통과** | `tests/book-goto.test.ts` 'R8: GO_TO guards — same spread, unknown spread, held drag, closing book; PREV on contents closes', 'R8: hiding the page mid-jump recovers on the departed spread …'. 대기열은 NEXT/PREV와 같은 `beginTurnTo` 경로(한 칸 대기) |
| 잎 풀 3장, 잎과 쪽이 같은 compositor 텍스처 | **통과** | `tests/book-goto.test.ts` 'R8: a GO_TO frame shows the stacks under its flying leaves and uses one pool slot per leaf', `stage.ts` 잎 풀(슬롯 0의 텍스처 = 넘김 텍스처, 슬롯 1·2 = `turnFront1/2`·`turnBack1/2`, 모두 compositor의 쪽 텍스처) |
| 쌓인 쪽 높이가 8 펼침면에서 단조 | **통과** | `tests/book-goto.test.ts` 'R8: stack heights stay monotonic over eight spreads' |
| 목차: 레슨 제목 6개 + 쪽수 인쇄, 줄 = `goto` 핫스폿, 조작바 '목차' = GO_TO('contents') | **통과** | `tests/print-layout.test.ts` 'v3 R8: the contents print a row per lesson (plus the closing) that jumps there …'(제목 = `getScene().title`, 쪽 '1쪽'…'11쪽', 줄 높이 ≥ 44 단위, 넘침 0), e2e 'R8: the contents in the mirror jump too …', 캡처 `*_contents_ink.jpg` |
| 장면 3–6 그림: 합산 가이드선 · 쉼표 비움 구간 · 템포 눈금 · 자유 마디 | **통과** | 3·4는 R4(`tests/duration-figure.test.ts` 의미 6개), 5·6은 R8 'v3 R8 decor: the seconds ruler follows the tempo (blocks keep their length); the free bar fills as far as the notes reach'. 보조 잉크는 모두 그림 하나의 선분 예산 안(e2e 'scene ≤ 40 draw calls, ≤ 6,000 segments') |
| 마침: 인쇄 문장은 lesson.ts에 있는 것만 | **통과** | `src/content/pages/matterPages.ts`(레슨 제목·장면 제목·목표 = `content/lesson.ts`, 나머지는 쪽 이름표 '마침'·'해 본 실험'·'돌아보기'·'차례로'), `tests/print-layout.test.ts` 'v3 R8: the closing lists the six experiments, stamps only when all are complete, and leads back to the contents' |
| 프리페치: 현재 ± 1 펼침면 인쇄, 그림은 현재만 | **통과** | `tests/book-goto.test.ts` 'R8: a GO_TO prints its far end before it starts, still six pages; a neighbour turn keeps current ± 1'. 그림은 레슨 펼침면에서만, 목차·마침은 장면 없음(`host.clear`) — 활성 장면 ≤ 1(`tests/book-scene-host.test.ts`) |
| 저장: 기존 `spread-1/2` 값 유효, 이관 | **통과(판올림 없음)** | 저장되는 자리는 언제나 레슨 펼침면이다(마침 → 레슨 6, 목차 → 직전 레슨 또는 레슨 1). 그래서 기록 형식이 바뀌지 않아 R7의 schema 3을 그대로 쓴다 — 아래 '설계와 다르게 한 것'. `tests/book-progress.test.ts`·`book-progress-v3.test.ts` 무변경 통과 |
| print-layout 테스트: 모든 쪽 44 px · 줄바꿈 | **통과** | `tests/print-layout.test.ts`의 쪽 전체 검사(여백·글꼴·넘침)가 이제 책 16쪽을 돈다. 화면 위 44 CSS px는 계약 B5대로 2D 책·거울·조작바가 맡는다 |
| 2D(크게 읽기)에서 여섯 펼침면 + 목차 + 마침이 같은 조작 | **통과(부분 전환)** | 목차·마침은 쪽 DSL을 DOM으로 그리는 `MatterPages.tsx`(같은 GO_TO), 레슨 쪽은 기존 `LessonPages.tsx`(같은 `LessonCommand`). `LessonPages`를 DSL 해석기로 완성하지는 않았다 — 아래 |
| 인쇄 메모리 ≤ 48 MB | **통과** | 아래 텍스처 표: 인쇄 창 ≤ 6쪽, 최대 46.1 MiB(GO_TO 중 포함) |
| `renderer.info.memory.textures` ≤ 14 | **미달(기록)** | 27–31개. 인쇄 텍스처(쪽 ≤ 6 + state ≤ 2)는 8개 이하지만 환경 맵·그림자 맵·후처리 렌더 타깃·잉크 글자 텍스처가 더해진다(R2 25–27, R3 27, R5 29–32, R6 28–30 — R2부터 14를 넘었다). 수를 14로 줄이려면 후처리·그림자를 끄는 수준이라 하지 않았다 |
| 사람 검사(실기기에서 여러 장 넘김의 연속감, 여섯 펼침면 톤) | **미관측** | 아래 '사람 검사 항목' |

## 설계와 다르게 한 것

- **잎 사이 45 ms와 풀 3장.** 잎당 시간이 400 ms(4잎)면 45 ms 간격으로는 넷째 잎이 135 ms에 떠나 공중이 4장이 된다. 풀이 3장이므로 넷째 잎은 첫 잎이 내려앉은 400 ms에 출발한다(시작 [0, 45, 90, 400] ms, 전체 800 ms). 일반식: 잎 k는 '앞 잎 출발 + 45 ms'와 '잎 k−3이 내려앉는 시각' 중 늦은 때 떠난다(`goToSchedule`). 7잎(마침 → 목차)은 잎당 229 ms, 전체 686 ms다.
- **사이 쪽은 인쇄 없는 종이.** 넘김 동안 인쇄 창은 6쪽(출발 펼침면 2쪽, 첫 잎의 먼 면, 마지막 잎의 가까운 면, 도착 펼침면 2쪽)이다. 그 사이를 지나가는 잎과 잠깐 드러나는 쪽은 종이만 보인다. 사이 쪽까지 인쇄하면 7잎 이동에서 16쪽이 필요해 48 MiB를 넘는다.
- **표지를 펼치면 레슨 1.** 책 순서의 첫 펼침면은 목차지만 표지 열기·'이어서 펼치기'는 레슨 1(또는 저장된 레슨)로 연다. 목차는 바로 앞 펼침면(←)과 조작바 '목차'다. 보존 모듈인 `controller.ts`의 초기 펼침면(`spread-1`)과 G1·V13 고정 데이터, 첫 방문에서 곧바로 실험을 시작하는 흐름을 그대로 두었다.
- **저장 형식 판올림 없음.** 목차·마침은 저장되는 자리가 아니므로(위) `supportsStoredSpread`와 기록 형식이 그대로다. R7에서 이미 schema 3과 v2 → v3 이관을 넣었다.
- **2D 레슨 쪽은 `LessonPages.tsx` 유지.** 프롬프트는 2D를 PageSpec 해석기로 완성하라고 했지만, 레슨 쪽은 이미 같은 명령으로 모든 조작이 되고 테스트 ID가 e2e·거울과 묶여 있다. 새 쪽(목차·마침)만 DSL 해석기(`MatterPages.tsx`)로 그렸다.
- **쪽 DSL 파일.** `content/pages/{contents,closing}.ts`는 `matterPages.ts` 하나로, `spread-3..6.ts`는 R3부터 쓰던 `lessonPages.ts`에 그대로 두었다(내용은 R3·R5에서 이미 여섯 펼침면 모두 인쇄).
- **44 px.** 3D 화면 위 인쇄 핫스폿은 계약 B5대로 포인터 편의다. 목차 줄은 쪽 단위 44 이상으로 크게 인쇄했고, 화면 44 CSS px는 2D 책·거울·조작바가 맡는다.
- **텍스처 수.** 위 표 '미달(기록)'.
- **e2e의 다중 잎 검사.** SwiftShader는 한 프레임에 0.5–3 s라 0.7–0.8 s짜리 넘김 동안 그려지는 프레임이 1–3장뿐이다. e2e는 '넘김 프레임 ≥ 1, 잎 수, 공중 ≤ 3, 계획 시간 ≤ 1.6 s'를 보고, 잎별 연속 진행은 시계를 고정한 캡처(`holdTurn`)로 본다.
- **효과음.** GO_TO 한 번에 넘김 소리 한 번(page-turn → page-settle)이다. 잎마다 소리를 겹치지 않았다.

## 사람 검사 항목 (`after/`)

- 목차에서 레슨을 고르면 여러 장이 차례로 넘어가 도착하는가(1.6 s 안). 사이 쪽이 빈 종이로 지나가는 것이 어색하지 않은가.
- 여섯 펼침면과 목차·마침이 같은 종이·잉크 톤인가. 글자가 넘치거나 겹치지 않는가.
- 2D 모드('크게 읽기')에서도 여섯 펼침면과 목차·마침이 모두 조작되는가.

## 측정

### 책 한 권 (3 viewport × 목차 · 레슨 1–6 · 마침)

| 상태 | 1280x720 | 844x390 | 390x844 |
|---|---|---|---|
| contents | [1280x720_contents_ink.jpg](after/1280x720_contents_ink.jpg) | [844x390_contents_ink.jpg](after/844x390_contents_ink.jpg) | [390x844_contents_ink.jpg](after/390x844_contents_ink.jpg) |
| spread1 | [1280x720_spread1_ink.jpg](after/1280x720_spread1_ink.jpg) | [844x390_spread1_ink.jpg](after/844x390_spread1_ink.jpg) | [390x844_spread1_ink.jpg](after/390x844_spread1_ink.jpg) |
| spread2 | [1280x720_spread2_ink.jpg](after/1280x720_spread2_ink.jpg) | [844x390_spread2_ink.jpg](after/844x390_spread2_ink.jpg) | [390x844_spread2_ink.jpg](after/390x844_spread2_ink.jpg) |
| spread3 | [1280x720_spread3_ink.jpg](after/1280x720_spread3_ink.jpg) | [844x390_spread3_ink.jpg](after/844x390_spread3_ink.jpg) | [390x844_spread3_ink.jpg](after/390x844_spread3_ink.jpg) |
| spread4 | [1280x720_spread4_ink.jpg](after/1280x720_spread4_ink.jpg) | [844x390_spread4_ink.jpg](after/844x390_spread4_ink.jpg) | [390x844_spread4_ink.jpg](after/390x844_spread4_ink.jpg) |
| spread5 | [1280x720_spread5_ink.jpg](after/1280x720_spread5_ink.jpg) | [844x390_spread5_ink.jpg](after/844x390_spread5_ink.jpg) | [390x844_spread5_ink.jpg](after/390x844_spread5_ink.jpg) |
| spread6 | [1280x720_spread6_ink.jpg](after/1280x720_spread6_ink.jpg) | [844x390_spread6_ink.jpg](after/844x390_spread6_ink.jpg) | [390x844_spread6_ink.jpg](after/390x844_spread6_ink.jpg) |
| closing | [1280x720_closing_ink.jpg](after/1280x720_closing_ink.jpg) | [844x390_closing_ink.jpg](after/844x390_closing_ink.jpg) | [390x844_closing_ink.jpg](after/390x844_closing_ink.jpg) |

### 텍스처 (각 캡처 시점: renderer 텍스처 수 = `renderer.info.memory.textures`, 인쇄 창 = 페이지 compositor)

| viewport | 상태 | renderer 텍스처 | geometries | draw calls | 인쇄 쪽 (settled / draft / state) | 인쇄 메모리 MiB |
|---|---|---|---|---|---|---|
| 1280x720 | contents | 27 | 12 | 87 | 4 (2 / 2 / 2) | 37.3 |
| 1280x720 | spread1 | 30 | 18 | 101 | 6 (2 / 4 / 2) | 46.1 |
| 1280x720 | spread2 | 29 | 17 | 96 | 6 (2 / 4 / 2) | 46.1 |
| 1280x720 | spread3 | 28 | 17 | 93 | 6 (2 / 4 / 2) | 46.1 |
| 1280x720 | spread4 | 29 | 17 | 96 | 6 (2 / 4 / 2) | 46.1 |
| 1280x720 | spread5 | 30 | 18 | 98 | 6 (2 / 4 / 2) | 46.1 |
| 1280x720 | spread6 | 28 | 15 | 91 | 6 (2 / 4 / 2) | 46.1 |
| 1280x720 | closing | 27 | 12 | 87 | 4 (2 / 2 / 2) | 37.3 |
| 1280x720 | goto | 30 | 19 | 96 | 6 (2 / 4 / 2) | 46.1 |
| 844x390 | contents | 27 | 12 | 87 | 4 (2 / 2 / 2) | 37.3 |
| 844x390 | spread1 | 30 | 18 | 101 | 6 (2 / 4 / 2) | 46.1 |
| 844x390 | spread2 | 29 | 17 | 96 | 6 (2 / 4 / 2) | 46.1 |
| 844x390 | spread3 | 28 | 17 | 93 | 6 (2 / 4 / 2) | 46.1 |
| 844x390 | spread4 | 29 | 17 | 96 | 6 (2 / 4 / 2) | 46.1 |
| 844x390 | spread5 | 30 | 18 | 98 | 6 (2 / 4 / 2) | 46.1 |
| 844x390 | spread6 | 28 | 15 | 91 | 6 (2 / 4 / 2) | 46.1 |
| 844x390 | closing | 27 | 12 | 87 | 4 (2 / 2 / 2) | 37.3 |
| 390x844 | contents | 27 | 12 | 87 | 4 (2 / 2 / 2) | 37.3 |
| 390x844 | spread1 | 30 | 18 | 101 | 6 (2 / 4 / 2) | 46.1 |
| 390x844 | spread2 | 29 | 17 | 96 | 6 (2 / 4 / 2) | 46.1 |
| 390x844 | spread3 | 28 | 17 | 93 | 6 (2 / 4 / 2) | 46.1 |
| 390x844 | spread4 | 29 | 17 | 96 | 6 (2 / 4 / 2) | 46.1 |
| 390x844 | spread5 | 30 | 18 | 98 | 6 (2 / 4 / 2) | 46.1 |
| 390x844 | spread6 | 28 | 15 | 91 | 6 (2 / 4 / 2) | 46.1 |
| 390x844 | closing | 27 | 12 | 87 | 4 (2 / 2 / 2) | 37.3 |

### 목차 → 레슨 4 (GO_TO, 잎 4장) 연속 캡처 — 넘김 진행을 inspector로 고정(`holdTurn`)

| # | 전체 진행 | 잎별 진행(0 → 1) | 공중의 잎 | renderer 텍스처 | 캡처 |
|---|---|---|---|---|---|
| 0 | 0 | 0, 0, 0, 0 | 0 | 27 | [1280x720_goto_0_ink.jpg](after/1280x720_goto_0_ink.jpg) |
| 1 | 0.1429 | 0.286, 0.173, 0.061, 0 | 3 | 29 | [1280x720_goto_1_ink.jpg](after/1280x720_goto_1_ink.jpg) |
| 2 | 0.2857 | 0.571, 0.459, 0.346, 0 | 3 | 29 | [1280x720_goto_2_ink.jpg](after/1280x720_goto_2_ink.jpg) |
| 3 | 0.4286 | 0.857, 0.745, 0.632, 0 | 3 | 29 | [1280x720_goto_3_ink.jpg](after/1280x720_goto_3_ink.jpg) |
| 4 | 0.5714 | 1, 1, 0.918, 0.143 | 2 | 31 | [1280x720_goto_4_ink.jpg](after/1280x720_goto_4_ink.jpg) |
| 5 | 0.7143 | 1, 1, 1, 0.429 | 1 | 31 | [1280x720_goto_5_ink.jpg](after/1280x720_goto_5_ink.jpg) |
| 6 | 0.8571 | 1, 1, 1, 0.714 | 1 | 31 | [1280x720_goto_6_ink.jpg](after/1280x720_goto_6_ink.jpg) |
| 7 | 1 | 1, 1, 1, 1 | 0 | 31 | [1280x720_goto_7_ink.jpg](after/1280x720_goto_7_ink.jpg) |

넘김 중 인쇄 창: 6쪽(settled 2, draft 4, state 2), 46.1 MiB. 도착 뒤: [1280x720_goto_ink.jpg](after/1280x720_goto_ink.jpg).

### 페이지 오류

- 844x390 ink: 0건 []
- 390x844 ink: 0건 []
- 1280x720 ink: 0건 []

### e2e 1280x720 — 41/41 통과 ([e2e-1280x720.json](e2e-1280x720.json))

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
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 6, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 22, "stateAfter": 23}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 2.3, "draftMeasures": [2.3, 0.5, 0.5, 0.3, 1.3, 1.1, 0.4, 0.4, 0.6, 0.2, 1.4, 0.2, 0.5, 0.3, 0.4, 0.2, 0.5, 0.2, 0.6, 0.6, 0.6, 0.2, 0.5, 0.2,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 26, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.218, "max": 122}, "bestOffsetPx": {"dx": 0, "dy": 0}, "corre…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 28, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "31", "rootRevision": "31"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5/R8: next is disabled on the last spread (the closing) | 통과 | `{"disabled": true}` |
| R8: the closing prints the six experiments and its stamp slot, and leads back to the contents | 통과 | `{"headings": ["마침", "돌아보기"], "stamps": [{"id": "book", "stamped": false, "rect": {"x": 834, "y": 681.25, "w": 96, "h": 96}, "center": {"x": 905.327181029809,…` |
| R8: 목차 (toolbar) flies seven leaves from the closing to the contents, at most three in the air, planned ≤ 1.6 s | 통과 | `{"frames": 2, "leaves": 7, "maxFlying": 1, "wallMs": 1417, "plannedMs": 686, "note": "wallMs includes SwiftShader frame time (0.5–3 s per frame)"}` |
| R8: a printed contents row turns four leaves to lesson 4 (pointer) | 통과 | `{"row": "page-14:toc:spread-4", "frames": 1, "leaves": 4, "maxFlying": 0, "wallMs": 0, "plannedMs": 800, "contentsButton": {"prev": "표지로", "contents": true}}` |
| R8: the contents in the mirror jump too (keyboard / assistive path); on the contents prev reads 표지로 and 목차 is off | 통과 | `{"mirrorJump": true, "mirrorLanded": true, "prev": "표지로", "contents": true}` |
| R8 BK08: ten quick nexts turn once plus one queued (2 → 4); next then prev comes back (4 → 5 → 4) | 통과 | `{"afterTen": "spread-4", "afterReversal": "spread-4"}` |
| R5/R8: prev from lesson 1 opens the contents; prev on the contents (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |

### e2e 390x844 — 41/41 통과 ([e2e-390x844.json](e2e-390x844.json))

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
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 6, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 22, "stateAfter": 23}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 3.8, "draftMeasures": [0.5, 0.4, 0.5, 0.1, 0.5, 0.3, 0.6, 0.3, 0.7, 0.3, 0.5, 0.2, 0.9, 0.5, 0.4, 0.1, 0.5, 0.3, 0.7, 0.1, 0.6, 0.3, 0.7, 0.3,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 26, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.261, "max": 47}, "bestOffsetPx": {"dx": 0, "dy": 0}, "correl…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 29, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "31", "rootRevision": "31"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5/R8: next is disabled on the last spread (the closing) | 통과 | `{"disabled": true}` |
| R8: the closing prints the six experiments and its stamp slot, and leads back to the contents | 통과 | `{"headings": ["마침", "돌아보기"], "stamps": [{"id": "book", "stamped": false, "rect": {"x": 834, "y": 681.25, "w": 96, "h": 96}, "center": {"x": 324.4582825498914…` |
| R8: 목차 (toolbar) flies seven leaves from the closing to the contents, at most three in the air, planned ≤ 1.6 s | 통과 | `{"frames": 3, "leaves": 7, "maxFlying": 1, "wallMs": 1467, "plannedMs": 686, "note": "wallMs includes SwiftShader frame time (0.5–3 s per frame)"}` |
| R8: a printed contents row turns four leaves to lesson 4 (pointer) | 통과 | `{"row": "page-14:toc:spread-4", "frames": 1, "leaves": 4, "maxFlying": 0, "wallMs": 0, "plannedMs": 800, "contentsButton": {"prev": "표지로", "contents": true}}` |
| R8: the contents in the mirror jump too (keyboard / assistive path); on the contents prev reads 표지로 and 목차 is off | 통과 | `{"mirrorJump": true, "mirrorLanded": true, "prev": "표지로", "contents": true}` |
| R8 BK08: ten quick nexts turn once plus one queued (2 → 4); next then prev comes back (4 → 5 → 4) | 통과 | `{"afterTen": "spread-4", "afterReversal": "spread-4"}` |
| R5/R8: prev from lesson 1 opens the contents; prev on the contents (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |

### e2e 568x320 — 41/41 통과 ([e2e-568x320.json](e2e-568x320.json))

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
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 11, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 22, "stateAfter": 23}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 2, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 8.5, "draftMeasures": [0.5, 8.5, 0.5, 0.1, 0.7, 0.2, 0.8, 0.4, 2.3, 0.3, 0.4, 0.2, 0.5, 0.1, 0.5, 0.1, 0.7, 0.3, 1, 0.3, 0.8, 0.3, 0.5, 0.2, 0…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 26, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 0.946, "max": 61}, "bestOffsetPx": {"dx": 0, "dy": 0}, "correl…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 31, "phases": ["preparingTurn", "turningForward"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "31", "rootRevision": "31"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5/R8: next is disabled on the last spread (the closing) | 통과 | `{"disabled": true}` |
| R8: the closing prints the six experiments and its stamp slot, and leads back to the contents | 통과 | `{"headings": ["마침", "돌아보기"], "stamps": [{"id": "book", "stamped": false, "rect": {"x": 834, "y": 681.25, "w": 96, "h": 96}, "center": {"x": 390.0258807310106…` |
| R8: 목차 (toolbar) flies seven leaves from the closing to the contents, at most three in the air, planned ≤ 1.6 s | 통과 | `{"frames": 1, "leaves": 7, "maxFlying": 0, "wallMs": 0, "plannedMs": 686, "note": "wallMs includes SwiftShader frame time (0.5–3 s per frame)"}` |
| R8: a printed contents row turns four leaves to lesson 4 (pointer) | 통과 | `{"row": "page-14:toc:spread-4", "frames": 2, "leaves": 4, "maxFlying": 3, "wallMs": 567, "plannedMs": 800, "contentsButton": {"prev": "표지로", "contents": true}}` |
| R8: the contents in the mirror jump too (keyboard / assistive path); on the contents prev reads 표지로 and 목차 is off | 통과 | `{"mirrorJump": true, "mirrorLanded": true, "prev": "표지로", "contents": true}` |
| R8 BK08: ten quick nexts turn once plus one queued (2 → 4); next then prev comes back (4 → 5 → 4) | 통과 | `{"afterTen": "spread-4", "afterReversal": "spread-4"}` |
| R5/R8: prev from lesson 1 opens the contents; prev on the contents (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |

### e2e 844x390 — 41/41 통과 ([e2e-844x390.json](e2e-844x390.json))

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
| R6: ArrowRight during a shot returns to reading, then turns | 통과 | `{"turned": true, "samples": 7, "turnFromShot": 0}` |
| R6: Escape ends the spread-2 shot | 통과 | `{"shot": "strip-close", "escaped": true}` |
| Tab focus is drawn on the printed page (AX21) | 통과 | `{"hotspot": "page-1:q:same-end:same", "root": "page-1:q:same-end:same", "stateBefore": 22, "stateAfter": 23}` |
| ten splits through the mirror | 통과 | `{"splits": 10, "notes": 11}` |
| R4: split draws the new boundary as a pen stroke over 240 ms (data first) | 통과 | `{"notesBefore": 11, "firstStroke": {"events": 12, "transition": {"kind": "draw", "boundaries": [5.625]}}, "strokeFrames": 1, "strokeEnded": true}` |
| draft print per edit ≤ 60 ms (performance measure print:draft) | 통과 | `{"maxDraftMs": 4.4, "draftMeasures": [0.5, 0.6, 0.4, 0.2, 1.1, 0.3, 2.4, 0.3, 0.8, 0.2, 0.4, 0.2, 0.5, 0.2, 0.5, 0.4, 0.5, 1.8, 0.6, 0.3, 0.7, 0.3, 0.6, 0.2,…` |
| pointer press on printed 둘로 나누기 splits | 통과 | `{"revision": 26, "notes": 13}` |
| settled upgrade keeps the same print (jump 0) | 통과 | `{"draftFrameCaptured": true, "settledVsFinal": {"mean": 0, "max": 0}, "draftVsFinal": {"mean": 1.19, "max": 87.3}, "bestOffsetPx": {"dx": 0, "dy": 0}, "corre…` |
| tap on the 3D figure selects that note | 통과 | `{"figure": "scene-2-lanes", "selectedBefore": "edit-scene-2-main-12-1", "selectedAfter": "edit-scene-2-main-4-1", "expected": "edit-scene-2-main-4-1"}` |
| BK12: no page DOM during the turn | 통과 | `{"turningFrames": 30, "phases": ["preparingTurn", "turningForward", "settling"]}` |
| 2D reading book shows DOM pages with the same lesson | 통과 | `{"pages": 2, "mirror": false, "pageRevision": "31", "rootRevision": "31"}` |
| returns to the printed 3D book | 통과 | `null` |
| print memory stays in budget after 20 round trips | 통과 | `{"startMiB": 46.1, "endMiB": 46.1, "budgetMiB": 48, "settled": 2, "drafts": 4, "states": 2}` |
| R5/R8: next is disabled on the last spread (the closing) | 통과 | `{"disabled": true}` |
| R8: the closing prints the six experiments and its stamp slot, and leads back to the contents | 통과 | `{"headings": ["마침", "돌아보기"], "stamps": [{"id": "book", "stamped": false, "rect": {"x": 834, "y": 681.25, "w": 96, "h": 96}, "center": {"x": 552.229046229752,…` |
| R8: 목차 (toolbar) flies seven leaves from the closing to the contents, at most three in the air, planned ≤ 1.6 s | 통과 | `{"frames": 1, "leaves": 7, "maxFlying": 0, "wallMs": 0, "plannedMs": 686, "note": "wallMs includes SwiftShader frame time (0.5–3 s per frame)"}` |
| R8: a printed contents row turns four leaves to lesson 4 (pointer) | 통과 | `{"row": "page-14:toc:spread-4", "frames": 2, "leaves": 4, "maxFlying": 3, "wallMs": 950, "plannedMs": 800, "contentsButton": {"prev": "표지로", "contents": true}}` |
| R8: the contents in the mirror jump too (keyboard / assistive path); on the contents prev reads 표지로 and 목차 is off | 통과 | `{"mirrorJump": true, "mirrorLanded": true, "prev": "표지로", "contents": true}` |
| R8 BK08: ten quick nexts turn once plus one queued (2 → 4); next then prev comes back (4 → 5 → 4) | 통과 | `{"afterTen": "spread-4", "afterReversal": "spread-4"}` |
| R5/R8: prev from lesson 1 opens the contents; prev on the contents (표지로) closes the book; the toolbar hides but keeps its space | 통과 | `{"label": "표지로", "toolbar": "false", "hidden": "hidden"}` |
| no page errors | 통과 | `[]` |
