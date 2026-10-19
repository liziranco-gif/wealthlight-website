import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
const port=String(19000+Math.floor(Math.random()*500));
const pass='test-only-in-ci-never-the-production-password';
const child=spawn(process.execPath,['server.mjs'],{
 cwd:process.cwd(),
 env:{...process.env,PORT:port,SITE_ACCESS_PASSWORD:pass,RESEND_API_KEY:'',CONTACT_TO_EMAIL:'',CONTACT_FROM_EMAIL:''},
 stdio:['ignore','pipe','pipe']
});
const url='http://127.0.0.1:'+port;
let logs='';
child.stdout.on('data',d=>logs+=d.toString());
child.stderr.on('data',d=>logs+=d.toString());
async function ready(){
 for(let i=0;i<50;i++){
  if(child.exitCode!==null)throw Error('Protected server crashed: '+logs);
  try{if((await fetch(url+'/healthz')).status===200)return}catch{}
  await wait(100);
 }
 throw Error('Protected server failed health check: '+logs);
}
const checkNoindex=r=>assert.match(r.headers.get('x-robots-tag')||'',/noindex/,'Indexing must be explicitly blocked');
try{
 await ready();
 const health=await fetch(url+'/healthz');assert.equal(health.status,200);checkNoindex(health);
 const robots=await fetch(url+'/robots.txt');
 assert.equal(robots.status,200);checkNoindex(robots);
 assert.match(await robots.text(),/User-agent: \*/);
 const robots2=await fetch(url+'/robots.txt');assert.match(await robots2.text(),/Disallow: \/+/);
 for(const path of ['/','/about.html','/contact.html','/assets/hero-mountains.jpg','/styles/site.css','/scripts/site.js','/api/contact/status','/sitemap.xml']){
  const r=await fetch(url+path,{redirect:'manual'});
  assert.notEqual(r.status,200,'Unauthenticated access leaked '+path);
  checkNoindex(r);
 }
 const publicIcon=await fetch(url+'/favicon.ico');
 assert.equal(publicIcon.status,200,'Password page browser icon should be public');
 assert.match(publicIcon.headers.get('content-type')||'',/image\/png/);
 checkNoindex(publicIcon);
 const logo=await fetch(url+'/assets/wealthlight-logo-light.png');
 assert.equal(logo.status,200,'Only the public login logo should remain readable');checkNoindex(logo);
 const login=await fetch(url+'/access?next=%2Fcontact.html');
 assert.equal(login.status,401);checkNoindex(login);
 const form=await login.text();
 assert.match(form,/name="password"/);
 assert.ok(!form.includes(pass),'Never expose password in HTML');
 const headers={'Content-Type':'application/x-www-form-urlencoded'};
 const wrong=await fetch(url+'/access',{method:'POST',headers,body:new URLSearchParams({password:'wrong',next:'/contact.html'}),redirect:'manual'});
 assert.equal(wrong.status,401);checkNoindex(wrong);
 const verified=await fetch(url+'/access',{method:'POST',headers,body:new URLSearchParams({password:pass,next:'/contact.html'}),redirect:'manual'});
 assert.equal(verified.status,303);checkNoindex(verified);
 assert.equal(verified.headers.get('location'),'/contact.html');
 const setCookie=verified.headers.get('set-cookie')||'';
 assert.match(setCookie,/wl_access=/);
 for(const part of ['HttpOnly','Secure','SameSite=Lax'])assert.ok(setCookie.includes(part));
 const cookie=setCookie.split(';')[0];
 for(const path of ['/','/about.html','/contact.html','/assets/hero-mountains.jpg','/styles/site.css']){
  const r=await fetch(url+path,{headers:{Cookie:cookie}});
  assert.equal(r.status,200,'Authenticated session should read '+path);checkNoindex(r);
 }
 const authenticated=await fetch(url+'/assets/hero-mountains.jpg',{headers:{Cookie:cookie}});
 assert.equal(authenticated.status,200);assert.match(authenticated.headers.get('cache-control')||'',/private, no-cache/);
 const imageTag=authenticated.headers.get('etag');assert.ok(imageTag,'Protected photos need ETags');
 const cached=await fetch(url+'/assets/hero-mountains.jpg',{headers:{Cookie:cookie,'If-None-Match':imageTag}});
 assert.equal(cached.status,304,'Authenticated revalidation should return a lightweight 304');checkNoindex(cached);
 const unauthenticated=await fetch(url+'/assets/hero-mountains.jpg',{headers:{'If-None-Match':imageTag}});
 assert.equal(unauthenticated.status,401,'Never return 304 or content without authenticated cookie');
 const obsolete=await fetch(url+'/contact-success.html',{headers:{Cookie:cookie},redirect:'manual'});
 assert.equal(obsolete.status,303);assert.equal(obsolete.headers.get('location'),'/contact.html');
 const tampered=cookie.replace(/[a-f0-9]$/,x=>x==='f'?'e':'f');
 assert.equal((await fetch(url+'/about.html',{headers:{Cookie:tampered}})).status,401,'Forged session must fail');
 const external=await fetch(url+'/access',{method:'POST',headers,body:new URLSearchParams({password:pass,next:'//evil.test'}),redirect:'manual'});
 assert.equal(external.headers.get('location'),'/', 'Prevent open redirects');
 const logout=await fetch(url+'/logout',{headers:{Cookie:cookie},redirect:'manual'});
 assert.equal(logout.status,303);assert.match(logout.headers.get('set-cookie')||'',/Max-Age=0/);
 console.log('PASS: password gate, signed sessions, robots block, noindex headers, unauthenticated asset blocking, secure logout.');
}finally{
 child.kill('SIGTERM');
}
