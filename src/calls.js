// The caller's page (/admin/calls): only the Call list. Talks to /api/call, the one API a caller can use.
import { api as call, me, signIn } from "./session.js";
import { callCard, callStatus, todayKey, wireCallCards } from "./callcard.js";

const $ = (id) => document.getElementById(id);
const api = (method, body) => call("/api/call", method, body);

let rows = [];
let name = "";
let tab = "tocall";
let picking = null;

function toast(text) {
  const t = document.querySelector(".toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 4500);
}

const TABS = [
  // Not booked, not reached yet (or a call-back that's due), and not already tried today.
  ["tocall", "To call", (r) => {
    const st = callStatus(r).key;
    if (st === "booked") return false;
    if (r.call_back_on) return r.call_back_on <= todayKey();
    return st !== "today" && !["messaged", "follow_up", "followed_up", "replied"].includes(r.stage);
  }],
  ["callback", "Call backs", (r) => Boolean(r.call_back_on)],
  ["today", "Called today", (r) => r.last_called_at && new Date(r.last_called_at).toLocaleDateString("en-CA") === todayKey()],
  ["booked", "Booked", (r) => callStatus(r).key === "booked"],
  ["mine", "My leads", (r) => r.added_by && r.added_by === me()?.email],
  ["all", "All", () => true],
];

// Today's calls by this person, counted from the history lines ("2026-11-25 Called (Essence): …").
function myCallsToday() {
  const mark = `${todayKey()} Called (${name}):`;
  let calls = 0;
  let booked = 0;
  for (const r of rows)
    for (const l of String(r.log ?? "").split("\n"))
      if (l.startsWith(mark)) {
        calls += 1;
        if (l.includes("booked a call")) booked += 1;
      }
  return { calls, booked };
}

function render() {
  const { calls, booked } = myCallsToday();
  $("summary").textContent = `Hi ${name}. Today: ${calls} call${calls === 1 ? "" : "s"} · ${booked} booked · ${rows.length} on the list`;
  $("tabs").innerHTML = TABS.map(([k, l, f]) => `<button class="chip ${tab === k ? "on" : ""}" data-tab="${k}">${l} ${rows.filter(f).length}</button>`).join("");
  const test = TABS.find(([k]) => k === tab)[2];
  const q = $("search").value.trim().toLowerCase();
  const order = (r) => (r.call_back_on && r.call_back_on <= todayKey() ? -1 : 0);
  const shown = rows
    .filter(test)
    .filter((r) => !q || [r.business, r.area, r.phone, r.category, r.contact_name].join(" ").toLowerCase().includes(q))
    .sort((a, b) => order(a) - order(b) || (a.call_rank ?? 999) - (b.call_rank ?? 999));
  $("list").innerHTML = shown.length
    ? shown.map((r) => callCard(r, { picking: picking?.id === r.id ? picking.result : null })).join("")
    : `<p class="muted">Nobody here right now.</p>`;
}

async function load() {
  const data = await api("GET");
  rows = data.rows;
  name = data.me?.name || "";
  render();
}

signIn(load);

$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  tab = b.dataset.tab;
  render();
});
$("search").addEventListener("input", render);
$("add-toggle").addEventListener("click", () => ($("add").hidden = !$("add").hidden));
$("add").addEventListener("submit", async (e) => {
  e.preventDefault();
  const lead = Object.fromEntries(new FormData(e.target));
  try {
    const row = await api("POST", { action: "add", lead });
    rows.unshift(row);
    e.target.reset();
    e.target.hidden = true;
    tab = "mine";
    render();
    toast(`Added ${row.business}. Jordan sees it in the CRM with your name on it.`);
  } catch (err) {
    toast(err.message);
  }
});

wireCallCards($("list"), {
  logFn: (id, body) => api("POST", { action: "log", id, ...body }),
  done: (row, msg) => {
    if (row) {
      rows = rows.map((r) => (r.id === row.id ? row : r)).filter((r) => r.stage !== "pass");
      render();
    }
    toast(msg);
  },
  rerender: render,
  getPicking: () => picking,
  setPicking: (p) => (picking = p),
});
