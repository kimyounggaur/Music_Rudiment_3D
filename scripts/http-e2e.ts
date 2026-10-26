import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { Locator } from 'playwright';
import { lessonContent } from '../src/content/lesson.ts';
import { isSceneComplete, tryRestoreLessonState } from '../src/lesson/controller.ts';
import { parseImport, STORAGE_KEY } from '../src/persistence/progress.ts';
import type { ProgressEnvelope } from '../src/persistence/progress.ts';

// Preparation is safe to type-check/lint. A real HTTP run needs explicit dispatch.
assert.equal(process.env.LAB_HTTP_RUN_AUTHORIZED, '1', 'Root must explicitly authorize the HTTP browser run.');
const base = new URL(process.env.LAB_BASE_URL ?? 'http://127.0.0.1:4174/');
assert.equal(base.protocol, 'http:');
assert.equal(base.hostname, '127.0.0.1');
assert.equal(base.port, '4174', 'Do not probe alternate ports or retry a denied listener.');
assert.equal(base.username + base.password, '');
const expectedIndexSha256 = (process.env.LAB_EXPECTED_HTTP_INDEX_SHA256 ?? '').toLowerCase();
assert.match(expectedIndexSha256, /^[a-f0-9]{64}$/, 'Assign the built dist/index.html SHA256 explicitly.');
const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256(await readFile('dist/index.html')), expectedIndexSha256, 'The assigned built index must exist locally.');
const buildId = expectedIndexSha256.slice(0, 8);
const output = resolve(`output/playwright/http-${buildId}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? 'C:\\Users\\kimyo\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1223\\chrome-headless-shell-win64\\chrome-headless-shell.exe' });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, acceptDownloads: true });
const unexpectedRequests: string[] = [];
const resources: { url: string; status: number; type: string }[] = [];
await context.route(/^https?:\/\//, async route => {
  const request = route.request();
  if (new URL(request.url()).origin !== base.origin || request.method() !== 'GET') {
    unexpectedRequests.push(`${request.method()} ${request.url()}`);
    await route.abort('blockedbyclient');
    return;
  }
  await route.continue();
});
await context.addInitScript(() => {
  const audit = { contextsCreated: 0, oscillatorsCreated: 0,
    starts: [] as { id: number; when: number; contextTime: number }[],
    stops: [] as { id: number; when: number }[], ended: [] as number[] };
  const contexts: AudioContext[] = [];
  Reflect.set(window, '__httpAudioAudit', audit);
  Reflect.set(window, '__httpAudioContexts', contexts);
  const Original = window.AudioContext;
  window.AudioContext = class extends Original {
    constructor(options?: AudioContextOptions) { super(options); audit.contextsCreated += 1; contexts.push(this); }
    createOscillator() {
      const node = super.createOscillator();
      const id = ++audit.oscillatorsCreated;
      const start = node.start.bind(node);
      const stop = node.stop.bind(node);
      node.start = (when = 0) => { audit.starts.push({ id, when, contextTime: this.currentTime }); start(when); };
      node.stop = (when = 0) => { stop(when); audit.stops.push({ id, when }); };
      node.addEventListener('ended', () => audit.ended.push(id));
      return node;
    }
  };
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => resources.push({ url: response.url(), status: response.status(), type: response.request().resourceType() }));
await context.tracing.start({ screenshots: true, snapshots: true });
const results: { name: string; status: 'passed' | 'failed' | 'blocked'; detail?: string }[] = [];
const screenshots: string[] = [];
let servedIndexSha256 = '';
let threeOutcome = 'not reached';
let downloadSha256 = '';
let backgroundOutcome = 'not reached';
let audioEvidence: unknown = null;
let audioBeforePagehide: unknown = null;
let pagehideEvidence: unknown = null;
const pass = (name: string, detail?: string) => {
  results.push({ name, status: 'passed', detail });
  process.stdout.write(`PASS ${name}\n`);
};
const block = (name: string, detail: string) => {
  results.push({ name, status: 'blocked', detail });
  process.exitCode = 1;
  process.stdout.write(`BLOCKED ${name}: ${detail}\n`);
};
const play = () => page.getByRole('button', { name: /소리 켜고 재생/ });
const stop = () => page.getByRole('button', { name: '■ 정지', exact: true });
const next = () => page.getByRole('button', { name: '다음 →', exact: true });
const palette = (name: string) => page.getByRole('button', { name: new RegExp(`^${name}`) });

async function keyboard(control: Locator, key = 'Enter') { await control.focus(); await control.press(key); }
async function scene(index: number) {
  await page.getByRole('navigation', { name: '학습 장면' }).getByRole('button').nth(index).click();
  await page.getByRole('heading', { level: 1, name: lessonContent.scenes[index].title, exact: true }).waitFor();
}
async function answer(index: number) {
  const region = page.getByRole('region', { name: '개념 확인', exact: true });
  for (const question of lessonContent.scenes[index].questions) {
    const option = question.options.find(item => item.value === question.correctValue);
    assert.ok(option);
    await region.getByRole('group', { name: question.prompt, exact: true }).getByRole('radio', { name: option.label, exact: true }).check();
  }
}
async function advance(index: number) {
  assert.equal(await next().isEnabled(), true);
  await next().click();
  await page.getByRole('heading', { level: 1, name: lessonContent.scenes[index].title, exact: true }).waitFor();
}
async function readyScore() { await page.locator('main .notation-view[data-notation-ready="true"] svg').first().waitFor({ timeout: 20000 }); }
async function waitPlaying(playing: boolean, timeout = 6000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await play().isDisabled()) === playing) return;
    await page.waitForTimeout(40);
  }
  assert.fail(`Transport did not become ${playing ? 'playing' : 'ready'} within ${timeout}ms.`);
}
async function audit() {
  return page.evaluate(() => ({
    ...Reflect.get(window, '__httpAudioAudit'),
    contextStates: (Reflect.get(window, '__httpAudioContexts') as AudioContext[]).map(item => ({ state: item.state, currentTime: item.currentTime })),
  })) as Promise<{ contextsCreated: number; oscillatorsCreated: number; starts: { id: number; when: number; contextTime: number }[];
    stops: { id: number; when: number }[]; ended: number[]; contextStates: { state: string; currentTime: number }[] }>;
}
async function stored(): Promise<ProgressEnvelope> {
  await page.waitForTimeout(350);
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as ProgressEnvelope, STORAGE_KEY);
}
async function capture(name: string) {
  const file = `${name}-${buildId}-http.png`;
  await page.screenshot({ path: `${output}/${file}`, fullPage: true });
  screenshots.push(file);
}

try {
  const response = await page.goto(base.href, { waitUntil: 'networkidle' });
  assert.ok(response);
  assert.equal(response.status(), 200);
  servedIndexSha256 = sha256(await response.body());
  assert.equal(servedIndexSha256, expectedIndexSha256, 'HTTP must serve the assigned built index, not a stale or dev page.');
  await page.getByRole('heading', { level: 1, name: lessonContent.scenes[0].title, exact: true }).waitFor();
  await readyScore();
  assert.equal((await audit()).contextsCreated, 0);
  const fonts = await page.evaluate(() => Array.from(document.fonts).map(font => ({ family: font.family, status: font.status })));
  assert.ok(fonts.some(font => font.family.includes('Bravura') && font.status === 'loaded'));
  assert.ok(fonts.some(font => font.family.includes('Academico') && font.status === 'loaded'));
  pass('assigned production app is actually HTTP-served with ready VexFlow SVG and local music/text fonts, no autoplay');

  await page.getByRole('button', { name: '소리 없이 설명 확인', exact: true }).click();
  await page.getByRole('button', { name: '아래: 4분음표 4개', exact: true }).click();
  await page.getByRole('button', { name: '소리 없이 설명 확인', exact: true }).click();
  await answer(0); await advance(1);
  for (let i = 0; i < 4; i += 1) await keyboard(page.getByRole('button', { name: '둘로 나누기', exact: true }));
  assert.equal(await page.getByRole('button', { name: '둘로 나누기', exact: true }).isDisabled(), true);
  await answer(1); await advance(2);
  await palette('4분음표').click(); await palette('4분음표').click();
  await page.getByRole('button', { name: '과제B', exact: true }).click();
  for (let i = 0; i < 4; i += 1) await palette('8분음표').click();
  await page.getByRole('button', { name: '과제C', exact: true }).click();
  await palette('4분음표').click(); await palette('8분음표').click(); await palette('8분음표').click();
  await advance(3); await answer(3); await advance(4); await answer(4); await advance(5);
  await palette('2분음표').click(); await palette('4분쉼표').click(); await palette('8분음표').click(); await palette('8분음표').click();
  await keyboard(page.getByRole('checkbox', { name: '쉼표도 시간을 차지한다는 점과 길이의 합을 설명했어요.', exact: true }), 'Space');
  await page.getByRole('heading', { level: 2, name: '나의 한 마디를 완성했어요', exact: true }).waitFor();
  const silentSaved = await stored();
  const silentRestored = tryRestoreLessonState(silentSaved);
  if (!silentRestored.ok) throw new Error(silentRestored.message);
  assert.equal(lessonContent.scenes.every(item => isSceneComplete(silentRestored.state, item.sceneId)), true);
  assert.equal((await audit()).contextsCreated, 0);
  pass('HTTP text/2D route completes all six scenes with keyboard split/Space support before AudioContext creation');
  await page.getByRole('button', { name: '되돌리기', exact: true }).click();
  assert.equal(await page.getByRole('heading', { level: 2, name: '나의 한 마디를 완성했어요', exact: true }).count(), 0);
  await page.getByRole('button', { name: '다시 하기', exact: true }).click();
  pass('scene6 current success is removed by undo and restored by redo through the HTTP app');

  // Real browser AudioContext, not a mock; the wrappers only observe native calls.
  for (const index of [0, 1, 2, 5]) {
    await scene(index);
    assert.match(await page.locator('.play-status').innerText(), /4분음표 = 90/);
    await play().click(); await waitPlaying(true);
    assert.equal((await audit()).contextStates.some(item => item.state === 'running'), true);
    await stop().click(); await waitPlaying(false);
  }
  pass('real HTTP AudioContext play and stop work in scenes1 2 3 and6 at quarter90 without overlapping sessions');
  await scene(3);
  const beforeRest = (await audit()).starts.length;
  await play().click(); await waitPlaying(true); await waitPlaying(false, 6500);
  const restAttacks = (await audit()).starts.slice(beforeRest);
  assert.equal(restAttacks.length, 2, 'Two quarter rests must create no oscillator source.');
  assert.ok(Math.abs(restAttacks[1].when - restAttacks[0].when - 4 / 3) < 1e-8);
  assert.equal(await page.locator('.play-status').innerText().then(text => text.includes('재생 중')), false);
  assert.equal(await page.locator('[data-playhead]').count(), 0, 'Natural completion must reset the visual position.');
  pass('scene4 native90BPM sources exclude rests, keep4/3second onset spacing and naturally finish at logical bar end');

  await scene(4);
  const tempo = page.getByRole('combobox', { name: '비교 템포', exact: true });
  for (const bpm of ['60', '120']) {
    await tempo.selectOption(bpm);
    await play().click(); await waitPlaying(true);
    assert.equal(await tempo.isDisabled(), true);
    await stop().click(); await waitPlaying(false);
    assert.equal(await tempo.isEnabled(), true);
  }
  await tempo.selectOption('120');
  await page.getByRole('checkbox', { name: '반복', exact: true }).check();
  const beforeLoop = (await audit()).starts.length;
  await play().click(); await waitPlaying(true); await page.waitForTimeout(2250);
  assert.equal(await play().isDisabled(), true);
  assert.ok((await audit()).starts.length - beforeLoop >= 8, 'The second 120BPM four-note cycle must be scheduled.');
  await stop().click(); await waitPlaying(false);
  await page.getByRole('checkbox', { name: '반복', exact: true }).uncheck();
  await play().click(); await waitPlaying(true); await waitPlaying(false, 5000);
  pass('60 and120 tempo guards, loop across a bar, stop, nonloop natural end and position reset work over HTTP');

  await tempo.selectOption('60');
  await play().click(); await waitPlaying(true);
  const other = await context.newPage();
  try {
    await other.goto('about:blank'); await other.bringToFront();
    const hidden = await page.waitForFunction(() => document.visibilityState === 'hidden', undefined, { timeout: 2000 }).then(() => true).catch(() => false);
    if (!hidden) {
      backgroundOutcome = 'blocked: native headless tab focus did not produce document.hidden; no synthetic visibility event was used';
      block('native background visibility stop', backgroundOutcome);
    } else {
      await waitPlaying(false);
      await page.bringToFront();
      assert.equal(await play().isEnabled(), true);
      backgroundOutcome = 'passed: actual document.hidden stopped transport and return did not autoplay';
      pass('native background visibility stop and return without automatic replay');
    }
  } finally { await other.close(); await page.bringToFront(); await stop().click(); await waitPlaying(false); }

  // Native navigation generates a trusted pagehide. This observer is registered
  // after the app's lifecycle listeners and only records their native stop calls.
  await tempo.selectOption('60');
  await page.getByRole('checkbox', { name: '반복', exact: true }).check();
  const pagehidePatterns = JSON.stringify((await stored()).studentPatterns);
  const startBaseline = (await audit()).starts.length;
  await play().click(); await waitPlaying(true);
  const pagehideKey = `music-theory-lab:qa:pagehide:${buildId}`;
  const armed = await page.evaluate(({ key, startIndex }) => {
    const audio = Reflect.get(window, '__httpAudioAudit') as {
      starts: { id: number; when: number }[]; stops: { id: number; when: number }[];
    };
    const contexts = Reflect.get(window, '__httpAudioContexts') as AudioContext[];
    const currentTime = contexts[contexts.length - 1].currentTime;
    const futureSourceIds = audio.starts.slice(startIndex).filter(item => item.when > currentTime).map(item => item.id);
    const stopIndex = audio.stops.length;
    sessionStorage.removeItem(key);
    window.addEventListener('pagehide', event => {
      sessionStorage.setItem(key, JSON.stringify({
        nativePagehide: event.isTrusted, persisted: event.persisted,
        lateObserver: true, contextTime: contexts[contexts.length - 1].currentTime,
        stopIndexBeforeNavigation: stopIndex, futureSourceIds,
        newStopsBeforeLatePagehideObserver: audio.stops.slice(stopIndex),
      }));
    }, { once: true });
    return { futureSourceIds, stopIndex, currentTime };
  }, { key: pagehideKey, startIndex: startBaseline });
  assert.ok(armed.futureSourceIds.length > 0, 'Arm the native lifecycle check while future notes remain scheduled.');
  audioBeforePagehide = await audit();
  await page.goto('about:blank');
  await page.goto(base.href, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1 }).waitFor(); await readyScore();
  const navigationCapture = await page.evaluate(key => {
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return raw;
  }, pagehideKey);
  assert.ok(navigationCapture, 'The late same-origin observer must persist the native pagehide evidence.');
  const lifecycleCapture = JSON.parse(navigationCapture) as {
    nativePagehide: boolean; contextTime: number; futureSourceIds: number[];
    newStopsBeforeLatePagehideObserver: { id: number; when: number }[];
  };
  assert.equal(lifecycleCapture.nativePagehide, true);
  assert.ok(lifecycleCapture.futureSourceIds.length > 0);
  for (const id of lifecycleCapture.futureSourceIds) {
    assert.ok(lifecycleCapture.newStopsBeforeLatePagehideObserver.some(item => item.id === id && item.when <= lifecycleCapture.contextTime + 1e-8),
      `App lifecycle handler must explicitly stop future source ${id} at current audio time before the late native pagehide observer.`);
  }
  assert.equal((await audit()).contextsCreated, 0, 'Returning from native pagehide must not create an AudioContext or resume sound.');
  assert.equal(JSON.stringify((await stored()).studentPatterns), pagehidePatterns);
  pagehideEvidence = lifecycleCapture;
  pass('native aboutblank pagehide invokes app immediate source.stop for future loop appointments before unload and returns without autoplay');

  await scene(5);
  const before3D = JSON.stringify((await stored()).studentPatterns);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-three-status="ready"] canvas[data-renderer="three-webgl"]') ||
    document.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.textContent === '2D' ||
    document.querySelector('.notices')?.textContent?.includes('2D로 전환'), undefined, { timeout: 20000 });
  const actualCanvas = page.locator('canvas[data-three-canvas][data-renderer="three-webgl"]');
  if (await actualCanvas.count()) {
    assert.ok(Number(await actualCanvas.getAttribute('data-render-count')) > 0);
    assert.equal(Number(await actualCanvas.getAttribute('data-event-count')), 4);
    const nativeContext = await actualCanvas.evaluate(node => {
      const gl = (node as HTMLCanvasElement).getContext('webgl2');
      return { realWebGL2: gl instanceof WebGL2RenderingContext, lost: gl?.isContextLost(), width: gl?.drawingBufferWidth, height: gl?.drawingBufferHeight };
    });
    assert.equal(nativeContext.realWebGL2, true);
    assert.equal(nativeContext.lost, false);
    assert.ok((nativeContext.width ?? 0) > 0 && (nativeContext.height ?? 0) > 0);
    threeOutcome = 'actual Three WebGL canvas rendered';
  } else {
    assert.equal(await page.getByRole('button', { name: '2D', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('.notices').innerText(), /3D.*2D/);
    threeOutcome = 'actual renderer initialization unavailable; explicit2D fallback retained data';
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('scene6-390x844-3d-or-fallback');
  assert.equal(JSON.stringify((await stored()).studentPatterns), before3D);
  await page.getByRole('button', { name: '2D', exact: true }).click();
  assert.equal(JSON.stringify((await stored()).studentPatterns), before3D);
  pass('actual Three renderer or explicit honest context fallback and portrait rotation preserve the rhythm', threeOutcome);

  const settingsButton = page.getByRole('button', { name: '설정·기록', exact: true });
  await settingsButton.click();
  const settings = page.getByRole('dialog', { name: '설정과 학습 기록', exact: true });
  const downloadEvent = page.waitForEvent('download', { timeout: 15000 });
  await settings.getByRole('button', { name: 'JSON 내보내기', exact: true }).click();
  const download = await downloadEvent;
  const exportedPath = `${output}/duration-basics-progress.json`;
  await download.saveAs(exportedPath);
  assert.equal(await download.failure(), null);
  const downloadedBytes = await readFile(exportedPath);
  downloadSha256 = sha256(downloadedBytes);
  const downloaded = JSON.parse(downloadedBytes.toString('utf8')) as ProgressEnvelope;
  assert.equal(parseImport(downloadedBytes.toString('utf8')).ok, true);
  assert.equal(downloaded.lessonId, 'duration-basics');
  const exportedPatterns = JSON.stringify(downloaded.studentPatterns);
  await settings.getByRole('button', { name: '설정 닫기', exact: true }).click();
  await page.getByRole('button', { name: '선택 삭제', exact: true }).click();
  assert.notEqual(JSON.stringify((await stored()).studentPatterns), exportedPatterns);
  await settingsButton.click();
  await page.locator('input[type="file"]').setInputFiles(exportedPath);
  const preview = page.getByRole('dialog', { name: '가져오기 미리보기', exact: true });
  await preview.waitFor(); await preview.getByRole('button', { name: '취소', exact: true }).click();
  assert.notEqual(JSON.stringify((await stored()).studentPatterns), exportedPatterns);
  await page.locator('input[type="file"]').setInputFiles(exportedPath);
  await preview.waitFor(); await preview.getByRole('button', { name: '확인 후 가져오기', exact: true }).click();
  assert.equal(JSON.stringify((await stored()).studentPatterns), exportedPatterns);
  await settings.getByRole('button', { name: '설정 닫기', exact: true }).click();
  pass('actual HTTP blob download saves a valid JSON file and real file import cancel/confirm preserves or restores exact patterns');

  await page.getByRole('button', { name: '교사 보기', exact: true }).click();
  await page.getByRole('button', { name: '정답 공개하기', exact: true }).click();
  assert.equal(await page.locator('.teacher-answer').count(), 1);
  await page.getByRole('button', { name: '교사 보기', exact: true }).click();
  assert.equal(await page.locator('.teacher-answer').count(), 0);
  audioEvidence = { beforeNativePagehide: audioBeforePagehide, beforeFinalReload: await audit() };
  await page.reload({ waitUntil: 'networkidle' });
  await readyScore();
  assert.equal(JSON.stringify((await stored()).studentPatterns), exportedPatterns);
  assert.equal((await audit()).contextsCreated, 0);
  pass('HTTP-origin progress restores after reload with teacher answers hidden and no new AudioContext or autoplay');

  for (const [width, height] of [[844, 390], [667, 375], [568, 320], [390, 844], [360, 640], [320, 640], [1024, 768], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    for (let index = 0; index < 6; index += 1) {
      await scene(index); await readyScore();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, `scene${index + 1} ${width}x${height} body overflow`);
      if (width === 844 || width === 390) await capture(`scene${index + 1}-${width}x${height}-2d`);
    }
    const sizes = await page.locator('.transport button').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
    assert.ok(sizes.every(size => size.width >= 44 && size.height >= 44));
    pass(`HTTP responsive ${width}x${height}: six ready score scenes no body overflow and44px transport`);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpectedRequests, []);
  const failedCoreResources = resources.filter(item => ['document', 'script', 'stylesheet', 'font'].includes(item.type) && item.status >= 400);
  assert.deepEqual(failedCoreResources, []);
  pass('HTTP suite has no uncaught page errors, failed core resources, unexpected origins or data-upload requests');
} catch (error) {
  const detail = error instanceof Error ? error.stack ?? error.message : String(error);
  results.push({ name: 'HTTP integration suite', status: 'failed', detail });
  process.exitCode = 1;
  await page.screenshot({ path: `${output}/failure-http.png`, fullPage: true }).catch(() => undefined);
  process.stderr.write(`${detail}\n`);
} finally {
  await context.tracing.stop({ path: `${output}/trace-http.zip` });
  await writeFile(`${output}/results.json`, JSON.stringify({
    environment: { browser: browser.version(), origin: base.origin, base: base.href, mode: 'served-production-http',
      runnerRevision: 'native-pagehide-v1',
      expectedIndexSha256, servedIndexSha256, headless: true, viewport: 'eight-viewport-matrix',
      actualDevice: false, actualListening: false, actualScreenReader: false },
    results, threeOutcome, backgroundOutcome, pagehideEvidence, downloadSha256, audioEvidence, screenshots, resources, errors, unexpectedRequests,
  }, null, 2));
  await context.close(); await browser.close();
}
