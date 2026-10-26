import { frac, add } from '../domain/index.ts';
import type { Fraction, Notation } from '../domain/index.ts';
import type { LessonContent, MusicEvent, Question, SceneDefinition, SceneId } from './types.ts';

export const durationChoices = Object.freeze([
  { duration: frac(1, 1), name: '온음표', restName: '온쉼표', type: 'whole' },
  { duration: frac(1, 2), name: '2분음표', restName: '2분쉼표', type: 'half' },
  { duration: frac(1, 4), name: '4분음표', restName: '4분쉼표', type: 'quarter' },
  { duration: frac(1, 8), name: '8분음표', restName: '8분쉼표', type: 'eighth' },
  { duration: frac(1, 16), name: '16분음표', restName: '16분쉼표', type: 'sixteenth' },
] as const);

export function notationForDuration(duration: Fraction): Notation {
  const item = durationChoices.find(x => x.duration.n === duration.n && x.duration.d === duration.d);
  if (!item) throw new RangeError('첫 단원은 온음표부터 16분음표까지만 지원합니다.');
  return Object.freeze({ type: item.type, dots: 0 });
}

export function durationLabel(duration: Fraction, kind: 'note' | 'rest' = 'note'): string {
  const item = durationChoices.find(x => x.duration.n === duration.n && x.duration.d === duration.d);
  return item ? (kind === 'rest' ? item.restName : item.name) : `${duration.n}/${duration.d}`;
}

export function makePattern(prefix: string, entries: readonly Readonly<{ duration: Fraction; kind?: 'note' | 'rest' }>[]): readonly MusicEvent[] {
  let onset = frac(0, 1);
  return Object.freeze(entries.map((entry, index) => {
    const base = { id: `${prefix}-${index + 1}`, onset, duration: entry.duration, notation: notationForDuration(entry.duration) };
    onset = add(onset, entry.duration);
    return Object.freeze(entry.kind === 'rest' ? { ...base, kind: 'rest' as const } : { ...base, kind: 'note' as const, pitch: Object.freeze({ step: 'C' as const, alter: 0, octave: 4 }) });
  }));
}

const q = (id: string, prompt: string, choices: readonly [string, string][], answer: string, explanation: string): Question =>
  Object.freeze({ id, prompt, options: Object.freeze(choices.map(([value, label]) => Object.freeze({ value, label }))), correctValue: answer, explanation });
