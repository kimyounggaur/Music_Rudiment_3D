import { bookCanInteract } from './controller.ts';
import type { BookState } from './controller.ts';
import { bookNeighbour } from './manifest.ts';
import type { NavigationDirection } from './manifest.ts';
import type { StageLayout, StagePoint, StageQuad } from './stage.ts';
import { applyHomography, homographyFromUnitSquare, quadUv } from './render/homography.ts';

export const TURN_HIT_SIZE = 44;
export type TurnCorner = 'top' | 'bottom';
export type TurnCornerHit = Readonly<{ direction: NavigationDirection; corner: TurnCorner }>;
export type TurnAvailability = Readonly<Record<NavigationDirection, boolean>>;

const edge = (a: StagePoint, b: StagePoint) => Math.hypot(b.x - a.x, b.y - a.y);

/** A projected page is a general convex quad under the perspective camera (affine is the special case). */
function pageMap(quad: StageQuad) {
  return homographyFromUnitSquare(quad);
}

/**
 * A 44 CSS pixel corner, wholly inside the visible paper. Under perspective the page edges have
 * different screen lengths, so each corner uses the lengths of the two edges that meet there.
 */
export function turnCornerRegion(quad: StageQuad, direction: NavigationDirection, corner: TurnCorner): StageQuad | null {
  const map = pageMap(quad);
  if (!map) return null;
  const horizontal = corner === 'bottom' ? edge(quad.bl, quad.br) : edge(quad.tl, quad.tr);
  const vertical = direction === 'next' ? edge(quad.tr, quad.br) : edge(quad.tl, quad.bl);
  if (!(horizontal > 1e-6) || !(vertical > 1e-6)) return null;
  const du = Math.min(1, TURN_HIT_SIZE / horizontal), dv = Math.min(1, TURN_HIT_SIZE / vertical);
  const u0 = direction === 'next' ? 1 - du : 0, u1 = direction === 'next' ? 1 : du;
  const v0 = corner === 'bottom' ? 1 - dv : 0, v1 = corner === 'bottom' ? 1 : dv;
  const point = (u: number, v: number) => applyHomography(map, u, v);
  return { tl: point(u0, v0), tr: point(u1, v0), bl: point(u0, v1), br: point(u1, v1) };
}

export function turnInputAvailability({ book, layout, stageReady, printsReady, textureCount, requiredTextureCount = 4, preparedScene, pointerOwned = false }: {
  book: BookState; layout: StageLayout | null; stageReady: boolean; printsReady: boolean;
  textureCount: number; requiredTextureCount?: number; preparedScene: string; pointerOwned?: boolean;
}): TurnAvailability {
  const ready = !pointerOwned && book.mode === '3d' && !!layout && stageReady && printsReady
    && (requiredTextureCount === 4 || requiredTextureCount === 6) && textureCount === requiredTextureCount
    && bookCanInteract(book) && preparedScene === `${book.bookEpoch}:${book.sceneInstanceId}:${book.currentSpreadId}`;
  return {
    // v3 R8: neighbours in book order (contents ↔ lesson 1, lesson 6 ↔ closing are leaves too).
    next: ready && !!bookNeighbour(book.currentSpreadId, 'next', book.spreadCount) && !!pageMap(layout!.right),
    prev: ready && !!bookNeighbour(book.currentSpreadId, 'prev', book.spreadCount) && !!pageMap(layout!.left),
  };
}

export function turnCornerAtPoint(layout: StageLayout | null, point: StagePoint, available: TurnAvailability): TurnCornerHit | null {
  if (!layout || ![point.x, point.y].every(Number.isFinite)) return null;
  for (const direction of ['next', 'prev'] as const) {
    if (!available[direction]) continue;
    for (const corner of ['top', 'bottom'] as const) {
      const quad = turnCornerRegion(direction === 'next' ? layout.right : layout.left, direction, corner);
      const uv = quad && quadUv(quad, point);
      if (!uv) continue;
      const tolerance = 1e-6;
      if (uv.x >= -tolerance && uv.x <= 1 + tolerance && uv.y >= -tolerance && uv.y <= 1 + tolerance) return { direction, corner };
    }
  }
  return null;
}

type PointerTarget = Readonly<{
  tagName?: string; isContentEditable?: boolean; parentElement?: unknown;
  getAttribute?: (name: string) => string | null;
  classList?: { contains(name: string): boolean };
}>;
const controlTags = new Set(['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'LABEL', 'SUMMARY', 'DIALOG']);
const controlRoles = new Set(['button', 'link', 'slider', 'spinbutton', 'textbox', 'combobox', 'checkbox', 'radio',
  'radiogroup', 'listbox', 'menu', 'menubar', 'grid', 'tree', 'tablist', 'dialog', 'alertdialog', 'application']);

/** Run on the original target/path before capture. No transparent hit overlay may steal controls. */
export function turnTargetOwnsInput(target: unknown): boolean {
  const seen = new Set<unknown>();
  for (let node = target; node !== null && typeof node === 'object' && !seen.has(node);) {
    seen.add(node);
    const element = node as PointerTarget;
    const attr = (name: string) => element.getAttribute?.(name) ?? null;
    if (controlTags.has(element.tagName?.toUpperCase() ?? '') || element.isContentEditable) return true;
    const editable = attr('contenteditable');
    if (editable !== null && editable.toLowerCase() !== 'false') return true;
    if ((attr('role') ?? '').toLowerCase().split(/\s+/).some(role => controlRoles.has(role))) return true;
    if (attr('data-book-instrument') !== null || attr('data-instrument') !== null || attr('data-event-select') !== null) return true;
    if (element.classList?.contains('book-popup-window') || element.classList?.contains('book-progress-tools')) return true;
    // v3 R5: the toolbar and the records dialog own their presses (never a page drag).
    if (element.classList?.contains('book-toolbar') || element.classList?.contains('book-records')) return true;
    node = element.parentElement;
  }
  return false;
}

export function pointOnScrollbar(point: StagePoint, metrics: {
  rect: { left: number; top: number; width: number; height: number };
  offsetWidth: number; offsetHeight: number; clientWidth: number; clientHeight: number; clientLeft: number; clientTop: number;
}): boolean {
  const { rect, offsetWidth, offsetHeight, clientWidth, clientHeight, clientLeft, clientTop } = metrics;
  if (offsetWidth <= 0 || offsetHeight <= 0 || rect.width <= 0 || rect.height <= 0) return false;
  const x = (point.x - rect.left) * offsetWidth / rect.width;
  const y = (point.y - rect.top) * offsetHeight / rect.height;
  return x >= 0 && x <= offsetWidth && y >= 0 && y <= offsetHeight
    && (x < clientLeft || x >= clientLeft + clientWidth || y < clientTop || y >= clientTop + clientHeight);
}
