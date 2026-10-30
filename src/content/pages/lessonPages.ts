import { durationChoices, durationLabel, getScene } from '../lesson.ts';
import type { SceneId } from '../types.ts';
import { eq, frac, sum } from '../../domain/index.ts';
import { currentAssessment, isSceneComplete, sceneEvents, sceneState } from '../../lesson/controller.ts';
import type { LessonCommand } from '../../lesson/controller.ts';
import { lessonPageNumber, lessonTempoTiming } from '../../book/lessonPresentation.ts';
import type { HotspotCommand, PageBlock, PageContext, PageSpec, PrintedButton } from '../../book/print/pageSpec.ts';
import type { PageId } from '../../book/manifest.ts';
import { answerLine, EXPERIMENT_TITLES, laneCaption, listenLabel, PAGE_TEXT, questionStampLabel, RUNNING_HEADS } from './pageText.ts';

/**
 * v3 R3 printed lesson pages. Same text and commands as the 2D reading pages (LessonPages.tsx);
 * global controls (reading mode, sound, records) live on the toolbar outside the book (C1).
 */
const playing = (context: PageContext) => ['starting', 'playing', 'paused'].includes(context.playback.state);
/** Same rule as lessonEditsAllowed: edits wait until playback is stopped. */
const editable = (context: PageContext) => context.interactive && !playing(context);
const lesson = (...commands: LessonCommand[]): HotspotCommand => ({ type: 'lesson', commands });
const events = (context: PageContext, laneId?: string) => sceneEvents(context.lesson, context.sceneId, laneId);
const current = (context: PageContext) => sceneState(context.lesson, context.sceneId);

/**
 * Fraction of the page height reserved for the 3D figure, by lane count: the lanes' span plus the
 * block depth and the raised top faces (LESSON_FIGURE_RAISE_Z), with a small printed margin.
 */
/**
 * Page share reserved for the 3D figure. v3 R4: spreads 1 and 2 also carry an ink decor drawing under
 * their lanes (tests/book-lesson-scene checks every figure fits its window at the reading pose).
 */
const FIGURE_HEIGHT: Readonly<Partial<Record<SceneId, number>>> = Object.freeze({ 'scene-1': 0.39, 'scene-2': 0.18 });
const figureHeight = (sceneId: SceneId) => FIGURE_HEIGHT[sceneId] ?? (getScene(sceneId).lanes.length >= 3 ? 0.31 : getScene(sceneId).lanes.length === 2 ? 0.29 : 0.13);

function listenButtons(sceneId: SceneId): PrintedButton[] {
  const scene = getScene(sceneId);
  return [
    ...scene.lanes.map((lane): PrintedButton => ({
      id: `play-${lane.laneId}`, label: listenLabel(sceneId, lane.laneId), icon: 'play', testId: `play-${lane.laneId}`,
      command: { type: 'play', laneId: lane.laneId },
      enabled: context => events(context, lane.laneId).length > 0 && context.playback.state !== 'paused'
        && !(playing(context) && context.playback.laneId === lane.laneId),
    })),
    { id: 'pause', label: context => context.playback.state === 'paused' ? PAGE_TEXT.resume : PAGE_TEXT.pause, icon: 'pause', testId: 'pause-resume-audio',
      command: context => context.playback.state === 'paused' ? { type: 'resume' } : { type: 'pause' },
      enabled: context => context.playback.state === 'playing' || context.playback.state === 'paused' },
    { id: 'stop', label: PAGE_TEXT.stop, icon: 'stop', testId: 'stop-audio', command: { type: 'stop' }, enabled: playing },
  ];
}

