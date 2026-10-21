const $ = selector => document.querySelector(selector);
const frames = ['left', 'right'];
let viewport = 'desktop';
function resizeFrames() {
  for (const side of frames) {
    const frame = $(`#${side}-frame`), host = frame.parentElement;
    if (viewport === 'desktop') {
      const scale = host.clientWidth / 1280;
      frame.style.width = '1280px';
      frame.style.height = `${Math.max(900, host.clientHeight / scale)}px`;
      frame.style.transform = `scale(${scale})`;
    } else {
      frame.style.width = '100%';
      frame.style.height = '100%';
      frame.style.transform = 'none';
    }
  }
}
for (const button of document.querySelectorAll('[data-viewport]')) {
  button.addEventListener('click', () => {
    viewport = button.dataset.viewport;
    for (const other of document.querySelectorAll('[data-viewport]')) other.setAttribute('aria-pressed', String(other === button));
    resizeFrames();
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
  const query = new URLSearchParams(location.search);
  function selectStyle(side, slug) {
    const style = styles.find(item => item.slug === slug) || styles[0];
    $(`#${side}-style`).value = style.slug;
    $(`#${side}-open`).href = style.path;
    const frame = $(`#${side}-frame`);
    if (frame.getAttribute('src') !== style.path) frame.src = style.path;
    frame.title = `${style.name} 风格页面`;
    query.set(side, style.slug);
    const names = frames.map(item => styles.find(style => style.slug === $(`#${item}-style`).value)?.name).filter(Boolean);
    $('#comparison-status').textContent = `${names.join(' / ')} · 每侧为独立页面，操作互不影响。`;
  }
  for (const [index, side] of frames.entries()) {
    const select = $(`#${side}-style`);
    select.replaceChildren(...styles.map(style => Object.assign(document.createElement('option'), {value:style.slug, textContent:style.name})));
    selectStyle(side, query.get(side) || styles[Math.min(index, styles.length - 1)].slug);
    select.addEventListener('change', () => {
      selectStyle(side, select.value);
      history.replaceState(null, '', `${location.pathname}?${query}`);
    });
  }
  resizeFrames();
} catch {
  $('#comparison-status').textContent = '风格列表暂时不可用；仍可使用上方链接打开两个页面。';
}
