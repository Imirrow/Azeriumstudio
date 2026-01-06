document.addEventListener("DOMContentLoaded", async () => {
  const input = document.querySelector("#qSearch");
  const btn   = document.querySelector("#qGo");

  if (!input || !btn) return;

  // Cuando el usuario presiona ENTER
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") goSearch();
  });

  // Cuando da click en la lupa
  btn.addEventListener("click", goSearch);

  function goSearch() {
    const term = input.value.trim();
    sessionStorage.setItem("searchTerm", term);
    window.location.href = "shop.html";
  }
});
