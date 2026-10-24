// Early-access sign-ups from the Final page. Each one is sent as an email through the maintainer's own SMTP
// mailbox (QQ Mail by default) to the maintainer. No database, no third-party form service, no npm packages.
//
// Environment (set in the Vercel project, never committed):
//   SMTP_USER    the mailbox that sends, e.g. the maintainer's QQ address
//   SMTP_PASS    that mailbox's SMTP authorization code (QQ Mail → Settings → Account → SMTP)
//   WAITLIST_TO  where sign-ups go (defaults to SMTP_USER)
//   SMTP_HOST / SMTP_PORT  default smtp.qq.com / 465 (implicit TLS)
import tls from 'node:tls';

export const USES = {
  interview: '求职面试 · Job interviews',
  talk: '组会 / 学术报告 · Lab meetings & talks',
  meeting: '商务会议 / 谈判 · Business meetings',
  class: '网课 / 课程 · Classes',
  other: '其他 · Other'
};

const EMAIL = /^[^\s@<>()",;:]{1,64}@[^\s@<>()",;:]{1,190}\.[a-z]{2,24}$/i;
const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);

// Returns { data } or { error } — the error is a short key the page turns into a sentence.
export function validate(input) {
  if (clean(input.website, 200)) return { error: 'spam' }; // honeypot: people never see this field
  const email = clean(input.email, 254), name = clean(input.name, 60).replace(/[\r\n]+/g, ' ');
  if (!EMAIL.test(email)) return { error: 'email' };
  if (!name) return { error: 'name' };
  const picked = [].concat(input.uses ?? []).flatMap(v => String(v).split(',')).map(v => v.trim()).filter(v => v in USES);
  const uses = [...new Set(picked)];
  const more = clean(input.more, 1000);
  if (!uses.length && !more) return { error: 'uses' };
  const lang = input.lang === 'en' ? 'en' : 'zh';
  return { data: { email, name, uses, more, lang } };
}

