import test from 'node:test';
import assert from 'node:assert/strict';
import { frac, sum, eq } from '../src/domain/index.ts';
import { getScene, lessonContent, makePattern } from '../src/content/lesson.ts';
import { assessPattern, validateEvents, validateLessonContent } from '../src/content/validation.ts';
import { createLessonState, currentAssessment, isSceneComplete, reduceLesson, restoreLessonState, sceneEvents, sceneState, serializeLearning, tryRestoreLessonState } from '../src/lesson/controller.ts';
import type { LessonState } from '../src/lesson/controller.ts';
import type { SceneId } from '../src/content/types.ts';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
type Mutable<T> = T extends readonly (infer Item)[] ? Mutable<Item>[] : T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T;
const mutableClone = <T>(value: T): Mutable<T> => JSON.parse(JSON.stringify(value));
function at(id: SceneId): LessonState { return reduceLesson(createLessonState(), { type: 'navigate', sceneId: id }); }
function addNote(state: LessonState, denominator: number, kind: 'note' | 'rest' = 'note'): LessonState { return reduceLesson(state, { type: 'add', duration: frac(1, denominator), kind }); }
function answerAll(state: LessonState): LessonState { for (const q of getScene(state.currentSceneId).questions) state = reduceLesson(state, { type: 'answer', questionId: q.id, value: q.correctValue }); return state; }
const validQuarter = makePattern('test', [{ duration: frac(1, 4) }]);

test('all six canonical scenes validate; comparison lane onsets can overlap across lanes', () => {
  const result = validateLessonContent(lessonContent);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(lessonContent.scenes.length, 6);
  assert.ok(Object.isFrozen(lessonContent.scenes));
  assert.equal(lessonContent.schemaVersion, '2.0.0');
});
test('draft, playable prefix, and assessment are separate contracts', () => {
  assert.equal(validateEvents([]).valid, true);
  assert.equal(validateEvents([], { mode: 'playable' }).valid, false);
  assert.equal(validateEvents(validQuarter, { mode: 'playable' }).valid, true);
  assert.equal(assessPattern(validQuarter, { target: frac(1) }).success, false);
  assert.deepEqual(validQuarter[0]!.duration, frac(1, 4));
});
test('rest.pitch and note missing pitch fail with field paths', () => {
  const rest = { ...validQuarter[0]!, kind: 'rest' };
  const missing = { ...validQuarter[0]! } as Record<string, unknown>;
  delete missing.pitch;
  for (const events of [[rest], [missing]]) {
    const result = validateEvents(events);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(x => x.path.endsWith('.pitch')));
  }
});
test('notation mismatch, noncanonical fraction, bad range and unknown nested keys fail', () => {
  const fixtures = [
    [{ ...validQuarter[0]!, notation: { type: 'half' } }],
    [{ ...validQuarter[0]!, duration: { n: 2, d: 8 } }],
    [{ ...validQuarter[0]!, duration: { n: 1, d: 0 } }],
    [{ ...validQuarter[0]!, onset: { n: -1, d: 4 } }],
    [{ ...validQuarter[0]!, pitch: { step: 'C', alter: 0, octave: 4, html: '<script>' } }],
    [{ ...validQuarter[0]!, duration: { n: 1.5, d: 4 } }],
  ];
  for (const input of fixtures) assert.equal(validateEvents(input).valid, false);
});
test('duplicate IDs, gaps, overlaps, bar overflow, unsafe event counts fail', () => {
  const quarters = clone(makePattern('q', Array.from({ length: 4 }, () => ({ duration: frac(1, 4) }))));
  assert.equal(validateEvents([quarters[0], { ...quarters[1]!, id: quarters[0]!.id }]).valid, false);
  assert.equal(validateEvents([{ ...quarters[0]!, onset: frac(1, 4) }]).errors[0]!.code, 'gap');
  assert.ok(validateEvents([quarters[0], { ...quarters[1]!, onset: frac(0) }]).errors.some(x => x.code === 'overlap'));
  assert.equal(validateEvents([...quarters, { ...quarters[0]!, id: 'overflow', onset: frac(1) }]).valid, false);
  assert.equal(validateEvents(Array(65).fill(quarters[0])).valid, false);
});
test('lesson validation rejects global duplicate IDs, versions, unknown fields, broken question refs', () => {
  const duplicate = mutableClone(lessonContent);
  duplicate.scenes[0].lanes[1].events[0].id = duplicate.scenes[0].lanes[0].events[0].id;
  assert.ok(validateLessonContent(duplicate).errors.some(x => x.code === 'duplicate-id'));
  const future = { ...lessonContent, schemaVersion: '999.0.0' };
  assert.equal(validateLessonContent(future).valid, false);
  assert.equal(validateLessonContent({ ...lessonContent, unexpected: true }).valid, false);
  const question = mutableClone(lessonContent);
  question.scenes[0].questions[0].correctValue = 'missing';
  assert.ok(validateLessonContent(question).errors.some(x => x.code === 'answer-reference'));
});
test('dangerous JSON keys are refused without modifying object prototypes', () => {
  const event = JSON.parse(JSON.stringify(validQuarter[0]).slice(0, -1) + ',"__proto__":{"polluted":true}}');
  assert.equal(validateEvents([event]).valid, false);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});
