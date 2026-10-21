import { cp, mkdir, rm, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
await rm(new URL('dist', root), { recursive: true, force: true });
await mkdir(new URL('dist', root), { recursive: true });
await cp(new URL('public', root), new URL('dist', root), { recursive: true });
async function inventory(dir) {
  let bytes = 0, files = 0;
  for (const name of await readdir(dir)) {
    const p = path.join(dir, name), s = await stat(p);
    if (s.isDirectory()) { const child = await inventory(p); bytes += child.bytes; files += child.files; }
    else { bytes += s.size; files++; }
  }
  return { bytes, files };
}
console.log('Static production build:', await inventory(fileURLToPath(new URL('dist', root))));
