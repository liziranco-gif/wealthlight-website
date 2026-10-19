// WealthLight: on-page FormSubmit AJAX submission.
// Never navigate away from the contact page; confirm success only when FormSubmit accepts the submission.
(()=>{
 'use strict';
 const form=document.getElementById('wealthlight-contact-form');
 if(!form)return;
 const meeting=document.getElementById('wl-meeting');
 const options=document.getElementById('wl-meeting-options');
 const button=document.getElementById('wl-form-submit');
 const status=document.getElementById('wl-form-status');
 const success=document.getElementById('wl-form-success');
 let sending=false;
 const sync=()=>{if(meeting&&options)options.hidden=meeting.value!=='Yes'};
 meeting?.addEventListener('change',sync);
 sync();
 const report=(text,type)=>{
  if(!status)return;
  status.textContent=text;
  status.dataset.status=type;
 };
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(sending)return;
  if(!form.checkValidity()){
   form.reportValidity();
   report('Please complete the required fields and enter a valid email address.','error');
   return;
  }
  const data=Object.fromEntries(new FormData(form).entries());
  if(data._honey){report('Unable to process your submission.','error');return}
  if(data.consent!=='on'){
   report('Please confirm the privacy acknowledgement.','error');
   return;
  }
  delete data.consent;
  delete data._next;
  sending=true;
  button.disabled=true;
  const original=button.innerHTML;
  button.textContent='Submitting…';
  report('','checking');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch('https://formsubmit.co/ajax/hr@wealthlight.net',{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify(data),
    signal:controller.signal
   });
   const result=await response.json().catch(()=>null);
   // FormSubmit can return the string "false" with HTTP 200. Never mistake it for success.
   const accepted=Boolean(response.ok&&result&&(result.success===true||result.success==='true'));
   if(!accepted){
    const msg=typeof result?.message==='string'?result.message.toLowerCase():'';
    if(msg.includes('activat')||msg.includes('confirm')){
     throw new Error('This contact channel is being activated. Please try again later.');
    }
    throw new Error('We could not send your message at the moment. Please try again shortly.');
   }
   form.hidden=true;
   success.hidden=false;
   success.scrollIntoView({behavior:'smooth',block:'center'});
  }catch(error){
   report(error.name==='AbortError'
    ?'The submission timed out. Please try again shortly.'
    :(error.message||'The submission could not be sent. Please try again.'),'error');
  }finally{
   clearTimeout(timeout);
   sending=false;
   button.disabled=false;
   button.innerHTML=original;
  }
 });
})();
