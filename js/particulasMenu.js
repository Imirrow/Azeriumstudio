// /js/particulas.js
// Partículas reutilizables para el menú (y cualquier selector)
// Uso rápido: Particulas.attach('header .space-link', { color:'#4f46e5' })

(function (global) {
  let enabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function createParticle(x, y, o) {
    const p = document.createElement('div');
    p.className = o.className || 'particle';
    // posición con leve aleatoriedad
    p.style.left = (x + (Math.random() * o.spreadX - o.spreadX / 2)) + 'px';
    p.style.top  = (y + (Math.random() * o.spreadY - o.spreadY / 2)) + 'px';
    // tamaño y duración variables
    const s = o.minSize + Math.random() * (o.maxSize - o.minSize);
    p.style.width = p.style.height = s + 'px';
    if (o.color) p.style.background = o.color;
    p.style.animationDuration = (o.duration * (0.7 + Math.random() * 0.6)) + 's';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), (o.duration + 0.6) * 1000);
  }

  function burst(el, count = 10, opts = {}) {
    if (!enabled) return;
    const rect = el.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const x = rect.left + rect.width * Math.random();
      const y = rect.top  + rect.height * Math.random();
      createParticle(x, y, Object.assign({
        spreadX: 10, spreadY: 6,
        minSize: 4,  maxSize: 8,
        duration: 0.9, // segundos
        color: '#4f46e5', // por defecto
        className: 'particle'
      }, opts));
    }
  }

  function attach(selector = 'header .space-link', options = {}) {
    if (!enabled) return;
    const hoverN = options.hover ?? 8;
    const clickN = options.click ?? 14;
    document.querySelectorAll(selector).forEach((el) => {
      if (el.dataset.particlesBound) return; // idempotente
      el.dataset.particlesBound = '1';
      el.addEventListener('mouseenter', () => burst(el, hoverN, options));
      el.addEventListener('click',      () => burst(el, clickN, options));
      el.addEventListener('touchstart', () => burst(el, clickN, options), { passive: true });
    });
  }

  // respeta cambios en preferencias de movimiento
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener?.('change', (e) => { enabled = !e.matches; });

  global.Particulas = { attach, burst };
})(window);


// Al cargar la página (si el header ya está)
if (window.__headerReady && window.Particulas) {
  Particulas.attach('header .space-link', { color:'#4f46e5', hover:8, click:14 });
}

// Si el header llega luego (partial), vuelve a enlazar
document.addEventListener('header:ready', () => {
  if (window.Particulas) {
    Particulas.attach('header .space-link', { color:'#4f46e5', hover:8, click:14 });
  }
});
