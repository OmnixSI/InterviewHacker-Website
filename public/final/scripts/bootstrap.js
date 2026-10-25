// Runs in <head> before first paint: script flag, the saved appearance and the saved motion choice.
// Final is light by default (like the app's README); dark is an opt-in kept per browser.
(() => {
  const root = document.documentElement;
  root.classList.replace('no-js', 'js');
  let theme = null, motion = null;
  try { theme = localStorage.getItem('ih-final-theme'); motion = localStorage.getItem('ih-final-motion'); } catch { /* storage blocked */ }
  root.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  if (motion === 'paused') root.classList.add('motion-paused');
})();
