import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

/** Read-only inspection of embedded fonts in the locally verified VexFlow package.
 * No eval/import of font JS, no font download, no glyph reconstruction or font rewriting.
 * WOFF2 directory: W3C REC-WOFF2-20240808 §4.1; name records: OpenType name table.
 */
const tags = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
type Table = { tag: string; originalLength: number; storedLength: number; transformVersion: number; offset: number; transformed: boolean };
type NameRecord = { platform: number; encoding: number; language: number; nameId: number; text: string };
const maxFontBytes = 32 * 1024 * 1024;
function u128(bytes: Buffer, cursor: { offset: number }): number {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    assert.ok(cursor.offset < bytes.length, 'WOFF2 directory truncated');
    const byte = bytes[cursor.offset++]!;
    assert.ok(i !== 0 || byte !== 0x80, 'WOFF2 UIntBase128 leading zero');
    value = value * 128 + (byte & 0x7f);
    assert.ok(value <= 0xffffffff, 'WOFF2 UIntBase128 overflow');
    if (!(byte & 0x80)) return value;
  }
  throw new Error('WOFF2 UIntBase128 too long');
}
function decodeName(bytes: Buffer, platform: number): string {
  if (platform === 0 || platform === 3) {
    assert.equal(bytes.length % 2, 0, 'UTF-16 name has odd byte length');
    return Buffer.from(bytes).swap16().toString('utf16le');
  }
  if (platform === 1) return new TextDecoder('macintosh').decode(bytes);
  return bytes.toString('latin1');
}
function namesFromWoff2(bytes: Buffer): { tables: Table[]; records: NameRecord[]; decompressedBytes: number } {
  assert.ok(bytes.length >= 48 && bytes.length <= maxFontBytes, 'WOFF2 input size');
  assert.equal(bytes.toString('ascii', 0, 4), 'wOF2', 'Only WOFF2 supported');
  assert.notEqual(bytes.readUInt32BE(4), 0x74746366, 'Font collections are not supported by this audit');
  assert.equal(bytes.readUInt32BE(8), bytes.length, 'WOFF2 header length mismatch');
  const count = bytes.readUInt16BE(12); assert.ok(count > 0 && count <= 256);
  const compressedLength = bytes.readUInt32BE(20); assert.ok(compressedLength <= maxFontBytes);
  const cursor = { offset: 48 }; const tables: Table[] = []; let offset = 0;
  for (let i = 0; i < count; i++) {
    assert.ok(cursor.offset < bytes.length);
    const flags = bytes[cursor.offset++]!; const index = flags & 0x3f; const transformVersion = flags >>> 6;
    let tag = tags[index];
    if (index === 63) { assert.ok(cursor.offset + 4 <= bytes.length); tag = bytes.toString('ascii', cursor.offset, cursor.offset + 4); cursor.offset += 4; }
    assert.ok(tag, 'Unknown table tag');
    const originalLength = u128(bytes, cursor);
    const transformed = tag === 'glyf' || tag === 'loca' ? transformVersion !== 3 : transformVersion !== 0;
    if (tag === 'glyf' || tag === 'loca') assert.ok(transformVersion === 0 || transformVersion === 3, 'Unknown glyf/loca transform');
    else if (tag === 'hmtx') assert.ok(transformVersion === 0 || transformVersion === 1, 'Unknown hmtx transform');
    else assert.equal(transformVersion, 0, 'Unknown table transform');
    const storedLength = transformed ? u128(bytes, cursor) : originalLength;
    if (tag === 'loca' && transformed) assert.equal(storedLength, 0, 'Transformed loca length');
    tables.push({ tag, originalLength, storedLength, transformVersion, offset, transformed });
    offset += storedLength; assert.ok(offset <= maxFontBytes, 'WOFF2 decompression size limit');
  }
  assert.ok(cursor.offset + compressedLength <= bytes.length, 'WOFF2 compressed stream truncated');
  const decompressed = brotliDecompressSync(bytes.subarray(cursor.offset, cursor.offset + compressedLength), { maxOutputLength: maxFontBytes });
  assert.equal(decompressed.length, offset, 'WOFF2 table stream length mismatch');
  const name = tables.find(table => table.tag === 'name'); assert.ok(name && !name.transformed, 'Untransformed name table required');
  const table = decompressed.subarray(name.offset, name.offset + name.storedLength);
  assert.ok(table.length >= 6); const format = table.readUInt16BE(0); assert.ok(format === 0 || format === 1);
  const nameCount = table.readUInt16BE(2); const storageOffset = table.readUInt16BE(4);
  assert.ok(nameCount <= 4096 && 6 + nameCount * 12 <= table.length);
  const records: NameRecord[] = [];
  for (let i = 0; i < nameCount; i++) {
    const r = 6 + i * 12;
    const platform = table.readUInt16BE(r), encoding = table.readUInt16BE(r + 2), language = table.readUInt16BE(r + 4), nameId = table.readUInt16BE(r + 6);
    const length = table.readUInt16BE(r + 8), begin = storageOffset + table.readUInt16BE(r + 10);
    assert.ok(begin + length <= table.length, 'Name string outside table');
    records.push({ platform, encoding, language, nameId, text: decodeName(table.subarray(begin, begin + length), platform) });
  }
  return { tables, records, decompressedBytes: decompressed.length };
}

