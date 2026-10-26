import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// File-only font fault injection; the denied Chromium1248/localhost actions are never retried.
// Run notation-e2e first so this artifact contains the current renderer code.
const fixturePath = resolve(process.env.LAB_NOTATION_FIXTURE_FILE ?? 'output/notation/vexflow5/fixtures.html');
const fixtureBytes = await readFile(fixturePath);
const fixtureSha256 = createHash('sha256').update(fixtureBytes).digest('hex');
const output = 'output/notation/font-retry';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
await context.addInitScript(() => {
  const fonts = document.fonts;
  const original = fonts.load.bind(fonts);
  let failOnce = true;
  Reflect.set(window, '__fontLoadCalls', 0);
  Reflect.set(window, '__fontFailureInjected', false);
  Object.defineProperty(fonts, 'load', { configurable: true, writable: true, value: (font: string, text?: string) => {
    Reflect.set(window, '__fontLoadCalls', Number(Reflect.get(window, '__fontLoadCalls')) + 1);
    if (failOnce && font.includes('Bravura')) {
      failOnce = false;
      Reflect.set(window, '__fontFailureInjected', true);
      // Let initial ResizeObserver setup settle while this one resource attempt is still pending.
      return new Promise<FontFace[]>((_resolve, reject) => setTimeout(() => reject(new Error('Intentional one-shot local font-load fixture failure')), 80));
    }
    return original(font, text);
  } });
});
const page = await context.newPage();
const pageErrors: string[] = [];
const externalRequests: string[] = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('request', (request) => { if (/^https?:/.test(request.url())) externalRequests.push(request.url()); });
try {
  await page.goto(pathToFileURL(fixturePath).href);
  const panel = page.locator('[data-fixture="note-quarter"]');
  const retry = panel.getByRole('button', { name: '악보 다시 불러오기', exact: true });
  await retry.waitFor();
  assert.equal(await panel.locator('svg').count(), 0);
  assert.equal(await page.evaluate(() => Reflect.get(window, '__fontFailureInjected')), true);
  const buttonBounds = await retry.boundingBox();
  assert.ok(buttonBounds && buttonBounds.width >= 44 && buttonBounds.height >= 44);
  assert.equal(await panel.locator('[data-selection]').innerText(), '선택 없음');
  await panel.screenshot({ path: `${output}/quarter-844x390-font-error.png` });

  await retry.click();
  await panel.locator('[data-notation-ready="true"]').waitFor();
  assert.equal(await panel.locator('svg').count(), 1);
  assert.equal(await panel.locator('[data-notation-event]').count(), 4);
  assert.deepEqual(await panel.locator('[data-notation-event]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-notation-event'))),
    ['note-quarter-0', 'note-quarter-1', 'note-quarter-2', 'note-quarter-3']);
  assert.deepEqual(await panel.locator('[data-note-type]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-note-type'))),
    ['quarter', 'quarter', 'quarter', 'quarter']);
  assert.deepEqual(await panel.locator('[data-pitch-key]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-pitch-key'))),
    ['c/4', 'c/4', 'c/4', 'c/4']);
  assert.equal(await panel.locator('[data-selection]').innerText(), '선택 없음');
  assert.equal(await retry.count(), 0);
  assert.ok((await page.evaluate(() => Number(Reflect.get(window, '__fontLoadCalls')))) >= 4);
  assert.equal(await panel.locator('[data-local-fonts-ready="true"]').count(), 1);
  assert.equal(await panel.locator('[aria-label="악보 영역, 좁은 화면에서는 가로로 스크롤하세요"]').evaluate((element) => element === document.activeElement), true);
  await panel.screenshot({ path: `${output}/quarter-844x390-font-recovered.png` });
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(externalRequests, []);
  const result = { status: 'passed', checks: 1, name: 'one-shot local font failure → explicit44px retry → one real SVG with unchanged quarter-note events and preserved focus',
    browser: browser.version(), fixturePath, fixtureSha256, pageErrors, externalRequests,
    route: 'self-contained file only; no localhost connection or denied Chromium1248 retry', musicEducatorApproval: 'pending', realDevice: 'not tested' };
  await writeFile(`${output}/results.json`, JSON.stringify(result, null, 2));
  process.stdout.write(`PASS ${result.name}\n`);
} catch (error) {
  await writeFile(`${output}/results.json`, JSON.stringify({ status: 'failed', fixturePath, fixtureSha256, pageErrors, externalRequests, error: error instanceof Error ? error.stack : String(error) }, null, 2));
  throw error;
} finally {
  await context.close();
  await browser.close();
}
