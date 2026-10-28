import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOK_BACKUP_KEY, BOOK_STORAGE_KEY, BOOK_V1_BACKUP_KEY, commitBookImport,
  deleteBookProgress, exportBookProgress, loadBookProgress, parseBookImport,
  readBookBackups, saveBookProgress, validateBookProgress,
} from '../src/persistence/bookProgress.ts';
import type { BookPreferences, BookProgressEnvelope, StoredSpreadId } from '../src/persistence/bookProgress.ts';
import { BACKUP_KEY, MAX_IMPORT_BYTES, STORAGE_KEY, createProgress } from '../src/persistence/progress.ts';
import type { ProgressEnvelope, Result, StorageLike } from '../src/persistence/progress.ts';
import { captureBookProgress, restoreBookLearning } from '../src/book/learningProgress.ts';
import { createLessonState, isSceneComplete, reduceLesson, sceneEvents, sceneState, serializeLearning } from '../src/lesson/controller.ts';
import type { LessonState } from '../src/lesson/controller.ts';
import { getScene, makePattern } from '../src/content/lesson.ts';
import type { SceneId } from '../src/content/types.ts';
import { frac } from '../src/domain/index.ts';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  operations: { kind: 'read' | 'write' | 'delete'; key: string; value?: string }[] = [];
  failRead = new Set<string>();
  failWrite = new Set<string>();
  failDelete = new Set<string>();
  getItem(key: string) {
    this.operations.push({ kind: 'read', key });
    if (this.failRead.has(key)) throw new Error('SecurityError');
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.operations.push({ kind: 'write', key, value });
    if (this.failWrite.has(key)) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.operations.push({ kind: 'delete', key });
    if (this.failDelete.has(key)) throw new Error('SecurityError');
    this.data.delete(key);
  }
  writes() { return this.operations.filter(operation => operation.kind === 'write'); }
}

type Mutable<T> = T extends readonly (infer Item)[] ? Mutable<Item>[]
  : T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T;
const clone = <T>(value: T): Mutable<T> => JSON.parse(JSON.stringify(value));
const savedAt = '2026-10-28T09:00:00.000Z';
const preferences: BookPreferences = { mode: '3d', reducedMotion: false, muted: true, volume: 0.4 };
const appKeys = [STORAGE_KEY, BACKUP_KEY, BOOK_STORAGE_KEY, BOOK_BACKUP_KEY, BOOK_V1_BACKUP_KEY];

function value<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(JSON.stringify(result.error));
  return result.value;
}
function at(sceneId: SceneId): LessonState { return reduceLesson(createLessonState(), { type: 'navigate', sceneId }); }
function capture(lesson = createLessonState(), lastStableSpreadId: StoredSpreadId = 'spread-1', previous?: BookProgressEnvelope) {
  return value(captureBookProgress({ lesson, lastStableSpreadId, preferences, previous, savedAt }));
}
function legacy(sceneId: SceneId = 'scene-1', lesson = at(sceneId)): ProgressEnvelope {
  const learning = serializeLearning(lesson);
  return createProgress({ savedAt, studentPatterns: learning.studentPatterns, sceneProgress: learning.sceneProgress,
    supportLevel: learning.supportLevel, attempts: { 'scene-2/split': 3 }, hints: { 'scene-1/compare': 1 },
    preferences: { ...preferences, currentSceneId: sceneId } });
}
function rawLegacy(sceneId: SceneId = 'scene-1', lesson?: LessonState) {
  return ` \n${JSON.stringify(legacy(sceneId, lesson), null, 2)}\n `;
}
function answerAll(lesson: LessonState): LessonState {
  for (const question of getScene(lesson.currentSceneId).questions) {
    lesson = reduceLesson(lesson, { type: 'answer', questionId: question.id, value: question.correctValue });
  }
  return lesson;
}
function completedComposition(): LessonState {
  let lesson = at('scene-6');
  for (const [denominator, kind] of [[2, 'note'], [4, 'rest'], [8, 'note'], [8, 'note']] as const) {
    lesson = reduceLesson(lesson, { type: 'add', duration: frac(1, denominator), kind });
  }
  return reduceLesson(lesson, { type: 'explain', checked: true });
}

test('an empty store is writable but loading alone creates no progress or backup', () => {
  const storage = new MemoryStorage();
  const loaded = loadBookProgress(storage);
  assert.equal(loaded.status, 'empty');
  assert.equal(loaded.progress, null);
  assert.equal(loaded.raw, null);
  assert.equal(loaded.legacyRaw, null);
  assert.equal(loaded.error, null);
  assert.equal(loaded.canSave, true);
  assert.equal(storage.writes().length, 0);
});

