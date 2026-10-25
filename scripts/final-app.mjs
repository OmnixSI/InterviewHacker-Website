// Renders Final's product mock-ups from scripts/final-i18n/demo.json at build time, so the page reads
// complete without scripts and the scripts only animate and switch states. The markup mirrors the v2
// app (home, prepare, live, notes) in HTML and CSS; class names starting with "a-" belong to the window.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (id, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

// Splits text into the units an answer fades in by: Latin words, or CJK in pairs, punctuation attached.
export function tokens(text) {
  return String(text).match(/[A-Za-z0-9.,'’%:;\-–—()?!/“”"]+\s*|[　-〿＀-￯]|[一-鿿]{1,2}[　-〿＀-￯]?|\s+|./g) || [];
}

function answerHtml(a) {
  const lead = `<p class="a-lead">${esc(a.lead)}</p>`;
  const pts = a.points.length ? `<ul class="a-pts">${a.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : '';
  return lead + pts;
}

function sheetSection(sec, d, opts = {}) {
  const gapMark = !!opts.gapMark;
  // In the specimen sheets the first timestamp and the first "to confirm" carry a pen note in the margin.
  const st = opts.state || {};
  const ts = t => t ? ` <span class="ts" title="${esc(d.lang === 'zh' ? '跳到转写里的这句话' : 'Jump to this moment in the transcript')}">[${esc(t)}]</span>` : '';
  const note = t => (t && opts.gapMark && !st.ts) ? (st.ts = true, `<span class="anno anno--ts" aria-hidden="true">{{@pen:arrow-left}}<b class="d">${d.lang === 'zh' ? '点一下，跳回原话' : 'click to jump back'}</b></span>`) : '';
  const unsure = it => {
    if (!it.unsure) return '';
    const ring = opts.gapMark && !st.unsure ? (st.unsure = true, '{{@pen:loop}}') : '';
    return ` <span class="badge badge--caution${ring ? ' badge--ringed' : ''}">${esc(d.unsure)}${ring}</span>`;
  };
  let body;
  if (sec.ai) {
    body = `<div class="ai-note"><p class="ai-note__over">${icon('spark')}${esc(sec.title)}</p><p>${esc(sec.items[0].text)}</p></div>`;
    return `<section class="sh-sec sh-sec--ai">${body}</section>`;
  }
  if (sec.kind === 'questions') {
    body = `<ol class="sh-qs">${sec.items.map((it, i) => `<li><span class="sh-n">${i + 1}</span><div><p class="sh-q">${esc(it.text)}${ts(it.t)} <span class="badge badge--${it.verdict === 'good' ? 'ready' : 'caution'}">${esc(d.verdict[it.verdict])}</span>${note(it.t)}</p><p class="sh-mine">${esc(d.mineLabel)}${esc(it.mine)}</p>${it.better ? `<div class="ai-note ai-note--sm"><p class="ai-note__over">${icon('spark')}${esc(d.better)}</p><p>${esc(it.better)}</p></div>` : ''}</div></li>`).join('')}</ol>`;
  } else if (sec.kind === 'actions') {
    body = `<div class="sh-table">${sec.items.map(it => `<div class="sh-row"><span class="sh-what">${esc(it.text)}${ts(it.t)}${note(it.t)}</span><span class="sh-who">${esc(it.who)}</span><span class="sh-due">${esc(it.due)}${unsure(it)}</span></div>`).join('')}</div>`;
  } else {
    body = `<ul class="sh-list">${sec.items.map(it => `<li>${esc(it.text)}${ts(it.t)}${unsure(it)}${note(it.t)}</li>`).join('')}</ul>`;
  }
  const mark = sec.gap && gapMark ? `<span class="gap-mark" aria-hidden="true">{{@pen:bracket}}<span class="gap-mark__label d">${esc(d.gapLabel)}</span></span>` : '';
  return `<section class="sh-sec${sec.gap ? ' is-gap' : ''}">${mark}<h5 class="sh-title">${esc(sec.title)}${sec.gap && !gapMark ? '' : ''}</h5>${body}</section>`;
}

export function renderSheet(tpl, d, opts = {}) {
  const state = {};
  return tpl.sections.map(s => sheetSection(s, d, { ...opts, state })).join('');
}

export function renderApp(d) {
  const p = d.prepare, l = d.live, n = d.notes, h = d.home;
  const side = active => `<nav class="a-side" aria-hidden="true"><span class="a-nav${active === 'home' ? ' is-on' : ''}" data-nav="home">${icon('home')}<span>${esc(d.nav.home)}</span></span><span class="a-nav${active === 'meetings' ? ' is-on' : ''}" data-nav="meetings">${icon('list')}<span>${esc(d.nav.meetings)}</span></span><span class="a-nav">${icon('folder')}<span>${esc(d.nav.library)}</span></span><span class="a-grow"></span><span class="a-nav">${icon('gear')}<span>${esc(d.nav.settings)}</span></span></nav>`;
  const type0 = d.types.find(t => t.id === 'interview');

  const home = `<section class="a-view a-home" data-view="home"><div class="a-scroll"><div class="a-col">
    <p class="a-over">${esc(h.date)}</p><h4 class="a-display">${esc(h.greeting)}</h4>
    <div class="a-card a-start" data-focus="start"><p class="a-over">${esc(h.over)}</p><p class="a-section">${esc(h.title)}</p><p class="a-sub">${esc(h.body)}</p>
      <div class="a-actions"><button class="a-primary a-primary--lg" type="button" data-go="prepare">${esc(h.new)} ${icon('arrow')}</button><button class="a-secondary" type="button" data-go="live" data-record>${icon('record')}${esc(h.record)} <kbd>${esc(h.recordKey)}</kbd></button></div></div>
    <p class="a-over a-over--rule">${esc(h.recentLabel)}</p>
    <ul class="a-recent">${h.recent.map(r => `<li><span><b>${esc(r.title)}</b><small>${esc(r.result)}</small></span><time>${esc(r.when)}</time></li>`).join('')}</ul>
  </div></div></section>`;

  const chips = d.types.map(t => `<button type="button" class="a-chip${t.id === 'interview' ? ' is-on' : ''}" data-type="${t.id}" aria-pressed="${t.id === 'interview'}">${esc(t.name)}</button>`).join('') + `<button type="button" class="a-chip a-chip--add" data-type-custom>${icon('plus')}${esc(p.custom)}</button>`;
  const carry = p.s2.items.map(it => `<label class="a-check"><input type="checkbox" data-carry="${it.id}"${it.on ? ' checked' : ''}><span class="a-box">${icon('check')}</span><span class="a-grow">${esc(it.label)}</span><span class="a-cap">${esc(it.count)}</span></label>`).join('');
  const files = p.s3.files.map((f, i) => `<div class="a-file" data-file="${i}"><span class="a-ext">${esc(f.ext)}</span><span class="a-grow"><span class="a-fname">${esc(f.name)}</span><span class="a-bar"><i></i></span></span><span class="a-fstate"><span class="when-reading">${esc(f.reading)}</span><span class="when-done">${icon('check')}${esc(f.done)}</span></span></div>`).join('');
  const highlights = p.s3.highlights.map(x => `<li${x.needs ? ` data-needs="${x.needs}"` : ''}>${esc(x.text)}</li>`).join('');
  const meter = (who, label) => `<span class="a-meter" data-meter="${who}"><span class="a-meter__label">${esc(label)}</span><span class="a-meter__bar">${'<i></i>'.repeat(14)}</span></span>`;
  const prepare = `<section class="a-view a-prep" data-view="prepare"><header class="a-crumbs"><span>${esc(p.crumbs[0])}</span>${icon('chev-r')}<b>${esc(p.crumbs[1])}</b></header><div class="a-scroll" data-prep-scroll><div class="a-col">
    <h4 class="a-display">${esc(p.title)}</h4><p class="a-src">${icon('screen')}<span data-where>${esc(p.where)}</span></p>
    <div class="a-step" data-prep-step="1"><span class="a-n">1</span><div><p class="a-step__head"><b>${esc(p.s1.label)}</b><span class="a-cap">${esc(p.s1.hint)}</span></p><div class="a-chips" role="group" aria-label="${esc(p.s1.label)}">${chips}</div><p class="a-cap a-typeline" data-typeline>${esc(type0.name)}${d.lang === 'zh' ? '：' : ': '}${esc(type0.line)} · ${esc(d.bringLabel)}${esc(type0.bring)}</p></div></div>
    <div class="a-step" data-prep-step="2"><span class="a-n">2</span><div><p class="a-step__head"><b>${esc(p.s2.label)}</b></p><div class="a-card a-carry"><div class="a-carry__head">${icon('layers')}<span class="a-grow"><b>${esc(p.s2.series)}</b><span class="a-cap">${esc(p.s2.last)}</span></span><button type="button" class="a-ghost" data-not-same>${esc(p.s2.notSame)}</button></div><div class="a-carry__list">${carry}</div></div></div></div>
    <div class="a-step" data-prep-step="3"><span class="a-n">3</span><div><p class="a-step__head"><b>${esc(p.s3.label)}</b><span class="a-cap">${esc(p.s3.optional)}</span><span class="a-grow"></span><span class="a-link">${esc(p.s3.bringIn)}</span><span class="a-link">${icon('plus')}${esc(p.s3.add)}</span></p>${files}
      <div class="ai-note a-ai"><p class="ai-note__over">${icon('spark')}${esc(p.s3.ai)}</p><ul>${highlights}</ul><p class="a-ai__more">${esc(p.s3.likely)} ${icon('chev-r')}</p></div></div></div>
    <div class="a-step" data-prep-step="4"><span class="a-n">4</span><div><p class="a-step__head"><b>${esc(p.s4.label)}</b></p><div class="a-card a-checks">
      <div class="a-crow"><i class="dot dot--ready"></i><b>${esc(p.s4.audio)}</b><span class="a-seg a-seg--sm" role="group"><button type="button" class="is-on" data-audio="online" aria-pressed="true">${esc(p.s4.online)}</button><button type="button" data-audio="offline" aria-pressed="false">${esc(p.s4.offline)}</button></span><span class="a-grow a-meters">${meter('them', p.s4.them)}${meter('me', p.s4.me)}${meter('room', p.s4.room)}</span></div>
      <div class="a-crow"><i class="dot dot--ready"></i><b>${esc(p.s4.answers)}</b><span class="a-cap">${esc(p.s4.model)}</span></div>
      <div class="a-crow"><i class="dot dot--ready"></i><b>${esc(p.s4.phone)}</b><span class="a-cap">${esc(p.s4.phoneState)}</span></div>
    </div></div></div>
  </div></div><footer class="a-prep__foot"><button type="button" class="a-primary a-primary--lg" data-go="live" data-start data-label-ready="${esc(p.start)}" data-label-reading="${esc(p.startReading)}">${esc(p.start)}</button></footer></section>`;

  const who = w => esc(l.whoName[w]);
  const lines = l.lines.map((x, i) => `<li class="a-line a-line--${x.who}${x.partial ? ' is-partial' : ''}" data-line="${i}" data-who="${x.who}"><span class="a-who">${who(x.who)}</span><span class="a-said">${x.q ? `<span class="a-qtag">${esc(l.question)}</span>` : ''}${esc(x.text)}</span></li>`).join('');
  const s = l.settings;
  const seg = (name, opts, on) => `<span class="a-seg a-seg--sm" role="group" aria-label="${esc(name)}">${opts.map((o, i) => `<button type="button" class="${i === on ? 'is-on' : ''}" aria-pressed="${i === on}">${esc(o)}</button>`).join('')}</span>`;
  const pop = `<div class="a-pop" data-pop role="dialog" aria-label="${esc(s.title)}" hidden><p class="a-pop__title">${esc(s.title)}</p>
    <div class="a-prow"><span>${esc(s.model)}</span>${seg(s.model, s.models, 0)}</div>
    <div class="a-prow"><span>${esc(s.fast)} ${icon('bolt')}<small>${esc(s.fastNote)}</small></span><button type="button" class="a-switch is-on" data-fast role="switch" aria-checked="true"><i></i></button></div>
    <div class="a-prow"><span>${esc(s.web)}</span>${seg(s.web, s.webOptions, 1)}</div>
    <div class="a-prow"><span>${esc(s.length)}</span>${seg(s.length, s.lengthOptions, 0)}</div>
    <p class="a-pop__foot">${esc(s.foot)}</p></div>`;
  const more = `<div class="a-menu" data-more-menu hidden>${l.more.map((m, i) => `<button type="button"${i === 5 ? ' data-regen' : ''}>${esc(m)}</button>`).join('')}</div>`;
  const live = `<section class="a-view a-live" data-view="live"><header class="a-top">
      <button type="button" class="a-timer" data-timer title="${esc(l.paused)}"><i class="dot dot--live"></i><span data-time>${esc(l.timer)}</span><span class="a-paused">${esc(l.paused)}</span></button>
      <span class="a-ttl">${esc(p.title)}</span><span class="a-grow"></span>
      <span class="a-seg" role="group" data-focus="mode"><button type="button" class="is-on" data-mode-btn="prompt" aria-pressed="true">${esc(l.prompt)}</button><button type="button" data-mode-btn="notes" aria-pressed="false">${esc(l.notesOnly)}</button></span>
      <span class="a-phone" title="${esc(l.phoneTip)}">${icon('phone')}<i class="dot dot--ready"></i></span>
      <button type="button" class="a-model" data-model aria-expanded="false" data-focus="model">${esc(l.model)}<span data-fast-mark>${icon('bolt')}</span></button>
      <span class="a-icon" title="${esc(l.teleprompter)}">${icon('tele')}</span>
      <button type="button" class="a-secondary" data-go="notes" data-end>${esc(l.end)}</button>${pop}
    </header>
    <div class="a-cols">
      <div class="a-conv"><p class="a-over">${esc(l.transcript)}</p><ol class="a-lines" data-lines>${lines}</ol><p class="a-foot">${esc(l.echo)}${icon('lock')}</p></div>
      <div class="a-ans" data-focus="answer"><div class="a-ans__head"><p class="a-over a-over--ai">${icon('spark')}${esc(l.suggested)}</p><span class="a-grow"></span><span class="a-pager">${icon('chev-l')}<span data-pager>${esc(l.pager)}</span>${icon('chev-r')}</span></div>
        <p class="a-q" data-q>${esc(l.answerFor)}</p><div class="a-body" data-body data-empty="${d.lang === 'zh' ? '正在听…' : 'Listening…'}">${answerHtml(l.answers.base)}</div>
        <p class="a-quiet" data-quiet>${esc(l.quiet)}</p>
        <div class="a-rew">${l.rewrites.map(r => `<button type="button" data-rewrite="${r.id}">${esc(r.label)}</button>`).join('')}<button type="button" class="a-more" data-more aria-expanded="false" aria-label="${d.lang === 'zh' ? '更多' : 'More'}">${icon('more')}</button>${more}</div>
        <p class="a-basis">${esc(l.basis)}</p></div>
    </div>
    <footer class="a-barline"><span class="a-input" data-input><span class="when-prompt">${esc(l.input)}</span><span class="when-notes">${esc(l.inputNotes)}</span><kbd>⌘L</kbd></span><span class="a-icon">${icon('crop')}</span><button type="button" class="a-primary" data-answer-now>${icon('bolt')}${esc(l.answerNow)} <kbd>${esc(l.answerKey)}</kbd></button></footer>
  </section>`;

  const interview = d.templates.find(t => t.id === 'interview');
  const notes = `<section class="a-view a-notes" data-view="notes"><header class="a-crumbs a-crumbs--bar"><span>${esc(n.crumbs[0])}</span>${icon('chev-r')}<span class="a-crumb-mid">${esc(n.crumbs[1])}</span>${icon('chev-r')}<b>${esc(n.crumbs[2])}</b><span class="a-grow"></span><span class="a-tpl">${icon('doc')}${esc(n.template)}${icon('chev-d')}</span><span class="a-icon">${icon('more')}</span><button type="button" class="a-primary" data-save data-saved="${esc(n.saved)}">${esc(n.save)}</button></header>
    <div class="a-scroll" data-notes-scroll><div class="a-col">
      <h4 class="a-display">${esc(n.title)}</h4><p class="a-cap a-meta">${esc(n.meta)}</p>
      <span class="a-seg a-tabs"><button type="button" class="is-on">${esc(n.tabs[0])}</button><button type="button">${esc(n.tabs[1])}</button><button type="button">${esc(n.tabs[2])}</button></span>
      <div class="a-progress" data-progress><p class="a-progress__title"><i class="spin"></i>${esc(n.progress)}</p><ol>${n.steps.map((x, i) => `<li data-pstep="${i}">${icon('check')}<span>${esc(x)}</span></li>`).join('')}</ol></div>
      <div class="sheet sheet--app" data-doc>${renderSheet(interview, d)}</div>
    </div></div></section>`;

  return `<div class="app" data-demo-app data-phase="home" data-mode="prompt" data-audio="online" data-type="interview" role="group" aria-roledescription="${d.lang === 'zh' ? '交互示意' : 'interactive mock-up'}" aria-label="${d.lang === 'zh' ? 'InterviewHacker 窗口' : 'InterviewHacker window'}">
  <div class="app__chrome" aria-hidden="true"><i></i><i></i><i></i></div>
  ${side('home')}
  <div class="a-views">${home}${prepare}${live}${notes}</div>
</div>`;
}

// #scenes: the type chips and the sheet of defaults they set.
export function renderTypes(d) {
  const t0 = d.types.find(t => t.id === 'interview');
  const chips = d.types.map(t => `<button type="button" class="chip${t.id === t0.id ? ' is-on' : ''}" data-tsel="${t.id}" aria-pressed="${t.id === t0.id}">${esc(t.name)}</button>`).join('');
  const L = d.lang === 'zh' ? { live: '会中', length: '回答长度', notes: '纪要', bring: '建议放', prompt: '提词', notesOnly: '只记录' } : { live: 'During the meeting', length: 'Answer length', notes: 'Notes', bring: 'Bring', prompt: 'Prompt', notesOnly: 'Notes only' };
  return `<div class="tsel__chips" role="group" aria-label="${d.lang === 'zh' ? '会议类型' : 'Meeting type'}">${chips}<span class="chip chip--add">${icon('plus')}${d.lang === 'zh' ? '自定义…' : 'Custom…'}</span></div>
  <div class="tsel__sheet" aria-live="polite">
    <div class="tsel__glyph" data-tglyph="${t0.mode}" aria-hidden="true"><span class="g-top"><i></i><i></i><i></i></span><span class="g-cols"><span class="g-conv"><i></i><i></i><i></i><i></i></span><span class="g-ans"><b class="g-ans__ai"><i></i><i></i><i></i></b><b class="g-ans__quiet"></b></span></span><span class="g-labels"><span class="g-l g-l--prompt">${L.prompt}</span><span class="g-l g-l--notes">${L.notesOnly}</span></span></div>
    <dl class="tsel__dl">
      <div><dt>${L.live}</dt><dd data-tfield="live">${esc(t0.live)}</dd></div>
      <div><dt>${L.length}</dt><dd data-tfield="length">${esc(t0.length)}</dd></div>
      <div><dt>${L.notes}</dt><dd data-tfield="template">${esc(t0.template)}</dd></div>
      <div><dt>${L.bring}</dt><dd data-tfield="bring">${esc(t0.bring)}</dd></div>
    </dl>
  </div>`;
}

// #notes: three templates side by side as tabs and sheets.
export function renderTemplates(d) {
  const tabs = d.templates.map((t, i) => `<button type="button" role="tab" id="tpl-tab-${t.id}" aria-controls="tpl-${t.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"${i === 0 ? ' class="is-on"' : ''}><b>${esc(t.name)}</b><small>${esc(t.for)}</small></button>`).join('');
  const panels = d.templates.map((t, i) => `<article class="paper tpl-panel" role="tabpanel" id="tpl-${t.id}" aria-labelledby="tpl-tab-${t.id}"${i ? ' hidden' : ''}><header class="paper__head"><div><h4 class="paper__title">${esc(t.meeting)}</h4><p class="paper__meta">${esc(t.meta)}</p></div><span class="paper__btn">${esc(t.primary)}</span></header><div class="sheet">${renderSheet(t, d, { gapMark: true })}</div></article>`).join('');
  return `<div class="tpl-tabs" role="tablist" aria-label="${d.lang === 'zh' ? '纪要模板' : 'Notes templates'}">${tabs}</div><div class="tpl-panels">${panels}</div>`;
}

export function renderAudioLines(d, mode) {
  const a = d.audio[mode];
  const names = d.live.whoName;
  return a.lines.map(x => `<li class="au-line au-line--${x.who}"><span class="au-who">${esc(names[x.who])}</span><span>${esc(x.text)}</span></li>`).join('');
}
