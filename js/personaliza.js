
/* ===== personaliza.js (3/2/1 por vista; 1 card por clic; swipe nativo) ===== */

/* --- Helpers mínimos --- */
window.qs  = window.qs  || ((sel, root=document) => root.querySelector(sel));
window.qsa = window.qsa || ((sel, root=document) => [...root.querySelectorAll(sel)]);

/* --- CSS dinámico: el SCROLLER es el viewport --- */
(function injectStepsCSS(){
  if (document.getElementById('steps-dyn-css')) return;
  const style = document.createElement('style');
  style.id = 'steps-dyn-css';
  style.textContent = `
    /* Raíz del slider */
    #stepsRow{ --per:3; --gap:24px; position:relative; }

    /* Viewport: SCROLLER real */
    #stepsViewport{
      overflow-x:auto;
      overflow-y:hidden;
      -webkit-overflow-scrolling:touch;
      scroll-behavior:smooth;
      scroll-snap-type:x mandatory;    /* <- AQUÍ va el snap */
    }
    /* Ocultar scrollbar */
    #stepsViewport::-webkit-scrollbar{ display:none; }
    #stepsViewport{ scrollbar-width:none; }

    /* Track: solo layout */
    #stepsTrack{ display:flex; gap:var(--gap); will-change:transform; }

    /* Slides: el snap-align va en cada item */
    #stepsRow .step-slide{
      flex:0 0 calc((100% - (var(--gap) * (var(--per) - 1))) / var(--per));
      scroll-snap-align:start;
    }

    /* Flechas (hover desktop) */
    #stepsRow .steps-arrow{ opacity:0; pointer-events:none; transition:opacity .25s ease; }
    #stepsRow:hover .steps-arrow{ opacity:1; pointer-events:auto; }

    /* Breakpoints: 2 por vista <=1280px, 1 por vista <=768px */
    @media (max-width:1280px){ #stepsRow{ --per:2; } }
    @media (max-width:768px){  #stepsRow{ --per:1; --gap:16px; } }
  `;
  document.head.appendChild(style);
})();

/* --- Carrusel por ÍNDICE con estado interno (usa scroll nativo) --- */
if (typeof window.initRowCarousel !== 'function') {
  window.initRowCarousel = function(viewport, track, prevBtn, nextBtn) {
    const clamp = (n, a, b) => Math.min(Math.max(n, a), b);
    const slides = () => [...track.querySelectorAll('.step-slide, li')];

    /* posición objetivo de un slide relativo al viewport */
    const targetLeft = (el) => {
      const r1 = el.getBoundingClientRect();
      const r2 = viewport.getBoundingClientRect();
      return (r1.left - r2.left) + viewport.scrollLeft;
    };

    const nearestIndex = () => {
      const arr = slides();
      if (!arr.length) return 0;
      let best = 0, bestDist = Infinity;
      const cur = viewport.scrollLeft;
      for (let i = 0; i < arr.length; i++) {
        const pos = targetLeft(arr[i]);
        const d = Math.abs(cur - pos);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      return best;
    };

    let idx = 0;
    let raf = 0;

    const goTo = (i, smooth = true) => {
      const arr = slides();
      if (!arr.length) return;
      idx = clamp(i, 0, arr.length - 1);
      viewport.scrollTo({ left: targetLeft(arr[idx]), behavior: smooth ? 'smooth' : 'auto' });
      setTimeout(updateArrows, 260);
    };

    const goNext = () => goTo(idx + 1);
    const goPrev = () => goTo(idx - 1);

    const updateArrows = () => {
      const arr = slides();
      if (!arr.length) { prevBtn.disabled = nextBtn.disabled = true; return; }
      prevBtn.disabled = idx <= 0;
      nextBtn.disabled = idx >= arr.length - 1;
    };

    /* Flechas: 1 por clic */
    prevBtn.addEventListener('click', goPrev);
    nextBtn.addEventListener('click', goNext);

    /* Swipe nativo: al hacer scroll recalculamos el índice más cercano */
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        idx = nearestIndex();
        updateArrows();
        raf = 0;
      });
    };
    viewport.addEventListener('scroll', onScroll, { passive: true });

    /* En resize, reencajar al índice actual (sin animación) */
    window.addEventListener('resize', () => goTo(idx, false));

    /* Posición inicial */
    goTo(0, false);
    updateArrows();
  };
}