test('v2 save/load keeps a strict isolated envelope with the exact primary CAS string', () => {
  const storage = new MemoryStorage();
  const progress = capture();
  const saved = value(saveBookProgress(progress, storage, null));
  assert.equal(storage.data.get(BOOK_STORAGE_KEY), saved.raw);
  assert.deepEqual(saved.progress, progress);
  const loaded = loadBookProgress(storage);
  assert.equal(loaded.status, 'loaded');
  assert.equal(loaded.raw, saved.raw);
  assert.equal(loaded.canSave, true);
  assert.deepEqual(loaded.progress, progress);
  const detached = value(validateBookProgress(progress));
  detached.preferences.muted = false;
  assert.equal(progress.preferences.muted, true);
  const wire = JSON.parse(saved.raw) as Record<string, unknown>;
  assert.equal(wire.progressSchemaVersion, 2);
  assert.equal(wire.bookUiVersion, '2.1.0');
  assert.equal(wire.lessonSchemaVersion, '2.0.0');
  assert.equal(wire.contentVersion, '1.0.0');
  for (const excluded of ['audioContext', 'transport', 'sessionId', 'logicalOffset', 'progress', 'destinationSpreadId', 'gesture', 'revision', 'history', 'email']) {
    assert.equal(Object.hasOwn(wire, excluded), false, excluded);
  }
});

test('all six legacy scene locations migrate to stable spread IDs without changing legacy bytes', () => {
  for (let index = 1; index <= 6; index++) {
    const sceneId = `scene-${index}` as SceneId;
    const spreadId = `spread-${index}` as StoredSpreadId;
    const storage = new MemoryStorage();
    const raw = rawLegacy(sceneId);
    storage.data.set(STORAGE_KEY, raw);
    const migrated = loadBookProgress(storage);
    assert.equal(migrated.status, 'migrated', JSON.stringify(migrated.error));
    assert.equal(migrated.canSave, true);
    assert.equal(migrated.progress?.lastStableSpreadId, spreadId);
    assert.equal(migrated.legacyRaw, raw);
    assert.equal(storage.data.get(STORAGE_KEY), raw);
    assert.equal(storage.data.get(BOOK_V1_BACKUP_KEY), raw);
    assert.equal(migrated.raw, storage.data.get(BOOK_STORAGE_KEY));
    assert.deepEqual(storage.writes().map(write => write.key), [BOOK_V1_BACKUP_KEY, BOOK_STORAGE_KEY]);
    assert.equal(Object.keys(migrated.progress!.studentPatterns).length, 9);
    assert.equal(migrated.progress!.studentPatterns['scene-1/upper'].length, 1);
    assert.equal(migrated.progress!.studentPatterns['scene-1/lower'].length, 4);
    assert.equal(value(restoreBookLearning(migrated.progress!)).currentSceneId, sceneId);
    const before = new Map(storage.data);
    storage.operations = [];
    const repeated = loadBookProgress(storage);
    assert.equal(repeated.status, 'loaded');
    assert.deepEqual(storage.data, before);
    assert.equal(storage.writes().length, 0, 'a repeated mount must not migrate twice');
  }
});

test('an existing valid v2 primary wins over legacy data and retains exact whitespace for CAS', () => {
  const storage = new MemoryStorage();
  const progress = capture(at('scene-4'), 'spread-4');
  const raw = `\n${JSON.stringify(progress, null, 4)}\n`;
  storage.data.set(BOOK_STORAGE_KEY, raw);
  storage.data.set(STORAGE_KEY, rawLegacy('scene-2'));
  storage.data.set(BOOK_V1_BACKUP_KEY, 'older immutable backup');
  const loaded = loadBookProgress(storage);
  assert.equal(loaded.status, 'loaded');
  assert.equal(loaded.raw, raw);
  assert.equal(loaded.progress?.lastStableSpreadId, 'spread-4');
  assert.equal(storage.data.get(BOOK_V1_BACKUP_KEY), 'older immutable backup');
  assert.equal(storage.writes().length, 0);
});

test('corrupt or future v2 primary blocks automatic save and never falls back to a legacy overwrite', () => {
  const valid = capture();
  const invalid = ['{broken', JSON.stringify({ ...valid, progressSchemaVersion: 999 }), JSON.stringify({ ...valid, bookUiVersion: '9.0.0' }), JSON.stringify({ ...valid, contentVersion: '9.0.0' })];
  for (const raw of invalid) {
    const storage = new MemoryStorage();
    storage.data.set(BOOK_STORAGE_KEY, raw);
    storage.data.set(STORAGE_KEY, rawLegacy());
    const before = new Map(storage.data);
    const loaded = loadBookProgress(storage);
    assert.equal(loaded.status, 'blocked');
    assert.equal(loaded.canSave, false);
    assert.equal(loaded.progress, null);
    assert.equal(loaded.raw, raw);
    assert.ok(loaded.error);
    assert.equal(saveBookProgress(valid, storage, raw).ok, false);
    assert.deepEqual(storage.data, before);
    assert.equal(storage.writes().length, 0);
  }
});

