import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import {
  maxBlobBytes,
  PBKDF2_ITERATIONS,
  PENDING_TTL_MS,
  TOMBSTONE_DAYS,
} from '../../../packages/shared/src/constants.ts';

const WEB_ORIGIN = 'http://localhost:5173';
const blob = new Uint8Array(randomBytes(256));
const day = 24 * 60 * 60 * 1_000;
let mf;
let db;
let bucket;

before(async () => {
  const bundle = await build({
    entryPoints: ['test/worker-fixture.ts'],
    bundle: true,
    format: 'esm',
    write: false,
  });
  mf = new Miniflare({
    workers: [
      {
        config: {
          name: 'hashbox-test',
          compatibilityDate: '2024-11-01',
          manifest: {
            mainModule: 'index.js',
            modules: { 'index.js': { type: 'esm', contents: bundle.outputFiles[0].text } },
          },
          env: {
            WEB_ORIGIN: { type: 'text', value: WEB_ORIGIN },
            DB: { type: 'd1', id: 'hashbox-test' },
            BLOBS: { type: 'r2', name: 'hashbox-test' },
          },
        },
      },
    ],
  });
  db = await mf.getD1Database('DB');
  bucket = await mf.getR2Bucket('BLOBS');
  const migrations = (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort();
  for (const migration of migrations) {
    const sql = await readFile('migrations/' + migration, 'utf8');
    const statements = sql
      .replace(/^\s*--[^\n]*$/gm, '')
      .split(';')
      .filter((s) => s.trim());
    await db.batch(statements.map((statement) => db.prepare(statement)));
  }
});

after(async () => {
  await mf?.dispose();
});

function fetchApi(path, options = {}) {
  return mf.dispatchFetch('http://localhost' + path, options);
}

function bearer(token) {
  return { Authorization: 'Bearer ' + token };
}

function token(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('base64url');
}

function row(id) {
  return db.prepare('SELECT * FROM shares WHERE id = ?').bind(id).first();
}

function create(fields = {}) {
  return fetchApi('/api/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'text',
      size: blob.length,
      expiresIn: 3600,
      maxViews: 1,
      ...fields,
    }),
  });
}

async function newShare(fields) {
  const response = await create(fields);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return response.json();
}

function upload(share, body = blob, headers = {}) {
  return fetchApi('/api/shares/' + share.id + '/blob', {
    method: 'PUT',
    headers: { ...bearer(share.uploadToken), ...headers },
    body,
    duplex: 'half',
  });
}

function open(share, authToken, headers = {}) {
  return fetchApi('/api/shares/' + share.id + '/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: authToken === undefined ? undefined : JSON.stringify({ authToken }),
  });
}

function meta(share) {
  return fetchApi('/api/shares/' + share.id);
}

function manage(share, method = 'GET', headers = {}) {
  return fetchApi('/api/manage', { method, headers: { ...bearer(share.manageToken), ...headers } });
}

async function error(response, status, code, attemptsLeft) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.error.code, code);
  if (attemptsLeft !== undefined) assert.equal(body.error.attemptsLeft, attemptsLeft);
}

test('creation validates options and returns 413 at each kind limit', async () => {
  for (const kind of ['text', 'env', 'file']) {
    await error(await create({ kind, size: maxBlobBytes(kind) + 1 }), 413, 'TOO_LARGE');
    await newShare({ kind, size: maxBlobBytes(kind) });
  }
  await error(await create({ maxViews: 2 }), 400, 'BAD_REQUEST');
  await error(await create({ expiresIn: 0 }), 400, 'BAD_REQUEST');
  await error(await create({ size: 0 }), 400, 'BAD_REQUEST');
  await error(await create({ password: { authToken: 'invalid' } }), 400, 'BAD_REQUEST');
});

test('creation saves token hashes; sequential upload reuse is rejected', async () => {
  const share = await newShare();
  const pending = await row(share.id);
  assert.equal(pending.status, 'pending');
  assert.equal(pending.manage_hash, sha256(share.manageToken));
  assert.equal(pending.upload_hash, sha256(share.uploadToken));
  await error(await meta(share), 404, 'NOT_FOUND');
  await error(await upload({ ...share, uploadToken: token() }), 401, 'UNAUTHORIZED');
  assert.equal((await upload(share)).status, 204);
  assert.equal((await row(share.id)).upload_hash, null);
  await error(await upload(share), 401, 'UNAUTHORIZED');
});

