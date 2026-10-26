# 첫 단원 콘텐츠 작성 규칙

현재 콘텐츠 원본은 `src/content/lesson.ts`이며 계약은 `src/content/types.ts`, 검증은 `src/content/validation.ts`에 있다. 학습 기록 JSON 가져오기는 콘텐츠 저작 기능이 아니다.

## 현재 지원 범위

- `schemaVersion: '2.0.0'`, `contentVersion: '1.0.0'`, `lessonId: 'duration-basics'`, `locale: 'ko-KR'`, `pitchConvention: 'C4=MIDI60'`.
- `scene-1`부터 `scene-6`까지의 고정된 장면 ID와 9개 저장 레인.
- 4/4, 그룹 `[1,1,1,1]`, 기준 박 단위 `1/4`. 기본 템포 90, 비교 장면은 60/120.
- 첫 단원 이벤트는 점·잇단음표 없는 `whole`, `half`, `quarter`, `eighth`, `sixteenth`; 음높이는 C4. 도메인의 더 넓은 계산 가능 범위를 단원 UI의 지원 범위로 확대 해석하지 않는다.
- 작성 과제의 초안은 비어 있거나 목표보다 짧을 수 있다. 빈 초안을 완성 마디나 정답으로 취급하지 않는다.

장면은 `title`, `goal`, `question`, `instructions`, `meter`, `tempo`, `lanes`, `task`, `questions`, `teacherGuide`, `alternative`, `completion`, `audio`를 명시한다. `teacherGuide`에는 오개념, 정답 근거, 시범, 확장 안내를 작성한다. 청취 대체는 실제 청취와 구분하여 기록한다.

## 이벤트 작성 예

```ts
import { frac } from '../domain/index.ts';
import { makePattern } from './lesson.ts';

const events = makePattern('duration-basics-example', [
  { duration: frac(1, 2) },
  { duration: frac(1, 4), kind: 'rest' },
  { duration: frac(1, 8) },
  { duration: frac(1, 8) },
]);
```

합계는 정확히 `1/1`이고 실제 음가 종류는 세 가지다. 같은 길이의 음표와 쉼표는 다른 음가 종류로 세지 않는다. `makePattern`은 연속 onset, 기보 종류, 고유 접두어 기반 ID, 음표의 C4 pitch를 만든다. 직접 이벤트를 작성할 때도 duration과 notation의 일치, 정규화 분수, 중복되지 않는 ID, 빈틈 없는 시간 순서를 지켜야 한다.

## 여섯 장면의 완료 계약

| 장면 | 확인할 내용 |
| --- | --- |
| 1 | 위·아래 레인의 청취 또는 텍스트 관찰을 각각 기록하고 세 개념 질문에 정답 |
| 2 | 1/2·1/4·1/8·1/16 관찰과 개념 질문 정답. 분할·병합은 총합 보존 |
| 3 | A는 4분음표만으로 1/2, B는 8분음표만으로 1/2, C는 두 음가 종류 이상으로 1/2 |
| 4 | 총합 1, 쉼표 한 개 이상, 쉼표에서도 시간 진행 질문 정답 |
| 5 | 같은 패턴의 60/120 비교와 비율·초 단위 질문 정답 |
| 6 | 총합 1, 서로 다른 음가 두 종류 이상, 쉼표 한 개 이상, 설명 자기 확인. 자유 설명을 자동 정답 판정하지 않음 |

질문은 안정적인 ID, 선택지 value/label, 정답 value, 설명을 가진다. 선택지 표현을 바꿀 때 저장된 답안과 controller의 의미 검증에 미치는 영향을 함께 검토한다. 사전·사후 평가 문항은 `src/lesson/assessment.ts`에서 별도로 관리한다.

## 수정 후 확인

```powershell
npm run content:validate
npm run typecheck
npm test
npm run lint
npm run build
```

이벤트 종류·완료 계약을 바꾸면 관련 domain/lesson/assessment/persistence 테스트의 실제 기대값을 검토한다. 단순히 테스트를 새 구현과 똑같이 바꾸지 않는다. 새 콘텐츠 버전은 저장 복원·가져오기와 함께 설계하며 알려지지 않은 구버전을 자동 이관하지 않는다.

현재 정확 악보는 실제 VexFlow 5.0.0과 로컬 내장 폰트로 연결되어 있다. 기보 fixture 검증은 23개 실제 확인, 폰트 일시 실패 후 명시적 재시도 확인은 1개 통과했다. 새 작성 내용도 음표·쉼표 위치·기둥·꼬리·beam·미완성 마디·강조·화면 폭 변화를 실제 SVG로 검수해야 한다. 특히 온쉼표와 2분쉼표의 보표선 위치를 혼동하지 않는다. 다른 단원의 변화표/조표를 fixture에서 확인한 사실을 첫 단원 UI의 확장 기능으로 설명하지 않는다.

문항이나 초기 패턴을 바꾸면 현재 레인 이름이 인쇄 활동지에도 나타나는지 확인한다. 인쇄 설정은 A4 12mm 여백·장면별 페이지 구분·설명 기입 줄을 사용한다. 마지막 6쪽 정본의 화면 검수에서는 장면 3의 세 악보와 두 기입 줄이 함께 들어가고 이전 분리 문제가 해결됐다. 새 PDF의 실제 시각 검수 결과는 [PRINT_REVIEW.md](qa/PRINT_REVIEW.md)에 별도로 기록하며 과거 PDF의 통과 여부를 승계하지 않는다. 폰트·라이브러리를 교체할 때 `public/licenses`의 프로그램 MIT와 폰트별 OFL/저작권 고지를 함께 갱신·보존한다.

다음 단원은 문구 교체만으로 지원되지 않는다. 타입·검증·controller·저장 키·UI의 현재 단원 고정을 먼저 분석해야 한다. [다음 단원 검토 양식](NEXT_LESSON_TEMPLATE.md)은 분석용이며 새 단원 구현 승인을 뜻하지 않는다.
