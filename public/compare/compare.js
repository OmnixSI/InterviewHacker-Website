const $ = selector => document.querySelector(selector);
const frames = ['left', 'right'];
const widths = { desktop: 1280, mobile390: 390, mobile320: 320 };
const query = new URLSearchParams(location.search);
const requested = query.get('viewport');
let viewport = requested === 'responsive' || Object.hasOwn(widths, requested) ? requested : 'desktop';
const persist = () => history.replaceState(null, '', `${location.pathname}?${query}`);
function resizeFrames() {
  for (const side of frames) {
    const frame = $(`#${side}-frame`), host = frame.parentElement;
    if (viewport !== 'responsive') {
      const width = widths[viewport];
      const scale = Math.min(1, host.clientWidth / width);
      frame.style.width = `${width}px`;
      frame.style.height = `${Math.max(1, host.clientHeight / Math.max(scale, .01))}px`;
      frame.style.transform = `scale(${scale})`;
      frame.style.left = `${Math.max(0, (host.clientWidth - width * scale) / 2)}px`;
    } else {
      frame.style.width = '100%';
      frame.style.height = '100%';
      frame.style.transform = 'none';
      frame.style.left = '0';
    }
    frame.style.right = 'auto';
    frame.style.bottom = 'auto';
  }
  for (const button of document.querySelectorAll('[data-viewport]')) button.setAttribute('aria-pressed', String(button.dataset.viewport === viewport));
  for (const side of frames) {
    const link = $(`#${side}-inspect`);
    if (link) link.href = `/compare/inspect.html?style=${encodeURIComponent($(`#${side}-style`).value)}&width=${widths[viewport] || 390}&height=844&lang=zh`;
  }
}
for (const button of document.querySelectorAll('[data-viewport]')) {
  button.addEventListener('click', () => {
    viewport = button.dataset.viewport;
    query.set('viewport', viewport);
    resizeFrames();
    persist();
  });
}
new ResizeObserver(resizeFrames).observe($('.comparison-grid'));
resizeFrames();
try {
  const response = await fetch('/styles.json');
  if (!response.ok) throw new Error('Style catalog unavailable');
  const catalog = await response.json();
  const styles = catalog.styles.filter(style => /^[a-z][a-z0-9-]*$/.test(style.slug) && style.path === `/${style.slug}/`);
  if (!styles.length) throw new Error('Style catalog empty');
  function selectStyle(side, slug) {
    const style = styles.find(item => item.slug === slug) || styles[0];
    $(`#${side}-style`).value = style.slug;
    $(`#${side}-open`).href = style.path;
    const frame = $(`#${side}-frame`);
    if (frame.getAttribute('src') !== style.path) frame.src = style.path;
    frame.title = `${style.name} 风格页面`;
    query.set(side, style.slug);
    const names = frames.map(item => styles.find(style => style.slug === $(`#${item}-style`).value)?.name).filter(Boolean);
    $('#comparison-status').textContent = `${names.join(' / ')} · 两侧来自当前同一部署，操作互不影响。PR #4 的内容须先部署到该环境才会出现，合并或推送不会自动切换此处版本。`;
  }
  for (const [index, side] of frames.entries()) {
    const select = $(`#${side}-style`);
    select.replaceChildren(...styles.map(style => Object.assign(document.createElement('option'), {value:style.slug, textContent:style.name})));
    selectStyle(side, query.get(side) || styles[Math.min(index, styles.length - 1)].slug);
    select.addEventListener('change', () => {
      selectStyle(side, select.value);
      resizeFrames();
      persist();
    });
  }
  query.set('viewport', viewport);
  resizeFrames();
  persist();
} catch {
  $('#comparison-status').textContent = '风格列表暂时不可用；仍可使用上方链接打开两个页面。此工具只比较当前部署，不会载入其他分支或生产站。';
}
