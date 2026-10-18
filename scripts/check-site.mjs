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
const css=readFileSync(path.join(root,'styles/site.css'),'utf8');
for(const match of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g))check('styles/site.css',match[1]);
for(const critical of ['wealthlight-logo-light.png','wealthlight-logo-original.png','hero-mountains.jpg','hero-fog.png','intro-energy-back.png','intro-energy.png']){
 if(!existsSync(path.join(root,'assets',critical)))errors.push('missing critical asset '+critical);
}
const home=readFileSync(path.join(root,'index.html'),'utf8');
if(!home.includes('id="intro-skip"'))errors.push('Missing intro skip control');
if(!home.includes('class="intro-scene"'))errors.push('Missing photo-backed intro transition');
if(pages.length<13)errors.push('Expected 13 pages, got '+pages.length);
console.log('Verified '+pages.length+' HTML pages, CSS links and mandatory PNG/JPG assets.');
if(errors.length){errors.forEach(e=>console.error('ERROR: '+e));process.exit(1)}
console.log('PASS: no missing referenced local assets or pages.');
