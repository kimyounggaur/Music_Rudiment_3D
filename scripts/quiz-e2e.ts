import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { questionsForPhase } from '../src/lesson/assessment.ts';
import type { AssessmentPhase } from '../src/lesson/assessment.ts';
import { STORAGE_KEY } from '../src/persistence/progress.ts';

const output = 'output/playwright';
const artifact = resolve('output/preview.html');
const baselineSha256 = '002afbaff4599ea714f6ca6741f505e91c671bcebce2ae0bf1dca30160e25b3e';
const expectedSha256 = (process.env.LAB_EXPECTED_ARTIFACT_SHA256 ?? baselineSha256).toLowerCase();
assert.match(expectedSha256, /^[a-f0-9]{64}$/, 'LAB_EXPECTED_ARTIFACT_SHA256 must be an explicitly assigned 64-character hex SHA256.');
const artifactSha256 = createHash('sha256').update(await readFile(artifact)).digest('hex');
assert.equal(artifactSha256, expectedSha256, 'Only the assigned current standalone artifact may be tested.');
const buildId = artifactSha256.slice(0, 8);
await mkdir(output, { recursive: true });
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? 'C:\\Users\\kimyo\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1223\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
// A local file check: never listen on a socket or retry the denied HTTP server.
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
const blockedHttpRequests: string[] = [];
await context.route(/^https?:\/\//, async route => {
  blockedHttpRequests.push(route.request().url());
  await route.abort('blockedbyclient');
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const results: { name: string; status: 'passed' | 'failed'; detail?: string }[] = [];
const screenshots: string[] = [];
const expectedAttempts: Record<string, number> = {};
let restoredAttempts: Record<string, number> = {};
const passed = (name: string) => {
  results.push({ name, status: 'passed' });
  process.stdout.write(`PASS ${name}\n`);
};

async function readQuizAttempts(): Promise<Record<string, number>> {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const envelope = JSON.parse(raw) as { attempts: Record<string, number> };
    return Object.fromEntries(Object.entries(envelope.attempts).filter(([id]) => id.startsWith('pre-') || id.startsWith('post-')));
  }, STORAGE_KEY);
}

async function waitForAttempts(expected: Record<string, number>) {
  await page.waitForFunction(({ key, wanted }) => {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const attempts = (JSON.parse(raw) as { attempts: Record<string, number> }).attempts;
    const quiz = Object.fromEntries(Object.entries(attempts).filter(([id]) => id.startsWith('pre-') || id.startsWith('post-')));
    return Object.keys(quiz).length === Object.keys(wanted).length && Object.entries(wanted).every(([id, count]) => quiz[id] === count);
  }, { key: STORAGE_KEY, wanted: expected });
  assert.deepEqual(await readQuizAttempts(), expected);
}

async function chooseAllCorrect(phase: AssessmentPhase) {
  const form = page.getByRole('form', { name: phase === 'pre' ? '사전 5문항' : '사후 5문항', exact: true });
  for (const [index, question] of questionsForPhase(phase).entries()) {
    const correct = question.options.find(option => option.id === question.correctOptionId);
    assert.ok(correct);
    await form.getByRole('group', { name: `${index + 1}. ${question.prompt}`, exact: true })
      .getByRole('radio', { name: correct.label, exact: true }).check();
  }
  return form;
}

