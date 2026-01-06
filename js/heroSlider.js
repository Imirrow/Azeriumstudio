/**(function(){
  const slider = document.querySelector('[data-slider]');
  if(!slider) return;

  const track  = slider.querySelector('[data-track]');
  const slides = [...track.children];
  const prev   = slider.querySelector('.ps-prev');
  const next   = slider.querySelector('.ps-next');
  const iTxt   = slider.querySelector('#psIndex');
  const tTxt   = slider.querySelector('#psTotal');

  let i = 0, N = slides.length, timer, hovering=false;

  const to2 = n => String(n).padStart(2,'0');
  if(tTxt) tTxt.textContent = to2(N);

  function go(n){
    i = (n+N)%N;
    track.style.transform = `translateX(-${i*100}%)`;
    if(iTxt) iTxt.textContent = to2(i+1);
  }

  // autoplay con pausa al hover
  function start(){ stop(); timer = setInterval(()=>{ if(!hovering) go(i+1); }, 5000); }
  function stop(){ if(timer) clearInterval(timer); }

  prev.addEventListener('click', ()=> go(i-1));
  next.addEventListener('click', ()=> go(i+1));
  slider.addEventListener('mouseenter', ()=> hovering=true);
  slider.addEventListener('mouseleave', ()=> hovering=false);

  // swipe (móvil)
  let sx=0, dx=0;
  track.addEventListener('touchstart', e=>{ sx=e.touches[0].clientX; dx=0; }, {passive:true});
  track.addEventListener('touchmove',  e=>{ dx=e.touches[0].clientX - sx; }, {passive:true});
  track.addEventListener('touchend',   ()=>{ if(Math.abs(dx)>40) go(i+(dx<0?1:-1)); });

  // teclado accesible
  window.addEventListener('keydown', e=>{
    if(e.key==='ArrowRight') go(i+1);
    if(e.key==='ArrowLeft')  go(i-1);
  });

  go(0); start();
})();*/

const slides = [...document.querySelectorAll('.hero__slide')];
const dotsBox = document.querySelector('.hero__dots');
let i = 0;

function go(n){
  i = (n + slides.length) % slides.length;
  slides.forEach((s,idx)=>{
    s.style.opacity = (idx===i) ? 1 : 0;
    s.style.position = (idx===i) ? 'relative' : 'absolute';
    s.style.inset = 0;
  });
  [...dotsBox.children].forEach((b,idx)=> b.classList.toggle('is-active', idx===i));
}
slides.forEach(s => { s.style.transition = 'opacity .5s'; s.style.opacity = 0; });
go(0);

// dots
slides.forEach((_,idx)=>{
  const b=document.createElement('button');
  b.onclick=()=>go(idx);
  dotsBox.appendChild(b);
});
dotsBox.firstChild.classList.add('is-active');

// arrows
document.querySelector('.hero__prev').onclick=()=>go(i-1);
document.querySelector('.hero__next').onclick=()=>go(i+1);

// auto play (opcional)
setInterval(()=>go(i+1), 6000);


