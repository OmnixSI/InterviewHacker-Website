// Final's choreography: Lenis smooth wheel, GSAP tweens and ScrollTrigger scenes.
// Progressive throughout: without this file (or with reduced motion) the page is complete and static.
// The walkthrough's step logic lives in page.js, so it also works without GSAP.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => root.classList.contains('motion-paused');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const header = $('[data-header]');
  const field = window.IHField;

  if (!window.gsap || !window.ScrollTrigger) { root.classList.add('is-ready'); return; }
  gsap.registerPlugin(ScrollTrigger, ...(window.SplitText ? [SplitText] : []), ...(window.DrawSVGPlugin ? [DrawSVGPlugin] : []), ...(window.CustomEase ? [CustomEase] : []));
  if (window.CustomEase) {
    CustomEase.create('ih.settle', '.16,1,.3,1');
    CustomEase.create('ih.change', '.65,0,.35,1');
  }
  gsap.defaults({ ease: window.CustomEase ? 'ih.settle' : 'power3.out', duration: 1 });

  /* ---------- Smooth scroll and in-page links ---------- */
  let lenis = null;
  if (!reduced.matches && window.Lenis) {
    lenis = new Lenis({ lerp: .11, smoothWheel: true, anchors: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.addEventListener('ih:motion', () => (paused() ? lenis.stop() : lenis.start()));
  }
  const go = (id, immediate) => {
    const el = id === '#top' ? 0 : $(id);
    if (el == null) return;
    const offset = typeof el === 'number' ? 0 : -(header?.offsetHeight || 60) + 2;
    if (lenis) lenis.scrollTo(el, { offset, duration: 1.4, immediate });
    else if (typeof el === 'number') scrollTo(0, 0); else el.scrollIntoView();
  };
  for (const a of $$('a[href^="#"]')) {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2 || (id !== '#top' && !$(id))) return;
      e.preventDefault();
      go(id, false);
      history.replaceState(null, '', id);
    });
  }

  /* ---------- Header, progress, active section ---------- */
  const bar = $('.progress span');
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      header?.classList.toggle('is-scrolled', y > 24);
      header?.classList.toggle('is-hidden', y > 900 && y > lastY + 2);
      if (y < lastY - 2) header?.classList.remove('is-hidden');
      lastY = y;
      if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`;
    }
  });
  for (const link of $$('.hd__nav a')) {
    const sec = $(link.getAttribute('href'));
    if (sec) ScrollTrigger.create({ trigger: sec, start: 'top 45%', end: 'bottom 45%', refreshPriority: -1, onToggle: s => link.classList.toggle('is-active', s.isActive) });
  }
  root.classList.add('is-ready');

  // Writes a drawing in pen order: each stroke's share of the time follows its length.
  // pathLength="1" (used by the CSS fallback) would distort DrawSVG's dash lengths, so it goes first.
  const strokes = svg => { const ps = svg ? $$('path', svg) : []; ps.forEach(p => p.removeAttribute('pathLength')); return ps; };
  function pen(svg, total, ease = 'power1.inOut') {
    const tl = gsap.timeline();
    if (!svg || !window.DrawSVGPlugin) return tl;
    const paths = strokes(svg), lens = paths.map(p => p.getTotalLength()), sum = lens.reduce((a, b) => a + b, 0) || 1;
    paths.forEach((p, i) => tl.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: Math.max(.04, total * lens[i] / sum), ease: i === 0 ? ease : 'none' }));
    return tl;
  }

  /* ---------- Hero headline: two-pass recognition, in place ----------
     1. A grey draft streams into the headline's own positions, mistakes and all, behind a caret.
     2. A refinement line sweeps across; each character it passes turns into the display face;
        mistakes are struck in amber first, then corrected.
     3. At the end the draft words are struck and the lettering writes itself in violet.
     Plays on every load; scrolling, a click or a key jumps to the finished headline. */
  function twoPass() {
    const h1 = $('[data-two-pass]'), letterBox = $('.hero__lettering', h1), letter = $('svg', letterBox);
    if (!h1 || !letter) return;
    const lines = $$('.hero__line', h1);
    const tokens = str => str.match(/[　-鿿＀-￯]|\s+|[^\s　-鿿＀-￯]+/g) || [];
    const draftTokens = tokens(h1.dataset.draft || '');
    const cells = [];
    lines.forEach((line, li) => {
      const text = line.firstChild;
      if (!text || text.nodeType !== 3 || !text.data.trim()) return;
      const wrap = document.createElement('span');
      wrap.className = 'hero__text';
      tokens(text.data).forEach((tok, ti) => {
        if (/^\s+$/.test(tok)) { wrap.append(document.createTextNode(tok)); return; }
        const draft = li === 0 ? draftTokens[ti] ?? tok : tok;
        const cell = document.createElement('span');
        cell.className = 'hc' + (draft !== tok ? ' is-wrong' : '');
        cell.innerHTML = '<span class="hc__f"></span><span class="hc__d" aria-hidden="true"></span>';
        cell.firstChild.textContent = tok;
        cell.lastChild.textContent = draft;
        wrap.append(cell);
        cells.push({ cell, line: li });
      });
      text.replaceWith(wrap);
    });
    const word = document.createElement('span');
    word.className = 'hero__draftword';
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

    const tl = gsap.timeline({ delay: .35, onComplete: finish });
    const step = root.lang.startsWith('zh') ? .07 : .13;
    cells.forEach((c, i) => tl.call(() => c.cell.append(caret), null, i * step).to(D(c), { opacity: 1, duration: .18, ease: 'power1.out' }, i * step));
    let t = cells.length * step;
    tl.call(() => word.append(caret), null, t).to(word, { opacity: 1, duration: .3 }, t);
    t += .55;
    tl.call(() => { caret.remove(); h1.classList.add('is-refining'); }, null, t);

    const box = h1.getBoundingClientRect();
    const rows = lines.map(line => {
      const r = line.getBoundingClientRect();
      const right = line.querySelector('.hero__lettering') ? letterBox.getBoundingClientRect().right : r.right;
      return { left: r.left - box.left, right: right - box.left, top: r.top - box.top, height: r.height };
    });
    const sweepTime = .75;
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
        if (wrong) tl.to(c.cell, { '--strike': 1, duration: .16, ease: 'power2.inOut' }, at - .08);
        tl.to(D(c), { opacity: 0, yPercent: -22, duration: .32, ease: 'power2.inOut' }, at + (wrong ? .12 : 0))
          .to(F(c), { opacity: 1, yPercent: 0, duration: .55 }, at + (wrong ? .16 : .02));
        if (wrong) tl.to(c.cell, { '--strike': 0, duration: .01 }, at + .2);
      }
      if (li === rows.length - 1) {
        const wr = word.getBoundingClientRect();
        const at = start + sweepTime * reach((wr.left - box.left - row.left) / span);
        tl.to(word, { '--strike': 1, duration: .2, ease: 'power2.inOut' }, at)
          .to(word, { opacity: 0, y: -10, duration: .3, ease: 'power2.inOut' }, at + .22)
          .add(pen(letter, 1.5), at + .3);
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
  }

  const mm = gsap.matchMedia();
  mm.add({
    motion: '(prefers-reduced-motion: no-preference)',
    stage: '(min-width: 901px) and (min-height: 600px)',
    phone: '(min-width: 1061px) and (min-height: 640px)'
  }, ctx => {
    const { motion, stage, phone } = ctx.conditions;
    if (!motion) return;
    if (!paused()) twoPass();

    /* Hero: as it scrolls away the two voices calm into one ink line and the copy lifts off. */
    const hero = $('[data-hero]'), copy = $('[data-hero-copy]');
    ScrollTrigger.create({
      trigger: hero, start: 'top top', end: 'bottom top', scrub: true,
      onUpdate(self) {
        const p = self.progress;
        field?.set({ converge: Math.min(1, p * 1.6), base: gsap.utils.interpolate(.815, .55, Math.min(1, p * 1.3)) });
        gsap.set(copy, { y: -p * 120, opacity: 1 - Math.min(1, p * 1.5) });
      }
    });

    /* Walkthrough: the laptop rises and settles flat as the section arrives; the title writes "next line." */
    const demo = $('[data-demo]'), device = $('[data-device]'), word = $('.demo__word svg');
    if (stage && device) {
      gsap.fromTo(device, { rotationX: 22, y: 90, scale: .9, transformOrigin: '50% 100%' }, { rotationX: 0, y: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: demo, start: 'top 95%', end: 'top top', scrub: .6 } });
      gsap.fromTo('.demo__head', { y: 40, opacity: 0 }, { y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: demo, start: 'top 70%', end: 'top 10%', scrub: .6 } });
    }
    if (word) {
      gsap.set(strokes(word), { drawSVG: '0%' });
      ScrollTrigger.create({ trigger: demo, start: stage ? 'top 30%' : 'top 75%', once: true, onEnter: () => pen(word, 1.6).add(() => gsap.to(strokes(word)[0], { drawSVG: '6.5% 100%', duration: .5 }), '+=.1') });
    }

    /* Interlude: the lines rise past the drop, bending as they cross the middle, through a blur. */
    const swirl = $('[data-swirl]'), col = $('[data-swirl-col]'), drop = $('.swirl__drop');
    const swirlLines = $$('.sl', swirl || document);
    if (swirl && stage) {
      swirl.classList.add('is-pinned');
      const SWAY = .16, gutter = 24;
      const bend = y => Math.sin((.5 - Math.max(-.2, Math.min(1.2, y))) * Math.PI) * .5;
      const setY = gsap.quickSetter(col, 'y', 'px'), setters = swirlLines.map(l => ({ x: gsap.quickSetter(l, 'x', 'px'), o: gsap.quickSetter(l, 'opacity') }));
      let H = 1, W = 1, from = 0, travel = 1, mids = [], room = [], lastMid = -1;
      const measure = () => {
        gsap.set(col, { y: 0 }); gsap.set(swirlLines, { x: 0, opacity: 1, filter: 'none' });
        H = innerHeight; W = col.offsetWidth;
        const c = col.getBoundingClientRect();
        const rects = swirlLines.map(l => l.getBoundingClientRect());
        mids = rects.map(r => r.top - c.top + r.height / 2);
        room = rects.map(r => [Math.min(0, gutter - r.left), Math.max(0, innerWidth - gutter - r.right)]);
        from = H * 1.04 - mids[0];
        const closing = swirlLines.length - $$('.swirl__stanza--end .sl', swirl).length;
        const to = H * .62 - mids[closing];
        travel = Math.max(1, from - to);
        swirl.style.height = `${Math.round(travel * 1.6 + H)}px`;
      };
      const render = p => {
        const y = from - p * travel;
        setY(y);
        let crossing = -1;
        swirlLines.forEach((l, i) => {
          const sy = (y + mids[i]) / H, k = Math.max(0, Math.min(1, (1 - sy) / .2, (sy - .03) / .22));
          setters[i].x(Math.max(room[i][0], Math.min(room[i][1], bend(sy) * SWAY * W)));
          setters[i].o(k);
          l.style.filter = k > .98 ? '' : `blur(${((1 - k) * 7).toFixed(1)}px)`;
          if (Math.abs(sy - .5) < .04) crossing = i;
        });
        // A line crossing the middle drops a ring on the water.
        if (crossing >= 0 && crossing !== lastMid) { lastMid = crossing; drop?.classList.remove('is-drop'); void drop?.offsetWidth; drop?.classList.add('is-drop'); }
      };
      measure();
      ScrollTrigger.addEventListener('refreshInit', measure);
      ScrollTrigger.create({ trigger: swirl, start: 'top top', end: 'bottom bottom', onUpdate: s => render(s.progress), onRefresh: s => render(s.progress) });
      render(0);
    } else if (swirl) {
      for (const l of swirlLines) gsap.fromTo(l, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.1, scrollTrigger: { trigger: l, start: 'top 90%' } });
    }

    /* Section headings rise line by line behind a mask. */
    if (window.SplitText) {
      for (const h of $$('.display, .tpl__intro h3, .ending__title')) {
        const split = SplitText.create(h, { type: 'lines', mask: 'lines', linesClass: 'line' });
        gsap.from(split.lines, { yPercent: 108, duration: 1.15, stagger: .09, scrollTrigger: { trigger: h, start: 'top 88%', refreshPriority: -1 } });
      }
    }
    // Leads, kickers and the specimens surface after their heading.
    for (const el of $$('.head .lead, .head .eyebrow, .tsel, .audio, .process > li, .install > li, .faq details, .ledger__col, .aside, .req li')) {
      gsap.from(el, { y: 34, opacity: 0, duration: 1.1, scrollTrigger: { trigger: el, start: 'top 90%', refreshPriority: -1 } });
    }

    /* Pen marks are drawn as they come into view, like notes added while reading. */
    if (window.DrawSVGPlugin) {
      for (const svg of $$('.anno .pen, .series__arrow .pen, .ledger__mid .pen, .gap-mark .pen, .badge--ringed .pen, .ledger__line')) {
        const paths = strokes(svg);
        gsap.set(paths, { drawSVG: '0%' });
        ScrollTrigger.create({ trigger: svg.closest('.tpl-panel') ? svg.parentElement : svg, start: 'top 82%', once: true, onEnter: () => pen(svg, svg.classList.contains('ledger__line') ? 1.6 : .7).delay(.2) });
      }
      // Template panels that start hidden draw their marks when shown.
      document.addEventListener('ih:tpl', e => { for (const svg of $$('.pen', e.detail)) pen(svg, .7); });
    }

    /* Depth: the series sheets and the laptop drift at different speeds. */
    const leaves = $$('.series .leaf');
    leaves.forEach((leaf, i) => gsap.fromTo(leaf, { y: [70, 30, 110][i] || 60, rotation: [-3, 1.2, 3.5][i] || 0 }, { y: 0, rotation: [-1.4, 0, 1.6][i] || 0, ease: 'none', scrollTrigger: { trigger: '.series', start: 'top bottom', end: 'center 45%', scrub: .8 } }));

    /* Phone companion: pinned for three beats, then the phone is handed over. */
    const comp = $('[data-companion]');
    if (comp && phone && window.IHCompanion) {
      comp.classList.add('is-pinned');
      ScrollTrigger.create({ trigger: comp, start: 'top top', end: 'bottom bottom', onUpdate: s => (s.progress > .985 ? IHCompanion.release() : IHCompanion.scene(s.progress)) });
    }

    /* Ending: the words surface from the water, through a blur; the signature writes itself. */
    const ending = $('[data-ending]');
    if (ending) {
      gsap.from($$('.ending__sub, .ending__fine', ending), { opacity: 0, y: 34, filter: 'blur(10px)', duration: 1.6, stagger: .12, clearProps: 'filter,transform', scrollTrigger: { trigger: ending, start: 'top 45%' } });
      gsap.from($('.ending__btn', ending), { opacity: 0, duration: 1.2, delay: .3, scrollTrigger: { trigger: ending, start: 'top 45%' } });
      const sig = $('.ending__script svg', ending);
      if (sig && window.DrawSVGPlugin) { gsap.set(strokes(sig), { drawSVG: '0%' }); ScrollTrigger.create({ trigger: ending, start: 'top 35%', once: true, onEnter: () => pen(sig, 1.8).delay(.5) }); }
    }

    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    addEventListener('load', () => { ScrollTrigger.refresh(); if (location.hash.length > 1) requestAnimationFrame(() => go(location.hash, true)); }, { once: true });
    return () => { swirl?.classList.remove('is-pinned'); if (swirl) swirl.style.height = ''; comp?.classList.remove('is-pinned'); };
  });
  reduced.addEventListener('change', () => location.reload());
})();