export function compose({ email, name, uses, more, lang }, { from, to, now = new Date() }) {
  const b64 = s => Buffer.from(s, 'utf8').toString('base64');
  const body = [
    'InterviewHacker 早期试用申请 / Early-access request',
    '',
    `称呼 Name: ${name}`,
    `邮箱 Email: ${email}`,
    `用途 Uses: ${uses.map(k => USES[k]).join('；') || '—'}`,
    `补充 More: ${more || '—'}`,
    '',
    `页面语言 Page language: ${lang}`,
    `时间 Time: ${now.toISOString()}`
  ].join('\r\n');
  const headers = [
    `From: =?UTF-8?B?${b64('InterviewHacker 网站')}?= <${from}>`,
    `To: <${to}>`,
    `Reply-To: <${email}>`,
    `Subject: =?UTF-8?B?${b64(`试用申请：${name}`)}?=`,
    `Date: ${now.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${now.getTime().toString(36)}.${Math.random().toString(36).slice(2)}@interviewhacker.vercel.app>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64'
  ];
  return `${headers.join('\r\n')}\r\n\r\n${b64(body).replace(/.{1,76}/g, '$&\r\n')}`;
}

// A minimal SMTP client over implicit TLS: greeting, EHLO, AUTH LOGIN, one message, QUIT.
export function sendMail({ host, port, user, pass, from, to, message }, connect = tls.connect) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port, servername: host });
    let buffer = '', waiting = null;
    const fail = error => { socket.destroy(); reject(error); };
    socket.setEncoding('utf8');
    socket.setTimeout(15000, () => fail(new Error('SMTP timeout')));
    socket.on('error', fail);
    socket.on('data', chunk => {
      buffer += chunk;
      // A reply is complete when its last line is "NNN text" (a dash after the code means more lines follow).
      const lines = buffer.split('\r\n');
      const done = lines.slice(0, -1).findLast(line => /^\d{3}(?: |$)/.test(line));
      if (!done || !waiting) return;
      buffer = '';
      const take = waiting; waiting = null;
      take(Number(done.slice(0, 3)), done);
    });
    const step = (command, expect) => new Promise((ok, no) => {
      waiting = (code, line) => (expect.includes(code) ? ok(code) : no(new Error(`SMTP ${code}: ${line}`)));
      if (command !== null) socket.write(`${command}\r\n`);
    });
    (async () => {
      await step(null, [220]);
      await step('EHLO interviewhacker.vercel.app', [250]);
      await step('AUTH LOGIN', [334]);
      await step(Buffer.from(user).toString('base64'), [334]);
      await step(Buffer.from(pass).toString('base64'), [235]);
      await step(`MAIL FROM:<${from}>`, [250]);
      await step(`RCPT TO:<${to}>`, [250, 251]);
      await step('DATA', [354]);
      await step(`${message.replace(/\r\n\./g, '\r\n..')}\r\n.`, [250]);
      socket.end('QUIT\r\n');
      resolve();
    })().catch(fail);
  });
}

// A few sign-ups per address per ten minutes, per warm instance — enough to stop a stuck button or a casual flood.
const recent = new Map();
function limited(ip) {
  const now = Date.now(), list = (recent.get(ip) || []).filter(t => now - t < 600000);
  list.push(now);
  recent.set(ip, list);
  return list.length > 5;
}

// One sign-up, whatever the platform: { status, error }. env holds SMTP_* (process.env on Vercel, context.env on EdgeOne).
export async function submit(input, env, ip = 'unknown') {
  if (limited(ip)) return { status: 429, error: 'busy' };
  const { data, error } = validate(input);
  if (error === 'spam') return { status: 200 }; // quietly accept bots
  if (error) return { status: 400, error };
  // Values pasted into the dashboard often carry a stray space or newline.
  const user = (env.SMTP_USER || '').trim(), pass = (env.SMTP_PASS || '').replace(/\s+/g, '');
  if (!user || !pass) return { status: 503, error: 'offline' };
  const to = env.WAITLIST_TO || user;
  try {
    await sendMail({ host: env.SMTP_HOST || 'smtp.qq.com', port: Number(env.SMTP_PORT || 465), user, pass, from: user, to, message: compose(data, { from: user, to }) });
    return { status: 200 };
  } catch (e) {
    // The shape of the code (never the code) tells a wrong value from a refused login.
    console.error(`waitlist mail failed: ${e.message} (user ${/^[^@\s]+@[^@\s]+$/.test(user) ? 'ok' : 'malformed'}, code ${pass.length} chars${/^[a-z]+$/i.test(pass) ? ', letters only' : ''})`);
    return { status: 502, error: 'mail' };
  }
}

// A url-encoded form body as an object; repeated keys (the use checkboxes) become arrays.
export function formFields(raw) {
  const form = new URLSearchParams(raw), out = {};
  for (const key of new Set(form.keys())) { const all = form.getAll(key); out[key] = all.length > 1 ? all : all[0]; }
  return out;
}

// JSON for the script, or — after a script-free post — back to the ending with the outcome in the hash.
export function outcome({ status, error }, { json, referer }) {
  if (json) return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(status < 300 ? { ok: true } : { ok: false, error }) };
  const back = (referer || '/final/').split('#')[0];
  return { status: 303, headers: { Location: `${back}#waitlist-${status < 300 ? 'ok' : error}` }, body: '' };
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!raw) for await (const chunk of req) { raw += chunk; if (raw.length > 20000) break; }
  if (/json/.test(req.headers['content-type'] || '')) { try { return JSON.parse(raw); } catch { return {}; } }
  return formFields(raw);
}

// Vercel entry.
export default async function handler(req, res) {
  const json = /json/.test(req.headers.accept || '') || /json/.test(req.headers['content-type'] || '');
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const result = req.method === 'POST' ? await submit(await readBody(req), process.env, ip) : { status: 405, error: 'method' };
  if (result.status === 405) res.setHeader('Allow', 'POST');
  const out = outcome(result, { json, referer: req.headers.referer });
  res.statusCode = out.status;
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
  res.end(out.body);
}