test('corrupt, unsupported and semantically invalid legacy sources remain untouched', () => {
  const wrongReference = clone(legacy());
  wrongReference.studentPatterns['scene-1/upper'][0].id = 'changed-reference';
  const brokenSplit = clone(legacy());
  brokenSplit.studentPatterns['scene-2/main'][0].duration = { n: 1, d: 2 };
  brokenSplit.studentPatterns['scene-2/main'][0].notation = { type: 'half', dots: 0 };
  const invalid = ['not JSON', JSON.stringify({ ...legacy(), progressSchemaVersion: 0 }),
    JSON.stringify({ ...legacy(), progressSchemaVersion: 999 }), JSON.stringify({ ...legacy(), contentVersion: '2.0.0' }),
    JSON.stringify(wrongReference), JSON.stringify(brokenSplit)];
  for (const raw of invalid) {
    const storage = new MemoryStorage(); storage.data.set(STORAGE_KEY, raw);
    const loaded = loadBookProgress(storage);
    assert.equal(loaded.status, 'blocked');
    assert.equal(loaded.canSave, false);
    assert.equal(loaded.legacyRaw, raw);
    assert.ok(loaded.error);
    assert.equal(storage.data.get(STORAGE_KEY), raw);
    assert.equal(storage.data.has(BOOK_STORAGE_KEY), false);
    assert.equal(storage.data.has(BOOK_V1_BACKUP_KEY), false);
    assert.equal(storage.writes().length, 0);
  }
});

test('migration refuses to replace an immutable v1 backup from another source', () => {
  const storage = new MemoryStorage();
  const raw = rawLegacy('scene-2');
  storage.data.set(STORAGE_KEY, raw);
  storage.data.set(BOOK_V1_BACKUP_KEY, rawLegacy('scene-1'));
  const before = new Map(storage.data);
  const loaded = loadBookProgress(storage);
  assert.equal(loaded.status, 'blocked');
  assert.equal(loaded.canSave, false);
  assert.ok(loaded.error);
  assert.deepEqual(storage.data, before);
  assert.equal(storage.writes().length, 0);
});

test('migration backup failure cannot create a v2 primary or damage the source', () => {
  const storage = new MemoryStorage();
  const raw = rawLegacy('scene-2'); storage.data.set(STORAGE_KEY, raw);
  storage.failWrite.add(BOOK_V1_BACKUP_KEY);
  const loaded = loadBookProgress(storage);
  assert.equal(loaded.status, 'blocked');
  assert.equal(loaded.canSave, false);
  assert.ok(loaded.error);
  assert.equal(storage.data.get(STORAGE_KEY), raw);
  assert.equal(storage.data.has(BOOK_STORAGE_KEY), false);
  assert.deepEqual(storage.writes().map(write => write.key), [BOOK_V1_BACKUP_KEY]);
});

test('failed v2 migration write retains the exact backup and can retry without overwriting it', () => {
  const storage = new MemoryStorage();
  const raw = rawLegacy('scene-3'); storage.data.set(STORAGE_KEY, raw);
  storage.failWrite.add(BOOK_STORAGE_KEY);
  const failed = loadBookProgress(storage);
  assert.equal(failed.status, 'blocked');
  assert.equal(failed.canSave, false);
  assert.equal(storage.data.get(STORAGE_KEY), raw);
  assert.equal(storage.data.get(BOOK_V1_BACKUP_KEY), raw);
  assert.equal(storage.data.has(BOOK_STORAGE_KEY), false);
  storage.failWrite.clear(); storage.operations = [];
  const retried = loadBookProgress(storage);
  assert.equal(retried.status, 'migrated');
  assert.equal(retried.progress?.lastStableSpreadId, 'spread-3');
  assert.equal(storage.data.get(BOOK_V1_BACKUP_KEY), raw);
  assert.deepEqual(storage.writes().map(write => write.key), [BOOK_STORAGE_KEY]);
});

test('storage read failures block migration and writes while retaining memory-export capability', () => {
  for (const key of [BOOK_STORAGE_KEY, STORAGE_KEY, BOOK_V1_BACKUP_KEY]) {
    const storage = new MemoryStorage();
    storage.data.set(STORAGE_KEY, rawLegacy());
    storage.failRead.add(key);
    const loaded = loadBookProgress(storage);
    assert.equal(loaded.status, 'blocked', key);
    assert.equal(loaded.canSave, false);
    assert.ok(loaded.error);
    assert.equal(storage.writes().length, 0);
  }
  const storage = new MemoryStorage(); storage.failRead.add(BOOK_STORAGE_KEY);
  assert.equal(saveBookProgress(capture(), storage, null).ok, false);
  assert.equal(storage.writes().length, 0);
  assert.equal(parseBookImport(value(exportBookProgress(capture()))).ok, true);
});

test('save CAS rejects another tab change or a removed key without replacing newer data', () => {
  const storage = new MemoryStorage();
  const first = value(saveBookProgress(capture(), storage, null));
  const newer = capture(at('scene-2'), 'spread-2');
  const second = value(saveBookProgress(newer, storage, first.raw));
  const writes = storage.writes().length;
  assert.equal(saveBookProgress(capture(at('scene-3'), 'spread-3'), storage, first.raw).ok, false);
  assert.equal(storage.data.get(BOOK_STORAGE_KEY), second.raw);
  assert.equal(storage.writes().length, writes);
  storage.data.delete(BOOK_STORAGE_KEY);
  assert.equal(saveBookProgress(newer, storage, second.raw).ok, false);
  assert.equal(storage.data.has(BOOK_STORAGE_KEY), false);
  assert.equal(storage.writes().length, writes);
});

