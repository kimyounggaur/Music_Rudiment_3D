/** Minimal local-only progress. Runtime audio, DOM, history and free prose are not saved. */
export const PROGRESS_SCHEMA_VERSION = 1;
export const CONTENT_VERSION = '1.0.0';
export const STORAGE_KEY = 'music-theory-lab:duration-basics:progress';
export const BACKUP_KEY = `${STORAGE_KEY}:backup`;
export const MAX_IMPORT_BYTES = 1024 * 1024;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface FractionData { n: number; d: number }
export interface StoredEvent {
  id: string;
  kind: 'note' | 'rest';
  onset: FractionData;
  duration: FractionData;
  notation: { type: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'; dots?: number; tuplet?: Readonly<{ actual: number; normal: number }> | null };
  pitch?: { step: string; alter: number; octave: number };
}
export interface StoredSceneProgress {
  answers: Record<string, string>;
  observedDurations?: readonly string[];
  observedLanes?: Record<string, 'text' | 'listened'>;
  explanationSelfCheck?: boolean;
}
export interface ProgressPreferences {
  mode: '2d' | '3d';
  reducedMotion: boolean;
  muted: boolean;
  volume: number;
  currentSceneId: string;
}
export interface ProgressEnvelope {
  progressSchemaVersion: number;
  appVersion: string;
  lessonId: 'duration-basics';
  contentVersion: string;
  savedAt: string;
  sceneProgress: Record<string, StoredSceneProgress>;
  attempts: Record<string, number>;
  hints: Record<string, number>;
  supportLevel: 1 | 2 | 3;
  studentPatterns: Record<string, readonly StoredEvent[]>;
  preferences: ProgressPreferences;
}
export interface ProgressError { code: string; path: string; message: string }
export type Result<T> = { ok: true; value: T } | { ok: false; error: ProgressError };
export interface ImportPreview {
  progress: ProgressEnvelope;
  summary: { lessonId: string; contentVersion: string; patternCount: number; savedAt: string };
}

class ValidationFailure extends Error {
  detail: ProgressError;
  constructor(code: string, path: string, message: string) {
    super(message);
    this.detail = { code, path, message };
  }
}
function fail(code: string, path: string, message: string): never { throw new ValidationFailure(code, path, message); }
const success = <T>(value: T): Result<T> => ({ ok: true, value });
const failure = (code: string, path: string, message: string): Result<never> => ({ ok: false, error: { code, path, message } });
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const byteLength = (text: string) => new TextEncoder().encode(text).byteLength;
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const sceneIds = new Set(['scene-1', 'scene-2', 'scene-3', 'scene-4', 'scene-5', 'scene-6']);
const patternKeys = new Set(['scene-1/upper', 'scene-1/lower', 'scene-2/main', 'scene-3/A', 'scene-3/B', 'scene-3/C', 'scene-4/main', 'scene-5/main', 'scene-6/main']);
const durationTypes: Record<number, StoredEvent['notation']['type']> = { 1: 'whole', 2: 'half', 4: 'quarter', 8: 'eighth', 16: 'sixteenth' };

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('OBJECT', path, '객체 형식이어야 합니다.');
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) fail('OBJECT', path, '일반 JSON 객체만 허용합니다.');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[], path: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('UNKNOWN_FIELD', `${path}.${key}`, '지원하지 않는 필드입니다.');
  for (const key of required) if (!own(value, key)) fail('REQUIRED', `${path}.${key}`, '필수 필드가 없습니다.');
}
function string(value: unknown, path: string, limit = 80): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > limit) fail('STRING', path, `1~${limit}자의 문자열이어야 합니다.`);
  return value;
}
function integer(value: unknown, path: string, min = 0, max = 1_000_000): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail('INTEGER', path, '허용 범위의 안전한 정수여야 합니다.');
  return value as number;
}
function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail('BOOLEAN', path, '참 또는 거짓이어야 합니다.');
  return value;
}
function scan(value: unknown, path = '$', depth = 0, state = { nodes: 0, seen: new WeakSet<object>() }) {
  if (++state.nodes > 10_000 || depth > 20) fail('LIMIT', path, '중첩 깊이 또는 데이터 수가 제한을 넘었습니다.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') { if (value.length > 4000) fail('LIMIT', path, '문자열이 너무 깁니다.'); return; }
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('NUMBER', path, '유한한 수만 허용합니다.'); return; }
  if (typeof value !== 'object') fail('JSON_VALUE', path, 'JSON으로 저장할 수 없는 값입니다.');
  if (state.seen.has(value as object)) fail('CYCLE', path, '순환 참조를 저장할 수 없습니다.');
  state.seen.add(value as object);
  if (Array.isArray(value)) {
    if (value.length > 256) fail('LIMIT', path, '배열이 너무 큽니다.');
    value.forEach((v, i) => scan(v, `${path}[${i}]`, depth + 1, state));
  } else {
    const o = object(value, path);
    if (Object.keys(o).length > 256) fail('LIMIT', path, '객체 필드가 너무 많습니다.');
    for (const [k, v] of Object.entries(o)) {
      if (forbidden.has(k)) fail('UNSAFE_KEY', `${path}.${k}`, '위험한 객체 키는 허용하지 않습니다.');
      if (k.length > 80) fail('LIMIT', path, '필드 이름이 너무 깁니다.');
      scan(v, `${path}.${k}`, depth + 1, state);
    }
  }
  state.seen.delete(value as object);
}
function gcd(a: number, b: number): number { while (b) [a, b] = [b, a % b]; return a; }
function fraction(value: unknown, path: string, positive: boolean): FractionData {
  const f = object(value, path);
  keys(f, ['n', 'd'], ['n', 'd'], path);
  const n = integer(f.n, `${path}.n`, positive ? 1 : 0, 16);
  const d = integer(f.d, `${path}.d`, 1, 16);
  if (gcd(n, d) !== 1) fail('FRACTION_NORMALIZED', path, '음가는 기약분수여야 합니다.');
  return { n, d };
}
function record(value: unknown, path: string, limit: number): Record<string, unknown> {
  const r = object(value, path);
  if (Object.keys(r).length > limit) fail('LIMIT', path, '기록 항목이 너무 많습니다.');
  for (const key of Object.keys(r)) string(key, path);
  return r;
}
function event(value: unknown, path: string, ids: Set<string>, expectedTick: number): number {
  const e = object(value, path);
  keys(e, ['id', 'kind', 'onset', 'duration', 'notation', 'pitch'], ['id', 'kind', 'onset', 'duration', 'notation'], path);
  const id = string(e.id, `${path}.id`);
  if (ids.has(id)) fail('DUPLICATE_ID', `${path}.id`, '이벤트 ID가 중복됩니다.');
  ids.add(id);
  if (e.kind !== 'note' && e.kind !== 'rest') fail('EVENT_KIND', `${path}.kind`, '음표 또는 쉼표만 허용합니다.');
  if (e.kind === 'rest' && own(e, 'pitch')) fail('REST_PITCH', `${path}.pitch`, '쉼표에는 음높이를 저장하지 않습니다.');
  if (e.kind === 'note') {
    const p = object(e.pitch, `${path}.pitch`);
    keys(p, ['step', 'alter', 'octave'], ['step', 'alter', 'octave'], `${path}.pitch`);
    if (p.step !== 'C' || p.alter !== 0 || p.octave !== 4) fail('PITCH', `${path}.pitch`, '첫 단원은 C4 음높이를 사용합니다.');
  }
  const onset = fraction(e.onset, `${path}.onset`, false);
  const duration = fraction(e.duration, `${path}.duration`, true);
  if (duration.n !== 1 || !own(durationTypes, String(duration.d))) fail('DURATION', `${path}.duration`, '지원하는 기본 음가만 저장할 수 있습니다.');
  const onsetTick = onset.n * 16 / onset.d;
  const durationTick = 16 / duration.d;
  if (!Number.isInteger(onsetTick) || onsetTick !== expectedTick) fail('EVENT_SEQUENCE', `${path}.onset`, '이벤트는 쉼표를 포함해 연속된 시간순이어야 합니다.');
  if (onsetTick + durationTick > 16) fail('MEASURE_RANGE', path, '한 마디 범위를 넘었습니다.');
  const n = object(e.notation, `${path}.notation`);
  keys(n, ['type', 'dots', 'tuplet'], ['type'], `${path}.notation`);
  if (n.type !== durationTypes[duration.d] || (own(n, 'dots') && n.dots !== 0) || (own(n, 'tuplet') && n.tuplet !== null)) fail('NOTATION', `${path}.notation`, '기보와 음가가 일치하지 않습니다.');
  return onsetTick + durationTick;
}

