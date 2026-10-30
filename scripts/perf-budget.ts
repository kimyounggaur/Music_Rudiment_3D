/**
 * v3 R9 performance budget (REFACTOR_DESIGN_V3 §6 R9, REFACTOR_PROMPTS_V3 R9-a 2).
 *
 *   node scripts/perf-budget.ts [--base http://127.0.0.1:4173/] [--viewport 1280x720] [--trips 50]
 *                               [--out docs/qa/refactor/R9/perf-budget.json]
 *
 * Drives the real app on the local dev server and checks the budget:
 *   - first open spread: draw calls ≤ 150, the lesson scene's own draw calls ≤ 40;
 *   - print textures ≤ 48 MiB (the page compositor's window);
 *   - a button turn: p95 frame interval ≤ 33 ms — recorded only: headless SwiftShader renders in
 *     software (0.5–3 s a frame), so the value is a reference, never a pass/fail;
 *   - after N round trips (reduced motion), renderer geometries, textures and programs do not grow.
 * Exits 1 when a gated budget fails.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index]!.replace(/^--/, ''), process.argv[index + 1] ?? '');
const base = new URL(args.get('base') ?? 'http://127.0.0.1:4173/');
assert.equal(base.hostname, '127.0.0.1', 'The budget uses the local dev server only.');
const [width, height] = (args.get('viewport') ?? '1280x720').split('x').map(Number) as [number, number];
const trips = Number(args.get('trips') ?? 50);
const out = resolve(args.get('out') ?? 'docs/qa/refactor/R9/perf-budget.json');
const MIB = 1024 * 1024;
const BUDGET = Object.freeze({ drawCalls: 150, sceneDrawCalls: 40, printBytes: 48 * MIB, p95FrameMs: 33 });

type Check = { name: string; value: unknown; limit: unknown; pass: boolean; gated: boolean; note?: string };
const checks: Check[] = [];
const check = (name: string, value: unknown, limit: unknown, pass: boolean, gated = true, note?: string) => {
  checks.push({ name, value, limit, pass, gated, ...(note ? { note } : {}) });
  process.stdout.write(`${gated ? (pass ? 'PASS' : 'FAIL') : 'INFO'} ${name}: ${JSON.stringify(value)} (limit ${JSON.stringify(limit)})${note ? ` — ${note}` : ''}\n`);
};

const dataset = (page: Page) => page.evaluate(() => ({ ...document.querySelector<HTMLElement>('main.book-app')!.dataset }));
async function idle(page: Page, spread: string, timeout = 240_000) {
  await page.waitForFunction(id => { const r = document.querySelector<HTMLElement>('main.book-app')?.dataset;
    return r?.spread === id && r.phase === 'spreadIdle' && r.scene === 'ready' && r.printsReady === 'true'; }, spread, { timeout, polling: 100 });
}
const frames = (page: Page, count: number) => page.evaluate(n => new Promise(done => {
  let left = n;
  const tick = () => { left -= 1; if (left <= 0) done(null); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}), count);
const resources = async (page: Page) => {
  const data = await dataset(page);
  return { geometries: Number(data.geometries), textures: Number(data.textures), programs: Number(data.programs) };
};

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors: string[] = [];
let report: Record<string, unknown> = {};
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await context.route(/^https?:\/\//, async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && url.port === base.port) await route.continue();
    else await route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(new URL('/?quality=high', base).toString(), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const r = document.querySelector<HTMLElement>('main.book-app')?.dataset; return r?.phase === 'coverIdle' && r.threeReady === 'true'; }, undefined, { timeout: 240_000, polling: 200 });
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('.book-open:not(:disabled)')!.click());
  await idle(page, 'spread-1');
  await page.waitForFunction(() => ((window as unknown as { __bookInspector: { pages(): { upgrading: boolean }[] } }).__bookInspector.pages()).every(item => !item.upgrading), undefined, { timeout: 30_000, polling: 100 });
  await frames(page, 4);

  // --- First open spread: whole frame and the scene's own draw calls (the stage renders once without the figure).
  const first = await dataset(page);
  const sceneCalls = await page.evaluate(() => (window as unknown as { __bookInspector: { sceneDrawCalls(): { total: number; withoutScene: number; scene: number } | null } }).__bookInspector.sceneDrawCalls());
  check('first spread draw calls', Number(first.drawCalls), `≤ ${BUDGET.drawCalls}`, Number(first.drawCalls) <= BUDGET.drawCalls);
  check('lesson scene draw calls', sceneCalls?.scene ?? null, `≤ ${BUDGET.sceneDrawCalls}`, !!sceneCalls && sceneCalls.scene <= BUDGET.sceneDrawCalls);
  const stats = await page.evaluate(() => (window as unknown as { __bookInspector: { printStats(): { bytes: number; pages: number; settled: number; drafts: number; states: number } } }).__bookInspector.printStats());
  check('print textures (page compositor window)', Number((stats.bytes / MIB).toFixed(2)), `≤ ${BUDGET.printBytes / MIB} MiB`, stats.bytes <= BUDGET.printBytes, true,
    `${stats.pages} pages: ${stats.settled} settled, ${stats.drafts} draft, ${stats.states} state layers`);

  // --- A button turn: frame intervals while the leaf moves (reference only under SwiftShader).
  await page.evaluate(() => {
    const samples: number[] = [];
    (window as unknown as { __frames: number[] }).__frames = samples;
    let last = 0;
    const tick = (now: number) => {
      const phase = document.querySelector<HTMLElement>('main.book-app')?.dataset.phase ?? '';
      if (phase === 'turningForward' && last) samples.push(now - last);
      last = now;
      if (samples.length < 2000 && phase !== 'settling') requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    document.querySelector<HTMLButtonElement>('[data-testid="book-next"]')!.click();
  });
  await idle(page, 'spread-2');
  const intervals = (await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames.slice())).sort((a, b) => a - b);
  const p95 = intervals.length ? intervals[Math.min(intervals.length - 1, Math.ceil(intervals.length * 0.95) - 1)]! : null;
  check('turn p95 frame interval', p95 === null ? null : Math.round(p95), `≤ ${BUDGET.p95FrameMs} ms`, p95 !== null && p95 <= BUDGET.p95FrameMs, false,
    `headless SwiftShader reference only (${intervals.length} frames); real devices are a human check`);

  // --- N round trips with reduced motion: renderer resources must not grow.
  // A media change reaches the page at its next rendering update: ask for frames until the book has it.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => { requestAnimationFrame(() => undefined); return document.querySelector<HTMLElement>('main.book-app')?.dataset.reducedMotion === 'true'; },
    undefined, { timeout: 30_000, polling: 100 });
  const before = await resources(page);
  for (let trip = 0; trip < trips; trip += 1) {
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="book-next"]')!.click());
    await idle(page, 'spread-3', 60_000);
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="book-prev"]')!.click());
    await idle(page, 'spread-2', 60_000);
  }
  await page.waitForFunction(() => ((window as unknown as { __bookInspector: { pages(): { upgrading: boolean }[] } }).__bookInspector.pages()).every(item => !item.upgrading), undefined, { timeout: 30_000, polling: 100 });
  await frames(page, 4);
  const after = await resources(page);
  for (const key of ['geometries', 'textures', 'programs'] as const) {
    check(`${key} after ${trips} round trips`, { before: before[key], after: after[key] }, 'growth 0', Number.isFinite(after[key]) && after[key] <= before[key]);
  }
  check('page errors', errors.length, 0, errors.length === 0);
  report = { budget: { ...BUDGET, printBytes: `${BUDGET.printBytes / MIB} MiB` }, first: { drawCalls: Number(first.drawCalls), sceneCalls, textures: Number(first.textures), geometries: Number(first.geometries) },
    print: stats, turn: { frames: intervals.length, p95, median: intervals[Math.floor(intervals.length / 2)] ?? null }, trips: { count: trips, before, after }, errors: errors.slice(0, 8) };
  await context.close();
} catch (reason) {
  check('perf run completed', reason instanceof Error ? reason.message : String(reason), 'no exception', false);
} finally {
  await browser.close();
}
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify({ time: new Date().toISOString(), viewport: `${width}x${height}`, checks, ...report }, null, 2)}\n`);
const failed = checks.filter(item => item.gated && !item.pass);
process.stdout.write(`${checks.filter(item => item.gated).length - failed.length}/${checks.filter(item => item.gated).length} gated budgets passed → ${out}\n`);
process.exitCode = failed.length ? 1 : 0;
