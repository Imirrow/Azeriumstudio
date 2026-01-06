/* =========================================================================
   Helpers básicos
   -------------------------------------------------------------------------
   - qs / qsa: query selectors cortos
   - money: formatea números en moneda peruana "S/ 0,000.00"
   ========================================================================= */
function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }
function money(n){ n = Number(n)||0; return 'S/ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

/* =========================================================================
   Control manual de “Recién llegados” y “Más pedidos”
   ========================================================================= */
const NEW_ARRIVALS_IDS = Array.isArray(window.NEW_ARRIVALS_IDS) ? window.NEW_ARRIVALS_IDS : ["AT-005","OP-002","MS-012","SP-020","CM-011"];
const HOT_IDS          = Array.isArray(window.HOT_IDS)           ? window.HOT_IDS           : ["DS-022","DP-004","MS-009","N-002","DP-008","SL-006","DB-007","DP-021"];

/* =========================================================================
   Temporizador de ofertas
   ========================================================================= */
function startTimer(el, minutes=180){
  const end = Date.now() + minutes*60*1000;
  const tick = () => {
    const t = Math.max(0, end - Date.now());
    const h = String(Math.floor(t/3600000)).padStart(2,'0');
    const m = String(Math.floor((t%3600000)/60000)).padStart(2,'0');
    const s = String(Math.floor((t%60000)/1000)).padStart(2,'0');
    el.textContent = `${h}:${m}:${s}`;
    if(t>0) requestAnimationFrame(tick);
  };
  tick();
}

/* =========================================================================
   Indicadores del carrito (header)
   ========================================================================= */
function updateCartCount(){
  const items = cartGet();
  const count = items.reduce((a,b)=> a + (Number(b.qty)||0), 0);
  const total = items.reduce((a,b)=> a + (Number(b.qty)||0) * (Number(b.price)||0), 0);

  qsa('#cartCount').forEach(el => el.textContent = String(count));
  qsa('#cartBadge').forEach(el => el.textContent = String(count));
  qsa('#cartTotal').forEach(el => el.textContent = money(total));
}

/* =========================================================================
   Carga de datos (products.json + categories.json)
   ========================================================================= */
async function loadData(){
  const [products, cats] = await Promise.all([
    fetch('data/products.json').then(r=>r.json()),
    fetch('data/categories.json').then(r=>r.json()),
  ]);
  return {products, cats};
}

/* =========================================================================
   Utilidad: ¿es “nuevo”? (por fecha de creación)
   ========================================================================= */
function isNewItem(p, days=30){
  const created = new Date(p.created);
  return Date.now() - created.getTime() < days*24*60*60*1000;
}

/* =========================================================================
   PRECIO DINÁMICO — Tabla exacta por Formato/Tamaño
   -------------------------------------------------------------------------
   • Si un producto trae p.priceTable, se usa esa; si no, se usa DEFAULT_PRICE_TABLE.
   • formats (opcional) restringe qué formatos mostrar. Si no existe, se usa p.pieces.
   ========================================================================= */

// Convierte "20x30" -> "20 × 30 cm"
function sizeLabel(key){ const [w,h] = key.split('x'); return `${w} × ${h} cm`; }

// Tabla GLOBAL por defecto
const DEFAULT_PRICE_TABLE = {
  "1": { // 1 pieza
    "20x30": 39.90,
    "30x40": 59.90,
    "40x60": 99.90
  }
};

// Obtiene el precio según piezas/tamaño
function priceFor(p, pieces, sizeKey){
  const table = p.priceTable || DEFAULT_PRICE_TABLE;
  const row = table?.[String(pieces)];
  if(!row) return Number(p.price)||0;
  const val = row[sizeKey];
  return (typeof val === 'number') ? val : (Number(p.price)||0);
}

/* =========================================================================
   Precio mínimo (para “Desde:”) con soporte de filtro de piezas
   ========================================================================= */
// piecesFilter puede ser: undefined | number | Set<string|number> | Array<string|number>
// Precio mínimo (para mostrar "Desde: S/ ...")
function minPriceFromTable(p){
  const table = p.priceTable || DEFAULT_PRICE_TABLE;
  let min = Number.POSITIVE_INFINITY;

  // prioriza los formatos válidos:
  // 1) p.formats (si viene en el producto)
  // 2) p.pieces (si está definido y existe en la tabla)
  // 3) todos los formatos de la tabla (fallback)
  let formats;
  if (Array.isArray(p.formats) && p.formats.length){
    formats = p.formats.map(f => String(f));
  } else if (p.pieces != null && table[String(p.pieces)]) {
    formats = [String(p.pieces)];
  } else {
    formats = Object.keys(table);
  }

  for (const f of formats){
    const row = table[String(f)];
    if (!row) continue;
    for (const k of Object.keys(row)){
      const val = row[k];
      if (typeof val === 'number' && val < min) min = val;
    }
  }

  if (!isFinite(min)) min = Number(p.price) || 0;
  return min;
}


/* =========================================================================
   Variantes (Formato/Tamaño) — helpers
   ========================================================================= */
function extractVariants(p){
  const table = p.priceTable || DEFAULT_PRICE_TABLE;

  const formats = (Array.isArray(p.formats) && p.formats.length)
    ? p.formats.filter(f => table[String(f)]).sort((a,b)=>a-b)
    : (table[String(p.pieces||1)] ? [Number(p.pieces||1)] : Object.keys(table).map(Number).sort((a,b)=>a-b));

  const sizesByFormat = {};
  formats.forEach(f=>{
    const row = table[String(f)] || {};
    sizesByFormat[f] = Object.keys(row);
  });
  return { formats, sizesByFormat, table };
}
function hasVariantChoices(p){
  const { formats, sizesByFormat } = extractVariants(p);
  const totalCombos = formats.reduce((acc,f)=> acc + (sizesByFormat[f]?.length||0), 0);
  return totalCombos > 1;
}
function firstVariant(p){
  const { formats, sizesByFormat } = extractVariants(p);
  const f = formats[0];
  const k = (sizesByFormat[f] && sizesByFormat[f][0]) || '';
  const price = k ? priceFor(p, f, k) : Number(p.price)||0;
  return { pieces: f, sizeKey: k, price };
}
function addOrChoose(p){
  if (hasVariantChoices(p)) {
    openQuickView(p, { withOptions: true });
  } else {
    const { pieces, sizeKey, price } = firstVariant(p);
    cartAdd({
      id: `${p.id}-${pieces}-${sizeKey||'unique'}`,
      title: p.title,
      price: Number(price),
      image: p.image,
      size: sizeKey ? `${sizeLabel(sizeKey)} · ${pieces}p` : 'Único',
      qty: 1
    });
  }
}

/* =========================================================================
   Tarjetas para carruseles del HOME
   ========================================================================= */
function newRowCard(p){
  const li = document.createElement('li');
  li.className = 'row-card';
  li.innerHTML = `
    ${isNewItem(p) ? `<span class="chip">¡NUEVO!</span>` : ''}
    <a class="thumb" href="product.html?id=${p.id}" aria-label="${p.title}">
      <img src="${p.image}" alt="${p.title}" loading="lazy" decoding="async" style="object-fit:contain; padding:6%;">
    </a>
    <div class="meta">
      <div class="title">${p.title}</div>
      <div class="bar">
        <span class="price"><b>Desde: ${money(minPriceFromTable(p))}</b></span>
        <button type="button" class="add-btn" data-add="${p.id}">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path fill="currentColor" d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 .001 3.999A2 2 0 0 0 17 18Zm2.16-12H7.42l-.94-2H2v2h2.24l3.6 7.59-1.35 2.45A2 2 0 0 0 8.26 18h9.48v-2H8.42l1.1-2h7.45a2 2 0 0 0 1.79-1.11L21.6 6.5A1 1 0 0 0 21 6Z"/>
          </svg>
          Añadir
        </button>
      </div>
    </div>
  `;
  return li;
}
function hotRowCard(p){
  const li = document.createElement('li');
  li.className = 'row-card';
  li.innerHTML = `
    <a class="thumb" href="product.html?id=${p.id}" aria-label="${p.title}">
      <img src="${p.image}" alt="${p.title}" loading="lazy" decoding="async" style="object-fit:contain; padding:6%;">
    </a>
    <div class="meta">
      <div class="title">${p.title}</div>
      <div class="bar">
        <span class="price"><b>Desde: ${money(minPriceFromTable(p))}</b></span>
        <button type="button" class="add-btn" data-add="${p.id}">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path fill="currentColor" d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 .001 3.999A2 2 0 0 0 17 18Zm2.16-12H7.42l-.94-2H2v2h2.24l3.6 7.59-1.35 2.45A2 2 0 0 0 8.26 18h9.48v-2H8.42l1.1-2h7.45a2 2 0 0 0 1.79-1.11L21.6 6.5A1 1 0 0 0 21 6Z"/>
          </svg>
          Añadir
        </button>
      </div>
    </div>
  `;
  return li;
}

/* =========================================================================
   Carrusel genérico (flechas + drag)
   ========================================================================= */
function initRowCarousel(viewport, track, prevBtn, nextBtn){
  const updateArrows = ()=>{
    const maxScroll = Math.max(0, track.scrollWidth - viewport.clientWidth - 1);
    prevBtn.disabled = viewport.scrollLeft <= 0;
    nextBtn.disabled = viewport.scrollLeft >= maxScroll;
  };
  const step = ()=>{
    const anyCard = track.firstElementChild;
    const dx = anyCard
      ? (anyCard.getBoundingClientRect().width + 18) * 2
      : viewport.clientWidth * 0.9;
    return Math.max(200, dx);
  };
  prevBtn.addEventListener('click', ()=> viewport.scrollBy({ left: -step(), behavior: 'smooth' }));
  nextBtn.addEventListener('click', ()=> viewport.scrollBy({ left:  step(), behavior: 'smooth' }));
  viewport.addEventListener('scroll', updateArrows, { passive:true });
  window.addEventListener('resize', updateArrows);

  // Drag
  let dragging = false, startX = 0, startLeft = 0;
  viewport.addEventListener('pointerdown', (e)=>{
    if (e.button !== 0) return;
    if (e.target.closest('button,[data-add],a,input,textarea,select')) return;
    dragging = true;
    viewport.setPointerCapture(e.pointerId);
    startX = e.clientX; startLeft = viewport.scrollLeft;
  });
  viewport.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    viewport.scrollLeft = startLeft - (e.clientX - startX);
  });
  viewport.addEventListener('pointerup',   ()=> dragging=false);
  viewport.addEventListener('pointercancel',()=> dragging=false);

  updateArrows();
}

/* =========================================================================
   Home (página principal)
   ========================================================================= */
function renderNewArrivalsFrom(products){
  let items = [];
  if (Array.isArray(NEW_ARRIVALS_IDS) && NEW_ARRIVALS_IDS.length){
    items = NEW_ARRIVALS_IDS
      .map(id => products.find(p => String(p.id) === String(id)))
      .filter(Boolean);
  } else {
    items = products.slice().sort((a,b)=> new Date(b.created) - new Date(a.created)).slice(0, 12);
  }
  const newRow  = qs('#newRow');
  const newGrid = qs('#newGrid');
  if (!newRow) { if (newGrid){ newGrid.innerHTML = ''; items.forEach(p => newGrid.appendChild(card(p))); } return; }
  const viewport = newRow.querySelector('#newViewport, .home-row__viewport');
  const track    = newRow.querySelector('#newTrack, .home-row__track');
  const prevBtn  = newRow.querySelector('.row-arrow--prev, .home-row__prev');
  const nextBtn  = newRow.querySelector('.row-arrow--next, .home-row__next');
  if (!(viewport && track && prevBtn && nextBtn)) { if (newGrid){ newGrid.innerHTML=''; items.forEach(p=>newGrid.appendChild(card(p))); } return; }
  track.innerHTML = ''; items.forEach(p => track.appendChild(newRowCard(p)));
  initRowCarousel(viewport, track, prevBtn, nextBtn);
  track.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-add]'); if(!btn) return;
    e.preventDefault(); e.stopPropagation();
    const id = btn.dataset.add; const p  = items.find(x => String(x.id) === String(id));
    if(!p) return;
    addOrChoose(p);
  });
}
function renderMostOrderedFrom(products){
  let items = [];
  if (Array.isArray(HOT_IDS) && HOT_IDS.length){
    items = HOT_IDS.map(id => products.find(p => String(p.id) === String(id))).filter(Boolean).slice(0, 12);
  } else {
    items = products.slice().sort((a,b)=> (Number(b.orders ?? b.reviews)||0) - (Number(a.orders ?? a.reviews)||0)).slice(0, 12);
  }
  const hotRow  = qs('#hotRow'); const hotGrid = qs('#hotGrid');
  if (!hotRow) { if (hotGrid){ hotGrid.innerHTML = ''; items.forEach(p => hotGrid.appendChild(card(p))); } return; }
  const viewport = hotRow.querySelector('#hotViewport, .home-row__viewport');
  const track    = hotRow.querySelector('#hotTrack, .home-row__track');
  const prevBtn  = hotRow.querySelector('.row-arrow--prev, .home-row__prev');
  const nextBtn  = hotRow.querySelector('.row-arrow--next, .home-row__next');
  if (!(viewport && track && prevBtn && nextBtn)) { if (hotGrid){ hotGrid.innerHTML=''; items.forEach(p=>hotGrid.appendChild(card(p))); } return; }
  track.innerHTML = ''; items.forEach(p => track.appendChild(hotRowCard(p)));
  initRowCarousel(viewport, track, prevBtn, nextBtn);
  track.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-add]'); if(!btn) return;
    e.preventDefault(); e.stopPropagation();
    const id = btn.dataset.add; const p  = items.find(x => String(x.id) === String(id));
    if(!p) return;
    addOrChoose(p);
  });
}

function catCard(c){
  const li = document.createElement('li');
  li.className = 'cat-card';
  const cover = c.cover || `img/categories/${c.slug}.jpg`;
  li.innerHTML = `
    <a class="cat-link" href="shop.html#${c.slug}" aria-label="${c.name}">
      <img src="${cover}" alt="${c.name}" loading="lazy" decoding="async">
      <div class="cat-overlay"><h3>${c.name}</h3><span class="cta">Ver todos</span></div>
    </a>`;
  return li;
}
function renderCatRow(cats){
  const catRow = qs('#catRow'); if(!catRow) return;
  const viewport = qs('#catViewport', catRow) || qs('.cat-row__viewport', catRow);
  const track    = qs('#catTrack', catRow)    || qs('.cat-row__track', catRow);
  const prevBtn  = qs('.cat-arrow--prev', catRow);
  const nextBtn  = qs('.cat-arrow--next', catRow);
  if(!(viewport && track && prevBtn && nextBtn)) return;
  track.innerHTML = ''; cats.forEach(c => track.appendChild(catCard(c)));
  initRowCarousel(viewport, track, prevBtn, nextBtn);
}

