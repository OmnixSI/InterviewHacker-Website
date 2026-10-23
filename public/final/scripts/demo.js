// Live assistant demo. Replays a fixed local script (no microphone, model or network) of what the app does:
// two-channel capture, echo suppression, question typing, streaming answers, one-tap rewrites,
// "answer now" (⌘⇧↩) and the teleprompter view. The HTML already holds a finished state, so without this
// file — or with reduced motion — the window still reads correctly.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const globalPaused = () => root.classList.contains('motion-paused');
  const app = document.querySelector('[data-demo-app]');
  const dataEl = document.getElementById('demo-data');
  if (!app || !dataEl) return;
  const data = JSON.parse(dataEl.textContent);
  const ui = data.ui;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const screen = app.parentElement;
  const transcript = $('[data-transcript]', app);
  const question = $('[data-demo-question]', app);
  const answer = $('[data-demo-answer]', app);
  const answerState = $('[data-demo-answer-state]', app);
  const acard = $('[data-acard]', app);
  const sources = $('[data-demo-sources]', app);
  const status = $('[data-demo-status]', app);
  const clock = $('[data-demo-clock]', app);
  const sceneName = $('[data-demo-scene-name]', app);
  const qtypes = $$('[data-qtype]', app);
  const chips = $$('[data-variant]', app);
  const nowBtn = $('[data-demo-now]', app);
  const sceneTabs = $$('[data-demo-scenes] [role="tab"]');
  const viewBtns = $$('[data-view]');
  const toggle = $('[data-demo-toggle]');
  const toggleLabel = $('[data-demo-toggle-label]');
  const points = $$('[data-point]');
  const rulerHead = $('[data-ruler-head]');
  const fileIcon = '<svg aria-hidden="true"><use href="#i-file"/></svg>';

  /* ---------- Waveforms (both lanes, and the hero field's energy) ---------- */
  let palette = {};
  const readPalette = () => { const cs = getComputedStyle(app); palette = { them: cs.getPropertyValue('--them').trim(), me: cs.getPropertyValue('--me').trim() }; };
  readPalette();
  document.addEventListener('ih:theme', () => requestAnimationFrame(readPalette));
  const lanes = $$('canvas[data-wave]', app).map(canvas => ({ canvas, lane: canvas.dataset.wave, level: .1, seed: Math.random() * 10 }));
  const levels = { them: .12, me: .08 };
  let waveFrame = 0, waveT = 0, waveLast = 0, inView = false;
  function drawLane(l) {
    const { canvas } = l;
    const dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = palette[l.lane];
    const bars = Math.max(14, Math.floor(w / 4)), gap = w / bars, bw = Math.max(1, gap * .5);
    for (let i = 0; i < bars; i++) {
      const x = i / bars;
      const n = Math.sin(x * 21 + waveT * 5.1 + l.seed) * Math.sin(x * 6.7 - waveT * 3.3) * .5 + .5;
      const amp = Math.max(.1, (n * .85 + .15) * (Math.sin(Math.PI * x) * .5 + .5) * l.level);
      const bh = Math.max(1.5, amp * h * .95);
      ctx.globalAlpha = .4 + l.level * .6;
      ctx.fillRect(i * gap + (gap - bw) / 2, (h - bh) / 2, bw, bh);
    }
    ctx.globalAlpha = 1;
  }
  function waveLoop(now) {
    waveFrame = 0;
    const dt = Math.min(.05, (now - (waveLast || now)) / 1000);
    waveLast = now;
    waveT += dt;
    for (const l of lanes) { l.level += (levels[l.lane] - l.level) * Math.min(1, dt * 7); drawLane(l); }
    if (inView && !globalPaused() && !reduced.matches && !document.hidden) waveFrame = requestAnimationFrame(waveLoop);
  }
  function wakeWaves() {
    if (waveFrame) return;
    if (reduced.matches || globalPaused() || !inView) { for (const l of lanes) { l.level = .45; drawLane(l); } return; }
    waveLast = 0;
    waveFrame = requestAnimationFrame(waveLoop);
  }
  function setLevel(lane, v) {
    levels[lane] = v;
    window.IHField?.set({ [lane]: Math.min(1, v * 1.1) });
  }

  /* ---------- Script runner ---------- */
  let sceneKey = 'interview', gen = 0, userPaused = false, started = false, seconds = 0, rush = false, userDriven = false, current = null, guided = false;
  const running = () => inView && !userPaused && !globalPaused() && !document.hidden && !guided;
  class Abort extends Error {}
  // Waits for `ms` of running time, so pausing freezes the demo mid-character.
  function wait(ms, g) {
    return new Promise((resolve, reject) => {
      let left = ms, prev = performance.now();
      const step = now => {
        if (g !== gen) return reject(new Abort());
        if (running()) left -= now - prev;
        prev = now;
        left <= 0 || (rush && ms < 200) ? resolve() : requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  const point = name => points.forEach(p => p.classList.toggle('is-active', p.dataset.point === name));
  const setType = name => qtypes.forEach(b => b.classList.toggle('is-on', b.dataset.qtype === name));
  function setSources(list) { sources.innerHTML = list.map(s => `<span>${fileIcon}${s.replace(/</g, '&lt;')}</span>`).join(''); }
  function bubble(kind, tag) {
    const li = document.createElement('li');
    li.className = `bubble bubble--${kind}`;
    if (tag) { const t = document.createElement('span'); t.className = 'bubble__tag'; t.textContent = tag; li.append(t); }
    li.append(document.createTextNode(''));
    transcript.append(li);
    while (transcript.children.length > 4) transcript.firstElementChild.remove();
    window.gsap?.from(li, { y: 14, opacity: 0, duration: .5, ease: 'power3.out' });
    return li;
  }
  async function type(node, text, speed, g) { for (const ch of text) { node.data += ch; await wait(speed, g); } }
  async function speak(lane, text, g, tag) {
    setLevel(lane, .95);
    point('listen');
    status.textContent = lane === 'me' ? ui.speaking : ui.listening;
    const li = bubble(lane);
    if (lane === 'them') li.classList.add('bubble--interim');
    await type(li.lastChild, text, lane === 'them' ? 55 : 45, g);
    setLevel(lane, .1);
    await wait(240, g);
    li.classList.remove('bubble--interim');
    if (tag) {
      const t = document.createElement('span');
      t.className = 'bubble__tag'; t.textContent = tag;
      li.prepend(t);
      li.classList.add('is-question');
    }
    return li;
  }
  function echo(text) {
    const li = bubble('echo', ui.echo);
    li.lastChild.data = text;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'bubble__restore'; btn.textContent = ui.restore;
    btn.addEventListener('click', () => { li.className = 'bubble bubble--me'; li.querySelector('.bubble__tag')?.remove(); btn.remove(); });
    li.append(btn);
  }
  async function setQuestion(q, g) {
    point('detect');
    setType(q.type);
    status.textContent = ui.detected;
    if (window.gsap && window.ScrambleTextPlugin && !reduced.matches) gsap.to(question, { duration: .8, scrambleText: { text: q.text, chars: ui.chars, speed: .6 } });
    else question.textContent = q.text;
    await wait(650, g);
  }
  async function stream(text, g, label = ui.streaming) {
    point('answer');
    status.textContent = ui.generating;
    answerState.textContent = label;
    answer.textContent = '';
    const node = document.createTextNode(''), caret = document.createElement('span');
    caret.className = 'caret';
    answer.append(node, caret);
    acard.classList.add('is-streaming');
    window.IHField?.set({ them: .2, me: .7 });
    await wait(200, g);
    const total = [...text].length;
    let i = 0;
    for (const ch of text) {
      node.data += ch;
      acard.style.setProperty('--stream', (++i / total).toFixed(3));
      await wait(/[，。：；、,.;:]/.test(ch) ? 110 : 30, g);
    }
    rush = false;
    acard.classList.remove('is-streaming');
    caret.remove();
    window.IHField?.set({ me: .3 });
  }

  async function run(g, key) {
    const s = data.scenes[key];
    current = { key, stage: 'q1' };
    sceneName.textContent = s.name;
    transcript.textContent = '';
    question.textContent = '';
    answer.textContent = '';
    answerState.textContent = ui.waiting;
    setType(null);
    chips.forEach(c => c.classList.remove('is-on'));
    setSources(s.sources);
    await wait(500, g);
    await speak('them', s.q1.text, g, ui.tags[s.q1.type]);
    await setQuestion(s.q1, g);
    current.stage = 'a1';
    await stream(s.a1, g);
    await wait(380, g);
    await speak('me', s.me, g);
    await wait(320, g);
    current.stage = 'q2';
    await speak('them', s.q2.text, g, ui.tags[s.q2.type]);
    if (s.echo) echo(s.echo);
    await setQuestion(s.q2, g);
    current.stage = 'a2';
    await stream(s.a2, g);
    current.stage = 'done';
    status.textContent = ui.ready;
    point(null);
    await wait(900, g);
    chips[0].classList.add('is-on');
    await wait(420, g);
    await stream(s.variants.short, g, ui.adjusted.short);
    await wait(4200, g);
  }
  async function loop() {
    const g = ++gen;
    try {
      for (;;) {
        await run(g, sceneKey);
        // Autoplay walks through the scenes until someone picks one.
        if (!userDriven) selectScene((sceneTabs.findIndex(t => t.dataset.sceneKey === sceneKey) + 1) % sceneTabs.length, { restart: false });
      }
    } catch (e) { if (!(e instanceof Abort)) throw e; }
  }
  function restart() { gen++; started = false; rush = false; sync(); }

  function selectScene(i, { restart: again = true, focus = false } = {}) {
    sceneTabs.forEach((t, k) => { const on = k === i; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    sceneKey = sceneTabs[i].dataset.sceneKey;
    if (focus) sceneTabs[i].focus();
    if (again) restart();
  }
  sceneTabs.forEach((t, i) => {
    t.addEventListener('click', () => { userDriven = true; selectScene(i); });
    t.addEventListener('keydown', e => {
      const n = sceneTabs.length, cur = sceneTabs.findIndex(x => x.getAttribute('aria-selected') === 'true');
      const map = { ArrowRight: (cur + 1) % n, ArrowLeft: (cur - 1 + n) % n, Home: 0, End: n - 1 };
      if (e.key in map) { e.preventDefault(); userDriven = true; selectScene(map[e.key], { focus: true }); }
    });
  });

  // One-tap rewrites take over from the script: the chosen variant streams and the demo waits for you.
  chips.forEach(chip => chip.addEventListener('click', async () => {
    const s = data.scenes[sceneKey];
    const g = ++gen;
    started = true; userDriven = true;
    chips.forEach(c => c.classList.toggle('is-on', c === chip));
    question.textContent = s.q2.text;
    setType(s.q2.type);
    try { await stream(s.variants[chip.dataset.variant], g, ui.adjusted[chip.dataset.variant]); status.textContent = ui.ready; point(null); } catch (e) { if (!(e instanceof Abort)) throw e; }
  }));

  // Answer now: finish a streaming answer at once, or re-answer the current question immediately.
  async function answerNow() {
    nowBtn.animate?.([{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.16,1,.3,1)' });
    if (acard.classList.contains('is-streaming')) { rush = true; return; }
    const s = data.scenes[sceneKey];
    const g = ++gen;
    started = true; userDriven = true;
    const q = current?.stage === 'a1' || current?.stage === 'q2' ? s.q1 : s.q2;
    question.textContent = q.text;
    setType(q.type);
    rush = true;
    try { await stream(q === s.q1 ? s.a1 : s.a2, g); status.textContent = ui.ready; point(null); } catch (e) { if (!(e instanceof Abort)) throw e; }
  }
  nowBtn.addEventListener('click', answerNow);
  addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.shiftKey && (e.metaKey || e.ctrlKey) && inView) { e.preventDefault(); answerNow(); }
  });

  // Teleprompter view: the window folds into a bar under the camera, over a call.
  viewBtns.forEach(btn => btn.addEventListener('click', () => {
    const prompter = btn.dataset.view === 'prompter';
    if (prompter === app.classList.contains('is-prompter')) return;
    viewBtns.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    const flip = window.Flip && !reduced.matches;
    const state = flip ? Flip.getState([app, $('.qcard', app), acard, answer]) : null;
    app.classList.toggle('is-prompter', prompter);
    screen.classList.toggle('is-prompter', prompter);
    if (flip) Flip.from(state, { duration: .85, ease: 'expo.inOut', nested: true, scale: false, simple: true });
  }));

  // Session clock and the ruler's playhead tick only while the demo runs.
  setInterval(() => {
    if (!started || !running()) return;
    seconds++;
    clock.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    if (rulerHead) rulerHead.style.setProperty('--x', `${(seconds % 24) / 24 * rulerHead.parentElement.clientWidth}px`);
  }, 1000);

  function sync() {
    const pausedNow = userPaused || globalPaused();
    toggle?.setAttribute('aria-pressed', String(pausedNow));
    if (toggleLabel) toggleLabel.textContent = pausedNow ? ui.resume : ui.pause;
    if (running() && !started && !reduced.matches && !guided) { started = true; loop(); }
    wakeWaves();
  }
  toggle?.addEventListener('click', () => { userPaused = !userPaused; sync(); });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { threshold: .35 }).observe(app);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('ih:motion', sync);
  reduced.addEventListener('change', () => { if (reduced.matches) restart(); sync(); });

  /* ---------- Scroll-guided walkthrough ----------
     On the pinned hero the conversation is driven by scroll, not time: every scroll position maps to one
     state, so it plays forwards and backwards with the reader and can't be missed by scrolling past.
     A spotlight marks the part of the window each step is about; the bar below names the step. */
  const guideEl = document.querySelector('[data-guide]');
  const guideNo = guideEl?.querySelector('[data-guide-no]'), guideTitle = guideEl?.querySelector('[data-guide-title]'), guideDesc = guideEl?.querySelector('[data-guide-desc]');
  const guideBar = guideEl?.querySelector('[data-guide-bar]');
  const steps = ui.guide || [];
  const segs = steps.map(st => { const li = document.createElement('li'); li.innerHTML = '<i><b></b></i>'; li.append(Object.assign(document.createElement('span'), { textContent: st.title })); guideBar?.append(li); return li; });
  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const cut = (text, f) => { const chars = [...text]; return chars.slice(0, Math.round(chars.length * clamp01(f))).join(''); };
  let lastKey = '', lastStep = -1;
  function stateAt(p) {
    const S = data.scenes.interview, n = steps.length || 6;
    const step = Math.min(n - 1, Math.floor(p * n)), t = clamp01(p * n - step);
    const q1 = { lane: 'them', text: S.q1.text, tag: ui.tags[S.q1.type] };
    const me = { lane: 'me', text: S.me };
    const st = { step, items: [], q: '', type: null, a: '', label: ui.waiting, streaming: false, sources: false, chip: null, focus: 'talk', them: .1, me: .08, status: ui.listening };
    if (step === 0) { st.items = [{ ...q1, text: cut(S.q1.text, t / .85), tag: t >= .85 ? q1.tag : null, interim: t < .85 }]; st.them = t < .85 ? .95 : .15; return st; }
    st.items = [q1];
    if (step === 1) { Object.assign(st, { q: cut(S.q1.text, t / .5), type: t > .35 ? S.q1.type : null, focus: 'q', status: ui.detected }); return st; }
    Object.assign(st, { q: S.q1.text, type: S.q1.type });
    if (step === 2) { Object.assign(st, { a: cut(S.a1, t / .9), streaming: t < .9, label: ui.streaming, sources: t > .5, focus: 'a', status: ui.generating }); return st; }
    Object.assign(st, { a: S.a1, label: ui.streaming, sources: true });
    if (step === 3) { st.items = [q1, { ...me, text: cut(S.me, t / .8) }]; Object.assign(st, { me: t < .8 ? .95 : .12, focus: 'talk', status: ui.speaking }); return st; }
    st.items = [q1, me];
    if (step === 4) {
      st.items.push({ lane: 'them', text: cut(S.q2.text, t / .45), tag: t >= .45 ? ui.tags[S.q2.type] : null, interim: t < .45 });
      if (t > .5) st.items.push({ lane: 'echo', text: S.echo, tag: ui.echo });
      Object.assign(st, { them: t < .45 ? .95 : .15, focus: t < .5 ? 'talk' : 'a', status: t < .5 ? ui.listening : ui.generating });
      if (t > .55) Object.assign(st, { q: S.q2.text, type: S.q2.type, a: cut(S.a2, (t - .55) / .42), streaming: t < .97 });
      return st;
    }
    st.items.push({ lane: 'them', text: S.q2.text, tag: ui.tags[S.q2.type] }, { lane: 'echo', text: S.echo, tag: ui.echo });
    Object.assign(st, { q: S.q2.text, type: S.q2.type, chip: t > .15 ? 'short' : null, focus: t < .3 ? 'chips' : 'a', status: ui.ready });
    if (t > .2) Object.assign(st, { a: cut(S.variants.short, (t - .2) / .65), label: ui.adjusted.short, streaming: t < .85 });
    else Object.assign(st, { a: S.a2 });
    return st;
  }
  function renderGuide(p) {
    const st = stateAt(p);
    const key = JSON.stringify(st);
    if (key === lastKey) return;
    lastKey = key;
    transcript.innerHTML = st.items.map(it => {
      const cls = `bubble bubble--${it.lane}${it.interim ? ' bubble--interim' : ''}${it.tag && it.lane === 'them' ? ' is-question' : ''}`;
      return `<li class="${cls}">${it.tag ? `<span class="bubble__tag">${esc(it.tag)}</span>` : ''}${esc(it.text)}</li>`;
    }).join('');
    question.textContent = st.q;
    setType(st.type);
    answerState.textContent = st.label;
    answer.innerHTML = esc(st.a) + (st.streaming ? '<span class="caret"></span>' : '');
    acard.classList.toggle('is-streaming', st.streaming);
    acard.style.setProperty('--stream', st.streaming ? '.6' : '0');
    sources.style.visibility = st.sources ? '' : 'hidden';
    chips.forEach(c => c.classList.toggle('is-on', c.dataset.variant === st.chip));
    status.textContent = st.status;
    // No spotlight until the walkthrough has actually begun (the device is still rising before that).
    if (p > .002) app.dataset.focus = st.focus; else delete app.dataset.focus;
    levels.them = st.them; levels.me = st.me;
    wakeWaves();
    if (st.step !== lastStep && guideEl) {
      lastStep = st.step;
      guideNo.textContent = String(st.step + 1).padStart(2, '0');
      guideTitle.textContent = steps[st.step]?.title || '';
      guideDesc.textContent = steps[st.step]?.desc || '';
    }
    const n = steps.length || 6;
    segs.forEach((li, k) => { li.style.setProperty('--f', clamp01(p * n - k).toFixed(3)); li.classList.toggle('is-current', k === st.step); });
  }
  window.IHDemo = {
    // p in 0–1 drives the walkthrough; null hands the window back to the visitor.
    guide(p) {
      if (p == null) {
        if (!guided) return;
        renderGuide(1); // settle on the finished conversation, never a half-streamed answer
        guided = false;
        delete app.dataset.focus;
        sources.style.visibility = '';
        acard.classList.remove('is-streaming');
        answer.querySelector('.caret')?.remove();
        started = true; // stay on the finished conversation until the visitor acts
        sync();
        return;
      }
      if (!guided) { guided = true; gen++; started = false; userDriven = false; sceneKey = 'interview'; sceneTabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === 0)); t.tabIndex = k === 0 ? 0 : -1; }); setSources(data.scenes.interview.sources); sceneName.textContent = data.scenes.interview.name; if (app.classList.contains('is-prompter')) viewBtns[0]?.click(); lastKey = ''; }
      renderGuide(p);
    }
  };
})();
