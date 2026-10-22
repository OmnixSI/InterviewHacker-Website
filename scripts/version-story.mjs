import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { root } from './catalog.mjs';

// Changing cache headers cannot expire an older immutable response already in a browser.
// Stamp every entry point so a release always requests its matching CSS and JavaScript.
for (const slug of ['story', 'classic']) {
  const base = path.join(root, 'public', slug);
  const file = path.join(base, 'index.html');
  let html = await readFile(file, 'utf8');
  for (const match of [...html.matchAll(/(?:href|src)="(\.\/[^"?#]+\.(?:css|js))(?:\?[^"#]*)?"/g)]) {
    const bytes = await readFile(path.join(base, match[1]));
    const version = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    html = html.replace(match[0], match[0].replace(/=".*"/, `="${match[1]}?v=${version}"`));
  }
  await writeFile(file, html);
}
