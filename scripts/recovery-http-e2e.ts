import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { BrowserContext, Page } from 'playwright';
import { lessonContent, makePattern } from '../src/content/lesson.ts';
import { frac } from '../src/domain/index.ts';
import { preQuestions } from '../src/lesson/assessment.ts';
import { createLessonState, reduceLesson, serializeLearning, tryRestoreLessonState } from '../src/lesson/controller.ts';
import { BACKUP_KEY, createProgress, parseImport, STORAGE_KEY } from '../src/persistence/progress.ts';
import type { ProgressEnvelope } from '../src/persistence/progress.ts';

// ROOT LATER EXECUTION ONLY. Static checking does not run this module.
// No listener/server startup, readiness fetch, alternate origin/port or connection retry.
const base = new URL(process.env.LAB_HTTP_URL ?? 'http://127.0.0.1:4174/').href;
assert.equal(base, 'http://127.0.0.1:4174/', 'Only the assigned HTTP URL is allowed; no alternate origin or port.');
const allowedOrigin = new URL(base).origin;
const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const expectedIndexSha256 = sha256(await readFile('dist/index.html'));
const appSourceSha256 = sha256(await readFile('src/App.tsx'));
const buildId = expectedIndexSha256.slice(0, 8);
const output = resolve(`output/playwright/recovery-http-${buildId}`);
await mkdir(output, { recursive: true });
const unrelatedKey = 'recovery-qa:unrelated';
const seedMarker = 'recovery-qa:seeded';

let state = createLessonState();
state = reduceLesson(state, { type: 'navigate', sceneId: 'scene-2' });
state = reduceLesson(state, { type: 'split' });
const learning = serializeLearning(state);
const fixture = createProgress({ ...learning, savedAt: '2026-10-26T00:00:00.000Z',
  preferences: { ...createProgress().preferences, ...learning.preferences } });
assert.equal(tryRestoreLessonState(fixture).ok, true);
const semantic = structuredClone(fixture);
semantic.studentPatterns['scene-1/upper'] = makePattern('qa-reference-tamper', [{ duration: frac(1, 2) }, { duration: frac(1, 2) }]);
assert.equal(parseImport(JSON.stringify(semantic)).ok, true);
assert.equal(tryRestoreLessonState(semantic).ok, false);

