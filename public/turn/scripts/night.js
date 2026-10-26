// Turn — night: № 03 Privacy (22:30), № 04 FAQ (23:10) and the ending's arrival (23:59).
// Everything here is an enhancement: the markup reads complete with no script, and with reduced or paused motion
// nothing moves (states simply change). Entrances run once, as the reader reaches them, and never hold up reading.
(() => {
  const IH = window.IH;
  if (!IH) return;
  const gsap = window.gsap;
  const hasDraw = !!(gsap && window.DrawSVGPlugin);
  const play = (name, opts) => IH.sound?.play?.(name, opts);
  const settle = gsap ? IH.ease.settle : null;

  /* ---------- Once, when it arrives ---------- */
  // Calls fn(el) the first time el is well inside the viewport. Elements already on screen at start run at once.
  function arrive(el, fn, { margin = '0px 0px -18% 0px', threshold = 0 } = {}) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(el); return; }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { io.disconnect(); fn(el); }
    }, { rootMargin: margin, threshold });
    io.observe(el);
  }
  // Is el below the fold right now? Only those get a pre-entrance state, so nothing visible ever blinks out.
  const below = el => el.getBoundingClientRect().top > innerHeight * 0.92;

  /* ---------- Headlines: lines rise from their own clip (the site's Reveal) ---------- */
  function reveal(title, { delay = 0, onStart } = {}) {
    const lines = [...title.querySelectorAll('.rl > span')];
    if (!gsap || !lines.length || !IH.motionOK() || !below(title)) { onStart?.(false); return; }
    title.classList.add('is-revealing');
    gsap.set(lines, { yPercent: 108 });
    arrive(title, () => {
      onStart?.(true);
      gsap.to(lines, {
        yPercent: 0, duration: 0.72, ease: settle, stagger: 0.07, delay,
        onComplete: () => { title.classList.remove('is-revealing'); gsap.set(lines, { clearProps: 'transform' }); }
      });
    });
  }

  /* ---------- № 03 Privacy ---------- */
  const privacy = document.getElementById('privacy');
  if (privacy) {
    const title = privacy.querySelector('[data-night-title]');
    if (title) reveal(title);

    // The drawing: the Mac's outline, then the two voices arrive from the left, settle, and stay on as words.
    const fig = privacy.querySelector('[data-privacy-figure]');
    if (fig && hasDraw && IH.motionOK() && below(fig)) {
      const q = s => [...fig.querySelectorAll(s)];
      const mac = q('.pf-mac'), voices = q('.pf-voice'), words = q('.pf-word--them, .pf-word--me'), notes = q('.pf-word--note'), cam = q('.pf-cam');
      gsap.set([...mac, ...voices, ...words, ...notes], { drawSVG: '0%' });
      gsap.set(cam, { opacity: 0 });
      arrive(fig, () => {
        const tl = gsap.timeline({ defaults: { ease: IH.ease.change } });
        tl.to(mac, { drawSVG: '100%', duration: 0.9, stagger: 0.12, ease: settle })
          .to(cam, { opacity: 0.4, duration: 0.3 }, 0.6)
          .to(voices, { drawSVG: '100%', duration: 1.05, stagger: 0.18, ease: 'power1.inOut', onStart: () => IH.emit('voice', { who: 'them', level: 0.35, ms: 600 }) }, 0.35)
          .to(words, { drawSVG: '100%', duration: 0.16, stagger: 0.07 }, 1.35)
          .to(notes, { drawSVG: '100%', duration: 0.22, stagger: 0.09, ease: settle }, 1.75);
      }, { margin: '0px 0px -24% 0px' });
    }

    // The principles settle in one after another, a small step each (opacity and 10px; nothing is hidden for long).
    const items = [...privacy.querySelectorAll('.principle, .privacy__fine')];
    if (gsap && items.length && IH.motionOK() && below(items[0])) {
      gsap.set(items, { opacity: 0, y: 10 });
      arrive(items[0], () => gsap.to(items, { opacity: 1, y: 0, duration: 0.52, ease: settle, stagger: 0.07, clearProps: 'transform,opacity' }));
    }
  }

  /* ---------- № 04 FAQ ---------- */
  const faq = document.getElementById('faq');
  if (faq) {
    const title = faq.querySelector('[data-night-title]');
    if (title) reveal(title);

    const rows = [...faq.querySelectorAll('details.qa')];
    // Browsers that can transition ::details-content to height:auto do it in CSS (night.css); others get this.
    const cssAnimates = CSS.supports?.('interpolate-size', 'allow-keywords') && CSS.supports?.('selector(::details-content)');
    for (const row of rows) {
      const summary = row.querySelector('summary');
      const body = row.querySelector('.qa__a');
      let anim = null;
      // Sound comes from sound.js (it hears every <details> toggle).
      summary.addEventListener('click', e => {
        const opening = !row.open || row.classList.contains('is-closing');
        if (cssAnimates || !IH.motionOK() || !body.animate) return; // native toggle
        e.preventDefault();
        const from = anim ? body.getBoundingClientRect().height : (row.open ? body.offsetHeight : 0);
        anim?.cancel();
        if (opening) {
          row.classList.remove('is-closing');
          row.open = true;
          const to = body.scrollHeight;
          anim = body.animate({ height: [`${from}px`, `${to}px`] }, { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' });
        } else {
          row.classList.add('is-closing');
          anim = body.animate({ height: [`${from}px`, '0px'] }, { duration: 380, easing: 'cubic-bezier(.65,0,.35,1)' });
        }
        body.style.overflow = 'hidden';
        const mine = anim;
        mine.onfinish = () => {
          if (anim !== mine) return;
          if (!opening) { row.open = false; row.classList.remove('is-closing'); }
          body.style.overflow = '';
          anim = null;
        };
      });
    }

    // Rows settle in after the heading.
    if (gsap && rows.length && IH.motionOK() && below(rows[0])) {
      gsap.set(rows, { opacity: 0, y: 12 });
      arrive(rows[0], () => gsap.to(rows, { opacity: 1, y: 0, duration: 0.52, ease: settle, stagger: 0.05, clearProps: 'transform,opacity' }));
    }
  }

  /* ---------- Ending: the headline arrives on the horizon, and "tomorrow." writes itself ---------- */
  const ending = document.getElementById('join');
  if (ending) {
    const title = ending.querySelector('[data-night-title]');
    const letter = ending.querySelector('[data-ending-letter] svg');
    const strokes = letter ? [...letter.querySelectorAll('path')] : [];
    const water = [...ending.querySelectorAll('.ending__sub, .ending__btn')];
    const canWrite = gsap && letter && IH.motionOK() && below(ending);

    if (canWrite) {
      if (strokes.length && hasDraw) gsap.set(strokes, { drawSVG: '0%' });
      else gsap.set(letter, { clipPath: 'inset(-20% 100% -20% -4%)' });
      gsap.set(water, { opacity: 0, y: 10 });
    }
    const write = () => {
      if (!canWrite) return;
      IH.emit('turn', { who: 'me' });
      const tl = gsap.timeline({ delay: 0.32 });
      if (strokes.length && hasDraw) {
        strokes.forEach((p, i) => {
          tl.to(p, { drawSVG: '100%', duration: 0.18 * Math.max(1, Math.min(2.4, (p.getTotalLength?.() || 60) / 60)), ease: IH.ease.change,
            onStart: () => IH.emit('voice', { who: 'me', level: 0.5, ms: 180 }) }, i ? '>-0.03' : 0);
        });
      } else {
        tl.to(letter, { clipPath: 'inset(-20% -4% -20% -4%)', duration: 1.1, ease: 'power2.inOut' });
      }
      tl.to(water, { opacity: 1, y: 0, duration: 0.52, ease: settle, stagger: 0.08, clearProps: 'transform,opacity' }, 0.1);
    };
    if (title) reveal(title, { onStart: write });
    else arrive(ending, write);

    // Any "Join the waitlist" link elsewhere on the page (header, hero, FAQ) means: go to midnight and open the form.
    const openBtn = ending.querySelector('[data-waitlist-open]');
    document.addEventListener('click', e => {
      const a = e.target.closest?.('a[href="#join"]');
      if (!a || ending.contains(a) || !openBtn || ending.classList.contains('is-joining')) return;
      let opened = false;
      const go = () => { if (!opened) { opened = true; openBtn.click(); } };
      if (!('IntersectionObserver' in window)) { setTimeout(go, 600); return; }
      const io = new IntersectionObserver(entries => {
        if (entries.some(en => en.intersectionRatio >= 0.6)) { io.disconnect(); setTimeout(go, IH.motionOK() ? 520 : 0); }
      }, { threshold: [0.6] });
      io.observe(ending);
      setTimeout(() => io.disconnect(), 6000);
    });
  }
})();
