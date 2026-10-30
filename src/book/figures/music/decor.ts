import type { Group } from 'three';
import type { SceneId } from '../../../content/types.ts';
import type { DurationEvent } from '../../../scenes/DurationScene2D.tsx';
import { BAR_WIDTH } from '../../../scenes/durationWorld.ts';
import { createInkFigure } from '../figure.ts';
import type { FigureBuilder, FigureStats, FigureSurface, InkFigure } from '../figure.ts';
import type { Vec3 } from '../inkLines.ts';
import { durationBoundaries } from './durationFigure.ts';
import { lessonTempoTiming } from '../../lessonPresentation.ts';

/**
 * v3 R4 decor (REFACTOR_DESIGN_V3 §6 R4 (5)): small ink drawings beside a spread's lanes. They are
 * a meaning aid, never the learning record: nothing here is read back for answers or assessment.
 * Spread 1 — long and short "sound bands" and a small metronome that stands up like a pop-up card.
 * Spread 2 — a paper strip under the lane with a scissor cut at every boundary, scissors, and the
 * current division written as fractions. Coordinates are lane units (x 0..10 = one bar).
 * v3 R8 (design §6 R8): spread 5 — a seconds ruler under the lane whose ink labels follow the tempo
 * (60: 0–4 s, 120: 0–2 s) while the blocks keep their length; spread 6 — the free bar: a strip filled
 * as far as the reader's notes and rests reach, the rest of the bar dashed, and the sum in fractions.
 * Spread 3's half-bar target and spread 4's empty dashed rests are drawn by the lesson scene and the
 * duration figure themselves.
 */
export type DecorKind = 'sound' | 'scissors' | 'tempo' | 'bar';
export const DECOR_KIND: Readonly<Partial<Record<SceneId, DecorKind>>> = Object.freeze({ 'scene-1': 'sound', 'scene-2': 'scissors', 'scene-5': 'tempo', 'scene-6': 'bar' });
export const DECOR_LAYOUT = Object.freeze({
  sound: Object.freeze({ bandZ: 0.35, bandWidth: 0.16, longBand: Object.freeze([0.2, 3.4] as const), shortStart: 3.9, shortStep: 0.75, shortLength: 0.55,
    metronomeX: 8.6, metronomeSize: 2, metronomeHeight: 0.79 * 2 }),
  scissors: Object.freeze({ stripZ0: 0.1, stripZ1: 0.4, cutFrom: 0.02, cutTo: 0.48, labelZ: 0.74, labelSize: 0.3, iconFront: 0.97 }),
  tempo: Object.freeze({ rulerZ: 0.14, tickFrom: 0.04, tickTo: 0.24, labelZ: 0.5, labelSize: 0.28 }),
  bar: Object.freeze({ stripZ0: 0.1, stripZ1: 0.4, labelZ: 0.74, labelSize: 0.3 }),
});
/** Segment budget for one decor drawing (design: ≤ 400). */
export const DECOR_BUDGET = 400;

/**
 * Lane-unit z extent around the decor origin. `back` includes how far a standing part appears up
 * the page at the reading pose (height × raisePerHeight); `front` how far a folded part lies toward
 * the reader before it stands.
 */
export function decorExtent(kind: DecorKind, raisePerHeight: number): Readonly<{ back: number; front: number }> {
  if (kind === 'sound') {
    // The metronome stands on its base line (z = 0) and lies as its plan while flat (no fold).
    const { metronomeHeight, bandZ, bandWidth } = DECOR_LAYOUT.sound;
    return { back: Math.min(bandZ - bandWidth, -metronomeHeight * raisePerHeight), front: bandZ + bandWidth };
  }
  if (kind === 'tempo') {
    const { tickFrom, labelZ, labelSize } = DECOR_LAYOUT.tempo;
    return { back: tickFrom, front: labelZ + labelSize / 2 };
  }
  if (kind === 'bar') {
    const { stripZ0, labelZ, labelSize } = DECOR_LAYOUT.bar;
    return { back: stripZ0, front: labelZ + labelSize / 2 };
  }
  const { cutFrom, iconFront, labelZ, labelSize } = DECOR_LAYOUT.scissors;
  return { back: cutFrom, front: Math.max(iconFront, labelZ + labelSize / 2) };
}

/** Seconds as the ruler writes them (0.5초, 1초 …). */
export const secondsLabel = (value: number) => `${Number(value.toFixed(2))}초`;

const gcd = (a: number, b: number): number => b === 0 ? Math.abs(a) : gcd(b, a % b);
const reduced = (n: number, d: number) => { const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; };
const text = (n: number, d: number) => d === 1 ? String(n) : `${n}/${d}`;

