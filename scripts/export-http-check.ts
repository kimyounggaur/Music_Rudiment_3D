import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import assert from 'node:assert/strict';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { lessonContent } from '../src/content/lesson.ts';
import { parseImport, STORAGE_KEY } from '../src/persistence/progress.ts';

// Root runs this only in the separately authorized HTTP execution profile.
// No server start, fallback port, DNS probe, retry loop or alternative download route.
const base = new URL(process.env.LAB_HTTP_URL ?? 'http://127.0.0.1:4174/');
assert.ok(base.protocol === 'http:' && base.hostname === '127.0.0.1' && base.port === '4174'
  && base.pathname === '/' && !base.search && !base.hash && !base.username && !base.password,
'Only the expressly authorized http://127.0.0.1:4174/ target is accepted.');
const runId = new Date().toISOString().replace(/[-:.TZ]/g, '') + '-' + process.pid;
const output = resolve('output/playwright');
const browserDownloadDirectory = resolve(output, 'export-http-browser-downloads');
await mkdir(browserDownloadDirectory, { recursive: true });
const prefix = `export-http-${runId}`;
const jsonPath = resolve(output, `${prefix}-progress.json`);
const resultPath = resolve(output, `${prefix}-result.json`);
const screenshotPath = resolve(output, `${prefix}-844x390.png`);
const tracePath = resolve(output, `${prefix}-trace.zip`);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ?? 'C:/Users/kimyo/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe';
const pageErrors: string[] = [], consoleErrors: string[] = [], blockedExternalRequests: string[] = [];
const checks: { name: string; status: 'passed'; detail?: string }[] = [];
let browser: Browser | null = null, context: BrowserContext | null = null, page: Page | null = null;
let phase = 'prepare';
let failure: string | null = null;
let downloadFailure: string | null = null;
let downloadUrl: string | null = null;
let suggestedFilename: string | null = null;
let fileProof: { path: string; bytes: number; sha256: string } | null = null;
let browserVersion: string | null = null;
let httpStatus: number | null = null;
let tracing = false;
let distIndexSha256: string | null = null;
try {
  try { distIndexSha256 = createHash('sha256').update(await readFile('dist/index.html')).digest('hex'); } catch { /* record absence; HTTP response is still checked directly */ }
  phase = 'launch-browser';
  browser = await chromium.launch({ headless: true, executablePath, downloadsPath: browserDownloadDirectory });
  browserVersion = browser.version();
  context = await browser.newContext({ viewport: { width: 844, height: 390 }, acceptDownloads: true });
  await context.route(/https?:\/\//, async route => {
    if (new URL(route.request().url()).origin === base.origin) { await route.continue(); return; }
    blockedExternalRequests.push(route.request().url()); await route.abort('blockedbyclient');
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true }); tracing = true;
  page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  phase = 'single-authorized-http-navigation';
  const response = await page.goto(base.href, { waitUntil: 'networkidle', timeout: 15000 });
  httpStatus = response?.status() ?? null;
  assert.ok(response?.ok(), `HTTP page load failed (${httpStatus})`);
  await page.locator('h1').first().waitFor();
  checks.push({ name: 'authorized HTTP app loaded', status: 'passed', detail: `HTTP${httpStatus}` });
  phase = 'edit-synthetic-pattern';
  await page.locator('.steps button').nth(1).click();
  await page.getByRole('heading', { level: 1, name: lessonContent.scenes[1].title, exact: true }).waitFor();
  const split = page.locator('.edit-controls .primary'); assert.equal(await split.isEnabled(), true);
  await split.click();
  await page.waitForTimeout(450); // app's250ms save debounce, not a music clock
  const savedBefore = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  assert.ok(savedBefore, 'edited rhythm should have a valid browser storage snapshot');
  const stored = parseImport(savedBefore); if (!stored.ok) throw new Error(stored.error.message);
  const expected = stored.value.progress.studentPatterns['scene-2/main'];
  assert.equal(expected.length, 2, 'synthetic pattern must be exactly two half notes');
  assert.deepEqual(expected.map(event => event.duration), [{ n: 1, d: 2 }, { n: 1, d: 2 }]);
  checks.push({ name: 'current two-half-note pattern stored', status: 'passed' });
  phase = 'request-one-json-download';
  await page.locator('.header-actions button').last().click();
  const settings = page.locator('dialog[aria-labelledby="settings-title"]'); await settings.waitFor({ state: 'visible' });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    settings.getByRole('button', { name: 'JSON 내보내기', exact: true }).click(),
  ]);
  downloadUrl = download.url(); suggestedFilename = download.suggestedFilename();
  assert.equal(suggestedFilename, 'duration-basics-progress.json');
  phase = 'wait-for-real-download-file';
  try { await download.saveAs(jsonPath); }
  catch (error) { downloadFailure = await download.failure(); throw new Error(`download.saveAs failed: ${String(error)}; download.failure=${downloadFailure}`); }
  downloadFailure = await download.failure(); assert.equal(downloadFailure, null);
  const file = await stat(jsonPath); assert.ok(file.isFile() && file.size > 0, 'download success requires a real nonempty newly named file');
  const bytes = await readFile(jsonPath); assert.equal(bytes.length, file.size);
  fileProof = { path: jsonPath, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  checks.push({ name: 'real JSON download file generated', status: 'passed', detail: `${file.size} bytes` });
  phase = 'validate-downloaded-data';
  const parsed = parseImport(bytes.toString('utf8')); if (!parsed.ok) throw new Error(parsed.error.message);
  assert.equal(parsed.value.progress.lessonId, 'duration-basics');
  assert.equal(parsed.value.progress.progressSchemaVersion, 1);
  assert.equal(parsed.value.progress.preferences.currentSceneId, 'scene-2');
  assert.deepEqual(parsed.value.progress.studentPatterns['scene-2/main'], expected, 'file must represent the actual current UI rhythm');
  const rawText = settings.getByRole('textbox', { name: '내보내기 JSON 원문', exact: true }); await rawText.waitFor({ state: 'visible' });
  assert.deepEqual(JSON.parse(bytes.toString('utf8')), JSON.parse(await rawText.inputValue()), 'download and visible export text must share one snapshot');
  checks.push({ name: 'downloaded schema/current pattern/visible snapshot match', status: 'passed' });
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
  assert.equal(blockedExternalRequests.length, 0, blockedExternalRequests.join('\n'));
  checks.push({ name: 'no uncaught errors or external requests', status: 'passed' });
  phase = 'complete';
  console.log(`PASS actual HTTP JSON download: ${jsonPath} (${file.size} bytes)`);
} catch (error) {
  failure = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  process.exitCode = 1; console.error(`FAIL HTTP export at ${phase}: ${String(error)}`);
} finally {
  if (page && !page.isClosed()) await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  if (context && tracing) await context.tracing.stop({ path: tracePath }).catch(() => undefined);
  await browser?.close();
  let generatedFileExists = false;
  try { await access(jsonPath); generatedFileExists = true; } catch { /* no generated file */ }
  const result = { status: failure ? 'failed' : 'passed', phase, failure,
    environment: { node: process.version, browser: browserVersion, executablePath, origin: base.origin,
      authorizedHttpTarget: base.href, browserDownloadDirectory, distIndexSha256, actualDevice: false, actualListening: false },
    checks, httpStatus, download: { suggestedFilename, url: downloadUrl, failure: downloadFailure, generatedFileExists, file: fileProof },
    pageErrors, consoleErrors, blockedExternalRequests, artifacts: { resultPath, screenshotPath, tracePath },
    causalLimit: 'This verifies one authorized HTTP environment. A success does not identify the exact cause of earlier file-origin cancellation because execution permissions/origin/download directory may differ.',
  };
  await writeFile(resultPath, JSON.stringify(result, null, 2) + '\n');
  await writeFile(resolve(output, 'export-http-latest.json'), JSON.stringify(result, null, 2) + '\n');
}
