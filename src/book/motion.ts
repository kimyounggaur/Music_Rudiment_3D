/**
 * Authoring proposals, not measured Every Joule timings. v3 R4 adds the ink figure tokens (design
 * appendix D): pen reveal, paper→standing lift with its delay, the stagger between figures and the
 * split/merge stroke; R5 adds the paper flap's lift. Existing values are unchanged.
 */
export const BOOK_MOTION = Object.freeze({ intro: 1100, cover: 1000, turn: 1120, enter: 600, revisit: 200, exit: 180, settle: 100,
  reveal: 520, lift: 600, liftDelay: 120, stagger: 45, splitMerge: 240, flap: 240 });
export function smoothStep(value: number): number {
  const p = Math.max(0, Math.min(1, value));
  return p * p * p * (p * (p * 6 - 15) + 10);
}

/** One cancellable motion owner. Cancelling never invokes completion. */
export function tween(from: number, to: number, duration: number, update: (value: number) => void, complete: () => void): () => void {
  let frame = 0;
  let cancelled = false;
  const start = performance.now();
  if (duration <= 0 || from === to) {
    update(to);
    queueMicrotask(() => { if (!cancelled) complete(); });
  } else {
    const tick = (now: number) => {
      if (cancelled) return;
      const p = Math.min(1, (now - start) / duration);
      update(from + (to - from) * smoothStep(p));
      if (p === 1) complete(); else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }
  return () => { cancelled = true; cancelAnimationFrame(frame); };
}
