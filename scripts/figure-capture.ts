/**
 * v3 R4 ink figure evidence (REFACTOR_PROMPTS_V3 R4-d 4–5).
 *
 *   node scripts/figure-capture.ts [--base http://127.0.0.1:4173/] [--viewport 1280x720] [--out docs/qa/refactor/R4]
 *
 * Drives the real app on the local dev server (external requests blocked) and records:
 * - the first-entry sequence, 12 frames at 0, 60 … 660 ms, posed with __bookInspector.figureEntry
 *   (the same timeline BookApp plays), cropped to the right page, plus a contact sheet;
 * - a playback frame (playing note glow + playhead) without audio (figurePlayback);
 * - the split stroke on spread 2 held at 0, 120 and 240 ms after a real press of the printed control's
 *   mirror button (holdFigureStrokes);
 * - ink line widths measured on the screenshot (darkness FWHM across the axis, a tick and a block edge)
 *   with a 400% crop; scene draw calls with/without the figure and segment counts.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { CDPSession, Page } from 'playwright';

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index]!.replace(/^--/, ''), process.argv[index + 1] ?? '');
const base = new URL(args.get('base') ?? 'http://127.0.0.1:4173/');
const [vw, vh] = (args.get('viewport') ?? '1280x720').split('x').map(Number) as [number, number];
const out = resolve(args.get('out') ?? 'docs/qa/refactor/R4');
const name = `${vw}x${vh}`;
await mkdir(resolve(out, 'after'), { recursive: true });

type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
const ENTRY_FRAMES = Array.from({ length: 12 }, (_, index) => index * 60);

async function waitFor(page: Page, predicate: string, timeout = 240_000) {
  await page.waitForFunction(predicate, undefined, { timeout, polling: 100 });
}
async function frames(page: Page, count = 3) {
  await page.evaluate(n => new Promise<void>(done => { let left = n; const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), count);
}
async function png(cdp: CDPSession): Promise<Buffer> {
  return Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64');
}
/** Crop (and optionally scale with nearest-neighbour) a PNG in the page; returns JPEG or PNG bytes. */
async function crop(page: Page, image: Buffer, box: Box, scale = 1, type: 'jpeg' | 'png' = 'jpeg'): Promise<Buffer> {
  const url = await page.evaluate(async ({ data, box, scale, type }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(box.w * scale); canvas.height = Math.round(box.h * scale);
    const context = canvas.getContext('2d')!;
    context.imageSmoothingEnabled = false;
    context.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(type === 'jpeg' ? 'image/jpeg' : 'image/png', 0.85);
  }, { data: image.toString('base64'), box, scale, type });
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}
async function sheet(page: Page, images: Buffer[], columns: number, labels: string[]): Promise<Buffer> {
  const url = await page.evaluate(async ({ list, columns, labels }) => {
    const loaded = await Promise.all(list.map(async data => { const img = new Image(); img.src = `data:image/jpeg;base64,${data}`; await img.decode(); return img; }));
    const w = loaded[0]!.width, h = loaded[0]!.height, rows = Math.ceil(loaded.length / columns);
    const canvas = document.createElement('canvas');
    canvas.width = w * columns; canvas.height = h * rows;
    const context = canvas.getContext('2d')!;
    loaded.forEach((img, index) => {
      const x = (index % columns) * w, y = Math.floor(index / columns) * h;
      context.drawImage(img, x, y);
      context.fillStyle = 'rgba(255,255,255,0.85)'; context.fillRect(x + 4, y + 4, 64, 18);
      context.fillStyle = '#222'; context.font = '12px sans-serif'; context.fillText(labels[index]!, x + 8, y + 17);
    });
    return canvas.toDataURL('image/jpeg', 0.85);
  }, { list: images.map(image => image.toString('base64')), columns, labels });
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}
/**
 * Ink line width: at `samples` points along the segment a→b, the darkness profile perpendicular to
 * the line (±3 px, bilinear, 0.1 px steps) gives a full width at half of the line's depth below the
 * paper. A 1.4 px line covers one or two pixel rows depending on its sub-pixel phase, so the widths
 * along a slightly slanted line are averaged; profiles touched by a neighbouring mark are dropped.
 */