/** Validates the complete import before returning an isolated JSON snapshot. */
export function validateProgress(input: unknown): Result<ProgressEnvelope> {
  try {
    scan(input);
    const p = object(input, '$');
    const fields = ['progressSchemaVersion', 'appVersion', 'lessonId', 'contentVersion', 'savedAt', 'sceneProgress', 'attempts', 'hints', 'supportLevel', 'studentPatterns', 'preferences'];
    keys(p, fields, fields, '$');
    if (p.progressSchemaVersion !== PROGRESS_SCHEMA_VERSION) fail('SCHEMA_VERSION', '$.progressSchemaVersion', '지원하지 않는 학습 기록 버전입니다. 기존 기록을 유지합니다.');
    if (p.lessonId !== 'duration-basics') fail('LESSON_ID', '$.lessonId', '다른 단원의 기록입니다.');
    if (p.contentVersion !== CONTENT_VERSION) fail('CONTENT_VERSION', '$.contentVersion', '콘텐츠 버전이 달라 자동으로 적용하지 않습니다.');
    if (!/^\d+\.\d+\.\d+$/.test(string(p.appVersion, '$.appVersion', 30))) fail('APP_VERSION', '$.appVersion', '앱 버전 형식이 올바르지 않습니다.');
    const savedAt = string(p.savedAt, '$.savedAt', 40);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(savedAt) || !Number.isFinite(Date.parse(savedAt)) || new Date(savedAt).toISOString() !== savedAt) fail('SAVED_AT', '$.savedAt', '저장 시각이 올바르지 않습니다.');
    integer(p.supportLevel, '$.supportLevel', 1, 3);
    for (const field of ['attempts', 'hints']) for (const [key, count] of Object.entries(record(p[field], `$.${field}`, 80))) integer(count, `$.${field}.${key}`);
    const scenes = record(p.sceneProgress, '$.sceneProgress', 6);
    for (const [id, raw] of Object.entries(scenes)) {
      if (!sceneIds.has(id)) fail('SCENE_ID', `$.sceneProgress.${id}`, '지원하지 않는 장면입니다.');
      const s = object(raw, `$.sceneProgress.${id}`);
      keys(s, ['answers', 'observedDurations', 'observedLanes', 'explanationSelfCheck'], ['answers'], `$.sceneProgress.${id}`);
      for (const [key, answer] of Object.entries(record(s.answers, `$.sceneProgress.${id}.answers`, 20))) string(answer, `$.sceneProgress.${id}.answers.${key}`, 2000);
      if (own(s, 'observedDurations')) {
        if (!Array.isArray(s.observedDurations) || s.observedDurations.length > 5 || s.observedDurations.some(v => !['1/1', '1/2', '1/4', '1/8', '1/16'].includes(v))) fail('OBSERVATIONS', `$.sceneProgress.${id}.observedDurations`, '음가 관찰 기록이 올바르지 않습니다.');
      }
      if (own(s, 'observedLanes')) for (const [lane, mode] of Object.entries(record(s.observedLanes, `$.sceneProgress.${id}.observedLanes`, 4))) if (mode !== 'text' && mode !== 'listened') fail('OBSERVATION_MODE', `$.sceneProgress.${id}.observedLanes.${lane}`, '텍스트 대체와 실제 청취 기록을 구별해야 합니다.');
      if (own(s, 'explanationSelfCheck')) boolean(s.explanationSelfCheck, `$.sceneProgress.${id}.explanationSelfCheck`);
    }
    const patterns = record(p.studentPatterns, '$.studentPatterns', 9);
    const ids = new Set<string>();
    for (const [key, events] of Object.entries(patterns)) {
      if (!patternKeys.has(key)) fail('PATTERN_KEY', `$.studentPatterns.${key}`, '지원하지 않는 장면 레인입니다.');
      if (!Array.isArray(events) || events.length > 16) fail('EVENT_COUNT', `$.studentPatterns.${key}`, '한 마디에는 최대 16개 기본 음가 이벤트를 저장합니다.');
      let tick = 0;
      events.forEach((e, i) => { tick = event(e, `$.studentPatterns.${key}[${i}]`, ids, tick); });
    }
    const prefs = object(p.preferences, '$.preferences');
    const prefFields = ['mode', 'reducedMotion', 'muted', 'volume', 'currentSceneId'];
    keys(prefs, prefFields, prefFields, '$.preferences');
    if (prefs.mode !== '2d' && prefs.mode !== '3d') fail('MODE', '$.preferences.mode', '2D 또는 3D 모드를 선택해야 합니다.');
    boolean(prefs.reducedMotion, '$.preferences.reducedMotion');
    boolean(prefs.muted, '$.preferences.muted');
    if (typeof prefs.volume !== 'number' || !Number.isFinite(prefs.volume) || prefs.volume < 0 || prefs.volume > 1) fail('VOLUME', '$.preferences.volume', '음량은 0~1 범위여야 합니다.');
    if (!sceneIds.has(prefs.currentSceneId as string)) fail('SCENE_ID', '$.preferences.currentSceneId', '지원하지 않는 장면입니다.');
    const serialized = JSON.stringify(p);
    if (byteLength(serialized) > MAX_IMPORT_BYTES) fail('FILE_SIZE', '$', '학습 기록은 1MiB 이하이어야 합니다.');
    return success(JSON.parse(serialized) as ProgressEnvelope);
  } catch (error) {
    return error instanceof ValidationFailure ? { ok: false, error: error.detail } : failure('VALIDATION', '$', '학습 기록을 검증하지 못했습니다. 기존 기록을 유지합니다.');
  }
}

