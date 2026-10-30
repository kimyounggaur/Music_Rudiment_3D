/**
 * v3 refactor before/after capture (REFACTOR_PROMPTS_V3 §5).
 *
 *   node scripts/refactor-capture.ts --stage R1 --phase after --renderer ink
 *
 * Drives the real app on the local dev server (127.0.0.1 only, external requests blocked):
 * cover, inspector-posed half-open cover, opened first spread, a held direct drag at about
 * half a turn, the second spread after ArrowRight, and the 2D reading book. Each capture records
 * layout metrics from the app's own data-layout and pixel luminance from the screenshot.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';

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
    await waitFor(page, `document.querySelector('main.book-app')?.dataset.phase === 'coverIdle' && document.querySelector('main.book-app')?.dataset.threeReady === 'true'`, 60_000);
    await nextFrames(page, 6);
    const name = `${viewport.width}x${viewport.height}`;

    async function shoot(state: string, open: boolean, extra?: Record<string, unknown>) {
      await nextFrames(page, 3);
      const png = await page.screenshot({ type: 'png' });
      const file = `${name}_${state}_${renderer}.jpg`;
      await writeFile(resolve(folder, file), await page.screenshot({ type: 'jpeg', quality: 82 }));
      const layout = await readLayout(page);
      const points: Record<string, Point> = {};
      if (layout && open) {
        points.leftPage = quadCenter(layout.left);
        points.rightPage = quadCenter(layout.right);
        points.spine = { x: (layout.left.tr.x + layout.left.br.x + layout.right.tl.x + layout.right.bl.x) / 4 + 6,
          y: (layout.left.tr.y + layout.left.br.y + layout.right.tl.y + layout.right.bl.y) / 4 };
        points.leftOuter = { x: layout.left.tl.x * 0.85 + layout.left.tr.x * 0.15, y: (layout.left.tl.y + layout.left.bl.y) / 2 };
        points.rightOuter = { x: layout.right.tr.x * 0.85 + layout.right.tl.x * 0.15, y: (layout.right.tr.y + layout.right.br.y) / 2 };
      } else if (layout) points.cover = quadCenter(layout.cover);
      captures.push({ file: `${phase}/${file}`, viewport: name, state, renderer, phase, time: new Date().toISOString(),
        data: await rootData(page), layout: layoutMetrics(layout, open), luminance: await luminance(page, png, points), extra });
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
      const openButton = page.locator('.book-open, [data-testid="book-open"]').first();
      await openButton.click({ force: true });
      await waitFor(page, `(() => { const r = document.querySelector('main.book-app'); return r?.dataset.phase === 'spreadIdle' && r?.dataset.scene === 'ready' && r?.dataset.printsReady === 'true'; })()`, 60_000);
      await wait(900);
      if (states.includes('spread1')) await shoot('spread1', true);
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
      await waitFor(page, `(() => { const r = document.querySelector('main.book-app'); return r?.dataset.phase === 'spreadIdle' && r?.dataset.scene === 'ready' && r?.dataset.spread === 'spread-1'; })()`, 30_000);
      await wait(600);
    }
    if (states.includes('spread2')) {
      await page.locator('main.book-app').focus().catch(() => undefined);
      await page.evaluate(() => {
        const heading = document.querySelector<HTMLElement>('[data-active-page="true"] h1, .book-mirror h1');
        heading?.focus({ preventScroll: true });
      });
      await page.keyboard.press('ArrowRight');
      await waitFor(page, `(() => { const r = document.querySelector('main.book-app'); return r?.dataset.spread === 'spread-2' && r?.dataset.phase === 'spreadIdle' && r?.dataset.scene === 'ready' && r?.dataset.printsReady === 'true'; })()`, 60_000);
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
      await waitFor(page, `document.querySelector('main.book-app')?.dataset.phase === 'fallback2D'`, 30_000);
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
