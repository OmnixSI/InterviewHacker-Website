// Validation, composition, response and preview-handler tests. Never opens an SMTP connection.
import assert from 'node:assert/strict';
import test from 'node:test';
import tls from 'node:tls';
import handler, { validate, compose, formFields, outcome } from '../api/waitlist.js';

const email = 'reader+early@example.com';

test('an email alone is sufficient; optional answers remain honestly empty', () => {
  assert.deepEqual(validate({ email: `  ${email}  `, source: 'signature' }), {
    data: { email, name: '', uses: [], more: '', lang: 'zh', source: 'signature' }
  });
  assert.equal(validate({ email, lang: 'en', source: 'signature-en' }).data.source, 'signature-en');
  assert.equal(validate({ email, lang: 'en' }).data.lang, 'en');
});

test('existing Final and Turn submissions keep their optional answers', () => {
  const legacy = { email, name: '  Lin\r\nChen  ', uses: ['meeting', 'interview, meeting', 'other'], more: '  A product review.\u0000  ', lang: 'en' };
  assert.deepEqual(validate(legacy), {
    data: { email, name: 'Lin Chen', uses: ['meeting', 'interview', 'other'], more: 'A product review.', lang: 'en', source: 'unspecified' }
  });
  const form = formFields(`email=${encodeURIComponent(email)}&name=Lin&uses=talk&uses=class&lang=zh`);
  assert.deepEqual(validate(form).data.uses, ['talk', 'class']);
  assert.equal(validate({ email, more: 'Only this optional answer.' }).data.more, 'Only this optional answer.');
});

test('optional inputs are bounded and recognized options use own keys only', () => {
  const { data } = validate({ email, name: 'a'.repeat(100), more: 'b'.repeat(1200), uses: ['constructor', '__proto__', 'toString', 'talk', 'not-a-use', 'talk'] });
  assert.equal(data.name.length, 60);
  assert.equal(data.more.length, 1000);
  assert.deepEqual(data.uses, ['talk']);
  assert.equal(validate({ email, lang: 'fr' }).data.lang, 'zh');
});

test('invalid email, malformed payloads and the honeypot retain rejection behavior', () => {
  for (const value of ['', 'reader', 'reader@example', 'reader @example.com', 'reader@example.com\r\nBcc: other@example.com', 'a'.repeat(65) + '@example.com', 'a'.repeat(254) + '@example.com']) {
    assert.deepEqual(validate({ email: value }), { error: 'email' });
  }
  for (const value of [null, undefined, 'email=reader@example.com', []]) assert.deepEqual(validate(value), { error: 'email' });
  assert.deepEqual(validate({ email, website: 'https://bot.example/' }), { error: 'spam' });
  assert.ok(validate({ email, website: '  ' }).data);
});

test('source attribution admits only recognized page identifiers', () => {
  for (const source of ['final', 'final-en', 'turn', 'turn-en', 'signature', 'signature-en']) {
    assert.equal(validate({ email, source }).data.source, source);
  }
  for (const source of ['https://example.com', 'signature\r\nBcc: person@example.com', 'constructor', ['signature'], undefined]) {
    assert.equal(validate({ email, source }).data.source, 'unspecified');
  }
});

test('composition includes empty optional answers and safe source attribution', () => {
  const now = new Date('2026-10-31T00:00:00.000Z');
  const message = compose(validate({ email, source: 'signature-en', lang: 'en' }).data, { from: 'sender@example.com', to: 'owner@example.com', now });
  const [headers, encoded] = message.split('\r\n\r\n');
  const body = Buffer.from(encoded, 'base64').toString('utf8');
  const subject = Buffer.from(headers.match(/Subject: =\?UTF-8\?B\?([^?]+)\?=/)[1], 'base64').toString('utf8');
  assert.match(headers, /Reply-To: <reader\+early@example\.com>/);
  assert.equal(subject, '试用申请：未填写');
  assert.ok(body.includes('称呼 Name: 未填写'));
  assert.ok(body.includes('用途 Uses: —'));
  assert.ok(body.includes('补充 More: —'));
  assert.ok(body.includes('来源 Source: signature-en'));
  assert.ok(body.includes('时间 Time: 2026-10-31T00:00:00.000Z'));

  const existing = compose(validate({ email, name: 'Lin', uses: ['talk'], more: 'Details', source: 'turn' }).data, { from: 'sender@example.com', to: 'owner@example.com', now });
  const existingBody = Buffer.from(existing.split('\r\n\r\n')[1], 'base64').toString('utf8');
  assert.ok(existingBody.includes('称呼 Name: Lin'));
  assert.ok(existingBody.includes('用途 Uses: 组会 / 学术报告 · Lab meetings & talks'));
  assert.ok(existingBody.includes('补充 More: Details'));
  assert.ok(existingBody.includes('来源 Source: turn'));
});

