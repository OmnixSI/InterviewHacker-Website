// Lays out Instrument Serif outlines for the day's times as hairline SVG (one <path> per contour, for DrawSVG).
import { readFileSync, writeFileSync } from 'node:fs';
const G = JSON.parse(readFileSync(new URL('./glyphs.json', import.meta.url)));
// Optical gaps between ink edges (font units, cap height ≈ 730).
const GAP = { d: 30, colon: 44 };
const shift = (d, dx) => d.replace(/([MLQCZ])([^MLQCZ]*)/g, (_, op, args) => {
  if (op === 'Z') return 'Z';
  const n = args.trim().split(/[\s,]+/).map(Number);
  for (let i = 0; i < n.length; i += 2) n[i] = Math.round((n[i] + dx) * 10) / 10;
  return op + n.join(' ');
});
export function numeral(time) {
  let x = 0, prev = null, out = [];
  for (const ch of time) {
    const g = G[ch];
    const [l, , r] = g.bounds;
    let dx;
    if (!prev) dx = -l;
    else {
      const gap = ch === ':' || prev.ch === ':' ? GAP.colon : GAP.d;
      dx = prev.right + gap - l;
    }
    out.push(`<g data-ch="${ch === ':' ? 'colon' : ch}">${g.paths.map(p => `<path d="${shift(p, dx)}"/>`).join('')}</g>`);
    prev = { ch, right: r + dx };
  }
  const w = Math.ceil(prev.right);
  return `<svg class="scene__numeral" viewBox="0 -740 ${w} 752" style="--ar:${(w / 752).toFixed(4)}" aria-hidden="true" focusable="false">${out.join('')}</svg>`;
}
if (import.meta.url === `file://${process.argv[1]}`) {
const res = {};
for (const t of ['09:30', '11:00', '14:00', '16:30']) res[t] = numeral(t);
writeFileSync(new URL('./numerals.json', import.meta.url), JSON.stringify(res, null, 1));
for (const [t, s] of Object.entries(res)) console.log(t, s.length, s.match(/viewBox="[^"]+"/)[0]);
}
