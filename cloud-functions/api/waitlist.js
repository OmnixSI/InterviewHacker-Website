// EdgeOne Pages entry for the early-access waitlist (/api/waitlist). The checks and the mail client are shared with
// the Vercel function in /api; settings come from the project's environment variables (SMTP_USER, SMTP_PASS, ...).
import { submit, formFields, outcome } from '../../api/waitlist.js';

export async function onRequestPost({ request, env, clientIp }) {
  const type = request.headers.get('content-type') || '';
  const raw = (await request.text()).slice(0, 20000);
  let input = {};
  if (/json/.test(type)) { try { input = JSON.parse(raw); } catch { input = {}; } } else input = formFields(raw);
  const json = /json/.test(request.headers.get('accept') || '') || /json/.test(type);
  const ip = clientIp || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const out = outcome(await submit(input, { ...process.env, ...env }, ip), { json, referer: request.headers.get('referer') });
  return new Response(out.body || null, { status: out.status, headers: out.headers });
}