/** "1 = 1/2 + 1/4 × 2": the division the scissors have made, largest pieces first (nothing before the first cut). */
export function fractionSummary(events: readonly DurationEvent[]): string {
  const groups = new Map<string, { n: number; d: number; count: number }>();
  let total = { n: 0, d: 1 };
  for (const event of events) {
    const { n, d } = reduced(event.duration.n, event.duration.d);
    const key = `${n}/${d}`;
    const group = groups.get(key) ?? { n, d, count: 0 };
    group.count += 1;
    groups.set(key, group);
    total = reduced(total.n * d + n * total.d, total.d * d);
  }
  if (events.length < 2) return '';
  const parts = [...groups.values()].sort((a, b) => b.n / b.d - a.n / a.d)
    .map(group => group.count > 1 ? `${text(group.n, group.d)} × ${group.count}` : text(group.n, group.d));
  return `${text(total.n, total.d)} = ${parts.join(' + ')}`;
}

export interface SpreadDecor {
  readonly kind: DecorKind;
  readonly group: Group;
  readonly figure: InkFigure;
  /** Redraw from the lanes' events (scissor marks, the free bar) and the tempo (the seconds ruler). */
  update(lanes: readonly (readonly DurationEvent[])[], bpm?: 60 | 120): void;
  setLift(t: number): void;
  setReveal(t: number): void;
  setResolution(width: number, height: number): void;
  stats(): FigureStats;
  dispose(): void;
}

export type DecorOptions = Readonly<{ surface?: FigureSurface; hatch?: boolean; floor?: number; bpm?: 60 | 120 }>;

function soundBand(builder: FigureBuilder, x0: number, x1: number, z: number, width: number, samples: number): void {
  const envelope = (t: number) => width * (t < 0.08 ? t / 0.08 : 1 - 0.55 * (t - 0.08) / 0.92);
  const upper: Vec3[] = [], lower: Vec3[] = [], wave: Vec3[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples, x = x0 + (x1 - x0) * t, w = envelope(t);
    upper.push([x, 0, z - w]);
    lower.push([x, 0, z + w]);
  }
  builder.line([...upper, ...lower.reverse()], { onPaper: true, closed: true, tone: 0.1 });
  // The sound inside the band: a wave that fades with the envelope.
  const period = 0.5, waveSamples = Math.max(8, Math.round((x1 - x0) / 0.07));
  for (let index = 0; index <= waveSamples; index += 1) {
    const t = index / waveSamples, x = x0 + (x1 - x0) * t;
    wave.push([x, 0, z + Math.sin(2 * Math.PI * (x - x0) / period) * 0.6 * envelope(t)]);
  }
  builder.line(wave, { onPaper: true, tone: 0.45 });
}

function metronome(builder: FigureBuilder, cx: number, s: number): void {
  // A card standing on its base line (z = 0) that rises from its plan like the blocks; s scales it.
  const card = {} as const;
  const at = (x: number, y: number): Vec3 => [cx + x * s, y * s, 0];
  builder.line([at(-0.4, 0), at(0.4, 0), at(0.15, 0.62), at(-0.15, 0.62)], { ...card, closed: true });
  builder.line([at(0, 0.1), at(0, 0.5)], { ...card, tone: 0.4 });
  const angle = 18 * Math.PI / 180, arm = 0.69;
  builder.line([at(0, 0.1), at(arm * Math.sin(angle), 0.1 + arm * Math.cos(angle))], card);
  const along = 0.62, size = 0.07;
  const wx = arm * along * Math.sin(angle), wy = 0.1 + arm * along * Math.cos(angle);
  builder.line([at(wx - size, wy), at(wx, wy + size), at(wx + size, wy), at(wx, wy - size)], { ...card, closed: true });
}

function scissors(builder: FigureBuilder): void {
  const ring = (cx: number, cz: number, r: number): Vec3[] => Array.from({ length: 12 }, (_, index) => {
    const a = index / 12 * 2 * Math.PI;
    return [cx + r * Math.cos(a), 0, cz + r * Math.sin(a)];
  });
  builder.line(ring(9.2, 0.6, 0.09), { onPaper: true, closed: true });
  builder.line(ring(9.2, 0.88, 0.09), { onPaper: true, closed: true });
  // Two blades crossing at the pivot, opening toward the cut.
  builder.line([[9.29, 0, 0.62], [9.95, 0, 0.78]], { onPaper: true });
  builder.line([[9.29, 0, 0.86], [9.95, 0, 0.7]], { onPaper: true });
}

