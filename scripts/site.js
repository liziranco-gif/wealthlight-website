(()=>{
'use strict';
const nav=document.getElementById('site-nav');
const toggle=document.querySelector('.nav-toggle');
const current=location.pathname.split('/').pop()||'index.html';

document.querySelectorAll('.site-nav a[data-nav]').forEach(a=>{
  if(a.getAttribute('data-nav')===current)a.classList.add('is-active');
});
toggle?.addEventListener('click',()=>{
  const open=nav?.classList.toggle('is-open')||false;
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');
});
document.querySelectorAll('.site-nav a').forEach(a=>a.addEventListener('click',()=>{
  nav?.classList.remove('is-open');
  toggle?.setAttribute('aria-expanded','false');
}));

const intro=document.getElementById('intro');
if(!intro)return;

const params=new URLSearchParams(location.search);
const replay=params.get('intro')==='1';
const noIntro=params.has('nointro');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let seen=false;
try{seen=sessionStorage.getItem('wl_intro_seen')==='1'}catch(e){}
let timer=null;
let leaving=false;

const hide=(focusAfter=false)=>{
  if(leaving||intro.hidden)return;
  leaving=true;
  if(timer!==null)clearTimeout(timer);
  intro.classList.add('is-leaving');
  intro.setAttribute('aria-hidden','true');
  document.body.classList.remove('intro-active');
  try{sessionStorage.setItem('wl_intro_seen','1')}catch(e){}
  if(focusAfter){document.querySelector('.hero-actions a')?.focus({preventScroll:true})}
  window.setTimeout(()=>{intro.hidden=true},1120);
};

if(noIntro||reduced||(seen&&!replay)){
  intro.hidden=true;
  intro.setAttribute('aria-hidden','true');
  document.body.classList.remove('intro-active');
}else{
  document.body.classList.add('intro-active');
  timer=window.setTimeout(()=>hide(false),10000);
  document.getElementById('intro-skip')?.addEventListener('click',()=>hide(true));
  intro.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();hide(true)}});
}
})();