(async function home(){
  const tmr = qs('#saleTimer'); if (tmr) startTimer(tmr, 180);
  updateCartCount();
  const {products, cats} = await loadData();
  // ===============================
// SISTEMA DE BÚSQUEDA PRINCIPAL
// ===============================

// Detectar input real
const shopSearch = qs('#qSearch');
const shopSearchBtn = qs('#qGo');

// Si no existe state, lo creamos
if (!window._shopStateFix){
  window._shopStateFix = true; // evitar doble creación

  window.shopState = {
    q: "",
    cats: new Set(),
    tags: new Set(),
    pieces: new Set(),
    sort: "new"
  };
}

// cargar búsqueda previa guardada
let stored = sessionStorage.getItem("searchTerm") || "";
sessionStorage.removeItem("searchTerm");

// ponerlo en el input si existe
if (shopSearch) shopSearch.value = stored;

// cuando el usuario escribe
if (shopSearch){
  shopSearch.addEventListener('input', e=>{
    shopState.q = e.target.value.toLowerCase();
    apply();
  });
}

// cuando el usuario presiona la lupa
if (shopSearchBtn){
  shopSearchBtn.addEventListener('click', ()=>{
    shopState.q = shopSearch.value.toLowerCase();
    apply();
  });
}

  window.__PRODS = products;
  renderNewArrivalsFrom(products);
  renderMostOrderedFrom(products);
  renderCatRow(cats);

  const topGrid = qs('#topGrid');
  if (topGrid){
    const topItems = products.slice().sort((a,b)=>b.reviews-a.reviews).slice(0,12);
    topItems.forEach(p => topGrid.appendChild(card(p)));
  }
  const catGrid = qs('#catGrid');
  if (catGrid){
    catGrid.innerHTML = '';
    cats.forEach(c => {
      const a = document.createElement('a');
      a.href = 'shop.html#'+c.slug;
      a.className = 'rounded-2xl bg-white/5 border border-white/10 p-4 text-center hover:bg-white/10';
      a.textContent = c.name;
      catGrid.appendChild(a);
    });
  }
  const fCats = qs('#fCats');
  if (fCats){
    fCats.innerHTML = '';
    cats.forEach(c => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="shop.html#${c.slug}">${c.name}</a>`;
      fCats.appendChild(li);
    });
  }
 if (q) {
  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      sessionStorage.setItem("searchTerm", q.value.trim());
      location.href = "shop.html";
    }
  });
  }
})();

/* =========================================================================
   Tarjeta para grids del HOME (usa modal de QV)
   ========================================================================= */
function card(p){
  const el = document.createElement('article');
  el.className = 'rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition';
  el.innerHTML = `
    <div class="relative">
      <img src="${p.image}" alt="${p.title}" class="w-full h-44 md:h-56 object-cover">
      ${p.badge ? `<span class="absolute top-3 left-3 text-xs px-2 py-1 rounded bg-rose-600 z-[5]">${p.badge}</span>` : ''}
      <button data-qv="${p.id}" class="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-sm">Vista rápida</button>
    </div>
    <div class="p-4">
      <a href="product.html?id=${p.id}" class="font-medium hover:underline line-clamp-1">${p.title}</a>
      <div class="text-indigo-300 font-bold mt-1">Desde: ${money(minPriceFromTable(p))}</div>
      <div class="text-xs opacity-70 mt-1">★ ${p.rating} · ${p.reviews} reseñas</div>
      <div class="mt-3 flex gap-2">
        <button data-add="${p.id}" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm">Añadir</button>
        <a href="product.html?id=${p.id}" class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm">Ver</a>
      </div>
    </div>`;
  el.querySelector('[data-add]').onclick = ()=> addOrChoose(p);
  el.querySelector('[data-qv]').onclick  = ()=> openQuickView(p, {withOptions:true});
  return el;
}

/* =========================================================================
   Quick View (modal) — versión corregida y responsiva
   ========================================================================= */
function ensureQuickView(){
  if (document.getElementById('qvBackdrop')) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <!-- Fondo oscuro -->
    <div id="qvBackdrop" class="hidden fixed inset-0 bg-black/60 z-[70]"></div>

    <!-- Contenedor del modal (siempre dentro del wrap) -->
    <section id="qvModal"
      class="fixed inset-0 z-[80] flex items-start justify-center
             overflow-y-auto p-4 md:p-6
             opacity-0 pointer-events-none transition-opacity">

      <!-- Caja interna del modal (centrada en desktop, scroll en móvil) -->
      <div id="qvBox"
        class="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl
               w-full max-w-5xl max-h-[90vh] overflow-y-auto
               relative p-4 md:p-6 md:mt-20">

        <!-- Botón cerrar sticky -->
        <button id="qvClose" aria-label="Cerrar"
          class="sticky top-3 right-0 ml-auto z-50
                 grid place-content-center w-9 h-9 rounded-lg
                 bg-black/50 hover:bg-black/70 border border-white/10 text-white">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        <!-- Aquí cargo el contenido del producto -->
        <div id="qvBody"></div>

      </div>
    </section>
  `;

  document.body.appendChild(wrap);

  // eventos cerrar
  qs('#qvBackdrop').addEventListener('click', closeQuickView);
  qs('#qvClose').addEventListener('click',  closeQuickView);
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeQuickView(); });
}


function openQuickView(p, opts={}){
  ensureQuickView();
  const bd = qs('#qvBody');

  const hasOffer = Number(p.compareAt) > Number(p.price);
  const pct = hasOffer ? Math.max(1, Math.round((1 - (p.price / p.compareAt)) * 100)) : 0;

  const imgs = (Array.isArray(p.images) && p.images.length ? p.images : [p.image]).filter(Boolean);

  const { formats, sizesByFormat, table } = extractVariants(p);
  const showOptions = !!opts.withOptions && hasVariantChoices(p);

  // UI
  bd.innerHTML = `
    <div class="grid md:grid-cols-2 gap-5">
      <div id="qvSlider" class="relative rounded-xl overflow-hidden bg-black/30 border border-white/10">
        <div id="qvSlideViewport" class="overflow-hidden">
          <ul id="qvSlideTrack" class="flex transition-transform duration-500 ease-[cubic-bezier(.22,.61,.36,1)]" style="will-change: transform;"></ul>
        </div>

        <button id="qvPrev" class="absolute left-2 top-1/2 -translate-y-1/2 grid place-content-center w-10 h-10 rounded-full bg-black/60 border border-white/10 text-white hover:bg-black/80" aria-label="Anterior">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18 9 12l6-6"/></svg>
        </button>
        <button id="qvNext" class="absolute right-2 top-1/2 -translate-y-1/2 grid place-content-center w-10 h-10 rounded-full bg-black/60 border border-white/10 text-white hover:bg-black/80" aria-label="Siguiente">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
        </button>

        <div id="qvDots" class="absolute left-1/2 -translate-x-1/2 bottom-2 flex gap-2"></div>
      </div>

      <div class="space-y-4">
        <div>
          <h3 class="text-2xl md:text-[28px] font-extrabold">${p.title}</h3>
          <div class="mt-1 text-xl">
            <span id="qvPrice" class="${hasOffer ? 'text-rose-300' : 'text-indigo-300'} font-bold">
              ${money(p.price)}
            </span>
            ${hasOffer ? `<span class="opacity-70 ml-2"><del>${money(p.compareAt)}</del></span>
                          <span class="ml-2 text-xs px-2 py-1 rounded bg-rose-600">${pct}% OFF</span>` : ''}
          </div>
        </div>

        ${showOptions ? `
        <div class="grid sm:grid-cols-2 gap-3">
          <label class="grid gap-1 text-sm">
            <span class="opacity-80">Formato</span>
            <select id="qvFormat" class="px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10"></select>
          </label>
          <label class="grid gap-1 text-sm">
            <span class="opacity-80">Tamaño</span>
            <select id="qvSize" class="px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10"></select>
          </label>
        </div>` : ''}

        <p class="opacity-90 leading-relaxed">${p.description || '—'}</p>

        <div class="flex gap-2 pt-2">
          <button id="qvAdd" class="btn btn--primary btn--lg">Añadir Al Carrito</button>
          <a href="product.html?id=${p.id}" class="btn btn--ghost btn--lg">Ver detalles</a>
        </div>

        <hr class="border-white/10">

        <div class="text-sm grid gap-1">
          <div><span class="opacity-70">Categoría:</span> ${p.category || '-'}</div>
          <div><span class="opacity-70">Temática:</span> ${(p.tags||[]).join(', ') || '-'}</div>
          <div class="flex items-center gap-2">
            <span class="opacity-70">Compartir:</span>
            <a target="_blank" rel="noopener"
               class="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20"
               href="https://wa.me/?text=${encodeURIComponent(`Mira este póster: ${p.title} - ${location.origin}/product.html?id=${p.id}`)}">WhatsApp</a>
          </div>
        </div>
      </div>
    </div>`;

  // Cargar slides
  const track = qs('#qvSlideTrack', bd);
  track.innerHTML = '';
  imgs.forEach(src=>{
    const li = document.createElement('li');
    li.className = 'shrink-0 basis-full';
    li.innerHTML = `<img src="${src}" class="w-full h-[280px] md:h-[420px] object-contain bg-black/30" alt="">`;
    track.appendChild(li);
  });

  // Dots
  const dotsBox = qs('#qvDots', bd);
  dotsBox.innerHTML = '';
  imgs.forEach((_,i)=>{
    const b = document.createElement('button');
    b.className = 'w-2 h-2 rounded-full bg-white/40';
    b.dataset.i = i;
    dotsBox.appendChild(b);
  });

  // Estado + helpers
  let i = 0;
  const total = imgs.length;
  const vp = qs('#qvSlideViewport', bd);
  const prevBtn = qs('#qvPrev', bd);
  const nextBtn = qs('#qvNext', bd);

  function updateUI(){
    track.style.transform = `translateX(-${i*100}%)`;
    qsa('button', dotsBox).forEach((d,idx)=>{
      d.style.transform = idx===i ? 'scale(1.25)' : '';
      d.style.background = idx===i ? '#fff' : 'rgba(255,255,255,.45)';
    });
    prevBtn.disabled = (i===0);
    nextBtn.disabled = (i===total-1);
    prevBtn.style.opacity = i===0 ? '.5' : '';
    nextBtn.style.opacity = i===total-1 ? '.5' : '';
  }
  function go(n){ i = Math.max(0, Math.min(total-1, n)); updateUI(); }
  function prev(){ go(i-1); }
  function next(){ go(i+1); }

  // Eventos
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  dotsBox.addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-i]'); if(!b) return;
    go(+b.dataset.i || 0);
  });

  // Drag / swipe
  let dragging=false, startX=0, moved=0;
  vp.addEventListener('pointerdown', (e)=>{
    dragging=true; startX=e.clientX; moved=0;
    track.style.transitionDuration='0ms';
    vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    moved = e.clientX - startX;
    track.style.transform = `translateX(calc(-${i*100}% + ${moved}px))`;
  });
  const endDrag = ()=>{
    if(!dragging) return;
    dragging=false;
    track.style.transitionDuration='500ms';
    const threshold = vp.clientWidth * 0.18;
    if (moved < -threshold) next();
    else if (moved > threshold) prev();
    else updateUI();
  };
  vp.addEventListener('pointerup', endDrag);
  vp.addEventListener('pointercancel', endDrag);
  vp.addEventListener('pointerleave', endDrag);

  // ==== Opciones (si aplica) ====
  let selPieces = formats[0];
  let selSize   = (sizesByFormat[selPieces] && sizesByFormat[selPieces][0]) || '';
  function setPrice(){
    const price = selSize ? priceFor(p, selPieces, selSize) : (Number(p.price)||0);
    const priceEl = qs('#qvPrice', bd);
    if (priceEl) priceEl.textContent = money(price);
    return price;
  }
  if (showOptions){
    const fSel = qs('#qvFormat', bd);
    const sSel = qs('#qvSize', bd);
    // llena formato
    fSel.innerHTML = '';
    formats.forEach(f=>{ const o=document.createElement('option'); o.value=f; o.textContent = f===1?'1 pieza':`${f} piezas`; fSel.appendChild(o); });
    // llena tamaño según formato
    function fillSizes(){
      sSel.innerHTML='';
      (sizesByFormat[selPieces]||[]).forEach(k=>{
        const o=document.createElement('option'); o.value=k; o.textContent=sizeLabel(k); sSel.appendChild(o);
      });
      selSize = sSel.value || '';
    }
    fillSizes(); setPrice();
    fSel.addEventListener('change', ()=>{ selPieces = Number(fSel.value); fillSizes(); setPrice(); });
    sSel.addEventListener('change', ()=>{ selSize = sSel.value; setPrice(); });
  }

  // Botón añadir
  qs('#qvAdd').onclick = ()=>{
    let pieces = selPieces, sizeKey = selSize, price;
    if (!showOptions){
      const v = firstVariant(p); pieces=v.pieces; sizeKey=v.sizeKey; price=v.price;
    } else {
      price = setPrice();
    }
    const img = imgs[i] || p.image;
    cartAdd({
      id: `${p.id}-${pieces}-${sizeKey||'unique'}`,
      title: p.title,
      price: Number(price),
      image: img,
      size: sizeKey ? `${sizeLabel(sizeKey)} · ${pieces}p` : 'Único',
      qty: 1
    });
    closeQuickView();
  };

  // Mostrar modal
  qs('#qvBackdrop').classList.remove('hidden');
  const m = qs('#qvModal');
  m.style.opacity = '1';
  m.style.pointerEvents = 'auto';
  document.body.classList.add('noscroll');

  // Estado inicial
  updateUI();
}

function closeQuickView(){
  const bd = qs('#qvBackdrop'); const m = qs('#qvModal');
  if(!bd || !m) return;
  bd.classList.add('hidden');
  m.style.opacity = '0';
  m.style.pointerEvents = 'none';
  document.body.classList.remove('noscroll');
}

/* =========================================================================
   ShopCard (lupa + modal) – para SHOP
   ========================================================================= */
function shopCard(p, opts={}){
  const fromPieces = opts.fromPieces; // Set | number | array | undefined
  const hasOffer = Number(p.compareAt) > Number(p.price);
  const pct = hasOffer ? Math.max(1, Math.round((1 - (p.price / p.compareAt)) * 100)) : 0;

  const el = document.createElement('article');
  el.className = 'product-card';
  el.innerHTML = `
    <div class="product-thumb">
      ${hasOffer ? `<span class="sale-badge">-${pct}%</span>` : ''}
      <a href="product.html?id=${p.id}" class="block">
        <img src="${p.image}" alt="${p.title}" class="product-card__img">
      </a>
      <button class="qv-btn" data-qv="${p.id}" aria-label="Vista rápida">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
          width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>
    </div>
    <div class="p-4">
      <a href="product.html?id=${p.id}" class="font-semibold hover:underline">${p.title}</a>
      <div class="price-line mt-1">
        Desde: <span class="text-indigo-700">${money(minPriceFromTable(p, fromPieces))}</span>
      </div>
      <div class="mt-2">
        <button data-add="${p.id}" class="btn btn--sm btn--primary">Añadir Al Carrito</button>
      </div>
    </div>`;

  // Acciones
  el.querySelector('[data-add]').onclick = ()=> addOrChoose(p);
  el.querySelector('.qv-btn').onclick = (e)=> {
    e.preventDefault();
    openQuickView(p, {withOptions:true});
  };

  return el;
}

/* =========================================================================
   SHOP (listado + filtros) — ADAPTADO con drawer móvil final
   ========================================================================= */
/* =========================================================================
   SHOP (listado + filtros) — ADAPTADO con drawer móvil final
   Versión con logging y fallback para depuración (pegar sobre tu IIFE actual)
   ========================================================================= */
