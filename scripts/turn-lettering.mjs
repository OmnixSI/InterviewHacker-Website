// Turn's hand lettering: a monoline connected script drawn as SVG strokes in pen order.
//
// Each glyph is a skeleton in upright coordinates (y up, baseline 0, x-height 100). A word is built by chaining
// glyph skeletons through their joins, splitting the chain at cusps (where the pen reverses), and passing each run
// through a centripetal Catmull–Rom spline (no overshoot loops on uneven spacing) converted to cubic Béziers.
// A shear gives the slant. Strokes stay in writing order: each word in one stroke, then its t-bars, x-crosses and
// i-dots (as a pen goes back over a word), then the full stop. DrawSVG can reveal them like handwriting.
//
//   letteringSvg({ word, className })  → inline <svg> (aria-hidden) for the page builder
//   letteringData(word)                → { viewBox, baseline, xHeight, strokes: [{ id, d, length }] } for scripts
//   node scripts/turn-lettering.mjs "your turn."          prints the SVG; add --json for the data
const SLANT = Math.tan(13 * Math.PI / 180);
const C = 1; // third item on a point: a cusp (the spline restarts there with a sharp turn)
const PAD = 7; // viewBox padding around the ink, in skeleton units (x-height = 100)
const SPACE = 46; // gap between words
const ASC = 190, DESC = -100; // vertical extent used for data-xheight/--l-h bookkeeping only

// Shared joins. A low exit leaves the last stem at the baseline and rises to the join point; the next glyph's
// `in.low` carries the stroke on up to its first stem. A high exit leaves near the x-height (o, r, w).
const lowOut = (s, k = 1) => [[s, 20], [s + 4 * k, 4], [s + 12 * k, 0], [s + 21 * k, 6], [s + 27 * k, 16]];
const lowEnd = s => [[s, 20], [s + 4, 4], [s + 12, 0], [s + 20, 7], [s + 25, 17]];
const upTo = (x, top = 100) => [[x * .42, 46], [x * .76, 77], [x, top, C]];

