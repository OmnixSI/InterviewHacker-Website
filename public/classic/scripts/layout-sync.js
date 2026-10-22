/* Re-measure the reference choreography after late fonts, images and viewport changes. */
(() => {
  let frame = 0;
  const main = document.querySelector("main");
  if (!main) return;

  function refresh() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const scroller = window.jQuery?.(window).data("smooth-scroll");
      scroller?.update();
    });
  }

  // Font metrics can settle after the first animation measurement on a cold visit.
  document.fonts?.ready.then(refresh);
  document.fonts?.addEventListener("loadingdone", refresh);
  main.addEventListener("load", refresh, true);
  window.addEventListener("pageshow", refresh);
  window.addEventListener("resize", refresh, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(refresh).observe(main);
  refresh();
})();
