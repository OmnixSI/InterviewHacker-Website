// Pointer layer (fine pointers only, motion allowed):
//  - a quiet cursor: an ink dot, and a ring that opens into a labelled pill over things you can use;
//  - display type that answers the cursor like a voice — characters near it rise a little, as on a waveform;
//  - a soft light that follows the pointer along card edges, and buttons that fill from the side you enter.
(() => {
  const root = document.documentElement;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => root.classList.contains('motion-paused');
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---------- Cursor ---------- */
  const lang = root.lang.startsWith('zh') ? 'zh' : 'en';
  const words = {
    zh: { download: '下载', switch: '切换', try: '试一试', play: '继续', write: '再写一遍', read: '阅读', open: '打开', go: '前往', ripple: '拨动水面' },
    en: { download: 'Download', switch: 'Switch', try: 'Try it', play: 'Resume', write: 'Write again', read: 'Read', open: 'Open', go: 'Go', ripple: 'Stir' }
  }[lang];
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<i class="cursor__dot"></i><span class="cursor__ring"><b class="cursor__label"></b></span>';
  document.body.append(cursor);
  const dot = cursor.firstElementChild, ring = cursor.lastElementChild, label = ring.firstElementChild;
  root.classList.add('has-cursor');

  // Labels: explicit data-cursor wins; otherwise a few kinds of control get a word.
  const labelFor = el => {
    if (!el) return null;
    if (el.dataset.cursor) return words[el.dataset.cursor] || el.dataset.cursor;
    // Small, self-explanatory controls get no word: a label would only cover them.
    if (el.matches('a[href*="releases"]')) return words.download;
    if (el.matches('a[href^="http"]')) return words.open;
    return '';
  };
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf = 0, hot = null, shown = false;
  const tick = () => {
    raf = 0;
    rx += (x - rx) * .2; ry += (y - ry) * .2;
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    if (Math.abs(x - rx) + Math.abs(y - ry) > .3) raf = requestAnimationFrame(tick);
  };
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    if (!shown) { shown = true; rx = x; ry = y; cursor.classList.add('is-on'); }
    // Over a text field the system caret takes over; over the dark water the cursor turns light.
    const field = !!e.target.closest?.('input:not([type="checkbox"]), textarea');
    cursor.classList.toggle('is-typing', field);
    cursor.classList.toggle('is-dark', !!e.target.closest?.('.ending__panel'));
    const target = e.target.closest?.('a, button, summary, label, [data-cursor]');
    if (target !== hot) {
      hot = target;
      const text = labelFor(target);
      cursor.classList.toggle('is-hot', target != null);
      cursor.classList.toggle('has-label', !!text);
      label.textContent = text || '';
      const over = e.target.closest?.('[data-hero], [data-demo-pin], .ending__panel');
      cursor.classList.toggle('is-water', !target && !!over);
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });
  addEventListener('pointerdown', () => cursor.classList.add('is-down'));
  addEventListener('pointerup', () => cursor.classList.remove('is-down'));
  document.addEventListener('pointerleave', () => { shown = false; cursor.classList.remove('is-on'); });

  if (reduced.matches) return;

  /* ---------- Type that listens ----------
     Characters rise by their distance to the cursor, with the speed of the pointer as loudness. */
  function listen(container, { reach = 140, lift = 16, scale = .06, cells = null } = {}) {
    if (!container || !window.gsap || (!cells && !window.SplitText)) return;
    const els = cells || SplitText.create(container, { type: 'chars', charsClass: 'ch' }).chars;
    const chars = els.map(el => ({ el, y: gsap.quickTo(el, 'y', { duration: .5, ease: 'power3.out' }), s: gsap.quickTo(el, 'scaleY', { duration: .5, ease: 'power3.out' }) }));
    let centres = [], energy = 0, last = null, raf = 0, inside = false, px = 0, py = 0;
    const measure = () => { centres = chars.map(c => { const r = c.el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
    const frame = () => {
      raf = 0;
      energy *= .9;
      chars.forEach((c, i) => {
        const [cx, cy] = centres[i] || [0, 0];
        const d = Math.hypot(cx - px, (cy - py) * 1.6);
        const k = inside ? Math.exp(-(d * d) / (reach * reach)) * Math.min(1, .25 + energy) : 0;
        c.y(-lift * k); c.s(1 + scale * k);
      });
      if (inside || energy > .02) raf = requestAnimationFrame(frame);
    };
    container.addEventListener('pointerenter', () => { measure(); inside = true; });
    container.addEventListener('pointermove', e => {
      if (paused()) return;
      if (last) energy = Math.min(1.4, energy + Math.hypot(e.clientX - last[0], e.clientY - last[1]) / 60);
      last = [e.clientX, e.clientY]; px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(frame);
    });
    container.addEventListener('pointerleave', () => { inside = false; last = null; if (!raf) raf = requestAnimationFrame(frame); });
    addEventListener('scroll', () => { if (inside) measure(); }, { passive: true });
  }
  const start = () => {
    // The headline's characters were already split into cells by the two-pass intro; reuse them.
    const texts = $$('.hero__text');
    if (texts.length) for (const t of texts) listen(t, { reach: 120, lift: 14, cells: $$('.hc', t) });
    else for (const line of $$('.hero__line')) listen(line.firstChild?.nodeType === 3 ? wrapText(line) : line, { reach: 120, lift: 14 });
  };
  // Only the text node of the second hero line is split; the lettering beside it stays one drawing.
  function wrapText(line) {
    const span = document.createElement('span');
    span.className = 'hero__listen';
    line.insertBefore(span, line.firstChild);
    span.append(line.childNodes[1]);
    return span;
  }
  document.fonts?.ready.then(() => setTimeout(start, 50)) ?? start();

  // Hovering the lettering writes it again.
  for (const svg of $$('.hero__lettering svg, .demo__word svg')) {
    svg.parentElement.dataset.cursor = 'write';
    svg.parentElement.addEventListener('pointerenter', () => {
      if (!window.gsap || paused()) return;
      const paths = [...svg.querySelectorAll('path')], lens = paths.map(p => p.getTotalLength()), sum = lens.reduce((a, b) => a + b, 0);
      const tl = gsap.timeline();
      paths.forEach((p, i) => tl.fromTo(p, { drawSVG: '0%' }, { drawSVG: i === 0 && svg.classList.contains('lettering--lead') ? '6.5% 100%' : '100%', duration: Math.max(.04, 1.2 * lens[i] / sum), ease: 'none' }));
    });
  }

  /* ---------- Edge light and directional fills ---------- */
  for (const el of $$('.leaf, .ledger__col, .paper, .install li, .tsel__sheet, .audio__river')) {
    el.classList.add('glow');
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--gx', `${e.clientX - r.left}px`);
      el.style.setProperty('--gy', `${e.clientY - r.top}px`);
    });
  }
  for (const btn of $$('.btn')) {
    btn.addEventListener('pointerenter', e => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--from', e.clientX < r.left + r.width / 2 ? '0%' : '100%');
    });
  }

  /* ---------- The device leans towards you ---------- */
  const device = document.querySelector('[data-device] .device__tilt');
  if (device && window.gsap) {
    const rx = gsap.quickTo(device, 'rotationX', { duration: .9, ease: 'power3.out' });
    const ry = gsap.quickTo(device, 'rotationY', { duration: .9, ease: 'power3.out' });
    const stage = device.closest('[data-demo-pin]') || device;
    stage.addEventListener('pointermove', e => {
      if (paused()) return;
      const r = device.getBoundingClientRect();
      rx(((e.clientY - (r.top + r.height / 2)) / r.height) * -3);
      ry(((e.clientX - (r.left + r.width / 2)) / r.width) * 4);
    });
    stage.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }
})();
