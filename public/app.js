import { mountSignalEngine } from "/engine.js";
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
  $('#feature-image').src = `/shots/${data.image}`;
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
  $('#image-dialog img').src = `/shots/${data.image}`;
  $('#image-dialog img').alt = data.alt;
  openDialog($('#image-dialog'));
});

const optional = { ocr: false, vector: false };
function updateOptions() {
  const { ocr, vector } = optional;
  $('#ocr-toggle').setAttribute('aria-checked', String(ocr));
  $('#vector-toggle').setAttribute('aria-checked', String(vector));
  $('#ocr-explanation').textContent = ocr ? '增加版面检测、区域识别与阅读顺序重建，面向复杂表格和公式。模型约 1.23 GB，需要更多磁盘与内存，具体准确度取决于文件。' : '默认系统 OCR，无需下载 OCR 权重。适合常规文字与清晰扫描件；复杂表格、公式可考虑本机增强。';
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


const engine=mountSignalEngine($('#signal-field'),{onRenderer:text=>{$('#engine-renderer').textContent=text;}});
const shapeNames=['声场已就位 / AWAITING SIGNAL','语义空间 / CONTEXT IN ORBIT','联结展开 / THOUGHTS CONNECTED'];
$$('[data-shape]').forEach(button=>button.addEventListener('click',()=>{
  const index=Number(button.dataset.shape);engine.setShape(index);
  $$('[data-shape]').forEach(b=>{const selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
  $('#engine-state').textContent=shapeNames[index];
}));
let pulseTimer;
$('#inject-signal').addEventListener('click',()=>{clearTimeout(pulseTimer);engine.pulse();$('.hero-stage').classList.add('burst');$('#engine-state').textContent='信号已注入 / SIGNAL IN MOTION';pulseTimer=setTimeout(()=>{$('.hero-stage').classList.remove('burst');const b=$('[data-shape][aria-pressed="true"]');$('#engine-state').textContent=shapeNames[Number(b.dataset.shape)];},1600);});

const techSteps={
  capture:{kicker:'TWO STREAMS. ONE CONVERSATION.',title:'听得见，也分得清。',description:'系统声音与麦克风分别采集、独立识别。本地规则过滤回声、判断提问，让“对方在问”与“我在回答”各归其位。',tags:['双通道采集','本机规则判断','回声可恢复']},
  decode:{kicker:'STREAM FIRST. REFINE SECOND.',title:'先跟上，再听准。',description:'第一遍流式转写，跟上对话节奏；一句话说完，第二遍整句精修。持续反馈与最终文本，各自承担最合适的任务。',tags:['流式粗稿','整句精修','本机语音处理']},
  retrieve:{kicker:'THE RIGHT CONTEXT. AT THE RIGHT TIME.',title:'找到相关的，不堆全部的。',description:'标题树切片保留章节、表格与真实定位。关键词与可选语义检索共享切片；语义等待超过约 500 毫秒，采用关键词结果继续回答。',tags:['统一切片','版本化索引','超时关键词兜底']},
  stream:{kicker:'LESS WAITING. MORE CONVERSATION.',title:'一边生成，一边进入视线。',description:'识别到问题后，组织当前场景与检索片段，调用所选回答服务流式输出。任务绑定场景版本，取消或切换后，过期结果不覆盖当前回答。',tags:['流式呈现','可取消任务','过期结果隔离']}
};
function waveMarkup(){return ['remote','self'].map((side,j)=>`<div class="track track-${side}"><span>${j?'SELF':'REMOTE'}</span><div class="wave-track">${Array.from({length:40},(_,i)=>`<i style="height:${4+Math.round(Math.abs(Math.sin(i*2.17+j))*18)}px;animation-delay:-${(i*.13).toFixed(2)}s"></i>`).join('')}</div><b>${j?'我':'对方'}</b></div>`).join('')+'<div class="trace-merge"><i></i><span>独立识别 / 回声过滤</span><i></i></div><div class="trace-output"><span>QUESTION_DETECTED</span><strong>识别问题，触发回答。</strong><span class="trace-cursor">▌</span></div>';}
const techVisuals={capture:waveMarkup(),decode:'<div class="refine-line"><b>PASS_01</b> 实时流式草稿</div><div class="refine-line"><s>缓寸删除失拜怎么办</s></div><div class="trace-merge"><i></i><span>整句结束 → 离线精修</span><i></i></div><div class="refine-line final"><b>PASS_02</b> 缓存删除失败怎么办？</div><div class="context-route">示意文本 / TWO-PASS TRANSCRIPTION</div>',retrieve:'<div class="context-map"><span>个人简历</span><span class="matched">项目经验</span><span>岗位要求</span><span class="matched">缓存策略</span><span>历史问题</span><span class="matched">一致性方案</span></div><div class="context-route">QUERY → KEYWORD + SEMANTIC* → CONTEXT<br>* 语义检索按需开启</div>',stream:'<div class="stream-code"><span>01 <b>SCENE</b> · 当前场景</span><span>02 <b>CONTEXT</b> · 命中片段</span><span>03 <b>STREAM</b> · 回答逐字呈现</span><div class="trace-merge"><i></i><span>ANSWER_STREAM</span><i></i></div><span class="stream-line">我的思路是，先保证主流程的正确性…</span><i class="trace-cursor">▌</i></div>'};
function selectTech(name,focus=false){
  const data=techSteps[name];
  $$('[data-tech]').forEach(b=>{const selected=b.dataset.tech===name;b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;if(selected&&focus)b.focus();});
  $('#tech-panel').setAttribute('aria-labelledby',`tech-${name}`);$('#tech-kicker').textContent=data.kicker;$('#tech-title').textContent=data.title;$('#tech-description').textContent=data.description;
  $('#tech-tags').replaceChildren(...data.tags.map(text=>Object.assign(document.createElement('span'),{textContent:text})));
  $('.tech-visual').dataset.visual=name;$('.tech-visual').innerHTML=techVisuals[name];
}
let pipelineTimers=[];
function cancelPipeline(){pipelineTimers.forEach(clearTimeout);pipelineTimers=[];$('#run-pipeline').replaceChildren(document.createTextNode('运行链路演示 '),Object.assign(document.createElement('span'),{textContent:'▶',ariaHidden:'true'}));}
$$('[data-tech]').forEach((button,i,buttons)=>{
  button.addEventListener('click',()=>{cancelPipeline();selectTech(button.dataset.tech);});
  button.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%buttons.length;if(e.key==='ArrowLeft')next=(i+buttons.length-1)%buttons.length;if(e.key==='Home')next=0;if(e.key==='End')next=buttons.length-1;if(next!==undefined){e.preventDefault();cancelPipeline();selectTech(buttons[next].dataset.tech,true);}});
});
$('#run-pipeline').addEventListener('click',()=>{cancelPipeline();$('#run-pipeline').textContent='演示运行中 · 点击可重播';Object.keys(techSteps).forEach((name,i)=>{if(i===0)selectTech(name);else pipelineTimers.push(setTimeout(()=>selectTech(name),i*1500));});pipelineTimers.push(setTimeout(cancelPipeline,6200));});
selectTech('capture');
if(matchMedia('(hover: hover)').matches&&!motion.matches)$$('.craft-card').forEach(card=>{card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect();card.style.setProperty('--spot-x',`${(e.clientX-r.left)/r.width*100}%`);card.style.setProperty('--spot-y',`${(e.clientY-r.top)/r.height*100}%`);},{passive:true});});

