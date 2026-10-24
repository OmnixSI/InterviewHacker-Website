// Phone companion. On wide screens the section is pinned and the scroll plays three beats: you are sharing your
// whole screen; the phone scans the pairing code; the question and answer arrive on the phone only. motion.js drives
// that through IHCompanion.scene(p) and hands the phone over with IHCompanion.release(). Elsewhere the same beats
// play once when the stage comes into view. Afterwards every key works, and a small hint suggests what to try.
(() => {
  const root = document.documentElement;
  const section = document.querySelector('[data-companion]');
  const dataEl = document.getElementById('demo-data');
  if (!section || !dataEl) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => root.classList.contains('motion-paused');
  const $ = s => section.querySelector(s);
  const zh = root.lang.startsWith('zh');
  const S = JSON.parse(dataEl.textContent).scenes.interview;
  const items = [{ q: S.q1.text, a: S.a1 }, { q: S.q2.text, a: S.a2, variants: S.variants }];
  const stage = $('[data-companion-stage]'), phone = $('[data-phone]');
  const qEl = $('[data-phone-q]'), aEl = $('[data-phone-a]'), count = $('[data-phone-count]');
  const beats = [...section.querySelectorAll('.beat')], beatList = $('[data-beats]');

  /* A decorative pairing code: finder squares in three corners, a seeded scatter elsewhere. */
  const qr = $('[data-qr]');
  if (qr) {
    let seed = 7, cells = '';
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const finder = (x, y) => `<path d="M${x} ${y}h7v7h-7z M${x + 1} ${y + 1}v5h5v-5z" fill-rule="evenodd"/><path d="M${x + 2} ${y + 2}h3v3h-3z"/>`;
    const inFinder = (x, y) => (x < 8 && y < 8) || (x > 20 && y < 8) || (x < 8 && y > 20);
    for (let y = 0; y < 29; y++) for (let x = 0; x < 29; x++) if (!inFinder(x, y) && rnd() > .52) cells += `M${x} ${y}h1v1h-1z`;
    qr.innerHTML = `${finder(0, 0)}${finder(22, 0)}${finder(0, 22)}<path d="${cells}"/>`;
  }

  /* Beats and pairing state. */
  const setBeat = i => {
    beats.forEach((b, k) => b.classList.toggle('is-on', k === i));
    beatList?.style.setProperty('--beat-p', String((i + 1) / beats.length));
  };
  const setPhase = phase => {
    for (const c of ['is-pairing', 'is-linking', 'is-paired']) stage.classList.toggle(c, c === `is-${phase}`);
  };

  /* Streaming onto the phone, cancellable. */
  let index = 1, run = 0, size = 0, free = false;
  const show = (i, text = items[i].a) => { index = i; count.textContent = `${i + 1} / ${items.length}`; qEl.textContent = items[i].q; aEl.textContent = text; };
  async function stream(text) {
    const id = ++run;
    aEl.textContent = '';
    phone.classList.add('is-streaming');
    const caret = document.createElement('span');
    caret.className = 'caret';
    const node = document.createTextNode('');
    aEl.append(node, caret);
    for (const ch of text) {
      if (id !== run) return;
      node.data += ch;
      await new Promise(r => setTimeout(r, reduced.matches || paused() ? 0 : /[，。；,.;]/.test(ch) ? 90 : 26));
    }
    if (id === run) { caret.remove(); phone.classList.remove('is-streaming'); }
  }
  const stop = () => { run++; aEl.querySelector('.caret')?.remove(); phone.classList.remove('is-streaming'); };

  /* Hints: one key at a time, moving on once you've pressed it. */
  const coach = $('[data-coach]'), coachText = $('[data-coach-text]');
  const steps = [
    { key: 'short', text: zh ? '点一下，让回答更简短' : 'Tap to make it shorter' },
    { key: 'translate', text: zh ? '换成英文版看看' : 'Try it in Chinese' },
    { key: 'prev', text: zh ? '翻回上一个问题' : 'Go back a question' }
  ];
  let step = 0;
  const placeCoach = () => {
    section.querySelectorAll('.is-hinted').forEach(b => b.classList.remove('is-hinted'));
    const s = steps[step];
    if (!coach || !free || !s) { coach?.classList.remove('is-on'); return; }
    const btn = $(`[data-remote="${s.key}"]`), p = phone.getBoundingClientRect(), r = btn.getBoundingClientRect();
    coachText.textContent = s.text;
    coach.style.setProperty('--cx', `${r.left - p.left + r.width / 2}px`);
    coach.style.setProperty('--cy', `${r.top - p.top}px`);
    btn.classList.add('is-hinted');
    coach.classList.add('is-on');
  };
  const advanceCoach = key => { if (steps[step]?.key === key) { step++; setTimeout(placeCoach, 500); } };
  addEventListener('resize', () => free && placeCoach());

  section.querySelectorAll('[data-remote]').forEach(btn => btn.addEventListener('click', () => {
    const key = btn.dataset.remote;
    if (!free) release();
    btn.animate?.([{ transform: 'scale(.94)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
    advanceCoach(key);
    if (key === 'cancel') return stop();
    if (key === 'prev' || key === 'next') { stop(); const i = Math.max(0, Math.min(items.length - 1, index + (key === 'next' ? 1 : -1))); show(i); return; }
    if (key === 'answer') { show(index, ''); return stream(items[index].a); }
    // Rewrites apply to the latest question.
    if (index !== items.length - 1) show(items.length - 1, '');
    stream(items[items.length - 1].variants[key]);
  }));
  section.querySelectorAll('[data-size]').forEach(btn => btn.addEventListener('click', () => {
    size = Math.max(-2, Math.min(3, size + Number(btn.dataset.size)));
    phone.style.setProperty('--fs', size);
  }));

  /* The scroll-driven scene, p from 0 to 1. Deterministic, so it plays the same backwards. */
  const answer = items[1].a;
  function scene(p) {
    if (free) { free = false; stop(); placeCoach(); }
    const clamp = v => Math.max(0, Math.min(1, v));
    setBeat(p < .3 ? 0 : p < .58 ? 1 : 2);
    phone.style.setProperty('--enter', clamp((p - .16) / .16).toFixed(3));
    setPhase(p < .3 ? 'sharing' : p < .5 ? 'pairing' : p < .58 ? 'linking' : 'paired');
    const typed = Math.round(answer.length * clamp((p - .64) / .3));
    show(1, answer.slice(0, typed));
  }
  // Hand the phone over: the full answer, every key live, and the first hint.
  function release() {
    if (free) return;
    free = true;
    phone.style.setProperty('--enter', '1');
    setBeat(2);
    setPhase('paired');
    if (aEl.textContent.length < answer.length && !phone.classList.contains('is-streaming')) show(1);
    requestAnimationFrame(placeCoach);
  }
  window.IHCompanion = { scene, release };

  /* Without the pinned scene: the beats play once, a third of the stage in view. */
  show(1, '');
  if (reduced.matches || !window.gsap) { stage.classList.add('is-instant'); setBeat(2); setPhase('paired'); show(1); free = true; return; }
  if (matchMedia('(min-width: 961px) and (min-height: 640px)').matches) { scene(0); return; }
  setBeat(0);
  new IntersectionObserver((entries, io) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    const later = (ms, fn) => setTimeout(fn, ms);
    later(400, () => { setBeat(1); setPhase('pairing'); });
    later(2200, () => setPhase('linking'));
    later(2900, () => { setBeat(2); setPhase('paired'); stream(answer).then(() => { if (!free) release(); }); });
  }, { threshold: .3 }).observe(stage);
})();
