const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const scenes = {
  interview: { question: '如果缓存删除失败了，你们怎么保证一致性？', answer: '我会先保证数据库写入成功，再删除缓存。\n删除失败时，把任务放入重试队列，同时用 binlog 订阅兜底。\n这个方案保证的是最终一致；对余额这类强一致场景，我会单独设计。' },
  academic: { question: '相比已有方法，你们最主要的贡献是什么？', answer: '我想从问题本身说起。现有方法在复杂场景下的泛化还不够稳定。\n我们的核心思路，是把结构信息引入建模过程。\n接下来我会结合消融实验，说明这一设计究竟带来了什么。' },
  meeting: { question: '如果交付时间不变，你会怎么调整这次的范围？', answer: '我建议先锁定本次必须交付的核心流程，把增强功能放到下一阶段。\n今天先对齐验收标准和负责人，再确认各个依赖的最晚时间。\n这样能尽早暴露风险，也让进度更可控。' },
  course: { question: '能举个例子，解释一下什么是过拟合吗？', answer: '可以把它想成只背熟了练习题，却没有理解解题方法。\n模型在训练数据上表现很好，换一道新题就容易答错。\n我们可以用独立验证集检查这个问题，并尝试正则化或增加数据。' }
};
let currentScene = 'interview';
let typingTimer = null;
function playScene(name, userInitiated = false) {
  currentScene = name;
  clearTimeout(typingTimer);
  const scene = scenes[name];
  $('#demo-question').textContent = scene.question;
  $$('[data-scene]').forEach(b => { const on = b.dataset.scene === name; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  const answer = $('#demo-answer');
  answer.replaceChildren();
  const text = document.createElement('span');
  text.style.whiteSpace = 'pre-line';
  answer.append(text);
  if (motion.matches) { text.textContent = scene.answer; return; }
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor'; cursor.setAttribute('aria-hidden', 'true');
  answer.append(cursor);
  let i = 0;
  function tick() {
    if (document.hidden) { typingTimer = setTimeout(tick, 250); return; }
    i = Math.min(i + 2, scene.answer.length);
    text.textContent = scene.answer.slice(0, i);
    if (i < scene.answer.length) typingTimer = setTimeout(tick, 40);
    else { cursor.remove(); typingTimer = null; }
  }
  typingTimer = setTimeout(tick, userInitiated ? 120 : 500);
}
$$('[data-scene]').forEach(b => b.addEventListener('click', () => playScene(b.dataset.scene, true)));
$('.replay-button').addEventListener('click', () => playScene(currentScene, true));
playScene('interview');

const features = {
  listen: { symbol: '≋', title: '听得到双方，\n也分得清你我。', description: '系统声音是「对方」，麦克风是「我」。两条音轨独立识别，实时转写；本地规则识别问题，触发流式回答。', points: ['默认在本机完成语音识别', '流式出字，整句再精修', '回声自动忽略，也能手动恢复'], image: 'assistant-dark.webp', alt: '助手页：实时对话、问题识别与建议回答' },
  context: { symbol: '▧', title: '有背景，\n回答才像你。', description: '把简历、岗位要求、论文或项目资料放进场景。回答会结合当前场景的要求与检索到的资料片段，帮助你把准备用起来。', points: ['面试、学术、商务等五种模式', 'PDF、Office 与图片按需处理', 'OCR 与语义检索可选'], image: 'materials-dark.webp', alt: '场景页：分类资料、背景信息与回答要求' },
  prompt: { symbol: '✦', title: '把要点，变成\n可以说出口的话。', description: '回答逐字出现，以第一人称、短句与自然衔接组织。打开悬浮提词器，让建议靠近摄像头；随时调整成更短、举例或英文版。', points: ['半透明悬浮窗，自定义字号', '鼠标穿透，减少操作干扰', '快捷键随时显示或隐藏'], image: 'teleprompter-dark.webp', alt: '悬浮提词器：当前问题、建议回答与调整操作' },
  review: { symbol: '↗', title: '这一次的经历，\n成为下一次的底气。', description: '会话结束后，回看转录与问题，生成复盘。把值得保留的经验和改进后的回答沉淀到场景里，让下一次准备有迹可循。', points: ['记录、问题与提词可回看', '经验库与题库按场景沉淀', '支持导出与本机备份'], image: 'workspace-knowledge-dark.webp', alt: '场景经验库与题库：复盘经验和改进后的回答' }
};
let currentFeature = 'listen';
function selectFeature(name, focus = false) {
  currentFeature = name;
  const data = features[name];
  $$('[data-feature]').forEach(b => { const on = b.dataset.feature === name; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  $('#workflow-panel').setAttribute('aria-labelledby', `tab-${name}`);
  $('#feature-symbol').textContent = data.symbol;
  $('#feature-title').replaceChildren(...data.title.split('\n').flatMap((line, i) => i ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
  $('#feature-description').textContent = data.description;
  $('#feature-points').replaceChildren(...data.points.map(point => { const li = document.createElement('li'); li.textContent = point; return li; }));
  $('#feature-image').src = `./shots/${data.image}`;
  $('#feature-image').alt = data.alt;
}
$$('[data-feature]').forEach((button, i, buttons) => {
  button.addEventListener('click', () => selectFeature(button.dataset.feature));
  button.addEventListener('keydown', e => {
    let next;
    if (e.key === 'ArrowRight') next = (i + 1) % buttons.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + buttons.length) % buttons.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = buttons.length - 1;
    if (next !== undefined) { e.preventDefault(); selectFeature(buttons[next].dataset.feature, true); }
  });
});

function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
$$('[data-download]').forEach(button => button.addEventListener('click', () => openDialog($('#download-dialog'))));
$$('dialog').forEach(dialog => {
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
});
$('.screenshot-frame').addEventListener('click', () => {
  const data = features[currentFeature];
  $('#image-dialog img').src = `./shots/${data.image}`;
  $('#image-dialog img').alt = data.alt;
  openDialog($('#image-dialog'));
});

const optional = { ocr: false, vector: false };
function updateOptions() {
  const { ocr, vector } = optional;
  $('#ocr-toggle').setAttribute('aria-checked', String(ocr));
  $('#vector-toggle').setAttribute('aria-checked', String(vector));
  $('#ocr-explanation').textContent = ocr ? '增加 Paddle Q8 与版面检测，面向复杂表格、公式和阅读顺序。模型约 1.23 GB，需要更多磁盘与内存，具体准确度取决于文件。' : '默认系统 OCR，无需下载 OCR 权重。适合常规文字与清晰扫描件；复杂表格、公式可考虑本机增强。';
  $('#vector-explanation').textContent = vector ? '增加语义召回，更容易找到意思相近、用词不同的资料。模型约 649 MB；需要建立索引并占用内存，实时检索超时会采用关键词结果。' : '不开启时，仍会按关键词检索资料片段；不会把所有资料塞入上下文。相近但不同词的表达可能漏检。';
  const modelBytes = (ocr ? 1230669106 : 0) + (vector ? 649100000 : 0);
  const total = modelBytes + (ocr || vector ? 185562618 : 0);
  const unit = total > 1e9 ? 'GB' : 'MB';
  const value = total > 1e9 ? (total / 1e9).toFixed(2) : Math.round(total / 1e6);
  $('#download-size').replaceChildren(document.createTextNode(`${value} `), Object.assign(document.createElement('small'), { textContent: unit }));
  $('#download-note').textContent = ocr || vector ? '估算包含共享运行包约 186 MB，仅需一份' : '不含语音引擎所需模型';
  $('#runtime-note').textContent = ocr || vector ? '运行包安装占用约 632 MB；此处仅预览，不会下载。' : '此处仅展示取舍，不会下载或修改应用设置。';
}
for (const key of ['ocr', 'vector']) $(`#${key}-toggle`).addEventListener('click', () => { optional[key] = !optional[key]; updateOptions(); });

const menu = $('.menu-button');
menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? '关闭导航' : '打开导航'); $('#mobile-nav').hidden = !open; });
$$('#mobile-nav a').forEach(a => a.addEventListener('click', () => { menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', '打开导航'); $('#mobile-nav').hidden = true; }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { menu.setAttribute('aria-expanded', 'false'); $('#mobile-nav').hidden = true; } });

if ('IntersectionObserver' in window && !motion.matches) {
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }), { threshold: .08 });
  $$('.reveal').forEach(el => observer.observe(el));
}
let scrollPending = false;
function setScrollProgress() {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  $('.scroll-progress').style.transform = `scaleX(${total > 0 ? Math.max(0, Math.min(1, window.scrollY / total)) : 0})`;
  scrollPending = false;
}
window.addEventListener('scroll', () => { if (!scrollPending) { scrollPending = true; requestAnimationFrame(setScrollProgress); } }, { passive: true });
window.addEventListener('resize', setScrollProgress);
setScrollProgress();

// A projected signal sculpture: small, procedural, and no graphics dependency.
const canvas = $('#signal-field');
const ctx = canvas.getContext('2d');
if (ctx) {
  let width = 0, height = 0, visible = true, frameId = 0, lastFrame = 0;
  let lastTime = 0, phase = 0;
  const dpr = () => Math.min(window.devicePixelRatio || 1, 1.7);
  function resize() { const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height; canvas.width = width * dpr(); canvas.height = height * dpr(); ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0); draw(0); }
  function project(x, y, z, rotation) {
    const x1 = x * Math.cos(rotation) + z * Math.sin(rotation);
    const z1 = -x * Math.sin(rotation) + z * Math.cos(rotation);
    const tilt = .92;
    const y1 = y * Math.cos(tilt) - z1 * Math.sin(tilt);
    const depth = y * Math.sin(tilt) + z1 * Math.cos(tilt);
    const perspective = 740 / (740 + depth);
    return [width * .51 + x1 * perspective, height * .47 + y1 * perspective, depth];
  }
  function draw(t) {
    ctx.clearRect(0, 0, width, height);
    const radius = width * .42;
    // An orbit of filament strands around the conversation, never behind the text itself.
    for (let ring = 0; ring < 22; ring++) {
      const latitude = (ring / 21 - .5) * 2;
      const rr = Math.sqrt(Math.max(0, 1 - latitude * latitude)) * radius;
      const yy = latitude * radius;
      ctx.beginPath();
      for (let j = 0; j <= 110; j++) {
        const a = j / 110 * Math.PI * 2;
        const ripple = Math.sin(a * 5 + t * .3 + ring * .21) * 2;
        const [x, y] = project(Math.cos(a) * (rr + ripple), yy, Math.sin(a) * rr, .35 + t * .018);
        if (!j) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      const alpha = .06 + .08 * (1 - Math.abs(latitude));
      ctx.strokeStyle = `rgba(153,120,209,${alpha})`; ctx.lineWidth = .55; ctx.stroke();
    }
    for (let meridian = 0; meridian < 10; meridian++) {
      const a = meridian / 10 * Math.PI;
      ctx.beginPath();
      for (let j = 0; j <= 96; j++) {
        const b = j / 96 * Math.PI * 2;
        const [x, y] = project(Math.cos(b) * Math.cos(a) * radius, Math.sin(b) * radius, Math.cos(b) * Math.sin(a) * radius, .35 + t * .018);
        if (!j) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(153,120,209,.055)'; ctx.lineWidth = .6; ctx.stroke();
    }
    // Wide diagonal equator and travelling pulses.
    ctx.beginPath();
    for (let i = 0; i <= 150; i++) {
      const a = i / 150 * Math.PI * 2;
      const [x, y] = project(Math.cos(a) * radius * 1.16, Math.sin(a * 2 + t * .12) * 17, Math.sin(a) * radius * 1.16, .35);
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#b9a2e93b'; ctx.lineWidth = .8; ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + t * .13;
      const [x, y] = project(Math.cos(a) * radius * 1.16, Math.sin(a * 2 + t * .12) * 17, Math.sin(a) * radius * 1.16, .35);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
      g.addColorStop(0, '#c1a3f640'); g.addColorStop(1, '#c1a3f600');
      ctx.fillStyle = g; ctx.fillRect(x - 12, y - 12, 24, 24);
      ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fillStyle = i % 2 ? '#b4d2bd' : '#bc9ce9'; ctx.fill();
    }
  }
  function loop(time) {
    frameId = 0;
    if (document.hidden || !visible || motion.matches) { lastTime = 0; return; }
    if (time - lastFrame > 1000 / 25) {
      if (lastTime) phase += Math.min((time - lastTime) / 1000, .1);
      lastTime = time; lastFrame = time; draw(phase);
    }
    frameId = requestAnimationFrame(loop);
  }
  function start() { if (!frameId && visible && !document.hidden && !motion.matches) frameId = requestAnimationFrame(loop); }
  function stop() { cancelAnimationFrame(frameId); frameId = 0; lastTime = 0; }
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) start(); else stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  motion.addEventListener('change', () => { if (motion.matches) { stop(); draw(0); playScene(currentScene); } else start(); });
  resize(); start();
}
