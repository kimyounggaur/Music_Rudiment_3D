export type AssessmentPhase = 'pre' | 'post';
export type Concept = 'equivalence' | 'bar-total' | 'rest-time' | 'tempo-ratio' | 'length-properties';

export type QuizOption = Readonly<{ id: string; label: string }>;
export type QuizQuestion = Readonly<{
  id: string;
  concept: Concept;
  prompt: string;
  options: readonly QuizOption[];
  correctOptionId: string;
  explanation: string;
}>;

/** Local concept questions, not a listening test or an automatic free-text rubric. */
export const preQuestions: readonly QuizQuestion[] = [
  {
    id: 'pre-equivalence', concept: 'equivalence',
    prompt: '2분음표 하나와 같은 길이를 만들려면 8분음표가 몇 개 필요할까요?',
    options: [{ id: 'two', label: '2개' }, { id: 'four', label: '4개' }, { id: 'eight', label: '8개' }],
    correctOptionId: 'four',
    explanation: '온음표 기준 1/8을 네 번 더하면 1/2입니다. 2분음표 1개와 8분음표 4개의 총길이가 같습니다.',
  },
  {
    id: 'pre-bar-total', concept: 'bar-total',
    prompt: '4/4에서 2분음표 + 4분음표 + 8분음표 + 8분음표를 넣으면 한 마디가 어떻게 될까요?',
    options: [
      { id: 'short', label: '온음표 기준 1/8만큼 부족해요' },
      { id: 'full', label: '한 마디를 정확히 채워요' },
      { id: 'over', label: '온음표 기준 1/4만큼 넘어요' },
    ],
    correctOptionId: 'full',
    explanation: '1/2 + 1/4 + 1/8 + 1/8 = 1입니다. 이 4/4 한 마디의 길이는 온음표 기준 1입니다.',
  },
  {
    id: 'pre-rest-time', concept: 'rest-time',
    prompt: '음표 뒤에 4분쉼표가 있습니다. 쉼표 구간에서 재생선은 어떻게 움직여야 할까요?',
    options: [
      { id: 'stop', label: '쉼표가 끝날 때까지 멈춰요' },
      { id: 'skip', label: '쉼표를 건너뛰어요' },
      { id: 'continue', label: '같은 속도로 계속 움직여요' },
    ],
    correctOptionId: 'continue',
    explanation: '쉼표는 소리가 없는 시간입니다. 음원은 시작하지 않지만 시간과 재생선은 계속 진행합니다.',
  },
  {
    id: 'pre-tempo-ratio', concept: 'tempo-ratio',
    prompt: '4분음표 = 60과 120에서 온음표와 4분음표의 길이 비율은 어떻게 될까요?',
    options: [
      { id: 'same-ratio', label: '두 템포 모두 4:1이에요' },
      { id: 'double-ratio', label: '120에서는 8:1이에요' },
      { id: 'equal-ratio', label: '120에서는 1:1이에요' },
    ],
    correctOptionId: 'same-ratio',
    explanation: '템포는 실제 초 단위 시간을 바꿉니다. 온음표의 음가는 1, 4분음표는 1/4이므로 두 템포에서 비율은 4:1입니다.',
  },
  {
    id: 'pre-length-properties', concept: 'length-properties',
    prompt: '같은 C4와 같은 음량 설정에서 온음표 길이를 4분음표 길이로 바꾸면 무엇이 바뀔까요?',
    options: [
      { id: 'higher', label: '음높이도 높아져요' },
      { id: 'louder', label: '음량 설정도 커져요' },
      { id: 'length-only', label: '길이가 바뀌고 음높이·음량 설정은 그대로예요' },
    ],
    correctOptionId: 'length-only',
    explanation: '이 실험에서는 길이만 바꿉니다. C4와 음량 설정은 같습니다. 짧은 소리의 체감 크기 차이를 설정값의 변화와 구별해요.',
  },
];

