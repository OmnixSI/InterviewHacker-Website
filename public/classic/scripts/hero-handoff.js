/* Keep one opaque device identity through the opening 0 → 50vh handoff. */
(() => {
  const root = document.documentElement;
  const anchor = document.querySelector('.ih-hero-device');
  const target = document.querySelector('.ih-hero-target');
  const device = target?.querySelector('.ih-hero-device-single');
  const image = device?.querySelector('picture:not(.intro-video__tablet__image) img');
  const measure = document.querySelector('#intro-top .intro-video');
  const copy = document.querySelector('#intro-top .intro__content');
  const $ = window.jQuery;
  if (!anchor || !target || !device || !measure || !$?.fn.pageOffset) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const phone = matchMedia('(max-width: 567px)');
  const landscape = matchMedia('(max-width: 979px) and (max-height: 415px) and (orientation: landscape)');
  // The reference engine freezes reduced-motion eligibility at construction.
  // An initially reduced visit stays readable/static until a fresh navigation.
  const startedReduced = reduced.matches;
  let geometry;
  let frame = 0;
  let needsMeasure = true;
  let lastTransform = '';
  let lastCopyOpacity = '';
  const clamp = n => Math.max(0, Math.min(1, n));
  // C2-continuous ends meet the existing lateral stage with no velocity jump.
  const settle = t => t * t * t * (t * (t * 6 - 15) + 10);

  function readGeometry() {
    const start = $(anchor).pageOffset();
    const end = $(target).pageOffset();
    const section = $(measure).pageOffset();
    const matrix = new DOMMatrixReadOnly(getComputedStyle(target).transform);
    const width = end.width;
    if (!width || !start.width) return;
    geometry = {
      x: start.left - (end.left - matrix.m41),
      y: start.top - (end.top - matrix.m42),
      scale: start.width / width,
      top: section.top,
      distance: Math.max(1, section.height * .5)
    };
  }

  function draw() {
    frame = 0;
    if (document.hidden) return;
    const isStatic = startedReduced || reduced.matches || phone.matches || landscape.matches;
    root.classList.toggle('ih-hero-handoff-static', isStatic);
    if (isStatic) {
      device.style.removeProperty('transform');
      copy?.style.removeProperty('opacity');
      lastTransform = '';
      lastCopyOpacity = '';
      root.classList.add('ih-hero-handoff-ready');
      return;
    }
    if (needsMeasure || !geometry) {
      readGeometry();
      needsMeasure = false;
    }
    if (!geometry) return;
    const progress = clamp(($(window).scrollTop() - geometry.top) / geometry.distance);
    // Copy and hardware share the viewport clock, not the copy's text height.
    const copyProgress = clamp(progress / .85);
    const copyOpacity = (1 - copyProgress * copyProgress * (3 - 2 * copyProgress)).toFixed(4);
    if (copy && copyOpacity !== lastCopyOpacity) {
      copy.style.opacity = copyOpacity;
      lastCopyOpacity = copyOpacity;
    }
    const eased = settle(progress);
    const inverse = 1 - eased;
    const scale = geometry.scale + (1 - geometry.scale) * eased;
    const transform = `translate3d(${(geometry.x * inverse).toFixed(3)}px, ${(geometry.y * inverse).toFixed(3)}px, 0) scale(${scale.toFixed(6)})`;
    if (transform !== lastTransform) {
      device.style.transform = transform;
      lastTransform = transform;
    }
    if (image?.complete && image.naturalWidth) root.classList.add('ih-hero-handoff-ready');
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
  function refresh() { needsMeasure = true; schedule(); }

  // The existing smooth scroller owns desktop easing; native touch stays native.
  $('.js-page-content-wrapper').on('scroll.ihHeroHandoff', schedule);
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', refresh, {passive: true});
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', refresh);
  document.fonts?.ready.then(refresh);
  document.fonts?.addEventListener('loadingdone', refresh);
  reduced.addEventListener('change', refresh);
  phone.addEventListener('change', refresh);
  landscape.addEventListener('change', refresh);
  if ('ResizeObserver' in window) {
    const sizes = new ResizeObserver(refresh);
    sizes.observe(anchor);
    sizes.observe(target);
    sizes.observe(measure);
  }
  target.addEventListener('load', refresh, true);
  schedule();
})();
