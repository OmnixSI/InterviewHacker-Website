// Opt-in frame meter for checking smoothness on real hardware: add ?fps to the URL.
// Shows current FPS, the refresh rate it can reach, and how many frames took >2× the budget.
(() => {
  if (!new URLSearchParams(location.search).has('fps')) return;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;padding:8px 10px;border-radius:10px;background:rgba(10,12,20,.88);color:#e8ebff;font:12px/1.5 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre';
  document.body.append(box);
  let last = performance.now(), frames = 0, windowStart = last, slow = 0, best = 0, worst = 0, budget = 16.7;
  const deltas = [];
  function tick(now) {
    const d = now - last;
    last = now;
    deltas.push(d);
    if (deltas.length > 120) deltas.shift();
    budget = [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length * .1)] || 16.7;
    if (d > budget * 2 && d < 1000) { slow++; worst = Math.max(worst, d); }
    frames++;
    if (now - windowStart >= 500) {
      const fps = Math.round(frames * 1000 / (now - windowStart));
      best = Math.max(best, fps);
      box.textContent = `FPS ${fps}  (display ≈ ${Math.round(1000 / budget)} Hz)\nslow frames ${slow}  worst ${worst.toFixed(0)} ms\nDPR ${devicePixelRatio}  ${innerWidth}×${innerHeight}`;
      frames = 0; windowStart = now;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  // Ignore loading: count only after the page has settled.
  addEventListener('load', () => setTimeout(() => { slow = 0; worst = 0; }, 1500));
})();