function leftPage(sceneId: SceneId): PageSpec {
  const scene = getScene(sceneId);
  const blocks: PageBlock[] = [
    { kind: 'heading', level: 1, text: scene.title, focusTarget: true },
    { kind: 'paragraph', style: 'lead', text: scene.question },
    { kind: 'paragraph', style: 'meta', text: context => `4/4 · 4분음표 = ${current(context).tempo} · C4` },
    { kind: 'rule' },
  ];
  for (const lane of scene.lanes) {
    blocks.push({ kind: 'notation', laneId: lane.laneId, label: lane.label });
    const caption = laneCaption(sceneId, lane.laneId);
    if (caption) blocks.push({ kind: 'paragraph', style: 'caption', text: caption });
    if (['scene-2', 'scene-3', 'scene-4', 'scene-6'].includes(sceneId)) blocks.push({ kind: 'eventList', laneId: lane.laneId });
    if (sceneId === 'scene-3' || sceneId === 'scene-6') blocks.push({ kind: 'when', test: context => !events(context, lane.laneId).length,
      blocks: [{ kind: 'paragraph', style: 'note', text: PAGE_TEXT.emptyDraft }] });
  }
  if (sceneId === 'scene-6') blocks.push(...compositionChecks());
  if (scene.questions.length) {
    // v3 R5: the questions are printed on the page; the answers wait under a paper flap ('정답 보기',
    // saved as hints[`${sceneId}/answer`]) and all-correct answers earn a stamp (derived, no new field).
    blocks.push({ kind: 'heading', level: 3, text: PAGE_TEXT.questions });
    for (const question of scene.questions) blocks.push({ kind: 'question', questionId: question.id });
    blocks.push({ kind: 'flap', id: 'answer', hintKey: `${sceneId}/answer`, label: PAGE_TEXT.answer, cover: true, coverHint: PAGE_TEXT.answerHint, foldHint: PAGE_TEXT.answerFold,
      blocks: scene.questions.map((question): PageBlock => ({ kind: 'paragraph', style: 'caption',
        text: answerLine(question.prompt, question.options.find(option => option.value === question.correctValue)?.label ?? question.correctValue, question.explanation) })) });
    blocks.push({ kind: 'stampSlot', id: `${sceneId}-questions`, label: questionStampLabel(scene.questions.length),
      stamped: context => scene.questions.every(question => current(context).answers[question.id] === question.correctValue) });
  }
  return { pageId: `page-${lessonPageNumber(sceneId, 'left')}` as PageId, side: 'left', runningHead: RUNNING_HEADS.left, folio: lessonPageNumber(sceneId, 'left'), blocks };
}

function splitControls(): PageBlock[] {
  const selectedIndex = (context: PageContext) => events(context).findIndex(event => event.id === current(context).selectedEventId);
  const compatible = (context: PageContext, offset: -1 | 1) => {
    const list = events(context), index = selectedIndex(context);
    const selected = list[index], other = list[index + offset];
    return !!selected && !!other && selected.kind === 'note' && other.kind === 'note' && eq(selected.duration, other.duration)
      && selected.pitch.step === other.pitch.step && selected.pitch.alter === other.pitch.alter && selected.pitch.octave === other.pitch.octave;
  };
  const pattern = (context: PageContext) => current(context).patterns[current(context).activeLaneId];
  const canSplit = (context: PageContext) => { const selected = events(context)[selectedIndex(context)]; return !!selected && !eq(selected.duration, frac(1, 16)); };
  return [
    { kind: 'paragraph', style: 'body', live: true, text: context => {
      const index = selectedIndex(context), selected = events(context)[index];
      return selected ? `${index + 1}번째 ${durationLabel(selected.duration, selected.kind)} 선택` : '왼쪽 목록에서 음표를 선택하세요.';
    } },
    { kind: 'buttons', id: 'edit', label: '음표 나누기와 합치기', columns: 3, compact: true, buttons: [
      { id: 'split', label: '둘로 나누기', icon: 'split', testId: 'split-note', command: lesson({ type: 'split' }), enabled: context => editable(context) && canSplit(context) },
      { id: 'merge-before', label: '앞과 합치기', icon: 'merge', ariaLabel: '앞 음표와 합치기', enabled: context => editable(context) && compatible(context, -1),
        command: context => { const list = events(context), index = selectedIndex(context); return list[index - 1] && list[index] ? lesson({ type: 'merge', ids: [list[index - 1]!.id, list[index]!.id] }) : null; } },
      { id: 'merge-after', label: '뒤와 합치기', icon: 'merge', ariaLabel: '뒤 음표와 합치기', enabled: context => editable(context) && compatible(context, 1),
        command: context => { const list = events(context), index = selectedIndex(context); return list[index] && list[index + 1] ? lesson({ type: 'merge', ids: [list[index]!.id, list[index + 1]!.id] }) : null; } },
      { id: 'undo', label: '되돌리기', icon: 'undo', command: lesson({ type: 'undo' }), enabled: context => editable(context) && !!pattern(context)?.past.length },
      { id: 'redo', label: '다시 하기', icon: 'redo', command: lesson({ type: 'redo' }), enabled: context => editable(context) && !!pattern(context)?.future.length },
    ] },
    { kind: 'paragraph', style: 'caption', text: context => { const total = sum(events(context).map(event => event.duration)); return `음표 ${events(context).length}개 · 전체 ${total.n}/${total.d} · 같은 길이와 음높이의 이웃 음표만 합칠 수 있어요.`; } },
    { kind: 'when', test: context => selectedIndex(context) >= 0 && !canSplit(context),
      blocks: [{ kind: 'paragraph', style: 'note', text: '16분음표까지 나눌 수 있어요. 다른 음표를 골라 보세요.' }] },
  ];
}

