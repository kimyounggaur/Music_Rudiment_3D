import { useLayoutEffect, useMemo, useRef } from 'react';
import type { FocusEvent, ReactNode } from 'react';
import type { PageId, SpreadId } from '../manifest.ts';
import type { MirrorNode, PageHotspot, PageLayout } from './pageLayout.ts';

/**
 * v3 R3 accessible mirror (REFACTOR_DESIGN_V3 §6 R3 (7), CONTRACT_V3 C3).
 * The visible page is a texture; this visually hidden DOM carries the same text and the same
 * commands for keyboards and assistive technology. Focus is drawn on the paper by the state
 * layer (AX21). It exists only for the interactive spread and is absent during a turn (BK12).
 */
export type MirrorPage = Readonly<{ pageId: PageId; side: 'left' | 'right'; layout: PageLayout }>;
export type AccessibleMirrorProps = Readonly<{
  spreadId: SpreadId;
  pages: readonly MirrorPage[];
  inert: boolean;
  onActivate(hotspot: PageHotspot): void;
  onFocusHotspot(id: string | null): void;
}>;

type Context = Readonly<{ pageId: PageId; hotspots: ReadonlyMap<string, PageHotspot>; activate(hotspot: PageHotspot): void }>;

/**
 * Content-derived sibling keys: a paragraph that appears after an edit must not shift (and so
 * remount) the focused control that follows it.
 */
function keyed(items: readonly MirrorNode[]): [MirrorNode, string][] {
  const seen = new Map<string, number>();
  return items.map(item => {
    const base = item.kind === 'control' ? `c:${item.hotspotId}` : item.kind === 'group' ? `g:${item.role}:${item.label}`
      : item.kind === 'heading' ? `h:${item.text}` : item.kind === 'text' ? `t:${item.id ?? item.text}` : `f:${item.label}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return [item, count ? `${base}#${count}` : base];
  });
}

function control(hotspot: PageHotspot, context: Context): ReactNode {
  const common = { 'data-hotspot': hotspot.id, 'data-testid': hotspot.testId, disabled: !hotspot.enabled };
  switch (hotspot.role) {
    case 'radio':
      return <label key={hotspot.id}><input type="radio" name={`${context.pageId}-${hotspot.group ?? 'choice'}`} checked={!!hotspot.checked}
        onChange={() => context.activate(hotspot)} {...common} />{hotspot.label}</label>;
    case 'checkbox':
      return <label key={hotspot.id}><input type="checkbox" checked={!!hotspot.checked} onChange={() => context.activate(hotspot)} {...common} />{hotspot.label}</label>;
    case 'note':
      return <button key={hotspot.id} type="button" aria-pressed={!!hotspot.pressed} aria-label={hotspot.label} data-event-select={hotspot.eventId}
        onClick={() => context.activate(hotspot)} {...common}>{hotspot.label}</button>;
    case 'flap':
      return <button key={hotspot.id} type="button" aria-expanded={!!hotspot.expanded} onClick={() => context.activate(hotspot)} {...common}>{hotspot.label}</button>;
    case 'toggle':
      return <button key={hotspot.id} type="button" aria-pressed={!!hotspot.pressed} onClick={() => context.activate(hotspot)} {...common}>{hotspot.label}</button>;
    default:
      return <button key={hotspot.id} type="button" onClick={() => context.activate(hotspot)} {...common}>{hotspot.label}</button>;
  }
}

function node(item: MirrorNode, key: string, context: Context): ReactNode {
  switch (item.kind) {
    case 'heading': {
      const Tag = item.level === 1 ? 'h1' : item.level === 2 ? 'h2' : 'h3';
      return <Tag key={key} tabIndex={item.focusTarget ? -1 : undefined}>{item.text}</Tag>;
    }
    case 'text':
      return <p key={key} role={item.live ? 'status' : undefined} data-testid={item.id}>{item.text}</p>;
    case 'figure':
      return <p key={key}>그림: {item.label}</p>;
    case 'control': {
      const hotspot = context.hotspots.get(item.hotspotId);
      return hotspot ? control(hotspot, context) : null;
    }
    case 'group': {
      const instrument = item.instrument ? 'true' : undefined;
      const children = keyed(item.children);
      if (item.role === 'list') return <ol key={key} aria-label={item.label} data-book-instrument={instrument}>
        {children.map(([child, childKey]) => <li key={childKey}>{node(child, childKey, context)}</li>)}
      </ol>;
      if (item.role === 'radiogroup') return <fieldset key={key} data-book-instrument={instrument}>
        <legend>{item.label}</legend>
        {children.map(([child, childKey]) => node(child, childKey, context))}
      </fieldset>;
      return <div key={key} role="group" aria-label={item.label} data-book-instrument={instrument}>
        {children.map(([child, childKey]) => node(child, childKey, context))}
      </div>;
    }
  }
}

export function AccessibleMirror({ spreadId, pages, inert, onActivate, onFocusHotspot }: AccessibleMirrorProps) {
  const root = useRef<HTMLDivElement>(null);
  const activated = useRef<string | null>(null);
  const contexts = useMemo(() => pages.map(page => ({ page, context: {
    pageId: page.pageId, hotspots: new Map(page.layout.hotspots.map(hotspot => [hotspot.id, hotspot])),
    activate(hotspot: PageHotspot) {
      if (!hotspot.enabled) return;
      activated.current = hotspot.id;
      onActivate(hotspot);
    },
  } satisfies Context })), [pages, onActivate]);

  // A control that disables itself (e.g. 둘로 나누기 at a 16th note) would drop focus to the
  // document. Keep keyboard users in the same control group, as the 2D edit groups do.
  useLayoutEffect(() => {
    const id = activated.current;
    activated.current = null;
    const container = root.current;
    if (!id || !container) return;
    const active = document.activeElement;
    if (active && active !== document.body && container.contains(active) && !(active as HTMLButtonElement).disabled) return;
    if (active && active !== document.body && !container.contains(active)) return;
    const previous = container.querySelector<HTMLElement>(`[data-hotspot="${CSS.escape(id)}"]`);
    const group = previous?.closest('[role="group"], fieldset, ol') ?? null;
    const candidates = [...(group ?? container).querySelectorAll<HTMLButtonElement | HTMLInputElement>('button[data-hotspot], input[data-hotspot]')];
    const start = previous ? candidates.indexOf(previous as HTMLButtonElement) : -1;
    for (let offset = 1; offset <= candidates.length; offset += 1) {
      const next = candidates[(Math.max(0, start) + offset) % candidates.length];
      if (next && !next.disabled) { next.focus({ preventScroll: true }); break; }
    }
  }, [pages]);

  const focus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    onFocusHotspot(target.dataset.hotspot ?? null);
  };
  const blur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onFocusHotspot(null);
  };
  return <div ref={root} className="book-mirror" data-active-page="true" data-mirror-spread={spreadId} inert={inert} onFocus={focus} onBlur={blur}>
    {contexts.map(({ page, context }) => <section key={page.pageId} aria-label={page.side === 'left' ? '왼쪽 쪽' : '오른쪽 쪽'} data-mirror-page={page.pageId}>
      {keyed(page.layout.mirror).map(([item, key]) => node(item, key, context))}
    </section>)}
  </div>;
}
