// Runs in <head> before first paint: script flag and the saved motion choice, so nothing flashes.
// Final is a light design only; the theme attribute stays fixed so shared tokens never flip.
(() => {
  const root = document.documentElement;
  root.classList.replace('no-js', 'js');
  root.dataset.theme = 'light';
  let motion = null;
  try { motion = localStorage.getItem('ih-final-motion'); } catch { /* storage blocked */ }
  if (motion === 'paused') root.classList.add('motion-paused');
})();
