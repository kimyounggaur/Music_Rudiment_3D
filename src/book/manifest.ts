import type { SceneId } from '../content/types.ts';

/** Stable IDs also used by the already-versioned six-scene progress schema. */
export type LessonSpreadId = 'spread-1' | 'spread-2' | 'spread-3' | 'spread-4' | 'spread-5' | 'spread-6';
/** v3 R8: the physical book adds a contents spread before the lessons and a closing spread after them. */
export type SpreadId = 'contents' | LessonSpreadId | 'closing';
/** v3 R8: page IDs generalised (lessons keep page-1…page-12; contents page-13/14, closing page-15/16). */
export type PageId = `page-${number}`;
export type NavigationDirection = 'next' | 'prev';
export type SpreadDefinition = Readonly<{
  spreadId: LessonSpreadId;
  leftPageId: PageId;
  rightPageId: PageId;
  sceneId: SceneId;
}>;
/** Front and back matter: printed pages without a lesson scene. */
export type MatterDefinition = Readonly<{ spreadId: 'contents' | 'closing'; leftPageId: PageId; rightPageId: PageId; sceneId: null }>;
export type BookSpread = SpreadDefinition | MatterDefinition;

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

// --- v3 R8: the physical book (REFACTOR_DESIGN_V3 §6 R8). The lesson-only helpers above keep their
// contract (the G1 and V13 fixtures and their tests); the controller and the stage use the book order.
export const CONTENTS_SPREAD: MatterDefinition = Object.freeze({ spreadId: 'contents', leftPageId: 'page-13', rightPageId: 'page-14', sceneId: null });
export const CLOSING_SPREAD: MatterDefinition = Object.freeze({ spreadId: 'closing', leftPageId: 'page-15', rightPageId: 'page-16', sceneId: null });
export const BOOK_SPREADS: readonly BookSpread[] = Object.freeze([CONTENTS_SPREAD, ...BOOK_MANIFEST, CLOSING_SPREAD]);
export const isLessonSpread = (id: SpreadId): id is LessonSpreadId => id.startsWith('spread-');

/** The spreads a book state shows: the whole curriculum with its contents and closing; a shorter fixture stays a lesson prefix. */
export function bookSpreads(spreadCount = BOOK_MANIFEST.length): readonly BookSpread[] {
  return spreadCount >= BOOK_MANIFEST.length ? BOOK_SPREADS : BOOK_MANIFEST.slice(0, Math.max(0, spreadCount));
}
export function bookIndex(id: SpreadId, spreadCount = BOOK_MANIFEST.length): number {
  return bookSpreads(spreadCount).findIndex(spread => spread.spreadId === id);
}
export function bookSpreadAt(index: number, spreadCount = BOOK_MANIFEST.length): BookSpread | undefined {
  const spreads = bookSpreads(spreadCount);
  return Number.isInteger(index) && index >= 0 && index < spreads.length ? spreads[index] : undefined;
}
export function bookNeighbour(id: SpreadId, direction: NavigationDirection, spreadCount = BOOK_MANIFEST.length): BookSpread | undefined {
  const index = bookIndex(id, spreadCount);
  return index < 0 ? undefined : bookSpreadAt(index + (direction === 'next' ? 1 : -1), spreadCount);
}
/** Any spread of the full book by ID. */
export function bookSpread(id: SpreadId): BookSpread {
  const spread = BOOK_SPREADS.find(item => item.spreadId === id);
  if (!spread) throw new RangeError(`Unknown book spread ${id}`);
  return spread;
}

/** The leaf between two neighbouring spreads of the book (the same physical leaf both ways). */
export function bookLeaf(from: SpreadId, to: SpreadId, spreadCount = BOOK_MANIFEST.length): TurningLeafSpec | null {
  const spreads = bookSpreads(spreadCount);
  const source = bookIndex(from, spreadCount), destination = bookIndex(to, spreadCount);
  if (source < 0 || destination < 0 || Math.abs(source - destination) !== 1) return null;
  const lowerIndex = Math.min(source, destination);
  const lower = spreads[lowerIndex]!, upper = spreads[lowerIndex + 1]!;
  return Object.freeze({
    leafId: `book-leaf-${lowerIndex + 1}`, direction: destination > source ? 'next' : 'prev', sourceSpreadId: from, destinationSpreadId: to,
    frontPageId: lower.rightPageId, backPageId: upper.leftPageId, stationaryLeftPageId: lower.leftPageId, stationaryRightPageId: upper.rightPageId,
  });
}
/** GO_TO: the leaves turned one after another on the way from `from` to `to` (empty when equal or unknown). */
export function bookLeaves(from: SpreadId, to: SpreadId, spreadCount = BOOK_MANIFEST.length): readonly TurningLeafSpec[] {
  const spreads = bookSpreads(spreadCount);
  const source = bookIndex(from, spreadCount), destination = bookIndex(to, spreadCount);
  if (source < 0 || destination < 0 || source === destination) return [];
  const step = destination > source ? 1 : -1;
  const leaves: TurningLeafSpec[] = [];
  for (let index = source; index !== destination; index += step) leaves.push(bookLeaf(spreads[index]!.spreadId, spreads[index + step]!.spreadId, spreadCount)!);
  return leaves;
}
/** Bounded GPU print window in book order: the committed spread plus its immediate neighbours. */
export function bookPrintIds(id: SpreadId, spreadCount = BOOK_MANIFEST.length): readonly PageId[] {
  const index = bookIndex(id, spreadCount);
  if (index < 0) throw new RangeError(`Unknown book spread ${id}`);
  return bookSpreads(spreadCount).slice(Math.max(0, index - 1), index + 2).flatMap(spread => [spread.leftPageId, spread.rightPageId]);
}
/** v3 R8 GO_TO timing: n leaves one after another, each min(turn, 1600 / n) ms, so the whole jump stays ≤ 1.6 s. */
export const GO_TO_MAX_MS = 1600;
export const goToLeafMs = (leaves: number, turnMs: number) => leaves <= 1 ? turnMs : Math.min(turnMs, GO_TO_MAX_MS / leaves);
/** Leaves leave the stack 45 ms apart (BOOK_MOTION.stagger) and at most three are in the air (the stage's leaf pool). */
export const GO_TO_STAGGER_MS = 45;
export const LEAF_POOL_SIZE = 3;
export type LeafSchedule = Readonly<{ leaves: number; leafMs: number; starts: readonly number[]; totalMs: number }>;
/**
 * When each leaf of a GO_TO starts: 45 ms after the one before it, and never before the leaf three
 * places ahead has landed (its pool slot is then free). Every leaf takes the same `leafMs`.
 */
