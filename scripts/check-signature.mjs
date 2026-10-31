// Dependency-free checks for the generated, bilingual Signature pages.
// These validate deliverables and content contracts, not browser layout or SMTP delivery.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { root, publicRoot, loadCatalog } from './catalog.mjs';

const origin = new URL((await loadCatalog()).origin).origin;
const site = path.join(publicRoot, 'signature');
const source = path.join(root, 'scripts/signature-i18n');
const locales = [
  { key: 'zh', html: 'zh-CN', file: 'index.html', route: '/signature/', source: 'signature' },
  { key: 'en', html: 'en', file: 'en/index.html', route: '/signature/en/', source: 'signature-en' }
];
const scenarios = ['interview', 'meeting', 'research'];
const answerVariants = ['base', 'english', 'example', 'short'];
const stageNames = ['after', 'before', 'live'];
const sourceData = JSON.parse(await readFile(path.join(source, 'demo.json'), 'utf8'));
const textCache = new Map(), inspectedCss = new Set(), assets = new Set();
const missingReferences = [];
let characterSource = '';

async function text(file) {
  if (!textCache.has(file)) textCache.set(file, await readFile(file, 'utf8'));
  return textCache.get(file);
}

function decode(value) {
  return value.replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => {
    const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
    return point <= 0x10ffff ? String.fromCodePoint(point) : '\ufffd';
  }).replace(/&(amp|quot|apos|lt|gt|nbsp);/g, (_, name) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' })[name]);
}

function tags(html) {
  const result = [];
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const match of withoutComments.matchAll(/<([a-z][\w:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)) {
    const attrs = Object.create(null);
    for (const attr of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const name = attr[1].toLowerCase();
      assert(!Object.hasOwn(attrs, name), `Duplicate ${name} attribute in <${match[1]}>`);
      attrs[name] = decode(attr[2] ?? attr[3] ?? attr[4] ?? '');
    }
    result.push({ tag: match[1].toLowerCase(), attrs });
  }
  return result;
}

function fileUrl(file) {
  return new URL('/' + path.relative(publicRoot, file).split(path.sep).join('/'), origin);
}

async function inspectReference(ref, from, { asset = false, hash = false, document = from } = {}) {
  const url = new URL(decode(ref), fileUrl(ref.startsWith('#') ? document : from));
  if (/^(mailto:|tel:)$/.test(url.protocol)) {
    assert(!asset, `Asset cannot use ${url.protocol}: ${ref}`);
    return;
  }
  if (url.protocol === 'data:') {
    assert(asset && /^data:image\//i.test(ref), `Only inline image data is allowed: ${ref.slice(0, 80)}`);
    return;
  }
  assert(['https:', 'http:'].includes(url.protocol), `Unsupported URL protocol: ${ref}`);
  if (url.origin !== origin) {
    assert(!asset, `External runtime asset is not allowed: ${ref}`);
    return; // External navigation is not fetched by this static check.
  }
  const pathname = decodeURIComponent(url.pathname);
  let target = path.resolve(publicRoot, '.' + pathname);
  assert(target === publicRoot || target.startsWith(publicRoot + path.sep), `Reference leaves public/: ${ref}`);
  let info;
  try { info = await stat(target); } catch {
    missingReferences.push(`Missing reference ${ref} from ${path.relative(root, from)}`);
    return;
  }
  if (info.isDirectory()) {
    target = path.join(target, 'index.html');
    try { info = await stat(target); } catch {
      missingReferences.push(`Directory has no index.html: ${ref}`);
      return;
    }
  }
  assert(info.isFile() && info.size > 0, `Empty or invalid reference: ${ref}`);
  if (asset) assets.add(target);
  if (hash || /\.(?:css|js)$/i.test(url.pathname)) {
    const actual = createHash('sha256').update(await readFile(target)).digest('hex').slice(0, 12);
    assert.equal(url.searchParams.get('v'), actual, `Stale or missing content hash for ${ref}; run npm run signature:build`);
  }
  if (url.hash) {
    const id = decodeURIComponent(url.hash.slice(1));
    const ids = new Set(tags(await text(target)).map(el => el.attrs.id).filter(Boolean));
    assert(ids.has(id), `Missing anchor #${id} in ${path.relative(root, target)}`);
  }
  if (asset && /\.css$/i.test(target)) await inspectCss(target, document);
}

async function inspectCss(file, document) {
  if (inspectedCss.has(file)) return;
  inspectedCss.add(file);
  const css = (await text(file)).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of css.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/gi)) {
    await inspectReference(match[1] ?? match[2] ?? match[3], file, { asset: true, document });
  }
  for (const match of css.matchAll(/@import\s+(?:"([^"]+)"|'([^']+)')/gi)) {
    await inspectReference(match[1] ?? match[2], file, { asset: true, hash: true, document });
  }
}