/* === Datos de los pasos (ajusta rutas si quieres) === */
const STEPS = [
  {
    n: 1,
    title: 'Envías las imágenes',
    desc: 'O te ayudamos a buscar opciones de la temática que te guste.',
    img: 'assets/categorias/enviatuimagen.jpg',
    gradient: 'from-rose-500/40 via-orange-500/20 to-transparent',
    imgClass: 'w-[70%] md:w-[100%]'
  },
  {
    n: 2,
    title: 'Las revisamos',
    desc: 'Buscamos mejor resolución y/o mejoramos con IA.',
    img: 'assets/categorias/ajustamostuimagen.jpg',
    gradient: 'from-fuchsia-500/40 via-violet-500/20 to-transparent',
    imgClass: 'w-[76%] md:w-[100%]'
  },
  {
    n: 3,
    title: 'Preparamos un demo',
    desc: 'Te mostramos un montaje realista de cómo podría verse en la pared.',
    img: 'assets/categorias/mockuptuimagen.jpg',
    gradient: 'from-emerald-500/40 via-green-500/20 to-transparent',
    imgClass: 'w-[76%] md:w-[100%]'
  },
];

/* --- Creador de cada slide --- */
function stepSlide(s){
  const li = document.createElement('li');
  li.className = 'step-slide group/step relative rounded-2xl overflow-hidden border border-white/10 bg-white/5';
  li.innerHTML = `
    <div class="absolute inset-0 bg-gradient-to-br ${s.gradient}"></div>
    <div class="relative z-[2] h-full flex flex-col">
      <div class="p-6 md:p-8">
        <h3 class="flex items-center gap-3 text-2xl font-extrabold">
          <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white text-sm">${s.n}.</span> ${s.title}
        </h3>
        <p class="mt-2 text-white/80 text-sm md:text-base">${s.desc}</p>
      </div>
      <div class="relative mt-auto grid place-items-center pb-0 md:pb-0">
        <img src="${s.img}" alt="${s.title}"
             class="drop-shadow-[0_10px_30px_rgba(0,0,0,.45)]
                    transition-transform duration-700 ease-[cubic-bezier(.22,.9,.24,1)]
                    group-hover/step:scale-[1.03] ${s.imgClass}">
      </div>
    </div>
  `;
  return li;
}

/* --- Render del carrusel --- */
function renderSteps(){
  const row = qs('#stepsRow'); if(!row) return;
  const viewport = qs('#stepsViewport', row);
  const track    = qs('#stepsTrack', row);
  const prevBtn  = qs('#stepsPrev', row);
  const nextBtn  = qs('#stepsNext', row);
  if(!(viewport && track && prevBtn && nextBtn)) return;

  track.innerHTML = '';
  STEPS.forEach(s => track.appendChild(stepSlide(s)));

  requestAnimationFrame(()=> initRowCarousel(viewport, track, prevBtn, nextBtn));
}