function combinationControls(): PageBlock[] {
  const scene = getScene('scene-3');
  const pattern = (context: PageContext) => current(context).patterns[current(context).activeLaneId];
  return [
    { kind: 'buttons', id: 'tasks', label: '조합 과제 선택', compact: true, buttons: scene.lanes.map((lane): PrintedButton => ({
      id: `task-${lane.laneId}`, label: `과제 ${lane.laneId}`, pressed: context => current(context).activeLaneId === lane.laneId,
      command: lesson({ type: 'selectLane', laneId: lane.laneId }), enabled: editable })) },
    { kind: 'paragraph', style: 'caption', text: 'A는 4분음표만 · B는 8분음표만 · C는 서로 다른 길이 2종 이상' },
    { kind: 'buttons', id: 'edit', label: '음표 추가와 고치기', columns: 3, compact: true, buttons: [
      ...durationChoices.filter(choice => [4, 8, 16].includes(choice.duration.d)).map((choice): PrintedButton => ({
        id: `add-${choice.type}`, label: `${choice.name} 추가`, icon: 'add', testId: `add-${choice.type}`,
        command: lesson({ type: 'add', kind: 'note', duration: choice.duration }), enabled: editable })),
      { id: 'remove', label: '선택 지우기', icon: 'remove', command: lesson({ type: 'remove' }), enabled: context => editable(context) && !!current(context).selectedEventId },
      { id: 'undo', label: '되돌리기', icon: 'undo', command: lesson({ type: 'undo' }), enabled: context => editable(context) && !!pattern(context)?.past.length },
      { id: 'redo', label: '다시 하기', icon: 'redo', command: lesson({ type: 'redo' }), enabled: context => editable(context) && !!pattern(context)?.future.length },
    ] },
    ...scene.lanes.map((lane): PageBlock => ({ kind: 'paragraph', style: 'caption', live: lane.laneId === 'A', text: context => {
      const assessment = currentAssessment(context.lesson, 'scene-3', lane.laneId);
      return `과제 ${lane.laneId} · 현재 ${assessment.total.n}/${assessment.total.d} / 목표 1/2 — ${assessment.message}`;
    } })),
    { kind: 'paragraph', style: 'body', text: context => isSceneComplete(context.lesson, 'scene-3') ? '세 과제의 현재 조건을 모두 만족했어요.' : '각 과제의 길이와 종류 조건을 확인해 보세요.' },
    { kind: 'stampSlot', id: 'scene-3', label: '세 과제 확인', stamped: context => isSceneComplete(context.lesson, 'scene-3') },
  ];
}

function restControls(): PageBlock[] {
  const selected = (context: PageContext) => events(context).find(event => event.id === current(context).selectedEventId);
  const pattern = (context: PageContext) => current(context).patterns[current(context).activeLaneId];
  return [
    { kind: 'paragraph', style: 'body', live: true, text: context => { const event = selected(context); return event ? `${durationLabel(event.duration, event.kind)} 선택 · 길이 ${event.duration.n}/${event.duration.d}` : '왼쪽 목록에서 음표나 쉼표를 선택하세요.'; } },
    { kind: 'buttons', id: 'edit', label: '음표와 쉼표 바꾸기', compact: true, buttons: [
      { id: 'toggle', label: context => selected(context)?.kind === 'rest' ? '같은 길이 음표로 바꾸기' : '같은 길이 쉼표로 바꾸기', icon: 'toggle',
        command: lesson({ type: 'toggle' }), enabled: context => editable(context) && !!selected(context) },
      { id: 'undo', label: '되돌리기', icon: 'undo', command: lesson({ type: 'undo' }), enabled: context => editable(context) && !!pattern(context)?.past.length },
      { id: 'redo', label: '다시 하기', icon: 'redo', command: lesson({ type: 'redo' }), enabled: context => editable(context) && !!pattern(context)?.future.length },
    ] },
    { kind: 'paragraph', style: 'caption', text: context => {
      const assessment = currentAssessment(context.lesson, context.sceneId);
      return `전체 ${assessment.total.n}/${assessment.total.d} · 쉼표 ${events(context).filter(event => event.kind === 'rest').length}개. ${assessment.message}`;
    } },
    { kind: 'paragraph', style: 'note', text: '쉼표는 점선 빈칸으로 나타나요. 소리 없는 구간에도 시간과 다음 음표의 시작 위치는 유지돼요.' },
  ];
}

