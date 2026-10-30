import { durationLabel, getScene } from '../../content/lesson.ts';
import type { MusicEvent } from '../../content/types.ts';
import { sceneEvents, sceneState } from '../../lesson/controller.ts';
import { BOOK_DIMENSIONS } from '../geometry.ts';
import { lessonSceneOf, resolve } from './pageSpec.ts';
import type {
  HotspotCommand, InkTone, NotationBox, NotationMeasure, PageBlock, PageContext, PageSpec, ParagraphStyle, PrintIcon,
} from './pageSpec.ts';

/**
 * v3 R3 page layout (REFACTOR_DESIGN_V3 §6 R3 (2)). Pure: text measurement and notation
 * engraving are injected, so the same layout runs in tests without a canvas.
 * Coordinates are logical page units: width 1000, height PAGE_LOGICAL.height (A4-derived ratio).
 */
export const PAGE_LOGICAL = Object.freeze({ width: 1000, height: 1000 * BOOK_DIMENSIONS.pageHeight / BOOK_DIMENSIONS.pageWidth });
export const PRINT_COLORS = Object.freeze({ ink: '#252721', muted: '#5f6668', blue: '#436c7b', accent: '#b96335', rule: '#bdb6a5', faint: '#9aa0a0' });
export const PRINT_MARGINS = Object.freeze({ top: 84, bottom: 106, inner: 92, outer: 70 });

/** Book Sans = renamed Pretendard subset, Book Serif = renamed Noto Serif CJK KR subset (pageFonts.ts). */
export type FontSpec = Readonly<{ family: 'Book Sans' | 'Book Serif'; weight: 400 | 600 | 700; size: number; letterSpacing?: number }>;
type TypeToken = Readonly<{ family: FontSpec['family']; weight: FontSpec['weight']; size: number; lineHeight: number; letterSpacing?: number; tone: InkTone }>;
export const PRINT_TYPE: Readonly<Record<'runningHead' | 'h1' | 'h2' | 'h3' | ParagraphStyle | 'button' | 'cell' | 'folio', TypeToken>> = Object.freeze({
  runningHead: { family: 'Book Sans', weight: 600, size: 17, lineHeight: 1.3, letterSpacing: 1.6, tone: 'muted' },
  h1: { family: 'Book Serif', weight: 700, size: 50, lineHeight: 1.22, tone: 'ink' },
  h2: { family: 'Book Serif', weight: 700, size: 35, lineHeight: 1.25, tone: 'ink' },
  h3: { family: 'Book Sans', weight: 600, size: 25, lineHeight: 1.35, tone: 'ink' },
  lead: { family: 'Book Sans', weight: 400, size: 30, lineHeight: 1.45, tone: 'ink' },
  body: { family: 'Book Sans', weight: 400, size: 26, lineHeight: 1.5, tone: 'ink' },
  caption: { family: 'Book Sans', weight: 400, size: 23, lineHeight: 1.45, tone: 'muted' },
  meta: { family: 'Book Sans', weight: 600, size: 21, lineHeight: 1.4, letterSpacing: 0.6, tone: 'muted' },
  note: { family: 'Book Sans', weight: 400, size: 22, lineHeight: 1.45, tone: 'muted' },
  button: { family: 'Book Sans', weight: 600, size: 24, lineHeight: 1.25, tone: 'ink' },
  cell: { family: 'Book Sans', weight: 400, size: 21, lineHeight: 1.25, tone: 'ink' },
  folio: { family: 'Book Serif', weight: 700, size: 22, lineHeight: 1, tone: 'muted' },
});

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type TextLine = Readonly<{ text: string; x: number; baseline: number; font: FontSpec; color: string }>;
export type LaidOutItem =
  | Readonly<{ kind: 'text'; lines: readonly TextLine[] }>
  | Readonly<{ kind: 'rule'; x: number; y: number; w: number; color: string }>
  | Readonly<{ kind: 'button'; rect: Rect; label: readonly TextLine[]; icon?: PrintIcon; enabled: boolean; pressed?: boolean; hotspotId: string }>
  | Readonly<{ kind: 'radio'; rect: Rect; center: Readonly<{ x: number; y: number }>; radius: number; selected: boolean; enabled: boolean; label: readonly TextLine[]; hotspotId: string }>
  | Readonly<{ kind: 'checkbox'; rect: Rect; box: Rect; checked: boolean; enabled: boolean; label: readonly TextLine[]; hotspotId?: string }>
  | Readonly<{ kind: 'cell'; rect: Rect; number: TextLine; label: TextLine; rest: boolean; enabled: boolean; hotspotId: string }>
  | Readonly<{ kind: 'notation'; rect: Rect; laneId: string; key: string; events: readonly MusicEvent[] }>
  | Readonly<{ kind: 'figure'; rect: Rect; figureId: string }>
  | Readonly<{ kind: 'flapTab'; rect: Rect; label: readonly TextLine[]; open: boolean; hotspotId: string }>
  | Readonly<{ kind: 'flapPanel'; rect: Rect }>
  /** v3 R5: the closed paper flap printed over its (hidden) content. */
  | Readonly<{ kind: 'flapCover'; rect: Rect; hint: readonly TextLine[] }>
  | Readonly<{ kind: 'axis'; x: number; y: number; w: number; ticks: readonly TextLine[] }>
  | Readonly<{ kind: 'stampSlot'; rect: Rect; stamped: boolean; label: readonly TextLine[] }>
  /** v3 R8: one table-of-contents row; the dotted leader runs from the title to the folio. */
  | Readonly<{ kind: 'entry'; rect: Rect; number: TextLine; title: readonly TextLine[]; detail: readonly TextLine[]; folio: TextLine;
    leader: Readonly<{ x0: number; x1: number; y: number }> | null; done: boolean; enabled: boolean; hotspotId: string }>
  | Readonly<{ kind: 'overflow'; rect: Rect; label: readonly TextLine[] }>;

