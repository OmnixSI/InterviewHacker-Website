import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.argv[2] || 'https://interviewhacker.vercel.app';
const inventory = [];
async function walk(dir) {
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.name !== 'vercel.json') inventory.push(path.relative(path.join(root,'dist'),file));
  }
}
await walk(path.join(root,'dist'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const results = await Promise.all(inventory.map(async file => {
  const response = await fetch(`${base}/${file.replace(/(^|\/)index\.html$/, '$1')}`);
  const actual = Buffer.from(await response.arrayBuffer());
  const expected = await readFile(path.join(root,'dist',file));
  if (!response.ok || digest(actual)!==digest(expected)) throw new Error(`Published file mismatch: ${file} ${response.status}`);
  return {file,status:response.status,bytes:actual.length,sha256:digest(actual)};
}));
const head = await fetch(base, {method:'HEAD'});
for (const header of ['content-security-policy','permissions-policy','x-content-type-options','referrer-policy']) if(!head.headers.has(header)) throw new Error(`Missing ${header}`);
if (!head.headers.get('content-security-policy').includes("frame-ancestors 'self'")) throw new Error('Same-origin comparison framing is not enabled');
const result={url:base,checkedAt:new Date().toISOString(),files:results,headers:Object.fromEntries(head.headers)};
await mkdir(path.join(root,'validation'),{recursive:true});
await writeFile(path.join(root,'validation','production-check.json'),JSON.stringify(result,null,2)+'\n');
console.log(`Verified ${results.length} public files: HTTP 200, exact SHA-256 matches, required headers present.`);