function nonempty(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `Missing text: ${label}`);
}

for (const locale of locales) {
  const file = path.join(site, locale.file), html = await text(file), elements = tags(html);
  const label = `Signature ${locale.key}`;
  assert(!html.includes('{{') && !/\}\}/.test(html.replace(/<script\b[\s\S]*?<\/script>/gi, '')), `${label}: unresolved template marker`);
  assert.equal(elements.filter(el => el.tag === 'h1').length, 1, `${label}: expected exactly one h1`);
  assert.equal(elements.find(el => el.tag === 'html')?.attrs.lang, locale.html, `${label}: document language`);
  const ids = elements.map(el => el.attrs.id).filter(Boolean), idSet = new Set(ids);
  assert.equal(ids.length, idSet.size, `${label}: duplicate IDs`);
  const links = elements.filter(el => el.tag === 'link');
  const canonical = links.filter(el => el.attrs.rel === 'canonical');
  assert.equal(canonical.length, 1, `${label}: expected one canonical`);
  assert.equal(canonical[0].attrs.href, origin + locale.route, `${label}: incorrect canonical`);
  const alternates = links.filter(el => el.attrs.rel === 'alternate' && el.attrs.hreflang);
  assert.equal(alternates.length, 3, `${label}: expected three language alternatives`);
  for (const [lang, route] of [['zh-CN', '/signature/'], ['en', '/signature/en/'], ['x-default', '/signature/en/']]) {
    assert.equal(alternates.find(el => el.attrs.hreflang === lang)?.attrs.href, origin + route, `${label}: missing ${lang} alternative`);
  }

  for (const el of elements) {
    const a = el.attrs;
    for (const name of ['aria-controls', 'aria-labelledby', 'aria-describedby']) {
      for (const id of (a[name] || '').split(/\s+/).filter(Boolean)) assert(idSet.has(id), `${label}: ${name} points to missing #${id}`);
    }
    if (el.tag === 'a') {
      assert(!Object.hasOwn(a, 'download'), `${label}: early access must not advertise a download`);
      assert(!/\/releases(?:\/|$)|\.(?:dmg|exe|msi|pkg|zip|appimage)(?:[?#]|$)/i.test(a.href || ''), `${label}: release/download link is not supported`);
    }
    if (el.tag === 'script' && a.src) assert.equal(new URL(a.src, fileUrl(file)).origin, origin, `${label}: scripts must be local`);
    if (a.src) await inspectReference(a.src, file, { asset: true });
    if (a.poster) await inspectReference(a.poster, file, { asset: true });
    if (a.srcset) for (const candidate of a.srcset.split(',')) await inspectReference(candidate.trim().split(/\s+/)[0], file, { asset: true });
    if (a.href) {
      const resource = el.tag !== 'a' && (el.tag !== 'link' || !['canonical', 'alternate'].includes(a.rel));
      await inspectReference(a.href, file, { asset: resource });
    }
    if (el.tag === 'meta' && ['og:image', 'twitter:image'].includes(a.property || a.name)) {
      await inspectReference(a.content, file, { asset: true });
    }
  }
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = tags(`<script ${script[1]}>`)[0].attrs;
    assert(attrs.src || !script[2].trim() || /^application\/(?:ld\+)?json$/.test(attrs.type), `${label}: inline executable script violates the deployment CSP`);
  }

  const forms = [...html.matchAll(/<form\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/form>/gi)];
  assert.equal(forms.length, 1, `${label}: expected one waitlist form`);
  const form = tags(`<form ${forms[0][1]}>`)[0].attrs;
  assert.equal(form.action, '/api/waitlist', `${label}: incorrect form endpoint`);
  assert.equal(form.method?.toLowerCase(), 'post', `${label}: form must POST`);
  const fields = tags(forms[0][2]);
  const field = name => {
    const matches = fields.filter(el => ['input', 'select', 'textarea'].includes(el.tag) && el.attrs.name === name);
    assert.equal(matches.length, 1, `${label}: expected one ${name} field`);
    return matches[0].attrs;
  };
  assert.equal(field('email').type, 'email', `${label}: email input type`);
  assert(Object.hasOwn(field('email'), 'required'), `${label}: email is required`);
  assert(!Object.hasOwn(field('name'), 'required') && !field('name').value, `${label}: name must be optional without a fake default`);
  assert(!Object.hasOwn(field('uses'), 'required'), `${label}: use case must be optional`);
  assert.equal(field('website').tabindex, '-1', `${label}: honeypot must be outside the tab order`);
  assert.equal(field('website').type, 'text', `${label}: preserve the honeypot`);
  assert(fields.some(el => (el.attrs.class || '').split(/\s+/).includes('honeypot') && el.attrs['aria-hidden'] === 'true'), `${label}: honeypot must be hidden from assistive technology`);
  assert.equal(field('source').type, 'hidden', `${label}: attribution field type`);
  assert.equal(field('source').value, locale.source, `${label}: attribution is not localized correctly`);
  assert.equal(field('lang').value, locale.key, `${label}: submission language`);
  for (const result of ['ok', 'email', 'busy', 'offline', 'mail', 'preview']) assert(idSet.has(`waitlist-${result}`), `${label}: missing script-free ${result} feedback`);

  const dataBlocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(match => tags(`<script ${match[1]}>`)[0].attrs.id === 'signature-data');
  assert.equal(dataBlocks.length, 1, `${label}: expected one scenario data block`);
  assert.equal(tags(`<script ${dataBlocks[0][1]}>`)[0].attrs.type, 'application/json', `${label}: scenario data must be inert JSON`);
  const data = JSON.parse(dataBlocks[0][2]);
  assert.deepEqual(data, sourceData[locale.key], `${label}: scenario data is stale; run npm run signature:build`);
  assert.deepEqual(Object.keys(data.scenarios).sort(), scenarios, `${label}: expected all three scenarios`);
  for (const [key, scenario] of Object.entries(data.scenarios)) {
    for (const name of ['title', 'type', 'document', 'insight', 'lead', 'question', 'source', 'decision', 'action', 'unsure']) nonempty(scenario[name], `${label}/${key}/${name}`);
    assert.deepEqual(Object.keys(scenario.answers).sort(), answerVariants, `${label}/${key}: missing answer variant`);
    for (const [variant, paragraphs] of Object.entries(scenario.answers)) {
      assert(Array.isArray(paragraphs) && paragraphs.length > 0, `${label}/${key}/${variant}: expected answer paragraphs`);
      paragraphs.forEach((paragraph, i) => nonempty(paragraph, `${label}/${key}/${variant}/${i}`));
    }
  }
  for (const key of ['illustrative', 'quietOn', 'quietOff', 'companionOn', 'companionOff', 'scenarioChanged', 'answerChanged', 'sourceReturned']) nonempty(data.strings[key], `${label}/strings/${key}`);
  assert.deepEqual(Object.keys(data.strings.stages).sort(), stageNames, `${label}: stage labels are incomplete`);
  assert.deepEqual(elements.filter(el => el.attrs['data-scenario']).map(el => el.attrs['data-scenario']).sort(), scenarios, `${label}: scene controls do not match scenario data`);
  assert.deepEqual(elements.filter(el => el.attrs['data-rewrite']).map(el => el.attrs['data-rewrite']).sort(), answerVariants, `${label}: rewrite controls do not match answer variants`);

  const copy = decode(html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<svg\b[\s\S]*?<\/svg>|<!--[\s\S]*?-->/gi, '').replace(/<[^>]+>/g, ' '));
  assert(!/(?:\b\d+(?:\.\d+)?\s*(?:ms|milliseconds?)\b|\d+(?:\.\d+)?\s*毫秒)/i.test(copy), `${label}: unverified latency claim`);
  assert(!/(?:准确率|accuracy|success\s*rate|成功率)[^.!?\n]{0,30}\d+(?:\.\d+)?\s*%/i.test(copy), `${label}: unverified performance percentage`);
  assert(!/(?:无法被检测|绝对隐身|百分之百准确|100\s*%\s*(?:accurate|undetectable))/i.test(copy), `${label}: unsupported guarantee`);
  characterSource += html + '\n';
}

