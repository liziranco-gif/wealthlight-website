import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const pages=readdirSync(root).filter(f=>f.endsWith('.html'));
const errors=[];
const check=(file,target)=>{
  if(!target||/^(?:https?:|mailto:|tel:|#|data:|javascript:)/.test(target))return;
  const clean=target.split('?')[0].split('#')[0];
  if(!clean)return;
  const local=path.resolve(root,file.startsWith('styles/')?'styles/..':'.',clean.replace(/^\//,''));
  const adjusted=clean.startsWith('/')?path.join(root,clean.slice(1)):path.resolve(root,path.dirname(file),clean);
  if(!existsSync(adjusted))errors.push(file+': missing '+clean);
};
for(const page of pages){
 const html=readFileSync(path.join(root,page),'utf8');
 if(!/<title>[^<]+<\/title>/i.test(html))errors.push(page+': missing title');
 if(!/<h1\b/i.test(html))errors.push(page+': missing h1');
 for(const match of html.matchAll(/(?:src|href)=(["'])(.*?)\1/g))check(page,match[2]);
}
const cssFiles=readdirSync(path.join(root,'styles')).filter(f=>f.endsWith('.css'));
for(const name of cssFiles){
 const source=readFileSync(path.join(root,'styles',name),'utf8');
 for(const match of source.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g))check('styles/'+name,match[1]);
}
const repair=readFileSync(path.join(root,'styles/scene-repair-v6.css'),'utf8');
for(const name of ['wl-v6-mountain','wl-v6-trails','wl-v6-content-photo']){
 if(!repair.includes('@keyframes '+name))errors.push('Missing motion animation '+name);
}
for(const page of pages){
 if(!readFileSync(path.join(root,page),'utf8').includes('/styles/scene-repair-v6.css'))
  errors.push(page+': missing new motion and background stylesheet');
}
for(const critical of ['wealthlight-logo-light.png','wealthlight-logo-original.png','hero-mountains.jpg','hero-fog.png','intro-energy-back.png','intro-energy.png']){
 if(!existsSync(path.join(root,'assets',critical)))errors.push('missing critical asset '+critical);
}
const home=readFileSync(path.join(root,'index.html'),'utf8');
if(!home.includes('id="intro-skip"'))errors.push('Missing intro skip control');
if(!home.includes('class="intro-scene"'))errors.push('Missing photo-backed intro transition');
if(pages.length<13)errors.push('Expected 13 pages, got '+pages.length);

const photoStyle=readFileSync(path.join(root,'styles/photographic-v10.css'),'utf8');
for(const page of pages){
 const doc=readFileSync(path.join(root,page),'utf8');
 if(!doc.includes('photographic-v10.css'))errors.push(page+': natural-photography theme missing');
 if(doc.includes('class="scene-overlay-art"'))errors.push(page+': artificial scenic light overlay still in DOM');
}
if(home.includes('intro-energy-back.png')||home.includes('intro-energy.png'))errors.push('Opening still contains blue/gold ring images');
if(home.includes('class="intro-aura"'))errors.push('Opening still includes old energy-ring container');
if(!photoStyle.includes('wl-v10-brand')||!photoStyle.includes('wl-v10-photo-reveal'))errors.push('Natural intro crossfade rules missing');
const behavior=readFileSync(path.join(root,'scripts/site.js'),'utf8');
if(!behavior.includes('timer=window.setTimeout(()=>hide(false),9000)'))errors.push('Intro must start its 1s dismissal at 9 seconds');
if(!behavior.includes('intro.hidden=true},1000'))errors.push('Intro dismissal must finish at 10 seconds');
if(!photoStyle.includes('--photo-home:url("https://images.unsplash.com/'))errors.push('Real photographic background missing');

console.log('Verified '+pages.length+' HTML pages, CSS links and mandatory PNG/JPG assets.');
if(errors.length){errors.forEach(e=>console.error('ERROR: '+e));process.exit(1)}
console.log('PASS: no missing referenced local assets or pages.');
