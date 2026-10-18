import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, createHmac, timingSafeEqual, randomBytes} from 'node:crypto';


/* Server-side, invite-only website. Secret is ONLY in Railway SITE_ACCESS_PASSWORD.
   Never embed, log, or commit the chosen password. */
const siteSecret=(process.env.SITE_ACCESS_PASSWORD||'').trim();
const accessControlled=siteSecret.length>0;
const sessionPeriodMs=24*60*60*1000;
const failures=new Map();
function safePath(raw){
 if(typeof raw!=='string'||!raw.startsWith('/')||raw.startsWith('//')||raw.includes('\\')||/[\r\n]/.test(raw))return '/';
 try{
  const u=new URL(raw,'https://wealthlight.net');
  if(u.origin!=='https://wealthlight.net'||u.pathname.startsWith('/access')||u.pathname==='/logout')return '/';
  return u.pathname+(u.search||'');
 }catch{return '/'}
}
const authSigningKey=accessControlled?createHash('sha256').update('WealthLight signed sessions v1\u0000'+siteSecret).digest():null;
function signature(value){
 return createHmac('sha256',authSigningKey).update(value).digest('hex');
}
function verifySession(req){
 if(!accessControlled)return true;
 const text=String(req.headers.cookie||'');
 const cookie=text.split(';').map(x=>x.trim()).find(x=>x.startsWith('wl_access='));
 if(!cookie)return false;
 const parts=cookie.slice(10).split('.');
 if(parts.length!==3||!/^\d{13}$/.test(parts[0])||!/^[a-f0-9]{24}$/.test(parts[1])||!/^[a-f0-9]{64}$/.test(parts[2]))return false;
 const expires=Number(parts[0]);
 if(!Number.isSafeInteger(expires)||Date.now()>=expires||expires>Date.now()+sessionPeriodMs+60000)return false;
 const actual=Buffer.from(parts[2],'hex'),expected=Buffer.from(signature(parts[0]+'.'+parts[1]),'hex');
 return timingSafeEqual(actual,expected);
}
function secureHeaders(res){
 res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive, nosnippet, noimageindex');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Frame-Options','DENY');
}
function gatePage(next,reason=''){
 const target=escapeHtml(safePath(next));
 const error=reason?'<p class="error" role="alert">'+escapeHtml(reason)+'</p>':'';
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="theme-color" content="#041523"><title>Private Access | WealthLight</title><style>
 *{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 50% 15%,#12344b,#071a2a 52%,#03101d);color:#f3f7fb;font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;display:grid;place-items:center;padding:30px}
 .panel{width:min(100%,470px);padding:clamp(28px,5vw,53px);border:1px solid rgba(199,223,236,.24);background:rgba(4,18,31,.91);box-shadow:0 25px 90px rgba(0,0,0,.28)}
 .brand{display:block;max-width:255px;width:80%;height:auto;object-fit:contain;margin:0 auto 34px;filter:brightness(1.45)}
 .eyebrow{margin:0 0 13px;color:#ddbd86;font-size:11px;letter-spacing:.24em;font-weight:700}
 h1{font:normal clamp(31px,6vw,44px)/1.15 Georgia,serif;margin:0 0 14px}
 .copy{font-size:14px;line-height:1.7;color:#bfcfdb;margin:0 0 31px}
 label{display:block;margin:0 0 11px;font-size:12px;letter-spacing:.09em;color:#e4d7bd}
 input{width:100%;border:1px solid #6d8493;background:#081e2f;color:#fff;padding:15px;font:inherit;border-radius:2px}
 input:focus{outline:2px solid #d8b879;outline-offset:3px}
 button{margin-top:16px;width:100%;padding:15px;border:0;background:#e9c58b;color:#071727;font-size:13px;font-weight:700;letter-spacing:.06em;cursor:pointer}
 button:hover{background:#f4d6a2}.error{color:#ffd4cb;font-size:13px}
 .note{font-size:12px;color:#8ca6b6;margin-top:21px;text-align:center}
 </style></head><body><main class="panel"><img class="brand" src="/assets/wealthlight-logo-light.png" alt="WealthLight"><p class="eyebrow">PRIVATE WEBSITE ACCESS</p><h1>Welcome to WealthLight.</h1><p class="copy">This website is available by invitation. Enter the access password to continue.</p>${error}<form method="post" action="/access" autocomplete="off"><input type="hidden" name="next" value="${target}"><label for="password">ACCESS PASSWORD</label><input id="password" type="password" name="password" required autofocus autocomplete="current-password" maxlength="120"><button type="submit">Enter Website &nbsp;↗</button></form><p class="note">WEALTHLIGHT · MARKET INTELLIGENCE</p></main></body></html>`;
}
function showGate(req,res,next,reason='',status=401){
 res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
 res.end(req.method==='HEAD'?undefined:gatePage(next,reason));
}
function limited(ip){
 const now=Date.now();let entry=failures.get(ip);
 if(!entry||now-entry.start>15*60*1000){entry={start:now,count:0};failures.set(ip,entry)}
 if(failures.size>4000){for(const [k,v] of failures){if(now-v.start>15*60*1000)failures.delete(k)}}
 return entry.count>=8;
}
async function acceptPassword(req,res){
 if(!accessControlled){res.writeHead(303,{Location:'/'});res.end();return}
 if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']||'')){res.writeHead(415);res.end('Unsupported content type');return}
 let data;
 try{
  const pieces=[];let size=0;
  for await(const part of req){size+=part.length;if(size>4000)throw Error('size');pieces.push(part)}
  data=new URLSearchParams(Buffer.concat(pieces).toString('utf8'));
 }catch{res.writeHead(400);res.end('Invalid request');return}
 const redirect=safePath(data.get('next'));
 const ip=ipOf(req);
 if(limited(ip)){showGate(req,res,redirect,'Too many attempts. Please try again in 15 minutes.',429);return}
 const supplied=String(data.get('password')||'');
 const candidate=createHash('sha256').update(supplied).digest();
 const expected=createHash('sha256').update(siteSecret).digest();
 if(!timingSafeEqual(candidate,expected)){
  const entry=failures.get(ip)||{start:Date.now(),count:0};entry.count++;failures.set(ip,entry);
  showGate(req,res,redirect,'Incorrect password. Please try again.',401);return;
 }
 failures.delete(ip);
 const expiry=Date.now()+sessionPeriodMs,nonce=randomBytes(12).toString('hex');
 const unsigned=expiry+'.'+nonce;
 const token=unsigned+'.'+signature(unsigned);
 res.writeHead(303,{
  Location:redirect,
  'Set-Cookie':'wl_access='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400',
  'Cache-Control':'no-store'
 });
 res.end();
}

const root=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||3000);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml'};
const recipients=(process.env.CONTACT_TO_EMAIL||'').trim();
const from=(process.env.CONTACT_FROM_EMAIL||'').trim();
const mailKey=(process.env.RESEND_API_KEY||'').trim();
const turnstileSiteKey=(process.env.TURNSTILE_SITE_KEY||'').trim();
const turnstileSecret=(process.env.TURNSTILE_SECRET_KEY||'').trim();
const hasCaptcha=(turnstileSiteKey&&turnstileSecret);
const ready=Boolean(recipients&&from&&mailKey&&(!turnstileSiteKey||turnstileSecret)&&(!turnstileSecret||turnstileSiteKey));
const limits=new Map();
const mailRE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const fields=['fullName','email','country','clientType','interest','message'];
function reply(res,code,data){
 res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(JSON.stringify(data));
}
function clean(v,max=140){
 if(typeof v!=='string')return '';
 return v.trim().replace(/[\u0000-\u001F\u007F]/g,' ').slice(0,max);
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function ipOf(req){return clean(String(req.headers['x-forwarded-for']||'').split(',')[0]||req.socket.remoteAddress||'',100)}
function rateLimit(ip){
 const now=Date.now(),windowMs=15*60*1000,max=5;
 let item=limits.get(ip);
 if(!item||now-item.since>windowMs){item={since:now,count:0};limits.set(ip,item)}
 item.count++;
 if(limits.size>3000){for(const [k,v] of limits){if(now-v.since>windowMs)limits.delete(k)}}
 return item.count>max;
}
async function verifyCaptcha(token,ip){
 const body=new URLSearchParams({secret:turnstileSecret,response:token,remoteip:ip});
 const controller=new AbortController();const t=setTimeout(()=>controller.abort(),8000);
 try{const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body,signal:controller.signal});const x=await r.json();return Boolean(r.ok&&x.success)}
 catch{return false}finally{clearTimeout(t)}
}
async function readJSON(req){
 let total=0,chunks=[];
 for await(const chunk of req){total+=chunk.length;if(total>18000)throw Error('too-large');chunks.push(chunk)}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Error('invalid-json')}
}
async function deliver(data){
 const lines=[
 'New WealthLight website enquiry','',
 'Full name: '+data.fullName,'Email: '+data.email,
 'Organization: '+data.organization,'Role: '+data.jobTitle,'Country / Region: '+data.country,
 'Phone: '+data.phone,'Client Type: '+data.clientType,'Area of Interest: '+data.interest,
 'Meeting requested: '+data.meeting,
 'Meeting format: '+data.meetingFormat,'Time zone / availability: '+data.meetingTime,'',
 'Message:',data.message,'','Source: WealthLight website contact form'
 ];
 const html='<div style="font:15px/1.6 Arial,sans-serif;color:#10243a"><h2>WealthLight website enquiry</h2><pre style="white-space:pre-wrap;font:inherit">'+escapeHtml(lines.join('\n'))+'</pre></div>';
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:'Bearer '+mailKey,'Content-Type':'application/json'},
   body:JSON.stringify({from,to:recipients.split(',').map(x=>x.trim()).filter(Boolean),reply_to:data.email,subject:'WealthLight Enquiry — '+data.interest,text:lines.join('\n'),html}),
   signal:controller.signal
  });
  return response.ok;
 }finally{clearTimeout(timer)}
}
async function contact(req,res){
 if(!ready){reply(res,503,{ok:false,message:'Our secure enquiry service is not configured yet. Please try again later.'});return}
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json')){reply(res,415,{ok:false,message:'Unsupported request format.'});return}
 const origin=req.headers.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host){reply(res,403,{ok:false,message:'Unable to process this request.'});return}}catch{reply(res,403,{ok:false,message:'Unable to process this request.'});return}}
 const ip=ipOf(req);
 if(rateLimit(ip)){reply(res,429,{ok:false,message:'Too many enquiries. Please try again later.'});return}
 let incoming;
 try{incoming=await readJSON(req)}catch{reply(res,400,{ok:false,message:'Please check your message and try again.'});return}
 if(!incoming||typeof incoming!=='object'||Array.isArray(incoming)){reply(res,400,{ok:false,message:'Please review your enquiry.'});return}
 if(clean(incoming.website,500)){reply(res,400,{ok:false,message:'Unable to process this enquiry.'});return}
 const elapsed=Date.now()-Number(incoming.startedAt||0);
 if(elapsed<1800||elapsed>12*60*60*1000){reply(res,400,{ok:false,message:'Please reload the form and try again.'});return}
 const data={fullName:clean(incoming.fullName,120),email:clean(incoming.email,254),organization:clean(incoming.organization,150),jobTitle:clean(incoming.jobTitle,120),country:clean(incoming.country,100),phone:clean(incoming.phone,40),clientType:clean(incoming.clientType,100),interest:clean(incoming.interest,120),message:clean(incoming.message,3500),meeting:clean(incoming.meeting,10),meetingFormat:clean(incoming.meetingFormat,40),meetingTime:clean(incoming.meetingTime,140)};
 if(fields.some(k=>!data[k])||data.message.length<15||!mailRE.test(data.email)||incoming.consent!==true){reply(res,400,{ok:false,message:'Please complete the required fields and check your email.'});return}
 if(hasCaptcha){const valid=await verifyCaptcha(clean(incoming.turnstileToken,2048),ip);if(!valid){reply(res,400,{ok:false,message:'Human verification failed. Please retry.'});return}}
 try{const sent=await deliver(data);if(!sent){reply(res,502,{ok:false,message:'We could not deliver your enquiry right now. Please try again later.'});return}
  reply(res,200,{ok:true,message:'Thank you for reaching out.'});
 }catch{reply(res,502,{ok:false,message:'We could not deliver your enquiry right now. Please try again later.'})}
}
async function serve(req,res,pathname){
 let relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
 let allowed=relative.endsWith('.html')&&!relative.includes('/')||relative.startsWith('assets/')||relative.startsWith('styles/')||relative.startsWith('scripts/')||relative==='robots.txt'||relative==='sitemap.xml';
 if(!allowed||relative.split('/').some(t=>t.startsWith('.'))||relative.includes('..')){res.writeHead(404);res.end('Not found');return}
 const full=path.resolve(root,relative);if(!full.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return}
 const ext=path.extname(full).toLowerCase();if(!mime[ext]){res.writeHead(404);res.end('Not found');return}
 try{const data=await fs.readFile(full);res.writeHead(200,{'Content-Type':mime[ext],'Cache-Control':accessControlled?'private, no-store':(ext==='.html'||ext==='.css')?'no-cache, max-age=0':'public, max-age=120','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY'});res.end(req.method==='HEAD'?undefined:data)}
 catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found')}
}
const server=http.createServer(async(req,res)=>{
 let u;try{u=new URL(req.url||'/', 'http://localhost')}catch{reply(res,400,{error:'Invalid URL'});return}
 const name=u.pathname;
 secureHeaders(res);
 if(name==='/robots.txt'&&(req.method==='GET'||req.method==='HEAD')){
  res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:'User-agent: *\nDisallow: /\n');
  return;
 }
 if(name==='/sitemap.xml'){res.writeHead(404,{'Cache-Control':'no-store'});res.end('Not found');return}
 if(name==='/access'&&accessControlled){
  if(req.method==='POST'){await acceptPassword(req,res);return}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
  if(verifySession(req)){res.writeHead(303,{Location:'/'});res.end();return}
  showGate(req,res,u.searchParams.get('next')||'/', '', 401);return;
 }
 if(name==='/logout'&&accessControlled){
  res.writeHead(303,{Location:'/access','Set-Cookie':'wl_access=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0','Cache-Control':'no-store'});
  res.end();return;
 }
 // Serve only the brand logo on the sign-in page; all other files require a signed session.
 if(accessControlled&&!verifySession(req)&&name!=='/healthz'&&name!=='/assets/wealthlight-logo-light.png'){
  showGate(req,res,req.method==='GET'||req.method==='HEAD'?req.url:'/');return;
 }
 if(name==='/healthz'){reply(res,200,{ok:true});return}
 if(name==='/api/contact/status'&&req.method==='GET'){reply(res,200,{ready,turnstileSiteKey:ready&&hasCaptcha?turnstileSiteKey:null});return}
 if(name==='/api/contact'){if(req.method!=='POST'){reply(res,405,{ok:false,message:'Method not allowed.'});return}await contact(req,res);return}
 if(req.method!=='GET'&&req.method!=='HEAD'){reply(res,405,{error:'Method not allowed'});return}
 await serve(req,res,name);
});
server.requestTimeout=18000;
server.headersTimeout=12000;
server.listen(PORT,'0.0.0.0',()=>console.log('WealthLight web service listening on '+PORT+'; contact delivery configured: '+ready));
