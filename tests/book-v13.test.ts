import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, LineSegments, Material, Mesh } from 'three';
import { BOOK_MANIFEST, G1_MANIFEST, adjacentSpread, pagePrintIds, spreadIndex, turningLeaf } from '../src/book/manifest.ts';
import { bookCanInteract, bookReducer, bookToken, createBookState } from '../src/book/controller.ts';
import type { BookEvent, BookState } from '../src/book/controller.ts';
import type { StageLayout } from '../src/book/stage.ts';
import { turnInputAvailability } from '../src/book/turnHit.ts';
import { lessonEditsAllowed, lessonPageNumber, lessonPlaybackDuration, lessonTempoTiming } from '../src/book/lessonPresentation.ts';
import { createLessonScene } from '../src/book/lessonScene.ts';
import { createLessonState, currentAssessment, isSceneComplete, reduceLesson, sceneEvents } from '../src/lesson/controller.ts';
import { frac, seconds } from '../src/domain/index.ts';
import { captureBookProgress, restoreBookLearning } from '../src/book/learningProgress.ts';
import { pageSnapshotKey } from '../src/book/pageSnapshot.ts';
import type { PageId } from '../src/book/manifest.ts';
import { renderBarBuffer } from '../src/audio/renderBarBuffer.ts';

const complete = (state: BookState, type: Extract<BookEvent, { token: unknown }>['type']) => bookReducer(state, { type, token: bookToken(state) } as BookEvent);
function openAt(id: 'spread-1' | 'spread-2' | 'spread-3', spreadCount = 3): BookState {
  let state = createBookState({ spreadCount, reducedMotion: true });
  state = complete(state, 'BOOT_READY');
  state = bookReducer(state, { type: 'OPEN_BOOK', inputId: 1, spreadId: id });
  state = complete(complete(state, 'COVER_COMPLETE'), 'CAMERA_COMPLETE');
  return complete(state, 'SCENE_READY');
}
function finishTurn(state: BookState) {
  for (const type of ['TURN_PREPARED', 'TURN_COMPLETE', 'SETTLED', 'SCENE_READY'] as const) state = complete(state, type);
  return state;
}
const quad = (x: number) => ({ tl: { x, y: 100 }, tr: { x: x + 400, y: 100 }, bl: { x, y: 660 }, br: { x: x + 400, y: 660 } });
const layout: StageLayout = {
  width: 1280, height: 720, pageWidth: 2.64, pageHeight: 3.88, pageWorld: { width: 2.64, height: 3.88 },
  left: quad(100), right: quad(500), cover: quad(500), safeRect: { left: 12, top: 12, right: 1268, bottom: 708 },
  coverUvCenter: { x: 700, y: 380 }, coverCenterErrorPx: 0,
  camera: { position: [], target: [], quaternion: [], span: 6 }, bookBounds: { left: 100, right: 900, top: 100, bottom: 660 }, openWidthFraction: 0.625,
};
const scene3 = () => reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-3' });
const add = (state: ReturnType<typeof scene3>, denominator: number) => reduceLesson(state, { type: 'add', duration: frac(1, denominator), kind: 'note' });

test('V13 adds the third actual scene while preserving the exact G1 fixture and printed leaf identities', () => {
  assert.equal(G1_MANIFEST.length, 2);
  assert.deepEqual(BOOK_MANIFEST.slice(0, 2), G1_MANIFEST);
  assert.deepEqual(BOOK_MANIFEST[2], { spreadId: 'spread-3', leftPageId: 'page-5', rightPageId: 'page-6', sceneId: 'scene-3' });
  assert.equal(adjacentSpread('spread-2', 'next', 2), undefined);
  assert.equal(adjacentSpread('spread-2', 'next', 3)?.spreadId, 'spread-3');
  const forward = turningLeaf('spread-2', 'spread-3', 3)!;
  const reverse = turningLeaf('spread-3', 'spread-2', 3)!;
  assert.deepEqual([forward.frontPageId, forward.backPageId, forward.stationaryLeftPageId, forward.stationaryRightPageId], ['page-4', 'page-5', 'page-3', 'page-6']);
  assert.equal(reverse.frontPageId, forward.frontPageId);
  assert.equal(reverse.backPageId, forward.backPageId);
  assert.equal(reverse.leafId, forward.leafId);
  assert.equal(turningLeaf('spread-1', 'spread-3'), null);
  assert.deepEqual([lessonPageNumber('scene-3', 'left'), lessonPageNumber('scene-3', 'right')], [5, 6]);
});

