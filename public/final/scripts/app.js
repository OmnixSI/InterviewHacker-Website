// The product window (home → prepare → live → notes). The markup is rendered at build time from
// demo.json; this file only switches states, plays the sample conversation and streams answers.
// Nothing here touches audio, a model or the network. Exposes window.IHApp for the scroll narrative.
(() => {
  const app = document.querySelector('[data-demo-app]');
  const dataEl = document.getElementById('demo-data');
  if (!app || !dataEl) return;
  const D = JSON.parse(dataEl.textContent);
  const root = document.documentElement;
  const still = () => root.classList.contains('motion-paused') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = app) => el.querySelector(s);
  const $$ = (s, el = app) => [...el.querySelectorAll(s)];
  const zh = D.lang === 'zh';

  // Timers belong to a phase; leaving the phase cancels them so states never pile up.
  const timers = new Set();
  const later = (fn, ms) => { if (still()) { fn(); return; } const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  const clearLater = () => { timers.forEach(clearTimeout); timers.clear(); };

  const state = { phase: 'home', mode: 'prompt', audio: 'online', type: 'interview', quick: false, played: false, filesDone: false, notesDone: false, answer: 'base', visible: true, paused: false, seconds: 12 * 60 + 37 };
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => fn(state.phase));

  // ---- Phases -------------------------------------------------------------------------------
  function setPhase(phase, focus) {
    const changed = phase !== state.phase;
    if (changed) clearLater();
    state.phase = phase;
    app.dataset.phase = phase;
    for (const nav of $$('[data-nav]')) nav.classList.toggle('is-on', nav.dataset.nav === (phase === 'notes' ? 'meetings' : 'home'));
    if (phase !== 'live') closeMenus();
    if (phase === 'prepare') enterPrepare(focus);
    if (phase === 'live') enterLive(focus);
    if (phase === 'notes') enterNotes();
    if (phase === 'home') setFocus(focus === 'start' ? 'start' : null);
    if (changed) emit();
  }

  function setFocus(name) {
    for (const el of $$('[data-focus]')) el.classList.toggle('is-focus', !!name && el.dataset.focus === name);
  }

  // ---- Prepare ------------------------------------------------------------------------------
  const prepScroll = $('[data-prep-scroll]');
  function focusStep(n) {
    const steps = $$('[data-prep-step]');
    if (!n) { app.removeAttribute('data-focus-step'); steps.forEach(s => s.classList.remove('is-focus')); return; }
    app.dataset.focusStep = n;
    const on = n === '3' ? ['3', '4'] : [n];
    steps.forEach(s => s.classList.toggle('is-focus', on.includes(s.dataset.prepStep)));
    const target = steps.find(s => s.dataset.prepStep === n);
    if (target && prepScroll) {
      const top = n === '1' ? 0 : target.offsetTop - 18;
      prepScroll.scrollTo({ top, behavior: still() ? 'auto' : 'smooth' });
    }
  }
  // Scrolling the page inside the window means the reader is exploring: stop dimming.
  prepScroll?.addEventListener('wheel', () => focusStep(null), { passive: true });
  prepScroll?.addEventListener('touchmove', () => focusStep(null), { passive: true });

  function enterPrepare(focus) {
    focusStep(focus || null);
    if (state.filesDone) return;
    const files = $$('[data-file]');
    const start = $('[data-start]');
    start.textContent = start.dataset.labelReading;
    files.forEach(f => f.classList.remove('is-done'));
    files[1]?.classList.add('is-done');
    const bar = files[0]?.querySelector('.a-bar i');
    if (bar) { bar.style.transform = 'scaleX(.18)'; requestAnimationFrame(() => { bar.style.transform = 'scaleX(.64)'; }); }
    later(() => { if (bar) bar.style.transform = 'scaleX(1)'; }, 1100);
    later(() => { files[0]?.classList.add('is-done'); state.filesDone = true; start.textContent = start.dataset.labelReady; }, 1600);
  }

  function setType(id) {
    const t = D.types.find(x => x.id === id);
    if (!t) return;
    state.type = id;
    app.dataset.type = id;
    for (const chip of $$('[data-type]')) { const on = chip.dataset.type === id; chip.classList.toggle('is-on', on); chip.setAttribute('aria-pressed', on); }
    const line = $('[data-typeline]');
    swap(line, `${t.name}${zh ? '：' : ': '}${t.line} · ${D.bringLabel}${t.bring}`);
    setMode(state.audio === 'offline' ? 'notes' : t.mode, false);
  }

  function swap(el, text) {
    if (!el) return;
    if (still()) { el.textContent = text; return; }
    el.classList.add('is-swapping');
    setTimeout(() => { el.textContent = text; el.classList.remove('is-swapping'); }, 120);
  }

  function updateCarry() {
    const on = Object.fromEntries($$('[data-carry]').map(c => [c.dataset.carry, c.checked]));
    for (const li of $$('[data-needs]')) li.classList.toggle('is-hidden', !on[li.dataset.needs]);
  }

  function setAudio(mode) {
    state.audio = mode;
    app.dataset.audio = mode;
    for (const b of $$('[data-audio]')) { const on = b.dataset.audio === mode; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); }
    const where = $('[data-where]');
    if (where) where.textContent = mode === 'offline' ? (zh ? '线下会议' : 'In-person meeting') : D.prepare.where;
    for (const line of $$('[data-line]')) {
      const who = mode === 'offline' ? 'room' : line.dataset.who;
      line.querySelector('.a-who').textContent = D.live.whoName[who];
    }
    setMode(mode === 'offline' ? 'notes' : (D.types.find(t => t.id === state.type)?.mode || 'prompt'), false);
  }

  // ---- Live ---------------------------------------------------------------------------------
  const lines = $$('[data-line]');
  function enterLive(focus) {
    $('.a-ttl').textContent = state.quick ? (zh ? '随手记录' : 'Quick notes') : D.prepare.title;
    if (!state.played) {
      state.played = true;
      lines.forEach(l => l.classList.remove('is-shown'));
      const body = $('[data-body]');
      body.replaceChildren();
      const plan = [0, 700, 1500, 2100];
      plan.forEach((ms, i) => later(() => lines[i].classList.add('is-shown'), ms));
      later(() => { if (state.mode === 'prompt') stream('base'); }, 2500);
      later(() => lines[4].classList.add('is-shown'), 5200);
      later(() => lines[5].classList.add('is-shown'), 6400);
    } else {
      lines.forEach(l => l.classList.add('is-shown'));
    }
    if (focus === 'settings') {
      if (!$('[data-body]').childElementCount) stream('base', true);
      lines.forEach(l => l.classList.add('is-shown'));
      later(() => setMode('notes', true), 500);
      later(() => openPop(true), 1100);
    } else if (focus === 'answer') {
      openPop(false);
      if (state.played && state.mode === 'notes' && !state.quick) setMode(D.types.find(t => t.id === state.type)?.mode || 'prompt', true);
    }
  }

  function setMode(mode, fromUser) {
    state.mode = mode;
    app.dataset.mode = mode;
    for (const b of $$('[data-mode-btn]')) { const on = b.dataset.modeBtn === mode; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); }
    if (fromUser && mode === 'prompt' && state.phase === 'live' && !$('[data-body]').childElementCount) stream('base');
  }

  // Answers fade in by word (pairs of characters in Chinese), 160 ms each, without moving.
  const tokenRe = /[A-Za-z0-9.,'’%:;\-–—()?!/“”"]+\s*|[　-〿＀-￯]|[一-鿿]{1,2}[　-〿＀-￯]?|\s+|./g;
  function tokenize(parent, text, start) {
    let i = start;
    for (const t of text.match(tokenRe) || []) {
      const s = document.createElement('span');
      s.className = 'tok';
      s.style.animationDelay = `${i * 34}ms`;
      s.textContent = t;
      parent.append(s);
      i++;
    }
    return i;
  }
  function stream(key, instant) {
    const a = D.live.answers[key];
    if (!a) return;
    state.answer = key;
    const body = $('[data-body]');
    body.replaceChildren();
    body.classList.toggle('is-instant', !!instant || still());
    const lead = document.createElement('p');
    lead.className = 'a-lead';
    let i = tokenize(lead, a.lead, 0);
    body.append(lead);
    if (a.points.length) {
      const ul = document.createElement('ul');
      ul.className = 'a-pts';
      for (const p of a.points) { const li = document.createElement('li'); li.className = 'tok'; li.style.animationDelay = `${(i + 2) * 34}ms`; i = tokenize(li, p, i + 2); ul.append(li); }
      body.append(ul);
    }
    const latest = key === 'latest';
    $('[data-q]').textContent = latest ? D.live.latestFor : D.live.answerFor;
    $('[data-pager]').textContent = latest ? D.live.pagerLatest : D.live.pager;
    for (const b of $$('[data-rewrite]')) b.classList.toggle('is-on', b.dataset.rewrite === key);
  }

  // Answer settings popover and the "…" menu.
  const pop = $('[data-pop]'), modelBtn = $('[data-model]');
  const menu = $('[data-more-menu]'), moreBtn = $('[data-more]');
  function openPop(open) { if (!pop) return; pop.hidden = !open; modelBtn.setAttribute('aria-expanded', open); if (open) menu.hidden = true; }
  function closeMenus() { openPop(false); if (menu) { menu.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); } }

  // The timer counts while the window is live and on screen; clicking it pauses, like the app.
  setInterval(() => {
    if (state.phase !== 'live' || state.paused || !state.visible || still()) return;
    state.seconds++;
    const m = Math.floor(state.seconds / 60), s = state.seconds % 60;
    $('[data-time]').textContent = `${m}:${String(s).padStart(2, '0')}`;
  }, 1000);

  // Level meters: refreshed 8 times a second with a linear 125 ms glide, only when seen.
  const meters = $$('[data-meter]');
  setInterval(() => {
    if (state.phase !== 'prepare' || !state.visible || still()) return;
    for (const m of meters) {
      const loud = m.dataset.meter === 'me' ? .45 : .8;
      m.querySelectorAll('i').forEach((bar, i) => {
        const level = Math.max(.12, Math.min(1, (Math.random() * .8 + .2) * loud * (1 - Math.abs(i - 6) / 12)));
        bar.style.transform = `scaleY(${level.toFixed(2)})`;
      });
    }
  }, 125);
  new IntersectionObserver(([e]) => { state.visible = e.isIntersecting; }).observe(app);

  // ---- Notes --------------------------------------------------------------------------------
  function enterNotes() {
    const prog = $('[data-progress]'), steps = $$('[data-pstep]');
    if (state.notesDone || still()) { finishNotes(); return; }
    app.classList.remove('notes-ready');
    $('[data-notes-scroll]').scrollTop = 0;
    steps.forEach(s => s.className = '');
    prog.classList.remove('is-done');
    const tick = (i, ms) => { later(() => steps[i].className = 'is-active', ms); later(() => steps[i].className = 'is-done', ms + 800); };
    tick(0, 200); tick(1, 1000); tick(2, 1800);
    later(finishNotes, 2900);
  }
  function finishNotes() {
    state.notesDone = true;
    $$('[data-pstep]').forEach(s => s.className = 'is-done');
    $('[data-progress]').classList.add('is-done');
    app.classList.add('notes-ready');
  }

  // ---- Events -------------------------------------------------------------------------------
  app.addEventListener('click', e => {
    const t = e.target.closest('button, [data-go]');
    if (!t || !app.contains(t)) { closeMenus(); return; }
    if (t.dataset.go) {
      if (t.hasAttribute('data-record')) { state.quick = true; setMode('notes'); state.played = false; }
      if (t.hasAttribute('data-start')) { state.quick = false; setMode(state.audio === 'offline' ? 'notes' : (D.types.find(x => x.id === state.type)?.mode || 'prompt')); }
      setPhase(t.dataset.go);
      return;
    }
    if (t.dataset.type) { setType(t.dataset.type); return; }
    if (t.hasAttribute('data-not-same')) { $$('[data-carry]').forEach(c => { c.checked = false; }); updateCarry(); return; }
    if (t.dataset.audio) { setAudio(t.dataset.audio); return; }
    if (t.dataset.modeBtn) { setMode(t.dataset.modeBtn, true); return; }
    if (t.hasAttribute('data-model')) { openPop(pop.hidden); return; }
    if (t.hasAttribute('data-timer')) { state.paused = !state.paused; t.classList.toggle('is-paused', state.paused); return; }
    if (t.dataset.rewrite) { closeMenus(); stream(t.dataset.rewrite); return; }
    if (t.hasAttribute('data-more')) { const open = menu.hidden; closeMenus(); menu.hidden = !open; t.setAttribute('aria-expanded', open); return; }
    if (t.hasAttribute('data-regen')) { closeMenus(); stream(state.answer); return; }
    if (t.hasAttribute('data-answer-now')) { closeMenus(); stream('latest'); return; }
    if (t.hasAttribute('data-fast')) { const on = !t.classList.contains('is-on'); t.classList.toggle('is-on', on); t.setAttribute('aria-checked', on); app.classList.toggle('no-fast', !on); return; }
    if (t.hasAttribute('data-save')) { if (!t.dataset.label) { t.dataset.label = t.textContent; t.textContent = t.dataset.saved; t.classList.add('is-saved'); } else { t.textContent = t.dataset.label; delete t.dataset.label; t.classList.remove('is-saved'); } return; }
    // Segmented controls inside the popover and the tabs only move their selection.
    const seg = t.closest('.a-seg');
    if (seg) { for (const b of seg.querySelectorAll('button')) { const on = b === t; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); } }
    if (menu && !menu.hidden && !t.closest('[data-more-menu]')) closeMenus();
  });
  app.addEventListener('change', e => { if (e.target.matches('[data-carry]')) updateCarry(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });
  document.addEventListener('click', e => { if (!app.contains(e.target)) closeMenus(); });

  // The live view starts empty when scripts run; without scripts every line is already there.
  app.classList.add('is-live-ready');
  lines.forEach(l => l.classList.remove('is-shown'));
  setPhase('home');

  window.IHApp = {
    go(phase, focus) { setPhase(phase, focus); },
    onPhase(fn) { listeners.add(fn); },
    get phase() { return state.phase; }
  };
})();
