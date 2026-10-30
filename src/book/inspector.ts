import type { BookStage, StageLayout, StageUpdate } from './stage.ts';
import type { LessonScene } from './lessonScene.ts';
import { figureEntryFrame } from './figures/choreography.ts';

export type BookInspectorSnapshot = Readonly<{ layout: StageLayout | null; visual: StageUpdate }>;
export interface BookInspector {
  pose(patch: Partial<StageUpdate>): BookInspectorSnapshot;
  reset(): void;
  snapshot(): BookInspectorSnapshot;
  /** v3 R3: printed pages in the window, their hotspots and on-screen centres (client px) for tests. */
  pages(): readonly unknown[];
  /** v3 R3: compositor memory, paint counts and recent paint durations. */
  printStats(): unknown;
  /** v3 R3: the uploaded print (or state layer) of a page in the window as a PNG data URL. */
  printImage(pageId: string, layer?: 'print' | 'state'): string | null;
  /** v3 R3: hold settled upgrades so a draft frame can be compared with its settled frame. */
  holdPrintUpgrades(hold: boolean): void;
  /** v3 R3: client coordinates of a page-local point (u right, v down) on the open spread. */
  pagePoint(side: 'left' | 'right', u: number, v: number): { x: number; y: number } | null;
  /** v3 R4: the live scene figure (lift, reveal, segment counts, split/merge strokes). */
  figure(): unknown;
  /** v3 R4: pose the first-entry figure frame `ms` after entering (pen reveal + lift); reset() restores. */
  figureEntry(ms: number): BookInspectorSnapshot;
  /** v3 R4: pin split/merge strokes `ms` after they start (null resumes real time). */
  holdFigureStrokes(ms: number | null): void;
  /** v3 R4: show a playback display on the figure (playhead + glowing note) without audio; null clears. */
  figurePlayback(laneId: string | null, activeIndex?: number | null, position?: number): void;
  /** v3 R4: draw calls of one frame with and without the figure (renders the stage twice). */
  sceneDrawCalls(): unknown;
  /** v3 R4: client coordinates of lane-unit figure points (x 0..10 along the bar, y up, z toward the reader). */
  figurePoints(laneId: string, points: readonly (readonly [number, number, number])[]): ({ x: number; y: number } | null)[];
  /** v3 R5: paper flap angles in degrees by `${pageId}:${flapId}` (0 closed, 110 open). */
  flapAngles(): Readonly<Record<string, number>>;
  /** v3 R5: pin moving flaps `ms` after they start (null resumes real time). */
  holdFlaps(ms: number | null): void;
  /** v3 R5: the flap key of a standing paper sheet under a client point (the pointer's raycast). */
  flapAt(clientX: number, clientY: number): string | null;
  /** v3 R6: the lesson shot in progress (entering, holding or returning) and its linear progress. */
  shot(): Readonly<{ id: string; phase: 'enter' | 'hold' | 'return'; t: number }> | null;
  /** v3 R6: pin the shot clock `ms` after its current phase began (null resumes real time). */
  holdShot(ms: number | null): void;
}

declare global {
  interface Window {
    __bookInspector?: BookInspector;
  }
}

export type BookInspectorOptions = Readonly<{
  getStage: () => BookStage | null;
  getVisual: () => StageUpdate;
  draw: (patch: Partial<StageUpdate>) => void;
  getRoot: () => HTMLElement | null;
  getScene?: () => LessonScene | null;
  getPages?: () => readonly unknown[];
  getPrintStats?: () => unknown;
  getPrintImage?: (pageId: string, layer: 'print' | 'state') => string | null;
  holdPrintUpgrades?: (hold: boolean) => void;
  getShot?: () => Readonly<{ id: string; phase: 'enter' | 'hold' | 'return'; t: number }> | null;
  holdShot?: (ms: number | null) => void;
}>;

const poseKeys = new Set(['coverProgress', 'introProgress', 'currentSpreadIndex', 'turn', 'inspectionWireframe', 'sceneProgress', 'sceneReveal']);
const unitValue = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const copyVisual = (visual: StageUpdate): StageUpdate => ({ ...visual, turn: visual.turn ? { ...visual.turn } : null });

function checkedPose(patch: Partial<StageUpdate>, spreadCount: number): Partial<StageUpdate> {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !poseKeys.has(key))) {
    throw new TypeError('Inspector pose accepts only coverProgress, introProgress, currentSpreadIndex, turn, inspectionWireframe, sceneProgress and sceneReveal.');
  }
  const next: Partial<StageUpdate> = {};
  if (Object.hasOwn(patch, 'inspectionWireframe')) {
    if (typeof patch.inspectionWireframe !== 'boolean') throw new TypeError('inspectionWireframe must be a boolean.');
    next.inspectionWireframe = patch.inspectionWireframe;
  }
  for (const key of ['coverProgress', 'introProgress', 'sceneProgress', 'sceneReveal'] as const) {
    if (Object.hasOwn(patch, key)) {
      if (!unitValue(patch[key])) throw new RangeError(`${key} must be between 0 and 1.`);
      next[key] = patch[key];
    }
  }
  if (Object.hasOwn(patch, 'currentSpreadIndex')) {
    const index = patch.currentSpreadIndex;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= spreadCount) {
      throw new RangeError('currentSpreadIndex must identify an existing spread.');
    }
    next.currentSpreadIndex = index;
  }
  if (Object.hasOwn(patch, 'turn')) {
    const turn = patch.turn;
    if (turn === null) next.turn = null;
    else {
      if (!turn || typeof turn !== 'object' || Array.isArray(turn)
        || Object.keys(turn).some(key => !['direction', 'progress', 'corner'].includes(key))
        || (turn.direction !== 'forward' && turn.direction !== 'backward')
        || !unitValue(turn.progress) || (turn.corner !== 'top' && turn.corner !== 'bottom')) {
        throw new TypeError('turn must be null or contain a valid direction, progress, and corner.');
      }
      next.turn = { direction: turn.direction, progress: turn.progress, corner: turn.corner };
    }
  }
  return next;
}

