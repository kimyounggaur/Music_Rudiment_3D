import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOK_BACKUP_KEY, BOOK_STORAGE_KEY, BOOK_V1_BACKUP_KEY, saveBookProgress } from '../src/persistence/bookProgress.ts';
import type { BookPreferences, BookProgressEnvelope } from '../src/persistence/bookProgress.ts';
import {
  BOOK_V2_SOURCE_BACKUP_KEY, BOOK_V3_BACKUP_KEY, BOOK_V3_STORAGE_KEY, commitBookImportV3, DEFAULT_BOOK_SETTINGS, deleteBookProgressV3,
  exportBookProgressV3, fromV2, loadBookProgressV3, parseBookImportV3, readBookBackupsV3, saveBookProgressV3, toV2, validateBookProgressV3,
} from '../src/persistence/bookProgressV3.ts';
import type { BookProgressEnvelopeV3 } from '../src/persistence/bookProgressV3.ts';
import { BACKUP_KEY, STORAGE_KEY, createProgress } from '../src/persistence/progress.ts';
import type { Result, StorageLike } from '../src/persistence/progress.ts';
import { captureBookProgress } from '../src/book/learningProgress.ts';
import { createLessonState, reduceLesson, serializeLearning } from '../src/lesson/controller.ts';
import type { LessonState } from '../src/lesson/controller.ts';

/** REFACTOR_PROMPTS_V3 R7-4: the v2 → v3 migration keeps every existing record (the v2 suite stays unchanged). */
class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  operations: { kind: 'read' | 'write' | 'delete'; key: string }[] = [];
  failWrite = new Set<string>();
  failRead = new Set<string>();
  getItem(key: string) {
    this.operations.push({ kind: 'read', key });
    if (this.failRead.has(key)) throw new Error('SecurityError');
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.operations.push({ kind: 'write', key });
    if (this.failWrite.has(key)) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
  removeItem(key: string) { this.operations.push({ kind: 'delete', key }); this.data.delete(key); }
  writes() { return this.operations.filter(operation => operation.kind === 'write').map(operation => operation.key); }
}
const savedAt = '2026-10-30T09:00:00.000Z';
const preferences: BookPreferences = { mode: '3d', reducedMotion: true, muted: false, volume: 0.5 };
function value<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(JSON.stringify(result.error));
  return result.value;
}
function lesson(): LessonState {
  let state = reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-1' });
  state = reduceLesson(state, { type: 'answer', questionId: 'same-end', value: 'same' });
  return state;
}
const v2 = (): BookProgressEnvelope => value(captureBookProgress({ lesson: lesson(), lastStableSpreadId: 'spread-1', preferences, savedAt, hints: { 'scene-1/answer': 1 } }));
const v3 = (settings = { sfx: false, autoShot: true }): BookProgressEnvelopeV3 => fromV2(v2(), settings);
const appKeys = [BOOK_V3_STORAGE_KEY, BOOK_V3_BACKUP_KEY, BOOK_V2_SOURCE_BACKUP_KEY, BOOK_STORAGE_KEY, BOOK_BACKUP_KEY, STORAGE_KEY, BACKUP_KEY, BOOK_V1_BACKUP_KEY];

test('R7 v3: the record adds sfx (default on) and autoShot (default off); the rest is the v2 record', () => {
  const record = value(validateBookProgressV3(fromV2(v2())));
  assert.equal(record.progressSchemaVersion, 3);
  assert.equal(record.bookUiVersion, '3.0.0');
  assert.deepEqual(record.preferences, { ...preferences, ...DEFAULT_BOOK_SETTINGS });
  assert.deepEqual(DEFAULT_BOOK_SETTINGS, { sfx: true, autoShot: false }, 'decisions 2 and 5');
  assert.deepEqual(toV2(record), v2(), 'nothing of the v2 record changes');
  // Strict: exact preference fields and types, exact header; v2 rules still apply.
  const bad = (patch: (record: Record<string, unknown>) => void) => { const copy = JSON.parse(JSON.stringify(record)); patch(copy); return validateBookProgressV3(copy).ok; };
  assert.equal(bad(copy => { (copy.preferences as Record<string, unknown>).sfx = 'yes'; }), false);
  assert.equal(bad(copy => { delete (copy.preferences as Record<string, unknown>).autoShot; }), false);
  assert.equal(bad(copy => { (copy.preferences as Record<string, unknown>).quality = 'high'; }), false);
  assert.equal(bad(copy => { copy.progressSchemaVersion = 2; }), false);
  assert.equal(bad(copy => { copy.bookUiVersion = '2.1.0'; }), false);
  assert.equal(bad(copy => { copy.extra = 1; }), false);
  assert.equal(bad(copy => { (copy.sceneTempos as Record<string, unknown>)['scene-1'] = 120; }), false, 'v2 tempo rule');
  assert.equal(validateBookProgressV3(v2()).ok, false, 'a v2 record is not a v3 record');
});

