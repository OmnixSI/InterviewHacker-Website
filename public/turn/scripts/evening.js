// Turn — evening (20:00 → 21:40). Evening agent.
//
// 20:00 · a late call in English. When the scene comes into view their line is spoken word by word with a faint
// amber underline under the active word ('voice' them); when it lands, 'turn' them; 600 ms later the next line
// surfaces word by word ('turn' me, then per word 'voice' me + the 'word' sound). The English / 中文 toggle morphs
// the answer between languages: the old words sink and fade, the new ones rise (ih.change, ≤ 600 ms in all).
// 21:40 · after the call. The raw transcript on the left assembles into the note on the right: items rise in with
// their timestamps, the misheard word is struck in amber and the fix appears in indigo, the vague date resolves and
// takes its To confirm tag; finally the question-bank line and the lettering `next line.` written stroke by stroke.
// Large screens: scrubbed by scroll. Phones: plays once on entering. Reduced motion, no script: the finished state.
// Timestamps are real links to the transcript line; hover or focus shows "Back to the moment" (CSS).
(() => {
  const IH = window.IH;
  if (!IH) return;
  const hasGsap = typeof window.gsap !== 'undefined';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const ok = () => IH.motionOK();
  const play = (n, o) => IH.sound?.play?.(n, o);

  /* ======================= The time numerals draw in, like the day's ======================= */
  if (hasGsap && window.ScrollTrigger && window.DrawSVGPlugin) {
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      const tls = $$('.ev-numeral').map(svg => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: 'top 96%', end: 'bottom 46%', scrub: 0.8 } });
        $$('g', svg).forEach((g, i) => tl.fromTo(g.querySelectorAll('path'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 1, ease: 'none' }, i * 0.32));
        return tl;
      });
      const off = IH.on('motion', m => { if (!m) tls.forEach(t => { t.scrollTrigger?.kill(); t.progress(1); }); });
      if (!ok()) tls.forEach(t => { t.scrollTrigger?.kill(); t.progress(1); });
      return () => { off(); tls.forEach(t => { t.scrollTrigger?.kill(); t.revert(); }); };
    });
  }

  /* =============================== 20:00 · the call =============================== */
  const call = $('[data-ev-call]');
  if (call) {
    const quote = $('[data-ev-quote] p', call);
    const box = $('[data-ev-answer]', call);
    const vers = { en: $('[data-v="en"]', box), zh: $('[data-v="zh"]', box) };
    const btns = $$('[data-ev-lang]', call);
    let lang = 'en', played = false, busy = null, timers = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const clear = () => { timers.forEach(clearTimeout); timers = []; };

    // Words as inline-blocks (Chinese: phrase groups split at punctuation, so lines still break naturally).
    function words(el) {
      if (el.dataset.split) return $$('.w', el);
      const text = el.textContent.trim();
      const zh = el.lang && el.lang.startsWith('zh');
      const parts = zh ? text.match(/[^，。、；：？！]+[，。、；：？！]?/g) || [text] : text.split(/\s+/);
      el.textContent = '';
      parts.forEach((p, i) => {
        const s = document.createElement('span');
        s.className = 'w'; s.textContent = p;
        el.append(s);
        if (!zh && i < parts.length - 1) el.append(' ');
      });
      el.dataset.split = '1';
      return $$('.w', el);
    }
    const qWords = words(quote);
    const aWords = { en: words(vers.en), zh: words(vers.zh) };

    function finish() {
      clear();
      call.classList.remove('is-armed');
      qWords.forEach(w => w.classList.remove('is-on', 'was-on'));
      if (hasGsap) gsap.set([...aWords.en, ...aWords.zh], { clearProps: 'opacity,transform' });
      played = true;
    }

    // Their line: word by word, the underline sweeping along under the active word.
    function speak() {
      let t = 0;
      qWords.forEach((w, i) => {
        const len = w.textContent.length;
        later(() => {
          if (i) { qWords[i - 1].classList.remove('is-on'); qWords[i - 1].classList.add('was-on'); }
          w.style.opacity = '1'; w.classList.add('is-on');
          IH.emit('voice', { who: 'them', level: 0.35 + Math.min(0.4, len / 20), ms: 200 });
        }, t);
        t += 150 + len * 22;
      });
      later(() => {
        const lastW = qWords[qWords.length - 1];
        lastW.classList.remove('is-on'); lastW.classList.add('was-on');
        IH.emit('turn', { who: 'them' });
      }, t + 80);
      return t + 80;
    }
    // The answer: word by word from 0.4em below, 40 ms apart, 520 ms each (ih.settle).
    function surface(ws, at) {
      later(() => IH.emit('turn', { who: 'me' }), at);
      ws.forEach((w, i) => {
        later(() => {
          IH.emit('voice', { who: 'me', level: 0.3, ms: 140 });
          play('word');
        }, at + 120 + i * 40);
      });
      if (hasGsap) gsap.to(ws, { opacity: 1, y: 0, duration: 0.52, ease: IH.ease.settle, stagger: 0.04, delay: (at + 120) / 1000 });
      later(() => { played = true; call.classList.remove('is-armed'); gsap.set(ws, { clearProps: 'opacity,transform' }); }, at + 120 + ws.length * 40 + 560);
    }
    function run() {
      if (played) return;
      if (!ok() || !hasGsap) { finish(); return; }
      played = true;
      gsap.set(aWords[lang], { opacity: 0, y: '0.4em' });
      call.classList.remove('is-armed');
      qWords.forEach(w => { w.style.opacity = '.18'; });
      const landed = speak();
      surface(aWords[lang], landed + 520);
      later(() => qWords.forEach(w => { w.style.opacity = ''; w.classList.remove('was-on'); }), landed + 900);
    }

    // English ⇄ 中文: the old line sinks and fades word by word while the new one rises in.
    function setLang(next) {
      if (next === lang) return;
      const from = vers[lang], to = vers[next], fw = aWords[lang], tw = aWords[next];
      lang = next;
      btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.evLang === next)));
      if (!played) finish();
      busy?.kill?.();
      to.removeAttribute('data-off'); to.removeAttribute('aria-hidden');
      from.setAttribute('aria-hidden', 'true');
      if (!ok() || !hasGsap) {
        from.setAttribute('data-off', '');
        if (hasGsap) gsap.set([...fw, ...tw], { clearProps: 'opacity,transform' });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: IH.ease.change }, onComplete: () => { from.setAttribute('data-off', ''); gsap.set([...fw, ...tw], { clearProps: 'opacity,transform' }); busy = null; } });
      const outEach = Math.min(0.03, 0.18 / fw.length), inEach = Math.min(0.035, 0.2 / tw.length);
      tl.to(fw, { opacity: 0, y: '0.35em', duration: 0.26, stagger: outEach }, 0)
        .fromTo(tw, { opacity: 0, y: '-0.35em' }, { opacity: 1, y: 0, duration: 0.34, stagger: inEach }, 0.14);
      busy = tl;
      play('type');
    }
    btns.forEach(b => b.addEventListener('click', () => setLang(b.dataset.evLang)));
    // Arrow keys move between the two options, as in a segmented control.
    call.querySelector('.ev-seg')?.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const i = btns.indexOf(document.activeElement), n = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length];
      n.focus(); setLang(n.dataset.evLang);
    });

    if (hasGsap && ok() && 'IntersectionObserver' in window) {
      call.classList.add('is-armed');
      const io = new IntersectionObserver(es => {
        for (const e of es) if (e.isIntersecting) { io.disconnect(); run(); }
      }, { rootMargin: '0px 0px -38% 0px', threshold: 0 });
      io.observe($('[data-ev-stage]', call));
      IH.on('motion', m => { if (!m && !played) { io.disconnect(); finish(); } });
    } else finish();
    IH.on('motion', m => { if (!m && played) { clear(); busy?.progress?.(1); finish(); } });
  }

  /* =============================== 21:40 · the notes =============================== */
  const notes = $('[data-ev-notes]');
  if (notes) {
    const vignette = $('[data-ev-vignette]', notes);
    const raws = $$('[data-ev-raw]', notes);
    const items = $$('[data-ev-item]', notes);
    const olds = $$('[data-ev-old]', notes), news = $$('[data-ev-new]', notes);
    const dates = $$('[data-ev-date]', notes), tags = $$('[data-ev-tag]', notes);
    const foot = $('[data-ev-foot]', notes), bank = $('.ev-bank', notes);
    const sign = $('.ev-sign', notes);
    const strokes = sign ? $$('path', sign) : [];

    // Back to the moment: following a timestamp lights its transcript line for a moment (the link still works).
    $$('[data-ev-ts]', notes).forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1), line = document.getElementById(id);
      if (!line) return;
      e.preventDefault();
      // The transcript usually sits right beside the note; scroll only when the line is off screen.
      const r = line.getBoundingClientRect();
      if (r.top < 72 || r.bottom > innerHeight - 24) IH.scrollTo(line, { offset: -innerHeight * 0.35 });
      line.focus({ preventScroll: true });
      $$('.ev-raw__line.is-hit', notes).forEach(l => l.classList.remove('is-hit'));
      line.classList.add('is-hit');
      setTimeout(() => line.classList.remove('is-hit'), 2400);
    }));

    if (!hasGsap || !window.ScrollTrigger) return;
    const mm = gsap.matchMedia();
    mm.add({ big: '(min-width: 820px) and (min-height: 640px)', motion: '(prefers-reduced-motion: no-preference)' }, ctx => {
      const { big, motion } = ctx.conditions;
      if (!motion) return;
      // Which transcript line feeds which note item (by data-ev-raw → data-ev-item).
      const feed = n => raws.filter(r => r.dataset.evRaw === String(n));
      const tl = gsap.timeline({ paused: true, defaults: { ease: IH.ease.settle } });
      // Raw lines start a little brighter (being read), then dim as their item settles on the sheet.
      tl.from($('[data-ev-sheet]', notes), { opacity: 0, y: 28, duration: 0.6 }, 0);
      items.forEach((it, i) => {
        const at = 0.35 + i * 0.55;
        tl.fromTo(feed(i + 1), { color: 'var(--ink-2)' }, { color: 'var(--muted)', duration: 0.5 }, at)
          .from(it, { opacity: 0, x: -36, duration: 0.6 }, at + 0.05)
          .from($('.ev-ts', it), { opacity: 0, x: -10, duration: 0.4 }, at + 0.2);
      });
      // The fix: strike the misheard word in amber, then the indigo word arrives.
      const fixAt = 0.35 + 1 * 0.55 + 0.45;
      tl.fromTo(olds, { '--strike': 0 }, { '--strike': 1, duration: 0.4, ease: IH.ease.change }, fixAt)
        .from(news, { opacity: 0, y: '0.3em', duration: 0.45 }, fixAt + 0.32);
      // The date: resolved, then tagged; the weak answer gets its question-bank tag.
      const dateAt = 0.35 + 3 * 0.55 + 0.4;
      tl.from(dates, { opacity: 0, y: '0.3em', duration: 0.45 }, dateAt)
        .from(tags, { opacity: 0, scale: 0.85, duration: 0.4, stagger: 0.3, ease: IH.ease.spring }, dateAt + 0.2)
        .from(bank, { opacity: 0, y: 12, duration: 0.5 }, dateAt + 0.75);
      // Signed: the lettering writes itself, stroke by stroke (DrawSVG when the real alphabet is in).
      if (sign) {
        if (strokes.length && window.DrawSVGPlugin) {
          let t = dateAt + 1.05;
          strokes.forEach(p => {
            const len = p.getTotalLength?.() || 100;
            const d = Math.max(0.12, Math.min(0.9, len / 1500));
            tl.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: d, ease: IH.ease.change }, t);
            t += d * 0.92;
          });
        } else tl.from(sign, { opacity: 0, x: -12, duration: 0.5 }, dateAt + 1.05);
      }
      let st;
      if (big) {
        // Assembled by the time the sheet sits in the middle of the screen, so it is read finished.
        st = ScrollTrigger.create({ trigger: vignette, start: 'top 78%', end: 'center 52%', scrub: 0.8, animation: tl });
      } else {
        // Phones: plays once on entering, at its own pace (about three seconds), never waiting on the reader.
        tl.timeScale(1.6);
        st = ScrollTrigger.create({ trigger: vignette, start: 'top 70%', once: true, onEnter: () => tl.play() });
      }
      const stopIfPaused = m => { if (!m) { tl.progress(1); st.kill(); } };
      const off = IH.on('motion', stopIfPaused);
      if (!ok()) stopIfPaused(false);
      return () => { off(); st?.kill(); tl.revert(); };
    });
  }
})();
