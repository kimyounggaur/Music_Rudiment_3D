/**
 * v3 R9 visual baseline (REFACTOR_PROMPTS_V3 R9-a 1; v2.1 V16): the capture matrix
 * 3 viewports × {cover, opening50, spread1, turn50, spread2, shot, 2d} × {legacy, ink}. The legacy
 * renderer was removed in R9-b; its 18 cells were captured before that (docs/qa/refactor/R9), so a
 * new run takes `--renderers ink` (the default).
 *
 *   node scripts/visual-baseline.ts [--out docs/qa/refactor/R9] [--base http://127.0.0.1:4173/] [--renderers ink]
 *
 * It runs scripts/refactor-capture.ts (the R1 capture, kept under its name so earlier stage
 * evidence stays reproducible) for each renderer and writes `baseline/matrix.json`: one row per
 * cell with every number the stages measured — far/near ratio, book width, paper luminance, body
 * x-height inputs, HTML page elements, draw calls, renderer textures and print memory. The legacy
 * renderer has no lesson shot, so that cell is recorded as not applicable. Regressions compare the
 * same app before and after; nothing here aims at pixel equality with the original (V16).
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index]!.replace(/^--/, ''), process.argv[index + 1] ?? '');
const outRoot = resolve(args.get('out') ?? 'docs/qa/refactor/R9');
const base = args.get('base') ?? 'http://127.0.0.1:4173/';
const VIEWPORTS = ['1280x720', '844x390', '390x844'] as const;
const STATES = ['cover', 'opening50', 'spread1', 'turn50', 'spread2', 'shot', '2d'] as const;
const RENDERERS = (args.get('renderers') ?? 'ink').split(',').filter((item): item is 'legacy' | 'ink' => item === 'legacy' || item === 'ink');
const stage = outRoot.split('/').at(-1) ?? 'R9';

for (const renderer of RENDERERS) {
  const states = STATES.filter(state => renderer === 'ink' || state !== 'shot');
  const command = ['scripts/refactor-capture.ts', '--stage', stage, '--phase', 'after', '--renderer', renderer, '--quality', 'high',
    '--viewports', VIEWPORTS.join(','), '--states', states.join(','), '--base', base];
  process.stdout.write(`node ${command.join(' ')}\n`);
  execFileSync(process.execPath, command, { stdio: 'inherit' });
}

type Capture = { file: string; viewport: string; state: string; renderer: string; phase: string; data: Record<string, string>;
  layout?: Record<string, unknown>; luminance?: Record<string, number>; extra?: Record<string, unknown> };
const metrics = JSON.parse(await readFile(resolve(outRoot, 'metrics.json'), 'utf8')) as Capture[];
const rows = VIEWPORTS.flatMap(viewport => STATES.flatMap(state => RENDERERS.map(renderer => {
  const found = metrics.find(item => item.phase === 'after' && item.viewport === viewport && item.state === state && item.renderer === renderer && item.file);
  if (!found) return { viewport, state, renderer, file: null, applicable: !(renderer === 'legacy' && state === 'shot') };
  const ink = (found.extra?.ink ?? null) as Record<string, unknown> | null;
  return {
    viewport, state, renderer, file: found.file, applicable: true,
    layout: found.layout ?? null, luminance: found.luminance ?? null,
    htmlPageElements: ink?.htmlPageElements ?? found.data.htmlPageElements ?? null,
    bodyXHeight: (ink?.left as Record<string, unknown> | undefined)?.bodyXHeightPx ?? null,
    drawCalls: Number(found.data.drawCalls ?? NaN), textures: Number(found.data.textures ?? NaN), geometries: Number(found.data.geometries ?? NaN),
    printMemory: ink?.print ?? null, figure: ink?.figure ?? null,
  };
})));
await mkdir(resolve(outRoot, 'baseline'), { recursive: true });
await writeFile(resolve(outRoot, 'baseline/matrix.json'), `${JSON.stringify({ time: new Date().toISOString(), viewports: VIEWPORTS, states: STATES, renderers: RENDERERS, rows }, null, 2)}\n`);
const captured = rows.filter(row => row.file).length, applicable = rows.filter(row => row.applicable).length;
process.stdout.write(`matrix: ${captured}/${applicable} applicable cells captured (${rows.length - applicable} not applicable) → ${resolve(outRoot, 'baseline/matrix.json')}\n`);
process.exitCode = captured === applicable ? 0 : 1;
