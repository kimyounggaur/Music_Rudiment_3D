import { brotliDecompressSync } from 'node:zlib';

/** Minimal WOFF2 → SFNT `name` reader for tests (W3C WOFF2 §4.1 directory; OpenType name table). */
const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
export type NameRecord = Readonly<{ platform: number; nameId: number; text: string }>;

function base128(bytes: Buffer, cursor: { offset: number }): number {
  let value = 0;
  for (let index = 0; index < 5; index += 1) {
    const byte = bytes[cursor.offset++]!;
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) return value;
  }
  throw new Error('WOFF2 UIntBase128 too long');
}

export function woff2Names(bytes: Buffer): NameRecord[] {
  if (bytes.toString('ascii', 0, 4) !== 'wOF2') throw new Error('Not WOFF2');
  const count = bytes.readUInt16BE(12);
  const compressedLength = bytes.readUInt32BE(20);
  const cursor = { offset: 48 };
  let offset = 0;
  let name: { offset: number; length: number } | null = null;
  for (let index = 0; index < count; index += 1) {
    const flags = bytes[cursor.offset++]!;
    let tag = KNOWN[flags & 0x3f];
    if ((flags & 0x3f) === 63) { tag = bytes.toString('ascii', cursor.offset, cursor.offset + 4); cursor.offset += 4; }
    const version = flags >>> 6;
    const original = base128(bytes, cursor);
    const transformed = tag === 'glyf' || tag === 'loca' ? version !== 3 : version !== 0;
    const stored = transformed ? base128(bytes, cursor) : original;
    if (tag === 'name') name = { offset, length: stored };
    offset += stored;
  }
  if (!name) throw new Error('No name table');
  const tables = brotliDecompressSync(bytes.subarray(cursor.offset, cursor.offset + compressedLength));
  const table = tables.subarray(name.offset, name.offset + name.length);
  const records: NameRecord[] = [];
  const storage = table.readUInt16BE(4);
  for (let index = 0; index < table.readUInt16BE(2); index += 1) {
    const at = 6 + index * 12;
    const platform = table.readUInt16BE(at), nameId = table.readUInt16BE(at + 6);
    const length = table.readUInt16BE(at + 8), begin = storage + table.readUInt16BE(at + 10);
    const raw = table.subarray(begin, begin + length);
    records.push({ platform, nameId, text: platform === 3 || platform === 0 ? Buffer.from(raw).swap16().toString('utf16le') : raw.toString('latin1') });
  }
  return records;
}
