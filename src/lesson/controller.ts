import { add, cmp, div, eq, frac, sum } from '../domain/index.ts';
import type { Fraction } from '../domain/index.ts';
import { getScene, lessonContent, makePattern, notationForDuration } from '../content/lesson.ts';
import { assessPattern, validateEvents } from '../content/validation.ts';
import type { Assessment } from '../content/validation.ts';
import type { MusicEvent, SceneDefinition, SceneId, Task } from '../content/types.ts';

type Snapshot = Readonly<{ events: readonly MusicEvent[]; selectedEventId: string | null }>;
export type PatternState = Readonly<{ events: readonly MusicEvent[]; past: readonly Snapshot[]; future: readonly Snapshot[] }>;
export type SceneState = Readonly<{
  activeLaneId: string; patterns: Readonly<Record<string, PatternState>>; selectedEventId: string | null;
  answers: Readonly<Record<string, string>>; observedDurations: readonly string[];
  observedLanes: Readonly<Record<string, 'text' | 'listened'>>; explanationSelfCheck: boolean; tempo: number;
}>;
export type LessonState = Readonly<{
  currentSceneId: SceneId; scenes: Readonly<Record<SceneId, SceneState>>; supportLevel: 1 | 2 | 3;
  nextId: number; revision: number; feedback: string;
}>;
export type LessonCommand =
  | Readonly<{ type: 'restore'; state: LessonState }>
  | Readonly<{ type: 'navigate'; sceneId: SceneId }>
  | Readonly<{ type: 'select'; id: string }>
  | Readonly<{ type: 'selectLane'; laneId: string }>
  | Readonly<{ type: 'split'; id?: string }>
  | Readonly<{ type: 'merge'; ids: readonly [string, string] }>
  | Readonly<{ type: 'add'; duration: Fraction; kind: 'note' | 'rest' }>
  | Readonly<{ type: 'remove' | 'toggle'; id?: string }>
  | Readonly<{ type: 'undo' | 'redo' | 'resetScene' }>
  | Readonly<{ type: 'answer'; questionId: string; value: string }>
  | Readonly<{ type: 'observeLane'; laneId: string; mode: 'text' | 'listened' }>
  | Readonly<{ type: 'setTempo'; bpm: 60 | 90 | 120 }>
  | Readonly<{ type: 'setSupport'; level: 1 | 2 | 3 }>
  | Readonly<{ type: 'explain'; checked: boolean }>;

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freezeDeep); Object.freeze(value); }
  return value;
}
function initialScene(scene: SceneDefinition): SceneState {
  return {
    activeLaneId: scene.lanes[0]!.laneId,
    patterns: Object.fromEntries(scene.lanes.map(lane => [lane.laneId, { events: lane.events, past: [], future: [] }])),
    selectedEventId: scene.lanes[0]!.events[0]?.id ?? null, answers: {}, observedDurations: ['1/1'], observedLanes: {}, explanationSelfCheck: false, tempo: scene.sceneId === 'scene-5' ? 60 : scene.tempo.bpm,
  };
}
export function createLessonState(): LessonState {
  return freezeDeep({ currentSceneId: 'scene-1', scenes: Object.fromEntries(lessonContent.scenes.map(scene => [scene.sceneId, initialScene(scene)])) as Record<SceneId, SceneState>, supportLevel: 1, nextId: 1, revision: 0, feedback: '' });
}
export function sceneState(state: LessonState, id: SceneId = state.currentSceneId): SceneState { return state.scenes[id]; }
export function sceneEvents(state: LessonState, id: SceneId = state.currentSceneId, laneId?: string): readonly MusicEvent[] {
  const current = sceneState(state, id);
  return current.patterns[laneId ?? current.activeLaneId]?.events ?? [];
}
export function taskForScene(state: LessonState, id: SceneId = state.currentSceneId, laneId?: string): Task {
  const scene = getScene(id);
  if (id !== 'scene-3') return scene.task;
  const lane = laneId ?? sceneState(state, id).activeLaneId;
  return lane === 'A' ? { target: frac(1, 2), onlyDuration: frac(1, 4) } : lane === 'B' ? { target: frac(1, 2), onlyDuration: frac(1, 8) } : { target: frac(1, 2), minimumDurationKinds: 2 };
}
export function currentAssessment(state: LessonState, id: SceneId = state.currentSceneId, laneId?: string): Assessment {
  return assessPattern(sceneEvents(state, id, laneId), taskForScene(state, id, laneId));
}
export function isSceneComplete(state: LessonState, id: SceneId = state.currentSceneId): boolean {
  const current = sceneState(state, id);
  const questionsCorrect = getScene(id).questions.every(q => current.answers[q.id] === q.correctValue);
  if (id === 'scene-1') return ['upper', 'lower'].every(x => !!current.observedLanes[x]) && questionsCorrect;
  if (id === 'scene-2') return ['1/2', '1/4', '1/8', '1/16'].every(x => current.observedDurations.includes(x)) && questionsCorrect;
  if (id === 'scene-3') return ['A', 'B', 'C'].every(x => currentAssessment(state, id, x).success);
  if (id === 'scene-6') return currentAssessment(state, id).success && current.explanationSelfCheck;
  return currentAssessment(state, id).success && questionsCorrect;
}
function updateScene(state: LessonState, current: SceneState, feedback = '', nextId = state.nextId): LessonState {
  return freezeDeep({ ...state, scenes: { ...state.scenes, [state.currentSceneId]: current }, nextId, revision: state.revision + 1, feedback });
}
function fail(state: LessonState, feedback: string): LessonState { return freezeDeep({ ...state, feedback }); }
function reflow(events: readonly MusicEvent[]): readonly MusicEvent[] {
  let onset = frac(0, 1);
  return events.map(event => { const next = { ...event, onset }; onset = add(onset, event.duration); return next; });
}
function observe(current: SceneState, event: MusicEvent | undefined): SceneState {
  if (!event) return current;
  const key = `${event.duration.n}/${event.duration.d}`;
  return current.observedDurations.includes(key) ? current : { ...current, observedDurations: [...current.observedDurations, key] };
}
function commit(state: LessonState, events: readonly MusicEvent[], selectedEventId: string | null, feedback: string, nextId = state.nextId): LessonState {
  const current = sceneState(state);
  const validation = validateEvents(reflow(events));
  if (!validation.valid) return fail(state, validation.errors[0]!.message);
  const old = current.patterns[current.activeLaneId]!;
  const pattern = { events: validation.events!, past: [...old.past.slice(-99), { events: old.events, selectedEventId: current.selectedEventId }], future: [] };
  let changed: SceneState = { ...current, patterns: { ...current.patterns, [current.activeLaneId]: pattern }, selectedEventId };
  changed = observe(changed, pattern.events.find(x => x.id === selectedEventId));
  return updateScene(state, changed, feedback, nextId);
}
const editTypes = new Set(['split', 'merge', 'add', 'remove', 'toggle', 'undo', 'redo', 'resetScene', 'setTempo']);
export function reduceLesson(state: LessonState, command: LessonCommand, options: Readonly<{ playing?: boolean }> = {}): LessonState {
  if (!command || typeof command !== 'object') return fail(state, '알 수 없는 조작입니다.');
  if (command.type === 'restore') {
    try {
      const restored = restoreLessonState(serializeLearning(command.state), state);
      return freezeDeep({ ...restored, revision: state.revision + 1 });
    } catch { return fail(state, '복구할 학습 상태를 확인하세요. 기존 리듬을 유지합니다.'); }
  }
  if (options.playing && editTypes.has(command.type)) return fail(state, '정지 후 수정할 수 있어요.');
  const current = sceneState(state);
  const events = sceneEvents(state);
  const content = getScene(state.currentSceneId);
  const isEditable = content.lanes.find(x => x.laneId === current.activeLaneId)?.role === 'draft';
  if (['split', 'merge', 'add', 'remove', 'toggle'].includes(command.type) && !isEditable) return fail(state, '이 장면은 비교용 리듬입니다.');
  if (command.type === 'navigate') {
    if (!lessonContent.scenes.some(x => x.sceneId === command.sceneId)) return fail(state, '알 수 없는 장면입니다.');
    return freezeDeep({ ...state, currentSceneId: command.sceneId, revision: state.revision + 1, feedback: '' });
  }
  if (command.type === 'selectLane') {
    if (!current.patterns[command.laneId]) return fail(state, '알 수 없는 레인입니다.');
    return updateScene(state, { ...current, activeLaneId: command.laneId, selectedEventId: current.patterns[command.laneId]!.events[0]?.id ?? null });
  }
  if (command.type === 'select') {
    const event = events.find(x => x.id === command.id);
    if (!event) return fail(state, '선택할 블록을 찾을 수 없어요.');
    return updateScene(state, observe({ ...current, selectedEventId: command.id }, event));
  }
  if (command.type === 'setSupport') {
    if (![1, 2, 3].includes(command.level)) return fail(state, '지원 수준은1~3입니다.');
    return freezeDeep({ ...state, supportLevel: command.level, revision: state.revision + 1, feedback: '지원 수준을 바꿨어요. 만든 리듬은 유지됩니다.' });
  }
  if (command.type === 'observeLane') {
    if (!current.patterns[command.laneId] || !['text', 'listened'].includes(command.mode)) return fail(state, '관찰 기록을 확인하세요.');
    const old = current.observedLanes[command.laneId];
    return updateScene(state, { ...current, observedLanes: { ...current.observedLanes, [command.laneId]: old === 'listened' ? old : command.mode } }, command.mode === 'text' ? '소리 없는 설명을 확인했어요. 청취 기록과 구분합니다.' : '레인 재생을 끝까지 확인했어요.');
  }
  if (command.type === 'answer') {
    const question = content.questions.find(x => x.id === command.questionId);
    if (!question || !question.options.some(x => x.value === command.value)) return fail(state, '문항과 선택지를 확인하세요.');
    return updateScene(state, { ...current, answers: { ...current.answers, [command.questionId]: command.value } }, command.value === question.correctValue ? question.explanation : '다시 관찰하고 비교해 보세요. ' + question.explanation);
  }
  if (command.type === 'explain') return updateScene(state, { ...current, explanationSelfCheck: command.checked }, command.checked ? '설명을 스스로 확인했어요. 자동 의미 채점은 하지 않습니다.' : '설명 자기 확인을 해제했어요.');
  if (command.type === 'setTempo') {
    if (state.currentSceneId !== 'scene-5' || ![60, 120].includes(command.bpm)) return fail(state, '비교 장면에서60과120을 선택하세요.');
    return updateScene(state, { ...current, tempo: command.bpm }, '템포를 바꿨어요. 음가 비율은 그대로예요.');
  }
  if (command.type === 'resetScene') return updateScene(state, initialScene(content), '현재 장면을 초기화했어요. 다른 장면은 유지됩니다.');
  if (command.type === 'undo' || command.type === 'redo') {
    const pattern = current.patterns[current.activeLaneId]!;
    const stack = command.type === 'undo' ? pattern.past : pattern.future;
    const target = stack.at(-1);
    if (!target) return fail(state, command.type === 'undo' ? '되돌릴 조작이 없어요.' : '다시 할 조작이 없어요.');
    const snapshot = { events: pattern.events, selectedEventId: current.selectedEventId };
    const nextPattern = command.type === 'undo' ? { events: target.events, past: pattern.past.slice(0, -1), future: [...pattern.future, snapshot] } : { events: target.events, past: [...pattern.past, snapshot], future: pattern.future.slice(0, -1) };
    return updateScene(state, { ...current, patterns: { ...current.patterns, [current.activeLaneId]: nextPattern }, selectedEventId: target.selectedEventId && target.events.some(x => x.id === target.selectedEventId) ? target.selectedEventId : target.events[0]?.id ?? null }, command.type === 'undo' ? '되돌렸어요. 현재 조건을 다시 확인합니다.' : '다시 했어요. 현재 조건을 다시 확인합니다.');
  }
  if (command.type === 'add') {
    if (!['scene-3', 'scene-6'].includes(state.currentSceneId)) return fail(state, '이 장면에서는 추가할 수 없어요.');
    if (!['note', 'rest'].includes(command.kind)) return fail(state, '음표 또는 쉼표를 선택하세요.');
    let normalized: Fraction;
    try { normalized = frac(command.duration.n, command.duration.d); notationForDuration(normalized); } catch { return fail(state, '지원하지 않는 음가입니다.'); }
    if (state.currentSceneId === 'scene-3' && (! [4, 8, 16].includes(normalized.d) || command.kind !== 'note')) return fail(state, '조합 과제는1/4·1/8·1/16 음표를 사용해요.');
    const total = add(sum(events.map(x => x.duration)), normalized);
    if (cmp(total, frac(1, 1)) > 0) { const excess = add(total, frac(-1, 1)); return fail(state, `한 마디를${excess.n}/${excess.d}만큼 넘어서 추가하지 않았어요.`); }
    const id = `edit-${state.currentSceneId}-${current.activeLaneId}-${state.nextId}`;
    const event = makePattern(id, [{ duration: normalized, kind: command.kind }])[0]!;
    return commit(state, [...events, { ...event, id }], id, '블록을 추가했어요.', state.nextId + 1);
  }
  if (command.type === 'split') {
    if (state.currentSceneId !== 'scene-2') return fail(state, '분할은 절반씩 나누기 장면에서 해요.');
    const id = command.id ?? current.selectedEventId;
    const index = events.findIndex(x => x.id === id);
    const event = events[index];
    if (!event) return fail(state, '나눌 블록을 선택하세요.');
    if (cmp(event.duration, frac(1, 16)) <= 0) return fail(state, '16분음표보다 작게 나눌 수 없어요.');
    const half = div(event.duration, frac(2, 1));
    const childId = `edit-${state.currentSceneId}-${current.activeLaneId}-${state.nextId}`;
    const children = makePattern(childId, [{ duration: half }, { duration: half }]);
    return commit(state, [...events.slice(0, index), ...children, ...events.slice(index + 1)], children[0]!.id, '선택한 길이를 둘로 나눴어요. 전체 합은 같아요.', state.nextId + 1);
  }
  if (command.type === 'merge') {
    if (state.currentSceneId !== 'scene-2' || !Array.isArray(command.ids) || command.ids.length !== 2) return fail(state, '이웃한 두 음표를 선택하세요.');
    const first = events.findIndex(x => x.id === command.ids[0]);
    const second = events.findIndex(x => x.id === command.ids[1]);
    const index = Math.min(first, second);
    const a = events[index]; const b = events[index + 1];
    if (index < 0 || Math.abs(first - second) !== 1 || !a || !b || a.kind !== 'note' || b.kind !== 'note' || !eq(a.duration, b.duration) || a.pitch.step !== b.pitch.step || a.pitch.alter !== b.pitch.alter || a.pitch.octave !== b.pitch.octave) return fail(state, '이웃한 같은 길이·같은 음높이의 음표 두 개만 합쳐요.');
    const duration = add(a.duration, b.duration);
    let notation;
    try { notation = notationForDuration(duration); } catch { return fail(state, '합친 길이는 지원하지 않아요.'); }
    const id = `edit-${state.currentSceneId}-${current.activeLaneId}-${state.nextId}`;
    return commit(state, [...events.slice(0, index), { ...a, id, duration, notation }, ...events.slice(index + 2)], id, '두 어택을 하나로 합쳤어요. 붙임줄과는 다른 조작이에요.', state.nextId + 1);
  }
  if (command.type === 'remove' || command.type === 'toggle') {
    if (!['scene-3', 'scene-4', 'scene-6'].includes(state.currentSceneId) || command.type === 'remove' && state.currentSceneId === 'scene-4' || command.type === 'toggle' && state.currentSceneId === 'scene-3') return fail(state, '이 장면에서 허용하지 않는 조작이에요.');
    const id = command.id ?? current.selectedEventId;
    const index = events.findIndex(x => x.id === id);
    const event = events[index];
    if (!event) return fail(state, '변경할 블록을 선택하세요.');
    if (command.type === 'remove') {
      const remaining = events.filter(x => x.id !== id);
      return commit(state, remaining, remaining[Math.min(index, remaining.length - 1)]?.id ?? null, '블록을 지웠어요. 현재 조건을 다시 확인합니다.');
    }
    const base = { id: event.id, onset: event.onset, duration: event.duration, notation: event.notation };
    const toggled: MusicEvent = event.kind === 'note' ? { ...base, kind: 'rest' } : { ...base, kind: 'note', pitch: { step: 'C', alter: 0, octave: 4 } };
    return commit(state, events.map((x, i) => i === index ? toggled : x), event.id, '길이는 유지하고 음표와 쉼표를 바꿨어요.');
  }
  return fail(state, '알 수 없는 조작입니다.');
}

