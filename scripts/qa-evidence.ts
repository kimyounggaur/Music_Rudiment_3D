import { createHash } from 'node:crypto';
import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export const QA_EVIDENCE_ROUTE = '/__qa/evidence';
export const MAX_QA_REQUEST_BYTES = 16 * 1024 * 1024;
const allowedHosts = new Set(['localhost', '127.0.0.1']);
const allowedRemotes = new Set(['127.0.0.1', '::ffff:127.0.0.1', '::1']);
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);

export class QaEvidenceError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'QaEvidenceError';
    this.status = status;
    this.code = code;
  }
}

type RequestMetadata = Readonly<{
  method?: string;
  headers: IncomingHttpHeaders;
  remoteAddress?: string;
}>;

/** No CORS, forwarded-host trust, compression or streaming/chunked uploads. */
export function validateQaRequest(request: RequestMetadata): number {
  const fail = (status: number, code: string, message: string): never => { throw new QaEvidenceError(status, code, message); };
  if (request.method !== 'POST') fail(405, 'METHOD', 'Use POST.');
  if (!request.remoteAddress || !allowedRemotes.has(request.remoteAddress)) fail(403, 'LOCAL_ONLY', 'Local requests only.');
  const { host, origin } = request.headers;
  if (typeof host !== 'string' || typeof origin !== 'string') throw new QaEvidenceError(403, 'ORIGIN', 'A matching local origin is required.');
  try {
    const target = new URL(`http://${host}`);
    const source = new URL(origin);
    if (!allowedHosts.has(target.hostname) || target.pathname !== '/' || target.search || target.hash || target.username || target.password
      || source.protocol !== 'http:' || !allowedHosts.has(source.hostname) || source.origin !== target.origin
      || origin !== source.origin) fail(403, 'ORIGIN', 'A matching local origin is required.');
  } catch { fail(403, 'ORIGIN', 'A matching local origin is required.'); }
  const fetchSite = request.headers['sec-fetch-site'];
  if (fetchSite !== undefined && fetchSite !== 'same-origin') fail(403, 'ORIGIN', 'Same-origin requests only.');
  const type = request.headers['content-type'];
  if (typeof type !== 'string' || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(type)) fail(415, 'CONTENT_TYPE', 'Use application/json.');
  if (request.headers['transfer-encoding'] !== undefined || request.headers['content-encoding'] !== undefined) fail(400, 'ENCODING', 'Encoded or chunked bodies are not accepted.');
  const lengthHeader = request.headers['content-length'];
  if (typeof lengthHeader !== 'string' || !/^[1-9]\d{0,8}$/.test(lengthHeader)) fail(411, 'CONTENT_LENGTH', 'A positive Content-Length is required.');
  const length = Number(lengthHeader);
  if (length > MAX_QA_REQUEST_BYTES) fail(413, 'TOO_LARGE', 'The request exceeds 16 MiB.');
  return length;
}

function validateMetrics(value: unknown, depth = 0, budget = { nodes: 0 }): void {
  if (++budget.nodes > 100_000 || depth > 12) throw new QaEvidenceError(422, 'METRICS_LIMIT', 'Metrics structure exceeds the limit.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value === 'string' && value.length <= 4000) return;
  if (Array.isArray(value)) { for (const item of value) validateMetrics(item, depth + 1, budget); return; }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) {
      if (!key || key.length > 100 || forbiddenKeys.has(key)) throw new QaEvidenceError(422, 'METRICS_KEY', 'Unsupported metrics key.');
      validateMetrics(item, depth + 1, budget);
    }
    return;
  }
  throw new QaEvidenceError(422, 'METRICS_VALUE', 'Metrics must contain finite JSON values.');
}

export type QaEvidence = Readonly<{ filename: string; bytes: Buffer }>;

