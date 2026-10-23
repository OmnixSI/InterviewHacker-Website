/* Scroll-driven version of the Story page's six-step pipeline. */
(() => {
  const root = document.querySelector('#workflow.pipeline');
  if (!root) return;

  const pin = root.querySelector('.pipeline__pin');
  const track = root.querySelector('[data-pipe-track]');
  const viewport = root.querySelector('[data-pipe-viewport]');
  const wire = root.querySelector('[data-pipe-wire]');
  const line = root.querySelector('[data-pipe-line]');
  const glow = root.querySelector('[data-pipe-glow]');
  const pulse = root.querySelector('[data-pipe-pulse]');
  const header = document.querySelector('.header--sticky');
  const railContainer = root.querySelector('.pipe-rail');
  const sparks = [...root.querySelectorAll('[data-pipe-spark]')];
  const stations = [...root.querySelectorAll('[data-station]')];
  const rail = [...root.querySelectorAll('[data-pipe-rail] li')];
  const fill = root.querySelector('[data-pipe-fill]');
  const count = root.querySelector('[data-pipe-index]');
  const ghost = root.querySelector('[data-pipe-ghost]');
  const payload = root.querySelector('[data-pipe-payload]');
  const wrapper = document.querySelector('.js-page-content-wrapper');
  const $ = window.jQuery;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stackLayout = window.matchMedia('(max-width: 900px), (max-height: 640px)');
  const CONFIG = {
    scrollDistanceMultiplier: 1.2,
    visibilityPadding: 160,
    pathSamples: 180,
    payloadFadeAt: .98,
    scrambleDuration: 520,
    scrambleInterval: 32,
    sparkOffsets: [.22, .46, .70, .95]
  };
  const names = stations.map(station => station.querySelector('h3')?.textContent.trim() || '');
  const path = line;
  let geometry = null;
  let pathLength = 0;
  let pathSamples = [];
  let activeIndex = -1;
  let frame = 0;
  let measureFrame = 0;
  let scrambleTimer = 0;
  let observer = null;
  let observedStacked = false;
  let lastTrackTransform = '';
  let lastWireTransform = '';
  let lastFillTransform = '';
  let lastPinOffset = '';
  let headerHeight = 0;
  let lastProgress = -1;

  const clamp = value => Math.max(0, Math.min(1, value));

  function readScrollPosition() {
    const instance = root.closest('.js-page-content-wrapper')?.scroller?.scroll?.instance;
    const current = instance?.scroll?.y;
    return Number.isFinite(current) ? current : window.scrollY;
  }

  function readHeaderOffset() {
    const translate = header?.style.transform.match(/translateY\(\s*(-?[\d.]+)px\s*\)/);
    if (!translate || !headerHeight) return 0;
    return Math.max(0, Math.min(headerHeight, headerHeight + Number(translate[1])));
  }

  function getLayoutTop(element) {
    let top = 0;
    let node = element;
    while (node) {
      top += node.offsetTop;
      node = node.offsetParent;
    }
    return top;
  }

  function samplePath() {
    pathSamples = [];
    pathLength = 0;
    if (!path || !wire || stackLayout.matches || reduceMotion.matches) return;

    try {
      pathLength = path.getTotalLength();
      if (!pathLength) return;
      for (let i = 0; i <= CONFIG.pathSamples; i++) {
        const point = path.getPointAtLength(pathLength * i / CONFIG.pathSamples);
        pathSamples.push({ x: point.x, y: point.y });
      }
    } catch {
      pathLength = 0;
      pathSamples = [];
    }
  }

  function pointOnPath(progress) {
    if (!pathSamples.length) return { x: 20, y: 190 };
    const location = clamp(progress) * (pathSamples.length - 1);
    const index = Math.min(pathSamples.length - 2, Math.floor(location));
    const fraction = location - index;
    const first = pathSamples[index];
    const second = pathSamples[index + 1];
    return {
      x: first.x + (second.x - first.x) * fraction,
      y: first.y + (second.y - first.y) * fraction
    };
  }

  function runScramble(index) {
    const target = stations[index]?.querySelector('[data-scramble]');
    if (!target || reduceMotion.matches) return;
    clearInterval(scrambleTimer);

    const text = target.dataset.scramble || target.textContent;
    const alphabet = '采访缓存问题链路识别资料回答参考上下文!<>+-*/?';
    const start = performance.now();
    scrambleTimer = setInterval(() => {
      const progress = clamp((performance.now() - start) / CONFIG.scrambleDuration);
      const locked = Math.floor(progress * text.length);
      let value = '';
      for (let i = 0; i < text.length; i++) {
        value += i < locked || text[i] === ' ' ? text[i] : alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      target.textContent = progress >= 1 ? text : value;
      if (progress >= 1) clearInterval(scrambleTimer);
    }, CONFIG.scrambleInterval);
  }

  function setActive(index, stacked) {
    if (!stations.length) return;
    const nextIndex = Math.max(0, Math.min(stations.length - 1, index));
    if (activeIndex === nextIndex) return;
    const changedFrom = activeIndex;
    activeIndex = nextIndex;

    stations.forEach((station, i) => {
      station.classList.toggle('is-lit', stacked || i <= nextIndex);
      station.classList.toggle('is-current', i === nextIndex);
    });
    rail.forEach((item, i) => {
      item.classList.toggle('is-done', i < nextIndex);
      item.classList.toggle('is-current', i === nextIndex);
    });
    if (count) count.textContent = String(nextIndex + 1).padStart(2, '0');
    if (ghost) ghost.textContent = names[nextIndex] || '';

    if (changedFrom !== -1) runScramble(nextIndex);
  }

  function setStackObserver(stacked) {
    if (observedStacked === stacked) return;
    observedStacked = stacked;
    observer?.disconnect();
    observer = null;
    if (!stacked || reduceMotion.matches || !('IntersectionObserver' in window)) return;

    observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
      if (!visible) return;
      const index = stations.indexOf(visible.target);
      if (index < 0) return;
      setActive(index, true);
      root.style.setProperty('--workflow-progress', String((index + 1) / stations.length));
    }, { rootMargin: '-35% 0px -35% 0px', threshold: [0, .2, .5, .75, 1] });
    stations.forEach(station => observer.observe(station));
  }

  function measure() {
    measureFrame = 0;
    headerHeight = header?.offsetHeight || 0;
    root.style.setProperty('--workflow-header-height', `${headerHeight}px`);
    const stacked = stackLayout.matches || reduceMotion.matches;
    root.classList.toggle('is-pipeline-stacked', stacked);
    setStackObserver(stacked);

    if (stacked) {
      root.style.removeProperty('--workflow-scroll-distance');
      root.style.setProperty('--workflow-progress', '1');
      pin.style.removeProperty('--workflow-pin-offset');
      lastPinOffset = '';
      viewport.style.transform = '';
      railContainer.style.transform = '';
      track.style.transform = '';
      wire.style.transform = '';
      if (payload) {
        payload.style.opacity = '0';
        payload.style.visibility = 'hidden';
      }
      stations.forEach(station => station.classList.add('is-lit'));
      if (activeIndex < 0) setActive(0, true);
      geometry = { top: getLayoutTop(root), distance: 0, maxTranslate: 0, viewportWidth: viewport.clientWidth };
      scheduleDraw();
      return;
    }

    const maxTranslate = Math.max(0, track.scrollWidth - viewport.clientWidth);
    const distance = maxTranslate * CONFIG.scrollDistanceMultiplier;
    root.style.setProperty('--workflow-scroll-distance', `${distance}px`);
    geometry = {
      top: getLayoutTop(root),
      distance,
      maxTranslate,
      viewportWidth: viewport.clientWidth,
      viewportHeight: innerHeight
    };
    samplePath();
    lastProgress = -1;
    if (payload) {
      payload.style.visibility = '';
      payload.style.opacity = '';
    }
    scheduleDraw();
  }

  function scheduleMeasure() {
    if (measureFrame) return;
    measureFrame = requestAnimationFrame(measure);
  }

  function draw() {
    frame = 0;
    if (!geometry || stackLayout.matches || reduceMotion.matches || document.hidden) return;

    const position = readScrollPosition();
    const nearStart = position + geometry.viewportHeight + CONFIG.visibilityPadding >= geometry.top;
    const nearEnd = position - CONFIG.visibilityPadding <= geometry.top + geometry.distance + geometry.viewportHeight;
    if ((!nearStart || !nearEnd) && lastProgress >= 0) return;
    const progress = geometry.distance > 0 ? clamp((position - geometry.top) / geometry.distance) : 0;
    const headerOffset = readHeaderOffset();
    const pinOffset = Math.min(geometry.distance, Math.max(0, position - geometry.top)) + headerOffset;
    const pinOffsetStyle = `${pinOffset.toFixed(3)}px`;
    if (pinOffsetStyle !== lastPinOffset) {
      pin.style.setProperty('--workflow-pin-offset', pinOffsetStyle);
      lastPinOffset = pinOffsetStyle;
    }
    const translateX = -geometry.maxTranslate * progress;
    const trackTransform = `translate3d(${translateX.toFixed(3)}px, 0, 0)`;
    if (trackTransform !== lastTrackTransform) {
      track.style.transform = trackTransform;
      lastTrackTransform = trackTransform;
    }
    if (wire) {
      const wireTransform = `translate3d(${translateX.toFixed(3)}px, 0, 0)`;
      if (wireTransform !== lastWireTransform) {
        wire.style.transform = wireTransform;
        lastWireTransform = wireTransform;
      }
    }

    if (progress === lastProgress) return;
    const index = Math.min(stations.length - 1, Math.floor(progress * stations.length));
    setActive(index, false);
    if (fill) {
      const fillTransform = `scaleX(${progress.toFixed(4)})`;
      if (fillTransform !== lastFillTransform) {
        fill.style.transform = fillTransform;
        lastFillTransform = fillTransform;
      }
    }

    if (pathLength && line && glow && pulse) {
      const drawnLength = pathLength * progress;
      const dash = `${drawnLength.toFixed(2)}px ${(pathLength - drawnLength).toFixed(2)}px`;
      line.style.strokeDasharray = dash;
      glow.style.strokeDasharray = dash;
      const point = pointOnPath(progress);
      pulse.setAttribute('cx', point.x.toFixed(2));
      pulse.setAttribute('cy', point.y.toFixed(2));

      sparks.forEach((spark, i) => {
        const sparkPoint = pointOnPath((progress + CONFIG.sparkOffsets[i % CONFIG.sparkOffsets.length]) % 1);
        spark.setAttribute('cx', sparkPoint.x.toFixed(2));
        spark.setAttribute('cy', sparkPoint.y.toFixed(2));
      });

      if (payload) {
        const x = point.x + translateX;
        payload.style.transform = `translate3d(${x.toFixed(2)}px, ${point.y.toFixed(2)}px, 0) scale(.85)`;
        const visible = progress < CONFIG.payloadFadeAt && x > -150 && x < geometry.viewportWidth + 140;
        payload.style.opacity = visible ? '1' : '0';
        payload.style.visibility = visible ? 'visible' : 'hidden';
      }
    }

    if (progress !== lastProgress) {
      root.style.setProperty('--workflow-progress', progress.toFixed(4));
      lastProgress = progress;
    }
  }

  function scheduleDraw() {
    if (frame) return;
    frame = requestAnimationFrame(draw);
  }

  function drawWithScroller() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    draw();
  }

  window.addEventListener('scroll', scheduleDraw, { passive: true });
  window.addEventListener('resize', scheduleMeasure, { passive: true });
  window.addEventListener('pageshow', scheduleMeasure);
  document.addEventListener('visibilitychange', scheduleDraw);
  if ($ && wrapper) $(wrapper).on('scroll.ihPipeline', drawWithScroller);
  reduceMotion.addEventListener('change', scheduleMeasure);
  stackLayout.addEventListener('change', scheduleMeasure);
  document.fonts?.ready.then(scheduleMeasure);

  if ('ResizeObserver' in window) {
    const sizes = new ResizeObserver(scheduleMeasure);
    sizes.observe(track);
    sizes.observe(viewport);
    if (header) sizes.observe(header);
  }

  scheduleMeasure();
})();
