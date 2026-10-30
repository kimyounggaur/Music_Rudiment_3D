import type { AudioState } from '../audio/AudioEngine.ts';
import type { SceneId } from '../content/types.ts';
import { cmp, frac, seconds, sum } from '../domain/index.ts';
import { sceneEvents, taskForScene } from '../lesson/controller.ts';
import type { LessonState } from '../lesson/controller.ts';

export const LESSON_LANE_Z: Readonly<Record<SceneId, readonly number[]>> = Object.freeze({
  'scene-1': Object.freeze([0.1, 0.85]), 'scene-2': Object.freeze([0.45]),
  'scene-3': Object.freeze([0.05, 0.475, 0.9]), 'scene-4': Object.freeze([0.45]),
  'scene-5': Object.freeze([0.45]), 'scene-6': Object.freeze([0.45]),
});
export const lessonSceneCenter = (id: SceneId) => (LESSON_LANE_Z[id][0] + LESSON_LANE_Z[id].at(-1)!) / 2;
/**
 * v3 R3: how far (page Z) a lane block's raised top face reaches toward the far edge on screen
 * at the reading pose: block height × scene scale / tan(62°). The printed figure window centres
 * the lanes' visual extent, not their bases (tests/book-lesson-scene checks the constant).
 */
export const LESSON_FIGURE_RAISE_Z = 0.0453;

export function lessonEditsAllowed(interactive: boolean, state: AudioState | undefined): boolean {
  return interactive && state !== 'starting' && state !== 'playing' && state !== 'paused';
}

export const lessonPageNumber = (id: SceneId, side: 'left' | 'right') => Number(id.slice(6)) * 2 - (side === 'left' ? 1 : 0);

export function lessonTempoTiming(bpm: 60 | 120) {
  const tempo = { bpm, unit: frac(1, 4) };
  return { quarterSeconds: seconds(frac(1, 4), tempo), barSeconds: seconds(frac(1, 1), tempo),
    ticks: [0, 1, 2, 3, 4].map(beat => seconds(frac(beat, 4), tempo)) };
}

/** A partial composition is a preview, not success. Include a target's trailing time. */
export function lessonPlaybackDuration(lesson: LessonState, sceneId: SceneId, laneId: string) {
  const total = sum(sceneEvents(lesson, sceneId, laneId).map(event => event.duration));
  const target = sceneId === 'scene-3' ? taskForScene(lesson, sceneId, laneId).target : frac(1, 1);
  return cmp(total, target) > 0 ? total : target;
}