test('expanded navigation remains bounded, resumes a saved third spread and preserves its prefix across restore', () => {
  let state = openAt('spread-1');
  for (let i = 0; i < 10; i++) state = bookReducer(state, { type: 'NEXT' });
  assert.equal(state.destinationSpreadId, 'spread-2');
  assert.equal(state.pendingIntent, 'next');
  state = finishTurn(state);
  assert.equal(state.currentSpreadId, 'spread-2');
  assert.equal(state.destinationSpreadId, 'spread-3');
  assert.equal(state.pendingIntent, null);
  state = finishTurn(state);
  assert.equal(state.currentSpreadId, 'spread-3');
  assert.equal(bookReducer(state, { type: 'NEXT' }), state);
  assert.equal(openAt('spread-3').currentSpreadId, 'spread-3');
  const restored = bookReducer(state, { type: 'RESTORE_CLOSED', mode: '3d', reducedMotion: false });
  assert.equal(restored.spreadCount, 3);
  const cover = complete(complete(restored, 'BOOT_READY'), 'INTRO_SETTLED');
  assert.equal(bookReducer(cover, { type: 'OPEN_BOOK', inputId: 4, spreadId: 'spread-4' }), cover);
  assert.throws(() => createBookState({ spreadCount: 0 }), RangeError);
  assert.throws(() => createBookState({ spreadCount: BOOK_MANIFEST.length + 1 }), RangeError);
});

test('adjacent print windows retain all four leaf surfaces, never more than six textures', () => {
  for (const spread of BOOK_MANIFEST) {
    const pages = pagePrintIds(spread.spreadId);
    assert.ok(pages.length >= 4 && pages.length <= 6);
    assert.equal(new Set(pages).size, pages.length);
    assert.ok(pages.includes(spread.leftPageId) && pages.includes(spread.rightPageId));
    for (const direction of ['next', 'prev'] as const) {
      const adjacent = adjacentSpread(spread.spreadId, direction);
      if (!adjacent) continue;
      const leaf = turningLeaf(spread.spreadId, adjacent.spreadId)!;
      for (const id of [leaf.frontPageId, leaf.backPageId, leaf.stationaryLeftPageId, leaf.stationaryRightPageId]) assert.ok(pages.includes(id));
    }
    assert.equal(spreadIndex(spread.spreadId), BOOK_MANIFEST.indexOf(spread));
  }
});

test('every exposed manifest page has a valid snapshot identity, while unknown and future pages still fail closed', () => {
  const identity = { contentRevision: 1, width: 340, height: 500, scale: 2, fontVersion: 'local-bravura', scrollSignature: '[]' };
  const keys = BOOK_MANIFEST.flatMap(spread => [spread.leftPageId, spread.rightPageId]).map(pageId => pageSnapshotKey({ ...identity, pageId }));
  assert.equal(new Set(keys).size, BOOK_MANIFEST.length * 2);
  for (const id of ['page-0', 'page-01', 'page-13', `page-${BOOK_MANIFEST.length * 2 + 1}`]) {
    assert.throws(() => pageSnapshotKey({ ...identity, pageId: id as PageId }), /Invalid page snapshot identity/);
  }
});

test('six-texture middle-page readiness is exact; the first-release four-texture guards remain strict', () => {
  const book = openAt('spread-2');
  const input = { book, layout, stageReady: true, printsReady: true, textureCount: 6,
    requiredTextureCount: 6, preparedScene: `${book.bookEpoch}:${book.sceneInstanceId}:spread-2` };
  assert.deepEqual(turnInputAvailability(input), { next: true, prev: true });
  for (const patch of [{ textureCount: 5 }, { printsReady: false }, { requiredTextureCount: 4 }, { requiredTextureCount: 12 }]) {
    assert.deepEqual(turnInputAvailability({ ...input, ...patch }), { next: false, prev: false });
  }
  assert.equal(bookCanInteract(book), true);
});

test('edit availability rejects loading/play/pause and inactive pages without disabling silent learning', () => {
  for (const state of ['starting', 'playing', 'paused'] as const) assert.equal(lessonEditsAllowed(true, state), false);
  for (const state of [undefined, 'ready', 'locked', 'unavailable', 'error'] as const) {
    assert.equal(lessonEditsAllowed(true, state), true);
    assert.equal(lessonEditsAllowed(false, state), false);
  }
});

