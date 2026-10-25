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
 const version={final:'v2.0.0'}[style.slug]||'v1.8.0';
 // Final states its own prerequisites (system, private repository) in its download section.
 for(const text of [version,'不会把所有资料塞入上下文',...(style.slug==='final'?[]:['需要仓库访问权','语音识别 + 对话服务']),...(['story','classic'].includes(style.slug)?[]:['交互示意'])])assert(html.includes(text),`Missing product disclosure in ${style.slug}: ${text}`);
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
  const hero=html.slice(html.indexOf('id="top"'),html.indexOf('id="capabilities"'));
  assert.equal((hero.match(/data-product-screen=/g)||[]).length,1,'Hero must show exactly one product device');
  for(const hook of ['data-motion-toggle','data-demo-toggle','data-theme-toggle'])assert(html.includes(hook),`Story must keep its ${hook} control`);
  assert(css.includes('reveal-fallback'),'Story pre-hidden content needs a CSS fallback when scripts fail');
  for(const src of scripts)assert(src.startsWith('./'),'Story scripts must be same-origin for the deployment CSP');
  await access(path.join(base,'assets/vendor/README.md'));
  const screensBetween=(start,end)=>[...html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start))).matchAll(/data-product-screen="([^"]+)"/g)].map(m=>m[1]);
  const chapters=['conversation','workspace','devices','materials','review'];
  assert.deepEqual(screensBetween('id="features"','id="workflow"'),[...chapters,...chapters],'Story chapter text and sticky device must share one screen order');
  assert.deepEqual(screensBetween('id="benefits"','id="loop"'),['context','phone','prompter'],'Story capability artwork must match its card');
  assert.deepEqual(screensBetween('id="stories"','id="privacy"'),['conversation','lecture','meeting','course'],'Story scenes must match their tabs');
  for(const img of html.matchAll(/<img\b[^>]*data-product-screen="([^"]+)"[^>]*>/g)){
   for(const theme of ['light','dark'])assert(img[0].includes(`data-ih-${theme}="./assets/product-scenes/${img[1]}-${theme}.svg"`),'Product images must use matching theme assets');
   assert(!/产品界面截图|示意|合成/.test(img[0]),'Keep Story artwork labels descriptive and unobtrusive');
  }
  assert(scripts.findIndex(src=>src.startsWith('./scripts/theme.js')) < scripts.findIndex(src=>src.startsWith('./scripts/main.js')),'Story theme must initialize before motion measurements');
 }
 if(style.slug==='classic'){
  const intro=html.slice(html.indexOf('id="intro-top"'),html.indexOf('id="capabilities"'));
  assert.equal((intro.match(/class="[^"]*\bih-hero-device-single\b/g)||[]).length,1,'Classic hero must have exactly one animated device');
  assert(!intro.includes('data-parallax-pattern="l-intro-tablet"'),'Classic hero geometry must not have two transform owners');
  assert(!/<div[^>]*class="intro__content"[^>]*data-parallax/.test(intro),'Classic hero copy must share the viewport handoff clock');
  const handoffCss=await readFile(path.join(base,'styles/hero-handoff.css'),'utf8');
  assert.match(handoffCss,/\.ih-hero-handoff-ready\s+\.ih-hero-fallback\s*\{[^}]*visibility:\s*hidden\b/,'Classic ready hero must hide its loading fallback');
  const screensBetween=(start,end)=>[...html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start))).matchAll(/data-product-screen="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(screensBetween('id="features"','data-scroll-section-id="section4"'),['workspace','materials','conversation','review'],'Classic workflow screens must match the four steps');
  assert.deepEqual(screensBetween('data-scroll-section-id="section4"','data-scroll-section-id="section5"'),['conversation','context','devices','review'],'Classic capability artwork must match its feature');
  assert.deepEqual(screensBetween('id="stories"','data-scroll-section-id="section6"'),['conversation','lecture','meeting','course','conversation','lecture','meeting','course'],'Classic desktop and mobile stories must share the same screen mapping');
  for(const img of html.matchAll(/<img\b[^>]*data-product-screen="([^"]+)"[^>]*>/g)){
   for(const theme of ['light','dark']){
    const source=img[0].match(new RegExp(`data-ih-${theme}="([^"]+)"`))?.[1];
    assert.equal(source?.split(/[?#]/)[0],`./assets/product-scenes/${img[1]}-${theme}.svg`,'Classic product images must use matching theme assets');
   }
   assert(!/产品界面截图|示意|合成/.test(img[0]),'Keep Classic artwork labels descriptive and unobtrusive');
  }
  assert(scripts.findIndex(src=>src.startsWith('./scripts/theme.js')) < scripts.findIndex(src=>src.startsWith('./assets/javascripts/shared.js')),'Classic theme must initialize before reference measurements');
 }
 if(style.slug==='final'){
  // Final ships two generated language pages, subset fonts and its own vendor copies (GSAP, Lenis).
  const en=await inspectHtml(path.join(base,'en/index.html'),catalog.origin+'/final/en/');
  for(const page of [html,en]){
   assert(page.includes('v2.0.0'),'Final must state the current release');
   assert(page.includes('https://github.com/OmnixSI/InterviewHacker/releases/latest'),'Final must link the latest GitHub release');
   assert(page.includes('hreflang="zh-CN"')&&page.includes('hreflang="en"'),'Final pages must link their language alternates');
   assert(!/fonts\.googleapis|cdn\.|无法被检测|undetectable/i.test(page),'Final must stay self-hosted and avoid detection claims');
   for(const src of [...page.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]))assert(/^\.\.?\//.test(src),'Final scripts must be same-origin');
   for(const id of ['hero-title','demo','scenes','companion','privacy','download','install','faq'])assert(page.includes(`id="${id}"`),`Final is missing #${id}`);
   assert.equal((page.match(/data-demo-app/g)||[]).length,1,'Final must render exactly one product device');
  }
  for(const m of [...html.matchAll(/(?:href|src)="(\.\/[^"?#]+\.(?:css|js))\?v=([a-f0-9]{12})"/g)]){
   assert.equal(m[2],createHash('sha256').update(await readFile(path.join(base,m[1]))).digest('hex').slice(0,12),'Final resource version is stale: run npm run final:build');
  }
  const fontFiles=[];
  async function walkFonts(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walkFonts(p);else fontFiles.push(p);}}
  await walkFonts(path.join(base,'assets/fonts'));
  assert(!fontFiles.some(f=>/\.(?:ttf|otf)$/i.test(f)),'Final fonts must be subset woff2, not full TTF/OTF');
  const charset=JSON.parse(await readFile(path.join(base,'assets/fonts/charset.json'),'utf8'));
  const covered=new Set(charset.sans);
  const text=(html+en).replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,'');
  const missing=[...new Set(text)].filter(ch=>/[\u3000-\u9fff\uff00-\uffef]/.test(ch)&&!covered.has(ch));
  assert.equal(missing.join(''),'','Final font subset is missing characters: run npm run fonts:final -- <source dir>');
  // Headings are set in IH Serif, which carries only the characters used in them.
  const serif=new Set(charset.serif||'');
  const headings=[...(html+en).matchAll(/<h([1-5])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map(m=>m[2].replace(/<[^>]+>/g,'')).join('');
  const missingSerif=[...new Set(headings)].filter(ch=>/[\u3000-\u9fff\uff00-\uffef]/.test(ch)&&!serif.has(ch));
  assert.equal(missingSerif.join(''),'','Final serif subset is missing heading characters: run npm run fonts:final -- <source dir>');
  // Display type (Smiley Sans) only carries the characters set in it; headings must be covered.
  const display=new Set(charset.display||'');
  const shown=[...(html+en).matchAll(/<h([12])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map(m=>m[2].replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<[^>]+>/g,'')).join('');
  const missingDisplay=[...new Set(shown)].filter(ch=>/[\u3000-\u9fff\uff00-\uffef]/.test(ch)&&!display.has(ch));
  assert.equal(missingDisplay.join(''),'','Final display subset is missing heading characters: run npm run fonts:final -- <source dir>');
 }
 if(['story','classic'].includes(style.slug)){
  for(const m of html.matchAll(/(?:href|src|data-ih-light|data-ih-dark)="(\.\/[^"?#]+\.(?:css|js|svg))\?v=([a-f0-9]{12})(?:#[^"]*)?"/g)){
   const bytes=await readFile(path.join(base,m[1]));
   assert.equal(m[2],createHash('sha256').update(bytes).digest('hex').slice(0,12),`${style.slug} resource version is stale: run npm run docs:sync`);
  }
 }
}
const staticConfig=JSON.parse(await readFile(path.join(publicRoot,'vercel.json'),'utf8'));
const gitConfig=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
assert.deepEqual(gitConfig.headers,staticConfig.headers,'Git and static deployments must share headers');
assert.equal(gitConfig.outputDirectory,'dist');assert.equal(gitConfig.trailingSlash,true);
// EdgeOne Pages publishes the same build with the same security headers.
const edgeConfig=JSON.parse(await readFile(path.join(root,'edgeone.json'),'utf8'));
assert.equal(edgeConfig.outputDirectory,'./dist','EdgeOne must publish dist only');
assert.deepEqual(edgeConfig.headers.find(h=>h.source==='/*')?.headers,gitConfig.headers.find(h=>h.source==='/(.*)').headers,'EdgeOne and Vercel must share security headers');
console.log(`Gallery, ${catalog.styles.length} style pages, comparison, README synchronization and deployment checks passed.`);
