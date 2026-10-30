import type { NavigationDirection } from './manifest.ts';
import type { StageLayout } from './stage.ts';

export const BOOK_NAVIGATION_TARGET = 44;

/** Keep the complete bookmark target inside the viewport without moving the paper. */
export function navigationButtonPosition(layout: StageLayout, direction: NavigationDirection): { left: number; top: number } {
  const page = direction === 'next' ? layout.right : layout.left;
  // Perspective pages are trapezoids: attach to the midpoint of the outer edge.
  const outer = direction === 'next' ? { x: (page.tr.x + page.br.x) / 2, y: (page.tr.y + page.br.y) / 2 }
    : { x: (page.tl.x + page.bl.x) / 2, y: (page.tl.y + page.bl.y) / 2 };
  const desiredLeft = direction === 'next' ? outer.x : outer.x - BOOK_NAVIGATION_TARGET;
  const desiredTop = outer.y;
  const clamp = (value: number, extent: number) => Math.max(0, Math.min(value, Math.max(0, extent - BOOK_NAVIGATION_TARGET)));
  return { left: clamp(desiredLeft, layout.width), top: clamp(desiredTop, layout.height) };
}