(async function shop(){
  // Si no existe el contenedor principal, salir (evita errores en otras páginas)
  if(!qs('#shopGrid')) return;

  // Mostrar on-page un banner de debug si algo va mal
  function showPageMessage(txt, isError=true){
    let box = qs('#shopDebugBox');
    if(!box){
      box = document.createElement('div');
      box.id = 'shopDebugBox';
      box.style.position = 'fixed';
      box.style.right = '16px';
      box.style.top = '80px';
      box.style.zIndex = '9999';
      box.style.maxWidth = '320px';
      box.style.padding = '10px 12px';
      box.style.borderRadius = '8px';
      box.style.boxShadow = '0 6px 18px rgba(0,0,0,.4)';
      box.style.fontFamily = 'Inter, system-ui, Arial';
      box.style.fontSize = '13px';
      box.style.color = '#fff';
      document.body.appendChild(box);
    }
    box.style.background = isError ? 'rgba(220,40,70,.95)' : 'rgba(40,180,120,.95)';
    box.textContent = txt;
    setTimeout(()=>{ if(box) box.style.opacity = '1'; }, 20);
  }

  // Intenta cargar datos y si falla usa fallback
  let products = [], cats = [];
  try{
    const data = await loadData();
    products = Array.isArray(data.products) ? data.products : (window.__PRODS || []);
    cats     = Array.isArray(data.cats) ? data.cats : (window.__CATS || []);
    console.log('[shop] loadData() OK — productos:', products.length, 'categorías:', cats.length);
  }catch(err){
    console.error('[shop] loadData() failed:', err);
    showPageMessage('Error cargando datos. Revisa la consola (F12) para más detalles.', true);
    // fallback si en alguna parte cargaste globalmente
    products = Array.isArray(window.__PRODS) ? window.__PRODS : [];
    cats     = Array.isArray(window.__CATS) ? window.__CATS : [];
    if(!products.length) {
      console.warn('[shop] No hay productos en window.__PRODS. Abandonando render.');
      return;
    }
  }

  // Comprueba que realmente haya productos para renderizar
  if(!products || !products.length){
    console.warn('[shop] No se encontraron productos. Comprueba data/products.json o window.__PRODS');
    showPageMessage('No se encontraron productos. Revisa la ruta data/products.json o la consola.', true);
    return;
  }

  // Indicadores del carrito
  try{ updateCartCount(); }catch(e){ console.warn('[shop] updateCartCount falla:', e); }

  /* ========================================================
     🔍 Corrección: eliminar ?q= de la URL y usar sessionStorage
     ======================================================== */
  let initialQ = '';
  try {
    initialQ = sessionStorage.getItem("searchTerm") || "";
    sessionStorage.removeItem("searchTerm"); // limpiar
  } catch(e) {
    console.warn('[shop] sessionStorage inaccesible:', e);
  }

  // Paginación
  let page = 0;
  const pageSize = 12;

  const state = {
    q: (initialQ || '').toLowerCase(),
    cats: new Set(),
    tags: new Set(),
    pieces: new Set(),
    sort: 'new',
  };

  /* Pintar búsqueda inicial en el input shopSearch (si existe) */
  const shopSearch = qs('#shopSearch');
  if (shopSearch) {
    try { shopSearch.value = initialQ; } catch(e){ console.warn('[shop] no pudo asignar shopSearch.value', e); }
  }

  /* PRE-CÁLCULOS: contadores */
  const counts = { cats:{}, pieces:{} };
  products.forEach(p=>{
    try{
      counts.cats[p.category] = (counts.cats[p.category]||0) + 1;
      const pz = String(p.pieces || '1');
      counts.pieces[pz] = (counts.pieces[pz]||0) + 1;
    }catch(e){ /* ignore individual product errors */ }
  });

  /* Facetas: Categorías */
  const facetCats = qs('#facetCats');
  if (facetCats){
    facetCats.innerHTML = '';
    cats.forEach(c=>{
      const row = document.createElement('label');
      row.className = 'facet-row text-sm';
      row.innerHTML = `
        <span class="flex items-center gap-2">
          <input type="checkbox" />
          <span>${c.name}</span>
        </span>
        <span class="count">${counts.cats[c.slug]||0}</span>`;
      facetCats.appendChild(row);
      row.querySelector('input').onchange = (e)=>{
        e.target.checked ? state.cats.add(c.slug) : state.cats.delete(c.slug);
        apply();
      };
    });
  }

  /* Facetas: Tags */
  const allTags = [...new Set(products.flatMap(p=>p.tags||[]))].sort();
  const facetTags = qs('#facetTags');
  if (facetTags){
    facetTags.innerHTML = '';
    allTags.forEach(t=>{
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'facet-chip';
      chip.textContent = t;
      chip.onclick = ()=>{
        if (state.tags.has(t)){ state.tags.delete(t); chip.dataset.on = '0'; }
        else { state.tags.add(t); chip.dataset.on = '1'; }
        apply();
      };
      facetTags.appendChild(chip);
    });
  }

  /* Facetas: Piezas */
  const facetPieces = qs('#facetPieces');
  if (facetPieces){
    facetPieces.innerHTML = '';
    ['1','2','3','4'].forEach(pz=>{
      const row = document.createElement('label');
      row.className = 'facet-row text-sm';
      row.innerHTML = `
        <span class="flex items-center gap-2">
          <input type="checkbox" value="${pz}" />
          <span>${pz} Piezas</span>
        </span>
        <span class="count">${counts.pieces[pz]||0}</span>`;
      facetPieces.appendChild(row);
      row.querySelector('input').onchange = (e)=>{
        e.target.checked ? state.pieces.add(pz) : state.pieces.delete(pz);
        apply();
      };
    });
  }

  /* Render + Apply */
  function render(arr){
    const grid = qs('#shopGrid');
    if(!grid){ console.error('[shop] #shopGrid no existe'); showPageMessage('Contenedor #shopGrid no encontrado.', true); return; }
    if(page===0) grid.innerHTML='';
    const slice = arr.slice(page*pageSize, (page+1)*pageSize);
    if(!slice.length && page===0){
      // si no hay resultados, mostrar mensaje en página
      grid.innerHTML = `<div class="empty-results" style="padding:40px;color:#9aa; text-align:center">No hay productos que coincidan con la búsqueda.</div>`;
      return;
    }
    slice.forEach(p=>{
      try{
        grid.appendChild(shopCard(p, { fromPieces: state.pieces }));
      }catch(e){
        console.warn('[shop] fallo renderizando producto', p && p.id, e);
      }
    });
  }

  function apply(){
    let arr = products.filter(p=>{
      try{
        const okQ = !state.q || (
          (p.title||'').toLowerCase().includes(state.q) ||
          (p.tags||[]).join(' ').toLowerCase().includes(state.q)
        );
        const okCat = !state.cats.size || state.cats.has(p.category);
        const okTag = !state.tags.size || (p.tags||[]).some(t=>state.tags.has(t));
        const okPieces = !state.pieces.size || state.pieces.has(String(p.pieces||'1'));
        return okQ && okCat && okTag && okPieces;
      }catch(e){
        return false;
      }
    });

    switch(state.sort){
      case 'new':        arr.sort((a,b)=>new Date(b.created)-new Date(a.created)); break;
      case 'popular':    arr.sort((a,b)=>b.reviews-a.reviews); break;
      case 'price-asc':  arr.sort((a,b)=>a.price-b.price); break;
      case 'price-desc': arr.sort((a,b)=>b.price-a.price); break;
    }

    const rc = qs('#resultCount');
    if (rc) rc.textContent = `Mostrando ${arr.length} resultados`;

    page = 0;
    render(arr);

    const lm = qs('#loadMore');
    if (lm){
      lm.onclick = ()=>{ page++; render(arr); };
      lm.style.display = (arr.length > pageSize) ? '' : 'none';
    }
  }

 /* ======================
   BUSCADOR PRINCIPAL REAL
   ====================== */

// Detectar el input y botón reales del HTML
const qInput = qs('#qSearch');
const qBtn = qs('#qGo');

// Rellenar búsqueda previa (si existe)
let stored = sessionStorage.getItem("searchTerm") || "";
sessionStorage.removeItem("searchTerm");

if (qInput) qInput.value = stored;
if (stored) state.q = stored.toLowerCase();

// Cuando el usuario escribe
if (qInput){
  qInput.addEventListener('input', e=>{
    state.q = e.target.value.toLowerCase();
    apply();
  });
}

// Cuando el usuario hace click en la lupa
if (qBtn){
  qBtn.addEventListener('click', ()=>{
    state.q = (qInput.value || "").toLowerCase();
    apply();
  });
}

// Cuando el usuario presiona ENTER
if (qInput){
  qInput.addEventListener('keydown', e=>{
    if (e.key === 'Enter'){
      state.q = qInput.value.toLowerCase();
      apply();
    }
  });
}


  const sortSel = qs('#sort');
  if (sortSel) sortSel.onchange = e=>{
    state.sort = e.target.value;
    apply();
  };

  // Primer render
  try { apply(); } catch(e){ console.error('[shop] apply() fallo:', e); showPageMessage('Error interno al renderizar la tienda. Revisa la consola.', true); }

  /* Drawer / Mobile */
  const openBtn  = qs('#openFilters');
  const closeBtn = qs('#closeFilters');
  const panel    = qs('#filtersPanel');
  const backdrop = qs('#filtersBackdrop');

  function openDrawer(){
    panel?.classList.add('open');
    backdrop?.classList.remove('hidden');
    backdrop?.classList.add('show');
    document.body.classList.add('noscroll');
  }
  function closeDrawer(){
    panel?.classList.remove('open');
    backdrop?.classList.remove('show');
    backdrop?.classList.add('hidden');
    document.body.classList.remove('noscroll');
  }

  openBtn?.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  backdrop?.addEventListener('click', closeDrawer);

  qs('#openSort')?.addEventListener('click', ()=> qs('#sort')?.focus());
})();


/* =========================================================================
   Product (detalle) — PRECIO dinámico por Formato y Tamaño
   ========================================================================= */
