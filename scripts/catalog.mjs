import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const publicRoot = path.join(root, 'public');
export const markers = { readme:['<!-- STYLES:START -->','<!-- STYLES:END -->'], gallery:['<!-- GALLERY:START -->','<!-- GALLERY:END -->'] };
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function loadCatalog() {
  const catalog = JSON.parse(await readFile(path.join(root,'styles.json'),'utf8'));
  if (!/^https:\/\/[a-z0-9.-]+$/.test(catalog.origin)) throw new Error('Invalid gallery origin');
  const slugs = new Set();
  for (const style of catalog.styles) {
    if (!/^[a-z][a-z0-9-]*$/.test(style.slug) || ['compare','previews','assets'].includes(style.slug) || slugs.has(style.slug)) throw new Error('Invalid or duplicate style slug');
    if (style.path !== `/${style.slug}/` || style.preview !== `/previews/${style.slug}-home.png`) throw new Error(`Invalid style paths: ${style.slug}`);
    for (const key of ['name','subtitle','description','updated']) if (typeof style[key] !== 'string' || !style[key]) throw new Error(`Missing ${key}: ${style.slug}`);
    if (!Array.isArray(style.tags)) throw new Error(`Missing tags: ${style.slug}`);
    slugs.add(style.slug);
  }
  if (!slugs.size) throw new Error('At least one design style is required');
  return catalog;
}
export function replaceBlock(source, type, content) {
  const [start, end] = markers[type], a = source.indexOf(start), b = source.indexOf(end);
  if (a < 0 || b < a) throw new Error(`Missing ${type} gallery markers`);
  return source.slice(0,a+start.length)+'\n'+content.trim()+'\n'+source.slice(b);
}
export function extractBlock(source,type) {
  const [start,end]=markers[type],a=source.indexOf(start),b=source.indexOf(end);
  if(a<0||b<a) throw new Error(`Missing ${type} gallery markers`);
  return source.slice(a+start.length,b).trim();
}
async function treeFingerprint(directory) {
  const entries=[];
  async function walk(dir) {
    for(const item of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      const file=path.join(dir,item.name);
      if(item.isDirectory()) await walk(file);
      else entries.push(path.relative(directory,file)+'\0'+hash(await readFile(file)));
    }
  }
  await walk(directory);
  return hash(entries.join('\n'));
}
export async function fingerprints(catalog) {
  const result={};
  for(const style of catalog.styles) result[style.slug]={source:await treeFingerprint(path.join(publicRoot,style.slug)),preview:hash(await readFile(path.join(publicRoot,style.preview)))};
  return result;
}
const escapeHtml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function galleryCards(catalog, prints) {
  return catalog.styles.map((style,i)=>`<article class="style-card"><a class="style-preview" href="${style.path}" aria-label="打开 ${escapeHtml(style.name)} 风格"><img src="${style.preview}?v=${prints[style.slug].preview.slice(0,12)}" width="1280" height="844" alt="${escapeHtml(style.name)} 风格首页预览"><span class="preview-overlay" aria-hidden="true"></span><span class="preview-open">进入完整页面 <span aria-hidden="true">↗</span></span></a><div class="card-meta"><span class="card-number">${String(i+1).padStart(2,'0')}</span><div class="card-heading"><h2><a href="${style.path}">${escapeHtml(style.name)} <span aria-hidden="true">↗</span></a></h2><span class="card-subtitle">${escapeHtml(style.subtitle)}</span><p>${escapeHtml(style.description)}</p><div class="card-tags">${style.tags.map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div><a class="card-route" href="${style.path}">${escapeHtml(catalog.origin+style.path)}</a></div></div></article>`).join('\n');
}
export async function readmeGallery(catalog, prints, indexHtml) {
  const galleryPreview=hash(await readFile(path.join(publicRoot,'previews/gallery-home.png')));
  const gallerySource=hash(indexHtml+await readFile(path.join(publicRoot,'gallery.css'),'utf8')+await treeFingerprint(path.join(publicRoot,'compare'))+JSON.stringify(catalog));
  const content=[`[打开在线展示画廊](${catalog.origin}/) · [并排对比风格](${catalog.origin}/compare/)`,``,`[![展示画廊首页](public/previews/gallery-home.png?v=${galleryPreview.slice(0,12)})](${catalog.origin}/)`,``,`<!-- gallery-source:${gallerySource} preview:${galleryPreview} -->`];
  for(const style of catalog.styles) content.push(``,`### ${style.name} · ${style.subtitle}`,``,`[![${style.name} 首页](public${style.preview}?v=${prints[style.slug].preview.slice(0,12)})](${catalog.origin+style.path})`,``,style.description,``,`**访问页面：[${catalog.origin+style.path}](${catalog.origin+style.path})**`,``,`<!-- style:${style.slug} source:${prints[style.slug].source} preview:${prints[style.slug].preview} -->`);
  return content.join('\n');
}
