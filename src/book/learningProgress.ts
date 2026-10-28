import { lessonContent } from '../content/lesson.ts';
import type { SceneId } from '../content/types.ts';
import { isSceneComplete, serializeLearning, tryRestoreLessonState } from '../lesson/controller.ts';
import type { LessonState } from '../lesson/controller.ts';
import { BOOK_UI_VERSION, CONTENT_VERSION, LESSON_SCHEMA_VERSION, STORED_SPREAD_TO_SCENE, validateBookProgress } from '../persistence/bookProgress.ts';
import type { BookAchievement, BookPreferences, BookProgressEnvelope, StoredSpreadId } from '../persistence/bookProgress.ts';
import type { Result } from '../persistence/progress.ts';

export interface CaptureBookProgressOptions {
  lesson: LessonState; lastStableSpreadId: StoredSpreadId; preferences: BookPreferences;
  previous?: BookProgressEnvelope | null; hints?: Record<string, number>; attempts?: Record<string, number>; savedAt?: string;
}

/** Capture musical data and explicit preferences, never Book/Audio runtime state. */
export function captureBookProgress(options: CaptureBookProgressOptions): Result<BookProgressEnvelope> {
  const { lesson, previous } = options;
  const learning = serializeLearning(lesson);
  const achievements = {} as Record<SceneId, BookAchievement>;
  const sceneTempos = {} as Record<SceneId, 60 | 90 | 120>;
  for (const scene of lessonContent.scenes) {
    const id = scene.sceneId;
    const current = isSceneComplete(lesson, id);
    achievements[id] = { current, ever: current || previous?.achievements[id].ever === true };
    sceneTempos[id] = lesson.scenes[id].tempo as 60 | 90 | 120;
  }
  return validateBookProgress({ progressSchemaVersion: 2, bookUiVersion: BOOK_UI_VERSION,
    lessonSchemaVersion: LESSON_SCHEMA_VERSION, lessonId: 'duration-basics', contentVersion: CONTENT_VERSION,
    savedAt: options.savedAt ?? new Date().toISOString(), lastStableSpreadId: options.lastStableSpreadId,
    studentPatterns: learning.studentPatterns, sceneProgress: learning.sceneProgress, supportLevel: learning.supportLevel,
    hints: options.hints ?? previous?.hints ?? {}, attempts: options.attempts ?? previous?.attempts ?? {},
    sceneTempos, achievements, preferences: options.preferences });
}

/** Caller sets this validated state directly; legacy reducer restore omits tempo. */
export function restoreBookLearning(input: BookProgressEnvelope): Result<LessonState> {
  const checked = validateBookProgress(input);
  if (!checked.ok) return checked;
  const progress = checked.value;
  const restored = tryRestoreLessonState({ ...progress, preferences: {
    currentSceneId: STORED_SPREAD_TO_SCENE[progress.lastStableSpreadId],
  } });
  if (!restored.ok) return { ok: false, error: { code: 'LESSON_RESTORE', path: '$', message: restored.message } };
  const scenes = { ...restored.state.scenes };
  for (const scene of lessonContent.scenes) scenes[scene.sceneId] = Object.freeze({
    ...scenes[scene.sceneId], tempo: progress.sceneTempos[scene.sceneId],
  });
  return { ok: true, value: Object.freeze({ ...restored.state, scenes: Object.freeze(scenes) }) };
}
