import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import type { PageId } from '../manifest.ts';
import type { QualityTier } from '../profile.ts';
import { sceneState } from '../../lesson/controller.ts';
import { PAGE_LOGICAL } from './pageLayout.ts';
import type { FontSpec, PageLayout } from './pageLayout.ts';
import { interactionKey } from './hotspots.ts';
import type { PageInteraction } from './hotspots.ts';
import type { PageContext, PageSpec } from './pageSpec.ts';

/**
 * v3 R3 page compositor (REFACTOR_DESIGN_V3 §6 R3 (5)).
 *
 * Each page owns ONE print texture for its whole life in the window, so a static page and a
 * turning leaf always share the same object and a resolution change never swaps identities.
 * A changed page is printed synchronously at draft resolution and upgraded to settled
 * resolution later (idle); both use the same resolution-independent PageLayout, so the
 * upgrade changes sharpness only, never positions. The interactive spread also owns a light
 * RGBA state layer (selection, playback note, hover, pressed, focus) that repaints without
 * reprinting.
 */
export type SurfaceResolution = 'settled' | 'draft';
export type CanvasLike = { width: number; height: number };
export type PageSurface = Readonly<{
  pageId: PageId;
  layout: PageLayout;
  print: CanvasTexture;
  state: CanvasTexture | null;
  /** Resolution currently uploaded in `print`. */
  resolution: SurfaceResolution;
  /** True while a settled page still shows its draft print. */
  upgrading: boolean;
  printVersion: number;
  stateVersion: number;
}>;
export type CompositorPolicy = Readonly<{ settledWidth: number; draftWidth: number; stateWidth: number; anisotropy: number; budgetBytes: number }>;
export type PaintRecord = Readonly<{ pageId: PageId; layer: SurfaceResolution | 'state'; ms: number }>;
export type CompositorStats = Readonly<{
  pages: number; bytes: number; budgetBytes: number; settled: number; drafts: number; states: number;
  printPaints: number; statePaints: number; lastDraftMs: number; lastSettledMs: number; recent: readonly PaintRecord[];
}>;
export type CompositorDeps = Readonly<{
  layout(spec: PageSpec, context: PageContext): PageLayout;
  createCanvas(width: number, height: number): CanvasLike;
  paintPrint(canvas: CanvasLike, layout: PageLayout): void;
  paintState(canvas: CanvasLike, layout: PageLayout, interaction: PageInteraction): void;
  now?(): number;
  mark?(name: string): void;
}>;

const MIB = 1024 * 1024;
/** CONTRACT_V3 C3 / design §6 R3 (5): texture memory for the print window. */
export const PRINT_BUDGET_BYTES = 48 * MIB;
export const pageCanvasHeight = (width: number) => Math.round(width * PAGE_LOGICAL.height / PAGE_LOGICAL.width);
/** RGBA8 upload plus a full mip chain (×4/3). */
export const textureBytes = (width: number) => width * pageCanvasHeight(width) * 4 * 4 / 3;

/**
 * Settled 1280 (1024 on the low tier), draft 768 (640), state 512. With the six-page window
 * (2 settled + 4 draft + 2 state layers) this is 46.1 MiB on high/medium, inside the 48 MiB budget.
 */
export function compositorPolicy(tier: QualityTier, maxAnisotropy = 8): CompositorPolicy {
  return { settledWidth: tier === 'low' ? 1024 : 1280, draftWidth: tier === 'low' ? 640 : 768, stateWidth: 512,
    anisotropy: Math.max(1, Math.min(8, maxAnisotropy)), budgetBytes: PRINT_BUDGET_BYTES };
}

export function windowBytes(policy: CompositorPolicy, settled = 2, drafts = 4, states = 2): number {
  return settled * textureBytes(policy.settledWidth) + drafts * textureBytes(policy.draftWidth) + states * textureBytes(policy.stateWidth);
}

const sceneIds = new WeakMap<object, number>();
let nextSceneId = 1;
function identity(value: object): number {
  let id = sceneIds.get(value);
  if (!id) { id = nextSceneId++; sceneIds.set(value, id); }
  return id;
}

/**
 * Every input a page print depends on: its own scene state object (immutable, replaced on any
 * edit/selection/answer, so identity is exact), the live feedback line when it is the current
 * scene, the printed playback state, this scene's flaps and the composition kind.
 * Resolution is deliberately absent: draft and settled share one layout.
 */
