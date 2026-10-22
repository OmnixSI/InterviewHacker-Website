/* Scene carousel: replaces the template's slide plugin for #stories with a stacked,
   GPU-only crossfade. Slides share one grid cell, so switching never changes height,
   and every slide image is decoded ahead of the first click. */
(() => {
  const section = document.querySelector('#stories');
  const groups = section ? [...section.querySelectorAll('[data-ih-switch]')] : [];
  if (!groups.length) return;
  const prev = section.querySelector('.js-success-prev');
  const next = section.querySelector('.js-success-next');
  const count = groups[0].querySelectorAll(':scope > [data-content-animation-item]').length;
  let index = 0;
  let busy = false;

  for (const group of groups) {
    group.classList.add('ih-switch');
    group.querySelectorAll(':scope > [data-content-animation-item]').forEach((item, i) => {
      item.classList.remove('is-hidden');
      item.classList.toggle('is-active', i === 0);
      item.setAttribute('aria-hidden', String(i !== 0));
      item.inert = i !== 0;
    });
  }
  const decode = () => section.querySelectorAll('[data-ih-switch] img').forEach(img => img.decode?.().catch(() => {}));
  ('requestIdleCallback' in window ? requestIdleCallback : setTimeout)(decode);

  function go(step) {
    if (busy) return;
    busy = true;
    const target = (index + step + count) % count;
    section.style.setProperty('--ih-switch-dir', step > 0 ? '1' : '-1');
    for (const group of groups) {
      const items = group.querySelectorAll(':scope > [data-content-animation-item]');
      items.forEach((item, i) => {
        item.classList.toggle('is-leaving', i === index);
        item.classList.toggle('is-active', i === target);
        item.setAttribute('aria-hidden', String(i !== target));
        item.inert = i !== target;
      });
    }
    index = target;
    setTimeout(() => {
      section.querySelectorAll('.is-leaving').forEach(item => item.classList.remove('is-leaving'));
      busy = false;
    }, 420);
  }
  prev?.addEventListener('click', () => go(-1));
  next?.addEventListener('click', () => go(1));
  section.addEventListener('keydown', event => {
    if (event.target.closest('input, textarea')) return;
    if (event.key === 'ArrowRight') go(1);
    if (event.key === 'ArrowLeft') go(-1);
  });
})();