test('combination tasks retain exact half-length and kinds rules through edits, undo and persistence', () => {
  let lesson = add(add(scene3(), 4), 4);
  assert.equal(currentAssessment(lesson, 'scene-3', 'A').success, true);
  lesson = reduceLesson(lesson, { type: 'selectLane', laneId: 'B' });
  for (let i = 0; i < 4; i++) lesson = add(lesson, 8);
  assert.equal(currentAssessment(lesson, 'scene-3', 'B').success, true);
  lesson = reduceLesson(lesson, { type: 'selectLane', laneId: 'C' });
  lesson = add(add(lesson, 4), 4);
  assert.equal(currentAssessment(lesson).code, 'kinds');
  assert.equal(isSceneComplete(lesson), false);
  lesson = reduceLesson(lesson, { type: 'remove' });
  lesson = add(add(lesson, 8), 8);
  assert.equal(isSceneComplete(lesson), true);
  assert.deepEqual(currentAssessment(lesson).total, frac(1, 2));
  const completeLesson = lesson;
  lesson = reduceLesson(lesson, { type: 'remove' });
  assert.equal(isSceneComplete(lesson), false);
  assert.deepEqual(currentAssessment(lesson).difference, frac(1, 8));
  lesson = reduceLesson(lesson, { type: 'undo' });
  assert.equal(isSceneComplete(lesson), true);
  const saved = captureBookProgress({ lesson: completeLesson, lastStableSpreadId: 'spread-3', preferences: { mode: '3d', reducedMotion: false, muted: false, volume: 0.6 } });
  assert.equal(saved.ok, true);
  if (saved.ok) assert.deepEqual(saved.value.achievements['scene-3'], { current: true, ever: true });
});

test('combination playback covers its half-target without clipping an over-target draft', () => {
  let lesson = add(add(scene3(), 4), 4);
  assert.deepEqual(lessonPlaybackDuration(lesson, 'scene-3', 'A'), frac(1, 2));
  assert.equal(seconds(lessonPlaybackDuration(lesson, 'scene-3', 'A'), { bpm: 90, unit: frac(1, 4) }), 4 / 3);
  lesson = add(lesson, 4);
  assert.deepEqual(lessonPlaybackDuration(lesson, 'scene-3', 'A'), frac(3, 4));
  assert.deepEqual(lessonPlaybackDuration(createLessonState(), 'scene-1', 'upper'), frac(1, 1));
});

test('third-scene world has three owned lanes, an ink half-guide and preserved event IDs on return', () => {
  let lesson = scene3();
  const scene = createLessonScene('scene-3', lesson);
  const resources = new Set<BufferGeometry | Material>();
  try {
    assert.deepEqual(scene.getSnapshot().lanes.map(lane => lane.laneId), ['A', 'B', 'C']);
    assert.equal(scene.pickTargets.length, 0);
    assert.ok(scene.group.getObjectByName('half-duration-target'));
    lesson = add(add(lesson, 4), 4);
    scene.updateLesson(lesson);
    assert.equal(scene.pickTargets.length, 2);
    for (const mesh of scene.pickTargets) assert.equal(scene.pickEvent(mesh)?.laneId, 'A');
    const returned = createLessonScene('scene-3', lesson);
    try { assert.deepEqual(returned.getSnapshot().lanes[0].eventIds, sceneEvents(lesson).map(event => event.id)); }
    finally { returned.dispose(); }
    scene.group.traverse(object => {
      if (object instanceof Mesh || object instanceof LineSegments) {
        resources.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          assert.equal(material.depthTest, true);
          resources.add(material);
        }
      }
    });
  } finally {
    const disposed = new Map<BufferGeometry | Material, number>();
    resources.forEach(resource => resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) ?? 0) + 1)));
    scene.dispose(); scene.dispose();
    for (const resource of resources) assert.equal(disposed.get(resource), 1);
  }
});

test('fourth printed spread has reversible leaf identity and manifest-approved snapshot IDs', () => {
  assert.deepEqual(BOOK_MANIFEST[3], { spreadId: 'spread-4', leftPageId: 'page-7', rightPageId: 'page-8', sceneId: 'scene-4' });
  assert.equal(adjacentSpread('spread-3', 'next', 4)?.sceneId, 'scene-4');
  assert.equal(adjacentSpread('spread-4', 'next', 4), undefined);
  const leaf = turningLeaf('spread-3', 'spread-4', 4)!;
  const reverse = turningLeaf('spread-4', 'spread-3', 4)!;
  assert.deepEqual([leaf.frontPageId, leaf.backPageId, leaf.stationaryLeftPageId, leaf.stationaryRightPageId], ['page-6', 'page-7', 'page-5', 'page-8']);
  assert.equal(reverse.leafId, leaf.leafId);
  assert.deepEqual(pagePrintIds('spread-4'), BOOK_MANIFEST.slice(2, 5).flatMap(spread => [spread.leftPageId, spread.rightPageId]));
});