// Include inert JSON and dynamic JS text: either locale can reveal the other language.
// This intentionally checks all CJK, rather than hiding missing glyphs by stripping scripts.
for (const name of await readdir(path.join(site, 'scripts'))) {
  if (name.endsWith('.js')) characterSource += await text(path.join(site, 'scripts', name));
}
characterSource = decode(characterSource).replace(/\\u\{([\da-f]{1,6})\}|\\u([\da-f]{4})/gi, (_, brace, short) => {
  const point = parseInt(brace || short, 16);
  return point <= 0x10ffff ? String.fromCodePoint(point) : '';
});
const needed = [...new Set(characterSource.match(/\p{Script=Han}/gu) || [])];
const charsets = JSON.parse(await readFile(path.join(site, 'assets/fonts/charset.json'), 'utf8'));
for (const face of ['sans', 'serif']) {
  nonempty(charsets[face], `font charset ${face}`);
  const available = new Set(charsets[face]);
  const missing = needed.filter(char => !available.has(char));
  assert.equal(missing.join(''), '', `Signature ${face} font lacks: ${missing.join('')}; regenerate font subsets and rebuild the pages`);
}

assert.equal(missingReferences.length, 0, missingReferences.join('\n'));
console.log(`Signature checks passed: 2 locales, 3 scenarios × 4 answers, ${assets.size} local assets, ${needed.length} CJK characters in both font subsets.`);
