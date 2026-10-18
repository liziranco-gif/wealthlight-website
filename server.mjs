import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

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
 try{const data=await fs.readFile(full);res.writeHead(200,{'Content-Type':mime[ext],'Cache-Control':(ext==='.html'||ext==='.css')?'no-cache, max-age=0':'public, max-age=120','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY'});res.end(req.method==='HEAD'?undefined:data)}
 catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found')}
}
const server=http.createServer(async(req,res)=>{
 let u;try{u=new URL(req.url||'/', 'http://localhost')}catch{reply(res,400,{error:'Invalid URL'});return}
 const name=u.pathname;
 if(name==='/healthz'){reply(res,200,{ok:true});return}
 if(name==='/api/contact/status'&&req.method==='GET'){reply(res,200,{ready,turnstileSiteKey:ready&&hasCaptcha?turnstileSiteKey:null});return}
 if(name==='/api/contact'){if(req.method!=='POST'){reply(res,405,{ok:false,message:'Method not allowed.'});return}await contact(req,res);return}
 if(req.method!=='GET'&&req.method!=='HEAD'){reply(res,405,{error:'Method not allowed'});return}
 await serve(req,res,name);
});
server.requestTimeout=18000;
server.headersTimeout=12000;
server.listen(PORT,'0.0.0.0',()=>console.log('WealthLight web service listening on '+PORT+'; contact delivery configured: '+ready));
