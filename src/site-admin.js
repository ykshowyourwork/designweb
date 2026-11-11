// /admin/site: drag the public site's cards into order, hide some, and send new demos to the site.
import { api, signIn } from "./session.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let items = { examples: [], industries: [] };
let dirty = false;

// Saved order first; anything new (not saved yet) goes on top, like the public site.
const merged = (all, saved) => {
  const rank = new Map(saved.map((x, i) => [x.slug, i]));
  const hidden = new Set(saved.filter((x) => x.hidden).map((x) => x.slug));
  return all
    .map((x, i) => ({ ...x, hidden: hidden.has(x.slug), r: rank.has(x.slug) ? rank.get(x.slug) : -1, i }))
    .sort((a, b) => (a.r === -1 && b.r === -1 ? a.i - b.i : a.r - b.r));
};

const changed = () => {
  dirty = true;
  $("save").disabled = false;
  $("save-note").textContent = "Not saved yet";
};

function list(id, rows) {
  const ol = $(id);
  ol.innerHTML = rows
    .map(
      (x) => `<li draggable="true" data-slug="${esc(x.slug)}" class="${x.hidden ? "off" : ""}">
        <span class="grip" aria-hidden="true">⋮⋮</span>
        ${x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy" />` : ""}
        <span class="who"><b>${esc(x.name)}</b>${x.tag ? `<small>${esc(x.tag)}</small>` : ""}</span>
        <button type="button" class="ic up" aria-label="Move up">↑</button>
        <button type="button" class="ic down" aria-label="Move down">↓</button>
        <button type="button" class="ic eye" aria-label="${x.hidden ? "Show" : "Hide"} ${esc(x.name)}">${x.hidden ? "Hidden" : "Shown"}</button>
      </li>`,
    )
    .join("");
  ol.onclick = (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    if (e.target.closest(".up") && li.previousElementSibling) li.parentNode.insertBefore(li, li.previousElementSibling);
    else if (e.target.closest(".down") && li.nextElementSibling) li.parentNode.insertBefore(li.nextElementSibling, li);
    else if (e.target.closest(".eye")) {
      li.classList.toggle("off");
      const b = li.querySelector(".eye");
      b.textContent = li.classList.contains("off") ? "Hidden" : "Shown";
    } else return;
    changed();
  };
  let dragging = null;
  ol.ondragstart = (e) => { dragging = e.target.closest("li"); dragging?.classList.add("dragging"); };
  ol.ondragend = () => { dragging?.classList.remove("dragging"); dragging = null; };
  ol.ondragover = (e) => {
    e.preventDefault();
    const over = e.target.closest("li");
    if (!dragging || !over || over === dragging) return;
    const r = over.getBoundingClientRect();
    ol.insertBefore(dragging, e.clientY > r.top + r.height / 2 ? over.nextSibling : over);
    changed();
  };
}

const read = (id) => [...$(id).children].map((li) => ({ slug: li.dataset.slug, hidden: li.classList.contains("off") }));

function demos(all, queue) {
  const onSite = new Set(items.examples.map((x) => x.slug));
  const fresh = (all || []).filter((d) => d.slug && !onSite.has(d.slug));
  $("demos").innerHTML = fresh.length
    ? fresh
        .map((d) => {
          const q = queue.includes(d.slug);
          return `<div class="card demo"><b>${esc(d.business)}</b><small>${esc(d.area || "")}</small>
          <a href="${esc(d.demo_url)}" target="_blank" rel="noopener">Open the site</a>
          <button type="button" class="btn ${q ? "ghost" : ""}" data-slug="${esc(d.slug)}" data-on="${q ? "0" : "1"}">${q ? "Queued · undo" : "Add to site"}</button></div>`;
        })
        .join("")
    : `<p class="muted">Every demo is already on the site.</p>`;
  $("demos").onclick = async (e) => {
    const b = e.target.closest("button[data-slug]");
    if (!b) return;
    b.disabled = true;
    const layout = await api("/api/site-layout", "POST", { action: "queue", slug: b.dataset.slug, on: b.dataset.on === "1" });
    demos(all, layout.queue);
  };
}

signIn(async () => {
  const [all, layout] = await Promise.all([fetch("/site-items.json").then((r) => r.json()), api("/api/site-layout?admin=1", "GET")]);
  items = all;
  list("examples", merged(all.examples, layout.examples));
  list("industries", merged(all.industries, layout.industries));
  demos(layout.demos, layout.queue);
  $("save").onclick = async () => {
    $("save").disabled = true;
    $("save-note").textContent = "Saving…";
    try {
      await api("/api/site-layout", "POST", { action: "save", examples: read("examples"), industries: read("industries") });
      dirty = false;
      $("save-note").textContent = "Saved. desiweb.org shows the new order within a minute.";
    } catch (e) {
      $("save").disabled = false;
      $("save-note").textContent = e.message;
    }
  };
  addEventListener("beforeunload", (e) => { if (dirty) e.preventDefault(); });
});
