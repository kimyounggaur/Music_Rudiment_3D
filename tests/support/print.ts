import { createLessonState, reduceLesson, sceneEvents } from '../../src/lesson/controller.ts';
import type { LessonState } from '../../src/lesson/controller.ts';
import type { MusicEvent, SceneId } from '../../src/content/types.ts';
import { BOOK_SPREADS } from '../../src/book/manifest.ts';
import type { PageId } from '../../src/book/manifest.ts';
import type { FontSpec, LayoutServices } from '../../src/book/print/pageLayout.ts';
import type { Canvas2D } from '../../src/book/print/pagePainter.ts';
import type { PageContext, PagePlayback } from '../../src/book/print/pageSpec.ts';

/** Shared Node stubs for the v3 R3 print tests (no canvas, no fonts). */
/** Book Sans (Pretendard) -like advance widths: Hangul ≈ 0.92 em, Latin/digits ≈ 0.56 em, space ≈ 0.26 em. */
export const stubMeasure = (text: string, font: FontSpec) => [...text].reduce((total, character) => total
  + font.size * (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/.test(character) ? 0.92 : character === ' ' ? 0.26 : 0.56), 0)
  + (font.letterSpacing ?? 0) * Math.max(0, [...text].length - 1);
const notation = (events: readonly MusicEvent[], width: number, scale: number) => ({
  height: 160 * scale, key: `staff:${events.map(event => event.id).join(',')}:${width}:${scale}`,
  boxes: events.map((event, index) => ({ eventId: event.id, x: 130 + index * (width - 160) / Math.max(1, events.length), y: 12, w: 26, h: 90 })),
});
export const stubServices: LayoutServices = { measure: stubMeasure, notation };
export const READY: PagePlayback = { state: 'ready', laneId: null, activeEventId: null, error: null };
/** The lesson scene of a page; null on the contents and closing (v3 R8). */
export const sceneFor = (pageId: PageId): SceneId | null => BOOK_SPREADS.find(spread => spread.leftPageId === pageId || spread.rightPageId === pageId)!.sceneId;
export function contextFor(pageId: PageId, lesson: LessonState = createLessonState(), extra: Partial<PageContext> = {}): PageContext {
  return { lesson, sceneId: sceneFor(pageId), playback: READY, hints: {}, ui: { composeKind: 'note' }, interactive: true, ...extra };
}

/** Scene 2 split down to sixteen 1/16 notes: the densest event list the book can print. */
export function sixteenSixteenths(): LessonState {
  let lesson = reduceLesson(createLessonState(), { type: 'navigate', sceneId: 'scene-2' });
  for (let guard = 0; guard < 40; guard += 1) {
    const target = sceneEvents(lesson, 'scene-2').find(event => event.duration.d < 16);
    if (!target) break;
    lesson = reduceLesson(reduceLesson(lesson, { type: 'select', id: target.id }), { type: 'split' });
  }
  return lesson;
}

type Call = Readonly<{ name: string; args: readonly unknown[]; fillStyle: unknown }>;
/** A canvas 2D context that records calls (no pixels in Node). */
export function recordingContext(width: number, height: number): { context: Canvas2D; calls: Call[] } {
  const calls: Call[] = [];
  const state = { fillStyle: '#000' as unknown, strokeStyle: '#000' as unknown };
  const target: Record<string, unknown> = { canvas: { width, height }, lineWidth: 1, font: '', textAlign: 'start', textBaseline: 'alphabetic', lineCap: 'butt', lineJoin: 'miter', letterSpacing: '0px' };
  const context = new Proxy(target, {
    get(object, key: string) {
      if (key === 'fillStyle') return state.fillStyle;
      if (key === 'strokeStyle') return state.strokeStyle;
      if (key in object) return object[key];
      return (...args: unknown[]) => { calls.push({ name: key, args, fillStyle: state.fillStyle }); };
    },
    set(object, key: string, value) {
      if (key === 'fillStyle') state.fillStyle = value;
      else if (key === 'strokeStyle') state.strokeStyle = value;
      else object[key] = value;
      return true;
    },
  }) as unknown as Canvas2D;
  return { context, calls };
}

