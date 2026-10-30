/**
 * v3 refactor before/after capture (REFACTOR_PROMPTS_V3 §5).
 *
 *   node scripts/refactor-capture.ts --stage R1 --phase after --renderer ink
 *
 * Drives the real app on the local dev server (127.0.0.1 only, external requests blocked):
 * cover, inspector-posed half-open cover, opened first spread, a held direct drag at about
 * half a turn, the second spread after ArrowRight, and the 2D reading book. Each capture records
 * layout metrics from the app's own data-layout and pixel luminance from the screenshot.
 * v3 R5 adds `stamp` (three right answers) and `flap` (the answer flap lifting, 0/120/240 ms)
 * states on the first spread, 2× crops of the left page, and toolbar metrics on every capture.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { applyHomography, homographyFromUnitSquare } from '../src/book/render/homography.ts';
import { PAGE_LOGICAL, PRINT_TYPE } from '../src/book/print/pageLayout.ts';

/** Book Sans Regular (renamed Pretendard Regular subset) OS/2 sxHeight / unitsPerEm (1086 / 2048): body Latin x-height. */
const BODY_X_HEIGHT = 1086 / 2048;
type InspectorPage = { pageId: string; side: 'left' | 'right' | null; scale: number; overflow: number; resolution: string;
  hotspots: { id: string; enabled: boolean; rect: { x: number; y: number; w: number; h: number } }[] };

type Point = { x: number; y: number };
type Quad = { tl: Point; tr: Point; br: Point; bl: Point };
type Layout = { width: number; height: number; left: Quad; right: Quad; cover: Quad; coverCenterErrorPx: number;
  bookBounds: { left: number; right: number; top: number; bottom: number }; camera: Record<string, unknown> };
type Capture = { file: string; viewport: string; state: string; renderer: string; phase: string; time: string;
  data: Record<string, string>; layout?: Record<string, number | string>; luminance?: Record<string, number>; extra?: Record<string, unknown> };

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index].replace(/^--/, ''), process.argv[index + 1] ?? '');
const stage = args.get('stage') ?? 'R1';
const phase = args.get('phase') ?? 'after';
const renderer = args.get('renderer') ?? 'ink';
const quality = args.get('quality') ?? '';
const base = new URL(args.get('base') ?? 'http://127.0.0.1:4173/');
assert.equal(base.hostname, '127.0.0.1', 'Captures use the local dev server only.');
assert.match(stage, /^R\d(-[a-z])?$/);
assert.ok(['before', 'after'].includes(phase));
assert.ok(['legacy', 'ink'].includes(renderer));
const states = (args.get('states') ?? 'cover,opening50,spread1,turn50,spread2,2d').split(',').filter(Boolean);
const viewports = (args.get('viewports') ?? '1280x720,844x390,390x844').split(',').map(text => {
  const [width, height] = text.split('x').map(Number);
  assert.ok(width > 0 && height > 0);
  return { width, height };
});
const folder = resolve(`docs/qa/refactor/${stage}/${phase}`);
const metricsFile = resolve(`docs/qa/refactor/${stage}/metrics.json`);
await mkdir(folder, { recursive: true });

const wait = (ms: number) => new Promise(done => setTimeout(done, ms));
const quadCenter = (quad: Quad): Point => ({ x: (quad.tl.x + quad.tr.x + quad.br.x + quad.bl.x) / 4, y: (quad.tl.y + quad.tr.y + quad.br.y + quad.bl.y) / 4 });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

async function rootData(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('main.book-app');
    if (!root) return {};
    const result: Record<string, string> = {};
    for (const key of ['phase', 'camera', 'scene', 'spread', 'printsReady', 'printCount', 'threeReady', 'frames', 'textures', 'geometries', 'drawCalls', 'quality'] as const) {
      const value = root.dataset[key];
      if (value !== undefined) result[key] = value;
    }
    return result;
  });
}

