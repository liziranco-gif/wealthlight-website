(()=>{
'use strict';
const nav=document.getElementById('site-nav');
const toggle=document.querySelector('.nav-toggle');
const current=location.pathname.split('/').pop()||'index.html';
document.querySelectorAll('.site-nav a[data-nav]').forEach(a=>{
 if(a.getAttribute('data-nav')===current)a.classList.add('is-active');
});
const closeNav=()=>{
 nav?.classList.remove('is-open');
 toggle?.setAttribute('aria-expanded','false');
 toggle?.setAttribute('aria-label','Open navigation');
};
toggle?.addEventListener('click',()=>{
 const open=nav?.classList.toggle('is-open')||false;
 toggle.setAttribute('aria-expanded',String(open));
 toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');
});
document.querySelectorAll('.site-nav a').forEach(a=>a.addEventListener('click',closeNav));
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeNav()});

const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
const allowed=!reduce.matches;

/* A few editorial entrances, once. No card-by-card flying or heavy stagger. */
if(allowed && 'IntersectionObserver' in window){
 const targets=document.querySelectorAll(
  '.page-hero-copy,.section-heading,.wide-editorial,.service-lines,.research-links,.steps,.market-stage-heading,.closing-inner,.contact-panel'
 );
 const textObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(entry.isIntersecting){
    entry.target.classList.add('wl-soft-enter');
    textObserver.unobserve(entry.target);
   }
  }
 },{rootMargin:'0px 0px -24px 0px',threshold:.08});
 for(const node of targets){textObserver.observe(node)}
 const sceneObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(entry.isIntersecting){
    entry.target.classList.add('is-in-view');
    sceneObserver.unobserve(entry.target);
   }
  }
 },{rootMargin:'0px 0px -25px 0px',threshold:.05});
 document.querySelectorAll('.wl-chapter-image').forEach(node=>sceneObserver.observe(node));
}

const intro=document.getElementById('intro');
if(!intro)return;
const params=new URLSearchParams(location.search);
const replay=params.get('intro')==='1';
const noIntro=params.has('nointro');
let seen=false;
try{seen=sessionStorage.getItem('wl_intro_seen')==='1'}catch{}
let timer=null,closing=false;
const hide=(focusAfter=false)=>{
 if(closing||intro.hidden)return;
 closing=true;
 if(timer!==null)clearTimeout(timer);
 intro.classList.add('is-leaving');
 intro.setAttribute('aria-hidden','true');
 document.body.classList.remove('intro-active');
 try{sessionStorage.setItem('wl_intro_seen','1')}catch{}
 if(focusAfter)document.querySelector('.hero-actions a')?.focus({preventScroll:true});
 window.setTimeout(()=>{intro.hidden=true;intro.classList.remove('is-playing')},1000);
};
if(noIntro||!allowed||(seen&&!replay)){
 intro.hidden=true;
 intro.setAttribute('aria-hidden','true');
 document.body.classList.remove('intro-active');
 return;
}
document.body.classList.add('intro-active');
intro.focus({preventScroll:true});
document.getElementById('intro-skip')?.addEventListener('click',()=>hide(true));
intro.addEventListener('keydown',event=>{
 if(event.key==='Escape'){event.preventDefault();hide(true)}
});
// Start all visual frames and the 9-second timer in the same paint.
// 9s branded sequence + 1s overlay dismissal = a 10-second opening.
requestAnimationFrame(()=>{
 if(closing||intro.hidden)return;
 intro.classList.add('is-playing');
 timer=window.setTimeout(()=>hide(false),9000);
});
})();
