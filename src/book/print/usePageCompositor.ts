import { useEffect, useMemo, useRef, useState } from 'react';
import type { LessonState } from '../../lesson/controller.ts';
import { ensureBookNotationReady } from '../BookNotation.tsx';
import { BOOK_SPREADS } from '../manifest.ts';
import type { PageId } from '../manifest.ts';
import type { QualityTier } from '../profile.ts';
import { pageSpecFor } from '../../content/pages/index.ts';
import { createNotationEngraver } from './notationRaster.ts';
import { ensurePageFontsReady } from './pageFonts.ts';
import { compositorPolicy, createPageCompositor, createTextMeasurer } from './pageCompositor.ts';
import type { CanvasLike, CompositorStats, PageCompositor, PageSurface } from './pageCompositor.ts';
import { layoutPage, PRINT_COLORS } from './pageLayout.ts';
import { paintPage } from './pagePainter.ts';
import { paintState } from './hotspots.ts';
import type { PageInteraction } from './hotspots.ts';
import type { PagePlayback, PageUiState } from './pageSpec.ts';

export type PageCompositorInput = Readonly<{
  enabled: boolean;
  tier: QualityTier;
  lesson: LessonState;
  hints: Readonly<Record<string, number>>;
  ui: PageUiState;
  /** The print window: committed spread plus neighbours (manifest.pagePrintIds). */
  pageIds: readonly PageId[];
  /** Pages of the committed spread: settled resolution, live playback and a state layer. */
  currentPageIds: readonly PageId[];
  playback: PagePlayback;
  /** Canonical stopped playback printed on neighbouring pages (as the v2 canonicalStopped prints). */
  idlePlayback: PagePlayback;
  interaction: PageInteraction;
  maxAnisotropy?: number;
  /** DEV inspection only: keep drafts on screen (to compare draft and settled frames). */
  holdUpgrades?: boolean;
  onError?: (error: Error) => void;
}>;

/** v3 R7 preload order after the cover: body fonts → notation fonts → the first spread's prints. */
export type PagePreload = 'waiting' | 'fonts' | 'notation' | 'printing' | 'ready';
export type PageCompositorState = Readonly<{
  surfaces: ReadonlyMap<PageId, PageSurface>;
  ready: boolean;
  preload: PagePreload;
  /** Changes whenever any print or state texture changed: the stage must render again. */
  generation: number;
  stats(): CompositorStats | null;
}>;

const EMPTY = new Map<PageId, PageSurface>();
// v3 R8: every page of the book; the contents and closing pages carry no scene (null).
const sceneOf = new Map(BOOK_SPREADS.flatMap(spread => [[spread.leftPageId, spread.sceneId], [spread.rightPageId, spread.sceneId]] as const));

type Idle = { cancel(): void };
function whenIdle(callback: () => void): Idle {
  const host = globalThis as typeof globalThis & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (host.requestIdleCallback && host.cancelIdleCallback) {
    const id = host.requestIdleCallback(callback, { timeout: 160 });
    return { cancel: () => host.cancelIdleCallback!(id) };
  }
  const id = setTimeout(callback, 32);
  return { cancel: () => clearTimeout(id) };
}

/**
 * React owner of the page compositor (REFACTOR_DESIGN_V3 §6 R3 (5)). Fonts and the VexFlow
 * engraver load once; after that every print is synchronous, so a turn never waits on DOM capture.
 */