export type HotspotRole = 'button' | 'toggle' | 'radio' | 'note' | 'checkbox' | 'flap';
export type PageHotspot = Readonly<{
  id: string; rect: Rect; role: HotspotRole; label: string; enabled: boolean; command: HotspotCommand | null;
  pressed?: boolean; checked?: boolean; expanded?: boolean; group?: string; eventId?: string; laneId?: string; testId?: string;
  /** false: a pointer-only duplicate (printed staff note) whose keyboard equivalent is listed elsewhere in the mirror. */
  mirror?: boolean;
}>;
export type MirrorNode =
  | Readonly<{ kind: 'heading'; level: 1 | 2 | 3; text: string; focusTarget?: boolean }>
  | Readonly<{ kind: 'text'; text: string; live?: boolean; id?: string }>
  | Readonly<{ kind: 'control'; hotspotId: string }>
  /** `instrument` groups own arrow keys like the 2D page's data-book-instrument areas (EN02). */
  | Readonly<{ kind: 'group'; label: string; role: 'group' | 'radiogroup' | 'list'; children: readonly MirrorNode[]; instrument?: boolean }>
  | Readonly<{ kind: 'figure'; label: string }>;

export type NoteHighlightBox = NotationBox & Readonly<{ laneId: string; source: 'notation' | 'cell' }>;
/** v3 R5: a covered flap's paper rect (logical units, hinge on its top edge) for the 3D flap mesh. */
/** A covered flap: `hint` is printed on the closed sheet, `foldHint` on its back (seen while it stands open). */
export type FlapLayout = Readonly<{ id: string; hotspotId: string; rect: Rect; open: boolean; hint: string; foldHint: string }>;
/** v3 R5: stamps are drawn on the state layer (derived from saved answers, never a new field). */
export type StampLayout = Readonly<{ id: string; rect: Rect; stamped: boolean }>;
export type PageLayout = Readonly<{
  pageId: string;
  width: number;
  height: number;
  scale: number;
  overflow: number;
  items: readonly LaidOutItem[];
  hotspots: readonly PageHotspot[];
  figureRects: Readonly<Record<string, Rect>>;
  noteBoxes: readonly NoteHighlightBox[];
  mirror: readonly MirrorNode[];
  flaps: readonly FlapLayout[];
  stamps: readonly StampLayout[];
}>;

export type TextMeasurer = (text: string, font: FontSpec) => number;
export type NotationLayout = (events: readonly MusicEvent[], width: number, scale: number) => NotationMeasure;
export type LayoutServices = Readonly<{ measure: TextMeasurer; notation: NotationLayout }>;

const FIT_SCALES = [1, 0.95, 0.9, 0.85, 0.8] as const;
/** Printed in the bottom margin of every left page: the 3D page is a view; '크게 읽기' is the reading path (R3 x-height fallback). */
export const READING_HINT = '글씨가 작으면 ‘크게 읽기’로 펼쳐 보세요';
const isPlaying = (context: PageContext) => ['starting', 'playing', 'paused'].includes(context.playback.state);
const toneColor = (tone: InkTone) => tone === 'muted' ? PRINT_COLORS.muted : tone === 'accent' ? PRINT_COLORS.accent : tone === 'blue' ? PRINT_COLORS.blue : PRINT_COLORS.ink;

/** Korean keep-all: break between words; split a single over-long word by characters. */
export function wrapText(text: string, width: number, font: FontSpec, measure: TextMeasurer): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/(\s+)/).filter(part => part.length > 0);
    let line = '';
    const push = () => { if (line.trim()) lines.push(line.trim()); line = ''; };
    for (const word of words) {
      if (/^\s+$/.test(word)) { if (line) line += ' '; continue; }
      const candidate = line + word;
      if (measure(candidate.trim(), font) <= width) { line = candidate; continue; }
      if (line.trim()) push();
      if (measure(word, font) <= width) { line = word; continue; }
      for (const character of word) {
        if (measure((line + character).trim(), font) > width && line) push();
        line += character;
      }
    }
    push();
  }
  return lines.length ? lines : [''];
}