function tempoControls(): PageBlock[] {
  const timing = (context: PageContext) => lessonTempoTiming(current(context).tempo === 120 ? 120 : 60);
  return [
    { kind: 'buttons', id: 'tempo', label: '템포 비교', compact: true, buttons: ([60, 120] as const).map((bpm): PrintedButton => ({
      id: `tempo-${bpm}`, label: `템포 ${bpm}`, pressed: context => current(context).tempo === bpm,
      command: lesson({ type: 'setTempo', bpm }), enabled: editable })) },
    { kind: 'paragraph', style: 'caption', text: '정지 후 템포를 바꿔요. 음표 종류와 블록의 상대 길이는 그대로예요.' },
    { kind: 'secondsAxis', ticks: context => timing(context).ticks.map(tick => `${tick}초`), label: context => `한 마디 ${timing(context).barSeconds}초 눈금` },
    { kind: 'paragraph', style: 'body', id: 'tempo-timing', text: context => `템포 ${current(context).tempo} · 한 마디(온음표) ${timing(context).barSeconds}초 · 4분음표 ${timing(context).quarterSeconds}초 · 비율 4:1` },
    { kind: 'paragraph', style: 'note', text: '60에서는 4초와 1초, 120에서는 2초와 0.5초예요. 왼쪽 질문에서 실제 시간과 비율을 구별해 보세요.' },
  ];
}

function compositionControls(): PageBlock[] {
  const selected = (context: PageContext) => events(context).find(event => event.id === current(context).selectedEventId);
  const pattern = (context: PageContext) => current(context).patterns[current(context).activeLaneId];
  return [
    { kind: 'buttons', id: 'kind', label: '추가할 종류', compact: true, buttons: (['note', 'rest'] as const).map((kind): PrintedButton => ({
      id: `kind-${kind}`, label: kind === 'note' ? '음표' : '쉼표', pressed: context => context.ui.composeKind === kind,
      command: { type: 'ui', patch: { composeKind: kind } }, enabled: editable })) },
    { kind: 'buttons', id: 'add', label: '음표와 쉼표 추가', columns: 3, compact: true, buttons: durationChoices.map((choice): PrintedButton => ({
      id: `add-${choice.type}`, label: context => `${context.ui.composeKind === 'rest' ? choice.restName : choice.name} 추가`, icon: 'add',
      testId: context => `compose-${context.ui.composeKind}-${choice.type}`,
      command: context => lesson({ type: 'add', kind: context.ui.composeKind, duration: choice.duration }), enabled: editable })) },
    { kind: 'buttons', id: 'edit', label: '고치기', columns: 2, compact: true, buttons: [
      { id: 'toggle', label: context => selected(context)?.kind === 'rest' ? '음표로 바꾸기' : '쉼표로 바꾸기', icon: 'toggle',
        ariaLabel: context => selected(context)?.kind === 'rest' ? '같은 길이 음표로 바꾸기' : '같은 길이 쉼표로 바꾸기',
        command: lesson({ type: 'toggle' }), enabled: context => editable(context) && !!selected(context) },
      { id: 'remove', label: '선택 지우기', icon: 'remove', command: lesson({ type: 'remove' }), enabled: context => editable(context) && !!selected(context) },
      { id: 'undo', label: '되돌리기', icon: 'undo', command: lesson({ type: 'undo' }), enabled: context => editable(context) && !!pattern(context)?.past.length },
      { id: 'redo', label: '다시 하기', icon: 'redo', command: lesson({ type: 'redo' }), enabled: context => editable(context) && !!pattern(context)?.future.length },
    ] },
  ];
}

