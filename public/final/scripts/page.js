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
  });
  syncMotion();

  // Switching language keeps the section you are reading.
  for (const a of $$('[data-lang-switch]')) {
    a.addEventListener('click', () => {
      const current = $$('main > section[id], main .run > header[id]').filter(s => s.getBoundingClientRect().top < innerHeight / 2).pop();
      if (current) a.href = a.href.split('#')[0] + '#' + current.id;
    });
  }

  // ---- Reveal: opacity only, once, staggered a little ----------------------------------------
  const reveal = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); reveal.unobserve(e.target); }
  }, { rootMargin: '0px 0px -12% 0px' });
  for (const el of $$('[data-reveal], .sec__head, .process > li, .series .leaf, .ledger__col, .install > li, .faq details, .tpl, .tsel, .audio, .look, .ft__script')) {
    el.setAttribute('data-reveal', '');
    reveal.observe(el);
  }
  requestAnimationFrame(() => root.classList.add('is-ready'));

  // ---- Scroll narrative: the step in the reading line drives the window ----------------------
  const steps = $$('.step[data-step]');
  const rail = $$('[data-rail]');
  const setRail = phase => rail.forEach(b => b.setAttribute('aria-pressed', b.dataset.rail === phase));
  let active = null;
  const activate = step => {
    if (step === active) return;
    active = step;
    steps.forEach(s => s.classList.toggle('is-active', s === step));
    window.IHApp?.go(step.dataset.step, step.dataset.focus);
  };
  if (steps.length) {
    const narrow = matchMedia('(max-width: 900px)');
    let io;
    const watch = () => {
      io?.disconnect();
      // On narrow screens the window sits at the top, so the reading line is lower.
      io = new IntersectionObserver(entries => {
        for (const e of entries) if (e.isIntersecting) activate(e.target);
      }, { rootMargin: narrow.matches ? '-66% 0px -20% 0px' : '-46% 0px -46% 0px' });
      steps.forEach(s => io.observe(s));
    };
    watch();
    narrow.addEventListener('change', watch);
    // Above the first step the window rests on Home.
    const hero = $('#top');
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio > .5) { active = null; steps.forEach(s => s.classList.remove('is-active')); window.IHApp?.go('home'); }
    }, { threshold: [0, .5, 1] }).observe(hero);
  }
  window.IHApp?.onPhase(setRail);
  rail.forEach(b => b.addEventListener('click', () => window.IHApp?.go(b.dataset.rail)));

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

  // ---- Audio: online / in person -------------------------------------------------------------
  const audio = $('[data-audio-root]');
  if (audio) {
    const btns = $$('[data-amode]', audio);
    btns.forEach(b => b.addEventListener('click', () => {
      audio.dataset.audioMode = b.dataset.amode;
      btns.forEach(x => x.setAttribute('aria-pressed', x === b));
    }));
    let seen = false;
    new IntersectionObserver(([e]) => { seen = e.isIntersecting; }).observe(audio);
    const meters = $$('[data-ameter]', audio);
    setInterval(() => {
      if (!seen || still()) return;
      for (const m of meters) {
        if (!m.offsetParent) continue;
        const loud = m.closest('.lane--me') ? .5 : .85;
        m.querySelectorAll('i').forEach((bar, i) => {
          const v = Math.max(.1, Math.min(1, (Math.random() * .75 + .25) * loud * (1 - Math.abs(i - 5.5) / 11)));
          bar.style.transform = `scaleY(${v.toFixed(2)})`;
        });
      }
    }, 125);
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