const root = resolve('node_modules/vexflow');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as { name: string; version: string; license: string };
assert.equal(pkg.name, 'vexflow'); assert.equal(pkg.version, '5.0.0');
const fonts = [];
const notices: { font: string; sourceNameId: number; file: string; sha256: string }[] = [];
await mkdir('public/licenses', { recursive: true });
const wrapperNotices = [];
for (const [source, file] of [['LICENSE', 'VexFlow-MIT.txt'], ['AUTHORS.md', 'VexFlow-AUTHORS.md']]) {
  const bytes = await readFile(resolve(root, source!));
  await writeFile(resolve('public/licenses', file!), bytes);
  wrapperNotices.push({ source: `node_modules/vexflow/${source}`, file, sha256: createHash('sha256').update(bytes).digest('hex') });
}
for (const name of ['bravura', 'academico', 'academicobold']) {
  const path = `node_modules/vexflow/build/esm/src/fonts/${name}.js`;
  const source = await readFile(path, 'utf8');
  const match = source.match(/data:[^,]+;base64,([A-Za-z0-9+/=]+)/); assert.ok(match, `No embedded font in ${path}`);
  const bytes = Buffer.from(match[1]!, 'base64');
  const inspected = namesFromWoff2(bytes);
  const byId = (id: number) => [...new Set(inspected.records.filter(record => record.nameId === id).map(record => record.text))];
  const metadata = { copyright: byId(0), family: byId(1), subfamily: byId(2), fullName: byId(4), version: byId(5), licenseDescription: byId(13), licenseUrl: byId(14) };
  assert.ok(metadata.family.length && metadata.version.length && metadata.copyright.length, `Missing font identity in ${path}`);
  const unicodeText = (id: number) => inspected.records.find(record => record.nameId === id && record.platform === 3)?.text
    ?? inspected.records.find(record => record.nameId === id && record.platform === 0)?.text;
  const license = unicodeText(13), copyright = unicodeText(0);
  assert.ok(license && copyright, 'Unicode copyright/license records required for verbatim notices');
  assert.ok(license.startsWith('Copyright') && license.includes('SIL OPEN FONT LICENSE Version 1.1')
    && license.includes('PERMISSION & CONDITIONS') && license.includes('TERMINATION') && license.includes('DISCLAIMER'), 'Complete embedded OFL notice required');
  const noticeFile = name === 'bravura' ? 'Bravura-OFL.txt' : name === 'academico' ? 'Academico-OFL.txt' : 'Academico-Bold-OFL.txt';
  const legalBytes = Buffer.from(license + '\n', 'utf8');
  await writeFile(resolve('public/licenses', noticeFile), legalBytes);
  notices.push({ font: name, sourceNameId: 13, file: noticeFile, sha256: createHash('sha256').update(legalBytes).digest('hex') });
  if (copyright !== license) {
    // Preserve conflicting/different embedded copyright text, rather than silently choosing a year.
    const file = name === 'academicobold' ? 'Academico-Bold-nameID0-notice.txt' : `${name}-nameID0-notice.txt`;
    const bytes = Buffer.from(copyright + '\n', 'utf8');
    await writeFile(resolve('public/licenses', file), bytes);
    notices.push({ font: name, sourceNameId: 0, file, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  fonts.push({ key: name, source: path, sourceSha256: createHash('sha256').update(source).digest('hex'),
    fontSha256: createHash('sha256').update(bytes).digest('hex'), woff2Bytes: bytes.length, decompressedBytes: inspected.decompressedBytes,
    metadata, nameRecords: inspected.records.filter(record => [0, 1, 2, 4, 5, 13, 14].includes(record.nameId)),
    tableDirectory: inspected.tables,
  });
  console.log(JSON.stringify({ font: name, woff2Bytes: bytes.length, family: metadata.family, subfamily: metadata.subfamily, version: metadata.version,
    copyrightFirstLines: metadata.copyright.map(text => text.split('\n')[0]), licenseFirstLines: metadata.licenseDescription.map(text => text.split('\n')[0]),
    licenseUrl: metadata.licenseUrl, noticeFile }, null, 2));
}
await writeFile('public/licenses/font-metadata.json', JSON.stringify({
  auditDate: '2026-10-26', package: { name: pkg.name, version: pkg.version, wrapperLicense: pkg.license },
  method: 'Static data-URL extraction; WOFF2 directory and Brotli stream parsed; SFNT name table read. No package JS executed or font rewritten.',
  references: ['https://www.w3.org/TR/2024/REC-WOFF2-20240808/', 'https://learn.microsoft.com/en-us/typography/opentype/spec/name'],
  legalReferences: ['https://openfontlicense.org/open-font-license-official-text/', 'https://github.com/steinbergmedia/bravura/blob/master/LICENSE.txt', 'https://forums.steinberg.net/t/academico-open-font-license/114847'],
  sourceAccessIssues: [
    { action: 'web.click', target: 'https://github.com/vexflow/vexflow-fonts/tree/main/academico', error: 'Failed to fetch restricted URL', status: 'read failed; no retry or alternate path attempted' },
    { action: 'web.click', target: 'https://github.com/vexflow/vexflow-fonts/tree/main/bravura', error: 'Failed to fetch restricted URL', status: 'read failed; no retry or alternate path attempted' },
  ],
  fonts, notices, wrapperNotices,
}, null, 2) + '\n', 'utf8');

// v3 R9: the printed page fonts are OFL subsets renamed under condition 3 (Reserved Font Names):
// the notice lists both, each WOFF2 carries only the new family name and keeps its licence record.
const pageNotice = await readFile('public/licenses/book-page-fonts.txt', 'utf8');
assert.ok(pageNotice.includes('SIL OPEN FONT LICENSE Version 1.1') && pageNotice.includes('"Book Sans"') && pageNotice.includes('"Book Serif"'),
  'public/licenses/book-page-fonts.txt must carry the OFL text and both renamed families');
for (const [file, family] of [['book-sans-regular.subset.woff2', 'Book Sans'], ['book-sans-semibold.subset.woff2', 'Book Sans'], ['book-serif-bold.subset.woff2', 'Book Serif']] as const) {
  const inspected = namesFromWoff2(await readFile(resolve('public/fonts', file)));
  const families = [...new Set(inspected.records.filter(record => record.nameId === 1 || record.nameId === 16).map(record => record.text))];
  assert.ok(families.length > 0 && families.every(name => name.startsWith(family)), `${file}: only the renamed family ${family} (found ${families.join(', ')})`);
  assert.ok(!families.some(name => /Pretendard|Noto|Source/.test(name)), `${file}: a Reserved Font Name is still the family name`);
  const licence = inspected.records.find(record => record.nameId === 13)?.text ?? '';
  assert.ok(/Open Font License|OFL/i.test(licence), `${file}: the OFL licence record must be kept`);
  console.log(JSON.stringify({ pageFont: file, family: families, licence: licence.split('\n')[0] }));
}
