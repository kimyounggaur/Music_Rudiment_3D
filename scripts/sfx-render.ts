/**
 * v3 R7 sound-effect render check (REFACTOR_PROMPTS_V3 R7-6).
 *
 *   node scripts/sfx-render.ts [--base http://127.0.0.1:4173/] [--out docs/qa/refactor/R7/sfx-render.json]
 *
 * Renders every procedural effect in the browser's OfflineAudioContext (48 kHz, mono) from the app's
 * own module on the local dev server and reports its audible length (last sample above −60 dBFS) and
 * its peak in dBFS. Pass: length within ±10% of the design and peak ≤ −6 dBFS. Listening is a human
 * check (external review); this only measures.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index]!.replace(/^--/, ''), process.argv[index + 1] ?? '');
const base = new URL(args.get('base') ?? 'http://127.0.0.1:4173/');
assert.equal(base.hostname, '127.0.0.1', 'The render uses the local dev server only.');
const out = resolve(args.get('out') ?? 'docs/qa/refactor/R7/sfx-render.json');

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
type Row = { name: string; designS: number; audibleS: number; lengthError: number; peak: number; peakDbfs: number; rms: number; pass: boolean };
let rows: Row[] = [];
try {
  const context = await browser.newContext();
  await context.route(/^https?:\/\//, async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && url.port === base.port) await route.continue();
    else await route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  await page.goto(new URL('/', base).toString(), { waitUntil: 'domcontentloaded' });
  rows = await page.evaluate(async () => {
    const module = await import('/src/book/sfx/synthSfx.ts' as string) as typeof import('../src/book/sfx/synthSfx.ts');
    const result: Row[] = [];
    for (const name of module.SFX_NAMES) {
      const rate = 48_000;
      const offline = new OfflineAudioContext(1, Math.round(rate * 0.8), rate);
      module.playSynthSfx(name, offline as unknown as Parameters<typeof module.playSynthSfx>[1], offline.destination, 0.05);
      const buffer = await offline.startRendering();
      const data = buffer.getChannelData(0);
      let peak = 0, first = -1, last = -1, sum = 0;
      for (let index = 0; index < data.length; index += 1) {
        const value = Math.abs(data[index]!);
        peak = Math.max(peak, value);
        sum += value * value;
        if (value > 0.001) { if (first < 0) first = index; last = index; }
      }
      const designS = module.SFX_SPECS[name].duration;
      const audibleS = first < 0 ? 0 : (last - first) / rate;
      const lengthError = (audibleS - designS) / designS;
      const peakDbfs = 20 * Math.log10(Math.max(peak, 1e-9));
      result.push({ name, designS, audibleS: Number(audibleS.toFixed(4)), lengthError: Number(lengthError.toFixed(3)), peak: Number(peak.toFixed(4)),
        peakDbfs: Number(peakDbfs.toFixed(2)), rms: Number(Math.sqrt(sum / data.length).toFixed(5)), pass: Math.abs(lengthError) <= 0.1 && peakDbfs <= -6 });
    }
    return result;
  });
  await context.close();
} finally {
  await browser.close();
}
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify({ time: new Date().toISOString(), sampleRate: 48_000, rows }, null, 2)}\n`);
for (const row of rows) process.stdout.write(`${row.pass ? 'PASS' : 'FAIL'} ${row.name} ${row.audibleS}s (design ${row.designS}s, ${(row.lengthError * 100).toFixed(1)}%) peak ${row.peakDbfs} dBFS\n`);
process.exitCode = rows.length === 7 && rows.every(row => row.pass) ? 0 : 1;