document.addEventListener('DOMContentLoaded', renderSteps);




  //=================================================================================================
                                    //MODAL PERSONALIZA
  //=================================================================================================
  const WHATSAPP_NUMBER = "+51932724113";

  // Triggers externos: crea un botón con id="openCustomize" donde quieras
  // <button id="openCustomize" ...>Personalizar ya</button>
  const openBtn  = document.getElementById('openCustomize');
  const modal    = document.getElementById('customizeModal');
  const closeBtn = document.getElementById('closeCustomize');
  const cancelBtn= document.getElementById('cancelCustomize');
  const backdrop = document.getElementById('modalBackdrop');

  const form     = document.getElementById('customizeForm');
  const nameI    = document.getElementById('cf_name');
  const emailI   = document.getElementById('cf_email');
  const phoneI   = document.getElementById('cf_phone');
  const sizeI    = document.getElementById('cf_size');
  const linksI   = document.getElementById('cf_links');
  const noteI    = document.getElementById('cf_note');
  const privI    = document.getElementById('cf_priv');

  function openModal(){
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(()=> nameI?.focus(), 50);
  }
  function closeModal(){
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  openBtn?.addEventListener('click', (e)=>{ e.preventDefault(); openModal(); });
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeModal(); });

  function buildWhatsAppText(){
    const name  = (nameI.value || '').trim();
    const email = (emailI.value|| '').trim();
    const phone = (phoneI.value|| '').trim();
    const size  = (sizeI.value || '').trim();
    const links = (linksI.value|| '').trim();
    const note  = (noteI.value || '').trim();

    const lines = [
      '*Hola! Quiero un cuadro personalizado* 🙌',
      `*Nombre:* ${name || '(no indicó)'}`,
      `*Email:* ${email || '(no indicó)'}`,
      phone ? `*WhatsApp:* ${phone}` : null,
      size  ? `*Tamaño:* ${size}` : null,
      links ? `*Enlaces:* ${links}` : null,
      note  ? `*Comentario:* ${note}` : null,
      '',
      '¿Me ayudas con un demo? Aquí te adjunto las imágenes 📎'
    ].filter(Boolean);

    return encodeURIComponent(lines.join('\n'));
  }

  form?.addEventListener('submit', (e)=>{
    e.preventDefault();
    if (!privI.checked) { alert('Debes aceptar la política de privacidad.'); return; }
    if (!(nameI.value||'').trim()) { alert('Por favor, escribe tu nombre 😊'); nameI.focus(); return; }
    if (!(emailI.value||'').trim()) { alert('Por favor, escribe tu e-mail.'); emailI.focus(); return; }

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${buildWhatsAppText()}`;
    window.open(url, '_blank', 'noopener');
    closeModal();
  });


  
  //=================================================================================================
                                    //RESEÑAS
  //=================================================================================================

  // reseñas.js

// ===== Datos de reseñas =====
const REVIEWS = [
   {
    name: "Luis Reynoso",
    verified: true,
    rating: 5,
    title: "Muy bueno, volveré a comprar",
    text: "Me encantó el cuadro, aunque demoró un día más en llegar. Aun así, vale totalmente la pena por la calidad.",
    photo: "assets/imgreview/personalizadoluis2.jpeg"
  },
  {
    name: "Cathy",
    verified: true,
    rating: 5,
    title: "Superó mis expectativas",
    text: "El acabado en aluminio se ve increíble. Llegó bien protegido y la impresión es nítida. Mi sala quedó hermosa.",
    photo: "assets/imgreview/personalizadopilar.jpeg"
  },
  {
    name: "Ivan",
    verified: true,
    rating: 4,
    title: "Excelente compra",
    text: "Pensé que sería más delgado pero es súper resistente. El borde negro queda elegante y combina con todo.",
    photo: "assets/imgreview/paologuerrero.jpeg"
  },
    {
    name: "Luis Reynoso",
    verified: true,
    rating: 5,
    title: "Mortal 🔥",
    text: "Llegó rapidísimo y el brillo HD-Gloss en vivo se ve brutal.",
    photo: "assets/imgreview/personalizadoluis.jpeg"
  },
  {
    name: "Julio Salas",
    verified: true,
    rating: 4,
    title: "Muy bueno, volveré a comprar",
    text: "Me encantó el cuadro, aunque demoró un día más en llegar. Aun así, vale totalmente la pena por la calidad.",
    photo: "assets/imgreview/alianza2001.jpeg"
  },
  {
    name: "Irene Delgado",
    verified: true,
    rating: 5,
    title: "Me encanto",
    text: "Lo compré para mi hermano y quedó fascinado. La impresión tiene un brillo muy bonito y el MDF se siente premium.",
    photo: "assets/imgreview/tomioka.jpeg"
  }
];

// ===== Render de cada card =====
function reviewCard(r) {
  const stars = "★★★★★"
    .slice(0, r.rating)
    .split("")
    .map(
      () =>
        `<svg class="star" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z"/></svg>`
    )
    .join("");

  return `
    <article class="reviews-card flex-shrink-0 rounded-2xl overflow-hidden bg-white/[.03] border border-white/10">
      <div class="reviews-photo">
        <img src="${r.photo}" alt="${r.title}" loading="lazy" decoding="async" class="w-full h-auto object-cover"/>
      </div>
      <div class="p-4">
        <div class="flex items-center gap-2   ">
          <div class="flex">${stars}</div>
          ${r.verified ? `<span class="badge-verified">Verified</span>` : ``}
        </div>
        <div class="mt-2 font-medium">${r.name}</div>
        <div class="text-white/90 mt-1">${r.title}</div>
        <p class="text-white/60 mt-1 line-clamp-3">${r.text}</p>
      </div>
    </article>
  `;
}