export function goToSchedule(leaves: number, turnMs: number): LeafSchedule {
  const count = Math.max(0, Math.floor(leaves));
  const leafMs = goToLeafMs(count, turnMs);
  const starts: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const staggered = index === 0 ? 0 : starts[index - 1]! + GO_TO_STAGGER_MS;
    const slotFree = index >= LEAF_POOL_SIZE ? starts[index - LEAF_POOL_SIZE]! + leafMs : 0;
    starts.push(Math.max(staggered, slotFree));
  }
  return Object.freeze({ leaves: count, leafMs, starts: Object.freeze(starts), totalMs: count ? starts[count - 1]! + leafMs : 0 });
}
/** Each leaf's own progress (0 → 1) at the jump's overall progress; a single leaf is the turn itself. */
export function leafProgresses(schedule: LeafSchedule, progress: number): number[] {
  const overall = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  if (schedule.leaves <= 1) return schedule.leaves ? [overall] : [];
  const time = overall * schedule.totalMs;
  return schedule.starts.map(start => Math.min(1, Math.max(0, (time - start) / schedule.leafMs)));
}
export type GoToFrame = Readonly<{
  /** The pages lying on the two stacks under the leaves in the air. */
  staticLeftPageId: PageId;
  staticRightPageId: PageId;
  /** The leaf in each pool slot (leaf k uses slot k mod 3), or null when that slot is empty. */
  slots: readonly (Readonly<{ leaf: TurningLeafSpec; index: number; progress: number }> | null)[];
  started: number;
  landed: number;
}>;
/**
 * What a GO_TO shows at a set of leaf progresses: a leaf is in the air while 0 < p < 1. Forward, the
 * right stack shows the spread after the last leaf that left it and the left stack the spread after
 * the last leaf that landed; backward is the mirror image.
 */
export function goToFrame(from: SpreadId, to: SpreadId, progresses: readonly number[], spreadCount = BOOK_MANIFEST.length): GoToFrame | null {
  const leaves = bookLeaves(from, to, spreadCount);
  if (!leaves.length || progresses.length !== leaves.length) return null;
  const spreads = bookSpreads(spreadCount);
  const source = bookIndex(from, spreadCount);
  const step = leaves[0]!.direction === 'next' ? 1 : -1;
  const started = progresses.filter(value => value > 0).length;
  const landed = progresses.filter(value => value >= 1).length;
  const at = (count: number) => spreads[source + step * count]!;
  const slots: (Readonly<{ leaf: TurningLeafSpec; index: number; progress: number }> | null)[] = Array.from({ length: LEAF_POOL_SIZE }, () => null);
  progresses.forEach((value, index) => {
    if (value > 0 && value < 1) slots[index % LEAF_POOL_SIZE] = Object.freeze({ leaf: leaves[index]!, index, progress: value });
  });
  return Object.freeze({
    staticLeftPageId: at(step > 0 ? landed : started).leftPageId,
    staticRightPageId: at(step > 0 ? started : landed).rightPageId,
    slots: Object.freeze(slots), started, landed,
  });
}
/**
 * The print window while a GO_TO is under way (still six pages): the departure spread, the first
 * leaf's far face, the last leaf's near face and the destination. Leaves in between are plain paper
 * flying past. A neighbour turn keeps the ordinary window.
 */
export function bookTurnPrintIds(from: SpreadId, to: SpreadId | null, spreadCount = BOOK_MANIFEST.length): readonly PageId[] {
  const leaves = to ? bookLeaves(from, to, spreadCount) : [];
  if (leaves.length <= 1) return bookPrintIds(from, spreadCount);
  const forward = leaves[0]!.direction === 'next';
  const first = leaves[0]!, last = leaves[leaves.length - 1]!;
  const departure = bookSpread(from), destination = bookSpread(to!);
  const ids = [departure.leftPageId, departure.rightPageId, forward ? first.backPageId : first.frontPageId,
    forward ? last.frontPageId : last.backPageId, destination.leftPageId, destination.rightPageId];
  return [...new Set(ids)];
}