export function createProgress(overrides: Partial<ProgressEnvelope> = {}): ProgressEnvelope {
  const progress: ProgressEnvelope = {
    progressSchemaVersion: PROGRESS_SCHEMA_VERSION,
    appVersion: '0.1.0', lessonId: 'duration-basics', contentVersion: CONTENT_VERSION,
    savedAt: new Date().toISOString(), sceneProgress: {}, attempts: {}, hints: {}, supportLevel: 1,
    studentPatterns: {}, preferences: { mode: '2d', reducedMotion: false, muted: false, volume: 0.35, currentSceneId: 'scene-1' },
    ...overrides,
  };
  const result = validateProgress(progress);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.path}: ${result.error.message}`);
  return result.value;
}
export function parseImport(text: string): Result<ImportPreview> {
  if (typeof text !== 'string' || byteLength(text) > MAX_IMPORT_BYTES) return failure('FILE_SIZE', '$', '가져오기 파일은 1MiB 이하이어야 합니다.');
  let input: unknown;
  try { input = JSON.parse(text); } catch { return failure('JSON_PARSE', '$', 'JSON 파일을 읽을 수 없습니다. 기존 기록을 유지합니다.'); }
  const checked = validateProgress(input);
  if (!checked.ok) return checked;
  const p = checked.value;
  return success({ progress: p, summary: { lessonId: p.lessonId, contentVersion: p.contentVersion, patternCount: Object.keys(p.studentPatterns).length, savedAt: p.savedAt } });
}
export function exportProgress(progress: unknown): Result<string> {
  const checked = validateProgress(progress);
  return checked.ok ? success(JSON.stringify(checked.value, null, 2)) : checked;
}
/** LocalStorage setItem is one atomic key operation. A failed write does not replace the prior key. */
export function saveProgress(progress: unknown, storage: StorageLike): Result<ProgressEnvelope> {
  const checked = validateProgress(progress);
  if (!checked.ok) return checked;
  try { storage.setItem(STORAGE_KEY, JSON.stringify(checked.value)); return checked; }
  catch { return failure('STORAGE_WRITE', '$', '이 기기에 저장할 수 없습니다. 학습을 계속하고 JSON으로 내보낼 수 있습니다.'); }
}
/** Preview is revalidated on explicit confirmation; parsing alone never changes storage. */
export function commitImport(preview: ImportPreview, storage: StorageLike): Result<ProgressEnvelope> {
  if (!preview || typeof preview !== 'object' || !own(preview, 'progress')) return failure('IMPORT_PREVIEW', '$', '가져오기 미리보기가 필요합니다.');
  return saveProgress(preview.progress, storage);
}
export function loadProgress(storage: StorageLike): Result<ProgressEnvelope | null> {
  let text: string | null;
  try { text = storage.getItem(STORAGE_KEY); } catch { return failure('STORAGE_READ', '$', '저장 장치에 접근할 수 없습니다. 세션 내 학습을 계속할 수 있습니다.'); }
  if (text === null) return success(null);
  const parsed = parseImport(text);
  return parsed.ok ? success(parsed.value.progress) : parsed;
}
/** No automatic backup restore: removed student records cannot silently reappear. */
export function deleteProgress(storage: StorageLike): Result<void> {
  let failed = false;
  for (const key of [STORAGE_KEY, BACKUP_KEY]) { try { storage.removeItem(key); } catch { failed = true; } }
  return failed ? failure('STORAGE_DELETE', '$', '기록 삭제를 완료하지 못했습니다. 브라우저 저장 설정을 확인해 주세요.') : success(undefined);
}
export function browserStorage(): Result<StorageLike> {
  try {
    const storage = globalThis.localStorage;
    return storage ? success(storage) : failure('STORAGE_UNAVAILABLE', '$', '로컬 저장 장치를 사용할 수 없습니다.');
  } catch { return failure('STORAGE_UNAVAILABLE', '$', '로컬 저장이 차단되어 있습니다. 세션 내 학습과 JSON 내보내기를 이용하세요.'); }
}
