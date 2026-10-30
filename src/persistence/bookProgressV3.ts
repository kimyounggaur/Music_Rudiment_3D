import { BACKUP_KEY, MAX_IMPORT_BYTES, STORAGE_KEY } from './progress.ts';
import type { ProgressError, Result, StorageLike } from './progress.ts';
import { BOOK_BACKUP_KEY, BOOK_STORAGE_KEY, BOOK_UI_VERSION, BOOK_V1_BACKUP_KEY, loadBookProgress, parseBookImport, validateBookProgress } from './bookProgress.ts';
import type { BookPreferences, BookProgressEnvelope, StoredSpreadId } from './bookProgress.ts';

/**
 * v3 R7 book record (REFACTOR_DESIGN_V3 §6 R7, decisions 2 and 5): schema 3 adds two reader settings —
 * `sfx` (procedural sound effects, default on) and `autoShot` (a lesson shot when playback starts,
 * default off). Everything else is the v2 record, validated by the unchanged v2 validator, so v2 rules
 * keep one implementation. Migration follows the v1 → v2 pattern: the exact v2 primary is kept (and
 * copied once to an immutable source backup), the v3 record is validated, then written to a new key.
 */
export const BOOK_V3_STORAGE_KEY = `${STORAGE_KEY}:book-v3`;
export const BOOK_V3_BACKUP_KEY = `${BOOK_V3_STORAGE_KEY}:backup`;
export const BOOK_V2_SOURCE_BACKUP_KEY = `${STORAGE_KEY}:v2-source-backup`;
export const BOOK_V3_UI_VERSION = '3.0.0';
export const BOOK_PROGRESS_V3_SCHEMA_VERSION = 3;

export interface BookPreferencesV3 extends BookPreferences { sfx: boolean; autoShot: boolean }
export type BookSettings = Readonly<Pick<BookPreferencesV3, 'sfx' | 'autoShot'>>;
export const DEFAULT_BOOK_SETTINGS: BookSettings = Object.freeze({ sfx: true, autoShot: false });
export type BookProgressEnvelopeV3 = Omit<BookProgressEnvelope, 'progressSchemaVersion' | 'bookUiVersion' | 'preferences'>
  & { progressSchemaVersion: 3; bookUiVersion: '3.0.0'; preferences: BookPreferencesV3 };
export interface BookProgressLoadV3 {
  status: 'empty' | 'loaded' | 'migrated' | 'blocked';
  progress: BookProgressEnvelopeV3 | null;
  /** Exact v3 primary text; the next save's CAS baseline. */
  raw: string | null;
  /** The raw source a blocked or migrated load kept (v2 primary or v1 legacy text). */
  sourceRaw: string | null;
  error: ProgressError | null;
  canSave: boolean;
}
export interface BookImportPreviewV3 {
  progress: BookProgressEnvelopeV3;
  sourceSchemaVersion: 1 | 2 | 3;
  sourceRaw: string;
  summary: { lessonId: string; contentVersion: string; patternCount: number; lastStableSpreadId: StoredSpreadId; savedAt: string };
}
export interface BookSaveResultV3 { progress: BookProgressEnvelopeV3; raw: string }

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const no = (code: string, message: string, path = '$'): Result<never> => ({ ok: false, error: { code, path, message } });
const isObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const PREFERENCE_FIELDS = ['mode', 'reducedMotion', 'muted', 'volume', 'sfx', 'autoShot'];
const exact = (value: Record<string, unknown>, names: readonly string[]) => Object.keys(value).length === names.length
  && names.every(name => Object.hasOwn(value, name));
const storageError = (code: string) => no(code, '기기 기록을 안전하게 처리하지 못했습니다. 현재 학습과 기존 원문은 유지하며 JSON으로 내보낼 수 있어요.');

/** The v2 view of a v3 record (settings set aside) — for the v2 validator and the v2 learning code. */
export function toV2(input: BookProgressEnvelopeV3): BookProgressEnvelope {
  const { sfx: _sfx, autoShot: _autoShot, ...preferences } = input.preferences;
  void _sfx; void _autoShot;
  return { ...input, progressSchemaVersion: 2, bookUiVersion: BOOK_UI_VERSION as '2.1.0', preferences };
}
export function fromV2(input: BookProgressEnvelope, settings: BookSettings = DEFAULT_BOOK_SETTINGS): BookProgressEnvelopeV3 {
  return { ...input, progressSchemaVersion: 3, bookUiVersion: BOOK_V3_UI_VERSION, preferences: { ...input.preferences, sfx: settings.sfx, autoShot: settings.autoShot } };
}
export const settingsOf = (progress: BookProgressEnvelopeV3 | null): BookSettings =>
  progress ? { sfx: progress.preferences.sfx, autoShot: progress.preferences.autoShot } : DEFAULT_BOOK_SETTINGS;

