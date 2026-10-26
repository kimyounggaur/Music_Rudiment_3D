import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { add, durationForNotation, eq, frac, midi } from '../src/domain/index.ts';
import type { Fraction, NotationType, Pitch } from '../src/domain/index.ts';
import type { MusicEvent } from '../src/content/types.ts';
import { validateEvents } from '../src/content/validation.ts';

// This suite renders a separate self-contained file. Never retry the denied localhost socket.
const output = 'output/notation/vexflow5';
await mkdir(output, { recursive: true });
const names: readonly NotationType[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];
const denominators = [1, 2, 4, 8, 16];
const c4: Pitch = { step: 'C', alter: 0, octave: 4 };
type Fixture = { id: string; title: string; events: readonly MusicEvent[]; keySignature?: 'C' | 'G'; expectedBeams: number };

function pattern(id: string, entries: readonly { type: NotationType; duration: Fraction; kind?: 'note' | 'rest'; pitch?: Pitch }[]): MusicEvent[] {
  let onset = frac(0);
  return entries.map((entry, index) => {
    const common = { id: `${id}-${index}`, onset, duration: entry.duration, notation: { type: entry.type, dots: 0 } };
    onset = add(onset, entry.duration);
    return entry.kind === 'rest' ? { ...common, kind: 'rest' } : { ...common, kind: 'note', pitch: entry.pitch ?? c4 };
  });
}

const fixtures: Fixture[] = [];
for (const kind of ['note', 'rest'] as const) for (const [index, type] of names.entries()) {
  const count = denominators[index];
  const id = `${kind}-${type}`;
  fixtures.push({ id, title: `${kind === 'note' ? 'C4 음표' : '쉼표'} · ${type}`, events: pattern(id, Array.from({ length: count }, () => ({ type, duration: frac(1, count), kind }))), expectedBeams: kind === 'note' && count >= 8 ? 4 : 0 });
}
fixtures.push({ id: 'mixed-scene6', title: '장면 6 · 2분음표 + 4분쉼표 + 8분음표 2개', events: pattern('mixed', [
  { type: 'half', duration: frac(1, 2) }, { type: 'quarter', duration: frac(1, 4), kind: 'rest' },
  { type: 'eighth', duration: frac(1, 8) }, { type: 'eighth', duration: frac(1, 8) },
]), expectedBeams: 1 });
fixtures.push({ id: 'empty-draft', title: '빈 초안 · 자동 쉼표 삽입 없음', events: [], expectedBeams: 0 });
fixtures.push({ id: 'incomplete-draft', title: '미완성 초안 · 3/8만 입력됨', events: pattern('draft', [
  { type: 'quarter', duration: frac(1, 4) }, { type: 'eighth', duration: frac(1, 8) },
]), expectedBeams: 0 });
fixtures.push({ id: 'spelling-f-sharp-g-flat', title: 'C장조 · F♯4와 G♭4 철자 보존', events: pattern('spelling', [
  { type: 'quarter', duration: frac(1, 4), pitch: { step: 'F', alter: 1, octave: 4 } },
  { type: 'quarter', duration: frac(1, 4), pitch: { step: 'G', alter: -1, octave: 4 } },
  { type: 'quarter', duration: frac(1, 4) }, { type: 'quarter', duration: frac(1, 4), kind: 'rest' },
]), expectedBeams: 0 });
fixtures.push({ id: 'g-major-effective-alter', title: 'G장조 · F♯ 최종 alter + 제자리표와 재적용', keySignature: 'G', events: pattern('g-major', [
  { type: 'quarter', duration: frac(1, 4), pitch: { step: 'F', alter: 1, octave: 4 } },
  { type: 'quarter', duration: frac(1, 4), pitch: { step: 'F', alter: 0, octave: 4 } },
  { type: 'quarter', duration: frac(1, 4), pitch: { step: 'F', alter: 1, octave: 4 } },
  { type: 'quarter', duration: frac(1, 4), kind: 'rest' },
]), expectedBeams: 0 });

for (const fixture of fixtures) {
  const validation = validateEvents(fixture.events, { mode: fixture.id.includes('draft') ? 'draft' : 'playable' });
  if (fixture.id === 'spelling-f-sharp-g-flat' || fixture.id === 'g-major-effective-alter') {
    // These are adapter regression fixtures, deliberately outside the C4-only pilot content contract.
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.every((issue) => issue.code === 'pilot-pitch'));
    for (const event of fixture.events) {
      assert.equal(eq(durationForNotation(event.notation), event.duration), true);
      if (event.kind === 'note') assert.ok(Number.isInteger(midi(event.pitch)));
    }
  } else assert.equal(validation.valid, true, `Invalid fixture ${fixture.id}: ${JSON.stringify(validation)}`);
}

