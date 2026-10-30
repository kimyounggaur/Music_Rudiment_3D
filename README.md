# 음악이론 교과서 · 소리의 길이를 펼치다

책 한 권으로 읽는 음가 교재입니다. 표지를 펼치면 원근 카메라로 놓인 3D 책이 열리고, 종이에 인쇄된 쪽과 잉크로 그려진 음가 그림으로 여섯 실험(길이 비교, 음표 분할, 음가 조합, 쉼표, 템포, 한 마디 창작)을 합니다. 책은 **목차 → 레슨 1–6 → 마침**의 여덟 펼침면입니다. 정확한 분수 모델·VexFlow 기보·Three.js 책·Web Audio가 같은 학습 데이터를 씁니다.

**실행: [음가 블록 실험실](https://music-rudiment-3d.vercel.app/)** · [배포와 Git 연동 기록](docs/RELEASE.md) — 배포 사이트는 v3 리팩터 이전 판일 수 있습니다. 이 브랜치는 배포하지 않았습니다.

## 실행

Node.js 24.14 이상인 24.x에서:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run dev          # http://127.0.0.1:4173/
npm run build        # 내용 검증 → 글꼴 라이선스 감사 → vite build
npm run preview      # http://127.0.0.1:4174/
```

- **3D 책이 기본**입니다. 화면 아래 한 줄 조작바의 '크게 읽기'가 같은 내용·같은 조작의 **2D 책**을 엽니다(WebGL을 쓸 수 없거나 실패하면 자동으로 2D). 
- **첫 표지 행동**: 표지를 누르면 책이 열리고 레슨 1이 펼쳐집니다(저장된 기록이 있으면 '이어서 펼치기'). 표지를 펼치기 전에는 소리가 나지 않습니다.
- 품질은 기기에 맞춰 자동으로 정해지고 `?quality=high|medium|low`로 고정할 수 있습니다.
- v3 리팩터 동안 쓰던 `?renderer=legacy` 비교 경로는 R9에서 지웠습니다. 남은 링크로 열어도 이 책이 열립니다.

## 책에서 할 수 있는 것

- **넘기기**: 종이 모서리를 잡고 끌기(멈추기·되돌리기·놓기·취소), 조작바 ← →, 방향키. 첫 펼침면(목차)에서 ←는 표지로 닫고, 마지막(마침)에서 →는 꺼집니다.
- **목차**: 레슨 제목과 쪽 번호가 인쇄되어 있고, 줄을 누르면 여러 장이 한 번에 넘어가 그 레슨으로 갑니다(1.6초 안). 조작바 '목차'는 어디서나 목차로 갑니다.
- **쪽 안 조작은 인쇄물**: 듣기·정지·나누기·합치기·되돌리기, 질문 라디오, 종이 덮개로 가린 정답(들어 올리기), 문항을 모두 맞히면 찍히는 도장. 화면 밖 단추는 아래 조작바(목차·소리·정지 화면·크게 읽기·기록)뿐입니다.
- **가까이 보기**: 펼침면 1·2의 인쇄 단추로 카메라가 그림 쪽으로 다가가고, 같은 단추·Escape·넘기기로 정확히 원래 자리로 돌아옵니다.
- **잉크 그림**: 음가 블록이 펜으로 그려진 뒤 종이에서 일어섭니다. 쉼표는 면 없는 점선, 펼침면 5는 초 눈금(템포에 따라 글자만 바뀜), 펼침면 6은 남은 자리를 점선으로 보여 주는 자유 마디.
- **소리**: 학습 음악(시작·잠깐 멈춤·이어 듣기·정지)과 절차 합성 효과음(표지·넘김·안착·펜·덮개·도장). 조작바 '소리'가 둘을 함께 끕니다.
- **기록**: 자동 저장(v3 형식, 이전 형식은 원본 백업을 남기고 옮김), JSON 내보내기·가져오기, 백업, 삭제, 효과음·자동 가까이 보기 설정.
- **보조기술**: 인쇄된 쪽마다 같은 내용·같은 조작의 숨은 DOM 거울이 있고, Tab 초점은 종이 위 인쇄 조작에 그려집니다.

## 검증

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`(CI '`Verify music lab`'와 같음). 화면 검사는 로컬 개발 서버에서 `npm run test:e2e`(`scripts/book-v3-e2e.ts --viewport W×H`), 캡처는 `scripts/refactor-capture.ts`·`scripts/visual-baseline.ts`, 성능 예산은 `scripts/perf-budget.ts`. 단계별 기록은 [BUILD_STATUS_V3](docs/BUILD_STATUS_V3.md), 증거 색인은 [docs/qa/refactor](docs/qa/refactor/README.md).

이전 실험실(v1)과 v2 책의 QA 기록·스크립트(`scripts/e2e.ts` 등 표준 독립 파일 검사)는 이력 자료입니다. v3 책의 통과 증거로 쓰지 않습니다.

## 검수 경계

headless Chromium(SwiftShader)의 자동 검사와 캡처는 실기기 통과가 아닙니다. 실제 휴대전화(iOS Safari·Android Chrome) 터치와 60 fps 움직임, 스피커·이어폰 청취, 스크린리더, 음악 교육자 검토, 원본 화면 녹화 비교는 아직 하지 않았습니다 — [사람 검수 패킷](docs/qa/HUMAN_REVIEW_V3.md), [책 경험 관문 v3](docs/qa/BOOK_EXPERIENCE_GATE_V3.md), [알려진 한계](docs/KNOWN_LIMITATIONS.md).

[아키텍처](docs/ARCHITECTURE.md) · [계약 v3](docs/CONTRACT_V3.md) · [폰트·라이선스](public/licenses/README.md)

`output/`(로컬 trace·PNG·다운로드)와 의존성·비밀 설정은 Git에서 제외합니다.
