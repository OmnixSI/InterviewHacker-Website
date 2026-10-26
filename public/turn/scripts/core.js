// Turn — core runtime. Owns: smooth scroll, motion state, header controls, and "the day": a clock and a paper colour
// that follow the reader through the page. Every other script registers with window.IH (opened in bootstrap.js).
//
// Contract for section scripts
//   IH.motionOK()                 decorative motion may run (not reduced, not paused, tab visible)
//   IH.on('motion', ok => …)      fired when that changes (pause button, tab hidden/shown, reduced-motion change)
//   IH.on('section', s => …)      { id, lines, palette, time } when the reader enters a new [data-time] anchor
//   IH.on('tick', s => …)         every scroll update: { y, progress (0–1 of page), minutes (since 00:00) }
//   IH.inView(el, on => …)        IntersectionObserver helper: call your loop on/off as the element enters/leaves
//   IH.scrollTo(target)           smooth (Lenis) or native scroll to an element / selector / y
//   IH.anchorAt(el, () => y)      override where an anchor starts (pinned sequences can map scenes to scroll y)
//   IH.ease.settle|change|spring  registered GSAP eases (also mirrored as CSS custom properties)
//   IH.palettes                   the named palettes ([data-palette] values)
//   IH.palette                    current blended palette (hex strings), updated before 'tick'
(() => {
  const IH = window.IH;
  const root = document.documentElement;
  const hasGsap = typeof window.gsap !== 'undefined';
  if (hasGsap) {
    gsap.registerPlugin(...[window.ScrollTrigger, window.SplitText, window.DrawSVGPlugin, window.CustomEase, window.Flip].filter(Boolean));
    if (window.CustomEase) {
      CustomEase.create('ih.settle', '0.16, 1, 0.3, 1');
      CustomEase.create('ih.change', '0.65, 0, 0.35, 1');
      // A soft spring: overshoots ~2% and settles.
      CustomEase.create('ih.spring', 'M0,0 C0.12,0.62 0.2,1.04 0.38,1.035 0.56,1.03 0.7,0.996 1,1');
    }
  }
  IH.ease = { settle: 'ih.settle', change: 'ih.change', spring: 'ih.spring' };

  /* ---------------- Motion state ---------------- */
  const motionBtn = document.querySelector('[data-motion-toggle]');
  const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
  let lastOK = IH.motionOK();
  function syncMotion() {
    root.classList.toggle('motion-paused', IH.paused);
    root.classList.toggle('motion-reduced', IH.reduced);
    root.classList.toggle('motion-ok', !IH.paused && !IH.reduced);
    if (motionBtn) {
      motionBtn.setAttribute('aria-pressed', String(IH.paused));
      motionBtn.setAttribute('aria-label', IH.paused ? motionBtn.dataset.labelOn : motionBtn.dataset.labelOff);
    }
    const ok = IH.motionOK();
    if (ok !== lastOK) { lastOK = ok; IH.emit('motion', ok); }
    smooth();
  }
  motionBtn?.addEventListener('click', () => {
    IH.paused = !IH.paused;
    try { localStorage.setItem('ih-turn-motion', IH.paused ? 'paused' : 'running'); } catch (e) { /* ignore */ }
    syncMotion();
  });
  reducedMQ.addEventListener?.('change', e => { IH.reduced = e.matches; syncMotion(); });
  document.addEventListener('visibilitychange', () => { const ok = IH.motionOK(); if (ok !== lastOK) { lastOK = ok; IH.emit('motion', ok); } });

  /* ---------------- Smooth scroll ---------------- */
  let lenis = null;
  function smooth() {
    const want = !IH.reduced && !IH.paused && typeof window.Lenis !== 'undefined' && !matchMedia('(pointer: coarse)').matches;
    if (want && !lenis) {
      lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.9, smoothWheel: true });
      if (hasGsap && window.ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
      root.classList.add('has-lenis');
    } else if (!want && lenis) {
      lenis.destroy(); lenis = null; root.classList.remove('has-lenis');
    }
    IH.lenis = lenis;
  }
  if (hasGsap) {
    gsap.ticker.add(t => lenis?.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  IH.scrollTo = (target, opts = {}) => {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    const offset = opts.offset ?? -8;
    if (opts.immediate) {
      // Jumps go through the native scroll first, so a stale smooth-scroll limit can't clamp them.
      const y = typeof target === 'number' ? target : (el ? el.getBoundingClientRect().top + scrollY + offset : 0);
      lenis?.resize?.();
      scrollTo({ top: y, behavior: 'auto' });
      lenis?.scrollTo(y, { immediate: true, force: true });
      return;
    }
    if (lenis) { lenis.scrollTo(el ?? target, { offset, duration: opts.duration ?? 1.4, easing: t => 1 - Math.pow(1 - t, 4) }); return; }
    const y = typeof target === 'number' ? target : (el ? el.getBoundingClientRect().top + scrollY + offset : 0);
    scrollTo({ top: y, behavior: IH.reduced || opts.immediate ? 'auto' : 'smooth' });
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-no-smooth')) return;
    const id = a.getAttribute('href').slice(1);
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    e.preventDefault();
    closeMenu();
    IH.scrollTo(el);
    history.replaceState(null, '', '#' + id);
    // Move focus for keyboard and screen-reader users without a second jump.
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });
  smooth();

  /* ---------------- Header: menu, language ---------------- */
  const header = document.querySelector('[data-masthead]');
  const menuBtn = document.querySelector('[data-menu-toggle]');
  function closeMenu() {
    if (!menuBtn) return;
    root.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', menuBtn.dataset.labelClosed);
  }
  menuBtn?.addEventListener('click', () => {
    const open = !root.classList.contains('menu-open');
    root.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? menuBtn.dataset.labelOpen : menuBtn.dataset.labelClosed);
  });
  const lang = document.querySelector('[data-lang]');
  const langBtn = lang?.querySelector('[data-lang-toggle]');
  const setLang = open => { lang?.classList.toggle('is-open', open); langBtn?.setAttribute('aria-expanded', String(open)); };
  langBtn?.addEventListener('click', e => { e.stopPropagation(); setLang(!lang.classList.contains('is-open')); });
  document.addEventListener('click', e => { if (lang && !lang.contains(e.target)) setLang(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') { setLang(false); closeMenu(); } });
  // Switching language keeps the reader in the same part of the day.
  const boxOf = sec => (sec.parentElement?.classList.contains('pin-spacer') ? sec.parentElement : sec);
  function currentSection() {
    const secs = [...document.querySelectorAll('main > section[id]')];
    const y = scrollY + innerHeight * 0.35;
    let cur = secs[0];
    for (const sec of secs) if (boxOf(sec).getBoundingClientRect().top + scrollY <= y) cur = sec;
    return cur;
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-lang-switch]');
    if (!a) return;
    const sec = currentSection();
    if (!sec) return;
    const box = boxOf(sec), top = box.getBoundingClientRect().top + scrollY;
    const p = Math.max(0, Math.min(1, (scrollY - top) / Math.max(1, box.offsetHeight)));
    try { sessionStorage.setItem('ih-turn-pos', JSON.stringify({ id: sec.id, p })); } catch (err) { /* ignore */ }
    a.href = a.getAttribute('href').split('#')[0] + '#' + sec.id;
  }, true);

  /* ---------------- Colour: OKLab blending ---------------- */
  const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const fromLin = c => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, v)) * 255); };
  function hex2lab(h) {
    const [r, g, b] = hex2rgb(h).map(toLin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function lab2hex([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(fromLin);
    return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  IH.mix = (h1, h2, t) => { const A = hex2lab(h1), B = hex2lab(h2); return lab2hex(A.map((v, i) => v + (B[i] - v) * t)); };
  IH.lightness = h => hex2lab(h)[0];

  // Named palettes. paper/ink pairs keep AA contrast; them = the other side (amber), me = you (indigo).
  // *-ink are the text-safe versions of each voice on that paper.
  IH.palettes = {
    dawn:      { paper: '#eeebe4', paper2: '#e6e2d9', ink: '#17181c', ink2: '#3e4048', muted: '#6b6d75', them: '#d0802e', themInk: '#8d4c0e', me: '#5b5ff0', meInk: '#3c3fc4' },
    morning:   { paper: '#f5f4ef', paper2: '#ecebe4', ink: '#16171b', ink2: '#3d3f47', muted: '#6c6e77', them: '#d9822b', themInk: '#93500c', me: '#5b5ff0', meInk: '#3d40c8' },
    noon:      { paper: '#f8f7f3', paper2: '#efeee8', ink: '#141519', ink2: '#3a3c44', muted: '#6a6c75', them: '#de8429', themInk: '#8f4d0a', me: '#5458f2', meInk: '#383bc6' },
    afternoon: { paper: '#f3ece0', paper2: '#e9e0d1', ink: '#1b1814', ink2: '#433d36', muted: '#73695e', them: '#e0842a', themInk: '#8a4708', me: '#5b5ff0', meInk: '#3a3dc0' },
    dusk:      { paper: '#1c1820', paper2: '#26212b', ink: '#f2ece4', ink2: '#d4cbc2', muted: '#a0958c', them: '#f0a35a', themInk: '#f6bd85', me: '#8f92ff', meInk: '#b3b5ff' },
    evening:   { paper: '#11131b', paper2: '#191c26', ink: '#eeedf2', ink2: '#c9c9d3', muted: '#90929e', them: '#eb9f57', themInk: '#f2b77c', me: '#8a8dff', meInk: '#adafff' },
    night:     { paper: '#0e0f13', paper2: '#16171c', ink: '#efede8', ink2: '#c8c7cc', muted: '#8f9098', them: '#e89b52', themInk: '#f0b06d', me: '#8487ff', meInk: '#a5a7ff' },
    midnight:  { paper: '#09090c', paper2: '#111216', ink: '#f1efe9', ink2: '#c9c8cc', muted: '#8a8b92', them: '#e59a4d', themInk: '#f0b06d', me: '#8487ff', meInk: '#a5a7ff' }
  };
  const KEYS = ['paper', 'paper2', 'ink', 'ink2', 'muted', 'them', 'themInk', 'me', 'meInk'];
  const CSSVAR = { paper: '--paper', paper2: '--paper-2', ink: '--ink', ink2: '--ink-2', muted: '--muted', them: '--them', themInk: '--them-ink', me: '--me', meInk: '--me-ink' };
  // Light → dark passes through a sunset (peach, then dusky rose) instead of grey; dark → light reverses it.
  const SUNSET = [[0, null], [0.38, '#e9c4a2'], [0.72, '#6a4752'], [1, null]];
  function paperPath(a, b, t, key) {
    const down = IH.lightness(a) > IH.lightness(b);
    const stops = SUNSET.map(([at, c]) => [at, c && key === 'paper2' ? IH.mix(c, down ? b : a, 0.18) : c]);
    const pts = stops.map(([at, c], i) => [at, c ?? (i === 0 ? (down ? a : b) : (down ? b : a))]);
    const u = down ? t : 1 - t;
    let i = 0; while (i < pts.length - 2 && u > pts[i + 1][0]) i++;
    const [u0, c0] = pts[i], [u1, c1] = pts[i + 1];
    return IH.mix(c0, c1, (u - u0) / (u1 - u0));
  }
  function blend(p, q, t) {
    if (t <= 0) return { ...p }; if (t >= 1) return { ...q };
    const out = {};
    const crossing = (IH.lightness(p.paper) > 0.6) !== (IH.lightness(q.paper) > 0.6);
    for (const k of KEYS) out[k] = crossing && (k === 'paper' || k === 'paper2') ? paperPath(p[k], q[k], t, k) : IH.mix(p[k], q[k], t);
    // Text flips cleanly instead of fading through grey: it follows which side of mid-lightness the paper is on.
    const lp = IH.lightness(p.paper), lq = IH.lightness(q.paper);
    if ((lp > 0.6) !== (lq > 0.6)) {
      const dark = IH.lightness(out.paper) < 0.58;
      const src = (IH.lightness(p.paper) < 0.58) === dark ? p : q;
      for (const k of ['ink', 'ink2', 'muted', 'themInk', 'meInk']) out[k] = src[k];
    }
    return out;
  }
  let lastApplied = '';
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  function applyPalette(pal) {
    const sig = KEYS.map(k => pal[k]).join();
    if (sig === lastApplied) return;
    lastApplied = sig;
    for (const k of KEYS) root.style.setProperty(CSSVAR[k], pal[k]);
    const dark = IH.lightness(pal.paper) < 0.58;
    root.style.setProperty('--line', dark ? 'rgba(255,255,255,.11)' : 'rgba(20,20,24,.1)');
    root.style.setProperty('--line-2', dark ? 'rgba(255,255,255,.2)' : 'rgba(20,20,24,.18)');
    root.classList.toggle('is-dark', dark);
    themeMeta?.setAttribute('content', pal.paper);
    IH.palette = pal;
  }

  /* ---------------- The day: anchors → clock, palette, lines mode ---------------- */
  const state = { anchors: [], sectionEl: null, key: '' };
  IH.state = state;
  const overrides = new WeakMap();
  IH.anchorAt = (el, fn) => { overrides.set(el, fn); measure(); };
  const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const inherit = (el, attr) => el.closest(`[${attr}]`)?.getAttribute(attr);
  function measure() {
    const vh = innerHeight;
    state.anchors = [...document.querySelectorAll('[data-time]')].map(el => {
      const o = overrides.get(el);
      const y = o ? o() : el.getBoundingClientRect().top + scrollY - vh * 0.5;
      return { el, y, min: toMin(el.dataset.time), palette: inherit(el, 'data-palette') || 'morning', lines: inherit(el, 'data-lines') || 'day', id: el.id || el.closest('[id]')?.id };
    }).sort((a, b) => a.y - b.y);
    update();
  }
  const clockEl = document.querySelector('[data-clock-time]');
  let digits = null;
  function buildClock() {
    if (!clockEl) return;
    clockEl.setAttribute('aria-hidden', 'true');
    clockEl.textContent = '';
    digits = [];
    for (let i = 0; i < 5; i++) {
      if (i === 2) { const c = document.createElement('span'); c.className = 'clock__colon'; c.textContent = ':'; clockEl.append(c); continue; }
      const d = document.createElement('span'); d.className = 'clock__digit';
      const col = document.createElement('span'); col.className = 'clock__col';
      for (let n = 0; n < 10; n++) { const s = document.createElement('span'); s.textContent = n; col.append(s); }
      d.append(col); clockEl.append(d); digits.push(col);
    }
  }
  let shownTime = '';
  function renderClock(min) {
    if (!clockEl) return;
    min = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
    const s = String(Math.floor(min / 60)).padStart(2, '0') + String(min % 60).padStart(2, '0');
    if (s === shownTime) return;
    shownTime = s;
    if (!digits) { clockEl.textContent = s.slice(0, 2) + ':' + s.slice(2); return; }
    s.split('').forEach((ch, i) => { digits[i].style.transform = `translateY(${-Number(ch)}em)`; });
  }
  IH.setClock = renderClock;
  let clockHold = null;
  IH.holdClock = min => { clockHold = min; if (min != null) renderClock(min); else update(); };

  function update() {
    const y = scrollY, A = state.anchors;
    if (!A.length) return;
    let i = 0;
    while (i < A.length - 1 && A[i + 1].y <= y) i++;
    const a = A[i], b = A[i + 1];
    let t = 0;
    if (b && y > a.y) t = Math.min(1, (y - a.y) / Math.max(1, b.y - a.y));
    if (y < a.y) t = 0;
    const minutes = b ? a.min + (b.min - a.min) * t : a.min;
    // Colour holds through most of a stretch of the day and turns in its last third.
    const pt = b ? Math.max(0, (t - 0.62) / 0.38) : 0;
    const p0 = IH.palettes[a.palette] || IH.palettes.morning, p1 = b ? (IH.palettes[b.palette] || p0) : p0;
    applyPalette(blend(p0, p1, pt * pt * (3 - 2 * pt)));
    if (clockHold == null) renderClock(minutes);
    const active = (b && t > 0.5 && y >= b.y - innerHeight * 0.25) ? a : a;
    if (active.el !== state.sectionEl) {
      state.sectionEl = active.el;
      const key = active.lines + '|' + active.palette + '|' + active.id;
      if (key !== state.key) {
        state.key = key;
        state.lines = active.lines;
        IH.emit('section', { id: active.id, el: active.el, lines: active.lines, palette: active.palette, time: active.el.dataset.time });
      }
    }
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    IH.emit('tick', { y, progress: Math.min(1, y / max), minutes });
    header?.classList.toggle('is-scrolled', y > 24);
  }
  let queued = false;
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } }, { passive: true });
  addEventListener('resize', () => requestAnimationFrame(measure));
  if (hasGsap && window.ScrollTrigger) ScrollTrigger.addEventListener('refresh', measure);

  /* ---------------- Header nav follows the day ---------------- */
  const navMap = { gap: 'gap', day: 'day', dusk: 'day', evening: 'day', privacy: 'privacy', faq: 'faq' };
  const navLinks = [...document.querySelectorAll('.masthead__nav a[href^="#"]')];
  IH.on('section', s => {
    const top = s.el?.closest('main > section')?.id;
    const target = navMap[top];
    for (const a of navLinks) {
      const on = a.getAttribute('href') === '#' + target;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    }
  });

  /* ---------------- In-view helper ---------------- */
  const watchers = new Map();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const e of entries) (watchers.get(e.target) || []).forEach(fn => fn(e.isIntersecting, e));
  }, { rootMargin: '10% 0px' }) : null;
  IH.inView = (el, fn) => {
    if (!el) return;
    if (!io) { fn(true); return; }
    if (!watchers.has(el)) { watchers.set(el, []); io.observe(el); }
    watchers.get(el).push(fn);
  };

  /* ---------------- Start ---------------- */
  buildClock();
  measure();
  IH.ready = true;
  // Fonts change line breaks; re-measure everything once they land.
  document.fonts?.ready.then(() => { if (hasGsap && window.ScrollTrigger) ScrollTrigger.refresh(); else measure(); });
  addEventListener('load', () => { if (hasGsap && window.ScrollTrigger) ScrollTrigger.refresh(); else measure(); });
  // Arriving with a hash (e.g. after switching language): go back to the same place once fonts and pins have settled.
  if (location.hash.length > 1) {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = document.getElementById(id);
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('ih-turn-pos') || 'null'); sessionStorage.removeItem('ih-turn-pos'); } catch (e) { /* ignore */ }
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const go = () => {
      if (!el) return;
      if (saved && saved.id === id && el.matches('main > section')) {
        const box = boxOf(el), top = box.getBoundingClientRect().top + scrollY;
        IH.scrollTo(top + saved.p * box.offsetHeight, { immediate: true });
      } else IH.scrollTo(el, { immediate: true });
    };
    addEventListener('load', () => Promise.resolve(document.fonts?.ready).then(() => requestAnimationFrame(() => {
      if (hasGsap && window.ScrollTrigger) ScrollTrigger.refresh();
      go(); setTimeout(go, 250);
    })));
  }
})();
