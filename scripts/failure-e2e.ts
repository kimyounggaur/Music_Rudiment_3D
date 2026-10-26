import { chromium } from 'playwright';
import type { BrowserContext, Page } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { lessonContent, makePattern } from '../src/content/lesson.ts';
import { frac } from '../src/domain/index.ts';
import { createLessonState, reduceLesson, serializeLearning } from '../src/lesson/controller.ts';
import { BACKUP_KEY, createProgress, parseImport, STORAGE_KEY } from '../src/persistence/progress.ts';
import type { ProgressEnvelope } from '../src/persistence/progress.ts';

// The normal preview-server route is blocked by the execution environment.
// This suite exercises a separate self-contained file artifact only; no socket probes.
const preview = process.env.LAB_PREVIEW_FILE;
if (!preview) throw new Error('LAB_PREVIEW_FILE must name the self-contained local app artifact. Web-served E2E remains blocked.');
const previewPath = resolve(preview);
const artifactBytes = await readFile(previewPath); // Real artifact existence/readability, not an assumed cloud path.
const artifactSha256 = createHash('sha256').update(artifactBytes).digest('hex');
const base = pathToFileURL(previewPath).href;
const output = resolve('output/playwright');
await mkdir(output, { recursive: true });
let state = createLessonState();
state = reduceLesson(state, { type: 'navigate', sceneId: 'scene-2' });
state = reduceLesson(state, { type: 'split' });
const learning = serializeLearning(state);
const fixture = createProgress({ ...learning, savedAt: '2026-10-26T00:00:00.000Z',
  preferences: { ...createProgress().preferences, ...learning.preferences } });
const tampered = structuredClone(fixture);
tampered.studentPatterns['scene-1/upper'] = makePattern('qa-reference-tamper', [{ duration: frac(1, 2) }, { duration: frac(1, 2) }]);
assert.equal(parseImport(JSON.stringify(tampered)).ok, true, 'semantic fixture must reach confirmation, rather than structure rejection');

