import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MusicEvent } from '../content/types.ts';
import { validateEvents } from '../content/validation.ts';
import { eventLabel } from '../scenes/durationWorld.ts';

type NotationRuntime = Readonly<{
  module: typeof import('vexflow/core');
  fontCss: string;
  fontVersion: string;
  fontLicense: string;
}>;

let fontRuntime: Promise<NotationRuntime> | undefined;

/** A shared local-font barrier for live notation and its printed page snapshots. */
export function ensureBookNotationReady(): Promise<NotationRuntime> {
  if (!fontRuntime) fontRuntime = (async () => {
    if (!document.fonts) throw new Error('이 환경에서는 악보 글꼴을 확인할 수 없습니다.');
    const [module, bundled] = await Promise.all([import('vexflow/core'), import('./notationFonts.generated.ts')]);
    const owned: FontFace[] = [];
    try {
      // Explicit bundled URLs: never call loadFonts() or Font.load() with a CDN default.
      // Own the face before awaiting so failed faces are also removed for a clean retry.
      const attempts = await Promise.allSettled(bundled.NOTATION_FONTS.map(async (font) => {
        const face = new FontFace(font.family, `url("${font.dataUrl}")`, { weight: font.weight, display: 'block' });
        owned.push(face);
        document.fonts.add(face);
        return face.load();
      }));
      if (attempts.some(result => result.status === 'rejected')) throw new Error('악보 글꼴을 불러오지 못했습니다.');
      const checks = await Promise.all([
        document.fonts.load('40px Bravura', '\uE0A4'),
        document.fonts.load('16px Academico', '4/4'),
        document.fonts.load('bold 16px Academico', '4/4'),
      ]);
      if (checks.some(faces => !faces.length || faces.some(face => face.status !== 'loaded')) ||
          !document.fonts.check('40px Bravura', '\uE0A4') || !document.fonts.check('16px Academico', '4/4') ||
          !document.fonts.check('bold 16px Academico', '4/4')) throw new Error('악보 글꼴 준비를 확인하지 못했습니다.');
      module.VexFlow.setFonts('Bravura', 'Academico');
      return {
        module,
        fontCss: bundled.NOTATION_FONTS.map(font => `@font-face{font-family:"${font.family}";font-style:normal;font-weight:${font.weight};src:url("${font.dataUrl}") format("woff2");}`).join('\n'),
        fontVersion: bundled.NOTATION_FONT_VERSION,
        fontLicense: bundled.NOTATION_FONT_LICENSE,
      };
    } catch (reason) {
      owned.forEach(face => document.fonts.delete(face));
      throw reason;
    }
  })().catch((reason: unknown) => {
    fontRuntime = undefined;
    throw reason;
  });
  return fontRuntime;
}

export type BookNotationArtifact = Readonly<{
  svg: SVGSVGElement;
  width: number;
  height: number;
  revision: string | number;
  fontVersion: string;
  /** Captures the current highlights and includes unchanged font bytes and their full notices. */
  serialize(): string;
}>;

export type BookNotationProps = Readonly<{
  events: readonly MusicEvent[];
  width: number;
  selectedEventId?: string | null;
  activeEventIds?: readonly string[];
  onSelect?: (eventId: string) => void;
  contentRevision?: string | number;
  /** A coordinator retry must redraw even when music and dimensions are unchanged. */
  preparationEpoch?: number;
  label?: string;
  keySignature?: 'C' | 'G';
  /** False only when the page provides one equivalent semantic event list/description. */
  showEventList?: boolean;
  onReady?: (artifact: BookNotationArtifact) => void;
  onError?: (message: string) => void;
}>;

type RenderedEvent = { id: string; x: number; y: number; width: number; height: number; element: Element | null };
type Drawing = { svg: SVGSVGElement; width: number; height: number; runtime: NotationRuntime;
  request: object; revision: string | number };
const SVG_NS = 'http://www.w3.org/2000/svg';
const durations = { whole: 'w', half: 'h', quarter: 'q', eighth: '8', sixteenth: '16' };
const accidentalNames: Record<number, string> = { [-2]: '겹내림', [-1]: '내림', 0: '', 1: '올림', 2: '겹올림' };

