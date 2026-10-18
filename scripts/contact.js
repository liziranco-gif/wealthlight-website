(()=>{
'use strict';
const form=document.getElementById('wealthlight-contact-form');
if(!form)return;
const button=document.getElementById('wl-form-submit');
const status=document.getElementById('wl-form-status');
const meeting=document.getElementById('wl-meeting');
const options=document.getElementById('wl-meeting-options');
const startedAt=Date.now();
let enabled=false;
let sending=false;
let captchaToken='';
const say=(message,type)=>{status.textContent=message;status.dataset.status=type};
const showMeeting=()=>{options.hidden=meeting.value!=='Yes'};
meeting.addEventListener('change',showMeeting);
showMeeting();
const fetchWithTimeout=async(url,opts={},ms=12000)=>{
 const c=new AbortController();const timer=setTimeout(()=>c.abort(),ms);
 try{return await fetch(url,{...opts,signal:c.signal,credentials:'same-origin'})}
 finally{clearTimeout(timer)}
};
const setupCaptcha=sitekey=>{
 const node=document.createElement('div');node.id='wl-turnstile-widget';
 form.querySelector('.contact-form-grid').insertBefore(node,form.querySelector('.form-field.wide:last-child'));
 const script=document.createElement('script');
 script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
 script.async=true;
 script.onload=()=>{
  if(!window.turnstile){say('Human verification is unavailable. Please retry later.','offline');button.disabled=true;return}
  window.turnstile.render(node,{sitekey,callback:token=>{captchaToken=token},'expired-callback':()=>{captchaToken=''},'error-callback':()=>{captchaToken='';say('Human verification is temporarily unavailable.','error')}});
 };
 script.onerror=()=>{say('Human verification is temporarily unavailable.','offline');button.disabled=true};
 document.head.appendChild(script);
};
async function initialise(){
 try{
  const r=await fetchWithTimeout('/api/contact/status',{headers:{Accept:'application/json'}},8000);
  const data=await r.json();
  if(!r.ok||!data.ready){say('Our secure enquiry channel is being prepared. The form is visible for review, but submissions are not yet enabled.','offline');return}
  enabled=true;button.disabled=false;
  if(data.turnstileSiteKey)setupCaptcha(data.turnstileSiteKey);
  say('Secure enquiry channel is available. Fields marked * are required.','ready');
 }catch(e){say('The secure enquiry service is currently unavailable. Please try again later.','offline')}
}
form.addEventListener('submit',async e=>{
 e.preventDefault();
 if(!enabled||sending)return;
 if(!form.checkValidity()){form.reportValidity();say('Please complete the required fields and enter a valid email address.','error');return}
 if(Date.now()-startedAt<2200){say('Please review your details before submitting.','error');return}
 const fields=Object.fromEntries(new FormData(form).entries());
 if(fields.website){say('We could not process your enquiry.','error');return}
 if(document.getElementById('wl-turnstile-widget')&&!captchaToken){say('Please complete the human verification before submitting.','error');return}
 fields.consent=Boolean(fields.consent);fields.startedAt=startedAt;fields.turnstileToken=captchaToken;
 sending=true;button.disabled=true;say('Sending your enquiry securely…','checking');
 try{
  const r=await fetchWithTimeout('/api/contact',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(fields)},14000);
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.ok){say(data.message||'We could not send your enquiry. Please try again later.','error');return}
  form.hidden=true;document.getElementById('wl-form-success').hidden=false;
 }catch(e){say('The connection failed. Your enquiry has not been sent. Please retry.','error')}
 finally{sending=false;button.disabled=!enabled}
});
initialise();
})();
