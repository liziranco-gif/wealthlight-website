// WealthLight contact form uses FormSubmit's hosted, email-verified submission flow.
// Only keep the optional meeting preference interaction here; do not intercept form submits.
(()=>{
 'use strict';
 const meeting=document.getElementById('wl-meeting');
 const options=document.getElementById('wl-meeting-options');
 if(!meeting||!options)return;
 const sync=()=>{options.hidden=meeting.value!=='Yes'};
 meeting.addEventListener('change',sync);
 sync();
})();