export type LearningSnapshot = Readonly<{
  studentPatterns: Readonly<Record<string, readonly MusicEvent[]>>;
  sceneProgress: Readonly<Record<string, Readonly<{ answers: Readonly<Record<string, string>>; observedDurations: readonly string[]; observedLanes: Readonly<Record<string, 'text' | 'listened'>>; explanationSelfCheck: boolean }>>>;
  supportLevel: 1 | 2 | 3;
  preferences: Readonly<{ currentSceneId: SceneId }>;
}>;
export function serializeLearning(state: LessonState): LearningSnapshot {
  const studentPatterns: Record<string, readonly MusicEvent[]> = {};
  const sceneProgress: Record<string, { answers: Readonly<Record<string, string>>; observedDurations: readonly string[]; observedLanes: Readonly<Record<string, 'text' | 'listened'>>; explanationSelfCheck: boolean }> = {};
  for (const definition of lessonContent.scenes) {
    const scene = sceneState(state, definition.sceneId);
    for (const lane of definition.lanes) studentPatterns[`${definition.sceneId}/${lane.laneId}`] = scene.patterns[lane.laneId]!.events;
    sceneProgress[definition.sceneId] = { answers: scene.answers, observedDurations: scene.observedDurations, observedLanes: scene.observedLanes, explanationSelfCheck: scene.explanationSelfCheck };
  }
  return freezeDeep({ studentPatterns, sceneProgress, supportLevel: state.supportLevel, preferences: { currentSceneId: state.currentSceneId } });
}
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export type RestoreOutcome = Readonly<{ ok: true; state: LessonState }> | Readonly<{ ok: false; message: string }>;
export function tryRestoreLessonState(input: unknown, fallbackState?: LessonState): RestoreOutcome {
  const fresh = fallbackState ?? createLessonState();
  const reject = (message: string): RestoreOutcome => ({ ok: false, message });
  if (!isObject(input) || !isObject(input.studentPatterns) || !isObject(input.sceneProgress)) return reject('저장 구조를 복구할 수 없어 기존 상태를 유지합니다.');
  const scenes = { ...fresh.scenes };
  const allIds = new Set<string>();
  let maximumId = 0;
  for (const definition of lessonContent.scenes) {
    let scene: SceneState = { ...fresh.scenes[definition.sceneId] };
    const patterns = { ...scene.patterns };
    for (const lane of definition.lanes) {
      const key = `${definition.sceneId}/${lane.laneId}`;
      const raw = input.studentPatterns[key];
      const result = validateEvents(raw === undefined ? lane.events : raw);
      if (!result.valid) return reject(`저장된${key}리듬을복구할수없어기존상태를유지합니다.`);
      for (const event of result.events!) {
        if (allIds.has(event.id)) return reject('저장된이벤트ID가중복되어복구하지않았습니다.');
        allIds.add(event.id);
        const match = /^edit-scene-[1-6]-[A-Za-z]+-(\d+)(?:-[12])?$/.exec(event.id);
        if (match) {
          const parsed = Number(match[1]);
          if (!Number.isSafeInteger(parsed) || parsed > 1_000_000) return reject('저장된편집ID범위를확인하세요.');
          maximumId = Math.max(maximumId, parsed);
        }
      }
      if (lane.role === 'reference' && JSON.stringify(result.events) !== JSON.stringify(lane.events)) return reject('비교용원본리듬이변경되어복구하지않았습니다.');
      if (definition.sceneId === 'scene-2' && !eq(sum(result.events!.map(x => x.duration)), frac(1, 1))) return reject('분할장면의전체길이가올바르지않습니다.');
      patterns[lane.laneId] = { events: result.events!, past: [], future: [] };
    }
    const progress = input.sceneProgress[definition.sceneId];
    if (progress !== undefined && !isObject(progress)) return reject('저장된진행기록을확인하세요.');
    const answers: Record<string, string> = {};
    if (isObject(progress) && isObject(progress.answers)) for (const question of definition.questions) {
      const value = progress.answers[question.id];
      if (typeof value === 'string' && question.options.some(x => x.value === value)) answers[question.id] = value;
    }
    const observedDurations = isObject(progress) && Array.isArray(progress.observedDurations) ? progress.observedDurations.filter((x): x is string => typeof x === 'string' && ['1/1', '1/2', '1/4', '1/8', '1/16'].includes(x)) : [];
    const observedLanes: Record<string, 'text' | 'listened'> = {};
    if (isObject(progress) && isObject(progress.observedLanes)) for (const lane of definition.lanes) {
      const mode = progress.observedLanes[lane.laneId];
      if (mode === 'text' || mode === 'listened') observedLanes[lane.laneId] = mode;
    }
    scene = { ...scene, patterns, selectedEventId: patterns[scene.activeLaneId]!.events[0]?.id ?? null, answers, observedDurations: [...new Set(observedDurations)], observedLanes, explanationSelfCheck: isObject(progress) && progress.explanationSelfCheck === true };
    scenes[definition.sceneId] = scene;
  }
  const supportLevel = [1, 2, 3].includes(input.supportLevel as number) ? input.supportLevel as 1 | 2 | 3 : 1;
  const candidate = isObject(input.preferences) ? input.preferences.currentSceneId : undefined;
  const currentSceneId = lessonContent.scenes.some(x => x.sceneId === candidate) ? candidate as SceneId : fresh.currentSceneId;
  return { ok: true, state: freezeDeep({ ...fresh, scenes, currentSceneId, supportLevel, nextId: maximumId + 1, feedback: '이기기에저장된학습을복구했어요. 소리는자동재생하지않습니다.' }) };
}
export function restoreLessonState(input: unknown, fallback: LessonState = createLessonState()): LessonState {
  const result = tryRestoreLessonState(input, fallback);
  return result.ok ? result.state : fail(fallback, result.message);
}
