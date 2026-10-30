import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PAGE_FONTS } from '../src/book/print/pageFonts.generated.ts';
import { woff2Names } from './support/woff2.ts';

const RESERVED = ['Pretendard', 'Source', 'Noto'];
const NAME_IDS = [1, 3, 4, 6, 16, 17, 18, 21, 22];

test('bundled page fonts match their generated hashes', () => {
  assert.deepEqual(PAGE_FONTS.map(font => `${font.family}:${font.weight}`), ['Book Sans:400', 'Book Sans:600', 'Book Serif:700']);
  for (const font of PAGE_FONTS) {
    const bytes = readFileSync(new URL(`../public${font.url}`, import.meta.url));
    assert.equal(bytes.length, font.bytes, font.url);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), font.sha256, font.url);
  }
  // Design R3 risk (a): the whole printed-page font payload stays within 400 KB.
  assert.ok(PAGE_FONTS.reduce((total, font) => total + font.bytes, 0) <= 400 * 1024);
});

test('renamed subsets carry no Reserved Font Name but keep copyright and the OFL (condition 3)', () => {
  for (const font of PAGE_FONTS) {
    const records = woff2Names(readFileSync(new URL(`../public${font.url}`, import.meta.url)));
    const names = records.filter(record => NAME_IDS.includes(record.nameId));
    assert.ok(names.length > 0);
    for (const record of names) assert.ok(!RESERVED.some(word => record.text.includes(word)), `${font.url} name ${record.nameId}: ${record.text}`);
    assert.ok(records.some(record => record.nameId === 16 && record.text === font.family), `${font.url} typographic family`);
    assert.ok(records.some(record => record.nameId === 0 && record.text.trim().length > 0), `${font.url} copyright`);
    assert.ok(records.some(record => record.nameId === 13 && record.text.includes('SIL Open Font License')), `${font.url} licence`);
  }
  const notice = readFileSync(new URL('../public/licenses/book-page-fonts.txt', import.meta.url), 'utf8');
  assert.match(notice, /Reserved Font Name "Pretendard"/);
  assert.match(notice, /"Book Sans".*derived from Pretendard 1\.3\.9/);
  assert.match(notice, /"Book Serif".*derived from Noto Serif CJK KR/);
  assert.match(notice, /SIL OPEN FONT LICENSE Version 1\.1/);
});
