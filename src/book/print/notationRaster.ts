import type { MusicEvent } from '../../content/types.ts';
import { validateEvents } from '../../content/validation.ts';
import type { NotationMeasure } from './pageSpec.ts';
import type { Canvas2D, NotationPainter } from './pagePainter.ts';
import type { Rect } from './pageLayout.ts';

/**
 * v3 R3 notation raster (REFACTOR_DESIGN_V3 §6 R3 (4)). The same VexFlow engraving rules as the
 * 2D BookNotation (treble, 4/4, quarter beam groups, whole-rest centring), drawn straight into the
 * page canvas with VexFlow's CanvasContext. Highlights belong to the state layer, not the print.
 */
type VexModule = typeof import('vexflow/core');
type Engraved = {
  key: string;
  scale: number;
  height: number;
  draw(context: Canvas2D): void;
  boxes: { eventId: string; x: number; y: number; w: number; h: number }[];
};

const DURATIONS = { whole: 'w', half: 'h', quarter: 'q', eighth: '8', sixteenth: '16' } as const;
/** VexFlow units per logical page unit at scale 1; a staff space is 10 VexFlow px. */
export const NOTATION_SCALE = 1.62;
const DRAW_HEIGHT = 112;
const STAVE_Y = -6;

export function notationKey(events: readonly MusicEvent[], width: number, scale: number): string {
  return JSON.stringify([width.toFixed(2), scale.toFixed(3), events.map(event => [event.id, event.kind, event.duration.n, event.duration.d,
    event.kind === 'note' ? `${event.pitch.step}${event.pitch.alter}${event.pitch.octave}` : 'r'])]);
}

export interface NotationEngraver extends NotationPainter {
  measure(events: readonly MusicEvent[], width: number, scale: number): NotationMeasure;
  clear(): void;
}

export function createNotationEngraver(module: VexModule, ink = '#252721'): NotationEngraver {
  const cache = new Map<string, Engraved>();
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = 8; measureCanvas.height = 8;

  function engrave(events: readonly MusicEvent[], width: number, scale: number): Engraved {
    const key = notationKey(events, width, scale);
    const cached = cache.get(key);
    if (cached) { cache.delete(key); cache.set(key, cached); return cached; }
    const validation = validateEvents(events);
    if (!validation.valid) throw new Error('음악 데이터가 유효하지 않아 악보를 인쇄하지 못했습니다.');
    if (events.some(event => (event.notation.dots ?? 0) !== 0 || event.notation.tuplet || !(event.notation.type in DURATIONS))) {
      throw new Error('이 페이지는 무부점 온음표부터 16분음표까지 인쇄합니다.');
    }
    const { Accidental, Beam, CanvasContext, Formatter, Fraction, Stave, StaveNote, Voice } = module;
    const measureContext = new CanvasContext(measureCanvas.getContext('2d')!);
    const base = NOTATION_SCALE * scale;
    const available = width / base;
    const stave = new Stave(8, STAVE_Y, available - 16).addClef('treble').addTimeSignature('4/4');
    stave.setContext(measureContext);
    const notes = events.map((event, index) => {
      const accidental = event.kind === 'note' ? ({ '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' } as Record<string, string>)[String(event.pitch.alter)] : '';
      if (accidental === undefined) throw new Error('지원하지 않는 변화표입니다.');
      const key = event.kind === 'rest' ? event.notation.type === 'whole' ? 'd/5' : 'b/4' : `${event.pitch.step.toLowerCase()}${accidental}/${event.pitch.octave}`;
      const note = new StaveNote({ clef: 'treble', keys: [key], duration: `${DURATIONS[event.notation.type as keyof typeof DURATIONS]}${event.kind === 'rest' ? 'r' : ''}`,
        autoStem: true, alignCenter: event.kind === 'rest' && event.notation.type === 'whole' && events.length === 1 });
      note.setAttribute('id', `print-note-${index}`);
      note.setStave(stave);
      return note;
    });
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT).addTickables(notes);
    Accidental.applyAccidentals([voice], 'C');
    const beams = Beam.generateBeams(notes, { groups: [new Fraction(1, 4)], beamRests: false });
    const formatter = new Formatter().joinVoices([voice]);
    const minimum = notes.length ? formatter.preCalculateMinTotalWidth([voice]) : 0;
    // A crowded bar shrinks to the page width instead of scrolling (a print cannot scroll).
    const natural = Math.max(available, Math.ceil(stave.getNoteStartX() + minimum + 28));
    const effective = base * available / natural;
    stave.setWidth(natural - 16);
    if (notes.length) formatter.formatToStave([voice], stave);
    // VexFlow places note heads (and settles beamed stems) only while drawing, so bounding boxes
    // read before a draw start at the stave origin. Draw once into the tiny measuring canvas first.
    stave.draw();
    if (notes.length) {
      voice.draw(measureContext, stave);
      beams.forEach(beam => beam.setContext(measureContext).draw());
    }
    const boxes = notes.map((note, index) => {
      const box = note.getBoundingBox();
      return { eventId: events[index]!.id, x: (box.getX() - 4) * effective, y: (box.getY() - 4) * effective,
        w: Math.max(box.getW() + 8, 20) * effective, h: Math.max(box.getH() + 8, 22) * effective };
    });
    const engraved: Engraved = {
      key, scale: effective, height: DRAW_HEIGHT * effective, boxes,
      draw(context) {
        const vex = new CanvasContext(context as CanvasRenderingContext2D);
        vex.setFillStyle(ink);
        vex.setStrokeStyle(ink);
        stave.setContext(vex).draw();
        if (notes.length) {
          voice.draw(vex, stave);
          beams.forEach(beam => beam.setContext(vex).draw());
        }
      },
    };
    cache.set(key, engraved);
    while (cache.size > 48) cache.delete(cache.keys().next().value!);
    return engraved;
  }

  return {
    measure(events, width, scale) {
      const engraved = engrave(events, width, scale);
      return { height: engraved.height, key: engraved.key, boxes: engraved.boxes };
    },
    draw(context: Canvas2D, key: string, rect: Rect, k: number) {
      const engraved = cache.get(key);
      if (!engraved) return;
      context.save();
      // Logical → canvas pixels (k), then VexFlow px → logical (effective scale), as the 2D viewBox 0..112.
      context.translate(rect.x * k, rect.y * k);
      context.scale(engraved.scale * k, engraved.scale * k);
      engraved.draw(context);
      context.restore();
    },
    clear() { cache.clear(); },
  };
}
