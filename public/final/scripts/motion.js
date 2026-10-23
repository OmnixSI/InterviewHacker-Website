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

  // FAQ: animated disclosure on top of native <details>.
  for (const d of $$('[data-faq] details')) {
    const summary = $('summary', d), body = $('.faq__answer', d);
    summary.addEventListener('click', e => {
      if (reducedMQ.matches) return;
      e.preventDefault();
      if (d.open) gsap.to(body, { height: 0, duration: .45, ease: 'ih.change', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'height' }); } });
      else { d.open = true; gsap.fromTo(body, { height: 0 }, { height: 'auto', duration: .6, clearProps: 'height' }); }
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

  /* ---------- Hero headline: two-pass recognition ----------
     A mono draft streams in with mistakes, the mistakes are struck and corrected, then the line settles
     into the display face and the custom lettering writes itself. Scroll, click or a key skips to the end. */
  function twoPass() {
    const h1 = $('[data-two-pass]'), finalEl = $('.hero__final', h1);
    const letter = $('.hero__lettering svg', h1);
    let seen = false;
    try { seen = sessionStorage.getItem('ih-final-intro') === '1'; sessionStorage.setItem('ih-final-intro', '1'); } catch { /* fine */ }
    if (reducedMQ.matches || seen) return gsap.timeline();
    const draft = document.createElement('span');
    draft.className = 'hero__draft';
    draft.setAttribute('aria-hidden', 'true');
    const parts = [];
    let line = document.createElement('span');
    draft.append(line);
    for (const token of h1.dataset.draft.split('|')) {
      for (const [k, piece] of token.split('¶').entries()) {
        if (k > 0) { line = document.createElement('span'); draft.append(line); }
        if (!piece) continue;
        const [text, fix] = piece.split('>');
        const span = document.createElement('span');
        if (fix) span.className = 'bad';
        line.append(span);
        parts.push({ span, text, fix });
      }
    }
    const caret = document.createElement('span');
    caret.className = 'caret';
    h1.append(draft);
    const tl = gsap.timeline({ delay: .35 });
    gsap.set(finalEl, { opacity: 0 });
    gsap.set(strokes(letter), { drawSVG: '0%' });
    for (const p of parts) {
      tl.call(() => p.span.after(caret));
      tl.to({}, { duration: p.text.length * .032, onUpdate() { p.span.textContent = p.text.slice(0, Math.ceil(this.progress() * p.text.length)); } });
    }
    tl.to({}, { duration: .25 });
    for (const p of parts.filter(x => x.fix)) {
      tl.to(p.span, { '--strike': 1, duration: .28, ease: 'ih.change' })
        .call(() => { p.span.textContent = p.fix; p.span.className = 'fixed'; p.span.style.removeProperty('--strike'); })
        .to({}, { duration: .12 });
    }
    tl.call(() => caret.remove())
      .to(draft, { opacity: 0, y: -10, duration: .45, ease: 'ih.change' }, '+=.15')
      .fromTo($$('.hero__line', finalEl), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .9, stagger: .08 }, '<.1')
      .set(finalEl, { opacity: 1 }, '<')
      .add(pen(letter, 1.5), '<.25')
      .call(() => draft.remove());
    const skip = () => { if (tl.progress() < 1) tl.progress(1); off(); };
    const off = () => ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(t => removeEventListener(t, skip));
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(t => addEventListener(t, skip, { passive: true, once: true }));
    tl.eventCallback('onComplete', off);
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
    const copy = $('[data-hero-copy]'), vp = $('[data-voiceprint]'), hint = $('.hero__hint');
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
      const peek = () => innerHeight * .835 - (vp.offsetTop + vp.offsetHeight + 22);
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
            field?.set({ converge: c, base: gsap.utils.interpolate(.79, baseline, gsap.parseEase('ih.change')(c)) });
            // The walkthrough owns the window from the moment the device has settled until the pin ends.
            const g = (p - introEnd) / (1 - introEnd - .015);
            const done = g >= 1;
            if (done !== free) { free = done; hero.classList.toggle('is-free', done); }
            demo?.guide(done ? null : Math.max(0, g));
          }
        }
      });
      // Intro, laid out on a 0–1 clock, then stretched to its share of the pin.
      tl.to([copy, hint], { y: -70, opacity: 0, duration: .26, ease: 'power2.in' }, 0)
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

    /* Interlude: each line surfaces from the paper as it reaches the middle of the screen. */
    for (const line of $$('[data-line]')) {
      gsap.fromTo(line, { opacity: .08, y: 18 }, { opacity: 1, y: 0, ease: 'none', scrollTrigger: { trigger: line, start: 'top 85%', end: 'top 50%', scrub: .6 } });
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
      const parts = $$('.moment__kicker, .moment__title, .moment__echo, .moment__body, .moment__aside', m);
      gsap.from(parts, { y: 36, opacity: 0, duration: 1.1, stagger: .07, scrollTrigger: { trigger: m, start: 'top 70%' } });
    }

    /* Section headings rise line by line behind a mask. refreshPriority -1: measured after the pins above. */
    for (const h of $$('.section .display')) {
      const split = SplitText.create(h, { type: 'lines', mask: 'lines', linesClass: 'line' });
      gsap.from(split.lines, { yPercent: 105, duration: 1.1, stagger: .08, scrollTrigger: { trigger: h, start: 'top 88%', refreshPriority: -1 } });
    }
    // Content reveals use IntersectionObserver, so pinned sections and hash jumps can't strand them hidden.
    const reveal = $$('.caption-serif, .principles__list li, .sheet div, .faq__list details, .specs div, .index li')
      .filter(el => el.getBoundingClientRect().top > innerHeight * .9);
    gsap.set(reveal, { y: 28, opacity: 0 });
    const pending = new Set(reveal);
    const showEls = els => { els = els.filter(el => pending.delete(el)); if (els.length) gsap.to(els, { y: 0, opacity: 1, duration: 1, stagger: .06, overwrite: true }); };
    revealIO = new IntersectionObserver(entries => {
      showEls(entries.filter(e => e.isIntersecting || e.boundingClientRect.top < 0).map(e => { revealIO.unobserve(e.target); return e.target; }));
    }, { rootMargin: '0px 0px -8% 0px' });
    reveal.forEach(el => revealIO.observe(el));
    ScrollTrigger.addEventListener('refresh', () => showEls([...pending].filter(el => el.getBoundingClientRect().top < innerHeight)));

    /* Download: the same voiceprint, short — two voices close into a line and the lettering writes. */
    const dl = $('[data-download]'), dlWord = $('.download__word .lettering', dl), dlLine = $('.download__line', dl);
    gsap.set(strokes(dlWord), { drawSVG: '0%' });
    const mini = field?.mini;
    gsap.timeline({ scrollTrigger: { trigger: dl, start: 'top 75%', end: 'top 15%', scrub: .6,
      onUpdate: s => { if (mini) { mini.converge = Math.min(1, s.progress / .5); mini.wake?.(); } } } })
      .to(dlLine, { scaleX: 1, duration: .3, ease: 'ih.change' }, .35)
      .add(pen(dlWord, .5, 'none'), .5);

    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    // Pins add height after the browser already jumped to a #hash, so land there again once layout settles.
    addEventListener('load', () => { ScrollTrigger.refresh(); if (location.hash.length > 1) requestAnimationFrame(() => go(location.hash, true)); }, { once: true });
    return () => { hero.classList.remove('hero--stage', 'is-free'); demo?.guide(null); };
  });
  reducedMQ.addEventListener('change', () => location.reload());
})();
