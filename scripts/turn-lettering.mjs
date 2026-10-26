// Turn's hand lettering: a monoline connected script, drawn as SVG strokes in pen order.
//
// Glyphs are drawn the way METAFONT draws: a few nodes per letter in upright coordinates (y up, baseline 0,
// x-height 100). A node is [x, y] (direction free), [x, y, dir] (the pen passes through heading `dir` degrees) or
// [x, y, dirIn, dirOut] (a cusp, where the pen turns sharply or goes back over its own line). Between nodes the curve
// is Hobby's (METAFONT's `..`, tension 1, curl 1 at free ends), so a handful of nodes gives fair curves, and a curve
// reversed is exactly the same curve — a retrace reads as one line.
// Letters chain through their joins: a low exit leaves the last stem at the baseline and swings up into the next
// letter; a high exit (o r w) ties across at the x-height. A 13° shear gives the slant, with a little deterministic
// variation in width, slant and height so repeated letters are not stamps of each other.
// Strokes are in writing order: each connected run of letters (named after its letters), then the strokes a pen adds
// when it goes back over the word (t-bars, x-crosses, i-dots), then the full stop.
//
//   letteringSvg({ word, className })  → inline <svg> string (aria-hidden) for scripts/build-turn.mjs
//   letteringData(word)                → { viewBox, width, height, baseline, xHeight, strokes: [{ id, d, length }] }
//   node scripts/turn-lettering.mjs "your turn." [--json]
const SLANT = 13;
const PAD = 6; // viewBox padding around the ink centre line (x-height = 100); covers stroke widths up to ~12 units
const GAP = 50; // white between the optical edges of two joined letters
const WIDE = 1.24; // horizontal scale of the glyph drawings (drawn narrow so they are easy to edit)
const SPACE = 84; // white between words
const R = Math.PI / 180;

const lowOut = s => [[s, 22, -90], [s + 9, 0.5, 0], [s + 21, 9, 36]]; // round off at the baseline, rise to the join
const lowEnd = s => [[s, 22, -90], [s + 9, 0.5, 0], [s + 19, 8, 38]]; // the same, a shorter flick at a word end
const nIn = { low: 74, high: 8, lead: [[-1, 66, 64]] }; // arriving at the top of a first stem (n m r u w y i)

