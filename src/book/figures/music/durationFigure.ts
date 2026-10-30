import type { Group, Mesh } from 'three';
import { BAR_WIDTH, BLOCK_DEPTH, BLOCK_HEIGHT, clampedPosition, durationBounds } from '../../../scenes/durationWorld.ts';
import type { DurationEvent } from '../../../scenes/durationWorld.ts';
import { BOOK_MOTION } from '../../motion.ts';
import { createInkFigure } from '../figure.ts';
import type { FigureBuilder, FigureSurface, InkFigure } from '../figure.ts';
import { createInkUniforms, INK, InkLines } from '../inkLines.ts';
import type { InkSegment, Vec3 } from '../inkLines.ts';

/**
 * v3 R4 duration figure (REFACTOR_DESIGN_V3 §6 R4 (4), CONTRACT_V3 C6). The meaning layer of
 * durationWorld is imported, not copied: x = onset × 10, width = duration × 10, fixed height and
 * depth (never volume). Only the drawing changes: an ink time axis printed on the paper, notes as
 * paper-filled ink boxes, rests as dashed outlines, the selection in accent ink, the playing note
 * glowing, and split/merge drawn as a pen stroke along the boundary that changed.
 */
export const DURATION_FIGURE = Object.freeze({
  /** Axis line and ticks in front of the blocks (same layout as durationWorld). */
  axisZ: 0.64, tickFrom: 0.61, tickTo: 0.86, labelZ: 1.04, labelSize: 0.3,
  /** Ink density bias: the axis and its ticks are lighter than the note outlines. */
  axisTone: 0.2, tickTone: 0.3, restBackTone: 0.4,
  playheadZ: 0.57, playheadHeight: 0.72,
  /** Selection outline is drawn just outside the block's own edges. */
  accentInflate: 0.012,
  /** The split/merge pen cut starts this far above the block and runs on the paper to the ticks. */
  cutAbove: 0.35, cutFront: 0.04,
  /** Figure-local extent toward the far edge (block backs) and the near edge (ticks, labels). */
  backZ: -BLOCK_DEPTH / 2,
});
export const DURATION_LABELS = Object.freeze([{ text: '0', x: 0 }, { text: '1/2', x: BAR_WIDTH / 2 }, { text: '1', x: BAR_WIDTH }]);
/** Near-edge extent of a lane, with or without its printed axis labels (figure units). */
export const durationFrontZ = (labels: boolean) => labels ? DURATION_FIGURE.labelZ + DURATION_FIGURE.labelSize / 2 : DURATION_FIGURE.tickTo;

