/* One frame per scroll event. No perpetual animation loop or touch interception. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 567px)');
  const wide = matchMedia('(min-width: 980px)');
  const stage = document.querySelector('.ih-viewing-stage');
  const figures = stage ? [...stage.querySelectorAll('figure')] : [];
  let frame = 0;
  const clamp = value => Math.max(0, Math.min(1, value));
  const settle = t => t * t * t * (t * (t * 6 - 15) + 10);

  if ('IntersectionObserver' in window) {
    const sections = document.querySelectorAll('main > [data-scroll-section]');
    const visibility = new IntersectionObserver(entries => {
      for (const entry of entries) {
        entry.target.classList.toggle('ih-motion-active', entry.isIntersecting);
      }
    }, { rootMargin: '160px 0px' });
    sections.forEach(section => visibility.observe(section));
    document.documentElement.classList.add('ih-motion-visibility-ready');
  }

  function updateDevices() {
    frame = 0;
    if (!stage || document.hidden) return;
    const rect = stage.getBoundingClientRect();
    if (rect.bottom < -80 || rect.top > innerHeight + 80) return;
    const progress = clamp((innerHeight - rect.top) / (innerHeight + rect.height));
    const curve = progress * progress * (3 - 2 * progress);
    // Arrive below the copy, hold while it is readable, then depart after it leaves.
    const arrival = 1 - settle(clamp((innerHeight - rect.top) / (innerHeight * .6)));
    const departure = settle(clamp(-rect.top / (rect.height * .7)));
    figures.forEach((figure, i) => {
      const distance = reduced.matches ? 0 : (wide.matches ? (i ? 360 : 280) : narrow.matches ? 10 : 48);
      const direction = i ? -1 : 1;
      const travel = wide.matches ? (arrival - departure) * .5 : .5 - curve;
      figure.style.setProperty('--ih-device-y', `${(travel * distance).toFixed(2)}px`);
      figure.style.setProperty('--ih-device-x', `${(reduced.matches || !wide.matches ? 0 : travel * -140 * direction).toFixed(2)}px`);
      figure.style.setProperty('--ih-device-angle', `${(reduced.matches || narrow.matches ? 0 : travel * (wide.matches ? 16 : 3) * direction).toFixed(3)}deg`);
      figure.style.setProperty('--ih-device-scale', (reduced.matches || !wide.matches ? 1 : 1 - travel * travel * .24).toFixed(4));
    });
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(updateDevices);
  }
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule, {passive: true});
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', schedule);
  // The desktop reference scroller emits jQuery events on its content wrapper.
  window.jQuery?.('.js-page-content-wrapper').on('scroll.ihMotion', schedule);
  const arrivals = [...document.querySelectorAll('.intro__title, .intro__content > .row, .ih-viewing-heading, .ih-viewing-stage figure, .ih-privacy-device, .ih-scene-card')];
  const animated = new Set();
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !entry.target.getBoundingClientRect().height) continue;
      observer.unobserve(entry.target);
      if (reduced.matches) continue;
      entry.target.classList.add('ih-arriving');
      animated.add(entry.target);
    }
  }, {threshold: .12}) : null;
  arrivals.forEach(element => {
    const delay = element.matches('.intro__content > .row') ? 80 : figures.includes(element) ? figures.indexOf(element) * 90 : 0;
    element.style.setProperty('--ih-arrival-delay', `${delay}ms`);
    observer?.observe(element);
    element.addEventListener('animationend', () => {
      element.classList.remove('ih-arriving');
      animated.delete(element);
    }, {once: true});
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      for (const element of animated) element.classList.remove('ih-arriving');
      animated.clear();
    }
    schedule();
  });

  const rail = document.querySelector('#stories .mobile-scrollable');
  const buttons = [...document.querySelectorAll('[data-scene-index]')];
  if (rail && buttons.length) {
    const cards = [...rail.children];
    let railFrame = 0;
    function syncCurrent() {
      railFrame = 0;
      const start = rail.getBoundingClientRect().left + parseFloat(getComputedStyle(rail).paddingLeft || 0);
      const distances = cards.map(card => Math.abs(card.getBoundingClientRect().left - start));
      const current = distances.indexOf(Math.min(...distances));
      buttons.forEach((button, index) => {
        if (index === current) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
    }
    rail.addEventListener('scroll', () => {
      if (!railFrame) railFrame = requestAnimationFrame(syncCurrent);
    }, {passive: true});
    window.addEventListener('resize', syncCurrent, {passive: true});
    buttons.forEach((button, i) => button.addEventListener('click', () => {
      const current = rail.getBoundingClientRect();
      const card = cards[i].getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(rail).paddingLeft || 0);
      rail.scrollTo({left: rail.scrollLeft + card.left - current.left - padding, behavior: reduced.matches ? 'auto' : 'smooth'});
    }));
    syncCurrent();
  }
  document.fonts?.ready.then(schedule);
  schedule();
})();