// left/right: optical edges for spacing. in: arrival direction at the first body node for each kind of join, and
// the lead-in a word starts with. approach: extra nodes before the body for a join. body: the letter. out/end:
// exit nodes (joined / word end). exit: kind of join it makes. lift: joins after which the pen lifts first.
const GLYPHS = {
  n: {
    left: 10, right: 60, in: nIn,
    body: [[10, 100, null, -90], [10, 0, -90, 88], [11, 36, 87], [36, 101, 0], [60, 70, -90]],
    out: lowOut(60), end: lowEnd(60), exit: 'low'
  },
  m: {
    left: 10, right: 82, in: nIn,
    body: [[10, 100, null, -90], [10, 0, -90, 88], [11, 38, 86], [29, 101, 0], [46, 72, -90], [46, 0, -90, 88], [47, 38, 86],
      [65, 101, 0], [82, 72, -90]],
    out: lowOut(82), end: lowEnd(82), exit: 'low'
  },
  u: {
    left: 10, right: 57, in: nIn,
    body: [[10, 100, null, -90], [10, 34, -90], [29, 0, 0], [54, 46, 84], [57, 100, 90, -90]],
    out: lowOut(57), end: lowEnd(57), exit: 'low'
  },
  i: {
    left: 10, right: 10, in: nIn,
    body: [[10, 100, null, -90]],
    out: lowOut(10), end: lowEnd(10), exit: 'low',
    marks: [{ id: 'i-dot', pts: [[11, 145, 66], [12.8, 149.5, 66]] }]
  },
  r: {
    // The arch rises to a small shoulder and eases down a touch before the tie, so a pair of r's never reads as a bar.
    left: 10, right: 44, in: nIn,
    body: [[10, 100, null, -90], [10, 0, -90, 88], [11, 40, 86], [27, 97, 16], [41, 91, -18]],
    out: [[55, 93, 8]], end: [[46, 86, -44]], exit: 'high'
  },
  w: {
    left: 10, right: 88, in: nIn,
    body: [[10, 100, null, -90], [10, 34, -90], [28, 0, 0], [46, 44, 84], [48, 86, 90, -90], [48, 32, -90], [66, 0, 0], [84, 46, 86]],
    out: [[87, 95, 100], [78, 97, 210], [78, 86, 330], [90, 86, 8], [104, 93, 14]],
    end: [[86, 92, 92], [93, 99, 34]], exit: 'high'
  },
  y: {
    left: 8, right: 55, in: { ...nIn, lead: [[-1, 68, 64]] },
    body: [[8, 100, null, -90], [8, 34, -90], [27, 0, 0], [52, 46, 84], [55, 100, 90, -90], [54, 0, -91], [50, -58, -100],
      [39, -88, 180], [29, -66, 78], [52, -8, 46]],
    out: [[70, 12, 36]], end: [[68, 11, 38]], exit: 'low'
  },
  l: {
    left: 12, right: 16,
    in: { low: 58, high: 40, lead: [[-4, 10, 46]] },
    body: [[12, 66, null, 70], [30, 152, 80], [25, 184, 180], [15, 154, -93], [14, 100, -90]],
    out: lowOut(14), end: lowEnd(14), exit: 'low'
  },
  t: {
    // A join meets the stem (from the baseline, or across at the x-height); the pen goes up the stem and comes back
    // down over the same line.
    left: 16, right: 22,
    in: { low: 90, high: 90 }, approach: { low: [[18, 58, 90]], high: [[18, 97, 4, 90]] },
    body: [[18, 146, null, -90], [18, 58, -90]],
    out: lowOut(18), end: lowEnd(18), exit: 'low',
    marks: [{ id: 't-bar', pts: [[1, 101, 7], [45, 106, 5]] }]
  },
  e: {
    left: 7, right: 42,
    in: { low: 40, high: -20, lead: [[0, 26, 34]] },
    body: [[13, 42, null, 40], [40, 78, 78], [28, 101, 180], [7, 56, -90], [27, 0, 0]],
    out: [[47, 9, 32]], end: [[44, 8, 34]], exit: 'low'
  },
  x: {
    left: 16, right: 56,
    in: { low: 30, high: 0 },
    body: [[17, 98, null, 12], [31, 86, -64], [45, 16, -72], [57, 0.5, 0]],
    out: [[69, 9, 36]], end: [[67, 8, 38]], exit: 'low',
    marks: [{ id: 'x-cross', pts: [[60, 98, -116], [14, 2, -116]] }]
  },
  o: {
    // The join runs up the left side and over the top to a point on the right shoulder; the pen comes back over the
    // same arc, round the bowl, and closes through that point before it ties out at the x-height.
    left: 6, right: 48,
    in: { low: 0, high: -6 }, approach: { low: [[6, 54, 90]] },
    body: [[25, 101, null], [47, 84, -62, 118], [25, 101, 180], [6, 54, -90], [26, 0, 0], [48, 46, 88], [47, 84, 100]],
    out: [[56, 97, 30], [66, 99, 0]], end: [[52, 95, 50]], exit: 'high'
  },
  d: {
    // Like o, the join goes over the top to the right and back; the turning point sits on the stem, so it vanishes.
    left: 6, right: 52,
    in: { low: 0, high: -6 }, approach: { low: [[6, 54, 90]] },
    body: [[24, 101, null], [49, 84, -60, 120], [24, 101, 180], [6, 54, -90], [25, 0, 0], [52, 52, 88], [53, 174, 90, -90], [52, 52, -90]],
    out: lowOut(52), end: lowEnd(52), exit: 'low'
  },
};

