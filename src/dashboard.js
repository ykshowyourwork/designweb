// The owner's dashboard: money in, outreach, client sites in progress, quick links.
import { LABEL, esc, money } from "./money.js";
import { api, signIn } from "./session.js";

const $ = (id) => document.getElementById(id);

// Free demo homepages being built for clients (also listed in HANDOFF.md).
const DEMOS = [
  { name: "MCM Atlanta", note: "Proposal ready · $3,000", url: "/demo/mcm-atlanta" },
  { name: "JL Absolute Tree Service", note: "Demo homepage", url: "/demo/jl-absolute-tree-service" },
];

const NET_STAGES = [
  ["today", "Today"],
  ["call", "To call or text"],
  ["lead", "To email"],
  ["messaged", "Sent"],
  ["follow_up", "Follow-up due"],
  ["replied", "Replied"],
  ["yes", "Yes"],
  ["warm", "From the website"],
];

$("today").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
$("demos").innerHTML = DEMOS.map((d) => `<a class="line-item" href="${d.url}" target="_blank" rel="noopener"><span>${esc(d.name)}</span><small>${esc(d.note)}</small></a>`).join("");

async function money_() {
  const { projects } = await api("/api/admin", "GET");
  const sum = (status) => projects.flatMap((p) => p.payments).filter((x) => x.status === status).reduce((n, x) => n + x.amount, 0);
  $("s-paid").textContent = money(sum("paid"));
  $("s-due").textContent = money(sum("due"));
  $("s-launch").textContent = money(sum("upcoming"));
  $("s-projects").textContent = projects.length;
  $("recent").innerHTML = projects.length
    ? projects
        .slice(0, 5)
        .map((p) => `<a class="line-item" href="${esc(p.link)}" target="_blank" rel="noopener"><span>${esc(p.title)}<br><small>${esc(p.clientName)}</small></span><small>${p.payments.map((x) => `${LABEL[x.part] ?? "Payment"}: ${x.status}`).join(" · ")}</small></a>`)
        .join("")
    : `<p class="muted">No invoices yet. <a href="/admin/invoices">Make the first one →</a></p>`;
}

async function outreach() {
  try {
    const { rows, autoSend } = await api("/api/network", "GET");
    const today = new Date().toLocaleDateString("en-CA");
    const open = ["lead", "call", "warm", "follow_up"];
    const count = (st) =>
      st === "today"
        ? rows.filter((r) => open.includes(r.stage) && ((r.queue_on && r.queue_on <= today) || r.stage === "follow_up" || r.stage === "warm")).length
        : rows.filter((r) => r.stage === st).length;
    $("net").innerHTML =
      `<div class="pills">${NET_STAGES.map(([st, l]) => `<a href="/admin/network?tab=${st}">${l} <b>${count(st)}</b></a>`).join("")}</div>` +
      `<p class="muted" style="margin-top:12px">${rows.length} businesses · emails ${autoSend ? "send automatically each morning" : "wait for you to press Send"}.</p>`;
  } catch (e) {
    if (e.status === 401) throw e;
    $("net").innerHTML = `<p class="muted">${e.status === 503 ? "Not switched on yet. It starts once the Supabase keys are added." : esc(e.message)}</p>`;
  }
}

signIn(() => Promise.all([money_(), outreach()]));

// Run today: wakes the daily routine now instead of waiting for 7am.
$("run-today").addEventListener("click", async () => {
  const b = $("run-today");
  if (!confirm("Start today's run now? It lines up 100 businesses and builds 10 decks and demo sites. It takes a while; you'll get a phone notification when it's done.")) return;
  b.disabled = true;
  $("run-note").textContent = "Starting…";
  try {
    await api("/api/network", "POST", { action: "run-today" });
    $("run-note").textContent = "Running. You'll get a notification when it's done.";
  } catch (e) {
    $("run-note").textContent = e.message;
    b.disabled = false;
  }
});
