import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root} from './catalog.mjs';

// Editable product artwork. Each screen is composed from the feature described
// beside it, rather than reusing an unrelated full-app screenshot.
const palettes = {
  light: {canvas:'#eff1f7', panel:'#ffffff', soft:'#f6f7fb', ink:'#24283b', copy:'#626b83', line:'#e2e6f0', tint:'#eeecff', accent:'#6e63ed', green:'#248563'},
  dark: {canvas:'#121723', panel:'#1c2232', soft:'#252d40', ink:'#f0f3fc', copy:'#b2bed5', line:'#343f55', tint:'#353254', accent:'#b9afff', green:'#73dbb5'}
};
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function drawing(p) {
  const rect=(x,y,w,h,r=18,fill=p.panel,stroke='none',extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke==='none'&&fill===p.panel?p.line:stroke}" ${extra}/>`;
  const text=(x,y,s,size=25,fill=p.ink,weight=400,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(s)}</text>`;
  const lines=(x,y,ss,size=25,fill=p.copy,gap=40,weight=400)=>ss.map((s,i)=>text(x,y+i*gap,s,size,fill,weight)).join('');
  const line=(x1,y1,x2,y2,color=p.line)=>`<path d="M${x1} ${y1}H${x2}" stroke="${color}"/>`;
  const chip=(x,y,s,w=140,active=false)=>rect(x,y,w,38,19,active?p.tint:p.soft)+text(x+w/2,y+26,s,18,active?p.accent:p.copy,500,'text-anchor="middle"');
  const icon=(x,y,name,color=p.copy,size=26)=>{
    const paths={wave:'M2 12h3m2-6v12m5-15v18m5-15v12m2-6h3',folder:'M3 6h7l2 3h9v12H3z',clock:'M12 7v5l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',file:'M5 2h9l5 5v15H5zM14 2v6h5M8 12h8M8 16h8',check:'m5 12 4 4L20 5',arrow:'M3 12h18m-6-6 6 6-6 6',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',mic:'M8 5a4 4 0 0 1 8 0v7a4 4 0 0 1-8 0zM5 10v2a7 7 0 0 0 14 0v-2M12 19v4M8 23h8',screen:'M3 3h18v15H3zM8 22h8M12 18v4',book:'M3 3h7l2 2 2-2h7v17h-7l-2 2-2-2H3zM12 5v17'};
    return `<g transform="translate(${x} ${y}) scale(${size/24})" fill="none" stroke="${color}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.file}"/></g>`;
  };
  const button=(x,y,label,w=170,primary=false)=>rect(x,y,w,48,24,primary?'url(#accent)':p.soft)+text(x+w/2,y+32,label,21,primary?'#fff':p.copy,500,'text-anchor="middle"');
  function wave(x,y,w,color,seed=0) {
    return Array.from({length:46},(_,i)=>{
      // Quantize decorative bars so SVG output is stable across JS engines/CPUs.
      const h=Math.round((6+Math.abs(Math.sin(i*1.7+seed)*Math.cos(i*.47+seed))*36)*100)/100;
      return rect(Number((x+i*w/46).toFixed(2)),Number((y-h/2).toFixed(2)),3,h,1.5,color);
    }).join('');
  }
  function shell(body, active='助手') {
    const nav=['助手','场景','记录','设置'];
    return `<ellipse cx="800" cy="1026" rx="660" ry="6" fill="#101626" opacity=".16" filter="url(#contact-shadow)"/>`+
      `<g filter="url(#device-shadow)">`+
      rect(50,18,1500,966,34,'url(#metal)','#7b8498')+
      rect(53,21,1494,960,31,'none','url(#rim-light)')+
      rect(60,28,1480,946,28,'#10131b')+
      `<path d="M87 42H1513" stroke="#bfc8db" stroke-opacity=".25"/>`+
      `<circle cx="800" cy="34" r="3.2" fill="#090d15" stroke="#8491aa" stroke-width=".6"/><circle cx="799.3" cy="33.3" r=".8" fill="#7186a5"/>`+
      `<g clip-path="url(#display)">`+rect(74,42,1452,912,16,p.canvas)+
      rect(74,42,1452,82,0,p.panel)+line(74,124,1526,124)+
      ['#ff6a65','#f8c34b','#62c878'].map((c,i)=>`<circle cx="${108+i*26}" cy="82" r="8" fill="${c}"/>`).join('')+
      text(196,91,'InterviewHacker',24,p.ink,500)+
      rect(450,60,492,46,23,p.soft)+nav.map((n,i)=>(n===active?rect(456+i*121,64,117,38,19,p.tint):'')+text(515+i*121,90,n,21,n===active?p.accent:p.copy,500,'text-anchor="middle"')).join('')+
      `<circle cx="1182" cy="82" r="5" fill="${p.green}"/>`+text(1198,89,'本机语音已就绪',18,p.copy)+text(1473,90,'Ⅱ',23,p.copy)+
      body+`</g>`+
      `<path d="M88 44H1511" stroke="#fff" stroke-opacity=".18"/>`+
      text(800,972,'I N T E R V I E W H A C K E R',9,'#98a3ba',500,'text-anchor="middle"')+
      `<path d="M18 988H1582L1546 1018Q1540 1026 1518 1026H82Q60 1026 54 1018Z" fill="url(#base)" stroke="#9ca6bb" stroke-width=".8"/>`+
      `<path d="M18 989H1582" stroke="#f4f6fd" stroke-opacity=".8"/>`+
      `<path d="M652 988H948L934 999Q932 1001 926 1001H674Q668 1001 666 999Z" fill="url(#notch)"/>`+
      `<path d="M64 1017H1536" stroke="#f0f3fc" stroke-opacity=".34"/>`+
      `<path d="M82 1025H1518" stroke="#3a4356" stroke-opacity=".74"/></g>`;
  }
  function sidebar(mode='scene', selected='产品设计面试') {
    let out=rect(92,144,230,790,20,p.panel)+text(114,190,mode==='settings'?'设置':mode==='record'?'会话记录':'我的场景',24,p.ink,500)+(mode==='settings'?'':text(286,190,'＋',24,p.copy));
    const list=mode==='settings'?['语音识别','对话服务','资料与记录','高级选项']:mode==='record'?['产品设计面试','产品周会','研究进展汇报','数据结构课程']:['产品设计面试','研究进展汇报','产品周会','数据结构课程'];
    list.forEach((s,i)=>{
      let y=220+i*102,sel=s===selected;
      out+=rect(104,y,206,88,14,sel?p.tint:p.panel)+icon(120,y+16,['folder','book','wave','file'][i],sel?p.accent:p.copy,20)+text(120,y+66,s,20,sel?p.accent:p.ink,sel?500:400);
    });
    return out+line(112,696,302,696)+icon(116,726,'folder',p.copy,21)+text(150,745,'资料保存在本机',18,p.copy)+text(114,894,'每场对话，独立准备。',16,p.copy);
  }
  const heading=(title,sub)=>text(372,194,title,34,p.ink,500)+(sub?text(374,233,sub,20,p.copy):'');
  function conversation(context=false) {
    let out=sidebar()+rect(342,144,508,790,20,p.panel)+rect(868,144,640,790,20,p.panel);
    out+=text(370,190,context?'当前场景与资料':'实时对话',29,p.ink,500)+chip(676,163,'面试',144,true);
    if(context){
      const cards=[['当前场景','产品设计面试','关注设计取舍与跨团队协作'],['相关资料','个人简历 · 岗位说明','已加入当前场景'],['经验与题库','跨团队项目复盘','先讲结论，再补充行动与结果']];
      cards.forEach(([label,title,desc],i)=>{let y=226+i*181;out+=rect(366,y,460,158,17,p.soft)+icon(388,y+22,['folder','file','spark'][i],p.accent,23)+text(424,y+43,label,19,p.copy)+text(388,y+88,title,26,p.ink,500)+text(388,y+126,desc,20,p.copy);});
      out+=chip(370,807,'只参考当前场景',226,true);
    }else{
      [['对方 · 系统声音',p.accent,0],['我 · 麦克风',p.green,2]].forEach(([label,c,seed],i)=>{
        let y=224+i*110;out+=rect(366,y,460,94,16,p.soft)+icon(384,y+18,i?'mic':'wave',c,23)+text(420,y+38,label,20,p.copy)+wave(384,y+68,416,c,seed);
      });
      out+=text(372,490,'对方',20,p.copy)+rect(366,510,460,130,18,p.soft)+lines(388,552,['你是怎样推动跨团队合作，','让一个有分歧的项目落地的？'],25,p.ink,40);
      out+=text(372,690,'我',20,p.copy)+rect(404,710,422,126,18,p.tint)+lines(426,752,['我会先找到共同目标，','再把分歧转成可验证的方案。'],23,p.ink,38);
      const flow=[['双路识别',p.green],['问题整理',p.accent],['建议回答',p.accent]];
      flow.forEach(([label,color],i)=>{
        const x=370+i*156;
        out+=rect(x,864,136,38,19,i===2?p.tint:p.soft)+`<circle cx="${x+17}" cy="883" r="3" fill="${color}"/>`+text(x+31,889,label,17,i===2?p.accent:p.copy,500);
        if(i<2)out+=`<path d="M${x+142} 883H${x+150}m-3-3 3 3-3 3" stroke="${p.copy}" stroke-opacity=".6" stroke-linecap="round" stroke-linejoin="round"/>`;
      });
    }
    out+=icon(896,175,'spark',p.accent,26)+text(935,197,'建议回答',29,p.ink,500)+chip(1316,169,'当前场景',164,true)+
      line(894,220,1482,220)+text(900,266,'如何推动跨团队合作？',23,p.copy)+
      text(900,335,'先对齐目标，再验证方案。',30,p.ink,500)+
      lines(900,393,['在项目初期，我会先明确共同的','业务目标，把不同意见拆成可比较的','方案与判断标准。'],25,p.ink,42)+
      lines(900,555,['01   先听清各方真正关心的问题。','02   用小范围验证建立共同依据。','03   明确分工、节点和下一步行动。'],24,p.copy,52)+
      chip(896,755,'简历 · 项目经历',222,true)+chip(1132,755,'经验 · 协作复盘',222)+
      line(894,820,1482,820)+button(896,848,'更简短',128)+button(1038,848,'举例',108)+button(1160,848,'STAR',108)+button(1282,848,'继续追问',196,true);
    return shell(out);
  }
  function workspace() {
    let out=sidebar()+heading('每场对话，都有自己的背景。','选择场景，带入对应的目标、资料和回答要求。');
    out+=chip(370,265,'资料与要求',170,true)+chip(554,265,'经验与题库',170)+chip(738,265,'复盘',108);
    out+=rect(368,332,536,580,20,p.panel)+rect(924,332,584,580,20,p.panel);
    out+=text(394,381,'产品设计面试',30,p.ink,500)+chip(732,352,'面试场景',146,true);
    [['目标角色','产品设计师'],['沟通目标','用项目证据讲清设计取舍'],['回答要求','先给结论，再说明过程和结果']].forEach(([label,value],i)=>{
      let y=420+i*142;out+=text(396,y,label,20,p.copy)+rect(392,y+20,488,80,13,p.soft)+text(414,y+68,value,24,p.ink);
    });
    out+=text(954,381,'本次准备',27,p.ink,500);
    [['file','个人简历.pdf','项目经历与个人优势'],['file','岗位说明.pdf','职责、要求与关注重点'],['spark','跨团队项目复盘','可复用的过程与经验']].forEach(([i,t,d],n)=>{
      let y=414+n*128;out+=rect(948,y,536,108,16,p.soft)+icon(968,y+25,i,p.accent,29)+text(1016,y+44,t,24,p.ink,500)+text(1016,y+80,d,20,p.copy);
    });
    out+=line(950,834,1480,834)+icon(958,858,'check',p.green,24)+text(998,881,'回答仅使用当前场景的相关背景',21,p.copy);
    return shell(out,'场景');
  }
  function materials(course=false) {
    let out=sidebar('scene',course?'数据结构课程':'产品设计面试')+heading(course?'课件、问题与笔记，放在一起。':'让资料和技能，参与每次回答。',course?'数据结构课程 · 独立的课程背景':'产品设计面试 · 资料与要求');
    out+=chip(370,265,'资料',112,true)+chip(496,265,'经验与题库',180)+chip(690,265,'技能',112);
    out+=rect(368,332,462,580,20,p.panel)+rect(850,332,658,580,20,p.panel);
    out+=text(394,378,'场景资料',25,p.ink,500)+text(790,378,'＋',26,p.accent);
    const fs=course?['课程课件.pdf','课堂笔记.md','练习与问题.md']:['个人简历.pdf','岗位说明.pdf','项目复盘.md'];
    fs.forEach((f,i)=>{let y=400+i*100;out+=rect(388,y,422,84,14,i===0?p.tint:p.soft)+icon(406,y+25,'file',i===0?p.accent:p.copy,25)+text(450,y+38,f,23,p.ink,500)+text(450,y+66,i===0?'已解析 · 可用于回答':'已加入当前场景',17,p.copy);});
    out+=line(390,726,808,726)+icon(396,751,'spark',p.accent,24)+text(434,775,'回答技能',23,p.ink,500)+chip(700,749,'启用',94,true)+
      lines(396,824,course?['先解释概念，再结合课件举例。','只应用于当前课程场景。']:['先讲结论 → 提供证据 → 下一步','只应用于当前面试场景。'],20,p.copy,36);
    out+=text(884,383,course?'课堂笔记':'个人简历',27,p.ink,500)+chip(1320,352,'全文',156)+line(878,406,1480,406)+
      text(886,455,course?'哈希表与冲突处理':'项目经历',30,p.ink,500)+
      rect(882,488,594,92,12,p.tint)+lines(904,526,course?['哈希表通过映射规则快速定位元素，','冲突处理决定了数据如何继续存储。']:['跨团队协作平台设计','负责目标对齐、方案验证与交付推进。'],24,p.ink,36)+
      text(886,631,course?'本节要点':'过程与结果',24,p.ink,500)+
      lines(886,678,course?['• 链地址法：在同一位置维护多个元素。','• 开放寻址：为冲突元素寻找新的位置。','• 结合课件中的例子理解不同取舍。']:['• 访谈业务、设计与研发，明确共同目标。','• 用原型验证分歧，保留关键决策依据。','• 将复盘整理为下一次可复用的经验。'],22,p.copy,48)+
      line(880,838,1480,838)+icon(886,860,'check',p.green,23)+text(924,881,'资料在本机解析与保存',21,p.copy);
    return shell(out,'场景');
  }
  function review(meeting=false) {
    let out=sidebar('record',meeting?'产品周会':'产品设计面试')+heading(meeting?'产品周会 · 决定事项与下一步':'对话结束，经验继续积累。',meeting?'议程、讨论重点与行动事项':'产品设计面试 · 会话记录与复盘');
    out+=chip(370,265,'摘要',112,true)+chip(496,265,'问题',112)+chip(622,265,'转录',112)+chip(748,265,'回答',112);
    out+=rect(368,332,462,580,20,p.panel)+rect(850,332,658,580,20,p.panel);
    out+=text(396,381,meeting?'讨论脉络':'问题回顾',26,p.ink,500);
    const qs=meeting?['本轮验证希望解决什么问题？','先在哪个范围进行验证？','下一次需要带回哪些结果？']:['你如何推动跨团队合作？','方案产生分歧时怎么处理？','这次项目带给你哪些经验？'];
    qs.forEach((q,i)=>{let y=414+i*136;out+=rect(390,y,418,114,15,i===0?p.tint:p.soft)+text(410,y+34,`0${i+1}`,18,p.accent,500)+lines(410,y+72,[q.slice(0,14),q.slice(14)].filter(Boolean),23,p.ink,32);});
    out+=icon(398,858,'clock',p.copy,23)+text(436,880,'完整转录与回答可回看',21,p.copy);
    out+=text(882,381,meeting?'会议摘要':'这次对话的重点',27,p.ink,500)+
      rect(878,408,602,178,16,p.tint)+lines(902,454,meeting?['先用小范围验证方案，','确认关键假设后再扩大投入。','下一次对齐时，带回结果与问题。']:['项目表达的重点是「取舍依据」。','把共同目标、验证过程和个人行动','连起来，比罗列职责更有说服力。'],25,p.ink,43)+
      text(884,638,meeting?'行动事项':'下一次可以这样改进',24,p.ink,500)+
      lines(884,684,meeting?['01   产品：明确验证目标与范围。','02   设计：补齐核心流程与原型。','03   研发：同步方案限制与依赖。']:['01   先说结论，避免铺垫过长。','02   补充一次关键分歧的具体处理。','03   为追问准备行动与结果的证据。'],22,p.copy,48)+
      button(882,838,meeting?'加入后续准备':'整理为场景经验',276,true)+button(1176,838,'回看完整记录',282);
    return shell(out,'记录');
  }
  function prompter() {
    let out=rect(74,124,1452,830,0,p.canvas)+`<g opacity=".3">`+rect(158,190,1180,624,22,p.panel,p.line)+
      text(202,246,'实时对话',24,p.copy)+line(190,280,1308,280)+rect(202,318,340,118,16,p.soft)+rect(202,462,340,182,16,p.soft)+rect(580,318,710,394,16,p.soft)+`</g>`;
    out+=text(240,250,'悬浮提词器',30,p.ink,500)+text(240,288,'把重点留在视线里，让表达保持自然。',23,p.copy);
    out+=`<g filter="url(#card-shadow)">`+rect(238,340,1124,438,24,p.panel,p.line)+`</g>`+
      `<circle cx="273" cy="378" r="6" fill="${p.green}"/>`+text(292,385,'正在聆听',19,p.copy)+text(1174,385,'−    A    ＋',21,p.copy)+
      line(264,408,1334,408)+text(274,451,'如何推动跨团队合作？',24,p.copy)+
      lines(274,516,['先把分歧，转成共同目标。','用小范围验证找到依据，','再明确分工与下一步行动。'],38,p.ink,60,500)+
      line(264,680,1334,680)+button(274,704,'更简短',160)+button(448,704,'举例',126)+button(588,704,'STAR',126)+button(1042,704,'继续回答',280,true)+
      text(248,844,'助手窗口、悬浮提词器，按场合选择。',22,p.copy);
    return shell(out);
  }
  function phone() {
    return `<g filter="url(#phone-shadow)">`+rect(24,12,392,832,58,'url(#metal)','#777d91')+rect(31,19,378,818,52,'#101219')+
      rect(40,28,360,800,45,p.canvas)+rect(164,43,112,29,15,'#101219')+
      text(69,64,'9:41',16,p.ink,500)+text(337,64,'•••',15,p.ink)+
      icon(64,109,'wave',p.accent,24)+text(101,130,'手机伴侣',24,p.ink,500)+
      chip(66,154,'同一 Wi-Fi',150,true)+line(62,214,378,214)+
      text(66,250,'当前问题',18,p.copy)+rect(60,268,320,124,19,p.panel)+lines(78,308,['你是怎样推动跨团队合作，','让有分歧的项目落地的？'],22,p.ink,36)+
      icon(66,428,'spark',p.accent,22)+text(99,448,'建议回答',22,p.ink,500)+
      rect(60,470,320,246,19,p.panel)+lines(80,514,['先对齐共同目标，','再验证方案。'],27,p.ink,42,500)+
      lines(80,622,['把不同意见变成可比较的','方案，明确分工与下一步。'],19,p.copy,32)+
      text(220,762,'当前问题与回答，同步查看',15,p.copy,400,'text-anchor="middle"')+
      rect(162,804,116,5,3,p.ink)+`</g>`;
  }
  function devices() {
    return `<g transform="translate(0 112) scale(.78)">${conversation()}</g><g transform="translate(1130 90) scale(.9)">${phone()}</g>`;
  }
  function lecture() {
    let out=sidebar('scene','研究进展汇报')+heading('研究进展汇报','论文、讲稿与听众的问题，在同一场景准备。');
    out+=rect(368,270,474,642,20,p.panel)+rect(862,270,646,642,20,p.panel);
    out+=text(396,318,'讲稿与资料',26,p.ink,500)+chip(646,288,'报告场景',168,true)+line(392,344,816,344)+
      text(396,394,'02  方法与实验',27,p.ink,500)+
      rect(392,420,426,190,16,p.tint)+lines(416,465,['先交代问题与限制，','再说明方法的关键选择，','最后回到实验支持的结论。'],24,p.ink,43)+
      icon(398,662,'file',p.accent,25)+text(438,685,'论文.pdf',23,p.ink)+
      icon(398,719,'file',p.copy,25)+text(438,742,'报告讲稿.md',23,p.ink)+
      icon(398,776,'file',p.copy,25)+text(438,799,'演示幻灯片.pdf',23,p.ink)+
      text(894,318,'准备应对听众的追问',26,p.ink,500)+
      rect(888,354,594,108,16,p.soft)+lines(910,397,['为什么选择这个基线？','在什么条件下，这个方法不适用？'],24,p.ink,38)+
      text(896,522,'先解释选择依据。',30,p.ink,500)+
      lines(896,576,['从任务目标与限制出发，','说明比较的对象、控制的变量，','以及实验支持结论的范围。'],27,p.copy,48)+
      chip(890,756,'论文 · 实验设计',240,true)+button(890,834,'更简短',160)+button(1064,834,'补充解释',192,true);
    return shell(out,'场景');
  }
  function privacy() {
    let out=sidebar('settings','资料与记录')+heading('数据去向，由你决定。','本机识别与保存，外部服务按配置使用。');
    out+=rect(368,278,1140,634,20,p.panel);
    const cs=[{x:392,title:'保存在本机',icon:'folder',items:['场景资料','会话转录与回答','经验与题库'],foot:'原始音频不保存'},
      {x:758,title:'用于生成回答',icon:'spark',items:['当前问题与转录','相关资料与启用的技能','按需提供的截图'],foot:'发送至所配置的回答引擎'},
      {x:1124,title:'按需启用',icon:'settings',items:['云端语音识别','联网搜索','同一网络的手机伴侣'],foot:'由你选择与控制'}];
    cs.forEach(({x,title,icon:i,items,foot})=>{
      out+=rect(x,314,338,488,17,p.soft)+icon(x+24,344,i,p.accent,32)+text(x+24,422,title,29,p.ink,500)+
        lines(x+24,488,items,23,p.copy,57)+line(x+24,690,x+314,690)+text(x+24,739,foot,18,p.accent,500);
    });
    out+=icon(400,851,'check',p.green,24)+text(440,875,'保留控制权，让每一次使用都清楚。',23,p.copy);
    return shell(out,'设置');
  }
  return {conversation:()=>conversation(),context:()=>conversation(true),workspace,materials:()=>materials(),review:()=>review(),prompter,phone,devices,lecture,meeting:()=>review(true),course:()=>materials(true),privacy};
}

const titles={conversation:'双路实时对话与建议回答',context:'结合场景资料的回答',workspace:'独立场景与回答要求',materials:'场景资料与回答技能',review:'会话记录与复盘',prompter:'悬浮提词器',phone:'手机伴侣',devices:'助手窗口与手机伴侣',lecture:'学术报告与讲稿准备',meeting:'会议记录与行动事项',course:'课程资料与笔记',privacy:'本机数据与服务使用'};
// Keep the physical display aperture identical in every desktop scene. The page
// can transform one device between hero and content without remapping UI pixels.
const definitions = `<defs>
  <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7265ed"/><stop offset="1" stop-color="#9769ee"/></linearGradient>
  <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e1e6f1"/><stop offset=".12" stop-color="#9aa4b8"/><stop offset=".56" stop-color="#737f96"/><stop offset=".86" stop-color="#b2bbcc"/><stop offset="1" stop-color="#5d6980"/></linearGradient>
  <linearGradient id="rim-light" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#fff" stop-opacity=".8"/><stop offset=".42" stop-color="#e0e8fb" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity=".4"/></linearGradient>
  <linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f0f3fa"/><stop offset=".16" stop-color="#c7d0df"/><stop offset=".55" stop-color="#a4b0c5"/><stop offset="1" stop-color="#67758f"/></linearGradient>
  <linearGradient id="notch" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#6c7991"/><stop offset="1" stop-color="#b8c3d5"/></linearGradient>
  <clipPath id="display"><rect x="74" y="42" width="1452" height="912" rx="16"/></clipPath>
  <filter id="device-shadow" x="-8%" y="-6%" width="116%" height="126%"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#0d1426" flood-opacity=".17"/></filter>
  <filter id="contact-shadow" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="15" stdDeviation="17" flood-color="#0d1426" flood-opacity=".16"/></filter>
  <filter id="phone-shadow" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#0d1426" flood-opacity=".18"/></filter>
</defs>`.replace(/>\s+</g,'><');
const out=path.join(root,'public/story/assets/product-scenes');
const check=process.argv.includes('--check');
await mkdir(out,{recursive:true});
for (const [theme,p] of Object.entries(palettes)) {
  const screens=drawing(p);
  for(const [name,draw] of Object.entries(screens)) {
    const phone=name==='phone',w=phone?440:1600,h=phone?860:1044;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none"><title>${titles[name]}</title>${definitions}<g font-family="'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif" text-rendering="geometricPrecision">${draw()}</g></svg>\n`;
    const file=path.join(out,`${name}-${theme}.svg`);
    if(check){if(await readFile(file,'utf8')!==svg)throw Error(`Stale product artwork: ${name}-${theme}.svg`);}
    else await writeFile(file,svg);
  }
}
console.log(`${check?'Verified':'Generated'} ${Object.keys(titles).length*2} product screens.`);
