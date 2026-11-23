// 보안 테스트 (#37, 개발 기획서 10장)
// 실제 암호화 모듈(@hashbox/shared crypto)과 실제 API(Miniflare 로컬 D1·R2)를 끝까지 연결해서 확인한다.
// share-api.test.mjs가 가짜 토큰으로 API 규칙을 본다면, 이 파일은 "보내기 → 서버 → 받기" 전체에서
// 서버가 평문·열쇠를 보지 못하고, 열람 통제가 실제 사용 흐름에서 지켜지는지를 본다.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const WEB_ORIGIN = 'http://localhost:5173';
const enc = new TextEncoder();
const dec = new TextDecoder();

let mf;
let db;
let bucket;
/** @type {typeof import('../../../packages/shared/src/index.ts')} */
let shared;
/** Worker가 남긴 모든 로그 (console.*) */
const logs = [];
/** 테스트 중 만든 비밀들. 마지막에 서버 저장소·로그 어디에도 없는지 확인한다 */
const secrets = [];

before(async () => {
  // shared는 확장자 없는 import를 써서 Node가 바로 못 읽는다 → esbuild로 묶어서 불러온다
  const sharedBundle = await build({
    entryPoints: ['../../packages/shared/src/index.ts'],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
  });
  shared = await import(
    'data:text/javascript;base64,' +
      Buffer.from(sharedBundle.outputFiles[0].text).toString('base64')
  );

  const workerBundle = await build({
    entryPoints: ['test/worker-fixture.ts'],
    bundle: true,
    format: 'esm',
    write: false,
  });
  mf = new Miniflare({
    handleStructuredLogs: (log) => logs.push(log.message),
    workers: [
      {
        config: {
          name: 'hashbox-security-test',
          compatibilityDate: '2024-11-01',
          manifest: {
            mainModule: 'index.js',
            modules: { 'index.js': { type: 'esm', contents: workerBundle.outputFiles[0].text } },
          },
          env: {
            WEB_ORIGIN: { type: 'text', value: WEB_ORIGIN },
            DB: { type: 'd1', id: 'hashbox-security-test' },
            BLOBS: { type: 'r2', name: 'hashbox-security-test' },
          },
        },
      },
    ],
  });
  db = await mf.getD1Database('DB');
  bucket = await mf.getR2Bucket('BLOBS');
  const migrations = (await readdir('migrations')).filter((n) => n.endsWith('.sql')).sort();
  for (const migration of migrations) {
    const sql = await readFile('migrations/' + migration, 'utf8');
    const statements = sql
      .replace(/^\s*--[^\n]*$/gm, '')
      .split(';')
      .filter((s) => s.trim());
    await db.batch(statements.map((s) => db.prepare(s)));
  }
});

after(async () => {
  await mf?.dispose();
});

// ---------- 클라이언트 흉내 (FE1·FE2가 하는 일을 그대로) ----------

function api(path, options = {}) {
  return mf.dispatchFetch('http://localhost' + path, options);
}

/** 보내기: encryptPayload → POST /api/shares → PUT blob. 받기 링크 구성요소를 돌려준다 */
async function send(header, content, { password, expiresIn = 3600, maxViews = 1 } = {}) {
  const e = await shared.encryptPayload(header, content, { password });
  const res = await api('/api/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: header.kind,
      size: e.blob.length,
      expiresIn,
      maxViews,
      password: e.password,
    }),
  });
  assert.equal(res.status, 201);
  const share = await res.json();
  const up = await api(`/api/shares/${share.id}/blob`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + share.uploadToken },
    body: e.blob,
    duplex: 'half',
  });
  assert.equal(up.status, 204);

  secrets.push(e.linkKey, share.manageToken, share.uploadToken);
  if (e.password) secrets.push(e.password.authToken);
  // 아주 짧은 비밀번호는 해시 문자열에 우연히 들어갈 수 있어 검사 대상에서 뺀다
  if (password && password.length >= 8) secrets.push(password);
  return { ...share, linkKey: e.linkKey };
}

function meta(id) {
  return api(`/api/shares/${id}`);
}

