// Final's hand-drawn ink: a monoline script word ("one page.") and the pen marks an editor leaves on a
// page — a loop around a phrase, an underline, a tick, a margin bracket and a curved arrow.
// Every stroke is a list of skeleton points (y up). A Catmull-Rom pass turns them into cubic Béziers and
// the strokes stay in writing order, so the page can reveal them the way a pen would (stroke-dashoffset).
// Nothing here is a font: the shapes are drawn point by point for this site.
const f = n => Number(n.toFixed(1));

function catmullRom(points) {
  const p = points;
  if (p.length === 2) return `M${f(p[0][0])} ${f(p[0][1])}L${f(p[1][0])} ${f(p[1][1])}`;
  const q = [p[0], ...p, p[p.length - 1]];
  let d = `M${f(q[1][0])} ${f(q[1][1])}`;
  for (let i = 1; i < q.length - 2; i++) {
    const [a, b, c, e] = [q[i - 1], q[i], q[i + 1], q[i + 2]];
    d += `C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`;
  }
  return d;
}

// ---- The script word ---------------------------------------------------------------------------
// Upright skeleton, x-height 100, baseline 0, descender to -92. A 14° shear gives the slant.
const SLANT = Math.tan(14 * Math.PI / 180);
const word = [
  // o n e — the o closes at the top and its exit stroke becomes the n's first arch.
  { id: 'one', points: [[44,92],[26,94],[10,76],[4,44],[12,12],[30,0],[50,8],[60,36],[58,72],[46,94],[40,88],[54,86],[70,90],
    [80,96],[86,84],[88,56],[88,26],[88,0],
    [90,34],[100,80],[116,98],[130,88],[132,48],[134,12],[146,0],[160,10],
    [178,40],[190,62],[186,76],[172,76],[164,58],[164,28],[174,6],[194,0],[214,12]] },
  // p a g e — the p's stem drops below the line, climbs back into its bowl and runs on into the a.
  { id: 'p', points: [[262,2],[276,52],[286,96],[284,40],[278,-40],[272,-92],[276,-40],[284,30],[294,78],[312,98],[330,90],[336,60],[330,24],[314,4],[296,4],[288,12]] },
  { id: 'age', points: [[352,70],[366,84],[376,86],[388,98],[380,94],[364,96],[348,80],[342,48],[350,14],[366,2],[380,14],[388,46],[392,92],[392,40],[396,10],[408,0],[420,8],
    [446,92],[430,98],[414,82],[408,52],[418,22],[434,14],[446,30],[452,92],[448,20],[440,-48],[424,-88],[404,-92],[396,-70],[410,-36],[440,-6],[468,16],
    [486,42],[498,64],[494,76],[480,76],[472,58],[472,28],[482,6],[502,0],[524,12]] },
  { id: 'stop', points: [[542,2],[545,6]] }
];
const WORD_BASE = 120, WORD_OX = 36;
const placeWord = ([x, y]) => [x + y * SLANT + WORD_OX, WORD_BASE - y];

export function scriptSvg({ className = 'script', label = '' } = {}) {
  const paths = word.map(s => `<path data-stroke="${s.id}" pathLength="1" d="${catmullRom(s.points.map(placeWord))}"/>`).join('');
  const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="${className}" viewBox="0 0 640 236" ${aria} focusable="false"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

// ---- Pen marks ---------------------------------------------------------------------------------
// A loop drawn around a phrase: starts at the upper right, overshoots past the start, drifts a little.
function loopPoints() {
  const pts = [];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const t = -0.32 * Math.PI + (i / steps) * 2.3 * Math.PI;
    const drift = i / steps;
    const rx = 96 + 3 * Math.sin(3 * t), ry = 38 + 2.4 * Math.cos(2 * t);
    pts.push([100 + rx * Math.cos(t) + drift * 4, 46 - ry * Math.sin(t) - drift * 6 + 2 * Math.cos(t)]);
  }
  return pts;
}
const marks = {
  loop: { viewBox: '-4 0 208 92', strokes: [loopPoints()] },
  underline: { viewBox: '0 0 200 20', strokes: [[[2,12],[40,9],[90,8],[140,10],[176,8],[198,5]]] },
  tick: { viewBox: '0 0 28 24', strokes: [[[3,13],[7,16],[11,21],[17,11],[25,3]]] },
  bracket: { viewBox: '0 0 18 200', strokes: [[[4,3],[12,4],[13,30],[13,92],[16,100],[13,108],[13,170],[12,196],[4,197]]] },
  arrow: { viewBox: '0 0 120 60', strokes: [[[4,42],[30,22],[62,14],[92,20],[112,34]], [[96,38],[113,35],[108,18]]] },
  'arrow-down': { viewBox: '0 0 40 90', strokes: [[[20,3],[16,30],[17,58],[20,84]], [[9,70],[20,85],[31,71]]] }
};

export function markSvg(name, { className = '' } = {}) {
  const m = marks[name];
  if (!m) throw new Error(`Unknown pen mark: ${name}`);
  const paths = m.strokes.map(s => `<path pathLength="1" vector-effect="non-scaling-stroke" d="${catmullRom(s)}"/>`).join('');
  return `<svg class="pen pen--${name}${className ? ' ' + className : ''}" viewBox="${m.viewBox}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}
