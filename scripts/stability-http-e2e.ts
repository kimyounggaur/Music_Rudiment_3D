import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';
import type { Browser, BrowserContext, CDPSession, Page } from 'playwright';

const BASE = 'http://127.0.0.1:4174/';
const REQUIRED_MS = 900_000;
const PERIOD_MS = 30_000;
const CYCLES = 30;
const EXPECTED_INDEX = (process.env.LAB_EXPECTED_HTTP_INDEX_SHA256 ?? '6d4ca09b0288cdd5bdf376fbdc7168e13e432bdb919f6b6151d7f348ad08383d').toLowerCase();
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? 'C:/Users/kimyo/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe';
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
assert.equal(process.env.LAB_HTTP_RUN_AUTHORIZED, '1', 'Root must explicitly dispatch the already approved HTTP run.');
assert.match(EXPECTED_INDEX, /^[a-f0-9]{64}$/);
assert.match(EXECUTABLE.replaceAll('\\', '/'), /\/(?:chromium|chromium_headless_shell)-1223\//, 'Use the known Chromium 1223 binary only.');
assert.equal(sha256(await readFile('dist/index.html')), EXPECTED_INDEX, 'Freeze the assigned built index before launch.');

type OscillatorRecord = { id: number; context: number; createdAt: number; startAt: number | null; stopAt: number | null; ended: boolean };
type AudioAudit = { contextsCreated: number; oscillatorsCreated: number; records: OscillatorRecord[]; contexts: { state: string; currentTime: number }[] };
type Sample = { cycle: number; elapsedMs: number; cycleDurationMs: number; gapFromPreviousCycleMs: number | null; idleRenderCounts: number[]; audio: AudioAudit; metrics: Record<string, number>; geometryCount: number; pattern: string };

const startedAt = new Date().toISOString();
const output = resolve(`output/http/stability-${EXPECTED_INDEX.slice(0, 8)}-${startedAt.replace(/[:.]/g, '-')}`);
await mkdir(resolve(output, 'samples'), { recursive: true });
const samples: Sample[] = [];
const pageErrors: string[] = [];
const consoleErrors: string[] = [];
const failedRequests: string[] = [];
const unexpectedRequests: string[] = [];
const failedResponses: { url: string; status: number }[] = [];
let browser: Browser | undefined;
let context: BrowserContext | undefined;
let page: Page | undefined;
let cdp: CDPSession | undefined;
let measuredStart: number | null = null;
let previousCycleStart: number | null = null;
let phase = 'preflight';
let status: 'running' | 'passed' | 'failed' = 'running';
let failure: string | null = null;
let servedStartSha256 = '';
let servedEndSha256 = '';

async function checkpoint(): Promise<void> {
  await writeFile(resolve(output, 'checkpoint.json'), JSON.stringify({ status, phase, startedAt, expectedIndexSha256: EXPECTED_INDEX,
    measuredElapsedMs: measuredStart === null ? 0 : performance.now() - measuredStart, completedCycles: samples.length,
    pageErrors, consoleErrors, failedRequests, unexpectedRequests, failedResponses, failure }, null, 2));
}
function assertNoErrors(): void {
  assert.deepEqual(pageErrors, [], 'No uncaught page errors.');
  assert.deepEqual(consoleErrors, [], 'No browser console errors.');
  assert.deepEqual(failedRequests, [], 'No failed requests.');
  assert.deepEqual(unexpectedRequests, [], 'No external origin or non-GET request.');
  assert.deepEqual(failedResponses, [], 'No HTTP resource failures.');
}
async function audio(): Promise<AudioAudit> {
  return page!.evaluate(() => {
    const audit = Reflect.get(window, '__stabilityAudioAudit') as Omit<AudioAudit, 'contexts'>;
    const contexts = Reflect.get(window, '__stabilityAudioContexts') as AudioContext[];
    return { ...audit, contexts: contexts.map(item => ({ state: item.state, currentTime: item.currentTime })) };
  });
}
function assertNoIntervalsOverlap(audit: AudioAudit): void {
  for (let id = 1; id <= audit.contextsCreated; id++) {
    const intervals = audit.records.filter(item => item.context === id && item.startAt !== null && item.stopAt !== null && item.stopAt > item.startAt)
      .map(item => ({ start: item.startAt!, end: item.stopAt!, id: item.id })).sort((a, b) => a.start - b.start);
    for (let i = 1; i < intervals.length; i++) assert.ok(intervals[i].start >= intervals[i - 1].end - 0.004,
      `Native oscillator intervals must not overlap: ${intervals[i - 1].id}/${intervals[i].id}`);
  }
}
async function waitStopped(): Promise<AudioAudit> {
  const deadline = performance.now() + 6000;
  while (performance.now() < deadline) {
    const value = await audio();
    if (!(await page!.getByRole('button', { name: /소리 켜고 재생/ }).isDisabled()) && value.records.every(item => item.startAt === null || item.ended)) return value;
    await page!.waitForTimeout(50);
  }
  assert.fail('Stop must leave zero live oscillators, including previously scheduled future sources.');
}
async function pattern(): Promise<string> {
  await page!.waitForTimeout(350);
  return page!.evaluate(() => {
    const raw = localStorage.getItem('music-theory-lab:duration-basics:progress');
    if (!raw) throw new Error('Expected this context\'s saved lesson.');
    const saved = JSON.parse(raw) as { studentPatterns: Record<string, unknown> };
    return JSON.stringify(saved.studentPatterns['scene-2/main']);
  });
}
async function readyCanvas(): Promise<void> {
  await page!.locator('[data-three-status="ready"] canvas[data-three-ready="true"][data-renderer="three-webgl"]').waitFor({ timeout: 20000 });
  assert.equal(await page!.locator('canvas[data-three-canvas]').count(), 1);
}
async function idleRenderCount(): Promise<number> {
  const canvas = page!.locator('canvas[data-three-canvas]');
  await canvas.scrollIntoViewIfNeeded();
  await page!.waitForTimeout(200);
  const before = Number(await canvas.getAttribute('data-render-count'));
  assert.ok(before > 0);
  await page!.waitForTimeout(600);
  assert.equal(Number(await canvas.getAttribute('data-render-count')), before, 'Idle demand renderer must stay stable for 600ms.');
  return before;
}

try {
  await checkpoint();
  browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE }); // No security or WebGL flags.
  context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await context.route(/^https?:\/\//, async route => {
    const request = route.request();
    if (new URL(request.url()).origin !== new URL(BASE).origin || request.method() !== 'GET') {
      unexpectedRequests.push(`${request.method()} ${request.url()}`);
      await route.abort('blockedbyclient');
    } else await route.continue();
  });
  await context.addInitScript(() => {
    const audit = { contextsCreated: 0, oscillatorsCreated: 0, records: [] as OscillatorRecord[] };
    const contexts: AudioContext[] = [];
    Reflect.set(window, '__stabilityAudioAudit', audit);
    Reflect.set(window, '__stabilityAudioContexts', contexts);
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) { super(options); audit.contextsCreated++; contexts.push(this); }
      createOscillator(): OscillatorNode {
        const node = super.createOscillator();
        const record: OscillatorRecord = { id: ++audit.oscillatorsCreated, context: contexts.indexOf(this) + 1,
          createdAt: this.currentTime, startAt: null, stopAt: null, ended: false };
        audit.records.push(record);
        const nativeStart = node.start.bind(node);
        const nativeStop = node.stop.bind(node);
        node.start = (when = 0) => { nativeStart(when); record.startAt = Math.max(when, this.currentTime); };
        node.stop = (when = 0) => { nativeStop(when); record.stopAt = Math.max(when, this.currentTime); };
        node.addEventListener('ended', () => { record.ended = true; }, { once: true });
        return node;
      }
    };
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() }); });
  const response = await page.goto(BASE, { waitUntil: 'networkidle' });
  assert.ok(response); assert.equal(response.status(), 200);
  servedStartSha256 = sha256(await response.body());
  assert.equal(servedStartSha256, EXPECTED_INDEX);
  await page.locator('main .notation-view[data-notation-ready="true"] svg').first().waitFor({ timeout: 20000 });
  assert.equal((await audio()).contextsCreated, 0, 'Entry must not create an AudioContext.');
  assert.equal(await page.locator('canvas[data-three-canvas]').count(), 0);
  await page.getByRole('navigation', { name: '학습 장면' }).getByRole('button').nth(1).click();
  await page.getByRole('heading', { level: 1, name: '절반씩 나누기', exact: true }).waitFor();
  const originalPattern = await pattern();
  assert.ok(originalPattern && originalPattern !== 'undefined');
  cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  phase = 'measured window'; measuredStart = performance.now();
  console.log(JSON.stringify({ status: 'running', output, requiredElapsedMs: REQUIRED_MS, cycles: CYCLES, expectedIndexSha256: EXPECTED_INDEX }));

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    const cycleStart = performance.now();
    const gap = previousCycleStart === null ? null : cycleStart - previousCycleStart;
    previousCycleStart = cycleStart;
    phase = `cycle ${cycle}: split/undo`;
    await checkpoint();
    await page.getByRole('button', { name: '둘로 나누기', exact: true }).click();
    assert.notEqual(await pattern(), originalPattern);
    await page.getByRole('button', { name: '되돌리기', exact: true }).click();
    assert.equal(await pattern(), originalPattern);

    phase = `cycle ${cycle}: 3D/rotation`;
    await page.getByRole('button', { name: '3D', exact: true }).click(); await readyCanvas();
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150); await readyCanvas();
    await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(150); await readyCanvas();
    assert.equal(await pattern(), originalPattern);
    const geometryCount = Number(await page.locator('canvas[data-three-canvas]').getAttribute('data-geometry-count'));
    const idleBefore = await idleRenderCount();

    phase = `cycle ${cycle}: native audio loop/stop`;
    const previousNodes = (await audio()).oscillatorsCreated;
    await page.getByRole('checkbox', { name: '반복', exact: true }).check();
    await page.getByRole('button', { name: /소리 켜고 재생/ }).click();
    await page.waitForFunction(() => (document.querySelector('.play') as HTMLButtonElement)?.disabled === true);
    assert.equal((await audio()).contextsCreated, 1, 'Reuse one native AudioContext across all cycles.');
    await page.waitForTimeout(3100); // Whole note at quarter=90 crosses a real loop boundary.
    assert.equal(await page.getByRole('button', { name: /소리 켜고 재생/ }).isDisabled(), true);
    const playing = await audio();
    assert.ok(playing.records.filter(item => item.id > previousNodes && item.startAt !== null && item.startAt - item.createdAt > 0.1).length > 0,
      'Exercise future-cycle scheduling before stop.');
    await page.getByRole('button', { name: '■ 정지', exact: true }).click();
    await page.getByRole('checkbox', { name: '반복', exact: true }).uncheck();
    const stopped = await waitStopped();
    assert.equal(stopped.contextsCreated, 1);
    assertNoIntervalsOverlap(stopped);
    const idleAfter = await idleRenderCount();

    phase = `cycle ${cycle}: 2D cleanup`;
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await page.waitForTimeout(600);
    assert.equal(await page.locator('canvas[data-three-canvas]').count(), 0);
    assert.equal(await pattern(), originalPattern);
    assert.ok((await audio()).records.every(item => item.startAt === null || item.ended));
    assertNoErrors();
    const performanceData = await cdp.send('Performance.getMetrics') as { metrics: { name: string; value: number }[] };
    const metricNames = new Set(['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents', 'LayoutCount', 'RecalcStyleCount', 'TaskDuration']);
    const metrics = Object.fromEntries(performanceData.metrics.filter(item => metricNames.has(item.name)).map(item => [item.name, item.value]));
    const sample: Sample = { cycle, elapsedMs: performance.now() - measuredStart, cycleDurationMs: performance.now() - cycleStart,
      gapFromPreviousCycleMs: gap, idleRenderCounts: [idleBefore, idleAfter], audio: stopped, metrics, geometryCount, pattern: originalPattern };
    samples.push(sample);
    await writeFile(resolve(output, 'samples', `cycle-${String(cycle).padStart(3, '0')}.json`), JSON.stringify(sample, null, 2));
    await checkpoint();
    console.log(JSON.stringify({ checkpoint: cycle, elapsedMs: Math.round(sample.elapsedMs), contexts: stopped.contextsCreated,
      liveOscillators: stopped.records.filter(item => item.startAt !== null && !item.ended).length, canvases2D: 0, metrics }));
    const nextDeadline = measuredStart + cycle * PERIOD_MS;
    while (performance.now() < nextDeadline) {
      await page.waitForTimeout(Math.min(1000, nextDeadline - performance.now()));
      assertNoErrors();
    }
  }

  phase = 'final frozen index and cleanup assertions';
  assert.ok(performance.now() - measuredStart >= REQUIRED_MS, 'Measured monotonic time must reach a full 15 minutes.');
  assert.equal(samples.length, CYCLES);
  assert.equal(sha256(await readFile('dist/index.html')), EXPECTED_INDEX, 'The local built index changed during the run.');
  const endResponse = await context.request.get(BASE);
  assert.equal(endResponse.status(), 200);
  servedEndSha256 = sha256(await endResponse.body()); assert.equal(servedEndSha256, EXPECTED_INDEX, 'Served index changed during the run.');
  assert.equal(await page.locator('canvas[data-three-canvas]').count(), 0);
  const finalAudio = await waitStopped(); assert.equal(finalAudio.contextsCreated, 1); assertNoIntervalsOverlap(finalAudio);
  assertNoErrors(); status = 'passed'; phase = 'completed';
} catch (error) {
  status = 'failed'; failure = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(failure);
  process.exitCode = 1;
  if (page) await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => undefined);
} finally {
  await checkpoint();
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ status, phase, startedAt, finishedAt: new Date().toISOString(),
    base: BASE, expectedIndexSha256: EXPECTED_INDEX, servedStartSha256, servedEndSha256,
    requiredElapsedMs: REQUIRED_MS, measuredElapsedMs: measuredStart === null ? 0 : performance.now() - measuredStart,
    completedCycles: samples.length, browser: browser?.version(), executable: EXECUTABLE, securityFlagsAdded: false,
    actualDevice: false, actualListening: false, smartphoneThermalTest: false, forcedGC: false,
    metricPolicy: 'Heap and DOM metrics are recorded only; no nondeterministic heap threshold is asserted. Observer records retain numeric timing data, not oscillator nodes.',
    samples, pageErrors, consoleErrors, failedRequests, unexpectedRequests, failedResponses, failure }, null, 2));
  await cdp?.detach().catch(() => undefined);
  await context?.close(); await browser?.close();
  console.log(JSON.stringify({ status, output, completedCycles: samples.length }));
}
