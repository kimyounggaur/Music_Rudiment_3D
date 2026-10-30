import { Group, Vector3 } from 'three';
import type { Mesh, Object3D } from 'three';
import { getScene } from '../content/lesson.ts';
import type { MusicEvent, SceneId } from '../content/types.ts';
import { sceneEvents, sceneState } from '../lesson/controller.ts';
import type { LessonState } from '../lesson/controller.ts';
import { BAR_WIDTH } from '../scenes/durationWorld.ts';
import { attachFigureControls, createInkFigure, sumFigureStats } from './figures/figure.ts';
import type { FigureControls, FigureStats, FigureSurface, InkFigure } from './figures/figure.ts';
import { INK } from './figures/inkLines.ts';
import { createSpreadDecor, DECOR_KIND } from './figures/music/decor.ts';
import type { SpreadDecor } from './figures/music/decor.ts';
import { createDurationFigure, DURATION_FIGURE } from './figures/music/durationFigure.ts';
import type { DurationFigure, DurationTransition } from './figures/music/durationFigure.ts';
import { BOOK_DIMENSIONS, rightPagePaper } from './geometry.ts';
import { BOOK_MOTION } from './motion.ts';
import type { PreparedScene } from './SceneHost.ts';
import { LESSON_LANE_Z, lessonFigureExtent } from './lessonPresentation.ts';

export type BookLessonSceneId = SceneId;
export type LessonScenePick = Readonly<{ laneId: string; eventId: string }>;
export type LessonScenePlayback = Readonly<{
  laneId: string;
  activeId: string | null;
  position: number;
  reducedMotion: boolean;
}>;
export type LessonSceneSnapshot = Readonly<{
  sceneId: BookLessonSceneId;
  revision: number;
  disposed: boolean;
  activeLaneId: string;
  selectedEventId: string | null;
  playbackLaneId: string | null;
  lanes: readonly Readonly<{
    laneId: string;
    eventIds: readonly string[];
    /** Coordinates relative to the stage's right-page scene anchor. */
    origin: Readonly<{ x: number; y: number; z: number }>;
    width: number;
    scale: number;
    transition: DurationTransition | null;
  }>[];
  /** v3 R4 ink figure state. */
  lift: number;
  reveal: number;
  decor: string | null;
  figure: FigureStats;
}>;
export interface LessonScene extends PreparedScene {
  readonly sceneId: BookLessonSceneId;
  /** Stable array, updated in place after edits. The stage raycasts these actual meshes. */
  readonly pickTargets: Mesh[];
  updateLesson(lesson: LessonState): void;
  setPlayback(playback: LessonScenePlayback | null): void;
  pickEvent(object: Object3D): LessonScenePick | null;
  getSnapshot(): LessonSceneSnapshot;
  /** v3 R4: the figure controls the stage drives (also registered on `group`). */
  readonly figure: FigureControls;
  /** DEV inspection: pin split/merge strokes `ms` after they start (null resumes real time). */
  holdTransitions(ms: number | null): void;
  /** DEV inspection: world position of a lane-unit point (after the stage placed the group). */
  laneToWorld(laneId: string, point: readonly [number, number, number]): [number, number, number] | null;
}
export type LessonSceneOptions = Readonly<{
  /** Paper height of the right page above its flat base at page-local x (world units); flat when omitted. */
  paper?: (pageX: number) => number;
  /** The spread the scene lies on: its right page's curve becomes `paper` (geometry.rightPagePaper). */
  spread?: Readonly<{ index: number; count: number }>;
  /** Ink hatching on shaded faces (off on the low tier). */
  hatch?: boolean;
  /** Split/merge strokes are skipped for reduced motion. */
  reducedMotion?: () => boolean;
  /** Request a frame while a split/merge stroke animates. */
  invalidate?: () => void;
}>;

