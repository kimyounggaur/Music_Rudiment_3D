import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import type { Locator } from 'playwright';
import { lessonContent } from '../src/content/lesson.ts';
import { isSceneComplete, tryRestoreLessonState } from '../src/lesson/controller.ts';
import { STORAGE_KEY } from '../src/persistence/progress.ts';
import type { ProgressEnvelope } from '../src/persistence/progress.ts';

const output = 'output/playwright';
const artifact = resolve('output/preview.html');
const assignedSha256 = (process.env.LAB_EXPECTED_ARTIFACT_SHA256 ?? '9cd77d64935429d78e725180039c5799cac3408d9c55db76a98b70a1a594ee86').toLowerCase();
assert.match(assignedSha256, /^[a-f0-9]{64}$/, 'An explicit 64-character artifact SHA256 is required.');
const artifactSha256 = createHash('sha256').update(await readFile(artifact)).digest('hex');
assert.equal(artifactSha256, assignedSha256, 'Only the explicitly assigned standalone artifact may be tested.');
const buildId = artifactSha256.slice(0, 8);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? 'C:\\Users\\kimyo\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1223\\chrome-headless-shell-win64\\chrome-headless-shell.exe' });
const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
const externalRequests: string[] = [];
await context.route(/^https?:\/\//, async route => {
  externalRequests.push(route.request().url());
  await route.abort('blockedbyclient');
});
await context.addInitScript(() => {
  const audit = { pointerDown: 0, mouseDown: 0, touchStart: 0, audioContexts: 0 };
  Reflect.set(window, '__keyboardAudit', audit);
  window.addEventListener('pointerdown', () => { audit.pointerDown += 1; }, true);
  window.addEventListener('mousedown', () => { audit.mouseDown += 1; }, true);
  window.addEventListener('touchstart', () => { audit.touchStart += 1; }, true);
  const Original = window.AudioContext;
  window.AudioContext = class extends Original {
    constructor(options?: AudioContextOptions) {
      super(options);
      audit.audioContexts += 1;
    }
  };
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const results: { name: string; status: 'passed' | 'failed'; detail?: string }[] = [];
let keyboardActions = 0;
let audit: unknown = null;
let completedScenes: string[] = [];
const observedLaneModes: Record<string, string> = {};
const screenshots: string[] = [];
const passed = (name: string) => {
  results.push({ name, status: 'passed' });
  process.stdout.write(`PASS ${name}\n`);
};

/** Focus identifies a semantic control; activation is always a real key press. */
async function activate(control: Locator, key = 'Enter') {
  await control.waitFor({ state: 'visible' });
  assert.equal(await control.isEnabled(), true);
  await control.focus();
  await control.press(key);
  keyboardActions += 1;
}

const next = () => page.getByRole('button', { name: '다음 →', exact: true });
const observeText = () => activate(page.getByRole('button', { name: '소리 없이 설명 확인', exact: true }));
const card = (name: string) => page.getByRole('button', { name: new RegExp(`^${name}`) });

async function answerQuestions(index: number) {
  const region = page.getByRole('region', { name: '개념 확인', exact: true });
  for (const question of lessonContent.scenes[index].questions) {
    const answer = question.options.find(option => option.value === question.correctValue);
    assert.ok(answer);
    const radio = region.getByRole('group', { name: question.prompt, exact: true }).getByRole('radio', { name: answer.label, exact: true });
    await activate(radio, 'Space');
    assert.equal(await radio.isChecked(), true);
  }
}

async function advance(index: number) {
  assert.equal(await next().isEnabled(), true, 'The completed scene must unlock its next action.');
  await activate(next());
  await page.getByRole('heading', { level: 1, name: lessonContent.scenes[index].title, exact: true }).waitFor();
}

async function readyScore() {
  await page.locator('main .notation-view[data-notation-ready="true"] svg').first().waitFor();
}

try {
  await page.goto(pathToFileURL(artifact).href);
  await page.getByRole('heading', { level: 1, name: lessonContent.scenes[0].title, exact: true }).waitFor();
  await readyScore();
  assert.equal(await next().isDisabled(), true);
  passed('fresh 2D scene has a ready VexFlow SVG and a locked next action before responses');

  await observeText();
  await activate(page.getByRole('button', { name: '아래: 4분음표 4개', exact: true }));
  await observeText();
  await answerQuestions(0);
  await advance(1);
  passed('scene1 upper and lower text observations plus three native radio answers unlock next using keys');

  assert.equal(await next().isDisabled(), true);
  await observeText();
  for (let i = 0; i < 4; i += 1) await activate(page.getByRole('button', { name: '둘로 나누기', exact: true }));
  assert.equal(await page.getByRole('button', { name: '둘로 나누기', exact: true }).isDisabled(), true);
  assert.equal(await next().isDisabled(), true, 'Observation alone must not replace the question response.');
  await answerQuestions(1);
  await readyScore();
  await advance(2);
  passed('scene2 four keyboard splits reach sixteenth limit and require the answer before progressing');

  assert.equal(await next().isDisabled(), true);
  await observeText();
  await activate(card('4분음표'));
  await activate(card('4분음표'));
  assert.equal(await next().isDisabled(), true, 'Task A alone must not complete A/B/C.');
  await activate(page.getByRole('button', { name: '과제B', exact: true }));
  await observeText();
  for (let i = 0; i < 4; i += 1) await activate(card('8분음표'));
  assert.equal(await next().isDisabled(), true, 'Tasks A/B must still require task C.');
  await activate(page.getByRole('button', { name: '과제C', exact: true }));
  await observeText();
  await activate(card('4분음표'));
  await activate(card('8분음표'));
  await activate(card('8분음표'));
  await advance(3);
  passed('scene3 A B C lanes and note palettes complete all equivalence tasks using Enter only');

  assert.equal(await next().isDisabled(), true);
  await observeText();
  const toggle = page.getByRole('button', { name: '음표 ↔ 쉼표', exact: true });
  await activate(toggle);
  await activate(toggle);
  await answerQuestions(3);
  await advance(4);
  passed('scene4 keyboard note-rest toggles and the continuous-time answer preserve and complete the bar');

  assert.equal(await next().isDisabled(), true);
  await observeText();
  const tempo = page.getByRole('combobox', { name: '비교 템포', exact: true });
  await activate(tempo, 'End');
  await tempo.press('Enter');
  keyboardActions += 1;
  assert.equal(await tempo.inputValue(), '120');
  await activate(tempo, 'Home');
  await tempo.press('Enter');
  keyboardActions += 1;
  assert.equal(await tempo.inputValue(), '60');
  await answerQuestions(4);
  await advance(5);
  passed('scene5 keyboard select compares 120 and 60 and native radio responses unlock the final scene');

  await observeText();
  await activate(card('2분음표'));
  await activate(card('4분쉼표'));
  await activate(card('8분음표'));
  await activate(card('8분음표'));
  const summary = page.getByRole('heading', { level: 2, name: '나의 한 마디를 완성했어요', exact: true });
  assert.equal(await summary.count(), 0, 'A numerically valid pattern must still require explanation self-check.');
  const explanation = page.getByRole('checkbox', { name: '쉼표도 시간을 차지한다는 점과 길이의 합을 설명했어요.', exact: true });
  await activate(explanation, 'Space');
  assert.equal(await explanation.isChecked(), true);
  await summary.waitFor();
  await readyScore();
  const finalScreenshot = `keyboard-six-scenes-844x390-complete-${buildId}-file-artifact.png`;
  await page.screenshot({ path: `${output}/${finalScreenshot}`, fullPage: true });
  screenshots.push(finalScreenshot);
  passed('scene6 keyboard cards and explanation Space produce the final summary and a ready score SVG');

  await page.waitForFunction(key => {
    const raw = localStorage.getItem(key);
    return raw && (JSON.parse(raw) as ProgressEnvelope).sceneProgress['scene-6']?.explanationSelfCheck === true;
  }, STORAGE_KEY);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as ProgressEnvelope, STORAGE_KEY);
  const restored = tryRestoreLessonState(saved);
  if (!restored.ok) throw new Error(restored.message);
  completedScenes = lessonContent.scenes.filter(scene => isSceneComplete(restored.state, scene.sceneId)).map(scene => scene.sceneId);
  assert.equal(completedScenes.length, 6);
  for (const scene of lessonContent.scenes) {
    for (const lane of scene.lanes) {
      const mode = saved.sceneProgress[scene.sceneId].observedLanes?.[lane.laneId];
      assert.equal(mode, 'text');
      observedLaneModes[`${scene.sceneId}/${lane.laneId}`] = mode;
    }
  }
  assert.equal(Object.values(observedLaneModes).includes('listened'), false);
  passed('persisted six-scene completion restores correctly and all nine lane observations are text rather than listened');

  audit = await page.evaluate(() => Reflect.get(window, '__keyboardAudit'));
  assert.deepEqual(audit, { pointerDown: 0, mouseDown: 0, touchStart: 0, audioContexts: 0 });
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  passed('entire route records zero pointer mouse touch or AudioContext creation and no page errors or HTTP requests');
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  results.push({ name: 'keyboard-only six-scene regression', status: 'failed', detail });
  audit = await page.evaluate(() => Reflect.get(window, '__keyboardAudit')).catch(() => null);
  process.exitCode = 1;
  process.stderr.write(`${detail}\n`);
} finally {
  const report = JSON.stringify({
    environment: { browser: browser.version(), artifact, artifactSha256, expectedArtifactSha256: assignedSha256,
      mode: 'standalone-file', servedE2E: false, viewport: { width: 844, height: 390 }, headless: true,
      focusAssistedKeyboardRoute: true, actualDevice: false, actualListening: false, actualScreenReader: false },
    results, keyboardActions, audit, completedScenes, observedLaneModes, screenshots, errors, externalRequests,
  }, null, 2);
  await writeFile(`${output}/keyboard-results-${buildId}.json`, report);
  await writeFile(`${output}/keyboard-results.json`, report);
  await context.close();
  await browser.close();
}