test('scene2 repeated split reaches exactly sixteen sixteenths; sum and onset invariant hold', () => {
  let state = at('scene-2');
  while (sceneEvents(state).some(x => x.duration.d < 16)) {
    const event = sceneEvents(state).find(x => x.duration.d < 16)!;
    state = reduceLesson(state, { type: 'split', id: event.id });
    assert.equal(eq(sum(sceneEvents(state).map(x => x.duration)), frac(1)), true);
    assert.equal(validateEvents(sceneEvents(state)).valid, true);
  }
  assert.equal(sceneEvents(state).length, 16);
  assert.equal(new Set(sceneEvents(state).map(x => x.id)).size, 16);
  const before = sceneEvents(state);
  const past = sceneState(state).patterns.main!.past;
  state = reduceLesson(state, { type: 'split' });
  assert.equal(sceneEvents(state), before);
  assert.equal(sceneState(state).patterns.main!.past, past);
  assert.match(state.feedback, /16/);
  assert.equal(isSceneComplete(state), false);
  state = answerAll(state);
  assert.equal(isSceneComplete(state), true);
});
test('split undo redo restores exact event meaning and selected child', () => {
  const start = at('scene-2');
  const split = reduceLesson(start, { type: 'split' });
  const undone = reduceLesson(split, { type: 'undo' });
  assert.deepEqual(sceneEvents(undone), sceneEvents(start));
  const redone = reduceLesson(undone, { type: 'redo' });
  assert.deepEqual(sceneEvents(redone), sceneEvents(split));
  assert.equal(sceneState(redone).selectedEventId, sceneState(split).selectedEventId);
  assert.equal(sceneEvents(start).length, 1);
  assert.ok(Object.isFrozen(sceneEvents(redone)));
});
test('adjacent merge is inverse; nonadjacent and unequal commands preserve history', () => {
  let state = reduceLesson(at('scene-2'), { type: 'split' });
  const halves = sceneEvents(state);
  state = reduceLesson(state, { type: 'merge', ids: [halves[1]!.id, halves[0]!.id] });
  assert.equal(sceneEvents(state).length, 1);
  assert.deepEqual(sceneEvents(state)[0]!.duration, frac(1));
  state = reduceLesson(state, { type: 'split' });
  state = reduceLesson(state, { type: 'split' });
  const unequal = sceneEvents(state);
  const invalid = reduceLesson(state, { type: 'merge', ids: [unequal[1]!.id, unequal[2]!.id] });
  assert.equal(sceneEvents(invalid), unequal);
  const absent = reduceLesson(state, { type: 'merge', ids: ['missing', unequal[0]!.id] });
  assert.equal(sceneEvents(absent), unequal);
});
test('new edit after undo discards redo without changing earlier state', () => {
  let state = reduceLesson(at('scene-2'), { type: 'split' });
  state = reduceLesson(state, { type: 'split' });
  state = reduceLesson(state, { type: 'undo' });
  state = reduceLesson(state, { type: 'split', id: sceneEvents(state)[1]!.id });
  assert.equal(sceneState(state).patterns.main!.future.length, 0);
  const events = sceneEvents(state);
  state = reduceLesson(state, { type: 'redo' });
  assert.equal(sceneEvents(state), events);
});
test('scene3 accepts A and B, rejects same-kind C, accepts equivalent C and recomputes current completion', () => {
  let state = at('scene-3');
  state = addNote(addNote(state, 4), 4);
  assert.equal(currentAssessment(state).success, true);
  state = reduceLesson(state, { type: 'selectLane', laneId: 'B' });
  for (let i = 0; i < 4; i++) state = addNote(state, 8);
  assert.equal(currentAssessment(state).success, true);
  state = reduceLesson(state, { type: 'selectLane', laneId: 'C' });
  state = addNote(addNote(state, 4), 4);
  assert.equal(currentAssessment(state).code, 'kinds');
  state = reduceLesson(state, { type: 'remove' });
  assert.equal(currentAssessment(state).code, 'under');
  assert.deepEqual(currentAssessment(state).difference, frac(1, 4));
  state = addNote(addNote(state, 8), 8);
  assert.equal(isSceneComplete(state), true);
  state = reduceLesson(state, { type: 'remove' });
  assert.equal(isSceneComplete(state), false);
  state = reduceLesson(state, { type: 'undo' });
  assert.equal(isSceneComplete(state), true);
});
test('scene3 diagnoses target overflow below safety bar and enforces its available cards', () => {
  let state = at('scene-3');
  state = addNote(addNote(addNote(state, 4), 4), 4);
  assert.equal(currentAssessment(state).code, 'over');
  assert.deepEqual(currentAssessment(state).difference, frac(-1, 4));
  const old = sceneEvents(state);
  assert.equal(sceneEvents(addNote(state, 2)), old);
  assert.equal(sceneEvents(addNote(state, 8, 'rest')), old);
});
test('scene4 toggling note/rest preserves time and removes pitch from rests; current rest condition matters', () => {
  let state = answerAll(at('scene-4'));
  assert.equal(isSceneComplete(state), true);
  const original = sceneEvents(state);
  for (const event of original.filter(x => x.kind === 'rest')) state = reduceLesson(state, { type: 'toggle', id: event.id });
  assert.equal(currentAssessment(state).code, 'rests');
  assert.equal(isSceneComplete(state), false);
  assert.deepEqual(sceneEvents(state).map(x => x.onset), original.map(x => x.onset));
  state = reduceLesson(state, { type: 'undo' });
  assert.equal(isSceneComplete(state), true);
  const rest = sceneEvents(state).find(x => x.kind === 'rest')!;
  assert.equal(Object.hasOwn(rest, 'pitch'), false);
  assert.equal(validateEvents(sceneEvents(state)).valid, true);
});
test('scene5 tempo changes preserve fractions and block changes while playing', () => {
  let state = at('scene-5');
  const original = sceneEvents(state);
  state = reduceLesson(state, { type: 'setTempo', bpm: 120 });
  assert.equal(sceneState(state).tempo, 120);
  assert.equal(sceneEvents(state), original);
  state = reduceLesson(state, { type: 'setTempo', bpm: 60 }, { playing: true });
  assert.equal(sceneState(state).tempo, 120);
  assert.match(state.feedback, /정지/);
  state = reduceLesson(state, { type: 'setTempo', bpm: 60 });
  assert.equal(sceneEvents(state), original);
  assert.equal(isSceneComplete(answerAll(state)), true);
});
test('scene6 requires exact sum, two normalized durations and a rest; explanation is separate', () => {
  let state = at('scene-6');
  state = addNote(state, 2);
  state = addNote(state, 4, 'rest');
  state = addNote(addNote(state, 8), 8);
  assert.equal(currentAssessment(state).success, true);
  assert.equal(isSceneComplete(state), false);
  state = reduceLesson(state, { type: 'explain', checked: true });
  assert.equal(isSceneComplete(state), true);
  state = reduceLesson(state, { type: 'remove' });
  assert.equal(isSceneComplete(state), false);
  state = reduceLesson(state, { type: 'undo' });
  assert.equal(isSceneComplete(state), true);
  state = reduceLesson(state, { type: 'redo' });
  assert.equal(isSceneComplete(state), false);
});
test('scene6 rejects empty, whole note, one duration note/rest combination, and no-rest patterns', () => {
  const task = getScene('scene-6').task;
  assert.equal(assessPattern([], task).success, false);
  assert.equal(assessPattern(makePattern('w', [{ duration: frac(1) }]), task).code, 'rests');
  assert.equal(assessPattern(makePattern('q', [{ duration: frac(1, 4) }, { duration: frac(1, 4), kind: 'rest' }, { duration: frac(1, 4) }, { duration: frac(1, 4) }]), task).code, 'kinds');
  assert.equal(assessPattern(makePattern('n', [{ duration: frac(1, 2) }, { duration: frac(1, 4) }, { duration: frac(1, 4) }]), task).code, 'rests');
});
test('bar overflow is rejected atomically with explicit excess; editing blocked during playback', () => {
  const state = addNote(at('scene-6'), 1);
  const blocked = addNote(state, 4);
  assert.equal(sceneEvents(blocked), sceneEvents(state));
  assert.equal(sceneState(blocked).patterns.main!.past, sceneState(state).patterns.main!.past);
  assert.match(blocked.feedback, /1\/4/);
  const playing = reduceLesson(state, { type: 'remove' }, { playing: true });
  assert.equal(sceneEvents(playing), sceneEvents(state));
});
test('scene1 text observations complete concepts without recording actual listening', () => {
  let state = answerAll(createLessonState());
  assert.equal(isSceneComplete(state), false);
  for (const laneId of ['upper', 'lower']) state = reduceLesson(state, { type: 'observeLane', laneId, mode: 'text' });
  assert.equal(isSceneComplete(state), true);
  assert.deepEqual(sceneState(state).observedLanes, { upper: 'text', lower: 'text' });
  state = reduceLesson(state, { type: 'answer', questionId: 'same-end', value: 'different' });
  assert.equal(isSceneComplete(state), false);
});
test('navigation/support preserve each draft; reference lanes refuse edits; reset affects current only', () => {
  let state = addNote(at('scene-6'), 2);
  const made = sceneEvents(state);
  state = reduceLesson(state, { type: 'setSupport', level: 3 });
  state = reduceLesson(state, { type: 'navigate', sceneId: 'scene-1' });
  const ref = sceneEvents(state);
  assert.equal(sceneEvents(addNote(state, 4)), ref);
  state = reduceLesson(state, { type: 'resetScene' });
  state = reduceLesson(state, { type: 'navigate', sceneId: 'scene-6' });
  assert.equal(sceneEvents(state), made);
  assert.equal(state.supportLevel, 3);
});
test('serialization excludes histories/runtime and restores only valid minimal learning', () => {
  let state = reduceLesson(at('scene-2'), { type: 'split' });
  state = answerAll(state);
  const snapshot = serializeLearning(state);
  assert.equal(Object.hasOwn(snapshot, 'nextId'), false);
  assert.equal(Object.hasOwn(snapshot, 'revision'), false);
  assert.equal(JSON.stringify(snapshot).includes('past'), false);
  const restored = restoreLessonState(clone(snapshot));
  assert.deepEqual(sceneEvents(restored), sceneEvents(state));
  assert.deepEqual(sceneState(restored).answers, sceneState(state).answers);
  assert.equal(sceneState(restored).patterns.main!.past.length, 0);
  assert.equal(restored.currentSceneId, 'scene-2');
  const edited = reduceLesson(restored, { type: 'split' });
  assert.equal(new Set(sceneEvents(edited).map(x => x.id)).size, sceneEvents(edited).length);
});
test('restore refuses malformed patterns atomically and protects reference content', () => {
  const snapshot = mutableClone(serializeLearning(addNote(at('scene-6'), 2)));
  snapshot.studentPatterns['scene-6/main'][0].duration.d = 0;
  const restored = restoreLessonState(snapshot);
  assert.equal(sceneEvents(restored, 'scene-6').length, 0);
  const changedReference = mutableClone(serializeLearning(createLessonState()));
  changedReference.studentPatterns['scene-1/upper'] = [];
  assert.match(restoreLessonState(changedReference).feedback, /비교용/);
});
test('restore detects cross-scene IDs even when defaults are omitted and bounds future ID counter', () => {
  const event = { ...validQuarter[0]!, id: getScene('scene-1').lanes[0]!.events[0]!.id };
  const duplicate = restoreLessonState({ studentPatterns: { 'scene-6/main': [event] }, sceneProgress: {}, supportLevel: 1, preferences: {} });
  assert.equal(sceneEvents(duplicate, 'scene-6').length, 0);
  assert.match(duplicate.feedback, /중복/);
  const huge = restoreLessonState({ studentPatterns: { 'scene-6/main': [{ ...validQuarter[0]!, id: 'edit-scene-6-main-9999999999999999999' }] }, sceneProgress: {} });
  assert.equal(sceneEvents(huge, 'scene-6').length, 0);
  assert.match(huge.feedback, /범위/);
});
test('restore command validates learning snapshots and strips runtime history', () => {
  const made = addNote(at('scene-6'), 2);
  const replaced = reduceLesson(createLessonState(), { type: 'restore', state: made });
  assert.deepEqual(sceneEvents(replaced), sceneEvents(made));
  assert.equal(sceneState(replaced).patterns.main!.past.length, 0);
  const invalid = reduceLesson(made, { type: 'restore', state: null as unknown as LessonState });
  assert.equal(sceneEvents(invalid), sceneEvents(made));
  const badProgress = { studentPatterns: { 'scene-6/main': [{ ...validQuarter[0]!, duration: { n: 1, d: 0 } }] }, sceneProgress: {} };
  assert.equal(sceneEvents(restoreLessonState(badProgress, made)), sceneEvents(made));
});
test('explicit import result rejects semantic changes before a storage commit boundary', () => {
  const current = addNote(at('scene-6'), 2);
  const reference = mutableClone(serializeLearning(current));
  reference.studentPatterns['scene-1/upper'] = [];
  const wrongSplitSum = mutableClone(serializeLearning(current));
  wrongSplitSum.studentPatterns['scene-2/main'] = mutableClone(makePattern('changed', [{ duration: frac(1, 2) }]));
  for (const candidate of [reference, wrongSplitSum]) {
    const result = tryRestoreLessonState(candidate, current);
    assert.equal(result.ok, false);
    if (result.ok) assert.fail('semantic-invalid import must not reach commit');
    else assert.ok(result.message.length > 0);
    assert.equal(sceneEvents(current).length, 1);
    assert.deepEqual(sceneEvents(current)[0]!.duration, frac(1, 2));
  }
  const valid = tryRestoreLessonState(clone(serializeLearning(current)), current);
  assert.equal(valid.ok, true);
  if (valid.ok) assert.deepEqual(sceneEvents(valid.state), sceneEvents(current));
});
