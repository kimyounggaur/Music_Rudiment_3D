import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPageSnapshotLayout, canonicalPrintPresentation, PageSnapshotLayoutError, pageSnapshotKey,
  selfContainedCss, withPageSnapshotLayoutRetries } from '../src/book/pageSnapshot.ts';
import type { PageSnapshotIdentity } from '../src/book/pageSnapshot.ts';

const identity: PageSnapshotIdentity = { pageId: 'page-1', contentRevision: 3, width: 340.5, height: 500,
  scale: 2, fontVersion: 'vexflow-5-bravura', scrollSignature: '[["root",0,0]]' };

test('page print keys separate content, font, scale, viewport and nested scroll states', () => {
  const variants = [identity, { ...identity, pageId: 'page-2' as const }, { ...identity, contentRevision: 4 },
    { ...identity, width: 340 }, { ...identity, height: 501 }, { ...identity, scale: 1 },
    { ...identity, fontVersion: 'replacement-font' }, { ...identity, scrollSignature: '[["root",0,0],[4,80,0]]' },
    { ...identity, presentationSignature: '[[2,"details",true]]' },
    { ...identity, background: '#ffffff' }, { ...identity, presentationKey: 'new-import-preview' }];
  assert.equal(new Set(variants.map(pageSnapshotKey)).size, variants.length);
  assert.equal(pageSnapshotKey(identity), pageSnapshotKey({ ...identity }));
});

test('page print rejects invalid dimensions and oversized allocation before rasterization', () => {
  for (const changed of [{ width: 0 }, { width: NaN }, { height: -1 }, { scale: 5 }, { width: 5000 },
    { contentRevision: -1 }, { contentRevision: 0.5 }, { fontVersion: '' }]) {
    assert.throws(() => pageSnapshotKey({ ...identity, ...changed }));
  }
});

test('page layout accepts fractional CSS rounding but rejects a changed viewport', () => {
  assert.doesNotThrow(() => assertPageSnapshotLayout({ offsetWidth: 341, offsetHeight: 500 }, 'page-1', 340.5, 500.4));
  assert.throws(() => assertPageSnapshotLayout({ offsetWidth: 360, offsetHeight: 474 }, 'page-1', 340.5, 500), PageSnapshotLayoutError);
});

test('print preparation recovers a transient layout change after another layout barrier', async () => {
  let frames = 0;
  let captures = 0;
  const result = await withPageSnapshotLayoutRetries(async () => {
    captures += 1;
    assertPageSnapshotLayout({ offsetWidth: frames === 1 ? 400 : 360, offsetHeight: 474 }, 'page-1', 360, 474);
    return 'current layout';
  }, async () => { frames += 1; }, () => true);
  assert.equal(result, 'current layout');
  assert.equal(captures, 2);
  assert.equal(frames, 2);
});

test('a superseded intro capture cancels instead of retrying or reporting its size mismatch', async () => {
  let current = true;
  let captures = 0;
  await assert.rejects(withPageSnapshotLayoutRetries(async () => {
    captures += 1;
    current = false; // A newer size commits before the old capture resumes.
    assertPageSnapshotLayout({ offsetWidth: 360, offsetHeight: 474 }, 'page-1', 400, 588);
  }, async () => {}, () => current), { name: 'AbortError' });
  assert.equal(captures, 1);
});

test('persistent layout mismatch is bounded and a real raster failure is never retried', async () => {
  let attempts = 0;
  await assert.rejects(withPageSnapshotLayoutRetries(async () => {
    attempts += 1;
    assertPageSnapshotLayout({ offsetWidth: 360, offsetHeight: 474 }, 'page-1', 400, 588);
  }, async () => {}, () => true), PageSnapshotLayoutError);
  assert.equal(attempts, 3);
  attempts = 0;
  const failure = new Error('Self-contained page print could not be decoded');
  await assert.rejects(withPageSnapshotLayoutRetries(async () => {
    attempts += 1;
    throw failure;
  }, async () => {}, () => true), error => error === failure);
  assert.equal(attempts, 1);
});

test('page print CSS only admits embedded resources and same-document SVG fragments', () => {
  assert.equal(selfContainedCss('src:url(data:font/woff2;base64,AAAA)'), 'src:url("data:font/woff2;base64,AAAA")');
  assert.equal(selfContainedCss('filter:url("http://127.0.0.1:4173/#clip")', 'http://127.0.0.1:4173/'), 'filter:url("#clip")');
  assert.equal(selfContainedCss('fill:url(#ink)'), 'fill:url("#ink")');
  assert.throws(() => selfContainedCss('@import "https://example.com/font.css"'));
  assert.throws(() => selfContainedCss('src:url(https://example.com/font.woff2)'));
  assert.throws(() => selfContainedCss('background:url(/cover.png)', 'http://127.0.0.1:4173/'));
  assert.throws(() => selfContainedCss('filter:url(https://example.com/#clip)', 'http://127.0.0.1:4173/'));
});

test('stopped print removes playback-only highlighting but preserves a selected note', () => {
  assert.equal(canonicalPrintPresentation({ 'data-score-highlight': 'note-2', 'data-selected': 'false', 'data-active': 'true' }).omit, true);
  const selected = canonicalPrintPresentation({ 'data-score-highlight': 'note-1', 'data-selected': 'true', 'data-active': 'true' });
  assert.equal(selected.omit, false);
  assert.equal(selected.clearDash, true);
  assert.equal(selected.clearActive, true);
});

test('stopped print preserves musical disabled restrictions and normalizes transport text only by explicit metadata', () => {
  assert.equal(canonicalPrintPresentation({ disabled: '', 'data-print-disabled': 'false' }).disabled, false);
  assert.equal(canonicalPrintPresentation({ disabled: '', 'data-print-disabled': 'true' }).disabled, true);
  assert.equal(canonicalPrintPresentation({ disabled: '' }).disabled, undefined);
  assert.equal(canonicalPrintPresentation({ 'data-print-text': '정지 상태' }).text, '정지 상태');
  assert.throws(() => canonicalPrintPresentation({ 'data-print-disabled': 'sometimes' }));
});