// ===== Carrusel =====
function initReviews() {
  const root = document.getElementById("reviews");
  const track = root?.querySelector(".reviews-track");
  if (!track) return;

  // Render inicial
  track.innerHTML = REVIEWS.map(reviewCard).join("");
  const cards = Array.from(track.children);

  // Viewport
  const viewport =
    root.querySelector(".reviews-viewport") || track.parentElement;

  // GAP
  function getGap() {
    const gap = parseFloat(
      getComputedStyle(track).columnGap || getComputedStyle(track).gap || "24"
    );
    return isNaN(gap) ? 24 : gap;
  }

  let index = 0;
  let perView = 1;
  let CARD_WIDTH = 0;
  const AUTOPLAY_MS = 3500;

  function computePerView() {
    if (window.innerWidth >= 1280) perView = 4;
    else if (window.innerWidth >= 1024) perView = 3;
    else if (window.innerWidth >= 640) perView = 2;
    else perView = 1;
  }

  function setCardWidths() {
    const gap = getGap();
    const vpWidth = viewport.clientWidth;
    CARD_WIDTH = Math.max(160, (vpWidth - gap * (perView - 1)) / perView);

    cards.forEach((el) => {
      el.style.flex = `0 0 ${CARD_WIDTH}px`;
      el.style.width = `${CARD_WIDTH}px`;
    });
  }

  function maxIndex() {
    return Math.max(0, cards.length - perView);
  }

  function go(i) {
    const gap = getGap();
    const max = maxIndex();
    index = Math.max(0, Math.min(i, max));
    const x = index * (CARD_WIDTH + gap);
    track.style.transform = `translateX(${-x}px)`;
  }

  root.querySelector(".reviews-prev")?.addEventListener("click", () =>
    go(index - 1)
  );
  root.querySelector(".reviews-next")?.addEventListener("click", () =>
    go(index + 1)
  );

  // Autoplay
  let timer = setInterval(() => {
    if (index >= maxIndex()) go(0);
    else go(index + 1);
  }, AUTOPLAY_MS);

  root.addEventListener("mouseenter", () => clearInterval(timer));
  root.addEventListener(
    "mouseleave",
    () =>
      (timer = setInterval(() => {
        if (index >= maxIndex()) go(0);
        else go(index + 1);
      }, AUTOPLAY_MS))
  );

  function onResize() {
    const prev = track.style.transition;
    track.style.transition = "none";
    computePerView();
    setCardWidths();
    go(index);
    track.offsetHeight;
    track.style.transition = prev || "transform .5s ease-out";
  }
  window.addEventListener("resize", onResize);

  computePerView();
  setCardWidths();
  go(0);
}

