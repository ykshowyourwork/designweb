// Puts the cards on this page in the order Jordan set at /admin/site, and takes out the ones he hid.
// Cards carry data-slug. Anything not in his list (like a site added since) stays first, newest on top.
const arrange = (container, list) => {
  const kids = [...container.children].filter((el) => el.dataset.slug);
  if (!kids.length) return;
  const rank = new Map(list.map((x, i) => [x.slug, i]));
  const hidden = new Set(list.filter((x) => x.hidden).map((x) => x.slug));
  const sorted = kids
    .map((el, i) => ({ el, i, r: rank.has(el.dataset.slug) ? rank.get(el.dataset.slug) : -1 }))
    .sort((a, b) => (a.r === -1 && b.r === -1 ? a.i - b.i : a.r - b.r));
  for (const { el } of sorted) hidden.has(el.dataset.slug) ? el.remove() : container.appendChild(el);
};

// The logo wall repeats its list to fill the screen. Our sites follow the saved order (hidden ones drop out);
// the brand logos between them stay where they are.
const arrangeLogos = (track, list) => {
  const seen = new Set();
  const one = [];
  for (const el of track.children) {
    const key = el.dataset.slug || el.dataset.brand;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    one.push(el.cloneNode(true));
  }
  const holder = document.createElement("div");
  one.filter((el) => el.dataset.slug).forEach((el) => holder.appendChild(el));
  arrange(holder, list);
  const sites = [...holder.children];
  let k = 0;
  const merged = one.map((el) => (el.dataset.slug ? sites[k++] : el)).filter(Boolean);
  if (!merged.length) return;
  track.replaceChildren(...merged.map((el) => el.cloneNode(true)), ...merged.map((el) => el.cloneNode(true)));
};

(async () => {
  try {
    const res = await fetch("/api/site-layout");
    if (res.ok) {
      const { examples = [], industries = [] } = await res.json();
      document.querySelectorAll(".work-grid, #ex-grid, .hero-shots").forEach((c) => arrange(c, examples));
      document.querySelectorAll(".logo-track").forEach((t) => arrangeLogos(t, examples));
      document.querySelectorAll("[data-industries]").forEach((c) => arrange(c, industries));
      document.dispatchEvent(new CustomEvent("layout:ready"));
    }
  } catch {
    /* keep the built order */
  }
})();
