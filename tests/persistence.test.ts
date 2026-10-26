import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_KEY, MAX_IMPORT_BYTES, STORAGE_KEY, commitImport, createProgress, deleteProgress, exportProgress, loadProgress, parseImport, saveProgress, validateProgress } from '../src/persistence/progress.ts';
import type { StorageLike } from '../src/persistence/progress.ts';
import { lessonContent } from '../src/content/lesson.ts';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  writes = 0;
  failRead = false;
  failWrite = false;
  failDelete = false;
  getItem(key: string) { if (this.failRead) throw new Error('SecurityError'); return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw new Error('QuotaExceededError'); this.writes++; this.data.set(key, value); }
  removeItem(key: string) { if (this.failDelete) throw new Error('SecurityError'); this.data.delete(key); }
}
const note = (id = 'scene-6-main-1') => ({ id, kind: 'note' as const, onset: { n: 0, d: 1 }, duration: { n: 1, d: 2 }, pitch: { step: 'C', alter: 0, octave: 4 }, notation: { type: 'half' as const, dots: 0 } });
const sample = () => createProgress({ savedAt: '2026-10-26T00:00:00.000Z', studentPatterns: { 'scene-6/main': [note()] }, sceneProgress: { 'scene-6': { answers: {}, explanationSelfCheck: true } } });
const expectCode = (result: ReturnType<typeof validateProgress>, code: string) => { assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, code); };

