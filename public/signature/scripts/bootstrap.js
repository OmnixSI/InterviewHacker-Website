// A small fail-open enhancement marker. No critical content waits for JavaScript.
(() => {
  document.documentElement.classList.add('has-js');
  try {
    if (localStorage.getItem('signature-motion') === 'paused' || matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.dataset.motion = 'paused';
  } catch {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.dataset.motion = 'paused';
  }
})();
