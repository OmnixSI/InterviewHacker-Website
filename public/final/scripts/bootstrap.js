// Runs in <head> before first paint: script flag, theme and the saved motion choice, so nothing flashes.
(() => {
  const root = document.documentElement;
  root.classList.replace('no-js', 'js');
  let theme = null, motion = null;
  try { theme = localStorage.getItem('ih-final-theme'); motion = localStorage.getItem('ih-final-motion'); } catch { /* storage blocked */ }
  if (theme !== 'light' && theme !== 'dark') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.dataset.theme = theme;
  if (motion === 'paused') root.classList.add('motion-paused');
})();
