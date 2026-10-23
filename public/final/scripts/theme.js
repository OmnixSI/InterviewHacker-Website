// Light / dark theme. Product images carry both sources and swap with the theme.
(() => {
  const root = document.documentElement;
  const images = [...document.querySelectorAll('img[data-ih-light]')];
  const saved = () => { try { return localStorage.getItem('ih-final-theme'); } catch { return null; } };
  function apply(theme) {
    root.dataset.theme = theme;
    for (const img of images) {
      const src = theme === 'dark' ? img.dataset.ihDark : img.dataset.ihLight;
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    }
    document.dispatchEvent(new CustomEvent('ih:theme', { detail: theme }));
  }
  apply(root.dataset.theme);
  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('ih-final-theme', next); } catch { /* session only */ }
    apply(next);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => { if (!saved()) apply(e.matches ? 'dark' : 'light'); });
})();