test('quota failure during normal save preserves the previous primary and exact expected raw', () => {
  const storage = new MemoryStorage();
  const first = value(saveBookProgress(capture(), storage, null));
  storage.failWrite.add(BOOK_STORAGE_KEY);
  assert.equal(saveBookProgress(capture(at('scene-2'), 'spread-2'), storage, first.raw).ok, false);
  assert.equal(storage.data.get(BOOK_STORAGE_KEY), first.raw);
  assert.equal(loadBookProgress(storage).raw, first.raw);
});

test('v1/v2 import parsing is preview-only and preserves source identity and exact raw', () => {
  const storage = new MemoryStorage();
  const existing = value(saveBookProgress(capture(), storage, null));
  const before = new Map(storage.data), writes = storage.writes().length;
  for (const [raw, version, stable] of [[rawLegacy('scene-5'), 1, 'spread-5'],
    [value(exportBookProgress(capture(at('scene-6'), 'spread-6'))), 2, 'spread-6']] as const) {
    const preview = value(parseBookImport(raw));
    assert.equal(preview.sourceSchemaVersion, version);
    assert.equal(preview.sourceRaw, raw);
    assert.equal(preview.summary.lastStableSpreadId, stable);
    assert.equal(preview.summary.patternCount, 9);
    assert.equal(preview.progress.lastStableSpreadId, stable);
  }
  assert.equal(storage.writes().length, writes);
  assert.deepEqual(storage.data, before);
  assert.equal(storage.data.get(BOOK_STORAGE_KEY), existing.raw);
});

test('explicit v2 import preserves a corrupt raw primary before replacing it', () => {
  const storage = new MemoryStorage();
  const raw = '  { damaged v2 original \n';
  storage.data.set(BOOK_STORAGE_KEY, raw);
  const preview = value(parseBookImport(value(exportBookProgress(capture(at('scene-4'), 'spread-4')))));
  const imported = value(commitBookImport(preview, storage, raw));
  assert.equal(storage.data.get(BOOK_BACKUP_KEY), raw);
  assert.equal(storage.data.get(BOOK_STORAGE_KEY), imported.raw);
  assert.equal(imported.progress.lastStableSpreadId, 'spread-4');
  assert.deepEqual(storage.writes().map(write => write.key), [BOOK_BACKUP_KEY, BOOK_STORAGE_KEY]);
});

test('a valid prior backup survives corrupt-primary import even when the primary write would fail', () => {
  const storage = new MemoryStorage();
  const raw = 'corrupt current primary';
  const backup = `\n${JSON.stringify(capture(at('scene-2'), 'spread-2'), null, 2)}\n`;
  storage.data.set(BOOK_STORAGE_KEY, raw);
  storage.data.set(BOOK_BACKUP_KEY, backup);
  storage.failWrite.add(BOOK_STORAGE_KEY);
  const before = new Map(storage.data);
  const preview = value(parseBookImport(value(exportBookProgress(capture(at('scene-4'), 'spread-4')))));
  const imported = commitBookImport(preview, storage, raw);
  assert.equal(imported.ok, false);
  if (!imported.ok) assert.equal(imported.error.code, 'IMPORT_BACKUP_CONFLICT');
  assert.deepEqual(storage.data, before);
  assert.equal(storage.writes().length, 0, 'the backup conflict must be detected before either write');
  assert.equal(parseBookImport(storage.data.get(BOOK_BACKUP_KEY)!).ok, true);
});

test('a different existing backup explicitly blocks replacement of a valid primary without mutation', () => {
  const storage = new MemoryStorage();
  const raw = JSON.stringify(capture(at('scene-1'), 'spread-1'));
  const backup = JSON.stringify(capture(at('scene-2'), 'spread-2'));
  storage.data.set(BOOK_STORAGE_KEY, raw);
  storage.data.set(BOOK_BACKUP_KEY, backup);
  const before = new Map(storage.data);
  const preview = value(parseBookImport(value(exportBookProgress(capture(at('scene-3'), 'spread-3')))));
  const imported = commitBookImport(preview, storage, raw);
  assert.equal(imported.ok, false);
  if (!imported.ok) assert.equal(imported.error.code, 'IMPORT_BACKUP_CONFLICT');
  assert.deepEqual(storage.data, before);
  assert.equal(storage.writes().length, 0);
});

test('a v1 import checks the existing v2 backup conflict before reserving an immutable legacy backup', () => {
  const storage = new MemoryStorage();
  const raw = JSON.stringify(capture(at('scene-1'), 'spread-1'));
  storage.data.set(BOOK_STORAGE_KEY, raw);
  storage.data.set(BOOK_BACKUP_KEY, JSON.stringify(capture(at('scene-2'), 'spread-2')));
  const before = new Map(storage.data);
  const preview = value(parseBookImport(rawLegacy('scene-3')));
  const imported = commitBookImport(preview, storage, raw);
  assert.equal(imported.ok, false);
  if (!imported.ok) assert.equal(imported.error.code, 'IMPORT_BACKUP_CONFLICT');
  assert.deepEqual(storage.data, before);
  assert.equal(storage.data.has(BOOK_V1_BACKUP_KEY), false);
  assert.equal(storage.writes().length, 0, 'a rejected import cannot reserve the immutable source slot');
});

