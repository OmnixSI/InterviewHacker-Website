// Turn — № 02 The day. Four meetings; in each, the other side speaks and the next line surfaces.
//
// Choreography (once per scene, when its first beat reaches ~78% of the viewport; motion allowed only):
//   room / series beats → the quote is spoken word by word with an amber underline under the active word
//   (IH.emit('turn', {who:'them'}), then 'voice' {who:'them'} per word) → a 200 ms gap, the caret blinking →
//   IH.emit('turn', {who:'me'}) and the answer surfaces word by word ('voice' {who:'me'} + sound 'word' per word).
// The hairline time numerals draw in with the scroll (scrubbed: position is state).
// Gestures: 09:30 Answer / Record only · 11:00 rewrite chips · 14:00 Online / In person (also merges the background
// lines via IH.emit('lines', {merge}), released when the scene leaves the viewport) · 16:30 Share entire screen
// (the answer card flies from the laptop to the phone with Flip). Gesture results are announced once, politely.
// Reduced or paused motion: everything is shown complete and gestures switch instantly. No script: the part's
// markup is already the complete, final reading (gestures are hidden with data-needs-js).
(() => {
  const IH = window.IH;
  const section = document.querySelector('[data-day]');
  if (!IH || !section) return;
  const gsap = window.gsap;
  const hasGsap = !!gsap;
  const ST = window.ScrollTrigger, Flip = window.Flip;
  const canDraw = hasGsap && !!window.DrawSVGPlugin;
  const live = section.querySelector('[data-day-live]');
  const motion = () => hasGsap && IH.motionOK();
  const sound = (name, opts) => { try { IH.sound?.play?.(name, opts); } catch (e) { /* sound never breaks the page */ } };
  const reduceNow = () => IH.reduced || IH.paused;
  const SETTLE = IH.ease?.settle || 'power3.out', CHANGE = IH.ease?.change || 'power2.inOut';

  /* ---------------- Announce (one polite message per gesture, the final sentence only) ---------------- */
  let announceTimer = 0;
  function announce(text) {
    if (!live) return;
    clearTimeout(announceTimer);
    live.textContent = '';
    announceTimer = setTimeout(() => { live.textContent = text.replace(/\s+/g, ' ').trim(); }, 120);
  }

  /* ---------------- Split text into words, grouped into unbreakable phrases ----------------
     Words (en: by space; zh: Intl.Segmenter words, punctuation kept with its word) become inline blocks (.dw) so they
     can rise. Inline blocks may break anywhere, so words are grouped into nowrap phrases (.dp) and lines break only
     between phrases: zh at authored <wbr>s and after punctuation when the copy has them, otherwise between words
     with particles kept on the word before and runs of one-character words kept together; the last short phrase
     never stands alone on a line (en: the last two words stay together). */
  const CLOSE = /^[，。、；：？！…）」』》〉】,.;:?!’”)\]]/;
  const OPEN = /[（「『《〈【“‘(\[]$/;
  const PUNCT_END = /[，。、；：？！…,.;:?!]$/;
  const PARTICLE = /^[的了吗呢吧着过地得们]$/;
  const HAN = /[\u3400-\u9fff\uf900-\ufaff]/;
  const LATIN = /[A-Za-z0-9]/;
  const zhSeg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('zh', { granularity: 'word' }) : null;
  const langOf = el => ((el.closest('[lang]')?.getAttribute('lang') || 'en').startsWith('zh') ? 'zh' : 'en');
  function tokens(text, lang) {
    if (lang !== 'zh') return text.split(/(\s+)/);
    if (zhSeg) return [...zhSeg.segment(text)].map(s => s.segment);
    return text.match(/[A-Za-z0-9]+|\s+|./gu) || [];
  }
  const coreLen = w => w.text.replace(/[，。、；：？！…（）“”‘’,.;:?!()\s]/g, '').length;
  const isSingle = w => !w.el && coreLen(w) === 1 && !/[A-Za-z]/.test(w.text);
  /** Group zh words into phrases (arrays of word indices). */
  function phrasesZh(words, authored) {
    const out = [];
    let cur = [];
    const flush = () => { if (cur.length) out.push(cur); cur = []; };
    if (authored) {
      words.forEach((w, i) => { if (w.brBefore) flush(); cur.push(i); if (PUNCT_END.test(w.text)) flush(); });
      flush();
    } else {
      // Units: runs of single characters stick together; particles join the word before.
      const units = [];
      words.forEach((w, i) => {
        const prev = units[units.length - 1];
        const prevWord = prev && words[prev[prev.length - 1]];
        const prevOpen = prevWord && !PUNCT_END.test(prevWord.text);
        if (prev && prevOpen && (PARTICLE.test(w.text.replace(/[，。、；：？！]$/, '')) || (isSingle(w) && prev.single))) { prev.push(i); prev.single = prev.single && isSingle(w); return; }
        const u = [i]; u.single = isSingle(w); units.push(u);
      });
      // A lone single character joins its neighbour in the same clause (the one before, else the one after).
      for (let k = 0; k < units.length; k++) {
        const u = units[k];
        if (u.length !== 1 || !u.single) continue;
        const prev = units[k - 1], next = units[k + 1];
        const prevOpen = prev && !PUNCT_END.test(words[prev[prev.length - 1]].text);
        if (prevOpen && !PUNCT_END.test(words[u[0]].text) && next && !(k === 0)) { prev.push(...u); units.splice(k--, 1); }
        else if (!PUNCT_END.test(words[u[0]].text) && next) { next.unshift(...u); units.splice(k--, 1); }
        else if (prevOpen) { prev.push(...u); units.splice(k--, 1); }
      }
      out.push(...units);
    }
    // No orphan: a short last phrase stays with the one before it.
    const last = out[out.length - 1];
    if (out.length > 1 && last.reduce((n, i) => n + coreLen(words[i]), 0) <= 4) { out[out.length - 2].push(...last); out.pop(); }
    return out;
  }
  /** Wraps each word of el in span.dw (once), grouped in span.dp; returns the word spans. */
  function split(el) {
    if (el._dw) return el._dw;
    const lang = langOf(el);
    // Authored phrases (span.nw, unbreakable without script) become break points.
    el.querySelectorAll('.nw').forEach(n => { n.before(document.createElement('wbr')); n.replaceWith(...n.childNodes); });
    el.normalize();
    const words = [];
    let cur = null, brBefore = false, authored = false;
    const start = () => { cur = { nodes: [], text: '', el: false, brBefore }; brBefore = false; words.push(cur); return cur; };
    for (const node of [...el.childNodes]) {
      if (node.nodeType === 3) {
        for (const tok of tokens(node.textContent, lang)) {
          if (!tok) continue;
          if (/^\s+$/.test(tok)) { cur = null; continue; }
          if (!(cur && (CLOSE.test(tok) || cur.open))) start();
          cur.nodes.push(tok); cur.text += tok; cur.open = OPEN.test(tok);
        }
      } else if (node.nodeType === 1 && (node.tagName === 'WBR' || node.tagName === 'BR')) {
        cur = null; brBefore = true; authored = true;
      } else if (node.nodeType === 1) {
        if (!(cur && cur.open)) start();
        cur.nodes.push(node); cur.text += node.textContent; cur.el = true; cur.open = false;
      }
    }
    const keepLast = (gs, n) => { if (gs.length > 1 && gs[gs.length - 1].reduce((k, i) => k + coreLen(words[i]), 0) <= n) gs[gs.length - 2].push(...gs.pop()); return gs; };
    // zh: always phrase groups, so a word (联调, 运维, 屏幕) is never split across lines.
    const groups = lang === 'zh' ? phrasesZh(words, authored)
      : keepLast(words.map((w, i) => [i]), lang === 'zh' ? 3 : 12);
    const units = [];
    const frag = document.createDocumentFragment();
    let lastChar = '';
    groups.forEach((g, gi) => {
      if (lang !== 'zh' && gi) frag.append(' ');
      const dp = document.createElement('span');
      dp.className = 'dp';
      g.forEach((i, k) => {
        const w = words[i];
        if (lang !== 'zh' && k) dp.append(' ');
        const dw = document.createElement('span');
        dw.className = 'dw';
        const first = w.text.trim()[0] || '';
        // text-autospace does not reach across inline blocks: keep the ⅛ em between Han and Latin by hand.
        if (lang === 'zh' && lastChar && first && ((HAN.test(lastChar) && LATIN.test(first)) || (LATIN.test(lastChar) && HAN.test(first)))) dw.classList.add('as');
        dw.append(...w.nodes);
        dp.append(dw);
        units.push(dw);
        lastChar = w.text.trim().slice(-1) || lastChar;
      });
      frag.append(dp);
    });
    el.textContent = '';
    el.append(frag);
    el._dw = units;
    return units;
  }
  function setContent(el, text, lang) {
    el._dw = null;
    if (lang) el.setAttribute('lang', lang); else el.removeAttribute('lang');
    el.textContent = text;
  }

  /* ---------------- Speak: the other side's line, word by word, with an amber underline ---------------- */
  function underline(p) {
    let ul = p.querySelector('.speak-ul');
    if (!ul) { ul = document.createElement('span'); ul.className = 'speak-ul'; ul.setAttribute('aria-hidden', 'true'); p.append(ul); }
    return ul;
  }
  const lenOf = u => u.textContent.replace(/[\s，。？！、,.?!]/g, '').length;
  function speak(quoteP) {
    const units = split(quoteP);
    const lang = langOf(quoteP);
    const ul = underline(quoteP);
    const tl = gsap.timeline();
    const chars = units.reduce((n, u) => n + lenOf(u), 0) || 1;
    // A spoken line, compressed: about 70 ms a character (zh) or 26 ms a letter (en), 0.7–1.5 s in all.
    const total = Math.min(0.55, Math.max(0.36, chars * (lang === 'zh' ? 0.045 : 0.017)));
    let t = 0;
    tl.call(() => IH.emit('turn', { who: 'them' }), null, 0);
    units.forEach((u, i) => {
      const d = total * Math.max(1, lenOf(u)) / chars;
      tl.call(() => {
        const fs = parseFloat(getComputedStyle(quoteP).fontSize) || 32;
        const to = { x: u.offsetLeft, y: u.offsetTop + u.offsetHeight - fs * 0.12, width: u.offsetWidth, opacity: 0.6 };
        if (i === 0) gsap.set(ul, { ...to, width: 0 });
        gsap.to(ul, { ...to, duration: i === 0 ? 0.22 : 0.16, ease: CHANGE, overwrite: true });
        IH.emit('voice', { who: 'them', level: 0.4 + 0.45 * Math.min(1, lenOf(u) / 4), ms: Math.round(d * 1000) });
      }, null, t);
      tl.to(u, { opacity: 1, duration: 0.2, ease: SETTLE }, t);
      t += d;
    });
    tl.call(() => gsap.to(ul, { opacity: 0, duration: 0.32, ease: CHANGE, overwrite: true }), null, t + 0.06);
    tl.lineEnd = t; // when the last word has been said
    return tl;
  }

  /* ---------------- Surface: the next line, word by word ---------------- */
  function surface(el, { emitTurn = true } = {}) {
    const units = split(el);
    const tl = gsap.timeline();
    if (emitTurn) tl.call(() => IH.emit('turn', { who: 'me' }), null, 0);
    // 40 ms a word, but a long answer never takes more than ~0.36 s to start its last word.
    const each = Math.min(0.04, 0.36 / Math.max(1, units.length - 1));
    tl.fromTo(units, { opacity: 0, y: '0.4em' }, { opacity: 1, y: 0, duration: 0.42, ease: SETTLE, stagger: each }, 0);
    units.forEach((u, i) => tl.call(() => {
      IH.emit('voice', { who: 'me', level: 0.35 + 0.4 * Math.min(1, lenOf(u) / 5), ms: 120 });
      sound('word');
    }, null, i * each));
    return tl;
  }
  /** Old words sink and fade (160 ms), the new ones rise. The slot's height eases between the two. */
  function resurface(el, slot, text, lang) {
    if (!motion()) { setContent(el, text, lang); return null; }
    const old = split(el);
    const h0 = slot.offsetHeight;
    const tl = gsap.timeline();
    tl.to(old, { opacity: 0, y: '0.3em', duration: 0.16, ease: CHANGE, stagger: { each: 0.006, from: 'end' } });
    tl.call(() => {
      setContent(el, text, lang);
      const units = split(el);
      gsap.set(units, { opacity: 0, y: '0.4em' });
      const h1 = slot.offsetHeight;
      if (Math.abs(h1 - h0) > 1) gsap.fromTo(slot, { height: h0 }, { height: h1, duration: 0.42, ease: CHANGE, clearProps: 'height' });
      tl.add(surface(el), '>');
    });
    return tl;
  }

  /* ---------------- Write: hand lettering by stroke order ---------------- */
  function write(svg) {
    const paths = svg ? [...svg.querySelectorAll('path')] : [];
    if (!paths.length || !canDraw || !motion()) return null;
    const tl = gsap.timeline();
    const scale = svg.getBoundingClientRect().height / (svg.viewBox.baseVal?.height || 1);
    let t = 0;
    for (const p of paths) {
      let len = 0;
      try { len = p.getTotalLength() * scale; } catch (e) { len = 60; }
      const d = Math.min(0.9, Math.max(0.18, len / 620));
      tl.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: d, ease: CHANGE }, t);
      t += d + 0.04;
    }
    return tl;
  }

  /* ---------------- Reveal: headline lines rise from a clip ---------------- */
  const pending = new Set(); // { finish() } for entrances set up but not yet played
  function belowFold(el) { return el.getBoundingClientRect().top > innerHeight * 0.98; }
  function onEnter(trigger, start, fn) {
    if (ST) ST.create({ trigger, start, once: true, onEnter: fn });
    else IH.inView(trigger, on => { if (on && !trigger._entered) { trigger._entered = true; fn(); } });
  }
  function setupReveal(h) {
    const lines = [...h.querySelectorAll('.day-rl > span')];
    if (!lines.length || !belowFold(h)) return;
    h.classList.add('is-revealing');
    gsap.set(lines, { yPercent: 112 });
    const item = { finish() { gsap.set(lines, { yPercent: 0 }); h.classList.remove('is-revealing'); pending.delete(item); } };
    pending.add(item);
    onEnter(h, 'top 86%', () => {
      if (!pending.has(item)) return;
      pending.delete(item);
      gsap.to(lines, { yPercent: 0, duration: 0.72, ease: SETTLE, stagger: 0.07, onComplete: () => h.classList.remove('is-revealing') });
    });
  }

  /* ---------------- Numerals: hairlines drawn by the scroll ---------------- */
  function setupNumeral(svg) {
    if (!canDraw || !ST) return;
    const groups = [...svg.querySelectorAll('g')];
    const tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: 'top 96%', end: 'bottom 46%', scrub: 0.8 } });
    groups.forEach((g, i) => tl.fromTo(g.querySelectorAll('path'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 1, ease: 'none' }, i * 0.32));
    svg._tl = tl;
  }

  /* ---------------- Segmented control ---------------- */
  function segmented(group, onChange) {
    const btns = [...group.querySelectorAll('.seg__btn')];
    group.setAttribute('data-sound', 'none'); // the module plays its own sounds
    const set = (i, user) => {
      const prev = btns.findIndex(b => b.getAttribute('aria-pressed') === 'true');
      btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
      group.dataset.on = String(i);
      if (user && i !== prev) { sound('toggle', { on: i > 0 }); onChange(btns[i].dataset.value, i); }
    };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => set(i, true));
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const j = (i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length;
        btns[j].focus();
        set(j, true);
      });
    });
    set(0, false);
    return { set: i => set(i, false), get value() { return btns[Number(group.dataset.on) || 0].dataset.value; } };
  }

  /* ================================================================================================
     Scenes
     ================================================================================================ */
  const scenes = [...section.querySelectorAll('[data-scene]')].map(el => ({ el, kind: el.dataset.scene }));
  const S = Object.fromEntries(scenes.map(s => [s.kind, s]));
  section.querySelectorAll('[data-day-reveal]').forEach(h => hasGsap && setupReveal(h));
  section.querySelectorAll('.scene__numeral').forEach(setupNumeral);

  // ---- 16:30: start with the screen not shared, the card on the laptop ----
  const call = S.call;
  if (call) {
    const fig = call.el.querySelector('[data-devices]');
    const card = fig.querySelector('[data-card]');
    const laptop = fig.querySelector('[data-dock="laptop"]'), phone = fig.querySelector('[data-dock="phone"]');
    const sw = fig.querySelector('[data-switch]');
    fig.classList.add('is-live');
    fig.classList.remove('is-sharing');
    laptop.append(card);
    sw.setAttribute('data-sound', 'none');
    sw.addEventListener('click', () => {
      const on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(on));
      sound('toggle', { on });
      const target = on ? phone : laptop;
      const doFlip = motion() && Flip;
      const state = doFlip ? Flip.getState(card) : null;
      fig.classList.toggle('is-sharing', on);
      target.append(card);
      if (doFlip) Flip.from(state, { duration: 0.7, ease: SETTLE, absolute: true, zIndex: 6, scale: false });
      announce(on ? IH.t('正在共享整个屏幕。回答已移到手机上，只有你看得到。', 'Sharing entire screen. The answer moved to your phone, where only you can see it.')
        : IH.t('已停止共享整个屏幕。回答回到电脑上。', 'Stopped sharing the entire screen. The answer is back on the laptop.'));
    });
  }

  // ---- 14:00: the two lines (online) and the one (in person) ----
  const lab = S.lab;
  let labApi = null;
  if (lab) {
    const fig = lab.el.querySelector('[data-duo]');
    const svg = fig.querySelector('svg');
    const [pT, pM] = svg.querySelectorAll('path');
    const lblT = fig.querySelector('.duo__label--them'), lblM = fig.querySelector('.duo__label--me'), lblR = fig.querySelector('.duo__label--room');
    const st = { m: 0 };
    let W = 640;
    const H = 120;
    function draw() {
      const yT = 30, yM = 90, y0 = 60, amp = 2.1, soft = Math.max(120, W * 0.3), wave = Math.max(90, Math.min(150, W / 9)), n = Math.min(240, Math.round(W / 4));
      const J = (W + soft) - st.m * (W + 2 * soft);
      const sm = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
      let a = '', b = '';
      for (let i = 0; i <= n; i++) {
        const x = (W * i) / n;
        const f = sm((x - (J - soft / 2)) / soft);
        const tw = amp * f * Math.sin((x / wave) * Math.PI * 2);
        a += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + (yT + (y0 - yT) * f + tw).toFixed(2);
        b += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + (yM + (y0 - yM) * f - tw).toFixed(2);
      }
      pT.setAttribute('d', a); pM.setAttribute('d', b);
      const sep = 1 - Math.min(1, st.m * 1.6), joined = Math.max(0, st.m * 1.6 - 0.6);
      lblT.style.opacity = lblM.style.opacity = sep.toFixed(3);
      lblR.style.opacity = Math.min(1, joined).toFixed(3);
    }
    function measure() {
      const w = Math.round(svg.getBoundingClientRect().width) || 640;
      if (w === W) return;
      W = w; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); draw();
    }
    fig.classList.add('is-live');
    measure(); draw();
    addEventListener('resize', () => requestAnimationFrame(measure));
    let inView = false, asked = false;
    const tellLines = on => {
      // Ask the background to merge only while this scene is on screen; let go when it leaves.
      if (on && inView) { IH.emit('lines', { merge: true }); asked = true; }
      else if (asked) { IH.emit('lines', { merge: false }); asked = false; }
    };
    const seg = segmented(fig.querySelector('[data-seg="room"]'), value => {
      const on = value === 'room';
      if (motion()) gsap.to(st, { m: on ? 1 : 0, duration: 0.9, ease: CHANGE, onUpdate: draw, overwrite: true });
      else { st.m = on ? 1 : 0; draw(); }
      tellLines(on);
      announce(on ? IH.t('线下：现场，只用麦克风。', 'In person: in the room, microphone only.') : IH.t('线上：对方是这台 Mac 播放的声音，我是麦克风。', 'Online: them is everything your Mac plays, me is the microphone.'));
    });
    IH.inView(lab.el, on => { inView = on; tellLines(on && seg.value === 'room'); });
    labApi = { seg };
  }

  // ---- 11:00: rewrites ----
  const round = S.round;
  if (round) {
    const ans = round.el.querySelector('[data-answer]');
    const slot = round.el.querySelector('[data-slot]');
    const chips = [...round.el.querySelectorAll('.chip')];
    const group = round.el.querySelector('[data-chips]');
    group.setAttribute('data-sound', 'none');
    const original = { text: ans.textContent.trim(), lang: ans.getAttribute('lang') };
    const variants = {
      original,
      short: { text: ans.dataset.rewriteShort, lang: null },
      example: { text: ans.dataset.rewriteExample, lang: null },
      lang: { text: ans.dataset.rewriteLang, lang: ans.dataset.rewriteLangCode || null }
    };
    let current = 'original', busy = null;
    chips.forEach(c => {
      if (c.dataset.variant === 'original') c.classList.add('chip--original');
      c.addEventListener('click', () => {
        let v = c.dataset.variant;
        if (v === current && v !== 'original') v = 'original'; // pressing the active rewrite again goes back
        if (v === current) return;
        sound('tap');
        current = v;
        chips.forEach(k => k.setAttribute('aria-pressed', String(k.dataset.variant === v)));
        busy?.progress(1);
        const { text, lang } = variants[v];
        busy = resurface(ans, slot, text, lang);
        announce(text);
      });
    });
  }

  // ---- 09:30: answer / record only ----
  const standup = S.standup;
  if (standup) {
    const ans = standup.el.querySelector('[data-answer]');
    const noted = standup.el.querySelector('[data-noted]');
    const letter = noted.querySelector('svg');
    let busy = null;
    segmented(standup.el.querySelector('[data-seg="record"]'), value => {
      const rec = value === 'record';
      busy?.progress(1);
      standup.el.classList.toggle('is-record', rec);
      if (rec) {
        busy = write(letter);
        announce(noted.querySelector('.noted__line').textContent);
      } else {
        busy = motion() ? surface(ans) : null;
        announce(ans.textContent);
      }
    });
  }

  /* ---------------- Entrances: each scene plays its turn once ---------------- */
  function sequence(s) {
    const el = s.el;
    const quote = el.querySelector('[data-quote] p');
    const ans = el.querySelector('[data-answer]');
    const room = [...el.querySelectorAll('.room__line')];
    const series = el.querySelector('[data-series]');
    const first = room[0] || series || quote;
    if (!quote || !ans || !belowFold(first)) return;
    const qUnits = split(quote);
    const aUnits = split(ans);
    const cite = el.querySelector('.cite');
    gsap.set(qUnits, { opacity: 0.55 }); // readable before it is spoken
    gsap.set(aUnits, { opacity: 0, y: '0.4em' });
    if (room.length) gsap.set(room, { opacity: 0.35, y: 6 });
    let seriesParts = null;
    if (series) {
      seriesParts = { tabs: series.querySelectorAll('.series__tab'), paths: series.querySelectorAll('path') };
      gsap.set(seriesParts.tabs, { opacity: 0.35, y: 6 });
      if (canDraw) gsap.set(seriesParts.paths, { drawSVG: '0%' });
    }
    if (cite) el.classList.add('cite-pending');
    let tl = null;
    const item = {
      finish() {
        pending.delete(item);
        if (tl) { tl.progress(1); return; }
        gsap.set([...qUnits, ...aUnits], { opacity: 1, y: 0 });
        if (room.length) gsap.set(room, { opacity: 1, y: 0 });
        if (seriesParts) { gsap.set(seriesParts.tabs, { opacity: 1, y: 0 }); if (canDraw) gsap.set(seriesParts.paths, { drawSVG: '100%' }); }
        el.classList.remove('cite-pending');
        room.forEach(r => r.classList.remove('is-now'));
      }
    };
    pending.add(item);
    const play = () => {
      if (!pending.has(item) || tl) return;
      tl = gsap.timeline({ onComplete: () => pending.delete(item) });
      // ≈1.2 s from trigger to the last answer word starting: room / series 0.3 s, quote ≤ 0.55 s, 200 ms gap.
      let t = 0;
      if (room.length) {
        room.forEach((r, i) => {
          tl.call(() => { room.forEach(x => x.classList.toggle('is-now', x === r)); IH.emit('voice', { who: 'them', level: 0.18, ms: 120 }); }, null, t);
          tl.to(r, { opacity: 1, y: 0, duration: 0.3, ease: SETTLE }, t);
          t += 0.1;
        });
        tl.call(() => room.forEach(x => x.classList.remove('is-now')), null, t + 0.12);
        t += 0.1;
      }
      if (seriesParts) {
        tl.to(seriesParts.tabs[0], { opacity: 1, y: 0, duration: 0.3, ease: SETTLE }, t);
        if (canDraw) tl.to(seriesParts.paths, { drawSVG: '100%', duration: 0.2, ease: CHANGE, stagger: 0.14 }, t + 0.06);
        tl.to(seriesParts.tabs[1], { opacity: 1, y: 0, duration: 0.3, ease: SETTLE }, t + 0.24);
        t += 0.3;
      }
      tl.call(() => ans.classList.add('is-listening'), null, t);
      const sp = speak(quote);
      tl.add(sp, t);
      t += sp.lineEnd + 0.2; // the line ends; 200 ms later, your turn
      tl.call(() => ans.classList.remove('is-listening'), null, t);
      const recording = s.kind === 'standup' && el.classList.contains('is-record');
      if (!recording) tl.add(surface(ans), t);
      else gsap.set(aUnits, { opacity: 1, y: 0 });
      if (cite) tl.call(() => el.classList.remove('cite-pending'), null, t + 0.5);
    };
    const grid = el.querySelector('.scene__grid') || el;
    if (ST) {
      // Plays once the scene is about a quarter into the viewport. Scrolled past fast (or past it entirely): complete at once.
      ST.create({
        trigger: grid, start: 'top 75%', end: 'bottom top',
        onEnter: self => { if (Math.abs(self.getVelocity()) > 3200) item.finish(); else play(); },
        onLeave: () => { if (pending.has(item)) item.finish(); },
        onEnterBack: () => { if (pending.has(item)) item.finish(); }
      });
    } else onEnter(grid, 'top 75%', play);
  }
  if (hasGsap && IH.motionOK()) scenes.forEach(sequence);
  // Chinese body copy: the same phrase grouping keeps words whole at the line end (word-break: auto-phrase is Japanese-only).
  if (IH.lang === 'zh') section.querySelectorAll('.scene__body, .day__lead').forEach(split);

  // Motion paused or reduced: whatever is waiting appears at once, whatever is running jumps to its end.
  IH.on('motion', () => { if (reduceNow()) [...pending].forEach(p => p.finish()); });
  addEventListener('beforeprint', () => [...pending].forEach(p => p.finish()));
  section.classList.add('is-ready');
  IH.day = { scenes: S, lab: labApi };
})();
