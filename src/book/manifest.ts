import type { SceneId } from '../content/types.ts';

/** Stable IDs also used by the already-versioned six-scene progress schema. */
export type SpreadId = 'spread-1' | 'spread-2' | 'spread-3' | 'spread-4' | 'spread-5' | 'spread-6';
export type PageId = `page-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`;
export type NavigationDirection = 'next' | 'prev';
export type SpreadDefinition = Readonly<{
  spreadId: SpreadId;
  leftPageId: PageId;
  rightPageId: PageId;
  sceneId: SceneId;
}>;

/** Preserve the first-release fixture and its original boundary regression suite. */
export const G1_MANIFEST: readonly SpreadDefinition[] = Object.freeze([
  Object.freeze({ spreadId: 'spread-1', leftPageId: 'page-1', rightPageId: 'page-2', sceneId: 'scene-1' }),
  Object.freeze({ spreadId: 'spread-2', leftPageId: 'page-3', rightPageId: 'page-4', sceneId: 'scene-2' }),
]);
export const BOOK_MANIFEST: readonly SpreadDefinition[] = Object.freeze([
  ...G1_MANIFEST,
  Object.freeze({ spreadId: 'spread-3', leftPageId: 'page-5', rightPageId: 'page-6', sceneId: 'scene-3' }),
  Object.freeze({ spreadId: 'spread-4', leftPageId: 'page-7', rightPageId: 'page-8', sceneId: 'scene-4' }),
  Object.freeze({ spreadId: 'spread-5', leftPageId: 'page-9', rightPageId: 'page-10', sceneId: 'scene-5' }),
  Object.freeze({ spreadId: 'spread-6', leftPageId: 'page-11', rightPageId: 'page-12', sceneId: 'scene-6' }),
]);

export function spreadIndex(id: SpreadId, spreadCount = BOOK_MANIFEST.length): number {
  const index = BOOK_MANIFEST.findIndex((spread) => spread.spreadId === id);
  return index < spreadCount ? index : -1;
}

export function spreadAt(index: number, spreadCount = BOOK_MANIFEST.length): SpreadDefinition | undefined {
  return Number.isInteger(index) && index < spreadCount ? BOOK_MANIFEST[index] : undefined;
}

export function adjacentSpread(id: SpreadId, direction: NavigationDirection, spreadCount = BOOK_MANIFEST.length): SpreadDefinition | undefined {
  const index = spreadIndex(id, spreadCount);
  return index < 0 ? undefined : spreadAt(index + (direction === 'next' ? 1 : -1), spreadCount);
}

/** Bounded GPU print window: committed spread plus its immediate neighbours. */
export function pagePrintIds(id: SpreadId): readonly PageId[] {
  const index = spreadIndex(id);
  if (index < 0) throw new RangeError(`Unknown book spread ${id}`);
  return BOOK_MANIFEST.slice(Math.max(0, index - 1), index + 2).flatMap(spread => [spread.leftPageId, spread.rightPageId]);
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
export function turningLeaf(from: SpreadId, to: SpreadId, spreadCount = BOOK_MANIFEST.length): TurningLeafSpec | null {
  const source = spreadIndex(from, spreadCount);
  const destination = spreadIndex(to, spreadCount);
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