/** Scene 6's conditions and self-check sit on the left page under the learner's bar. */
function compositionChecks(): PageBlock[] {
  return [
    { kind: 'checklist', id: 'conditions', label: '한 마디 현재 조건', items: context => {
      const assessment = currentAssessment(context.lesson, 'scene-6');
      return [
        { label: `합 ${assessment.total.n}/${assessment.total.d} / 목표 1`, done: eq(assessment.total, frac(1, 1)) },
        { label: `서로 다른 길이 ${assessment.durationKinds}종 / 2종 이상`, done: assessment.durationKinds >= 2 },
        { label: `쉼표 ${assessment.rests}개 / 1개 이상`, done: assessment.rests >= 1 },
      ];
    } },
    { kind: 'paragraph', style: 'caption', live: true, text: context => currentAssessment(context.lesson, 'scene-6').message },
    { kind: 'checkbox', id: 'explain', label: '길이와 쉼표의 시간을 설명했어요 (자기 확인)', checked: context => current(context).explanationSelfCheck,
      command: context => lesson({ type: 'explain', checked: !current(context).explanationSelfCheck }), enabled: editable },
    { kind: 'paragraph', style: 'note', text: '설명은 종이나 말로 해 보세요. 자유 문장을 자동 채점하지 않아요. 같은 길이의 음표와 쉼표는 음가 한 종류로 세요.' },
    { kind: 'paragraph', style: 'body', live: true, text: context => {
      const complete = isSceneComplete(context.lesson, 'scene-6');
      return complete ? '나의 한 마디 완성! 현재 세 조건과 설명 자기 확인을 만족했어요.'
        : currentAssessment(context.lesson, 'scene-6').success ? '음악 조건을 만족했어요. 이유를 설명하고 자기 확인해 보세요.' : '현재 리듬의 세 조건을 확인해 보세요. 빈 초안은 아직 정답이 아니에요.';
    } },
    { kind: 'stampSlot', id: 'scene-6', label: '나의 한 마디', stamped: context => isSceneComplete(context.lesson, 'scene-6') },
  ];
}

/** v3 R5: '가까이 보기' prints next to the transport on spread 1 (the R6 camera shot runs it). */
const closeLookButton = (sceneId: SceneId): PrintedButton[] => sceneId === 'scene-1'
  ? [{ id: 'look', label: PAGE_TEXT.closeLook, icon: 'look', testId: 'close-look', command: { type: 'shot', shotId: 'lanes-close' }, enabled: context => context.interactive }]
  : [];

function rightPage(sceneId: SceneId): PageSpec {
  const scene = getScene(sceneId);
  const blocks: PageBlock[] = [
    { kind: 'buttons', id: 'listen', label: '듣기', compact: true, buttons: [...listenButtons(sceneId), ...closeLookButton(sceneId)] },
    { kind: 'paragraph', style: 'note', text: PAGE_TEXT.transportHelp },
    { kind: 'heading', level: 2, text: EXPERIMENT_TITLES[sceneId] },
    { kind: 'paragraph', style: 'caption', text: sceneId === 'scene-3' ? `${PAGE_TEXT.axisCaption} ${PAGE_TEXT.halfTarget}` : PAGE_TEXT.axisCaption },
    { kind: 'figure', figureId: `${sceneId}-lanes`, height: figureHeight(sceneId), label: '종이에서 올라오는 음가 블록' },
  ];
  if (sceneId === 'scene-2') blocks.push(...splitControls());
  if (sceneId === 'scene-3') blocks.push(...combinationControls());
  if (sceneId === 'scene-4') blocks.push(...restControls());
  if (sceneId === 'scene-5') blocks.push(...tempoControls());
  if (sceneId === 'scene-6') blocks.push(...compositionControls());
  blocks.push(
    { kind: 'paragraph', style: 'caption', tone: 'accent', live: true, text: context => context.playback.error ? `${context.playback.error} ${PAGE_TEXT.soundless}` : '' },
    { kind: 'paragraph', style: 'caption', tone: 'blue', live: true, text: context => context.lesson.currentSceneId === sceneId ? context.lesson.feedback : '' },
    { kind: 'flap', id: 'alternative', hintKey: `${sceneId}/alternative`, label: PAGE_TEXT.alternative, blocks: [
      { kind: 'paragraph', style: 'body', text: scene.alternative },
      ...(sceneId === 'scene-1' ? [{ kind: 'buttons', id: 'observe', label: '설명 확인', compact: true, buttons: [{
        id: 'observe', label: PAGE_TEXT.observed, icon: 'check', enabled: (context: PageContext) => context.interactive && !playing(context),
        command: lesson({ type: 'observeLane', laneId: 'upper', mode: 'text' }, { type: 'observeLane', laneId: 'lower', mode: 'text' }),
      }] } as PageBlock] : []),
    ] },
  );
  return { pageId: `page-${lessonPageNumber(sceneId, 'right')}` as PageId, side: 'right', runningHead: RUNNING_HEADS.right, folio: lessonPageNumber(sceneId, 'right'), blocks };
}

const SCENES: readonly SceneId[] = ['scene-1', 'scene-2', 'scene-3', 'scene-4', 'scene-5', 'scene-6'];
export const LESSON_PAGE_SPECS: ReadonlyMap<PageId, PageSpec> = new Map(SCENES.flatMap(sceneId => {
  const left = leftPage(sceneId), right = rightPage(sceneId);
  return [[left.pageId, left], [right.pageId, right]] as const;
}));