test('an identical existing backup is reused without rewriting it during successful import', () => {
  const storage = new MemoryStorage();
  const raw = '  { exact corrupt primary already backed up \n';
  storage.data.set(BOOK_STORAGE_KEY, raw);
  storage.data.set(BOOK_BACKUP_KEY, raw);
  const preview = value(parseBookImport(value(exportBookProgress(capture(at('scene-4'), 'spread-4')))));
  const imported = value(commitBookImport(preview, storage, raw));
  assert.equal(imported.progress.lastStableSpreadId, 'spread-4');
  assert.equal(storage.data.get(BOOK_STORAGE_KEY), imported.raw);
  assert.equal(storage.data.get(BOOK_BACKUP_KEY), raw);
  assert.deepEqual(storage.writes().map(write => write.key), [BOOK_STORAGE_KEY]);
});

test('raw backup reading preserves corrupt strings exactly and excludes primary or unrelated keys', () => {
  const storage = new MemoryStorage();
  const expected = new Map([
    [BACKUP_KEY, '  { corrupt legacy backup \n'],
    [BOOK_V1_BACKUP_KEY, '\n원본 공백과 글자 그대로\n'],
    [BOOK_BACKUP_KEY, ''],
  ]);
  expected.forEach((raw, key) => storage.data.set(key, raw));
  storage.data.set(STORAGE_KEY, rawLegacy());
  storage.data.set(BOOK_STORAGE_KEY, JSON.stringify(capture()));
  storage.data.set('other-app:backup', 'private unrelated content');
  storage.data.set(`${BOOK_BACKUP_KEY}:unrelated`, 'unrelated sibling');
  const before = new Map(storage.data);
  const result = value(readBookBackups(storage));
  assert.deepEqual(new Map(result.map(item => [item.key, item.raw])), expected);
  assert.deepEqual(storage.data, before);
  assert.ok(storage.operations.every(operation => operation.kind === 'read' && expected.has(operation.key)));
  const empty = new MemoryStorage();
  assert.deepEqual(value(readBookBackups(empty)), []);
  assert.equal(empty.writes().length, 0);
});

test('raw backup read failure identifies its key and never deletes or rewrites preserved data', () => {
  const storage = new MemoryStorage();
  for (const key of [BACKUP_KEY, BOOK_V1_BACKUP_KEY, BOOK_BACKUP_KEY]) storage.data.set(key, `exact original ${key}`);
  const before = new Map(storage.data);
  storage.failRead.add(BOOK_V1_BACKUP_KEY);
  const result = readBookBackups(storage);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'BACKUP_READ');
    assert.equal(result.error.path, BOOK_V1_BACKUP_KEY);
  }
  assert.deepEqual(storage.data, before);
  assert.ok(storage.operations.every(operation => operation.kind === 'read'));
});

test('explicit v1 import backs up its exact source and preserves an existing v2 primary backup', () => {
  const storage = new MemoryStorage();
  const previous = value(saveBookProgress(capture(), storage, null));
  const raw = rawLegacy('scene-2');
  const imported = value(commitBookImport(value(parseBookImport(raw)), storage, previous.raw));
  assert.equal(imported.progress.lastStableSpreadId, 'spread-2');
  assert.equal(storage.data.get(BOOK_V1_BACKUP_KEY), raw);
  assert.equal(storage.data.get(BOOK_BACKUP_KEY), previous.raw);
  assert.equal(storage.data.get(BOOK_STORAGE_KEY), imported.raw);
});

test('modified import previews and concurrent primary changes cannot bypass revalidation or CAS', () => {
  const storage = new MemoryStorage();
  const previous = value(saveBookProgress(capture(), storage, null));
  const text = value(exportBookProgress(capture(at('scene-2'), 'spread-2')));
  const modified = value(parseBookImport(text));
  modified.progress.preferences.muted = !modified.progress.preferences.muted;
  assert.equal(commitBookImport(modified, storage, previous.raw).ok, false);
  const invalid = value(parseBookImport(text));
  invalid.progress.supportLevel = 99 as 1;
  assert.equal(commitBookImport(invalid, storage, previous.raw).ok, false);
  assert.equal(storage.data.get(BOOK_STORAGE_KEY), previous.raw);
  assert.equal(storage.data.has(BOOK_BACKUP_KEY), false);
  const stale = value(parseBookImport(text));
  const current = value(saveBookProgress(capture(at('scene-3'), 'spread-3'), storage, previous.raw));
  const writes = storage.writes().length;
  assert.equal(commitBookImport(stale, storage, previous.raw).ok, false);
  assert.equal(storage.data.get(BOOK_STORAGE_KEY), current.raw);
  assert.equal(storage.writes().length, writes);
  assert.equal(storage.data.has(BOOK_BACKUP_KEY), false);
});

