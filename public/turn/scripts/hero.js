// Turn — hero (08:59). Owned by the hero module.
// Entrance (≤ 1.3 s; content is complete without it): the kicker fades, the headline phrases rise from their clipped
// line boxes, and the word for "a blink" arrives as a grey first-pass draft with one letter misheard, which is struck
// in amber and corrected in place (the product's two-pass recognition, in one word). Then "your turn." writes itself
// stroke by stroke, the curl draws into the gap between the strings, and the labels fade in last.
// A repeat visit in the same tab gets a 300 ms fade instead. On scroll the copy drifts up a little slower than the page.
(() => {
  const IH = window.IH;
  const hero = document.querySelector('[data-hero]');
  if (!IH || !hero) return;
  const $ = (s, el = hero) => el.querySelector(s);
  const $$ = (s, el = hero) => [...el.querySelectorAll(s)];
  const hasGsap = typeof window.gsap !== 'undefined';
  const canDraw = hasGsap && !!window.DrawSVGPlugin;

  const kicker = $('.hero__kicker');
  const lines = $$('.hero__in');
  const word = $('.hero__word');
  const letter = $('.hero__letter');
  const arrow = $('.hero__arrow');
  const marks = $$('[data-mark]');
  const foot = $$('.hero__foot [data-enter]');
  const hint = $('.hero__hint');
  const strokes = svg => (svg ? [...svg.querySelectorAll('path')] : []);

  /* ---------- Draft word: wrap only the characters the first pass got wrong ---------- */
  let wrong = [];
  function buildDraft() {
    if (!word || !word.dataset.draft) return;
    const fin = [...word.textContent], draft = [...word.dataset.draft];
    if (fin.length !== draft.length) return;
    word.textContent = '';
    let run = '';
    fin.forEach((ch, i) => {
      if (ch === draft[i]) { run += ch; return; }
      if (run) { word.append(run); run = ''; }
      const cell = document.createElement('span');
      cell.className = 'hw';
      const f = document.createElement('span'); f.className = 'hw__f'; f.textContent = ch;
      const d = document.createElement('span'); d.className = 'hw__d'; d.textContent = draft[i]; d.setAttribute('aria-hidden', 'true');
      cell.append(f, d);
      word.append(cell);
      wrong.push(cell);
    });
    if (run) word.append(run);
    // Start as the draft: the misheard glyph shows, the final one waits (the real text stays in the DOM).
    word.classList.add('is-draft');
    gsap.set(wrong.map(c => c.firstChild), { opacity: 0 });
  }

  /* ---------- Entrance ---------- */
  function pen(svg, total) {
    const paths = strokes(svg);
    const tl = gsap.timeline();
    if (!paths.length) { if (svg) tl.from(svg, { opacity: 0, duration: total, ease: 'power1.out' }); return tl; }
    if (!canDraw) { tl.from(paths, { opacity: 0, duration: .3, stagger: total / paths.length, ease: 'power1.out' }); return tl; }
    const lens = paths.map(p => { try { return p.getTotalLength(); } catch (e) { return 1; } });
    const sum = lens.reduce((a, b) => a + b, 0) || 1;
    // Each stroke gets its share of the time by length, with a floor so dots and bars still read as strokes.
    let t = 0;
    paths.forEach((p, i) => {
      const d = Math.max(.07, total * lens[i] / sum);
      tl.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: d, ease: i === 0 ? 'power1.in' : 'none' }, t);
      t += d + .02;
    });
    return tl;
  }

  function entrance() {
    if (!hasGsap || !IH.motionOK()) return null;
    const ease = IH.ease.settle;
    if (IH.firstVisit === false) {
      // Repeat visit: everything is already known; a short settle only.
      return gsap.timeline()
        .from([kicker, ...lines, ...foot], { opacity: 0, y: 8, duration: .3, ease, stagger: .02 }, 0)
        .from([letter, arrow, ...marks], { opacity: 0, duration: .3, ease }, 0);
    }
    buildDraft();
    const tl = gsap.timeline({ delay: .05 });
    tl.from(kicker, { opacity: 0, y: 6, duration: .5, ease }, 0)
      .from(lines, { yPercent: 108, duration: .72, ease, stagger: .07 }, .06)
      .from(foot, { opacity: 0, y: 10, duration: .6, ease, stagger: .06 }, .3);
    if (wrong.length) {
      const F = wrong.map(c => c.firstChild), D = wrong.map(c => c.lastChild);
      tl.to(wrong, { '--strike': 1, duration: .16, ease: IH.ease.change }, .5)
        .to(D, { opacity: 0, yPercent: -30, duration: .22, ease: IH.ease.change }, .66)
        .fromTo(F, { opacity: 0, yPercent: 30 }, { opacity: 1, yPercent: 0, duration: .4, ease }, .7)
        .to(wrong, { '--strike': 0, duration: .01 }, .72)
        .call(() => word.classList.remove('is-draft'), null, .72);
    }
    // "your turn." — a turn starts: the indigo string answers.
    tl.call(() => IH.emit('turn', { who: 'me' }), null, .7)
      .add(pen(letter, .46), .7)
      .add(pen(arrow, .2), 1.04)
      .from(marks, { opacity: 0, x: -4, duration: .3, ease, stagger: .04 }, 1.0);
    return tl;
  }

  /* ---------- Scroll drift: the copy lags the page a little and fades ---------- */
  let drift = null;
  function setDrift(on) {
    if (!hasGsap || !window.ScrollTrigger) return;
    if (on && !drift) {
      const els = $$('[data-hero-drift]');
      drift = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: .6 } })
        .to(els[0], { y: () => innerHeight * .14, opacity: .15, ease: 'none' }, 0)
        .to(els[1], { y: () => innerHeight * .06, opacity: .4, ease: 'none' }, 0);
    } else if (!on && drift) {
      drift.scrollTrigger.kill(); drift.kill(); drift = null;
      gsap.set($$('[data-hero-drift]'), { clearProps: 'transform,opacity' });
    }
  }

  /* ---------- Pointer hint ---------- */
  function hintLater() {
    if (!hint) return;
    const show = () => { if (scrollY < innerHeight * .3) hint.classList.add('is-shown'); };
    setTimeout(show, IH.firstVisit === false ? 400 : 1500);
    const done = () => { if (hint.classList.contains('is-shown')) hint.classList.add('is-done'); };
    IH.on('pluck', done);
    IH.on('tick', s => { if (s.y > innerHeight * .4) done(); });
  }

  // The clock reads 08:59 for the whole first screen, not halfway to the next anchor.
  IH.anchorAt(hero, () => 0);
  const tl = entrance();
  // Anything that takes the reader elsewhere finishes the entrance at once.
  if (tl) {
    const skip = () => { if (tl.progress() < 1) tl.progress(1); off(); };
    const off = () => ['wheel', 'touchmove', 'keydown'].forEach(t => removeEventListener(t, skip));
    ['wheel', 'touchmove', 'keydown'].forEach(t => addEventListener(t, skip, { passive: true }));
    tl.eventCallback('onComplete', off);
  }
  const wide = matchMedia('(min-width: 820px)');
  const syncDrift = () => setDrift(IH.motionOK() && wide.matches);
  syncDrift();
  wide.addEventListener?.('change', syncDrift);
  IH.on('motion', syncDrift);
  hintLater();
})();