async function lineWidth(page: Page, image: Buffer, a: Point, b: Point, samples = 15) {
  return page.evaluate(async ({ data, a, b, samples }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(img, 0, 0);
    const pixels = context.getImageData(0, 0, img.width, img.height).data;
    const at = (x: number, y: number) => { const i = (y * img.width + x) * 4; return 0.2126 * pixels[i]! + 0.7152 * pixels[i + 1]! + 0.0722 * pixels[i + 2]!; };
    const lum = (x: number, y: number) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
    };
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
    const step = 0.1, reach = 3;
    const widths: number[] = [];
    let dropped = 0;
    for (let k = 0; k < samples; k += 1) {
      const s = 0.15 + 0.7 * k / Math.max(1, samples - 1);
      const cx = a.x + (b.x - a.x) * s, cy = a.y + (b.y - a.y) * s;
      const profile: number[] = [];
      for (let t = -reach; t <= reach + 1e-9; t += step) profile.push(lum(cx + nx * t, cy + ny * t));
      const ends = [profile[0]!, profile.at(-1)!];
      // A neighbouring mark at either end of the profile: not an isolated line.
      if (Math.abs(ends[0]! - ends[1]!) > 0.12 * Math.max(...ends)) { dropped += 1; continue; }
      const background = Math.max(...ends);
      let minIndex = 0;
      profile.forEach((value, index) => { if (value < profile[minIndex]!) minIndex = index; });
      const depth = background - profile[minIndex]!;
      if (depth < 15) { dropped += 1; continue; }
      const half = background - depth / 2;
      let left = minIndex, right = minIndex;
      while (left > 0 && profile[left]! < half) left -= 1;
      while (right < profile.length - 1 && profile[right]! < half) right += 1;
      if (left === 0 || right === profile.length - 1) { dropped += 1; continue; }
      const cross = (i: number, j: number) => i + (half - profile[i]!) / ((profile[j]! - profile[i]!) || 1) * (j - i);
      widths.push((cross(right - 1, right) - cross(left + 1, left)) * step);
    }
    const mean = widths.reduce((sum, value) => sum + value, 0) / Math.max(1, widths.length);
    return { meanPx: Number(mean.toFixed(2)), minPx: Number(Math.min(...widths).toFixed(2)), maxPx: Number(Math.max(...widths).toFixed(2)), samples: widths.length, dropped };
  }, { data: image.toString('base64'), a, b, samples });
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report: Record<string, unknown> = { viewport: name, time: new Date().toISOString(), entryFramesMs: ENTRY_FRAMES };
try {
  const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  await context.route(/^https?:\/\//, async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && url.port === base.port) await route.continue();
    else await route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = new URL(base);
  url.searchParams.set('quality', 'high');
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitFor(page, `document.querySelector('main.book-app')?.dataset.phase === 'coverIdle' && document.querySelector('main.book-app')?.dataset.threeReady === 'true'`);
  const cdp = await context.newCDPSession(page);
  const opened = await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('.book-open:not(:disabled), [data-testid="book-open"]:not(:disabled)')
      ?? [...document.querySelectorAll<HTMLButtonElement>('.book-cover-primary:not(:disabled)')].find(item => /처음부터|펼치/.test(item.textContent ?? ''));
    button?.click();
    return !!button;
  });
  assert.ok(opened, 'no enabled cover control');
  const ready = (spread: string) => waitFor(page, `(() => { const r = document.querySelector('main.book-app'); return r?.dataset.spread === '${spread}' && r?.dataset.phase === 'spreadIdle' && r?.dataset.scene === 'ready' && r?.dataset.printsReady === 'true'; })()`);
  await ready('spread-1');
  await frames(page, 4);

  type Inspector = {
    snapshot(): { layout: { right: Record<'tl' | 'tr' | 'br' | 'bl', Point> } | null };
    figure(): { lanes: { laneId: string; transition: unknown }[]; lift: number; reveal: number; figure: Record<string, number> } | null;
    figureEntry(ms: number): unknown; reset(): void; holdFigureStrokes(ms: number | null): void;
    figurePlayback(laneId: string | null, activeIndex?: number | null, position?: number): void;
    sceneDrawCalls(): unknown; figurePoints(laneId: string, points: [number, number, number][]): (Point | null)[];
  };
  const inspect = <T>(fn: (inspector: Inspector, arg: unknown) => T, arg?: unknown) =>
    page.evaluate(({ source, arg }) => {
      const inspector = (window as unknown as { __bookInspector: unknown }).__bookInspector;
      return (new Function('inspector', 'arg', `return (${source})(inspector, arg);`))(inspector, arg);
    }, { source: fn.toString(), arg }) as Promise<T>;
  // Crop: the upper part of the right page, where the figure is printed.
  const rightBox = async (): Promise<Box> => {
    const quad = (await inspect(inspector => inspector.snapshot().layout?.right ?? null))!;
    const xs = [quad.tl.x, quad.tr.x, quad.br.x, quad.bl.x], ys = [quad.tl.y, quad.tr.y, quad.br.y, quad.bl.y];
    const x = Math.max(0, Math.floor(Math.min(...xs)) - 4), y = Math.max(0, Math.floor(Math.min(...ys)) - 4);
    const w = Math.min(vw - x, Math.ceil(Math.max(...xs)) - x + 4), full = Math.ceil(Math.max(...ys)) - y + 4;
    return { x, y, w, h: Math.min(vh - y, Math.round(full * 0.62)) };
  };

  // 1. Entry sequence (spread 1, first visit timeline).
  const box = await rightBox();
  const entry: Buffer[] = [];
  const entryState: unknown[] = [];
  for (const ms of ENTRY_FRAMES) {
    await inspect((inspector, value) => inspector.figureEntry(value as number), ms);
    await frames(page, 3);
    const image = await crop(page, await png(cdp), box);
    entry.push(image);
    await writeFile(resolve(out, 'after', `${name}_entry_${String(ms).padStart(3, '0')}ms_ink.jpg`), image);
    entryState.push({ ms, ...(await inspect(inspector => { const f = inspector.figure(); return f ? { lift: Number(f.lift.toFixed(3)), reveal: Number(f.reveal.toFixed(3)) } : null; })) });
  }
  await inspect(inspector => inspector.reset());
  await frames(page, 3);
  await writeFile(resolve(out, 'after', `${name}_entry_sheet_ink.jpg`), await sheet(page, entry, 4, ENTRY_FRAMES.map(ms => `${ms} ms`)));
  report.entry = entryState;

  // 2. Line widths and scene budget on the settled spread 1.
  const settled = await png(cdp);
  const lanePoints = (lane: string, list: [number, number, number][]) =>
    inspect((inspector, value) => { const [laneId, points] = value as [string, [number, number, number][]]; return inspector.figurePoints(laneId, points); }, [lane, list]);
  const [tickA, tickB, backA, backB] = (await lanePoints('lower', [[2.5, 0, 0.62], [2.5, 0, 0.85], [2.8, 0.38, -0.45], [4.7, 0.38, -0.45]]))!;
  const [axisA, axisB] = (await lanePoints('upper', [[5.6, 0, 0.64], [7.2, 0, 0.64]]))!;
  const measure = async (label: string, a: Point | null, b: Point | null) =>
    a && b ? { label, a, b, ...(await lineWidth(page, settled, a, b)) } : { label, error: 'not projected' };
  const widths = [await measure('tick (ink on the paper, vertical)', tickA!, tickB!), await measure('axis (ink on the paper, horizontal)', axisA!, axisB!),
    await measure('block top back edge (standing)', backA!, backB!)];
  report.lineWidths = widths;
  // 400% crops (nearest neighbour) around each measured line.
  const slugs = ['tick', 'axis', 'edge'];
  for (const [index, pair] of [[tickA, tickB], [axisA, axisB], [backA, backB]].entries()) {
    const [a, b] = pair as [Point | null, Point | null];
    if (!a || !b) continue;
    const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    await writeFile(resolve(out, `linewidth-${name}-${slugs[index]}-400pct.png`), await crop(page, settled, { x: Math.round(centre.x - 30), y: Math.round(centre.y - 18), w: 60, h: 36 }, 4, 'png'));
  }
  report.spread1 = { calls: await inspect(inspector => inspector.sceneDrawCalls()), figure: await inspect(inspector => inspector.figure()?.figure ?? null) };

  // 3. Playback display: the third quarter of the lower lane glows, the playhead at 0.6.
  await inspect(inspector => inspector.figurePlayback('lower', 2, 0.6));
  await frames(page, 3);
  await writeFile(resolve(out, 'after', `${name}_glow_ink.jpg`), await crop(page, await png(cdp), box));
  await inspect(inspector => inspector.figurePlayback(null));

  // 4. Spread 2: a real split, with the stroke held at 0 / 120 / 240 ms.
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="book-next"]')?.click());
  await ready('spread-2');
  await frames(page, 4);
  const box2 = await rightBox();
  await writeFile(resolve(out, 'after', `${name}_split_before_ink.jpg`), await crop(page, await png(cdp), box2));
  report.spread2 = { calls: await inspect(inspector => inspector.sceneDrawCalls()), figure: await inspect(inspector => inspector.figure()?.figure ?? null) };
  await inspect(inspector => inspector.holdFigureStrokes(0));
  const before = await page.evaluate(() => document.querySelector('main.book-app')?.getAttribute('data-print-generation'));
  const pressed = await page.evaluate(() => { const button = document.querySelector<HTMLButtonElement>('[data-testid="split-note"]'); button?.click(); return !!button && !button.disabled; });
  assert.ok(pressed, 'split control missing or disabled');
  await page.waitForFunction(() => {
    const inspector = (window as unknown as { __bookInspector: { figure(): { lanes: { transition: unknown }[] } | null } }).__bookInspector;
    return !!inspector.figure()?.lanes[0]?.transition;
  }, undefined, { timeout: 60_000, polling: 100 });
  const split: Record<string, unknown> = { printGenerationBefore: before };
  for (const ms of [0, 120, 240]) {
    await inspect((inspector, value) => inspector.holdFigureStrokes(value as number), ms);
    await frames(page, 3);
    await writeFile(resolve(out, 'after', `${name}_split_${String(ms).padStart(3, '0')}ms_ink.jpg`), await crop(page, await png(cdp), box2));
    split[`${ms}ms`] = await inspect(inspector => inspector.figure()?.lanes[0]?.transition ?? null);
  }
  await inspect(inspector => inspector.holdFigureStrokes(null));
  await frames(page, 3);
  split.after = await inspect(inspector => inspector.figure()?.lanes[0]?.transition ?? null);
  report.split = split;
  report.errors = errors;
  await writeFile(resolve(out, `figure-${name}.json`), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ viewport: name, lineWidths: widths.map(item => (item as { meanPx?: number }).meanPx), spread1: report.spread1, spread2: report.spread2, errors })}\n`);
} finally { await browser.close(); }