test('failed explicit import backup cannot replace the primary; failed primary write keeps the backup', () => {
  for (const failingKey of [BOOK_BACKUP_KEY, BOOK_STORAGE_KEY]) {
    const storage = new MemoryStorage();
    const raw = 'corrupt original worth preserving'; storage.data.set(BOOK_STORAGE_KEY, raw);
    storage.failWrite.add(failingKey);
    const preview = value(parseBookImport(value(exportBookProgress(capture()))));
    assert.equal(commitBookImport(preview, storage, raw).ok, false);
    assert.equal(storage.data.get(BOOK_STORAGE_KEY), raw);
    if (failingKey === BOOK_BACKUP_KEY) {
      assert.equal(storage.data.has(BOOK_BACKUP_KEY), false);
      assert.equal(storage.writes().some(write => write.key === BOOK_STORAGE_KEY), false);
    } else assert.equal(storage.data.get(BOOK_BACKUP_KEY), raw);
  }
});

test('strict v2 versions, unknown runtime fields and invalid preference/tempo/spread values reject', () => {
  const good = capture();
  const invalid = [
    { ...good, progressSchemaVersion: 3 }, { ...good, bookUiVersion: '2.2.0' },
    { ...good, lessonSchemaVersion: '999.0.0' }, { ...good, contentVersion: '2.0.0' },
    { ...good, lessonId: 'other-lesson' }, { ...good, lastStableSpreadId: 'spread-7' },
    { ...good, transport: { state: 'playing', logicalOffset: 1 } }, { ...good, email: 'private@example.test' },
    { ...good, preferences: { ...good.preferences, currentSceneId: 'scene-2' } },
    { ...good, preferences: { ...good.preferences, volume: 2 } },
    { ...good, sceneTempos: { ...good.sceneTempos, 'scene-5': 500 } },
    { ...good, attempts: { 'scene-1/play': -1 } },
  ];
  for (const input of invalid) {
    assert.equal(validateBookProgress(input).ok, false);
    assert.equal(parseBookImport(JSON.stringify(input)).ok, false);
  }
});

test('v2 rejects unsafe keys, oversized inputs, unknown question answers and invalid musical meaning', () => {
  const good = capture();
  assert.equal(parseBookImport(' '.repeat(MAX_IMPORT_BYTES + 1)).ok, false);
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const unsafe = JSON.stringify(good).replace('"attempts":{}', `"attempts":{"${key}":1}`);
    assert.notEqual(unsafe, JSON.stringify(good));
    assert.equal(parseBookImport(unsafe).ok, false);
  }
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  const unknownAnswer = clone(good);
  unknownAnswer.sceneProgress['scene-1'].answers.unknown = 'invented';
  const invalidAnswer = clone(good);
  invalidAnswer.sceneProgress['scene-1'].answers['same-end'] = 'not-an-option';
  const reference = clone(good);
  reference.studentPatterns['scene-1/upper'][0].id = 'changed-reference';
  const split = clone(good);
  split.studentPatterns['scene-2/main'][0].duration = { n: 1, d: 2 };
  split.studentPatterns['scene-2/main'][0].notation = { type: 'half', dots: 0 };
  for (const invalid of [unknownAnswer, invalidAnswer, reference, split]) {
    assert.equal(validateBookProgress(invalid).ok, false);
    assert.equal(parseBookImport(JSON.stringify(invalid)).ok, false);
  }
});

test('scene 2 rejects a rest replacing its whole note even when total duration is still one', () => {
  const rest = makePattern('invalid-split-rest', [{ duration: frac(1), kind: 'rest' }]);
  const current = clone(capture());
  current.studentPatterns['scene-2/main'] = clone(rest);
  assert.equal(validateBookProgress(current).ok, false);
  assert.equal(parseBookImport(JSON.stringify(current)).ok, false);
  const old = clone(legacy());
  old.studentPatterns['scene-2/main'] = clone(rest);
  const raw = JSON.stringify(old), storage = new MemoryStorage();
  storage.data.set(STORAGE_KEY, raw);
  assert.equal(loadBookProgress(storage).status, 'blocked');
  assert.equal(storage.data.get(STORAGE_KEY), raw);
  assert.equal(storage.writes().length, 0);
});

test('scene 3 rejects unavailable half notes and rests in v2 and legacy imports', () => {
  const unavailable = [
    makePattern('invalid-combination-half', [{ duration: frac(1, 2) }]),
    makePattern('invalid-combination-rest', [{ duration: frac(1, 4), kind: 'rest' }]),
  ];
  for (const pattern of unavailable) {
    const current = clone(capture());
    current.studentPatterns['scene-3/A'] = clone(pattern);
    assert.equal(validateBookProgress(current).ok, false);
    assert.equal(parseBookImport(JSON.stringify(current)).ok, false);
    const old = clone(legacy());
    old.studentPatterns['scene-3/A'] = clone(pattern);
    assert.equal(parseBookImport(JSON.stringify(old)).ok, false);
  }
});

