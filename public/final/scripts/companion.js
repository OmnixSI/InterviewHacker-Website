// Phone companion section. When it comes into view the phone "scans" the pairing code on the shared Mac,
// the link between them draws, and the answer streams onto the phone. Every key on the phone works:
// answer, shorter, example, other language, previous/next, cancel, and text size. Local script only.
(() => {
  const root = document.documentElement;
  const section = document.querySelector('[data-companion]');
  const dataEl = document.getElementById('demo-data');
  if (!section || !dataEl) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => root.classList.contains('motion-paused');
  const $ = s => section.querySelector(s);
  const S = JSON.parse(dataEl.textContent).scenes.interview;
  const items = [{ q: S.q1.text, a: S.a1 }, { q: S.q2.text, a: S.a2, variants: S.variants }];
  const stage = $('[data-companion-stage]'), qEl = $('[data-phone-q]'), aEl = $('[data-phone-a]'), count = $('[data-phone-count]');
  const phone = $('[data-phone]');

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

  /* Streaming onto the phone, cancellable. */
  let index = 1, run = 0, size = 0;
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

  section.querySelectorAll('[data-remote]').forEach(btn => btn.addEventListener('click', () => {
    const key = btn.dataset.remote;
    btn.animate?.([{ transform: 'scale(.94)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
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

  /* Pairing, once, when the stage is mostly in view. */
  const connect = () => {
    stage.classList.add('is-paired');
    show(1, '');
    stream(items[1].a);
  };
  if (reduced.matches || !window.gsap) { stage.classList.add('is-paired', 'is-instant'); show(1); return; }
  show(1, '');
  if (window.DrawSVGPlugin) gsap.registerPlugin(DrawSVGPlugin);
  const link = $('[data-link]');
  gsap.set(link, { drawSVG: '0%' });
  new IntersectionObserver((entries, io) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    stage.classList.add('is-scanning');
    gsap.timeline({ delay: .3 })
      .to({}, { duration: 1.6 })
      .call(() => { stage.classList.remove('is-scanning'); stage.classList.add('is-linking'); })
      .to(link, { drawSVG: '100%', duration: .9, ease: 'power2.inOut' })
      .call(connect);
  }, { threshold: .55 }).observe(stage);
})();