export function printKey(spec: PageSpec, context: PageContext): string {
  const hints = Object.entries(context.hints).filter(([key]) => key.startsWith(`${context.sceneId}/`)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return JSON.stringify([spec.pageId, identity(sceneState(context.lesson, context.sceneId)),
    context.lesson.currentSceneId === context.sceneId ? context.lesson.feedback : '',
    context.playback.state, context.playback.laneId, context.playback.error, hints, context.ui.composeKind, context.interactive]);
}

/** Canvas text metrics with a small cache; the layout calls it many times per page. */
export function createTextMeasurer(): (text: string, font: FontSpec) => number {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 4;
  const context = canvas.getContext('2d')!;
  const cache = new Map<string, number>();
  return (text, font) => {
    const key = `${font.family}|${font.weight}|${font.size.toFixed(3)}|${font.letterSpacing ?? 0}|${text}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    context.font = `${font.weight} ${Math.max(1, font.size).toFixed(2)}px "${font.family}"`;
    const width = context.measureText(text).width + (font.letterSpacing ?? 0) * Math.max(0, [...text].length - 1);
    if (cache.size > 6000) cache.clear();
    cache.set(key, width);
    return width;
  };
}

export interface PageCompositor {
  /** Print (synchronously, draft first) and return a page's surfaces. Cached: unchanged inputs paint nothing. */
  request(spec: PageSpec, context: PageContext, want: SurfaceResolution, interaction: PageInteraction | null): PageSurface;
  /** Pages that show a draft but want a settled print. */
  pending(): PageId[];
  /** Paint and upload the settled print of a pending page (idle work). Returns true if anything changed. */
  upgrade(pageId: PageId): boolean;
  /** Release pages outside the print window. */
  prune(keep: ReadonlySet<PageId>): void;
  surface(pageId: PageId): PageSurface | null;
  stats(): CompositorStats;
  dispose(): void;
}

type Layer = { canvas: CanvasLike; key: string };
type Entry = {
  pageId: PageId;
  print: CanvasTexture;
  draft: Layer | null;
  settled: Layer | null;
  shown: SurfaceResolution;
  want: SurfaceResolution;
  layout: PageLayout;
  layoutKey: string;
  state: { canvas: CanvasLike; texture: CanvasTexture; key: string } | null;
  printVersion: number;
  stateVersion: number;
};

export function createPageCompositor(deps: CompositorDeps, policy: CompositorPolicy): PageCompositor {
  const entries = new Map<PageId, Entry>();
  const recent: PaintRecord[] = [];
  let printPaints = 0, statePaints = 0, lastDraftMs = 0, lastSettledMs = 0;
  let disposed = false;
  const now = () => deps.now?.() ?? performance.now();

  function texture(canvas: CanvasLike): CanvasTexture {
    const result = new CanvasTexture(canvas as unknown as HTMLCanvasElement);
    result.colorSpace = SRGBColorSpace;
    result.generateMipmaps = true;
    result.minFilter = LinearMipmapLinearFilter;
    result.magFilter = LinearFilter;
    result.anisotropy = policy.anisotropy;
    return result;
  }
  function record(pageId: PageId, layer: PaintRecord['layer'], ms: number): void {
    recent.push({ pageId, layer, ms });
    if (recent.length > 48) recent.shift();
  }
  function paint(entry: Entry, resolution: SurfaceResolution): void {
    const width = resolution === 'settled' ? policy.settledWidth : policy.draftWidth;
    let layer = resolution === 'settled' ? entry.settled : entry.draft;
    if (!layer || layer.canvas.width !== width) layer = { canvas: deps.createCanvas(width, pageCanvasHeight(width)), key: '' };
    deps.mark?.(`print:${resolution}:start`);
    const started = now();
    deps.paintPrint(layer.canvas, entry.layout);
    const ms = now() - started;
    deps.mark?.(`print:${resolution}:end`);
    layer.key = entry.layoutKey;
    if (resolution === 'settled') { entry.settled = layer; lastSettledMs = ms; } else { entry.draft = layer; lastDraftMs = ms; }
    printPaints += 1;
    record(entry.pageId, resolution, ms);
  }
  /** Upload a layer into the page's single texture. A size change frees the GPU storage first. */
  function show(entry: Entry, resolution: SurfaceResolution): void {
    const layer = resolution === 'settled' ? entry.settled! : entry.draft!;
    const image = entry.print.image as CanvasLike;
    if (image !== layer.canvas) {
      // WebGL2 texStorage is immutable: a different size must reallocate.
      if (image.width !== layer.canvas.width || image.height !== layer.canvas.height) entry.print.dispose();
      entry.print.image = layer.canvas as unknown as HTMLCanvasElement;
    }
    entry.print.needsUpdate = true;
    entry.shown = resolution;
    entry.printVersion += 1;
  }
  function releaseState(entry: Entry): void {
    if (!entry.state) return;
    entry.state.texture.dispose();
    entry.state = null;
    entry.stateVersion += 1;
  }
  function surfaceOf(entry: Entry): PageSurface {
    return { pageId: entry.pageId, layout: entry.layout, print: entry.print, state: entry.state?.texture ?? null, resolution: entry.shown,
      upgrading: entry.want === 'settled' && entry.settled?.key !== entry.layoutKey, printVersion: entry.printVersion, stateVersion: entry.stateVersion };
  }

  return {
    request(spec, context, want, interaction) {
      if (disposed) throw new Error('The page compositor was disposed.');
      const key = printKey(spec, context);
      let entry = entries.get(spec.pageId);
      if (!entry) {
        const layout = deps.layout(spec, context);
        const fresh = { pageId: spec.pageId, draft: null, settled: null, shown: 'draft', want, layout, layoutKey: key,
          state: null, printVersion: 0, stateVersion: 0 } as Omit<Entry, 'print'> as Entry;
        paint(fresh, 'draft');
        fresh.print = texture(fresh.draft!.canvas);
        entries.set(spec.pageId, fresh);
        show(fresh, 'draft');
        entry = fresh;
      } else if (entry.layoutKey !== key) {
        entry.layout = deps.layout(spec, context);
        entry.layoutKey = key;
      }
      entry.want = want;
      if (want === 'settled' && entry.settled?.key === key) {
        if (entry.shown !== 'settled') show(entry, 'settled');
      } else {
        if (entry.draft?.key !== key) { paint(entry, 'draft'); show(entry, 'draft'); }
        else if (entry.shown !== 'draft') show(entry, 'draft');
        // A neighbour keeps only its draft: settled storage is for the open spread.
        if (want === 'draft') entry.settled = null;
      }
      if (interaction) {
        if (!entry.state) {
          const canvas = deps.createCanvas(policy.stateWidth, pageCanvasHeight(policy.stateWidth));
          entry.state = { canvas, texture: texture(canvas), key: '' };
        }
        const stateKey = `${entry.layoutKey}|${interactionKey(entry.layout, interaction)}`;
        if (stateKey !== entry.state.key) {
          const started = now();
          deps.paintState(entry.state.canvas, entry.layout, interaction);
          record(entry.pageId, 'state', now() - started);
          statePaints += 1;
          entry.state.key = stateKey;
          entry.state.texture.needsUpdate = true;
          entry.stateVersion += 1;
        }
      } else releaseState(entry);
      return surfaceOf(entry);
    },
    pending() {
      return [...entries.values()].filter(entry => entry.want === 'settled' && entry.settled?.key !== entry.layoutKey).map(entry => entry.pageId);
    },
    upgrade(pageId) {
      const entry = entries.get(pageId);
      if (disposed || !entry || entry.want !== 'settled' || entry.settled?.key === entry.layoutKey) return false;
      paint(entry, 'settled');
      show(entry, 'settled');
      return true;
    },
    prune(keep) {
      for (const [pageId, entry] of entries) {
        if (keep.has(pageId)) continue;
        entry.print.dispose();
        releaseState(entry);
        entries.delete(pageId);
      }
    },
    surface(pageId) {
      const entry = entries.get(pageId);
      return entry ? surfaceOf(entry) : null;
    },
    stats() {
      let bytes = 0, settled = 0, drafts = 0, states = 0;
      for (const entry of entries.values()) {
        const image = entry.print.image as CanvasLike;
        bytes += image.width * image.height * 4 * 4 / 3;
        if (entry.shown === 'settled') settled += 1; else drafts += 1;
        if (entry.state) { states += 1; bytes += entry.state.canvas.width * entry.state.canvas.height * 4 * 4 / 3; }
      }
      return { pages: entries.size, bytes, budgetBytes: policy.budgetBytes, settled, drafts, states, printPaints, statePaints,
        lastDraftMs, lastSettledMs, recent: [...recent] };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.values()) { entry.print.dispose(); entry.state?.texture.dispose(); }
      entries.clear();
    },
  };
}