test('scene 3 keeps legally addable quarter/eighth/sixteenth drafts even when task answers are wrong', () => {
  const current = clone(capture(at('scene-3'), 'spread-3'));
  current.studentPatterns['scene-3/A'] = clone(makePattern('legal-under-target', [
    { duration: frac(1, 4) }, { duration: frac(1, 8) }, { duration: frac(1, 16) },
  ]));
  current.studentPatterns['scene-3/B'] = clone(makePattern('legal-over-target', Array.from({ length: 3 }, () => ({ duration: frac(1, 4) }))));
  current.studentPatterns['scene-3/C'] = clone(makePattern('legal-single-kind', [{ duration: frac(1, 4) }, { duration: frac(1, 4) }]));
  const checked = value(validateBookProgress(current));
  assert.equal(checked.achievements['scene-3'].current, false);
  const preview = value(parseBookImport(JSON.stringify(current)));
  const restored = value(restoreBookLearning(preview.progress));
  for (const laneId of ['A', 'B', 'C']) {
    assert.deepEqual(sceneEvents(restored, 'scene-3', laneId), current.studentPatterns[`scene-3/${laneId}`]);
  }
  assert.equal(isSceneComplete(restored), false);
  const old = clone(legacy('scene-3'));
  for (const laneId of ['A', 'B', 'C']) old.studentPatterns[`scene-3/${laneId}`] = clone(current.studentPatterns[`scene-3/${laneId}`]);
  const migrated = value(parseBookImport(JSON.stringify(old)));
  assert.equal(migrated.sourceSchemaVersion, 1);
  assert.equal(migrated.progress.achievements['scene-3'].current, false);
  assert.deepEqual(migrated.progress.studentPatterns['scene-3/A'], current.studentPatterns['scene-3/A']);
});

test('scene 4 rejects changed quarter-slot count and changed durations independently', () => {
  const unavailable = [
    makePattern('invalid-rest-slot-count', Array.from({ length: 3 }, () => ({ duration: frac(1, 4) }))),
    makePattern('invalid-rest-slot-duration', [
      { duration: frac(1, 2) }, { duration: frac(1, 4) }, { duration: frac(1, 8) }, { duration: frac(1, 8) },
    ]),
  ];
  for (const pattern of unavailable) {
    const current = clone(capture());
    current.studentPatterns['scene-4/main'] = clone(pattern);
    assert.equal(validateBookProgress(current).ok, false);
    assert.equal(parseBookImport(JSON.stringify(current)).ok, false);
    const old = clone(legacy());
    old.studentPatterns['scene-4/main'] = clone(pattern);
    assert.equal(parseBookImport(JSON.stringify(old)).ok, false);
  }
});

test('scene 4 accepts note/rest toggles preserving all four quarter slots, including an incomplete no-rest draft', () => {
  for (const kind of ['note', 'rest'] as const) {
    const current = clone(capture(at('scene-4'), 'spread-4'));
    current.studentPatterns['scene-4/main'] = clone(makePattern(`legal-rest-toggle-${kind}`,
      Array.from({ length: 4 }, () => ({ duration: frac(1, 4), kind }))));
    const checked = value(validateBookProgress(current));
    const restored = value(restoreBookLearning(checked));
    assert.deepEqual(sceneEvents(restored), current.studentPatterns['scene-4/main']);
    assert.equal(sceneEvents(restored).length, 4);
    assert.ok(sceneEvents(restored).every(event => event.duration.n === 1 && event.duration.d === 4));
    if (kind === 'note') assert.equal(checked.achievements['scene-4'].current, false);
    const old = clone(legacy('scene-4'));
    old.studentPatterns['scene-4/main'] = clone(current.studentPatterns['scene-4/main']);
    const migrated = value(parseBookImport(JSON.stringify(old)));
    assert.deepEqual(migrated.progress.studentPatterns['scene-4/main'], current.studentPatterns['scene-4/main']);
  }
});

test('split drafts, answers, independent lanes, support and tempo survive a v2 round trip', () => {
  let lesson = at('scene-2');
  lesson = reduceLesson(reduceLesson(lesson, { type: 'split' }), { type: 'split' });
  lesson = answerAll(lesson);
  const splitEvents = sceneEvents(lesson);
  lesson = reduceLesson(lesson, { type: 'navigate', sceneId: 'scene-5' });
  lesson = reduceLesson(lesson, { type: 'setTempo', bpm: 120 });
  lesson = reduceLesson(lesson, { type: 'setSupport', level: 3 });
  const progress = value(captureBookProgress({ lesson, lastStableSpreadId: 'spread-5', preferences,
    attempts: { 'scene-2/split': 2 }, hints: { 'scene-2/length': 1 }, savedAt }));
  const storage = new MemoryStorage(); value(saveBookProgress(progress, storage, null));
  const loaded = loadBookProgress(storage);
  assert.equal(loaded.status, 'loaded');
  const restored = value(restoreBookLearning(loaded.progress!));
  assert.equal(restored.currentSceneId, 'scene-5');
  assert.equal(sceneState(restored, 'scene-5').tempo, 120);
  assert.equal(restored.supportLevel, 3);
  assert.deepEqual(sceneEvents(restored, 'scene-2'), splitEvents);
  assert.equal(sceneState(restored, 'scene-2').answers['eighth-count'], '8');
  assert.equal(sceneEvents(restored, 'scene-1', 'upper').length, 1);
  assert.equal(sceneEvents(restored, 'scene-1', 'lower').length, 4);
  assert.deepEqual(loaded.progress!.attempts, { 'scene-2/split': 2 });
  assert.deepEqual(loaded.progress!.hints, { 'scene-2/length': 1 });
  assert.deepEqual(loaded.progress!.preferences, preferences);
  assert.deepEqual(sceneState(restored, 'scene-2').patterns.main.past, []);
  assert.deepEqual(sceneState(restored, 'scene-2').patterns.main.future, []);
  const edited = reduceLesson(reduceLesson(restored, { type: 'navigate', sceneId: 'scene-2' }), { type: 'split' });
  const ids = sceneEvents(edited).map(event => event.id);
  assert.equal(new Set(ids).size, ids.length, 'restored editor IDs cannot collide with saved children');
});

