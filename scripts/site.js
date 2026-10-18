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
 nav?.classList.remove('is-open');toggle?.setAttribute('aria-expanded','false');
}));

const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
const allMotion=()=>!reduce.matches;
if('IntersectionObserver' in window && allMotion()){
 const targets=document.querySelectorAll('.page-hero-copy,.section-heading,.three-col,.wide-editorial,.service-lines,.research-links,.steps,.market-stage-heading,.market-slices,.closing-inner,.hero-pillars article,.line-column,.service-line,.market-slice,.contact-panel');
 const observer=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-revealed');observer.unobserve(entry.target)}});
 },{rootMargin:'0px 0px -28px 0px',threshold:0.07});
 targets.forEach((el,i)=>{
  el.classList.add('reveal-scroll');
  el.style.setProperty('--reveal-delay',(i%4*70)+'ms');
  observer.observe(el);
 });
}
// Photo atmospheres use one steady animation timeline; scroll no longer drives abrupt
// changes to --parallax-shift, which previously caused jerks when scrolling.
const intro=document.getElementById('intro');
if(!intro)return;
const params=new URLSearchParams(location.search);
const replay=params.get('intro')==='1';
const noIntro=params.has('nointro');
let seen=false;
try{seen=sessionStorage.getItem('wl_intro_seen')==='1'}catch(e){}
let timer=null,leaving=false;
const hide=(focusAfter=false)=>{
 if(leaving||intro.hidden)return;
 leaving=true;
 if(timer!==null)clearTimeout(timer);
 intro.classList.add('is-leaving');
 intro.setAttribute('aria-hidden','true');
 document.body.classList.remove('intro-active');
 try{sessionStorage.setItem('wl_intro_seen','1')}catch(e){}
 if(focusAfter)document.querySelector('.hero-actions a')?.focus({preventScroll:true});
 window.setTimeout(()=>{intro.hidden=true},1120);
};
if(noIntro||reduce.matches||(seen&&!replay)){
 intro.hidden=true;
 intro.setAttribute('aria-hidden','true');
 document.body.classList.remove('intro-active');
}else{
 document.body.classList.add('intro-active');
 intro.focus({preventScroll:true});
 timer=window.setTimeout(()=>hide(false),10000);
 document.getElementById('intro-skip')?.addEventListener('click',()=>hide(true));
 intro.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();hide(true)}});
}
})();
