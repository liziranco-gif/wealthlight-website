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

 const presentation=await(await fetch(base+'/styles/wealthlight-visual-v16.css')).text();
 assert.ok(presentation.includes('body[data-page="markets"]')&&presentation.includes('/assets/markets-mountains.jpg'),'Independent Markets scene missing');
 assert.ok(presentation.includes('body[data-page="research-&-insights"]')&&presentation.includes('/assets/research-mountains.jpg'),'Independent Research scene missing');
 assert.ok(presentation.includes('body[data-page="about"]')&&presentation.includes('/assets/hero-mountains.jpg'),'Independent About scene missing');
 for(const page of ['index.html','about.html','markets.html','research.html','risk.html','contact.html']){
  const doc=await(await fetch(base+'/'+page)).text();
  assert.ok(doc.includes('wealthlight-visual-v16.css'),'Cohesive scene CSS missing from '+page);
  assert.ok(doc.includes('class="brand brand-lockup"')&&doc.includes('class="brand-title">WealthLight</span>')&&doc.includes('See the Market Differently.'),'Official English brand missing on '+page);
  assert.ok(!doc.includes('财富之光')&&!doc.includes('换个角度看市场。'),'Chinese translation must not replace the company brand on '+page);
  assert.ok(!doc.includes('<div class="footer-brand"><img src="/assets/wealthlight-logo-light.png"'),'Duplicate footer lockup remains on '+page);
 }
 const sceneStyle=await(await fetch(base+'/styles/wealthlight-live-v17.css')).text();
 assert.ok(sceneStyle.includes('wl-v17-photographic-drift')&&sceneStyle.includes('.wl-chapter-image'),'Image movement and editorial photo composition are missing');
 assert.ok(!sceneStyle.includes('canvas.getContext')&&!sceneStyle.includes('market-trends.png'),'Visual scene must use prepared photo assets, not generated charts');
 const imagePages=['index.html','about.html','capabilities.html','markets.html','strategies.html','research.html','risk.html','approach.html','perspective.html','technology.html','institutional.html','contact.html','disclosure.html'];
 for(const page of imagePages){
  const markup=await(await fetch(base+'/'+page)).text();
  assert.ok(markup.includes('wealthlight-live-v17.css?v=actual17'),page+': live photographic style not linked');
  assert.ok(markup.includes('class="brand-title">WealthLight</span>'),'English WealthLight brand missing on '+page);
  assert.ok(markup.includes('class="footer-brand" translate="no"'),'Brand slogan must remain English and untranslated on '+page);
  assert.ok(!markup.includes('财富之光')&&!markup.includes('换个角度看市场。'),'Old Chinese lockup found on '+page);
  assert.ok(markup.includes('class="wl-chapter-image"'),page+': prepared editorial photo missing');
  const match=markup.match(/class="wl-chapter-image"[^>]*><img src="(\/assets\/[^"]+)"/);
  assert.ok(match,page+': cannot identify editorial image source');
  const img=await fetch(base+match[1]);
  assert.equal(img.status,200,page+': media file not served');
  const bytes=Buffer.from(await img.arrayBuffer());
  assert.ok(bytes.length>8000,page+': image may be invalid');
  assert.equal(bytes[0],0xff,page+': expected real JPEG photographic file');
 }
 assert.ok(homeHTML.includes('class="button ghost" href="/contact.html">Start a Conversation'), 'Home conversation button should open actual contact form');
 const contactHTML=await (await fetch(base+'/contact.html')).text();
 assert.ok(contactHTML.includes('wealthlight-contact-form'),'Contact page missing real form');
 assert.ok(contactHTML.includes('action="https://formsubmit.co/ajax/hr@wealthlight.net"'),'Contact must submit to the same-page AJAX endpoint');
 assert.ok(contactHTML.includes('name="_subject" value="有人在你的网站中留言了"'),'Notify the official inbox with the requested Chinese email subject');
 assert.ok(!contactHTML.includes('name="_next"'),'Contact must not redirect to external or secondary pages');
 assert.ok(contactHTML.includes('Submission Successful.'),'Submission confirmation must display inside the contact page');
 assert.ok(contactHTML.includes('name="_captcha" value="false"'),'Contact should not redirect users to FormSubmit reCAPTCHA page');
 assert.ok(contactHTML.includes('name="_honey"'),'Keep spam honeypot on contact form');
 assert.ok(!/<button[^>]+id="wl-form-submit"[^>]+disabled/.test(contactHTML),'Public contact submission must be enabled');
 const contactJS=await (await fetch(base+'/scripts/contact.js')).text();
 assert.ok(!contactJS.includes('/api/contact/status'),'Contact page must not depend on Resend API configuration');
 assert.ok(contactJS.includes('event.preventDefault()'),'Form submit must not navigate away');
 assert.ok(contactJS.includes("result.success===true||result.success==='true'"),'Only truthfully accepted FormSubmit messages show success');
 assert.ok(contactJS.includes('form.hidden=true')&&contactJS.includes('success.hidden=false'),'Success is shown inline after confirmed acceptance');
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
