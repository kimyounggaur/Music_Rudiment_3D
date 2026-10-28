import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_QA_REQUEST_BYTES, parseQaEvidence, qaEvidencePlugin, QaEvidenceError, validateQaRequest } from '../scripts/qa-evidence.ts';

const headers = () => ({ host: '127.0.0.1:4173', origin: 'http://127.0.0.1:4173', 'content-type': 'application/json', 'content-length': '100', 'sec-fetch-site': 'same-origin' });
const request = () => ({ method: 'POST', remoteAddress: '127.0.0.1', headers: headers() });
const encoded = (value: unknown) => Buffer.from(JSON.stringify(value));
const metrics = (filename = 'ci01-run1.json') => ({ filename, mimeType: 'application/json', data: { viewport: { width: 844, height: 390 }, errorPx: 1.25, label: 'coverIdle', clipped: false } });
const rejects = (run: () => unknown, code: string) => assert.throws(run, (error) => error instanceof QaEvidenceError && error.code === code);

test('evidence route accepts only same-origin loopback POST with a bounded known JSON body length', () => {
  assert.equal(validateQaRequest(request()), 100);
  const local = request(); local.headers.host = 'localhost:4173'; local.headers.origin = 'http://localhost:4173';
  assert.equal(validateQaRequest(local), 100);
  rejects(() => validateQaRequest({ ...request(), method: 'GET' }), 'METHOD');
  rejects(() => validateQaRequest({ ...request(), remoteAddress: '192.168.1.4' }), 'LOCAL_ONLY');
  for (const origin of ['null', 'https://evil.example', 'http://localhost:4173', 'http://127.0.0.1:4174', 'http://127.0.0.1:4173/path']) {
    rejects(() => validateQaRequest({ ...request(), headers: { ...headers(), origin } }), 'ORIGIN');
  }
  rejects(() => validateQaRequest({ ...request(), headers: { ...headers(), host: 'evil.example', origin: 'http://evil.example' } }), 'ORIGIN');
  for (const length of ['', '0', '-1', '1.5', 'NaN']) rejects(() => validateQaRequest({ ...request(), headers: { ...headers(), 'content-length': length } }), 'CONTENT_LENGTH');
  rejects(() => validateQaRequest({ ...request(), headers: { ...headers(), 'content-length': String(MAX_QA_REQUEST_BYTES + 1) } }), 'TOO_LARGE');
  rejects(() => validateQaRequest({ ...request(), headers: { ...headers(), 'transfer-encoding': 'chunked' } }), 'ENCODING');
  rejects(() => validateQaRequest({ ...request(), headers: { ...headers(), 'content-type': 'text/plain' } }), 'CONTENT_TYPE');
});

test('evidence payload rejects paths, reserved names, extra keys and mismatched extensions', () => {
  for (const filename of ['../outside.json', '/outside.json', 'C:\\outside.json', 'a/b.json', 'a..json', '.hidden.json', 'con.json', 'NUL.png', 'note.txt']) {
    rejects(() => parseQaEvidence(encoded(metrics(filename))), 'FILENAME');
  }
  rejects(() => parseQaEvidence(encoded({ ...metrics(), directory: '../outside' })), 'FIELDS');
  rejects(() => parseQaEvidence(encoded(metrics('frame.png'))), 'FORMAT');
  rejects(() => parseQaEvidence(Buffer.from('{broken')), 'JSON');
});

test('JSON metrics serialize finite values as readable UTF-8 and reject unsafe or unbounded structures', () => {
  const result = parseQaEvidence(encoded(metrics()));
  assert.equal(result.filename, 'ci01-run1.json');
  assert.deepEqual(JSON.parse(result.bytes.toString('utf8')), metrics().data);
  rejects(() => parseQaEvidence(encoded({ ...metrics(), data: 'not metrics' })), 'METRICS');
  rejects(() => parseQaEvidence(Buffer.from('{"filename":"bad.json","mimeType":"application/json","data":{"__proto__":{}}}')), 'METRICS_KEY');
  rejects(() => parseQaEvidence(Buffer.from('{"filename":"bad.json","mimeType":"application/json","data":{"value":1e999}}')), 'METRICS_VALUE');
  let nested: unknown = 1;
  for (let i = 0; i < 14; i++) nested = { child: nested };
  rejects(() => parseQaEvidence(encoded({ ...metrics(), data: nested })), 'METRICS_LIMIT');
});

test('image evidence requires canonical base64 and matching PNG/JPEG signatures', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jq1EAAAAASUVORK5CYII=';
  const result = parseQaEvidence(encoded({ filename: 'cover-0001.png', mimeType: 'image/png', data: png }));
  assert.equal(result.bytes.toString('base64'), png);
  rejects(() => parseQaEvidence(encoded({ filename: 'cover.png', mimeType: 'image/png', data: 'data:image/png;base64,' + png })), 'BASE64');
  rejects(() => parseQaEvidence(encoded({ filename: 'cover.png', mimeType: 'image/png', data: 'aGVsbG8=' })), 'IMAGE_SIGNATURE');
  rejects(() => parseQaEvidence(encoded({ filename: 'cover.jpg', mimeType: 'image/jpeg', data: png })), 'IMAGE_SIGNATURE');
});

test('plugin has no production-build or preview route', () => {
  const plugin = qaEvidencePlugin();
  assert.equal(typeof plugin.configureServer, 'function');
  assert.equal(plugin.configurePreviewServer, undefined);
  assert.equal(typeof plugin.apply, 'function');
  if (typeof plugin.apply !== 'function') assert.fail();
  assert.equal(plugin.apply({}, { command: 'build', mode: 'production' }), false);
  assert.equal(plugin.apply({}, { command: 'serve', mode: 'production' }), false);
  assert.equal(plugin.apply({}, { command: 'serve', mode: 'development' }), true);
});