/** Strict v3 boundary: exact v3 header and settings, then the unchanged v2 validator for the rest. */
export function validateBookProgressV3(input: unknown): Result<BookProgressEnvelopeV3> {
  try {
    if (!isObject(input)) return no('BOOK_FIELDS', '책 기록의 필수 필드나 지원하지 않는 필드를 확인해 주세요.');
    if (input.progressSchemaVersion !== BOOK_PROGRESS_V3_SCHEMA_VERSION || input.bookUiVersion !== BOOK_V3_UI_VERSION) {
      return no('BOOK_VERSION', '지원하지 않는 책 또는 학습 기록 버전입니다. 기존 원문을 유지합니다.');
    }
    const preferences = input.preferences;
    if (!isObject(preferences) || !exact(preferences, PREFERENCE_FIELDS)
      || typeof preferences.sfx !== 'boolean' || typeof preferences.autoShot !== 'boolean') return no('PREFERENCES', '책 설정의 필드를 확인해 주세요.');
    const settings = { sfx: preferences.sfx, autoShot: preferences.autoShot };
    const v2 = validateBookProgress(toV2(input as unknown as BookProgressEnvelopeV3));
    if (!v2.ok) return v2;
    const checked = fromV2(v2.value, settings);
    if (new TextEncoder().encode(JSON.stringify(checked)).byteLength > MAX_IMPORT_BYTES) return no('FILE_SIZE', '학습 기록은1MiB 이하이어야 합니다.');
    return ok(checked);
  } catch { return no('BOOK_VALIDATION', '책 기록을 검증하지 못했습니다. 기존 원문을 유지합니다.'); }
}

function parseV3(text: string): Result<BookProgressEnvelopeV3> {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) return no('FILE_SIZE', '학습 기록은1MiB 이하이어야 합니다.');
  try { return validateBookProgressV3(JSON.parse(text)); } catch { return no('JSON_PARSE', 'JSON 원문을 읽지 못했습니다. 기존 기록을 유지합니다.'); }
}

/** The v2 source backup is immutable: copied once, never replaced by a different source. */
function preserveV2Raw(storage: StorageLike, raw: string): Result<void> {
  try {
    const backup = storage.getItem(BOOK_V2_SOURCE_BACKUP_KEY);
    if (backup !== null && backup !== raw) return no('BACKUP_CONFLICT', '다른 이전 기록의 원문 백업이 있어 자동으로 덮어쓰지 않았습니다. 먼저 원문을 내보내 주세요.');
    if (backup === null) storage.setItem(BOOK_V2_SOURCE_BACKUP_KEY, raw);
    return ok(undefined);
  } catch { return storageError('BACKUP_WRITE'); }
}

const result = (status: BookProgressLoadV3['status'], progress: BookProgressEnvelopeV3 | null, raw: string | null, sourceRaw: string | null,
  error: ProgressError | null = null): BookProgressLoadV3 => ({ status, progress, raw, sourceRaw, error, canSave: status !== 'blocked' });

/**
 * Load v3 first. Otherwise load v2 through the existing path (which itself migrates v1 with its own
 * backup), keep its exact raw in the v2 source backup, validate the v3 record, then write the new key.
 * The v2 primary stays where it was. Any failure blocks saving and changes nothing it does not own.
 */