/** Development inspection of the live stage; no renderer, animation, or lesson mock. */
export function attachBookInspector(options: BookInspectorOptions): () => void {
  if (!import.meta.env.DEV) return () => {};
  let original: StageUpdate | null = null;
  let inspectionRoot: HTMLElement | null = null;
  let disposed = false;

  const snapshot = (): BookInspectorSnapshot => {
    const layout = options.getStage()?.getLayout() ?? null;
    return { layout: layout ? structuredClone(layout) : null, visual: copyVisual(options.getVisual()) };
  };
  const reset = () => {
    const saved = original;
    original = null;
    try {
      if (saved) options.draw({ ...copyVisual(saved), inspectionWireframe: saved.inspectionWireframe ?? false });
    } finally {
      inspectionRoot?.removeAttribute('data-inspection');
      inspectionRoot = null;
    }
  };
  const inspector: BookInspector = {
    pose(patch) {
      if (disposed) throw new Error('Book inspector is detached.');
      if (!options.getStage()) throw new Error('The live book stage is not ready.');
      const current = options.getVisual();
      const next = checkedPose(patch, current.spreadCount);
      if (!original) original = copyVisual(current);
      const root = options.getRoot();
      if (inspectionRoot !== root) inspectionRoot?.removeAttribute('data-inspection');
      inspectionRoot = root;
      inspectionRoot?.setAttribute('data-inspection', 'true');
      options.draw(next);
      // Rendering is scheduled by the same stage. Capture pixels after its next
      // animation frame; this immediate layout can still describe the prior frame.
      return snapshot();
    },
    reset,
    snapshot,
    pages: () => structuredClone(options.getPages?.() ?? []),
    printStats: () => structuredClone(options.getPrintStats?.() ?? null),
    printImage: (pageId, layer = 'print') => options.getPrintImage?.(pageId, layer) ?? null,
    holdPrintUpgrades: hold => options.holdPrintUpgrades?.(Boolean(hold)),
    pagePoint: (side, u, v) => options.getStage()?.pagePoint(side === 'left' ? 'left' : 'right', Number(u), Number(v)) ?? null,
    figure: () => structuredClone(options.getScene?.()?.getSnapshot() ?? null),
    figureEntry(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) throw new RangeError('figureEntry needs a non-negative time in ms.');
      const frame = figureEntryFrame(ms);
      return inspector.pose({ sceneProgress: frame.lift, sceneReveal: frame.reveal });
    },
    holdFigureStrokes(ms) {
      options.getScene?.()?.holdTransitions(typeof ms === 'number' && Number.isFinite(ms) ? ms : null);
      options.getStage()?.invalidate();
    },
    figurePlayback(laneId, activeIndex = null, position = 0) {
      const scene = options.getScene?.();
      if (!scene) return;
      if (laneId === null) scene.setPlayback(null);
      else {
        const lane = scene.getSnapshot().lanes.find(item => item.laneId === laneId);
        if (!lane) throw new RangeError(`Unknown lane ${laneId}.`);
        scene.setPlayback({ laneId, activeId: activeIndex === null ? null : lane.eventIds[activeIndex] ?? null, position: Number(position), reducedMotion: false });
      }
      options.getStage()?.invalidate();
    },
    sceneDrawCalls: () => structuredClone(options.getStage()?.measureSceneDrawCalls() ?? null),
    flapAngles: () => ({ ...(options.getStage()?.flapAngles() ?? {}) }),
    holdFlaps(ms) {
      if (ms !== null && (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0)) throw new RangeError('holdFlaps takes a non-negative time in ms or null.');
      options.getStage()?.holdFlaps(ms);
    },
    flapAt: (clientX, clientY) => options.getStage()?.flapAt(clientX, clientY) ?? null,
    shot: () => { const shot = options.getShot?.(); return shot ? { ...shot } : null; },
    holdShot(ms) {
      if (ms !== null && (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0)) throw new RangeError('holdShot takes a non-negative time in ms or null.');
      options.holdShot?.(ms);
    },
    figurePoints(laneId, points) {
      const scene = options.getScene?.(), stage = options.getStage();
      return points.map(point => {
        const world = scene?.laneToWorld(String(laneId), [Number(point[0]), Number(point[1]), Number(point[2])]);
        return world && stage ? stage.projectToClient(world) : null;
      });
    },
  };
  window.__bookInspector = inspector;
  return () => {
    if (disposed) return;
    try {
      reset();
    } finally {
      disposed = true;
      if (window.__bookInspector === inspector) delete window.__bookInspector;
    }
  };
}
