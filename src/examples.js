// The examples gallery: narrows as you type (every word has to match) or tap a trade.
const q = document.getElementById("ex-q");
const chips = document.getElementById("ex-chips");
const cards = [...document.querySelectorAll("#ex-grid .shot-card")];
const count = document.getElementById("ex-count");
const none = document.getElementById("ex-none");
let ind = new URLSearchParams(location.search).get("industry") || "";
q.value = new URLSearchParams(location.search).get("q") || "";

function update() {
  const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const c of cards) {
    const hit = (!ind || c.dataset.ind.split(" ").includes(ind)) && words.every((w) => c.dataset.search.includes(w));
    c.hidden = !hit;
    if (hit) shown++;
  }
  for (const b of chips.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.ind === ind));
  count.textContent = `${shown} ${shown === 1 ? "example" : "examples"}`;
  none.hidden = shown > 0;
  const url = new URL(location.href);
  url.searchParams.delete("q");
  url.searchParams.delete("industry");
  if (q.value.trim()) url.searchParams.set("q", q.value.trim());
  if (ind) url.searchParams.set("industry", ind);
  history.replaceState(null, "", url);
}

q.addEventListener("input", update);
chips.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  ind = b.dataset.ind;
  update();
});
update();
