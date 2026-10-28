import test from 'node:test';
import assert from 'node:assert/strict';
import { pageNotationReady, PageNotationError } from '../src/book/notationPreparation.ts';

const marker = (patch: Record<string, string> = {}) => {
  const values: Record<string, string> = { 'data-notation-revision': '4', 'data-notation-epoch': '2',
    'data-notation-status': 'ready', 'data-notation-ready': 'true', ...patch };
  return { getAttribute: (name: string) => values[name] ?? null };
};

test('only a completed notation of the requested revision and epoch is printable', () => {
  assert.equal(pageNotationReady(marker(), 'page-1', 4, 2), true);
  assert.equal(pageNotationReady(marker({ 'data-notation-status': 'pending' }), 'page-1', 4, 2), false);
  assert.equal(pageNotationReady(marker({ 'data-notation-ready': 'false' }), 'page-1', 4, 2), false);
  assert.equal(pageNotationReady(marker(), 'page-1', 5, 2), false);
  assert.equal(pageNotationReady(marker(), 'page-1', 4, 3), false);
});

test('a current renderer failure reaches the print recovery path even before any ready SVG', () => {
  const failed = marker({ 'data-notation-status': 'error', 'data-notation-ready': 'false', 'data-notation-error': 'renderer failed' });
  assert.throws(() => pageNotationReady(failed, 'page-3', 4, 2), error =>
    error instanceof PageNotationError && error.pageId === 'page-3' && error.revision === 4 && error.message === 'renderer failed');
});

test('a late failure from an earlier revision or retry epoch cannot fail the new batch', () => {
  const failed = marker({ 'data-notation-status': 'error', 'data-notation-ready': 'false', 'data-notation-error': 'old failure' });
  assert.equal(pageNotationReady(failed, 'page-3', 5, 2), false);
  assert.equal(pageNotationReady(failed, 'page-3', 4, 3), false);
});

test('pending markers do not mask a current failed marker when inspecting a batch', () => {
  const scores = [marker({ 'data-notation-status': 'pending', 'data-notation-ready': 'false' }),
    marker({ 'data-notation-status': 'error', 'data-notation-ready': 'false' })];
  assert.throws(() => scores.map(score => pageNotationReady(score, 'page-1', 4, 2)), PageNotationError);
});