test('JSON status distinguishes accepted submissions from server failures', () => {
  const accepted = outcome({ status: 200 }, { json: true, referer: 'https://untrusted.example/' });
  assert.equal(accepted.status, 200);
  assert.deepEqual(JSON.parse(accepted.body), { ok: true });
  assert.equal(accepted.headers['Cache-Control'], 'no-store');
  const offline = outcome({ status: 503, error: 'offline' }, { json: true });
  assert.equal(offline.status, 503);
  assert.deepEqual(JSON.parse(offline.body), { ok: false, error: 'offline' });
});

test('script-free responses preserve known routes with safe error fragments', () => {
  for (const path of ['/final/', '/final/en/', '/turn/', '/turn/en/', '/signature/', '/signature/en/']) {
    const result = outcome({ status: 502, error: 'mail' }, { json: false, referer: `https://preview.example${path}?campaign=launch#join` });
    assert.equal(result.status, 303);
    assert.equal(result.headers.Location, `${path}#waitlist-mail`);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.equal(result.body, '');
    assert.equal(outcome({ status: 200 }, { json: false, referer: path }).headers.Location, `${path}#waitlist-ok`);
  }
});

test('script-free responses never redirect to a referrer origin or arbitrary path', () => {
  const badReferers = [undefined, 'https://attacker.example/phishing', '//attacker.example/phishing', '/compare/', '/signature/extra/', 'javascript:/signature/', 'data:text/html,anything', 'https://[', '/signature/%2f%2fattacker.example'];
  for (const referer of badReferers) {
    assert.equal(outcome({ status: 503, error: 'offline' }, { json: false, referer }).headers.Location, '/final/#waitlist-offline');
  }
  assert.equal(outcome({ status: 200 }, { json: false, referer: 'https://attacker.example/signature/?redirect=https://attacker.example#anything' }).headers.Location, '/signature/#waitlist-ok');
  assert.equal(outcome({ status: 500, error: 'mail\r\nLocation: https://attacker.example' }, { json: false, referer: '/signature/en/' }).headers.Location, '/signature/en/#waitlist-offline');
});

test('the real preview handler rejects valid submissions before SMTP for JSON and native forms', async t => {
  const replacement = { VERCEL_ENV: 'preview', SMTP_USER: 'preview-test@example.com', SMTP_PASS: 'previewtestnotacredential' };
  const previous = Object.fromEntries(Object.keys(replacement).map(key => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  Object.assign(process.env, replacement);
  // Fake configured credentials make this test exercise the preview guard, rather
  // than passing merely because SMTP settings are absent. The mock prevents all I/O
  // even if the guard regresses; its call count must remain zero.
  const connect = t.mock.method(tls, 'connect', () => { throw new Error('SMTP must not run in a preview'); });
  const response = () => ({
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key] = value; },
    end(body) { this.body = body; }
  });

  const json = response();
  await handler({
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.10' },
    body: { email, source: 'signature' }
  }, json);
  assert.equal(json.statusCode, 503);
  assert.deepEqual(JSON.parse(json.body), { ok: false, error: 'preview' });
  assert.equal(json.headers['Cache-Control'], 'no-store');

  const native = response();
  await handler({
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', referer: 'https://preview.example/signature/en/?campaign=review#join', 'x-forwarded-for': '192.0.2.11' },
    body: `email=${encodeURIComponent(email)}&source=signature-en&lang=en`
  }, native);
  assert.equal(native.statusCode, 303);
  assert.equal(native.headers.Location, '/signature/en/#waitlist-preview');
  assert.equal(native.headers['Cache-Control'], 'no-store');
  assert.equal(native.body, '');
  assert.equal(connect.mock.callCount(), 0, 'Preview requests must not attempt any SMTP connection');
});