const base = { meter: { numerator: 4, denominator: 4, groups: [1, 1, 1, 1] }, tempo: { bpm: 90, unit: frac(1, 4) }, audio: { instrument: 'prototype-synth' as const, narrationAssetId: null, backgroundMusicAssetId: null } };
const quarter = frac(1, 4);
const empty = Object.freeze([]) as readonly MusicEvent[];
const scenes: SceneDefinition[] = [
  {
    ...base, sceneId: 'scene-1', title: '같은 끝, 다른 시작', goal: '총 길이와 소리 시작 횟수를 구별합니다.',
    question: '두 줄이 끝나는 시각은 같을까요? 소리 시작 횟수도 같을까요?',
    instructions: '위·아래를 한 줄씩 재생하거나 소리 없는 설명을 확인한 뒤 질문에 답하세요.',
    lanes: [
      { laneId: 'upper', label: '위: 온음표 1개', role: 'reference', events: makePattern('duration-basics-scene1-upper', [{ duration: frac(1, 1) }]) },
      { laneId: 'lower', label: '아래: 4분음표 4개', role: 'reference', events: makePattern('duration-basics-scene1-lower', Array.from({ length: 4 }, () => ({ duration: quarter }))) },
    ], task: { target: frac(1, 1) },
    questions: [
      q('same-end', '두 줄의 전체 길이는?', [['same', '같아요'], ['different', '달라요']], 'same', '두 줄 모두 온음표 기준 길이1이며 90에서 8/3초입니다.'),
      q('attacks', '위·아래 소리 시작 횟수는?', [['1-4', '위1회 · 아래4회'], ['4-4', '모두4회']], '1-4', '총 길이가 같아도 시작 횟수와 리듬은 다릅니다.'),
      q('attributes', '길이를 짧게 만들면 이 실험의 음높이·음량 설정도 바뀌나요?', [['fixed', '아니요, 길이만 바뀌어요'], ['changed', '모두 바뀌어요']], 'fixed', '음높이C4와 gain 설정은 유지됩니다. 짧은 소리의 체감 크기는 다르게 느껴질 수 있습니다.'),
    ],
    alternative: '위는0초에1회, 아래는0·2/3·4/3·2초에4회 시작합니다. 두 줄 모두8/3초에 끝납니다. 음높이와 음량 설정은 같습니다.',
    completion: '두 레인을 청취 또는 텍스트로 확인하고 세 질문에 답합니다.',
    teacherGuide: { misconception: '길이가 같으면 리듬도 같다거나 긴 블록이 높은/큰 소리라는 오개념.', answer: '총 길이 같음, 시작1/4회, 음높이·음량 설정 유지.', demonstration: '한 레인씩 들려주고 같은 끝 지점을 짚습니다.', extension4: '각 어택의 초를 분수로 계산해 설명합니다.', extension5: '종이에 같은 길이·다른 어택의 두 리듬을 만듭니다.' },
  },
  {
    ...base, sceneId: 'scene-2', title: '절반씩 나누기', goal: '온음표부터16분음표까지 상대 길이를 확인합니다.',
    question: '온음표 하나와 같으려면8분음표가 몇 개 필요할까요?', instructions: '블록 선택 → 둘로 나누기. 같은 길이의 이웃한 두 음표는 합칠 수 있어요.',
    lanes: [{ laneId: 'main', label: '분할 실험', role: 'draft', events: makePattern('duration-basics-scene2-main', [{ duration: frac(1, 1) }]) }], task: { target: frac(1, 1) },
    questions: [q('eighth-count', '8분음표는 몇 개?', [['4', '4개'], ['8', '8개'], ['16', '16개']], '8', '1/8이8개이면 전체1입니다.')],
    alternative: '1을 둘로 나누면1/2 두 개입니다. 같은 방식으로1/4·1/8·1/16까지 나누어도 합은1입니다.', completion: '2분·4분·8분·16분 길이를 관찰하고 문항에 답합니다.',
    teacherGuide: { misconception: '분할하면 전체 길이도 줄어든다는 오개념.', answer: '분할 전후 합1, 8분음표8개.', demonstration: '선택한 블록만 분할하고 원래 끝 지점을 비교합니다. 병합은 두 어택을 하나로 바꿉니다.', extension4: '분할·병합을 분수식으로 설명합니다.', extension5: '같은 길이가 되는 여러 분할을 종이에 설계합니다.' },
  },
  {
    ...base, sceneId: 'scene-3', title: '다른 조합, 같은 길이', goal: '여러 음가의 동치 조합을 만듭니다.', question: '온음표의 절반을 세 가지 방법으로 채울까요?', instructions: 'A는4분음표만, B는8분음표만, C는두 종류 이상으로1/2을 만드세요.',
    lanes: ['A', 'B', 'C'].map(laneId => ({ laneId, label: `과제${laneId}`, role: 'draft' as const, events: empty })), task: { target: frac(1, 2) }, questions: [],
    alternative: 'A:1/4+1/4. B:1/8+1/8+1/8+1/8. C의 예:1/4+1/8+1/8. 다른 동등 조합도 인정합니다.', completion: 'A·B·C의 현재 답이 각 조건을 만족해야 합니다.',
    teacherGuide: { misconception: '예시 하나만 정답이라는 오개념.', answer: '합1/2. A는1/4만, B는1/8만, C는서로 다른 길이2종 이상.', demonstration: '부족·초과량을 온음표 기준 분수로 비교합니다.', extension4: '동치 조합의 수를 조건별로 비교합니다.', extension5: '새로운 제한 조건을 만들어 동등 정답을 설명합니다.' },
  },
  {
    ...base, sceneId: 'scene-4', title: '쉼표도 시간이에요', goal: '무음과 시간 부재를 구별합니다.', question: '쉼표에서 재생선은 멈추어야 할까요?', instructions: '선택한 음표와 같은 길이의 쉼표를 바꾸어 보세요. 전체 길이는 유지해요.',
    lanes: [{ laneId: 'main', label: '음표와 쉼표', role: 'draft', events: makePattern('duration-basics-scene4-main', [{ duration: quarter }, { duration: quarter, kind: 'rest' }, { duration: quarter }, { duration: quarter, kind: 'rest' }]) }], task: { target: frac(1, 1), minimumRests: 1 },
    questions: [q('rest-motion', '쉼표에서 재생선은?', [['continues', '같은 속도로 계속 가요'], ['stops', '멈추어요']], 'continues', '쉼표에서는 소리를 만들지 않지만 시간이 흐릅니다.')],
    alternative: '음표는0과1/2 위치에서 시작합니다. 90에서0과4/3초입니다. 두 쉼표 구간에도 재생 위치는 계속 진행합니다.', completion: '쉼표를 포함한 길이1을 유지하고 질문에 답합니다.',
    teacherGuide: { misconception: '쉼표를 없애거나 재생선이 정지해야 한다는 오개념.', answer: '무음은 시간의 일부이며 재생선은 일정하게 이동.', demonstration: '음표↔쉼표를 바꿔도 다음 시작 시각이 유지됨을 관찰합니다.', extension4: '어택 예약이 없는 구간과 전체 길이를 식으로 설명합니다.', extension5: '쉼표 위치만 바꾼 같은 길이 리듬을 종이 두 마디로 만듭니다.' },
  },
  {
    ...base, sceneId: 'scene-5', title: '템포와 비율', goal: '실제 초와 음가 비율을 구별합니다.', question: '템포120에서도 온음표:4분음표 비율은4:1일까요?', instructions: '정지한 뒤60과120을 선택해 비교해요. 음가와 블록 길이는 바뀌지 않아요.',
    lanes: [{ laneId: 'main', label: '같은 한 마디', role: 'reference', events: makePattern('duration-basics-scene5-main', Array.from({ length: 4 }, () => ({ duration: quarter }))) }], task: { target: frac(1, 1) },
    questions: [q('ratio', '온음표:4분음표 비율은?', [['4:1', '두 템포 모두4:1'], ['2:1', '120에서는2:1']], '4:1', '템포는 실제 초를 바꾸지만 음가 비율은 유지합니다.'), q('seconds', '60과120에서 한 마디 시간은?', [['4-2', '4초 · 2초'], ['2-4', '2초 · 4초']], '4-2', '4분음표가 각각1초·0.5초이므로 한 마디는4초·2초입니다.')],
    alternative: '60:온음표4초·4분음표1초. 120:온음표2초·4분음표0.5초. 비율은둘 다4:1입니다.', completion: '비율과 시간 두 질문에 답합니다.',
    teacherGuide: { misconception: '빨라지면 음표 자체가 짧은 종류로 변한다는 오개념.', answer: 'duration·onset은 유지, 초 눈금·재생 속도만 변함.', demonstration: '정지 상태에서만 템포를 바꾸고 레인 길이를 비교합니다.', extension4: '60/120의 초를 계산해 비율 유지 이유를 설명합니다.', extension5: '다른 정수 템포의 시간표를 종이로 설계합니다.' },
  },
  {
    ...base, sceneId: 'scene-6', title: '나의 한 마디', goal: '두 가지 이상의 음가와 쉼표를 포함한 한 마디를 만듭니다.', question: '길이1을 맞추고 어떻게 만들었는지 설명해 볼까요?', instructions: '음표·쉼표를 눌러 추가하세요. 두 가지 길이 이상, 쉼표 하나 이상이 필요해요.',
    lanes: [{ laneId: 'main', label: '내 리듬', role: 'draft', events: empty }], task: { target: frac(1, 1), minimumDurationKinds: 2, minimumRests: 1 }, questions: [],
    alternative: '예시:2분음표+4분쉼표+8분음표+8분음표=1. 음표와쉼표의 이름이 달라도 길이가 같으면 같은 음가 종류로 셉니다.', completion: '현재 리듬의 세 조건을 만족하고 설명 자기 확인을 합니다. 자유 문장은 자동 채점하지 않습니다.',
    teacherGuide: { misconception: '4분음표와4분쉼표를 서로 다른 음가 종류로 세는 오개념.', answer: '합1, 서로 다른 기약분수길이≥2, 쉼표≥1. 설명은자기 확인/교사 검토.', demonstration: '조건별 피드백을 읽고 성공 후삭제·undo로 현재 성공이 바뀌는지 확인합니다.', extension4: '합계를 분수로 쓰고 쉼표가 시간을 유지하는 이유를 설명합니다.', extension5: '앱은한 마디만 지원. 종이활동지에두 마디를 창작하고 근거를 설명합니다.' },
  },
];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
export const lessonContent: LessonContent = deepFreeze({ schemaVersion: '2.0.0', contentVersion: '1.0.0', lessonId: 'duration-basics', locale: 'ko-KR', title: '온음표부터16분음표까지', pitchConvention: 'C4=MIDI60', scenes });
export function getScene(sceneId: SceneId): SceneDefinition {
  const scene = lessonContent.scenes.find(x => x.sceneId === sceneId);
  if (!scene) throw new RangeError('알 수 없는 장면입니다.');
  return scene;
}