type AudioAudit = { contexts: number; starts: number; ended: number; unavailable: boolean };
type Entry = {
  name: string; status: 'passed' | 'failed' | 'blocked'; detail?: string;
  pageErrors: string[]; consoleErrors: string[]; unexpectedRequests: string[];
  resources: { url: string; status: number; type: string }[];
  screenshot?: string; trace?: string; storageSnapshot?: unknown; audio?: AudioAudit;
};
const results: Entry[] = [];
let blockedNavigation: string | null = null;
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? 'C:\\Users\\kimyo\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1223\\chrome-headless-shell-win64\\chrome-headless-shell.exe' });
const settings = (page: Page) => page.locator('dialog[aria-labelledby="settings-title"]');
const confirmation = (page: Page) => page.locator('dialog[aria-labelledby="confirm-title"]');
const blockedStatus = (page: Page) => page.locator('p.privacy-note[role="status"]');
const waitSave = async (page: Page) => { await page.waitForTimeout(550); };
const rawPrimary = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
const openSettings = async (page: Page) => {
  await page.locator('.header-actions button').last().click();
  await settings(page).waitFor({ state: 'visible' });
};
const requestNewLearner = async (page: Page) => {
  await openSettings(page);
  await settings(page).locator('.settings-actions button').last().click();
  await confirmation(page).waitFor({ state: 'visible' });
};
const navigate = async (page: Page, sceneIndex: number) => {
  await page.locator('.steps button').nth(sceneIndex).click();
  await page.getByRole('heading', { level: 1, name: lessonContent.scenes[sceneIndex].title, exact: true }).waitFor();
};
function decode(raw: string | null): ProgressEnvelope {
  if (raw === null) throw new Error('Expected a stored progress envelope.');
  const result = parseImport(raw);
  if (!result.ok) throw new Error(result.error.message);
  return result.value.progress;
}
async function seed(context: BrowserContext, raw: string) {
  await context.addInitScript(({ primary, backup, marker, unrelated, value }) => {
    if (localStorage.getItem(marker) !== 'yes') {
      localStorage.setItem(primary, value);
      localStorage.setItem(backup, 'synthetic-recovery-backup');
      localStorage.setItem(unrelated, 'preserve-me');
      localStorage.setItem(marker, 'yes');
    }
  }, { primary: STORAGE_KEY, backup: BACKUP_KEY, marker: seedMarker, unrelated: unrelatedKey, value: raw });
}
async function installActualAudioAudit(context: BrowserContext) {
  await context.addInitScript(() => {
    const audit: AudioAudit = { contexts: 0, starts: 0, ended: 0, unavailable: false };
    Reflect.set(window, '__recoveryAudioAudit', audit);
    const Original = window.AudioContext;
    if (!Original) { audit.unavailable = true; return; }
    // Real browser AudioContext and oscillators; instrumentation is not an audio mock.
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) { super(options); audit.contexts += 1; }
      createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (when = 0) => { audit.starts += 1; start(when); };
        oscillator.addEventListener('ended', () => { audit.ended += 1; });
        return oscillator;
      }
    };
  });
}
async function run(name: string, raw: string, action: (page: Page) => Promise<void>, auditAudio = false) {
  if (blockedNavigation) {
    results.push({ name, status: 'blocked', detail: `No connection retry: ${blockedNavigation}`, pageErrors: [], consoleErrors: [], unexpectedRequests: [], resources: [] });
    return;
  }
  const entry: Entry = { name, status: 'passed', pageErrors: [], consoleErrors: [], unexpectedRequests: [], resources: [] };
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, acceptDownloads: true });
  await context.route(/^https?:\/\//, async route => {
    const request = route.request();
    if (new URL(request.url()).origin !== allowedOrigin || request.method() !== 'GET') {
      entry.unexpectedRequests.push(`${request.method()} ${request.url()}`);
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  // A production preview needs no WebSocket. Do not open another network channel.
  await context.routeWebSocket('**/*', socket => {
    entry.unexpectedRequests.push(`WebSocket ${socket.url()}`);
    socket.close({ code: 1008, reason: 'Recovery QA allows the assigned HTTP preview only.' });
  });
  await seed(context, raw);
  if (auditAudio) await installActualAudioAudit(context);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  page.on('pageerror', error => entry.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') entry.consoleErrors.push(message.text()); });
  page.on('response', response => { entry.resources.push({ url: response.url(), status: response.status(), type: response.request().resourceType() }); });
  try {
    try {
      const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      assert.ok(response, 'The assigned HTTP navigation must return a response.');
      assert.equal(response.status(), 200, 'The assigned preview must return HTTP 200.');
      assert.equal(sha256(await response.body()), expectedIndexSha256, 'Served HTML must match the assigned built index.');
    } catch (error) {
      blockedNavigation = error instanceof Error ? error.message : String(error);
      throw error;
    }
    await page.locator('h1').first().waitFor();
    await page.evaluate(async () => { await document.fonts.ready; });
    await action(page);
    assert.deepEqual(entry.pageErrors, [], 'No uncaught page errors.');
    assert.deepEqual(entry.consoleErrors, [], 'No console errors.');
    assert.deepEqual(entry.unexpectedRequests, [], 'No unexpected network attempts.');
    entry.storageSnapshot = await page.evaluate(({ primary, backup, unrelated }) => ({ primary: localStorage.getItem(primary), backup: localStorage.getItem(backup), unrelated: localStorage.getItem(unrelated) }), { primary: STORAGE_KEY, backup: BACKUP_KEY, unrelated: unrelatedKey });
    if (auditAudio) entry.audio = await page.evaluate(() => Reflect.get(window, '__recoveryAudioAudit') as AudioAudit);
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    entry.status = 'failed';
    entry.detail = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    process.stdout.write(`FAIL ${name}: ${String(error)}\n`);
  } finally {
    entry.screenshot = `${name}-${buildId}-844x390.png`;
    entry.trace = `${name}-${buildId}-trace.zip`;
    await page.screenshot({ path: resolve(output, entry.screenshot), fullPage: true });
    await context.tracing.stop({ path: resolve(output, entry.trace) });
    results.push(entry);
    await context.close();
  }
}

try {
  const invalidInputs = [
    { name: 'malformed', raw: '{not-json' },
    { name: 'future-schema', raw: JSON.stringify({ ...fixture, progressSchemaVersion: 999 }) },
    { name: 'reference-tamper', raw: JSON.stringify(semantic) },
  ];
  for (const input of invalidInputs) {
    await run(`recovery-${input.name}-preserves-original-until-new-learner`, input.raw, async page => {
      await waitSave(page);
      assert.equal(await blockedStatus(page).count(), 1);
      assert.equal(await rawPrimary(page), input.raw, 'Mount must not replace rejected original data.');
      await navigate(page, 1);
      await page.locator('.edit-controls button').first().click();
      await waitSave(page);
      assert.equal(await rawPrimary(page), input.raw, 'Temporary edits must keep recovery-mode autosave blocked.');
      await page.locator('.edit-controls button').last().click();
      await confirmation(page).locator('.dialog-actions button').last().click();
      await waitSave(page);
      assert.equal(await blockedStatus(page).count(), 1, 'Resetting one scene is not consent to replace rejected saved data.');
      assert.equal(await rawPrimary(page), input.raw);
      await requestNewLearner(page);
      await confirmation(page).locator('.dialog-actions button').first().click();
      await waitSave(page);
      assert.equal(await rawPrimary(page), input.raw, 'Cancelling a new learner preserves original data.');
      await requestNewLearner(page);
      await confirmation(page).locator('.dialog-actions button').last().click();
      await waitSave(page);
      assert.equal(await blockedStatus(page).count(), 0);
      const fresh = decode(await rawPrimary(page));
      assert.equal(fresh.studentPatterns['scene-2/main'].length, 1);
      assert.deepEqual(fresh.attempts, {});
      assert.deepEqual(fresh.hints, {});
      const keys = await page.evaluate(({ backup, unrelated }) => ({ backup: localStorage.getItem(backup), unrelated: localStorage.getItem(unrelated) }), { backup: BACKUP_KEY, unrelated: unrelatedKey });
      assert.deepEqual(keys, { backup: null, unrelated: 'preserve-me' });
      await navigate(page, 1);
      await page.locator('.edit-controls button').first().click();
      await waitSave(page);
      assert.equal(decode(await rawPrimary(page)).studentPatterns['scene-2/main'].length, 2, 'Confirmed new learner re-enables valid saves.');
    });
  }

  await run('recovery-valid-import-unblocks-after-confirmation', '{old-rejected-data', async page => {
    await waitSave(page);
    await openSettings(page);
    const upload = { name: 'recovery-valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) };
    await settings(page).locator('input[type=file]').setInputFiles(upload);
    await confirmation(page).waitFor({ state: 'visible' });
    await confirmation(page).locator('.dialog-actions button').first().click();
    await waitSave(page);
    assert.equal(await rawPrimary(page), '{old-rejected-data');
    assert.equal(await blockedStatus(page).count(), 1);
    await settings(page).locator('input[type=file]').setInputFiles(upload);
    await confirmation(page).waitFor({ state: 'visible' });
    await confirmation(page).locator('.dialog-actions button').last().click();
    await waitSave(page);
    assert.equal(await blockedStatus(page).count(), 0);
    const restored = decode(await rawPrimary(page));
    assert.equal(restored.studentPatterns['scene-2/main'].length, 2);
    assert.equal(restored.preferences.currentSceneId, 'scene-2');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), unrelatedKey), 'preserve-me');
  });

  await run('new-learner-clears-quiz-answers-and-score-cancel-preserves', JSON.stringify(fixture), async page => {
    const quiz = page.locator('.concept-quiz');
    await quiz.locator('summary').click();
    for (let index = 0; index < preQuestions.length; index += 1) {
      await quiz.locator('fieldset').nth(index).locator(`input[value="${preQuestions[index].correctOptionId}"]`).check();
    }
    await quiz.locator('button[type=submit]').click();
    assert.equal(await quiz.locator('input:checked').count(), 5);
    assert.equal(await quiz.locator('.quiz-summary').count(), 1);
    const oldSummary = await quiz.locator('.quiz-summary').innerText();
    await requestNewLearner(page);
    await confirmation(page).locator('.dialog-actions button').first().click();
    assert.equal(await quiz.locator('input:checked').count(), 5);
    assert.equal(await quiz.locator('.quiz-summary').innerText(), oldSummary);
    await requestNewLearner(page);
    await confirmation(page).locator('.dialog-actions button').last().click();
    assert.equal(await quiz.locator('input:checked').count(), 0);
    assert.equal(await quiz.locator('.quiz-summary').count(), 0);
    await waitSave(page);
    assert.deepEqual(decode(await rawPrimary(page)).attempts, {});
  });

  for (const mode of ['muted-start', 'zero-volume-start'] as const) {
    const audioFixture = createProgress({ ...serializeLearning(createLessonState()),
      preferences: { ...createProgress().preferences, currentSceneId: 'scene-1', muted: mode === 'muted-start', volume: mode === 'zero-volume-start' ? 0 : 0.35 } });
    await run(`audio-${mode}-does-not-record-listened`, JSON.stringify(audioFixture), async page => {
      const initial = await page.evaluate(() => Reflect.get(window, '__recoveryAudioAudit') as AudioAudit);
      assert.equal(initial.unavailable, false, 'This case requires the actual browser AudioContext.');
      assert.equal(initial.contexts, 0, 'First entry has no autoplay/context creation.');
      const play = page.locator('.transport button.play');
      await play.click();
      await page.waitForFunction(() => (Reflect.get(window, '__recoveryAudioAudit') as AudioAudit).starts > 0);
      await page.waitForFunction(() => {
        const audit = Reflect.get(window, '__recoveryAudioAudit') as AudioAudit;
        const playButton = document.querySelector<HTMLButtonElement>('.transport button.play');
        return playButton?.disabled === false && audit.ended >= audit.starts && audit.ended > 0;
      }, undefined, { timeout: 10_000 });
      await waitSave(page);
      const progress = decode(await rawPrimary(page));
      assert.notEqual(progress.sceneProgress['scene-1'].observedLanes?.upper, 'listened', 'Zero-output playback must not become a listening record.');
      const audit = await page.evaluate(() => Reflect.get(window, '__recoveryAudioAudit') as AudioAudit);
      assert.equal(audit.contexts, 1);
      assert.equal(audit.starts, 1);
      assert.equal(audit.ended, 1);
    }, true);
  }
} finally {
  const report = {
    environment: { browser: browser.version(), base, expectedIndexSha256, appSourceSha256, headless: true,
      actualDevice: false, actualHumanListening: false, audioCasesUse: 'native browser AudioContext instrumented; see executed case evidence',
      scope: 'production HTTP recovery regression; written for explicit root dispatch; no server startup or connection retry' },
    results,
    passed: results.filter(result => result.status === 'passed').length,
    failed: results.filter(result => result.status === 'failed').length,
    blocked: results.filter(result => result.status === 'blocked').length,
  };
  await writeFile(resolve(output, 'recovery-http-results.json'), JSON.stringify(report, null, 2));
  await browser.close();
  if (report.failed || report.blocked) process.exitCode = 1;
}
