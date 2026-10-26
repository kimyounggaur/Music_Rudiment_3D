import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { eq, frac, sum } from '../domain/index.ts';
import { eventLabel, type DurationSceneProps } from '../scenes/DurationScene2D.tsx';

export type NotationViewProps = DurationSceneProps & {
  /** The pilot uses C; G is an explicit spelling/key-signature regression fixture. */
  keySignature?: 'C' | 'G';
};
type RenderedEvent = { id: string; x: number; y: number; width: number; height: number; element: Element | null };

let rendererReady: Promise<typeof import('vexflow/bravura')> | undefined;
function loadRenderer() {
  if (!rendererReady) rendererReady = (async () => {
    // This package entry uses its bundled data:woff2 fonts. Never call loadFonts()'s CDN defaults.
    const module = await import('vexflow/bravura');
    if (!document.fonts) throw new Error('이 환경에서 악보 글꼴을 확인할 수 없습니다.');
    const [musicFonts, textFonts] = await Promise.all([document.fonts.load('40px Bravura', '\uE0A4'), document.fonts.load('16px Academico', '4/4')]);
    if (!musicFonts.length || !textFonts.length || [...musicFonts, ...textFonts].some((font) => font.status !== 'loaded') ||
        !document.fonts.check('40px Bravura', '\uE0A4') || !document.fonts.check('16px Academico', '4/4')) throw new Error('악보 글꼴을 불러오지 못했습니다.');
    return module;
  })().catch((error: unknown) => {
    // A failed local font attempt must not poison later explicit retries.
    rendererReady = undefined;
    throw error;
  });
  return rendererReady;
}

const durations: Record<string, string> = { whole: 'w', half: 'h', quarter: 'q', eighth: '8', sixteenth: '16' };
const accidentalLabels: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

