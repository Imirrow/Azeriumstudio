(function(){
  const open  = document.getElementById('openCustomModal');
  const modal = document.getElementById('customModal');
  const close = document.getElementById('closeCustomModal');
  const form  = document.getElementById('customForm');

  const progressWrap = document.getElementById('progressWrap');
  const progressBar  = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const successBox   = document.getElementById('successBox');
  const orderIdEl    = document.getElementById('orderId');
  const goWhatsApp   = document.getElementById('goWhatsApp');
  const submitBtn    = document.getElementById('submitBtn');
  const PHONE        = '51XXXXXXXXX'; // <-- TU NÚMERO

  if(!open || !modal || !form) return;

  open.onclick  = ()=> modal.classList.remove('hidden');
  close.onclick = ()=> modal.classList.add('hidden');
  modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.classList.add('hidden'); });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();

    // Recojo datos
    const fd = new FormData(form);
    // Limitar archivos
    const files = document.getElementById('imagesInput').files;
    if (files.length > 6) { alert('Máximo 6 imágenes'); return; }
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) { alert(`Archivo muy grande: ${f.name}`); return; }
      if (!/image\/(png|jpe?g|webp)/i.test(f.type)) { alert(`Formato no permitido: ${f.name}`); return; }
      fd.append('images', f, f.name);
    }

    // UI estado
    submitBtn.disabled = true;
    progressWrap.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    successBox.classList.add('hidden');

    try {
      const res = await fetch('/api/custom-order', {
        method: 'POST',
        body: fd
      });

      if(!res.ok) throw new Error('Error al enviar. Intenta de nuevo.');
      const data = await res.json();
      const id   = data.id || 'SIN-ID';

      // Éxito
      orderIdEl.textContent = id;
      const msg = `Hola Azerium, envié mi formulario. ID: ${id}`;
      goWhatsApp.href = `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`;
      successBox.classList.remove('hidden');

      // Limpia barra
      progressBar.style.width = '100%';
      progressText.textContent = '100%';
      form.reset();
    } catch(err){
      alert(err.message || 'Ocurrió un error.');
    } finally {
      submitBtn.disabled = false;
      setTimeout(()=> {
        progressWrap.classList.add('hidden');
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
      }, 1200);
    }
  });

  // Simular progreso (porque fetch no expone progreso nativo con FormData)
  // Opcional: lo dejamos visual.
  let fake = 0, timer;
  form.addEventListener('submit', ()=>{
    clearInterval(timer);
    fake = 0;
    timer = setInterval(()=>{
      fake = Math.min(95, fake + 5);
      progressBar.style.width = fake + '%';
      progressText.textContent = fake + '%';
    }, 180);
  });
})();
