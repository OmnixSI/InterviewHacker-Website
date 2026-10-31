// Dependency-free local preview. Production submissions remain in api/waitlist.js;
// this server never imports that handler or sends mail.
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const headers = Object.fromEntries(config.headers.find(rule => rule.source === '/(.*)').headers.map(({ key, value }) => [key, value]));
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

let host = '127.0.0.1', port = 4173;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--') continue;
  if (arg === '--strictPort' || arg === '--strict-port' || arg === '--strictPort=true') continue;
  if (arg === '--host') { host = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : '0.0.0.0'; continue; }
  if (arg.startsWith('--host=')) { host = arg.slice(7); continue; }
  if (arg === '--port') { port = Number(args[++i]); continue; }
  if (arg.startsWith('--port=')) { port = Number(arg.slice(7)); continue; }
  throw new Error(`Unknown preview option: ${arg}`);
}
if (!host || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Preview requires a valid host and port (1–65535).');

function send(req, res, status, type, body, extra = {}) {
  res.writeHead(status, { ...headers, 'Cache-Control': 'no-store', 'Content-Type': type, ...extra });
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://preview.invalid');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/api/waitlist' || pathname === '/api/waitlist/') {
      const json = /json/i.test(req.headers.accept || '') || /json/i.test(req.headers['content-type'] || '');
      if (json) send(req, res, 503, types['.json'], JSON.stringify({ ok: false, error: 'preview', message: 'This preview does not submit or store waitlist requests.' }));
      else send(req, res, 503, types['.html'], '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview only · InterviewHacker</title><body><main><h1>This is a website preview.</h1><p>Your request was not submitted, stored, or emailed. Waitlist submission is available only on the configured production website.</p><p lang="zh-CN">这是网站预览。你的申请没有被提交、保存或发送；等待名单需要正式部署后才能使用。</p><p><a href="/">Return to the gallery / 返回画廊</a></p></main></body></html>');
      req.resume();
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      send(req, res, 405, types['.txt'], 'Method not allowed.', { Allow: 'GET, HEAD' });
      req.resume();
      return;
    }
    const relative = pathname.replace(/^\/+/, '');
    if (relative.includes('\0') || relative.split('/').some(segment => segment.startsWith('.'))) {
      send(req, res, 404, types['.txt'], 'Not found.');
      return;
    }
    let file = path.resolve(root, relative);
    if (file !== root && !file.startsWith(root + path.sep)) {
      send(req, res, 404, types['.txt'], 'Not found.');
      return;
    }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        send(req, res, 308, types['.txt'], 'Redirecting.', { Location: url.pathname + '/' + url.search });
        return;
      }
      file = path.join(file, 'index.html');
      info = await stat(file).catch(() => null);
    } else if (!info && !path.extname(file)) {
      file += '.html';
      info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) {
      send(req, res, 404, types['.txt'], 'Not found.');
      return;
    }
    res.writeHead(200, { ...headers, 'Cache-Control': 'no-store', 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': info.size });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch (error) {
    if (res.headersSent) { res.destroy(); return; }
    send(req, res, error instanceof URIError ? 400 : 500, types['.txt'], error instanceof URIError ? 'Invalid URL.' : 'Preview request failed.');
  }
});

server.on('error', error => { console.error(`Preview could not start: ${error.message}`); process.exitCode = 1; });
server.listen(port, host, () => {
  const displayHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host.includes(':') ? `[${host}]` : host;
  console.log(`InterviewHacker preview ready\nLocal: http://${displayHost}:${port}/\nWaitlist requests are disabled in this preview.`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