test('upload rejects empty, truncated, and over-limit bodies without making the share ready', async () => {
  const share = await newShare();
  await error(await upload(share, blob, { 'X-Test-Content-Length': 'bad' }), 400, 'BAD_REQUEST');
  await error(await upload(share, new Uint8Array()), 400, 'BAD_REQUEST');
  await error(await upload(share, blob.subarray(0, 16)), 400, 'BAD_REQUEST');
  await error(await upload(share, new Uint8Array(maxBlobBytes('text') + 1)), 413, 'TOO_LARGE');
  const chunks = new ReadableStream({
    start(controller) {
      controller.enqueue(blob);
      controller.enqueue(Uint8Array.of(1));
      controller.close();
    },
  });
  await error(await upload(share, chunks), 400, 'BAD_REQUEST');
  assert.equal((await row(share.id)).status, 'pending');
  assert.equal(await bucket.head('blobs/' + share.id), null);
  assert.equal((await upload(share)).status, 204);
});

test('CORS preflight permits authorization, and the view count header is exposed', async () => {
  const preflight = await fetchApi('/api/manage', {
    method: 'OPTIONS',
    headers: {
      Origin: WEB_ORIGIN,
      'Access-Control-Request-Method': 'DELETE',
      'Access-Control-Request-Headers': 'Authorization',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), WEB_ORIGIN);
  assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /authorization/i);
  assert.equal(preflight.headers.get('Cache-Control'), 'no-store');

  const share = await newShare();
  assert.equal((await upload(share)).status, 204);
  const response = await open(share, undefined, { Origin: WEB_ORIGIN });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Expose-Headers'), 'X-Views-Left');
});

test('concurrent uploads keep exactly one blob and never overwrite the winner', async () => {
  const share = await newShare();
  const otherBlob = new Uint8Array(randomBytes(blob.length));
  const responses = await Promise.all([upload(share, blob), upload(share, otherBlob)]);
  assert.equal(responses.filter((response) => response.status === 204).length, 1);
  assert.ok(responses.every((response) => [204, 401, 409].includes(response.status)));
  const response = await open(share);
  assert.equal(response.status, 200);
  const expected = responses[0].status === 204 ? blob : otherBlob;
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), expected);
});

test('metadata is read-only; ten simultaneous opens of a one-view share yield one blob', async () => {
  const share = await newShare();
  assert.equal((await upload(share)).status, 204);
  for (let i = 0; i < 3; i++) assert.equal((await (await meta(share)).json()).viewsLeft, 1);

  const results = await Promise.all(Array.from({ length: 10 }, () => open(share)));
  const successful = results.filter((response) => response.status === 200);
  assert.equal(successful.length, 1);
  assert.equal(successful[0].headers.get('X-Views-Left'), '0');
  assert.equal(successful[0].headers.get('Content-Type'), 'application/octet-stream');
  assert.deepEqual(new Uint8Array(await successful[0].arrayBuffer()), blob);
  for (const response of results.filter((r) => r.status !== 200)) {
    await error(response, 410, 'CONSUMED');
  }
  assert.equal((await row(share.id)).views_left, 0);
  assert.equal(await bucket.head('blobs/' + share.id), null);
});

test('env and files use the same API, including uploads larger than the text limit', async () => {
  for (const [kind, body] of [
    ['env', blob],
    ['file', new Uint8Array(maxBlobBytes('text') + 1)],
  ]) {
    const share = await newShare({ kind, size: body.length });
    assert.equal((await upload(share, body)).status, 204);
    assert.equal((await (await meta(share)).json()).kind, kind);
    const response = await open(share);
    assert.equal(response.status, 200);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), body);
  }
});

test('password metadata exposes KDF parameters; valid proof opens the share', async () => {
  const { authToken, salt } = { authToken: token(), salt: token(16) };
  const share = await newShare({ password: { authToken, salt, iter: PBKDF2_ITERATIONS } });
  assert.equal((await row(share.id)).auth_hash, sha256(authToken));
  assert.equal((await upload(share)).status, 204);
  const metadata = await (await meta(share)).json();
  assert.equal(metadata.hasPassword, true);
  assert.deepEqual(metadata.kdf, { salt, iter: PBKDF2_ITERATIONS });
  assert.equal(JSON.stringify(metadata).includes(authToken), false);
  await error(await open(share, token()), 401, 'WRONG_PASSWORD', 4);
  assert.equal((await row(share.id)).views_left, 1);
  assert.equal((await open(share, authToken)).status, 200);
});

