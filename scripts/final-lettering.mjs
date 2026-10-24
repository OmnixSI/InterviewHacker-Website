// Custom monoline lettering for "next line." used by Final.
// Each stroke is a list of skeleton points (upright, y up, x-height = 100). A Catmull-Rom pass turns
// them into cubic Béziers, a 13° shear gives the italic slant, and the strokes stay in writing order
// so DrawSVG reveals them the way a pen would: the word, then the x-cross and t-bar, then the dots.
const SLANT = Math.tan(13 * Math.PI / 180);
const OX = 80, BASE = 200;

const strokes = [
  // n e x t — begins with a flat lead-in so the waveform's baseline can run straight into the pen.
  { id: 'next', points: [[-60,0],[-30,0],[0,4],[16,52],[26,94],[29,70],[29,30],[29,0],
    [31,34],[42,82],[58,98],[71,86],[73,46],[75,10],[88,0],[104,12],
    [124,44],[134,64],[130,76],[118,74],[110,58],[110,28],[120,6],[140,0],[160,14],
    [172,52],[178,72],[188,46],[202,10],[216,0],[230,10],
    [244,56],[254,142],[250,96],[248,40],[254,8],[268,0],[286,12]] },
  { id: 'x', points: [[212,72],[194,40],[170,0]] },
  { id: 't', points: [[232,96],[256,100],[280,100]] },
  // l i n e
  { id: 'line', points: [[330,6],[352,58],[374,128],[376,160],[364,164],[356,140],[354,90],[356,36],[364,6],[378,0],[394,12],
    [406,56],[412,94],[411,52],[414,10],[426,0],[442,12],
    [452,56],[458,96],[459,50],[459,0],
    [461,34],[472,84],[488,98],[501,86],[503,46],[505,10],[518,0],[532,12],
    [552,44],[562,64],[558,76],[546,74],[538,58],[538,28],[548,6],[568,0],[592,16]] },
  { id: 'dot', points: [[414,128],[418,136]] },
  { id: 'stop', points: [[612,2],[615,6]] }
];

const place = ([x, y]) => [x + y * SLANT + OX, BASE - y];
const f = n => Number(n.toFixed(1));

function catmullRom(points) {
  const p = points.map(place);
  if (p.length === 2) return `M${f(p[0][0])} ${f(p[0][1])}L${f(p[1][0])} ${f(p[1][1])}`;
  const q = [p[0], ...p, p[p.length - 1]];
  let d = `M${f(q[1][0])} ${f(q[1][1])}`;
  for (let i = 1; i < q.length - 2; i++) {
    const [a, b, c, e] = [q[i - 1], q[i], q[i + 1], q[i + 2]];
    d += `C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`;
  }
  return d;
}

// The viewBox starts at the lead-in so the stroke's first point sits on the left edge, on the baseline.
export const LETTERING_VIEWBOX = '20 20 690 196';
export const LETTERING_BASELINE = (BASE - 20) / 196;

// Inline use drops the lead-in (it would read as an underscore before the word) and crops to the word.
export function letteringSvg({ className = 'lettering', lead = true } = {}) {
  const paths = strokes.map(s => {
    const points = !lead && s.id === 'next' ? s.points.slice(2) : s.points;
    return `<path data-stroke="${s.id}" d="${catmullRom(points)}"/>`;
  }).join('');
  const viewBox = lead ? LETTERING_VIEWBOX : '72 20 638 196';
  return `<svg class="${className}" viewBox="${viewBox}" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}
