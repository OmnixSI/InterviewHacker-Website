// The 14:00 diagram: two strands (them, me) that join into one twisted cord where the junction has passed.
// m = 0: separate everywhere (online). m = 1: one cord everywhere (in person). Same formula as day.js.
export const DUO = { W: 640, H: 120, yT: 30, yM: 90, y0: 60, amp: 2.1, wave: 110, soft: 190, n: 160 };
export function duoPaths(m) {
  const { W, yT, yM, y0, amp, wave, soft, n } = DUO;
  const J = (W + soft) - m * (W + 2 * soft); // junction travels right → left as m goes 0 → 1
  const sm = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  let a = '', b = '';
  for (let i = 0; i <= n; i++) {
    const x = (W * i) / n;
    const f = sm((x - (J - soft / 2)) / soft);
    const tw = amp * f * Math.sin((x / wave) * Math.PI * 2);
    const t = yT + (y0 - yT) * f + tw, mm = yM + (y0 - yM) * f - tw;
    a += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + t.toFixed(2);
    b += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + mm.toFixed(2);
  }
  return [a, b];
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [a, b] = duoPaths(0.5);
  console.log(a.length, b.length);
  console.log(JSON.stringify({ a, b }));
}
