/**
 * The music-to-space meaning shared by the ink figures (v3 R4 C6): x = onset × 10, width = length ×
 * 10, fixed block height and depth. v3 R9 removed the v1 three.js world and 2D scene that used to
 * live beside this file; their event type and labels moved here unchanged.
 */
export type DurationEvent = Readonly<{
  id: string;
  kind: 'note' | 'rest';
  onset: Readonly<{ n: number; d: number }>;
  duration: Readonly<{ n: number; d: number }>;
  pitch?: Readonly<{ step: string; alter: number; octave: number }>;
  notation: Readonly<{ type: string; dots?: number }>;
}>;

export const BAR_WIDTH = 10;
export const BLOCK_HEIGHT = 0.38;
export const BLOCK_DEPTH = 0.9;

export function clampedPosition(position: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(position) ? position : 0));
}

export function durationBounds(event: DurationEvent) {
  const onset = event.onset.n / event.onset.d;
  const duration = event.duration.n / event.duration.d;
  if (!Number.isFinite(onset) || !Number.isFinite(duration) || onset < 0 || duration <= 0) {
    throw new RangeError('3D 시간 좌표에 유효한 시작점과 양의 길이가 필요합니다.');
  }
  return { x: onset * BAR_WIDTH, width: duration * BAR_WIDTH, height: BLOCK_HEIGHT, depth: BLOCK_DEPTH };
}

export const durationNames: Record<string, string> = {
  whole: '온', half: '2분', quarter: '4분', eighth: '8분', sixteenth: '16분',
};

/** The spoken name of an event: '4분음표, 온음표의 1/4'. */
export function eventLabel(event: DurationEvent): string {
  const name = durationNames[event.notation.type] ?? event.notation.type;
  const fraction = `${event.duration.n}/${event.duration.d}`;
  return `${name}${event.kind === 'rest' ? '쉼표' : '음표'}, 온음표의 ${fraction}`;
}
