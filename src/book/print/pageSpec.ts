import type { LessonCommand, LessonState } from '../../lesson/controller.ts';
import type { MusicEvent, SceneId } from '../../content/types.ts';
import type { PageId, SpreadId } from '../manifest.ts';

/**
 * v3 R3 printed page DSL (REFACTOR_DESIGN_V3 §6 R3 (1), CONTRACT_V3 C3).
 * A page is printed ink on paper; its controls are printed hotspots. Every value that depends on
 * the learner's music is computed from the same LessonState revision as sound and assessment.
 */
export type PagePlaybackState = 'locked' | 'ready' | 'starting' | 'playing' | 'paused' | 'stopped' | 'error' | 'unavailable';
export type PagePlayback = Readonly<{ state: PagePlaybackState; laneId: string | null; activeEventId: string | null; error: string | null }>;
/** `shotId`: the lesson shot the camera is in (v3 R6), so its printed button reads as the way back. */
export type PageUiState = Readonly<{ composeKind: 'note' | 'rest'; shotId?: string | null }>;
export type PageContext = Readonly<{
  lesson: LessonState;
  sceneId: SceneId;
  playback: PagePlayback;
  hints: Readonly<Record<string, number>>;
  ui: PageUiState;
  /** False while the book cannot accept learning input (turning, entering, hidden). */
  interactive: boolean;
}>;
export type Dynamic<T> = T | ((context: PageContext) => T);

export type HotspotCommand =
  | Readonly<{ type: 'lesson'; commands: readonly LessonCommand[] }>
  | Readonly<{ type: 'play'; laneId: string }>
  | Readonly<{ type: 'pause' }>
  | Readonly<{ type: 'resume' }>
  | Readonly<{ type: 'stop' }>
  | Readonly<{ type: 'flap'; key: string }>
  | Readonly<{ type: 'ui'; patch: Partial<PageUiState> }>
  | Readonly<{ type: 'shot'; shotId: string }>
  | Readonly<{ type: 'goto'; spreadId: SpreadId }>;

export type PrintIcon = 'play' | 'pause' | 'stop' | 'split' | 'merge' | 'undo' | 'redo' | 'look' | 'add' | 'remove' | 'toggle' | 'check';

export type PrintedButton = Readonly<{
  id: string;
  label: Dynamic<string>;
  icon?: PrintIcon;
  command: Dynamic<HotspotCommand | null>;
  enabled?: Dynamic<boolean>;
  /** Toggle buttons (task A/B/C, tempo, note/rest) print their pressed state. */
  pressed?: Dynamic<boolean | undefined>;
  ariaLabel?: Dynamic<string>;
  testId?: Dynamic<string>;
}>;

export type ParagraphStyle = 'lead' | 'body' | 'caption' | 'meta' | 'note';
export type InkTone = 'ink' | 'muted' | 'accent' | 'blue';

export type PageBlock =
  | Readonly<{ kind: 'heading'; text: Dynamic<string>; level: 1 | 2 | 3; focusTarget?: boolean }>
  | Readonly<{ kind: 'paragraph'; text: Dynamic<string>; style?: ParagraphStyle; tone?: InkTone; live?: boolean; id?: string }>
  | Readonly<{ kind: 'rule' }>
  | Readonly<{ kind: 'spacer'; size: number }>
  | Readonly<{ kind: 'notation'; laneId: string; label: string }>
  | Readonly<{ kind: 'figure'; figureId: string; height: number; label: string }>
  | Readonly<{ kind: 'buttons'; id: string; label: string; buttons: readonly PrintedButton[]; columns?: number; compact?: boolean }>
  | Readonly<{ kind: 'question'; questionId: string }>
  | Readonly<{ kind: 'eventList'; laneId: string }>
  | Readonly<{ kind: 'checklist'; id: string; label: string; items: Dynamic<readonly Readonly<{ label: string; done: boolean }>[]> }>
  | Readonly<{ kind: 'checkbox'; id: string; label: string; checked: Dynamic<boolean>; command: Dynamic<HotspotCommand>; enabled?: Dynamic<boolean> }>
  /**
   * A flap. `cover` (v3 R5): a paper flap lies over its content — the space is always reserved, the
   * print shows the closed flap or the content, and the 3D book lifts a flap mesh on its top hinge.
   */
  | Readonly<{ kind: 'flap'; id: string; hintKey: Dynamic<string>; label: string; blocks: readonly PageBlock[]; cover?: boolean; coverHint?: string; foldHint?: string }>
  | Readonly<{ kind: 'secondsAxis'; ticks: Dynamic<readonly string[]>; label: Dynamic<string> }>
  | Readonly<{ kind: 'when'; test: (context: PageContext) => boolean; blocks: readonly PageBlock[] }>
  | Readonly<{ kind: 'stampSlot'; id: string; label: string; stamped: Dynamic<boolean> }>;

export type PageSpec = Readonly<{
  pageId: PageId;
  side: 'left' | 'right';
  runningHead: string;
  folio: number;
  blocks: readonly PageBlock[];
}>;

/** Notation boxes in logical page units, provided by the VexFlow raster (or a test stub). */
export type NotationBox = Readonly<{ eventId: string; x: number; y: number; w: number; h: number }>;
export type NotationMeasure = Readonly<{ height: number; boxes: readonly NotationBox[]; key: string }>;
export type NotationMeasurer = (events: readonly MusicEvent[], width: number) => NotationMeasure;

export function resolve<T>(value: Dynamic<T>, context: PageContext): T {
  return typeof value === 'function' ? (value as (context: PageContext) => T)(context) : value;
}
