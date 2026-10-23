import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root} from './catalog.mjs';

// Editable product artwork. Layouts follow the shipping macOS app (assets/ih/ screenshots):
// top navigation, scene and audio-source pickers, question bar, streamed answer with
// adjust chips. Content is realistic sample data for each scenario; it never states
// product speed or accuracy figures.
const palettes = {
  light: {canvas:'#eef0f6', canvas2:'#e9e6f6', panel:'#ffffff', soft:'#f4f5fa', soft2:'#eceef6', ink:'#1f2335', copy:'#5d6680', faint:'#8a92a8', line:'#e1e5ee', tint:'#ece9ff', tint2:'#ddd8ff', accent:'#6a5cf0', accentInk:'#5a4de0', green:'#1f9d6a', orange:'#e88a2e', red:'#e25b5b', me:'#e7e3ff', glass:'#ffffff', video:'#d9dde8', videoInk:'#4a5268'},
  dark: {canvas:'#151926', canvas2:'#221d3a', panel:'#1d2232', soft:'#262c3f', soft2:'#2d3449', ink:'#f1f3fb', copy:'#b3bcd2', faint:'#7f89a3', line:'#323a50', tint:'#35305a', tint2:'#433b78', accent:'#a99cff', accentInk:'#c4bbff', green:'#6fdcae', orange:'#f2a35a', red:'#ff7d7d', me:'#3a3366', glass:'#1a1f2e', video:'#232838', videoInk:'#9aa3ba'}
};
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const n = v => Number(v.toFixed(2));

// Approximate advance widths so text can wrap inside fixed panels without a browser.
function charWidth(ch, size) {
  if (/[⺀-鿿豈-﫿＀-｠　-〿]/.test(ch)) return size;
  if (ch === ' ') return size * .3;
  if (/[A-Z]/.test(ch)) return size * .64;
  if (/[0-9]/.test(ch)) return size * .56;
  if (/[a-z]/.test(ch)) return size * .53;
  if (/[.,:;'!|]/.test(ch)) return size * .3;
  return size * .5;
}
const textWidth = (s, size) => [...s].reduce((w, ch) => w + charWidth(ch, size), 0);
// Tokens keep Latin words and numbers together; CJK breaks per character.
function tokens(s) { return s.match(/[A-Za-z0-9_.\-+/·%()=\[\]]+\s?|\s|./gu) || []; }
function wrapRich(segments, size, max, firstIndent = 0) {
  const lines = [[]];
  let width = firstIndent;
  for (const [str, bold] of segments) {
    for (const t of tokens(str)) {
      const w = textWidth(t, size);
      // Closing punctuation never starts a line; it may hang past the edge instead.
      if (width + w > max && width > 0 && t !== ' ' && !/^[，。、；：？！）」』,.;:?!)\]]/.test(t)) { lines.push([]); width = 0; }
      const line = lines[lines.length - 1];
      const last = line[line.length - 1];
      if (last && last[1] === bold) last[0] += t; else line.push([t, bold]);
      width += w;
    }
  }
  return lines;
}