test('save/load uses validated minimum envelope and no runtime autoplay state', () => {
  const storage = new MemoryStorage();
  const progress = sample();
  assert.deepEqual(saveProgress(progress, storage), { ok: true, value: progress });
  assert.deepEqual(loadProgress(storage), { ok: true, value: progress });
  assert.equal(JSON.stringify(loadProgress(storage)).includes('AudioContext'), false);
});
test('parseImport is preview-only; cancellation has no write, explicit confirmation saves', () => {
  const storage = new MemoryStorage();
  saveProgress(createProgress(), storage);
  const before = storage.getItem(STORAGE_KEY);
  const preview = parseImport(JSON.stringify(sample()));
  assert.equal(preview.ok, true);
  assert.equal(storage.writes, 1);
  assert.equal(storage.getItem(STORAGE_KEY), before);
  if (preview.ok) { assert.equal(preview.value.summary.patternCount, 1); assert.equal(commitImport(preview.value, storage).ok, true); }
  assert.equal(storage.writes, 2);
});
test('malformed, future, wrong content and invented old versions reject without replacing good storage', () => {
  const storage = new MemoryStorage(); saveProgress(sample(), storage);
  const before = storage.getItem(STORAGE_KEY);
  assert.equal(parseImport('{bad').ok, false);
  for (const progressSchemaVersion of [0, 2, 999]) expectCode(validateProgress({ ...sample(), progressSchemaVersion }), 'SCHEMA_VERSION');
  expectCode(validateProgress({ ...sample(), contentVersion: '2.0.0' }), 'CONTENT_VERSION');
  assert.equal(storage.getItem(STORAGE_KEY), before);
});
test('rest.pitch, missing pitch, duplicate IDs and invalid notation reject', () => {
  const p = sample();
  expectCode(validateProgress({ ...p, studentPatterns: { 'scene-6/main': [{ ...note(), kind: 'rest' }] } }), 'REST_PITCH');
  const without = note(); delete (without as { pitch?: unknown }).pitch;
  assert.equal(validateProgress({ ...p, studentPatterns: { 'scene-6/main': [without] } }).ok, false);
  expectCode(validateProgress({ ...p, studentPatterns: { 'scene-6/main': [note()], 'scene-2/main': [note()] } }), 'DUPLICATE_ID');
  expectCode(validateProgress({ ...p, studentPatterns: { 'scene-6/main': [{ ...note(), notation: { type: 'quarter' } }] } }), 'NOTATION');
});
test('draft empty pattern valid; gaps, nonnormalized fractions and overfull patterns reject', () => {
  assert.equal(validateProgress(createProgress({ studentPatterns: { 'scene-6/main': [] } })).ok, true);
  const p = sample();
  expectCode(validateProgress({ ...p, studentPatterns: { 'scene-6/main': [{ ...note(), onset: { n: 1, d: 4 } }] } }), 'EVENT_SEQUENCE');
  expectCode(validateProgress({ ...p, studentPatterns: { 'scene-6/main': [{ ...note(), duration: { n: 2, d: 4 } }] } }), 'FRACTION_NORMALIZED');
  const second = { ...note('second'), onset: { n: 1, d: 2 }, duration: { n: 1, d: 1 }, notation: { type: 'whole' } };
  expectCode(validateProgress({ ...p, studentPatterns: { 'scene-6/main': [note(), second] } }), 'MEASURE_RANGE');
});
test('oversized input, dangerous keys and excessive nesting do not execute or mutate anything', () => {
  assert.equal(parseImport(' '.repeat(MAX_IMPORT_BYTES + 1)).ok, false);
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const text = JSON.stringify(sample()).replace('"answers":{}', `"answers":{"${key}":"x"}`);
    const result = parseImport(text);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'UNSAFE_KEY');
  }
  assert.equal(({} as { polluted?: string }).polluted, undefined);
  let nested: unknown = 'x'; for (let i = 0; i < 30; i++) nested = { x: nested };
  expectCode(validateProgress(nested), 'LIMIT');
});
test('unknown runtime and personal fields reject; counters, preferences and observations bounded', () => {
  expectCode(validateProgress({ ...sample(), audioContext: {} }), 'UNKNOWN_FIELD');
  expectCode(validateProgress({ ...sample(), email: 'private@example.test' }), 'UNKNOWN_FIELD');
  expectCode(validateProgress({ ...sample(), attempts: { answer: -1 } }), 'INTEGER');
  expectCode(validateProgress({ ...sample(), preferences: { ...sample().preferences, volume: 2 } }), 'VOLUME');
  expectCode(validateProgress({ ...sample(), sceneProgress: { 'scene-1': { answers: {}, observedLanes: { upper: 'inferred' } } } }), 'OBSERVATION_MODE');
});
test('quota and security exceptions return actionable errors and preserve good key', () => {
  const storage = new MemoryStorage(); saveProgress(sample(), storage);
  const before = storage.getItem(STORAGE_KEY);
  storage.failWrite = true;
  const attempted = saveProgress(createProgress({ supportLevel: 3 }), storage);
  assert.equal(attempted.ok, false);
  if (!attempted.ok) assert.equal(attempted.error.code, 'STORAGE_WRITE');
  assert.equal(storage.getItem(STORAGE_KEY), before);
  storage.failRead = true; assert.equal(loadProgress(storage).ok, false);
});
test('forged preview is revalidated at commit and does not overwrite valid progress', () => {
  const storage = new MemoryStorage(); saveProgress(sample(), storage);
  const before = storage.getItem(STORAGE_KEY);
  const preview = parseImport(JSON.stringify(sample())); assert.equal(preview.ok, true);
  if (preview.ok) {
    preview.value.progress.supportLevel = 99 as 1;
    assert.equal(commitImport(preview.value, storage).ok, false);
  }
  assert.equal(storage.getItem(STORAGE_KEY), before);
});
test('delete removes only app primary and backup; refresh never restores old backup', () => {
  const storage = new MemoryStorage(); saveProgress(sample(), storage);
  storage.setItem(BACKUP_KEY, JSON.stringify(sample())); storage.setItem('other-app', 'preserve');
  assert.equal(deleteProgress(storage).ok, true);
  assert.deepEqual(loadProgress(storage), { ok: true, value: null });
  assert.equal(storage.getItem(BACKUP_KEY), null);
  assert.equal(storage.getItem('other-app'), 'preserve');
  storage.setItem(BACKUP_KEY, JSON.stringify(sample()));
  assert.deepEqual(loadProgress(storage), { ok: true, value: null });
});
test('delete failure reported; valid exports parse to same isolated envelope', () => {
  const storage = new MemoryStorage(); storage.failDelete = true; assert.equal(deleteProgress(storage).ok, false);
  const p = sample(); const result = exportProgress(p); assert.equal(result.ok, true);
  if (result.ok) { const imported = parseImport(result.value); assert.equal(imported.ok, true); if (imported.ok) assert.deepEqual(imported.value.progress, p); }
  const result2 = validateProgress(p); assert.equal(result2.ok, true);
  if (result2.ok) { result2.value.studentPatterns['scene-6/main'][0].id = 'changed'; assert.equal(p.studentPatterns['scene-6/main'][0].id, 'scene-6-main-1'); }
});
test('all six real content scenes serialize as valid progress without merging comparison lanes', () => {
  const studentPatterns = Object.fromEntries(lessonContent.scenes.flatMap(scene => scene.lanes.map(lane => [`${scene.sceneId}/${lane.laneId}`, lane.events])));
  const sceneProgress = Object.fromEntries(lessonContent.scenes.map(scene => [scene.sceneId, { answers: {}, observedDurations: [], observedLanes: {}, explanationSelfCheck: false }]));
  const progress = createProgress({ studentPatterns, sceneProgress });
  assert.equal(Object.keys(progress.studentPatterns).length, 9);
  const storage = new MemoryStorage();
  assert.equal(saveProgress(progress, storage).ok, true);
  const reloaded = loadProgress(storage);
  assert.equal(reloaded.ok, true);
  if (reloaded.ok && reloaded.value) {
    assert.equal(reloaded.value.studentPatterns['scene-1/upper'].length, 1);
    assert.equal(reloaded.value.studentPatterns['scene-1/lower'].length, 4);
    assert.equal(reloaded.value.studentPatterns['scene-6/main'].length, 0);
  }
});
