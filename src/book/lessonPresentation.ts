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
/** v3 R4: screen raise per unit of standing height at the reading pose, 1 / tan(62°). */
export const LESSON_FIGURE_RAISE_PER_HEIGHT = 0.5317;
/**
 * v3 R4 ink figure layout in lane units (one bar = 10), mirrored from figures/music so the page
 * window can be placed without loading three (tests/duration-figure checks the two agree):
 * block backs, axis ticks, the printed '0, 1/2, 1' (first lane only), decor extents and gap.
 */
export const LESSON_FIGURE_LAYOUT = Object.freeze({
  scale: 0.224, blockHeight: 0.38, laneBack: -0.45, laneFront: 0.86, laneFrontLabelled: 1.19,
  decor: Object.freeze({ 'scene-1': Object.freeze({ back: -0.84, front: 0.51 }), 'scene-2': Object.freeze({ back: 0.02, front: 0.97 }),
    // v3 R8: the seconds ruler (spread 5) and the free bar (spread 6).
    'scene-5': Object.freeze({ back: 0.04, front: 0.64 }), 'scene-6': Object.freeze({ back: 0.1, front: 0.89 }) }) as Readonly<Partial<Record<SceneId, Readonly<{ back: number; front: number }>>>>,
  /** World gap between the last lane's ticks and its decor. */
  decorGap: 0.04,
});

/**
 * World Z extent of a scene's ink figure at the reading pose (relative to the scene origin): from the
 * first lane's raised block tops to the last printed mark, plus the decor origin when it has one.
 */
export function lessonFigureExtent(id: SceneId): Readonly<{ minZ: number; maxZ: number; decorZ: number | null }> {
  const layout = LESSON_FIGURE_LAYOUT, lanes = LESSON_LANE_Z[id], s = layout.scale;
  const minZ = lanes[0]! + s * (layout.laneBack - layout.blockHeight * LESSON_FIGURE_RAISE_PER_HEIGHT);
  let maxZ = Math.max(...lanes.map((z, index) => z + s * (index === 0 ? layout.laneFrontLabelled : layout.laneFront)));
  const decor = layout.decor[id];
  if (!decor) return { minZ, maxZ, decorZ: null };
  const decorZ = maxZ + layout.decorGap - s * decor.back;
  maxZ = decorZ + s * decor.front;
  return { minZ, maxZ, decorZ };
}

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