export const postQuestions: readonly QuizQuestion[] = [
  {
    id: 'post-equivalence', concept: 'equivalence',
    prompt: '4분음표 하나를 같은 총길이의 16분음표들로 바꾸려면 몇 개가 필요할까요?',
    options: [{ id: 'two', label: '2개' }, { id: 'four', label: '4개' }, { id: 'sixteen', label: '16개' }],
    correctOptionId: 'four',
    explanation: '온음표 기준 1/16 × 4 = 1/4입니다. 음표가 시작하는 횟수는 달라도 총길이는 같을 수 있어요.',
  },
  {
    id: 'post-bar-total', concept: 'bar-total',
    prompt: '4/4에 4분음표 3개와 8분음표 1개를 넣었습니다. 한 마디까지 얼마가 남을까요?',
    options: [
      { id: 'full', label: '남지 않아요. 이미 한 마디예요' },
      { id: 'eighth-left', label: '온음표 기준 1/8이 남아요' },
      { id: 'quarter-left', label: '온음표 기준 1/4이 남아요' },
    ],
    correctOptionId: 'eighth-left',
    explanation: '1/4 + 1/4 + 1/4 + 1/8 = 7/8입니다. 한 마디 길이 1에서 빼면 1/8이 남습니다.',
  },
  {
    id: 'post-rest-time', concept: 'rest-time',
    prompt: '4분음표 = 60에서 4분음표·4분쉼표·4분음표 순서입니다. 두 번째 소리는 시작 후 언제 울릴까요?',
    options: [{ id: 'one-second', label: '1초 후' }, { id: 'two-seconds', label: '2초 후' }, { id: 'three-seconds', label: '3초 후' }],
    correctOptionId: 'two-seconds',
    explanation: '4분음표 1초 다음에 4분쉼표 1초가 지납니다. 쉼표도 시간을 차지하므로 두 번째 소리는 2초 후 시작합니다.',
  },
  {
    id: 'post-tempo-ratio', concept: 'tempo-ratio',
    prompt: '4분음표 = 120에서 60으로 바꿉니다. 온음표의 실제 시간과 음가 비율은 어떻게 될까요?',
    options: [
      { id: 'two-to-four', label: '2초에서 4초가 되고, 온음표:4분음표 비율은 4:1이에요' },
      { id: 'four-to-two', label: '4초에서 2초가 되고, 비율은 4:1이에요' },
      { id: 'ratio-changes', label: '2초에서 4초가 되고, 비율도 8:1로 바뀌어요' },
    ],
    correctOptionId: 'two-to-four',
    explanation: '4분음표 = 120의 한 마디는 2초, 60의 한 마디는 4초입니다. 음가 1과 1/4의 비율은 계속 4:1입니다.',
  },
  {
    id: 'post-length-properties', concept: 'length-properties',
    prompt: 'C4와 음량 설정을 유지하며 8분음표 하나를 16분음표 하나로 바꾸면 어떻게 될까요?',
    options: [
      { id: 'half-length', label: '길이는 절반이 되고, 음높이·음량 설정은 같아요' },
      { id: 'lower-pitch', label: '음높이가 절반만큼 낮아져요' },
      { id: 'half-gain', label: '음량 설정도 자동으로 절반이 돼요' },
    ],
    correctOptionId: 'half-length',
    explanation: '1/8의 절반은 1/16입니다. 길이를 바꾸는 조작과 음높이·음량 설정은 각각 다른 속성입니다.',
  },
];

export type AnswerResult = Readonly<{
  questionId: string;
  concept: Concept;
  selectedOptionId: string | null;
  answered: boolean;
  correct: boolean;
  explanation: string;
}>;

export type AssessmentResult = Readonly<{
  phase: AssessmentPhase;
  total: number;
  answered: number;
  correct: number;
  complete: boolean;
  results: readonly AnswerResult[];
}>;

export function questionsForPhase(phase: AssessmentPhase): readonly QuizQuestion[] {
  if (phase === 'pre') return preQuestions;
  if (phase === 'post') return postQuestions;
  throw new RangeError('Unsupported assessment phase.');
}

/** Scoring is deterministic, side-effect free and limited to listed choices. */
export function assessAnswers(
  phase: AssessmentPhase,
  answers: Readonly<Record<string, string | undefined>>,
): AssessmentResult {
  const questions = questionsForPhase(phase);
  const results = questions.map(question => {
    const selected = Object.hasOwn(answers, question.id) ? answers[question.id] : undefined;
    const answered = typeof selected === 'string' && question.options.some(option => option.id === selected);
    return {
      questionId: question.id,
      concept: question.concept,
      selectedOptionId: answered ? selected : null,
      answered,
      correct: answered && selected === question.correctOptionId,
      explanation: question.explanation,
    };
  });
  const answered = results.filter(result => result.answered).length;
  return {
    phase,
    total: questions.length,
    answered,
    correct: results.filter(result => result.correct).length,
    complete: answered === questions.length,
    results,
  };
}