export function usePageCompositor(input: PageCompositorInput): PageCompositorState {
  const { enabled, tier, lesson, hints, ui, pageIds, currentPageIds, playback, idlePlayback, interaction, maxAnisotropy = 8, holdUpgrades = false } = input;
  const [runtime, setRuntime] = useState<{ compositor: PageCompositor; tier: QualityTier } | null>(null);
  const [loading, setLoading] = useState<'fonts' | 'notation' | null>(null);
  const [upgrades, setUpgrades] = useState(0);
  const onError = useRef(input.onError);
  onError.current = input.onError;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let owned: PageCompositor | null = null;
    // v3 R7: one after the other, so the body fonts (needed by every page) arrive first.
    setLoading('fonts');
    void ensurePageFontsReady().then(() => {
      if (alive) setLoading('notation');
      return ensureBookNotationReady();
    }).then(notation => {
      if (!alive) return;
      setLoading(null);
      const engraver = createNotationEngraver(notation.module, PRINT_COLORS.ink);
      const measure = createTextMeasurer();
      owned = createPageCompositor({
        layout: (spec, context) => layoutPage(spec, context, { measure, notation: engraver.measure }),
        createCanvas(width, height) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          return canvas;
        },
        paintPrint: (canvas: CanvasLike, layout) => paintPage((canvas as HTMLCanvasElement).getContext('2d')!, layout, engraver),
        paintState: (canvas: CanvasLike, layout, state) => paintState((canvas as HTMLCanvasElement).getContext('2d')!, layout, state),
        mark: name => {
          try {
            performance.mark(name);
            // print:draft:end → a 'print:draft' measure (design R3: draft update ≤ 60 ms, Performance marks).
            if (name.endsWith(':end')) performance.measure(name.slice(0, -4), `${name.slice(0, -4)}:start`, name);
          } catch { /* marks are diagnostics only */ }
        },
      }, compositorPolicy(tier, maxAnisotropy));
      setRuntime({ compositor: owned, tier });
    }).catch((reason: unknown) => {
      if (alive) onError.current?.(reason instanceof Error ? reason : new Error(String(reason)));
    });
    return () => {
      alive = false;
      owned?.dispose();
      setRuntime(current => current?.compositor === owned ? null : current);
    };
  }, [enabled, tier, maxAnisotropy]);

  // Synchronous, cached printing: unchanged inputs return the same textures without painting.
  const printed = useMemo((): { surfaces: ReadonlyMap<PageId, PageSurface>; error: Error | null; upgrades: number } => {
    if (!enabled || !runtime) return { surfaces: EMPTY, error: null, upgrades };
    const result = new Map<PageId, PageSurface>();
    try {
      for (const pageId of pageIds) {
        const spec = pageSpecFor(pageId);
        const sceneId = sceneOf.get(pageId);
        if (sceneId === undefined) throw new RangeError(`Unknown print page ${pageId}`);
        const current = currentPageIds.includes(pageId);
        result.set(pageId, runtime.compositor.request(spec, { lesson, sceneId, playback: current ? playback : idlePlayback, hints, ui, interactive: true },
          current ? 'settled' : 'draft', current ? interaction : null));
      }
      runtime.compositor.prune(new Set(pageIds));
    } catch (reason) {
      return { surfaces: EMPTY, error: reason instanceof Error ? reason : new Error(String(reason)), upgrades };
    }
    return { surfaces: result, error: null, upgrades };
    // `upgrades` re-reads surfaces after idle settled prints.
  }, [enabled, runtime, lesson, hints, ui, pageIds, currentPageIds, playback, idlePlayback, interaction, upgrades]);
  const { surfaces } = printed;

  useEffect(() => {
    if (printed.error) onError.current?.(printed.error);
  }, [printed]);

  useEffect(() => {
    if (!runtime || holdUpgrades) return;
    const pending = runtime.compositor.pending();
    if (!pending.length) return;
    const idle = whenIdle(() => {
      let changed = false;
      try {
        for (const pageId of pending) changed = runtime.compositor.upgrade(pageId) || changed;
      } catch (reason) {
        onError.current?.(reason instanceof Error ? reason : new Error(String(reason)));
        return;
      }
      if (changed) setUpgrades(value => value + 1);
    });
    return () => idle.cancel();
  }, [runtime, surfaces, holdUpgrades]);

  let generation = 0;
  for (const surface of surfaces.values()) generation += surface.printVersion * 2 + surface.stateVersion;
  const ready = enabled && !!runtime && pageIds.every(id => surfaces.has(id));
  const preload: PagePreload = ready ? 'ready' : !enabled ? 'waiting' : loading ?? (runtime ? 'printing' : 'fonts');
  return { surfaces, ready, preload, generation, stats: () => runtime?.compositor.stats() ?? null };
}
