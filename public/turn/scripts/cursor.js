// Turn — cursor. Fine pointers with motion allowed only; everyone else keeps the system cursor and nothing here runs.
//
// An ink dot sits exactly on the pointer (written in the pointer event itself, never smoothed), and a 28 px ring
// follows on a critically damped spring. States, by priority:
//   text fields (input, textarea, select, contenteditable)  → custom cursor hides, the system caret shows
//   [data-cursor="hide"]                                     → custom cursor hides, system cursor shows
//   links, buttons, switches, tabs, summary, labels, [data-cursor="hot"]
//                                                            → ring tightens around a smaller indigo dot
//   [data-cursor="caret"]  (headlines, answers)              → the dot becomes a thin blinking indigo text caret
//                                                              sized to the element's type ("your turn")
//   within reach of either line (lines.js: html.lines-near / lines-grabbing; modes hero/gap/day/offline/water),
//   or [data-cursor="pluck"]                                 → ring stretches sideways in that line's colour, with "~"
//   [data-cursor-label="…"]                                  → a small mono label beside the ring (combines with any)
// Colours come from the palette variables, so on dark paper the dot inverts by itself; over indigo buttons
// (or [data-cursor-tone="light"]) it turns paper-coloured.
(() => {
  const IH = window.IH;
  if (!IH) return;
  const root = document.documentElement;
  const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
  const PLUCK_MODES = new Set(['hero', 'gap', 'day', 'offline', 'water']);
  const NEAR = 24;

  const FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="color"]):not([type="file"]), textarea, select, [contenteditable]:not([contenteditable="false"])';
  const HOT = 'a[href], button, [role="button"], [role="switch"], [role="tab"], [role="checkbox"], [role="radio"], [role="option"], [role="menuitem"], summary, label, input[type="checkbox"], input[type="radio"], input[type="range"], input[type="button"], input[type="submit"], input[type="reset"], [data-cursor="hot"]';
  const ON_INK = '.btn--me, [data-cursor-tone="light"]'; // indigo on indigo would vanish

  let el = null, dot, ring, label, glyph;
  let active = false, shown = false;
  let x = -100, y = -100, rx = -100, ry = -100, vx = 0, vy = 0;
  let raf = 0, last = 0, moveTimer = 0, scrollQueued = false;
  let target = null, state = '', lineWho = '', labelW = 0, flipped = false;
  // Near the right edge the label moves to the other side of the ring.
  function flip() {
    const f = !!labelW && x > innerWidth - labelW - 48;
    if (f !== flipped) { flipped = f; el.classList.toggle('is-flip', f); }
  }

  const allowed = () => fineMQ.matches && !IH.reduced && !IH.paused;

  function build() {
    el = document.createElement('div');
    el.className = 'cursor';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="cursor__dot"><i></i></div><div class="cursor__ring"><i></i><b class="cursor__glyph">~</b><span class="cursor__label"></span></div>';
    dot = el.children[0]; ring = el.children[1];
    glyph = ring.querySelector('.cursor__glyph'); label = ring.querySelector('.cursor__label');
    document.body.append(el);
  }

  function activate() {
    if (active || !allowed()) return;
    if (!el) build();
    active = true;
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', onDown, { passive: true });
    addEventListener('pointerup', onUp, { passive: true });
    addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    addEventListener('blur', hide);
  }
  function deactivate() {
    if (!active) return;
    active = false;
    hide();
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerdown', onDown);
    removeEventListener('pointerup', onUp);
    removeEventListener('scroll', onScroll);
    document.removeEventListener('pointerout', onOut);
    removeEventListener('blur', hide);
  }
  const sync = () => (allowed() ? activate() : deactivate());
  // Motion paused or reduced (and touch-only setups) hand the pointer back to the system immediately.
  IH.on('motion', sync);
  fineMQ.addEventListener?.('change', sync);

  function show() {
    if (shown) return;
    shown = true;
    rx = x; ry = y; vx = vy = 0;
    place();
    el.classList.add('is-on');
    root.classList.add('has-cursor');
  }
  function hide() {
    if (!el) return;
    shown = false;
    el.classList.remove('is-on', 'is-down');
    root.classList.remove('has-cursor');
    cancelAnimationFrame(raf); raf = 0;
    target = null; setState('');
  }

  function place() {
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
  }

  function onMove(e) {
    if (e.pointerType !== 'mouse') { if (shown) hide(); return; }
    x = e.clientX; y = e.clientY;
    if (!shown) show();
    // The dot is written here, in the event, so it is never a frame behind the real pointer.
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    if (e.target !== target) resolve(e.target);
    else if (labelW) flip();
    el.classList.add('is-moving');
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => el.classList.remove('is-moving'), 520);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function onDown(e) { if (e.pointerType === 'mouse' && shown) el.classList.add('is-down'); }
  function onUp() {
    el?.classList.remove('is-down');
    // Letting go of a string: look again on the next frame, once lines.js has released it.
    if (shown) requestAnimationFrame(() => { if (shown) { target = null; resolve(document.elementFromPoint(x, y)); } });
  }
  // Leaving the window (relatedTarget null) or entering an iframe: let the system cursor take over.
  function onOut(e) { if (!e.relatedTarget || e.relatedTarget.nodeName === 'IFRAME') hide(); }
  // Scrolling moves content under a still pointer: look again once per frame.
  function onScroll() {
    if (!shown || scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      if (!shown) return;
      resolve(document.elementFromPoint(x, y));
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    });
  }

  // Ring: semi-implicit spring, ω ≈ 21 rad/s, ζ = 1 (no overshoot, so no visible wobble), settles in ~0.25 s.
  const K = 440, C = 2 * Math.sqrt(K);
  function frame(now) {
    raf = 0;
    if (!shown) return;
    let dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const steps = dt > 0.017 ? 2 : 1;
    dt /= steps;
    for (let i = 0; i < steps; i++) {
      vx += (K * (x - rx) - C * vx) * dt; vy += (K * (y - ry) - C * vy) * dt;
      rx += vx * dt; ry += vy * dt;
    }
    const settled = Math.abs(x - rx) < 0.05 && Math.abs(y - ry) < 0.05 && Math.abs(vx) + Math.abs(vy) < 0.5;
    if (settled) { rx = x; ry = y; vx = vy = 0; }
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    checkLines();
    if (!settled) raf = requestAnimationFrame(frame);
  }

  /* ---------- what is under the pointer ---------- */
  function resolve(t) {
    target = t;
    const node = t?.nodeType === 1 ? t : t?.parentElement;
    if (!node) { setState(''); return; }
    // Holding a string: whatever passes under the pointer, the hand is on the string.
    if (root.classList.contains('lines-grabbing')) { setState(''); checkLines(true); return; }
    const lab = node.closest('[data-cursor-label]')?.dataset.cursorLabel || '';
    if (label.textContent !== lab) { label.textContent = lab; labelW = lab ? label.offsetWidth : 0; }
    el.classList.toggle('has-label', !!lab);
    flip();
    if (node.closest(FIELD) || node.closest('[data-cursor="hide"]')) { setState('hidden'); return; }
    const hot = node.closest(HOT);
    if (hot) {
      const off = hot.matches(':disabled, [aria-disabled="true"]') || !!hot.closest('fieldset:disabled');
      el.classList.toggle('is-light', !!hot.closest(ON_INK));
      setState(off ? 'disabled' : 'hot');
      return;
    }
    el.classList.remove('is-light');
    const caret = node.closest('[data-cursor="caret"]');
    if (caret) {
      const fs = parseFloat(getComputedStyle(caret).fontSize) || 20;
      el.style.setProperty('--caret-h', `${Math.round(Math.min(88, Math.max(16, fs * 0.74)))}px`); // about cap height
      setState('caret');
      return;
    }
    if (node.closest('[data-cursor="pluck"]')) { setLine('me', true); return; }
    setState('');
    checkLines(true);
  }
  function setState(s) {
    if (s === state) return;
    state = s;
    el.classList.toggle('is-hidden', s === 'hidden');
    el.classList.toggle('is-hot', s === 'hot');
    el.classList.toggle('is-disabled', s === 'disabled');
    el.classList.toggle('is-caret', s === 'caret');
    el.classList.toggle('is-pluck', s === 'pluck');
    if (s !== 'pluck') { lineWho = ''; el.classList.remove('is-them', 'is-me', 'is-one', 'is-held'); }
  }
  function setLine(who, forced = false) {
    if (state !== 'pluck') setState('pluck');
    if (who !== lineWho) {
      lineWho = who;
      el.classList.toggle('is-them', who === 'them');
      el.classList.toggle('is-me', who === 'me');
      el.classList.toggle('is-one', who === 'one');
    }
    el.dataset.forced = forced ? '1' : '';
  }

  // Near the two strings, the ring suggests plucking. While lines.js is live it is the authority: it sets
  // html.lines-near when the pointer is within reach of a string as drawn, and html.lines-grabbing while one is
  // held. Which string: IH.lines.near(x, y) → 'them' | 'me' | null if it exists, else the nearest resting line from
  // IH.lines.geometry() → { mode, themY, meY, merged } (numbers, or functions of clientX). Without live lines (no
  // canvas yet) the resting geometry alone decides, within NEAR px.
  const at = (v, px) => (typeof v === 'function' ? v(px) : v);
  function nearest(g, limit) {
    let who = '', best = limit;
    const test = (yy, w) => { yy = at(yy, x); if (typeof yy === 'number' && Number.isFinite(yy)) { const d = Math.abs(y - yy); if (d < best) { best = d; who = w; } } };
    test(g.themY, 'them');
    test(g.meY, 'me');
    return who;
  }
  function checkLines(force = false) {
    if (state && state !== 'pluck') return;
    if (state === 'pluck' && el.dataset.forced === '1') return;
    const L = IH.lines;
    const g = L?.geometry?.();
    const mode = g?.mode || IH.state?.lines;
    const held = root.classList.contains('lines-grabbing');
    el.classList.toggle('is-held', held);
    let who = '';
    if (g) {
      const live = L.live || document.querySelector('.lines.is-live');
      // lines.js knows which strings can be held in each mode; trust it whenever it says so.
      if (held || root.classList.contains('lines-near')) {
        who = (L.near && L.near(x, y)) || (g.merged ? 'one' : nearest(g, Infinity)) || 'me';
      } else if (!live && PLUCK_MODES.has(mode)) {
        who = nearest(g, NEAR);
        if (who && g.merged) who = 'one';
      }
    }
    if (who) setLine(who);
    else if (state === 'pluck' || force) setState('');
  }

  sync();
})();
