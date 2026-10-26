// Turn — the two lines. One fixed canvas behind the page draws two strings: amber is the other side
// (IH.palette.them), indigo is you (IH.palette.me). They behave like strings: a 1D wave equation per string
// with fixed ends, light damping and fixed 720 Hz sub-steps. When the pointer's path crosses a string it
// plucks it (soft when slow, bright when fast); pressing near a string grabs it, and letting go lets it ring.
// 'voice' sends a small wave packet along the named string, 'turn' a single pulse. The shape follows the
// section's lines mode (hero, gap, day, offline, dusk, still, water) and morphs between resting poses; in
// 'water' the lines multiply into the rows of a small height-field lake. The loop stops whenever nothing
// moves. Reduced or paused motion draws still geometry only (plucks still emit, so sound can answer).
//
//   IH.lines.mode · geometry() → { mode, themY, meY, horizonY, waterY, merged }
//   IH.lines.pluck(who, x 0–1, strength 0–1, { silent }) · setMode(name | null) · merge(bool | null)
//   :root gets --line-them-y, --line-me-y, --horizon-y (dusk), --water-y (lake), px from the viewport top.
//   Emits 'pluck' { who, x, strength }. Listens to 'section', 'lines', 'voice', 'turn', 'motion', 'tick'.
(() => {
  const IH = window.IH;
  if (!IH || IH.lines) return;
  const root = document.documentElement;
  const host = document.querySelector('[data-lines-root]');
  const canvas = host ? host.querySelector('[data-lines-canvas]') : null;
  // With a software GPU (SwiftShader, llvmpipe: blocklisted drivers, VMs, headless test browsers) an accelerated
  // 2D canvas is emulated GPU work on the CPU and rasterises many times slower than plain software canvas, so
  // ask for a CPU-backed canvas there. A real GPU keeps the accelerated path.
  function softwareGPU() {
    try {
      const gl = document.createElement('canvas').getContext('webgl', { antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
    } catch (e) { return false; }
  }
  const soft = !!canvas && softwareGPU();
  let ctx = null;
  try { ctx = canvas && canvas.getContext ? canvas.getContext('2d', soft ? { willReadFrequently: true } : undefined) : null; } catch (e) { ctx = null; }

  const MODES = ['hero', 'gap', 'day', 'offline', 'dusk', 'still', 'water'];
  const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const now = () => performance.now();

  // Cubic-bezier easing (same curves as the CSS/GSAP eases), solved with Newton steps and a bisection fallback.
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = u => ((ax * u + bx) * u + cx) * u;
    return t => {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      let u = t;
      for (let i = 0; i < 6; i++) {
        const e = X(u) - t, d = (3 * ax * u + 2 * bx) * u + cx;
        if (Math.abs(e) < 1e-5) return ((ay * u + by) * u + cy) * u;
        if (Math.abs(d) < 1e-6) break;
        u -= e / d;
      }
      let lo = 0, hi = 1; u = t;
      for (let i = 0; i < 24; i++) { const x = X(u); if (Math.abs(x - t) < 1e-5) break; if (x < t) lo = u; else hi = u; u = (lo + hi) / 2; }
      return ((ay * u + by) * u + cy) * u;
    };
  }
  const easeMorph = bezier(0.3, 0.72, 0.18, 1); // ih.settle, softened at the start so a morph never jolts
  const easeDraw = bezier(0.42, 0, 0.16, 1);    // a pen stroke: eases in, glides out

  /* ---------------- Quality ---------------- */
  // Two strings cost little; the lake and the canvas size are what scale. Quality steps down (never up) when a
  // frame of ours takes too long, and the level is remembered for the session.
  const QUALITY = [
    { nodes: 96, glow: false, px: 0.9e6, gw: 56, gh: 20, breath: false },
    { nodes: 132, glow: false, px: 2.4e6, gw: 76, gh: 26, breath: true },
    { nodes: 180, glow: true, px: 9e6, gw: 96, gh: 32, breath: true }
  ];
  let Q = coarse || innerWidth < 720 ? 1 : 2;
  if ((navigator.hardwareConcurrency || 8) <= 2) Q = 0;
  if (soft) Q = Math.min(Q, 1);
  let halfStored = false;
  try {
    const s = sessionStorage.getItem('ih-lines-q');
    if (s !== null) Q = Math.min(Q, clamp(Number(s) | 0, 0, 2));
    halfStored = sessionStorage.getItem('ih-lines-half') === '1';
  } catch (e) { /* storage blocked */ }

  /* ---------------- Viewport ---------------- */
  // The canvas spans the large viewport (lines.css), so mobile toolbars never resize it; resting positions are
  // fractions of the small viewport (VH), so nothing hides behind a toolbar.
  let W = 0, CH = 0, VH = 0, DPR = 1, wrapL = 0, wrapR = 0, slotTop = NaN, slotBottom = NaN;
  let probe = null;
  if (host) {
    probe = document.createElement('i');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;left:0;top:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
    host.append(probe);
  }
  function readSlot() {
    const el = document.querySelector('[data-lines-slot]');
    if (!el) { slotTop = slotBottom = NaN; return; }
    const r = el.getBoundingClientRect();
    // A slot that isn't laid out yet (no size, or taller than a fifth of the screen) is ignored: fall back to 62/70%.
    if (r.height < 8 || r.height > VH * 0.2) { slotTop = slotBottom = NaN; return; }
    slotTop = r.top + scrollY; slotBottom = r.bottom + scrollY;
  }
  function measure() {
    W = (canvas && canvas.clientWidth) || innerWidth;
    CH = (canvas && canvas.clientHeight) || innerHeight;
    VH = Math.min(CH, (probe && probe.offsetHeight) || innerHeight) || CH;
    const gutter = clamp(W * 0.044, 20, 72), wrap = Math.min(1440, W - 2 * gutter);
    wrapL = (W - wrap) / 2; wrapR = W - wrapL;
    readSlot();
  }

  /* ---------------- Poses ---------------- */
  // A pose is the resting geometry of both lines; modes morph by tweening every slot.
  const TY = 0, MY = 1, TA = 2, MA = 3, LW = 4, X0 = 5, X1 = 6, AMP = 7, BR = 8, MG = 9, TW = 10, GL = 11, WA = 12, WARM = 13, CL = 14, NP = 15;
  const cur = new Float64Array(NP), from = new Float64Array(NP), tgt = new Float64Array(NP), rest = new Float64Array(NP);
  let mode = 'hero', sectionMode = null, overrideMode = null, mergeOverride = null, sectionKey = '';
  let morphAt = -1e9, morphDur = 1100, poseKey = '';

  const isMobile = () => W < 720;
  function gapPose(out) { out[TY] = VH * (isMobile() ? 0.655 : 0.535); out[MY] = VH * (isMobile() ? 0.7 : 0.59); }
  function dayPose(out) { out[TY] = VH * (isMobile() ? 0.915 : 0.905); out[MY] = VH * (isMobile() ? 0.945 : 0.935); }
  // Hero: the strings rest on the hero's slot (its top and bottom edges, in document coordinates) and scroll with
  // the copy, so its labels stay attached. Near the top of the screen they slow down and stop (a soft floor);
  // when the reader reaches № 01 the section change morphs them into their gap positions.
  function heroPose(out, sy) {
    let a = slotTop, b = slotBottom;
    if (!(a === a) || !(b === b)) { a = VH * (isMobile() ? 0.74 : 0.62); b = VH * (isMobile() ? 0.8 : 0.7); }
    const r = VH * 0.06, floor = Math.max(96, VH * 0.2);
    const ease = d => (d >= r ? d : r * Math.exp(d / r - 1));
    out[TY] = floor + ease(a - sy - floor);
    out[MY] = floor + (b - a) + ease(b - sy - floor - (b - a));
  }
  function poseFor(m, out, sy) {
    const mob = isMobile();
    out[TA] = 1; out[MA] = 1; out[LW] = mob ? 1.35 : 1.5; out[X0] = 0; out[X1] = W; out[AMP] = 1; out[BR] = 1;
    out[MG] = 0; out[TW] = 0; out[GL] = 1; out[WA] = 0; out[WARM] = 0; out[CL] = 0;
    switch (m) {
      case 'hero': heroPose(out, sy); break;
      // Pinned (wide screens with motion), № 01 is a stage built around the strings; unpinned it is ordinary
      // reading order, and the strings part around its text like the quiet modes do.
      case 'gap': gapPose(out); out[CL] = root.classList.contains('gap-pinned') ? 0 : 1; break;
      case 'day':
        dayPose(out); out[TA] = 0.6; out[MA] = 0.6; out[LW] = 1.15; out[X0] = wrapL; out[X1] = wrapR; out[AMP] = 0.55; out[BR] = 0.6; out[GL] = 0.45; out[CL] = 1; break;
      case 'offline': {
        dayPose(out); const y = (out[TY] + out[MY]) / 2;
        out[TY] = y; out[MY] = y; out[TA] = 0.85; out[MA] = 0.85; out[LW] = 1.25; out[X0] = wrapL; out[X1] = wrapR; out[AMP] = 0.6; out[BR] = 0.6; out[MG] = 1; out[TW] = 1.15; out[GL] = 0.6; out[CL] = 1; break;
      }
      case 'dusk':
        out[TY] = out[MY] = VH * 0.58; out[TA] = 0.95; out[MA] = 0.55; out[LW] = 1.5; out[X0] = -W * 0.02; out[X1] = W * 1.02; out[AMP] = 0.75; out[BR] = 1.3; out[MG] = 1; out[TW] = 0.55; out[GL] = 1.7; out[WARM] = 1; break;
      case 'still':
        out[TY] = VH * (mob ? 0.92 : 0.91); out[MY] = VH * (mob ? 0.945 : 0.935); out[TA] = 0.26; out[MA] = 0.26; out[LW] = 1; out[X0] = wrapL; out[X1] = wrapR; out[AMP] = 0.4; out[BR] = 0.2; out[GL] = 0; out[CL] = 1; break;
      case 'water':
        out[TY] = out[MY] = VH * 0.42; out[TA] = 0.6; out[MA] = 0.5; out[LW] = 1.1; out[X0] = -W * 0.02; out[X1] = W * 1.02; out[AMP] = 0.55; out[BR] = 0; out[MG] = 1; out[TW] = 0.5; out[GL] = 1; out[WA] = 1; break;
    }
    if (mergeOverride === true && out[MG] < 1) {
      const y = (out[TY] + out[MY]) / 2;
      out[TY] = y; out[MY] = y; out[MG] = 1; out[TW] = 1.15; out[TA] = Math.max(out[TA], 0.8); out[MA] = out[TA];
    } else if (mergeOverride === false && m === 'offline') {
      dayPose(out); out[MG] = 0; out[TW] = 0; out[TA] = 0.75; out[MA] = 0.75;
    }
  }

  /* ---------------- Strings ---------------- */
  const MAXN = 200, PK = 10, PF = 7; // packets: pos, speed, amp, len, k, omega, age
  function makeString(who, index) {
    return {
      who, index, y: new Float32Array(MAXN), v: new Float32Array(MAXN), px: new Float32Array(MAXN + 1), py: new Float32Array(MAXN + 1), m: 0,
      pickT: 1, pickDur: 0, pickA: 0, pickI: 0, pickW: 3,
      grab: false, grabI: 0, grabA: 0, grabTo: 0,
      lean: 0, leanTo: 0, leanX: 0,
      lit: 0, peak: 0, emitAt: -1e9, pk: new Float32Array(PK * PF), packetAt: -1e9, draw: 1
    };
  }
  const S = [makeString('them', 0), makeString('me', 1)];
  let N = QUALITY[Q].nodes, C2 = 1, acc = 0;
  const DT = 1 / 720, DAMP = 1.05, HOLD_DAMP = 9, SMOOTH = 0.01, CROSS_TIME = 0.38;
  function setNodes(n) {
    // Resample any motion onto the new node count so a quality change never visibly resets the strings.
    if (N !== n) {
      for (let k = 0; k < 2; k++) {
        const s = S[k], ys = s.px; // scratch
        for (let i = 0; i < n; i++) { const f = i / (n - 1) * (N - 1), j = Math.min(N - 2, f | 0), t = f - j; ys[i] = s.y[j] * (1 - t) + s.y[j + 1] * t; }
        for (let i = 0; i < MAXN; i++) { s.y[i] = i < n ? ys[i] : 0; s.v[i] = 0; }
        s.y[0] = 0; s.y[n - 1] = 0;
      }
    }
    N = n;
    const c = (N - 1) / CROSS_TIME;
    C2 = c * c;
  }
  setNodes(N);

  function substep(s) {
    const y = s.y, v = s.v, n = N;
    if (s.grab) {
      // Held: the string around the hand is pinned to it; the rest finds its tent shape through the wave equation.
      const c = s.grabI, A = s.grabA, i0 = Math.max(1, Math.floor(c - 7)), i1 = Math.min(n - 2, Math.ceil(c + 7));
      for (let i = i0; i <= i1; i++) { const u = (i - c) / 2.4, w = Math.exp(-u * u) * 0.6; y[i] += (A - y[i]) * w; v[i] *= 1 - w; }
    } else if (s.pickT < s.pickDur) {
      // A pluck: the string is carried a short way by a soft fingertip, then let go.
      s.pickT += DT;
      const A = s.pickA * smooth(s.pickT / s.pickDur), c = s.pickI, w = s.pickW;
      const i0 = Math.max(1, Math.floor(c - 3 * w)), i1 = Math.min(n - 2, Math.ceil(c + 3 * w));
      for (let i = i0; i <= i1; i++) { const u = (i - c) / w, g = Math.exp(-u * u); y[i] += (A * g - y[i]) * g * 0.35; }
    }
    const k = C2 * DT, d = 1 - (s.grab ? HOLD_DAMP : DAMP) * DT;
    for (let i = 1; i < n - 1; i++) v[i] = (v[i] + k * (y[i - 1] - 2 * y[i] + y[i + 1])) * d;
    for (let i = 1; i < n - 1; i++) y[i] += v[i] * DT;
    // A little smoothing takes the sharp corners off: high harmonics die first, like a real wound string.
    let prev = y[0];
    for (let i = 1; i < n - 1; i++) { const c = y[i]; y[i] = c + SMOOTH * (prev - 2 * c + y[i + 1]); prev = c; }
  }
  function stepStrings(dt) {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 40) { acc -= DT; steps++; substep(S[0]); substep(S[1]); }
    if (acc > DT) acc = 0;
    for (let k = 0; k < 2; k++) {
      const s = S[k], y = s.y, v = s.v;
      let p = 0, q = 0;
      for (let i = 0; i < N; i++) { const a = y[i] < 0 ? -y[i] : y[i], b = v[i] < 0 ? -v[i] : v[i]; if (a > p) p = a; if (b > q) q = b; }
      if (!s.grab && s.pickT >= s.pickDur && p < 0.06 && q < 2) { if (p > 0) { y.fill(0); v.fill(0); } p = 0; }
      s.peak = p;
      if (s.grab) s.grabA += (s.grabTo - s.grabA) * Math.min(1, dt * 22);
    }
  }

  // Wave packets ride along a string while someone speaks; a turn sends one wide, smooth pulse.
  function addPacket(s, speed, amp, len, lambda, t) {
    const pk = s.pk;
    let slot = 0, best = -1;
    for (let j = 0; j < PK; j++) { const o = j * PF; if (pk[o + 2] === 0) { slot = j; best = -2; break; } if (pk[o] > best) { best = pk[o]; slot = j; } }
    const o = slot * PF, k = lambda ? (2 * Math.PI) / lambda : 0;
    pk[o] = -len * 1.5; pk[o + 1] = speed; pk[o + 2] = amp; pk[o + 3] = len; pk[o + 4] = k; pk[o + 5] = k * speed * 0.45; pk[o + 6] = 0;
    s.packetAt = t;
  }
  function stepPackets(s, dt, span) {
    const pk = s.pk;
    let live = false;
    for (let j = 0; j < PK; j++) {
      const o = j * PF;
      if (pk[o + 2] === 0) continue;
      pk[o] += pk[o + 1] * dt; pk[o + 6] += dt;
      if (pk[o] - 3 * pk[o + 3] > span) pk[o + 2] = 0; else live = true;
    }
    return live;
  }

  /* ---------------- Water ---------------- */
  // A small height field (Final's ripple rule, slowed down), one row per drawn line, laid out in perspective
  // from the horizon to the bottom of the screen. Sponge edges let rings leave instead of bouncing back.
  let GW = 0, GH = 0, wA = null, wB = null, wV = null, wE = null, wStatic = false;
  let rowY = null, rowS = null, rowAl = null, rowLw = null, rowNear = null;
  const WDT = 1 / 60, WK = 0.34, WSM = 0.018, ZF = 3.2;
  let wAcc = 0, wPeak = 0, waterY = 0, waterB = 0;
  function buildWater() {
    const q = QUALITY[Q];
    GW = q.gw; GH = q.gh;
    const n = GW * GH;
    wA = new Float32Array(n); wB = new Float32Array(n); wV = new Float32Array(n); wE = new Float32Array(n);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const e = Math.min(x, GW - 1 - x, (GH - 1 - y) * 1.5, y * 3);
      wE[y * GW + x] = 0.9935 * (0.86 + 0.14 * smooth(e / 5));
    }
    rowY = new Float32Array(GH); rowS = new Float32Array(GH); rowAl = new Float32Array(GH); rowLw = new Float32Array(GH); rowNear = new Float32Array(GH);
    wStatic = false;
    layoutWater();
  }
  function persp(u) { const z = ZF + (1 - ZF) * u; return (1 / z - 1 / ZF) / (1 - 1 / ZF); }
  function layoutWater() {
    waterY = VH * 0.42; waterB = CH - 2;
    for (let k = 0; k < GH; k++) {
      const u = (k + 1) / GH, o = persp(u), near = 1 / (ZF + (1 - ZF) * u); // 1/z: 0.31 far … 1 near
      rowY[k] = waterY + (waterB - waterY) * o;
      rowNear[k] = near;
      rowS[k] = 10 + near * near * 80;
      rowAl[k] = 0.1 + 0.5 * Math.pow(o, 0.7);
      rowLw[k] = 0.5 + 0.95 * near;
    }
  }
  function waterRow(y) { // screen y → fractional sim row
    const o = clamp((y - waterY) / Math.max(1, waterB - waterY), 0.0001, 1);
    const z = 1 / (o * (1 - 1 / ZF) + 1 / ZF), u = (z - ZF) / (1 - ZF);
    return clamp(u * GH - 1, 0, GH - 1);
  }
  function waterStep() {
    const src = wA, dst = wB, v = wV, e = wE, w = GW, h = GH;
    let peak = 0;
    for (let y = 0; y < h; y++) {
      const row = y * w, up = (y > 0 ? y - 1 : y) * w, dn = (y < h - 1 ? y + 1 : y) * w;
      for (let x = 0; x < w; x++) {
        const i = row + x, l = x > 0 ? i - 1 : i, r = x < w - 1 ? i + 1 : i;
        const avg = (src[l] + src[r] + src[up + x] + src[dn + x]) * 0.25;
        const vel = (v[i] + (avg - src[i]) * WK) * e[i];
        let nx = src[i] + vel;
        // Smoothing keeps rings soft; the small leak returns the surface to level (drops add volume that the wave
        // rule alone would keep forever, and a lake that never settles would never let the loop stop).
        nx = (nx + (avg - nx) * WSM) * 0.996;
        v[i] = vel; dst[i] = nx;
        const m = (nx < 0 ? -nx : nx) + (vel < 0 ? -vel : vel) * 4;
        if (m > peak) peak = m;
      }
    }
    wA = dst; wB = src;
    return peak;
  }
  function waterDrop(cx, cy, r, a) {
    if (!wA) return;
    if (wStatic) { wA.fill(0); wB.fill(0); wV.fill(0); wStatic = false; }
    const x0 = Math.max(0, Math.floor(cx - 2.2 * r)), x1 = Math.min(GW - 1, Math.ceil(cx + 2.2 * r));
    const y0 = Math.max(0, Math.floor(cy - 2.2 * r)), y1 = Math.min(GH - 1, Math.ceil(cy + 2.2 * r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, d2 = (dx * dx + dy * dy) / (r * r);
      if (d2 < 4.8) wA[y * GW + x] -= a * Math.exp(-d2);
    }
  }
  // Reduced motion: a still lake with two sets of rings that meet in the middle.
  function waterStill() {
    if (!wA) return;
    const sx = [GW * 0.2, GW * 0.8], sy = GH * 0.5;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      let h = 0;
      for (let j = 0; j < 2; j++) { const d = Math.hypot(x - sx[j], (y - sy) * 1.6); h += Math.cos(d * 0.62) * Math.exp(-d * 0.05) * 0.16; }
      wA[y * GW + x] = h * smooth(Math.min(x, GW - 1 - x) / 6);
    }
    wStatic = true;
  }
  // The lake's own conversation: one side speaks a few soft "words", a pause, then the other answers.
  let seed = 7, convT = 0, convWho = 0, convLeft = 0, convNext = 0.4;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const sourceX = who => (who ? 0.8 : 0.2) * (GW - 1);
  const sourceY = () => GH * 0.5;
  function waterTalk(dt) {
    convT += dt;
    if (convT < convNext) return;
    if (convLeft > 0) {
      waterDrop(sourceX(convWho) + (rand() - 0.5) * 2.2, sourceY() + (rand() - 0.5) * 2, 1.6 * GW / 96 + 0.6, 0.5 + rand() * 0.35);
      convLeft--; convNext = convT + 0.2 + rand() * 0.16;
    } else {
      convWho ^= 1; convLeft = 2 + ((rand() * 3) | 0); convNext = convT + 0.9 + rand() * 0.9;
    }
  }

  /* ---------------- Colour ---------------- */
  // The lake is coloured left amber → right indigo. A canvas gradient stroke costs 2–3× a solid one when rastered,
  // so each row is stroked in SEG solid pieces whose colours step across (invisible on lines this fine).
  const SEG = 12, segCol = new Array(SEG).fill('#888');
  let pal = null, palSeen = null, dark = false, meWarm = '#888';
  function readPalette() {
    const p = IH.palette;
    if (p && p === palSeen) return false;
    palSeen = p;
    pal = p || { them: '#d0802e', me: '#5b5ff0', paper: '#eeebe4' };
    dark = root.classList.contains('is-dark');
    meWarm = IH.mix ? IH.mix(pal.me, pal.them, 0.62) : pal.them;
    for (let i = 0; i < SEG; i++) {
      const t = smooth(clamp(((i + 0.5) / SEG - 0.16) / 0.68, 0, 1));
      segCol[i] = IH.mix ? IH.mix(pal.them, pal.me, t) : (t < 0.5 ? pal.them : pal.me);
    }
    return true;
  }

  /* ---------------- State over time ---------------- */
  let running = false, rafId = 0, last = 0, bt = 0, bEnv = 0, lastActive = -1e9, drawAt = -1, waterF = 0;
  let adaptOff = false, workEMA = 0, dtEMA = 16.7, slow = 0, frameN = 0, halfRate = halfStored, bornAt = now(), lastEmit = -1e9, static_ = false, live = false;
  const ACTIVE_MS = 6500, WATER_MS = 16000;
  const motionOK = () => IH.motionOK();
  const activity = () => { lastActive = now(); };

  /* ---------------- Geometry of the drawn strings ---------------- */
  // Displacement of string k at node fraction u (0–1) / x px, everything included except the resting y.
  function disp(s, k, u, x) {
    let d = 0;
    // Physics (linear interpolation between nodes for an end point that falls between them).
    const f = u * (N - 1), j = f | 0;
    d = j >= N - 1 ? s.y[N - 1] : s.y[j] + (s.y[j + 1] - s.y[j]) * (f - j);
    d *= cur[AMP];
    const env = Math.sin(Math.PI * clamp(u, 0, 1));
    // Breathing: two slow, long waves, sub-pixel.
    const B = cur[BR] * bEnv * 0.5;
    if (B > 0.001) {
      const ph = k * 2.1;
      d += B * env * (Math.sin(6.2832 * (u * 0.85 - bt * 0.09) + ph) * 0.65 + Math.sin(6.2832 * (u * 2.1 + bt * 0.061) + ph * 1.7) * 0.35);
    }
    // Packets (positions are px along the string from its left end).
    const span = cur[X1] - cur[X0], along = u * span, pk = s.pk;
    let pkSum = 0;
    for (let i = 0; i < PK; i++) {
      const o = i * PF, a = pk[o + 2];
      if (a === 0) continue;
      const len = pk[o + 3], du = along - pk[o];
      if (du > 3 * len || du < -3 * len) continue;
      const e = Math.exp(-(du * du) / (len * len));
      pkSum += pk[o + 4] ? a * e * Math.sin(pk[o + 4] * du + pk[o + 5] * pk[o + 6]) : a * e;
    }
    if (pkSum !== 0) d += pkSum * cur[AMP] * smooth(along / 70) * smooth((span - along) / 70);
    // Lean: the string leans a pixel or two toward a pointer hovering close by.
    if (s.lean > 0.01 || s.lean < -0.01) { const q = (x - s.leanX) / 85; d += s.lean * Math.exp(-q * q) * env; }
    // Twist: merged, the two threads wind around each other.
    if (cur[TW] > 0.01) d += (k ? -1 : 1) * cur[TW] * Math.sin(x * 0.047 + bt * 0.5) * smooth(along / 40) * smooth((span - along) / 40);
    return d;
  }
  function buildString(s, k) {
    const x0 = cur[X0], span = cur[X1] - x0, base = cur[k ? MY : TY], px = s.px, py = s.py;
    const xe = x0 + span * s.draw;
    let m = 0;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), x = x0 + span * u;
      if (x > xe) {
        const ue = s.draw;
        if (m > 0 && ue > 0) { px[m] = xe; py[m] = base + disp(s, k, ue, xe); m++; }
        break;
      }
      px[m] = x; py[m] = base + disp(s, k, u, x); m++;
    }
    s.m = m;
  }
  // Displayed y of string k at viewport x, from the last drawn points (NaN if that part isn't drawn).
  function stringY(k, x) {
    const s = S[k], m = s.m;
    if (m < 2 || x < s.px[0] || x > s.px[m - 1]) return NaN;
    const step = (cur[X1] - cur[X0]) / (N - 1);
    let j = Math.min(m - 2, Math.max(0, ((x - s.px[0]) / step) | 0));
    if (x > s.px[j + 1] && j < m - 2) j++;
    const x0 = s.px[j], x1 = s.px[j + 1], t = x1 > x0 ? (x - x0) / (x1 - x0) : 0;
    return s.py[j] + (s.py[j + 1] - s.py[j]) * t;
  }
  const alphaOf = k => cur[k ? MA : TA] * (S[k].draw > 0 ? 1 : 0);

  /* ---------------- Drawing ---------------- */
  let bandA = 0, bandB = 0, sized = false;
  function resizeCanvas() {
    if (!ctx) return;
    const q = QUALITY[Q], area = Math.max(1, W * CH);
    DPR = soft ? 1 : Math.max(1, Math.min(devicePixelRatio || 1, 2, Math.sqrt(q.px / area)));
    const bw = Math.max(1, Math.round(W * DPR)), bh = Math.max(1, Math.round(CH * DPR));
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    bandA = 0; bandB = CH; sized = true;
  }
  function tracePath(s) {
    const px = s.px, py = s.py, m = s.m;
    ctx.beginPath();
    ctx.moveTo(px[0], py[0]);
    for (let i = 1; i < m - 1; i++) ctx.quadraticCurveTo(px[i], py[i], (px[i] + px[i + 1]) * 0.5, (py[i] + py[i + 1]) * 0.5);
    ctx.lineTo(px[m - 1], py[m - 1]);
  }
  function strokeString(s, color, alpha, width, glow) {
    if (s.m < 2 || alpha < 0.004) return;
    tracePath(s);
    ctx.strokeStyle = color;
    if (glow > 0.01 && QUALITY[Q].glow) {
      ctx.globalAlpha = Math.min(1, alpha * glow * (dark ? 0.15 : 0.085));
      ctx.lineWidth = width * 4 + 4;
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  let wx = null, wy = null, waterGrad = null, gradKey = '';
  // The lake: every row is stroked in one neutral ink, then a single amber → indigo gradient is laid over just
  // those pixels (source-atop). One gradient fill costs about as much as one solid stroke; a gradient stroke per
  // row would cost 2–3× in raster time.
  function getWaterGrad() {
    const key = W + segCol[0] + segCol[SEG - 1];
    if (waterGrad && key === gradKey) return waterGrad;
    gradKey = key;
    const g = ctx.createLinearGradient(0, 0, W, 0);
    for (let i = 0; i < SEG; i++) g.addColorStop((i + 0.5) / SEG, segCol[i]);
    waterGrad = g;
    return g;
  }
  function drawWater(f, t) {
    const w = GW, xL = -W * 0.02, dx = (W * 1.04) / (w - 1), still = wStatic;
    if (!wx || wx.length !== w) { wx = new Float32Array(w); wy = new Float32Array(w); }
    for (let i = 0; i < w; i++) wx[i] = xL + i * dx;
    ctx.strokeStyle = '#000';
    for (let k = 0; k < GH; k++) {
      // Rows fall from the horizon into place, nearest last: the line multiplies into the lake.
      const u = (k + 1) / GH, fk = clamp(f * 1.35 - u * 0.35, 0, 1);
      if (fk <= 0) continue;
      const e = easeMorph(fk), y0 = waterY + (rowY[k] - waterY) * e, a = rowAl[k] * smooth(fk * 1.6);
      if (a < 0.004) continue;
      const sc = rowS[k], sw = still ? 0 : 0.8 * rowNear[k], off = k * GW, ph = k * 0.83;
      let lift = 0;
      for (let i = 0; i < w; i++) {
        const x = wx[i], h = wA[off + i];
        wy[i] = y0 - h * sc + (sw ? sw * (Math.sin(x * 0.0061 + t * 0.33 + ph) + 0.5 * Math.sin(x * 0.0143 - t * 0.47 + ph * 2.3)) : 0);
        if (h > lift) lift = h; else if (-h > lift) lift = -h;
      }
      ctx.beginPath();
      ctx.moveTo(wx[0], wy[0]);
      for (let i = 1; i < w - 1; i++) ctx.quadraticCurveTo(wx[i], wy[i], (wx[i] + wx[i + 1]) * 0.5, (wy[i] + wy[i + 1]) * 0.5);
      ctx.lineTo(wx[w - 1], wy[w - 1]);
      // Ripples catch the light: a row with a ring passing through it brightens a little.
      ctx.globalAlpha = Math.min(1, a * (1 + (still ? 0 : Math.min(1, lift * 2.4))));
      ctx.lineWidth = rowLw[k];
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = getWaterGrad();
    ctx.fillRect(0, waterY - 30, W, CH - waterY + 30);
    ctx.globalCompositeOperation = 'source-over';
  }
  /* ---------------- Text keeps clear of the lines ---------------- */
  // In the quiet modes (day, offline, still) the lines must never read as strike-throughs: every text block in view
  // carves a soft gap where its box crosses them. Text opts in with [data-lines-clear]; headlines, quotes, answers,
  // body copy, FAQ rows and forms do by default. Boxes are read only for elements an IntersectionObserver reports in
  // view, and only on scroll ticks and layout refreshes, never inside the animation loop.
  const CLEAR_SEL = '[data-lines-clear], .t-h2, .t-h3, .t-quote, .t-answer, .t-body, .t-small, .t-label, .kicker, .faq details, .qa, form, .scene__numeral, .scene__kicker, .scene__note, .principle, .ev-raw__line, .ev-item, .room__line, .chip, .seg__btn, .gap__num, .gap__quote, .tl__plot, .tl__name, .blink, .btn';
  const MAXR = 96, rects = new Float32Array(MAXR * 4), pinned = new Uint8Array(MAXR), inView = new Set();
  let nRects = 0, clearDirty = true, rectsAt = -1e9, rectsY = 0;
  const clearIO = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const e of entries) { if (e.isIntersecting) inView.add(e.target); else inView.delete(e.target); }
    clearDirty = true; rectsAt = -1e9;
    if (!running && cur[CL] > 0.01 && live) redrawIdle();
  }) : null;
  const observed = new WeakSet();
  function watchClear() {
    if (!clearIO) return;
    for (const el of document.querySelectorAll(CLEAR_SEL)) {
      if (el.closest('[data-lines-clear="off"]')) continue;
      if (!observed.has(el)) { observed.add(el); clearIO.observe(el); }
    }
    clearDirty = true; rectsAt = -1e9;
  }
  // Boxes are re-read at most every 200 ms (a layout read can force a reflow while other scripts are writing);
  // in between they move with the scroll, except inside a pinned (GSAP .pin-spacer) block, which stays put.
  function readRects(force) {
    const t = now();
    if (!force && t - rectsAt < 200) return;
    clearDirty = false; rectsAt = t; rectsY = scrollY;
    nRects = 0;
    for (const el of inView) {
      if (nRects >= MAXR) break;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < -CH * 0.5 || r.top > CH * 1.5) continue;
      const o = nRects * 4;
      rects[o] = r.left; rects[o + 1] = r.top; rects[o + 2] = r.right; rects[o + 3] = r.bottom;
      pinned[nRects] = el.closest('.pin-spacer') ? 1 : 0;
      nRects++;
    }
  }
  // Erase with stepped alpha at both ends: a 36 px feather, no gradients allocated.
  const FEATHER = 36, STEPS = 9;
  function carve(lo, hi, k) {
    if (k < 0.01 || !nRects) return;
    const padY = 10, padX = 14, dy = rectsY - scrollY;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    for (let i = 0; i < nRects; i++) {
      const o = i * 4, shift = pinned[i] ? 0 : dy, top = rects[o + 1] - padY + shift, bot = rects[o + 3] + padY + shift;
      if (bot < lo || top > hi) continue;
      const l = rects[o] - padX, r = rects[o + 2] + padX, h = bot - top;
      ctx.globalAlpha = k;
      ctx.fillRect(l, top, r - l, h);
      const sw = FEATHER / STEPS;
      for (let j = 0; j < STEPS; j++) {
        ctx.globalAlpha = k * (STEPS - j) / (STEPS + 1);
        ctx.fillRect(l - (j + 1) * sw, top, sw, h);
        ctx.fillRect(r + j * sw, top, sw, h);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function render() {
    if (!ctx || !W) return;
    if (!sized) resizeCanvas();
    readPalette();
    // Build the strings first so the band that needs clearing is known.
    let lo = 1e9, hi = -1e9;
    for (let k = 0; k < 2; k++) {
      const s = S[k];
      if (alphaOf(k) < 0.004) { s.m = 0; continue; }
      buildString(s, k);
      const py = s.py;
      for (let i = 0; i < s.m; i++) { const y = py[i]; if (y < lo) lo = y; if (y > hi) hi = y; }
    }
    const water = waterF > 0.002 && wA;
    if (water) { lo = Math.min(lo, waterY - 30); hi = CH; }
    const pad = 16;
    const a = Math.max(0, Math.min(bandA, lo - pad)), b = Math.min(CH, Math.max(bandB, hi + pad));
    if (b > a) ctx.clearRect(0, a, W, b - a);
    bandA = lo - pad; bandB = hi + pad;
    if (bandA > bandB) { bandA = CH; bandB = 0; }

    if (water) drawWater(waterF, bt);
    const lw = cur[LW], merged = cur[MG], warm = cur[WARM], glow = cur[GL];
    const sT = S[0], sM = S[1];
    const litT = sT.lit, litM = sM.lit;
    // Indigo first: merged, it reads as a thread winding inside the amber cord.
    const litK = cur[AMP] < 0.9 && !dark ? 0.6 : 0.35;
    const meA = Math.min(1, alphaOf(1) * (1 + litM * litK)), themA = Math.min(1, alphaOf(0) * (1 + litT * litK));
    const meW = lw * (1 - merged * 0.3) + litM * 0.35, themW = lw * (1 + merged * 0.3) + litT * 0.35;
    if (warm > 0.99) strokeString(sM, meWarm, meA, meW, glow * (1 + litM));
    else if (warm > 0.01) { strokeString(sM, pal.me, meA * (1 - warm), meW, glow * (1 + litM) * (1 - warm)); strokeString(sM, meWarm, meA * warm, meW, glow * warm); }
    else strokeString(sM, pal.me, meA, meW, glow * (1 + litM));
    strokeString(sT, pal.them, themA, themW, glow * (1 + litT));
    ctx.globalAlpha = 1;
    if (cur[CL] > 0.01) { if (clearDirty) readRects(false); carve(lo - 40, hi + 40, cur[CL]); }
    if (!live) { live = true; host && host.classList.add('is-live'); }
  }

  /* ---------------- The loop ---------------- */
  const ticker = window.gsap && window.gsap.ticker;
  function tick() { if (running) frame(now()); }
  function rafLoop() { rafId = 0; if (!running) return; frame(now()); if (running) rafId = requestAnimationFrame(rafLoop); }
  function start() {
    if (!ctx) return;
    if (!motionOK()) { renderStill(); return; }
    if (running) return;
    running = true; static_ = false; last = now();
    if (ticker) ticker.add(tick); else rafId = requestAnimationFrame(rafLoop);
  }
  function stop() {
    if (!running) return;
    running = false;
    if (ticker) ticker.remove(tick); else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  function updatePose(t) {
    poseFor(mode, tgt, scrollY);
    const k = morphDur > 0 ? clamp((t - morphAt) / morphDur, 0, 1) : 1;
    if (k >= 1) { for (let i = 0; i < NP; i++) cur[i] = tgt[i]; return false; }
    const e = easeMorph(k);
    for (let i = 0; i < NP; i++) cur[i] = from[i] + (tgt[i] - from[i]) * e;
    return true;
  }
  function drawProgress(t) {
    if (drawAt < 0) { S[0].draw = 1; S[1].draw = 1; return false; }
    const a = easeDraw(clamp((t - drawAt) / 900, 0, 1)), b = easeDraw(clamp((t - drawAt - 150) / 900, 0, 1));
    const wasA = S[0].draw, wasB = S[1].draw;
    S[0].draw = a; S[1].draw = b;
    // Tied off at the far end: a small give travels back along the string.
    if (wasA < 1 && a >= 1) tieOff(S[0]);
    if (wasB < 1 && b >= 1) { tieOff(S[1]); drawAt = -1; }
    return true;
  }
  function tieOff(s) { s.pickI = (N - 1) * 0.93; s.pickA = 2.2; s.pickW = 3 * N / 180; s.pickDur = 0.07; s.pickT = 0; }

  function frame(t) {
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    const w0 = now();
    const morphing = updatePose(t);
    const drawing = drawProgress(t);
    if (cur[WA] !== waterF) waterF = cur[WA];
    bt += dt;
    // Breathing fades in while something has happened recently and fades out to a dead-still line afterwards.
    const breathe = QUALITY[Q].breath && t - lastActive < ACTIVE_MS && cur[BR] > 0.01;
    bEnv = clamp(bEnv + (breathe ? dt / 1.2 : -dt / 1.6), 0, 1);
    stepStrings(dt);
    let busy = morphing || drawing || bEnv > 0.001;
    const span = cur[X1] - cur[X0];
    for (let k = 0; k < 2; k++) {
      const s = S[k];
      if (stepPackets(s, dt, span)) busy = true;
      s.lit *= Math.exp(-dt / (cur[AMP] < 0.9 && !dark ? 1.6 : 0.7)); if (s.lit < 0.004) s.lit = 0; else busy = true;
      s.lean += (s.leanTo - s.lean) * Math.min(1, dt * 9);
      if (Math.abs(s.lean - s.leanTo) > 0.01 || Math.abs(s.lean) > 0.01) busy = true;
      if (s.peak > 0 || s.grab || s.pickT < s.pickDur) busy = true;
    }
    if (waterF > 0.002 && wA) {
      const talking = !hush && t - lastActive < WATER_MS && waterF > 0.6;
      if (talking) waterTalk(dt);
      wAcc += dt;
      let n = 0;
      while (wAcc >= WDT && n < 3) { wAcc -= WDT; n++; wPeak = waterStep(); }
      if (wAcc > WDT) wAcc = 0;
      if (talking || wPeak > 0.004) busy = true;
      else if (wPeak > 0) { wA.fill(0); wB.fill(0); wV.fill(0); wPeak = 0; }
    }
    const w1 = now();
    // Half rate (last resort on a raster-bound device): physics every frame, drawing every other frame.
    frameN++;
    if (!halfRate || !(frameN & 1) || grabbed >= 0) render();
    const work = now() - w0;
    if (api.trace) api.trace.push([w1 - w0, work - (w1 - w0)]);
    adapt(work, dt * 1000);
    if (!busy) stop();
  }
  // Two signals: our own script time, and the frame pacing the browser actually delivers (rasterising the strokes
  // happens outside our timer). Pacing is judged against the display's own interval, so a 30 Hz battery-saver
  // display is not mistaken for a slow one. The first 1.5 s after load are ignored (fonts, other modules starting).
  const ring = new Float32Array(48), sorted = new Float32Array(48);
  let ringN = 0, bestP25 = 1e9;
  function adapt(work, dtms) {
    if (adaptOff || dtms > 120) return;
    workEMA += (work - workEMA) * 0.1;
    dtEMA += (dtms - dtEMA) * 0.08;
    ring[ringN++ % 48] = dtms;
    if (now() - bornAt < 1500 || ringN % 24 || ringN < 48) return;
    // Every 24 frames: the display interval is the best 25th percentile of 48 frames seen so far (a 30 Hz
    // display never shows better than 33 ms, so it is never mistaken for a slow one); we are dropping frames when
    // the median sits well above it.
    sorted.set(ring); sorted.sort();
    bestP25 = Math.min(bestP25, Math.max(6.9, sorted[12]));
    const base = bestP25, median = sorted[24];
    const budget = waterF > 0.3 ? 4 : 2;
    if (workEMA > budget * 1.2 || median > base * 1.5) slow++; else if (slow > 0) slow--;
    if (slow >= 3) {
      slow = 0; workEMA = 0; ringN = 0;
      if (Q > 0) setQuality(Q - 1);
      else if (!halfRate) { halfRate = true; try { sessionStorage.setItem('ih-lines-half', '1'); } catch (e) { /* ignore */ } }
    }
  }
  function setQuality(q) {
    Q = q;
    try { sessionStorage.setItem('ih-lines-q', String(Q)); } catch (e) { /* ignore */ }
    setNodes(QUALITY[Q].nodes);
    resizeCanvas();
    if (wA && (GW !== QUALITY[Q].gw || GH !== QUALITY[Q].gh)) buildWater();
  }

  // Still drawing: reduced motion, paused motion, hidden tab. Resting geometry only, drawn on demand.
  function renderStill() {
    if (!ctx) return;
    stop();
    static_ = true;
    poseFor(mode, cur, scrollY);
    waterF = cur[WA];
    S[0].draw = S[1].draw = 1; drawAt = -1; bEnv = 0;
    for (let k = 0; k < 2; k++) { const s = S[k]; s.y.fill(0); s.v.fill(0); s.peak = 0; s.lit = 0; s.lean = s.leanTo = 0; s.grab = false; s.pickT = s.pickDur = 1; s.pk.fill(0); }
    if (waterF > 0.002) { if (!wA) buildWater(); if (!wStatic) waterStill(); }
    render();
  }
  function wake() { activity(); if (motionOK()) start(); else renderStill(); }

  /* ---------------- Modes ---------------- */
  function applyMode(dur) {
    const next = overrideMode || sectionMode || 'day';
    const key = next + '|' + mergeOverride;
    if (key === poseKey) return;
    const t = now();
    poseKey = key;
    // Freeze wherever the lines are now and morph from there to the new pose.
    if (running || static_ || live) { updatePose(t); for (let i = 0; i < NP; i++) from[i] = cur[i]; }
    mode = next;
    morphAt = t; morphDur = dur == null ? 1100 : dur;
    if (mode === 'water' && !wA) buildWater();
    writeVars();
    wake();
  }
  let varsKey = '';
  function writeVars() {
    poseFor(mode, rest, 0);
    const ty = Math.round(rest[TY]), my = Math.round(rest[MY]), hy = Math.round(VH * 0.58), wy = Math.round(VH * 0.42);
    const key = ty + ',' + my + ',' + hy + ',' + wy;
    if (key === varsKey) return;
    varsKey = key;
    const st = root.style;
    st.setProperty('--line-them-y', ty + 'px');
    st.setProperty('--line-me-y', my + 'px');
    st.setProperty('--horizon-y', hy + 'px');
    st.setProperty('--water-y', wy + 'px');
  }

  /* ---------------- Plucking ---------------- */
  const pickMax = () => clamp(VH * 0.036, 14, 32);
  const pullMax = () => clamp(VH * 0.085, 40, 84) * Math.max(0.55, cur[AMP]);
  function emitPluck(k, xFrac, strength) {
    const t = now(), s = S[k];
    if (t - s.emitAt < 90 || t - lastEmit < 40) return;
    s.emitAt = lastEmit = t;
    IH.emit('pluck', { who: s.who, x: Math.round(clamp(xFrac, 0, 1) * 1000) / 1000, strength: Math.round(clamp(strength, 0, 1) * 100) / 100 });
  }
  function pickString(s, u, strength, dir) {
    const st = clamp(strength, 0, 1);
    s.pickI = clamp(u, 0.01, 0.99) * (N - 1);
    s.pickA = dir * pickMax() * (0.08 + 0.92 * Math.pow(st, 0.9));
    s.pickW = (6.5 - 3.4 * st) * (N / 180);
    s.pickDur = 0.085 - 0.05 * st;
    s.pickT = 0;
    s.lit = Math.max(s.lit, 0.3 + 0.55 * st);
  }
  // Pluck string k where the pointer crossed it (viewport x), dir = which way the pointer was moving.
  function pluckAt(k, x, strength, dir, emit) {
    const x0 = cur[X0], span = cur[X1] - x0;
    if (span <= 0) return;
    const u = (x - x0) / span;
    if (u <= 0 || u >= 1) return;
    const merged = cur[MG] > 0.5;
    if (motionOK() && !static_) {
      pickString(S[k], u, strength, dir);
      if (merged) pickString(S[k ^ 1], u, strength * 0.92, dir);
      wake();
    }
    if (emit) emitPluck(merged ? (x < W / 2 ? 0 : 1) : k, x / W, strength);
  }

  /* ---------------- Pointer ---------------- */
  let pX = 0, pY = 0, pT = 0, pIn = false, grabbed = -1, near = false, wEmitAt = -1e9;
  const interactive = el => !!(el && el.closest && el.closest('a,button,input,textarea,select,label,summary,option,[role="button"],[role="slider"],[contenteditable],[data-lines-ignore]'));
  function setNear(v) { if (v !== near) { near = v; root.classList.toggle('lines-near', v); } }

  function crossings(x0, y0, x1, y1, dtm) {
    for (let k = 0; k < 2; k++) {
      if (alphaOf(k) < 0.05) continue;
      if (k === 1 && cur[MG] > 0.5) continue; // merged: one cord
      const a = stringY(k, x0), b = stringY(k, x1);
      if (!(a === a) || !(b === b)) continue;
      const d0 = y0 - a, d1 = y1 - b;
      if (d0 === 0 || (d0 < 0) === (d1 < 0)) continue;
      const t = d0 / (d0 - d1), xc = x0 + (x1 - x0) * t;
      const vy = Math.abs(y1 - y0) / dtm, vx = Math.abs(x1 - x0) / dtm; // px per ms
      const strength = clamp(Math.pow(clamp((vy + vx * 0.15 - 0.03) / 1.8, 0, 1), 0.75), 0.06, 1);
      pluckAt(k, xc, strength, y1 > y0 ? 1 : -1, true);
    }
  }
  function proximity(x, y) {
    let close = false, any = false;
    for (let k = 0; k < 2; k++) {
      const s = S[k];
      const sy = alphaOf(k) > 0.05 ? stringY(k, x) : NaN;
      if (!(sy === sy)) { s.leanTo = 0; continue; }
      const dy = y - sy, ady = Math.abs(dy);
      if (ady < 90) any = true;
      if (ady < 20) close = true;
      // Lean toward the pointer, at most ~2 px, falling to zero right at the string so a crossing is seamless.
      s.leanTo = static_ ? 0 : dy * 0.1 * Math.exp(-(dy * dy) / (40 * 40)) * Math.min(1, cur[AMP] * 1.5);
      s.leanX = x;
    }
    setNear(close && grabbed < 0);
    if (any || running) { activity(); if (motionOK()) start(); }
  }
  function stir(x0, y0, x1, y1, dtm) {
    if (hush) return;
    if (!wA || waterF < 0.5 || y1 < waterY + 4) return;
    const speed = Math.hypot(x1 - x0, y1 - y0);
    const c0 = (x0 + W * 0.02) / (W * 1.04) * (GW - 1), c1 = (x1 + W * 0.02) / (W * 1.04) * (GW - 1);
    const r0 = waterRow(Math.max(y0, waterY + 4)), r1 = waterRow(y1);
    const depth = Math.min(speed / 40, 1) * 0.11;
    if (motionOK() && !static_ && depth > 0.002) {
      const steps = Math.max(1, Math.ceil(Math.hypot(c1 - c0, r1 - r0) / 1.2));
      for (let i = 1; i <= steps; i++) { const t = i / steps; waterDrop(c0 + (c1 - c0) * t, r0 + (r1 - r0) * t, 1.4, depth / steps); }
      wake();
    }
    const v = speed / dtm, t = now();
    if (v > 0.9 && t - wEmitAt > 260) { wEmitAt = t; emitPluck(x1 < W / 2 ? 0 : 1, x1 / W, clamp(v / 3, 0.1, 0.8)); }
  }
  function grabAt(k, x, y) {
    const s = S[k], x0 = cur[X0], span = cur[X1] - x0;
    const u = clamp((x - x0) / span, 0.01, 0.99);
    grabbed = k;
    s.grab = true; s.grabI = u * (N - 1);
    const f = s.grabI | 0;
    s.grabA = s.y[f]; s.grabTo = s.grabA;
    s.pickT = s.pickDur = 1; s.leanTo = 0; S[k ^ 1].leanTo = 0;
    root.classList.add('lines-grabbing');
    setNear(false);
    moveGrab(x, y);
    wake();
  }
  function moveGrab(x, y) {
    const k = grabbed, s = S[k], x0 = cur[X0], span = cur[X1] - x0;
    const u = clamp((x - x0) / span, 0.01, 0.99);
    s.grabI = u * (N - 1);
    const d = y - cur[k ? MY : TY], L = pullMax();
    s.grabTo = (L * Math.tanh(d / L)) / Math.max(0.3, cur[AMP]);
    if (cur[MG] > 0.5) { const o = S[k ^ 1]; o.grab = true; o.grabI = s.grabI; o.grabTo = s.grabTo; if (!o.grabA) o.grabA = s.grabA; }
    if (Math.abs(d) > L * 2.3) release(); // pulled too far: it slips out of the hand
    activity();
  }
  function release() {
    if (grabbed < 0) return;
    const k = grabbed, s = S[k];
    const strength = clamp(Math.abs(s.grabA * cur[AMP]) / pullMax(), 0, 1);
    s.grab = false; s.lit = Math.max(s.lit, 0.4 + 0.5 * strength);
    const o = S[k ^ 1];
    if (o.grab) { o.grab = false; o.lit = s.lit; }
    grabbed = -1;
    root.classList.remove('lines-grabbing');
    if (strength > 0.05) emitPluck(cur[MG] > 0.5 ? (pX < W / 2 ? 0 : 1) : k, pX / W, strength);
    wake();
  }

  function onMove(e) {
    const x = e.clientX, y = e.clientY, t = e.timeStamp || now();
    if (!pIn) { pX = x; pY = y; pT = t; pIn = true; if (e.pointerType === 'mouse') proximity(x, y); return; }
    const dtm = Math.max(4, t - pT);
    if (grabbed >= 0) moveGrab(x, y);
    else {
      crossings(pX, pY, x, y, dtm);
      if (e.pointerType === 'mouse') proximity(x, y);
    }
    if (waterF > 0.5) stir(pX, pY, x, y, dtm);
    pX = x; pY = y; pT = t;
  }
  function onDown(e) {
    pX = e.clientX; pY = e.clientY; pT = e.timeStamp || now(); pIn = true;
    if (e.button > 0 || interactive(e.target)) return;
    const touch = e.pointerType !== 'mouse';
    const reach = (touch ? 30 : 20) * (cur[AMP] < 0.7 ? 0.6 : 1);
    let best = -1, bestD = reach;
    for (let k = 0; k < 2; k++) {
      if (alphaOf(k) < 0.05) continue;
      const sy = stringY(k, pX);
      if (sy === sy && Math.abs(pY - sy) < bestD) { bestD = Math.abs(pY - sy); best = k; }
    }
    if (best >= 0) {
      if (cur[MG] > 0.5) best = 0;
      // Touch: a tap plucks (a drag would become a scroll). Mouse: press and hold.
      if (touch || !motionOK() || static_) pluckAt(best, pX, 0.5, pY < stringY(best, pX) ? 1 : -1, true);
      else grabAt(best, pX, pY);
    } else if (!hush && waterF > 0.5 && pY > waterY + 4 && wA) {
      if (motionOK() && !static_) { waterDrop((pX + W * 0.02) / (W * 1.04) * (GW - 1), waterRow(pY), 1.8, 0.55); wake(); }
      emitPluck(pX < W / 2 ? 0 : 1, pX / W, 0.45);
    }
  }
  function onUp() { if (grabbed >= 0) release(); }
  function onLeave(e) { if (!e.relatedTarget) { pIn = false; S[0].leanTo = S[1].leanTo = 0; setNear(false); if (running || motionOK()) start(); } }

  /* ---------------- Voices and turns ---------------- */
  function onVoice(d) {
    if (!d || (hush && waterF > 0.5)) return;
    const k = d.who === 'me' ? 1 : 0, s = S[k], level = clamp(d.level == null ? 0.6 : +d.level, 0, 1), t = now();
    if (!motionOK() || static_ || !ctx) return;
    activity();
    if (waterF > 0.5 && wA) {
      if (t - s.packetAt > 140) { waterDrop(sourceX(k) + (rand() - 0.5) * 2, sourceY() + (rand() - 0.5) * 2, 1.5, 0.25 + 0.35 * level); s.packetAt = t; }
    } else if (t - s.packetAt > 110) {
      // Low, dim strings (day, still) get a relatively larger wave so a spoken line stays visible on them.
      // On light paper a hairline wave reads far weaker than on dark, so it is twice as tall there and travels slower
      // (about 4 s across instead of 2) so it is still moving while the answer finishes surfacing.
      const low = cur[AMP] < 0.9, light = low && !dark;
      const quiet = low ? (1.5 / Math.max(0.4, cur[AMP])) * (light ? 2 : 1) : 1;
      const speed = light ? Math.max(260, W * 0.24) : Math.max(420, W * 0.5);
      addPacket(s, speed, (1.3 + 3.4 * level) * (isMobile() ? 0.8 : 1) * quiet, light ? 80 : 64, 72, t);
    } else {
      // Words closer together than the packets: the newest packet carries the louder level instead.
      let o = -1, p = 1e9; const pk = s.pk;
      for (let j = 0; j < PK; j++) if (pk[j * PF + 2] !== 0 && pk[j * PF] < p) { p = pk[j * PF]; o = j * PF; }
      if (o >= 0) pk[o + 2] = Math.max(pk[o + 2], (1.3 + 3.4 * level) * (cur[AMP] < 0.9 ? (1.5 / Math.max(0.4, cur[AMP])) * (dark ? 1 : 2) : 1));
    }
    s.lit = Math.max(s.lit, (cur[AMP] < 0.9 ? (dark ? 0.45 : 0.85) : 0.15) + 0.3 * level);
    start();
  }
  function onTurn(d) {
    if (!d || (hush && waterF > 0.5)) return;
    const k = d.who === 'me' ? 1 : 0, s = S[k];
    if (!motionOK() || static_ || !ctx) return;
    activity();
    if (waterF > 0.5 && wA) waterDrop(sourceX(k), sourceY(), 2.4, 0.9);
    else addPacket(s, Math.max(760, W * 0.8), isMobile() ? 6 : 8, 110, 0, now());
    s.lit = 1;
    start();
  }

  /* ---------------- Hush: the waitlist sheet is open ---------------- */
  // While #join has .is-joining the frosted sheet blurs whatever is behind it, so the lake stops talking and
  // stirring and settles; the loop then stops by itself. Removing the class lets it speak again.
  let hush = false;
  const joinEl = document.getElementById('join');
  if (joinEl && 'MutationObserver' in window) {
    const sync = () => {
      const h = joinEl.classList.contains('is-joining');
      if (h === hush) return;
      hush = h;
      if (!hush) { activity(); if (motionOK() && !static_) start(); }
    };
    new MutationObserver(sync).observe(joinEl, { attributes: true, attributeFilter: ['class'] });
    sync();
  }

  /* ---------------- API ---------------- */
  const api = {
    get mode() { return mode; },
    get live() { return live; },
    geometry() {
      poseFor(mode, rest, 0);
      return { mode, themY: rest[TY], meY: rest[MY], horizonY: VH * 0.58, waterY: VH * 0.42, merged: rest[MG] > 0.5, x0: rest[X0], x1: rest[X1] };
    },
    pluck(who, x = 0.5, strength = 0.6, opts = {}) {
      const k = who === 'me' ? 1 : 0, vx = clamp(+x || 0, 0, 1) * W;
      if (waterF > 0.5 && wA) {
        if (motionOK() && !static_) { waterDrop(sourceX(k), sourceY(), 1.8, 0.3 + 0.5 * strength); wake(); }
        if (!opts.silent) emitPluck(k, vx / W, strength);
        return;
      }
      pluckAt(k, vx, clamp(+strength || 0, 0, 1), opts.dir || 1, !opts.silent);
    },
    /** Diagnostics: quality level, smoothed cost of our frame (ms), whether the loop runs. */
    stats() { return { hush, soft, quality: Q, half: halfRate, work: Math.round(workEMA * 100) / 100, frame: Math.round(dtEMA * 10) / 10, running, dpr: DPR, nodes: N, grid: GW + '×' + GH, wPeak: Math.round(wPeak * 1000) / 1000 }; },
    quality(q, hold) { setQuality(clamp(q | 0, 0, 2)); adaptOff = !!hold; if (!running) render(); },
    setMode(name, opts = {}) { overrideMode = MODES.includes(name) ? name : null; applyMode(opts.duration); },
    merge(on) { mergeOverride = on == null ? null : !!on; applyMode(); }
  };
  IH.lines = api;

  IH.on('section', s => {
    if (!s) return;
    // A request ('lines' event) holds until the page moves to a section with another lines mode.
    if (s.lines !== sectionKey) { sectionKey = s.lines; overrideMode = null; mergeOverride = null; }
    sectionMode = MODES.includes(s.lines) ? s.lines : 'day';
    applyMode();
  });
  IH.on('lines', d => {
    if (!d) return;
    if ('mode' in d) overrideMode = MODES.includes(d.mode) ? d.mode : null;
    if ('merge' in d) mergeOverride = d.merge == null ? null : !!d.merge;
    applyMode(d.duration);
  });
  IH.on('section', () => watchClear());
  IH.on('voice', onVoice);
  IH.on('turn', onTurn);
  IH.on('motion', ok => { if (ok) { static_ = false; wake(); } else renderStill(); });
  let settleT = 0;
  function redrawIdle() {
    if (running) return;
    if (static_) renderStill(); else { poseFor(mode, cur, scrollY); render(); }
  }
  IH.on('tick', () => {
    clearDirty = true;
    if (!ctx || running) return;
    if (cur[CL] > 0.01 && live) {
      redrawIdle();
      clearTimeout(settleT);
      settleT = setTimeout(() => { rectsAt = -1e9; clearDirty = true; redrawIdle(); }, 240);
      return;
    }
    // Idle: redraw only when something on screen depends on the scroll — the hero strings or the colour.
    const palChanged = IH.palette !== palSeen;
    if (mode === 'hero' && motionOK() && !static_) { activity(); start(); return; }
    if (mode === 'hero' || palChanged) {
      if (static_) renderStill();
      else { poseFor(mode, cur, scrollY); render(); }
    }
    if (waterF > 0.5 && !hush && motionOK()) { activity(); start(); }
  });

  /* ---------------- Start ---------------- */
  sectionMode = (IH.state && IH.state.lines) || 'hero';
  if (!MODES.includes(sectionMode)) sectionMode = 'day';
  sectionKey = sectionMode;
  mode = sectionMode; poseKey = mode + '|null';
  measure();
  writeVars();
  poseFor(mode, cur, scrollY);
  watchClear();
  if (!ctx) {
    host && host.classList.add('is-fallback');
    return;
  }
  resizeCanvas();
  if (mode === 'water') buildWater();
  poseFor(mode, cur, scrollY);
  for (let i = 0; i < NP; i++) from[i] = cur[i];
  waterF = cur[WA];
  if (motionOK()) {
    // First load: the strings draw in from the left, amber first, indigo 150 ms later.
    drawAt = now() + 60;
    if (waterF > 0.002) { drawAt = -1; for (let i = 0; i < NP; i++) from[i] = cur[i]; from[WA] = 0; morphAt = now(); morphDur = 1600; }
    S[0].draw = S[1].draw = 0;
    activity();
    start();
  } else renderStill();

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('pointerup', onUp, { passive: true });
  addEventListener('pointercancel', onUp, { passive: true });
  document.addEventListener('pointerout', onLeave, { passive: true });
  addEventListener('blur', onUp);
  // Holding a string must not start a text selection (mouse only; touch never reaches the grab).
  addEventListener('mousedown', e => { if (grabbed >= 0) e.preventDefault(); });
  document.addEventListener('selectstart', e => { if (grabbed >= 0) e.preventDefault(); });

  let resizeQ = false;
  function onResize() {
    resizeQ = false;
    const w = W, h = CH;
    measure();
    if (w !== W || h !== CH) resizeCanvas();
    if (wA) layoutWater();
    writeVars();
    if (running) return;
    if (static_ || !motionOK()) renderStill(); else { poseFor(mode, cur, scrollY); render(); }
  }
  addEventListener('resize', () => { if (!resizeQ) { resizeQ = true; requestAnimationFrame(onResize); } });
  const relayout = () => { watchClear(); readSlot(); writeVars(); if (!running) { if (static_) renderStill(); else if (live) { poseFor(mode, cur, scrollY); render(); } } };
  // gap.js adds/removes .gap-pinned as it (un)pins; the gap pose depends on it.
  if ('MutationObserver' in window) new MutationObserver(() => { if (mode === 'gap') relayout(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
  if (window.ScrollTrigger && window.ScrollTrigger.addEventListener) window.ScrollTrigger.addEventListener('refresh', relayout);
  document.fonts && document.fonts.ready.then(relayout);
  addEventListener('load', () => { relayout(); setTimeout(relayout, 1200); });
  fineMQ.addEventListener && fineMQ.addEventListener('change', () => setNear(false));
})();
