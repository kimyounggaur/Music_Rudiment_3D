import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('page layout reserves scrollbar width across pending/ready notation and preserves a 3D fallback', () => {
  const css = readFileSync(new URL('../src/styles/book.css', import.meta.url), 'utf8');
  assert.match(css, /\.book-page-scroll\s*\{\s*scrollbar-gutter\s*:\s*stable\s*\}/);
  assert.match(css, /@supports\s+not\s*\(scrollbar-gutter\s*:\s*stable\)\s*\{\s*\.book-app:not\(\.book-app--2d\)\s+\.book-page-scroll\s*\{\s*overflow-y\s*:\s*scroll\s*\}/);
  // The fallback does not turn the small 2D document into fixed scroll boxes.
  assert.match(css, /\.book-app--2d\s+\.book-page-scroll\s*\{[^}]*height:auto;overflow:visible/);
});