type Cursor = { y: number };
class Builder {
  readonly items: LaidOutItem[] = [];
  readonly hotspots: PageHotspot[] = [];
  readonly figureRects: Record<string, Rect> = {};
  readonly noteBoxes: NoteHighlightBox[] = [];
  readonly mirror: MirrorNode[] = [];
  readonly flaps: FlapLayout[] = [];
  readonly stamps: StampLayout[] = [];
  readonly spec: PageSpec;
  readonly context: PageContext;
  readonly services: LayoutServices;
  readonly s: number;
  // Explicit fields: Node's type stripping (tests) does not support parameter properties.
  constructor(spec: PageSpec, context: PageContext, services: LayoutServices, s: number) {
    this.spec = spec; this.context = context; this.services = services; this.s = s;
  }
  get left() { return this.spec.side === 'right' ? PRINT_MARGINS.inner : PRINT_MARGINS.outer; }
  get right() { return PAGE_LOGICAL.width - (this.spec.side === 'right' ? PRINT_MARGINS.outer : PRINT_MARGINS.inner); }
  get width() { return this.right - this.left; }
  font(token: TypeToken): FontSpec { return { family: token.family, weight: token.weight, size: token.size * this.s, letterSpacing: (token.letterSpacing ?? 0) * this.s }; }
  lineHeight(token: TypeToken) { return token.size * token.lineHeight * this.s; }
  gap(multiplier = 1) { return 20 * multiplier * this.s; }
  textBlock(cursor: Cursor, text: string, token: TypeToken, options: { x?: number; width?: number; color?: string } = {}): TextLine[] {
    const font = this.font(token);
    const x = options.x ?? this.left;
    const width = options.width ?? this.width;
    const lineHeight = this.lineHeight(token);
    const lines = wrapText(text, width, font, this.services.measure).map(line => {
      const baseline = cursor.y + lineHeight * 0.78;
      cursor.y += lineHeight;
      return { text: line, x, baseline, font, color: options.color ?? toneColor(token.tone) };
    });
    return lines;
  }
}

function hotspotId(pageId: string, ...parts: string[]) { return [pageId, ...parts].join(':'); }
/** Same rule as the 2D useSelection: switching lanes resets the selection, so only switch when needed. */
function selectCommand(context: PageContext, laneId: string, eventId: string): HotspotCommand {
  const lane = sceneState(context.lesson, lessonSceneOf(context)).activeLaneId === laneId;
  return { type: 'lesson', commands: lane ? [{ type: 'select', id: eventId }] : [{ type: 'selectLane', laneId }, { type: 'select', id: eventId }] };
}