(async function product(){
  if(!qs('#pImg')) return;
  updateCartCount();

  const {products} = await loadData();
  const id = new URLSearchParams(location.search).get('id') || '1';
  const p = products.find(x=>String(x.id)===String(id)) || products[0];

  // ====== Imágenes ======
  const imgs = (Array.isArray(p.images) && p.images.length ? p.images : [p.image]).filter(Boolean);
  const mainSrc = imgs[0];
  qs('#pImg').src = mainSrc;
  qs('#pTitle').textContent = p.title;
  qs('#pDesc').textContent  = p.description ?? '';
  qs('#pBread').textContent = `Categoría: ${p.category ?? '-'}`;
  const t = qs('#pTimer'); if (t) startTimer(t, 180);

  // Thumbs
  const thumbsRow = qs('#pThumbsRow');
  if (thumbsRow){
    thumbsRow.innerHTML = '';
    imgs.forEach((src, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 't'; b.dataset.src = src;
      if (i === 0) b.dataset.active = '1';
      b.innerHTML = `<img src="${src}" alt="">`;
      b.onclick = () => {
        qs('#pImg').src = src;
        qsa('#pThumbsRow .t').forEach(x => x.dataset.active = (x === b ? '1' : '0'));
      };
      thumbsRow.appendChild(b);
    });
  }

  // Video
  const v = qs('#pVideo');
  if (v){ if (p.video) { v.href = p.video; v.classList.remove('hidden'); } else { v.classList.add('hidden'); } }

  // ====== Formato (piezas) y Tamaño ======
  const formatSel = qs('#pPieces') || qs('#pFormat') || qs('#formatSel') || qs('#pFormatSel');
  const sizeSel   = qs('#pSize')   || qs('#sizeSel')   || qs('#pSizeSel')   || qs('#pOptions select[data-role="size"]');
  const priceEl   = qs('#pPrice');

  const availableFormats = (Array.isArray(p.formats) && p.formats.length)
    ? p.formats.slice().sort((a,b)=>a-b)
    : [ Number(p.pieces||1) ];

  const table = p.priceTable || DEFAULT_PRICE_TABLE;

  if (formatSel){
    formatSel.innerHTML = '';
    for (const f of availableFormats){
      if (!table[String(f)]) continue;
      const opt = document.createElement('option');
      opt.value = String(f);
      opt.textContent = f === 1 ? '1 pieza' : `${f} piezas`;
      formatSel.appendChild(opt);
    }
    if (formatSel.options.length <= 1){
      formatSel.disabled = true;
      const wrap = formatSel.closest('[data-format-wrap]') || formatSel.parentElement;
      wrap && (wrap.style.opacity = '0.8');
    }
  }

  function fillSizes(pieces){
    if(!sizeSel) return;
    const row = table[String(pieces)] || {};
    const keys = Object.keys(row);
    sizeSel.innerHTML = '';
    keys.forEach(k=>{
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = sizeLabel(k);
      sizeSel.appendChild(opt);
    });
    sizeSel.disabled = keys.length === 0;
  }

  function renderPrice(){
    const pieces = Number(formatSel?.value || availableFormats[0]);
    const sizeKey = sizeSel?.value || (Object.keys(table[String(pieces)]||{})[0]);
    if (!sizeKey) {
      priceEl.textContent = money(p.price||0);
      return { price: p.price||0, pieces, sizeKey:'' };
    }
    const price = priceFor(p, pieces, sizeKey);
    priceEl.textContent = money(price);
    return { price, pieces, sizeKey };
  }

  const initialPieces = Number(formatSel?.value || availableFormats[0]);
  fillSizes(initialPieces);
  renderPrice();

  formatSel?.addEventListener('change', ()=>{
    const pieces = Number(formatSel.value);
    fillSizes(pieces);
    renderPrice();
  });
  sizeSel?.addEventListener('change', renderPrice);

  /* =========================================================================
     Relacionados — usa SIEMPRE la tarjeta moderna `shopCard()` y limpia el grid
     ========================================================================= */
  (function renderRelated(){
    const relGrid = qs('#relGrid');
    if (!relGrid) return;

    relGrid.innerHTML = '';

    const shuffle = arr => {
      for (let i = arr.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    const sameTag = x => (x.tags || []).some(t => (p.tags || []).includes(t));
    const sameCat = x => x.category && p.category && x.category === p.category;

    const pool = products.filter(x => String(x.id) !== String(p.id));

    let rel = pool.filter(sameTag);
    if (rel.length < 8) {
      const extrasCat = pool.filter(x => sameCat(x) && !rel.includes(x));
      rel = rel.concat(extrasCat);
    }
    if (rel.length < 8) {
      const extrasAny = pool.filter(x => !rel.includes(x));
      rel = rel.concat(shuffle(extrasAny));
    }

    rel = shuffle(rel).slice(0, 8);

    rel.forEach(x => relGrid.appendChild(shopCard(x)));
  })();

  // ====== Botones de compra ======
  const addBtn = qs('#addBtn');
  if (addBtn) addBtn.onclick = ()=>{
    const {price, sizeKey, pieces} = renderPrice();
    const currentImg = qs('#pImg')?.src || mainSrc || p.image;
    cartAdd({
      id: `${p.id}-${pieces}-${sizeKey}`,
      title: p.title,
      price: Number(price),
      image: currentImg,
      size: `${sizeLabel(sizeKey)} · ${pieces}p`,
      qty: 1
    });
    alert('Añadido al carrito');
  };
  const buyBtn = qs('#buyBtn');
  if (buyBtn) buyBtn.onclick = ()=>{
    const {price, sizeKey, pieces} = renderPrice();
    const currentImg = qs('#pImg')?.src || mainSrc || p.image;
    cartAdd({
      id: `${p.id}-${pieces}-${sizeKey}`,
      title: p.title,
      price: Number(price),
      image: currentImg,
      size: `${sizeLabel(sizeKey)} · ${pieces}p`,
      qty: 1
    });
    alert('Aquí va la integración de pago');
  };
})();

/* =========================================================================
   Carrito (localStorage) + Drawer
   ========================================================================= */
function cartKey(){ return 'azerium_cart'; }
function cartGet(){ try { return JSON.parse(localStorage.getItem(cartKey())||'[]'); } catch(e){ return []; } }
function cartSet(items){
  localStorage.setItem(cartKey(), JSON.stringify(items));
  document.dispatchEvent(new Event('cart:changed'));
}
function cartAdd(item){
  const items = cartGet();
  const idx = items.findIndex(x=>String(x.id)===String(item.id) && String(x.size)===String(item.size));
  if(idx>-1){ items[idx].qty = (Number(items[idx].qty)||0) + (Number(item.qty)||0); }
  else { items.push({ ...item, qty: Number(item.qty)||1, price: Number(item.price)||0 }); }
  cartSet(items);
}
function cartQty(id, size, qty){
  const items = cartGet(); const it = items.find(x=>String(x.id)===String(id) && String(x.size)===String(size));
  if(it){ it.qty = Math.max(1, Number(qty)||1); cartSet(items); }
}
function cartRemove(id, size){
  const items = cartGet().filter(x=>!(String(x.id)===String(id) && String(x.size)===String(size)));
  cartSet(items);
}

// Drawer carrito
function ensureCartDrawer(){
  if(document.getElementById('cartDrawer')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="cartBackdrop" class="hidden fixed inset-0 bg-black/60 z-40"></div>
    <aside id="cartDrawer" class="fixed top-0 right-0 h-full w-[360px] max-w-[92vw] bg-slate-900 border-l border-white/10 translate-x-full transition-transform z-50">
      <div class="flex items-center justify-between p-4 border-b border-white/10">
        <h3 class="text-lg font-semibold">Tu carrito</h3>
        <button id="cartClose" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Cerrar</button>
      </div>
      <div id="cartItems" class="p-4 space-y-3 overflow-y-auto h-[70%]"></div>
      <div class="p-4 border-t border-white/10 space-y-3">
        <div class="flex justify-between"><span>Subtotal</span><span id="cartSubtotal" class="font-semibold">S/ 0.00</span></div>
        <a href="checkout.html" class="block text-center px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500">Ir al checkout</a>
      </div>
    </aside>`;
  document.body.appendChild(wrap);
  document.getElementById('cartClose').onclick = closeCartDrawer;
  document.getElementById('cartBackdrop').onclick = closeCartDrawer;
}
function openCartDrawer(){
  ensureCartDrawer();
  renderCartDrawer();
  document.getElementById('cartDrawer').style.transform = 'translateX(0)';
  document.getElementById('cartBackdrop').classList.remove('hidden');
}
function closeCartDrawer(){
  const d = document.getElementById('cartDrawer'); if(!d) return;
  d.style.transform = 'translateX(100%)';
  document.getElementById('cartBackdrop').classList.add('hidden');
}
function renderCartDrawer(){
  ensureCartDrawer();
  const box = document.getElementById('cartItems');
  box.innerHTML = '';
  let subtotal = 0;
  for(const it of cartGet()){
    subtotal += (Number(it.price)||0) * (Number(it.qty)||0);
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-xl';
    row.innerHTML = `
      <img src="${it.image}" class="w-14 h-14 rounded-lg object-cover border border-white/10">
      <div class="flex-1">
        <div class="text-sm font-medium">${it.title} <span class="opacity-60">(${it.size})</span></div>
        <div class="text-xs opacity-70">${money(it.price)}</div>
        <div class="mt-2 flex items-center gap-2 text-sm">
          <button class="px-2 rounded bg-white/10" data-dec>−</button>
          <input type="number" min="1" value="${it.qty}" class="w-12 text-center bg-transparent border border-white/10 rounded" data-qty>
          <button class="px-2 rounded bg-white/10" data-inc>+</button>
        </div>
      </div>
      <button class="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500" data-del>Eliminar</button>`;
    row.querySelector('[data-dec]').onclick = ()=> cartQty(it.id, it.size, (it.qty||1)-1);
    row.querySelector('[data-inc]').onclick = ()=> cartQty(it.id, it.size, (it.qty||1)+1);
    row.querySelector('[data-qty]').onchange = (e)=> cartQty(it.id, it.size, +e.target.value || 1);
    row.querySelector('[data-del]').onclick = ()=> cartRemove(it.id, it.size);
    box.appendChild(row);
  }
  const sub = document.getElementById('cartSubtotal');
  if (sub) sub.textContent = money(subtotal);
}

/* =========================================================================
   Header: abrir drawer del carrito
   ========================================================================= */
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('#cartBtn').forEach(btn => {
    btn.addEventListener('click', (e)=>{ e.preventDefault(); openCartDrawer(); });
  });
});

/* =========================================================================
   Eventos globales de sincronización
   ========================================================================= */
window.addEventListener('load', updateCartCount);
document.addEventListener('DOMContentLoaded', updateCartCount);
document.addEventListener('header:ready', updateCartCount);
document.addEventListener('cart:changed', ()=>{
  updateCartCount();
  if (document.getElementById('cartDrawer')) renderCartDrawer();
});



/* =========================================================================
   CHECKOUT — Envío: Pickup / Lima / Provincia + Modal de Pago + WhatsApp
   Mejoras: tarifa por provincia editable + envío "Shalom"
   ========================================================================= */

/* ===== Config negocio ===== */
const BUSINESS = {
  name: 'Azerium Studio',
  legal: 'Azerium Studio',
  ruc: '',
  supportHours: 'En unos minutos confirmamos su pedido, Gracias. ATENCION: Lun–Sáb 9:00–20:00',
  policies: {
    changes: 'cambios.html',
    delivery: 'terms.html',
    privacy: 'privacy.html'
  }
};

/* ===== Helpers base ===== */
function money(n){ n = Number(n)||0; return 'S/ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function cartKey(){ return 'azerium_cart'; }
function cartGet(){ try { return JSON.parse(localStorage.getItem(cartKey())||'[]'); } catch(e){ return []; } }

/* ===== Orden / ID persistente ===== */
const ORDER_ID_KEY = 'azerium_order_id';
function genOrderId(){
  const d = new Date();
  return `AZ-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
}
function getOrderId(){
  let id = localStorage.getItem(ORDER_ID_KEY);
  if (!id){ id = genOrderId(); localStorage.setItem(ORDER_ID_KEY, id); }
  return id;
}
function resetOrderId(){ localStorage.removeItem(ORDER_ID_KEY); }

/* ===== Estado de envío (persistente) ===== */
const SHIPPING_KEY = 'azerium_shipping';
function shipGet(){
  try{
    const v = JSON.parse(localStorage.getItem(SHIPPING_KEY)||'{}');
    if (v && (v.code==='pickup' || v.code==='delivery' || v.code==='province')) return v;
  }catch(_){}
  return { code:'pickup', fee:0, dept:'', carrier: '' };
}
// shipSet deja persistente cualquier propiedad que le pases (code, fee, dept, carrier...)
function shipSet(v){
  localStorage.setItem(SHIPPING_KEY, JSON.stringify(v));
  document.dispatchEvent(new Event('cart:changed'));
}

/* ===== Config tarifas por provincia (editable) =====
   - Cambia los valores a la tarifa que tú quieras por cada departamento.
   - Nombres deben coincidir exactamente con los que aparecen en el select (ej. "Lima", "Cusco", "Arequipa", etc.)
*/
const PROVINCE_FEES = {
  /*"Amazonas":*/
  "Amazonas-Chachapoyas co dos de Mayo": 22.00,
  "Amazonas-Chachapoyas Jr Grau": 24.00,
  "Amazonas-Bagua Capital": 22.00,
  "Amazonas-Pedro Ruiz": 22.00,
  "Amazonas-Luya": 24.00,
  "Amazonas-Bagua Grande": 22.00,

  /*"Áncash"*/
  "Áncash-Huaraz": 16.00,
  "Áncash-Carhuaz": 18.00,
  "Áncash-Casma": 18.00,
  "Áncash-Huarmey": 18.00,
  "Áncash-Caraz": 18.00,
  "Áncash-Av Enrique Meiggs": 18.00,
  "Áncash-Av Jose Galvez": 18.00,
  "Áncash-Av Los Pescadores Co": 16.00,
  "Áncash-Santa": 18.00,
  "Áncash-Ovalo de la Familia": 18.00,
  "Áncash-Tres de Octubre": 18.00,
  "Áncash-Garatea": 18.00,
  "Áncash-Av Pacífico Belen": 18.00,
  "Áncash-Yungai": 18.00,
  
  /*"Apurímac"*/
  "Apurimac-Abancay": 20.00,
  "Apurimac-Andahuaylas": 20.00,

  /*"Arequipa"*/
  "Arequipa-Av Parra 379 CO": 20.00,
  "Arequipa-Av Lima": 22.00,
  "Arequipa-Av Augusto Salazar Bondy": 22.00,
  "Arequipa-Plaza La Tomilla": 22.00,
  "Arequipa-Av Charcani": 22.00,
  "Arequipa-Ciudad Municipal": 22.00,
  "Arequipa-Asoc Las Flores-Av 54": 22.00,
  "Arequipa-Av Pumacahua": 22.00,
  "Arequipa-Zamacola": 22.00,
  "Arequipa-Av Los Incas": 22.00,
  "Arequipa-Autopista La Joya": 22.00,
  "Arequipa-Asoc. Nuevo Horizonte-Av.54": 22.00,
  "Arequipa-Jacobo Hunter": 22.00,
  "Arequipa-El Creuce La Joya": 22.00,
  "Arequipa-Mariano Melgar": 22.00,
  "Arequipa-Miraflores Arequipa": 22.00,
  "Arequipa-Urb Manuel Prado": 22.00,
  "Arequipa-Av Jesus": 22.00,
  "Arequipa-Av Socabaya-Los Toritos": 22.00,
  "Arequipa-Av. Horacio Zevallos": 22.00,
  "Arequipa-Huchumayo": 22.00,
  "Arequipa-Yura": 22.00,
  "Arequipa-Camana": 22.00,
  "Arequipa-Chala": 20.00,
  "Arequipa-Majes Pedregal": 22.00,
  "Arequipa-Moyendo Co": 22.00,
  "Arequipa-Cercado Mollendo": 22.00,
  "Arequipa-Cocachacra": 23.00,
  "Arequipa-Matarani": 22.00,

  /*Ayacucho*/
  "Ayacucho-Ayacucho Co": 18.00,
  "Ayacucho-Ayacucho Carmen Alto": 20.00,
  "Ayacucho-Ayacucho Jesús Nazareno": 20.00,
  "Ayacucho-Huanta": 20.00,

  /*"Cajamarca"*/
  "Cajamarca-Cajamarca Co": 20.00,
  "Cajamarca-Cajamarca Horacion Zevallos": 22.00,
  "Cajamarca-Barrio San Jose": 22.00,
  "Cajamarca-Huambocancha Baja": 22.00,
  "Cajamarca-Huaraclla": 22.00,
  "Cajamarca-Baños del Inca": 22.00,
  "Cajamarca-Cajabamba": 24.00,
  "Cajamarca-Celendin": 22.00,
  "Cajamarca-Chota": 22.00,
  "Cajamarca-Chilete": 22.00,
  "Cajamarca-Tembladera Cajamarca": 22.00,
  "Cajamarca-Cutervo": 24.00,
  "Cajamarca-Bambamarca": 22.00,
  "Cajamarca-Jaen": 22.00,
  "Cajamarca-San Ignacio": 24.00,
  "Cajamarca-San Marcos": 22.00,
  "Cajamarca-San Miguel Cajamarca": 22.00,
  "Cajamarca-San Pablo Cajamarca": 22.00,


  /*"Cusco"*/
  "Cusco-Tica Tica": 24.00,
  "Cusco-San Jeronimo": 24.00,
  "Cusco-Cachimayo-San Sebastián": 24.00,
  "Cusco-Via Expresa Sur": 24.00,
  "Cusco-Av Antonio Lorena": 24.00,
  "Cusco-Urb Bancopata Av Industrial": 24.00,
  "Cusco-Cusco CO Parque Industrial": 22.00,
  "Cusco-Av Pachacútec": 24.00,
  "Cusco-Velasco Astete": 24.00,
  "Cusco-Anta Izcuchaca": 22.00,
  "Cusco-Cusco Calca": 24.00,
  "Cusco-Pisac": 24.00,
  "Cusco-Sicuani CO Ovalo San Andres": 22.00,
  "Cusco-Sicuani Av Manuel Callo": 24.00,
  "Cusco-Combapata": 24.00,
  "Cusco-Santo Tomas": 27.00,
  "Cusco-Espinar": 24.00,
  "Cusco-Quillabamba": 27.00,
  "Cusco-Urcos": 24.00,
  "Cusco-Oropesa": 24.00,
  "Cusco-Cusco Urubamba": 24.00,
  "Cusco-Chinchero": 24.00,

  /*"Huancavelica"*/
  "Huancavelica-Huancavelica": 20.00,

  
  /*"Huánuco"*/
  "Huánuco-Jr Aguilar": 22.00,
  "Huánuco-Amarilis CO": 20.00,
  "Huánuco-Ambo": 22.00,
  "Huánuco-Tingo Maria CO Buenos Aires": 18.00,
  "Huánuco-Tingo Maria-Amazonas": 20.00,
  "Huánuco-Aucayacu": 20.00,

  /*"Ica"*/
  "Ica-Ica San Joaquín": 16.00,
  "Ica-Ica Av. JJ Elías": 18.00,
  "Ica-Ica Urb. Manzanilla": 18.00,
  "Ica-La Tinguiña": 18.00,
  "Ica-Parcona": 18.00,
  "Ica-Salas Ica": 18.00,
  "Ica-Ica Santiago": 18.00,
  "Ica-Ica Subtanjalla CO": 16.00,
  "Ica-Prolong Luis Massaro": 16.00,
  "Ica-Calle Los Ángeles": 18.00,
  "Ica-Chincha Pueblo Nuevo": 18.00,
  "Ica-Sunampe CO": 16.00,
  "Ica-Nazca": 18.00,
  "Ica-San Juan de Marcona": 20.00,
  "Ica-Av Abraham Valdelomar CO": 16.00,
  "Ica-La Villa Cruce Pisco": 18.00,
  "Ica-San Clemente": 18.00,



  /* ================= Junín ================= */
  "Junín-Huancayo JR. Ica": 18.00,
  "Junín-Terminal Los Andes": 18.00,
  "Junín-San Carlos Huancayo": 18.00,
  "Junín-Chilca Huancayo": 18.00,
  "Junín-Av Mariscal Castilla CO Parque Industrial": 16.00,
  "Junín-Pio Pata": 18.00,
  "Junín-Av Circunvalación Cruce con Mariátegui": 18.00,
  "Junín-Ciudad Universitaria": 18.00,
  "Junín-Pilcomayo": 18.00,
  "Junín-San Agustin de Cajas": 18.00,
  "Junín-Concepción": 18.00,
  "Junín-La Merced": 18.00,
  "Junín-Perene": 18.00,
  "Junín-Pichanaki": 18.00,
  "Junín-San Ramón": 16.00,
  "Junín-Jauja": 17.00,
  "Junín-Satipo": 18.00,
  "Junín-Mazamari": 20.00,
  "Junín-Tarma": 16.00,
  "Junín-La Oroya": 16.00,
  "Junín-Chupaca": 18.00,

  /*"La Libertad"*/
  "La Libertad-Calle Liverpool": 19.00,
  "La Libertad-Trujillo la Perla": 20.00,
  "La Libertad-Atahualpa": 20.00,
  "La Libertad-Calle Santa Cruz-America Sur": 20.00,
  "La Libertad-Av hnos Uceda-America Norte": 20.00,
  "La Libertad-Ovalo Papal": 20.00,
  "La Libertad-Av Hermanos Angulo": 20.00,
  "La Libertad-Alto Trujillo": 20.00,
  "La Libertad-Av. Las Magnolias": 20.00,
  "La Libertad-Jr. Cahuide": 20.00,
  "La Libertad-Ovalo Huanchaco CO": 18.00,
  "La Libertad-El Milagro": 20.00,
  "La Libertad-Av Tahuantinsuyo": 20.00,
  "La Libertad-Wichanzao": 20.00,
  "La Libertad-Moche": 20.00,
  "La Libertad-Av Larco": 20.00,
  "La Libertad-Paiján": 20.00,
  "La Libertad-Casa Grande": 20.00,
  "La Libertad-Chepen": 20.00,
  "La Libertad-Pacanguilla": 22.00,
  "La Libertad-Otuzco": 22.00,
  "La Libertad-San Pedro De Lloc": 20.00,
  "La Libertad-Ciudad de Dios": 20.00,
  "La Libertad-Guadalupe La Libertad": 20.00,
  "La Libertad-Pacasmayo Las Palmeras": 20.00,
  "La Libertad-Pacasmayo Centro": 20.00,
  "La Libertad-Puente Viru": 20.00,
  "La Libertad-Viru Centro": 20.00,
  "La Libertad-Chao": 20.00,

  /*"Lambayeque"*/
  "Lambayeque-Miraflores Chiclayo": 22.00,
  "Lambayeque-Mariscal Nieto": 22.00,
  "Lambayeque-Av Las Américas": 22.00,
  "Lambayeque-Chongoyape": 22.00,
  "Lambayeque-Calle Tahuantinsuyo": 22.00,
  "Lambayeque-Av Balta Cdra. 36": 22.00,
  "Lambayeque-Av Victor R. Haya CO": 22.00,
  "Lambayeque-Monsefú": 22.00,
  "Lambayeque-Pimentel": 22.00,
  "Lambayeque-Reque": 22.00,
  "Lambayeque-Tuman": 22.00,
  "Lambayeque)-Ferreñafe": 22.00,
  "Lambayeque-Lambayeque Panamericana": 22.00,
  "Lambayeque-Lambayeque Centro": 22.00,
  "Lambayeque-Jayanca": 24.00,
  "Lambayeque-Morrope": 22.00,
  "Lambayeque-Motupe": 24.00,
  "Lambayeque-Olmos": 24.00,
  "Lambayeque-Túcume": 22.00,


  "Lima-Lima": 15.00, // si el usuario elige "province" y selecciona Lima, se aplicará este valor (puedes dejarlo igual a FEES.delivery)

  /* Loreto */
  "Loreto-Iquitos Jr Francisco Bolognesi": 46.00,
  "Loreto-Iquitos Co Jr. Pablo Rossell": 46.00,
  "Loreto-Iquitos Av Tupac Amaru": 46.00,
  "Loreto-Punchana": 46.00,
  "Loreto-Av Participación Parcela": 46.00,
  "Loreto-Av Jose A. Quiñones": 46.00,
  "Loreto-Yurimaguas": 24.00,

 /* Madre de Dios */
  "Madre de Dios-Tambopata Av La Joya CO": 24.00,
  "Madre de Dios-Jr.Jaime Troncoso": 26.00,
  "Madre de Dios-Tambopata Av Circunvalación": 26.00,
  "Madre de Dios-Mazuko": 24.00,
  "Madre de Dios-El Triunfo": 26.00,
  "Madre de Dios-Iberia": 26.00,
  /* Moquegua */
  "Moquegua-San Antonio": 22.00,
  "Moquegua-Calle Lima": 22.00,
  "Moquegua-Quebrada Las Lechuzas CO": 20.00,
  "Moquegua-Chen Chen": 22.00,
  "Moquegua-Ilo Co Pampa Inalámbrica": 20.00,
  "Moquegua-Ilo Puerto": 22.00,

  /* Pasco */
  "Pasco-Cerro de Pasco": 16.00,
  "Pasco-Huayllay": 18.00,
  "Pasco-Oxapampa": 20.00,
  "Pasco-Villa Rica": 20.00,

  
  // piura
  "Piura-av. luis eguiguren": 22.00,
  "Piura-av. grau": 22.00,
  "Piura-av raul mata la cruz- dos grifos": 22.00,
  "Piura-av tacna": 22.00,
  "Piura-tacala": 22.00,
  "Piura-catacaos": 22.00,
  "Piura-la union": 22.00,
  "Ppiur)-las lomas": 24.00,
  "Piura-tambo grande": 24.00,
  "Piura-calle emaús": 22.00,
  "Piura-parque industrial co piura futura": 20.00,
  "Piura-av. gullman": 22.00,
  "Piura-aahh santa rosa piura": 22.00,
  "Piura-ayabaca": 24.00,
  "Piura-paimas": 24.00,
  "Piura-huancabamba": 24.00,
  "Piura-chulucanas": 22.00,
  "Piura-morropón": 22.00,
  "Piura-paita": 22.00,
  "Piura-sullana santa rosa": 24.00,
  "Piura-sullana co zona industrial": 22.00,
  "Piura-bellavista sullana": 24.00,
  "Piura-ignacio escudero": 24.00,
  "Piura-talara co asoc california": 22.00,
  "Piura-talara alta 9 de octubre": 24.00,
  "Piura-talara baja parque22": 24.00,
  "Piura-el alto": 24.00,
  "Piura-los organos": 24.00,
  "Piura-máncora": 26.00,
  "Piura-sechura": 22.00,


   
  /* puno */
  "Puno-av costanera": 24.00,
  "Puno-salcedo": 24.00,
  "Puno-alto puno": 24.00,
  "Puno-azangaro": 24.00,
  "Puno-desaguadero": 24.00,
  "Puno-ilave": 24.00,
  "Puno-ayaviri": 25.00,
  "Puno-juliaca san santiago": 24.00,
  "Puno-av. huancane cdra.9": 24.00,
  "Puno-las mercedes": 24.00,
  "Puno-av. lampa": 24.00,
  "Puno-av. modesto borda": 24.00,
  "Puno-av independencia": 24.00,
  "Puno-jr agustin gamarra": 24.00,
  "Puno-av heroes del pacifico co": 22.00,



  // san martín
  "San martín-moyobamba centro": 24.00,
  "San martín-soritor": 24.00,
  "San martín-san martin bellavista": 24.00,
  "San martín-san jose de sisa": 24.00,
  "San martín-lamas": 24.00,
  "San martín-juanjui fernando belaunde terry co": 24.00,
  "San martín-juanjui centro": 24.00,
  "San martín-picota": 24.00,
  "San martín-rioja": 22.00,
  "San martín-nueva cajamarca": 22.00,
  "San martín-pardo miguel naranjos": 22.00,
  "San martín-tarapoto co jr alfonso ugarte": 22.00,
  "San martín-jr leoncio prado": 24.00,
  "San martín-jr. tahuantinsuyo": 24.00,
  "San martín-jr. ramón castilla": 24.00,
  "San martín-tarapoto la banda de shilcayo": 24.00,
  "San martín-tarapoto jr. sargento lorez": 24.00,
  "San martín-av fernando belaunde": 20.00,
  "San martín-jr fredy aliaga co": 20.00,
  "San martín-uchiza": 20.00,


  /* tacna */
  "Tacna-av tacna": 22.00,
  "Tacna-tacna co av.jorge basadre": 22.00,
  "Tacna-av vigil": 24.00,
  "Tacna-av. arias araguez": 24.00,
  "Tacna-av ejercito": 24.00,
  "Tacna-pocollay": 24.00,
  "Tacna-tacna ciudad nueva": 24.00,
  "Tacna-villa san francisco": 24.00,
  "Tacna-av. municipal": 24.00,


  // tumbes
  "Tumbes-tumbes - av arica": 24.00,
  "Tumbes-tumbes puyango": 24.00,
  "Tumbes-tumbes co - panamericana norte km 2360": 22.00,
  "Tumbes-pampa grande tumbes": 24.00,
  "Tumbes-corrales": 24.00,
  "Tumbes-la cruz tumbes": 24.00,
  "Tumbes-zorritos": 24.00,
  "Tumbes-zarumilla": 24.00,
  "Tumbes-aguas verdes": 24.00,


  // ucayali
  "Ucayali-calleria jr jose galvez": 20.00,
  "Ucayali-calleria av saenz peña": 20.00,
  "Ucayali-pucallpa co federico basadre": 20.00,
  "Ucayali-yarinacocha centro": 22.00,
  "Uucayali-yarinacocha av universitaria": 20.00,
  "Ucayali-manantay av aguaytia": 20.00,
  "Ucayali-manantay av tupac amaru": 20.00,
  "Ucayali-aguaytía": 19.00,

};

/* ===== INFO DE ENVÍOS SHALOM (tiempo + modalidad) ===== */
const PROVINCE_INFO = {
  /*"Amazonas":        { days: 2, mode: "Terrestre" },*/
  "Amazonas-Chachapoyas co dos de Mayo": { days: 2, mode: "Terrestre" },
  "Amazonas-Chachapoyas Jr Grau":        { days: 2, mode: "Terrestre" },
  "Amazonas-Bagua Capital":   { days: 2, mode: "Terrestre" },
  "Amazonas-Pedro Ruiz":      { days: 2, mode: "Terrestre" },
  "Amazonas-Luya":            { days: 2, mode: "Terrestre" },
  "Amazonas-Bagua Grande":    { days: 2, mode: "Terrestre" },
  "Amazonas-Tingo Maria":     { days: 1, mode: "Terrestre" },
  "Amazonas-Yurimaguas":      { days: 1, mode: "Terrestre" },

  /*"Áncash":          { days: 1, mode: "Terrestre" },*/
  "Áncash-Huaraz":          { days: 1, mode: "Terrestre" },
  "Áncash-Carhuaz":         { days: 1, mode: "Terrestre" },
  "Áncash-Casma":           { days: 1, mode: "Terrestre" },
  "Áncash-Huarmey":         { days: 1, mode: "Terrestre" },
  "Áncash-Caraz":           { days: 1, mode: "Terrestre" },
  "Áncash-Av Enrique Meiggs": { days: 1, mode: "Terrestre" },
  "Áncash-Av Jose Galvez":    { days: 1, mode: "Terrestre" },
  "Áncash-Av Los Pescadores Co": { days: 1, mode: "Terrestre" },
  "Áncash-Santa":           { days: 1, mode: "Terrestre" },
  "Áncash-Ovalo de la Familia": { days: 1, mode: "Terrestre" },
  "Áncash-Tres de Octubre": { days: 1, mode: "Terrestre" },
  "Áncash-Garatea":         { days: 1, mode: "Terrestre" },
  "Áncash-Av Pacífico Belen": { days: 1, mode: "Terrestre" },
  "Áncash-Yungai":          { days: 1, mode: "Terrestre" },

  /*"Apurímac":        { days: 2, mode: "Terrestre" },*/
  "Apurimac-Abancay":         { days: 2, mode: "Terrestre" },
  "Apurimac-Andahuaylas":     { days: 2, mode: "Terrestre" },

  /*"Arequipa": 40.00,*/
  "Arequipa-Av Parra 379 CO":  { days: 2, mode: "Terrestre" },
  "Arequipa-Av Lima":  { days: 2, mode: "Terrestre" },
  "Arequipa-Av Augusto Salazar Bondy": { days: 2, mode: "Terrestre" },
  "Arequipa-Plaza La Tomilla": { days: 2, mode: "Terrestre" },
  "Arequipa-Av Charcani": { days: 2, mode: "Terrestre" },
  "Arequipa-Asoc Las Flores-Av 54": { days: 2, mode: "Terrestre" },
  "Arequipa-Av Pumacahua": { days: 2, mode: "Terrestre" },
  "Arequipa-Zamacola": { days: 2, mode: "Terrestre" },
  "Arequipa-Av Los Incas": { days: 2, mode: "Terrestre" },
  "Arequipa-Autopista La Joya": { days: 2, mode: "Terrestre" },
  "Arequipa-Asoc. Nuevo Horizonte-Av.54": { days: 2, mode: "Terrestre" },
  "Arequipa-Jacobo Hunter": { days: 2, mode: "Terrestre" },
  "Arequipa-El Creuce La Joya": { days: 2, mode: "Terrestre" },
  "Arequipa-Mariano Melgar": { days: 2, mode: "Terrestre" },
  "Arequipa-Miraflores Arequipa": { days: 2, mode: "Terrestre" },
  "Arequipa-Urb Manuel Prado": { days: 2, mode: "Terrestre" },
  "Arequipa-Av Jesus": { days: 2, mode: "Terrestre" },
  "Arequipa-Av Socabaya-Los Toritos": { days: 2, mode: "Terrestre" },
  "Arequipa-Av. Horacio Zevallos": { days: 2, mode: "Terrestre" },
  "Arequipa-Huchumayo": { days: 2, mode: "Terrestre" },
  "Arequipa-Yura": { days: 2, mode: "Terrestre" },
  "Arequipa-Camana": { days: 2, mode: "Terrestre" },
  "Arequipa-Chala": { days: 2, mode: "Terrestre" },
  "Arequipa-Majes Pedregal": { days: 2, mode: "Terrestre" },
  "Arequipa-Mollendo Co": { days: 2, mode: "Terrestre" },
  "Arequipa-Cercado Mollendo": { days: 2, mode: "Terrestre" },
  "Arequipa-Cocachacra": { days: 2, mode: "Terrestre" },
  "Arequipa-Matarani": { days: 2, mode: "Terrestre" },


 /*"Ayacucho": 46.00,*/
  "Ayacucho-Ayacucho Co":  { days: 1, mode: "Terrestre" },
  "Ayacucho-Ayacucho Carmen Alto":  { days: 1, mode: "Terrestre" },
  "Ayacucho-Ayacucho Jesús Nazareno": { days: 1, mode: "Terrestre" },
  "Ayacucho-Huanta": { days: 1, mode: "Terrestre" },

  /*"Cajamarca": 44.00,*/
  "Cajamarca-Cajamarca CO": { days: 2, mode: "Terrestre" },
  "Cajamarca-Cajamarca Horacion Zevallos": { days: 2, mode: "Terrestre" },
  "Cajamarca-Barrio San Jose": { days: 2, mode: "Terrestre" },
  "Cajamarca-Huambocancha Baja": { days: 2, mode: "Terrestre" },
  "Cajamarca-Huaraclla": { days: 2, mode: "Terrestre" },
  "Cajamarca-Baños del Inca": { days: 2, mode: "Terrestre" },
  "Cajamarca-Cajabamba": { days: 2, mode: "Terrestre" },
  "Cajamarca-Celendin": { days: 2, mode: "Terrestre" },
  "Cajamarca-Chota": { days: 2, mode: "Terrestre" },
  "Cajamarca-Chilete": { days: 2, mode: "Terrestre" },
  "Cajamarca-Tembladera Cajamarca": { days: 2, mode: "Terrestre" },
  "Cajamarca-Cutervo": { days: 2, mode: "Terrestre" },
  "Cajamarca-Bambamarca": { days: 2, mode: "Terrestre" },
  "Cajamarca-Jaen": { days: 3, mode: "Terrestre" },
  "Cajamarca-San Ignacio": { days: 3, mode: "Terrestre" },
  "Cajamarca-San Marcos": { days: 2, mode: "Terrestre" },
  "Cajamarca-San Miguel Cajamarca": { days: 2, mode: "Terrestre" },
  "Cajamarca-San Pablo Cajamarca": { days: 2, mode: "Terrestre" },

  /*"Cusco": 48.00,*/
  "Cusco-Tica Tica": { days: 2, mode: "Terrestre" },
  "Cusco-San Jeronimo": { days: 2, mode: "Terrestre" },
  "Cusco-Cachimayo-San Sebastián": { days: 2, mode: "Terrestre" },
  "Cusco-Via Expresa Sur": { days: 2, mode: "Terrestre" },
  "Cusco-Av Antonio Lorena": { days: 2, mode: "Terrestre" },
  "Urb Bancopata Av Industrial": { days: 2, mode: "Terrestre" },
  "Cusco-Cusco CO Parque Industrial": { days: 2, mode: "Terrestre" },
  "Cusco-Av Pachacútec": { days: 2, mode: "Terrestre" },
  "Cusco-Velasco Astete": { days: 2, mode: "Terrestre" },
  "Cusco-Anta Izcuchaca": { days: 2, mode: "Terrestre" },
  "Cusco-Cusco Calca": { days: 2, mode: "Terrestre" },
  "Cusco-Pisac": { days: 2, mode: "Terrestre" },
  "Cusco-Sicuani CO Ovalo San Andres": { days: 3, mode: "Terrestre" },
  "Cusco-Sicuani Av Manuel Callo": { days: 3, mode: "Terrestre" },
  "Cusco-Combapata": { days: 3, mode: "Terrestre" },
  "Cusco-Santo Tomas": { days: 2, mode: "Terrestre" },
  "Cusco-Espinar": { days: 3, mode: "Terrestre" },
  "Cusco-Quillabamba": { days: 2, mode: "Terrestre" },
  "Cusco-Urcos": { days: 2, mode: "Terrestre" },
  "Cusco-Oropesa": { days: 2, mode: "Terrestre" },
  "Cusco-Cusco Urubamba": { days: 2, mode: "Terrestre" },
  "Cusco-Chinchero": { days: 2, mode: "Terrestre" },

  /*"Huánuco": 44.00,*/
  "Huánuco-Jr Aguilar": { days: 2, mode: "Terrestre" },
  "Huánuco-Amarilis CO": { days: 2, mode: "Terrestre" },
  "Huánuco-Ambo": { days: 2, mode: "Terrestre" },
  "Huánuco-Tingo Maria CO Buenos Aires": { days: 1, mode: "Terrestre" },
  "Huánuco-Tingo Maria-Amazonas": { days: 1, mode: "Terrestre" },
  "Huánuco-Aucayacu": { days: 2, mode: "Terrestre" },

  /*"Ica": 44.00,*/
  "Ica-Ica San Joaquín": { days: 1, mode: "Terrestre" },
  "Ica-Ica Av. JJ Elías": { days: 1, mode: "Terrestre" },
  "Ica-Ica Urb. Manzanilla": { days: 1, mode: "Terrestre" },
  "Ica-La Tinguiña": { days: 1, mode: "Terrestre" },
  "Ica-Parcona": { days: 1, mode: "Terrestre" },
  "Ica-Salas Ica": { days: 1, mode: "Terrestre" },
  "Ica-Ica Santiago": { days: 1, mode: "Terrestre" },
  "Ica-Ica Subtanjalla CO": { days: 1, mode: "Terrestre" },
  "Ica-Prolong Luis Massaro": { days: 1, mode: "Terrestre" },
  "Ica-Calle Los Ángeles": { days: 1, mode: "Terrestre" },
  "Ica-Chincha Pueblo Nuevo": { days: 1, mode: "Terrestre" },
  "Ica-Sunampe CO": { days: 1, mode: "Terrestre" },
  "Ica-Nazca": { days: 1, mode: "Terrestre" },
  "Ica-San Juan de Marcona": { days: 1, mode: "Terrestre" },
  "Av Abraham Valdelomar CO": { days: 1, mode: "Terrestre" },
  "Ica-La Villa Cruce Pisco": { days: 1, mode: "Terrestre" },
  "Ica-San Clemente": { days: 1, mode: "Terrestre" },

  /* ================= JUNÍN ================= */
  "Junín-Huancayo JR. Ica": { days: 1, mode: "Terrestre" },
  "Junín-Terminal Los Andes": { days: 1, mode: "Terrestre" },
  "Junín-San Carlos Huancayo": { days: 1, mode: "Terrestre" },
  "Junín-Chilca Huancayo": { days: 1, mode: "Terrestre" },
  "Junín-Av Mariscal Castilla CO Parque Industrial": { days: 1, mode: "Terrestre" },
  "Junín-Pio Pata": { days: 1, mode: "Terrestre" },
  "Junín-Av Circunvalación Cruce con Mariátegui": { days: 1, mode: "Terrestre" },
  "Junín-Ciudad Universitaria": { days: 1, mode: "Terrestre" },
  "Junín-Pilcomayo": { days: 1, mode: "Terrestre" },
  "Junín-San Agustin de Cajas": { days: 1, mode: "Terrestre" },
  "Junín-Concepción": { days: 1, mode: "Terrestre" },
  "Junín-La Merced": { days: 1, mode: "Terrestre" },
  "Junín-Perene": { days: 1, mode: "Terrestre" },
  "Junín-Pichanaki": { days: 1, mode: "Terrestre" },
  "Junín-San Ramón": { days: 1, mode: "Terrestre" },
  "Junín-Jauja": { days: 1, mode: "Terrestre" },
  "Junín-Satipo": { days: 1, mode: "Terrestre" },
  "Junín-Mazamari": { days: 2, mode: "Terrestre" },
  "Junín-Tarma": { days: 1, mode: "Terrestre" },
  "Junín-La Oroya": { days: 1, mode: "Terrestre" },
  "Junín-Chupaca": { days: 1, mode: "Terrestre" },

  /* ================= La Libertad ================= */
  "La Libertad-Calle Liverpool": { days: 1, mode: "Terrestre" },
  "La Libertad-Trujillo la Perla": { days: 1, mode: "Terrestre" },
  "La Libertad-Atahualpa": { days: 1, mode: "Terrestre" },
  "La Libertad-Calle Santa Cruz-America Sur": { days: 1, mode: "Terrestre" },
  "La Libertad-Av hnos Uceda-America Norte": { days: 1, mode: "Terrestre" },
  "La Libertad-Ovalo Papal": { days: 1, mode: "Terrestre" },
  "La Libertad-Av Hermanos Angulo": { days: 1, mode: "Terrestre" },
  "La Libertad-Alto Trujillo": { days: 1, mode: "Terrestre" },
  "La Libertad-Av. Las Magnolias": { days: 1, mode: "Terrestre" },
  "La Libertad-Jr. Cahuide": { days: 1, mode: "Terrestre" },
  "La Libertad-Ovalo Huanchaco CO": { days: 1, mode: "Terrestre" },
  "La Libertad-El Milagro": { days: 1, mode: "Terrestre" },
  "La Libertad-Av Tahuantinsuyo": { days: 1, mode: "Terrestre" },
  "La Libertad-Wichanzao": { days: 1, mode: "Terrestre" },
  "La Libertad-Moche": { days: 1, mode: "Terrestre" },
  "La Libertad-Av Larco": { days: 1, mode: "Terrestre" },
  "La Libertad-Paiján": { days: 1, mode: "Terrestre" },
  "La Libertad-Casa Grande": { days: 1, mode: "Terrestre" },
  "La Libertad-Chepen": { days: 1, mode: "Terrestre" },
  "La Libertad-Pacanguilla": { days: 2, mode: "Terrestre" },
  "La Libertad-Otuzco": { days: 1, mode: "Terrestre" },
  "La Libertad-San Pedro De Lloc": { days: 1, mode: "Terrestre" },
  "La Libertad-Ciudad de Dios": { days: 1, mode: "Terrestre" },
  "La Libertad-Guadalupe La Libertad": { days: 1, mode: "Terrestre" },
  "La Libertad-Pacasmayo Las Palmeras": { days: 1, mode: "Terrestre" },
  "La Libertad-Pacasmayo Centro": { days: 1, mode: "Terrestre" },
  "La Libertad-Puente Viru": { days: 1, mode: "Terrestre" },
  "La Libertad-Viru Centro": { days: 1, mode: "Terrestre" },
  "La Libertad-Chao": { days: 1, mode: "Terrestre" },

  /*"Lambayeque": 36.00,*/
  "Lambayeque-Miraflores Chiclayo": { days: 2, mode: "Terrestre" },
  "Lambayeque-Mariscal Nieto": { days: 2, mode: "Terrestre" },
  "Lambayeque-Av Las Américas": { days: 2, mode: "Terrestre" },
  "Lambayeque-Chongoyape": { days: 2, mode: "Terrestre" },
  "Calle Tahuantinsuyo": { days: 2, mode: "Terrestre" },
  "Lambayeque-Av Balta Cdra. 36": { days: 2, mode: "Terrestre" },
  "Lambayeque-Av Victor R. Haya CO": { days: 2, mode: "Terrestre" },
  "Lambayeque-Monsefú": { days: 2, mode: "Terrestre" },
  "Lambayeque-Pimentel": { days: 2, mode: "Terrestre" },
  "Lambayeque-Reque": { days: 2, mode: "Terrestre" },
  "Lambayeque-Tuman": { days: 2, mode: "Terrestre" },
  "Lambayeque-Ferreñafe": { days: 2, mode: "Terrestre" },
  "Lambayeque-Lambayeque Panamericana": { days: 2, mode: "Terrestre" },
  "Lambayeque-Lambayeque Centro": { days: 2, mode: "Terrestre" },
  "Lambayeque-Jayanca": { days: 2, mode: "Terrestre" },
  "Lambayeque-Morrope": { days: 2, mode: "Terrestre" },
  "Lambayeque-Motupe": { days: 2, mode: "Terrestre" },
  "Lambayeque-Olmos": { days: 2, mode: "Terrestre" },
  "Lambayeque-Túcume": { days: 2, mode: "Terrestre" },

  /* Loreto */
  "Loreto-Iquitos Jr Francisco Bolognesi": { days: 10, mode: "Terrestre" },
  "Loreto-Iquitos Co Jr. Pablo Rossell": { days: 10, mode: "Terrestre" },
  "Loreto-Iquitos Av Tupac Amaru": { days: 4, mode: "Terrestre" },
  "Loreto-Punchana": { days: 4, mode: "Terrestre" },
  "Loreto-Av Participación Parcela": { days: 4, mode: "Terrestre" },
  "Loreto-Av Jose A. Quiñones": { days: 4, mode: "Terrestre" },
  "Loreto-Yurimaguas": { days: 2, mode: "Terrestre" },

  /* Madre de Dios */
  "Madre de Dios-Tambopata Av La Joya CO": { days: 3, mode: "Terrestre" },
  "Madre de Dios-Jr.Jaime Troncoso": { days: 3, mode: "Terrestre" },
  "Madre de Dios-Tambopata Av Circunvalación": { days: 3, mode: "Terrestre" },
  "Madre de Dios-Mazuko": { days: 3, mode: "Terrestre" },
  "Madre de Dios-El Triunfo": { days: 3, mode: "Terrestre" },
  "Madre de Dios-Iberia": { days: 3, mode: "Terrestre" },

  /* Moquegua */
  "Moquegua-San Antonio": { days: 2, mode: "Terrestre" },
  "Moquegua-Calle Lima": { days: 2, mode: "Terrestre" },
  "Moquegua-Quebrada Las Lechuzas CO": { days: 2, mode: "Terrestre" },
  "Moquegua-Chen Chen": { days: 2, mode: "Terrestre" },
  "Moquegua-Ilo Co Pampa Inalámbrica": { days: 2, mode: "Terrestre" },
  "Moquegua-Ilo Puerto": { days: 2, mode: "Terrestre" },

  /* Pasco */
  "Pasco-Cerro de Pasco": { days: 1, mode: "Terrestre" },
  "Pasco-Huayllay": { days: 1, mode: "Terrestre" },
  "Pasco-Oxapampa": { days: 1, mode: "Terrestre" },
  "Pasco-Villa Rica": { days: 1, mode: "Terrestre" },

  // Piura
  "Piura-av. luis eguiguren": { days: 2, mode: "Terrestre" },
  "Piura-av. grau": { days: 2, mode: "Terrestre" },
  "Piura-av raul mata la cruz- dos grifos": { days: 2, mode: "Terrestre" },
  "Piura-av tacna": { days: 2, mode: "Terrestre" },
  "Piura-tacala": { days: 2, mode: "Terrestre" },
  "Piura-catacaos": { days: 2, mode: "Terrestre" },
  "Piura-la union": { days: 2, mode: "Terrestre" },
  "Piura-las lomas": { days: 2, mode: "Terrestre" },
  "Piura-tambo grande": { days: 2, mode: "Terrestre" },
  "Piura-calle emaús": { days: 2, mode: "Terrestre" },
  "Piura-parque industrial co piura futura": { days: 2, mode: "Terrestre" },
  "Piura-av. gullman": { days: 2, mode: "Terrestre" },
  "Piura-aahh santa rosa piura": { days: 2, mode: "Terrestre" },
  "Piura-ayabaca": { days: 2, mode: "Terrestre" },
  "Piura-paimas": { days: 2, mode: "Terrestre" },
  "Piura-huancabamba": { days: 2, mode: "Terrestre" },
  "Piura-chulucanas": { days: 2, mode: "Terrestre" },
  "Piura-morropon": { days: 2, mode: "Terrestre" },
  "Piura-paita": { days: 2, mode: "Terrestre" },
  "Piura-sullana santa rosa": { days: 2, mode: "Terrestre" },
  "Piura-sullana co zona industrial": { days: 2, mode: "Terrestre" },
  "Piura-bellavista sullana": { days: 2, mode: "Terrestre" },
  "Piura-ignacio escudero": { days: 2, mode: "Terrestre" },
  "Piura-talara co asoc california": { days: 2, mode: "Terrestre" },
  "Piura-talara alta 9 de octubre": { days: 2, mode: "Terrestre" },
  "Piura-talara baja parque22": { days: 2, mode: "Terrestre" },
  "Piura-el alto": { days: 2, mode: "Terrestre" },
  "Piura-los organos": { days: 2, mode: "Terrestre" },
  "Piura-máncora": { days: 2, mode: "Terrestre" },
  "Piura-sechura": { days: 2, mode: "Terrestre" },

  // Puno
  "Puno-av costanera": { days: 2, mode: "Terrestre" },
  "Puno-salcedo": { days: 2, mode: "Terrestre" },
  "Puno-alto puno": { days: 2, mode: "Terrestre" },
  "Puno-azangaro": { days: 2, mode: "Terrestre" },
  "Puno-desaguadero": { days: 2, mode: "Terrestre" },
  "Puno-ilave": { days: 2, mode: "Terrestre" },
  "Puno-ayaviri": { days: 2, mode: "Terrestre" },
  "Puno-juliaca san santiago": { days: 2, mode: "Terrestre" },
  "Puno-av. huancane cdra.9": { days: 2, mode: "Terrestre" },
  "Puno-las mercedes": { days: 2, mode: "Terrestre" },
  "Puno-av. lampa": { days: 2, mode: "Terrestre" },
  "Puno-av. modesto borda": { days: 2, mode: "Terrestre" },
  "Puno-av independencia": { days: 2, mode: "Terrestre" },
  "Puno-jr agustin gamarra": { days: 2, mode: "Terrestre" },
  "Puno-av heroes del pacifico co": { days: 2, mode: "Terrestre" },

  // San Martín
  "San martín-moyobamba centro": { days: 2, mode: "Terrestre" },
  "San martín-soritor": { days: 2, mode: "Terrestre" },
  "San martín-san martin bellavista": { days: 2, mode: "Terrestre" },
  "San martín-san jose de sisa": { days: 2, mode: "Terrestre" },
  "San martín-lamas": { days: 2, mode: "Terrestre" },
  "San martín-juanjui fernando belaunde terry co": { days: 2, mode: "Terrestre" },
  "San martín-juanjui centro": { days: 2, mode: "Terrestre" },
  "San martín-picota": { days: 2, mode: "Terrestre" },
  "San martín-rioja": { days: 2, mode: "Terrestre" },
  "San martín-nueva cajamarca": { days: 2, mode: "Terrestre" },
  "San martín-pardo miguel naranjos": { days: 3, mode: "Terrestre" },
  "San martín-tarapoto co jr alfonso ugarte": { days: 2, mode: "Terrestre" },
  "San martín-jr leoncio prado": { days: 2, mode: "Terrestre" },
  "San martín-jr. tahuantinsuyo": { days: 2, mode: "Terrestre" },
  "San martín-jr. ramón castilla": { days: 2, mode: "Terrestre" },
  "San martín-tarapoto la banda de shilcayo": { days: 2, mode: "Terrestre" },
  "San martín-tarapoto jr. sargento lorez": { days: 2, mode: "Terrestre" },
  "San martín-av fernando belaunde": { days: 1, mode: "Terrestre" },
  "San martín-jr fredy aliaga co": { days: 1, mode: "Terrestre" },
  "San martín-uchiza": { days: 1, mode: "Terrestre" },

  // Tacna
  "Tacna-av tacna": { days: 2, mode: "Terrestre" },
  "Tacna-tacna co av. jorge basadre": { days: 2, mode: "Terrestre" },
  "Tacna-av vigil": { days: 2, mode: "Terrestre" },
  "Tacna-av. arias araguez": { days: 2, mode: "Terrestre" },
  "Tacna-av ejercito": { days: 2, mode: "Terrestre" },
  "Tacna-pocollay": { days: 2, mode: "Terrestre" },
  "Tacna-tacna ciudad nueva": { days: 2, mode: "Terrestre" },
  "Tacna-villa san francisco": { days: 2, mode: "Terrestre" },
  "Tacna-av. municipal": { days: 2, mode: "Terrestre" },

  // Tumbes
  "Tumbes-tumbes - av arica": { days: 3, mode: "Terrestre" },
  "Tumbes-tumbes puyango": { days: 3, mode: "Terrestre" },
  "Tumbes-tumbes co - panamericana norte km 2360": { days: 3, mode: "Terrestre" },
  "Tumbes-pampa grande tumbes": { days: 3, mode: "Terrestre" },
  "Tumbes-corrales": { days: 3, mode: "Terrestre" },
  "Tumbes-la cruz tumbes": { days: 3, mode: "Terrestre" },
  "Tumbes-zorritos": { days: 3, mode: "Terrestre" },
  "Tumbes-zarumilla": { days: 3, mode: "Terrestre" },
  "Tumbes-aguas verdes": { days: 3, mode: "Terrestre" },

  // Ucayali
  "Ucayali-calleria jr jose galvez": { days: 2, mode: "Terrestre" },
  "Ucayali-calleria av saenz peña": { days: 1, mode: "Terrestre" },
  "Ucayali-pucallpa co federico basadre": { days: 2, mode: "Terrestre" },
  "Ucayali-yarinacocha centro": { days: 2, mode: "Terrestre" },
  "Ucayali-yarinacocha av universitaria": { days: 1, mode: "Terrestre" },
  "Ucayali-manantay av aguaytia": { days: 1, mode: "Terrestre" },
  "Ucayali-manantay av tupac amaru": { days: 1, mode: "Terrestre" },
  "Ucayali-aguaytía": { days: 1, mode: "Terrestre" },




};

// Tarifas fijas para pickup / delivery (Lima domicilio)
const FEES = { pickup: 0, delivery: 15.00 };

// Lista de departamentos a utilizar en selects
const PERU_DEPTS = Object.keys(PROVINCE_FEES);

/* ===== DOM refs ===== */
const $pickup   = document.getElementById('coShipPickup');
const $delivery = document.getElementById('coShipDelivery');
const $province = document.getElementById('coShipProvince');

const $coSub  = document.getElementById('coSubtotal');
const $coShip = document.getElementById('coShipFee');
const $coTot  = document.getElementById('coTotal');
const $coItems = document.getElementById('coItems');

const $addr = document.getElementById('cfAddress');
const $ref  = document.getElementById('cfRef');
const $dist = document.getElementById('cfDistrict');
const $city = document.getElementById('cfCity');
const $dept = document.getElementById('cfDept');
const $ctry = document.getElementById('cfCountry');

/* ===== Modal / Pago refs ===== */
const $payBtnMain = document.querySelector('#checkoutSummary #checkoutPayBtn');
const $payModal   = document.getElementById('payModal');
const $pmBackdrop = document.getElementById('payBackdrop');
const $pmClose    = document.getElementById('pmClose');
const $pmCancel   = document.getElementById('pmCancel');
const $pmConfirm  = $payModal?.querySelector('#checkoutPayBtn');

// Totales en modal
const $pmSub  = document.getElementById('pmSub');
const $pmShip = document.getElementById('pmShip');
const $pmTot  = document.getElementById('pmTot');

// Métodos y cajas
const $pmBCP       = document.getElementById('pmBCP');
const $pmYapePlin  = document.getElementById('pmYapePlin');
const $pmBoxBCP    = document.getElementById('pmBoxBCP');
const $pmBoxYP     = document.getElementById('pmBoxYapePlin');

// Espacios dinámicos (ID de pedido + confianza)
let $pmOrderId = null;
let $pmTrustBox = null;

/* ===== Distritos Lima Metropolitana ===== */
const LIMA_DISTRICTS = [
  'Ancón','Ate','Barranco','Breña','Carabayllo','Chaclacayo','Chorrillos',
  'Cieneguilla','Comas','El Agustino','Independencia','Jesús María','La Molina',
  'La Victoria','Lince','Los Olivos','Lurigancho (Chosica)','Lurín','Magdalena del Mar',
  'Miraflores','Pachacámac','Pucusana','Pueblo Libre','Puente Piedra','Punta Hermosa',
  'Punta Negra','Rímac','San Bartolo','San Borja','San Isidro','San Juan de Lurigancho',
  'San Juan de Miraflores','San Luis','San Martín de Porres','San Miguel',
  'Santa Anita','Santa María del Mar','Santa Rosa','Santiago de Surco','Surquillo',
  'Villa El Salvador','Villa María del Triunfo'
];

/* ===== UI helpers ===== */
function setDisabled(el, disabled, {dim=true, requiredIfEnabled=false}={}) {
  if(!el) return;
  el.disabled = !!disabled;
  if (requiredIfEnabled) el.required = !disabled;
  const row = el.closest('.form-row, .form-group, .grid, .field, label') || el;
  if (row && dim) row.style.opacity = disabled ? '.55' : '1';
}
function resetSelect(selectEl, placeholder){
  if (!selectEl) return;
  selectEl.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = placeholder || 'Selecciona una opción';
  selectEl.appendChild(opt);
  selectEl.value = '';
}
function fillLimaDistricts(){
  if (!$dist) return;
  resetSelect($dist, 'Seleccione un distrito');
  LIMA_DISTRICTS.forEach(d => {
    const o = document.createElement('option');
    o.value = d; o.textContent = d;
    $dist.appendChild(o);
  });
}
function fillProvinceDepartments(){
  if (!$dept) return;
  resetSelect($dept, 'Selecciona tu departamento');
  PERU_DEPTS.forEach(d=>{
    const o = document.createElement('option');
    o.value = d; o.textContent = d;
    $dept.appendChild(o);
  });
  $dept.dataset.mode = 'province';
}
function setDeptAsLimaMetropolitana(){
  if (!$dept) return;
  resetSelect($dept, 'Departamento');
  const o = document.createElement('option');
  o.value = 'Lima Metropolitana';
  o.textContent = 'Lima Metropolitana';
  $dept.appendChild(o);
  $dept.value = o.value;
  $dept.dataset.mode = 'lima';
}

/* ===== Subtotales / items ===== */
function calcSubtotal(){
  const items = cartGet();
  return items.reduce((acc, it)=> acc + (Number(it.price)||0)*(Number(it.qty)||0), 0);
}

/* ===== Helper preview: resuelve rutas relativas para imágenes ===== */
function resolveAsset(url){
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = location.href.replace(/[^/]+$/, '');
  try { return new URL(url, base).href; } catch { return url; }
}

/* ===== Items con miniatura ===== */
function renderItems(){
  if(!$coItems) return;
  const items = cartGet();
  $coItems.innerHTML = '';

  items.forEach(it => {
    const li = document.createElement('li');
    li.className = 'flex items-center gap-3';

    li.innerHTML = `
      <div class="w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10">
        <img class="w-full h-full object-cover block" alt="">
      </div>
      <div class="flex-1">
        <div class="font-medium">${it.title || 'Producto'}</div>
        <div class="text-xs opacity-70">${it.size||''} · x${it.qty||1}</div>
      </div>
      <div class="font-semibold">${money((Number(it.price)||0)*(Number(it.qty)||0))}</div>
    `;

    const img = li.querySelector('img');
    const box = li.firstElementChild;
    const src = resolveAsset(it.image || it.thumb || it.thumbnail);

    if (src){
      img.src = src;
      img.onerror = function(){
        this.remove();
        box.style.background = 'linear-gradient(135deg,#1f2937,#0f172a)';
      };
    } else {
      img.remove();
      box.style.background = 'linear-gradient(135deg,#1f2937,#0f172a)';
    }

    $coItems.appendChild(li);
  });
}

/* ===== Totales ===== */
// obtiene tarifa según departamento (usa PROVINCE_FEES)
function feeForDept(deptText){
  if (!deptText) return 0;
  // normalizar acentos/spaces si quieres; aquí usamos la clave exacta
  return Number(PROVINCE_FEES[deptText] ?? 0);
}
function renderTotals(){
  const s   = shipGet();
  const sub = calcSubtotal();
  const fee = Number(s.fee)||0;
  const tot = sub + fee;

  if ($coSub)  $coSub.textContent  = money(sub);
  if ($coShip) $coShip.textContent = fee > 0 ? money(fee) : 'Gratis';
  if ($coTot)  $coTot.textContent  = money(tot);

  // ===== NUEVO: mostrar tiempo + modalidad Shalom =====
  const extraBox = document.getElementById('coShipExtra');
  if(extraBox){
    if (s.code === "province" && s.dept && PROVINCE_INFO[s.dept]){
      const info = PROVINCE_INFO[s.dept];
      extraBox.innerHTML =
        `⏳ Llega en: <b>${info.days} día(s)</b><br>` +
        `🚚 Modalidad: <b>${info.mode}</b>`;
    } else {
      extraBox.innerHTML = "";
    }
  }
}


/* ============================================================
   AUTORRELLENO PARA ENVÍOS A PROVINCIA
   ============================================================ */
function autoFillProvinceFields(){
  if(!$city || !$addr || !$dept) return;
  const d = $dept.value || '';
  $city.value = "Agencia Shalom";
  $addr.value = "Recojo en agencia Shalom - " + d;
}

/* ============================================================
   LIMPIEZA AUTOMÁTICA AL CAMBIAR DE MÉTODO DE ENVÍO
   ============================================================ */
function resetFormForNewShipping(){
  const fields = [
    '#cfName',
    '#cfLast',
    '#cfDni',
    '#cfEmail',
    '#cfPhone',
    '#cfAddress',
    '#cfRef',
    '#cfCity',
    '#cfDistrict'
  ];

  fields.forEach(sel=>{
    const el = document.querySelector(sel);
    if(el) el.value = '';
  });

  // Reiniciar selects
  if($dist) resetSelect($dist, 'Seleccione un distrito');
  if($city) $city.value = '';
  if($addr) $addr.value = '';
}

/* ============================================================
   BLOQUEO DE CAMPOS SEGÚN ENVÍO
   ============================================================ */
function applyFieldLocks(shipCode){
  if ($ctry){
    $ctry.value = 'Perú';
    setDisabled($ctry, true, {dim:false});
  }

  if (shipCode === 'pickup'){
    setDisabled($addr, true,  {requiredIfEnabled:true});
    setDisabled($ref,  true);
    setDisabled($dist, true);
    setDisabled($city, true);
    setDisabled($dept, true);
    resetSelect($dist, 'Seleccione un distrito');
    setDeptAsLimaMetropolitana();
  }

  else if (shipCode === 'delivery'){
    setDisabled($addr, false, {requiredIfEnabled:true});
    setDisabled($ref,  false);
    setDisabled($dist, false);
    setDisabled($city, true);
    setDisabled($dept, true);
    setDeptAsLimaMetropolitana();
    fillLimaDistricts();
  }

  else { // PROVINCIAS
    setDisabled($addr, 'Seleccione una dirección');
    setDisabled($ref,  'Seleccione una referencia');
    setDisabled($city, 'Seleccione una ciudad');
    setDisabled($dept, false, {requiredIfEnabled:true});
    setDisabled($dist, true);
    resetSelect($dist, 'Seleccione un distrito');
    fillProvinceDepartments();
    autoFillProvinceFields(); // 🔥 AUTORRELLENO AL ELEGIR PROVINCIAS
  }
}

/* ============================================================
   SELECCIÓN DE MÉTODO DE ENVÍO
   ============================================================ */
function chooseShipping(code){
  const prev = shipGet();
  let fee = 0;
  let carrier = prev.carrier || '';

  // 🔥 RESETEAR FORMULARIO AL CAMBIAR OPCIÓN
  resetFormForNewShipping();

  if (code === 'pickup'){
    fee = FEES.pickup;
    carrier = '';
  }

  else if (code === 'delivery'){
    fee = FEES.delivery;
    carrier = 'Shalom';
  }

  else if (code === 'province'){
    const dept = $dept?.value || prev.dept || '';
    fee = feeForDept(dept);
    carrier = 'Shalom';
  }

  shipSet({ code, fee, dept: ($dept?.value || prev.dept || ''), carrier });
  applyFieldLocks(code);

  if (code === 'delivery') fillLimaDistricts();
  if (code === 'province'){
    fillProvinceDepartments();
    autoFillProvinceFields(); // 🔥 AUTORRELLENO
  }

  renderTotals();
}

/* ============================================================
   CAMBIO DE DEPARTAMENTO EN PROVINCIAS
   ============================================================ */
function onDeptChange(){
  const s = shipGet();
  if (!$dept) return;
  if (s.code !== 'province') return;

  s.dept = $dept.value || '';
  s.fee  = feeForDept(s.dept);
  s.carrier = 'Shalom';
  shipSet(s);

  autoFillProvinceFields(); // 🔥 AUTORRELLENO AL CAMBIAR DPTO

  renderTotals();
}

/* ============================================================
   TOTALIZACIÓN
   ============================================================ */
function computeTotals(){
  const items = cartGet();
  const sub = items.reduce((a,b)=> a + (Number(b.price)||0)*(Number(b.qty)||0), 0);
  const ship = shipGet();
  const fee  = Number(ship.fee)||0;
  return { subtotal: sub, shipping: fee, total: sub + fee, items };
}

/* ============================================================
   LECTURA DEL FORMULARIO
   ============================================================ */
function readCheckoutForm(){
  const q = (s)=> document.querySelector(s);
  return {
    firstName: q('#cfName')?.value?.trim() || '',
    lastName:  q('#cfLast')?.value?.trim() || '',
    dni:       q('#cfDni')?.value?.trim() || '',
    email:     q('#cfEmail')?.value?.trim() || '',
    phone:     q('#cfPhone')?.value?.trim() || '',
    country:   q('#cfCountry')?.value?.trim() || 'Perú',
    dept:      q('#cfDept')?.value?.trim() || '',
    city:      q('#cfCity')?.value?.trim() || '',
    district:  q('#cfDistrict')?.value?.trim() || '',
    address:   q('#cfAddress')?.value?.trim() || '',
    reference: q('#cfRef')?.value?.trim() || '',
  };
}

/* ============================================================
   VALIDACIÓN FINAL
   ============================================================ */
function validateCheckoutForPay(){
  const ship = shipGet();
  const f = readCheckoutForm();
  const errors = [];

  if(!f.firstName) errors.push('Ingresa tu nombre.');
  if(!f.lastName)  errors.push('Ingresa tus apellidos.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errors.push('Correo inválido.');
  if(!/^\d{6,}$/.test((f.phone||'').replace(/\D/g,''))) errors.push('Ingresa tu celular.');

  if (ship.code === 'delivery'){
    if(!f.district) errors.push('Selecciona tu distrito (Lima Metropolitana).');
    if(!f.address)  errors.push('Ingresa tu dirección exacta.');
  }

  if (ship.code === 'province'){
    if(!f.dept)    errors.push('Selecciona tu departamento.');
    if(!f.city)    errors.push('Ingresa tu ciudad.');
    if(!f.address) errors.push('Ingresa tu dirección exacta.');
  }

  return { ok: errors.length===0, errors, ship, form: f };
}

/* ============================================================
   ACTUALIZAR TOTALES EN EL MODAL
   ============================================================ */
function updateModalTotals(){
  const t = computeTotals();
  const ship = shipGet();

  if ($pmSub)  $pmSub.textContent  = money(t.subtotal);
  if ($pmShip) $pmShip.textContent = t.shipping>0 ? money(t.shipping) : 'Gratis';
  if ($pmTot)  $pmTot.textContent  = money(t.total);

  const box = document.getElementById('pmShipExtra');
  if(box){
    if(ship.code === "province" && ship.dept && PROVINCE_INFO[ship.dept]){
      const info = PROVINCE_INFO[ship.dept];
      box.innerHTML =
        `⏳ Llega en: <b>${info.days} día(s)</b><br>` +
        `🚚 Modalidad: <b>${info.mode}</b>`;
    } else {
      box.innerHTML = "";
    }
  }
}


/* ====== INTEGRACIÓN WHATSAPP ====== */
const WHATSAPP_NUMBER = '51932724113';

/** Mensaje único para WhatsApp (incluye N.º de operación si lo ingresan) */
function buildWhatsAppMessage() {
  const orderId = getOrderId();
  const totals = computeTotals();
  const ship   = shipGet();
  const form   = readCheckoutForm();
  const items  = cartGet() || [];

  // método y número de operación (si fue escrito)
  const pmInput = document.querySelector('input[name="pmMethod"]:checked');
  const payMethod = pmInput?.value || ($pmBCP?.checked ? 'bcp' : 'yape/plin');
  const opBCP  = document.getElementById('pmOpBCP')?.value?.trim() || '';
  const opYape = document.getElementById('pmOpYape')?.value?.trim() || '';

  let opLine = '';
  if ((payMethod === 'bcp') && opBCP) {
    opLine = `\n*N.º de operación (BCP):* ${opBCP}`;
  } else if ((payMethod === 'yape/plin' || payMethod === 'yapeplin' || payMethod === 'yape' || payMethod === 'plin') && opYape) {
    opLine = `\n*N.º de operación (Yape/Plin):* ${opYape}`;
  }

  const envioTxt =
    ship.code === 'pickup'   ? 'Recoger en Estación de Tren San Juan (Gratis)' :
    ship.code === 'delivery' ? `Envío a domicilio (Lima Metropolitana) — vía ${ship.carrier || 'Shalom'}` :
                               `Envío a provincia (${form.dept || ship.dept || '—'}) — vía ${ship.carrier || 'Shalom'}`;

  const itemsTxt = items.map(it => {
    const lineTotal = (Number(it.price)||0) * (Number(it.qty)||0);
    return `• ${it.title} ${it.size ? `(${it.size})` : ''} ×${it.qty} — ${money(lineTotal)}`;
  }).join('\n');

  return (
`*Pedido #${orderId} — ${BUSINESS.name}*

*Cliente*
- Nombre: ${form.firstName} ${form.lastName}
- DNI: ${form.dni || '—'}
- Email: ${form.email}
- Celular: ${form.phone}

*Entrega*
- País: ${form.country || 'Perú'}
- Departamento: ${form.dept || (ship.code==='delivery' ? 'Lima Metropolitana' : '—')}
- Ciudad: ${form.city || '—'}
- Distrito: ${form.district || '—'}
- Dirección: ${form.address || '—'}
- Referencia: ${form.reference || '—'}
- Método de envío: ${envioTxt}

*Carrito*
${itemsTxt || '—'}

*Costos*
- Subtotal: ${money(totals.subtotal)}
- Envío: ${totals.shipping > 0 ? money(totals.shipping) : 'Gratis'}
- *Total: ${money(totals.total)}*

*Método de pago:* ${String(payMethod).toUpperCase()}${opLine}

*Soporte:* ${BUSINESS.supportHours}`
  );
}

function openWhatsAppWithOrder(text) {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

/* ===== Modal: apertura/cierre ===== */
function ensureModalTrustBlocks(){
  if (!$payModal) return;

  // ID de pedido bajo el título
  if (!$pmOrderId){
    $pmOrderId = document.createElement('div');
    $pmOrderId.id = 'pmOrderId';
    $pmOrderId.className = 'text-sm opacity-80 mb-2';
    const header = $payModal.querySelector('header') || $payModal.firstElementChild;
    header && header.insertAdjacentElement('afterend', $pmOrderId);
  }
  $pmOrderId.textContent = `ID de pedido: ${getOrderId()}`;

  // Caja confianza/políticas
  if (!$pmTrustBox){
    $pmTrustBox = document.createElement('div');
    $pmTrustBox.id = 'pmTrustBox';
    $pmTrustBox.className = 'mt-3 text-xs opacity-80';
    const btnRow = $payModal.querySelector('.flex.items-center.justify-end') 
                || $payModal.querySelector('.flex.gap-2.justify-end') 
                || $payModal.lastElementChild;
    btnRow && btnRow.insertAdjacentElement('beforebegin', $pmTrustBox);
  }
  const links = [];
  if (BUSINESS.policies.changes)  links.push(`<a class="underline" href="${BUSINESS.policies.changes}" target="_blank" rel="noopener">Cambios y devoluciones</a>`);
  if (BUSINESS.policies.delivery) links.push(`<a class="underline" href="${BUSINESS.policies.delivery}" target="_blank" rel="noopener">Tiempos de entrega</a>`);
  if (BUSINESS.policies.privacy)  links.push(`<a class="underline" href="${BUSINESS.policies.privacy}" target="_blank" rel="noopener">Privacidad</a>`);
  $pmTrustBox.innerHTML = `
    <div><b>${BUSINESS.legal}</b> · Soporte: ${BUSINESS.supportHours}</div>
    <div class="mt-1">Al confirmar, se abrirá WhatsApp con el detalle de tu pedido para validar el pago.</div>
    ${links.length ? `<div class="mt-1 space-x-2">${links.join(' · ')}</div>` : ''}
  `;
}
function openPayModal(){
  updateModalTotals();
  ensureModalTrustBlocks();
  if ($pmBCP?.checked){ $pmBoxBCP.classList.remove('hidden'); $pmBoxYP.classList.add('hidden'); }
  else { $pmBoxBCP.classList.add('hidden'); $pmBoxYP.classList.remove('hidden'); }
  $pmBackdrop.classList.remove('hidden');
  $payModal.style.opacity = '1';
  $payModal.style.pointerEvents = 'auto';
  document.body.classList.add('noscroll');
}
function closePayModal(){
  $pmBackdrop.classList.add('hidden');
  $payModal.style.opacity = '0';
  $payModal.style.pointerEvents = 'none';
  document.body.classList.remove('noscroll');
}

/* ===== Wiring inicial ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  const s = shipGet();

  if ($pickup)   $pickup.checked   = (s.code === 'pickup');
  if ($delivery) $delivery.checked = (s.code === 'delivery');
  if ($province) $province.checked = (s.code === 'province');

  if (s.code === 'province'){
    fillProvinceDepartments();
    if ($dept && s.dept) $dept.value = s.dept;
  } else {
    setDeptAsLimaMetropolitana();
  }
  if (s.code === 'delivery') fillLimaDistricts();

  applyFieldLocks(s.code);
  renderItems();
  renderTotals();

  if ($payBtnMain) $payBtnMain.textContent = 'Confirmar pedido y abrir WhatsApp';

  $pickup  ?.addEventListener('change', ()=> chooseShipping('pickup'));
  $delivery?.addEventListener('change', ()=> chooseShipping('delivery'));
  $province?.addEventListener('change', ()=> chooseShipping('province'));
  $dept    ?.addEventListener('change', onDeptChange);

  $payBtnMain?.addEventListener('click', (e)=>{
    e.preventDefault();
    const v = validateCheckoutForPay();
    if (!v.ok){
      alert('Corrige lo siguiente:\n\n• ' + v.errors.join('\n• '));
      return;
    }
    openPayModal();
  });

  const toggleMethod = ()=>{
    if ($pmBCP?.checked){
      $pmBoxBCP.classList.remove('hidden'); $pmBoxYP.classList.add('hidden');
    } else {
      $pmBoxBCP.classList.add('hidden'); $pmBoxYP.classList.remove('hidden');
    }
  };
  $pmBCP     ?.addEventListener('change', toggleMethod);
  $pmYapePlin?.addEventListener('change', toggleMethod);

  $pmClose ?.addEventListener('click', (e)=>{ e.preventDefault(); closePayModal(); });
  $pmCancel?.addEventListener('click', (e)=>{ e.preventDefault(); closePayModal(); });
  $pmBackdrop?.addEventListener('click', closePayModal);

  // ===== Confirmar pedido → abrir WhatsApp (guardia anti doble clic) =====
  let _sendingWA = false;
  $pmConfirm?.addEventListener('click', (e)=>{
    e.preventDefault();
    if (_sendingWA) return;

    const v = validateCheckoutForPay();
    if (!v.ok){
      alert('Corrige lo siguiente:\n\n• ' + v.errors.join('\n• '));
      return;
    }

    try {
      _sendingWA = true;
      const btn = e.target;
      const old = btn.textContent;
      btn.disabled = true; btn.textContent = 'Abriendo WhatsApp...';

      const message = buildWhatsAppMessage();
      openWhatsAppWithOrder(message);
      closePayModal();

      // resetOrderId(); // <- si quieres regenerar ID después
      // localStorage.removeItem(cartKey());
      // window.location.href = 'gracias.html';

      btn.disabled = false; btn.textContent = old;
      _sendingWA = false;
    } catch (err) {
      console.error(err);
      alert('No pudimos preparar el mensaje. Intenta nuevamente.');
      _sendingWA = false;
    }
  });
});

document.addEventListener('cart:changed', ()=>{
  renderItems();
  renderTotals();
  updateModalTotals();
});

/*==========================================CHECKOUT=================================================*/
 // Ajusta el alto del spacer a la altura real del header (incluye promo + barra)
  (function () {
    const hdr = document.querySelector('header');
    const spacer = document.getElementById('headerSpacer');

    function setSpacer() {
      if (!hdr || !spacer) return;
      spacer.style.height = hdr.offsetHeight + 'px';
    }
    if (typeof ResizeObserver !== 'undefined') {
      try { new ResizeObserver(setSpacer).observe(hdr); } catch(e){}
    }
    window.addEventListener('load', setSpacer);
    window.addEventListener('resize', setSpacer);

    // Próximo domingo para el mensaje de cierre
    const now = new Date();
    const add = ((7 - now.getDay()) % 7) || 7;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add);
    const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const label = `${dias[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${meses[d.getMonth()]}`;
    const el = document.getElementById('cutoff-date');
    if (el) el.textContent = label;
  })();


 (() => {
  const header = document.getElementById('siteHeader');
  const root = document.documentElement;

  function setHeaderHeightVar(){
    const h = header ? header.offsetHeight : 0;
    root.style.setProperty('--hdr-h', h + 'px');
  }

  // Ajusta en carga, resize y si cambia el header
  window.addEventListener('load', setHeaderHeightVar);
  window.addEventListener('resize', setHeaderHeightVar);
  if ('ResizeObserver' in window && header) {
    new ResizeObserver(setHeaderHeightVar).observe(header);
  }

  // Fecha próximo domingo
  const now = new Date();
  const add = ((7 - now.getDay()) % 7) || 7;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add);
  const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const label = `${dias[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${meses[d.getMonth()]}`;
  const el = document.getElementById('cutoff-date');
  if (el) el.textContent = label;
})();

  //ACORDEON FAQ
  (function initCheckoutFAQ(){
    const acc = document.querySelectorAll('#checkoutFAQ details');
    // Cierra los demás cuando uno se abre
    acc.forEach(d => {
      d.addEventListener('toggle', () => {
        if (d.open) acc.forEach(x => { if (x !== d) x.open = false; });
      });
    });
    // Soporte deep-link (ej: #faq-recibir)
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target && target.tagName === 'DETAILS') {
        target.open = true;
        target.scrollIntoView({behavior:'smooth', block:'start'});
      }
    }
  })();


  const accBtns = document.querySelectorAll('[data-acc-btn]');

  accBtns.forEach(btn => {
    const panel = btn.nextElementSibling;

    // Solo ocultar panel en móviles al cargar
    if (window.innerWidth < 640) {
      panel.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
    } else {
      panel.classList.remove('hidden');
      btn.setAttribute('aria-expanded', 'true');
    }

    btn.addEventListener('click', () => {
      if (window.innerWidth < 640) { // solo toggle en móviles
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', !expanded);
        panel.classList.toggle('hidden');
      }
    });
  });

  // Escucha redimensionamiento para ajustar visibilidad
  window.addEventListener('resize', () => {
    accBtns.forEach(btn => {
      const panel = btn.nextElementSibling;
      if (window.innerWidth >= 640) {
        panel.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        panel.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  });
  