const INSET_X = 0.2;
const WIDTH = BOOK_DIMENSIONS.pageWidth - INSET_X * 2;
const SCALE = WIDTH / BAR_WIDTH;
export const LESSON_SCENE_SCALE = SCALE;
// Flat ink and block bases sit this far above the printed paper (world units).
const PAPER_LIFT = 0.008;
type LaneFigure = {
  laneId: string;
  events: readonly MusicEvent[];
  figure: DurationFigure;
};
const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** Reveal of item `index` of `count`: the pen moves on to the next figure `stagger` ms later. */
export function staggeredReveal(reveal: number, index: number, count: number): number {
  const total = BOOK_MOTION.reveal, stagger = BOOK_MOTION.stagger;
  const span = Math.max(1, total - Math.max(0, count - 1) * stagger);
  return clamp01((clamp01(reveal) * total - index * stagger) / span);
}

/** Ink duration figures for a page's lanes (plus decor and guides), without owning a renderer or audio. */
export function createLessonScene(sceneId: BookLessonSceneId, initialLesson: LessonState, options: LessonSceneOptions = {}): LessonScene {
  const group = new Group();
  group.name = `book-${sceneId}`;
  const pickTargets: Mesh[] = [];
  const picks = new Map<Object3D, LessonScenePick>();
  const lanes: LaneFigure[] = [];
  let decor: SpreadDecor | null = null;
  let guide: InkFigure | null = null;
  let lesson = initialLesson;
  let playback: LessonScenePlayback | null = null;
  let disposed = false;
  let lift = 1, reveal = 1;
  const paper = options.paper ?? (options.spread ? rightPagePaper(options.spread.index, options.spread.count) : undefined);
  // Lane units: x 0..10 maps to INSET_X + SCALE·x on the page; heights scale the same way.
  const laneSurface: FigureSurface | undefined = paper ? x => paper(INSET_X + SCALE * x) / SCALE : undefined;
  const extent = lessonFigureExtent(sceneId);

  /** Reveal order: lanes top to bottom, then the decor, then guides. */
  const revealItems = (): { setReveal(t: number): void }[] => [...lanes.map(lane => lane.figure), ...(decor ? [decor] : []), ...(guide ? [guide] : [])];

  function refreshPicks(): void {
    pickTargets.length = 0;
    picks.clear();
    for (const { laneId, figure } of lanes) {
      for (const mesh of figure.pickTargets) {
        pickTargets.push(mesh);
        picks.set(mesh, Object.freeze({ laneId, eventId: String(mesh.userData.eventId) }));
      }
    }
  }

  function refreshHighlights(): void {
    const state = sceneState(lesson, sceneId);
    for (const { laneId, figure } of lanes) {
      figure.setHighlight(state.activeLaneId === laneId ? state.selectedEventId : null,
        playback?.laneId === laneId ? playback.activeId : null);
      figure.setPosition(playback?.laneId === laneId ? playback.position : 0,
        playback?.reducedMotion ?? false);
    }
  }

  const controls: FigureControls = {
    setLift(value) {
      if (disposed) return;
      lift = clamp01(value);
      for (const lane of lanes) lane.figure.setLift(lift);
      decor?.setLift(lift);
      guide?.setLift(lift);
    },
    setReveal(value) {
      if (disposed) return;
      reveal = clamp01(value);
      const items = revealItems();
      items.forEach((item, index) => item.setReveal(staggeredReveal(reveal, index, items.length)));
    },
    setResolution(width, height) {
      if (disposed) return;
      for (const lane of lanes) lane.figure.setResolution(width, height);
      decor?.setResolution(width, height);
      guide?.setResolution(width, height);
    },
    stats: () => sumFigureStats([...lanes.map(lane => lane.figure.figure.stats()), ...(decor ? [decor.stats()] : []), ...(guide ? [guide.stats()] : [])]),
  };

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    playback = null;
    group.removeFromParent();
    group.clear();
    picks.clear();
    pickTargets.length = 0;
    for (const { figure } of lanes) figure.dispose();
    decor?.dispose();
    guide?.dispose();
  }

  try {
    for (const [index, lane] of getScene(sceneId).lanes.entries()) {
      const events = sceneEvents(initialLesson, sceneId, lane.laneId);
      // Stacked lanes share one time axis: only the first prints '0, 1/2, 1'.
      const figure = createDurationFigure(events, { surface: laneSurface, hatch: options.hatch, labels: index === 0,
        reducedMotion: options.reducedMotion, invalidate: options.invalidate });
      // Register ownership before any further preparation that could throw.
      lanes.push({ laneId: lane.laneId, events, figure });
      figure.group.name = `${sceneId}-${lane.laneId}`;
      figure.group.scale.setScalar(SCALE);
      figure.group.position.set(INSET_X, PAPER_LIFT, LESSON_LANE_Z[sceneId][index]!);
      group.add(figure.group);
    }
    const kind = DECOR_KIND[sceneId];
    if (kind && extent.decorZ !== null) {
      decor = createSpreadDecor(kind, lanes.map(lane => lane.events), { surface: laneSurface, hatch: options.hatch });
      decor.group.name = `${sceneId}-decor-${kind}`;
      decor.group.scale.setScalar(SCALE);
      decor.group.position.set(INSET_X, PAPER_LIFT, extent.decorZ);
      group.add(decor.group);
    }
    if (sceneId === 'scene-3') {
      // The half-bar target, dashed in ink across all three lanes (world units).
      guide = createInkFigure('half-target', { surface: paper, floor: INK.floor * SCALE, dash: SCALE });
      const x = INSET_X + WIDTH / 2, z = LESSON_LANE_Z[sceneId];
      guide.rebuild(builder => builder.line([[x, 0, z[0]! + SCALE * DURATION_FIGURE.backZ], [x, 0, z.at(-1)! + SCALE * DURATION_FIGURE.tickTo]],
        { onPaper: true, dashed: true, tone: 0.1 }));
      guide.group.name = 'half-duration-target';
      guide.group.position.y = PAPER_LIFT;
      group.add(guide.group);
    }
    attachFigureControls(group, controls);
    refreshPicks();
    refreshHighlights();
    group.updateMatrixWorld(true);
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    sceneId, group, pickTargets, dispose, figure: controls,
    updateLesson(next: LessonState): void {
      if (disposed) return;
      let changedEvents = false;
      for (const lane of lanes) {
        const events = sceneEvents(next, sceneId, lane.laneId);
        if (events !== lane.events) {
          lane.figure.setEvents(events);
          lane.events = events;
          changedEvents = true;
        }
      }
      lesson = next;
      if (changedEvents) {
        decor?.update(lanes.map(lane => lane.events));
        // Edits invalidate a playback display just as the coordinator stops its audio.
        playback = null;
        refreshPicks();
      }
      refreshHighlights();
      group.updateMatrixWorld(true);
    },
    setPlayback(next: LessonScenePlayback | null): void {
      if (disposed) return;
      if (next && !lanes.some((lane) => lane.laneId === next.laneId)) {
        throw new RangeError(`Unknown lane ${next.laneId} for ${sceneId}.`);
      }
      playback = next ? Object.freeze({ ...next }) : null;
      refreshHighlights();
    },
    pickEvent(object: Object3D): LessonScenePick | null {
      return disposed ? null : picks.get(object) ?? null;
    },
    holdTransitions(ms) {
      if (disposed) return;
      for (const lane of lanes) lane.figure.hold(ms);
    },
    laneToWorld(laneId, point) {
      const lane = lanes.find(item => item.laneId === laneId);
      if (disposed || !lane) return null;
      lane.figure.group.updateWorldMatrix(true, false);
      // Heights are measured from the (curved) paper under x, as the figure builder draws them.
      return lane.figure.group.localToWorld(new Vector3(point[0], point[1] + (laneSurface?.(point[0]) ?? 0), point[2])).toArray();
    },
    getSnapshot(): LessonSceneSnapshot {
      const state = sceneState(lesson, sceneId);
      return Object.freeze({
        sceneId, revision: lesson.revision, disposed,
        activeLaneId: state.activeLaneId, selectedEventId: state.selectedEventId,
        playbackLaneId: playback?.laneId ?? null,
        lanes: Object.freeze(lanes.map(({ laneId, events, figure }) => Object.freeze({
          laneId, eventIds: Object.freeze(events.map((event) => event.id)),
          origin: Object.freeze({ x: figure.group.position.x, y: figure.group.position.y, z: figure.group.position.z }),
          width: WIDTH, scale: SCALE, transition: figure.transition,
        }))),
        lift, reveal, decor: decor?.kind ?? null, figure: controls.stats(),
      });
    },
  };
}