test('R7 v3: an empty store stays empty; a v3 primary wins and keeps its exact raw', () => {
  const empty = new MemoryStorage();
  assert.equal(loadBookProgressV3(empty).status, 'empty');
  assert.deepEqual(empty.writes(), []);
  const storage = new MemoryStorage();
  const raw = ` ${JSON.stringify(v3())} `;
  storage.data.set(BOOK_V3_STORAGE_KEY, raw);
  storage.data.set(BOOK_STORAGE_KEY, JSON.stringify(v2()));
  const loaded = loadBookProgressV3(storage);
  assert.equal(loaded.status, 'loaded');
  assert.equal(loaded.raw, raw, 'the CAS baseline is the exact text');
  assert.deepEqual(loaded.progress!.preferences, { ...preferences, sfx: false, autoShot: true });
  assert.deepEqual(storage.writes(), []);
});

test('R7 v3: a v2 primary migrates — source backup, validation, then the new key; the v2 primary is untouched', () => {
  const storage = new MemoryStorage();
  const raw2 = ` \n${JSON.stringify(v2(), null, 2)}\n`;
  storage.data.set(BOOK_STORAGE_KEY, raw2);
  const loaded = loadBookProgressV3(storage);
  assert.equal(loaded.status, 'migrated');
  assert.deepEqual(storage.writes(), [BOOK_V2_SOURCE_BACKUP_KEY, BOOK_V3_STORAGE_KEY]);
  assert.equal(storage.data.get(BOOK_STORAGE_KEY), raw2, 'v2 primary kept byte for byte');
  assert.equal(storage.data.get(BOOK_V2_SOURCE_BACKUP_KEY), raw2);
  assert.equal(loaded.raw, storage.data.get(BOOK_V3_STORAGE_KEY));
  assert.deepEqual(toV2(loaded.progress!), v2());
  assert.deepEqual(loaded.progress!.preferences, { ...preferences, ...DEFAULT_BOOK_SETTINGS });
  // A second load reads v3 and writes nothing.
  assert.equal(loadBookProgressV3(storage).status, 'loaded');
  assert.equal(storage.writes().length, 2);
});

test('R7 v3: a v1 legacy record migrates through the existing v1 → v2 path and on to v3', () => {
  const storage = new MemoryStorage();
  const learning = serializeLearning(lesson());
  const legacyRaw = JSON.stringify(createProgress({ savedAt, studentPatterns: learning.studentPatterns, sceneProgress: learning.sceneProgress,
    supportLevel: learning.supportLevel, attempts: {}, hints: {}, preferences: { ...preferences, currentSceneId: 'scene-1' } }));
  storage.data.set(STORAGE_KEY, legacyRaw);
  const loaded = loadBookProgressV3(storage);
  assert.equal(loaded.status, 'migrated');
  assert.deepEqual(storage.writes(), [BOOK_V1_BACKUP_KEY, BOOK_STORAGE_KEY, BOOK_V2_SOURCE_BACKUP_KEY, BOOK_V3_STORAGE_KEY]);
  assert.equal(storage.data.get(STORAGE_KEY), legacyRaw, 'v1 source untouched');
  assert.equal(storage.data.get(BOOK_V1_BACKUP_KEY), legacyRaw);
  assert.equal(loaded.progress!.preferences.sfx, true);
});

test('R7 v3: corrupt sources, conflicts and failed writes block saving without touching any source', () => {
  // Corrupt v3 primary.
  const corrupt = new MemoryStorage();
  corrupt.data.set(BOOK_V3_STORAGE_KEY, '{"progressSchemaVersion":3');
  corrupt.data.set(BOOK_STORAGE_KEY, JSON.stringify(v2()));
  const blocked = loadBookProgressV3(corrupt);
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.canSave, false);
  assert.deepEqual(corrupt.writes(), []);
  assert.equal(saveBookProgressV3(v3(), corrupt, blocked.raw).ok, false, 'never overwritten by an automatic save');
  // Corrupt v2 primary with no v3: no v3 key appears.
  const broken = new MemoryStorage();
  broken.data.set(BOOK_STORAGE_KEY, 'not json');
  assert.equal(loadBookProgressV3(broken).status, 'blocked');
  assert.equal(broken.data.has(BOOK_V3_STORAGE_KEY), false);
  // A different existing v2 source backup is never replaced.
  const conflict = new MemoryStorage();
  conflict.data.set(BOOK_STORAGE_KEY, JSON.stringify(v2()));
  conflict.data.set(BOOK_V2_SOURCE_BACKUP_KEY, 'another source');
  const refused = loadBookProgressV3(conflict);
  assert.equal(refused.status, 'blocked');
  assert.equal(refused.error?.code, 'BACKUP_CONFLICT');
  assert.equal(conflict.data.get(BOOK_V2_SOURCE_BACKUP_KEY), 'another source');
  assert.equal(conflict.data.has(BOOK_V3_STORAGE_KEY), false);
  // The v3 write fails: the exact backup stays and a retry reuses it.
  const quota = new MemoryStorage();
  const raw2 = JSON.stringify(v2());
  quota.data.set(BOOK_STORAGE_KEY, raw2);
  quota.failWrite.add(BOOK_V3_STORAGE_KEY);
  assert.equal(loadBookProgressV3(quota).status, 'blocked');
  assert.equal(quota.data.get(BOOK_V2_SOURCE_BACKUP_KEY), raw2);
  quota.failWrite.clear();
  assert.equal(loadBookProgressV3(quota).status, 'migrated');
  assert.equal(quota.writes().filter(key => key === BOOK_V2_SOURCE_BACKUP_KEY).length, 1, 'the identical backup is not rewritten');
  // Reads that fail block everything.
  const unreadable = new MemoryStorage();
  unreadable.failRead.add(BOOK_V3_STORAGE_KEY);
  assert.equal(loadBookProgressV3(unreadable).status, 'blocked');
});