function openRaw(id, authToken) {
  return api(`/api/shares/${id}/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: authToken === undefined ? undefined : JSON.stringify({ authToken }),
  });
}

/** 받기: GET → (비밀번호면 authToken 계산) → open → decryptPayload */
async function receive(id, linkKey, password) {
  const m = await (await meta(id)).json();
  const authToken =
    m.hasPassword && password !== undefined
      ? await shared.computeAuthToken(password, m.kdf.salt, m.kdf.iter)
      : undefined;
  const res = await openRaw(id, authToken);
  if (res.status !== 200) return { status: res.status, body: await res.json() };
  const blob = new Uint8Array(await res.arrayBuffer());
  const out = await shared.decryptPayload(
    blob,
    linkKey,
    m.hasPassword ? { password, kdf: m.kdf } : {},
  );
  return { status: 200, ...out, viewsLeft: Number(res.headers.get('X-Views-Left')) };
}

function row(id) {
  return db.prepare('SELECT * FROM shares WHERE id = ?').bind(id).first();
}

async function blobExists(id) {
  return (await bucket.head('blobs/' + id)) !== null;
}

function tamperFirstChar(s) {
  return (s[0] === 'A' ? 'B' : 'A') + s.slice(1);
}

// ---------- 정상 흐름 ----------

test('E2E: 텍스트를 보내고 받으면 원문이 그대로 나오고, 1회 뒤에는 "이미 열람됨"', async () => {
  const plain = 'OPENAI_API_KEY=sk-test-' + crypto.randomUUID();
  secrets.push(plain);
  const s = await send({ v: 1, kind: 'text' }, enc.encode(plain));

  const got = await receive(s.id, s.linkKey);
  assert.equal(got.status, 200);
  assert.equal(dec.decode(got.content), plain);
  assert.equal(got.viewsLeft, 0);

  const again = await receive(s.id, s.linkKey);
  assert.equal(again.status, 410);
  assert.equal(again.body.error.code, 'CONSUMED');
  assert.equal((await (await meta(s.id)).json()).status, 'consumed');
});

// ---------- 10장 보안 테스트 7개 ----------

test('[10-1] 1회 상자에 open을 동시에 10번 → 정확히 1명만 받고, 그 1명만 복호화된다', async () => {
  const plain = 'race-' + crypto.randomUUID();
  secrets.push(plain);
  const s = await send({ v: 1, kind: 'text' }, enc.encode(plain));

  const results = await Promise.all(Array.from({ length: 10 }, () => openRaw(s.id)));
  const ok = results.filter((r) => r.status === 200);
  assert.equal(ok.length, 1);
  const decrypted = await shared.decryptPayload(
    new Uint8Array(await ok[0].arrayBuffer()),
    s.linkKey,
  );
  assert.equal(dec.decode(decrypted.content), plain);
  for (const r of results.filter((r) => r.status !== 200)) assert.equal(r.status, 410);
});

test('[10-2] GET 상태 조회는 여러 번 해도 열람 횟수가 줄지 않는다 (미리보기 봇)', async () => {
  const s = await send({ v: 1, kind: 'text' }, enc.encode('bot-safe'));
  for (let i = 0; i < 5; i++) {
    const m = await (await meta(s.id)).json();
    assert.equal(m.viewsLeft, 1);
    assert.equal(m.status, 'ready');
  }
  assert.equal((await row(s.id)).views_left, 1);
  assert.equal((await receive(s.id, s.linkKey)).status, 200);
});

test('[10-3] 비밀번호 없이·틀린 비밀번호로는 횟수가 줄지 않고, 5번째 실패에 잠기며 암호문이 삭제된다', async () => {
  const s = await send({ v: 1, kind: 'env' }, enc.encode('DB_PASSWORD=hunter2\n'), {
    password: '맞는비번-correct',
  });

  // 링크만 가진 사람: authToken 없이 open해도 실패 횟수는 소모하지 않는다.
  const noPw = await openRaw(s.id);
  assert.equal(noPw.status, 401);
  assert.equal((await noPw.json()).error.attemptsLeft, 5);
  assert.equal((await row(s.id)).failed_attempts, 0);
  assert.equal((await row(s.id)).views_left, 1);

  // 틀린 비밀번호 4번 (실제 PBKDF2로 계산한 authToken)
  for (const left of [4, 3, 2, 1]) {
    const r = await receive(s.id, s.linkKey, 'wrong-' + left);
    assert.equal(r.status, 401);
    assert.equal(r.body.error.attemptsLeft, left);
    assert.equal((await row(s.id)).views_left, 1);
  }
  assert.ok(await blobExists(s.id));

  // 5번째 실패 → 잠김 + R2 삭제, 이후 맞는 비밀번호도 410
  const fifth = await receive(s.id, s.linkKey, 'wrong-last');
  assert.equal(fifth.status, 410);
  assert.equal(fifth.body.error.code, 'LOCKED');
  assert.equal((await row(s.id)).status, 'locked');
  assert.equal(await blobExists(s.id), false);
  const late = await receive(s.id, s.linkKey, '맞는비번-correct');
  assert.equal(late.status, 410);
  assert.equal(late.body.error.code, 'LOCKED');
});

test('비밀번호 상자: 맞는 비밀번호면 열리고, 링크만으로는 복호화도 안 된다', async () => {
  const plain = 'STRIPE_SECRET=sk_live_' + crypto.randomUUID();
  secrets.push(plain);
  const s = await send({ v: 1, kind: 'env' }, enc.encode(plain), {
    password: '한글 비밀번호 123',
    maxViews: 3,
  });

  const got = await receive(s.id, s.linkKey, '한글 비밀번호 123');
  assert.equal(got.status, 200);
  assert.equal(dec.decode(got.content), plain);

  // 서버가 암호문을 내줬다고 가정해도(링크만 가진 공격자) 비밀번호 없이는 풀 수 없다
  const raw = await bucket.get('blobs/' + s.id);
  const blob = new Uint8Array(await raw.arrayBuffer());
  await assert.rejects(shared.decryptPayload(blob, s.linkKey), shared.DecryptError);
});

test('[10-4] 링크 열쇠를 한 글자만 바꿔도 복호화 실패 화면(DecryptError)', async () => {
  const s = await send({ v: 1, kind: 'text' }, enc.encode('tamper-me'), { maxViews: 3 });
  const got = await receive(s.id, tamperFirstChar(s.linkKey)).catch((e) => e);
  assert.ok(got instanceof shared.DecryptError);
  // 원래 열쇠로는 여전히 열린다
  assert.equal((await receive(s.id, s.linkKey)).status, 200);
});

test('[10-4] 서버가 R2의 암호문을 1바이트 바꿔치기해도 받는 쪽이 알아챈다 (GCM 인증)', async () => {
  const s = await send({ v: 1, kind: 'text' }, enc.encode('integrity'));
  const raw = new Uint8Array(await (await bucket.get('blobs/' + s.id)).arrayBuffer());
  raw[raw.length - 1] ^= 0x01;
  await bucket.put('blobs/' + s.id, raw);
  await assert.rejects(receive(s.id, s.linkKey), shared.DecryptError);
});

test('[10-5] 열람 횟수를 다 쓰면(consumed) R2 암호문이 실제로 삭제된다', async () => {
  const s = await send({ v: 1, kind: 'text' }, enc.encode('three-views'), { maxViews: 3 });
  for (const left of [2, 1]) {
    const got = await receive(s.id, s.linkKey);
    assert.equal(got.viewsLeft, left);
    assert.ok(await blobExists(s.id), '남은 횟수가 있으면 암호문은 유지');
  }
  assert.equal((await receive(s.id, s.linkKey)).viewsLeft, 0);
  assert.equal((await row(s.id)).status, 'consumed');
  assert.equal(await blobExists(s.id), false);
});

test('[10-6] 만료 후 Cron이 돌면 expired가 되고 R2 암호문이 삭제된다', async () => {
  const s = await send({ v: 1, kind: 'text' }, enc.encode('expire-me'), { expiresIn: 600 });
  assert.ok(await blobExists(s.id));
  const now = Date.now();
  await db
    .prepare('UPDATE shares SET expires_at = ? WHERE id = ?')
    .bind(now - 1, s.id)
    .run();

  const worker = await mf.getWorker();
  await worker.scheduled({ cron: '*/10 * * * *', scheduledTime: now });
  assert.equal((await row(s.id)).status, 'expired');
  assert.equal(await blobExists(s.id), false);
  const late = await receive(s.id, s.linkKey);
  assert.equal(late.status, 410);
  assert.equal(late.body.error.code, 'EXPIRED');
});

// ---------- 악의적인 서버 ----------

test('서버가 약한 KDF 파라미터(iter=1)를 내려주면 받는 쪽이 비밀번호 계산을 거부한다', async () => {
  const s = await send({ v: 1, kind: 'text' }, enc.encode('weak-kdf'), { password: 'pw' });
  await db.prepare('UPDATE shares SET kdf_iter = 1 WHERE id = ?').bind(s.id).run();
  const m = await (await meta(s.id)).json();
  assert.equal(m.kdf.iter, 1);
  await assert.rejects(
    shared.computeAuthToken('pw', m.kdf.salt, m.kdf.iter),
    shared.InvalidInputError,
  );
  assert.equal((await row(s.id)).views_left, 1, '계산을 거부했으니 열기 요청도 나가지 않음');
});

// ---------- 메타데이터 노출 범위 ----------

test('파일명·MIME은 서버 응답·D1 어디에도 없고, 상태 조회는 허용한 메타데이터만 준다', async () => {
  const name = 'secret-' + crypto.randomUUID() + '.pem';
  secrets.push(name);
  const s = await send(
    { v: 1, kind: 'file', name, mime: 'application/x-pem-file', size: 4 },
    new Uint8Array([1, 2, 3, 4]),
  );
  const m = await (await meta(s.id)).json();
  assert.deepEqual(Object.keys(m).sort(), [
    'expiresAt',
    'hasPassword',
    'kind',
    'size',
    'status',
    'viewsLeft',
  ]);
  assert.equal(JSON.stringify(m).includes(name), false);
  assert.equal(JSON.stringify(await row(s.id)).includes(name), false);

  const got = await receive(s.id, s.linkKey);
  assert.equal(got.header.name, name, '받는 쪽에서는 복호화 후 파일명이 보인다');
});

test('다른 출처(Origin)에서 온 요청에는 CORS 허용 헤더를 주지 않는다', async () => {
  const s = await send({ v: 1, kind: 'text' }, enc.encode('cors'));
  const evil = await api(`/api/shares/${s.id}`, { headers: { Origin: 'https://evil.example' } });
  assert.notEqual(evil.headers.get('Access-Control-Allow-Origin'), 'https://evil.example');
  const good = await api(`/api/shares/${s.id}`, { headers: { Origin: WEB_ORIGIN } });
  assert.equal(good.headers.get('Access-Control-Allow-Origin'), WEB_ORIGIN);
  assert.equal(good.headers.get('Cache-Control'), 'no-store');
});

// ---------- [10-7] 마지막: 서버 저장소·로그 전체 검사 ----------

test('[10-7] 서버 로그·D1·R2 어디에도 평문·링크 열쇠·비밀번호·토큰 원문이 없다', async () => {
  // R2 저장 실패를 일부러 일으켜 오류 로그 경로도 거친다 (fixture가 Authorization을 에러 메시지에 넣음)
  const s = await send({ v: 1, kind: 'text' }, enc.encode('log-path'), { maxViews: 3 });
  const failed = await api(`/api/shares/${s.id}/open`, {
    method: 'POST',
    headers: { 'X-Test-R2-Failure': 'get', Authorization: 'Bearer ' + s.manageToken },
  });
  assert.ok(failed.status >= 400);
  const revoke = await api('/api/manage', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + s.manageToken, 'X-Test-R2-Failure': 'delete' },
  });
  assert.ok([204, 500].includes(revoke.status));

  // D1 전체 행을 문자열로
  const { results } = await db.prepare('SELECT * FROM shares').all();
  const d1Text = JSON.stringify(results);

  // R2 남은 객체 전체 (암호문이므로 원문이 보이면 안 된다)
  const listed = await bucket.list();
  const r2Chunks = [];
  for (const o of listed.objects) {
    const body = await bucket.get(o.key);
    r2Chunks.push(Buffer.from(await body.arrayBuffer()).toString('latin1'));
  }
  const r2Text = r2Chunks.join('\n');
  const logText = logs.join('\n');

  assert.ok(secrets.length >= 20, `검사한 비밀 ${secrets.length}개`);
  for (const secret of secrets) {
    const where = [
      d1Text.includes(secret) && 'D1',
      r2Text.includes(secret) && 'R2',
      logText.includes(secret) && 'log',
    ].filter(Boolean);
    assert.deepEqual(where, [], `비밀이 서버에 남음: ${secret.slice(0, 8)}… → ${where}`);
  }
  // 링크 열쇠는 바이트(base64url 디코딩)로도 확인
  for (const secret of secrets.filter((x) => /^[A-Za-z0-9_-]{43}$/.test(x))) {
    const raw = Buffer.from(shared.fromBase64url(secret)).toString('latin1');
    assert.equal(r2Text.includes(raw), false);
  }
});
