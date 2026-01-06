window.__PRODUCTS_LOADED = false;
window.products = [];

async function loadProducts() {
  if (window.__PRODUCTS_LOADED) return window.products;

  try {
    const res = await fetch("data/products.json");
    const data = await res.json();
    window.products = data.products || [];
    window.__PRODUCTS_LOADED = true;
    return window.products;
  } catch (e) {
    console.error("Error cargando productos:", e);
    return [];
  }
}
