(()=>{
'use strict';
const nav=document.getElementById('site-nav');const toggle=document.querySelector('.nav-toggle');
const current=location.pathname.split('/').pop()||'index.html';
document.querySelectorAll('.site-nav a[data-nav]').forEach(a=>{if(a.getAttribute('data-nav')===current)a.classList.add('is-active')});
toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(open))});
document.querySelectorAll('.site-nav a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('is-open');toggle?.setAttribute('aria-expanded','false')}));
const intro=document.getElementById('intro');
if(intro){const noIntro=new URLSearchParams(location.search).has('nointro');const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;let timer;
const hide=()=>{clearTimeout(timer);intro.classList.add('is-leaving');document.body.classList.remove('intro-active');window.setTimeout(()=>{intro.hidden=true},1120);try{sessionStorage.setItem('wl_intro_seen','1')}catch(e){}};
let seen=false;try{seen=sessionStorage.getItem('wl_intro_seen')==='1'}catch(e){}
if(noIntro||reduced||seen){intro.hidden=true}else{document.body.classList.add('intro-active');timer=setTimeout(hide,10000);document.getElementById('intro-skip')?.addEventListener('click',hide);intro.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});}
}
})();
