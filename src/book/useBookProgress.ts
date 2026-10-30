import { useCallback, useEffect, useRef, useState } from 'react';
import { createLessonState } from '../lesson/controller.ts';
import type { LessonState } from '../lesson/controller.ts';
import { browserStorage } from '../persistence/progress.ts';
import type { StorageLike } from '../persistence/progress.ts';
import type { BookProgressEnvelope, StoredSpreadId } from '../persistence/bookProgress.ts';
import {
  commitBookImportV3, DEFAULT_BOOK_SETTINGS, deleteBookProgressV3, exportBookProgressV3, fromV2, loadBookProgressV3, parseBookImportV3,
  readBookBackupsV3, saveBookProgressV3, toV2,
} from '../persistence/bookProgressV3.ts';
import type { BookImportPreviewV3, BookPreferencesV3 } from '../persistence/bookProgressV3.ts';
import { restoreBookLearning } from './learningProgress.ts';
import { BookProgressSession } from './BookProgressSession.ts';
import { bookCanInteract } from './controller.ts';
import type { BookState } from './controller.ts';
import { BOOK_MANIFEST, isLessonSpread } from './manifest.ts';
import type { LessonSpreadId } from './manifest.ts';

/** v3 R7: the record is schema 3; `sfx` on (decision 2) and `autoShot` off (decision 5) by default. */
export type BookPreferences = BookPreferencesV3;
export const defaultBookPreferences = (): BookPreferences => ({ mode: '3d', reducedMotion: false, muted: false, volume: 0.6, ...DEFAULT_BOOK_SETTINGS });
/** The learning code and the v2 validator see the v2 view of the record (settings set aside). */
const learningPreferences = ({ mode, reducedMotion, muted, volume }: BookPreferences) => ({ mode, reducedMotion, muted, volume });
/** A saved place is always a lesson spread (the record schema's StoredSpreadId). */
export const supportsStoredSpread = (id: string): id is LessonSpreadId => BOOK_MANIFEST.some(spread => spread.spreadId === id);
const unsupportedMessage = (id: string) => `${id.replace('spread-', '')}번 펼침면은 아직 이 책에서 열 수 없어요. 저장 원문을 보호하며, 지금 둘러본 내용은 자동 저장하지 않습니다.`;

export type InitialBookProgress = {
  storage: StorageLike | null;
  progress: BookProgressEnvelope | null;
  raw: string | null;
  preservedRaw: string | null;
  lesson: LessonState;
  preferences: BookPreferences;
  canSave: boolean;
  notice: string;
};

/** Read before the first book pose, so saved preferences never flash as defaults. */
export function loadInitialBookProgress(): InitialBookProgress {
  const fresh = { progress: null, raw: null, preservedRaw: null, lesson: createLessonState(), preferences: defaultBookPreferences() };
  const storage = browserStorage();
  if (!storage.ok) return { ...fresh, storage: null, canSave: false, notice: storage.error.message };
  const loaded = loadBookProgressV3(storage.value);
  const base = { ...fresh, storage: storage.value, raw: loaded.raw, preservedRaw: loaded.raw ?? loaded.sourceRaw,
    canSave: loaded.canSave, notice: loaded.error?.message ?? '' };
  if (!loaded.progress) return base;
  const progress = toV2(loaded.progress);
  const restored = restoreBookLearning(progress);
  if (!restored.ok) return { ...base, canSave: false, notice: `${restored.error.message} 저장 원문은 그대로 두었습니다.` };
  const supported = supportsStoredSpread(loaded.progress.lastStableSpreadId);
  return { ...base, progress, lesson: restored.value, preferences: loaded.progress.preferences,
    canSave: base.canSave && supported,
    notice: !supported ? unsupportedMessage(loaded.progress.lastStableSpreadId)
      : base.notice || (loaded.status === 'migrated' ? '이전 기록의 원문을 보존하고 책 기록으로 옮겼어요.' : '') };
}

export type BookProgressOptions = {
  initial: InitialBookProgress;
  book: BookState;
  lesson: LessonState;
  onApply(lesson: LessonState, preferences: BookPreferences): void;
};

/** Storage owns only stable learning data. A damaged/future record never becomes
 * writable merely because the reader chooses to browse the supported pages. */