/** Filename is a strict basename allowlist, never a user-supplied path. */
export function parseQaEvidence(body: Buffer): QaEvidence {
  if (body.length === 0 || body.length > MAX_QA_REQUEST_BYTES) throw new QaEvidenceError(413, 'TOO_LARGE', 'The request exceeds 16 MiB.');
  let input: unknown;
  try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
  catch { throw new QaEvidenceError(400, 'JSON', 'Invalid JSON body.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new QaEvidenceError(422, 'PAYLOAD', 'An evidence object is required.');
  const record = input as Record<string, unknown>;
  if (Object.keys(record).length !== 3 || !['filename', 'mimeType', 'data'].every((key) => Object.hasOwn(record, key))) throw new QaEvidenceError(422, 'FIELDS', 'Use filename, mimeType and data only.');
  if (typeof record.filename !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}\.(?:png|jpg|jpeg|json)$/.test(record.filename)
    || /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])\./i.test(record.filename)) throw new QaEvidenceError(422, 'FILENAME', 'Use an allowed ASCII evidence filename.');
  const filename = record.filename;
  const extension = filename.slice(filename.lastIndexOf('.') + 1);
  if (record.mimeType === 'application/json' && extension === 'json') {
    if (!record.data || typeof record.data !== 'object') throw new QaEvidenceError(422, 'METRICS', 'Metrics data must be a JSON object or array.');
    validateMetrics(record.data);
    const bytes = Buffer.from(JSON.stringify(record.data, null, 2) + '\n', 'utf8');
    if (bytes.length > MAX_QA_REQUEST_BYTES) throw new QaEvidenceError(413, 'TOO_LARGE', 'Formatted evidence exceeds 16 MiB.');
    return { filename, bytes };
  }
  const png = record.mimeType === 'image/png' && extension === 'png';
  const jpeg = record.mimeType === 'image/jpeg' && (extension === 'jpg' || extension === 'jpeg');
  if (!png && !jpeg) throw new QaEvidenceError(422, 'FORMAT', 'Filename and supported MIME type must agree.');
  if (typeof record.data !== 'string' || record.data.length === 0 || record.data.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(record.data)) throw new QaEvidenceError(422, 'BASE64', 'Use raw canonical base64 image data.');
  const bytes = Buffer.from(record.data, 'base64');
  if (bytes.toString('base64') !== record.data) throw new QaEvidenceError(422, 'BASE64', 'Use raw canonical base64 image data.');
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const isPng = bytes.length >= 33 && bytes.subarray(0, 8).equals(pngSignature) && bytes.subarray(12, 16).toString('ascii') === 'IHDR';
  const isJpeg = bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  if (png ? !isPng : !isJpeg) throw new QaEvidenceError(422, 'IMAGE_SIGNATURE', 'Image signature does not match its MIME type.');
  return { filename, bytes };
}

async function evidenceDirectory(root: string): Promise<string> {
  let directory = await realpath(root);
  for (const name of ['output', 'qa-v2.1']) {
    directory = join(directory, name);
    try { await mkdir(directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new QaEvidenceError(409, 'OUTPUT_DIRECTORY', 'Evidence directory must be an ordinary project directory.');
  }
  return directory;
}

function respond(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (status === 405) response.setHeader('Allow', 'POST');
  response.end(JSON.stringify(value));
}

async function receiveEvidence(request: IncomingMessage, response: ServerResponse, root: string): Promise<void> {
  try {
    const expectedLength = validateQaRequest({ method: request.method, headers: request.headers, remoteAddress: request.socket.remoteAddress });
    let received = 0;
    const chunks: Buffer[] = [];
    for await (const raw of request) {
      const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      received += chunk.length;
      if (received > expectedLength || received > MAX_QA_REQUEST_BYTES) throw new QaEvidenceError(413, 'TOO_LARGE', 'Body exceeds its declared limit.');
      chunks.push(chunk);
    }
    if (received !== expectedLength) throw new QaEvidenceError(400, 'BODY_LENGTH', 'Body length does not match Content-Length.');
    const evidence = parseQaEvidence(Buffer.concat(chunks, received));
    const directory = await evidenceDirectory(root);
    await writeFile(join(directory, evidence.filename), evidence.bytes, { flag: 'wx' });
    respond(response, 201, {
      path: `output/qa-v2.1/${evidence.filename}`,
      sha256: createHash('sha256').update(evidence.bytes).digest('hex'),
      bytes: evidence.bytes.length,
    });
  } catch (error) {
    if (response.destroyed || response.writableEnded) return;
    if (error instanceof QaEvidenceError) respond(response, error.status, { error: error.code, message: error.message });
    else if ((error as NodeJS.ErrnoException).code === 'EEXIST') respond(response, 409, { error: 'EXISTS', message: 'Evidence already exists; choose a unique filename.' });
    else respond(response, 500, { error: 'SAVE_FAILED', message: 'Evidence could not be saved.' });
  }
}

/** configureServer is never installed in a production build or Vite preview. */
export function qaEvidencePlugin(): Plugin {
  return {
    name: 'local-qa-evidence',
    apply: (_config, environment) => environment.command === 'serve' && environment.mode !== 'production',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== QA_EVIDENCE_ROUTE) { next(); return; }
        void receiveEvidence(request, response, server.config.root);
      });
    },
  };
}