try {
  await page.goto(pathToFileURL(artifact).href);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.getByText('사전·사후 개념 확인', { exact: true }).click();
  const preForm = page.getByRole('form', { name: '사전 5문항', exact: true });
  assert.equal(await preForm.getByRole('group').count(), 5);
  assert.equal(await preForm.getByRole('radio').count(), 15);
  await waitForAttempts({});
  passed('pre quiz expands with five labelled fieldsets and no attempt recorded on render');

  await chooseAllCorrect('pre');
  await page.waitForTimeout(350); // Past the app's documented 250ms save debounce.
  assert.deepEqual(await readQuizAttempts(), {});
  assert.equal(await preForm.getByRole('status').count(), 0);
  await preForm.getByRole('button', { name: '정답 확인', exact: true }).click();
  await preForm.getByRole('status').getByText('사전 5문항 중 5문항에 답했고, 5문항이 맞았습니다.', { exact: true }).waitFor();
  for (const question of questionsForPhase('pre')) expectedAttempts[question.id] = 1;
  await waitForAttempts(expectedAttempts);
  const preScreenshot = `quiz-pre-844x390-feedback-${buildId}-file-artifact.png`;
  await page.screenshot({ path: `${output}/${preScreenshot}`, fullPage: true });
  screenshots.push(preScreenshot);
  passed('pre answers produce five of five only after explicit check and record each attempt once');

  await page.getByRole('button', { name: '사후 5문항', exact: true }).click();
  const postForm = await chooseAllCorrect('post');
  await page.waitForTimeout(350);
  assert.deepEqual(await readQuizAttempts(), expectedAttempts);
  assert.equal(await postForm.getByRole('status').count(), 0);
  await postForm.getByRole('button', { name: '정답 확인', exact: true }).click();
  await postForm.getByRole('status').getByText('사후 5문항 중 5문항에 답했고, 5문항이 맞았습니다.', { exact: true }).waitFor();
  for (const question of questionsForPhase('post')) expectedAttempts[question.id] = 1;
  await waitForAttempts(expectedAttempts);
  passed('post uses its separate five questions and records only on explicit check');

  const first = questionsForPhase('post')[0];
  const wrong = first.options.find(option => option.id !== first.correctOptionId);
  const correct = first.options.find(option => option.id === first.correctOptionId);
  assert.ok(wrong && correct);
  const firstGroup = postForm.getByRole('group', { name: `1. ${first.prompt}`, exact: true });
  await firstGroup.getByRole('radio', { name: wrong.label, exact: true }).check();
  assert.equal(await postForm.getByRole('status').count(), 0, 'Editing must invalidate the old five-correct result.');
  await page.waitForTimeout(350);
  assert.deepEqual(await readQuizAttempts(), expectedAttempts);
  await firstGroup.getByRole('radio', { name: correct.label, exact: true }).check();
  await page.waitForTimeout(350);
  assert.deepEqual(await readQuizAttempts(), expectedAttempts);
  assert.equal(await postForm.getByRole('status').count(), 0);
  passed('changing an answer clears stale feedback without creating a recorded attempt');

  await postForm.getByRole('button', { name: '정답 확인', exact: true }).click();
  await postForm.getByRole('status').getByText('사후 5문항 중 5문항에 답했고, 5문항이 맞았습니다.', { exact: true }).waitFor();
  for (const question of questionsForPhase('post')) expectedAttempts[question.id] = 2;
  await waitForAttempts(expectedAttempts);
  const postScreenshot = `quiz-post-844x390-feedback-${buildId}-file-artifact.png`;
  await page.screenshot({ path: `${output}/${postScreenshot}`, fullPage: true });
  screenshots.push(postScreenshot);
  passed('a second explicit post check records exactly one further attempt per answered question');

  await page.reload();
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.getByText('사전·사후 개념 확인', { exact: true }).click();
  await waitForAttempts(expectedAttempts);
  restoredAttempts = await readQuizAttempts();
  const restoredPre = page.getByRole('form', { name: '사전 5문항', exact: true });
  assert.equal(await restoredPre.getByRole('radio', { checked: true }).count(), 0, 'Quiz choices are intentionally session-local.');
  assert.equal(await restoredPre.getByRole('status').count(), 0);
  await page.waitForTimeout(350);
  assert.deepEqual(await readQuizAttempts(), expectedAttempts);
  passed('reload preserves the ten stored attempt counters without replaying callbacks or restoring session-local choices');

  assert.deepEqual(errors, []);
  assert.deepEqual(blockedHttpRequests, []);
  passed('quiz file path has no uncaught page error or HTTP data request');
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  results.push({ name: 'quiz UI regression', status: 'failed', detail });
  process.exitCode = 1;
  process.stderr.write(`${detail}\n`);
} finally {
  const report = JSON.stringify({
    environment: {
      browser: browser.version(), artifact, artifactSha256, expectedArtifactSha256: expectedSha256, viewport: { width: 844, height: 390 },
      mode: 'standalone-file', servedE2E: false, headless: true, actualDevice: false, actualListening: false,
    },
    results, screenshots, expectedAttempts, restoredAttempts, errors, blockedHttpRequests,
  }, null, 2);
  await writeFile(`${output}/quiz-results-${buildId}.json`, report);
  await writeFile(`${output}/quiz-results.json`, report);
  await context.close();
  await browser.close();
}
