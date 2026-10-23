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

  // Privacy route switches (illustrative: show where data goes when an option is on).
  for (const sw of $$('[data-route] .switch')) {
    sw.addEventListener('click', () => {
      const on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(on));
      sw.closest('[data-route]').classList.toggle('is-on', on);
    });
  }

  // Optional-components configurator: live download total.
  const config = $('[data-config]');
  if (config) {
    const total = $('[data-config-total]', config);
    const update = () => {
      const mb = $$('input[data-size]', config).filter(i => i.checked).reduce((s, i) => s + Number(i.dataset.size), 0);
      total.textContent = mb >= 1000 ? `${(mb / 1000).toFixed(2)} GB` : `${mb} MB`;
    };
    config.addEventListener('change', update);
    update();
  }

  // Ambient loop helper: runs only while visible, unpaused and with motion allowed.
  function ambient(el, ms, step) {
    if (!el) return;
    let visible = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(el);
    setInterval(() => { if (visible && !isPaused() && !reducedMQ.matches && !document.hidden) step(); }, ms);
  }

  // Import queue: each file walks parse → (OCR) → index → ready, staggered, then the queue starts over.
  const queue = $('[data-queue]');
  if (queue) {
    const labels = queue.dataset.stages.split('|');
    const rows = $$('[data-q]', queue);
    let tick = 0;
    const render = () => rows.forEach((row, i) => {
      const plan = row.hasAttribute('data-ocr') ? [0, 1, 2, 3, 4] : [0, 1, 3, 4];
      const s = plan[Math.max(0, Math.min(plan.length - 1, tick - i * 2))];
      $('[data-q-stage]', row).textContent = labels[s];
      row.style.setProperty('--p', [0, .3, .62, .86, 1][s]);
      row.classList.toggle('is-ready', s === 4);
    });
    ambient(queue, 520, () => { tick = tick > rows.length * 2 + 10 ? 0 : tick + 1; render(); });
    if (!reducedMQ.matches) render();
  }

  // Scene tabs (WAI-ARIA tabs) with an autoplay progress line until someone takes over.
  const tabs = $$('[data-scene-tabs] [role="tab"]'), panels = $$('[data-scene]');
  let sceneIndex = 0, sceneAuto = !reducedMQ.matches, sceneT = 0;
  function showScene(i, { focus = false, user = false } = {}) {
    if (user) { sceneAuto = false; tabs.forEach(t => t.style.removeProperty('--p')); }
    const prev = sceneIndex;
    sceneIndex = (i + tabs.length) % tabs.length;
    tabs.forEach((t, k) => { const on = k === sceneIndex; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    panels.forEach((p, k) => { p.classList.toggle('is-active', k === sceneIndex); p.classList.toggle('is-before', k < sceneIndex && k !== prev); });
    if (focus) tabs[sceneIndex].focus();
    sceneT = 0;
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showScene(i, { user: true }));
    t.addEventListener('keydown', e => {
      const map = { ArrowRight: sceneIndex + 1, ArrowLeft: sceneIndex - 1, Home: 0, End: tabs.length - 1 };
      if (e.key in map) { e.preventDefault(); showScene(map[e.key], { focus: true, user: true }); }
    });
  });
  ambient($('[data-scene-tabs]'), 70, () => {
    if (!sceneAuto) return;
    sceneT += 70 / 7000;
    tabs[sceneIndex].style.setProperty('--p', Math.min(1, sceneT).toFixed(3));
    if (sceneT >= 1) { tabs[sceneIndex].style.removeProperty('--p'); showScene(sceneIndex + 1); }
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

    /* Hero → voiceprint → device, on one pinned stage. */
    const hero = $('[data-hero]'), pin = $('[data-hero-pin]');
    const copy = $('[data-hero-copy]'), vp = $('[data-voiceprint]');
    const vpWord = $('.lettering--lead', vp), stageEl = $('[data-stage]'), device = $('[data-device]');
    const controls = $('[data-demo-controls]');
    if (stage) {
      hero.classList.add('hero--stage');
      const measure = () => {
        const top = vp.offsetTop + vp.offsetHeight + 22;
        pin.style.setProperty('--stage-top', `${top}px`);
      };
      measure();
      // Where the voices converge: the baseline of the lettering, in viewport fractions.
      // Measured at refresh (not per frame) with the voiceprint's own tween offset removed.
      let baseline = .3;
      const measureBaseline = () => {
        const r = vpWord.getBoundingClientRect();
        baseline = (r.top - (gsap.getProperty(vp, 'y') || 0) - pin.getBoundingClientRect().top + r.height * BASELINE) / innerHeight;
      };
      const peek = () => innerHeight * .835 - (vp.offsetTop + vp.offsetHeight + 22);
      gsap.set(strokes(vpWord), { drawSVG: '0%' });
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero, pin, start: 'top top', end: '+=150%', scrub: .6, invalidateOnRefresh: true,
          onRefreshInit: measure,
          onRefresh: measureBaseline,
          onUpdate(self) {
            const p = self.progress;
            // Voices converge over the first third and settle on the lettering's baseline.
            const c = gsap.utils.clamp(0, 1, p / .34);
            field?.set({ converge: c, base: gsap.utils.interpolate(.79, baseline, gsap.parseEase('ih.change')(c)) });
          }
        }
      });
      tl.to(copy, { y: -70, opacity: 0, duration: .26, ease: 'power2.in' }, 0)
        .fromTo(vp, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .16, ease: 'ih.settle' }, .2)
        .add(pen(vpWord, .32, 'none'), .3)
        .to('.field', { opacity: 0, duration: .12 }, .5)
        // With the voices gone, the lead-in retracts into the word so it doesn't linger as an underscore.
        .to(strokes(vpWord)[0], { drawSVG: '6.5% 100%', duration: .1, ease: 'ih.change' }, .56)
        .fromTo(device, { y: peek, rotationX: 24, scale: .9 }, { y: 0, rotationX: 0, scale: 1, duration: .55, ease: 'ih.change' }, .38)
        .fromTo(controls, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .12, ease: 'ih.settle' }, .86);
      measureBaseline();
      heroST = tl.scrollTrigger;
    } else {
      // Plain reading order: the voiceprint writes itself when it scrolls into view.
      gsap.set(strokes(vpWord), { drawSVG: '0%' });
      ScrollTrigger.create({ trigger: vp, start: 'top 75%', once: true, onEnter: () => pen(vpWord, 2) });
      gsap.from(device, { y: 60, opacity: 0, duration: 1.2, scrollTrigger: { trigger: device, start: 'top 90%' } });
    }

    /* Pipeline: two coloured voices travel the wire, merge at "question detection", and light each station. */
    const pipe = $('[data-pipeline]'), track = $('[data-pipe-track]'), wire = $('[data-pipe-wire]');
    const stations = $$('[data-station]'), counter = $('[data-pipe-index]'), fill = $('[data-pipe-fill]');
    let lit = -2;
    function light(i) {
      if (i === lit) return;
      lit = i;
      stations.forEach((s, k) => { s.classList.toggle('is-lit', k <= i); s.classList.toggle('is-current', k === i); });
      if (counter) counter.textContent = String(Math.max(0, i) + 1).padStart(2, '0');
    }
    light(-1);
    if (wide) {
      const base = $('.wire__base', wire), them = $('.wire__them', wire), me = $('.wire__me', wire), merged = $('.wire__merged', wire), pulse = $('.wire__pulse', wire);
      let pts = [], mergeAt = .4, len = 1;
      const curve = (p, dy = () => 0) => {
        let d = `M${p[0][0] - 280} ${p[0][1] + dy(0)} L${p[0][0]} ${p[0][1] + dy(0)}`;
        for (let i = 1; i < p.length; i++) { const [x0, y0] = p[i - 1], [x1, y1] = p[i], mx = (x0 + x1) / 2; d += ` C${mx} ${y0 + dy(i - 1)} ${mx} ${y1 + dy(i)} ${x1} ${y1 + dy(i)}`; }
        return d;
      };
      function layout() {
        pts = stations.map(s => [track.offsetLeft + s.offsetLeft + s.offsetWidth / 2, track.offsetTop + s.offsetTop + 40]);
        const w = track.scrollWidth, h = track.offsetHeight, end = pts[pts.length - 1];
        wire.setAttribute('width', w); wire.setAttribute('height', h); wire.setAttribute('viewBox', `0 0 ${w} ${h}`);
        const lead = pts.slice(0, 3);
        const spread = i => [10, 6, 0][i];
        base.setAttribute('d', `${curve(pts)} L${end[0] + 320} ${end[1]}`);
        them.setAttribute('d', curve(lead, i => -spread(i)));
        me.setAttribute('d', curve(lead, i => spread(i)));
        merged.setAttribute('d', `${curve(pts.slice(2))} L${end[0] + 320} ${end[1]}`);
        mergeAt = (pts[2][0] - (pts[0][0] - 280)) / (end[0] + 320 - (pts[0][0] - 280));
        len = base.getTotalLength();
      }
      layout();
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: pipe, pin: true, scrub: .8, start: 'top top', end: () => `+=${dist() * 1.15 + innerHeight * .3}`, invalidateOnRefresh: true, onRefreshInit: layout },
        onUpdate() {
          const pt = base.getPointAtLength(this.progress() * len);
          let idx = -1;
          pts.forEach(([px], k) => { if (pt.x >= px - 30) idx = k; });
          light(idx);
          if (fill) fill.style.transform = `scaleX(${this.progress().toFixed(4)})`;
        }
      });
      tl.to([track, wire], { x: () => -dist() }, 0)
        .fromTo([them, me], { drawSVG: '0%' }, { drawSVG: '100%', duration: mergeAt }, 0)
        .fromTo(merged, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1 - mergeAt }, mergeAt)
        .to(pulse, { motionPath: { path: base, align: base, alignOrigin: [.5, .5] }, duration: 1 }, 0);
    } else {
      ScrollTrigger.create({
        trigger: track, start: 'top 70%', end: 'bottom 60%', scrub: true,
        onUpdate: s => { track.style.setProperty('--pipe-progress', s.progress.toFixed(3)); light(Math.floor(s.progress * stations.length * .999)); }
      });
    }

    /* Screen awareness: draw the capture region, then tick off the points as you scroll. */
    const crop = $('[data-crop]'), follow = $('[data-follow]'), items = $$('[data-follow-item]');
    gsap.timeline({ scrollTrigger: { trigger: '[data-screen]', start: 'top 70%', end: 'bottom 70%', scrub: .6,
      onUpdate: s => items.forEach((li, k) => li.classList.toggle('is-done', s.progress > .38 + k * .17)) } })
      .fromTo(crop, { scaleX: .08, scaleY: .1, opacity: 0 }, { scaleX: 1, scaleY: 1, opacity: 1, duration: .35, ease: 'ih.change' }, 0)
      .fromTo(follow, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .2 }, .25);

    /* Review timeline bars grow when they arrive. */
    gsap.from('[data-timeline] i', { scaleX: 0, duration: 1.2, stagger: .1, scrollTrigger: { trigger: '[data-timeline]', start: 'top 80%' } });

    /* Download: the same voiceprint, short — two voices close into a line and the lettering writes. */
    const dl = $('[data-download]'), dlWord = $('.download__word .lettering', dl), dlLine = $('.download__line', dl);
    gsap.set(strokes(dlWord), { drawSVG: '0%' });
    const mini = field?.mini;
    gsap.timeline({ scrollTrigger: { trigger: dl, start: 'top 75%', end: 'top 15%', scrub: .6,
      onUpdate: s => { if (mini) { mini.converge = Math.min(1, s.progress / .5); mini.wake?.(); } } } })
      .to(dlLine, { scaleX: 1, duration: .3, ease: 'ih.change' }, .35)
      .add(pen(dlWord, .5, 'none'), .5);

    /* Section headings rise line by line behind a mask. refreshPriority -1: measured after the pins above. */
    for (const h of $$('.section .display')) {
      const split = SplitText.create(h, { type: 'lines', mask: 'lines', linesClass: 'line' });
      gsap.from(split.lines, { yPercent: 105, duration: 1.1, stagger: .08, scrollTrigger: { trigger: h, start: 'top 88%', refreshPriority: -1 } });
    }
    // Content reveals use IntersectionObserver, so pinned sections and hash jumps can't strand them hidden:
    // anything already above the viewport shows at once, anything below rises in as it arrives.
    const reveal = $$('.section .lead, .points li, .ticks li, .view-card, .queue, .mdcard, .config, .flowmap, .faq__list details, .timeline li, .specs div, .index li, .scene__shot, .slide-stage')
      .filter(el => el.getBoundingClientRect().top > innerHeight * .9);
    gsap.set(reveal, { y: 28, opacity: 0 });
    const pending = new Set(reveal);
    const show = els => { els = els.filter(el => pending.delete(el)); if (els.length) gsap.to(els, { y: 0, opacity: 1, duration: 1, stagger: .06, overwrite: true }); };
    revealIO = new IntersectionObserver(entries => {
      show(entries.filter(e => e.isIntersecting || e.boundingClientRect.top < 0).map(e => { revealIO.unobserve(e.target); return e.target; }));
    }, { rootMargin: '0px 0px -8% 0px' });
    reveal.forEach(el => revealIO.observe(el));
    // Belt and braces for jumps (hash links, restored scroll): after every layout pass, show what's already passed.
    ScrollTrigger.addEventListener('refresh', () => show([...pending].filter(el => el.getBoundingClientRect().top < innerHeight)));

    // Re-measure once fonts and images settle (the display face changes line breaks).
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    // Pins add height after the browser already jumped to a #hash, so land there again once layout settles.
    addEventListener('load', () => { ScrollTrigger.refresh(); if (location.hash.length > 1) requestAnimationFrame(() => go(location.hash, true)); }, { once: true });
    return () => hero.classList.remove('hero--stage');
  });
  reducedMQ.addEventListener('change', () => location.reload());
})();
