import { useId } from 'react';

export type DurationEvent = Readonly<{
  id: string;
  kind: 'note' | 'rest';
  onset: Readonly<{ n: number; d: number }>;
  duration: Readonly<{ n: number; d: number }>;
  pitch?: Readonly<{ step: string; alter: number; octave: number }>;
  notation: Readonly<{ type: string; dots?: number }>;
}>;

export type DurationSceneProps = {
  events: readonly DurationEvent[];
  selectedId?: string | null;
  activeId?: string | null;
  position?: number;
  onSelect: (id: string) => void;
  reducedMotion?: boolean;
};

export const durationNames: Record<string, string> = {
  whole: '온', half: '2분', quarter: '4분', eighth: '8분', sixteenth: '16분',
};

export function eventLabel(event: DurationEvent): string {
  const name = durationNames[event.notation.type] ?? event.notation.type;
  const fraction = `${event.duration.n}/${event.duration.d}`;
  return `${name}${event.kind === 'rest' ? '쉼표' : '음표'}, 온음표의 ${fraction}`;
}

/** Proportional blocks explain time; the separate ordered controls keep tiny notes selectable. */
export function DurationScene2D({
  events, selectedId, activeId, position = 0, onSelect, reducedMotion = false,
}: DurationSceneProps) {
  const legendId = useId();
  const safePosition = Math.min(1, Math.max(0, Number.isFinite(position) ? position : 0));
  return (
    <section className="duration-scene-2d" aria-label="음가 블록 2D 실험" aria-describedby={legendId}>
      <p id={legendId} className="axis-legend">가로 길이 = 온음표 기준 시간 · 음높이와 음량 설정은 그대로예요.</p>
      <div aria-hidden="true" style={{ position: 'relative', minHeight: 82, borderBottom: '2px solid #465b60', margin: '12px 8px 6px' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <span key={tick} style={{ position: 'absolute', left: `${tick * 100}%`, bottom: -4, height: 8, borderLeft: '1px solid #7a8f94' }} />
        ))}
        {events.map((event, index) => {
          const selected = event.id === selectedId;
          const active = event.id === activeId;
          return <div key={event.id} data-event-block={event.id} style={{
            position: 'absolute', left: `${event.onset.n / event.onset.d * 100}%`, width: `${event.duration.n / event.duration.d * 100}%`,
            top: 10, height: 56, boxSizing: 'border-box', border: `${selected ? 3 : 1}px solid ${selected ? '#8d4c12' : '#2f5961'}`,
            background: event.kind === 'rest' ? 'repeating-linear-gradient(135deg, #e2e9eb 0px, #e2e9eb 5px, #cbd8db 5px, #cbd8db 7px)' : active ? '#b4dcd9' : '#457a82',
            color: event.kind === 'rest' || active ? '#142f35' : '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden',
            outline: active ? '3px solid #142f35' : undefined, outlineOffset: -4,
          }}><span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{index + 1}</span></div>;
        })}
        {!events.length && <p style={{ padding: '24px 10px', color: '#435a61' }}>아직 비어 있어요. 카드를 골라 넣어 보세요.</p>}
        {!reducedMotion && safePosition > 0 && <span data-playhead style={{ position: 'absolute', left: `${safePosition * 100}%`, top: 0, bottom: 0, borderLeft: '3px solid #b74e22', boxShadow: '0 0 0 1px #fff', pointerEvents: 'none' }} />}
      </div>
      <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', margin: '6px 4px' }}><span>0</span><span>1/4</span><span>1/2</span><span>3/4</span><span>1</span></div>
      <ol aria-label="음표와 쉼표 선택" style={{ display: 'flex', flexWrap: 'wrap', gap: 7, listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
        {events.map((event, index) => (
          <li key={event.id}>
            <button type="button" data-event-select={event.id} onClick={() => onSelect(event.id)} aria-pressed={event.id === selectedId}
              aria-current={event.id === activeId ? 'step' : undefined}
              aria-label={`${index + 1}번째 ${eventLabel(event)}, 시작 ${event.onset.n}/${event.onset.d}${event.id === activeId ? ', 현재 재생' : ''}`}
              style={{ minWidth: 44, minHeight: 44, border: `2px solid ${event.id === selectedId ? '#8d4c12' : '#879da3'}`, borderRadius: 9,
                background: event.id === selectedId ? '#fff0d8' : '#fff', color: '#18373d', padding: '7px 10px', font: 'inherit' }}>
              <span aria-hidden="true">{index + 1}. </span>{durationNames[event.notation.type] ?? event.notation.type}{event.kind === 'rest' ? '쉼표' : '음표'} <small>{event.duration.n}/{event.duration.d}</small>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default DurationScene2D;