function layoutBlocks(builder: Builder, blocks: readonly PageBlock[], cursor: Cursor, mirror: MirrorNode[]): void {
  const { context, services, spec } = builder;
  for (const block of blocks) {
    switch (block.kind) {
      case 'when':
        if (block.test(context)) layoutBlocks(builder, block.blocks, cursor, mirror);
        break;
      case 'heading': {
        const token = block.level === 1 ? PRINT_TYPE.h1 : block.level === 2 ? PRINT_TYPE.h2 : PRINT_TYPE.h3;
        const text = resolve(block.text, context);
        builder.items.push({ kind: 'text', lines: builder.textBlock(cursor, text, token) });
        cursor.y += builder.gap(block.level === 1 ? 0.7 : 0.45);
        mirror.push({ kind: 'heading', level: block.level, text, focusTarget: block.focusTarget });
        break;
      }
      case 'paragraph': {
        const style = block.style ?? 'body';
        const token = PRINT_TYPE[style];
        const text = resolve(block.text, context);
        if (!text) break;
        builder.items.push({ kind: 'text', lines: builder.textBlock(cursor, text, token, { color: block.tone ? toneColor(block.tone) : undefined }) });
        cursor.y += builder.gap(style === 'lead' ? 0.8 : 0.45);
        mirror.push({ kind: 'text', text, live: block.live, id: block.id });
        break;
      }
      case 'rule':
        cursor.y += builder.gap(0.3);
        builder.items.push({ kind: 'rule', x: builder.left, y: cursor.y, w: builder.width, color: PRINT_COLORS.rule });
        cursor.y += builder.gap(0.7);
        break;
      case 'spacer':
        cursor.y += builder.gap(block.size);
        break;
      case 'notation': {
        builder.items.push({ kind: 'text', lines: builder.textBlock(cursor, block.label, PRINT_TYPE.h3) });
        cursor.y += builder.gap(0.1);
        const events = sceneEvents(context.lesson, lessonSceneOf(context), block.laneId);
        const measured = services.notation(events, builder.width, builder.s);
        const rect = { x: builder.left, y: cursor.y, w: builder.width, h: measured.height };
        builder.items.push({ kind: 'notation', rect, laneId: block.laneId, key: measured.key, events });
        for (const box of measured.boxes) {
          const absolute = { eventId: box.eventId, x: rect.x + box.x, y: rect.y + box.y, w: box.w, h: box.h };
          builder.noteBoxes.push({ ...absolute, laneId: block.laneId, source: 'notation' });
        }
        cursor.y += measured.height + builder.gap(0.35);
        mirror.push({ kind: 'text', text: `${block.label} 악보: ${events.length ? events.map((event, index) => `${index + 1}번째 ${durationLabel(event.duration, event.kind)}`).join(', ') : '아직 음표나 쉼표가 없는 빈 마디'}` });
        for (const box of measured.boxes) {
          // Printed notes are pointer targets too (same command as the event list); the mirror lists them once.
          const event = events.find(item => item.id === box.eventId);
          if (!event) continue;
          const id = hotspotId(spec.pageId, 'staff', block.laneId, box.eventId);
          // Same rule as the 2D BookNotation onSelect: any printed note selects while playback is stopped.
          const enabled = context.interactive && !isPlaying(context);
          builder.hotspots.push({ id, rect: { x: rect.x + box.x, y: rect.y + box.y, w: box.w, h: box.h }, role: 'note', label: durationLabel(event.duration, event.kind),
            enabled, eventId: box.eventId, laneId: block.laneId, command: selectCommand(context, block.laneId, box.eventId), mirror: false });
        }
        break;
      }
      case 'figure': {
        const height = block.height * PAGE_LOGICAL.height;
        const rect = { x: builder.left, y: cursor.y, w: builder.width, h: height };
        builder.items.push({ kind: 'figure', rect, figureId: block.figureId });
        builder.figureRects[block.figureId] = rect;
        cursor.y += height + builder.gap(0.5);
        mirror.push({ kind: 'figure', label: block.label });
        break;
      }
      case 'buttons': {
        const group: MirrorNode[] = [];
        layoutButtons(builder, block, cursor, group);
        mirror.push({ kind: 'group', label: block.label, role: 'group', children: group, instrument: block.id !== 'listen' });
        cursor.y += builder.gap(0.55);
        break;
      }
      case 'question': {
        const question = getScene(lessonSceneOf(context)).questions.find(item => item.id === block.questionId);
        if (!question) break;
        const answer = sceneState(context.lesson, lessonSceneOf(context)).answers[question.id];
        builder.items.push({ kind: 'text', lines: builder.textBlock(cursor, question.prompt, PRINT_TYPE.body) });
        cursor.y += builder.gap(0.15);
        const group: MirrorNode[] = [];
        const rowHeight = 46 * builder.s;
        const radius = 10.5 * builder.s;
        for (const option of question.options) {
          const id = hotspotId(spec.pageId, 'q', question.id, option.value);
          const font = builder.font(PRINT_TYPE.body);
          const labelX = builder.left + radius * 2 + 16 * builder.s;
          const labelWidth = builder.width - (labelX - builder.left);
          const wrapped = wrapText(option.label, labelWidth, font, services.measure);
          const height = Math.max(rowHeight, wrapped.length * builder.lineHeight(PRINT_TYPE.body));
          const rect = { x: builder.left, y: cursor.y, w: builder.width, h: height };
          const label = wrapped.map((text, index) => ({ text, x: labelX, baseline: cursor.y + (height - wrapped.length * builder.lineHeight(PRINT_TYPE.body)) / 2 + builder.lineHeight(PRINT_TYPE.body) * (index + 0.78), font, color: PRINT_COLORS.ink }));
          const selected = answer === option.value;
          // Same rule as the 2D fieldset: answers wait until playback stops.
          const enabled = context.interactive && !isPlaying(context);
          builder.items.push({ kind: 'radio', rect, center: { x: builder.left + radius + 2, y: cursor.y + height / 2 }, radius, selected, enabled, label, hotspotId: id });
          builder.hotspots.push({ id, rect, role: 'radio', label: option.label, enabled, checked: selected, group: question.id,
            command: { type: 'lesson', commands: [{ type: 'answer', questionId: question.id, value: option.value }] } });
          group.push({ kind: 'control', hotspotId: id });
          cursor.y += height + 4 * builder.s;
        }
        mirror.push({ kind: 'group', label: question.prompt, role: 'radiogroup', children: group });
        cursor.y += builder.gap(0.5);
        break;
      }
      case 'eventList': {
        const events = sceneEvents(context.lesson, lessonSceneOf(context), block.laneId);
        if (!events.length) break;
        const columns = 4;
        const gap = 8 * builder.s;
        const cellWidth = (builder.width - gap * (columns - 1)) / columns;
        const cellHeight = 48 * builder.s;
        const font = builder.font(PRINT_TYPE.cell);
        const numberFont = { ...builder.font(PRINT_TYPE.folio), size: 19 * builder.s };
        const group: MirrorNode[] = [];
        const playing = isPlaying(context);
        events.forEach((event, index) => {
          const column = index % columns, row = Math.floor(index / columns);
          const rect = { x: builder.left + column * (cellWidth + gap), y: cursor.y + row * (cellHeight + gap), w: cellWidth, h: cellHeight };
          const id = hotspotId(spec.pageId, 'note', block.laneId, event.id);
          const name = durationLabel(event.duration, event.kind);
          builder.items.push({ kind: 'cell', rect, rest: event.kind === 'rest', enabled: context.interactive && !playing, hotspotId: id,
            number: { text: String(index + 1), x: rect.x + 12 * builder.s, baseline: rect.y + cellHeight * 0.66, font: numberFont, color: PRINT_COLORS.muted },
            label: { text: name, x: rect.x + 40 * builder.s, baseline: rect.y + cellHeight * 0.66, font, color: PRINT_COLORS.ink } });
          builder.noteBoxes.push({ eventId: event.id, x: rect.x, y: rect.y, w: rect.w, h: rect.h, laneId: block.laneId, source: 'cell' });
          builder.hotspots.push({ id, rect, role: 'note', label: `${index + 1}번째 ${name}, 온음표의 ${event.duration.n}/${event.duration.d}, 시작 ${event.onset.n}/${event.onset.d}`,
            enabled: context.interactive && !playing, eventId: event.id, laneId: block.laneId,
            pressed: sceneState(context.lesson, lessonSceneOf(context)).activeLaneId === block.laneId && sceneState(context.lesson, lessonSceneOf(context)).selectedEventId === event.id,
            command: selectCommand(context, block.laneId, event.id) });
          group.push({ kind: 'control', hotspotId: id });
        });
        cursor.y += Math.ceil(events.length / columns) * (cellHeight + gap) + builder.gap(0.35);
        mirror.push({ kind: 'group', label: '음표 선택 목록', role: 'list', children: group, instrument: true });
        break;
      }
      case 'checklist': {
        const items = resolve(block.items, context);
        const size = 20 * builder.s;
        const font = builder.font(PRINT_TYPE.body);
        const texts: string[] = [];
        for (const item of items) {
          const labelX = builder.left + size + 14 * builder.s;
          const local = { y: cursor.y };
          const lines = builder.textBlock(local, item.label, PRINT_TYPE.body, { x: labelX, width: builder.width - size - 14 * builder.s });
          const height = local.y - cursor.y;
          const box = { x: builder.left, y: cursor.y + (builder.lineHeight(PRINT_TYPE.body) - size) / 2, w: size, h: size };
          builder.items.push({ kind: 'checkbox', rect: { x: builder.left, y: cursor.y, w: builder.width, h: height }, box, checked: item.done, enabled: false, label: lines.map(line => ({ ...line, font })) });
          texts.push(`${item.label}: ${item.done ? '충족' : '아직'}`);
          cursor.y += height + 2 * builder.s;
        }
        cursor.y += builder.gap(0.4);
        mirror.push({ kind: 'text', text: `${block.label}. ${texts.join('. ')}` });
        break;
      }
      case 'checkbox': {
        const size = 24 * builder.s;
        const id = hotspotId(spec.pageId, 'check', block.id);
        const labelX = builder.left + size + 14 * builder.s;
        const local = { y: cursor.y + 6 * builder.s };
        const lines = builder.textBlock(local, block.label, PRINT_TYPE.body, { x: labelX, width: builder.width - size - 14 * builder.s });
        const height = Math.max(46 * builder.s, local.y - cursor.y + 6 * builder.s);
        const rect = { x: builder.left, y: cursor.y, w: builder.width, h: height };
        const checked = resolve(block.checked, context);
        const enabled = context.interactive && (block.enabled === undefined ? true : resolve(block.enabled, context));
        builder.items.push({ kind: 'checkbox', rect, box: { x: builder.left, y: cursor.y + (height - size) / 2, w: size, h: size }, checked, enabled, label: lines, hotspotId: id });
        builder.hotspots.push({ id, rect, role: 'checkbox', label: block.label, enabled, checked, command: resolve(block.command, context) });
        mirror.push({ kind: 'control', hotspotId: id });
        cursor.y += height + builder.gap(0.4);
        break;
      }
      case 'flap': {
        const key = resolve(block.hintKey, context);
        const open = context.hints[key] === 1;
        const id = hotspotId(spec.pageId, 'flap', block.id);
        const height = 48 * builder.s;
        const rect = { x: builder.left, y: cursor.y, w: builder.width, h: height };
        const font = builder.font(PRINT_TYPE.button);
        const label = [{ text: `${block.label}${open ? '  · 접기' : '  · 펼치기'}`, x: builder.left + 44 * builder.s, baseline: cursor.y + height * 0.66, font, color: PRINT_COLORS.ink }];
        builder.items.push({ kind: 'flapTab', rect, label, open, hotspotId: id });
        builder.hotspots.push({ id, rect, role: 'flap', label: block.label, enabled: context.interactive, expanded: open, command: { type: 'flap', key } });
        cursor.y += height + builder.gap(0.3);
        const children: MirrorNode[] = [{ kind: 'control', hotspotId: id }];
        if (block.cover) {
          // The content's space is always reserved; closed, only the paper flap over it is printed.
          const top = cursor.y;
          cursor.y += builder.gap(0.4);
          const before = { items: builder.items.length, hotspots: builder.hotspots.length, noteBoxes: builder.noteBoxes.length };
          const inner: MirrorNode[] = [];
          layoutBlocks(builder, block.blocks, cursor, inner);
          cursor.y += builder.gap(0.2);
          const cover = { x: builder.left, y: top - builder.gap(0.15), w: builder.width, h: cursor.y - top + builder.gap(0.15) };
          if (open) {
            builder.items.splice(before.items, 0, { kind: 'flapPanel', rect: cover });
            children.push(...inner);
          } else {
            builder.items.length = before.items; builder.hotspots.length = before.hotspots; builder.noteBoxes.length = before.noteBoxes;
            const hintFont = builder.font(PRINT_TYPE.caption);
            const hint = block.coverHint ?? `${block.label} · 종이를 들어 올려 보세요`;
            const hintWidth = services.measure(hint, hintFont);
            builder.items.push({ kind: 'flapCover', rect: cover, hint: [{ text: hint, x: cover.x + (cover.w - hintWidth) / 2,
              baseline: cover.y + cover.h / 2 + PRINT_TYPE.caption.size * builder.s * 0.35, font: hintFont, color: PRINT_COLORS.muted }] });
            // The paper flap itself lifts too (a pointer duplicate of the tab, which the mirror lists).
            builder.hotspots.push({ id: `${id}:paper`, rect: cover, role: 'flap', label: block.label, enabled: context.interactive, expanded: false,
              command: { type: 'flap', key }, mirror: false });
          }
          builder.flaps.push({ id: block.id, hotspotId: id, rect: cover, open, hint: block.coverHint ?? `${block.label} · 종이를 들어 올려 보세요`,
            foldHint: block.foldHint ?? `${block.label} · 눌러서 다시 덮어요` });
          cursor.y += builder.gap(0.4);
        } else if (open) {
          const top = cursor.y;
          cursor.y += builder.gap(0.4);
          const inner: MirrorNode[] = [];
          layoutBlocks(builder, block.blocks, cursor, inner);
          builder.items.push({ kind: 'flapPanel', rect: { x: builder.left, y: top - builder.gap(0.3), w: builder.width, h: cursor.y - top + builder.gap(0.3) } });
          children.push(...inner);
          cursor.y += builder.gap(0.4);
        }
        mirror.push({ kind: 'group', label: block.label, role: 'group', children });
        break;
      }
      case 'secondsAxis': {
        const ticks = resolve(block.ticks, context);
        const font = builder.font(PRINT_TYPE.caption);
        const y = cursor.y + 8 * builder.s;
        const labels = ticks.map((text, index) => {
          const x = builder.left + builder.width * index / Math.max(1, ticks.length - 1);
          const width = services.measure(text, font);
          const anchor = index === 0 ? x : index === ticks.length - 1 ? x - width : x - width / 2;
          return { text, x: anchor, baseline: y + 36 * builder.s, font, color: PRINT_COLORS.blue };
        });
        builder.items.push({ kind: 'axis', x: builder.left, y, w: builder.width, ticks: labels });
        cursor.y += 52 * builder.s + builder.gap(0.4);
        mirror.push({ kind: 'text', text: resolve(block.label, context) });
        break;
      }
      case 'contents': {
        const group: MirrorNode[] = [];
        layoutContents(builder, block, cursor, group);
        mirror.push({ kind: 'group', label: block.label, role: 'list', children: group });
        cursor.y += builder.gap(0.4);
        break;
      }
      case 'stampSlot': {
        const stamped = resolve(block.stamped, context);
        const size = 96 * builder.s;
        const rect = { x: builder.right - size, y: cursor.y, w: size, h: size };
        const font = builder.font(PRINT_TYPE.meta);
        builder.items.push({ kind: 'stampSlot', rect, stamped, label: [{ text: block.label, x: rect.x, baseline: rect.y + size + 22 * builder.s, font, color: PRINT_COLORS.muted }] });
        builder.stamps.push({ id: block.id, rect, stamped });
        cursor.y += size + 30 * builder.s;
        if (stamped) mirror.push({ kind: 'text', text: `${block.label} 확인 도장이 찍혔어요.` });
        break;
      }
    }
  }
}

