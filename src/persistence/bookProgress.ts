import { lessonContent } from '../content/lesson.ts';
import type { SceneId } from '../content/types.ts';
import { createLessonState, isSceneComplete, serializeLearning, tryRestoreLessonState } from '../lesson/controller.ts';
import { BACKUP_KEY, CONTENT_VERSION, MAX_IMPORT_BYTES, STORAGE_KEY, parseImport, validateProgress } from './progress.ts';
import type { ProgressEnvelope, ProgressError, Result, StorageLike, StoredEvent, StoredSceneProgress } from './progress.ts';

export const BOOK_STORAGE_KEY = `${STORAGE_KEY}:book-v2`;
export const BOOK_V1_BACKUP_KEY = `${STORAGE_KEY}:v1-source-backup`;
export const BOOK_BACKUP_KEY = `${BOOK_STORAGE_KEY}:backup`;
export const BOOK_UI_VERSION = '2.1.0';
export const BOOK_PROGRESS_SCHEMA_VERSION = 2;
export const LESSON_SCHEMA_VERSION = '2.0.0';
export type StoredSpreadId = 'spread-1' | 'spread-2' | 'spread-3' | 'spread-4' | 'spread-5' | 'spread-6';
export const SCENE_TO_STORED_SPREAD: Readonly<Record<SceneId, StoredSpreadId>> = Object.freeze({
  'scene-1': 'spread-1', 'scene-2': 'spread-2', 'scene-3': 'spread-3',
  'scene-4': 'spread-4', 'scene-5': 'spread-5', 'scene-6': 'spread-6',
});
export const STORED_SPREAD_TO_SCENE: Readonly<Record<StoredSpreadId, SceneId>> = Object.freeze({
  'spread-1': 'scene-1', 'spread-2': 'scene-2', 'spread-3': 'scene-3',
  'spread-4': 'scene-4', 'spread-5': 'scene-5', 'spread-6': 'scene-6',
});
export interface BookPreferences { mode: '2d' | '3d'; reducedMotion: boolean; muted: boolean; volume: number }
export interface BookAchievement { current: boolean; ever: boolean }
export interface BookProgressEnvelope {
  progressSchemaVersion: 2; bookUiVersion: '2.1.0'; lessonSchemaVersion: '2.0.0';
  lessonId: 'duration-basics'; contentVersion: '1.0.0'; savedAt: string;
  lastStableSpreadId: StoredSpreadId;
  studentPatterns: Record<string, readonly StoredEvent[]>;
  sceneProgress: Record<string, StoredSceneProgress>;
  supportLevel: 1 | 2 | 3;
  attempts: Record<string, number>; hints: Record<string, number>;
  sceneTempos: Record<SceneId, 60 | 90 | 120>;
  achievements: Record<SceneId, BookAchievement>;
  preferences: BookPreferences;
}
export interface BookProgressLoad {
  status: 'empty' | 'loaded' | 'migrated' | 'blocked';
  progress: BookProgressEnvelope | null;
  /** Exact v2 primary text; pass unchanged as the next save's CAS baseline. */
  raw: string | null; legacyRaw: string | null; error: ProgressError | null; canSave: boolean;
}
export interface BookImportPreview {
  progress: BookProgressEnvelope;
  sourceSchemaVersion: 1 | 2;
  sourceRaw: string;
  summary: { lessonId: string; contentVersion: string; patternCount: number; lastStableSpreadId: StoredSpreadId; savedAt: string };
}
export interface BookSaveResult { progress: BookProgressEnvelope; raw: string }
export interface BookRawBackup { key: string; raw: string }

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const no = (code: string, message: string, path = '$'): Result<never> => ({ ok: false, error: { code, path, message } });
const own = (value: object, key: string) => Object.hasOwn(value, key);
const isObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const sceneIds = Object.keys(SCENE_TO_STORED_SPREAD) as SceneId[];
const fields = ['progressSchemaVersion', 'bookUiVersion', 'lessonSchemaVersion', 'lessonId', 'contentVersion', 'savedAt',
  'lastStableSpreadId', 'studentPatterns', 'sceneProgress', 'supportLevel', 'attempts', 'hints', 'sceneTempos', 'achievements', 'preferences'];
