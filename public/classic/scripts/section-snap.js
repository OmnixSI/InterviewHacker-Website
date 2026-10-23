/* Settle the existing page scroller near real section starts. */
(() => {
  const CONFIG = {
    sectionSelector: '.js-page-content > main > [data-scroll-section][data-scroll-section-id]',
    excludedSelector: '[data-scroll-snap="off"]',
    exclusionPadding: 300,
    idleDelay: 240,
    attractionDistance: 300,
    triggerThresholdRatio: .32,
    overshootAllowance: 250,
    departureTolerance: 16,
    duration: 720,
    easing: [.2, .8, .2, 1]
  };
  const root = document.querySelector('.js-page-content-wrapper');
  const sections = root ? [...root.querySelectorAll(CONFIG.sectionSelector)] : [];
  const header = root?.querySelector('.header--sticky');
  const main = root?.querySelector('.js-page-content > main');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!root || !sections.length) return;

  let scroller = null;
  let mode = '';
  let points = [];
  let excludedRanges = [];
  let measureFrame = 0;
  let idleTimer = 0;
  let snapTimer = 0;
  let snapFrame = 0;
  let snapActive = false;
  let snapTarget = 0;
  let nativePreviousBehavior = '';
  let gesture = null;
  let touchX = 0;
  let touchY = 0;
  let touchDeltaX = 0;
  let touchDeltaY = 0;

  function readScroller() {
    // shared.js attaches its existing Locomotive instance to this wrapper.
    return root.scroller || null;
  }

  function readScrollPosition() {
    const instance = scroller?.scroll?.instance;
    const current = instance?.scroll?.y;
    const target = instance?.delta?.y;
    return {
      current: Number.isFinite(current) ? current : window.scrollY,
      target: Number.isFinite(target) ? target : window.scrollY
    };
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

  function scheduleMeasure() {
    if (measureFrame) return;
    measureFrame = requestAnimationFrame(() => {
      measureFrame = 0;
      points = [];
      excludedRanges = [];
      for (const section of sections) {
        const top = Math.max(0, getLayoutTop(section));
        const excluded = section.matches(CONFIG.excludedSelector);
        points.push({ top, excluded });
        if (excluded) {
          excludedRanges.push({
            top: Math.max(0, top - CONFIG.exclusionPadding),
            bottom: top + section.offsetHeight + CONFIG.exclusionPadding
          });
        }
      }
      const position = readScrollPosition();
      if (crossesExcludedRange(position.current, position.target)) resetGesture();
      if (snapActive && crossesExcludedRange(position.current, snapTarget)) cancelSnap(position.current);
    });
  }

  function crossesExcludedRange(start, target) {
    const top = Math.min(start, target);
    const bottom = Math.max(start, target);
    for (const range of excludedRanges) {
      if (bottom >= range.top && top <= range.bottom) return true;
    }
    return false;
  }

  function getHeaderOffset() {
    if (!header) return 0;
    const rect = header.getBoundingClientRect();
    return Math.max(0, Math.min(rect.height, rect.bottom));
  }

  function clearIdle() {
    clearTimeout(idleTimer);
    idleTimer = 0;
  }

  function cancelSnap(preserveTarget) {
    if (!snapActive) return;
    clearTimeout(snapTimer);
    snapTimer = 0;
    if (mode === 'custom') {
      const engine = scroller?.scroll;
      if (engine?.animatingScroll) {
        cancelAnimationFrame(engine.scrollToRaf);
        engine.scrollToRaf = null;
        engine.animatingScroll = false;
        if (Number.isFinite(preserveTarget) && engine.instance?.delta) {
          engine.instance.delta.y = preserveTarget;
        }
      }
    } else if (snapFrame) {
      cancelAnimationFrame(snapFrame);
      snapFrame = 0;
    }
    if (mode === 'native') document.documentElement.style.scrollBehavior = nativePreviousBehavior;
    snapActive = false;
  }

  function resetGesture() {
    clearIdle();
    gesture = null;
  }

  function cancelForNavigation() {
    resetGesture();
    cancelSnap();
  }

  function startGesture(start, target, direction) {
    if (!direction || reduced.matches) return;
    const current = mode === 'custom' ? readScrollPosition().current : window.scrollY;
    if (crossesExcludedRange(start, target) || crossesExcludedRange(current, target)) {
      resetGesture();
      cancelSnap(target);
      return;
    }
    if (!gesture || gesture.direction !== direction) {
      gesture = { start, target, direction, headerOffset: getHeaderOffset() };
    } else {
      gesture.target = target;
    }
    clearIdle();
    idleTimer = setTimeout(settleGesture, CONFIG.idleDelay);
  }

  function getNearbyPoint(position, direction, start, startHeaderOffset, settleHeaderOffset) {
    if (!points.length) return null;
    const threshold = Math.min(CONFIG.attractionDistance, window.innerHeight * CONFIG.triggerThresholdRatio);
    let startIndex = -1;
    for (let i = 0; i < points.length; i++) {
      if (points[i].top - startHeaderOffset <= start + 1) startIndex = i;
      else break;
    }
    if (startIndex < 0) return null;

    let candidateIndex = startIndex;
    if (direction > 0) {
      candidateIndex += 1;
    } else {
      const currentTarget = Math.max(0, points[startIndex].top - startHeaderOffset);
      if (Math.abs(currentTarget - start) <= CONFIG.departureTolerance) candidateIndex -= 1;
    }

    if (candidateIndex < 0 || candidateIndex >= points.length) return null;

    const point = points[candidateIndex];
    if (point.excluded) return null;
    const target = Math.max(0, point.top - settleHeaderOffset);
    if (crossesExcludedRange(start, target) || crossesExcludedRange(position, target)) return null;
    const distance = Math.abs(target - position);
    const passed = direction > 0 ? target <= position : target >= position;
    const limit = passed ? CONFIG.overshootAllowance : threshold;
    return distance <= limit ? { position: target, distance } : null;
  }

  function markSnapComplete() {
    clearTimeout(snapTimer);
    snapTimer = 0;
    snapActive = false;
    snapFrame = 0;
  }

  function animateNative(target) {
    const start = window.scrollY;
    const distance = target - start;
    if (Math.abs(distance) < 2) return;
    const startTime = performance.now();
    nativePreviousBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    snapActive = true;
    snapTarget = target;

    function step(now) {
      if (!snapActive) return;
      const progress = Math.min(1, (now - startTime) / CONFIG.duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      window.scrollTo(0, start + distance * eased);
      if (progress < 1) {
        snapFrame = requestAnimationFrame(step);
        return;
      }
      window.scrollTo(0, target);
      document.documentElement.style.scrollBehavior = nativePreviousBehavior;
      markSnapComplete();
    }

    snapFrame = requestAnimationFrame(step);
    snapTimer = setTimeout(() => {
      if (!snapActive) return;
      document.documentElement.style.scrollBehavior = nativePreviousBehavior;
      markSnapComplete();
    }, CONFIG.duration + 120);
  }

  function startSnap(target, position) {
    if (reduced.matches || Math.abs(target - position) < 2 || crossesExcludedRange(position, target)) return;
    snapActive = true;
    snapTarget = target;
    if (mode === 'custom') {
      scroller.scrollTo(target, {
        duration: CONFIG.duration,
        easing: CONFIG.easing,
        callback: markSnapComplete
      });
      snapTimer = setTimeout(markSnapComplete, CONFIG.duration + 160);
      return;
    }
    animateNative(target);
  }

  function settleGesture() {
    idleTimer = 0;
    if (!gesture || reduced.matches) {
      gesture = null;
      return;
    }
    const currentGesture = gesture;
    gesture = null;
    const scroll = readScrollPosition();
    if (crossesExcludedRange(currentGesture.start, currentGesture.target)
      || crossesExcludedRange(scroll.current, scroll.target)) return;
    const position = mode === 'custom' ? scroll.target : window.scrollY;
    const headerOffset = getHeaderOffset();
    const point = getNearbyPoint(position, currentGesture.direction, currentGesture.start, currentGesture.headerOffset, headerOffset);
    if (point) startSnap(point.position, position);
  }

  function handleCustomDelta(event) {
    const detail = event.detail || event.originalEvent?.detail;
    if (!detail || !Number.isFinite(detail.next) || !Number.isFinite(detail.current)) return;
    if (snapActive) cancelSnap(detail.next);
    startGesture(detail.current, detail.next, Math.sign(detail.next - detail.current));
  }

  function handleNativeWheel(event) {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.ctrlKey) return;
    const direction = Math.sign(event.deltaY);
    if (!direction) return;
    if (snapActive) cancelSnap();
    const position = window.scrollY;
    startGesture(position, position, direction);
  }

  function handleTouchStart(event) {
    if (!event.touches.length) return;
    touchX = event.touches[0].clientX;
    touchY = event.touches[0].clientY;
    touchDeltaX = 0;
    touchDeltaY = 0;
  }

  function updateTouchGesture(direction) {
    const position = mode === 'custom' ? readScrollPosition() : {
      current: window.scrollY,
      target: window.scrollY
    };
    if (snapActive) cancelSnap(position.target);
    startGesture(position.current, position.target, direction);
    requestAnimationFrame(() => {
      if (!gesture) return;
      const latest = mode === 'custom' ? readScrollPosition().target : window.scrollY;
      if (Number.isFinite(latest)) gesture.target = latest;
    });
  }

  function handleTouchMove(event) {
    if (!event.touches.length) return;
    const nextX = event.touches[0].clientX;
    const nextY = event.touches[0].clientY;
    touchDeltaX += touchX - nextX;
    touchDeltaY += touchY - nextY;
    touchX = nextX;
    touchY = nextY;
    if (Math.abs(touchDeltaY) < 10 || Math.abs(touchDeltaX) > Math.abs(touchDeltaY)) return;
    const direction = Math.sign(touchDeltaY);
    touchDeltaX = 0;
    touchDeltaY = 0;
    if (direction) updateTouchGesture(direction);
  }

  function handleTouchEnd() {
    if (!gesture || mode !== 'custom') return;
    const latest = readScrollPosition().target;
    if (Number.isFinite(latest)) gesture.target = latest;
    clearIdle();
    idleTimer = setTimeout(settleGesture, CONFIG.idleDelay);
  }

  function handleNativeScroll() {
    if (!gesture || snapActive || mode !== 'native') return;
    clearIdle();
    idleTimer = setTimeout(settleGesture, CONFIG.idleDelay);
  }

  function handleKeydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const directions = {
      ArrowDown: 1,
      PageDown: 1,
      ' ': 1,
      ArrowUp: -1,
      PageUp: -1,
      Home: -1,
      End: 1
    };
    const direction = directions[event.key];
    if (!direction || (event.key === ' ' && event.target instanceof Element && event.target.closest('button, a'))) return;
    if (mode === 'custom') {
      const position = readScrollPosition();
      if (snapActive) cancelSnap(position.target);
      startGesture(position.current, position.target, Math.sign(position.target - position.current) || direction);
      setTimeout(() => {
        const next = readScrollPosition().target;
        if (gesture && Number.isFinite(next)) gesture.target = next;
      }, 0);
    } else {
      if (snapActive) cancelSnap();
      const position = window.scrollY;
      startGesture(position, position, direction);
    }
  }

  function unbindMode() {
    root.removeEventListener('delta', handleCustomDelta);
    window.removeEventListener('wheel', handleNativeWheel);
    window.removeEventListener('scroll', handleNativeScroll);
    document.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleNativeScroll);
    document.removeEventListener('touchcancel', handleNativeScroll);
    document.removeEventListener('touchend', handleTouchEnd);
    document.removeEventListener('touchcancel', handleTouchEnd);
  }

  function bindMode() {
    scroller = readScroller();
    const nextMode = scroller?.scroll && typeof scroller.scrollTo === 'function' ? 'custom' : 'native';
    if (nextMode === mode) return;
    unbindMode();
    cancelForNavigation();
    mode = nextMode;
    scheduleMeasure();
    if (mode === 'custom') {
      // Use the scroller's normalized delta as the only custom-mode input source.
      // Raw wheel deltas use a different sign convention and can overwrite direction.
      root.addEventListener('delta', handleCustomDelta);
    } else {
      window.addEventListener('wheel', handleNativeWheel, { passive: true });
      window.addEventListener('scroll', handleNativeScroll, { passive: true });
    }
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', mode === 'custom' ? handleTouchEnd : handleNativeScroll, { passive: true });
    document.addEventListener('touchcancel', mode === 'custom' ? handleTouchEnd : handleNativeScroll, { passive: true });
  }

  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('a[href*="#"]')) cancelForNavigation();
  }, true);
  document.addEventListener('keydown', handleKeydown, true);
  window.addEventListener('resize', scheduleMeasure, { passive: true });
  window.addEventListener('pageshow', scheduleMeasure);
  window.addEventListener('load', scheduleMeasure, true);
  document.fonts?.ready.then(scheduleMeasure);
  document.fonts?.addEventListener('loadingdone', scheduleMeasure);
  reduced.addEventListener('change', () => {
    if (reduced.matches) cancelForNavigation();
  });
  if ('ResizeObserver' in window) {
    const sizes = new ResizeObserver(scheduleMeasure);
    if (main) sizes.observe(main);
    if (header) sizes.observe(header);
    sections.forEach(section => sizes.observe(section));
  }

  let initAttempts = 0;
  function initialize() {
    scroller = readScroller();
    if (!scroller && initAttempts < 80) {
      initAttempts += 1;
      setTimeout(initialize, 50);
      return;
    }
    bindMode();
  }
  initialize();
})();
