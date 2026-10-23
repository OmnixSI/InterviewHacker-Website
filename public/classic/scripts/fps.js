// Add ?fps to inspect frame timing and background animation work.
(() => {
  if (!new URLSearchParams(location.search).has('fps')) return;
  const box = document.createElement('div');
  box.id = 'ih-frame-meter';
  box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;padding:8px 10px;border-radius:10px;background:rgba(10,12,20,.88);color:#e8ebff;font:12px/1.5 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre';
  document.body.append(box);
  const workflow = document.querySelector('#workflow');
  const deltas = [];
  let last = performance.now();
  let windowStart = last;
  let frames = 0;
  let mutations = 0;
  let scrolls = 0;
  let slow = 0;
  let worst = 0;

  if (workflow) {
    new MutationObserver(records => { mutations += records.length; })
      .observe(workflow, { subtree: true, attributes: true });
  }
  window.jQuery?.('.js-page-content-wrapper').on('scroll.ihFrameMeter', () => { scrolls++; });

  function tick(now) {
    const delta = now - last;
    last = now;
    deltas.push(delta);
    if (deltas.length > 180) deltas.shift();
    frames++;
    if (delta > 34 && delta < 1000) slow++;
    if (delta < 1000) worst = Math.max(worst, delta);

    if (now - windowStart >= 1000) {
      const elapsed = now - windowStart;
      const ordered = [...deltas].sort((a, b) => a - b);
      const rect = workflow?.getBoundingClientRect();
      const report = {
        fps: Math.round(frames * 1000 / elapsed),
        p95: Math.round(ordered[Math.floor(ordered.length * .95)] || 0),
        slow,
        worst: Math.round(worst),
        workflowMutations: Math.round(mutations * 1000 / elapsed),
        scrollEvents: Math.round(scrolls * 1000 / elapsed),
        runningAnimations: document.getAnimations?.().filter(animation => animation.playState === 'running').length || 0,
        workflowVisible: !!rect && rect.bottom > 0 && rect.top < innerHeight
      };
      box.dataset.report = JSON.stringify(report);
      box.textContent = `FPS ${report.fps}  p95 ${report.p95} ms\nslow ${slow}  worst ${report.worst} ms\nworkflow ${report.workflowMutations} mutations/s (${report.workflowVisible ? 'visible' : 'offscreen'})\nscroll ${report.scrollEvents}/s  animations ${report.runningAnimations}\nDPR ${devicePixelRatio}  ${innerWidth}×${innerHeight}`;
      frames = 0;
      mutations = 0;
      scrolls = 0;
      windowStart = now;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  addEventListener('load', () => setTimeout(() => { slow = 0; worst = 0; }, 1500));
})();