test('R7 v3: saves are CAS-guarded and need the migration first; settings survive a round trip', () => {
  const storage = new MemoryStorage();
  storage.data.set(BOOK_STORAGE_KEY, JSON.stringify(v2()));
  assert.equal(saveBookProgressV3(v3(), storage, null).ok, false, 'MIGRATION_REQUIRED while only v2 exists');
  const loaded = loadBookProgressV3(storage);
  const saved = value(saveBookProgressV3(v3({ sfx: false, autoShot: true }), storage, loaded.raw));
  assert.equal(storage.data.get(BOOK_V3_STORAGE_KEY), saved.raw);
  const reloaded = loadBookProgressV3(storage);
  assert.deepEqual(reloaded.progress, saved.progress);
  assert.equal(saveBookProgressV3(v3(), storage, loaded.raw).ok, false, 'another tab changed it');
  // The v2 writer keeps writing only its own key (old tabs never touch v3).
  value(saveBookProgress(v2(), storage, storage.data.get(BOOK_STORAGE_KEY) ?? null));
  assert.equal(storage.data.get(BOOK_V3_STORAGE_KEY), saved.raw);
});

test('R7 v3: imports accept v1, v2 and v3 files as previews; commit keeps the current primary as a backup', () => {
  const fromV2File = value(parseBookImportV3(JSON.stringify(v2())));
  assert.equal(fromV2File.sourceSchemaVersion, 2);
  assert.deepEqual(fromV2File.progress.preferences, { ...preferences, ...DEFAULT_BOOK_SETTINGS });
  const fromV3File = value(parseBookImportV3(JSON.stringify(v3({ sfx: false, autoShot: false }))));
  assert.equal(fromV3File.sourceSchemaVersion, 3);
  assert.equal(fromV3File.progress.preferences.sfx, false);
  assert.equal(parseBookImportV3(JSON.stringify({ ...v3(), progressSchemaVersion: 4 })).ok, false);
  const storage = new MemoryStorage();
  const current = JSON.stringify(v3());
  storage.data.set(BOOK_V3_STORAGE_KEY, current);
  const committed = value(commitBookImportV3(fromV3File, storage, current));
  assert.equal(storage.data.get(BOOK_V3_BACKUP_KEY), current, 'the replaced primary is kept');
  assert.equal(storage.data.get(BOOK_V3_STORAGE_KEY), committed.raw);
  assert.equal(commitBookImportV3(fromV2File, storage, current).ok, false, 'CAS: the primary changed since the preview');
  const tampered = { ...fromV3File, progress: { ...fromV3File.progress, savedAt: '2027-01-01T00:00:00.000Z' } };
  assert.equal(commitBookImportV3(tampered, storage, committed.raw).ok, false, 'a modified preview is revalidated');
  assert.ok(value(exportBookProgressV3(committed.progress)).includes('"progressSchemaVersion": 3'));
});

test('R7 v3: backups list every kept source; delete removes every owned key (v1–v3) and nothing else', () => {
  const storage = new MemoryStorage();
  for (const key of appKeys) storage.data.set(key, `saved ${key}`);
  storage.data.set('other-app', 'keep');
  assert.deepEqual(value(readBookBackupsV3(storage)).map(item => item.key), [BACKUP_KEY, BOOK_V1_BACKUP_KEY, BOOK_BACKUP_KEY, BOOK_V2_SOURCE_BACKUP_KEY, BOOK_V3_BACKUP_KEY]);
  assert.equal(deleteBookProgressV3(storage).ok, true);
  for (const key of appKeys) assert.equal(storage.data.has(key), false, key);
  assert.equal(storage.data.get('other-app'), 'keep');
  assert.equal(loadBookProgressV3(storage).status, 'empty', 'no resurrection from any version');
});