const entry = `${output}/fixture-entry.tsx`;
await writeFile(entry, `import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NotationView } from '../../../src/notation/NotationView.tsx';
const fixtures = ${JSON.stringify(fixtures)};
function Panel({ fixture }) {
  const [selectedId, select] = useState(null);
  const [activeId, activate] = useState(null);
  const [position, move] = useState(0);
  return <section data-fixture={fixture.id} className="fixture"><h2>{fixture.title}</h2>
    <button data-active-toggle onClick={() => { activate(fixture.events[0]?.id ?? null); move(value => value === 0 ? 0.25 : 0); }}>현재 음 강조 변경</button>
    <output data-selection>{selectedId ?? '선택 없음'}</output>
    <NotationView events={fixture.events} keySignature={fixture.keySignature ?? 'C'} selectedId={selectedId} activeId={activeId} position={position} onSelect={select}/>
  </section>;
}
createRoot(document.getElementById('root')).render(<main><h1>실제 VexFlow 5 악보 검수 fixture</h1><p>로컬 data:woff2 폰트 · 음악 교육자 승인 대기</p>{fixtures.map(fixture => <Panel key={fixture.id} fixture={fixture}/>)}</main>);
`);
const built = await build({ entryPoints: [entry], bundle: true, write: false, format: 'iife', target: 'es2022', jsx: 'automatic', minify: true, define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'eof' });
const javascript = built.outputFiles[0].text.replaceAll('</script', '<\\/script');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VexFlow 5 실제 악보 fixture</title><style>body{margin:0;background:#edf1f1;color:#172f36;font:16px/1.5 system-ui,sans-serif}main{max-width:1050px;margin:auto;padding:18px}.fixture{background:white;padding:18px;margin:16px 0;border:1px solid #9aafb4;border-radius:12px}h1{font-size:24px}h2{font-size:18px}button{min-height:44px;font:inherit;margin-right:12px}button:focus-visible{outline:3px solid #934b10;outline-offset:3px}output{font-size:13px} @media print{body,main{background:white}main{padding:0}.fixture{break-inside:avoid}svg{max-width:100%;height:auto!important}button,details{display:none}}</style></head><body><div id="root"></div><script>${javascript}</script></body></html>`;
const htmlPath = `${output}/fixtures.html`;
await writeFile(htmlPath, html);
await writeFile(`${output}/fixtures.json`, JSON.stringify(fixtures, null, 2));

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
} catch (error) {
  await writeFile(`${output}/results.json`, JSON.stringify({ status: 'blocked', stage: 'browser launch before page/context', artifact: htmlPath, fixtures: fixtures.length,
    executable: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? 'Playwright default', error: error instanceof Error ? error.message : String(error),
    browserRenderExecuted: false, servedLocalhostRoute: 'denied; never retried', musicEducatorApproval: 'pending' }, null, 2));
  throw error;
}
const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
const page = await context.newPage();
const errors: string[] = [];
const external: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => { if (/^https?:/.test(request.url())) external.push(request.url()); });
const results: { name: string; status: 'passed'; detail?: unknown }[] = [];
const pass = (name: string, detail?: unknown) => { results.push({ name, status: 'passed', detail }); process.stdout.write(`PASS ${name}\n`); };
try {
  await page.goto(pathToFileURL(resolve(htmlPath)).href);
  await page.waitForFunction((count) => document.querySelectorAll('[data-notation-ready="true"]').length === count, fixtures.length);
  assert.equal(await page.evaluate(() => document.fonts.check('40px Bravura', '\uE0A4')), true);
  assert.equal(await page.evaluate(() => document.fonts.check('16px Academico', '4/4')), true);
  pass('actual bundled Bravura and Academico fonts ready, no CDN');
  for (const fixture of fixtures) {
    const panel = page.locator(`[data-fixture="${fixture.id}"]`);
    assert.equal(await panel.locator('svg').count(), 1, `${fixture.id} SVG count`);
    assert.equal(await panel.locator('[data-notation-event]').count(), fixture.events.length, `${fixture.id} event mapping`);
    assert.equal(await panel.locator('[data-beam-events]').count(), fixture.expectedBeams, `${fixture.id} quarter-note beam groups`);
    assert.match((await panel.locator('svg').getAttribute('data-renderer-version')) ?? '', /^5\.0\.0/);
    if (fixture.id.startsWith('rest-')) assert.equal(await panel.locator('[data-event-kind="rest"]').count(), fixture.events.length);
    const svg = await panel.locator('svg').evaluate((element) => element.outerHTML);
    await writeFile(`${output}/${fixture.id}-actual.svg`, svg);
    await panel.screenshot({ path: `${output}/${fixture.id}-844x390-default.png` });
    pass(`render ${fixture.id}`, { events: fixture.events.length, beams: fixture.expectedBeams });
  }

  const ledgerEvidence = await page.locator('[data-fixture="note-quarter"]').evaluate((panel) => {
    const svg = panel.querySelector('svg')!;
    const bottom = Number(svg.getAttribute('data-staff-bottom-y'));
    return [...panel.querySelectorAll('[data-notation-event]')].map((group) => {
      const y = Number(group.getAttribute('data-note-y'));
      const ledgerLines = [...group.querySelectorAll<SVGGraphicsElement>('path,line,rect')].map((element) => element.getBBox()).filter((box) => box.width > 10 && box.width < 100 && box.height < 1.6 && Math.abs(box.y + box.height / 2 - y) < 1.1).length;
      return { id: group.getAttribute('data-notation-event'), y, bottom, ledgerLines };
    });
  });
  for (const evidence of ledgerEvidence) { assert.equal(evidence.y - evidence.bottom, 10); assert.ok(evidence.ledgerLines >= 1, `Actual C4 ledger line missing: ${JSON.stringify(evidence)}`); }
  pass('treble C4 is one ledger line below staff and actual SVG contains ledger strokes', ledgerEvidence);

  const restPlacement = await page.evaluate(() => {
    const whole = document.querySelector('[data-fixture="rest-whole"] [data-notation-event]')!;
    const half = document.querySelector('[data-fixture="rest-half"] [data-notation-event]')!;
    const svg = whole.closest('svg')!;
    return { wholeY: Number(whole.getAttribute('data-note-y')), halfY: Number(half.getAttribute('data-note-y')),
      bottom: Number(svg.getAttribute('data-staff-bottom-y')), wholeCentered: whole.getAttribute('data-center-aligned'),
      wholeX: (whole as SVGGraphicsElement).getBBox().x, svgWidth: Number(svg.getAttribute('width')) };
  });
  assert.equal(restPlacement.wholeY, restPlacement.bottom - 30);
  assert.equal(restPlacement.halfY, restPlacement.bottom - 20);
  assert.equal(restPlacement.wholeCentered, 'true');
  assert.ok(restPlacement.wholeX > restPlacement.svgWidth * 0.4 && restPlacement.wholeX < restPlacement.svgWidth * 0.7);
  pass('whole rest hangs from fourth line and is centered; half rest stands on middle line', restPlacement);

  const spelling = page.locator('[data-fixture="spelling-f-sharp-g-flat"]');
  const keys = await spelling.locator('[data-pitch-key]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-pitch-key')));
  assert.deepEqual(keys.slice(0, 2), ['f#/4', 'gb/4']);
  const ys = await spelling.locator('[data-note-y]').evaluateAll((elements) => elements.map((element) => Number(element.getAttribute('data-note-y'))));
  assert.equal(ys[0] - ys[1], 5);
  pass('F sharp and G flat retain distinct staff spelling despite equal sounding pitch', { keys, ys });

  const quarter = page.locator('[data-fixture="note-quarter"]');
  const drawing = quarter.locator('[data-score-drawing]');
  const beforeRender = await drawing.getAttribute('data-render-count');
  const beforeText = await quarter.locator('svg text').allTextContents();
  await quarter.locator('[data-active-toggle]').click();
  assert.equal(await quarter.locator('[data-score-highlight]').count(), 1);
  assert.equal(await drawing.getAttribute('data-render-count'), beforeRender);
  await quarter.locator('summary').click();
  await quarter.getByRole('button', { name: /^2번째/ }).click();
  assert.equal(await quarter.locator('[data-selected="true"]').count(), 1);
  assert.equal(await quarter.locator('[data-selection]').innerText(), 'note-quarter-1');
  assert.equal(await drawing.getAttribute('data-render-count'), beforeRender);
  assert.deepEqual(await quarter.locator('svg text').allTextContents(), beforeText);
  await quarter.screenshot({ path: `${output}/note-quarter-844x390-selected-active.png` });
  pass('event selection and playback highlighting preserve the actual notation SVG and glyphs');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction((count) => document.querySelectorAll('[data-notation-ready="true"]').length === count, fixtures.length);
  assert.equal(await page.locator('svg').count(), fixtures.length);
  await page.screenshot({ path: `${output}/all-fixtures-390x844.png`, fullPage: true });
  await page.locator('[data-fixture="note-sixteenth"]').screenshot({ path: `${output}/note-sixteenth-390x844.png` });
  pass('portrait resize preserves one SVG per fixture without accumulated renderers');
  await page.emulateMedia({ media: 'print' });
  const printFits = await page.locator('svg').evaluateAll((svgs) => svgs.every((svg) => svg.getBoundingClientRect().right <= svg.parentElement!.parentElement!.getBoundingClientRect().right + 1));
  assert.equal(printFits, true, 'Print score must fit its paper-column width');
  await page.pdf({ path: `${output}/notation-print.pdf`, format: 'A4', printBackground: true });
  assert.equal(await page.locator('svg').count(), fixtures.length);
  pass('print media retains actual SVG notation, PDF generated for review');
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  pass('no browser page errors and no HTTP(S) requests');
  await writeFile(`${output}/results.json`, JSON.stringify({ status: 'passed', browser: browser.version(), route: 'self-contained file only; served localhost route denied and never retried', fixtures: fixtures.length, results, errors, external, htmlBytes: Buffer.byteLength(html), musicEducatorApproval: 'pending', realDevice: 'not tested', fontLicense: 'separate notice verification pending' }, null, 2));
} catch (error) {
  await writeFile(`${output}/results.json`, JSON.stringify({ status: 'failed', results, errors, external, error: error instanceof Error ? error.stack : String(error) }, null, 2));
  throw error;
} finally {
  await context.close();
  await browser.close();
}

// Reading the generated artifact is evidence of a real local result, not a cloud path assumption.
assert.ok((await readFile(htmlPath)).byteLength > 0);
