// Live assistant demo and waveform canvases.
// The demo replays a fixed, local script (no audio, model or network access) of features the app ships:
// two-lane capture, echo suppression, question typing, streaming answers and one-tap rewrites.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => root.classList.contains('motion-paused');
  // Colours are read once per theme, not per frame: getComputedStyle in a draw loop forces style work.
  let palette = {};
  const readPalette = () => { const cs = getComputedStyle(root); palette = {'--mint': cs.getPropertyValue('--mint').trim(), '--violet': cs.getPropertyValue('--violet').trim()}; };
  readPalette();
  document.addEventListener('ih:theme', () => requestAnimationFrame(readPalette));
  const css = name => palette[name];

  /* ---------- Waveforms ---------- */
  const waves = [];
  const levels = {them: .15, me: .1};
  for (const canvas of document.querySelectorAll('canvas[data-wave]')) {
    const kind = canvas.dataset.wave;
    const lane = kind.startsWith('me') ? 'me' : 'them';
    waves.push({canvas, lane, autonomous: kind.endsWith('-lg'), level: .2, visible: false, seed: Math.random() * 100});
  }
  let waveFrame = 0, waveTime = 0, lastWave = 0;
  function drawWave(w, t) {
    const {canvas} = w;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const color = w.lane === 'me' ? css('--mint') : css('--violet');
    const bars = Math.max(18, Math.floor(cw / 6));
    const gap = cw / bars;
    ctx.fillStyle = color;
    for (let i = 0; i < bars; i++) {
      const x = i / bars;
      const n = Math.sin(x * 19 + t * 5.3 + w.seed) * Math.sin(x * 7.1 - t * 3.1) * .5 + .5;
      const env = Math.sin(Math.PI * x) * .6 + .4;
      const amp = Math.max(.08, (n * .85 + .15) * env * w.level);
      const h = Math.max(2, amp * ch * .92);
      ctx.globalAlpha = .35 + w.level * .65;
      const bw = Math.max(1.5, gap * .5);
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(i * gap + (gap - bw) / 2, (ch - h) / 2, bw, h, bw / 2) : ctx.rect(i * gap + (gap - bw) / 2, (ch - h) / 2, bw, h);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function waveLoop(now) {
    waveFrame = 0;
    const dt = Math.min(.05, (now - (lastWave || now)) / 1000);
    lastWave = now;
    waveTime += dt;
    let any = false;
    for (const w of waves) {
      if (!w.visible) continue;
      any = true;
      let target;
      if (w.autonomous) {
        // Alternate turns: the other side talks, then you answer.
        const phase = (waveTime % 6) / 6;
        const them = phase < .5;
        target = (w.lane === 'them') === them ? .75 + .25 * Math.sin(waveTime * 4) : .08;
      } else target = levels[w.lane];
      w.level += (target - w.level) * Math.min(1, dt * 6);
      drawWave(w, waveTime);
    }
    if (any && !paused() && !reduced.matches && !document.hidden) waveFrame = requestAnimationFrame(waveLoop);
  }
  function wakeWaves() {
    if (waveFrame) return;
    if (reduced.matches || paused()) { for (const w of waves) if (w.visible) { w.level = w.autonomous ? .55 : .45; drawWave(w, 2.4); } return; }
    lastWave = 0;
    waveFrame = requestAnimationFrame(waveLoop);
  }
  const waveIO = new IntersectionObserver(entries => {
    for (const e of entries) { const w = waves.find(x => x.canvas === e.target); if (w) w.visible = e.isIntersecting; }
    wakeWaves();
  });
  for (const w of waves) waveIO.observe(w.canvas);

  /* ---------- Demo script ---------- */
  const demo = document.querySelector('[data-demo]');
  if (!demo) { document.addEventListener('ih:motion', wakeWaves); return; }
  const $ = s => demo.querySelector(s);
  const transcript = $('[data-transcript]');
  const question = $('[data-demo-question]');
  const answer = $('[data-demo-answer]');
  const answerState = $('[data-demo-answer-state]');
  const acard = answer.closest('.acard');
  const status = $('[data-demo-status]');
  const clock = $('[data-demo-clock]');
  const qtypes = [...demo.querySelectorAll('[data-qtype]')];
  const adjustChips = [...demo.querySelectorAll('[data-adjust]')];
  const toggle = $('[data-demo-toggle]');
  const toggleLabel = $('[data-demo-toggle-label]');
  const window_ = $('.demo__window');
  const points = [...document.querySelectorAll('[data-point]')];

  let inView = false, userPaused = false, gen = 0, started = false, seconds = 0;
  const running = () => inView && !userPaused && !paused() && !document.hidden;

  class Abort extends Error {}
  // Waits for `ms` of *running* time so pausing freezes the script mid-sentence.
  function wait(ms, g) {
    return new Promise((resolve, reject) => {
      let left = ms, prev = performance.now();
      const step = now => {
        if (g !== gen) return reject(new Abort());
        if (running()) left -= now - prev;
        prev = now;
        left <= 0 ? resolve() : requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  function point(name) { for (const p of points) p.classList.toggle('is-active', p.dataset.point === name); }
  function setType(name) { for (const b of qtypes) b.classList.toggle('is-on', b.dataset.qtype === name); }
  function bubble(kind, tag) {
    const li = document.createElement('li');
    li.className = `bubble bubble--${kind}`;
    if (tag) { const t = document.createElement('span'); t.className = 'bubble__tag'; t.textContent = tag; li.append(t); }
    li.append(document.createTextNode(''));
    transcript.append(li);
    while (transcript.children.length > 5) transcript.firstElementChild.remove();
    if (window.gsap) gsap.from(li, {y: 16, opacity: 0, duration: .5, ease: 'power3.out'});
    return li;
  }
  async function type(node, text, speed, g) {
    for (const ch of text) { node.data += ch; await wait(speed, g); }
  }
  async function speak(lane, text, g, {tag, question: isQ} = {}) {
    levels[lane] = .95;
    point('listen');
    const li = bubble(lane === 'them' ? 'them' : 'me');
    if (lane === 'them') li.classList.add('bubble--interim');
    const node = li.lastChild;
    await type(node, text, 70, g);
    levels[lane] = .12;
    await wait(260, g);
    li.classList.remove('bubble--interim');
    if (tag) {
      const t = document.createElement('span');
      t.className = 'bubble__tag'; t.textContent = tag;
      li.prepend(t);
      if (window.gsap) gsap.from(t, {opacity: 0, x: -8, duration: .4});
    }
    if (isQ) li.classList.add('is-question');
    return li;
  }
  async function stream(text, g, label = '流式输出') {
    point('answer');
    answerState.textContent = label;
    answer.textContent = '';
    const node = document.createTextNode('');
    const caret = document.createElement('span');
    caret.className = 'caret';
    answer.append(node, caret);
    acard.classList.add('is-streaming');
    await wait(240, g);
    for (const ch of text) { node.data += ch; await wait(/[，。：；、]/.test(ch) ? 120 : 34, g); }
    acard.classList.remove('is-streaming');
    caret.remove();
  }
  async function setQuestion(text, type_, g) {
    point('detect');
    setType(type_);
    status.textContent = '识别到问题';
    if (window.gsap && window.ScrambleTextPlugin) {
      gsap.to(question, {duration: .8, scrambleText: {text, chars: '问题识别追问请求明确提问上下文', speed: .6}});
    } else question.textContent = text;
    await wait(700, g);
  }

  async function run(g) {
    transcript.textContent = '';
    question.textContent = '';
    answer.textContent = '';
    answerState.textContent = '等待问题';
    setType(null);
    for (const b of adjustChips) b.classList.remove('is-on');
    status.textContent = '正在聆听';
    await wait(500, g);
    await speak('them', '先聊聊你简历上的订单系统，大促时库存怎么扣？', g, {tag: '问题 · 明确提问', question: true});
    await setQuestion('先聊聊你简历上的订单系统，大促时库存怎么扣？', 'ask', g);
    status.textContent = '正在生成回答';
    await stream('库存先放在 Redis，用 Lua 脚本原子扣减，避免超卖；扣减成功后发事务消息，消费端按订单号幂等落库。大促前再做一轮库存预热和限流。', g);
    status.textContent = '你在说话';
    await wait(400, g);
    await speak('me', '库存先在 Redis 里用 Lua 原子扣减，再异步落库。', g);
    status.textContent = '正在聆听';
    await wait(400, g);
    await speak('them', '那数据库和缓存同时更新，怎么保证一致性？', g, {tag: '问题 · 追问', question: true});
    const echo = bubble('echo', '回声 · 已忽略');
    echo.lastChild.data = '数据库和缓存同时更新怎么保证一致性';
    await setQuestion('那数据库和缓存同时更新，怎么保证一致性？', 'follow', g);
    status.textContent = '正在生成回答';
    await stream('我们用的是先更新数据库、再删除缓存。删除失败的 key 进重试队列，同时用 Canal 订阅 binlog 再删一次兜底；热点 key 做延迟双删。这是最终一致方案，余额这类强一致数据直接读库。', g);
    await wait(900, g);
    adjustChips.find(b => b.dataset.adjust === 'short')?.classList.add('is-on');
    await wait(450, g);
    await stream('先更新库再删缓存；删除失败进重试队列，binlog 订阅兜底，热点 key 延迟双删。', g, '已改为更简短');
    status.textContent = '本机语音已就绪';
    point(null);
    await wait(4200, g);
  }
  async function loop() {
    const g = ++gen;
    try { for (;;) await run(g); } catch (e) { if (!(e instanceof Abort)) throw e; }
  }
  // Session clock ticks only while the demo runs.
  setInterval(() => {
    if (!started || !running()) return;
    seconds++;
    clock.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }, 1000);

  function sync() {
    const pausedNow = userPaused || paused();
    toggle.setAttribute('aria-pressed', String(pausedNow));
    toggleLabel.textContent = pausedNow ? '继续演示' : '暂停演示';
    if (running() && !started && !reduced.matches) { started = true; loop(); }
    wakeWaves();
  }
  toggle.addEventListener('click', () => { userPaused = !userPaused; sync(); });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, {threshold: .3}).observe(demo);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('ih:motion', sync);
  reduced.addEventListener('change', () => { if (reduced.matches) { gen++; started = false; } sync(); });

  // Pointer tilt + light on the demo window (desktop pointers only).
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && window.gsap) {
    const rx = gsap.quickTo(window_, 'rotationX', {duration: .8, ease: 'power3.out'});
    const ry = gsap.quickTo(window_, 'rotationY', {duration: .8, ease: 'power3.out'});
    demo.addEventListener('pointermove', e => {
      if (reduced.matches || paused()) return;
      const r = window_.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      window_.style.setProperty('--mx', `${x * 100}%`);
      window_.style.setProperty('--my', `${y * 100}%`);
      rx((.5 - y) * 4); ry((x - .5) * 5);
    });
    demo.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }
})();
