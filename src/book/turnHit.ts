import { bookCanInteract } from './controller.ts';
import type { BookState } from './controller.ts';
import { adjacentSpread } from './manifest.ts';
import type { NavigationDirection } from './manifest.ts';
import type { StageLayout, StagePoint, StageQuad } from './stage.ts';

export const TURN_HIT_SIZE = 44;
export type TurnCorner = 'top' | 'bottom';
export type TurnCornerHit = Readonly<{ direction: NavigationDirection; corner: TurnCorner }>;
export type TurnAvailability = Readonly<Record<NavigationDirection, boolean>>;

function pageBasis(quad: StageQuad) {
  const x = { x: quad.tr.x - quad.tl.x, y: quad.tr.y - quad.tl.y };
  const y = { x: quad.bl.x - quad.tl.x, y: quad.bl.y - quad.tl.y };
  const width = Math.hypot(x.x, x.y), height = Math.hypot(y.x, y.y);
  const determinant = x.x * y.y - x.y * y.x;
  const error = Math.hypot(quad.tl.x + x.x + y.x - quad.br.x, quad.tl.y + x.y + y.y - quad.br.y);
  if (![...Object.values(quad).flatMap(p => [p.x, p.y]), width, height].every(Number.isFinite)
    || width < 1e-6 || height < 1e-6 || Math.abs(determinant) < 1e-6 || error > 0.5) return null;
  return { x, y, width, height, determinant };
}

/** A page-local 44 CSS pixel corner, wholly inside the visible paper. */
export function turnCornerRegion(quad: StageQuad, direction: NavigationDirection, corner: TurnCorner): StageQuad | null {
  const basis = pageBasis(quad);
  if (!basis) return null;
  const du = Math.min(1, TURN_HIT_SIZE / basis.width), dv = Math.min(1, TURN_HIT_SIZE / basis.height);
  const u0 = direction === 'next' ? 1 - du : 0, u1 = direction === 'next' ? 1 : du;
  const v0 = corner === 'bottom' ? 1 - dv : 0, v1 = corner === 'bottom' ? 1 : dv;
  const point = (u: number, v: number) => ({ x: quad.tl.x + u * basis.x.x + v * basis.y.x,
    y: quad.tl.y + u * basis.x.y + v * basis.y.y });
  return { tl: point(u0, v0), tr: point(u1, v0), bl: point(u0, v1), br: point(u1, v1) };
}

export function turnInputAvailability({ book, layout, stageReady, printsReady, textureCount, preparedScene, pointerOwned = false }: {
  book: BookState; layout: StageLayout | null; stageReady: boolean; printsReady: boolean;
  textureCount: number; preparedScene: string; pointerOwned?: boolean;
}): TurnAvailability {
  const ready = !pointerOwned && book.mode === '3d' && !!layout && stageReady && printsReady && textureCount === 4
    && bookCanInteract(book) && preparedScene === `${book.bookEpoch}:${book.sceneInstanceId}:${book.currentSpreadId}`;
  return {
    next: ready && !!adjacentSpread(book.currentSpreadId, 'next') && !!pageBasis(layout!.right),
    prev: ready && !!adjacentSpread(book.currentSpreadId, 'prev') && !!pageBasis(layout!.left),
  };
}

export function turnCornerAtPoint(layout: StageLayout | null, point: StagePoint, available: TurnAvailability): TurnCornerHit | null {
  if (!layout || ![point.x, point.y].every(Number.isFinite)) return null;
  for (const direction of ['next', 'prev'] as const) {
    if (!available[direction]) continue;
    for (const corner of ['top', 'bottom'] as const) {
      const quad = turnCornerRegion(direction === 'next' ? layout.right : layout.left, direction, corner);
      const basis = quad && pageBasis(quad);
      if (!quad || !basis) continue;
      const dx = point.x - quad.tl.x, dy = point.y - quad.tl.y;
      const u = (dx * basis.y.y - dy * basis.y.x) / basis.determinant;
      const v = (dy * basis.x.x - dx * basis.x.y) / basis.determinant;
      if (u >= -1e-9 && u <= 1 + 1e-9 && v >= -1e-9 && v <= 1 + 1e-9) return { direction, corner };
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
