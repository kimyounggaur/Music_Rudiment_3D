import test from 'node:test';
import assert from 'node:assert/strict';
import { audioOwnerIsCurrent, sameAudioOwner } from '../src/book/audioOwnership.ts';
import type { BookAudioOwner } from '../src/book/audioOwnership.ts';
import { bookReducer, bookToken, createBookState } from '../src/book/controller.ts';
import type { BookState } from '../src/book/controller.ts';
import { BOOK_MANIFEST } from '../src/book/manifest.ts';
import { createLessonState } from '../src/lesson/controller.ts';
import type { LessonState } from '../src/lesson/controller.ts';

function openBook(mode: BookState['mode'] = '3d'): BookState {
  let book = createBookState({ mode, reducedMotion: true });
  book = bookReducer(book, { type: 'BOOT_READY', token: bookToken(book) });
  book = bookReducer(book, { type: 'OPEN_BOOK', inputId: 1 });
  book = bookReducer(book, { type: 'COVER_COMPLETE', token: bookToken(book) });
  book = bookReducer(book, { type: 'CAMERA_COMPLETE', token: bookToken(book) });
  return bookReducer(book, { type: 'SCENE_READY', token: bookToken(book) });
}

function ownerFor(book: BookState, lesson: LessonState): BookAudioOwner {
  const spread = BOOK_MANIFEST.find(item => item.spreadId === book.currentSpreadId)!;
  const scene = lesson.scenes[spread.sceneId];
  return { token: bookToken(book), revision: lesson.revision, spreadId: book.currentSpreadId,
    mode: book.mode, laneId: Object.keys(scene.patterns)[0], tempo: scene.tempo };
}

test('same playback identity is reusable across twenty requests, while every ownership change differs', () => {
  const owner = ownerFor(openBook(), createLessonState());
  for (let index = 0; index < 20; index++) {
    assert.equal(sameAudioOwner(owner, { ...owner, token: { ...owner.token } }), true);
  }
  const changes: BookAudioOwner[] = [
    ...(['bookEpoch', 'navigationToken', 'sceneInstanceId'] as const).map(key => ({
      ...owner, token: { ...owner.token, [key]: owner.token[key] + 1 },
    })),
    { ...owner, revision: owner.revision + 1 },
    { ...owner, spreadId: 'spread-2' },
    { ...owner, mode: '2d' },
    { ...owner, laneId: 'lower' },
    { ...owner, tempo: 120 },
  ];
  for (const changed of changes) assert.equal(sameAudioOwner(owner, changed), false);
  assert.equal(sameAudioOwner(null, owner), false);
  assert.equal(sameAudioOwner(owner, null), false);
  assert.equal(sameAudioOwner(null, null), false);
});

test('the same owner remains valid through starting, playing and paused states in 3D and 2D', () => {
  for (const mode of ['3d', '2d'] as const) {
    let book = openBook(mode);
    const lesson = createLessonState();
    const owner = ownerFor(book, lesson);
    assert.equal(audioOwnerIsCurrent(owner, book, lesson), true);
    book = bookReducer(book, { type: 'TRANSPORT_STARTING', token: bookToken(book) });
    assert.equal(audioOwnerIsCurrent(owner, book, lesson), true);
    book = bookReducer(book, { type: 'TRANSPORT_PLAYING', token: bookToken(book), sessionId: 5 });
    assert.equal(audioOwnerIsCurrent(owner, book, lesson), true);
    book = bookReducer(book, { type: 'TRANSPORT_PAUSED', token: bookToken(book) });
    assert.equal(book.scene, 'paused');
    assert.equal(audioOwnerIsCurrent(owner, book, lesson), true);
  }
});

test('navigation, close, hide and mode recovery revoke the old owner before a late resume can publish', () => {
  const book = openBook();
  const lesson = createLessonState();
  const owner = ownerFor(book, lesson);
  for (const type of ['NEXT', 'CLOSE_BOOK', 'HIDE_DOCUMENT', 'USE_2D', 'WEBGL_LOST'] as const) {
    const departed = bookReducer(book, { type });
    assert.equal(audioOwnerIsCurrent(owner, departed, lesson), false, type);
  }
  for (const key of ['bookEpoch', 'navigationToken', 'sceneInstanceId'] as const) {
    assert.equal(audioOwnerIsCurrent(owner, { ...book, [key]: book[key] + 1 }, lesson), false, key);
  }
  assert.equal(audioOwnerIsCurrent(owner, { ...book, scene: 'entering' }, lesson), false);
  assert.equal(audioOwnerIsCurrent(owner, { ...book, currentSpreadId: 'spread-2' }, lesson), false);
  assert.equal(audioOwnerIsCurrent(owner, { ...book, mode: '2d', phase: 'fallback2D' }, lesson), false);
});

test('revision, tempo and lane identity guard paused music even when its lifecycle token is unchanged', () => {
  const book: BookState = { ...openBook(), scene: 'paused', transport: 'paused' };
  const lesson = createLessonState();
  const owner = ownerFor(book, lesson);
  assert.equal(audioOwnerIsCurrent(owner, book, { ...lesson, revision: lesson.revision + 1 }), false);
  const changedTempo = { ...lesson, scenes: { ...lesson.scenes,
    'scene-1': { ...lesson.scenes['scene-1'], tempo: 120 } } };
  assert.equal(audioOwnerIsCurrent(owner, book, changedTempo), false);
  const missingLane = { ...lesson, scenes: { ...lesson.scenes,
    'scene-1': { ...lesson.scenes['scene-1'], patterns: {} } } };
  assert.equal(audioOwnerIsCurrent(owner, book, missingLane), false);
  assert.equal(audioOwnerIsCurrent({ ...owner, laneId: 'toString' }, book, lesson), false,
    'inherited object properties are not owned music lanes');
});

test('lane and tempo resolve from the committed spread, not the asynchronously synchronized lesson cursor', () => {
  const book: BookState = { ...openBook(), currentSpreadId: 'spread-2' };
  const lesson = createLessonState();
  const owner = ownerFor(book, lesson);
  assert.equal(lesson.currentSceneId, 'scene-1');
  assert.equal(audioOwnerIsCurrent(owner, book, lesson), true);
  const otherSceneTempo = { ...lesson, scenes: { ...lesson.scenes,
    'scene-1': { ...lesson.scenes['scene-1'], tempo: 120 } } };
  assert.equal(audioOwnerIsCurrent(owner, book, otherSceneTempo), true);
  assert.equal(audioOwnerIsCurrent({ ...owner, laneId: 'upper' }, book, lesson), false);
});