async function readLayout(page: Page): Promise<Layout | null> {
  const text = await page.evaluate(() => document.querySelector<HTMLElement>('main.book-app')?.dataset.layout ?? '');
  return text ? JSON.parse(text) as Layout : null;
}

async function nextFrames(page: Page, count = 3) {
  await page.evaluate(async (frames) => {
    for (let index = 0; index < frames; index += 1) await new Promise(done => requestAnimationFrame(() => done(null)));
  }, count);
}

async function waitFor(page: Page, predicate: string, timeout = 30_000) {
  await page.waitForFunction(predicate, undefined, { timeout, polling: 100 });
}

async function luminance(page: Page, png: Buffer, points: Record<string, Point>): Promise<Record<string, number>> {
  return page.evaluate(async ({ data, samples }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    const result: Record<string, number> = {};
    for (const [name, point] of Object.entries(samples)) {
      const x = Math.round(point.x) - 4, y = Math.round(point.y) - 4;
      if (x < 0 || y < 0 || x + 9 > canvas.width || y + 9 > canvas.height) continue;
      const pixels = context.getImageData(x, y, 9, 9).data;
      let sum = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const [r, g, b] = [pixels[index], pixels[index + 1], pixels[index + 2]].map(value => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      result[name] = Number((sum / (pixels.length / 4)).toFixed(5));
    }
    return result;
  }, { data: png.toString('base64'), samples: points });
}

function layoutMetrics(layout: Layout | null, open: boolean): Record<string, number | string> | undefined {
  if (!layout) return undefined;
  const result: Record<string, number | string> = {
    coverCenterErrorPx: Number(layout.coverCenterErrorPx.toFixed(3)),
    bookWidthRatio: Number(((layout.bookBounds.right - layout.bookBounds.left) / layout.width).toFixed(4)),
    bookHeightRatio: Number(((layout.bookBounds.bottom - layout.bookBounds.top) / layout.height).toFixed(4)),
  };
  if (open) {
    const far = distance(layout.left.tl, layout.right.tr);
    const near = distance(layout.left.bl, layout.right.br);
    result.farEdgePx = Number(far.toFixed(2));
    result.nearEdgePx = Number(near.toFixed(2));
    result.farNearRatio = Number((far / near).toFixed(4));
    result.rightPageTopPx = Number(distance(layout.right.tl, layout.right.tr).toFixed(2));
    result.rightPageHeightPx = Number(((distance(layout.right.tl, layout.right.bl) + distance(layout.right.tr, layout.right.br)) / 2).toFixed(2));
  }
  for (const key of ['fov', 'distance', 'worldPerPixelAtAnchor', 'span'] as const) {
    const value = layout.camera[key];
    if (typeof value === 'number') result[`camera.${key}`] = Number(value.toFixed(5));
  }
  return result;
}

/**
 * v3 R3 print metrics: on-screen body size and x-height (design §3.1: ≥ 7 px at 1280×720), the
 * smallest printed hotspot, HTML page elements left in 3D (must be 0) and compositor memory.
 */
async function inkMetrics(page: Page, layout: Layout | null): Promise<Record<string, unknown>> {
  const dom = await page.evaluate(() => ({
    htmlPageElements: document.querySelectorAll('.book-page, .book-paper-dom').length,
    mirrorControls: document.querySelectorAll('.book-mirror button, .book-mirror input').length,
    mirrorPresent: !!document.querySelector('.book-mirror'),
  }));
  const pages = await page.evaluate(() => (window as unknown as { __bookInspector?: { pages(): unknown[] } }).__bookInspector?.pages() ?? []) as InspectorPage[];
  const stats = await page.evaluate(() => (window as unknown as { __bookInspector?: { printStats(): unknown } }).__bookInspector?.printStats() ?? null) as
    { bytes: number; budgetBytes: number; settled: number; drafts: number; states: number; lastDraftMs: number; lastSettledMs: number } | null;
  const result: Record<string, unknown> = { ...dom };
  // v3 R4: the ink figure's segment counts and the frame's draw calls with and without it.
  const figure = await page.evaluate(() => {
    const inspector = (window as unknown as { __bookInspector?: { figure?(): { lift: number; reveal: number; decor: string | null; figure: unknown } | null; sceneDrawCalls?(): unknown } }).__bookInspector;
    const snapshot = inspector?.figure?.() ?? null;
    return snapshot ? { lift: snapshot.lift, reveal: snapshot.reveal, decor: snapshot.decor, stats: snapshot.figure, calls: inspector?.sceneDrawCalls?.() ?? null } : null;
  });
  if (figure) result.figure = figure;
  if (stats) result.print = { MiB: Number((stats.bytes / 1048576).toFixed(2)), budgetMiB: stats.budgetBytes / 1048576, settled: stats.settled, drafts: stats.drafts,
    states: stats.states, lastDraftMs: Number(stats.lastDraftMs.toFixed(2)), lastSettledMs: Number(stats.lastSettledMs.toFixed(2)) };
  if (!layout) return result;
  for (const item of pages) {
    if (!item.side) continue;
    const quad = layout[item.side];
    // Screen pixels per logical page unit: side edges for vertical, top/bottom edges for horizontal.
    const vertical = (distance(quad.tl, quad.bl) + distance(quad.tr, quad.br)) / 2 / PAGE_LOGICAL.height;
    const horizontal = (distance(quad.tl, quad.tr) + distance(quad.bl, quad.br)) / 2 / PAGE_LOGICAL.width;
    const body = PRINT_TYPE.body.size * item.scale * vertical;
    const enabled = item.hotspots.filter(hotspot => hotspot.enabled);
    const minimum = enabled.length ? Math.min(...enabled.map(hotspot => Math.min(hotspot.rect.w * horizontal, hotspot.rect.h * vertical))) : null;
    result[item.side] = { pageId: item.pageId, resolution: item.resolution, layoutScale: item.scale, overflow: Number(item.overflow.toFixed(1)),
      pxPerUnitV: Number(vertical.toFixed(4)), pxPerUnitH: Number(horizontal.toFixed(4)), bodyFontPx: Number(body.toFixed(2)),
      bodyXHeightPx: Number((body * BODY_X_HEIGHT).toFixed(2)), hotspotMinPx: minimum === null ? null : Number(minimum.toFixed(1)), hotspots: enabled.length };
  }
  return result;
}

/**
 * v3 R5 (C1): the toolbar outside the book, its overlap with the book's on-screen bounds, and any
 * other visible button outside the toolbar, the cover controls and the (visually hidden) mirror.
 */
async function chromeMetrics(page: Page, layout: Layout | null): Promise<Record<string, unknown>> {
  const dom = await page.evaluate(() => {
    const shown = (element: Element) => { const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert], [aria-hidden="true"]'); };
    const toolbar = document.querySelector<HTMLElement>('nav.book-toolbar');
    const box = toolbar?.getBoundingClientRect() ?? null;
    const buttons = [...document.querySelectorAll<HTMLElement>('main.book-app button')].filter(button => !button.closest('.book-mirror') && shown(button));
    return {
      toolbarVisible: toolbar ? shown(toolbar) : false,
      toolbarRect: box ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom } : null,
      toolbarButtons: buttons.filter(button => button.closest('nav.book-toolbar')).map(button => {
        const rect = button.getBoundingClientRect();
        return { id: button.dataset.testid ?? '', w: Math.round(rect.width), h: Math.round(rect.height) };
      }),
      coverButtons: buttons.filter(button => button.closest('.book-cover-controls')).length,
      outsideButtons: buttons.filter(button => !button.closest('nav.book-toolbar') && !button.closest('.book-cover-controls'))
        .map(button => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''),
    };
  });
  const bounds = layout?.bookBounds, rect = dom.toolbarRect;
  const overlap = rect && bounds && dom.toolbarVisible
    ? Math.max(0, Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left)) * Math.max(0, Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top)) : null;
  return { ...dom, toolbarHeightPx: rect ? Number((rect.bottom - rect.top).toFixed(1)) : null,
    bookToolbarOverlapPx2: overlap === null ? null : Number(overlap.toFixed(1)),
    bookBottomToToolbarPx: rect && bounds && dom.toolbarVisible ? Number((rect.top - bounds.bottom).toFixed(1)) : null };
}