const GLYPHS = {
  n: {
    start: [[3, 80], [10, 96]],
    in: { low: [[7, 46], [13, 77]], high: [[9, 98]] },
    body: [[17, 100, C], [16, 58], [16, 0, C], [17, 30], [22, 64], [32, 90], [44, 100], [55, 95], [59, 74], [59, 42]],
    out: lowOut(59), end: lowEnd(59), exit: 'low'
  },
  m: {
    start: [[3, 80], [10, 96]],
    in: { low: [[7, 46], [13, 77]], high: [[9, 98]] },
    body: [[16, 100, C], [15, 58], [15, 0, C], [16, 32], [20, 66], [28, 91], [38, 100], [47, 94], [50, 72], [50, 30], [50, 0, C],
      [51, 34], [55, 67], [63, 91], [73, 100], [83, 94], [86, 72], [86, 42]],
    out: lowOut(86), end: lowEnd(86), exit: 'low'
  },
  u: {
    start: [[3, 80], [10, 96]],
    in: { low: [[7, 46], [13, 77]], high: [[9, 98]] },
    body: [[17, 100, C], [16, 62], [16, 28], [20, 8], [29, 0], [40, 3], [49, 18], [55, 48], [58, 78], [59, 100, C], [58, 62], [58, 42]],
    out: lowOut(58), end: lowEnd(58), exit: 'low'
  },
  i: {
    start: [[4, 74], [10, 94]],
    in: { low: [[6, 46], [11, 77]], high: [[8, 98]] },
    body: [[15, 100, C], [14, 60], [14, 40]],
    out: lowOut(14), end: lowEnd(14), exit: 'low',
    marks: [{ id: 'i-dot', pts: [[15, 146], [18, 152]] }]
  },
  l: {
    start: [[3, 34], [10, 58], [19, 92], [27, 132], [30, 162]],
    in: { low: [[9, 48], [19, 92], [27, 132], [30, 162]] },
    body: [[28, 178], [21, 176], [17, 156], [16, 120], [16, 78], [16, 40]],
    out: lowOut(16), end: lowEnd(16), exit: 'low'
  },
  t: {
    start: [[21, 146]],
    in: { low: [[8, 50], [15, 96], [19, 128]], high: [[11, 112], [17, 132]] },
    body: [[21, 146, C], [19, 100], [18, 52], [18, 40]],
    out: lowOut(18), end: lowEnd(18), exit: 'low',
    marks: [{ id: 't-bar', pts: [[2, 101], [22, 104], [44, 107]] }]
  },
  e: {
    start: [[4, 30], [20, 48]],
    in: { low: [[13, 34], [26, 56]], high: [[8, 76], [20, 66]] },
    body: [[35, 76], [36, 92], [28, 100], [18, 94], [12, 76], [11, 48], [14, 22]],
    out: [[19, 7], [28, 0], [39, 2], [48, 8], [55, 17]], end: [[19, 7], [28, 0], [38, 2], [47, 9], [52, 18]], exit: 'low'
  },
  x: {
    start: [[6, 80], [18, 96]],
    in: { low: [[8, 48], [17, 82]] },
    body: [[27, 98], [36, 100], [43, 90], [44, 64], [42, 36], [42, 22]],
    out: lowOut(42), end: lowEnd(42), exit: 'low',
    marks: [{ id: 'x-cross', pts: [[61, 98], [42, 50], [23, 2]] }]
  },
  o: {
    start: [[42, 96]],
    in: { low: [[5, 42], [10, 72], [19, 94], [31, 101]], high: [[12, 97], [26, 100]] },
    body: [[38, 100, C], [26, 102], [14, 94], [7, 72], [6, 40], [12, 13], [23, 1], [35, 3], [44, 19], [47, 46], [45, 74], [39, 93], [31, 100], [27, 96], [31, 90]],
    out: [[41, 89], [52, 91], [60, 92]], end: [[40, 89], [50, 92]], exit: 'high'
  },
  r: {
    start: [[3, 80], [10, 96]],
    in: { low: [[7, 46], [13, 77]], high: [[9, 98]] },
    body: [[17, 100, C], [16, 58], [16, 0, C], [17, 36], [22, 68], [31, 90], [42, 99], [51, 97]],
    out: [[57, 92], [62, 90]], end: [[50, 97], [55, 91]], exit: 'high'
  },
  w: {
    start: [[3, 80], [10, 96]],
    in: { low: [[7, 46], [13, 77]], high: [[9, 98]] },
    body: [[17, 100, C], [16, 62], [16, 28], [20, 8], [28, 0], [38, 3], [45, 18], [49, 48], [51, 86, C], [50, 50], [51, 22], [55, 7],
      [63, 0], [73, 3], [81, 18], [86, 48], [88, 80], [88, 100], [85, 104], [81, 101], [83, 95]],
    out: [[91, 93], [101, 94]], end: [[90, 93], [97, 95]], exit: 'high'
  },
  d: {
    start: [[42, 96]],
    in: { low: [[5, 42], [10, 72], [19, 94], [31, 101]], high: [[12, 97], [26, 100]] },
    body: [[39, 100, C], [27, 102], [15, 95], [8, 74], [7, 42], [12, 14], [22, 1], [34, 2], [44, 16], [49, 40], [51, 80], [53, 130], [55, 168, C],
      [53, 120], [51, 60], [51, 40]],
    out: lowOut(51), end: lowEnd(51), exit: 'low'
  },
  y: {
    start: [[2, 82], [8, 97]],
    in: { low: [[7, 46], [12, 77]], high: [[8, 98]] },
    body: [[14, 100, C], [13, 64], [13, 30], [17, 10], [26, 1], [37, 2], [46, 14], [52, 40], [55, 72], [56, 100, C], [55, 60], [53, 10],
      [50, -40], [45, -70], [36, -84], [26, -82], [22, -66], [29, -44], [42, -22], [56, -4]],
    out: [[64, 6], [70, 16]], end: [[63, 5], [68, 13]], exit: 'low'
  }
};

// Small deterministic variation so repeated letters are not identical stamps.
function wobble(word, i) {
  let h = 2166136261;
  for (const ch of word + i) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const r = k => (((h >>> k) & 255) / 127.5) - 1;
  return { sx: 1 + r(0) * .035, sy: 1 + r(8) * .012 };
}

function layout(word) {
  const strokes = [];
  let marks = [], run = null, x = 0, prevExit = null, words = 0;
  const flush = () => {
    if (run) strokes.push({ id: `word-${++words}`, pts: run });
    for (const m of marks) strokes.push(m);
    run = null; marks = []; prevExit = null;
  };
  const chars = [...word.toLowerCase()];
  chars.forEach((ch, i) => {
    if (ch === ' ') { flush(); x += SPACE; return; }
    if (ch === '.') { flush(); strokes.push({ id: 'stop', pts: [[x + 11, 2], [x + 14, 7]] }); x += 20; return; }
    const g = GLYPHS[ch];
    if (!g) throw new Error(`turn-lettering: no glyph for "${ch}" in "${word}"`);
    const last = !GLYPHS[chars[i + 1]];
    const { sx, sy } = wobble(word, i);
    const place = ([px, py, c]) => (c ? [x + px * sx, py > 0 ? py * sy : py, C] : [x + px * sx, py > 0 ? py * sy : py]);
    const head = prevExit ? (g.in[prevExit] || g.in.low) : (g.start || []);
    const tail = last ? (g.end || g.out) : g.out;
    const pts = [...head, ...g.body, ...tail].map(place);
    run = run ? run.concat(pts) : pts;
    for (const m of g.marks || []) marks.push({ id: m.id, pts: m.pts.map(place) });
    x += tail[tail.length - 1][0] * sx;
    prevExit = g.exit;
  });
  flush();
  // Unique ids in writing order (a word can have two t-bars).
  const seen = {};
  for (const s of strokes) { seen[s.id] = (seen[s.id] || 0) + 1; if (seen[s.id] > 1) s.id += `-${seen[s.id]}`; }
  return strokes;
}