// A scroll-driven chapter with native scrolling and a complete static reading path.
const storyEngine=mountSignalEngine($('#story-field'));
document.documentElement.classList.add('story-enhanced');
const chapters=[
  {heading:'先听见，真实的对话。',description:'双路音频各自进入识别管线，在本机成为可处理的文字。'},
  {heading:'再连接，你准备好的背景。',description:'围绕当前问题，从场景资料中召回相关片段；可选语义检索补充近义表达。'},
  {heading:'最后，让思路进入表达。',description:'将当前问题与相关上下文交给回答服务，让建议逐字进入你的视线。'}
];
let storyFrame=0,storyChapter=-1;
function updateStory(){
  storyFrame=0;const section=$('#signal-story'),rect=section.getBoundingClientRect();
  const distance=Math.max(1,section.offsetHeight-window.innerHeight);
  const progress=Math.max(0,Math.min(1,-rect.top/distance));
  const chapter=Math.min(2,Math.floor(progress*3));
  $('.story-progress span').style.transform=`scaleX(${progress})`;
  if(chapter!==storyChapter){storyChapter=chapter;storyEngine.setShape(chapter);$$('[data-story-word]').forEach((el,i)=>el.classList.toggle('active',i===chapter));$('#story-index').textContent=`0${chapter+1} / 03`;$('#story-heading').textContent=chapters[chapter].heading;$('#story-description').textContent=chapters[chapter].description;}
}
window.addEventListener('scroll',()=>{if(!storyFrame)storyFrame=requestAnimationFrame(updateStory);},{passive:true});
window.addEventListener('resize',()=>{if(!storyFrame)storyFrame=requestAnimationFrame(updateStory);});
updateStory();
// Real controls for pausing non-essential motion, independent of system preference.
const motionControl=document.createElement('button');motionControl.className='motion-control';motionControl.type='button';motionControl.setAttribute('aria-pressed','false');motionControl.setAttribute('aria-label','暂停装饰动效');motionControl.textContent='Ⅱ 动效';
let userPaused=false;
motionControl.addEventListener('click',()=>{userPaused=!userPaused;document.documentElement.classList.toggle('user-paused',userPaused);engine.setPaused(userPaused);storyEngine.setPaused(userPaused);motionControl.setAttribute('aria-pressed',String(userPaused));motionControl.setAttribute('aria-label',userPaused?'恢复装饰动效':'暂停装饰动效');motionControl.textContent=userPaused?'▶ 动效':'Ⅱ 动效';});
document.body.append(motionControl);