// ===== Modal reseña =====
function initReviewModal() {
  const modal = document.getElementById("reviewModal");
  const overlay = document.getElementById("reviewOverlay");
  const openBtn = document.getElementById("openReviewModal");
  const closeBtn = document.getElementById("closeReviewModal");
  const cancelBtn = document.getElementById("cancelReview");
  const form = document.getElementById("reviewForm");
  if (!modal || !form) return;

  function openModal() { modal.classList.remove("hidden"); }
  function closeModal() { modal.classList.add("hidden"); }

  openBtn?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  overlay?.addEventListener("click", closeModal);

  // estrellas
  const starsWrap = document.getElementById("starsControl");
  const ratingInput = form.querySelector("[name='rating']");
  function paintStars(n) {
    starsWrap.querySelectorAll(".starBtn").forEach(btn => {
      btn.classList.toggle("active", +btn.dataset.val <= n);
      btn.style.opacity = (+btn.dataset.val <= n) ? "1" : "0.6";
    });
  }
  starsWrap?.addEventListener("click", e => {
    const btn = e.target.closest(".starBtn");
    if (!btn) return;
    ratingInput.value = btn.dataset.val;
    paintStars(+btn.dataset.val);
  });
  paintStars(+ratingInput.value || 5);

  // enviar
  form.addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = fd.get("name")?.toString().trim();
    const productId = fd.get("productId")?.toString().trim();
    const rating = +fd.get("rating") || 5;
    const comment = fd.get("comment")?.toString().trim();
    if (!productId || !comment) { alert("Completa todos los campos."); return; }

    const stars = "⭐".repeat(rating);
    const msg = [
      "Nueva reseña desde la web 👇",
      name ? `Nombre: ${name}` : null,
      `Producto (ID): ${productId}`,
      `Valoración: ${stars} (${rating}/5)`,
      "Comentario:",
      comment
    ].filter(Boolean).join("\n");

    const num = "51932724113"; // tu número
    const base = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? "https://wa.me"
      : "https://api.whatsapp.com/send";
    const url = base.includes("api.whatsapp")
      ? `${base}?phone=${num}&text=${encodeURIComponent(msg)}`
      : `${base}/${num}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");

    closeModal();
    form.reset();
    ratingInput.value = 5;
    paintStars(5);
  });
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  initReviews();
  initReviewModal();
});

/* ==========================================================================
PERSONALIZADOS
***************************************************************************** */
(()=>{
  if (document.getElementById('cs-viewport-aspects')) return;
  const style = document.createElement('style');
  style.id = 'cs-viewport-aspects';
  style.textContent = `
    #csViewport{ aspect-ratio: 4 / 5; overflow: hidden; border-radius: inherit; }
    @media (min-width:640px){ #csViewport{ aspect-ratio: 5 / 6; } }
    @media (min-width:768px){ #csViewport{ aspect-ratio: 16 / 9; } }
  `;
  document.head.appendChild(style);
})();

const CUSTOM_SLIDES = [
  { video: 'assets/videos/personalizado1.mp4', title: 'Cuadro de 1 Pieza', size: '30 × 40 cm', price: 49.90 },
  { video: 'assets/videos/boda_Personalizado.mp4', title: 'Cuadro de 2 Piezas', size: '60 × 40 cm', price: 98.90 },
  { video: 'assets/videos/naruto_personalizado.mp4', title: 'Cuadro de 3 Piezas', size: 90, price: 165 }
  
];

(function customSlider(){
  const root = document.getElementById('customSlider');
  if (!root) return;
  const viewport = qs('#csViewport', root);
  const track    = qs('#csTrack', root);
  const prevBtn  = qs('#csPrev', root);
  const nextBtn  = qs('#csNext', root);

  viewport.classList.add('overflow-hidden');
  track.innerHTML = '';
 CUSTOM_SLIDES.forEach((s) => {
  const li = document.createElement('li');
  li.className = 'group/slide shrink-0 basis-full relative';
  li.innerHTML = `
    <video 
      src="${s.video}" 
      autoplay 
      loop 
      muted 
      playsinline
      class="absolute inset-0 w-full h-full object-cover md:object-contain object-center transition-transform duration-700 ease-[cubic-bezier(.22,.9,.24,1)] group-hover/slide:scale-[1.04] will-change-transform"
    ></video>
  `;
  track.appendChild(li);
});

  let i = 0;
  const total = CUSTOM_SLIDES.length;
  const go = (idx) => {
    i = Math.max(0, Math.min(total - 1, idx));
    track.style.transform = `translateX(-${i * 100}%)`;
    prevBtn.disabled = (i === 0);
    nextBtn.disabled = (i === total - 1);
    prevBtn.style.opacity = i === 0 ? '0.5' : '';
    nextBtn.style.opacity = i === total - 1 ? '0.5' : '';
  };
  const prev = () => go(i - 1);
  const next = () => go(i + 1);

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  const focusTrap = qs('#csRoot', root);
  focusTrap.tabIndex = 0;
  focusTrap.addEventListener('keydown', (e)=>{
    if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
  });

  let dragging = false, startX = 0, moved = 0;
  viewport.addEventListener('pointerdown', (e)=>{
    dragging = true; startX = e.clientX; moved = 0;
    track.style.transitionDuration = '0ms';
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    moved = e.clientX - startX;
    track.style.transform = `translateX(calc(-${i*100}% + ${moved}px))`;
  });
  const endDrag = ()=>{
    if(!dragging) return;
    dragging = false;
    track.style.transitionDuration = '500ms';
    const threshold = viewport.clientWidth * 0.18;
    if (moved < -threshold) next();
    else if (moved > threshold) prev();
    else go(i);
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('pointerleave', endDrag);

  go(0);
})();