export function useBookProgress({ initial, book, lesson, onApply }: BookProgressOptions) {
  const [preferences, setPreferences] = useState(initial.preferences);
  const [hints, setHints] = useState<Record<string, number>>(initial.progress?.hints ?? {});
  const [savedSpread, setSavedSpread] = useState<StoredSpreadId | null>(initial.progress?.lastStableSpreadId ?? null);
  const [notice, setNotice] = useState(initial.notice);
  const [canSave, setCanSave] = useState(initial.canSave);
  const [armed, setArmed] = useState(false);
  const [exportedText, setExportedText] = useState('');
  const [preview, setPreview] = useState<BookImportPreviewV3 | null>(null);
  const settings = useRef({ sfx: initial.preferences.sfx, autoShot: initial.preferences.autoShot });
  settings.current = { sfx: preferences.sfx, autoShot: preferences.autoShot };
  // The session keeps the v2 view for the learning code; its writer stores the v3 record (CAS on the v3 key).
  const session = useRef(new BookProgressSession(initial.progress, initial.raw, (input, storage, expectedRaw) => {
    const saved = saveBookProgressV3(fromV2(input, settings.current), storage, expectedRaw);
    return saved.ok ? { ok: true, value: { progress: toV2(saved.value.progress), raw: saved.value.raw } } : saved;
  }));
  const [backups, setBackups] = useState<readonly { key: string; raw: string }[]>(() => {
    const result = initial.storage && readBookBackupsV3(initial.storage);
    return result && result.ok ? result.value : [];
  });
  const preservedRaw = useRef(initial.preservedRaw);
  const lastSavedIdentity = useRef('');
  const latest = useRef({ book, lesson, preferences, hints, onApply });
  latest.current = { book, lesson, preferences, hints, onApply };

  const capture = useCallback(() => {
    const current = latest.current;
    const previousSpread = session.current.previous?.lastStableSpreadId;
    // Browsing an older two-spread runtime must not clamp a future saved target,
    // including in a user-requested export of the live supported-page edits.
    // v3 R8: the contents and closing spreads are not lesson places; the record keeps the last lesson spread.
    const here = current.book.currentSpreadId;
    const lastStableSpreadId = previousSpread && !supportsStoredSpread(previousSpread) ? previousSpread
      : isLessonSpread(here) ? here : here === 'closing' ? 'spread-6' : previousSpread ?? 'spread-1';
    return session.current.capture({ lesson: current.lesson, lastStableSpreadId,
      preferences: learningPreferences(current.preferences), hints: current.hints });
  }, []);

  useEffect(() => {
    // Historical achievement belongs to the live session even when storage is
    // blocked. Later edits/exports must not lose a success reached before failure.
    capture();
  }, [lesson.revision, preferences, hints, capture]);

  useEffect(() => {
    if (!armed || !canSave || !initial.storage || !bookCanInteract(book)) return;
    const identity = JSON.stringify([lesson.revision, book.currentSpreadId, preferences, hints]);
    if (lastSavedIdentity.current === identity) return;
    const candidate = capture();
    if (!candidate.ok) { setCanSave(false); setNotice(candidate.error.message); return; }
    const result = session.current.save(candidate.value, initial.storage);
    if (!result.ok) {
      setCanSave(false);
      setNotice(`${result.error.message} 현재 학습은 계속할 수 있고 JSON으로 내보낼 수 있어요.${result.error.code === 'STORAGE_CONFLICT' ? ' 아래 원문은 이 창이 마지막으로 읽은 기록입니다. 현재 학습을 내보낸 뒤 새로고침하면 다른 창의 기록을 확인할 수 있어요.' : ''}`);
      return;
    }
    preservedRaw.current = result.value.raw;
    lastSavedIdentity.current = identity;
    setSavedSpread(result.value.progress.lastStableSpreadId);
    setNotice('이 기기에 학습 기록을 저장했어요.');
  }, [armed, canSave, initial.storage, book, lesson.revision, preferences, hints, capture]);

  const activate = useCallback(() => { setArmed(true); }, []);
  const updatePreferences = useCallback((patch: Partial<BookPreferences>) => {
    setPreferences(current => ({ ...current, ...patch }));
  }, []);
  const setHint = useCallback((key: string, open: boolean) => {
    setHints(current => current[key] === Number(open) ? current : { ...current, [key]: Number(open) });
  }, []);
  const exportCurrent = useCallback(() => {
    const candidate = capture();
    if (!candidate.ok) { setNotice(candidate.error.message); return; }
    const result = exportBookProgressV3(fromV2(candidate.value, settings.current));
    if (!result.ok) { setNotice(result.error.message); return; }
    setExportedText(result.value);
  }, [capture]);
  const previewImport = useCallback((raw: string) => {
    setPreview(null);
    const result = parseBookImportV3(raw);
    if (!result.ok) { setNotice(result.error.message); return; }
    const restored = restoreBookLearning(toV2(result.value.progress));
    if (!restored.ok) { setNotice(restored.error.message); return; }
    setPreview(result.value);
    setNotice(supportsStoredSpread(result.value.progress.lastStableSpreadId)
      ? '미리보기를 확인한 뒤 가져오기를 확정해 주세요. 아직 기록은 바뀌지 않았어요.' : unsupportedMessage(result.value.progress.lastStableSpreadId));
  }, []);
  const cancelImport = useCallback(() => { setPreview(null); }, []);
  const confirmImport = useCallback(() => {
    if (!preview) return;
    if (!supportsStoredSpread(preview.progress.lastStableSpreadId)) { setNotice(unsupportedMessage(preview.progress.lastStableSpreadId)); return; }
    if (!initial.storage) { setNotice('저장소를 사용할 수 없어 가져오기를 적용하지 않았어요. 기존 학습은 유지됩니다.'); return; }
    const restored = restoreBookLearning(toV2(preview.progress));
    if (!restored.ok) { setNotice(restored.error.message); return; }
    const result = commitBookImportV3(preview, initial.storage, session.current.raw);
    const backupResult = readBookBackupsV3(initial.storage);
    if (backupResult.ok) setBackups(backupResult.value);
    if (!result.ok) { setNotice(result.error.message); return; }
    session.current.adopt(toV2(result.value.progress), result.value.raw);
    preservedRaw.current = result.value.raw;
    lastSavedIdentity.current = '';
    setPreferences(result.value.progress.preferences);
    setHints(result.value.progress.hints);
    setSavedSpread(result.value.progress.lastStableSpreadId);
    setCanSave(true);
    setArmed(false);
    setPreview(null);
    setExportedText('');
    setNotice('가져온 기록을 적용했어요. 표지에서 이어서 펼칠 수 있어요.');
    latest.current.onApply(restored.value, result.value.progress.preferences);
  }, [preview, initial.storage]);
  const deleteAll = useCallback(() => {
    if (!initial.storage) { setNotice('저장소에 접근할 수 없어 삭제하지 못했어요. 현재 학습은 유지됩니다.'); return; }
    const result = deleteBookProgressV3(initial.storage);
    if (!result.ok) { setCanSave(false); setNotice(result.error.message); return; }
    session.current.adopt(null, null);
    preservedRaw.current = null;
    setBackups([]);
    lastSavedIdentity.current = '';
    const defaults = defaultBookPreferences();
    setPreferences(defaults);
    setHints({});
    setSavedSpread(null);
    setCanSave(true);
    setArmed(false);
    setPreview(null);
    setExportedText('');
    setNotice('이 앱의 학습 기록과 백업을 삭제했어요. 다른 앱의 데이터와 내보낸 파일은 그대로입니다.');
    latest.current.onApply(createLessonState(), defaults);
  }, [initial.storage]);

  return { preferences, updatePreferences, hints, setHint, savedSpread, canSave, notice, activate,
    protectedRaw: canSave ? null : preservedRaw.current, backups, exportedText, exportCurrent, previewImport, cancelImport, confirmImport, deleteAll,
    preview: preview ? { savedAt: preview.summary.savedAt, spreadLabel: `${preview.progress.lastStableSpreadId.replace('spread-', '')}번 펼침면`,
      patternCount: preview.summary.patternCount, canApply: supportsStoredSpread(preview.progress.lastStableSpreadId),
      reason: supportsStoredSpread(preview.progress.lastStableSpreadId) ? undefined : unsupportedMessage(preview.progress.lastStableSpreadId) } : null };
}
