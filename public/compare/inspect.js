// Embed only allowlisted relative routes from this deployment. Never use catalog.origin
// or accept a URL parameter as the iframe source.
const $ = selector => document.querySelector(selector);
const query = new URLSearchParams(location.search);
const widths = [320, 390, 768, 1280, 1440];
const bilingual = new Set(['final', 'turn', 'signature']);
const capture = query.get('capture') === '1';
document.documentElement.dataset.capture = String(capture);
const requestedWidth = Number(query.get('width'));
$('#inspect-width').value = String(widths.includes(requestedWidth) ? requestedWidth : 1280);
const heightOf = value => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 200 && n <= 4000 ? n : 844;
};
$('#inspect-height').value = String(heightOf(query.get('height')));
$('#inspect-lang').value = query.get('lang') === 'en' ? 'en' : 'zh';
$('#inspect-noscript').checked = query.get('noscript') === '1';

try {
  const response = await fetch('/styles.json');
  if (!response.ok) throw new Error('Catalog unavailable');
  const catalog = await response.json();
  const styles = catalog.styles.filter(style => /^[a-z][a-z0-9-]*$/.test(style.slug) && style.path === `/${style.slug}/`);
  if (!styles.length) throw new Error('Catalog empty');
  const styleControl = $('#inspect-style');
  styleControl.replaceChildren(...styles.map(style => Object.assign(document.createElement('option'), { value: style.slug, textContent: style.name })));
  styleControl.disabled = false;
  styleControl.value = styles.some(style => style.slug === query.get('style')) ? query.get('style') : styles.find(style => style.slug === 'signature')?.slug || styles[0].slug;

  function apply() {
    const style = styles.find(item => item.slug === styleControl.value) || styles[0];
    const langControl = $('#inspect-lang');
    langControl.disabled = !bilingual.has(style.slug);
    if (langControl.disabled) langControl.value = 'zh';
    const lang = langControl.value === 'en' ? 'en' : 'zh';
    const requested = Number($('#inspect-width').value);
    const width = widths.includes(requested) ? requested : 1280;
    const height = heightOf($('#inspect-height').value);
    $('#inspect-height').value = String(height);
    const route = style.path + (lang === 'en' ? 'en/' : '');
    const frame = $('#inspect-frame');
    const noScript = $('#inspect-noscript').checked;
    const sandboxChanged = frame.hasAttribute('sandbox') !== noScript;
    // Apply sandbox before navigation: no allow-scripts means a real script-free
    // document, while same-origin access and native form submissions remain available.
    if (noScript) frame.setAttribute('sandbox', 'allow-same-origin allow-forms');
    else frame.removeAttribute('sandbox');
    frame.width = String(width);
    frame.height = String(height);
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    frame.title = `${style.name} · ${lang === 'en' ? 'English' : '中文'} · ${width} × ${height} CSS px${noScript ? ' · 无脚本' : ''}`;
    if (frame.getAttribute('src') !== route || sandboxChanged) frame.src = route;
    $('#inspect-open').href = route;
    const state = new URLSearchParams({ style: style.slug, width: String(width), height: String(height), lang });
    if (noScript) state.set('noscript', '1');
    if (capture) state.set('capture', '1');
    history.replaceState(null, '', `${location.pathname}?${state}`);
    state.set('capture', '1');
    $('#inspect-capture').href = `/compare/inspect.html?${state}`;
    $('#inspect-status').textContent = `${style.name} · ${lang === 'en' ? 'English' : '中文'} · ${width} × ${height} CSS px · 100% 显示${noScript ? ' · 无脚本（允许原生表单）' : ''} · 当前部署路径 ${route}`;
  }

  $('#inspector-controls').addEventListener('submit', event => { event.preventDefault(); apply(); });
  for (const id of ['#inspect-style', '#inspect-lang', '#inspect-width', '#inspect-height', '#inspect-noscript']) $(id).addEventListener('change', apply);
  apply();
} catch {
  document.documentElement.dataset.capture = 'false';
  $('#inspect-status').textContent = '无法读取当前部署的风格目录。没有加载其他站点；请返回画廊或刷新重试。';
}
