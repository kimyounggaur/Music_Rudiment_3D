import type { SceneId } from '../types.ts';

/**
 * v3 R3: sentences shared by the printed 3D pages (content/pages/lessonPages.ts) and the 2D
 * reading pages (book/LessonPages.tsx), so both paths print the same words. Scene text proper
 * (titles, questions, alternatives) stays in content/lesson.ts.
 */
export const RUNNING_HEADS = Object.freeze({ left: '음악이론 교과서 · 음가', right: '들어 보고 · 나누어 보고' });

export const EXPERIMENT_TITLES: Readonly<Record<SceneId, string>> = Object.freeze({
  'scene-1': '끝나는 순간을 비교해요', 'scene-2': '한 음표를 둘로', 'scene-3': '절반을 다르게 채워요',
  'scene-4': '소리 없는 시간도 이어져요', 'scene-5': '같은 음가, 다른 속도', 'scene-6': '한 마디를 만들어요',
});

export const listenLabel = (sceneId: SceneId, laneId: string) => sceneId === 'scene-1'
  ? laneId === 'upper' ? '위 줄 듣기' : '아래 줄 듣기'
  : sceneId === 'scene-3' ? `과제 ${laneId} 듣기` : '내 리듬 듣기';

/** Scene 1 explains each comparison lane under its staff. */
export const laneCaption = (sceneId: SceneId, laneId: string): string | null => sceneId === 'scene-1'
  ? laneId === 'upper' ? '한 번 시작해서 길게 · 온음표 1개' : '네 번 시작해서 짧게 · 4분음표 4개' : null;

export const PAGE_TEXT = Object.freeze({
  pause: '잠깐 멈춤',
  resume: '이어 듣기',
  stop: '정지',
  transportHelp: '잠깐 멈춘 뒤 이어 들을 수 있어요. 음표 선택·수정은 정지 후 해 주세요.',
  axisCaption: '가로 길이는 소리의 시간이에요.',
  halfTarget: '가운데 가이드가 목표 1/2예요. 빈 과제는 아직 재생할 수 없어요.',
  emptyDraft: '빈 초안 · 아직 음표나 쉼표를 넣지 않았어요.',
  questions: '생각을 확인해요',
  /** v3 R5: the answer flap on question pages and its stamp. */
  answer: '정답 보기',
  answerHint: '정답 보기 · 종이를 들어 올려 보세요',
  answerFold: '다시 덮기 · 종이를 눌러 내려요',
  closeLook: '가까이 보기',
  backToReading: '돌아오기',
  alternative: '소리 없이 살펴보기',
  observed: '두 줄 설명을 확인했어요',
  soundless: '소리 없는 설명으로도 계속할 수 있어요.',
});

/** v3 R5: the stamp under a page's questions (all answered correctly → '확인'). */
export const questionStampLabel = (count: number) => count === 3 ? '세 문항 확인' : `문항 ${count}개 확인`;
/** v3 R5: one line of the answer flap: the question, its correct choice and why. */
export const answerLine = (prompt: string, correct: string, explanation: string) => `${prompt} → ${correct}. ${explanation}`;