test('rest toggling keeps event identity, onset and duration; undo restores the exact musical pattern', () => {
  let lesson = reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-4' });
  const original = sceneEvents(lesson);
  assert.deepEqual(original.map(event => event.kind), ['note', 'rest', 'note', 'rest']);
  assert.deepEqual(original.filter(event => event.kind === 'note').map(event => seconds(event.onset, { bpm: 90, unit: frac(1, 4) })), [0, 4 / 3]);
  lesson = reduceLesson(lesson, { type: 'toggle' });
  assert.deepEqual(sceneEvents(lesson).map(({ id, onset, duration }) => ({ id, onset, duration })), original.map(({ id, onset, duration }) => ({ id, onset, duration })));
  assert.equal(sceneEvents(lesson)[0].kind, 'rest');
  assert.deepEqual(currentAssessment(lesson).total, frac(1, 1));
  lesson = reduceLesson(lesson, { type: 'undo' });
  assert.deepEqual(sceneEvents(lesson), original);
  lesson = reduceLesson(lesson, { type: 'answer', questionId: 'rest-motion', value: 'continues' });
  assert.equal(isSceneComplete(lesson), true);
  const playing = reduceLesson(lesson, { type: 'toggle' }, { playing: true });
  assert.deepEqual(sceneEvents(playing), original);
});

test('fourth-scene rests remain full-width pickable empty blocks and render zero samples during both gaps', () => {
  const lesson = reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-4' });
  const events = sceneEvents(lesson);
  const scene = createLessonScene('scene-4', lesson);
  try {
    assert.equal(scene.pickTargets.length, 4);
    scene.pickTargets.forEach((mesh, i) => {
      assert.equal(mesh.userData.kind, events[i].kind);
      assert.equal(mesh.scale.x, 2.5);
      assert.equal(mesh.position.x, 1.25 + i * 2.5);
      assert.equal(scene.pickEvent(mesh)?.eventId, events[i].id);
      if (events[i].kind === 'rest') assert.equal((mesh.material as Material).opacity, 0);
    });
  } finally { scene.dispose(); }
  const buffer = renderBarBuffer({ events, tempo: { bpm: 90, unit: frac(1, 4) }, logicalDuration: lessonPlaybackDuration(lesson, 'scene-4', 'main') }, {
    sampleRate: 4800,
    createBuffer(_channels, length, sampleRate) { const samples = new Float32Array(length); return { length, sampleRate, duration: length / sampleRate, getChannelData: () => samples }; },
  });
  const samples = buffer.getChannelData(0);
  assert.equal(buffer.duration, 8 / 3);
  assert.ok(samples.subarray(1, 3200).some(sample => sample !== 0));
  assert.ok(samples.subarray(3200, 6400).every(sample => sample === 0));
  assert.ok(samples.subarray(6401, 9600).some(sample => sample !== 0));
  assert.ok(samples.subarray(9600).every(sample => sample === 0));
});

test('fifth spread retains exact reference music and proportional geometry across both tempo presets', () => {
  assert.deepEqual(BOOK_MANIFEST[4], { spreadId: 'spread-5', leftPageId: 'page-9', rightPageId: 'page-10', sceneId: 'scene-5' });
  assert.deepEqual([turningLeaf('spread-4', 'spread-5')?.frontPageId, turningLeaf('spread-5', 'spread-4')?.backPageId], ['page-8', 'page-9']);
  let lesson = reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-5' });
  const events = sceneEvents(lesson);
  const scene = createLessonScene('scene-5', lesson);
  try {
    const originalGeometry = scene.pickTargets.map(mesh => ({ id: mesh.userData.eventId, x: mesh.position.x, width: mesh.scale.x }));
    for (const bpm of [60, 120] as const) {
      lesson = reduceLesson(lesson, { type: 'setTempo', bpm });
      assert.equal(lesson.scenes['scene-5'].tempo, bpm);
      assert.equal(sceneEvents(lesson), events);
      scene.updateLesson(lesson);
      assert.deepEqual(scene.pickTargets.map(mesh => ({ id: mesh.userData.eventId, x: mesh.position.x, width: mesh.scale.x })), originalGeometry);
      const timing = lessonTempoTiming(bpm);
      assert.equal(timing.barSeconds, bpm === 60 ? 4 : 2);
      assert.equal(timing.quarterSeconds, bpm === 60 ? 1 : 0.5);
      assert.equal(timing.barSeconds / timing.quarterSeconds, 4);
      assert.deepEqual(timing.ticks, bpm === 60 ? [0, 1, 2, 3, 4] : [0, 0.5, 1, 1.5, 2]);
    }
    const blocked = reduceLesson(lesson, { type: 'setTempo', bpm: 60 }, { playing: true });
    assert.equal(blocked.scenes['scene-5'].tempo, 120);
    assert.equal(sceneEvents(blocked), events);
    lesson = reduceLesson(lesson, { type: 'answer', questionId: 'ratio', value: '4:1' });
    assert.equal(isSceneComplete(lesson), false);
    lesson = reduceLesson(lesson, { type: 'answer', questionId: 'seconds', value: '4-2' });
    assert.equal(isSceneComplete(lesson), true);
  } finally { scene.dispose(); }
});