const exact = (value: Record<string, unknown>, names: readonly string[]) => Object.keys(value).length === names.length
  && names.every(name => own(value, name)) && Object.keys(value).every(name => names.includes(name));
const storageError = (code: string) => no(code, '기기 기록을 안전하게 처리하지 못했습니다. 현재 학습과 기존 원문은 유지하며 JSON으로 내보낼 수 있어요.');

function semanticCheck(progress: ProgressEnvelope): Result<ReturnType<typeof createLessonState>> {
  const restored = tryRestoreLessonState(progress);
  if (!restored.ok) return no('LESSON_DATA', restored.message);
  // Legacy restoration tolerates absent optional values. Persisted answers and
  // lane observations must never silently disappear during a v2 import.
  for (const definition of lessonContent.scenes) {
    for (const lane of definition.lanes) {
      const events = restored.state.scenes[definition.sceneId].patterns[lane.laneId].events;
      if (definition.sceneId === 'scene-2' && events.some(event => event.kind !== 'note')) {
        return no('SCENE_PATTERN', '분할 장면에는 음표만 저장할 수 있습니다.');
      }
      if (definition.sceneId === 'scene-3' && events.some(event => event.kind !== 'note' || ![4, 8, 16].includes(event.duration.d))) {
        return no('SCENE_PATTERN', '조합 장면에는4분·8분·16분음표만 저장할 수 있습니다.');
      }
      if (definition.sceneId === 'scene-4' && (events.length !== 4 || events.some(event => event.duration.n !== 1 || event.duration.d !== 4))) {
        return no('SCENE_PATTERN', '쉼표 관찰 장면의 네 개 시간 구간은 바뀌지 않습니다.');
      }
    }
    const stored = progress.sceneProgress[definition.sceneId];
    if (!stored) continue;
    for (const [id, value] of Object.entries(stored.answers)) {
      const question = definition.questions.find(item => item.id === id);
      if (!question?.options.some(option => option.value === value)) return no('ANSWER', '알 수 없는 질문이나 답안이 있어 기존 기록을 유지합니다.');
    }
    for (const lane of Object.keys(stored.observedLanes ?? {})) {
      if (!definition.lanes.some(item => item.laneId === lane)) return no('OBSERVATION_LANE', '지원하지 않는 레인의 관찰 기록입니다.');
    }
  }
  return ok(restored.state);
}

/** Strict v2 boundary; reuse the unchanged v1 validator for the shared music data. */
export function validateBookProgress(input: unknown): Result<BookProgressEnvelope> {
  try {
    if (!isObject(input) || !exact(input, fields)) return no('BOOK_FIELDS', '책 기록의 필수 필드나 지원하지 않는 필드를 확인해 주세요.');
    if (input.progressSchemaVersion !== 2 || input.bookUiVersion !== BOOK_UI_VERSION || input.lessonSchemaVersion !== LESSON_SCHEMA_VERSION) {
      return no('BOOK_VERSION', '지원하지 않는 책 또는 학습 기록 버전입니다. 기존 원문을 유지합니다.');
    }
    if (typeof input.lastStableSpreadId !== 'string' || !own(STORED_SPREAD_TO_SCENE, input.lastStableSpreadId)) return no('SPREAD_ID', '마지막 확정 펼침면이 올바르지 않습니다.');
    const spreadId = input.lastStableSpreadId as StoredSpreadId;
    if (!isObject(input.preferences) || !exact(input.preferences, ['mode', 'reducedMotion', 'muted', 'volume'])) return no('PREFERENCES', '책 설정의 필드를 확인해 주세요.');
    const shared = validateProgress({
      progressSchemaVersion: 1, appVersion: '0.1.0', lessonId: input.lessonId, contentVersion: input.contentVersion,
      savedAt: input.savedAt, sceneProgress: input.sceneProgress, studentPatterns: input.studentPatterns,
      supportLevel: input.supportLevel, attempts: input.attempts, hints: input.hints,
      preferences: { ...input.preferences, currentSceneId: STORED_SPREAD_TO_SCENE[spreadId] },
    });
    if (!shared.ok) return shared;
    const learning = semanticCheck(shared.value);
    if (!learning.ok) return learning;
    if (!isObject(input.sceneTempos) || !exact(input.sceneTempos, sceneIds)
      || !isObject(input.achievements) || !exact(input.achievements, sceneIds)) return no('SCENE_METADATA', '여섯 장면의 템포와 성취 기록이 필요합니다.');
    const achievements = {} as Record<SceneId, BookAchievement>;
    for (const id of sceneIds) {
      const tempo = input.sceneTempos[id];
      if (id === 'scene-5' ? tempo !== 60 && tempo !== 120 : tempo !== 90) return no('TEMPO', '장면에서 지원하는 템포만 저장할 수 있습니다.', `$.sceneTempos.${id}`);
      const achievement = input.achievements[id];
      if (!isObject(achievement) || !exact(achievement, ['current', 'ever'])
        || typeof achievement.current !== 'boolean' || typeof achievement.ever !== 'boolean') return no('ACHIEVEMENT', '현재/과거 성취 기록을 확인해 주세요.');
      const current = isSceneComplete(learning.value, id);
      achievements[id] = { current, ever: achievement.ever || current };
    }
    const serialized = JSON.stringify({ ...input, achievements });
    if (new TextEncoder().encode(serialized).byteLength > MAX_IMPORT_BYTES) return no('FILE_SIZE', '학습 기록은1MiB 이하이어야 합니다.');
    return ok(JSON.parse(serialized) as BookProgressEnvelope);
  } catch { return no('BOOK_VALIDATION', '책 기록을 검증하지 못했습니다. 기존 원문을 유지합니다.'); }
}

