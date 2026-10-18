import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const port='19473';
const proc=spawn(process.execPath,['server.mjs'],{
 cwd:process.cwd(),env:{...process.env,PORT:port,RESEND_API_KEY:'',CONTACT_FROM_EMAIL:'',CONTACT_TO_EMAIL:''},
 stdio:['ignore','pipe','pipe']
});
let output='';
proc.stdout.on('data',b=>output+=b.toString());
proc.stderr.on('data',b=>output+=b.toString());
const base='http://127.0.0.1:'+port;
async function waitForServer(){
 for(let i=0;i<45;i++){
  if(proc.exitCode!==null)throw Error('Server terminated prematurely: '+output);
  try{const r=await fetch(base+'/healthz');if(r.ok)return}catch{}
  await delay(100);
 }
 throw Error('Server never became healthy: '+output);
}
try{
 await waitForServer();
 for(const url of ['/','/index.html','/about.html','/markets.html','/research.html','/risk.html','/contact.html','/contact-success.html','/styles/site.css','/scripts/site.js','/scripts/contact.js','/assets/hero-mountains.jpg','/styles/market-intelligence-v11.css']){
  const r=await fetch(base+url);
  assert.equal(r.status,200,url+' must be served');
  const b=await r.arrayBuffer();
  assert.ok(b.byteLength>20,url+' must not be empty');
 }
 const homeHTML=await (await fetch(base+'/index.html')).text();
 assert.ok(homeHTML.includes('wl-research-ribbon'),'Research coverage ribbon must remain visible');
 assert.ok(!homeHTML.includes('wl-financial-art'),'No procedural chart layers may be used');

 const contactHTML=await (await fetch(base+'/contact.html')).text();
 assert.ok(contactHTML.includes('wealthlight-contact-form'),'Contact page missing real form');
 assert.ok(contactHTML.includes('action="https://formsubmit.co/hr@wealthlight.net"'),'Contact must forward directly to the official WealthLight inbox');
 assert.ok(contactHTML.includes('name="_captcha" value="false"'),'Contact should not redirect users to FormSubmit reCAPTCHA page');
 assert.ok(contactHTML.includes('name="_honey"'),'Keep spam honeypot on contact form');
 assert.ok(!/<button[^>]+id="wl-form-submit"[^>]+disabled/.test(contactHTML),'Public contact submission must be enabled');
 const contactJS=await (await fetch(base+'/scripts/contact.js')).text();
 assert.ok(!contactJS.includes('/api/contact/status'),'Contact page must not depend on Resend API configuration');
 const status=await(await fetch(base+'/api/contact/status')).json();
 assert.equal(status.ready,false,'Should not enable contact without configured recipient');
 const result=await fetch(base+'/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fullName:'Test',email:'test@example.com'})});
 assert.equal(result.status,503,'Must never report successful delivery without mail config');
 const missing=await fetch(base+'/private-not-real.html');
 assert.equal(missing.status,404);
 console.log('PASS: 13-page site, assets and contact API smoke tests.');
}finally{
 proc.kill('SIGTERM');
}