function layoutButtons(builder: Builder, block: Extract<PageBlock, { kind: 'buttons' }>, cursor: Cursor, mirror: MirrorNode[]): void {
  const { context, services, spec } = builder;
  const font = builder.font(PRINT_TYPE.button);
  const height = (block.compact ? 50 : 56) * builder.s;
  const padding = 16 * builder.s;
  const iconSize = 22 * builder.s;
  const gap = 10 * builder.s;
  const entries = block.buttons.map(button => {
    const label = resolve(button.label, context);
    const command = resolve(button.command, context);
    const enabled = context.interactive && !!command && (button.enabled === undefined ? true : resolve(button.enabled, context));
    const pressed = button.pressed === undefined ? undefined : resolve(button.pressed, context);
    const natural = services.measure(label, font) + padding * 2 + (button.icon ? iconSize + 8 * builder.s : 0);
    return { button, label, command, enabled, pressed, natural };
  });
  const columns = block.columns;
  let x = builder.left;
  let rowTop = cursor.y;
  let rowHeight = height;
  entries.forEach((entry, index) => {
    let width = columns ? (builder.width - gap * (columns - 1)) / columns : Math.min(builder.width, entry.natural);
    if (columns && index % columns === 0 && index > 0) { rowTop += rowHeight + gap; x = builder.left; rowHeight = height; }
    if (!columns && x > builder.left && x + width > builder.right + 0.5) { rowTop += rowHeight + gap; x = builder.left; rowHeight = height; }
    if (!columns) width = Math.min(width, builder.right - x);
    const textX = x + padding + (entry.button.icon ? iconSize + 8 * builder.s : 0);
    const textWidth = width - (textX - x) - padding;
    const wrapped = wrapText(entry.label, textWidth, font, services.measure);
    const lineHeight = builder.lineHeight(PRINT_TYPE.button);
    const buttonHeight = Math.max(height, wrapped.length * lineHeight + 14 * builder.s);
    rowHeight = Math.max(rowHeight, buttonHeight);
    const rect = { x, y: rowTop, w: width, h: buttonHeight };
    const id = hotspotId(spec.pageId, block.id, entry.button.id);
    const top = rowTop + (buttonHeight - wrapped.length * lineHeight) / 2;
    const label = wrapped.map((text, line) => ({ text, x: textX, baseline: top + lineHeight * (line + 0.8), font, color: PRINT_COLORS.ink }));
    builder.items.push({ kind: 'button', rect, label, icon: entry.button.icon, enabled: entry.enabled, pressed: entry.pressed, hotspotId: id });
    builder.hotspots.push({ id, rect, role: entry.pressed === undefined ? 'button' : 'toggle', label: entry.button.ariaLabel ? resolve(entry.button.ariaLabel, context) : entry.label,
      enabled: entry.enabled, pressed: entry.pressed, command: entry.command, testId: entry.button.testId ? resolve(entry.button.testId, context) : undefined });
    mirror.push({ kind: 'control', hotspotId: id });
    x += width + gap;
  });
  cursor.y = rowTop + rowHeight;
}