function jitter(word, i) {
  let h = 2166136261;
  for (const ch of `${word}#${i}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const r = k => (((h >>> k) & 255) / 127.5) - 1;
  return { sx: 1 + r(0) * .03, sy: 1 + r(8) * .015, dy: r(16) * .8, sk: Math.tan(r(24) * 1.2 * R) };
}

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const dirIn = n => n[2] ?? null;
const dirOut = n => (n.length > 3 ? n[3] : n[2] ?? null);

// Hobby's control points for one segment from z0 (leaving at angle w0) to z1 (arriving at angle w1), tension 1.
function hobby(z0, w0, z1, w1) {
  const dx = z1[0] - z0[0], dy = z1[1] - z0[1], chord = Math.hypot(dx, dy), delta = Math.atan2(dy, dx);
  const th = wrap(w0 - delta), ph = wrap(delta - w1);
  const st = Math.sin(th), ct = Math.cos(th), sp = Math.sin(ph), cp = Math.cos(ph);
  const a = Math.SQRT2 * (st - sp / 16) * (sp - st / 16) * (ct - cp);
  const c1 = (Math.sqrt(5) - 1) / 2, c2 = (3 - Math.sqrt(5)) / 2;
  const rho = Math.min(4, Math.max(0, (2 + a) / (1 + c1 * ct + c2 * cp)));
  const sigma = Math.min(4, Math.max(0, (2 - a) / (1 + c1 * cp + c2 * ct)));
  const u = chord * rho / 3, v = chord * sigma / 3;
  return [z0, [z0[0] + u * Math.cos(w0), z0[1] + u * Math.sin(w0)], [z1[0] - v * Math.cos(w1), z1[1] - v * Math.sin(w1)], z1];
}

// Directions through a run of free nodes between z[0] (departure t0, or curl) and z[n] (arrival t1, or curl):
// METAFONT's mock-curvature equations with every tension and curl at 1. Returns [depart, arrive] per segment.
function solveRun(z, t0, t1) {
  const n = z.length - 1, d = [], ang = [];
  for (let k = 0; k < n; k++) {
    d.push(Math.max(1e-6, Math.hypot(z[k + 1][0] - z[k][0], z[k + 1][1] - z[k][1])));
    ang.push(Math.atan2(z[k + 1][1] - z[k][1], z[k + 1][0] - z[k][0]));
  }
  if (n === 1) {
    if (t0 != null && t1 != null) return [[t0, t1]];
    if (t0 != null) return [[t0, 2 * ang[0] - t0]];
    if (t1 != null) return [[2 * ang[0] - t1, t1]];
    return [[ang[0], ang[0]]];
  }
  const psi = [0];
  for (let k = 1; k < n; k++) psi.push(wrap(ang[k] - ang[k - 1]));
  const phiEnd = t1 != null ? wrap(ang[n - 1] - t1) : null;
  const A = Array(n).fill(0), B = Array(n).fill(0), Cc = Array(n).fill(0), Rr = Array(n).fill(0);
  if (t0 != null) { B[0] = 1; Rr[0] = wrap(t0 - ang[0]); } else { B[0] = 1; Cc[0] = 1; Rr[0] = -psi[1]; }
  for (let k = 1; k < n; k++) {
    const a = 1 / d[k - 1], b = 2 / d[k - 1], c = 2 / d[k], e = 1 / d[k];
    A[k] = a;
    if (k < n - 1) { B[k] = b + c; Cc[k] = e; Rr[k] = -b * psi[k] - e * psi[k + 1]; }
    else if (phiEnd != null) { B[k] = b + c; Rr[k] = -b * psi[k] + e * phiEnd; }
    else { B[k] = b + c - e; Rr[k] = -b * psi[k]; }
  }
  for (let k = 1; k < n; k++) { const m = A[k] / B[k - 1]; B[k] -= m * Cc[k - 1]; Rr[k] -= m * Rr[k - 1]; }
  const theta = Array(n).fill(0);
  theta[n - 1] = Rr[n - 1] / B[n - 1];
  for (let k = n - 2; k >= 0; k--) theta[k] = (Rr[k] - Cc[k] * theta[k + 1]) / B[k];
  return theta.map((th, k) => {
    const phiNext = k < n - 1 ? -psi[k + 1] - theta[k + 1] : (phiEnd ?? theta[n - 1]);
    return [ang[k] + th, ang[k] - phiNext];
  });
}

function pathSegments(nodes) {
  const segs = [];
  for (let i = 0; i < nodes.length - 1;) {
    let j = i + 1;
    while (j < nodes.length - 1 && dirIn(nodes[j]) == null) j++;
    const z = nodes.slice(i, j + 1), t0 = dirOut(nodes[i]), t1 = dirIn(nodes[j]);
    const angles = solveRun(z, t0 == null ? null : t0 * R, t1 == null ? null : t1 * R);
    for (let k = 0; k < z.length - 1; k++) segs.push(hobby(z[k], angles[k][0], z[k + 1], angles[k][1]));
    i = j;
  }
  return segs;
}

function layout(word) {
  const strokes = [], chars = [...word.toLowerCase()];
  let x = 0, tail = 0, run = null, letters = '', marks = [], prev = null;
  const endRun = () => { if (run) strokes.push({ id: letters, nodes: run }); run = null; letters = ''; };
  const endWord = () => { endRun(); strokes.push(...marks); marks = []; prev = null; };
  chars.forEach((ch, i) => {
    if (ch === ' ') { endWord(); x = Math.max(x, tail) + SPACE; return; }
    if (ch === ',') {
      endWord();
      const cx = Math.max(x, tail) + 12;
      strokes.push({ id: 'comma', nodes: [[cx + 2, 6, -100], [cx - 6, -22, -120]] });
      x = tail = cx + 4;
      return;
    }
    if (ch === '.') {
      endWord();
      const sx0 = Math.max(x, tail) + 13;
      strokes.push({ id: 'stop', nodes: [[sx0, 1.5, 66], [sx0 + 2, 6, 66]] });
      x = tail = sx0 + 2;
      return;
    }
    const g = GLYPHS[ch];
    if (!g) throw new Error(`turn-lettering: no glyph for "${ch}" in "${word}"`);
    if (prev && g.lift?.includes(prev.exit)) { endRun(); prev = null; }
    const next = GLYPHS[chars[i + 1]];
    const last = !next || next.lift?.includes(g.exit);
    const { sx: jx, sy, dy, sk } = jitter(word, i);
    const sx = jx * WIDE;
    const ox = x + (prev ? GAP : 0) - g.left * sx;
    const place = n => [ox + n[0] * sx + n[1] * sk, n[1] > 0 ? n[1] * sy + dy : n[1] + dy, ...n.slice(2)];
    const body = g.body.map(n => n.slice());
    const lead = prev ? (g.approach?.[prev.exit] || []) : (g.in.lead || []);
    body[0][2] = prev ? (g.in[prev.exit] ?? g.in.low) : (lead.length ? dirOut(lead[lead.length - 1]) : dirOut(body[0]));
    const nodes = [...lead, ...body, ...(last ? g.end : g.out)].map(place);
    run = run ? run.concat(nodes) : nodes;
    letters += ch;
    for (const m of g.marks || []) marks.push({ id: m.id, nodes: m.pts.map(place) });
    x = ox + g.right * sx;
    tail = nodes[nodes.length - 1][0];
    prev = { exit: g.exit };
  });
  endWord();
  const seen = {};
  for (const s of strokes) { seen[s.id] = (seen[s.id] || 0) + 1; if (seen[s.id] > 1) s.id += `-${seen[s.id]}`; }
  return strokes;
}

const SH = Math.tan(SLANT * R);
const shear = ([x, y]) => [x + y * SH, -y];
const f = n => Number(n.toFixed(1));
const bez = ([a, b, c, d], t) => {
  const u = 1 - t;
  return [0, 1].map(k => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]);
};

export function letteringData(word, { debug = false } = {}) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const strokes = layout(word).map(s => {
    const segs = pathSegments(s.nodes).map(seg => seg.map(shear));
    let length = 0;
    for (const seg of segs) {
      let p = seg[0];
      for (let k = 0; k <= 32; k++) {
        const q = bez(seg, k / 32);
        minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]);
        length += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q;
      }
    }
    const d = `M${f(segs[0][0][0])} ${f(segs[0][0][1])}` + segs.map(([, b, c, e]) => `C${f(b[0])} ${f(b[1])} ${f(c[0])} ${f(c[1])} ${f(e[0])} ${f(e[1])}`).join('');
    const out = { id: s.id, d, length: Math.round(length) };
    if (debug) out.nodes = s.nodes.map(shear);
    return out;
  });
  const vx = Math.floor(minX - PAD), vy = Math.floor(minY - PAD);
  const vw = Math.ceil(maxX + PAD) - vx, vh = Math.ceil(maxY + PAD) - vy;
  return {
    word, viewBox: `${vx} ${vy} ${vw} ${vh}`, width: vw, height: vh,
    baseline: Number((-vy / vh).toFixed(4)), // fraction of the viewBox height, from the top, where the baseline sits
    xHeight: Number((100 / vh).toFixed(4)), // x-height as a fraction of the viewBox height
    strokes
  };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Sizing: --l-h is the viewBox height in x-heights, so `height: calc(var(--l-h) * 0.5em)` gives every word the
// same x-height (0.5em) whatever its ascenders and descenders; --l-base is the baseline from the top (fraction).
export function letteringSvg({ word, className = 'lettering' }) {
  const L = letteringData(word);
  const paths = L.strokes.map(s => `<path data-stroke="${esc(s.id)}" d="${s.d}"/>`).join('');
  return `<svg class="${esc(className)}" viewBox="${L.viewBox}" data-word="${esc(word)}" data-baseline="${L.baseline}" data-xheight="${L.xHeight}" style="--l-h:${(L.height / 100).toFixed(3)};--l-base:${L.baseline}" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

export const LETTERING_CHARS = `${Object.keys(GLYPHS).join('')} .,`;

// CLI. The module itself has no Node dependencies, so a copy can run in the browser to build strokes on the fly.
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv?.[1]}`) {
  const word = process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ') || 'your turn.';
  console.log(process.argv.includes('--json') ? JSON.stringify(letteringData(word), null, 2) : letteringSvg({ word }));
}