test('capture uses the explicitly committed spread instead of a lesson presentation location', () => {
  const progress = capture(at('scene-2'), 'spread-1');
  assert.equal(progress.lastStableSpreadId, 'spread-1');
  assert.equal(value(restoreBookLearning(progress)).currentSceneId, 'scene-1');
});

test('current achievements recompute from valid work while historical success survives later edits', () => {
  const complete = completedComposition();
  assert.equal(isSceneComplete(complete), true);
  const first = capture(complete, 'spread-6');
  assert.deepEqual(first.achievements['scene-6'], { current: true, ever: true });
  const incomplete = reduceLesson(complete, { type: 'remove' });
  assert.equal(isSceneComplete(incomplete), false);
  const next = capture(incomplete, 'spread-6', first);
  assert.deepEqual(next.achievements['scene-6'], { current: false, ever: true });
  const forgedCurrent = clone(next);
  forgedCurrent.achievements['scene-6'].current = true;
  const normalized = value(validateBookProgress(forgedCurrent));
  assert.deepEqual(normalized.achievements['scene-6'], { current: false, ever: true });
  assert.equal(isSceneComplete(value(restoreBookLearning(normalized))), false);
  assert.equal(forgedCurrent.achievements['scene-6'].current, true, 'validation must not mutate imported input');
});

test('text observation remains distinct from listened evidence through capture and migration', () => {
  let lesson = at('scene-1');
  lesson = reduceLesson(lesson, { type: 'observeLane', laneId: 'upper', mode: 'text' });
  lesson = reduceLesson(lesson, { type: 'observeLane', laneId: 'lower', mode: 'listened' });
  lesson = answerAll(lesson);
  const expected = { upper: 'text', lower: 'listened' };
  const progress = capture(lesson);
  assert.deepEqual(sceneState(value(restoreBookLearning(progress))).observedLanes, expected);
  const storage = new MemoryStorage(); storage.data.set(STORAGE_KEY, rawLegacy('scene-1', lesson));
  const migrated = loadBookProgress(storage);
  assert.equal(migrated.status, 'migrated');
  assert.deepEqual(migrated.progress!.sceneProgress['scene-1'].observedLanes, expected);
  assert.deepEqual(migrated.progress!.achievements['scene-1'], { current: true, ever: true });
});

test('delete removes all owned versions and backups without allowing legacy resurrection', () => {
  const storage = new MemoryStorage();
  storage.data.set(STORAGE_KEY, rawLegacy('scene-2'));
  storage.data.set(BOOK_STORAGE_KEY, JSON.stringify(capture()));
  for (const key of [BACKUP_KEY, BOOK_BACKUP_KEY, BOOK_V1_BACKUP_KEY]) storage.data.set(key, `saved ${key}`);
  storage.data.set('other-app', 'keep');
  storage.data.set(`${BOOK_STORAGE_KEY}:unrelated`, 'keep sibling');
  assert.equal(deleteBookProgress(storage).ok, true);
  for (const key of appKeys) assert.equal(storage.data.has(key), false);
  assert.equal(storage.data.get('other-app'), 'keep');
  assert.equal(storage.data.get(`${BOOK_STORAGE_KEY}:unrelated`), 'keep sibling');
  assert.equal(loadBookProgress(storage).status, 'empty');
  assert.equal(storage.writes().length, 0);
  storage.data.set(BOOK_V1_BACKUP_KEY, rawLegacy('scene-2'));
  storage.data.set(BOOK_BACKUP_KEY, JSON.stringify(capture()));
  assert.equal(loadBookProgress(storage).status, 'empty', 'a backup alone never restores deleted learning');
  assert.equal(storage.writes().length, 0);
});

test('delete failure is reported while cleanup still attempts every owned key', () => {
  const storage = new MemoryStorage();
  for (const key of appKeys) storage.data.set(key, 'preserve until removed');
  storage.failDelete.add(STORAGE_KEY);
  const result = deleteBookProgress(storage);
  assert.equal(result.ok, false);
  assert.deepEqual(new Set(storage.operations.filter(operation => operation.kind === 'delete').map(operation => operation.key)), new Set(appKeys));
  assert.equal(storage.data.get(STORAGE_KEY), 'preserve until removed');
  for (const key of appKeys.filter(key => key !== STORAGE_KEY)) assert.equal(storage.data.has(key), false);
});
