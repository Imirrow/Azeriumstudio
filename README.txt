Azerium Posters — Clone-Style Starter (HTML + Tailwind + Vanilla JS)

Este proyecto replica el flujo/UX de una tienda tipo Poster Maniacs sin usar WordPress:
- index.html: barras de oferta, hero, colecciones destacadas, 'Recién llegados', 'Por categoría', 'Más pedidos', badges de confianza, newsletter, footer.
- shop.html: filtros (categorías, temáticas, piezas), búsqueda, ordenamientos, grid con "Mostrar más".
- product.html: galería, video, temporizador, selector de piezas/tamaño, añadir al carrito, relacionados.
- data/*.json: reemplaza con tus productos/categorías reales.
- Sin backend: carrito en localStorage. Integra pagos (Culqi/Mercado Pago/Niubiz) según necesites.

Cómo usar:
1. Descomprime el ZIP y abre index.html.
2. Cambia assets e imágenes por tus mockups.
3. Edita data/products.json y data/categories.json.
4. Para producción, compila Tailwind con Vite/CLI y sube a tu hosting.