/** v3 R8: contents rows — number, title and a detail line, the folio at the right after a dotted leader. */
function layoutContents(builder: Builder, block: Extract<PageBlock, { kind: 'contents' }>, cursor: Cursor, mirror: MirrorNode[]): void {
  const { context, services, spec } = builder;
  // Large enough to pick a lesson on the 3D page at the reading pose (titles in the h2 serif).
  const titleFont = builder.font(PRINT_TYPE.h2);
  const numberFont = builder.font(PRINT_TYPE.h1);
  const folioFont = builder.font(PRINT_TYPE.button);
  const pad = 16 * builder.s;
  const numberWidth = 74 * builder.s;
  const minHeight = 104 * builder.s;
  for (const entry of block.entries) {
    const id = hotspotId(spec.pageId, block.id, entry.id);
    const done = entry.done === undefined ? false : resolve(entry.done, context);
    const enabled = context.interactive;
    const top = cursor.y;
    const folioWidth = services.measure(entry.folio, folioFont);
    const textX = builder.left + numberWidth;
    const titleWidth = builder.right - pad - folioWidth - 24 * builder.s - textX;
    const local = { y: top + pad };
    const title = builder.textBlock(local, entry.title, PRINT_TYPE.h2, { x: textX, width: titleWidth });
    local.y += 4 * builder.s;
    const detail = entry.detail ? builder.textBlock(local, entry.detail, PRINT_TYPE.caption, { x: textX, width: builder.right - pad - textX }) : [];
    const height = Math.max(minHeight, local.y - top + pad);
    const rect = { x: builder.left, y: top, w: builder.width, h: height };
    const first = title[0]!;
    const number = { text: entry.number, x: builder.left + 6 * builder.s, baseline: first.baseline + 2 * builder.s, font: numberFont, color: PRINT_COLORS.blue };
    const folio = { text: entry.folio, x: builder.right - pad - folioWidth, baseline: first.baseline, font: folioFont, color: PRINT_COLORS.ink };
    const titleEnd = textX + services.measure(first.text, titleFont) + 12 * builder.s;
    const leaderEnd = folio.x - 12 * builder.s;
    builder.items.push({ kind: 'entry', rect, number, title, detail, folio, done, enabled, hotspotId: id,
      leader: entry.folio && leaderEnd - titleEnd > 24 * builder.s ? { x0: titleEnd, x1: leaderEnd, y: first.baseline - 4 * builder.s } : null });
    const label = [entry.number, entry.title].filter(Boolean).join(' ') + (entry.folio ? `, ${entry.folio}` : '') + (done ? ', 완료' : '');
    builder.hotspots.push({ id, rect, role: 'button', label, enabled, command: entry.command, testId: entry.testId });
    mirror.push({ kind: 'control', hotspotId: id });
    cursor.y = top + height + 6 * builder.s;
  }
}

