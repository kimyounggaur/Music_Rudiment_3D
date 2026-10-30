import type { NavigationDirection } from './manifest.ts';
import type { StageLayout } from './stage.ts';

export const BOOK_NAVIGATION_TARGET = 44;

/** Keep the complete bookmark target inside the viewport without moving the paper. */
export function navigationButtonPosition(layout: StageLayout, direction: NavigationDirection): { left: number; top: number } {
  const page = direction === 'next' ? layout.right : layout.left;
  const desiredLeft = direction === 'next' ? page.tr.x : page.tl.x - BOOK_NAVIGATION_TARGET;
  const desiredTop = (page.tl.y + page.bl.y) / 2;
  const clamp = (value: number, extent: number) => Math.max(0, Math.min(value, Math.max(0, extent - BOOK_NAVIGATION_TARGET)));
  return { left: clamp(desiredLeft, layout.width), top: clamp(desiredTop, layout.height) };
}
