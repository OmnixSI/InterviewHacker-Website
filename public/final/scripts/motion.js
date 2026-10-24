// Final choreography: Lenis smooth wheel + GSAP ScrollTrigger scenes.
// Progressive throughout — without this file the page is complete, static and readable.
(() => {
  const root = document.documentElement;
  const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const isPaused = () => root.classList.contains('motion-paused');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const header = $('[data-header]');
  const headerOffset = () => (header?.offsetHeight || 64) + 8;
  const BASELINE = .918; // lettering baseline as a fraction of its viewBox height (see scripts/final-lettering.mjs)

  /* ---------- Controls that work with or without GSAP ---------- */
  const motionBtn = $('[data-motion-toggle]');
  function syncMotion() {
    const p = isPaused(), label = p ? motionBtn?.dataset.labelOn : motionBtn?.dataset.labelOff;
    motionBtn?.setAttribute('aria-pressed', String(p));
    if (label) { motionBtn.setAttribute('aria-label', label); motionBtn.title = label; }
  }
  motionBtn?.addEventListener('click', () => {
    root.classList.toggle('motion-paused');
    try { localStorage.setItem('ih-final-motion', isPaused() ? 'paused' : 'running'); } catch { /* session only */ }
    syncMotion();
    document.dispatchEvent(new Event('ih:motion'));
  });
  syncMotion();

  const menuBtn = $('[data-menu-toggle]'), nav = $('#site-nav');
  function setMenu(open) {
    nav?.classList.toggle('is-open', open);
    menuBtn?.setAttribute('aria-expanded', String(open));
    menuBtn?.setAttribute('aria-label', open ? menuBtn.dataset.labelOpen : menuBtn.dataset.labelClosed);
  }
  menuBtn?.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  addEventListener('keydown', e => { if (e.key === 'Escape' && nav?.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); } });

  // Language menu: a small popover listing both languages, the current one marked.
  const langBox = $('[data-lang]'), langBtn = $('[data-lang-toggle]');
  const setLang = open => { langBox?.classList.toggle('is-open', open); langBtn?.setAttribute('aria-expanded', String(open)); };
  langBtn?.addEventListener('click', e => { e.stopPropagation(); setLang(!langBox.classList.contains('is-open')); });
  document.addEventListener('click', e => { if (langBox?.classList.contains('is-open') && !langBox.contains(e.target)) setLang(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && langBox?.classList.contains('is-open')) { setLang(false); langBtn.focus(); } });

  // Language switch keeps your place: it carries the section you are reading.
  for (const link of $$('[data-lang-switch], .site-footer__meta a[hreflang]')) {
    link.addEventListener('click', e => {
      const sections = $$('main > section[id]');
      const mid = innerHeight * .4;
      const here = sections.filter(s => s.getBoundingClientRect().top <= mid).pop();
      try { localStorage.setItem('ih-final-lang', link.getAttribute('hreflang')); } catch { /* session only */ }
      if (here && here.id !== 'top') { e.preventDefault(); location.href = `${link.getAttribute('href')}#${here.id}`; }
    });
  }

  // Narrow screens have no room for the shared pool beside the text: each moment carries a copy of its window.
  const glassCards = $$('[data-glass-card]');
  $$('[data-moment]').forEach((m, i) => {
    if (!glassCards[i]) return;
    const visual = document.createElement('div');
    visual.className = 'moment__visual';
    visual.setAttribute('aria-hidden', 'true');
    const card = glassCards[i].cloneNode(true);
    card.removeAttribute('data-glass-card');
    visual.append(card);
    m.prepend(visual);
  });

  if (!window.gsap || !window.ScrollTrigger) { root.classList.add('is-ready'); return; }

  /* ---------- GSAP ---------- */
  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin, ScrambleTextPlugin, Flip, CustomEase);
  CustomEase.create('ih.settle', '.16,1,.3,1');
  CustomEase.create('ih.change', '.65,0,.35,1');
  gsap.defaults({ ease: 'ih.settle', duration: 1 });

  let lenis = null;
  if (!reducedMQ.matches && window.Lenis) {
    lenis = new Lenis({ lerp: .1, smoothWheel: true, anchors: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  // #demo lives inside the pinned hero: its real destination is the end of the pin, where the device is settled.
  let heroST = null;
  const destination = id => id === '#top' ? 0 : id === '#demo' && heroST ? heroST.end : $(id);
  const go = (id, immediate) => {
    const to = destination(id);
    if (to == null) return;
    if (lenis) lenis.scrollTo(to, { offset: typeof to === 'number' ? 0 : -headerOffset() + 4, duration: 1.4, immediate });
    else if (typeof to === 'number') scrollTo(0, to);
    else to.scrollIntoView();
  };
  for (const a of $$('a[href^="#"]')) {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id !== '#top' && !$(id)) return;
      setMenu(false);
      e.preventDefault();
      go(id, false);
      history.replaceState(null, '', id);
    });
  }

  // Header state, scroll progress and the active section.
  const progress = $('.scroll-progress span');
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      header.classList.toggle('is-scrolled', y > 24);
      header.classList.toggle('is-hidden', y > 700 && y > lastY + 2 && !nav.classList.contains('is-open'));
      if (y < lastY - 2) header.classList.remove('is-hidden');
      lastY = y;
      if (progress) progress.style.transform = `scaleX(${self.progress.toFixed(4)})`;
    }
  });
  for (const link of $$('.site-nav a')) {
    const sec = $(link.getAttribute('href'));
    if (sec) ScrollTrigger.create({ trigger: sec, start: 'top 45%', end: 'bottom 45%', refreshPriority: -1, onToggle: s => link.classList.toggle('is-active', s.isActive) });
  }

  root.classList.add('is-ready');
  const field = window.IHField;
  let revealIO = null; // held here so the observer outlives the matchMedia callback
  const strokes = svg => $$('path', svg);
  // Writes lettering in pen order: each stroke's share of the time follows its length.
  function pen(svg, total, ease = 'power1.inOut') {
    const paths = strokes(svg), lens = paths.map(p => p.getTotalLength()), sum = lens.reduce((a, b) => a + b, 0);
    const tl = gsap.timeline();
    paths.forEach((p, i) => tl.to(p, { drawSVG: '100%', duration: Math.max(.04, total * lens[i] / sum), ease: i === 0 ? ease : 'none' }));
    return tl;
  }

  /* ---------- Hero headline: two-pass recognition, in place ----------
     1. A grey draft streams into the headline's own positions, mistakes and all, behind a live caret.
     2. A refinement line sweeps across; each character it passes turns from draft to the display face,
        mistakes are struck in amber first, then corrected.
     3. At the end of the second line the draft word is struck and the lettering writes itself.
     Plays on every load; scroll, click or a key jumps to the finished headline. */
  function twoPass() {
    const h1 = $('[data-two-pass]'), letterBox = $('.hero__lettering', h1), letter = $('svg', letterBox);
    if (reducedMQ.matches || !h1) return gsap.timeline();
    const lines = $$('.hero__line', h1);
    // Chinese splits by character, Latin by word; spaces stay plain text so they never collapse.
    const tokens = str => str.match(/[\u3000-\u9fff\uff00-\uffef]|\s+|[^\s\u3000-\u9fff\uff00-\uffef]+/g) || [];
    const draftTokens = tokens(h1.dataset.draft || '');
    // Split each line's text into cells holding a draft glyph and the final glyph.
    const cells = [];
    lines.forEach((line, li) => {
      const text = line.firstChild;
      if (!text || text.nodeType !== 3) return;
      const wrap = document.createElement('span');
      wrap.className = 'hero__text';
      tokens(text.data).forEach((tok, ti) => {
        if (/^\s+$/.test(tok)) { wrap.append(document.createTextNode(tok)); return; }
        const draft = li === 0 ? draftTokens[ti] ?? tok : tok;
        const cell = document.createElement('span');
        cell.className = 'hc' + (draft !== tok ? ' is-wrong' : '');
        cell.innerHTML = `<span class="hc__f"></span><span class="hc__d" aria-hidden="true"></span>`;
        cell.firstChild.textContent = tok;
        cell.lastChild.textContent = draft;
        wrap.append(cell);
        cells.push({ cell, line: li });
      });
      text.replaceWith(wrap);
    });
    const word = document.createElement('span');
    word.className = 'hero__draftword';
    word.setAttribute('aria-hidden', 'true');
    word.textContent = h1.dataset.draftWord || '';
    letterBox.prepend(word);
    const caret = document.createElement('i');
    caret.className = 'hero__caret';
    const sweep = document.createElement('i');
    sweep.className = 'hero__sweep';
    h1.append(sweep);
    h1.classList.add('is-drafting');

    const F = c => $('.hc__f', c.cell), D = c => $('.hc__d', c.cell);
    gsap.set(cells.map(F), { opacity: 0, yPercent: 18 });
    gsap.set(cells.map(D), { opacity: 0 });
    gsap.set(word, { opacity: 0 });
    gsap.set(strokes(letter), { drawSVG: '0%' });

    const tl = gsap.timeline({ delay: .3, onComplete: finish });
    // 1. Draft streams in.
    const typeStep = root.lang.startsWith('zh') ? .06 : .13;
    cells.forEach((c, i) => tl.call(() => c.cell.append(caret), null, i * typeStep).to(D(c), { opacity: 1, duration: .18, ease: 'power1.out' }, i * typeStep));
    let t = cells.length * typeStep;
    tl.call(() => word.append(caret), null, t).to(word, { opacity: 1, duration: .3 }, t);
    t += .55;
    tl.call(() => { caret.remove(); h1.classList.add('is-refining'); }, null, t);

    // 2. The refinement sweep: each line in turn; characters flip as the line passes their centre.
    const box = h1.getBoundingClientRect();
    const rows = lines.map(line => {
      const r = line.getBoundingClientRect();
      const right = line.querySelector('.hero__lettering') ? letterBox.getBoundingClientRect().right : r.right;
      return { left: r.left - box.left, right: right - box.left, top: r.top - box.top, height: r.height };
    });
    const sweepTime = .75;
    // When the power1.inOut sweep reaches a fraction f of the line (the inverse of its easing).
    const reach = f => { f = Math.max(0, Math.min(1, f)); return f < .5 ? Math.sqrt(f / 2) : 1 - Math.sqrt((1 - f) / 2); };
    rows.forEach((row, li) => {
      const start = t + li * .5;
      tl.set(sweep, { x: row.left - 8, y: row.top, height: row.height, opacity: 0 }, start)
        .to(sweep, { opacity: 1, duration: .12 }, start)
        .to(sweep, { x: row.right + 8, duration: sweepTime, ease: 'power1.inOut' }, start)
        .to(sweep, { opacity: 0, duration: .15 }, start + sweepTime - .1);
      const span = Math.max(1, row.right - row.left);
      for (const c of cells.filter(x => x.line === li)) {
        const r = c.cell.getBoundingClientRect();
        const at = start + sweepTime * reach((r.left + r.width / 2 - box.left - row.left) / span);
        const wrong = c.cell.classList.contains('is-wrong');
        if (wrong) tl.to(c.cell, { '--strike': 1, duration: .16, ease: 'ih.change' }, at - .08);
        tl.to(D(c), { opacity: 0, yPercent: -22, duration: .32, ease: 'ih.change' }, at + (wrong ? .12 : 0))
          .to(F(c), { opacity: 1, yPercent: 0, duration: .55, ease: 'ih.settle' }, at + (wrong ? .16 : .02));
        if (wrong) tl.to(c.cell, { '--strike': 0, duration: .01 }, at + .2);
      }
      if (li === rows.length - 1) {
        const wr = word.getBoundingClientRect();
        const at = start + sweepTime * reach((wr.left - box.left - row.left) / span);
        tl.to(word, { '--strike': 1, duration: .2, ease: 'ih.change' }, at)
          .to(word, { opacity: 0, y: -10, duration: .3, ease: 'ih.change' }, at + .22)
          .add(pen(letter, 1.3), at + .3);
      }
    });

    function finish() {
      caret.remove(); sweep.remove(); word.remove();
      h1.classList.remove('is-drafting', 'is-refining');
      gsap.set(cells.map(F), { clearProps: 'opacity,transform' });
      gsap.set(cells.map(D), { opacity: 0 });
      gsap.set(strokes(letter), { drawSVG: '100%' });
      off();
    }
    const skip = () => { if (tl.progress() < 1) tl.progress(1); };
    const off = () => ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(type => removeEventListener(type, skip));
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(type => addEventListener(type, skip, { passive: true }));
    return tl;
  }

  const mm = gsap.matchMedia();
  mm.add({
    motion: '(prefers-reduced-motion: no-preference)',
    stage: '(min-width: 961px) and (min-height: 640px)',
    wide: '(min-width: 961px)'
  }, ctx => {
    const { motion, stage, wide } = ctx.conditions;
    if (!motion) return;
    twoPass();

    /* Hero → voiceprint → device → a scroll-guided conversation, on one pinned stage.
       The first INTRO of the pin hands over from the headline to the device; the rest plays the demo. */
    const hero = $('[data-hero]'), pin = $('[data-hero-pin]');
    const copy = $('[data-hero-copy]'), vp = $('[data-voiceprint]');
    const vpWord = $('.lettering--lead', vp), device = $('[data-device]');
    const guideEl = $('[data-guide]'), controls = $('[data-demo-controls]');
    const demo = window.IHDemo;
    if (stage) {
      hero.classList.add('hero--stage');
      if (guideEl) guideEl.hidden = false;
      const STEPS = 6, INTRO = 1.5, PER = .75, TOTAL = INTRO + STEPS * PER, introEnd = INTRO / TOTAL;
      const measure = () => pin.style.setProperty('--stage-top', `${vp.offsetTop + vp.offsetHeight + 22}px`);
      measure();
      let baseline = .3;
      const measureBaseline = () => {
        const r = vpWord.getBoundingClientRect();
        baseline = (r.top - (gsap.getProperty(vp, 'y') || 0) - pin.getBoundingClientRect().top + r.height * BASELINE) / innerHeight;
      };
      const peek = () => innerHeight * .875 - (vp.offsetTop + vp.offsetHeight + 22);
      gsap.set(strokes(vpWord), { drawSVG: '0%' });
      let free = null;
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero, pin, start: 'top top', end: `+=${TOTAL * 100}%`, scrub: .5, invalidateOnRefresh: true,
          onRefreshInit: measure,
          onRefresh: measureBaseline,
          onUpdate(self) {
            const p = self.progress, intro = Math.min(1, p / introEnd);
            const c = gsap.utils.clamp(0, 1, intro / .34);
            field?.set({ converge: c, base: gsap.utils.interpolate(.815, baseline, gsap.parseEase('ih.change')(c)) });
            // The walkthrough owns the window from the moment the device has settled until the pin ends.
            const g = (p - introEnd) / (1 - introEnd - .015);
            const done = g >= 1;
            if (done !== free) { free = done; hero.classList.toggle('is-free', done); }
            demo?.guide(done ? null : Math.max(0, g));
          }
        }
      });
      // Intro, laid out on a 0–1 clock, then stretched to its share of the pin.
      tl.to(copy, { y: -70, opacity: 0, duration: .26, ease: 'power2.in' }, 0)
        .fromTo(vp, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .16, ease: 'ih.settle' }, .2)
        .add(pen(vpWord, .32, 'none'), .3)
        .to('.field', { opacity: 0, duration: .12 }, .5)
        .to(strokes(vpWord)[0], { drawSVG: '6.5% 100%', duration: .1, ease: 'ih.change' }, .56)
        .fromTo(device, { y: peek, rotationX: 24, scale: .9 }, { y: 0, rotationX: 0, scale: 1, duration: .55, ease: 'ih.change' }, .38)
        .fromTo(guideEl, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .1, ease: 'ih.settle' }, .88)
        .to({}, { duration: 1 / introEnd - 1 }, 1);
      measureBaseline();
      heroST = tl.scrollTrigger;
      $('[data-guide-skip]')?.addEventListener('click', () => go('#demo', false));
    } else {
      // Plain reading order: the voiceprint writes itself when it scrolls into view; the demo plays on its own.
      gsap.set(strokes(vpWord), { drawSVG: '0%' });
      ScrollTrigger.create({ trigger: vp, start: 'top 75%', once: true, onEnter: () => pen(vpWord, 2) });
      gsap.from(device, { y: 60, opacity: 0, duration: 1.2, scrollTrigger: { trigger: device, start: 'top 90%' } });
    }

    /* Swirl: the lines rise past the turning voice, bending around it as they pass the middle of the
       screen, and surface and leave through a blur. The column is pinned while it plays. */
    const swirl = $('[data-swirl]'), swirlCol = $('[data-swirl-col]'), orb = $('.swirl__orb'), swirlLines = $$('.sl', swirl || document);
    if (swirl && stage) {
      swirl.classList.add('is-pinned');
      const SWAY = .17, gutter = 24;
      // Sideways offset by height on screen: left at the bottom, right at the top, fastest past the middle.
      const bend = y => Math.sin((.5 - Math.max(-.2, Math.min(1.2, y))) * Math.PI) * .5;
      const setY = gsap.quickSetter(swirlCol, 'y', 'px'), setters = swirlLines.map(l => ({ x: gsap.quickSetter(l, 'x', 'px'), o: gsap.quickSetter(l, 'opacity') }));
      let H = 1, W = 1, from = 0, travel = 1, mids = [], room = [];
      const measure = () => {
        gsap.set(swirlCol, { y: 0 }); gsap.set(swirlLines, { x: 0, opacity: 1, filter: 'none' });
        H = innerHeight; W = swirlCol.offsetWidth;
        const c = swirlCol.getBoundingClientRect();
        const rects = swirlLines.map(l => l.getBoundingClientRect());
        mids = rects.map(r => r.top - c.top + r.height / 2);
        room = rects.map(r => [Math.min(0, gutter - r.left), Math.max(0, innerWidth - gutter - r.right)]);
        from = H * 1.04 - mids[0];
        // It ends with the closing lines resting just under the voice.
        const closing = swirlLines.length - $$('.swirl__stanza--end .sl', swirl).length;
        const to = H * .6 - mids[closing];
        travel = Math.max(1, from - to);
        // The lines move slower than the page, so the passage reads as a slow drift.
        swirl.style.height = `${Math.round(travel * 1.7 + H)}px`;
      };
      const render = p => {
        const y = from - p * travel;
        setY(y);
        swirlLines.forEach((l, i) => {
          const sy = (y + mids[i]) / H, k = Math.max(0, Math.min(1, (1 - sy) / .2, (sy - .03) / .22));
          setters[i].x(Math.max(room[i][0], Math.min(room[i][1], bend(sy) * SWAY * W)));
          setters[i].o(k);
          l.style.filter = k > .98 ? '' : `blur(${((1 - k) * 7).toFixed(1)}px)`;
        });
        gsap.set(orb, { rotation: p * 160, scale: 1 + Math.sin(p * Math.PI) * .12 });
      };
      measure();
      ScrollTrigger.addEventListener('refreshInit', measure);
      ScrollTrigger.create({ trigger: swirl, start: 'top top', end: 'bottom bottom', onUpdate: s => render(s.progress), onRefresh: s => render(s.progress) });
      render(0);
    } else if (swirl) {
      for (const l of swirlLines) gsap.fromTo(l, { opacity: 0, y: 18, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, clearProps: 'filter', scrollTrigger: { trigger: l, start: 'top 90%' } });
    }

    /* Moments: the chapter in the middle of the screen chooses the window floating on the pool. */
    const cards = $$('[data-glass-card]'), moments = $$('[data-moment]'), index = $$('[data-index]');
    let shown = 0;
    const show = i => {
      if (i === shown) return;
      const from = cards[shown], to = cards[i], dir = i > shown ? 1 : -1;
      shown = i;
      gsap.to(from, { opacity: 0, y: -40 * dir, rotationX: 8 * dir, duration: .6, ease: 'ih.change', onComplete: () => from.classList.remove('is-active') });
      to.classList.add('is-active');
      gsap.fromTo(to, { opacity: 0, y: 50 * dir, rotationX: -10 * dir }, { opacity: 1, y: 0, rotationX: 0, duration: 1, ease: 'ih.settle', delay: .1 });
      index.forEach((a, k) => a.classList.toggle('is-active', k === i));
      field?.pool?.drop(.5, .5, .09, .08);
    };
    index[0]?.classList.add('is-active');
    moments.forEach((m, i) => ScrollTrigger.create({ trigger: m, start: 'top 55%', end: 'bottom 55%', onToggle: s => s.isActive && show(i) }));
    for (const m of moments) {
      const parts = $$('.moment__visual, .moment__kicker, .moment__title span, .moment__body, .moment__aside', m);
      gsap.from(parts, { y: 36, opacity: 0, duration: 1.1, stagger: .07, scrollTrigger: { trigger: m, start: 'top 70%' } });
    }

    /* Section headings rise line by line behind a mask. refreshPriority -1: measured after the pins above. */
    for (const h of $$('.section .display')) {
      const split = SplitText.create(h, { type: 'lines', mask: 'lines', linesClass: 'line' });
      gsap.from(split.lines, { yPercent: 105, duration: 1.1, stagger: .08, scrollTrigger: { trigger: h, start: 'top 88%', refreshPriority: -1 } });
    }
    // Content reveals use IntersectionObserver, so pinned sections and hash jumps can't strand them hidden.
    const reveal = $$('.principles__list li, .companion__facts li, .index li')
      .filter(el => el.getBoundingClientRect().top > innerHeight * .9);
    gsap.set(reveal, { y: 28, opacity: 0 });
    const pending = new Set(reveal);
    const showEls = els => { els = els.filter(el => pending.delete(el)); if (els.length) gsap.to(els, { y: 0, opacity: 1, duration: 1, stagger: .06, overwrite: true }); };
    revealIO = new IntersectionObserver(entries => {
      showEls(entries.filter(e => e.isIntersecting || e.boundingClientRect.top < 0).map(e => { revealIO.unobserve(e.target); return e.target; }));
    }, { rootMargin: '0px 0px -8% 0px' });
    reveal.forEach(el => revealIO.observe(el));
    ScrollTrigger.addEventListener('refresh', () => showEls([...pending].filter(el => el.getBoundingClientRect().top < innerHeight)));

    /* Ending: the words surface from the water, through a blur. */
    const ending = $('[data-ending]');
    if (ending) gsap.from($$('.ending__title span, .ending__sub, .ending__btn', ending), { opacity: 0, y: 34, filter: 'blur(10px)', duration: 1.6, stagger: .14, clearProps: 'filter', scrollTrigger: { trigger: ending, start: 'top 45%' } });

    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    // Pins add height after the browser already jumped to a #hash, so land there again once layout settles.
    addEventListener('load', () => { ScrollTrigger.refresh(); if (location.hash.length > 1) requestAnimationFrame(() => go(location.hash, true)); }, { once: true });
    return () => { hero.classList.remove('hero--stage', 'is-free'); swirl?.classList.remove('is-pinned'); if (swirl) swirl.style.height = ''; demo?.guide(null); };
  });
  reducedMQ.addEventListener('change', () => location.reload());
})();
