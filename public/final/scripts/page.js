// Page behaviour around the window: header, appearance and motion switches, the scroll narrative
// that drives the window, and the small specimens (meeting types, series, audio, notes templates).
(() => {
  const root = document.documentElement;
  const dataEl = document.getElementById('demo-data');
  const D = dataEl ? JSON.parse(dataEl.textContent) : null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => root.classList.contains('motion-paused') || reduce.matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage blocked */ } };

  // ---- Header -------------------------------------------------------------------------------
  const header = $('[data-header]');
  const onScroll = () => header?.classList.toggle('is-scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const themeBtn = $('[data-theme-toggle]');
  const syncTheme = () => {
    const dark = root.dataset.theme === 'dark';
    themeBtn?.setAttribute('aria-pressed', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#131312' : '#f6f5f2');
  };
  themeBtn?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    store('ih-final-theme', root.dataset.theme === 'dark' ? 'dark' : null);
    syncTheme();
    document.dispatchEvent(new CustomEvent('ih:theme', { detail: root.dataset.theme }));
  });
  syncTheme();

  const motionBtn = $('[data-motion-toggle]');
  const syncMotion = () => {
    const paused = root.classList.contains('motion-paused');
    motionBtn?.setAttribute('aria-pressed', paused);
    motionBtn?.setAttribute('aria-label', paused ? motionBtn.dataset.labelOn : motionBtn.dataset.labelOff);
  };
  motionBtn?.addEventListener('click', () => {
    root.classList.toggle('motion-paused');
    store('ih-final-motion', root.classList.contains('motion-paused') ? 'paused' : null);
    syncMotion();
    document.dispatchEvent(new Event('ih:motion'));
  });
  syncMotion();

  // Switching language keeps the section you are reading.
  for (const a of $$('[data-lang-switch]')) {
    a.addEventListener('click', () => {
      const current = $$('main > section[id], main .run > header[id]').filter(s => s.getBoundingClientRect().top < innerHeight / 2).pop();
      if (current) a.href = a.href.split('#')[0] + '#' + current.id;
    });
  }

  // ---- Walkthrough: the scroll moves the meeting through its steps ----------------------------
  // Wide screens pin the laptop and map the section's scroll progress onto the steps; narrow screens keep
  // the window at the top and let each step's text scroll past a reading line.
  const demo = $('[data-demo]');
  const steps = $$('.step[data-step]');
  const rail = $$('[data-rail]');
  const bars = $$('[data-guide-bar] li');
  const setRail = phase => rail.forEach(b => b.setAttribute('aria-pressed', b.dataset.rail === phase));
  let active = null;
  const activate = (step, progress = 0) => {
    const i = steps.indexOf(step);
    bars.forEach((b, k) => { b.classList.toggle('is-done', k < i); b.classList.toggle('is-on', k === i); b.querySelector('button')?.setAttribute('aria-current', k === i ? 'step' : 'false'); });
    if (i >= 0 && bars[i]) bars[i].style.setProperty('--p', progress.toFixed(3));
    if (step === active) return;
    active = step;
    steps.forEach(s => s.classList.toggle('is-active', s === step));
    if (step) { window.IHApp?.go(step.dataset.step, step.dataset.focus); $('[data-demo-app]')?.setAttribute('data-spot', step.dataset.focus || ''); }
    else window.IHApp?.go('home');
  };
  const stageMQ = matchMedia('(min-width: 901px) and (min-height: 600px)');
  let io = null;
  const onStageScroll = () => {
    if (!stageMQ.matches || !demo) return;
    const r = demo.getBoundingClientRect(), span = Math.max(1, r.height - innerHeight);
    const p = -r.top / span;
    if (p < 0) { activate(steps[0], 0); return; }
    const f = Math.min(.9999, p) * steps.length, i = Math.floor(f);
    activate(steps[Math.min(steps.length - 1, i)], f - i);
  };
  const watch = () => {
    io?.disconnect();
    root.classList.toggle('has-stage', stageMQ.matches);
    if (stageMQ.matches) { onStageScroll(); return; }
    io = new IntersectionObserver(entries => { for (const e of entries) if (e.isIntersecting) activate(e.target); }, { rootMargin: '-64% 0px -20% 0px' });
    steps.forEach(s => io.observe(s));
  };
  if (steps.length) {
    addEventListener('scroll', onStageScroll, { passive: true });
    addEventListener('resize', onStageScroll, { passive: true });
    stageMQ.addEventListener('change', watch);
    watch();
  }
  window.IHApp?.onPhase(setRail);
  // The labelled progress under the laptop: each label scrolls the page to its step.
  $$('[data-goto]').forEach(btn => btn.addEventListener('click', () => {
    const i = Number(btn.dataset.goto);
    if (stageMQ.matches && demo) {
      const top = demo.getBoundingClientRect().top + scrollY;
      const y = top + (i + .5) / steps.length * (demo.offsetHeight - innerHeight);
      window.IHLenis ? window.IHLenis.scrollTo(y, { duration: 1 }) : scrollTo({ top: y, behavior: 'smooth' });
    } else steps[i]?.scrollIntoView({ block: 'center' });
  }));

  // ---- Hand annotations: a few words and a pen arrow that land on a real element --------------
  // Positions come from layout offsets (not screen rects), so parallax and tilts never pull them apart;
  // they are measured again on resize, after fonts load and as the title is edited.
  const NS = 'http://www.w3.org/2000/svg';
  const offsetIn = (el, box) => { let x = 0, y = 0, n = el; while (n && n !== box) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return n === box ? [x, y] : [0, 0]; };
  function draw(anno, [sx, sy], [ex, ey], bow) {
    let svg = anno.querySelector('.anno__arrow');
    if (!svg) {
      svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'anno__arrow');
      svg.innerHTML = '<path class="anno__shaft" pathLength="1"/><path class="anno__head" pathLength="1"/>';
      anno.append(svg);
    }
    const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy) || 1;
    const cx = (sx + ex) / 2 - dy / len * len * bow, cy = (sy + ey) / 2 + dx / len * len * bow;
    const a = Math.atan2(ey - cy, ex - cx), h = 11, spread = .5;
    const p1 = [ex - h * Math.cos(a - spread), ey - h * Math.sin(a - spread)], p2 = [ex - h * Math.cos(a + spread), ey - h * Math.sin(a + spread)];
    const f = n => n.toFixed(1);
    svg.children[0].setAttribute('d', `M${f(sx)} ${f(sy)}Q${f(cx)} ${f(cy)} ${f(ex)} ${f(ey)}`);
    svg.children[1].setAttribute('d', `M${f(p1[0])} ${f(p1[1])}L${f(ex)} ${f(ey)}L${f(p2[0])} ${f(p2[1])}`);
  }
  // Where the first line of an element's text ends (x) and its middle (y), relative to the element.
  const textEnd = el => {
    const range = document.createRange();
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.data.trim() && !n.parentElement.closest('svg') ? 1 : 3) });
    const node = walk.nextNode();
    if (node) range.selectNodeContents(node); else range.selectNodeContents(el);
    const first = range.getClientRects()[0] || range.getBoundingClientRect(), e = el.getBoundingClientRect();
    const line = [...range.getClientRects()].filter(r => Math.abs(r.top - first.top) < 4);
    return [Math.max(...line.map(r => r.right)) - e.left, first.top + first.height / 2 - e.top];
  };
  const measureText = input => {
    const c = measureText.c || (measureText.c = document.createElement('canvas').getContext('2d'));
    const cs = getComputedStyle(input);
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return c.measureText(input.value).width;
  };
  const annotators = {
    // "Try another title": above the field, to the right of where the title ends; the arrow lands on its last letter.
    title(anno) {
      const box = anno.parentElement, input = box.querySelector('input');
      const [ix, iy] = offsetIn(input, box), text = anno.querySelector('.anno__text');
      const tw = text.offsetWidth, th = text.offsetHeight, cw = box.clientWidth;
      const tx = ix + Math.min(input.clientWidth - 8, measureText(input) + 10), ty = iy + input.offsetHeight * .42;
      let lx = Math.min(tx + 64, cw - tw), ly = iy - th - 26;
      if (lx < tx + 16) lx = Math.max(0, Math.min(cw - tw, tx - tw * .2));
      text.style.transform = `translate(${lx}px, ${ly}px)`;
      const start = lx > tx + 30 ? [lx - 6, ly + th * .65] : [lx + tw * .3, ly + th + 4];
      draw(anno, start, [tx + 6, ty - 10], lx > tx + 30 ? .28 : -.28);
    },
    // "Untick one": in the sheet's top-right corner, beside the title; the arrow lands where the first row ends.
    carry(anno) {
      const leaf = anno.parentElement, row = leaf.querySelector('.leaf__carry .check'), title = leaf.querySelector('.leaf__title');
      const text = anno.querySelector('.anno__text');
      const tw = text.offsetWidth, th = text.offsetHeight, cw = leaf.clientWidth;
      const [rx, ry] = offsetIn(row, leaf), [, ty0] = offsetIn(title, leaf);
      const lx = cw - tw - 26, ly = ty0 + 4;
      const [endX, endY] = textEnd(row);
      const ex = Math.min(rx + endX + 12, cw - 14), ey = ry + endY;
      text.style.transform = `translate(${lx}px, ${ly}px)`;
      draw(anno, [lx + tw * .45, ly + th + 6], [ex, ey - 2], ex > lx + tw * .45 ? .22 : -.22);
    }
  };
  const annos = $$('[data-anno]');
  const layoutAnnos = () => annos.forEach(a => { if (a.offsetParent) annotators[a.dataset.anno]?.(a); });
  if (annos.length) {
    layoutAnnos();
    document.fonts?.ready.then(layoutAnnos);
    addEventListener('resize', layoutAnnos, { passive: true });
    if (window.ResizeObserver) { const ro = new ResizeObserver(layoutAnnos); annos.forEach(a => ro.observe(a.parentElement)); }
    $('[data-tsel-input]')?.addEventListener('input', layoutAnnos);
    const seen = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-drawn'); seen.unobserve(e.target); } }), { rootMargin: '0px 0px -20% 0px' });
    annos.forEach(a => seen.observe(a.parentElement.closest('.leaf, .tsel') || a));
  }

  // ---- Meeting types: guess from the title, then show the defaults --------------------------
  const tsel = $('[data-tsel-root]');
  if (tsel && D) {
    const input = $('[data-tsel-input]', tsel), guessEl = $('[data-tsel-guess]', tsel);
    const glyph = $('[data-tglyph]', tsel);
    const fields = Object.fromEntries($$('[data-tfield]', tsel).map(el => [el.dataset.tfield, el]));
    const swap = (el, text) => {
      if (el.textContent === text) return;
      if (still()) { el.textContent = text; return; }
      el.classList.add('is-swapping');
      setTimeout(() => { el.textContent = text; el.classList.remove('is-swapping'); }, 120);
    };
    const select = id => {
      const t = D.types.find(x => x.id === id) || D.types[0];
      for (const c of $$('[data-tsel]', tsel)) { const on = c.dataset.tsel === t.id; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on); }
      for (const k of ['live', 'length', 'template', 'bring']) swap(fields[k], t[k]);
      glyph.dataset.tglyph = t.mode;
      return t;
    };
    const guess = title => {
      const s = title.toLowerCase();
      for (const r of D.guess.rules) if (r.words.some(w => s.includes(w.toLowerCase()))) return r.type;
      return 'general';
    };
    const fromTitle = () => {
      const t = select(guess(input.value));
      guessEl.textContent = input.value.trim() ? `→ ${t.name}` : '';
    };
    input.addEventListener('input', fromTitle);
    $$('[data-tsel]', tsel).forEach(c => c.addEventListener('click', () => { const t = select(c.dataset.tsel); guessEl.textContent = `→ ${t.name}`; }));
    const ex = $('[data-tsel-examples]', tsel);
    for (const title of D.guess.examples) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'try';
      b.textContent = title;
      b.addEventListener('click', () => { input.value = title; fromTitle(); });
      ex.append(b);
    }
    fromTitle();
  }

  // ---- Series: what carries over changes what the AI takes away ------------------------------
  const series = $('[data-series]');
  if (series) {
    const update = () => {
      const on = Object.fromEntries($$('[data-scarry]', series).map(c => [c.dataset.scarry, c.checked]));
      let shown = 0;
      for (const li of $$('[data-sneeds]', series)) { const vis = !!on[li.dataset.sneeds]; li.classList.toggle('is-hidden', !vis); shown += vis; }
      $('[data-sneeds-empty]', series)?.classList.toggle('is-hidden', shown > 0);
    };
    series.addEventListener('change', update);
    update();
  }

  // ---- Audio: two voices on one river, or one room ------------------------------------------
  // A 2D canvas draws the two channels as live lines (amber: them, ink: you). In person they merge into one.
  const audio = $('[data-audio-root]');
  if (audio) {
    const btns = $$('[data-amode]', audio);
    let target = 0, mix = 0, seen = false, t = 0, raf = 0;
    const canvas = $('[data-awave]', audio), ctx = canvas?.getContext('2d');
    const colour = name => getComputedStyle(root).getPropertyValue(name).trim();
    const draw = () => {
      raf = 0;
      if (!ctx) return;
      const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      mix += (target - mix) * .08;
      const lanes = [
        { c: colour('--them'), y: h * (.34 + .16 * mix), e: .55 + .45 * Math.max(0, Math.sin(t * .9)), s: 0 },
        { c: colour('--me'), y: h * (.7 - .2 * mix), e: .4 + .45 * Math.max(0, -Math.sin(t * .9)), s: 2.1 }
      ];
      lanes.forEach((L, li) => {
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 4) {
            const u = x / w, env = Math.pow(Math.sin(Math.PI * u), 1.4);
            const amp = (6 + 26 * L.e) * env * (1 - k * .18) * (mix > .5 ? .8 : 1);
            const y = L.y + amp * (Math.sin(u * 14 + t * 1.3 + L.s + k * .5) * .55 + Math.sin(u * 31 - t * 1.9 + L.s * 1.7) * .3 + Math.sin(u * 63 + t * 2.7) * .15);
            x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.strokeStyle = mix > .5 && li === 1 ? colour('--ink') : L.c;
          ctx.globalAlpha = (k ? .28 - k * .05 : .9) * (li === 0 ? 1 - mix * .6 : 1);
          ctx.lineWidth = k ? 1 : 1.6;
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
      if (seen && !still()) { t += 1 / 60; raf = requestAnimationFrame(draw); }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
    btns.forEach(b => b.addEventListener('click', () => {
      audio.dataset.audioMode = b.dataset.amode;
      btns.forEach(x => x.setAttribute('aria-pressed', x === b));
      target = b.dataset.amode === 'offline' ? 1 : 0;
      if (still()) mix = target;
      kick();
    }));
    new IntersectionObserver(([e]) => { seen = e.isIntersecting; kick(); }).observe(audio);
    document.addEventListener('ih:motion', kick);
    document.addEventListener('ih:theme', kick);
    addEventListener('resize', kick, { passive: true });
    kick();
  }

  // ---- Notes templates: tabs with arrow keys, panels stacked so the height never jumps -------
  const tpl = $('[data-tpl]');
  if (tpl) {
    const tabs = $$('[role="tab"]', tpl), panels = $$('[role="tabpanel"]', tpl);
    tpl.classList.add('is-scripted');
    panels.forEach((p, i) => { p.hidden = false; p.classList.toggle('is-on', i === 0); p.setAttribute('aria-hidden', i !== 0); p.inert = i !== 0; });
    const pick = (i, focus) => {
      tabs.forEach((t, j) => { const on = i === j; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; t.classList.toggle('is-on', on); });
      panels.forEach((p, j) => { const on = i === j; p.classList.toggle('is-on', on); p.setAttribute('aria-hidden', !on); p.inert = !on; });
      document.dispatchEvent(new CustomEvent('ih:tpl', { detail: panels[i] }));
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => pick(i));
      t.addEventListener('keydown', e => {
        const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (k) { e.preventDefault(); pick((i + k + tabs.length) % tabs.length, true); }
      });
    });
  }

  // ---- Copy the Terminal command -------------------------------------------------------------
  for (const btn of $$('[data-copy]')) {
    btn.addEventListener('click', async () => {
      const text = btn.parentElement.querySelector('[data-copy-src]')?.textContent || '';
      try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked */ }
      const label = btn.querySelector('span');
      const before = label.textContent;
      label.textContent = btn.dataset.done;
      btn.classList.add('is-done');
      setTimeout(() => { label.textContent = before; btn.classList.remove('is-done'); }, 1600);
    });
  }
})();
