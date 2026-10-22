// Story choreography: Lenis smooth scrolling + GSAP ScrollTrigger scenes.
// Everything here is progressive: without this file the page is a complete, static, readable document.
(() => {
  const root = document.documentElement;
  const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isPaused = () => root.classList.contains('motion-paused');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const header = $('[data-header]');
  const headerOffset = () => (header?.offsetHeight || 64) + 8;

  /* ---------- Interactions that work with or without GSAP ---------- */

  // Motion pause: stops ambient loops (shader, waves, marquee, demo, cycles). Scroll-linked motion stays user-driven.
  const motionBtn = $('[data-motion-toggle]');
  function syncMotion() {
    const p = isPaused();
    motionBtn?.setAttribute('aria-pressed', String(p));
    motionBtn?.setAttribute('aria-label', p ? '继续动效' : '暂停动效');
    motionBtn?.setAttribute('title', p ? '继续动效' : '暂停动效');
  }
  motionBtn?.addEventListener('click', () => {
    root.classList.toggle('motion-paused');
    try { localStorage.setItem('interviewhacker-motion', isPaused() ? 'paused' : 'running'); } catch { /* session only */ }
    syncMotion();
    document.dispatchEvent(new Event('ih:motion'));
  });
  syncMotion();

  // Mobile menu
  const menuBtn = $('[data-menu-toggle]');
  const nav = $('#site-nav');
  function setMenu(open) {
    nav?.classList.toggle('is-open', open);
    menuBtn?.setAttribute('aria-expanded', String(open));
    menuBtn?.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
  }
  menuBtn?.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  addEventListener('keydown', e => { if (e.key === 'Escape' && nav?.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); } });

  // Scene tabs (WAI-ARIA tabs pattern) with optional autoplay.
  const tabs = $$('[data-scene-tabs] [role="tab"]');
  const panels = $$('[data-scene]');
  let sceneIndex = 0, autoplay = !reducedMQ.matches, sceneTween = null;
  function showScene(i, {focus = false, user = false} = {}) {
    if (user) { autoplay = false; sceneTween?.kill(); for (const t of tabs) t.querySelector('.scenes__progress').style.transform = ''; }
    const prev = sceneIndex;
    sceneIndex = (i + tabs.length) % tabs.length;
    tabs.forEach((t, k) => { const on = k === sceneIndex; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    panels.forEach((p, k) => p.classList.toggle('is-active', k === sceneIndex));
    if (focus) tabs[sceneIndex].focus();
    if (window.gsap && prev !== sceneIndex && !reducedMQ.matches) {
      const p = panels[sceneIndex];
      gsap.fromTo(p.querySelector('.scene__copy'), {x: -24, opacity: 0}, {x: 0, opacity: 1, duration: .7, ease: 'expo.out'});
      gsap.fromTo(p.querySelector('.scene__shot'), {y: 30, scale: .96, opacity: 0, clipPath: 'inset(8% 8% 8% 8% round 24px)'},
        {y: 0, scale: 1, opacity: 1, clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: .9, ease: 'expo.out'});
    }
    if (tabs[sceneIndex].scrollIntoView && matchMedia('(max-width: 900px)').matches && user) {
      tabs[sceneIndex].parentElement.scrollTo({left: tabs[sceneIndex].offsetLeft - 16, behavior: 'smooth'});
    }
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showScene(i, {user: true}));
    t.addEventListener('keydown', e => {
      const map = {ArrowRight: sceneIndex + 1, ArrowLeft: sceneIndex - 1, Home: 0, End: tabs.length - 1};
      if (e.key in map) { e.preventDefault(); showScene(map[e.key], {focus: true, user: true}); }
    });
  });

  // Privacy route switches (illustrative: they show where data goes when an option is enabled).
  for (const sw of $$('[data-route] .switch')) {
    sw.addEventListener('click', () => {
      const on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(on));
      sw.closest('[data-route]').classList.toggle('is-on', on);
    });
  }

  // Pointer spotlight on cards.
  if (finePointer) {
    for (const card of $$('[data-card], .tip')) {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    }
  }

  // Ambient cycles shared by both paths (respect pause, visibility and reduced motion).
  function cycle(el, ms, step) {
    if (!el) return;
    let visible = false, i = 0;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(el);
    setInterval(() => { if (visible && !isPaused() && !reducedMQ.matches && !document.hidden) step(i++); }, ms);
  }
  const adjust = $('[data-adjust-cycle]');
  cycle(adjust, 1100, i => { const b = adjust.children; for (let k = 0; k < b.length; k++) b[k].classList.toggle('is-on', k === i % b.length); });
  const search = $('[data-search-cycle]');
  const searchLabel = $('[data-search-label]');
  cycle(search, 1400, i => {
    const s = i % 4;
    search.classList.toggle('is-searching', s === 1);
    search.classList.toggle('is-sourced', s >= 2);
    searchLabel.textContent = ['快速回答', '正在联网…', '联网版 · 附来源', '联网版 · 附来源'][s];
  });
  const orbitNodes = $$('.orbit__node');
  cycle($('[data-orbit]'), 1300, i => orbitNodes.forEach((n, k) => n.classList.toggle('is-on', k === i % orbitNodes.length)));

  // FAQ: animated disclosure that still uses native <details>.
  for (const d of $$('[data-faq] details')) {
    const summary = d.querySelector('summary');
    const body = d.querySelector('.faq__answer');
    summary.addEventListener('click', e => {
      if (!window.gsap || reducedMQ.matches) return;
      e.preventDefault();
      if (d.open) {
        gsap.to(body, {height: 0, duration: .45, ease: 'power3.inOut', onComplete: () => { d.open = false; gsap.set(body, {clearProps: 'height'}); }});
      } else {
        d.open = true;
        gsap.fromTo(body, {height: 0}, {height: 'auto', duration: .6, ease: 'expo.out', clearProps: 'height'});
        gsap.fromTo(body.firstElementChild, {y: -8, opacity: 0}, {y: 0, opacity: 1, duration: .5, delay: .08});
      }
    });
  }

  if (!window.gsap || !window.ScrollTrigger) { root.classList.add('is-ready'); return; }

  /* ---------- GSAP ---------- */
  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin, ScrambleTextPlugin);
  gsap.defaults({ease: 'expo.out', duration: 1});

  // Lenis drives smooth wheel scrolling; touch stays native.
  let lenis = null;
  if (!reducedMQ.matches && window.Lenis) {
    lenis = new Lenis({lerp: .09, smoothWheel: true, wheelMultiplier: 1, anchors: false});
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  for (const a of $$('a[href^="#"]')) {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? document.body : $(id);
      if (!target) return;
      setMenu(false);
      if (lenis) { e.preventDefault(); lenis.scrollTo(id === '#top' ? 0 : target, {offset: -headerOffset() + 4, duration: 1.4}); history.replaceState(null, '', id); }
    });
  }

  // Header state + scroll progress + active nav.
  const progress = $('.scroll-progress span');
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      header.classList.toggle('is-scrolled', y > 24);
      header.classList.toggle('is-hidden', y > 600 && y > lastY + 2 && !nav.classList.contains('is-open'));
      if (y < lastY - 2) header.classList.remove('is-hidden');
      lastY = y;
      if (progress) progress.style.transform = `scaleX(${self.progress.toFixed(4)})`;
    }
  });
  const navLinks = $$('.site-nav a');
  for (const link of navLinks) {
    const sec = $(link.getAttribute('href'));
    // Refresh after the pinned sections so their added scroll length is counted.
    if (sec) ScrollTrigger.create({trigger: sec, start: 'top 45%', end: 'bottom 45%', refreshPriority: -1, onToggle: s => link.classList.toggle('is-active', s.isActive)});
  }

  // Lift the CSS pre-hide in the same task that sets GSAP's start states, so nothing flashes and
  // tweens measure real values rather than the hidden ones.
  root.classList.add('is-ready');
  const mm = gsap.matchMedia();

  mm.add({
    motion: '(prefers-reduced-motion: no-preference)',
    desktop: '(min-width: 961px)',
    wide: '(min-width: 901px) and (min-height: 561px)'
  }, ctx => {
    const {motion, desktop, wide} = ctx.conditions;
    if (!motion) return;

    /* Hero: split headline, staged entrance, 3D device that flattens as you scroll. */
    const heroItems = $$('[data-hero-item]');
    const stage = $('[data-hero-stage]');
    const device = $('[data-hero-device]');
    const chips = $$('.float-chip', device);
    const splits = $$('[data-split]').map(el => SplitText.create(el, {type: 'chars', charsClass: 'char'}));
    const chars = splits.flatMap(s => s.chars);
    gsap.set(chars, {display: 'inline-block'});
    const intro = gsap.timeline({delay: .15});
    intro.from(chars, {yPercent: 110, rotationX: -70, opacity: 0, filter: 'blur(10px)', transformOrigin: '50% 100%', duration: 1.3, stagger: .045}, 0)
      .from('[data-hero-grad]', {yPercent: 100, opacity: 0, filter: 'blur(12px)', duration: 1.4}, .35)
      .from(heroItems, {y: 26, opacity: 0, duration: 1.1, stagger: .08}, .25)
      .from(stage, {y: 140, opacity: 0, duration: 1.6, ease: 'expo.out'}, .45)
      .from(chips, {scale: .6, opacity: 0, duration: .9, stagger: .09, ease: 'back.out(1.6)'}, 1.1);
    chips.forEach(c => gsap.set(c, {z: 40 + Number(c.dataset.depth || 1) * 60}));
    gsap.set(device, {rotationX: 26, scale: .9, transformPerspective: 1800});
    gsap.timeline({scrollTrigger: {trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: 1}})
      .to(device, {rotationX: 0, scale: 1.04, y: -40, ease: 'none'}, 0)
      .to('.hero__copy', {y: -120, opacity: .1, ease: 'none'}, 0)
      .to('.hero .aurora', {yPercent: 18, ease: 'none'}, 0);
    if (finePointer) {
      const qx = chips.map(c => gsap.quickTo(c, 'x', {duration: 1.2, ease: 'power3.out'}));
      const qy = chips.map(c => gsap.quickTo(c, 'y', {duration: 1.2, ease: 'power3.out'}));
      const ry = gsap.quickTo(device, 'rotationY', {duration: 1.4, ease: 'power3.out'});
      $('.hero').addEventListener('pointermove', e => {
        if (isPaused()) return;
        const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
        chips.forEach((c, i) => { const d = Number(c.dataset.depth || 1); qx[i](nx * 26 * d); qy[i](ny * 20 * d); });
        ry(nx * 5);
      });
    }

    /* Section headings: masked line reveals; other heading content fades up. */
    for (const head of $$('.section-head, .loop__copy, .privacy__copy')) {
      const title = $('.display', head);
      if (title) {
        SplitText.create(title, {
          type: 'lines', mask: 'lines', linesClass: 'line', autoSplit: true,
          onSplit: self => gsap.from(self.lines, {yPercent: 110, duration: 1.2, stagger: .1, scrollTrigger: {trigger: head, start: 'top 82%', once: true}})
        });
      }
      const rest = [...head.children].filter(c => c !== title);
      gsap.from(rest, {y: 30, opacity: 0, duration: 1.1, stagger: .08, delay: .15, scrollTrigger: {trigger: head, start: 'top 82%', once: true}});
    }
    gsap.from('.demo-points li', {y: 50, opacity: 0, stagger: .1, scrollTrigger: {trigger: '.demo-points', start: 'top 88%', once: true}});

    /* Demo window rises and settles. */
    gsap.from('.demo__window', {y: 120, rotationX: 18, scale: .94, opacity: 0, transformPerspective: 2000, duration: 1.6,
      scrollTrigger: {trigger: '.demo', start: 'top 85%', once: true}});

    /* Marquee: endless loop whose speed and direction follow scroll velocity. */
    const marquees = $$('[data-marquee]').map(row => {
      row.append(...[...row.children].map(n => n.cloneNode(true)));
      const dir = Number(row.dataset.marquee);
      const tween = gsap.fromTo(row, {xPercent: dir > 0 ? 0 : -50}, {xPercent: dir > 0 ? -50 : 0, duration: 46, ease: 'none', repeat: -1});
      return tween;
    });
    let boost = 1;
    ScrollTrigger.create({
      trigger: '.marquee', start: 'top bottom', end: 'bottom top',
      onToggle: s => marquees.forEach(t => s.isActive && !isPaused() ? t.play() : t.pause()),
      onUpdate: s => {
        boost = 1 + Math.min(6, Math.abs(s.getVelocity()) / 300);
        const sign = s.direction;
        marquees.forEach(t => gsap.to(t, {timeScale: boost * sign, duration: .3, overwrite: true, onComplete: () => gsap.to(t, {timeScale: sign, duration: 1.2})}));
      }
    });
    const syncMarquee = () => marquees.forEach(t => isPaused() ? t.pause() : t.play());
    document.addEventListener('ih:motion', syncMarquee);
    syncMarquee();

    /* Pipeline: a signal travels the wire; each station lights as it arrives, and a payload
       tag riding the pulse shows what the data has become at that point. */
    const pin = $('[data-pipeline]');
    const track = $('[data-pipe-track]');
    const wire = $('[data-pipe-wire]');
    const stations = $$('[data-station]');
    const counter = $('[data-pipe-index]');
    const ghost = $('[data-pipe-ghost]');
    const payload = $('[data-pipe-payload]');
    const payloadText = payload?.querySelector('span');
    const railItems = $$('[data-pipe-rail] li');
    const railFill = $('[data-pipe-fill]');
    const scramble = $('[data-scramble]');
    const titles = stations.map(s => s.querySelector('h3').textContent);
    const payloads = ['音频帧 · 对方 / 我', '转录文本 · 整句精修', '问题 · 追问', '3 段相关资料', '逐字输出的回答', '提词器 · 手机伴侣'];
    let lit = -2, scrambled = false;
    function light(i) {
      if (i === lit) return;
      lit = i;
      stations.forEach((s, k) => { s.classList.toggle('is-lit', k <= i); s.classList.toggle('is-current', k === i); });
      railItems.forEach((r, k) => { r.classList.toggle('is-done', k < i); r.classList.toggle('is-current', k === i); });
      const shown = Math.max(0, i);
      if (counter) counter.textContent = String(shown + 1).padStart(2, '0');
      if (ghost) gsap.to(ghost, {duration: .7, scrambleText: {text: titles[shown], chars: titles.join(''), speed: .6}, overwrite: true});
      if (payloadText) payloadText.textContent = payloads[shown];
      if (i >= 1 && !scrambled && scramble) {
        scrambled = true;
        gsap.fromTo(scramble, {scrambleText: {text: '　'}}, {duration: 1.6, scrambleText: {text: scramble.dataset.scramble, chars: '删除缓存失败了怎么办如果', revealDelay: .3, speed: .5}});
      }
    }
    light(-1);
    if (wide) {
      // Stagger comes from margin (not transform) so measurements never fight tweens.
      const points = () => stations.map(s => [s.offsetLeft + s.offsetWidth / 2, s.offsetTop + s.offsetHeight / 2]);
      const pathEl = $('#pipe-path');
      const grad = $('#wire-grad');
      function layoutWire() {
        const w = track.scrollWidth, h = track.offsetHeight;
        wire.setAttribute('width', w); wire.setAttribute('height', h);
        wire.setAttribute('viewBox', `0 0 ${w} ${h}`);
        grad?.setAttribute('x2', w);
        const p = points();
        let d = `M${p[0][0] - 260} ${p[0][1]} L${p[0][0]} ${p[0][1]}`;
        for (let i = 1; i < p.length; i++) {
          const [x0, y0] = p[i - 1], [x1, y1] = p[i], mx = (x0 + x1) / 2;
          d += ` C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`;
        }
        const end = p[p.length - 1];
        d += ` L${end[0] + 300} ${end[1]}`;
        for (const path of $$('path', wire)) path.setAttribute('d', d);
      }
      layoutWire();
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      const pulse = $('.wire-pulse');
      let pathLen = 1, payloadHidden = false;
      const tl = gsap.timeline({
        defaults: {ease: 'none'},
        scrollTrigger: {
          trigger: pin, pin: true, scrub: 1, start: 'top top', end: () => `+=${dist() * 1.2}`, invalidateOnRefresh: true,
          onRefreshInit: layoutWire,
          onRefresh: () => { pathLen = pathEl.getTotalLength(); }
        },
        onUpdate() {
          // Follow the pulse: its point on the path decides which station is lit.
          const pt = pathEl.getPointAtLength(this.progress() * pathLen);
          const tx = gsap.getProperty(track, 'x');
          let idx = -1;
          points().forEach(([px], k) => { if (pt.x >= px - 24) idx = k; });
          light(idx);
          if (payload) {
            // Only label the signal in the gaps; over a card the card itself tells the story.
            const behind = stations.some(st => pt.x > st.offsetLeft - 30 && pt.x < st.offsetLeft + st.offsetWidth + 30);
            gsap.set(payload, {x: pt.x + tx, y: pt.y});
            if (behind !== payloadHidden) { payloadHidden = behind; gsap.to(payload, {autoAlpha: behind ? 0 : 1, scale: behind ? .85 : 1, duration: .3, overwrite: 'auto'}); }
          }
          if (railFill) railFill.style.transform = `scaleX(${this.progress().toFixed(4)})`;
        }
      });
      pathLen = pathEl.getTotalLength();
      tl.to([track, wire], {x: () => -dist()}, 0)
        .fromTo('.wire-line, .wire-glow', {drawSVG: '0%'}, {drawSVG: '100%'}, 0)
        .to(pulse, {motionPath: {path: pathEl, align: pathEl, alignOrigin: [.5, .5]}}, 0);
      // Ambient particles stream along the whole wire while the section is on screen.
      const sparks = $$('.wire-spark').map((dot, k) => gsap.to(dot, {
        motionPath: {path: pathEl, align: pathEl, alignOrigin: [.5, .5]}, duration: 7, ease: 'none', repeat: -1, delay: -k * 1.75, paused: true
      }));
      const syncSparks = on => sparks.forEach(t => on && !isPaused() ? t.play() : t.pause());
      ScrollTrigger.create({trigger: pin, start: 'top bottom', end: () => `+=${dist() * 1.2 + innerHeight * 2}`, onToggle: s => syncSparks(s.isActive)});
      document.addEventListener('ih:motion', () => syncSparks(ScrollTrigger.isInViewport(pin)));
    } else {
      ScrollTrigger.create({
        trigger: track, start: 'top 70%', end: 'bottom 60%', scrub: true,
        onUpdate: s => {
          track.style.setProperty('--pipe-progress', s.progress.toFixed(3));
          light(Math.floor(s.progress * stations.length * .999));
        }
      });
    }

    /* Chapters: sticky device that swaps screens with a clip-path wipe. */
    const chapterEls = $$('[data-chapter]');
    const shots = $$('[data-chapter-shot]');
    const dots = $$('.chapters__dots li');
    let current = 0;
    function activate(i) {
      chapterEls.forEach((c, k) => c.classList.toggle('is-active', k === i));
      dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
      if (!desktop || i === current) { current = i; return; }
      const prev = shots[current], next = shots[i], down = i > current;
      current = i;
      gsap.killTweensOf([prev, next]);
      shots.forEach(s => s !== prev && s !== next && gsap.set(s, {opacity: 0, zIndex: 0}));
      gsap.set(prev, {zIndex: 1});
      gsap.set(next, {zIndex: 2, opacity: 1});
      gsap.fromTo(next, {clipPath: down ? 'inset(100% 0% 0% 0% round 28px)' : 'inset(0% 0% 100% 0% round 28px)', scale: 1.06, filter: 'brightness(1.4)'},
        {clipPath: 'inset(0% 0% 0% 0% round 0px)', scale: 1, filter: 'brightness(1)', duration: 1.1, ease: 'expo.inOut'});
      gsap.to(prev, {scale: .94, opacity: 0, duration: 1.1, ease: 'expo.inOut'});
      next.classList.add('is-active');
      prev.classList.remove('is-active');
    }
    chapterEls.forEach((c, i) => ScrollTrigger.create({trigger: c, start: 'top 55%', end: 'bottom 55%', onToggle: s => s.isActive && activate(i)}));
    activate(0);
    if (desktop) {
      gsap.fromTo('[data-chapter-bar]', {scaleX: .2}, {scaleX: 1, ease: 'none', scrollTrigger: {trigger: '.chapters__steps', start: 'top 55%', end: 'bottom 55%', scrub: true}});
      gsap.fromTo('[data-chapter-frame]', {rotationY: -10, rotationX: 6, transformPerspective: 1600}, {rotationY: 6, rotationX: -2, ease: 'none',
        scrollTrigger: {trigger: '.chapters__grid', start: 'top bottom', end: 'bottom top', scrub: true}});
    }

    /* Workflow line fills as you scroll; numbers light in order. */
    const steps = $$('[data-step]');
    const stepsEl = $('[data-steps]');
    gsap.from(steps, {y: 60, opacity: 0, stagger: .12, scrollTrigger: {trigger: stepsEl, start: 'top 82%', once: true}});
    ScrollTrigger.create({
      trigger: stepsEl, start: 'top 75%', end: 'bottom 45%', scrub: true,
      onUpdate: s => {
        stepsEl.style.setProperty('--steps', s.progress.toFixed(3));
        steps.forEach((st, k) => st.classList.toggle('is-on', s.progress >= k / (steps.length - 1) - .02));
      }
    });

    /* Bento: cascade in with depth; subtle tilt follows the pointer. */
    const cards = $$('[data-bento] [data-card]');
    gsap.from(cards, {y: 80, rotationX: 10, opacity: 0, transformPerspective: 1400, transformOrigin: '50% 100%', duration: 1.3,
      stagger: {each: .07, from: 'start'}, scrollTrigger: {trigger: '[data-bento]', start: 'top 82%', once: true}});
    if (finePointer) {
      for (const card of cards) {
        const rx = gsap.quickTo(card, 'rotationX', {duration: .6, ease: 'power3.out'});
        const ry = gsap.quickTo(card, 'rotationY', {duration: .6, ease: 'power3.out'});
        card.addEventListener('pointermove', e => {
          const r = card.getBoundingClientRect();
          rx(((e.clientY - r.top) / r.height - .5) * -4);
          ry(((e.clientX - r.left) / r.width - .5) * 5);
        });
        card.addEventListener('pointerleave', () => { rx(0); ry(0); });
      }
    }
    gsap.fromTo('.card--context .card__shot', {x: 60}, {x: -20, ease: 'none', scrollTrigger: {trigger: '.card--context', start: 'top bottom', end: 'bottom top', scrub: true}});
    gsap.fromTo('.viz-phone', {y: 60}, {y: -10, ease: 'none', scrollTrigger: {trigger: '.card--devices', start: 'top bottom', end: 'bottom top', scrub: true}});

    /* Loop orbit */
    gsap.from('.orbit', {scale: .7, rotation: -40, opacity: 0, duration: 1.6, scrollTrigger: {trigger: '.orbit', start: 'top 85%', once: true}});
    gsap.from('.orbit__node', {scale: 0, opacity: 0, stagger: .1, duration: .9, ease: 'back.out(1.8)', delay: .4, scrollTrigger: {trigger: '.orbit', start: 'top 85%', once: true}});

    /* Scenes autoplay with progress bars */
    function runScene() {
      if (!autoplay) return;
      const bar = tabs[sceneIndex].querySelector('.scenes__progress');
      for (const t of tabs) gsap.set(t.querySelector('.scenes__progress'), {scaleX: 0});
      sceneTween = gsap.fromTo(bar, {scaleX: 0}, {scaleX: 1, duration: 7, ease: 'none', onComplete: () => { showScene(sceneIndex + 1); runScene(); }});
    }
    ScrollTrigger.create({
      trigger: '.scenes', start: 'top 70%', end: 'bottom 30%',
      onToggle: s => { if (!autoplay) return; if (s.isActive && !isPaused()) { sceneTween ? sceneTween.resume() : runScene(); } else sceneTween?.pause(); }
    });
    document.addEventListener('ih:motion', () => { if (isPaused()) sceneTween?.pause(); else if (autoplay && ScrollTrigger.isInViewport('.scenes', .2)) sceneTween ? sceneTween.resume() : runScene(); });
    gsap.from('.scenes__tabs button', {y: 30, opacity: 0, stagger: .08, scrollTrigger: {trigger: '.scenes__tabs', start: 'top 85%', once: true}});
    gsap.from('.scenes__panels', {y: 80, opacity: 0, duration: 1.4, scrollTrigger: {trigger: '.scenes__panels', start: 'top 85%', once: true}});

    /* Privacy routes */
    gsap.from('.flowmap__local, .route', {x: 40, opacity: 0, stagger: .09, scrollTrigger: {trigger: '[data-flowmap]', start: 'top 80%', once: true}});

    /* FAQ, tips */
    gsap.from('[data-faq] details', {y: 30, opacity: 0, stagger: .07, scrollTrigger: {trigger: '[data-faq]', start: 'top 85%', once: true}});
    gsap.from('.tip', {y: 60, opacity: 0, stagger: .1, scrollTrigger: {trigger: '.tips__list', start: 'top 85%', once: true}});

    /* CTA: big title assembles from characters. */
    const ctaTitle = $('.cta__title');
    const ctaSplit = SplitText.create(ctaTitle, {type: 'chars', charsClass: 'char'});
    gsap.from(ctaSplit.chars, {yPercent: 80, opacity: 0, rotationX: -80, filter: 'blur(8px)', stagger: .035, duration: 1.2, transformOrigin: '50% 100%',
      scrollTrigger: {trigger: '.cta', start: 'top 70%', once: true}});
    gsap.from('.cta__mark', {scale: .4, rotation: -30, opacity: 0, duration: 1.4, ease: 'elastic.out(1, .6)', scrollTrigger: {trigger: '.cta', start: 'top 70%', once: true}});

    /* Magnetic primary buttons */
    if (finePointer) {
      for (const btn of $$('.magnetic')) {
        const mx = gsap.quickTo(btn, 'x', {duration: .5, ease: 'power3.out'});
        const my = gsap.quickTo(btn, 'y', {duration: .5, ease: 'power3.out'});
        btn.addEventListener('pointermove', e => {
          const r = btn.getBoundingClientRect();
          mx((e.clientX - r.left - r.width / 2) * .25);
          my((e.clientY - r.top - r.height / 2) * .35);
        });
        btn.addEventListener('pointerleave', () => { mx(0); my(0); });
      }
    }

    return () => { splits.forEach(s => s.revert()); ctaSplit.revert(); };
  });

  // Late fonts (HarmonyOS is large) and lazy images change layout; re-measure once they settle.
  let refreshQueued = 0;
  const refresh = () => { cancelAnimationFrame(refreshQueued); refreshQueued = requestAnimationFrame(() => ScrollTrigger.refresh()); };
  document.fonts?.ready.then(refresh);
  addEventListener('load', refresh);
  reducedMQ.addEventListener('change', () => location.reload());
})();