const captures: Capture[] = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    await context.route(/^https?:\/\//, async route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' && url.port === base.port) await route.continue();
      else await route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = new URL(base);
    url.searchParams.set('renderer', renderer);
    if (quality) url.searchParams.set('quality', quality);
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitFor(page, `document.querySelector('main.book-app')?.dataset.phase === 'coverIdle' && document.querySelector('main.book-app')?.dataset.threeReady === 'true'`, 240_000);
    await nextFrames(page, 6);
    const name = `${viewport.width}x${viewport.height}`;

    // Raw CDP capture of the current composited frame. Playwright's screenshot waits for an extra
    // frame/font settle that can stall for tens of seconds under SwiftShader with a post chain.
    const cdp = await context.newCDPSession(page);
    async function capture(format: 'png' | 'jpeg'): Promise<Buffer> {
      const result = await cdp.send('Page.captureScreenshot', format === 'jpeg' ? { format, quality: 82 } : { format });
      return Buffer.from(result.data, 'base64');
    }
    async function shoot(state: string, open: boolean, extra?: Record<string, unknown>) {
      await nextFrames(page, 3);
      const png = await capture('png');
      const file = `${name}_${state}_${renderer}.jpg`;
      await writeFile(resolve(folder, file), await capture('jpeg'));
      const layout = await readLayout(page);
      const points: Record<string, Point> = {};
      if (layout && open) {
        // Page-local samples in the printed margins (no text): outer edges and both sides of the gutter.
        const left = homographyFromUnitSquare(layout.left), right = homographyFromUnitSquare(layout.right);
        if (left && right) {
          points.leftOuter = applyHomography(left, 0.025, 0.5);
          points.leftGutter = applyHomography(left, 0.975, 0.5);
          points.rightGutter = applyHomography(right, 0.025, 0.5);
          points.rightOuter = applyHomography(right, 0.975, 0.5);
          points.leftPage = applyHomography(left, 0.5, 0.5);
          points.rightPage = applyHomography(right, 0.5, 0.5);
        }
      } else if (layout) points.cover = quadCenter(layout.cover);
      const samples = await luminance(page, png, points);
      if (samples.leftOuter !== undefined && samples.rightOuter !== undefined && samples.leftGutter !== undefined && samples.rightGutter !== undefined) {
        // Relative luminance difference between the outer edges and the gutter (REFACTOR_DESIGN_V3 §3.1: 3–8%).
        const outer = (samples.leftOuter + samples.rightOuter) / 2, gutter = (samples.leftGutter + samples.rightGutter) / 2;
        samples.edgeToGutterPercent = Number(((outer - gutter) / outer * 100).toFixed(2));
        const margins = [samples.leftOuter, samples.leftGutter, samples.rightGutter, samples.rightOuter];
        // Spread of lit paper across the four printed margins: 0 means a flat, unlit sheet.
        samples.paperShadingPercent = Number(((Math.max(...margins) - Math.min(...margins)) / Math.max(...margins) * 100).toFixed(2));
      }
      const ink = renderer === 'ink' && open && ['spread1', 'spread2', 'turn50', 'stamp', 'flap'].includes(state) ? await inkMetrics(page, layout) : undefined;
      const chrome = renderer === 'ink' ? await chromeMetrics(page, layout) : undefined;
      captures.push({ file: `${phase}/${file}`, viewport: name, state, renderer, phase, time: new Date().toISOString(),
        data: await rootData(page), layout: layoutMetrics(layout, open), luminance: samples,
        extra: ink || chrome ? { ...extra, ...(ink ? { ink } : {}), ...(chrome ? { chrome } : {}) } : extra });
      process.stdout.write(`captured ${phase}/${file}\n`);
    }

    if (states.includes('cover')) await shoot('cover', false);
    if (states.includes('opening50')) {
      const posed = await page.evaluate(() => {
        const inspector = (window as unknown as { __bookInspector?: { pose(patch: object): unknown } }).__bookInspector;
        if (!inspector) return false;
        inspector.pose({ coverProgress: 0.5 });
        return true;
      });
      if (posed) {
        await nextFrames(page, 4);
        await shoot('opening50', false, { posedBy: '__bookInspector.pose({coverProgress:0.5})' });
        await page.evaluate(() => (window as unknown as { __bookInspector?: { reset(): void } }).__bookInspector?.reset());
        await nextFrames(page, 4);
      }
    }
    const opened = states.some(state => ['spread1', 'turn50', 'spread2', '2d'].includes(state));
    if (opened) {
      // Open through the real cover control (a first visit has no saved spread to resume).
      const openedBy = await page.evaluate(() => {
        const button = document.querySelector<HTMLButtonElement>('.book-open:not(:disabled), [data-testid="book-open"]:not(:disabled)')
          ?? [...document.querySelectorAll<HTMLButtonElement>('.book-cover-primary:not(:disabled)')].find(item => /처음부터|펼치/.test(item.textContent ?? ''));
        button?.click();
        return button ? button.className || button.textContent : null;
      });
      assert.ok(openedBy, `No enabled cover control: ${JSON.stringify(await rootData(page))}`);
      await waitFor(page, `(() => { const r = document.querySelector('main.book-app'); return r?.dataset.phase === 'spreadIdle' && r?.dataset.scene === 'ready' && r?.dataset.printsReady === 'true'; })()`, 240_000);
      await wait(900);
      if (states.includes('spread1')) await shoot('spread1', true);
    }
    // v3 R5: a 2× crop of the left page (stamp, answer flap).
    async function zoomLeft(label: string): Promise<string | null> {
      const layout = await readLayout(page);
      if (!layout) return null;
      const quad = layout.left, xs = [quad.tl.x, quad.tr.x, quad.br.x, quad.bl.x], ys = [quad.tl.y, quad.tr.y, quad.br.y, quad.bl.y];
      const x = Math.max(0, Math.floor(Math.min(...xs)) - 6), y = Math.max(0, Math.floor(Math.min(...ys)) - 6);
      const width = Math.min(viewport.width - x, Math.ceil(Math.max(...xs)) - x + 6), height = Math.min(viewport.height - y, Math.ceil(Math.max(...ys)) - y + 6);
      const result = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88, clip: { x, y, width, height, scale: 2 } });
      const file = `${name}_${label}_left2x_${renderer}.jpg`;
      await writeFile(resolve(folder, file), Buffer.from(result.data, 'base64'));
      process.stdout.write(`captured ${phase}/${file}\n`);
      return `${phase}/${file}`;
    }
    const mirrorPress = (selector: string) => page.evaluate(css => {
      const element = document.querySelector<HTMLButtonElement | HTMLInputElement>(`.book-mirror ${css}`);
      if (!element || element.disabled) return false;
      element.focus({ preventScroll: true });
      element.click();
      return true;
    }, selector);
    const settledPrints = `(() => { const r = document.querySelector('main.book-app'); const pages = window.__bookInspector?.pages() ?? [];
      return r?.dataset.printsReady === 'true' && pages.every(item => !item.upgrading); })()`;
    if (states.includes('stamp')) {
      // Three right answers through the mirror (the path assistive technology uses); the stamp is derived.
      for (const id of ['page-1:q:same-end:same', 'page-1:q:attacks:1-4', 'page-1:q:attributes:fixed']) {
        const revision = await page.evaluate(() => Number(document.querySelector<HTMLElement>('main.book-app')?.dataset.lessonRevision));
        assert.ok(await mirrorPress(`input[data-hotspot="${id}"]`), `mirror radio ${id}`);
        await waitFor(page, `Number(document.querySelector('main.book-app')?.dataset.lessonRevision) > ${revision}`, 10_000);
      }
      await waitFor(page, `(window.__bookInspector?.pages() ?? []).find(item => item.pageId === 'page-1')?.stamps?.some(stamp => stamp.stamped) === true`, 10_000);
      await waitFor(page, settledPrints, 30_000);
      await nextFrames(page, 4);
      await shoot('stamp', true, { zoom: await zoomLeft('stamp') });
    }
    if (states.includes('flap')) {
      // The answer flap lifts on its top hinge: frames pinned at 0 / 120 / 240 ms (SwiftShader is too slow to sample live).
      await page.evaluate(() => (window as unknown as { __bookInspector: { holdFlaps(ms: number | null): void } }).__bookInspector.holdFlaps(0));
      assert.ok(await mirrorPress('button[data-hotspot="page-1:flap:answer"]'), 'answer flap');
      await waitFor(page, `(window.__bookInspector?.pages() ?? []).find(item => item.pageId === 'page-1')?.flaps?.some(flap => flap.id === 'answer' && flap.open) === true`, 10_000);
      await waitFor(page, settledPrints, 30_000);
      const frames: Record<string, unknown>[] = [];
      for (const ms of [0, 120, 240]) {
        await page.evaluate(value => (window as unknown as { __bookInspector: { holdFlaps(ms: number | null): void } }).__bookInspector.holdFlaps(value), ms);
        await nextFrames(page, 4);
        const angle = await page.evaluate(() => (window as unknown as { __bookInspector: { flapAngles(): Record<string, number> } }).__bookInspector.flapAngles()['page-1:answer'] ?? null);
        frames.push({ ms, angle, file: await zoomLeft(`flap_${String(ms).padStart(3, '0')}ms`) });
      }
      await shoot('flap', true, { frames });
      await page.evaluate(() => (window as unknown as { __bookInspector: { holdFlaps(ms: number | null): void } }).__bookInspector.holdFlaps(null));
      // Lower it again so the later captures match the earlier stages.
      assert.ok(await mirrorPress('button[data-hotspot="page-1:flap:answer"]'), 'answer flap (close)');
      await waitFor(page, `(window.__bookInspector?.pages() ?? []).find(item => item.pageId === 'page-1')?.flaps?.some(flap => flap.id === 'answer' && !flap.open) === true`, 10_000);
      await waitFor(page, `(window.__bookInspector?.flapAngles() ?? {})['page-1:answer'] === 0`, 10_000);
      await waitFor(page, settledPrints, 30_000);
    }
    if (states.includes('turn50')) {
      const layout = await readLayout(page);
      assert.ok(layout, 'An open layout is required for the drag capture.');
      const corner = layout.right.br;
      const along = (to: Point, px: number) => { const length = distance(corner, to) || 1; return { x: (to.x - corner.x) / length * px, y: (to.y - corner.y) / length * px }; };
      const spine = { x: (layout.right.tl.x + layout.right.bl.x) / 2, y: (layout.right.tl.y + layout.right.bl.y) / 2 };
      let start: Point | null = null;
      // Probe points inside the 44 px corner grab: page scrollbars and lesson controls own their pixels.
      for (const [insetX, insetY] of [[30, 12], [12, 8], [20, 30], [36, 36], [8, 20], [40, 6]]) {
        const inwardX = along(layout.right.bl, insetX), inwardY = along(layout.right.tr, insetY);
        const candidate = { x: corner.x + inwardX.x + inwardY.x, y: corner.y + inwardX.y + inwardY.y };
        await page.mouse.move(candidate.x, candidate.y);
        await page.mouse.down();
        await page.mouse.move(candidate.x - 16, candidate.y);
        await wait(60);
        const active = await page.evaluate(() => document.querySelector<HTMLElement>('main.book-app')?.dataset.dragActive === 'true');
        if (active) { start = candidate; break; }
        await page.mouse.up();
        await wait(200);
      }
      assert.ok(start, 'No direct drag could start inside the page corner.');
      const from = start;
      for (let step = 1; step <= 24; step += 1) {
        const t = step / 24;
        await page.mouse.move(from.x + (spine.x - from.x) * t, from.y + (spine.y - from.y) * t * 0.3);
        await wait(16);
      }
      await wait(400);
      const turn = await page.evaluate(() => JSON.parse(document.querySelector<HTMLElement>('main.book-app')?.dataset.visual ?? '{}').turn ?? null);
      await shoot('turn50', true, { heldTurn: turn });
      for (let step = 23; step >= 0; step -= 1) {
        const t = step / 24;
        await page.mouse.move(from.x + (spine.x - from.x) * t, from.y + (spine.y - from.y) * t * 0.3);
        await wait(12);
      }
      await page.mouse.up();
      await waitFor(page, `(() => { const r = document.querySelector('main.book-app'); return r?.dataset.phase === 'spreadIdle' && r?.dataset.scene === 'ready' && r?.dataset.spread === 'spread-1'; })()`, 120_000);
      await wait(600);
    }
    if (states.includes('spread2')) {
      await page.locator('main.book-app').focus().catch(() => undefined);
      await page.evaluate(() => {
        const heading = document.querySelector<HTMLElement>('[data-active-page="true"] h1, .book-mirror h1');
        heading?.focus({ preventScroll: true });
      });
      await page.keyboard.press('ArrowRight');
      await waitFor(page, `(() => { const r = document.querySelector('main.book-app'); return r?.dataset.spread === 'spread-2' && r?.dataset.phase === 'spreadIdle' && r?.dataset.scene === 'ready' && r?.dataset.printsReady === 'true'; })()`, 240_000);
      await wait(900);
      await shoot('spread2', true);
    }
    if (states.includes('2d')) {
      const clicked = await page.evaluate(() => {
        // Prepared (off-screen) pages also contain this control; use the one the reader can see.
        const candidates = [...document.querySelectorAll<HTMLElement>('[data-testid="reading-mode"]')];
        const visible = candidates.find(element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight && !element.closest('[inert]');
        }) ?? candidates.find(element => !element.closest('[inert]'));
        visible?.click();
        return !!visible;
      });
      assert.ok(clicked, 'A reading-mode control is required for the 2D capture.');
      await waitFor(page, `document.querySelector('main.book-app')?.dataset.phase === 'fallback2D'`, 120_000);
      await wait(600);
      await shoot('2d', false);
    }
    if (errors.length) process.stdout.write(`page errors at ${name}: ${errors.join(' | ')}\n`);
    captures.push({ file: '', viewport: name, state: 'errors', renderer, phase, time: new Date().toISOString(), data: {}, extra: { errors } });
    await context.close();
  }
} finally {
  await browser.close();
}

let existing: Capture[] = [];
try { existing = JSON.parse(await readFile(metricsFile, 'utf8')) as Capture[]; } catch { existing = []; }
const keep = existing.filter(item => !(item.phase === phase && item.renderer === renderer && viewports.some(v => `${v.width}x${v.height}` === item.viewport)
  && (item.state === 'errors' || states.includes(item.state))));
await writeFile(metricsFile, `${JSON.stringify([...keep, ...captures], null, 2)}\n`);
process.stdout.write(`metrics: ${metricsFile}\n`);