function fromLegacy(input: ProgressEnvelope): Result<BookProgressEnvelope> {
  const learning = semanticCheck(input);
  if (!learning.ok) return learning;
  const snapshot = serializeLearning(learning.value);
  const sceneTempos = {} as Record<SceneId, 60 | 90 | 120>;
  const achievements = {} as Record<SceneId, BookAchievement>;
  for (const id of sceneIds) {
    sceneTempos[id] = learning.value.scenes[id].tempo as 60 | 90 | 120;
    const current = isSceneComplete(learning.value, id);
    achievements[id] = { current, ever: current };
  }
  const { currentSceneId, ...preferences } = input.preferences;
  return validateBookProgress({ progressSchemaVersion: 2, bookUiVersion: BOOK_UI_VERSION, lessonSchemaVersion: LESSON_SCHEMA_VERSION,
    lessonId: input.lessonId, contentVersion: input.contentVersion, savedAt: input.savedAt,
    lastStableSpreadId: SCENE_TO_STORED_SPREAD[currentSceneId as SceneId],
    studentPatterns: snapshot.studentPatterns, sceneProgress: snapshot.sceneProgress, supportLevel: snapshot.supportLevel,
    attempts: input.attempts, hints: input.hints, sceneTempos, achievements, preferences });
}

function parseV2(text: string): Result<BookProgressEnvelope> {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) return no('FILE_SIZE', '학습 기록은1MiB 이하이어야 합니다.');
  try { return validateBookProgress(JSON.parse(text)); } catch { return no('JSON_PARSE', 'JSON 원문을 읽지 못했습니다. 기존 기록을 유지합니다.'); }
}

export function parseBookImport(text: string): Result<BookImportPreview> {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) return no('FILE_SIZE', '가져오기 파일은1MiB 이하이어야 합니다.');
  let version: unknown;
  try { const value: unknown = JSON.parse(text); version = isObject(value) ? value.progressSchemaVersion : null; }
  catch { return no('JSON_PARSE', 'JSON 파일을 읽지 못했습니다. 기존 기록을 유지합니다.'); }
  let checked: Result<BookProgressEnvelope>;
  if (version === 1) {
    const legacy = parseImport(text);
    checked = legacy.ok ? fromLegacy(legacy.value.progress) : legacy;
  } else if (version === 2) checked = parseV2(text);
  else return no('BOOK_VERSION', '지원하지 않는 기록 버전입니다. 자동 변환하지 않습니다.');
  if (!checked.ok) return checked;
  const progress = checked.value;
  return ok({ progress, sourceSchemaVersion: version, sourceRaw: text, summary: {
    lessonId: progress.lessonId, contentVersion: progress.contentVersion,
    patternCount: Object.keys(progress.studentPatterns).length,
    lastStableSpreadId: progress.lastStableSpreadId, savedAt: progress.savedAt,
  } });
}