function drawing(p) {
  const rect=(x,y,w,h,r=18,fill=p.panel,stroke='none',extra='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${r}" fill="${fill}" stroke="${stroke==='none'&&fill===p.panel?p.line:stroke}" ${extra}/>`;
  const text=(x,y,s,size=22,fill=p.ink,weight=400,extra='')=>`<text x="${n(x)}" y="${n(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(s)}</text>`;
  const line=(x1,y1,x2,y2=y1,color=p.line)=>`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}"/>`;
  // Rich paragraph: [[text,bold]] segments wrapped to `max`, returns {svg,height}.
  function para(x,y,segments,size,max,{fill=p.ink,boldFill=fill,gap=size*1.6,weight=400,indent=0}={}){
    const ls=wrapRich(segments,size,max,indent);
    const svg=ls.map((segs,i)=>`<text x="${n(i===0?x+indent:x)}" y="${n(y+i*gap)}" font-size="${size}" fill="${fill}" font-weight="${weight}">${segs.map(([t,b])=>b?`<tspan font-weight="600" fill="${boldFill}">${esc(t)}</tspan>`:esc(t)).join('')}</text>`).join('');
    return {svg,height:ls.length*gap,lines:ls.length};
  }
  const icon=(x,y,name,color=p.copy,size=24,sw=1.7)=>{
    const paths={
      wave:'M3 12h2m3-5v10m4-13v16m4-12v8m3-5h2',layers:'m12 3 9 5-9 5-9-5zM3 13l9 5 9-5',clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
      settings:'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
      file:'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',check:'m5 12.5 4.5 4.5L19 7',arrow:'M5 12h14m-6-6 6 6-6 6',spark:'m12 3 2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z',
      mic:'M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21',speaker:'M4 9h4l5-4v14l-5-4H4zM17 8.5a5 5 0 0 1 0 7',
      chat:'M4 5h16v11H9l-5 4z',person:'M4 5h16v14H4zM12 9a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M8 17c1-1.6 2.3-2.4 4-2.4s3 .8 4 2.4',
      cap:'m2 9 10-5 10 5-10 5zM6 11v5c3.5 2.5 8.5 2.5 12 0v-5',bag:'M4 8h16v12H4zM9 8V5h6v3',book:'M4 4h7l1 1 1-1h7v16h-7l-1 1-1-1H4zM12 5v16',
      search:'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M15.5 15.5 20 20',globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3',
      copy:'M8 8h12v12H8zM16 8V4H4v12h4',refresh:'M20 11a8 8 0 0 0-14-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14 4.9L20 16m0 4v-4h-4',
      down:'M12 5v12m-5-5 5 5 5-5',shrink:'M4 14h6v6M20 10h-6V4M14 10l6-6M4 20l6-6',expand:'M14 4h6v6M10 20H4v-14M20 4l-6 6M4 20l6-6',
      bulb:'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3',star:'m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
      lang:'M4 5h16v14H4zM8 15l2.5-6 2.5 6M8.8 13h3.4M15 9h3M16.5 9c0 3-1 5-2.5 6',help:'M9.2 9a3 3 0 1 1 4.3 2.7c-.9.4-1.5 1.2-1.5 2.2v.6M12 18h.01',
      camera:'M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3',lock:'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',pause:'M8 5v14M16 5v14',stop:'M6 6h12v12H6z',window:'M3 5h18v14H3zM3 9h18',
      layout:'M4 5h7v14H4zM14 5h6v6h-6zM14 14h6v5h-6',send:'M12 19V5m-6 6 6-6 6 6',bolt:'M13 2 5 14h6l-1 8 8-12h-6z',plus:'M12 5v14M5 12h14',chevron:'m8 10 4-4 4 4M8 14l4 4 4-4',
      left:'m14 6-6 6 6 6',right:'m10 6 6 6-6 6',pin:'M9 4h6l-1 6 3 3H7l3-3zM12 13v7',pointer:'M5 3l14 7-6 2-2 6z',eye:'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
      phone:'M8 3h8v18H8zM11 18h2',slides:'M3 4h18v12H3zM12 16v4M8 20h8',table:'M4 5h16v14H4zM4 10h16M10 5v14'};
    return `<g transform="translate(${n(x)} ${n(y)}) scale(${n(size/24)})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.file}"/></g>`;
  };
  const chip=(x,y,label,{w,active=false,h=34,size=16,ic=null,fill,color}={})=>{
    const width=w??(textWidth(label,size)+(ic?52:30));
    return rect(x,y,width,h,h/2,fill??(active?p.tint:p.soft),active?'none':p.line)+(ic?icon(x+13,y+(h-18)/2,ic,color??(active?p.accentInk:p.copy),18):'')+
      text(x+(ic?40:width/2),y+h/2+size*.36,label,size,color??(active?p.accentInk:p.copy),500,ic?'':'text-anchor="middle"');
  };
  const chipW=(label,size=16,ic=false)=>textWidth(label,size)+(ic?52:30);
  const row=(x,y,labels,opts={})=>{let out='',cx=x;for(const l of labels){const [label,ic,active]=Array.isArray(l)?l:[l];out+=chip(cx,y,label,{...opts,ic,active});cx+=chipW(label,opts.size??16,!!ic)+10;}return out;};
  const button=(x,y,label,w,primary=false,ic=null,h=48)=>rect(x,y,w,h,h/2,primary?'url(#accent)':p.soft,primary?'none':p.line)+
    (ic?icon(x+18,y+(h-20)/2,ic,primary?'#fff':p.copy,20):'')+text(ic?x+46:x+w/2,y+h/2+7,label,19,primary?'#fff':p.copy,500,ic?'':'text-anchor="middle"');
  function wave(x,y,w,h,color,seed=0,count=48){
    return Array.from({length:count},(_,i)=>{
      // Quantize decorative bars so SVG output is stable across JS engines/CPUs.
      const v=Math.abs(Math.sin(i*1.7+seed)*Math.cos(i*.47+seed*1.3));
      const env=.35+.65*Math.sin(Math.PI*(i+.5)/count);
      const bh=Math.round((3+v*env*h)*100)/100;
      return rect(x+i*w/count,y-bh/2,2.6,bh,1.3,color);
    }).join('');
  }
  const panel=(x,y,w,h)=>rect(x,y,w,h,22,p.panel,p.line);
  const panelHead=(x,y,ic,title,extra='')=>icon(x,y-19,ic,p.copy,22)+text(x+32,y,title,21,p.ink,600)+extra;

  /* ---------- Device + app chrome ---------- */
  function shell(body, active='助手', {timer='14:06', bare=false}={}) {
    const nav=[['助手','wave'],['场景','layers'],['记录','clock'],['设置','settings']];
    let chrome=rect(74,42,1452,912,16,'url(#canvas)')+`<ellipse cx="1300" cy="900" rx="700" ry="420" fill="url(#corner-glow)"/>`+
      ['#ff6a65','#f8c34b','#62c878'].map((c,i)=>`<circle cx="${106+i*24}" cy="68" r="7" fill="${c}"/>`).join('')+
      rect(250,72,486,56,28,p.panel,p.line);
    nav.forEach(([label,ic],i)=>{
      const x=256+i*120,on=label===active;
      if(on)chrome+=rect(x,77,114,46,23,p.tint);
      chrome+=icon(x+20,89,ic,on?p.accentInk:p.copy,22)+text(x+50,108,label,20,on?p.accentInk:p.copy,on?600:500);
    });
    chrome+=rect(1190,72,150,56,28,p.panel,p.line)+`<circle cx="1216" cy="100" r="6" fill="${p.green}"/>`+text(1232,108,timer,20,p.ink,500)+
      rect(1300,90,3,20,1.5,p.accent)+rect(1307,96,3,14,1.5,p.green);
    [['pause',1384],['stop',1444],['window',1500]].forEach(([ic,cx])=>{chrome+=`<circle cx="${cx-6}" cy="100" r="25" fill="${p.panel}" stroke="${p.line}"/>`+icon(cx-17,89,ic,p.ink,22,2);});
    return `<ellipse cx="800" cy="1026" rx="660" ry="6" fill="#101626" opacity=".16" filter="url(#contact-shadow)"/>`+
      `<g filter="url(#device-shadow)">`+
      rect(50,18,1500,966,34,'url(#metal)','#7b8498')+
      rect(53,21,1494,960,31,'none','url(#rim-light)')+
      rect(60,28,1480,946,28,'#0c0f16')+
      `<circle cx="800" cy="34" r="3.2" fill="#090d15" stroke="#8491aa" stroke-width=".6"/><circle cx="799.3" cy="33.3" r=".8" fill="#7186a5"/>`+
      `<g clip-path="url(#display)">`+(bare?'':chrome)+body+`</g>`+
      `<path d="M88 44H1511" stroke="#fff" stroke-opacity=".14"/>`+
      text(800,972,'I N T E R V I E W H A C K E R',9,'#98a3ba',500,'text-anchor="middle"')+
      `<path d="M18 988H1582L1546 1018Q1540 1026 1518 1026H82Q60 1026 54 1018Z" fill="url(#base)" stroke="#9ca6bb" stroke-width=".8"/>`+
      `<path d="M18 989H1582" stroke="#f4f6fd" stroke-opacity=".8"/>`+
      `<path d="M652 988H948L934 999Q932 1001 926 1001H674Q668 1001 666 999Z" fill="url(#notch)"/>`+
      `<path d="M64 1017H1536" stroke="#f0f3fc" stroke-opacity=".34"/>`+
      `<path d="M82 1025H1518" stroke="#3a4356" stroke-opacity=".74"/></g>`;
  }

  /* ---------- Assistant page ---------- */
  function transcript(x,y,w,items){
    let out='',cy=y;
    for(const it of items){
      if(it.time){out+=text(x+4,cy+16,it.time,15,p.faint);cy+=28;continue;}
      if(it.tag){out+=icon(x+2,cy-2,'chat',p.accent,18)+text(x+28,cy+13,it.tag,15,p.accentInk,600)+(it.at?text(x+28+textWidth(it.tag,15)+12,cy+13,it.at,15,p.faint):'');cy+=26;continue;}
      if(it.echo){
        const r=para(x+34,cy+18,[[it.echo,false]],16,w-150,{fill:p.faint,gap:24});
        out+=icon(x+6,cy+2,'speaker',p.faint,18)+`<g text-decoration="line-through">${r.svg}</g>`+text(x+w-6,cy+18,'是我说的',16,p.accentInk,600,'text-anchor="end"');
        cy+=r.height+14;continue;
      }
      const me=it.who==='me',size=19,max=w*.74;
      const r=wrapRich([[it.text,false]],size,max-36);
      const bw=Math.min(max,Math.max(...r.map(l=>textWidth(l.map(s=>s[0]).join(''),size)))+36),bh=r.length*31+22;
      const bx=me?x+w-bw:x;
      out+=rect(bx,cy,bw,bh,16,me?p.me:p.soft,it.interim?p.faint:'none',it.interim?'stroke-dasharray="5 5"':'');
      out+=para(bx+18,cy+34,[[it.text,false]],size,max-36,{fill:it.interim?p.copy:p.ink,gap:31}).svg;
      cy+=bh+12;
    }
    return out;
  }
  function answerCard(x,y,w,h,a){
    let out=panel(x,y,w,h)+icon(x+24,y+22,'spark',p.accent,22)+text(x+56,y+41,a.label??'建议回答',20,p.accentInk,600);
    if(a.page)out+=`<circle cx="${x+w-104}" cy="${y+34}" r="17" fill="${p.soft}" stroke="${p.line}"/>`+icon(x+w-115,y+23,'left',p.copy,22)+text(x+w-70,y+41,a.page,16,p.copy,500,'text-anchor="middle"')+`<circle cx="${x+w-36}" cy="${y+34}" r="17" fill="${p.soft}" stroke="${p.line}"/>`+icon(x+w-47,y+23,'right',p.copy,22);
    let cy=y+82;
    const q=para(x+24,cy,[[a.q,false]],18,w-48,{fill:p.copy,gap:28});out+=q.svg;cy+=q.height+16;
    const head=para(x+24,cy,[[a.head,true]],23,w-48,{boldFill:p.ink,gap:36});out+=head.svg;cy+=head.height+12;
    for(const [lead,rest] of a.bullets){
      out+=`<circle cx="${x+30}" cy="${cy-7}" r="3" fill="${p.accent}"/>`;
      const r=para(x+46,cy,[[lead,true],[rest,false]],19,w-74,{boldFill:p.ink,gap:32});out+=r.svg;cy+=r.height+10;
    }
    if(a.sources){cy+=4;let sx=x+24;for(const s of a.sources){out+=chip(sx,cy,s,{size:14,h:30,ic:'file',active:true});sx+=chipW(s,14,true)+8;}}
    const by=y+h-108;
    out+=line(x+20,by-14,x+w-20,by-14);
    const adj=[['更简短','shrink'],['展开','expand'],['举例','bulb'],['STAR','star'],['英文版','lang'],['澄清','help']];
    let bx=x+20;for(const [l,ic] of adj){const on=a.active===l;out+=chip(bx,by,l,{ic,active:on,size:15,h:36});bx+=chipW(l,15,true)+8;}
    bx=x+20;for(const [l,ic] of [['复制','copy'],['重新生成','refresh'],['联网查一下','globe']]){out+=chip(bx,by+48,l,{ic,size:15,h:36});bx+=chipW(l,15,true)+8;}
    out+=text(x+w-24,by+72,a.meta??'Codex · Fast',15,p.faint,400,'text-anchor="end"');
    return out;
  }
  function questionBar(x,y,w,type,q,conf=.72){
    return panel(x,y,w,70)+icon(x+20,y+23,'wave',p.accent,22)+text(x+52,y+42,type,18,p.accentInk,600)+
      rect(x+56+textWidth(type,18),y+31,52,8,4,p.soft2,'none')+rect(x+56+textWidth(type,18),y+31,52*conf,8,4,p.orange,'none')+
      text(x+124+textWidth(type,18),y+43,q,19,p.ink,500)+rect(x+w-92,y+15,76,40,20,'url(#accent)','none')+text(x+w-54,y+42,'回答',18,'#fff',600,'text-anchor="middle"');
  }
  function inputBar(){
    return rect(90,884,1420,56,28,p.panel,p.line)+text(120,919,'输入问题，回车发送…',18,p.faint)+
      `<circle cx="1046" cy="912" r="19" fill="url(#accent)"/>`+icon(1035,901,'send','#fff',22,2.2)+
      `<circle cx="1102" cy="912" r="21" fill="${p.soft}" stroke="${p.line}"/>`+icon(1091,901,'layout',p.copy,22)+
      rect(1136,891,98,42,21,'url(#accent)','none')+icon(1150,902,'bolt','#fff',20)+text(1178,919,'Fast',17,'#fff',600)+
      `<circle cx="1268" cy="912" r="21" fill="${p.soft}" stroke="${p.line}"/>`+icon(1257,901,'camera',p.copy,22)+
      rect(1302,891,196,42,21,'url(#accent)','none')+icon(1318,902,'bolt','#fff',20)+text(1346,919,'立即回答',18,'#fff',600);
  }
  function assistant(s){
    let out=panel(90,146,700,s.leftH??552);
    out+=panelHead(112,188,s.leftIcon??'chat',s.leftTitle??'实时对话');
    let px=246;for(const [label,ic] of s.pickers){const w=textWidth(label,17)+80;out+=rect(px,164,w,38,19,p.soft,p.line)+icon(px+12,173,ic,p.copy,20)+text(px+40,189,label,17,p.ink,500)+icon(px+w-26,175,'chevron',p.faint,16);px+=w+10;}
    out+=`<circle cx="760" cy="183" r="18" fill="url(#accent)"/>`+icon(749,172,'down','#fff',22,2.2);
    out+=text(112,232,s.status,16,p.faint);
    out+=s.left;
    const by=146+(s.leftH??552)+16;
    out+=panel(90,by,700,866-by)+s.leftBottom(by);
    out+=questionBar(808,146,702,s.qtype,s.question,s.conf);
    out+=answerCard(808,232,702,634,s.answer);
    return shell(out+inputBar(),'助手',{timer:s.timer});
  }
  const lanes=(y)=>[[p.accent,'对方',0,'speaker'],[p.green,'我',2.3,'mic']].map(([c,label,seed,ic],i)=>
    rect(112+i*334,y,322,40,20,p.soft,'none')+icon(126+i*334,y+9,ic,c,20)+text(154+i*334,y+27,label,15,p.copy,500)+wave(196+i*334,y+20,240,22,c,seed,40)).join('');
  const recordList=(by,title,items)=>{
    let out=panelHead(112,by+42,'clock','回答记录')+text(232,by+42,String(items.length),15,p.faint);
    items.slice(0,1).forEach(([time,q,a])=>{out+=rect(110,by+56,660,76,14,p.tint,'none')+text(130,by+86,q,17,p.ink,600)+text(750,by+86,time,13,p.faint,400,'text-anchor="end"')+text(130,by+114,a,15,p.copy);});
    return out;
  };

  function conversation(){
    return assistant({
      timer:'14:06',leftH:576,pickers:[['字节后端二面','person'],['Zoom · 后端工程师二面','speaker']],
      status:'X-ASR 本地识别 · 每句整句精修 · 1 句疑似回声已忽略',
      left:lanes(248)+transcript(112,306,656,[
        {who:'them',text:'先聊聊你简历上的订单系统，大促时库存怎么扣？'},
        {who:'me',text:'库存先在 Redis 里用 Lua 原子扣减，再异步落库。'},
        {tag:'问题',at:'14:05:20'},
        {who:'them',text:'那数据库和缓存同时更新，怎么保证一致性？'},
        {echo:'数据库和缓存同时更新的时候你们怎么保证一致性'},
        {who:'me',text:'我们用的是先更新数据库、再删除缓存的方式。'},
        {who:'them',text:'如果删除缓存失败了怎么办…',interim:true}]),
      leftBottom:by=>recordList(by,'回答记录',[['14:05','数据库和缓存同时更新，怎么保证一致性？','先更新数据库再删缓存，用 binlog 订阅兜底，保证最终一致。'],['','','']]),
      qtype:'追问',question:'如果删除缓存失败了怎么办？',conf:.82,
      answer:{page:'2/2',q:'对方追问：如果删除缓存失败了怎么办？',head:'删除失败的 key 进重试队列，再用 binlog 订阅兜底删一次。',
        bullets:[['重试队列：','删除失败的 key 写进 MQ，消费端重试直到成功，超过次数告警。'],['binlog 兜底：','用 Canal 订阅 binlog，数据变更后异步再删一次。'],['延迟双删：','热点 key 更新后延迟几百毫秒再删，降低旧值被回填的概率。'],['取舍：','这是最终一致方案；余额这类强一致数据直接读库。']],active:'更简短'}
    });
  }
  function context(){
    const snips=[['简历','简历_后端_2026.pdf · 第 1 页','订单服务缓存层改造：Cache Aside + Canal 订阅 binlog，P99 从 120 ms 降到 18 ms。'],['题库','缓存一致性 · 被问 2 次','改进版：先给方案，再讲删除失败兜底和一致性取舍。'],['经验','置顶 · 一面复盘','上一轮反馈“项目讲得不够量化”，这次先报结果数字。']];
    let left='';
    snips.forEach(([cat,src,body],i)=>{
      const y=256+i*132;
      left+=rect(112,y,656,120,16,i===0?p.tint:p.soft,'none')+chip(130,y+16,cat,{size:14,h:28,active:true})+text(140+chipW(cat,14),y+36,src,16,p.copy,500)+text(744,y+36,`[${i+1}]`,16,p.accentInk,600,'text-anchor="end"');
      left+=para(132,y+76,[[body,false]],18,610,{gap:28}).svg;
    });
    return assistant({
      timer:'14:09',leftIcon:'layers',leftTitle:'本次参考',pickers:[['字节后端二面','person'],['只用当前场景','layers']],
      status:'按问题检索 3 段相关内容 · 不会把所有资料塞入上下文',
      left,
      leftBottom:by=>panelHead(112,by+42,'file','当前场景资料')+text(290,by+42,'4 份',15,p.faint)+
        row(112,by+66,[['简历_后端_2026.pdf','file',true],['抖音电商后端 JD.pdf','file']],{size:15,h:34})+row(112,by+110,[['字节后端面经.md','file'],['订单系统设计文档.md','file']],{size:15,h:34}),
      qtype:'明确提问',question:'这套缓存方案上线后，效果怎么样？',conf:.9,
      answer:{page:'1/1',q:'这套缓存方案上线后，效果怎么样？',head:'订单详情 P99 从 120 ms 降到 18 ms，大促 8 万 QPS 零故障。[1]',
        bullets:[['背景：','订单详情读多写少，大促时数据库是瓶颈。[1]'],['方案：','Cache Aside + binlog 订阅兜底，热点 key 加本地缓存。[1]'],['取舍：','接受最终一致；支付和余额不走缓存。[2]'],['补一句：','上轮被说不够量化，所以先给数字再讲过程。[3]']],
        sources:['简历 · 第 1 页','题库 · 缓存一致性','经验 · 置顶'],active:'举例'}
    });
  }
  function slide(x,y,w,h,kind){
    let out=rect(x,y,w,h,12,'#ffffff','#d7dbe6');
    const ink='#1f2335',sub='#6a7388',acc='#6a5cf0';
    if(kind==='mamba'){
      out+=text(x+22,y+38,'3.3  硬件感知的选择性扫描',20,ink,600)+text(x+w-20,y+38,'7 / 18',14,sub,500,'text-anchor="end"');
      out+=rect(x+24,y+58,150,104,10,'#eef0f8','#c9cee0')+text(x+99,y+86,'HBM',17,ink,600,'text-anchor="middle"')+text(x+99,y+112,'x, Δ, A, B, C',14,sub,400,'text-anchor="middle"')+text(x+99,y+138,'输出 y',14,sub,400,'text-anchor="middle"');
      out+=rect(x+w-210,y+58,186,104,10,'#ece9ff','#b8aef5')+text(x+w-117,y+86,'SRAM',17,acc,600,'text-anchor="middle"')+text(x+w-117,y+112,'离散化 → 扫描',14,ink,400,'text-anchor="middle"')+text(x+w-117,y+138,'中间状态不写回',14,ink,400,'text-anchor="middle"');
      out+=`<path d="M${x+182} ${y+94}H${x+w-218}m-8-6 8 6-8 6" stroke="${acc}" stroke-width="2" fill="none"/><path d="M${x+w-218} ${y+132}H${x+182}m8-6-8 6 8 6" stroke="${sub}" stroke-width="2" fill="none"/>`;
      out+=text(x+(w)/2,y+86,'加载参数',13,sub,400,'text-anchor="middle"')+text(x+(w)/2,y+124,'写回 y',13,sub,400,'text-anchor="middle"');
      out+=text(x+24,y+h-14,'h(t) = Ā(t)·h(t−1) + B̄(t)·x(t)  · 线性递推，满足结合律',14,sub,400);
    }else{
      out+=text(x+22,y+36,'9.4  地址翻译与 TLB',20,ink,600)+text(x+w-20,y+36,'P23',14,sub,500,'text-anchor="end"');
      const boxes=[['虚拟地址',x+24],['TLB',x+170],['多级页表',x+316],['物理地址',x+w-140]];
      boxes.forEach(([l,bx],i)=>{out+=rect(bx,y+64,116,52,10,i===1?'#ece9ff':'#eef0f8',i===1?'#b8aef5':'#c9cee0')+text(bx+58,y+96,l,15,i===1?acc:ink,600,'text-anchor="middle"');if(i<3)out+=`<path d="M${bx+120} ${y+90}H${i===2?x+w-146:bx+142}m-6-5 6 5-6 5" stroke="${sub}" stroke-width="1.6" fill="none"/>`;});
      out+=text(x+24,y+148,'TLB 命中：直接得到物理页框号',14,sub)+text(x+24,y+172,'未命中：MMU 走页表；PTE 无效 → 缺页异常 → 内核调页',14,sub);
    }
    return out;
  }
  function lecture(){
    let left=rect(112,248,656,214,14,p.soft,'none')+slide(124,258,632,194,'mamba');
    left+=text(116,500,'本页要点',17,p.ink,600);
    [['输入相关的 Δ、B、C 让模型能选择性记忆',true],['参数随输入变化后，不能再用卷积并行',true],['核融合 + 重计算：中间状态只放 SRAM',false]].forEach(([t,done],i)=>{
      const y=520+i*40;left+=rect(116,y,22,22,6,done?p.accent:p.soft,done?'none':p.faint)+(done?icon(116,y-1,'check','#fff',22,2.4):'')+text(150,y+18,t,17,done?p.faint:p.ink,400,done?'text-decoration="line-through"':'');
    });
    return assistant({
      timer:'19:42',leftIcon:'slides',leftTitle:'讲稿跟随',leftH:510,pickers:[['组会 · Mamba 论文精读','cap'],['腾讯会议 · 共享屏幕','slides']],
      status:'已识别当前幻灯片：第 7 页 · 讲到第 2 个要点',
      left,
      leftBottom:by=>panelHead(112,by+42,'help','可能被问')+
        para(116,by+82,[['和 S4 / H3 相比，核心区别是什么？',false]],17,640,{gap:28}).svg+
        para(116,by+116,[['为什么不直接用 FlashAttention 处理长序列？',false]],17,640,{gap:28}).svg+
        rect(112,by+138,656,48,12,p.tint,'none')+text(128,by+169,'过渡句：解决了表达能力，下一个问题是怎么让它跑得快。',16,p.accentInk,500),
      qtype:'追问',question:'Δ、B、C 随输入变化，为什么还能并行训练？',conf:.78,
      answer:{page:'1/1',q:'导师：参数跟输入相关就不能用卷积了，那训练怎么并行？',head:'递推仍然是线性的，可以用并行扫描在 O(log L) 步内算完。',
        bullets:[['关联扫描：','h(t) = Ā(t)·h(t−1) + B̄(t)·x(t) 是线性递推，满足结合律，可以像前缀和一样分块并行。'],['核融合：','离散化、扫描和输出放进一个 kernel，中间状态留在 SRAM，不写回 HBM。'],['重计算：','反向传播时重算中间状态，显存开销与 FlashAttention 同量级。'],['一句话：','放弃卷积换来选择性，再用硬件感知的扫描把速度拿回来。']],
        sources:['论文 · Mamba.pdf 第 6 页','讲稿 · 组会讲稿.md'],active:'展开'}
    });
  }
  function meeting(){
    return assistant({
      timer:'10:27',pickers:[['华东代理商 · 年度续约','bag'],['飞书会议 · 系统声音','speaker']],
      status:'X-ASR 本地识别 · 每句整句精修 · 3 位参会人',
      leftH:500,
      left:lanes(248)+transcript(112,306,656,[
        {who:'them',text:'今年整体走量还不错，明年我们想再加大投入。'},
        {tag:'问题',at:'10:26:41'},
        {who:'them',text:'如果明年采购量翻倍，单价能不能再降 8 个点？'},
        {who:'me',text:'量翻倍我们当然欢迎，价格可以一起算一下。'},
        {who:'them',text:'另外账期我们还是希望 90 天…',interim:true}]),
      leftBottom:by=>panelHead(112,by+42,'check','会议纪要 · 实时')+
        text(116,by+84,'决定',15,p.faint,600)+text(170,by+84,'2027 年继续独家代理华东区',17,p.ink)+
        text(116,by+118,'待办',15,p.faint,600)+text(170,by+118,'我方：周五前给出阶梯报价测算表',17,p.ink)+
        text(170,by+150,'对方：提供明年分季度采购预测',17,p.ink)+text(116,by+190,'分歧',15,p.faint,600)+text(170,by+190,'账期 90 天 vs 60 天，待下次确认',17,p.ink),
      qtype:'请求',question:'采购量翻倍，单价能不能再降 8 个点？',conf:.74,
      answer:{page:'1/1',q:'对方：如果明年采购量翻倍，单价能不能再降 8 个点？',head:'可以谈，但用阶梯价换条件；8 个点超出底线，先不松口。',
        bullets:[['阶梯报价：','到 1.5 倍降 4%，翻倍降 6%，按季度实际提货量结算。'],['换条件：','降价同时把账期从 90 天缩到 60 天，并签年度框架协议。'],['守底线：','场景里设定的单价降幅上限是 6%。'],['下一步：','会后发测算表，周五前双方确认。']],
        sources:['报价 · 2027 渠道价格表.xlsx','场景 · 我方底线'],active:'更简短'}
    });
  }
  function course(){
    let left=transcript(112,262,656,[
      {who:'them',text:'多级页表每次翻译都要访存好几次，太慢了怎么办？'},
      {who:'them',text:'对，所以有 TLB。'},
      {tag:'问题',at:'10:15:22'},
      {who:'them',text:'那 TLB 没命中的时候，硬件和操作系统分别做什么？'},
      {who:'them',text:'可以结合课件上的图说一下…',interim:true}]);
    return assistant({
      timer:'10:15',leftH:446,pickers:[['操作系统 · 虚拟内存','book'],['腾讯会议 · 网课','speaker']],
      status:'X-ASR 本地识别 · 已对齐课件：第 9 讲 第 23 页',
      left,
      leftBottom:by=>panelHead(112,by+40,'slides','课件 · 第 9 讲')+slide(112,by+58,656,192,'tlb'),
      qtype:'明确提问',question:'TLB 未命中时，硬件和操作系统分别做什么？',conf:.88,
      answer:{page:'1/1',q:'老师：TLB 没命中的时候，硬件和操作系统分别要做什么？',head:'先由 MMU 查页表补回 TLB；页表项无效才触发缺页，交给操作系统。',
        bullets:[['硬件：','MMU 逐级查多级页表，找到有效页表项就填回 TLB，再重新访存。'],['缺页：','页表项无效时触发缺页异常，CPU 切到内核态。'],['操作系统：','找空闲页框（必要时换出一页），从磁盘读入并更新页表。'],['返回：','异常返回后重新执行那条指令，这次 TLB 命中。']],
        sources:['课件 · 第 9 讲 P23','笔记 · 课堂笔记.md'],active:'举例'}
    });
  }

  /* ---------- Scenes page ---------- */
  const groups=[['面试','person',[['字节后端二面','4 份资料 · 3 题 · 1 次会话'],['美团到店 · 后端一面','3 份资料 · 5 题 · 2 次会话']]],['学术会议','cap',[['组会 · Mamba 论文精读','3 份资料 · 4 题 · 1 次会话']]],['商务会议','bag',[['华东代理商 · 年度续约','5 份资料 · 2 题 · 3 次会话']]],['课程','book',[['操作系统 · 虚拟内存','6 份资料 · 8 题 · 4 次会话']]]];
  function sceneList(selected='字节后端二面'){
    let out=panel(90,146,380,792)+text(114,192,'场景',24,p.ink,600)+text(114,222,'每套面试 / 报告 / 会议单独管理',15,p.faint)+`<circle cx="434" cy="190" r="19" fill="${p.soft}" stroke="${p.line}"/>`+icon(423,179,'plus',p.ink,22,2);
    let y=252;
    for(const [g,ic,items] of groups){
      out+=icon(114,y,ic,p.faint,18)+text(142,y+15,g,16,p.faint,600);y+=30;
      for(const [name,meta] of items){const on=name===selected;out+=rect(108,y,344,74,14,on?p.tint:p.soft,'none')+text(126,y+32,name,19,p.ink,600)+text(126,y+58,meta,14,p.faint);if(on)out+=`<circle cx="426" cy="${y+28}" r="10" fill="${p.accent}"/>`+icon(419,y+21,'check','#fff',14,2.6);y+=84;}
      y+=10;
    }
    return out;
  }
  function sceneHeader(title,tabs,active,controls=[['面试','chevron'],['提词要点','chevron']]){
    let out=panel(488,146,1022,792)+rect(512,168,52,52,14,'url(#accent)','none')+icon(526,182,'person','#fff',24)+text(580,204,title,28,p.ink,600);
    let cx=1490;for(const [l,ic] of [...controls,['预测问题','spark']].reverse()){const w=chipW(l,16,true)+6;cx-=w+10;out+=chip(cx,172,l,{ic,size:16,h:40});}
    let tx=512;for(const t of tabs){const w=chipW(t,17)+8;out+=rect(tx,240,w,42,21,t===active?'url(#accent)':p.soft,'none')+text(tx+w/2,267,t,17,t===active?'#fff':p.copy,600,'text-anchor="middle"');tx+=w+8;}
    return out;
  }
  const field=(x,y,w,label,value,h=50)=>text(x,y,label,15,p.faint,600)+rect(x,y+10,w,h,12,p.soft,'none')+para(x+16,y+42,[[value,false]],18,w-32,{gap:28}).svg;
  function workspace(){
    let out=sceneList()+sceneHeader('字节后端二面',['资料与要求','经验库与题库','复盘'],'资料与要求');
    out+=icon(512,304,'file',p.copy,20)+text(540,321,'面试信息',18,p.ink,600);
    out+=field(512,360,476,'应聘公司','字节跳动 · 抖音电商')+field(1010,360,476,'岗位','后端开发工程师（2-1）');
    out+=field(512,446,974,'面试官 / HR','二面面试官为订单中台负责人，偏重系统设计与高并发');
    out+=field(512,532,476,'我的亮点','订单服务缓存层改造：P99 从 120 ms 降到 18 ms；大促 8 万 QPS 零故障',80)+field(1010,532,476,'其他背景','一面问了 MySQL 索引和 Redis，反馈是项目讲得不够量化',80);
    out+=field(512,648,974,'回答要求','先给结论，再讲方案和取舍；涉及效果时先报数字，控制在 1 分钟内');
    out+=text(512,750,'资料',15,p.faint,600)+text(552,750,'4',15,p.faint)+text(1486,750,'导入资料',15,p.accentInk,600,'text-anchor="end"');
    [['简历','简历_后端_2026.pdf'],['岗位 JD','抖音电商后端 JD.pdf'],['面经','字节后端面经合集.md'],['项目资料','订单系统设计文档.md']].forEach(([cat,f],i)=>{
      const x=512+(i%2)*490,y=766+Math.floor(i/2)*76;
      out+=rect(x,y,476,64,14,p.soft,'none')+icon(x+16,y+20,'file',p.accent,24)+text(x+52,y+39,f,18,p.ink,500)+chip(x+476-chipW(cat,14)-16,y+16,cat,{size:14,h:30,active:true});
    });
    return shell(out,'场景',{timer:'13:52'});
  }
  function materials(){
    let out=sceneList()+sceneHeader('字节后端二面',['资料与要求','经验库与题库','复盘'],'资料与要求');
    out+=rect(512,300,430,620,16,p.soft,'none')+text(532,338,'资料',19,p.ink,600)+text(922,338,'批量导入 · 自动归类',14,p.accentInk,600,'text-anchor="end"');
    [['简历','简历_后端_2026.pdf','已转 Markdown · 2 页'],['岗位 JD','抖音电商后端 JD.pdf','已转 Markdown · 1 页'],['面经','字节后端面经合集.md','Markdown · 46 题'],['项目资料','订单系统设计文档.md','Markdown · 9 节']].forEach(([cat,f,meta],i)=>{
      const y=358+i*86,on=i===3;out+=rect(526,y,402,74,12,on?p.tint:p.panel,on?'none':p.line)+icon(542,y+24,'file',on?p.accent:p.copy,24)+text(578,y+32,f,17,p.ink,600)+text(578,y+57,meta,14,p.faint)+chip(928-chipW(cat,13)-14,y+12,cat,{size:13,h:26,active:true});
    });
    out+=rect(526,712,402,192,14,p.panel,p.line)+icon(542,728,'spark',p.accent,22)+text(574,746,'技能 · SKILL.md',17,p.ink,600)+rect(864,728,48,26,13,p.accent,'none')+`<circle cx="899" cy="741" r="10" fill="#fff"/>`+
      `<g font-family="'SF Mono',Menlo,monospace">`+text(544,786,'---',15,p.faint)+text(544,812,'name: 系统设计答题框架',15,p.ink)+text(544,838,'description: 澄清需求 → 估算规模',15,p.ink)+text(544,864,'  → 核心链路 → 取舍与兜底',15,p.ink)+text(544,890,'---',15,p.faint)+`</g>`;
    out+=rect(960,300,526,620,16,p.panel,p.line)+icon(980,318,'file',p.accent,22)+text(1012,337,'订单系统设计文档.md',18,p.ink,600)+text(1466,337,'本机解析',14,p.green,600,'text-anchor="end"')+line(976,358,1470,358);
    out+=text(982,402,'## 3. 库存扣减',21,p.ink,600)+para(982,440,[['大促时库存先在 ',false],['Redis',true],[' 中用 ',false],['Lua 脚本原子扣减',true],['，扣减成功后发送事务消息，消费端按订单号幂等落库。',false]],17,470,{gap:28,boldFill:p.accentInk}).svg;
    out+=text(982,560,'## 4. 一致性兜底',21,p.ink,600)+para(982,598,[['写库后删除缓存，删除失败的 key 进入重试队列；同时 ',false],['Canal 订阅 binlog',true],[' 异步再删一次。每日凌晨对账任务修正 Redis 与 MySQL 的库存差异。',false]],17,470,{gap:28,boldFill:p.accentInk}).svg;
    out+=rect(976,750,494,150,12,p.tint,'none')+text(996,784,'回答时按问题检索',16,p.accentInk,600)+para(996,818,[['问到“删除缓存失败怎么办”，只取第 4 节相关片段，并标注 [项目资料] 订单系统设计文档.md。',false]],16,454,{gap:26}).svg;
    return shell(out,'场景',{timer:'13:55'});
  }

  /* ---------- Records page ---------- */
  function review(){
    let out=panel(90,146,440,792)+rect(110,166,400,46,23,p.soft,'none')+icon(126,177,'search',p.faint,22)+text(158,196,'搜索标题、问题和提词',16,p.faint);
    out+=row(110,226,[['全部场景','chevron'],['近 30 天','chevron'],['按时间','chevron']],{size:14,h:32});
    [['字节后端二面','10月22日 14:00 · 46 分钟 · 9 问'],['组会 · Mamba 论文精读','10月21日 19:30 · 32 分钟 · 6 问'],['华东代理商 · 年度续约','10月20日 10:00 · 58 分钟 · 4 问'],['操作系统 · 虚拟内存','10月18日 10:00 · 95 分钟 · 7 问'],['美团到店 · 后端一面','10月15日 15:00 · 38 分钟 · 8 问']].forEach(([t,m],i)=>{
      const y=282+i*92,on=i===0;out+=rect(108,y,404,80,14,on?p.tint:p.soft,'none')+text(128,y+33,t,19,p.ink,600)+text(128,y+60,m,14,p.faint);
    });
    out+=text(312,880,'共 5 条记录',14,p.faint,400,'text-anchor="middle"');
    out+=panel(548,146,962,792)+text(574,196,'字节后端二面 · 订单系统与缓存一致性',25,p.ink,600)+text(574,228,'10月22日 14:00 · 46 分钟 · 9 个问题 · 已加入场景经验库',15,p.faint);
    out+=chip(1316,172,'导出 Markdown',{size:15,h:38,ic:'file'});
    let tx=574;for(const t of ['摘要','问题','转录','提词']){const w=chipW(t,16)+14;out+=rect(tx,252,w,40,20,t==='摘要'?'url(#accent)':p.soft,'none')+text(tx+w/2,278,t,16,t==='摘要'?'#fff':p.copy,600,'text-anchor="middle"');tx+=w+8;}
    out+=text(574,334,'问题清单与我的回答要点',18,p.ink,600);
    [['订单系统大促时库存怎么扣？','Redis + Lua 原子扣减，事务消息异步落库，消费端幂等。'],['数据库和缓存怎么保证一致性？','先更新库再删缓存，binlog 订阅兜底，最终一致。'],['删除缓存失败了怎么办？','重试队列 + Canal 再删一次，热点 key 延迟双删。'],['Kafka 怎么保证消息不丢？','只答了消费端手动提交，生产端 acks 没讲到。']].forEach(([q,a],i)=>{
      const y=352+i*82;out+=rect(574,y,910,72,12,i===3?p.soft:p.soft,'none')+text(594,y+30,`0${i+1}`,15,p.accentInk,600)+text(630,y+30,q,18,p.ink,600)+text(630,y+57,a,15,i===3?p.orange:p.copy);
    });
    out+=text(574,712,'复盘建议',18,p.ink,600);
    [['check','缓存一致性讲得清楚，下次先给结论再展开。',p.green],['help','Kafka 追问补上 acks=all、幂等生产者和重试。',p.orange],['spark','已整理 2 条经验、3 道改进回答进场景题库。',p.accent]].forEach(([ic,t,c],i)=>{
      const y=730+i*44;out+=icon(576,y,ic,c,22)+text(610,y+18,t,17,p.ink);
    });
    out+=button(1256,862,'加入下次准备',228,true,'plus',46);
    return shell(out,'记录',{timer:'15:02'});
  }

  /* ---------- Teleprompter over a call ---------- */
  // Flat illustrated participant: hair, face, neck and shirt with a collar.
  function person(cx,cy,s,shirt,hair,id){
    const k=v=>n(v*s);
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${shirt}"/><stop offset="1" stop-color="#1c2131"/></linearGradient></defs>`+
      `<path d="M${cx-k(150)} ${cy+k(260)}C${cx-k(140)} ${cy+k(120)} ${cx-k(80)} ${cy+k(92)} ${cx} ${cy+k(92)}S${cx+k(140)} ${cy+k(120)} ${cx+k(150)} ${cy+k(260)}Z" fill="url(#${id})"/>`+
      `<path d="M${cx-k(22)} ${cy+k(40)}h${k(44)}v${k(56)}l-${k(22)} ${k(18)}-${k(22)}-${k(18)}z" fill="#c9a98f"/>`+
      `<path d="M${cx-k(30)} ${cy+k(92)}l${k(30)} ${k(34)} ${k(30)}-${k(34)}" stroke="#e9edf5" stroke-width="${k(6)}" fill="none" stroke-linejoin="round"/>`+
      `<ellipse cx="${cx}" cy="${cy}" rx="${k(52)}" ry="${k(62)}" fill="#dcbfa6"/>`+
      `<path d="M${cx-k(56)} ${cy-k(4)}C${cx-k(60)} ${cy-k(70)} ${cx+k(60)} ${cy-k(88)} ${cx+k(56)} ${cy-k(6)}C${cx+k(40)} ${cy-k(36)} ${cx-k(10)} ${cy-k(44)} ${cx-k(56)} ${cy-k(4)}Z" fill="${hair}"/>`;
  }
  const roomBack=(x,y,w,h)=>rect(x+w*.08,y+h*.16,w*.22,h*.5,6,'#ffffff0d','none')+rect(x+w*.08,y+h*.34,w*.22,4,2,'#ffffff14','none')+rect(x+w*.08,y+h*.5,w*.22,4,2,'#ffffff14','none')+
    rect(x+w*.7,y+h*.12,w*.2,h*.34,8,'#9fb4ff10','#ffffff14');
  function prompter(){
    let out=rect(74,42,1452,912,16,p.video,'none');
    out+=rect(100,140,920,650,18,'#2a3044','none')+`<g clip-path="url(#tile-a)"><defs><clipPath id="tile-a"><rect x="100" y="140" width="920" height="650" rx="18"/></clipPath></defs>`+rect(100,140,920,650,0,'url(#room)','none')+roomBack(100,140,920,650)+person(560,470,1.45,'#4b5a80','#2a2320','pa')+`</g>`+
      rect(118,738,180,36,10,'rgba(0,0,0,.45)','none')+text(134,762,'面试官 · 订单中台',16,'#fff',500);
    out+=rect(1040,140,460,320,18,'#323a52','none')+`<g clip-path="url(#tile-b)"><defs><clipPath id="tile-b"><rect x="1040" y="140" width="460" height="320" rx="18"/></clipPath></defs>`+rect(1040,140,460,320,0,'url(#room)','none')+person(1270,300,.72,'#3f6d63','#3a2a22','pb')+`</g>`+rect(1056,420,60,30,8,'rgba(0,0,0,.45)','none')+text(1086,441,'我',15,'#fff',500,'text-anchor="middle"');
    out+=rect(1040,476,460,314,18,'#2a3044','none')+text(1270,620,'共享屏幕已暂停',18,'#9aa3ba',400,'text-anchor="middle"');
    out+=rect(500,822,600,64,32,'#1b2030','none');[['mic',560],['camera',640],['slides',720],['chat',800],['person',880]].forEach(([ic,x])=>{out+=icon(x,842,ic,'#c9d0e2',24);});out+=rect(950,834,124,40,20,'#e25b5b','none')+text(1012,860,'离开',17,'#fff',600,'text-anchor="middle"');
    // Floating prompter tucked under the camera
    out+=`<g filter="url(#card-shadow)">`+rect(420,58,760,330,26,'#141824cc','#ffffff33')+`</g>`+
      `<circle cx="452" cy="94" r="6" fill="${p.green}"/>`+text(468,100,'聆听中',16,'#c9d0e2',500)+chip(540,80,'追问',{size:14,h:28,fill:'#6a5cf044',color:'#d3ccff'})+
      icon(856,85,'left','#c9d0e2',22)+text(902,101,'2/2',15,'#c9d0e2',500,'text-anchor="middle"')+icon(924,85,'right','#c9d0e2',22)+text(968,101,'A−',16,'#c9d0e2',600)+text(1006,101,'A+',16,'#c9d0e2',600)+icon(1046,85,'pointer','#a99cff',22)+icon(1086,85,'eye','#c9d0e2',22)+icon(1126,85,'pin','#c9d0e2',22)+
      line(440,122,1160,122,'#ffffff22')+text(448,156,'如果删除缓存失败了怎么办？',18,'#aeb6cc',500)+
      text(448,206,'删除失败的 key 进重试队列，',30,'#ffffff',600)+text(448,252,'再用 binlog 订阅兜底删一次；',30,'#ffffff',600)+text(448,298,'热点 key 延迟双删，缓存都设 TTL。',30,'#ffffff',600)+
      line(440,322,1160,322,'#ffffff22')+chip(448,336,'回答',{size:15,h:34,fill:'#6a5cf0',color:'#fff'})+chip(526,336,'取消',{size:15,h:34,fill:'#ffffff14',color:'#d7dcea'})+chip(604,336,'复制',{size:15,h:34,fill:'#ffffff14',color:'#d7dcea'})+
      text(1160,358,'鼠标穿透已开启 · 按钮仍可点',14,'#9aa3ba',400,'text-anchor="end"');
    return shell(out,'助手',{bare:true});
  }

  /* ---------- Phone companion ---------- */
  function phone(){
    return `<g filter="url(#phone-shadow)">`+rect(24,12,392,832,58,'url(#metal)','#777d91')+rect(31,19,378,818,52,'#101219')+
      rect(40,28,360,800,45,p.canvas)+rect(164,43,112,29,15,'#101219')+
      text(69,64,'14:07',16,p.ink,600)+text(340,64,'Wi-Fi',13,p.ink,500)+
      icon(62,100,'wave',p.accent,24)+text(96,120,'手机伴侣',22,p.ink,600)+chip(254,98,'已连接 Mac',{size:13,h:28,active:true})+
      text(64,166,'同一 Wi-Fi · 字节后端二面',14,p.faint)+
      rect(56,184,328,118,20,p.panel,p.line)+chip(72,198,'追问',{size:13,h:26,active:true})+para(74,258,[['如果删除缓存失败了怎么办？',false]],19,292,{gap:30,weight:600}).svg+
      rect(56,318,328,382,20,p.panel,p.line)+icon(72,334,'spark',p.accent,20)+text(100,351,'建议回答',17,p.accentInk,600)+
      para(74,396,[['删除失败的 key 进重试队列，再用 binlog 订阅兜底删一次。',true]],20,290,{boldFill:p.ink,gap:32}).svg+
      line(74,500,366,500)+para(74,536,[['• 重试队列：MQ 消费端重试，超过次数告警',false]],15,292,{fill:p.copy,gap:24}).svg+
      para(74,574,[['• 热点 key 延迟双删，降低旧值回填',false]],15,292,{fill:p.copy,gap:24}).svg+
      para(74,612,[['• 余额类强一致数据直接读库',false]],15,292,{fill:p.copy,gap:24}).svg+para(74,662,[['首字出现即可开口，后续逐字补全。',false]],13,292,{fill:p.faint,gap:20}).svg+
      rect(56,716,100,52,26,p.soft,p.line)+icon(94,730,'left',p.ink,24)+rect(170,716,100,52,26,'url(#accent)','none')+text(220,749,'回答',18,'#fff',600,'text-anchor="middle"')+rect(284,716,100,52,26,p.soft,p.line)+icon(322,730,'right',p.ink,24)+
      text(220,796,'遥控：上一条 · 回答 · 下一条',13,p.faint,400,'text-anchor="middle"')+
      rect(162,812,116,5,3,p.ink)+`</g>`;
  }
  function devices(){
    return `<g transform="translate(0 112) scale(.78)">${conversation()}</g><g transform="translate(1130 90) scale(.9)">${phone()}</g>`;
  }

  /* ---------- Settings · data ---------- */
  function privacy(){
    let out=panel(90,146,300,792)+text(114,194,'设置',24,p.ink,600);
    [['语音识别','mic'],['对话服务','spark'],['资料','file'],['提词器','eye'],['数据','lock'],['技能','bulb']].forEach(([l,ic],i)=>{const y=224+i*62,on=l==='数据';out+=rect(106,y,268,50,12,on?p.tint:'none','none')+icon(122,y+13,ic,on?p.accentInk:p.copy,22)+text(156,y+32,l,18,on?p.accentInk:p.ink,on?600:500);});
    out+=panel(408,146,1102,792)+text(436,198,'数据去向，由你决定。',28,p.ink,600)+text(436,232,'本机识别与保存，外部服务按你的配置使用。',17,p.copy);
    const cs=[{x:436,title:'保存在本机',ic:'lock',c:p.green,items:['场景资料与 Markdown','会话转录、问题与回答','经验库与题库'],foot:'原始音频不保存'},
      {x:788,title:'生成回答时发送',ic:'spark',c:p.accent,items:['当前问题与转录','检索到的资料片段','主动添加的截图与技能'],foot:'发往你配置的回答引擎'},
      {x:1140,title:'按需开启',ic:'settings',c:p.orange,items:['云端识别（需同意）','联网搜索（问题文本）','手机伴侣（同一 Wi-Fi）'],foot:'默认关闭，可随时切换'}];
    cs.forEach(({x,title,ic,c,items,foot})=>{
      out+=rect(x,268,334,410,18,p.soft,'none')+`<circle cx="${x+44}" cy="${312}" r="24" fill="${c}" fill-opacity=".16"/>`+icon(x+31,299,ic,c,26)+text(x+24,378,title,23,p.ink,600);
      items.forEach((t,i)=>{out+=icon(x+24,412+i*56,'check',c,20)+text(x+54,429+i*56,t,17,p.copy);});
      out+=line(x+24,596,x+310,596)+text(x+24,636,foot,16,c,600);
    });
    out+=rect(436,702,1046,120,16,p.tint,'none')+icon(458,722,'file',p.accentInk,22)+text(490,740,'导出与导入',18,p.ink,600)+text(490,772,'一个 .ihbackup 文件包含全部场景、记录和设置；默认不含密钥。',16,p.copy)+text(490,800,'每天自动备份，更新前和导入前也会备份。',16,p.copy);
    return shell(out,'设置',{timer:'09:30'});
  }
  return {conversation,context,workspace,materials,review,prompter,phone,devices,lecture,meeting,course,privacy};
}

const titles={conversation:'字节后端二面：双路实时对话与追问回答',context:'回答引用当前场景的资料、题库与经验',workspace:'场景页：字节后端二面的面试信息与资料',materials:'资料转 Markdown 与场景技能',review:'会话记录：问题清单与复盘建议',prompter:'视频面试中的悬浮提词器',phone:'手机伴侣：当前问题与回答',devices:'助手窗口与手机伴侣',lecture:'组会论文讲解：讲稿跟随与导师追问',meeting:'商务谈判：实时纪要与报价建议',course:'网课：课件对齐与老师提问',privacy:'设置：本机数据与服务使用'};
// Keep the physical display aperture identical in every desktop scene. The page
// can transform one device between hero and content without remapping UI pixels.
const definitions = (p) => `<defs>
  <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7265ed"/><stop offset="1" stop-color="#9769ee"/></linearGradient>
  <linearGradient id="canvas" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${p.canvas}"/><stop offset=".7" stop-color="${p.canvas}"/><stop offset="1" stop-color="${p.canvas2}"/></linearGradient>
  <radialGradient id="corner-glow"><stop stop-color="${p.canvas2}" stop-opacity=".85"/><stop offset="1" stop-color="${p.canvas2}" stop-opacity="0"/></radialGradient>
  <linearGradient id="room" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#3a4258"/><stop offset="1" stop-color="#1f2434"/></linearGradient>
  <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e1e6f1"/><stop offset=".12" stop-color="#9aa4b8"/><stop offset=".56" stop-color="#737f96"/><stop offset=".86" stop-color="#b2bbcc"/><stop offset="1" stop-color="#5d6980"/></linearGradient>
  <linearGradient id="rim-light" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#fff" stop-opacity=".8"/><stop offset=".42" stop-color="#e0e8fb" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity=".4"/></linearGradient>
  <linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f0f3fa"/><stop offset=".16" stop-color="#c7d0df"/><stop offset=".55" stop-color="#a4b0c5"/><stop offset="1" stop-color="#67758f"/></linearGradient>
  <linearGradient id="notch" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#6c7991"/><stop offset="1" stop-color="#b8c3d5"/></linearGradient>
  <clipPath id="display"><rect x="74" y="42" width="1452" height="912" rx="16"/></clipPath>
  <filter id="device-shadow" x="-8%" y="-6%" width="116%" height="126%"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#0d1426" flood-opacity=".17"/></filter>
  <filter id="contact-shadow" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#05070d" flood-opacity=".45"/></filter>
  <filter id="phone-shadow" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#0d1426" flood-opacity=".18"/></filter>
</defs>`.replace(/>\s+</g,'><');
// Story and Classic share one product artwork set; each style keeps its own copy.
const outs=['story','classic'].map(slug=>path.join(root,`public/${slug}/assets/product-scenes`));
const check=process.argv.includes('--check');
for (const out of outs) await mkdir(out,{recursive:true});
for (const out of outs) for (const [theme,p] of Object.entries(palettes)) {
  const screens=drawing(p);
  for(const [name,draw] of Object.entries(screens)) {
    const phone=name==='phone',w=phone?440:1600,h=phone?860:1044;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none"><title>${titles[name]}</title>${definitions(p)}<g font-family="'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif" text-rendering="geometricPrecision">${draw()}</g></svg>\n`;
    const file=path.join(out,`${name}-${theme}.svg`);
    if(check){if(await readFile(file,'utf8')!==svg)throw Error(`Stale product artwork: ${name}-${theme}.svg`);}
    else await writeFile(file,svg);
  }
}
// Classic also uses square close-ups and a wide wall cut from the same screens (SVG viewBox
// crops), in place of the template's stock portraits.
const tiles={
  answer:['conversation',[800,140,720,720],'追问：删除缓存失败怎么办'],
  lecture:['lecture',[84,140,720,720],'组会：讲稿跟随当前幻灯片'],
  meeting:['meeting',[800,140,720,720],'谈判：按底线给出报价建议'],
  course:['course',[84,140,720,720],'网课：老师提问与课件对齐'],
  prompter:['prompter',[400,40,800,800],'摄像头下方的悬浮提词器'],
  review:['review',[540,140,720,720],'复盘：问题清单与改进建议']};
const page={light:'#f5f6f8',dark:'#0f1115'};
const classicOut=path.join(root,'public/classic/assets/product-scenes');
const font=`font-family="'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif" text-rendering="geometricPrecision"`;
async function emit(file,svg){if(check){if(await readFile(file,'utf8')!==svg)throw Error(`Stale product artwork: ${path.basename(file)}`);}else await writeFile(file,svg);}
for (const [theme,p] of Object.entries(palettes)) {
  const screens=drawing(p);
  const crop=(key,x,y,w,h,r=28)=>{const [scene,[vx,vy,vw,vh]]=tiles[key];return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vx} ${vy} ${vw} ${vh}"><clipPath id="c-${key}"><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" rx="${r*vw/w}"/></clipPath><g clip-path="url(#c-${key})"><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${p.canvas}"/>${screens[scene]()}</g><rect x="${vx+.5}" y="${vy+.5}" width="${vw-1}" height="${vh-1}" rx="${r*vw/w}" fill="none" stroke="${p.line}" stroke-width="${2*vw/w}"/></svg>`;};
  for(const [key,[,,label]] of Object.entries(tiles)){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none"><title>${label}</title>${definitions(p)}<g ${font}>${crop(key,0,0,512,512,28)}</g></svg>\n`;
    await emit(path.join(classicOut,`tile-${key}-${theme}.svg`),svg);
  }
  // 1536×1024 wall: staggered close-ups that fade into the page on the right, where the copy sits.
  const keys=Object.keys(tiles),cells=[];
  keys.forEach((key,i)=>{const col=i%3,row=Math.floor(i/3);cells.push(crop(key,40+col*500,(col%2?140:60)+row*500,460,460,26));});
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024" fill="none"><title>InterviewHacker 在面试、组会、谈判与网课中的界面</title>${definitions(p)}<defs><linearGradient id="wall-fade" x1="0" x2="1"><stop offset=".35" stop-color="${page[theme]}" stop-opacity="0"/><stop offset=".72" stop-color="${page[theme]}" stop-opacity=".92"/><stop offset="1" stop-color="${page[theme]}"/></linearGradient></defs><rect width="1536" height="1024" fill="${page[theme]}"/><g ${font} opacity=".9">${cells.join('')}</g><rect width="1536" height="1024" fill="url(#wall-fade)"/></svg>\n`;
  await emit(path.join(classicOut,`wall-${theme}.svg`),svg);
}
// Classic hero side panels are tall (≈0.72) and perspective-clipped, so they get complete
// portrait cards rather than crops: scene, who asked, the question, and the key answer.
const cards={
  lecture:['cap','组会 · Mamba 论文精读','导师追问','为什么参数随输入变化，还能并行训练？',['并行扫描：线性递推满足结合律','核融合：中间状态只放 SRAM','重计算：显存与 FlashAttention 相当']],
  meeting:['bag','华东代理商 · 年度续约','对方请求','采购量翻倍，单价能不能再降 8 个点？',['阶梯价：1.5 倍降 4%，翻倍降 6%','换条件：账期 90 天缩到 60 天','守底线：降幅上限 6%']],
  course:['book','操作系统 · 虚拟内存','老师提问','TLB 未命中时，硬件和操作系统分别做什么？',['MMU 逐级查页表，补回 TLB','页表项无效 → 缺页异常','内核调页、更新页表后重试']],
  review:['clock','字节后端二面 · 复盘','会后整理','Kafka 怎么保证消息不丢？',['补上 acks=all 与幂等生产者','重试 + 消费端手动提交','已加入场景题库']],
  prompter:['eye','悬浮提词器','放在摄像头下方','如果删除缓存失败了怎么办？',['失败的 key 进重试队列','binlog 订阅兜底再删一次','热点 key 延迟双删']],
  skill:['spark','技能 · SKILL.md','系统设计答题框架','设计一个短链服务，你会怎么做？',['先澄清需求与读写比例','估算规模，再画核心链路','最后讲取舍与兜底']]};
for (const [theme,p] of Object.entries(palettes)) {
  for(const [key,[ic,scene,who,q,points]] of Object.entries(cards)){
    const W=360,H=500,lines=[];
    // Minimal local text helpers (the drawing() helpers are scoped to screens).
    const t=(x,y,str,size,fill,weight=400)=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(str)}</text>`;
    const wrapped=wrapRich([[q,true]],25,W-56).map(l=>l.map(s=>s[0]).join(''));
    let y=150;
    for(const l of wrapped){lines.push(t(28,y,l,25,p.ink,600));y+=36;}
    y+=14;
    lines.push(`<path d="M28 ${y}H${W-28}" stroke="${p.line}"/>`);y+=36;
    lines.push(t(28,y,'建议回答',16,p.accentInk,600));y+=34;
    for(const pt of points){lines.push(`<circle cx="34" cy="${y-6}" r="3.5" fill="${p.accent}"/>`+t(48,y,pt,17,p.copy));y+=34;}
    const bars=Array.from({length:22},(_,i)=>{const h=Math.round((4+Math.abs(Math.sin(i*1.9+key.length))*16)*100)/100;return `<rect x="${28+i*7}" y="${n(H-38-h/2)}" width="3" height="${h}" rx="1.5" fill="${i%2?p.green:p.accent}"/>`;}).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none"><title>${esc(scene)}：${esc(q)}</title><defs><linearGradient id="card-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${p.panel}"/><stop offset="1" stop-color="${p.canvas2}"/></linearGradient></defs><g ${font}>`+
      `<rect width="${W}" height="${H}" fill="url(#card-bg)"/>`+
      `<rect x="20" y="22" width="${W-40}" height="44" rx="22" fill="${p.soft}"/><circle cx="44" cy="44" r="5" fill="${p.green}"/>`+t(58,51,scene,16,p.ink,600)+
      `<rect x="28" y="84" width="${textWidth(who,15)+28}" height="30" rx="15" fill="${p.tint}"/>`+t(42,104,who,15,p.accentInk,600)+
      lines.join('')+bars+t(W-28,H-32,'流式输出',14,p.faint).replace('<text ','<text text-anchor="end" ')+
      `</g></svg>\n`;
    await emit(path.join(classicOut,`card-${key}-${theme}.svg`),svg);
  }
}
console.log(`${check?'Verified':'Generated'} ${Object.keys(titles).length*2} product screens × ${outs.length} styles, plus Classic close-ups and cards.`);