/** Musical spacing belongs to VexFlow; no pixel/time-axis coordinates are used to construct notation. */
export function NotationView({ events, selectedId, activeId, onSelect, keySignature = 'C' }: NotationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<RenderedEvent[]>([]);
  const renderCountRef = useRef(0);
  const latestRef = useRef({ selectedId, activeId, onSelect });
  const [containerWidth, setContainerWidth] = useState(0);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const total = sum(events.map((event) => event.duration));
  const complete = events.length > 0 && eq(total, frac(1));

  const highlight = useCallback(() => {
    const drawing = drawingRef.current;
    const svg = drawing?.querySelector('svg');
    if (!drawing || !svg) return;
    drawing.querySelectorAll('[data-score-highlight]').forEach((element) => element.remove());
    for (const item of renderedRef.current) {
      const selected = item.id === latestRef.current.selectedId;
      const active = item.id === latestRef.current.activeId;
      item.element?.setAttribute('data-selected', String(selected));
      item.element?.setAttribute('data-active', String(active));
      if (!selected && !active) continue;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('data-score-highlight', item.id);
      rect.setAttribute('x', String(item.x - 4));
      rect.setAttribute('y', String(item.y - 4));
      rect.setAttribute('width', String(Math.max(item.width + 8, 20)));
      rect.setAttribute('height', String(Math.max(item.height + 8, 22)));
      rect.setAttribute('rx', '3');
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', selected ? '#8d4c12' : '#275e68');
      rect.setAttribute('stroke-width', '2');
      if (active && !selected) rect.setAttribute('stroke-dasharray', '4 2');
      rect.setAttribute('pointer-events', 'none');
      svg.appendChild(rect);
    }
  }, []);

  useEffect(() => {
    latestRef.current = { selectedId, activeId, onSelect };
    highlight();
  }, [selectedId, activeId, onSelect, highlight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setContainerWidth(Math.round(container.clientWidth));
    const observer = new ResizeObserver(update);
    observer.observe(container);
    update();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    const drawing = drawingRef.current;
    if (!drawing) return;
    setReady(false);
    setError('');
    void loadRenderer().then((loaded) => {
      if (!alive) return;
      try {
        const { Accidental, Beam, Formatter, Fraction: VexFraction, Renderer, Stave, StaveNote, Voice } = loaded;
        drawing.replaceChildren();
        renderedRef.current = [];
        const width = Math.max(400, events.length * 44 + 128, containerWidth);
        const renderer = new Renderer(drawing, Renderer.Backends.SVG);
        renderer.resize(width, 170);
        const context = renderer.getContext();
        const stave = new Stave(12, 16, width - 26);
        stave.addClef('treble');
        if (keySignature !== 'C') stave.addKeySignature(keySignature);
        stave.addTimeSignature('4/4');
        stave.setContext(context).draw();
        if (events.length) {
          const notes = events.map((event, index) => {
            const duration = durations[event.notation.type];
            if (!duration || (event.notation.dots ?? 0) !== 0) throw new Error('지원하지 않는 기보');
            if (event.kind === 'note' && !event.pitch) throw new Error('음높이 없음');
            const accidental = event.kind === 'note' ? ({ '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' } as Record<string, string>)[String(event.pitch!.alter)] : '';
            if (accidental === undefined) throw new Error('지원하지 않는 변화표');
            // The final effective alter is encoded exactly once. Key signature affects display only.
            // A whole rest hangs from the fourth staff line; a half rest stands on the middle line.
            const key = event.kind === 'rest' ? event.notation.type === 'whole' ? 'd/5' : 'b/4' : `${event.pitch!.step.toLowerCase()}${accidental}/${event.pitch!.octave}`;
            const note = new StaveNote({ clef: 'treble', keys: [key], duration: `${duration}${event.kind === 'rest' ? 'r' : ''}`, autoStem: true,
              alignCenter: event.kind === 'rest' && event.notation.type === 'whole' && events.length === 1 });
            note.setAttribute('id', `${prefix}-event-${index}`);
            return note;
          });
          const voice = new Voice({ numBeats: 4, beatValue: 4 });
          voice.setMode(Voice.Mode.SOFT).addTickables(notes);
          Accidental.applyAccidentals([voice], keySignature);
          const beams = Beam.generateBeams(notes, { groups: [new VexFraction(1, 4)], beamRests: false });
          new Formatter().joinVoices([voice]).format([voice], Math.max(180, width - (keySignature === 'C' ? 130 : 160)));
          voice.draw(context, stave);
          beams.forEach((beam) => {
            beam.setContext(context).draw();
            beam.getSVGElement()?.setAttribute('data-beam-events', beam.getNotes().map((note) => note.getAttribute('id')).join(' '));
          });
          renderedRef.current = notes.map((note, index) => {
            const box = note.getBoundingBox();
            const element = note.getSVGElement() ?? drawing.querySelector(`[id="vf-${prefix}-event-${index}"]`);
            element?.setAttribute('data-notation-event', events[index].id);
            element?.setAttribute('data-note-type', events[index].notation.type);
            element?.setAttribute('data-event-kind', events[index].kind);
            element?.setAttribute('data-note-y', String(note.getYs()[0]));
            element?.setAttribute('data-pitch-key', note.getKeys()[0]);
            element?.setAttribute('data-center-aligned', String(note.isCenterAligned()));
            if (element) {
              (element as SVGElement).style.cursor = 'pointer';
              element.addEventListener('click', () => latestRef.current.onSelect(events[index].id));
            }
            return { id: events[index].id, x: box.getX(), y: box.getY(), width: box.getW(), height: box.getH(), element };
          });
        }
        const svg = drawing.querySelector('svg');
        svg?.setAttribute('aria-hidden', 'true');
        svg?.setAttribute('focusable', 'false');
        svg?.setAttribute('data-staff-bottom-y', String(stave.getYForLine(4)));
        svg?.setAttribute('data-renderer-version', loaded.VexFlow.BUILD.VERSION);
        svg?.setAttribute('data-local-fonts-ready', 'true');
        svg?.setAttribute('data-key-signature', keySignature);
        drawing.dataset.renderCount = String(++renderCountRef.current);
        highlight();
        setReady(true);
      } catch {
        drawing.replaceChildren();
        renderedRef.current = [];
        setError('악보를 그리지 못했습니다. 아래의 음표·쉼표 목록으로 같은 내용을 확인할 수 있습니다.');
      }
    }).catch(() => {
      if (alive) setError('악보 모듈을 불러오지 못했습니다. 아래 목록으로 학습을 계속할 수 있습니다.');
    });
    return () => {
      alive = false;
      drawing.replaceChildren();
      renderedRef.current = [];
    };
  }, [events, containerWidth, prefix, highlight, keySignature, retryNonce]);

  return <section aria-label="정확한 2D 악보" className="notation-view" data-notation-ready={ready}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}>
      <strong>악보로 연결하기</strong>
      <small>{complete ? '4/4 한 마디' : events.length ? `미완성 초안 · 온음표 기준 ${total.n}/${total.d}` : '빈 마디 · 아직 정답이 아니에요'}</small>
    </div>
    <div ref={containerRef} style={{ width: '100%', overflowX: 'auto', background: '#fff', border: '1px solid #cad5d8', borderRadius: 10, marginTop: 8 }} tabIndex={0} aria-label="악보 영역, 좁은 화면에서는 가로로 스크롤하세요">
      <div ref={drawingRef} data-score-drawing style={{ minHeight: 170 }} />
    </div>
    {!ready && !error && <p role="status">악보와 로컬 글꼴을 준비하고 있어요.</p>}
    {error && <p role="status">{error}</p>}
    {error && <button type="button" onClick={() => { setRetryNonce((value) => value + 1); containerRef.current?.focus(); }}
      style={{ minWidth: 44, minHeight: 44, padding: '7px 12px', font: 'inherit' }}>악보 다시 불러오기</button>}
    <details>
      <summary style={{ minHeight: 44, lineHeight: '44px', cursor: 'pointer' }}>악보의 텍스트 목록</summary>
      <ol>
        {events.map((event, index) => <li key={event.id}><button type="button" onClick={() => onSelect(event.id)} aria-pressed={selectedId === event.id}
          style={{ minHeight: 44, padding: '5px 10px', margin: '3px 0', font: 'inherit', color: '#19373e', background: selectedId === event.id ? '#fff0d8' : '#fff', border: '1px solid #899ea4', borderRadius: 6 }}>
          {index + 1}번째 {eventLabel(event)} · 시작 {event.onset.n}/{event.onset.d}{event.kind === 'note' ? event.pitch ? ` · ${event.pitch.step}${accidentalLabels[event.pitch.alter] ?? `(변화 ${event.pitch.alter})`}${event.pitch.octave}` : ' · 음높이 정보 없음' : ' · 무음 시간'}
        </button></li>)}
      </ol>
      {!events.length && <p>음표와 쉼표가 없습니다. 빈 초안은 재생 가능한 완성 마디가 아닙니다.</p>}
    </details>
  </section>;
}

export default NotationView;
