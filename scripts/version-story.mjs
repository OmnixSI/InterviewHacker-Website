import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { root } from './catalog.mjs';

// Changing cache headers cannot expire an older immutable response already in a browser.
// Stamp entry points and Classic artwork so cached resources match each release.
for (const slug of ['story', 'classic']) {
  const base = path.join(root, 'public', slug);
  const file = path.join(base, 'index.html');
  let html = await readFile(file, 'utf8');
  const pattern = slug === 'classic'
    ? /(?:href|src|data-ih-light|data-ih-dark)="(\.\/[^"?#]+\.(?:css|js|svg))(?:\?[^"#]*)?(#[^"]*)?"/g
    : /(?:href|src)="(\.\/[^"?#]+\.(?:css|js))(?:\?[^"#]*)?(#[^"]*)?"/g;
  for (const match of [...html.matchAll(pattern)]) {
    const bytes = await readFile(path.join(base, match[1]));
    const version = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    html = html.replace(match[0], match[0].replace(/=".*"/, `="${match[1]}?v=${version}${match[2] || ''}"`));
  }
  await writeFile(file, html);
}
