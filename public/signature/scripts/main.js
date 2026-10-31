(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const data = JSON.parse($('#signature-data').textContent);
  const en = document.documentElement.lang === 'en';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controls = $$('[data-stage-tab]');
  let stage = 'live', scenario = 'meeting', rewrite = 'base', quiet = false;
  const emitVoice = who => document.dispatchEvent(new CustomEvent('signature:voice', { detail: { who } }));

  function setMotion(paused, save = false) {
    paused = paused || reduced.matches;
    root.dataset.motion = paused ? 'paused' : 'running';
    $$('[data-motion-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(paused));
      const label = reduced.matches ? (en ? 'Reduced motion follows your system' : '动效已跟随系统减少') : paused ? button.dataset.labelOff : button.dataset.labelOn;
      button.setAttribute('aria-label', label);
      button.title = label;
      button.disabled = reduced.matches;
      const text = button.querySelector('[data-motion-label]');
      if (text) text.textContent = label;
    });
    if (save) { try { localStorage.setItem('signature-motion', paused ? 'paused' : 'running'); } catch { /* Optional preference. */ } }
    document.dispatchEvent(new CustomEvent('signature:motion', { detail: { paused } }));
  }
  setMotion(root.dataset.motion === 'paused');
  $$('[data-motion-toggle]').forEach(button => button.addEventListener('click', () => setMotion(root.dataset.motion !== 'paused', true)));
  reduced.addEventListener('change', () => {
    let preferred = false;
    try { preferred = localStorage.getItem('signature-motion') === 'paused'; } catch { /* no storage needed */ }
    setMotion(preferred);
  });

  function setStage(next, focus = false) {
    if (!['before', 'live', 'after'].includes(next)) return;
    stage = next;
    controls.forEach(button => {
      const active = button.dataset.stageTab === next;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus({ preventScroll: true });
    });
    $$('[data-stage]').forEach(panel => {
      const active = panel.dataset.stage === next;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
    const counter = $('.margin-number');
    if (counter) counter.textContent = `${String(['before', 'live', 'after'].indexOf(next) + 1).padStart(2, '0')} / 03`;
    emitVoice(next === 'live' ? 'them' : 'you');
  }
  controls.forEach((button, index) => {
    button.addEventListener('click', () => setStage(button.dataset.stageTab));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % controls.length;
      if (event.key === 'ArrowLeft') next = (index + controls.length - 1) % controls.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = controls.length - 1;
      if (next !== undefined) { event.preventDefault(); setStage(controls[next].dataset.stageTab, true); }
    });
  });
  $$('[data-go-stage]').forEach(button => button.addEventListener('click', () => setStage(button.dataset.goStage, true)));

  function renderAnswer() {
    const paragraphs = data.scenarios[scenario].answers[rewrite];
    const answer = $('[data-answer]');
    answer.replaceChildren(...paragraphs.map(text => Object.assign(document.createElement('p'), { textContent: text })));
    answer.lang = rewrite === 'english' ? (en ? 'zh-CN' : 'en') : root.lang;
    $$('[data-rewrite]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rewrite === rewrite)));
  }
  const fields = {
    'meeting-name': 'title', 'meeting-type': 'type', 'document-name': 'document',
    'context-insight': 'insight', lead: 'lead', question: 'question', source: 'source',
    'note-decision': 'decision', 'note-action': 'action', 'note-unsure': 'unsure'
  };
  function setScenario(next) {
    if (!Object.hasOwn(data.scenarios, next)) return;
    scenario = next; rewrite = 'base';
    for (const [attribute, key] of Object.entries(fields)) $$(`[data-${attribute}]`).forEach(node => { node.textContent = data.scenarios[scenario][key]; });
    $$('[data-scenario]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === next)));
    renderAnswer();
    emitVoice('them');
  }
  $$('[data-scenario]').forEach(button => button.addEventListener('click', () => setScenario(button.dataset.scenario)));
  $$('[data-rewrite]').forEach(button => button.addEventListener('click', () => { rewrite = button.dataset.rewrite; renderAnswer(); emitVoice('you'); }));
  $('[data-quiet]').addEventListener('click', event => {
    quiet = !quiet;
    $('.app-layout').classList.toggle('is-quiet', quiet);
    $('.record-only').hidden = !quiet;
    event.currentTarget.setAttribute('aria-pressed', String(quiet));
    event.currentTarget.textContent = quiet ? data.strings.quietOn : data.strings.quietOff;
    emitVoice('you');
  });
  $('[data-citation]').addEventListener('click', () => {
    if (quiet) $('[data-quiet]').click();
    setStage('live', true);
    const question = $('[data-question]');
    question.classList.add('is-source-highlight');
    window.setTimeout(() => question.classList.remove('is-source-highlight'), 1300);
  });
  setStage(stage);
  setScenario(scenario);

  const companion = $('[data-companion]');
  const setCompanionAccessibility = paired => {
    $('.desktop-prompt').setAttribute('aria-hidden', String(paired));
    $('.phone-waiting').setAttribute('aria-hidden', String(paired));
    $('.phone-answer').setAttribute('aria-hidden', String(!paired));
  };
  setCompanionAccessibility(false);
  companion.addEventListener('click', () => {
    const paired = companion.getAttribute('aria-pressed') !== 'true';
    companion.setAttribute('aria-pressed', String(paired));
    $('[data-companion-scene]').classList.toggle('is-paired', paired);
    setCompanionAccessibility(paired);
    $('[data-companion-feedback]').textContent = paired ? data.strings.companionOn : data.strings.companionOff;
    emitVoice(paired ? 'you' : 'them');
  });

  // Native anchors and scrolling stay available, including while motion is paused.
  $$('[data-language]').forEach(link => {
    link.addEventListener('click', () => {
      const known = ['top', 'experience', 'one-page', 'companion', 'privacy', 'faq', 'join'];
      const visible = known.filter(id => document.getElementById(id)?.getBoundingClientRect().top <= innerHeight * .35).at(-1);
      if (visible && visible !== 'top') link.hash = visible;
    });
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const node = entry.target;
        if (root.dataset.motion !== 'paused' && node.getBoundingClientRect().top > 0) {
          node.classList.add('is-entering');
          requestAnimationFrame(() => requestAnimationFrame(() => node.classList.remove('is-entering')));
        }
        observer.unobserve(node);
      });
    }, { threshold: .12 });
    $$('.section-heading, .chapter, .privacy-grid article, .waitlist-card').forEach(node => { node.dataset.enter = ''; observer.observe(node); });
  }

  const form = $('[data-waitlist]'), submit = $('[data-submit]'), feedback = $('#form-feedback');
  let submitting = false;
  const copy = en ? {
    sending: 'Sending your request…', sent: "You're on the list. We'll email you when access opens.", received: 'Request received',
    email: 'Please enter a valid email address.', busy: 'Too many attempts. Please try again in a little while.',
    offline: 'The waitlist is temporarily unavailable. Your request has not been saved; please try again later.',
    mail: "We couldn't deliver your request. Please try again later.",
    preview: 'This is a preview. Your request was not sent or saved.',
    timeout: "We couldn't confirm delivery. Your details are still here; please try again later.",
    network: "We couldn't connect. Your details are still here; please try again."
  } : {
    sending: '正在提交…', sent: '已收到申请。开放试用时，我们会通过邮箱联系你。', received: '已收到申请',
    email: '请填写有效的邮箱地址。', busy: '提交有点频繁，请稍后再试。',
    offline: '等待名单暂时无法提交。申请尚未保存，请稍后重试。',
    mail: '暂时没能送达，请稍后重试。', preview: '这是预览环境，申请没有发送或保存。',
    timeout: '暂时无法确认是否送达。你填写的信息仍在，请稍后重试。', network: '暂时无法连接。你填写的信息仍在，请检查网络后重试。'
  };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    submitting = true;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    feedback.classList.remove('is-success');
    feedback.textContent = copy.sending;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const body = new URLSearchParams(new FormData(form));
      const response = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body, signal: controller.signal });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        feedback.textContent = copy[result?.error] || copy.offline;
        if (result?.error === 'email') { $('#email').setAttribute('aria-invalid', 'true'); $('#email').focus(); }
        return;
      }
      feedback.textContent = copy.sent;
      feedback.classList.add('is-success');
      submit.classList.add('is-success');
      submit.replaceChildren(Object.assign(document.createElement('span'), { textContent: copy.received }));
      form.dataset.submitted = 'true';
      emitVoice('you');
    } catch (error) {
      feedback.textContent = error.name === 'AbortError' ? copy.timeout : copy.network;
    } finally {
      clearTimeout(timeout);
      submitting = false;
      form.removeAttribute('aria-busy');
      submit.disabled = form.dataset.submitted === 'true';
    }
  });
  $('#email').addEventListener('input', () => $('#email').removeAttribute('aria-invalid'));
})();
