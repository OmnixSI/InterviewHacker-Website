// Copies Story's product scenes into Final, retuned to Final's palette.
// Violet accents become the "me" indigo, cool canvases become warm paper, and SVG filters are
// dropped: blurred drop shadows re-rasterise on every transform and stall Windows compositing.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { root } from './catalog.mjs';

const from = path.join(root, 'public/story/assets/product-scenes');
const to = path.join(root, 'public/final/assets/scenes');
const palette = {
  light: { '#6a5cf0': '#5b5ff0', '#5a4de0': '#4b4fd6', '#7265ed': '#5b5ff0', '#9769ee': '#5b5ff0', '#ece9ff': '#e9eaff',
    '#e9e6f6': '#ece8de', '#eef0f6': '#efede6', '#f4f5fa': '#f7f6f2', '#1f2335': '#16171b' },
  dark: { '#a99cff': '#9fa2ff', '#c4bbff': '#babcff', '#7265ed': '#5b5ff0', '#9769ee': '#5b5ff0', '#35305a': '#2a2c4a',
    '#221d3a': '#1c1d2a', '#151926': '#121316', '#1d2232': '#1a1b20', '#262c3f': '#202127' }
};

await mkdir(to, { recursive: true });
for (const name of (await readdir(from)).filter(n => n.endsWith('.svg'))) {
  const map = palette[name.endsWith('-dark.svg') ? 'dark' : 'light'];
  let svg = await readFile(path.join(from, name), 'utf8');
  for (const [a, b] of Object.entries(map)) svg = svg.replaceAll(new RegExp(a, 'gi'), b);
  svg = svg.replace(/<filter\b[\s\S]*?<\/filter>/g, '').replace(/\sfilter="url\(#[^)]+\)"/g, '');
  await writeFile(path.join(to, name), svg);
}
console.log('Final scenes written');