export function createSpreadDecor(kind: DecorKind, lanes: readonly (readonly DurationEvent[])[], options: DecorOptions = {}): SpreadDecor {
  const figure = createInkFigure(`decor-${kind}`, { surface: options.surface, hatch: options.hatch, floor: options.floor });
  let events: readonly (readonly DurationEvent[])[] = lanes;
  let bpm: 60 | 120 = options.bpm ?? 60;
  let disposed = false;

  function draw(builder: FigureBuilder): void {
    if (kind === 'tempo') {
      // The ruler marks the bar's quarter beats; only the seconds written under them change with the tempo.
      const { rulerZ, tickFrom, tickTo, labelZ, labelSize } = DECOR_LAYOUT.tempo;
      builder.line([[0, 0, rulerZ], [BAR_WIDTH, 0, rulerZ]], { onPaper: true, tone: 0.2 });
      lessonTempoTiming(bpm).ticks.forEach((value, index) => {
        const x = BAR_WIDTH * index / 4;
        builder.line([[x, 0, tickFrom], [x, 0, tickTo]], { onPaper: true, tone: 0.3 });
        builder.label(secondsLabel(value), [x, 0, labelZ], { size: labelSize, align: index === 0 ? 'left' : index === 4 ? 'right' : 'center' });
      });
      return;
    }
    if (kind === 'bar') {
      // The free bar: filled as far as the notes and rests reach, the rest of the bar still open (dashed).
      const { stripZ0, stripZ1, labelZ, labelSize } = DECOR_LAYOUT.bar;
      const lane = events[0] ?? [];
      const boundaries = durationBoundaries(lane);
      const total = lane.reduce((sum, event) => sum + event.duration.n / event.duration.d, 0);
      const filled = Math.min(BAR_WIDTH, BAR_WIDTH * total);
      if (filled > 0) builder.line([[0, 0, stripZ0], [filled, 0, stripZ0], [filled, 0, stripZ1], [0, 0, stripZ1]], { onPaper: true, closed: true, tone: 0.15 });
      for (const x of boundaries) if (x < filled - 1e-6) builder.line([[x, 0, stripZ0], [x, 0, stripZ1]], { onPaper: true, tone: 0.3 });
      // The open part shares its left side with the filled strip (closed only when nothing is in the bar yet).
      if (filled < BAR_WIDTH - 1e-6) builder.line([[filled, 0, stripZ0], [BAR_WIDTH, 0, stripZ0], [BAR_WIDTH, 0, stripZ1], [filled, 0, stripZ1]],
        { onPaper: true, dashed: true, tone: 0.35, closed: filled <= 0 });
      const summary = lane.length === 1 ? `${text(lane[0]!.duration.n, lane[0]!.duration.d)}` : fractionSummary(lane);
      if (summary) builder.label(summary, [0, 0, labelZ], { size: labelSize, align: 'left' });
      return;
    }
    if (kind === 'sound') {
      const { bandZ, bandWidth, longBand, shortStart, shortStep, shortLength, metronomeX, metronomeSize } = DECOR_LAYOUT.sound;
      soundBand(builder, longBand[0], longBand[1], bandZ, bandWidth, 32);
      for (let index = 0; index < 4; index += 1) soundBand(builder, shortStart + index * shortStep, shortStart + index * shortStep + shortLength, bandZ, bandWidth, 8);
      builder.pause(0.1);
      metronome(builder, metronomeX, metronomeSize);
      return;
    }
    const { stripZ0, stripZ1, cutFrom, cutTo, labelZ, labelSize } = DECOR_LAYOUT.scissors;
    builder.line([[0, 0, stripZ0], [BAR_WIDTH, 0, stripZ0], [BAR_WIDTH, 0, stripZ1], [0, 0, stripZ1]], { onPaper: true, closed: true, tone: 0.15 });
    const lane = events[0] ?? [];
    for (const x of durationBoundaries(lane)) builder.line([[x, 0, cutFrom], [x, 0, cutTo]], { onPaper: true, dashed: true });
    builder.pause(0.1);
    scissors(builder);
    const summary = fractionSummary(lane);
    if (summary) builder.label(summary, [0, 0, labelZ], { size: labelSize, align: 'left' });
  }

  figure.rebuild(draw);
  return {
    kind, group: figure.group, figure,
    update(next, nextBpm) {
      if (disposed) return;
      const tempoChanged = nextBpm !== undefined && nextBpm !== bpm;
      events = next;
      if (nextBpm !== undefined) bpm = nextBpm;
      if (kind === 'scissors' || kind === 'bar' || (kind === 'tempo' && tempoChanged)) figure.rebuild(draw);
    },
    setLift: t => figure.setLift(t),
    setReveal: t => figure.setReveal(t),
    setResolution: (width, height) => figure.setResolution(width, height),
    stats: () => figure.stats(),
    dispose() { if (disposed) return; disposed = true; figure.dispose(); },
  };
}
