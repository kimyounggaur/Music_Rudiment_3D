/**
 * v3 printed-book e2e (CONTRACT_V3 B4; REFACTOR_PROMPTS_V3 R3-d/e).
 *
 *   node scripts/book-v3-e2e.ts [--base http://127.0.0.1:4173/] [--viewport 1280x720] [--out docs/qa/refactor/R5/e2e-1280x720.json]
 *
 * Drives the real app on the local dev server through the same two input paths a learner has:
 * the accessible mirror (keyboard / assistive technology) and pointer presses on printed hotspots
 * (positions from the DEV inspector, i.e. the live camera and curved page). Music expectations are
 * the lesson's own: answers, splits and selections are read back from the mirror and the lesson
 * revision, never from pixels.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { PAGE_LOGICAL } from '../src/book/print/pageLayout.ts';

type Result = { name: string; pass: boolean; detail: unknown };
type InspectorHotspot = { id: string; role: string; label: string; enabled: boolean; testId: string | null; center: { x: number; y: number } | null };
type InspectorPage = { pageId: string; side: 'left' | 'right' | null; resolution: string; upgrading: boolean; printVersion: number; stateVersion: number; hotspots: InspectorHotspot[];
  figures?: { id: string; rect: { x: number; y: number; w: number; h: number }; center: { x: number; y: number } | null }[];
  flaps?: { id: string; hotspotId: string; open: boolean }[]; stamps?: { id: string; stamped: boolean }[] };
type PrintStats = { bytes: number; budgetBytes: number; settled: number; drafts: number; states: number; recent: { pageId: string; layer: string; ms: number }[] };

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index]!.replace(/^--/, ''), process.argv[index + 1] ?? '');
const base = new URL(args.get('base') ?? 'http://127.0.0.1:4173/');
assert.equal(base.hostname, '127.0.0.1', 'The e2e uses the local dev server only.');
const [width, height] = (args.get('viewport') ?? '1280x720').split('x').map(Number) as [number, number];
const out = resolve(args.get('out') ?? 'docs/qa/refactor/R3/e2e.json');
const results: Result[] = [];
const record = (name: string, pass: boolean, detail: unknown = null) => {
  results.push({ name, pass, detail });
  process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${name}${detail === null ? '' : ` ${JSON.stringify(detail)}`}\n`);
};
const wait = (ms: number) => new Promise(done => setTimeout(done, ms));

const root = (page: Page) => page.evaluate(() => {
  const element = document.querySelector<HTMLElement>('main.book-app')!;
  const { phase, scene, spread, lessonRevision, printsReady, printGeneration, focusHotspot, pressedHotspot } = element.dataset;
  return { phase, scene, spread, revision: Number(lessonRevision), printsReady, generation: Number(printGeneration), focusHotspot, pressedHotspot };
});
const pages = (page: Page) => page.evaluate(() => (window as unknown as { __bookInspector: { pages(): unknown[] } }).__bookInspector.pages()) as Promise<InspectorPage[]>;
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __bookInspector: { printStats(): unknown } }).__bookInspector.printStats()) as Promise<PrintStats>;
async function idle(page: Page, spread: string, timeout = 240_000) {
  await page.waitForFunction(id => { const r = document.querySelector<HTMLElement>('main.book-app')?.dataset;
    return r?.spread === id && r.phase === 'spreadIdle' && r.scene === 'ready' && r.printsReady === 'true'; }, spread, { timeout, polling: 100 });
}
async function revisionAfter(page: Page, before: number, timeout = 10_000) {
  await page.waitForFunction(value => Number(document.querySelector<HTMLElement>('main.book-app')?.dataset.lessonRevision) > value, before, { timeout, polling: 50 });
  return (await root(page)).revision;
}
/** Activate a visually hidden mirror control the way assistive technology does (focus + click). */
async function mirrorClick(page: Page, selector: string): Promise<boolean> {
  return page.evaluate(css => {
    const element = document.querySelector<HTMLButtonElement | HTMLInputElement>(`.book-mirror ${css}`);
    if (!element || element.disabled) return false;
    element.focus({ preventScroll: true });
    element.click();
    return true;
  }, selector);
}
async function pointerClick(page: Page, hotspot: InspectorHotspot) {
  assert.ok(hotspot.center, `${hotspot.id} has no screen position`);
  await page.mouse.move(hotspot.center.x, hotspot.center.y);
  await page.mouse.down();
  await wait(40);
  const pressed = (await root(page)).pressedHotspot;
  await page.mouse.up();
  return pressed;
}
const hotspot = async (page: Page, predicate: (item: InspectorHotspot, owner: InspectorPage) => boolean) => {
  for (const owner of await pages(page)) for (const item of owner.hotspots) if (owner.side && predicate(item, owner)) return item;
  return null;
};

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors: string[] = [];
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
  await page.goto(base.toString(), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const r = document.querySelector<HTMLElement>('main.book-app')?.dataset; return r?.phase === 'coverIdle' && r.threeReady === 'true'; }, undefined, { timeout: 240_000, polling: 200 });
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('.book-open:not(:disabled)')!.click());
  await idle(page, 'spread-1');
  await wait(500);

  // --- BK/C3: the 3D book has no HTML pages; the mirror carries the page and takes focus.
  const dom = await page.evaluate(() => ({ pages: document.querySelectorAll('.book-page, .book-paper-dom').length,
    focused: document.activeElement?.matches('.book-mirror h1') ?? false, heading: document.querySelector('.book-mirror h1')?.textContent,
    testIds: [...document.querySelectorAll<HTMLElement>('.book-mirror [data-testid]')].map(element => element.dataset.testid) }));
  record('no HTML page elements in 3D', dom.pages === 0, { pages: dom.pages });

  // --- R4: the first entry ends with the ink figure fully drawn and standing, within its budgets.
  // The stage applies the timeline when it renders; the draw-call measurement renders a frame first.
  const figureState = await page.evaluate(() => {
    const inspector = (window as unknown as { __bookInspector: { figure(): { lift: number; reveal: number; figure: { segments: number } } | null; sceneDrawCalls(): { scene: number; total: number } | null } }).__bookInspector;
    const calls = inspector.sceneDrawCalls();
    const snapshot = inspector.figure();
    return { lift: snapshot?.lift ?? null, reveal: snapshot?.reveal ?? null, segments: snapshot?.figure.segments ?? null, calls };
  });
  record('R4: entry ends drawn and standing; scene ≤ 40 draw calls, ≤ 6,000 segments',
    figureState.lift !== null && figureState.lift > 0.999 && figureState.reveal === 1 && !!figureState.calls && figureState.calls.scene <= 40
      && figureState.segments !== null && figureState.segments <= 6000, figureState);
  record('mirror h1 takes page focus', dom.focused, { heading: dom.heading });
  record('mirror keeps 2D test ids', ['play-upper', 'play-lower', 'pause-resume-audio', 'stop-audio'].every(id => dom.testIds.includes(id)), dom.testIds);

  // --- R5 (C1): one toolbar outside the book, never under the book; everything else is printed.
  const chrome = await page.evaluate(() => {
    const shown = (element: Element) => { const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert], [aria-hidden="true"]'); };
    const toolbar = document.querySelector<HTMLElement>('nav.book-toolbar');
    const buttons = [...document.querySelectorAll<HTMLElement>('main.book-app button')].filter(button => !button.closest('.book-mirror') && shown(button));
    const box = toolbar?.getBoundingClientRect() ?? null;
    const bounds = (window as unknown as { __bookInspector: { snapshot(): { layout: { bookBounds: { left: number; top: number; right: number; bottom: number } } | null } } })
      .__bookInspector.snapshot().layout?.bookBounds ?? null;
    const overlap = box && bounds ? Math.max(0, Math.min(box.right, bounds.right) - Math.max(box.left, bounds.left))
      * Math.max(0, Math.min(box.bottom, bounds.bottom) - Math.max(box.top, bounds.top)) : null;
    return { visible: toolbar?.dataset.visible ?? null, height: box ? Math.round(box.height * 10) / 10 : null,
      inViewport: !!box && box.top >= 0 && box.left >= 0 && box.bottom <= innerHeight + 0.5 && box.right <= innerWidth + 0.5,
      outside: buttons.filter(button => !button.closest('nav.book-toolbar')).map(button => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''),
      buttons: buttons.filter(button => button.closest('nav.book-toolbar')).map(button => `${button.dataset.testid}:${Math.round(button.getBoundingClientRect().height)}`),
      overlap: overlap === null ? null : Math.round(overlap), bounds, toolbar: box && { top: Math.round(box.top), bottom: Math.round(box.bottom) },
      prev: document.querySelector('[data-testid="book-prev"]')?.getAttribute('aria-label') ?? null };
  });
  record('R5: one toolbar outside the book (≤ 56 px, in view, no other outside buttons)',
    chrome.visible === 'true' && chrome.height !== null && chrome.height <= 56 && chrome.inViewport && chrome.outside.length === 0, chrome);
  record('R5: the book never sits under the toolbar (bookBounds ∩ toolbar = 0)', chrome.overlap === 0, { overlap: chrome.overlap, bounds: chrome.bounds, toolbar: chrome.toolbar });

  // --- Quiz through the mirror: the questions are printed (R5: no flap), answer with a radio.
  const radios = await page.evaluate(() => document.querySelectorAll('.book-mirror input[type="radio"]').length);
  record('R5: questions are printed on the page without a flap', radios === 6, { radios });
  let before = await root(page);
  assert.ok(await mirrorClick(page, 'input[data-hotspot="page-1:q:same-end:same"]'), 'radio');
  await revisionAfter(page, before.revision);
  const answered = await page.evaluate(() => ({ checked: document.querySelector<HTMLInputElement>('.book-mirror input[data-hotspot="page-1:q:same-end:same"]')?.checked,
    feedback: [...document.querySelectorAll('.book-mirror p[role="status"]')].map(element => element.textContent).join(' ') }));
  record('mirror radio answers the quiz', answered.checked === true && answered.feedback.length > 0, answered);

  // --- Quiz with the pointer on a printed radio.
  const radio = await hotspot(page, item => item.id === 'page-1:q:attacks:1-4');
  assert.ok(radio, 'printed radio hotspot');
  before = await root(page);
  const pressedRadio = await pointerClick(page, radio);
  await revisionAfter(page, before.revision);
  const pointerAnswer = await page.evaluate(() => document.querySelector<HTMLInputElement>('.book-mirror input[data-hotspot="page-1:q:attacks:1-4"]')?.checked);
  record('pointer press on a printed radio answers', pointerAnswer === true && pressedRadio === radio.id, { pressed: pressedRadio });

  // --- R5: the last right answer stamps the printed page (derived from the answers, no saved field).
  const stampOf = async () => (await pages(page)).find(item => item.pageId === 'page-1')?.stamps?.find(stamp => stamp.id === 'scene-1-questions')?.stamped ?? null;
  const stampBefore = await stampOf();
  before = await root(page);
  assert.ok(await mirrorClick(page, 'input[data-hotspot="page-1:q:attributes:fixed"]'), 'third radio');
  await revisionAfter(page, before.revision);
  await page.waitForFunction(() => ((window as unknown as { __bookInspector: { pages(): { pageId: string; stamps?: { id: string; stamped: boolean }[] }[] } }).__bookInspector.pages())
    .find(item => item.pageId === 'page-1')?.stamps?.some(stamp => stamp.id === 'scene-1-questions' && stamp.stamped) ?? false, undefined, { timeout: 10_000, polling: 50 });
  const stampMirror = await page.evaluate(() => document.querySelector('.book-mirror')?.textContent?.includes('확인 도장이 찍혔어요') ?? false);
  record('R5: three right answers stamp the printed page', stampBefore === false && (await stampOf()) === true && stampMirror, { stampBefore, stampMirror });

  // --- R5: the answer flap is a paper sheet that lifts 0 → 110° on its top hinge; the explanations are printed beneath.
  // SwiftShader draws one frame in 0.5–3 s, longer than the 240 ms lift, so the stage clock is pinned (0 → 120 → 240 ms)
  // to see the sheet move; the timing itself is unit-tested (tests/flap-layer.test.ts).
  const flapInspector = (expression: string) => page.evaluate(source => (new Function('inspector', `return ${source};`))(
    (window as unknown as { __bookInspector: unknown }).__bookInspector), expression);
  const flapAngle = async (predicate: string) => {
    await page.waitForFunction(source => (new Function('angle', `return ${source};`))(
      (window as unknown as { __bookInspector: { flapAngles(): Record<string, number> } }).__bookInspector.flapAngles()['page-1:answer']), predicate, { timeout: 15_000, polling: 50 });
    return flapInspector("inspector.flapAngles()['page-1:answer']") as Promise<number>;
  };
  await flapInspector('inspector.holdFlaps(0)');
  assert.ok(await mirrorClick(page, 'button[data-hotspot="page-1:flap:answer"]'), 'answer flap');
  await page.waitForFunction(() => ((window as unknown as { __bookInspector: { pages(): { pageId: string; flaps?: { id: string; open: boolean }[] }[] } }).__bookInspector.pages())
    .find(item => item.pageId === 'page-1')?.flaps?.some(flap => flap.id === 'answer' && flap.open) ?? false, undefined, { timeout: 10_000, polling: 50 });
  const at0 = await flapAngle('angle === 0');
  await flapInspector('inspector.holdFlaps(120)');
  const at120 = await flapAngle('angle > 0 && angle < 110');
  await flapInspector('inspector.holdFlaps(240)');
  const at240 = await flapAngle('angle === 110');
  await flapInspector('inspector.holdFlaps(null)');
  const explained = await page.evaluate(() => document.querySelector('.book-mirror')?.textContent?.includes('두 줄 모두 온음표 기준') ?? false);
  record('R5: answer flap lifts 0 → 110° on its hinge (stage clock 0/120/240 ms); explanations printed beneath',
    at0 === 0 && at120 > 40 && at120 < 70 && at240 === 110 && explained, { at0, at120, at240, explained });

  // --- R5: pressing the standing paper itself folds it down (raycast on the sheet → the tab's command).
  const sheetPoint = await page.evaluate(height => {
    const inspector = (window as unknown as { __bookInspector: { pages(): { pageId: string; flaps?: { id: string; rect: { x: number; y: number; w: number } }[] }[];
      pagePoint(side: 'left' | 'right', u: number, v: number): { x: number; y: number } | null; flapAt(x: number, y: number): string | null } }).__bookInspector;
    const flap = inspector.pages().find(item => item.pageId === 'page-1')?.flaps?.find(item => item.id === 'answer');
    const hinge = flap && inspector.pagePoint('left', (flap.rect.x + flap.rect.w / 2) / 1000, flap.rect.y / height);
    if (!hinge) return null;
    // The sheet stands up from its hinge: walk up the screen until the ray meets the paper.
    for (let dy = 2; dy <= 160; dy += 2) if (inspector.flapAt(hinge.x, hinge.y - dy) === 'page-1:answer') return { x: hinge.x, y: hinge.y - dy - 3 };
    return null;
  }, PAGE_LOGICAL.height);
  let foldedByPaper = false;
  if (sheetPoint) {
    await page.mouse.move(sheetPoint.x, sheetPoint.y);
    await page.mouse.down();
    await wait(40);
    await page.mouse.up();
    foldedByPaper = await page.waitForFunction(() => ((window as unknown as { __bookInspector: { pages(): { pageId: string; flaps?: { id: string; open: boolean }[] }[] } }).__bookInspector.pages())
      .find(item => item.pageId === 'page-1')?.flaps?.some(flap => flap.id === 'answer' && !flap.open) ?? false, undefined, { timeout: 10_000, polling: 50 }).then(() => true, () => false);
  }
  record('R5: a press on the standing paper folds the flap down', foldedByPaper, { sheetPoint });

  // --- R5: the records dialog is modal; arrows do not turn the book while it is open; focus returns.
  await page.click('.book-toolbar [data-testid="records"]');
  await page.waitForFunction(() => document.querySelector<HTMLDialogElement>('dialog.book-records')?.open === true, undefined, { timeout: 5_000 });
  const inDialog = await page.evaluate(() => !!document.activeElement?.closest('dialog.book-records'));
  await page.keyboard.press('ArrowRight');
  await wait(700);
  const whileOpen = await root(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector<HTMLDialogElement>('dialog.book-records')?.open, undefined, { timeout: 5_000 });
  // The dialog's close event (which moves focus back to 기록) is queued after the dialog closes.
  await page.waitForFunction(() => (document.activeElement as HTMLElement | null)?.dataset.testid === 'records', undefined, { timeout: 3_000, polling: 50 }).catch(() => undefined);
  const returned = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid ?? null);
  record('R5: records dialog is modal, the book ignores arrows, focus returns to 기록',
    inDialog && whileOpen.spread === 'spread-1' && whileOpen.phase === 'spreadIdle' && returned === 'records', { inDialog, spread: whileOpen.spread, phase: whileOpen.phase, returned });

  // --- R5 (keyboard): with the dialog closed, ArrowRight / ArrowLeft turn the book again (the bookmark buttons are gone).
  await page.evaluate(() => document.querySelector<HTMLElement>('.book-mirror h1')?.focus({ preventScroll: true }));
  await page.keyboard.press('ArrowRight');
  const keyNext = await idle(page, 'spread-2', 120_000).then(() => true, () => false);
  await page.evaluate(() => document.querySelector<HTMLElement>('.book-mirror h1')?.focus({ preventScroll: true }));
  await page.keyboard.press('ArrowLeft');
  const keyPrev = await idle(page, 'spread-1', 120_000).then(() => true, () => false);
  record('R5: ArrowRight / ArrowLeft turn the book with the toolbar in place', keyNext && keyPrev, { keyNext, keyPrev });

  // --- R6: 가까이 보기 — the camera goes into the figure; the same button brings back the reading pose itself.
  type LiveCamera = { position: number[]; quaternion: number[]; shot?: { id: string; t: number } | null };
  const liveCamera = () => page.evaluate(() => ((window as unknown as { __bookInspector: { snapshot(): { layout: { camera: unknown } | null } } }).__bookInspector
    .snapshot().layout?.camera ?? null)) as Promise<LiveCamera | null>;
  const shotPhase = (phase: string | null) => page.waitForFunction(value => {
    const shot = (window as unknown as { __bookInspector: { shot(): { phase: string } | null } }).__bookInspector.shot();
    return value === null ? shot === null && document.querySelector<HTMLElement>('main.book-app')?.dataset.camera === 'settled' : shot?.phase === value;
  }, phase, { timeout: 20_000, polling: 50 });
  const cameraDiff = (a: LiveCamera | null, b: LiveCamera | null) => a && b
    ? Math.max(...a.position.map((value, index) => Math.abs(value - b.position[index]!)), ...a.quaternion.map((value, index) => Math.abs(value - b.quaternion[index]!))) : Infinity;
  const readingCamera = await liveCamera();
  assert.ok(await mirrorClick(page, 'button[data-testid="close-look"]'), 'close-look');
  await shotPhase('hold');
  await page.waitForFunction(() => ((window as unknown as { __bookInspector: { snapshot(): { layout: { camera: { shot?: { t: number } | null } } | null } } }).__bookInspector
    .snapshot().layout?.camera.shot?.t ?? 0) === 1, undefined, { timeout: 20_000, polling: 50 });
  const shotCamera = await liveCamera();
  const shotRoot = await page.evaluate(() => ({ camera: document.querySelector<HTMLElement>('main.book-app')?.dataset.camera,
    label: document.querySelector('.book-mirror button[data-testid="close-look"]')?.textContent?.trim() ?? null }));
  record('R6: 가까이 보기 takes the camera into the figure (user-started shot)', shotRoot.camera === 'shot' && shotCamera?.shot?.id === 'lanes-close'
    && cameraDiff(shotCamera, readingCamera) > 0.1 && shotRoot.label === '돌아오기', { ...shotRoot, moved: Number(cameraDiff(shotCamera, readingCamera).toFixed(3)) });
  // A printed control keeps working through the shot camera (one the shot leaves on screen, a play button first).
  const onScreen = (item: InspectorHotspot) => !!item.center && item.enabled && item.center.x > 4 && item.center.x < width - 4 && item.center.y > 4 && item.center.y < height - 64;
  const shotPlay = await hotspot(page, item => onScreen(item) && /^play-/.test(item.testId ?? ''))
    ?? await hotspot(page, item => onScreen(item) && item.role === 'button');
  const shotPressed = shotPlay ? await pointerClick(page, shotPlay) : null;
  const playing = /^play-/.test(shotPlay?.testId ?? '');
  const shotTransport = playing ? await page.waitForFunction(() => ['starting', 'playing'].includes(document.querySelector<HTMLElement>('main.book-app')?.dataset.transport ?? ''),
    undefined, { timeout: 15_000, polling: 50 }).then(() => true, () => false) : null;
  if (playing) await mirrorClick(page, 'button[data-testid="stop-audio"]');
  record('R6: a printed control works during the shot', !!shotPlay && shotPressed === shotPlay.id && shotTransport !== false,
    { control: shotPlay?.testId ?? shotPlay?.id ?? null, pressed: shotPressed, playing: shotTransport });
  assert.ok(await mirrorClick(page, 'button[data-testid="close-look"]'), 'close-look (return)');
  await shotPhase(null);
  const returnedCamera = await liveCamera();
  record('R6: the same button returns exactly to the reading pose (≤ 1e-6)', cameraDiff(returnedCamera, readingCamera) <= 1e-6 && !returnedCamera?.shot,
    { maxDifference: cameraDiff(returnedCamera, readingCamera) });
  // ArrowRight during a shot: the camera comes back first, then the book turns (never a turn from the shot).
  assert.ok(await mirrorClick(page, 'button[data-testid="close-look"]'), 'close-look (again)');
  await shotPhase('hold');
  await page.evaluate(() => {
    const samples: { camera: string; phase: string }[] = [];
    (window as unknown as { __r6: typeof samples }).__r6 = samples;
    const tick = () => {
      const data = document.querySelector<HTMLElement>('main.book-app')?.dataset;
      samples.push({ camera: data?.camera ?? '', phase: data?.phase ?? '' });
      if (samples.length < 4000 && !(data?.spread === 'spread-2' && data.phase === 'spreadIdle')) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    document.querySelector<HTMLElement>('.book-mirror h1')?.focus({ preventScroll: true });
  });
  await page.keyboard.press('ArrowRight');
  const shotTurned = await idle(page, 'spread-2', 120_000).then(() => true, () => false);
  const r6Samples = await page.evaluate(() => (window as unknown as { __r6: { camera: string; phase: string }[] }).__r6.splice(0));
  const turnFromShot = r6Samples.filter(sample => sample.camera === 'shot' && sample.phase !== 'spreadIdle');
  record('R6: ArrowRight during a shot returns to reading, then turns', shotTurned && turnFromShot.length === 0
    && r6Samples.some(sample => sample.camera === 'shot') && r6Samples.some(sample => sample.phase === 'preparingTurn' || sample.phase.startsWith('turning')),
    { turned: shotTurned, samples: r6Samples.length, turnFromShot: turnFromShot.length });
  // Escape also ends a shot (spread 2's own shot), and the arrows bring the reader back to spread 1.
  assert.ok(await mirrorClick(page, 'button[data-testid="close-look"]'), 'strip-close');
  await shotPhase('hold');
  const stripShot = (await liveCamera())?.shot?.id ?? null;
  await page.keyboard.press('Escape');
  const escaped = await shotPhase(null).then(() => true, () => false);
  record('R6: Escape ends the spread-2 shot', stripShot === 'strip-close' && escaped, { shot: stripShot, escaped });
  await page.evaluate(() => document.querySelector<HTMLElement>('.book-mirror h1')?.focus({ preventScroll: true }));
  await page.keyboard.press('ArrowLeft');
  await idle(page, 'spread-1', 120_000);

  // --- Keyboard: Tab from the heading draws the focus ring on the paper (state layer).
  await page.evaluate(() => document.querySelector<HTMLElement>('.book-mirror h1')?.focus());
  const stateBefore = (await pages(page)).find(item => item.pageId === 'page-1')!.stateVersion;
  await page.keyboard.press('Tab');
  await wait(150);
  const focus = await page.evaluate(() => ({ hotspot: (document.activeElement as HTMLElement | null)?.dataset.hotspot ?? null,
    root: document.querySelector<HTMLElement>('main.book-app')?.dataset.focusHotspot }));
  const stateAfter = (await pages(page)).find(item => item.pageId === 'page-1')!.stateVersion;
  record('Tab focus is drawn on the printed page (AX21)', !!focus.hotspot && focus.root === focus.hotspot && stateAfter > stateBefore, { ...focus, stateBefore, stateAfter });

  // --- Spread 2: ten consecutive splits through the mirror; draft prints ≤ 60 ms each.
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="book-next"]')!.click());
  await idle(page, 'spread-2');
  await wait(500);
  await page.evaluate(() => performance.clearMeasures('print:draft'));
  const commitTimes: number[] = [];
  const frameTimes: number[] = [];
  let splits = 0;
  for (let attempt = 0; attempt < 30 && splits < 10; attempt += 1) {
    before = await root(page);
    // Time the edit as the learner sees it: click → React commit (synchronous draft print) → next stage frame.
    const timing = await page.evaluate(async () => {
      const button = document.querySelector<HTMLButtonElement>('.book-mirror [data-testid="split-note"]');
      if (!button || button.disabled) return null;
      const element = document.querySelector<HTMLElement>('main.book-app')!;
      const frames = Number(element.dataset.frames);
      button.focus({ preventScroll: true });
      const start = performance.now();
      button.click();
      const committed = performance.now() - start;
      await new Promise(done => { const check = () => Number(element.dataset.frames) > frames ? done(null) : requestAnimationFrame(check); requestAnimationFrame(check); });
      return { committed, frame: performance.now() - start };
    });
    if (timing) {
      await revisionAfter(page, before.revision);
      splits += 1;
      commitTimes.push(Number(timing.committed.toFixed(1)));
      frameTimes.push(Number(timing.frame.toFixed(1)));
      continue;
    }
    // The selected note is a 1/16 (split disabled): select a longer one, as a learner would.
    const target = await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>('.book-mirror [data-event-select]')]
      .find(button => !button.disabled && !/16분/.test(button.textContent ?? ''))?.dataset.hotspot ?? null);
    assert.ok(target, 'a splittable note');
    await mirrorClick(page, `button[data-hotspot="${target}"]`);
    await revisionAfter(page, before.revision);
  }
  const listed = await page.evaluate(() => document.querySelectorAll('.book-mirror [data-event-select]').length);
  record('ten splits through the mirror', splits === 10 && listed === 11, { splits, notes: listed });

  // --- R4: a split changes the data at once and cuts the new boundary with a pen stroke that ends
  // after BOOK_MOTION.splitMerge (240 ms; under SwiftShader the end lands on the next slow frame).
  type FigureInspector = { __bookInspector: { figure(): { lanes: { eventIds: string[]; transition: { kind: string; boundaries: number[] } | null }[] } | null } };
  const strokeTarget = await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>('.book-mirror [data-event-select]')]
    .find(button => !button.disabled && !/16분/.test(button.textContent ?? ''))?.dataset.hotspot ?? null);
  if (strokeTarget) {
    before = await root(page);
    await mirrorClick(page, `button[data-hotspot="${strokeTarget}"]`);
    await revisionAfter(page, before.revision);
  }
  before = await root(page);
  // Sample the figure on every frame from the click on: the stroke runs on rAF for splitMerge ms.
  const stroke = await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('.book-mirror [data-testid="split-note"]');
    if (!button || button.disabled) return null;
    const notes = document.querySelectorAll('.book-mirror [data-event-select]').length;
    const samples: { events: number | null; transition: { kind: string; boundaries: number[] } | null }[] = [];
    (window as unknown as { __strokeSamples: typeof samples }).__strokeSamples = samples;
    const tick = () => {
      const snapshot = (window as unknown as FigureInspector).__bookInspector.figure();
      samples.push({ events: snapshot?.lanes[0]?.eventIds.length ?? null, transition: snapshot?.lanes[0]?.transition ?? null });
      if (samples.length < 600) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    button.click();
    return { notesBefore: notes };
  });
  await revisionAfter(page, before.revision);
  const drawn = await page.waitForFunction(() => (window as unknown as { __strokeSamples: { transition: unknown }[] }).__strokeSamples.some(sample => sample.transition),
    undefined, { timeout: 30_000, polling: 50 }).then(() => true, () => false);
  const strokeEnded = await page.waitForFunction(() => (window as unknown as FigureInspector).__bookInspector.figure()?.lanes[0]?.transition === null,
    undefined, { timeout: 30_000, polling: 100 }).then(() => true, () => false);
  const strokeSamples = await page.evaluate(() => (window as unknown as { __strokeSamples: { events: number | null; transition: { kind: string; boundaries: number[] } | null }[] }).__strokeSamples.splice(0));
  const firstStroke = strokeSamples.find(sample => sample.transition);
  record('R4: split draws the new boundary as a pen stroke over 240 ms (data first)',
    !!stroke && drawn && !!firstStroke && firstStroke.events === stroke.notesBefore + 1 && firstStroke.transition?.kind === 'draw'
      && firstStroke.transition.boundaries.length === 1 && strokeEnded,
    { ...stroke, firstStroke, strokeFrames: strokeSamples.filter(sample => sample.transition).length, strokeEnded });
  const draftMeasures = await page.evaluate(() => performance.getEntriesByName('print:draft').map(entry => Number(entry.duration.toFixed(2))));
  record('draft print per edit ≤ 60 ms (performance measure print:draft)', draftMeasures.length >= 10 && Math.max(...draftMeasures) <= 60,
    { maxDraftMs: Math.max(...draftMeasures), draftMeasures, clickToCommitMs: commitTimes, clickToRenderedFrameMs: frameTimes,
      note: 'commit = React render + synchronous draft print; frame adds texture upload and a full SwiftShader frame' });

  // --- Pointer press on the printed split button.
  let split = await hotspot(page, item => item.testId === 'split-note');
  if (split && !split.enabled) {
    const note = await hotspot(page, item => item.role === 'note' && item.enabled && !/16분/.test(item.label));
    assert.ok(note, 'printed note cell');
    before = await root(page);
    await pointerClick(page, note);
    await revisionAfter(page, before.revision);
    split = await hotspot(page, item => item.testId === 'split-note');
  }
  assert.ok(split?.enabled, 'printed split is enabled');
  before = await root(page);
  await pointerClick(page, split);
  const afterSplit = await revisionAfter(page, before.revision);
  const notesAfter = await page.evaluate(() => document.querySelectorAll('.book-mirror [data-event-select]').length);
  record('pointer press on printed 둘로 나누기 splits', notesAfter === listed + 2, { revision: afterSplit, notes: notesAfter });


  // --- Draft → settled upgrade keeps every printed position (jump 0). Undo + redo restore the same
  // lesson content; settled upgrades are held so the redo's draft frame can be captured.
  const cdp = await context.newCDPSession(page);
  const frame = async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64');
  const frames = async (count: number) => page.evaluate(async total => {
    for (let index = 0; index < total; index += 1) await new Promise(done => requestAnimationFrame(() => done(null)));
  }, count);
  await page.waitForFunction(() => ((window as unknown as { __bookInspector: { pages(): { side: string | null; upgrading: boolean }[] } }).__bookInspector.pages())
    .every(item => !item.upgrading), undefined, { timeout: 10_000, polling: 50 });
  await frames(4);
  const settledShot = await frame();
  const upgraded = (await pages(page)).filter(item => item.side).every(item => item.resolution === 'settled' && !item.upgrading);
  await page.evaluate(() => (window as unknown as { __bookInspector: { holdPrintUpgrades(hold: boolean): void } }).__bookInspector.holdPrintUpgrades(true));
  const beforeUndo = (await root(page)).revision;
  await mirrorClick(page, 'button[data-hotspot="page-4:edit:undo"]');
  await revisionAfter(page, beforeUndo);
  const undone = (await root(page)).revision;
  await mirrorClick(page, 'button[data-hotspot="page-4:edit:redo"]');
  await revisionAfter(page, undone);
  await frames(4);
  const draftState = (await pages(page)).find(item => item.pageId === 'page-3')!;
  const draftShot = await frame();
  const draftSeen = draftState.upgrading && draftState.resolution === 'draft';
  await page.evaluate(() => (window as unknown as { __bookInspector: { holdPrintUpgrades(hold: boolean): void } }).__bookInspector.holdPrintUpgrades(false));
  await page.waitForFunction(() => ((window as unknown as { __bookInspector: { pages(): { side: string | null; upgrading: boolean }[] } }).__bookInspector.pages())
    .filter(item => item.side).every(item => !item.upgrading), undefined, { timeout: 10_000, polling: 50 });
  await frames(4);
  const finalShot = await frame();
  // Evidence: the same edit as a held draft frame and as its settled frame.
  await mkdir(dirname(out), { recursive: true });
  await writeFile(resolve(dirname(out), `jump-${width}x${height}-1-settled-before.png`), settledShot);
  await writeFile(resolve(dirname(out), `jump-${width}x${height}-2-draft.png`), draftShot);
  await writeFile(resolve(dirname(out), `jump-${width}x${height}-3-settled-after.png`), finalShot);
  const difference = await page.evaluate(async ({ a, b, c }) => {
    const load = async (data: string) => { const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode(); return image; };
    const [one, two, three] = await Promise.all([load(a), load(b), load(c)]);
    const pixels = (image: HTMLImageElement) => {
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true })!; context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const layout = JSON.parse(document.querySelector<HTMLElement>('main.book-app')!.dataset.layout!) as { left: Record<string, { x: number; y: number }> };
    const xs = Object.values(layout.left).map(point => point.x), ys = Object.values(layout.left).map(point => point.y);
    const box = { x0: Math.ceil(Math.min(...xs)) + 4, x1: Math.floor(Math.max(...xs)) - 4, y0: Math.ceil(Math.min(...ys)) + 4, y1: Math.floor(Math.max(...ys)) - 4 };
    const mad = (p: Uint8ClampedArray, q: Uint8ClampedArray) => {
      let sum = 0, count = 0, max = 0;
      for (let y = box.y0; y < box.y1; y += 1) for (let x = box.x0; x < box.x1; x += 1) {
        const index = (y * one.naturalWidth + x) * 4;
        const delta = (Math.abs(p[index]! - q[index]!) + Math.abs(p[index + 1]! - q[index + 1]!) + Math.abs(p[index + 2]! - q[index + 2]!)) / 3;
        sum += delta; count += 1; max = Math.max(max, delta);
      }
      return { mean: Number((sum / count).toFixed(3)), max: Number(max.toFixed(1)) };
    };
    // Best alignment of the two prints' ink (normalised cross-correlation over ±4 px): a layout jump
    // moves the optimum away from (0,0); a sharper settled print only changes stroke weight.
    const ink = (p: Uint8ClampedArray) => {
      const values = new Float32Array((box.x1 - box.x0) * (box.y1 - box.y0));
      let index = 0;
      for (let y = box.y0; y < box.y1; y += 1) for (let x = box.x0; x < box.x1; x += 1, index += 1) {
        const offset = (y * one.naturalWidth + x) * 4;
        values[index] = Math.max(0, 200 - (p[offset]! + p[offset + 1]! + p[offset + 2]!) / 3);
      }
      return values;
    };
    const inkDraft = ink(pixels(two)), inkFinal = ink(pixels(three));
    const w = box.x1 - box.x0, h = box.y1 - box.y0;
    let best = { dx: 0, dy: 0, score: -Infinity };
    for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) {
      let dot = 0, na = 0, nb = 0;
      for (let y = 4; y < h - 4; y += 1) for (let x = 4; x < w - 4; x += 1) {
        const va = inkDraft[y * w + x]!, vb = inkFinal[(y + dy) * w + x + dx]!;
        dot += va * vb; na += va * va; nb += vb * vb;
      }
      const score = dot / Math.sqrt(na * nb || 1);
      if (score > best.score) best = { dx, dy, score };
    }
    return { settledVsFinal: mad(pixels(one), pixels(three)), draftVsFinal: mad(pixels(two), pixels(three)),
      bestOffsetPx: { dx: best.dx, dy: best.dy }, correlation: Number(best.score.toFixed(4)), box };
  }, { a: settledShot.toString('base64'), b: draftShot.toString('base64'), c: finalShot.toString('base64') });
  record('settled upgrade keeps the same print (jump 0)', upgraded && draftSeen && difference.settledVsFinal.mean < 1
    && difference.draftVsFinal.mean < 3 && difference.bestOffsetPx.dx === 0 && difference.bestOffsetPx.dy === 0, { draftFrameCaptured: draftSeen, ...difference });

  // --- A tap on the standing figure (scene pick through the printed figure window) selects that note:
  // the first block starts at the left of the window, so a tap there must select the first event.
  const figure = (await pages(page)).find(item => item.side === 'right')?.figures?.[0];
  const listedEvents = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.book-mirror [data-event-select]')].map(element => element.dataset.eventSelect!));
  const selectedBefore = await page.evaluate(() => document.querySelector<HTMLElement>('.book-mirror [data-event-select][aria-pressed="true"]')?.dataset.eventSelect ?? null);
  // Tap the block at whichever end of the bar is not already selected.
  const atStart = selectedBefore !== listedEvents[0];
  const expected = atStart ? listedEvents[0] : listedEvents.at(-1);
  // R4: the window also holds the axis labels and decor, so aim at the standing block itself (lane units).
  const tap = figure && (await page.evaluate(x => (window as unknown as { __bookInspector: { figurePoints(lane: string, points: number[][]): ({ x: number; y: number } | null)[] } })
    .__bookInspector.figurePoints('main', [[x, 0.19, 0]]), atStart ? 0.3 : 9.7))[0];
  if (figure && tap && expected) {
    before = await root(page);
    await page.mouse.click(tap.x, tap.y);
    await revisionAfter(page, before.revision).catch(() => before.revision);
    const selectedAfter = await page.evaluate(() => document.querySelector<HTMLElement>('.book-mirror [data-event-select][aria-pressed="true"]')?.dataset.eventSelect ?? null);
    record('tap on the 3D figure selects that note', selectedBefore !== expected && selectedAfter === expected, { figure: figure.id, selectedBefore, selectedAfter, expected });
  } else record('tap on the 3D figure selects that note', false, { figure: figure?.id ?? null, tap, expected });

  // --- BK12: no mirror (page DOM) while a turn is in flight.
  await page.evaluate(() => {
    const samples: { phase: string; mirror: boolean }[] = [];
    (window as unknown as { __bk12: typeof samples }).__bk12 = samples;
    const tick = () => {
      const phase = document.querySelector<HTMLElement>('main.book-app')?.dataset.phase ?? '';
      samples.push({ phase, mirror: !!document.querySelector('.book-mirror') });
      if (samples.length < 4000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    document.querySelector<HTMLButtonElement>('[data-testid="book-next"]')!.click();
  });
  await idle(page, 'spread-3');
  const bk12 = await page.evaluate(() => (window as unknown as { __bk12: { phase: string; mirror: boolean }[] }).__bk12.splice(0));
  const turning = bk12.filter(sample => sample.phase !== 'spreadIdle');
  record('BK12: no page DOM during the turn', turning.length > 0 && turning.every(sample => !sample.mirror), { turningFrames: turning.length, phases: [...new Set(turning.map(sample => sample.phase))] });

  // --- 2D reading book and back (toolbar control, then the 2D page control).
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('.book-toolbar [data-testid="reading-mode"]')!.click());
  await page.waitForFunction(() => document.querySelector<HTMLElement>('main.book-app')?.dataset.phase === 'fallback2D', undefined, { timeout: 60_000 });
  await page.waitForFunction(() => document.querySelector<HTMLElement>('main.book-app')?.dataset.scene === 'ready', undefined, { timeout: 60_000 });
  const flat = await page.evaluate(() => ({ pages: document.querySelectorAll('.book-page').length, mirror: !!document.querySelector('.book-mirror'),
    pageRevision: document.querySelector<HTMLElement>('.lesson-page-content')?.dataset.lessonRevision,
    rootRevision: document.querySelector<HTMLElement>('main.book-app')?.dataset.lessonRevision }));
  record('2D reading book shows DOM pages with the same lesson', flat.pages === 2 && !flat.mirror && flat.pageRevision === flat.rootRevision, flat);
  await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>('[data-testid="reading-mode"]')].find(button => !button.closest('[inert]'))!.click());
  await idle(page, 'spread-3');
  record('returns to the printed 3D book', (await page.evaluate(() => document.querySelectorAll('.book-page, .book-paper-dom').length)) === 0);

  // --- Memory: twenty spread-2 ↔ spread-3 round trips (reduced motion keeps the run short).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await wait(300);
  const start = await stats(page);
  for (let trip = 0; trip < 20; trip += 1) {
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="book-prev"]')!.click());
    await idle(page, 'spread-2', 60_000);
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="book-next"]')!.click());
    await idle(page, 'spread-3', 60_000);
  }
  await page.waitForFunction(() => ((window as unknown as { __bookInspector: { pages(): { side: string | null; upgrading: boolean }[] } }).__bookInspector.pages())
    .every(item => !item.upgrading), undefined, { timeout: 10_000, polling: 50 });
  const end = await stats(page);
  const mib = (bytes: number) => Number((bytes / 1048576).toFixed(2));
  record('print memory stays in budget after 20 round trips', end.bytes <= end.budgetBytes && end.bytes === start.bytes,
    { startMiB: mib(start.bytes), endMiB: mib(end.bytes), budgetMiB: mib(end.budgetBytes), settled: end.settled, drafts: end.drafts, states: end.states });

  // --- R5: next is disabled on the last spread; prev on the first spread is 표지로 and closes the book.
  for (const spread of ['spread-4', 'spread-5', 'spread-6']) {
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="book-next"]')!.click());
    await idle(page, spread, 60_000);
  }
  const lastNext = await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="book-next"]')?.disabled ?? null);
  record('R5: next is disabled on the last spread', lastNext === true, { disabled: lastNext });
  for (const spread of ['spread-5', 'spread-4', 'spread-3', 'spread-2', 'spread-1']) {
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="book-prev"]')!.click());
    await idle(page, spread, 60_000);
  }
  const firstPrev = await page.evaluate(() => document.querySelector('[data-testid="book-prev"]')?.getAttribute('aria-label') ?? null);
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="book-prev"]')!.click());
  await page.waitForFunction(() => document.querySelector<HTMLElement>('main.book-app')?.dataset.phase === 'coverIdle', undefined, { timeout: 60_000, polling: 100 });
  const closed = await page.evaluate(() => ({ toolbar: document.querySelector<HTMLElement>('nav.book-toolbar')?.dataset.visible ?? null,
    hidden: getComputedStyle(document.querySelector('nav.book-toolbar')!).visibility }));
  record('R5: prev on the first spread (표지로) closes the book; the toolbar hides but keeps its space',
    firstPrev === '표지로' && closed.toolbar === 'false' && closed.hidden === 'hidden', { label: firstPrev, ...closed });
  record('no page errors', errors.length === 0, errors.slice(0, 8));
  await context.close();
} catch (reason) {
  record('e2e run completed', false, reason instanceof Error ? reason.message : String(reason));
} finally {
  await browser.close();
}
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify({ time: new Date().toISOString(), viewport: `${width}x${height}`, results }, null, 2)}\n`);
const failed = results.filter(result => !result.pass);
process.stdout.write(`${results.length - failed.length}/${results.length} passed → ${out}\n`);
process.exitCode = failed.length ? 1 : 0;