export function exportBookProgress(input: unknown): Result<string> {
  const checked = validateBookProgress(input);
  return checked.ok ? ok(JSON.stringify(checked.value, null, 2)) : checked;
}

/** Raw preservation export, including invalid/older data; never parse or apply it. */
export function readBookBackups(storage: StorageLike): Result<readonly BookRawBackup[]> {
  const backups: BookRawBackup[] = [];
  for (const key of [BACKUP_KEY, BOOK_V1_BACKUP_KEY, BOOK_BACKUP_KEY]) {
    try {
      const raw = storage.getItem(key);
      if (raw !== null) backups.push({ key, raw });
    } catch { return no('BACKUP_READ', '백업 원문을 읽지 못했습니다. 기록을 삭제하지 말고 브라우저 저장 설정을 확인해 주세요.', key); }
  }
  return ok(backups);
}

/** An original v1 source backup is immutable; never replace a different original. */
function preserveLegacyRaw(storage: StorageLike, raw: string): Result<void> {
  try {
    const backup = storage.getItem(BOOK_V1_BACKUP_KEY);
    if (backup !== null && backup !== raw) return no('BACKUP_CONFLICT', '다른 이전 기록의 원문 백업이 있어 자동으로 덮어쓰지 않았습니다. 먼저 원문을 내보내 주세요.');
    if (backup === null) storage.setItem(BOOK_V1_BACKUP_KEY, raw);
    return ok(undefined);
  } catch { return storageError('BACKUP_WRITE'); }
}

function loadResult(status: BookProgressLoad['status'], progress: BookProgressEnvelope | null, raw: string | null,
  legacyRaw: string | null, error: ProgressError | null = null): BookProgressLoad {
  return { status, progress, raw, legacyRaw, error, canSave: status !== 'blocked' };
}

/** Load v2 first, or migrate exactly v1 with raw backup before the new-key write. */
export function loadBookProgress(storage: StorageLike): BookProgressLoad {
  let raw: string | null = null, legacyRaw: string | null = null;
  try {
    raw = storage.getItem(BOOK_STORAGE_KEY);
    if (raw !== null) {
      const checked = parseV2(raw);
      return checked.ok ? loadResult('loaded', checked.value, raw, null)
        : loadResult('blocked', null, raw, null, checked.error);
    }
    legacyRaw = storage.getItem(STORAGE_KEY);
    if (legacyRaw === null) return loadResult('empty', null, null, null);
    const legacy = parseImport(legacyRaw);
    if (!legacy.ok) return loadResult('blocked', null, null, legacyRaw, legacy.error);
    const migrated = fromLegacy(legacy.value.progress);
    if (!migrated.ok) return loadResult('blocked', null, null, legacyRaw, migrated.error);
    const backup = preserveLegacyRaw(storage, legacyRaw);
    if (!backup.ok) return loadResult('blocked', null, null, legacyRaw, backup.error);
    if (storage.getItem(BOOK_STORAGE_KEY) !== null || storage.getItem(STORAGE_KEY) !== legacyRaw) {
      return loadResult('blocked', null, null, legacyRaw, { code: 'STORAGE_CONFLICT', path: '$', message: '다른 창에서 기록이 바뀌어 이관을 멈췄습니다. 원문을 보존하고 다시 확인해 주세요.' });
    }
    const nextRaw = JSON.stringify(migrated.value);
    storage.setItem(BOOK_STORAGE_KEY, nextRaw);
    return loadResult('migrated', migrated.value, nextRaw, legacyRaw);
  } catch {
    return loadResult('blocked', null, raw, legacyRaw, { code: 'STORAGE_ACCESS', path: '$', message: '저장소 읽기 또는 이관 쓰기를 완료하지 못했습니다. 기존 원문과 현재 학습은 유지합니다.' });
  }
}

