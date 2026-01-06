
// Bloquear clic derecho
document.addEventListener('contextmenu', e => e.preventDefault());

// Bloquear teclas F12, Ctrl+U, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+S
document.onkeydown = function(e) {
  if (e.keyCode === 123) return false; // F12
  if (e.ctrlKey && e.keyCode === 85) return false; // Ctrl+U (ver código fuente)
  if (e.ctrlKey && e.shiftKey && e.keyCode === 73) return false; // Ctrl+Shift+I (DevTools)
  if (e.ctrlKey && e.shiftKey && e.keyCode === 67) return false; // Ctrl+Shift+C (Seleccionar elemento)
  if (e.ctrlKey && e.keyCode === 83) return false; // Ctrl+S (guardar código)
};

// Bloquear selección de texto
document.addEventListener('selectstart', e => e.preventDefault());

// Bloquear copiar
document.addEventListener('copy', e => e.preventDefault());

// Bloquear cortar
document.addEventListener('cut', e => e.preventDefault());

// Bloquear pegar
document.addEventListener('paste', e => e.preventDefault());

// Evitar arrastrar imágenes
document.addEventListener('dragstart', e => e.preventDefault());

// Evitar arrastrar elementos
document.addEventListener('drag', e => e.preventDefault());

// Ocultar código cuando intentan abrir DevTools (detección de tamaño)
setInterval(function() {
  const threshold = 160;
  if (window.outerWidth - window.innerWidth > threshold ||
      window.outerHeight - window.innerHeight > threshold) {
    document.body.innerHTML = "";
  }
}, 500);

