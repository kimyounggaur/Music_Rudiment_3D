import { BOOK_MOTION, smoothStep } from '../motion.ts';

/**
 * v3 R4 figure choreography (REFACTOR_DESIGN_V3 §6 R4 (6)). First entry: the pen draws the figure
 * flat on the paper (reveal, 520 ms) while it starts to stand 120 ms in (lift, 600 ms). A revisit
 * keeps the drawing and only stands it up (lift over `revisit`). Exits and drags only lay the figure
 * down (lift 1 → 0); the pen never rewinds. Reduced motion cuts straight to the end state.
 */
export const FIGURE_ENTRY_MS = Math.max(BOOK_MOTION.reveal, BOOK_MOTION.liftDelay + BOOK_MOTION.lift);

export type FigureFrame = Readonly<{ lift: number; reveal: number }>;

/** The first-entry state `ms` after the scene starts entering. */
export function figureEntryFrame(ms: number): FigureFrame {
  const time = Number.isFinite(ms) ? ms : 0;
  return { reveal: smoothStep(time / BOOK_MOTION.reveal), lift: smoothStep((time - BOOK_MOTION.liftDelay) / BOOK_MOTION.lift) };
}

/** tween() eases its value with smoothStep; recover the linear time so each channel keeps its own timing. */
export function inverseSmoothStep(value: number): number {
  const target = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  if (target === 0 || target === 1) return target;
  let low = 0, high = 1;
  for (let step = 0; step < 32; step += 1) {
    const middle = (low + high) / 2;
    if (smoothStep(middle) < target) low = middle; else high = middle;
  }
  return (low + high) / 2;
}