export type DurationFigureOptions = Readonly<{
  surface?: FigureSurface;
  hatch?: boolean;
  floor?: number;
  /** Print '0, 1/2, 1' under the axis (stacked lanes print it once). */
  labels?: boolean;
  /** Split/merge strokes are skipped for reduced motion. */
  reducedMotion?: () => boolean;
  /** Request a frame from the demand-driven stage while a stroke animates. */
  invalidate?: () => void;
  now?: () => number;
  requestFrame?: (callback: (time: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}>;

export type FigureEventView = Readonly<{ kind: 'note' | 'rest'; hit: Mesh }>;
export type DurationTransition = Readonly<{ kind: 'draw' | 'erase'; boundaries: readonly number[] }>;

export interface DurationFigure {
  readonly group: Group;
  readonly figure: InkFigure;
  readonly views: Map<string, FigureEventView>;
  /** Stable pick array (the lesson scene's pickTargets contract). */
  readonly pickTargets: Mesh[];
  readonly playhead: InkLines;
  setEvents(events: readonly DurationEvent[]): void;
  setHighlight(selected: string | null | undefined, active: string | null | undefined): void;
  setPosition(position: number, reducedMotion: boolean): void;
  setLift(t: number): void;
  setReveal(t: number): void;
  setResolution(width: number, height: number): void;
  /** Advance a split/merge stroke to `time`; returns true while it is still running. */
  advance(time: number): boolean;
  /** Inspection: pin strokes at `ms` after their start (null resumes real time). */
  hold(ms: number | null): void;
  /** Boundary strokes queued by the last edit (inspection/tests). */
  readonly transition: DurationTransition | null;
  dispose(): void;
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
/** Internal boundaries between adjacent events (0 and the bar end excluded). */
export function durationBoundaries(events: readonly DurationEvent[]): number[] {
  const result: number[] = [];
  for (const event of events) {
    const { x, width } = durationBounds(event);
    for (const value of [x, x + width]) if (value > 1e-9 && value < BAR_WIDTH - 1e-9 && !result.some(item => near(item, value))) result.push(value);
  }
  return result.sort((a, b) => a - b);
}

export function createDurationFigure(initialEvents: readonly DurationEvent[], options: DurationFigureOptions = {}): DurationFigure {
  const surface = options.surface ?? (() => 0);
  const labels = options.labels ?? true;
  const figure = createInkFigure('duration', { surface: options.surface, hatch: options.hatch, floor: options.floor });
  const { group } = figure;
  const views = new Map<string, FigureEventView>();
  const pickTargets: Mesh[] = [];
  let events: readonly DurationEvent[] = [];
  let selectedId: string | null | undefined;
  let activeId: string | null | undefined;
  let disposed = false;

  // Playhead: accent ink riding the lane, built once at x = 0 and moved by setPosition.
  const playheadUniforms = createInkUniforms(1, 1);
  const playhead = new InkLines(playheadUniforms, { color: INK.accent, width: INK.playheadWidth, capacity: 2, name: 'duration-playhead' });
  const { playheadZ, playheadHeight } = DURATION_FIGURE;
  playhead.set([
    { start: [0, 0, playheadZ], end: [0, playheadHeight, playheadZ] },
    { start: [0, playheadHeight, playheadZ], end: [0, playheadHeight, -playheadZ] },
  ]);
  playhead.object.visible = false;
  playhead.object.renderOrder = 2;
  group.add(playhead.object);

  // Split/merge strokes: their own reveal, the figure's lift; dark pen, drawn over everything else.
  const strokeUniforms = { uLift: figure.uniforms.uLift, uReveal: { value: 0 } };
  const stroke = new InkLines(strokeUniforms, { width: INK.accentWidth, capacity: 32, name: 'duration-split-stroke' });
  stroke.object.visible = false;
  stroke.object.renderOrder = 3;
  group.add(stroke.object);
  let transition: { kind: 'draw' | 'erase'; boundaries: number[]; start: number } | null = null;
  let frame: number | null = null;
  let held: number | null = null;
  const now = options.now ?? (() => performance.now());
  const requestFrame = options.requestFrame ?? (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
  const cancelFrame = options.cancelFrame ?? (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null);

  function draw(builder: FigureBuilder): void {
    const { axisZ, tickFrom, tickTo, labelZ, labelSize, axisTone, tickTone, restBackTone } = DURATION_FIGURE;
    builder.line([[0, 0, axisZ], [BAR_WIDTH, 0, axisZ]], { onPaper: true, tone: axisTone });
    for (const tick of [0, 0.25, 0.5, 0.75, 1]) builder.line([[tick * BAR_WIDTH, 0, tickFrom], [tick * BAR_WIDTH, 0, tickTo]], { onPaper: true, tone: tickTone });
    if (labels) for (const label of DURATION_LABELS) builder.label(label.text, [label.x, 0, labelZ], { size: labelSize });
    builder.pause(0.2);
    for (const event of events) {
      const bounds = durationBounds(event);
      const spec = { x0: bounds.x, x1: bounds.x + bounds.width, z0: -BLOCK_DEPTH / 2, z1: BLOCK_DEPTH / 2, height: BLOCK_HEIGHT };
      // Rests keep their time as a dashed outline with no paper face (v2 meaning: outline-only rests).
      builder.box(spec, event.kind === 'rest' ? { fill: false, edges: 'dashed', key: event.id, backTone: restBackTone } : { key: event.id });
      builder.hit(event.id, { x0: spec.x0, x1: spec.x1, y0: 0, y1: BLOCK_HEIGHT, z0: spec.z0, z1: spec.z1 }, { eventId: event.id, kind: event.kind });
    }
  }

  function syncViews(): void {
    views.clear();
    pickTargets.length = 0;
    figure.hitTargets.forEach((mesh, index) => {
      const event = events[index]!;
      views.set(event.id, { kind: event.kind, hit: mesh });
      pickTargets.push(mesh);
    });
  }

  function applyHighlight(): void {
    const selected = selectedId ? events.find(event => event.id === selectedId) : undefined;
    figure.setAccent(selected ? builder => {
      const { x, width } = durationBounds(selected);
      const grow = DURATION_FIGURE.accentInflate;
      builder.box({ x0: x - grow, x1: x + width + grow, z0: -BLOCK_DEPTH / 2 - grow, z1: BLOCK_DEPTH / 2 + grow, height: BLOCK_HEIGHT + grow },
        { fill: false, edges: selected.kind === 'rest' ? 'dashed' : 'solid' });
    } : null);
    // The playing note glows (rests have no face to light; the playhead shows their time).
    const active = activeId ? events.find(event => event.id === activeId) : undefined;
    figure.setGlow(active?.kind === 'note' ? active.id : null);
  }

  /**
   * One pen cut per boundary: from above the block down its front (just in front of the face, so it
   * shows over a selection outline) and on along the paper to the axis ticks.
   */
  function strokeSegments(values: readonly number[]): InkSegment[] {
    const result: InkSegment[] = [];
    const slot = 1 / Math.max(1, values.length);
    const { cutAbove, cutFront, tickTo } = DURATION_FIGURE;
    values.forEach((x, index) => {
      const base = surface(x), z = BLOCK_DEPTH / 2 + cutFront;
      const pieces: (readonly [Vec3, Vec3, number])[] = [
        [[x, base + BLOCK_HEIGHT + cutAbove, z], [x, base, z], 0.7],
        [[x, base, z], [x, base, tickTo], 0.3],
      ];
      let t = slot * index;
      for (const [start, end, share] of pieces) { result.push({ start, end, t0: t, dur: slot * share }); t += slot * share; }
    });
    return result;
  }

  function stopTransition(): void {
    if (frame !== null && cancelFrame) cancelFrame(frame);
    frame = null;
    transition = null;
    stroke.object.visible = false;
  }

  /** Returns true while the stroke should keep animating (a held stroke stays drawn but idle). */
  function advance(time: number): boolean {
    if (!transition) return false;
    const elapsed = held ?? time - transition.start;
    const progress = Math.max(0, Math.min(1, elapsed / BOOK_MOTION.splitMerge));
    strokeUniforms.uReveal.value = transition.kind === 'draw' ? progress : 1 - progress;
    if (held !== null) return false;
    if (progress >= 1) { stopTransition(); return false; }
    return true;
  }

  function loop(): void {
    if (!requestFrame || frame !== null) return;
    frame = requestFrame(() => {
      frame = null;
      const running = advance(now());
      options.invalidate?.();
      if (running) loop();
    });
  }

  function startTransition(kind: 'draw' | 'erase', values: number[]): void {
    stopTransition();
    if (!values.length || options.reducedMotion?.() || figure.reveal < 1 || figure.lift < 0.99) return;
    transition = { kind, boundaries: values, start: now() };
    stroke.set(strokeSegments(values));
    stroke.object.visible = true;
    if (advance(now())) loop();
  }

  function setEvents(next: readonly DurationEvent[]): void {
    if (disposed) throw new Error('The duration figure was disposed.');
    // Validate every event first: a rejected replacement keeps the current valid figure.
    next.forEach(event => durationBounds(event));
    const before = events.length ? durationBoundaries(events) : null;
    events = next;
    figure.rebuild(draw);
    syncViews();
    applyHighlight();
    if (before) {
      const after = durationBoundaries(events);
      const added = after.filter(value => !before.some(item => near(item, value)));
      const removed = before.filter(value => !after.some(item => near(item, value)));
      // Data changed already; only the drawing animates (v2.1 §8.5): cut new boundaries, erase merged ones.
      if (added.length && !removed.length) startTransition('draw', added);
      else if (removed.length && !added.length) startTransition('erase', removed);
      else stopTransition();
    }
  }

  try { setEvents(initialEvents); } catch (error) { playhead.dispose(); stroke.dispose(); figure.dispose(); throw error; }

  return {
    group, figure, views, pickTargets, playhead, setEvents, advance,
    get transition() { return transition ? { kind: transition.kind, boundaries: [...transition.boundaries] } : null; },
    hold(ms) {
      if (disposed) return;
      held = ms === null || !Number.isFinite(ms) ? null : Math.max(0, ms);
      if (!transition) return;
      if (advance(now())) loop();
      options.invalidate?.();
    },
    setHighlight(selected, active) {
      if (disposed) return;
      selectedId = selected;
      activeId = active;
      applyHighlight();
    },
    setPosition(position, reducedMotion) {
      if (disposed) return;
      const value = clampedPosition(position);
      const x = value * BAR_WIDTH;
      playhead.object.position.set(x, surface(x), 0);
      playhead.object.visible = !reducedMotion && value > 0;
    },
    setLift(t) { figure.setLift(t); playheadUniforms.uLift.value = figure.lift; },
    setReveal(t) { figure.setReveal(t); },
    setResolution(width, height) { figure.setResolution(width, height); playhead.setResolution(width, height); stroke.setResolution(width, height); },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopTransition();
      playhead.dispose();
      stroke.dispose();
      figure.dispose();
      views.clear();
      pickTargets.length = 0;
    },
  };
}