function layoutAt(spec: PageSpec, context: PageContext, services: LayoutServices, s: number): Builder & { bottom: number } {
  const builder = new Builder(spec, context, services, s);
  const cursor = { y: PRINT_MARGINS.top };
  // Running head and folio sit in the margins and do not scale.
  const headFont = { family: PRINT_TYPE.runningHead.family, weight: PRINT_TYPE.runningHead.weight, size: PRINT_TYPE.runningHead.size, letterSpacing: PRINT_TYPE.runningHead.letterSpacing } as FontSpec;
  const headX = spec.side === 'right' ? builder.right - services.measure(spec.runningHead, headFont) : builder.left;
  builder.items.push({ kind: 'text', lines: [{ text: spec.runningHead, x: headX, baseline: PRINT_MARGINS.top - 30, font: headFont, color: PRINT_COLORS.muted }] });
  layoutBlocks(builder, spec.blocks, cursor, builder.mirror);
  const folioFont = { family: PRINT_TYPE.folio.family, weight: PRINT_TYPE.folio.weight, size: PRINT_TYPE.folio.size } as FontSpec;
  const folioBaseline = PAGE_LOGICAL.height - PRINT_MARGINS.bottom / 2 + 8;
  // v3 R8: the contents and closing are unnumbered matter.
  if (spec.folio !== null) {
    const folio = String(spec.folio);
    const folioX = spec.side === 'right' ? builder.right - services.measure(folio, folioFont) : builder.left;
    builder.items.push({ kind: 'text', lines: [{ text: folio, x: folioX, baseline: folioBaseline, font: folioFont, color: PRINT_COLORS.muted }] });
  }
  if (spec.side === 'left') {
    const hintFont = { family: PRINT_TYPE.meta.family, weight: PRINT_TYPE.meta.weight, size: PRINT_TYPE.meta.size, letterSpacing: PRINT_TYPE.meta.letterSpacing } as FontSpec;
    builder.items.push({ kind: 'text', lines: [{ text: READING_HINT, x: builder.right - services.measure(READING_HINT, hintFont), baseline: folioBaseline, font: hintFont, color: PRINT_COLORS.blue }] });
  }
  return Object.assign(builder, { bottom: cursor.y });
}

