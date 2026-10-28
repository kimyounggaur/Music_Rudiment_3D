import test from 'node:test';
import assert from 'node:assert/strict';
import { BookProgressSession } from '../src/book/BookProgressSession.ts';
import { captureBookProgress } from '../src/book/learningProgress.ts';
import { getScene } from '../src/content/lesson.ts';
import { createLessonState, isSceneComplete, reduceLesson } from '../src/lesson/controller.ts';
import type { LessonState } from '../src/lesson/controller.ts';
import { BOOK_STORAGE_KEY, deleteBookProgress, exportBookProgress, parseBookImport } from '../src/persistence/bookProgress.ts';
import type { BookPreferences } from '../src/persistence/bookProgress.ts';
import type { Result, StorageLike } from '../src/persistence/progress.ts';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  failWrites = false;
  writeAttempts = 0;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, raw: string) {
    this.writeAttempts++;
    if (this.failWrites) throw new DOMException('Storage quota is full', 'QuotaExceededError');
    this.data.set(key, raw);
  }
  removeItem(key: string) { this.data.delete(key); }
}

const preferences: BookPreferences = { mode: '3d', reducedMotion: false, muted: false, volume: 0.6 };
const savedAt = '2026-10-28T12:00:00.000Z';
const options = (lesson: LessonState) => ({ lesson, lastStableSpreadId: 'spread-1' as const, preferences, savedAt });
function value<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(JSON.stringify(result.error));
  return result.value;
}
function completedComparison(): LessonState {
  let lesson = createLessonState();
  for (const laneId of ['upper', 'lower']) lesson = reduceLesson(lesson, { type: 'observeLane', laneId, mode: 'text' });
  for (const question of getScene('scene-1').questions) {
    lesson = reduceLesson(lesson, { type: 'answer', questionId: question.id, value: question.correctValue });
  }
  return lesson;
}
function baseline() {
  const progress = value(captureBookProgress({ ...options(createLessonState()),
    hints: { 'scene-1/compare': 1 }, attempts: { 'scene-1/play': 2 } }));
  const raw = ` \n${JSON.stringify(progress, null, 2)}\n `;
  const storage = new MemoryStorage();
  storage.data.set(BOOK_STORAGE_KEY, raw);
  return { progress, raw, storage, session: new BookProgressSession(progress, raw) };
}

test('quota failure preserves live historical achievement through a later wrong answer and export; confirmed deletion resets it', () => {
  const { session, storage, raw } = baseline();
  const complete = completedComparison();
  assert.equal(isSceneComplete(complete, 'scene-1'), true);
  const reached = value(session.capture(options(complete)));
  assert.deepEqual(reached.achievements['scene-1'], { current: true, ever: true });
  assert.equal(session.previous, reached, 'achievement is retained before any disk write');
  storage.failWrites = true;
  const saved = session.save(reached, storage);
  assert.equal(saved.ok, false);
  if (!saved.ok) assert.equal(saved.error.code, 'STORAGE_WRITE');
  assert.equal(session.previous, reached);
  assert.equal(session.raw, raw);
  assert.equal(storage.getItem(BOOK_STORAGE_KEY), raw, 'the exact prior primary text survives the failed write');

  const question = getScene('scene-1').questions[0];
  const wrong = question.options.find(option => option.value !== question.correctValue);
  assert.ok(wrong);
  const changed = reduceLesson(complete, { type: 'answer', questionId: question.id, value: wrong.value });
  assert.equal(isSceneComplete(changed, 'scene-1'), false);
  const captured = value(session.capture(options(changed)));
  assert.deepEqual(captured.achievements['scene-1'], { current: false, ever: true });
  const exported = value(parseBookImport(value(exportBookProgress(captured))));
  assert.deepEqual(exported.progress.achievements['scene-1'], { current: false, ever: true });
  assert.equal(session.raw, raw, 'capture and export cannot advance the CAS baseline');
  assert.equal(storage.getItem(BOOK_STORAGE_KEY), raw);
  assert.equal(storage.writeAttempts, 1, 'capture and export make no extra writes');

  value(deleteBookProgress(storage));
  session.adopt(null, null);
  assert.equal(session.previous, null);
  assert.equal(session.raw, null);
  assert.equal(storage.getItem(BOOK_STORAGE_KEY), null);
  const fresh = value(session.capture(options(createLessonState())));
  assert.deepEqual(fresh.achievements['scene-1'], { current: false, ever: false });
  assert.deepEqual(fresh.hints, {});
  assert.deepEqual(fresh.attempts, {});
});

test('a conflicting tab cannot advance the session baseline; explicit adoption and successful save do', () => {
  const { session, storage, raw } = baseline();
  const local = value(session.capture(options(completedComparison())));
  const imported = value(captureBookProgress({ ...options(createLessonState()), preferences: { ...preferences, muted: true } }));
  const otherRaw = JSON.stringify(imported);
  storage.data.set(BOOK_STORAGE_KEY, otherRaw);
  const conflict = session.save(local, storage);
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.code, 'STORAGE_CONFLICT');
  assert.equal(storage.writeAttempts, 0);
  assert.equal(storage.getItem(BOOK_STORAGE_KEY), otherRaw);
  assert.equal(session.raw, raw);
  assert.equal(session.previous, local);

  session.adopt(imported, otherRaw);
  assert.equal(session.raw, otherRaw);
  assert.equal(session.previous, imported);
  const next = value(session.capture(options(createLessonState())));
  assert.deepEqual(next.achievements['scene-1'], { current: false, ever: false }, 'explicit adoption replaces local history');
  const saved = value(session.save(next, storage));
  assert.equal(storage.getItem(BOOK_STORAGE_KEY), saved.raw);
  assert.equal(session.raw, saved.raw);
  assert.equal(session.previous, saved.progress);
  assert.equal(storage.writeAttempts, 1);
});

test('invalid capture leaves both live history and the confirmed primary baseline intact', () => {
  const { session, progress, raw, storage } = baseline();
  const invalid = session.capture({ ...options(createLessonState()), preferences: { ...preferences, volume: 2 } });
  assert.equal(invalid.ok, false);
  assert.equal(session.previous, progress);
  assert.equal(session.raw, raw);
  assert.equal(storage.getItem(BOOK_STORAGE_KEY), raw);
  assert.equal(storage.writeAttempts, 0);
});
