 //=================================================================================================
                                    //RESEÑAS
  //=================================================================================================

  // reseñas.js

// ===== Datos de reseñas =====
const REVIEWS = [
  {
    name: "Julian Soto",
    verified: true,
    rating: 5,
    title: "Genial",
    text: "Quedo perfecto en mi setup",
    photo: "assets/imgreview/naruto.jpeg"
  },
  {
    name: "Bryan Salazar",
    verified: true,
    rating: 5,
    title: "Se ve increible los colores",
    text: "mu yagusto con mi compra se ve genial el cuadro",
    photo: "assets/imgreview/zoro.jpeg"
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
    name: "Maria del Pilar",
    verified: true,
    rating: 5,
    title: "Me encanto",
    text: "me gustaron los colores, a la proxima comprare uno de medida mas grande",
    photo: "assets/imgreview/tanjiro.jpeg"
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