function serializeDrawing(drawing: Drawing, revision: string | number): string {
  const clone = drawing.svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('data-notation-revision', String(revision));
  const definitions = document.createElementNS(SVG_NS, 'defs');
  const style = document.createElementNS(SVG_NS, 'style');
  style.textContent = drawing.runtime.fontCss;
  definitions.appendChild(style);
  const metadata = document.createElementNS(SVG_NS, 'metadata');
  metadata.textContent = drawing.runtime.fontLicense;
  clone.prepend(definitions, metadata);
  return new XMLSerializer().serializeToString(clone);
}

/** Page-local VexFlow notation. Narrow pages scroll without shrinking music glyphs. */
export function BookNotation({
  events, width, selectedEventId, activeEventIds = [], onSelect, contentRevision = 0, preparationEpoch = 0,
  label = '4/4 한 마디 악보', keySignature = 'C', showEventList = true, onReady, onError,
}: BookNotationProps) {
  const drawingRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<RenderedEvent[]>([]);
  const artifactRef = useRef<Drawing | null>(null);
  const latest = useRef({ selectedEventId, activeEventIds, onSelect, contentRevision, onReady, onError });
  latest.current = { selectedEventId, activeEventIds, onSelect, contentRevision, onReady, onError };
  const [renderResult, setRenderResult] = useState<{ request: object; status: 'ready' | 'error'; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const preferredWidth = Number.isFinite(width) ? Math.max(96, Math.min(4096, Math.round(width))) : 240;
  const requestedWidth = containerWidth > 0 ? Math.max(96, Math.min(preferredWidth, containerWidth)) : preferredWidth;
  const request = useMemo(() => ({ events, requestedWidth, keySignature, contentRevision, preparationEpoch, retry }),
    [events, requestedWidth, keySignature, contentRevision, preparationEpoch, retry]);
  const currentRequest = useRef<object | null>(null);
  const status = renderResult?.request === request ? renderResult.status : 'pending';
  const ready = status === 'ready';
  const error = status === 'error' ? renderResult?.error ?? '' : '';

  // Pending is derived during render: a previous SVG/error never acquires the
  // new revision label while passive-effect cleanup is still outstanding.
  useLayoutEffect(() => {
    currentRequest.current = request;
    return () => { if (currentRequest.current === request) currentRequest.current = null; };
  }, [request]);

  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const measure = () => {
      // clientWidth stays in page-local CSS pixels even when the book is projected.
      // Keep the last visible size while turning/hidden so an invisible page does not rebuild.
      const measured = Math.round(viewport.clientWidth);
      if (measured <= 0) return;
      setContainerWidth(previous => previous === measured ? previous : measured);
      const drawing = artifactRef.current;
      if (drawing) setOverflowing(drawing.width > measured + 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    measure();
    return () => observer.disconnect();
  }, []);

  const publish = useCallback(() => {
    const drawing = artifactRef.current;
    if (!drawing || drawing.request !== currentRequest.current) return;
    const revision = drawing.revision;
    drawing.svg.dataset.notationRevision = String(revision);
    latest.current.onReady?.({ svg: drawing.svg, width: drawing.width, height: drawing.height, revision,
      fontVersion: drawing.runtime.fontVersion, serialize: () => serializeDrawing(drawing, revision) });
  }, []);

  const highlight = useCallback(() => {
    const drawing = artifactRef.current;
    if (!drawing) return;
    drawing.svg.querySelectorAll('[data-score-highlight]').forEach(element => element.remove());
    const active = new Set(latest.current.activeEventIds);
    for (const item of renderedRef.current) {
      const isSelected = item.id === latest.current.selectedEventId;
      const isActive = active.has(item.id);
      item.element?.setAttribute('data-selected', String(isSelected));
      item.element?.setAttribute('data-active', String(isActive));
      if (!isSelected && !isActive) continue;
      const rectangle = document.createElementNS(SVG_NS, 'rect');
      rectangle.setAttribute('data-score-highlight', item.id);
      // A stopped page print keeps the learner's selection but not playback's transient cue.
      rectangle.setAttribute('data-selected', String(isSelected));
      rectangle.setAttribute('data-active', String(isActive));
      rectangle.setAttribute('x', String(item.x - 4));
      rectangle.setAttribute('y', String(item.y - 4));
      rectangle.setAttribute('width', String(Math.max(item.width + 8, 20)));
      rectangle.setAttribute('height', String(Math.max(item.height + 8, 22)));
      rectangle.setAttribute('rx', '3');
      rectangle.setAttribute('fill', 'none');
      rectangle.setAttribute('stroke', isSelected ? '#8d4c12' : '#275e68');
      rectangle.setAttribute('stroke-width', '2');
      if (isActive) rectangle.setAttribute('stroke-dasharray', '4 2');
      rectangle.setAttribute('pointer-events', 'none');
      drawing.svg.appendChild(rectangle);
    }
  }, []);

  useEffect(() => { highlight(); }, [selectedEventId, activeEventIds, highlight]);

  useEffect(() => {
    let alive = true;
    const container = drawingRef.current;
    if (!container) return;
    artifactRef.current = null;
    renderedRef.current = [];
    container.replaceChildren();
    const fail = (reason: unknown) => {
      if (!alive || currentRequest.current !== request) return;
      const message = reason instanceof Error && reason.message.trim() ? reason.message : '악보를 준비하지 못했습니다.';
      artifactRef.current = null;
      renderedRef.current = [];
      container.replaceChildren();
      setRenderResult({ request, status: 'error', error: message });
      latest.current.onError?.(message);
    };
    void ensureBookNotationReady().then(runtime => {
      if (!alive || currentRequest.current !== request) return;
      try {
        const { events, requestedWidth, keySignature, contentRevision } = request;
        const validation = validateEvents(events);
        if (!validation.valid) throw new Error('음악 데이터가 유효하지 않아 악보를 표시하지 못했습니다.');
        if (events.some(event => (event.notation.dots ?? 0) !== 0 || event.notation.tuplet || !(event.notation.type in durations))) {
          throw new Error('이 페이지는 무부점 온음표부터 16분음표까지 지원합니다.');
        }
        const { Accidental, Beam, Formatter, Fraction, Renderer, Stave, StaveNote, Voice } = runtime.module;
        const renderer = new Renderer(container, Renderer.Backends.SVG);
        const context = renderer.getContext();
        const stave = new Stave(8, -6, requestedWidth - 16).addClef('treble');
        if (keySignature !== 'C') stave.addKeySignature(keySignature);
        stave.addTimeSignature('4/4');
        const notes = events.map((event, index) => {
          const accidental = event.kind === 'note' ? ({ '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' } as Record<string, string>)[String(event.pitch.alter)] : '';
          if (accidental === undefined) throw new Error('지원하지 않는 변화표입니다.');
          const key = event.kind === 'rest' ? event.notation.type === 'whole' ? 'd/5' : 'b/4'
            : `${event.pitch.step.toLowerCase()}${accidental}/${event.pitch.octave}`;
          const note = new StaveNote({ clef: 'treble', keys: [key], duration: `${durations[event.notation.type]}${event.kind === 'rest' ? 'r' : ''}`,
            autoStem: true, alignCenter: event.kind === 'rest' && event.notation.type === 'whole' && events.length === 1 });
          note.setAttribute('id', `${id}-note-${index}`);
          note.setStave(stave);
          return note;
        });
        const voice = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT).addTickables(notes);
        Accidental.applyAccidentals([voice], keySignature);
        const beams = Beam.generateBeams(notes, { groups: [new Fraction(1, 4)], beamRests: false });
        const formatter = new Formatter().joinVoices([voice]);
        const minimumNotesWidth = notes.length ? formatter.preCalculateMinTotalWidth([voice]) : 0;
        // The header is measured by VexFlow. A sixteen-note line can scroll rather than collapse.
        const drawWidth = Math.max(requestedWidth, Math.ceil(stave.getNoteStartX() + minimumNotesWidth + 28));
        const drawHeight = 112;
        renderer.resize(drawWidth, drawHeight);
        stave.setWidth(drawWidth - 16).setContext(context).draw();
        if (notes.length) {
          formatter.formatToStave([voice], stave);
          voice.draw(context, stave);
          beams.forEach(beam => {
            beam.setContext(context).draw();
            beam.getSVGElement()?.setAttribute('data-beam-events', beam.getNotes().map(note => note.getAttribute('id')).join(' '));
          });
        }
        const svg = container.querySelector('svg');
        if (!svg) throw new Error('악보 SVG를 만들지 못했습니다.');
        svg.setAttribute('viewBox', `0 0 ${drawWidth} ${drawHeight}`);
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('data-staff-bottom-y', String(stave.getYForLine(4)));
        svg.setAttribute('data-renderer-version', runtime.module.VexFlow.BUILD.VERSION);
        svg.setAttribute('data-local-fonts-ready', 'true');
        svg.setAttribute('data-font-version', runtime.fontVersion);
        svg.setAttribute('data-key-signature', keySignature);
        svg.style.display = 'block';
        renderedRef.current = notes.map((note, index) => {
          const event = events[index];
          const box = note.getBoundingBox();
          const element = note.getSVGElement() ?? null;
          element?.setAttribute('data-notation-event', event.id);
          element?.setAttribute('data-note-type', event.notation.type);
          element?.setAttribute('data-event-kind', event.kind);
          element?.setAttribute('data-note-y', String(note.getYs()[0]));
          element?.setAttribute('data-pitch-key', note.getKeys()[0]);
          element?.setAttribute('data-center-aligned', String(note.isCenterAligned()));
          if (element) {
            element.addEventListener('click', () => latest.current.onSelect?.(event.id));
            (element as SVGElement).style.cursor = latest.current.onSelect ? 'pointer' : 'default';
          }
          return { id: event.id, x: box.getX(), y: box.getY(), width: box.getW(), height: box.getH(), element };
        });
        artifactRef.current = { svg, width: drawWidth, height: drawHeight, runtime, request, revision: contentRevision };
        setOverflowing(drawWidth > (scrollRef.current?.clientWidth || requestedWidth) + 1);
        highlight();
        setRenderResult({ request, status: 'ready' });
        publish();
      } catch (reason) { fail(reason); }
    }, fail);
    return () => {
      alive = false;
      artifactRef.current = null;
      renderedRef.current = [];
      container.replaceChildren();
    };
  }, [request, id, highlight, publish]);

  return <section className="book-notation" aria-label={label} data-notation-ready={ready}
    data-notation-status={status} data-notation-error={error || undefined}
    data-notation-revision={contentRevision} data-notation-epoch={preparationEpoch} style={{ width: '100%', minWidth: 0 }}>
    <div ref={scrollRef} className="book-notation-scroll" tabIndex={overflowing ? 0 : undefined}
      role={overflowing ? 'region' : undefined} aria-label={overflowing ? `${label}, 가로로 스크롤하여 전체 악보 읽기` : undefined}
      style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', touchAction: 'pan-x pan-y pinch-zoom', minHeight: 112 }}>
      <div ref={drawingRef} data-score-drawing />
    </div>
    {overflowing && <small>악보를 좌우로 움직여 전체 음표를 읽을 수 있어요.</small>}
    {!ready && !error && <p role="status">악보를 준비하고 있어요.</p>}
    {error && <p role="status">{error} 아래 목록 또는 페이지의 글 설명으로 확인할 수 있어요.</p>}
    {error && <button type="button" onClick={() => setRetry(value => value + 1)} style={{ minHeight: 44, font: 'inherit' }}>악보 다시 준비하기</button>}
    {showEventList && <details className="book-notation-events">
      <summary style={{ minHeight: 44, lineHeight: '44px' }}>음표와 쉼표 목록</summary>
      <ol>{events.map((event, index) => {
        const text = `${index + 1}번째 ${eventLabel(event)} · 시작 ${event.onset.n}/${event.onset.d}${event.kind === 'note' ? ` · ${accidentalNames[event.pitch.alter] ?? ''}${event.pitch.step}${event.pitch.octave}` : ' · 무음 시간'}`;
        return <li key={event.id}>{onSelect ? <button type="button" onClick={() => onSelect(event.id)} aria-pressed={selectedEventId === event.id}
          aria-current={activeEventIds.includes(event.id) ? 'step' : undefined} style={{ minHeight: 44, font: 'inherit', textAlign: 'left' }}>{text}</button> : text}</li>;
      })}</ol>
      {!events.length && <p>아직 음표와 쉼표가 없는 빈 마디입니다.</p>}
    </details>}
  </section>;
}

export default BookNotation;