type Entry = { name: string; status: 'passed' | 'failed'; detail?: string; errors: string[]; consoleErrors: string[]; externalRequests: string[]; viewport: { width: number; height: number } | null; screenshot: string; trace: string };
const results: Entry[] = [];
const selectedCases = new Set((process.env.LAB_FAILURE_CASES ?? '').split(',').filter(Boolean));
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? 'C:/Users/kimyo/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe' });
const filename = (name: string) => `failure-${name.replace(/[^a-z0-9-]/g, '-')}`;
const waitSave = async (page: Page) => { await page.waitForTimeout(450); };
const settings = (page: Page) => page.locator('dialog[aria-labelledby="settings-title"]');
const confirm = (page: Page) => page.locator('dialog[aria-labelledby="confirm-title"]');
const openSettings = async (page: Page) => { await page.locator('.header-actions button').last().click(); await settings(page).waitFor({ state: 'visible' }); };
const canonical = async (page: Page) => page.evaluate((key) => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const value = JSON.parse(raw) as ProgressEnvelope;
  delete (value as Partial<ProgressEnvelope>).savedAt;
  return value as Omit<ProgressEnvelope, 'savedAt'>;
}, STORAGE_KEY);
async function seed(context: BrowserContext, blocked = false) {
  await context.addInitScript(({ primary, backup, progress, denied }) => {
    const original = window.localStorage;
    // One isolated browser context per test; marker prevents reseeding on reload.
    if (original.getItem('failure-qa-seeded') !== 'yes') {
      original.setItem(primary, progress); original.setItem(backup, 'synthetic-backup-probe');
      original.setItem('failure-qa-unrelated', 'preserve-me'); original.setItem('failure-qa-seeded', 'yes');
    }
    if (denied) {
      Object.defineProperty(window, '__failureQaStorage', { value: original, configurable: true });
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('QA storage blocked', 'SecurityError'); } });
    }
  }, { primary: STORAGE_KEY, backup: BACKUP_KEY, progress: JSON.stringify(fixture), denied: blocked });
}
async function run(name: string, prepare: (context: BrowserContext) => Promise<void>, action: (page: Page) => Promise<void>, reducedMotion = false) {
  if (selectedCases.size && !selectedCases.has(name)) return;
  const id = `${filename(name)}-${artifactSha256.slice(0, 8)}`;
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, acceptDownloads: true, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const errors: string[] = [], consoleErrors: string[] = [], externalRequests: string[] = [];
  // Explicitly block HTTP(S) before any request reaches the network.
  await context.route(/https?:\/\//, async (route) => { externalRequests.push(route.request().url()); await route.abort('blockedbyclient'); });
  await prepare(context);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  let status: 'passed' | 'failed' = 'passed', detail: string | undefined;
  try {
    await page.goto(base); await page.locator('h1').first().waitFor();
    await action(page);
    assert.equal(errors.length, 0, `uncaught errors: ${errors.join('; ')}`);
    assert.equal(externalRequests.length, 0, 'app attempted an external request');
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    status = 'failed'; detail = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    process.stdout.write(`FAIL ${name}: ${String(error)}\n`);
  } finally {
    const viewport = page.viewportSize();
    const screenshot = `${id}-${viewport?.width ?? 'unknown'}x${viewport?.height ?? 'unknown'}-file-artifact.png`, trace = `${id}-trace.zip`;
    await page.screenshot({ path: resolve(output, screenshot), fullPage: true });
    await context.tracing.stop({ path: resolve(output, trace) });
    results.push({ name, status, detail, errors, consoleErrors, externalRequests, viewport, screenshot, trace });
    await context.close();
  }
}

try {
  await run('no-audio-api-text-route', async context => {
    await context.addInitScript(() => {
      Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
      Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true });
    });
  }, async page => {
    await page.locator('.play').click();
    await page.locator('.notices').filter({ hasText: /소리/ }).waitFor();
    assert.equal(await page.locator('.play').isEnabled(), true, 'audio failure must not strand transport');
    await page.locator('.text-alternative').click();
    await page.locator('.lane-tabs button').nth(1).click();
    await page.locator('.text-alternative').click();
    for (const question of lessonContent.scenes[0].questions) await page.locator(`input[name="${question.id}"][value="${question.correctValue}"]`).check();
    assert.equal(await page.locator('.nav-actions button').last().isEnabled(), true, 'concept route must complete without audio API');
    await page.locator('.nav-actions button').last().click();
    assert.equal(await page.locator('h1').first().innerText(), lessonContent.scenes[1].title);
  });

  await run('storage-securityerror-export-available', context => seed(context, true), async page => {
    assert.match(await page.locator('.notices').innerText(), /저장|JSON/);
    await page.locator('.steps button').nth(1).click();
    await page.locator('.edit-controls .primary').click();
    assert.ok(await page.locator('[data-event-select]').count() >= 2, 'editing remains interactive');
    await openSettings(page);
    const downloading = page.waitForEvent('download'); await settings(page).locator('.settings-actions button').nth(1).click();
    const download = await downloading;
    const target = resolve(output, 'failure-storage-securityerror-export.json');
    try { await download.saveAs(target); }
    catch (error) { throw new Error(`JSON download failed: ${String(error)}; browser failure=${await download.failure()}; suggested filename=${download.suggestedFilename()}`); }
    assert.equal(parseImport(await readFile(target, 'utf8')).ok, true);
    assert.match(await page.locator('.notices').innerText(), /JSON/);
  });

  await run('storage-securityerror-text-export-valid-current-pattern', context => seed(context, true), async page => {
    let downloads = 0; page.on('download', () => { downloads++; });
    assert.match(await page.locator('.notices').innerText(), /저장|JSON/);
    await page.locator('.steps button').nth(1).click();
    await page.locator('.edit-controls .primary').click();
    await openSettings(page);
    await settings(page).getByRole('button', { name: 'JSON 원문 보기', exact: true }).click();
    const source = settings(page).getByRole('textbox', { name: '내보내기 JSON 원문', exact: true });
    await source.waitFor({ state: 'visible' });
    assert.equal(await source.getAttribute('readonly') !== null, true);
    const text = await source.inputValue();
    const parsed = parseImport(text); assert.equal(parsed.ok, true); if (!parsed.ok) return;
    const pattern = parsed.value.progress.studentPatterns['scene-2/main'];
    assert.equal(pattern.length, 2);
    assert.deepEqual(pattern.map(event => event.duration), [{ n: 1, d: 2 }, { n: 1, d: 2 }]);
    assert.deepEqual(pattern.map(event => event.onset), [{ n: 0, d: 1 }, { n: 1, d: 2 }]);
    assert.equal(parsed.value.progress.preferences.currentSceneId, 'scene-2');
    assert.equal(parsed.value.progress.progressSchemaVersion, 1);
    assert.equal(parsed.value.progress.lessonId, 'duration-basics');
    await source.focus(); await page.keyboard.press('Control+A');
    const selection = await source.evaluate(element => ({ start: (element as HTMLTextAreaElement).selectionStart, end: (element as HTMLTextAreaElement).selectionEnd }));
    assert.equal(selection.start, 0); assert.equal(selection.end, text.length);
    assert.equal(downloads, 0, 'text export must not retry the cancelled download action');
    await writeFile(resolve(output, 'failure-storage-securityerror-text-export.json'), text);
  });

  await run('malicious-and-reference-tamper-import-preserves-state', context => seed(context), async page => {
    await waitSave(page); const before = await canonical(page);
    const blocksBefore = await page.locator('[data-event-select]').count();
    await openSettings(page);
    await page.locator('input[type=file]').setInputFiles({ name: 'malicious.json', mimeType: 'application/json', buffer: Buffer.from('{"__proto__":{"polluted":true}}') });
    await page.locator('.notices').filter({ hasText: /거부/ }).waitFor();
    assert.equal(await confirm(page).isVisible(), false);
    assert.deepEqual(await canonical(page), before);
    await page.locator('input[type=file]').setInputFiles({ name: 'reference-tamper.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(tampered)) });
    await confirm(page).waitFor({ state: 'visible' });
    assert.deepEqual(await canonical(page), before, 'preview must not mutate storage');
    await confirm(page).locator('.dialog-actions button').last().click();
    await confirm(page).waitFor({ state: 'hidden' });
    assert.match(await page.locator('.notices').innerText(), /거부/);
    assert.deepEqual(await canonical(page), before, 'semantic rejection must retain valid progress');
    await settings(page).locator('.dialog-heading button').click();
    assert.equal(await page.locator('[data-event-select]').count(), blocksBefore);
  });

  await run('new-learner-cancel-confirm-backup-deletion', context => seed(context), async page => {
    await waitSave(page); const before = await canonical(page);
    await openSettings(page); await settings(page).locator('.settings-actions button').last().click();
    await confirm(page).waitFor({ state: 'visible' });
    await confirm(page).locator('.dialog-actions button').first().click();
    assert.deepEqual(await canonical(page), before);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), BACKUP_KEY), 'synthetic-backup-probe');
    await openSettings(page); await settings(page).locator('.settings-actions button').last().click();
    await confirm(page).locator('.dialog-actions button').last().click();
    await waitSave(page);
    assert.equal(await page.locator('h1').first().innerText(), lessonContent.scenes[0].title);
    const stored = await canonical(page); assert.ok(stored);
    assert.equal(stored.studentPatterns['scene-2/main'].length, 1, 'fresh learner must not retain split pattern');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), BACKUP_KEY), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('failure-qa-unrelated')), 'preserve-me');
    await page.reload(); await page.locator('h1').first().waitFor();
    assert.equal(await page.locator('h1').first().innerText(), lessonContent.scenes[0].title);
    const reloaded = await canonical(page); assert.ok(reloaded);
    assert.equal(reloaded.studentPatterns['scene-2/main'].length, 1);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), BACKUP_KEY), null);
  });

  await run('blocked-storage-delete-must-not-claim-success', context => seed(context, true), async page => {
    await openSettings(page); await settings(page).locator('.settings-actions button').last().click();
    await confirm(page).locator('.dialog-actions button').last().click();
    const retained = await page.evaluate(({ primary, backup }) => {
      const saved = (window as unknown as { __failureQaStorage: Storage }).__failureQaStorage;
      return { primary: saved.getItem(primary), backup: saved.getItem(backup) };
    }, { primary: STORAGE_KEY, backup: BACKUP_KEY });
    assert.ok(retained.primary && retained.backup, 'blocked storage fixture must still contain inaccessible prior records');
    const notice = await page.locator('.notices').innerText();
    assert.doesNotMatch(notice, /삭제했습니다/, 'UI must not claim deletion when inaccessible records remain');
    assert.match(notice, /저장|삭제|차단|확인/);
  });

  await run('keyboard-dialog-focus-and-escape', context => seed(context), async page => {
    const trigger = page.locator('.header-actions button').last();
    await trigger.focus(); await page.keyboard.press('Enter'); await settings(page).waitFor({ state: 'visible' });
    for (let i = 0; i < 16; i++) {
      const active = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.slice(0, 80) }));
      assert.equal(await settings(page).evaluate(dialog => dialog.contains(document.activeElement)), true, `modal focus must stay within visible settings at Tab step${i}; active=${JSON.stringify(active)}`);
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Escape'); await settings(page).waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(button => button === document.activeElement), true, 'Escape returns focus to opening control');
    const reset = page.locator('.edit-controls button').last(); await reset.focus(); await page.keyboard.press('Enter');
    await confirm(page).waitFor({ state: 'visible' }); await page.keyboard.press('Escape'); await confirm(page).waitFor({ state: 'hidden' });
    assert.equal(await reset.evaluate(button => button === document.activeElement), true);
    const split = page.locator('.edit-controls .primary'); await split.focus(); await page.keyboard.press('Enter');
    assert.ok(await page.locator('[data-event-select]').count() > 2);
  });

  await run('reduced-motion-css3d-2d-and-rotation-preserve-pattern', async () => {}, async page => {
    // No saved preference: this verifies OS initialization rather than overriding a user's saved choice.
    await page.locator('.steps button').nth(1).click();
    await page.locator('.edit-controls .primary').click();
    await waitSave(page); const before = await canonical(page); assert.ok(before);
    await openSettings(page);
    assert.equal(await settings(page).locator('input[type=checkbox]').first().isChecked(), true, 'OS reduced motion must initialize preference');
    await settings(page).locator('.dialog-heading button').click();
    await page.locator('.mode-switch button').last().click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.mode-switch button').last().getAttribute('aria-pressed'), 'true');
    await page.setViewportSize({ width: 360, height: 640 });
    await page.screenshot({ path: resolve(output, 'failure-reduced-motion-360x640-css3d-file-artifact.png'), fullPage: true });
    await page.locator('.mode-switch button').first().click(); await waitSave(page);
    const after = await canonical(page); assert.ok(after);
    assert.deepEqual(after.studentPatterns, before.studentPatterns);
    assert.deepEqual(after.sceneProgress, before.sceneProgress);
    assert.equal(after.preferences.reducedMotion, true);
    assert.equal(await page.locator('canvas').count(), 0, 'CSS3D path is not WebGL');
  }, true);
} finally {
  await writeFile(resolve(output, 'failure-results.json'), JSON.stringify({
    environment: { browser: browser.version(), artifact: previewPath, artifactSha256, origin: 'file-artifact', webServedE2E: 'blocked-by-EACCES-local-socket', actualDevice: false, actualListening: false, headless: true },
    selectedCases: [...selectedCases],
    scope: selectedCases.size ? 'targeted-regression' : 'full-failure-suite',
    results,
  }, null, 2));
  await browser.close();
}
if (results.some(result => result.status === 'failed')) process.exitCode = 1;
