
(function(){
  const sale = document.getElementById('saleBar');
  const root = document.documentElement;
  const HEADER_H = 72; // alto aprox. de tu header (ajústalo si cambia)

  function applyOffset(){
    const visible = sale && getComputedStyle(sale).display !== 'none';
    const h = visible ? sale.offsetHeight : 0;
    root.style.setProperty('--header-top', h + 'px');
    // Para que el contenido no quede tapado por el header fijo
    document.body.style.paddingTop = (h + HEADER_H) + 'px';
  }

  applyOffset();
  window.addEventListener('resize', applyOffset);
  if (window.ResizeObserver && sale) new ResizeObserver(applyOffset).observe(sale);

  // Opcional: si tienes un botón para cerrar la sale bar:
  window.hideSaleBar = () => { if (sale) { sale.style.display = 'none'; applyOffset(); } };
})();

(function(){
  const sale  = document.getElementById('saleBar');
  const root  = document.documentElement;
  const HEAD_H = 72; // alto aproximado del header (ajústalo si cambias su alto)

  function setLayout(saleVisible){
    const h = (sale && saleVisible) ? sale.offsetHeight : 0;
    // Mueve el header debajo de la sale bar (o al tope si está oculta)
    root.style.setProperty('--header-top', h + 'px');
    // Evita que el contenido quede tapado por el header fijo
    document.body.style.paddingTop = (HEAD_H + h) + 'px';
    if (sale) sale.classList.toggle('sale--hidden', !saleVisible);
  }

  // ---- Opción A (simple): ocultar sale bar al primer scroll y mostrar solo al volver arriba)
  let mode = 'A'; // cambia a 'B' si prefieres mostrar al desplazarte hacia arriba

  if(mode === 'A'){
    function onScrollA(){
      const y = window.scrollY || 0;
      setLayout(y < 10);   // visible solo cuando estás en la parte superior
    }
    onScrollA();
    window.addEventListener('scroll', onScrollA, { passive:true });
  }

  // ---- Opción B (direccional): ocultar al bajar, mostrar al subir
  if(mode === 'B'){
    let lastY = window.scrollY || 0;
    let saleVisible = true;

    function onScrollB(){
      const y = window.scrollY || 0;
      const goingDown = y > lastY;
      // Oculta cuando bajas y ya pasaste el header
      if (goingDown && y > HEAD_H) saleVisible = false;
      // Muestra cuando subes o estás cerca del top
      if (!goingDown || y < 10)    saleVisible = true;

      setLayout(saleVisible);
      lastY = y;
    }
    setLayout(true);
    window.addEventListener('scroll', onScrollB, { passive:true });
  }

  // Recalcula si cambia la altura de la sale bar (por texto responsivo, etc.)
  if (window.ResizeObserver && sale){
    new ResizeObserver(()=> setLayout(!sale.classList.contains('sale--hidden'))).observe(sale);
  }
})();