export function saveBookProgress(input: unknown, storage: StorageLike, expectedRaw: string | null): Result<BookSaveResult> {
  const checked = validateBookProgress(input);
  if (!checked.ok) return checked;
  try {
    const current = storage.getItem(BOOK_STORAGE_KEY);
    if (current !== expectedRaw) return no('STORAGE_CONFLICT', '다른 창에서 기록이 바뀌어 자동 저장하지 않았습니다. 기존 원문을 확인해 주세요.');
    if (current !== null && !parseV2(current).ok) return no('STORAGE_PROTECTED', '읽을 수 없는 기존 기록을 자동 저장으로 덮어쓰지 않습니다. 내보내기·가져오기·삭제를 선택해 주세요.');
    if (current === null && storage.getItem(STORAGE_KEY) !== null) return no('MIGRATION_REQUIRED', '이전 기록의 이관을 먼저 확인해야 합니다. 원문을 유지합니다.');
    const raw = JSON.stringify(checked.value);
    storage.setItem(BOOK_STORAGE_KEY, raw);
    return ok({ progress: checked.value, raw });
  } catch { return storageError('STORAGE_WRITE'); }
}

/** Revalidate a preview and compare its original canonical data before any writes. */
export function commitBookImport(preview: BookImportPreview, storage: StorageLike, expectedRaw: string | null): Result<BookSaveResult> {
  if (!preview || typeof preview !== 'object' || typeof preview.sourceRaw !== 'string') return no('IMPORT_PREVIEW', '검증된 가져오기 미리보기가 필요합니다.');
  const checked = parseBookImport(preview.sourceRaw);
  if (!checked.ok) return checked;
  try {
    if (preview.sourceSchemaVersion !== checked.value.sourceSchemaVersion
      || JSON.stringify(preview.progress) !== JSON.stringify(checked.value.progress)) return no('IMPORT_PREVIEW', '미리보기 이후 내용이 바뀌었습니다. 파일을 다시 확인해 주세요.');
    const current = storage.getItem(BOOK_STORAGE_KEY);
    if (current !== expectedRaw) return no('STORAGE_CONFLICT', '미리보기 이후 기기 기록이 바뀌어 가져오기를 멈췄습니다.');
    // Never sacrifice an existing recoverable backup for a tentative import:
    // the later primary write can still fail, and rollback can also fail.
    const currentBackup = current !== null ? storage.getItem(BOOK_BACKUP_KEY) : null;
    if (currentBackup !== null && currentBackup !== current) return no('IMPORT_BACKUP_CONFLICT', '이전 원문 백업이 이미 있어 가져오기를 멈췄습니다. 현재 기록과 백업을 먼저 내보낸 뒤 앱 기록 삭제를 선택하고 다시 가져와 주세요.');
    if (checked.value.sourceSchemaVersion === 1) {
      const backup = preserveLegacyRaw(storage, checked.value.sourceRaw);
      if (!backup.ok) return backup;
    }
    if (current !== null && currentBackup === null) storage.setItem(BOOK_BACKUP_KEY, current);
    if (storage.getItem(BOOK_STORAGE_KEY) !== current) return no('STORAGE_CONFLICT', '백업 중 기기 기록이 바뀌어 가져오기를 멈췄습니다.');
    const raw = JSON.stringify(checked.value.progress);
    storage.setItem(BOOK_STORAGE_KEY, raw);
    return ok({ progress: checked.value.progress, raw });
  } catch { return storageError('IMPORT_WRITE'); }
}

/** No backup auto-restore. Delete only this app's known primary and backup keys. */
export function deleteBookProgress(storage: StorageLike): Result<void> {
  let failed = false;
  for (const key of [BOOK_STORAGE_KEY, BOOK_BACKUP_KEY, STORAGE_KEY, BACKUP_KEY, BOOK_V1_BACKUP_KEY]) {
    try { storage.removeItem(key); } catch { failed = true; }
  }
  return failed ? no('STORAGE_DELETE', '앱 기록과 백업 삭제를 모두 확인하지 못했습니다. 현재 학습을 유지합니다.') : ok(undefined);
}

export { CONTENT_VERSION };