export function loadBookProgressV3(storage: StorageLike): BookProgressLoadV3 {
  let raw: string | null = null;
  try {
    raw = storage.getItem(BOOK_V3_STORAGE_KEY);
    if (raw !== null) {
      const checked = parseV3(raw);
      return checked.ok ? result('loaded', checked.value, raw, null) : result('blocked', null, raw, null, checked.error);
    }
    const v2 = loadBookProgress(storage);
    if (v2.status === 'empty') return result('empty', null, null, null);
    if (v2.status === 'blocked' || !v2.progress || v2.raw === null) return result('blocked', null, null, v2.raw ?? v2.legacyRaw, v2.error);
    const migrated = validateBookProgressV3(fromV2(v2.progress));
    if (!migrated.ok) return result('blocked', null, null, v2.raw, migrated.error);
    const backup = preserveV2Raw(storage, v2.raw);
    if (!backup.ok) return result('blocked', null, null, v2.raw, backup.error);
    if (storage.getItem(BOOK_V3_STORAGE_KEY) !== null || storage.getItem(BOOK_STORAGE_KEY) !== v2.raw) {
      return result('blocked', null, null, v2.raw, { code: 'STORAGE_CONFLICT', path: '$', message: '다른 창에서 기록이 바뀌어 이관을 멈췄습니다. 원문을 보존하고 다시 확인해 주세요.' });
    }
    const nextRaw = JSON.stringify(migrated.value);
    storage.setItem(BOOK_V3_STORAGE_KEY, nextRaw);
    return result('migrated', migrated.value, nextRaw, v2.raw);
  } catch {
    return result('blocked', null, raw, null, { code: 'STORAGE_ACCESS', path: '$', message: '저장소 읽기 또는 이관 쓰기를 완료하지 못했습니다. 기존 원문과 현재 학습은 유지합니다.' });
  }
}

export function saveBookProgressV3(input: unknown, storage: StorageLike, expectedRaw: string | null): Result<BookSaveResultV3> {
  const checked = validateBookProgressV3(input);
  if (!checked.ok) return checked;
  try {
    const current = storage.getItem(BOOK_V3_STORAGE_KEY);
    if (current !== expectedRaw) return no('STORAGE_CONFLICT', '다른 창에서 기록이 바뀌어 자동 저장하지 않았습니다. 기존 원문을 확인해 주세요.');
    if (current !== null && !parseV3(current).ok) return no('STORAGE_PROTECTED', '읽을 수 없는 기존 기록을 자동 저장으로 덮어쓰지 않습니다. 내보내기·가져오기·삭제를 선택해 주세요.');
    if (current === null && (storage.getItem(BOOK_STORAGE_KEY) !== null || storage.getItem(STORAGE_KEY) !== null)) {
      return no('MIGRATION_REQUIRED', '이전 기록의 이관을 먼저 확인해야 합니다. 원문을 유지합니다.');
    }
    const raw = JSON.stringify(checked.value);
    storage.setItem(BOOK_V3_STORAGE_KEY, raw);
    return ok({ progress: checked.value, raw });
  } catch { return storageError('STORAGE_WRITE'); }
}

/** v1 and v2 files go through the unchanged v2 import parser; v3 files through the v3 validator. */
export function parseBookImportV3(text: string): Result<BookImportPreviewV3> {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) return no('FILE_SIZE', '가져오기 파일은1MiB 이하이어야 합니다.');
  let version: unknown;
  try { const value: unknown = JSON.parse(text); version = isObject(value) ? value.progressSchemaVersion : null; }
  catch { return no('JSON_PARSE', 'JSON 파일을 읽지 못했습니다. 기존 기록을 유지합니다.'); }
  let progress: BookProgressEnvelopeV3;
  let sourceSchemaVersion: 1 | 2 | 3;
  if (version === 3) {
    const checked = parseV3(text);
    if (!checked.ok) return checked;
    progress = checked.value; sourceSchemaVersion = 3;
  } else if (version === 1 || version === 2) {
    const preview = parseBookImport(text);
    if (!preview.ok) return preview;
    const checked = validateBookProgressV3(fromV2(preview.value.progress));
    if (!checked.ok) return checked;
    progress = checked.value; sourceSchemaVersion = preview.value.sourceSchemaVersion;
  } else return no('BOOK_VERSION', '지원하지 않는 기록 버전입니다. 자동 변환하지 않습니다.');
  return ok({ progress, sourceSchemaVersion, sourceRaw: text, summary: {
    lessonId: progress.lessonId, contentVersion: progress.contentVersion, patternCount: Object.keys(progress.studentPatterns).length,
    lastStableSpreadId: progress.lastStableSpreadId, savedAt: progress.savedAt,
  } });
}

/**
 * Revalidate the preview, compare it with the current v3 primary (CAS), keep a recoverable copy of
 * that primary in the v3 backup (never replacing a different backup), then write the import. A v1
 * source keeps its immutable legacy backup exactly as the v2 import does.
 */
