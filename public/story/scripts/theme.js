// Theme toggle. Product artwork has matching light/dark files; night bands always use the dark set.
(() => {
  const root = document.documentElement;
  const toggle = document.querySelector('[data-theme-toggle]');
  const meta = document.querySelector('meta[name="theme-color"]');
  const images = [...document.querySelectorAll('img[data-ih-light][data-ih-dark]')];

  function apply(theme, persist) {
    const dark = theme === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    for (const img of images) {
      const next = dark || img.closest('.band-night') ? img.dataset.ihDark : img.dataset.ihLight;
      const source = img.parentElement?.tagName === 'PICTURE' ? img.parentElement.querySelector('source') : null;
      if (source && source.getAttribute('srcset') !== next) source.setAttribute('srcset', next);
      if (img.getAttribute('src') !== next) img.setAttribute('src', next);
    }
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(dark));
      toggle.setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
    }
    meta?.setAttribute('content', dark ? '#07080c' : '#f6f7fb');
    if (persist) {
      try { localStorage.setItem('interviewhacker-theme', root.dataset.theme); } catch { /* session only */ }
    }
    document.dispatchEvent(new CustomEvent('ih:theme', {detail: root.dataset.theme}));
  }

  apply(root.dataset.theme, false);
  toggle?.addEventListener('click', () => apply(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
})();
