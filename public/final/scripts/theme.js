// Theme hook: Final is light only. Images that carry light/dark sources keep their light one, and the
// ih:theme event still fires once so canvases read their colours after first paint.
(() => {
  const root = document.documentElement;
  root.dataset.theme = 'light';
  for (const img of document.querySelectorAll('img[data-ih-light]')) img.setAttribute('src', img.dataset.ihLight);
  document.dispatchEvent(new CustomEvent('ih:theme', { detail: 'light' }));
})();
