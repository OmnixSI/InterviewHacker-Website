// Fills the day part template: hairline numerals (Instrument Serif outlines) and the static 14:00 diagram.
// Run: node scripts/turn-day/build-part.mjs (then npm run turn:build). Edit copy in day.tpl.html, not the generated part.
import { readFileSync, writeFileSync } from 'node:fs';
import { numeral } from './gen-numerals.mjs';
import { duoPaths } from './duo.mjs';
const dir = new URL('.', import.meta.url);
let s = readFileSync(new URL('day.tpl.html', dir), 'utf8');
s = s.replace(/<!--NUM:([0-9:]+)-->/g, (_, t) => numeral(t));
const [a, b] = duoPaths(0.5);
s = s.replace('__DUO_A__', a).replace('__DUO_B__', b);
writeFileSync(new URL('../turn-i18n/parts/day.html', dir), s);
console.log('part written', s.length);