/** Lay out a page at the largest typographic scale that fits; report any remaining overflow. */
export function layoutPage(spec: PageSpec, context: PageContext, services: LayoutServices): PageLayout {
  const limit = PAGE_LOGICAL.height - PRINT_MARGINS.bottom;
  let result = layoutAt(spec, context, services, FIT_SCALES[0]);
  for (const scale of FIT_SCALES.slice(1)) {
    if (result.bottom <= limit) break;
    result = layoutAt(spec, context, services, scale);
  }
  const overflow = Math.max(0, result.bottom - limit);
  const items = [...result.items];
  if (overflow > 0) {
    const font = { family: 'Book Sans', weight: 600, size: PRINT_TYPE.note.size } as FontSpec;
    items.push({ kind: 'overflow', rect: { x: result.left, y: limit + 4, w: result.width, h: 30 },
      label: [{ text: '이어지는 내용은 아래 ‘크게 읽기’에서 볼 수 있어요.', x: result.left, baseline: limit + 26, font, color: PRINT_COLORS.accent }] });
  }
  return { pageId: spec.pageId, width: PAGE_LOGICAL.width, height: PAGE_LOGICAL.height, scale: result.s, overflow,
    items, hotspots: result.hotspots, figureRects: result.figureRects, noteBoxes: result.noteBoxes, mirror: result.mirror,
    flaps: result.flaps, stamps: result.stamps };
}

/** Topmost enabled-or-disabled hotspot containing the page-local point (logical units). */
export function hitTest(layout: PageLayout, x: number, y: number): PageHotspot | null {
  for (let index = layout.hotspots.length - 1; index >= 0; index -= 1) {
    const hotspot = layout.hotspots[index]!;
    const { rect } = hotspot;
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return hotspot;
  }
  return null;
}
