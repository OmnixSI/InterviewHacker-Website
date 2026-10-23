// Runs in <head> (external for the site CSP) so the first paint already has the right theme and motion state.
(() => {
  const root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');
  let theme = 'dark';
  try {
    theme = localStorage.getItem('interviewhacker-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    if (localStorage.getItem('interviewhacker-motion') === 'paused') root.classList.add('motion-paused');
  } catch {
    // Storage may be blocked; the system preference still applies.
  }
  root.dataset.theme = theme === 'light' ? 'light' : 'dark';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) root.classList.add('reduced');
  // Some effects (live backdrop blur) are only worth their cost on Apple compositors.
  if (/Mac|iPhone|iPad/.test(navigator.userAgentData?.platform || navigator.platform || '')) root.classList.add('is-apple');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f6f7fb' : '#07080c');
})();