const shear = ([x, y]) => [x + y * SLANT, -y];
const f = n => Number(n.toFixed(1));

// Centripetal Catmull–Rom (alpha 0.5) through a run of points → cubic Bézier segments.
function bezierRun(p) {
  const out = [];
  const dist = (a, b) => Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1]) ** .5);
  for (let i = 0; i < p.length - 1; i++) {
    const p1 = p[i], p2 = p[i + 1];
    const p0 = i > 0 ? p[i - 1] : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
    const p3 = i + 2 < p.length ? p[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
    const d1 = dist(p0, p1), d2 = dist(p1, p2), d3 = dist(p2, p3);
    const b1 = [0, 1].map(k => (d1 * d1 * p2[k] - d2 * d2 * p0[k] + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1[k]) / (3 * d1 * (d1 + d2)));
    const b2 = [0, 1].map(k => (d3 * d3 * p1[k] - d2 * d2 * p3[k] + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2[k]) / (3 * d3 * (d3 + d2)));
    out.push([p1, b1, b2, p2]);
  }
  return out;
}

function strokeSegments(pts) {
  const sheared = pts.map(p => [...shear(p), p[2]]);
  const runs = [];
  let cur = [];
  sheared.forEach((p, i) => {
    cur.push(p);
    if (p[2] === C && i > 0 && i < sheared.length - 1) { runs.push(cur); cur = [p]; }
  });
  runs.push(cur);
  return runs.filter(r => r.length > 1).flatMap(bezierRun);
}

const bez = ([a, b, c, d], t) => {
  const u = 1 - t;
  return [0, 1].map(k => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]);
};

export function letteringData(word) {
  const strokes = layout(word).map(s => ({ id: s.id, segs: strokeSegments(s.pts) }));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    s.length = 0;
    for (const seg of s.segs) {
      let prev = seg[0];
      for (let t = 0; t <= 1.0001; t += 1 / 24) {
        const q = bez(seg, t);
        minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]);
        s.length += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q;
      }
    }
    const [a] = s.segs[0];
    s.d = `M${f(a[0])} ${f(a[1])}` + s.segs.map(([, b, c, d]) => `C${f(b[0])} ${f(b[1])} ${f(c[0])} ${f(c[1])} ${f(d[0])} ${f(d[1])}`).join('');
  }
  const vx = Math.floor(minX - PAD), vy = Math.floor(minY - PAD);
  const vw = Math.ceil(maxX + PAD) - vx, vh = Math.ceil(maxY + PAD) - vy;
  return {
    word,
    viewBox: `${vx} ${vy} ${vw} ${vh}`,
    width: vw, height: vh,
    baseline: Number((-vy / vh).toFixed(4)), // fraction of the viewBox height where the baseline sits
    xHeight: Number((100 / vh).toFixed(4)), // x-height as a fraction of the viewBox height
    strokes: strokes.map(s => ({ id: s.id, d: s.d, length: Math.round(s.length) }))
  };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// --l-h is the viewBox height in x-heights: `height: calc(var(--l-h) * <x-height you want>)` keeps every word on one
// x-height whatever its ascenders or descenders. --l-base is the baseline position from the top (fraction).
export function letteringSvg({ word, className = 'lettering' }) {
  const L = letteringData(word);
  const paths = L.strokes.map(s => `<path data-stroke="${s.id}" data-len="${s.length}" d="${s.d}"/>`).join('');
  return `<svg class="${esc(className)}" viewBox="${L.viewBox}" data-word="${esc(word)}" data-baseline="${L.baseline}" data-xheight="${L.xHeight}" style="--l-h:${(L.height / 100).toFixed(3)};--l-base:${L.baseline}" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

export const LETTERING_GLYPHS = Object.keys(GLYPHS).join('') + ' .';
export const LETTERING_METRICS = { slant: 13, xHeight: 100, ascender: ASC, descender: DESC };

if (import.meta.url === `file://${process.argv[1]}`) {
  const word = process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ') || 'your turn.';
  console.log(process.argv.includes('--json') ? JSON.stringify(letteringData(word), null, 2) : letteringSvg({ word }));
}