test('sixth spread keeps empty draft distinct from playable music and current completion', () => {
  assert.equal(BOOK_MANIFEST.length, 6);
  assert.deepEqual(BOOK_MANIFEST[5], { spreadId: 'spread-6', leftPageId: 'page-11', rightPageId: 'page-12', sceneId: 'scene-6' });
  assert.equal(adjacentSpread('spread-6', 'next'), undefined);
  assert.deepEqual([lessonPageNumber('scene-6', 'left'), lessonPageNumber('scene-6', 'right')], [11, 12]);
  const lesson = reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-6' });
  assert.equal(sceneEvents(lesson).length, 0);
  assert.equal(currentAssessment(lesson).valid, true);
  assert.equal(currentAssessment(lesson).success, false);
  assert.equal(currentAssessment(lesson).code, 'under');
  assert.equal(isSceneComplete(reduceLesson(lesson, { type: 'explain', checked: true })), false);
  const scene = createLessonScene('scene-6', lesson);
  try { assert.equal(scene.pickTargets.length, 0); } finally { scene.dispose(); }
});

test('composition exact conditions reject same-duration note/rest kinds and preserve successful edits through undo and save', () => {
  const initial = reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-6' });
  let sameKinds = initial;
  for (const kind of ['note', 'rest', 'note', 'rest'] as const) sameKinds = reduceLesson(sameKinds, { type: 'add', kind, duration: frac(1, 4) });
  assert.equal(currentAssessment(sameKinds).code, 'kinds');
  assert.equal(currentAssessment(sameKinds).durationKinds, 1);
  let lesson = reduceLesson(initial, { type: 'add', kind: 'note', duration: frac(1, 2) });
  lesson = reduceLesson(lesson, { type: 'add', kind: 'rest', duration: frac(1, 4) });
  lesson = reduceLesson(lesson, { type: 'add', kind: 'note', duration: frac(1, 8) });
  lesson = reduceLesson(lesson, { type: 'add', kind: 'note', duration: frac(1, 8) });
  assert.equal(currentAssessment(lesson).success, true);
  assert.equal(isSceneComplete(lesson), false, 'self check is explicit, not an automatic semantic score');
  lesson = reduceLesson(lesson, { type: 'explain', checked: true });
  assert.equal(isSceneComplete(lesson), true);
  const saved = captureBookProgress({ lesson, lastStableSpreadId: 'spread-6', preferences: { mode: '3d', reducedMotion: false, muted: false, volume: 0.6 } });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.deepEqual(saved.value.achievements['scene-6'], { current: true, ever: true });
  const fullPattern = sceneEvents(lesson);
  const over = reduceLesson(lesson, { type: 'add', kind: 'note', duration: frac(1, 16) });
  assert.equal(sceneEvents(over), fullPattern);
  assert.match(over.feedback, /1\/16/);
  lesson = reduceLesson(lesson, { type: 'remove' });
  assert.equal(isSceneComplete(lesson), false);
  assert.deepEqual(currentAssessment(lesson).difference, frac(1, 8));
  const invalidated = captureBookProgress({ lesson, previous: saved.value, lastStableSpreadId: 'spread-6', preferences: saved.value.preferences });
  assert.equal(invalidated.ok, true);
  if (invalidated.ok) assert.deepEqual(invalidated.value.achievements['scene-6'], { current: false, ever: true });
  lesson = reduceLesson(lesson, { type: 'undo' });
  assert.deepEqual(sceneEvents(lesson), fullPattern);
  assert.equal(isSceneComplete(lesson), true);
  const restored = restoreBookLearning(saved.value);
  assert.equal(restored.ok, true);
  if (restored.ok) {
    assert.deepEqual(sceneEvents(restored.value, 'scene-6'), fullPattern);
    assert.equal(isSceneComplete(restored.value, 'scene-6'), true);
  }
});