export function commitBookImportV3(preview: BookImportPreviewV3, storage: StorageLike, expectedRaw: string | null): Result<BookSaveResultV3> {
  if (!preview || typeof preview !== 'object' || typeof preview.sourceRaw !== 'string') return no('IMPORT_PREVIEW', '검증된 가져오기 미리보기가 필요합니다.');
  const checked = parseBookImportV3(preview.sourceRaw);
  if (!checked.ok) return checked;
  try {
    if (preview.sourceSchemaVersion !== checked.value.sourceSchemaVersion
      || JSON.stringify(preview.progress) !== JSON.stringify(checked.value.progress)) return no('IMPORT_PREVIEW', '미리보기 이후 내용이 바뀌었습니다. 파일을 다시 확인해 주세요.');
    const current = storage.getItem(BOOK_V3_STORAGE_KEY);
    if (current !== expectedRaw) return no('STORAGE_CONFLICT', '미리보기 이후 기기 기록이 바뀌어 가져오기를 멈췄습니다.');
    const currentBackup = current !== null ? storage.getItem(BOOK_V3_BACKUP_KEY) : null;
    if (currentBackup !== null && currentBackup !== current) return no('IMPORT_BACKUP_CONFLICT', '이전 원문 백업이 이미 있어 가져오기를 멈췄습니다. 현재 기록과 백업을 먼저 내보낸 뒤 앱 기록 삭제를 선택하고 다시 가져와 주세요.');
    if (checked.value.sourceSchemaVersion === 1) {
      const legacy = storage.getItem(BOOK_V1_BACKUP_KEY);
      if (legacy !== null && legacy !== checked.value.sourceRaw) return no('BACKUP_CONFLICT', '다른 이전 기록의 원문 백업이 있어 자동으로 덮어쓰지 않았습니다. 먼저 원문을 내보내 주세요.');
      if (legacy === null) storage.setItem(BOOK_V1_BACKUP_KEY, checked.value.sourceRaw);
    }
    if (current !== null && currentBackup === null) storage.setItem(BOOK_V3_BACKUP_KEY, current);
    if (storage.getItem(BOOK_V3_STORAGE_KEY) !== current) return no('STORAGE_CONFLICT', '백업 중 기기 기록이 바뀌어 가져오기를 멈췄습니다.');
    const raw = JSON.stringify(checked.value.progress);
    storage.setItem(BOOK_V3_STORAGE_KEY, raw);
    return ok({ progress: checked.value.progress, raw });
  } catch { return storageError('IMPORT_WRITE'); }
}

export function exportBookProgressV3(input: unknown): Result<string> {
  const checked = validateBookProgressV3(input);
  return checked.ok ? ok(JSON.stringify(checked.value, null, 2)) : checked;
}

/** Raw preservation export of every source this app keeps (never parsed or applied). */
export function readBookBackupsV3(storage: StorageLike): Result<readonly { key: string; raw: string }[]> {
  const backups: { key: string; raw: string }[] = [];
  for (const key of [BACKUP_KEY, BOOK_V1_BACKUP_KEY, BOOK_BACKUP_KEY, BOOK_V2_SOURCE_BACKUP_KEY, BOOK_V3_BACKUP_KEY]) {
    try {
      const raw = storage.getItem(key);
      if (raw !== null) backups.push({ key, raw });
    } catch { return no('BACKUP_READ', '백업 원문을 읽지 못했습니다. 기록을 삭제하지 말고 브라우저 저장 설정을 확인해 주세요.', key); }
  }
  return ok(backups);
}

/** No backup auto-restore. Delete every key this app owns, v1 through v3, and report any failure. */
export function deleteBookProgressV3(storage: StorageLike): Result<void> {
  let failed = false;
  for (const key of [BOOK_V3_STORAGE_KEY, BOOK_V3_BACKUP_KEY, BOOK_V2_SOURCE_BACKUP_KEY, BOOK_STORAGE_KEY, BOOK_BACKUP_KEY, STORAGE_KEY, BACKUP_KEY, BOOK_V1_BACKUP_KEY]) {
    try { storage.removeItem(key); } catch { failed = true; }
  }
  return failed ? no('STORAGE_DELETE', '앱 기록과 백업 삭제를 모두 확인하지 못했습니다. 현재 학습을 유지합니다.') : ok(undefined);
}

