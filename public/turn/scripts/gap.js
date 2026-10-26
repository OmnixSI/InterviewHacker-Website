// Turn — № 01 The blink (09:00). Owned by the hero module.
// 1. The beats. On wide screens with motion, the stage pins and scroll scrubs five beats over one timing diagram:
//    A their question lights up word by word while the amber bar grows under it → B 200 ms: the gap, a caret blinking in
//    it, then your speech → C 600 ms: the indigo planning bar reaches back into their sentence → D the conclusion →
//    E InterviewHacker: listening along their sentence, the answer surfacing at its end. Everywhere else the beats read
//    in order and the diagram is static and complete (that is the markup's own state; nothing here hides it).
// 2. Try your blink: a question streams word by word; at its end a timer starts; Space / Answer stops it.
//    Nothing is stored or sent.
(() => {
  const IH = window.IH;
  const sec = document.querySelector('[data-gap]');
  if (!IH || !sec) return;
  const root = document.documentElement;
  const $ = (s, el = sec) => el.querySelector(s);
  const $$ = (s, el = sec) => [...el.querySelectorAll(s)];
  const hasGsap = typeof window.gsap !== 'undefined' && !!window.ScrollTrigger;
  const play = (name, opts) => IH.sound?.play?.(name, opts);

  /* ================= Beats ================= */
  const beat = id => $(`[data-beat="${id}"]`);
  const words = $$('.gap__w');
  const segs = $$('[data-tl-them] .tl__seg');

  // The product line surfaces word by word: split it once into inline-block words (zh: short phrases).
  const answer = $('.gap__answer');
  let answerWords = [];
  if (answer) {
    const text = answer.textContent.trim();
    const toks = IH.lang === 'zh'
      ? text.match(/[A-Za-z]+\s*|[^\sA-Za-z，。；：、？！]{1,2}[，。；：、？！]?/g)
      : text.split(/(?<=\s)/);
    if (toks && toks.join('') === text) {
      answer.setAttribute('aria-label', text);
      answer.textContent = '';
      for (const t of toks) {
        const s = document.createElement('span');
        s.className = 'aw'; s.setAttribute('aria-hidden', 'true');
        s.textContent = t.trimEnd();
        answer.append(s);
        if (/\s$/.test(t)) answer.append(' ');
      }
      answerWords = $$('.aw', answer);
    }
  }

  let ctx = null;
  function buildPinned() {
    root.classList.add('gap-pinned');
    ctx = gsap.context(() => {
      const ease = 'power2.out', settle = IH.ease.settle;
      const B = { a: beat('a'), b: beat('b'), c: beat('c'), d: beat('d'), e: beat('e') };
      const n200 = $('[data-beat="b"] .gap__n'), n600 = $('[data-beat="c"] .gap__n');
      const names = { plan: $('.tl__name--plan'), me: $('.tl__name--me'), ih: $('.tl__name--ih') };
      const el = s => $(`[data-${s}]`);
      const meRow = [names.me, el('tl-gap'), el('tl-me')];
      const planRow = [names.plan, el('tl-plan'), el('tl-plan-tag')];
      const ihRow = [names.ih, el('tl-listen'), el('tl-listen-tag'), el('tl-surface'), el('tl-surface-tag')];

      // Initial pinned state (JS only): beat A shown dim, the rest waiting; the diagram empty.
      gsap.set([B.b, B.c, B.d, B.e], { autoAlpha: 0 });
      gsap.set(words, { color: 'color-mix(in srgb, var(--them-ink) 24%, var(--paper))' });
      gsap.set([...segs, el('tl-me'), el('tl-surface'), el('tl-listen')], { scaleX: 0 });
      gsap.set(el('tl-plan'), { scaleX: 0 });
      gsap.set([el('tl-gap'), el('tl-plan-tag'), el('tl-overlap'), el('tl-end'), el('tl-listen-tag'), el('tl-surface-tag'), names.plan, names.me, names.ih], { autoAlpha: 0 });
      gsap.set('.gap__title .gap__ln > span', { yPercent: 110 });
      gsap.set(answerWords, { opacity: 0, y: '0.4em' });
      n200.textContent = '0'; n600.textContent = '200';

      const caret = el('tl-caret');
      let lit = 0, turned = false, surfaced = false;
      const W = words.length;
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: $('[data-gap-pin]'), pin: true, start: 'top top', end: () => '+=' + Math.round(innerHeight * 4.6),
          scrub: .8, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: self => {
            // Voice events follow the words as they light (forward only), so the amber string speaks with the quote.
            const t = tl.time(), k = Math.max(0, Math.min(W, Math.floor((t - .2) / (1.8 / W)) + 1));
            if (self.direction > 0) {
              if (k > 0 && !turned) { turned = true; IH.emit('turn', { who: 'them' }); }
              for (let i = lit; i < k; i++) IH.emit('voice', { who: 'them', level: .45 + .4 * ((i % 3) / 2), ms: 260 });
              if (t > 7.15 && !surfaced) { surfaced = true; IH.emit('turn', { who: 'me' }); }
            }
            if (t < .2) turned = false;
            if (t < 7) surfaced = false;
            lit = k;
            caret.classList.toggle('is-blinking', t > 2.95 && t < 3.6);
          }
        }
      });

      // A — their question, word by word, the amber bar growing segment by segment under it.
      const step = 1.8 / W;
      words.forEach((w, i) => {
        tl.to(w, { color: 'var(--them-ink)', duration: step * .9 }, .2 + i * step);
        const s = segs[i] || segs[segs.length - 1];
        if (segs.length === W) tl.to(s, { scaleX: 1, duration: step }, .2 + i * step);
      });
      if (segs.length !== W) tl.to(segs, { scaleX: 1, duration: 1.8 / segs.length, stagger: 1.8 / segs.length }, .2);
      tl.to(el('tl-end'), { autoAlpha: 1, duration: .2 }, 2.0);

      // B — 200 ms.
      tl.to(B.a, { autoAlpha: 0, y: -24, duration: .4, ease: 'power1.in' }, 2.4)
        .fromTo(B.b, { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, duration: .5, ease }, 2.65)
        .to({ v: 0 }, { v: 200, duration: .7, ease: 'power2.out', onUpdate() { n200.textContent = Math.round(this.targets()[0].v); } }, 2.65)
        .to(names.me, { autoAlpha: 1, duration: .3 }, 2.7)
        .to(el('tl-gap'), { autoAlpha: 1, duration: .3 }, 2.8)
        .to(el('tl-me'), { scaleX: 1, duration: .8 }, 3.6);

      // C — 600 ms: the planning bar grows backwards from where you speak, into their sentence.
      tl.to(B.b, { autoAlpha: 0, y: -24, duration: .4, ease: 'power1.in' }, 4.4)
        .fromTo(B.c, { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, duration: .5, ease }, 4.65)
        .to({ v: 200 }, { v: 600, duration: .8, ease: 'power2.out', onUpdate() { n600.textContent = Math.round(this.targets()[0].v); } }, 4.65)
        .to(names.plan, { autoAlpha: 1, duration: .3 }, 4.7)
        .to(el('tl-plan'), { scaleX: 1, duration: .9, ease: 'power1.inOut' }, 4.8)
        .to(el('tl-plan-tag'), { autoAlpha: 1, duration: .3 }, 5.5)
        .to(el('tl-overlap'), { autoAlpha: 1, duration: .35 }, 5.75);

      // D — the conclusion.
      tl.to(B.c, { autoAlpha: 0, y: -24, duration: .4, ease: 'power1.in' }, 6.1)
        .set(B.d, { autoAlpha: 1 }, 6.35)
        .to('.gap__title .gap__ln > span', { yPercent: 0, duration: .6, ease: settle, stagger: .08 }, 6.35);

      // E — the product: listening all along their sentence, the answer surfacing at its end.
      tl.to(B.d, { autoAlpha: 0, y: -24, duration: .4, ease: 'power1.in' }, 7.5)
        .set(B.e, { autoAlpha: 1 }, 7.75)
        .fromTo($('.gap__who', B.e), { autoAlpha: 0 }, { autoAlpha: 1, duration: .3 }, 7.75)
        .to([names.ih, el('tl-listen-tag')], { autoAlpha: 1, duration: .3 }, 7.0)
        .to(el('tl-listen'), { scaleX: 1, duration: .5 }, 7.0)
        .to(el('tl-surface'), { scaleX: 1, duration: .9 }, 7.6)
        .to(el('tl-surface-tag'), { autoAlpha: 1, duration: .3 }, 7.7)
        .to([...planRow, ...meRow, el('tl-overlap')], { opacity: .35, duration: .4 }, 7.6)
        .to(answerWords, { opacity: 1, y: 0, duration: .35, ease, stagger: .9 / Math.max(1, answerWords.length) }, 7.85)
        .to({}, { duration: .6 }, 8.9);
    }, sec);
  }
  function destroyPinned() {
    if (!ctx) return;
    ctx.revert(); ctx = null;
    root.classList.remove('gap-pinned');
    $$('.gap__n').forEach(n => { n.textContent = n.dataset.count; });
    $('[data-tl-caret]')?.classList.remove('is-blinking');
  }

  // Static mode with motion allowed: a light on-enter reveal for the numerals and the answer; never hides for long.
  function revealStatic() {
    if (!hasGsap || !IH.motionOK()) return;
    for (const n of $$('.gap__n')) {
      IH.inView(n, on => {
        if (!on || n.dataset.counted || ctx) return;
        n.dataset.counted = '1';
        const o = { v: 0 }, to = +n.dataset.count;
        gsap.to(o, { v: to, duration: .9, ease: 'power2.out', onUpdate: () => { n.textContent = Math.round(o.v); } });
      });
    }
  }

  const MQ = '(min-width: 820px) and (min-height: 640px)';
  const wideMQ = matchMedia(MQ);
  function sync() {
    const want = hasGsap && wideMQ.matches && IH.motionOK();
    if (want && !ctx) { buildPinned(); ScrollTrigger.refresh(); }
    else if (!want && ctx) { destroyPinned(); ScrollTrigger.refresh(); }
  }
  if (hasGsap) {
    sync();
    wideMQ.addEventListener?.('change', sync);
    // Only motion changes rebuild; a hidden tab must not tear down the pin.
    IH.on('motion', () => { if (!document.hidden) sync(); });
    revealStatic();
  }

  /* ================= Try your blink ================= */
  const game = $('[data-blink]');
  if (!game) return;
  const g = s => game.querySelector(s);
  const btn = g('[data-blink-btn]'), qEl = g('[data-blink-q]'), msEl = g('[data-blink-ms]'), verdictEl = g('[data-blink-verdict]');
  const pin = g('[data-blink-pin]'), live = g('[data-blink-live]');
  const D = game.dataset;
  const questions = [D.q1, D.q2, D.q3, D.q4].filter(Boolean);
  let state = 'idle', timers = [], t0 = 0, lastQ = -1, lastPress = 0, msTween = null;

  const setState = s => { state = s; game.dataset.state = s; };
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const label = text => { btn.textContent = text; };

  function tokens(q) {
    if (IH.lang === 'zh') return q.split('|');
    return q.split(/\s+/);
  }
  // Natural rhythm: longer words take longer; a comma adds a breath.
  const wordMs = w => IH.lang === 'zh'
    ? 150 + 42 * w.replace(/[，。？！]/g, '').length + (/[，]$/.test(w) ? 110 : 0)
    : 120 + 26 * w.replace(/[^\w’']/g, '').length + (/,$/.test(w) ? 120 : 0);

  function start() {
    clear();
    let i;
    do { i = Math.floor(Math.random() * questions.length); } while (questions.length > 1 && i === lastQ);
    lastQ = i;
    const toks = tokens(questions[i]);
    qEl.textContent = '';
    const spans = toks.map((t, k) => {
      const s = document.createElement('span');
      s.className = 'qw'; s.textContent = t;
      qEl.append(s);
      if (IH.lang !== 'zh' && k < toks.length - 1) qEl.append(' ');
      return s;
    });
    msEl.textContent = '—'; verdictEl.textContent = ''; pin.classList.remove('is-on');
    live.textContent = '';
    setState('asking');
    label(D.labelAnswer);
    play('blink');
    IH.emit('turn', { who: 'them' });
    let at = 380;
    spans.forEach((s, k) => {
      const d = wordMs(toks[k]);
      later(() => {
        s.classList.add('is-on');
        IH.emit('voice', { who: 'them', level: .5 + .35 * Math.min(1, toks[k].length / 6), ms: d });
      }, at);
      at += d;
    });
    // The question ends when its last word has been said: the clock starts there.
    later(() => {
      if (state !== 'asking') return;
      t0 = performance.now();
      const c = document.createElement('i'); c.className = 'qcaret'; c.setAttribute('aria-hidden', 'true');
      qEl.append(c);
      setState('armed');
      live.textContent = questions[i].replace(/\|/g, '') + ' ' + D.ready;
    }, at);
  }

  function verdictFor(ms) {
    if (ms < 250) return D.vFast;
    if (ms <= 600) return D.vOk;
    return D.vSlow;
  }
  function showMs(ms) {
    msTween?.kill();
    if (hasGsap && IH.motionOK()) {
      const o = { v: 0 };
      msTween = gsap.to(o, { v: ms, duration: Math.min(.7, .25 + ms / 2000), ease: 'power2.out', onUpdate: () => { msEl.textContent = Math.round(o.v); } });
    } else msEl.textContent = ms;
  }
  function press() {
    if (state === 'asking') {
      clear();
      setState('early');
      qEl.querySelectorAll('.qw').forEach(s => s.classList.add('is-on'));
      msEl.textContent = '—';
      verdictEl.textContent = D.vEarly;
      pin.style.left = '0%'; pin.classList.add('is-on');
      play('error');
      live.textContent = D.vEarly;
      label(D.labelAgain);
      return;
    }
    if (state !== 'armed') return;
    const ms = Math.max(0, Math.round(performance.now() - t0));
    clear();
    qEl.querySelector('.qcaret')?.remove();
    setState('result');
    showMs(ms);
    const v = verdictFor(ms);
    verdictEl.textContent = v;
    pin.style.left = Math.min(100, ms / 10) + '%'; pin.classList.add('is-on');
    play('result', { ms });
    live.textContent = `${ms} ${D.unit}. ${v}`;
    label(D.labelAgain);
  }
  function cancel() {
    if (state !== 'asking' && state !== 'armed') return;
    clear();
    setState('idle');
    qEl.textContent = '';
    msEl.textContent = '—'; verdictEl.textContent = ''; pin.classList.remove('is-on');
    label(D.labelStart);
    live.textContent = '';
  }
  const busy = () => state === 'asking' || state === 'armed';

  // Pointer: time on pointerdown (what the reader feels as the press); the click that follows is ignored.
  btn.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !busy()) return;
    lastPress = performance.now();
    press();
  });
  btn.addEventListener('click', () => {
    if (performance.now() - lastPress < 600) return;
    if (busy()) { press(); return; }
    start();
  });
  // Space anywhere answers while the game is armed (and never scrolls the page then); Escape cancels.
  addEventListener('keydown', e => {
    if (!busy()) return;
    if (e.key === 'Escape') { cancel(); return; }
    if (e.key !== ' ' && e.code !== 'Space') return;
    const t = e.target;
    if (t && t !== btn && t.closest?.('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    if (e.repeat) return;
    lastPress = performance.now();
    press();
  });
  // Space released on the focused button would click it again: swallow that one.
  btn.addEventListener('keyup', e => { if ((e.key === ' ' || e.code === 'Space') && performance.now() - lastPress < 2000) e.preventDefault(); });
  // Leaving the game mid-question cancels it.
  IH.inView(game, on => { if (!on) cancel(); });
})();