test('missing and wrong passwords do not charge views; concurrent failures lock at exactly five', async () => {
  const authToken = token();
  const share = await newShare({
    password: { authToken, salt: token(16), iter: PBKDF2_ITERATIONS },
  });
  assert.equal((await upload(share)).status, 204);
  await error(await open(share), 401, 'WRONG_PASSWORD', 4);
  const responses = await Promise.all(Array.from({ length: 8 }, () => open(share, token())));
  const attemptsLeft = [];
  for (const response of responses) {
    if (response.status === 401) attemptsLeft.push((await response.json()).error.attemptsLeft);
    else await error(response, 410, 'LOCKED');
  }
  assert.deepEqual(attemptsLeft.sort(), [1, 2, 3]);
  const locked = await row(share.id);
  assert.equal(locked.status, 'locked');
  assert.equal(locked.failed_attempts, 5);
  assert.equal(locked.views_left, 1);
  assert.equal(await bucket.head('blobs/' + share.id), null);
  await error(await open(share, authToken), 410, 'LOCKED');
});

test('manage checks the bearer, reports timestamps, and can safely revoke twice', async () => {
  const share = await newShare({ maxViews: 3 });
  const unauthenticated = { ...share, manageToken: token() };
  await error(await manage(unauthenticated), 401, 'UNAUTHORIZED');
  await error(await manage(unauthenticated, 'DELETE'), 401, 'UNAUTHORIZED');
  assert.equal((await (await manage(share)).json()).status, 'pending');
  assert.equal((await upload(share)).status, 204);
  assert.equal((await open(share)).status, 200);
  const status = await (await manage(share)).json();
  assert.equal(status.viewsLeft, 2);
  assert.equal(typeof status.firstOpenedAt, 'number');
  assert.equal(status.lastOpenedAt, status.firstOpenedAt);

  assert.equal((await manage(share, 'DELETE')).status, 204);
  assert.equal((await manage(share, 'DELETE')).status, 204);
  await error(await open(share), 410, 'REVOKED');
  assert.equal(await bucket.head('blobs/' + share.id), null);
});

test('R2 failures preserve upload/open state and failed deletes are retried by Cron', async () => {
  const share = await newShare();
  await error(await upload(share, blob, { 'X-Test-R2-Failure': 'put' }), 500, 'INTERNAL');
  assert.equal((await row(share.id)).status, 'pending');
  assert.equal((await upload(share)).status, 204);
  await error(await open(share, undefined, { 'X-Test-R2-Failure': 'get' }), 500, 'INTERNAL');
  assert.equal((await row(share.id)).views_left, 1);
  assert.equal((await open(share, undefined, { 'X-Test-R2-Failure': 'delete' })).status, 200);
  const consumed = await row(share.id);
  assert.equal(consumed.status, 'consumed');
  assert.equal(consumed.blob_deleted, 0);
  assert.ok(await bucket.head('blobs/' + share.id));
  await error(await open(share), 410, 'CONSUMED');

  const worker = await mf.getWorker();
  await worker.scheduled({ cron: '*/10 * * * *' });
  assert.equal(await bucket.head('blobs/' + share.id), null);
  assert.equal((await row(share.id)).blob_deleted, 1);
});

test('scheduled cleanup expires ready and stale pending shares and keeps recent terminal rows', async () => {
  const ready = await newShare();
  assert.equal((await upload(ready)).status, 204);
  const pending = await newShare({ expiresIn: 86400 });
  const now = Date.now();
  await db
    .prepare('UPDATE shares SET expires_at = ? WHERE id = ?')
    .bind(now - 1, ready.id)
    .run();
  await db
    .prepare('UPDATE shares SET created_at = ? WHERE id = ?')
    .bind(now - PENDING_TTL_MS - 1, pending.id)
    .run();

  const worker = await mf.getWorker();
  await worker.scheduled({ cron: '*/10 * * * *', scheduledTime: now });
  for (const { id } of [ready, pending]) {
    const expired = await row(id);
    assert.equal(expired.status, 'expired');
    assert.equal(expired.upload_hash, null);
    assert.equal(expired.blob_deleted, 1);
  }
  assert.equal(await bucket.head('blobs/' + ready.id), null);
  await error(await open(ready), 410, 'EXPIRED');

  await worker.scheduled({ cron: '*/10 * * * *', scheduledTime: now + TOMBSTONE_DAYS * day });
  assert.equal(await row(ready.id), null);
  assert.equal((await row(pending.id)).status, 'expired');
});
