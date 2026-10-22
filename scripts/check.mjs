import { readFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {root,publicRoot,loadCatalog,fingerprints,galleryCards,extractBlock,readmeGallery} from './catalog.mjs';
const catalog=await loadCatalog(),prints=await fingerprints(catalog);
const index=await readFile(path.join(publicRoot,'index.html'),'utf8');
assert.equal(extractBlock(index,'gallery'),galleryCards(catalog,prints),'Website gallery is stale: run npm run docs:sync');
assert.equal(extractBlock(await readFile(path.join(root,'README.md'),'utf8'),'readme'),await readmeGallery(catalog,prints,index),'README gallery is stale: update the preview if needed, then run npm run docs:sync');
assert.deepEqual(JSON.parse(await readFile(path.join(publicRoot,'styles.json'),'utf8')),catalog,'Browser style catalog is stale');
const roots=(await readdir(publicRoot,{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name);
for(const dir of roots){
 const file=path.join(publicRoot,dir,'index.html');
 try{await access(file);}catch{continue;}
 assert(dir==='compare'||catalog.styles.some(style=>style.slug===dir),`Unregistered style directory: ${dir}`);
}
async function inspectHtml(file, expectedCanonical) {
 const html=await readFile(file,'utf8');
 for(const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) assert(/\bsrc=/.test(script[1]) || !script[2].trim() || /type="application\/(?:ld\+)?json"/.test(script[1]), `Inline executable script blocked by deployment CSP: ${file}`);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size,`Duplicate IDs: ${file}`);
 assert.equal((html.match(/<h1\b/g)||[]).length,1,`Expected one h1: ${file}`);
 assert(html.includes(`href="${expectedCanonical}"`),`Missing canonical: ${file}`);
 for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  const url=m[1].split(/[?#]/)[0];
  if(/^(?:https?:|mailto:|data:)/.test(url))continue;
  const absolute=url.startsWith('/')?path.join(publicRoot,url):path.resolve(path.dirname(file),url);
  assert(absolute.startsWith(publicRoot+path.sep)||absolute===publicRoot,'Reference outside site');
  await access(absolute.endsWith(path.sep)?absolute+'index.html':absolute);
 }
 for(const m of html.matchAll(/href="#([^"]+)"/g))assert(ids.includes(m[1]),`Missing anchor ${m[1]}: ${file}`);
 return html;
}
await inspectHtml(path.join(publicRoot,'index.html'),catalog.origin+'/');
await inspectHtml(path.join(publicRoot,'compare/index.html'),catalog.origin+'/compare/');
for(const style of catalog.styles){
 const base=path.join(publicRoot,style.slug),html=await inspectHtml(path.join(base,'index.html'),catalog.origin+style.path);
 for(const text of ['v1.8.0','需要仓库访问权','不会把所有资料塞入上下文','语音识别 + 对话服务',...(style.slug==='story'?[]:['交互示意'])])assert(html.includes(text),`Missing product disclosure in ${style.slug}: ${text}`);
 const css=await readFile(path.join(base,'style.css'),'utf8');
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]);
 const js=(await Promise.all(scripts.map(src=>readFile(path.resolve(base,src.split('?')[0]),'utf8')))).join('\n');
 assert(css.includes('prefers-reduced-motion'));
 for(const match of js.matchAll(/image: '([^']+)'/g))await access(path.join(base,'shots',match[1]));
 assert(!/fonts\.googleapis|mcode\.cn|v1\.7\.0|无法被检测|<sup>®/.test(html));
 if(style.slug==='technology'){
  assert(!/Paddle|Qwen|Codex|DeepSeek|OpenAI/.test(html.slice(0,html.indexOf('<section id="faq"'))));
  for(const id of ['signal-field','story-field','tech-panel','inject-signal'])assert(html.includes(`id="${id}"`));
 }
 if(style.slug==='story'){
  const intro=html.slice(html.indexOf('id="intro-top"'),html.indexOf('id="capabilities"'));
  assert.equal((intro.match(/class="[^"]*\bih-hero-device-single\b/g)||[]).length,1,'Hero must have exactly one animated device');
  assert(!intro.includes('data-parallax-pattern="l-intro-tablet"'),'Hero geometry must not have two transform owners');
  assert(!/<div[^>]*class="intro__content"[^>]*data-parallax/.test(intro),'Hero copy must share the viewport handoff clock');
  const handoffCss=await readFile(path.join(base,'styles/hero-handoff.css'),'utf8');
  assert.match(handoffCss,/\.ih-hero-handoff-ready\s+\.ih-hero-fallback\s*\{[^}]*visibility:\s*hidden\b/,'Ready hero must hide its loading fallback');
  const screensBetween=(start,end)=>[...html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start))).matchAll(/data-product-screen="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(screensBetween('id="features"','data-scroll-section-id="section4"'),['workspace','materials','conversation','review'],'Story workflow screens must match the four steps');
  assert.deepEqual(screensBetween('data-scroll-section-id="section4"','data-scroll-section-id="section5"'),['conversation','context','devices','review'],'Story capability artwork must match its feature');
  assert.deepEqual(screensBetween('id="stories"','data-scroll-section-id="section6"'),['conversation','lecture','meeting','course','conversation','lecture','meeting','course'],'Desktop and mobile stories must share the same screen mapping');
  for(const img of html.matchAll(/<img\b[^>]*data-product-screen="([^"]+)"[^>]*>/g)){
   for(const theme of ['light','dark'])assert(img[0].includes(`data-ih-${theme}="./assets/product-scenes/${img[1]}-${theme}.svg"`),'Product images must use matching theme assets');
   assert(!/产品界面截图|示意|合成/.test(img[0]),'Keep Story artwork labels descriptive and unobtrusive');
  }
  assert(scripts.findIndex(src=>src.startsWith('./scripts/theme.js')) < scripts.findIndex(src=>src.startsWith('./assets/javascripts/shared.js')),'Story theme must initialize before reference measurements');
  for(const m of html.matchAll(/(?:href|src)="(\.\/[^"?#]+\.(?:css|js))\?v=([a-f0-9]{12})"/g)){
   const bytes=await readFile(path.join(base,m[1]));
   assert.equal(m[2],createHash('sha256').update(bytes).digest('hex').slice(0,12),'Story resource version is stale: run npm run docs:sync');
  }
 }
}
const staticConfig=JSON.parse(await readFile(path.join(publicRoot,'vercel.json'),'utf8'));
const gitConfig=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
assert.deepEqual(gitConfig.headers,staticConfig.headers,'Git and static deployments must share headers');
assert.equal(gitConfig.outputDirectory,'dist');assert.equal(gitConfig.trailingSlash,true);
console.log(`Gallery, ${catalog.styles.length} style pages, comparison, README synchronization and deployment checks passed.`);
