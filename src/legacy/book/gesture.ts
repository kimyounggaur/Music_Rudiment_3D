import type { NavigationDirection } from './manifest.ts';

/** Proposed V05 interaction tokens, in CSS pixels and milliseconds. */
export const TURN_DRAG_TOKENS = Object.freeze({
  activationPx: 8,
  horizontalDominance: 1.3,
  commitProgress: 0.5,
  flickProgress: 0.12,
  flickVelocity: 0.5,
  velocityMaxAgeMs: 100,
});

export type TurnDragSample = Readonly<{ clientX: number; clientY: number; time: number }>;
export type TurnDragState = Readonly<{
  initial: TurnDragSample;
  sample: TurnDragSample;
  direction: NavigationDirection;
  pageWidth: number;
  progress: number;
  activated: boolean;
  /** Positive means toward the requested destination; negative means reversing. */
  directionalVelocity: number;
  lastMotionTime: number;
}>;

const finiteSample = (sample: TurnDragSample) => [sample.clientX, sample.clientY, sample.time].every(Number.isFinite);
const inwardSign = (direction: NavigationDirection) => direction === 'next' ? -1 : 1;

export function createTurnDrag(initial: TurnDragSample, direction: NavigationDirection, pageWidth: number): TurnDragState {
  if (!finiteSample(initial) || !Number.isFinite(pageWidth) || pageWidth <= 0) {
    throw new RangeError('A drag requires a finite sample and a positive projected page width.');
  }
  return {
    initial: { ...initial }, sample: { ...initial }, direction, pageWidth,
    progress: 0, activated: false, directionalVelocity: 0, lastMotionTime: initial.time,
  };
}

/** No easing or clock advancement: holding the same point preserves the same pose. */
export function updateTurnDrag(state: TurnDragState, sample: TurnDragSample): TurnDragState {
  if (!finiteSample(sample) || sample.time < state.sample.time) return state;
  const dx = sample.clientX - state.initial.clientX;
  const dy = sample.clientY - state.initial.clientY;
  const movement = (sample.clientX - state.sample.clientX) * inwardSign(state.direction);
  const elapsed = sample.time - state.sample.time;
  const moved = movement !== 0;
  // A pointerup often repeats the last coordinate. Retain only a recent moving
  // segment, so a short flick survives pointerup but a held page has no momentum.
  const directionalVelocity = moved
    ? elapsed > 0 && elapsed <= TURN_DRAG_TOKENS.velocityMaxAgeMs ? movement / elapsed : 0
    : sample.time - state.lastMotionTime <= TURN_DRAG_TOKENS.velocityMaxAgeMs ? state.directionalVelocity : 0;
  return {
    ...state,
    sample: { ...sample },
    progress: Math.max(0, Math.min(1, dx * inwardSign(state.direction) / (2 * state.pageWidth))),
    activated: state.activated || (Math.abs(dx) >= TURN_DRAG_TOKENS.activationPx
      && Math.abs(dx) > Math.abs(dy) * TURN_DRAG_TOKENS.horizontalDominance),
    directionalVelocity,
    lastMotionTime: moved ? sample.time : state.lastMotionTime,
  };
}

export function turnReleaseDecision(state: TurnDragState, releaseTime = state.sample.time): 'commit' | 'cancel' {
  if (!state.activated || !Number.isFinite(releaseTime) || releaseTime < state.sample.time) return 'cancel';
  const recentVelocity = releaseTime - state.lastMotionTime <= TURN_DRAG_TOKENS.velocityMaxAgeMs
    ? state.directionalVelocity : 0;
  return state.progress >= TURN_DRAG_TOKENS.commitProgress
    || (state.progress > TURN_DRAG_TOKENS.flickProgress && recentVelocity >= TURN_DRAG_TOKENS.flickVelocity)
    ? 'commit' : 'cancel';
}

export type ArrowKeyInput = Readonly<{
  key: string;
  defaultPrevented?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: unknown;
  composedPath?: () => unknown[];
}>;

type KeyTarget = Readonly<{
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  parentElement?: unknown;
}>;

const arrowOwningTags = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'DIALOG']);
const arrowOwningRoles = new Set(['slider', 'dialog', 'alertdialog', 'radiogroup', 'radio', 'spinbutton',
  'textbox', 'combobox', 'listbox', 'menu', 'menubar', 'grid', 'tree', 'tablist', 'application']);

function ownsArrowKeys(target: unknown): boolean {
  const visited = new Set<unknown>();
  for (let node = target; node !== null && typeof node === 'object' && !visited.has(node);) {
    visited.add(node);
    const element = node as KeyTarget;
    const attr = (name: string) => typeof element.getAttribute === 'function' ? element.getAttribute(name) : null;
    if (arrowOwningTags.has(element.tagName?.toUpperCase() ?? '') || element.isContentEditable) return true;
    const editable = attr('contenteditable');
    if (editable !== null && editable.toLowerCase() !== 'false') return true;
    if ((attr('role') ?? '').toLowerCase().split(/\s+/).some(role => arrowOwningRoles.has(role))) return true;
    if (attr('data-book-instrument') !== null || attr('data-instrument') !== null) return true;
    node = element.parentElement;
  }
  return false;
}

/** The caller still owns book focus/context, modal state, and preventDefault. */
export function arrowNavigationDirection(event: ArrowKeyInput): NavigationDirection | null {
  if (event.defaultPrevented || event.repeat || event.isComposing
    || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return null;
  if (ownsArrowKeys(event.target) || event.composedPath?.().some(ownsArrowKeys)) return null;
  return event.key === 'ArrowRight' ? 'next' : 'prev';
}
