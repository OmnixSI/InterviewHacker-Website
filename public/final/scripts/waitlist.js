// Early-access waitlist. The button sinks the headline into the water and raises a sheet of glass with the form;
// the form posts to /api/waitlist/, which emails the maintainer. Without script the form is shown and posts normally.
(() => {
  const ending = document.querySelector('[data-ending]');
  const box = ending?.querySelector('[data-waitlist]');
  if (!ending || !box) return;
  const $ = s => box.querySelector(s);
  const form = $('[data-waitlist-form]'), submit = $('[data-waitlist-submit]'), errorEl = $('[data-waitlist-error]');
  const done = $('[data-waitlist-done]'), doneText = $('[data-waitlist-done-text]');
  const openBtn = ending.querySelector('[data-waitlist-open]');
  const zh = document.documentElement.lang.startsWith('zh');
  const say = zh
    ? { name: '请填写称呼。', email: '这个邮箱格式好像不对。', uses: '选一个用途，或者在“更多”里写几句。', busy: '提交得有点频繁，请稍等一会儿再试。', fail: '暂时没能提交，请稍后再试。' }
    : { name: 'Please add your name.', email: 'That email doesn’t look quite right.', uses: 'Pick a use, or tell us in “Anything else”.', busy: 'That was a lot of tries. Please wait a moment.', fail: 'We couldn’t send that just now. Please try again shortly.' };
  const EMAIL = /^[^\s@<>()",;:]{1,64}@[^\s@<>()",;:]{1,190}\.[a-z]{2,24}$/i;

  const open = (focus = true) => {
    ending.classList.add('is-joining');
    openBtn?.setAttribute('aria-expanded', 'true');
    if (focus) setTimeout(() => (box.classList.contains('is-done') ? done : form.elements.name).focus({ preventScroll: true }), 420);
  };
  const close = () => {
    ending.classList.remove('is-joining');
    openBtn?.setAttribute('aria-expanded', 'false');
    openBtn?.focus({ preventScroll: true });
  };
  openBtn?.addEventListener('click', () => open());
  box.querySelectorAll('[data-waitlist-close]').forEach(b => b.addEventListener('click', close));
  addEventListener('keydown', e => { if (e.key === 'Escape' && ending.classList.contains('is-joining')) close(); });

  const flag = (el, bad) => el.setAttribute('aria-invalid', String(bad));
  const fail = (key, el) => {
    errorEl.textContent = say[key] || say.fail;
    if (el) { flag(el, true); (el.focus ? el : el.querySelector('input'))?.focus(); }
  };
  form.addEventListener('input', e => {
    const field = e.target.closest('.uses') || e.target;
    if (field.getAttribute('aria-invalid') === 'true') flag(field, false);
    errorEl.textContent = '';
  });

  const finish = email => {
    if (email) doneText.textContent = doneText.dataset.template.replace('%email%', email);
    box.classList.add('is-done');
    done.focus({ preventScroll: true });
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = form.elements, uses = [...form.querySelectorAll('[name="uses"]:checked')].map(i => i.value);
    const data = { name: f.name.value.trim(), email: f.email.value.trim(), uses, more: f.more.value.trim(), website: f.website.value, lang: f.lang.value };
    errorEl.textContent = '';
    if (!data.name) return fail('name', f.name);
    if (!EMAIL.test(data.email)) return fail('email', f.email);
    if (!uses.length && !data.more) return fail('uses', form.querySelector('.uses'));
    submit.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) { form.reset(); finish(data.email); }
      else fail(body.error === 'busy' ? 'busy' : body.error in say ? body.error : 'fail', body.error === 'email' ? f.email : null);
    } catch {
      fail('fail');
    } finally {
      submit.removeAttribute('aria-busy');
    }
  });

  // Coming back from a script-free post: the outcome rides in the hash.
  const m = location.hash.match(/^#waitlist-(\w+)$/);
  if (m) {
    open(false);
    if (m[1] === 'ok') finish(); else fail(m[1]);
    history.replaceState(null, '', '#download');
  }
})();
