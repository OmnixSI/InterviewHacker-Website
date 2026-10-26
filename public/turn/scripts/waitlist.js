// Turn — the waitlist at the end of the day. Same behaviour as Final's: the button sinks the headline under the
// horizon and raises a sheet of frosted glass with the form; Escape, the close button and "Done" bring it back.
// The form posts JSON to /api/waitlist (api/waitlist.js). Without script it is shown under the headline and posts
// normally; the server sends the reader back with #waitlist-<outcome>, which CSS (:target) or this script shows.
// On success the header clock rolls to 00:00 and stays there while the reader is at the end of the page.
(() => {
  const IH = window.IH || { t: (zh, en) => (document.documentElement.lang.startsWith('zh') ? zh : en), motionOK: () => false, on() {}, emit() {} };
  const ending = document.querySelector('[data-ending]');
  const box = ending?.querySelector('[data-waitlist]');
  if (!ending || !box) return;
  const $ = s => box.querySelector(s);
  const form = $('[data-waitlist-form]'), submit = $('[data-waitlist-submit]'), errorEl = $('[data-waitlist-error]');
  const done = $('[data-waitlist-done]'), doneText = $('[data-waitlist-done-text]'), doneTitle = $('[data-waitlist-done-title]');
  const title = form.querySelector('.waitlist__title');
  const openBtn = ending.querySelector('[data-waitlist-open]');
  const copy = [...ending.querySelectorAll('[data-ending-copy]')];
  const play = (name, opts) => IH.sound?.play?.(name, opts);
  const f = form.elements;
  const usesBox = form.querySelector('.uses');
  // Script validates inline (below); the browser's own bubbles stay for script-free visitors.
  form.noValidate = true;

  // Final's wording, in the page's language.
  const say = {
    name: IH.t('请填写称呼。', 'Please add your name.'),
    emailEmpty: IH.t('请填写邮箱。', 'Please add your email.'),
    email: IH.t('这个邮箱格式好像不对。', 'That email doesn’t look quite right.'),
    uses: IH.t('选一个用途，或者在“更多”里写几句。', 'Pick a use, or tell us in “Anything else”.'),
    busy: IH.t('提交得有点频繁，请稍等一会儿再试。', 'That was a lot of tries. Please wait a moment.'),
    fail: IH.t('暂时没能提交，请稍后再试。', 'We couldn’t send that just now. Please try again shortly.')
  };
  const EMAIL = /^[^\s@<>()",;:]{1,64}@[^\s@<>()",;:]{1,190}\.[a-z]{2,24}$/i;
  const coarse = matchMedia('(pointer: coarse)');

  /* ---------- Open and close ---------- */
  const isOpen = () => ending.classList.contains('is-joining');
  let focusTimer = 0;
  function open() {
    if (isOpen()) return;
    ending.classList.add('is-joining');
    openBtn?.setAttribute('aria-expanded', 'true');
    copy.forEach(el => { el.inert = true; });
    // Bring the whole sheet into view on short screens, then hand focus over without a second jump.
    const sheet = box.getBoundingClientRect();
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header')) || 64) + 12;
    if (sheet.top < top || sheet.bottom > innerHeight) IH.scrollTo?.(box, { offset: -top });
    clearTimeout(focusTimer);
    focusTimer = setTimeout(() => {
      const target = box.classList.contains('is-done') ? doneTitle : (coarse.matches ? title : f.name);
      target?.focus({ preventScroll: true });
    }, IH.motionOK() ? 360 : 0);
  }
  function close() {
    if (!isOpen()) return;
    clearTimeout(focusTimer);
    ending.classList.remove('is-joining');
    openBtn?.setAttribute('aria-expanded', 'false');
    copy.forEach(el => { el.inert = false; });
    openBtn?.focus({ preventScroll: true });
    // On small screens the sheet is taller than the lake; come back up to the headline.
    if (ending.getBoundingClientRect().top < -4) IH.scrollTo?.(ending, { offset: 0 });
  }
  // Open and close sounds come from sound.js, which listens for aria-expanded flipping under the reader's hand.
  openBtn?.addEventListener('click', open);
  box.querySelectorAll('[data-waitlist-close]').forEach(b => b.addEventListener('click', close));
  addEventListener('keydown', e => {
    // Let an IME or an open autofill list take Escape first.
    if (e.key !== 'Escape' || !isOpen() || e.defaultPrevented || e.isComposing) return;
    close();
    play('close');
  });

  /* ---------- Validation: Final's rules, shown inline under each field ---------- */
  const fields = {
    name: { el: f.name, msg: $('#wl-name-msg') },
    email: { el: f.email, msg: $('#wl-email-msg') },
    uses: { el: usesBox, msg: $('#wl-uses-msg') }
  };
  let tried = false;
  function check(key) {
    const name = f.name.value.trim(), email = f.email.value.trim();
    if (key === 'name') return name ? '' : say.name;
    if (key === 'email') return !email ? say.emailEmpty : EMAIL.test(email) ? '' : say.email;
    if (key === 'uses') return form.querySelector('[name="uses"]:checked') || f.more.value.trim() ? '' : say.uses;
    return '';
  }
  function show(key, message) {
    const { el, msg } = fields[key];
    el.setAttribute('aria-invalid', String(!!message));
    if (msg.textContent !== message) msg.textContent = message;
  }
  // After the first attempt, messages follow the reader's typing; before it, only a finished, malformed email is flagged.
  form.addEventListener('input', e => {
    errorEl.textContent = '';
    const key = e.target.name === 'more' ? 'uses' : e.target.name;
    if (!(key in fields)) return;
    if (tried || fields[key].el.getAttribute('aria-invalid') === 'true') show(key, check(key));
  });
  f.email.addEventListener('blur', () => { if (f.email.value.trim() && !tried) show('email', check('email')); });

  /* ---------- Submit ---------- */
  let busy = false;
  function setBusy(on) {
    busy = on;
    box.classList.toggle('is-busy', on);
    form.setAttribute('aria-busy', String(on));
    if (on) { submit.setAttribute('aria-busy', 'true'); submit.setAttribute('aria-disabled', 'true'); }
    else { submit.removeAttribute('aria-busy'); submit.removeAttribute('aria-disabled'); }
  }
  function fail(key, fieldKey) {
    const message = say[key] || say.fail;
    if (fieldKey && fields[fieldKey]) { show(fieldKey, message); focusField(fieldKey); }
    else errorEl.textContent = message;
    play('error');
  }
  function focusField(key) {
    const el = fields[key].el;
    (el.matches('input, textarea') ? el : el.querySelector('input'))?.focus();
  }
  function finish(email) {
    doneText.textContent = email ? doneText.dataset.template.replace('%email%', email) : doneText.textContent;
    box.classList.add('is-done');
    doneTitle?.focus({ preventScroll: true });
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header')) || 64) + 12;
    if (box.getBoundingClientRect().top < top - 1) IH.scrollTo?.(box, { offset: -top });
    midnight(true);
    play('success');
    IH.emit('voice', { who: 'me', level: 1, ms: 900 });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    tried = true;
    errorEl.textContent = '';
    const bad = Object.keys(fields).map(key => { const m = check(key); show(key, m); return m ? key : null; }).filter(Boolean);
    if (bad.length) { focusField(bad[0]); play('error'); return; }
    const uses = [...form.querySelectorAll('[name="uses"]:checked')].map(i => i.value);
    const data = { name: f.name.value.trim(), email: f.email.value.trim(), uses, more: f.more.value.trim(), website: f.website.value, lang: f.lang.value };
    setBusy(true);
    const started = performance.now();
    const ctrl = 'AbortController' in window ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), 20000);
    let result = { key: 'fail' };
    try {
      const res = await fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data), signal: ctrl?.signal });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) result = { ok: true };
      else result = { key: body.error in say ? body.error : 'fail', field: ['name', 'email', 'uses'].includes(body.error) ? body.error : null };
    } catch {
      result = { key: 'fail' };
    } finally {
      clearTimeout(timer);
    }
    // Let the progress line be seen for a moment, so a fast answer doesn't flash.
    const wait = Math.max(0, 420 - (performance.now() - started));
    setTimeout(() => {
      setBusy(false);
      if (result.ok) { form.reset(); tried = false; finish(data.email); }
      else fail(result.key, result.field);
    }, IH.motionOK() ? wait : 0);
  });

  /* ---------- 00:00: the day ends when the reader is on the list ---------- */
  const endTime = ending.querySelector('[data-ending-time]');
  const dayLabel = document.querySelector('.clock__day');
  const dayText = dayLabel?.textContent;
  let held = false;
  function midnight(on) {
    if (on === held) return;
    held = on;
    IH.holdClock?.(on ? 0 : null);
    if (endTime) endTime.textContent = on ? '00:00' : '23:59';
    if (dayLabel && dayText) dayLabel.textContent = on ? IH.t('周二', 'Tue') : dayText;
  }
  IH.on('section', s => {
    if (!box.classList.contains('is-done')) return;
    midnight(s.id === 'join');
  });

  // Coming back from a script-free post: the outcome rides in the hash.
  const m = location.hash.match(/^#waitlist-(\w+)$/);
  if (m) {
    history.replaceState(null, '', '#join');
    ending.classList.add('is-joining');
    openBtn?.setAttribute('aria-expanded', 'true');
    copy.forEach(el => { el.inert = true; });
    if (m[1] === 'ok') finish();
    else fail(m[1] in say ? m[1] : 'fail', ['name', 'email', 'uses'].includes(m[1]) ? m[1] : null);
    addEventListener('load', () => setTimeout(() => IH.scrollTo?.(ending, { immediate: true, offset: 0 }), 0));
  }
})();
