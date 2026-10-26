// Turn — the dusk interlude (18:10). Evening agent.
//
// The page turns from day to night here. Large screens with motion (.is-pinned): the stage holds still while the
// reader's scroll does three things in order —
//   1. the turn: the sun comes down onto the horizon while the paper goes from afternoon to dusk. No text is on
//      screen while the colour passes mid-lightness (the anchors below place core.js's blend exactly here).
//   2. the moments: the stanzas rise from below, slower than the page, parting around the sun as they pass it
//      (offset most at its height), fading in and out with opacity and a slight scale. Each quoted line that
//      crosses the horizon sends a small 'voice' along the amber string.
//   3. the set: the closing line rises while the sun sinks below the horizon ahead of it (a blink), and comes to
//      rest in the sky where the sun was. The clock reaches 19:30.
// Everywhere else (.is-static: phones, short screens, reduced motion): a still sunset above staggered stanzas,
// with on-enter reveals when motion is allowed; the colour turns while only the sunset is on screen.
// Without script: the same still layout on the day's paper. Only transform and opacity are animated; the sun's
// blur is static, and its slow turn (CSS) runs only while it is on screen and motion is allowed.
(() => {
  const IH = window.IH;
  const section = document.querySelector('[data-dusk]');
  if (!IH || !section) return;
  const hasGsap = typeof window.gsap !== 'undefined' && !!window.ScrollTrigger;
  const root = document.documentElement;
  const $ = s => section.querySelector(s);
  const $$ = (s, el = section) => [...el.querySelectorAll(s)];
  const stage = $('[data-dusk-stage]'), air = $('.dusk__air'), col = $('[data-dusk-col]'), end = $('[data-dusk-end]');
  const lift = $('[data-dusk-lift]'), orb = $('[data-dusk-orb]'), dip = $('[data-dusk-dip]'), band = $('[data-dusk-band]');
  const horizon = $('[data-dusk-horizon]'), glow = $('.dusk__glow'), core = $('.dusk__core'), turnA = $('.dusk__turn');
  const markBefore = $('[data-dusk-mark="before"]'), markAfter = $('[data-dusk-mark="after"]');
  const colLines = $$('.dl', col), endLines = $$('.dl', end), allLines = [...colLines, ...endLines];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const c01 = v => clamp(v, 0, 1);
  const smooth = t => { t = c01(t); return t * t * (3 - 2 * t); };
  // core.js holds a stretch's colour for its first 62% and blends over the last 38% (smoothstep).
  const HOLD = 0.62;

  let mode = 'none'; // 'pinned' | 'static'
  const M = { ready: false };
  const docTop = el => el.getBoundingClientRect().top + scrollY;

  /* ---------------- Anchors: where the clock and the colour turn ---------------- */
  // The y at which the previous anchor (the day's last scene) starts, so ours never sort before it.
  function prevAnchorY() {
    // The last anchor before this section (the section's own anchors don't count: the section sorts first in the DOM).
    const all = [...document.querySelectorAll('[data-time]')].filter(el => !section.contains(el));
    const prev = all.filter(el => el.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).pop();
    return prev ? docTop(prev) - innerHeight * 0.5 : -Infinity;
  }
  function turnWindow() {
    const H = innerHeight, top = docTop(section);
    if (mode === 'pinned') return { top, start: top - 0.2 * H, end: top + 0.8 * H };
    // Static: the colour turns while the sunset alone fills the screen — from its top reaching the middle of the
    // screen until just before the title comes up from the bottom edge.
    const airH = air.offsetHeight || H;
    const pad = parseFloat(getComputedStyle(col).paddingTop) || 0;
    return { top, start: top - 0.5 * H, end: top + Math.max(0.2 * H, airH - H + pad * 0.5) };
  }
  const anchorBefore = () => {
    const w = turnWindow(), len = w.end - w.start;
    return Math.max(w.start - len * HOLD / (1 - HOLD), prevAnchorY() + innerHeight * 0.1);
  };
  const anchorDusk = () => turnWindow().end;
  const anchorAfter = () => {
    const top = docTop(section);
    if (mode === 'pinned' && M.ready) return top + M.uRest;
    return top + section.offsetHeight - innerHeight * 0.5;
  };
  let anchored = false;
  function registerAnchors() {
    if (anchored) return;
    anchored = true;
    IH.anchorAt(markBefore, anchorBefore);
    IH.anchorAt(section, anchorDusk);
    IH.anchorAt(markAfter, anchorAfter);
  }

  /* ---------------- The sun keeps turning while it is seen ---------------- */
  let seen = false;
  function syncLive() { section.classList.toggle('is-live', mode === 'pinned' && seen && IH.motionOK()); }
  IH.inView(section, on => { seen = on; syncLive(); });
  IH.on('motion', syncLive);

  /* ---------------- Lines: a horizon while the sun is down here; quiet otherwise ---------------- */
  let wantLines = null, sentLines = undefined, linesDirty = true;
  IH.on('section', s => {
    // Only our own anchors re-assert the request (a section change resets requests in lines.js).
    if (s && s.id === 'dusk') linesDirty = true;
    // Static layout: the scrolling picture has its own horizon, so the background lines stay low and dim.
    if (mode === 'static' && s && s.lines === 'dusk') IH.emit('lines', { mode: 'still' });
  });
  function syncLines() {
    if (wantLines === sentLines && (!linesDirty || wantLines === null)) return;
    sentLines = wantLines; linesDirty = false;
    IH.emit('lines', { mode: wantLines });
  }

  /* ---------------- Pinned ---------------- */
  const SLOW = 1.6; // the text moves at 1 / SLOW of the page
  const sets = new Map();
  const setter = (el, prop, unit) => {
    const key = el; let m = sets.get(key);
    if (!m) { m = {}; sets.set(key, m); }
    return m[prop] || (m[prop] = gsap.quickSetter(el, prop, unit));
  };
  let crossed = [];

  function measure() {
    gsap.set([col, end, lift, orb, dip, band, horizon, glow, core, turnA, ...allLines], { clearProps: 'transform,opacity' });
    section.style.height = '';
    const H = stage.clientHeight || innerHeight, W = stage.clientWidth || innerWidth;
    const hzVar = parseFloat(getComputedStyle(root).getPropertyValue('--horizon-y'));
    const sun = lift.offsetWidth;
    M.H = H; M.W = W; M.sun = sun; M.R = sun / 2;
    M.hz = hzVar > 0 && hzVar < H ? hzVar : H * 0.58;
    const c = col.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(col).rowGap) || H * 0.12;
    const clearX = Math.max(28, W * 0.03), base = W * 0.034;
    M.lines = colLines.map(l => {
      const r = l.getBoundingClientRect();
      const side = l.closest('[data-side="r"]') ? 1 : -1;
      // How far it must move out to clear the sun's disc, and how far it may move before the screen edge.
      const need = side < 0 ? r.right - (W / 2 - M.R - clearX) : (W / 2 + M.R + clearX) - r.left;
      const edge = Math.max(20, W * 0.022), room = side < 0 ? r.left - edge : W - edge - r.right;
      return { el: l, mid: r.top - c.top + r.height / 2, h: r.height, side, amp: clamp(base + Math.max(0, need), 0, Math.max(0, room)), short: Math.max(0, need) > room + 1, them: l.classList.contains('voice-them') };
    });
    const e = end.getBoundingClientRect();
    M.endH = e.height;
    M.endLines = endLines.map(l => { const r = l.getBoundingClientRect(); return { el: l, mid: r.top - e.top + r.height / 2 }; });
    const colH = col.offsetHeight, last = M.lines[M.lines.length - 1];
    M.colY0 = H + 12;
    M.colY1 = H * 0.05 - last.mid;
    M.endFollow = colH + gap * 1.5;
    M.endRest = Math.max(H * 0.16, M.hz - sun * 0.72 - M.endH / 2);
    M.u0 = 0.6 * H; // the title starts to rise once the paper is past its turn (see turnWindow)
    const uAt = colY => M.u0 + (M.colY0 - colY) * SLOW;
    M.uColEnd = uAt(M.colY1);
    M.uEndIn = uAt(H - M.endFollow);
    M.uSet = uAt(M.hz + 24 - M.endFollow);
    M.uRest = uAt(M.endRest - M.endFollow);
    // The sun comes down exactly while the paper turns: core.js blends over the last 38% of [before, dusk].
    const top = docTop(section), b0 = anchorBefore(), b1 = anchorDusk(), bs = b0 + (b1 - b0) * HOLD;
    M.turnStart = bs - top; M.turnLen = Math.max(1, b1 - bs);
    M.pin = Math.max(M.uColEnd, M.uRest) + 0.4 * H;
    section.style.height = Math.round(M.pin + H) + 'px';
    M.ready = true;
    crossed = M.lines.map(() => false);
    if (M.lines.some(l => l.short)) section.dataset.duskTight = '1'; else delete section.dataset.duskTight;
  }

  function render(u) {
    if (!M.ready) return;
    const { H, R, hz } = M;
    // 1. The turn: same window and curve as core.js's colour blend.
    const a = smooth((u - M.turnStart) / M.turnLen);
    // 2. The column rises slower than the page.
    const colY = M.colY0 - clamp(u - M.u0, 0, M.uColEnd - M.u0) / SLOW;
    // 3. The closing line follows the column and rests above where the sun was; the sun sets ahead of it.
    const endY = Math.max(M.endRest, colY + M.endFollow);
    const s = smooth((H - endY) / Math.max(1, H - hz - 24));
    const creep = c01((u - M.turnStart - M.turnLen) / Math.max(1, M.uEndIn - M.turnStart - M.turnLen));
    const sink = 0.1 * creep * (1 - s) + s;

    setter(lift, 'y', 'px')(-(1 - a) * M.sun * 0.95 + sink * (R + 34));
    setter(orb, 'rotation', 'deg')(u / H * 34);
    setter(orb, 'scale')(0.86 + 0.14 * a);
    setter(core, 'opacity')(0.4 + 0.6 * a);
    setter(turnA, 'opacity')(0.55 + 0.45 * a);
    // The glow grows as the sun nears the horizon, and lingers a little after it has gone.
    setter(glow, 'opacity')((0.25 + 0.75 * a) * (1 - 0.55 * s));
    setter(band, 'opacity')((0.3 + 0.7 * a) * (1 - 0.45 * s));
    setter(dip, 'opacity')((0.25 + 0.75 * a) * (1 - s));
    setter(dip, 'scaleY')((0.5 + 0.5 * a) * (1 - 0.55 * s));
    setter(horizon, 'opacity')((0.45 + 0.55 * a) * (1 - 0.7 * s));
    setter(col, 'y', 'px')(colY);
    setter(end, 'y', 'px')(endY);

    // The disc still above the horizon: lines part around it, most while they pass its height.
    const top = hz - R * (1 - sink) - 18, bottom = hz + 6, fall = H * 0.22;
    for (let i = 0; i < M.lines.length; i++) {
      const L = M.lines[i], y = colY + L.mid, sy = y / H;
      const d = Math.max(0, top - (y + L.h / 2), (y - L.h / 2) - bottom);
      const bell = Math.exp(-(d / fall) * (d / fall)) * (1 - sink);
      const k = smooth(Math.min((1 - sy) / 0.16, (sy - 0.07) / 0.2));
      setter(L.el, 'x', 'px')(L.side * L.amp * bell);
      setter(L.el, 'opacity')(k);
      setter(L.el, 'scale')(sy > 0.5 ? 0.955 + 0.045 * k : 0.975 + 0.025 * k);
      // A quoted line crossing the horizon on the way up: a small ripple runs along the other side's string.
      const above = y < hz;
      if (L.them && above !== crossed[i]) {
        if (above && IH.motionOK() && k > 0.5) IH.emit('voice', { who: 'them', level: 0.32, ms: 600 });
        crossed[i] = above;
      }
    }
    for (const L of M.endLines) {
      const sy = (endY + L.mid) / H;
      const k = smooth((1 - sy) / 0.2);
      setter(L.el, 'opacity')(k);
      setter(L.el, 'scale')(0.955 + 0.045 * k);
    }
    // The strings are the horizon while the sun is down here; once the stage leaves they go back to a quiet baseline.
    // Once the stage has gone, the request is withdrawn and the lines follow the sections again.
    wantLines = u <= -0.15 * H || u >= M.pin + 0.7 * H ? null : u < M.pin + 2 ? 'dusk' : 'day';
    syncLines();
  }

  function setupPinned() {
    mode = 'pinned';
    section.classList.add('is-pinned');
    section.classList.remove('is-static');
    measure();
    registerAnchors();
    const proxy = { u: scrollY - docTop(section) };
    const draw = () => render(proxy.u);
    const follow = gsap.quickTo(proxy, 'u', { duration: IH.lenis ? 0.32 : 0.55, ease: 'power3.out', onUpdate: draw });
    const target = () => scrollY - docTop(section);
    const onInit = () => measure();
    ScrollTrigger.addEventListener('refreshInit', onInit);
    const st = ScrollTrigger.create({
      trigger: section, start: 'top bottom', end: 'bottom top',
      onUpdate: () => { if (IH.motionOK()) follow(target()); else { proxy.u = target(); follow.tween?.kill?.(); draw(); } },
      onRefresh: () => { proxy.u = target(); draw(); },
      onToggle: self => { if (!self.isActive) { proxy.u = target(); draw(); } }
    });
    draw();
    syncLive();
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', onInit);
      st.kill();
      gsap.killTweensOf(proxy);
      section.classList.remove('is-pinned', 'is-live');
      section.style.height = '';
      gsap.set([col, end, lift, orb, dip, band, horizon, glow, core, turnA, ...allLines], { clearProps: 'transform,opacity' });
      sets.clear();
      M.ready = false;
      wantLines = null; syncLines();
      mode = 'none';
    };
  }

  /* ---------------- Static ---------------- */
  function setupStatic(motion) {
    mode = 'static';
    section.classList.add('is-static');
    registerAnchors();
    const tweens = [];
    if (motion && hasGsap) {
      // Each stanza surfaces once as it enters: lines rise 0.4em out of nothing, 70 ms apart.
      for (const st of $$('.dusk__st')) {
        tweens.push(gsap.from($$('.dl', st), { opacity: 0, y: '0.4em', duration: 0.6, stagger: 0.07, ease: IH.ease.settle, scrollTrigger: { trigger: st, start: 'top 86%', once: true } }));
      }
    }
    if (IH.state?.lines === 'dusk') IH.emit('lines', { mode: 'still' });
    return () => {
      for (const t of tweens) { t.scrollTrigger?.kill(); t.revert(); }
      section.classList.remove('is-static');
      mode = 'none';
    };
  }

  /* ---------------- Start ---------------- */
  if (!hasGsap) { setupStatic(false); return; }
  const mm = gsap.matchMedia();
  mm.add({ big: '(min-width: 820px) and (min-height: 640px)', ok: '(prefers-reduced-motion: no-preference)' }, ctx => {
    const { big, ok } = ctx.conditions;
    const undo = big && ok ? setupPinned() : setupStatic(ok);
    requestAnimationFrame(() => ScrollTrigger.refresh());
    return undo;
  });
  // Diagnostics for the screenshot scripts.
  IH.dusk = { get mode() { return mode; }, get m() { return M; } };
})();
