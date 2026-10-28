import type { SceneId } from '../content/types.ts';

/** G1 exposes two spreads. Add later spreads only after the objective G1 gate. */
export type SpreadId = 'spread-1' | 'spread-2';
export type PageId = 'page-1' | 'page-2' | 'page-3' | 'page-4';
export type NavigationDirection = 'next' | 'prev';
export type SpreadDefinition = Readonly<{
  spreadId: SpreadId;
  leftPageId: PageId;
  rightPageId: PageId;
  sceneId: SceneId;
}>;

export const BOOK_MANIFEST: readonly SpreadDefinition[] = Object.freeze([
  Object.freeze({ spreadId: 'spread-1', leftPageId: 'page-1', rightPageId: 'page-2', sceneId: 'scene-1' }),
  Object.freeze({ spreadId: 'spread-2', leftPageId: 'page-3', rightPageId: 'page-4', sceneId: 'scene-2' }),
]);
export const G1_MANIFEST = BOOK_MANIFEST;

export function spreadIndex(id: SpreadId): number {
  return BOOK_MANIFEST.findIndex((spread) => spread.spreadId === id);
}

export function spreadAt(index: number): SpreadDefinition | undefined {
  return Number.isInteger(index) ? BOOK_MANIFEST[index] : undefined;
}

export function adjacentSpread(id: SpreadId, direction: NavigationDirection): SpreadDefinition | undefined {
  const index = spreadIndex(id);
  return index < 0 ? undefined : spreadAt(index + (direction === 'next' ? 1 : -1));
}

export type TurningLeafSpec = Readonly<{
  leafId: string;
  direction: NavigationDirection;
  sourceSpreadId: SpreadId;
  destinationSpreadId: SpreadId;
  frontPageId: PageId;
  backPageId: PageId;
  stationaryLeftPageId: PageId;
  stationaryRightPageId: PageId;
}>;

/** A backward turn traverses the same physical leaf; it does not swap its printed faces. */
export function turningLeaf(from: SpreadId, to: SpreadId): TurningLeafSpec | null {
  const source = spreadIndex(from);
  const destination = spreadIndex(to);
  if (source < 0 || destination < 0 || Math.abs(source - destination) !== 1) return null;
  const lowerIndex = Math.min(source, destination);
  const lower = BOOK_MANIFEST[lowerIndex];
  const upper = BOOK_MANIFEST[lowerIndex + 1];
  return Object.freeze({
    leafId: `leaf-${lowerIndex + 1}`,
    direction: destination > source ? 'next' : 'prev',
    sourceSpreadId: from,
    destinationSpreadId: to,
    frontPageId: lower.rightPageId,
    backPageId: upper.leftPageId,
    stationaryLeftPageId: lower.leftPageId,
    stationaryRightPageId: upper.rightPageId,
  });
}
