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
  ["lead", "To email"],
  ["messaged", "Sent"],
  ["follow_up", "Follow-up due"],
  ["replied", "Replied"],
  ["yes", "Yes"],
  ["warm", "From the website"],
];

$("today").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
$("demos").innerHTML = DEMOS.map((d) => `<div class="line-item"><a href="${d.url}" target="_blank" rel="noopener">${esc(d.name)}</a><small>${esc(d.note)}</small></div>`).join("");

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
        .map((p) => `<div class="line-item"><span><a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.title)}</a><br><small>${esc(p.clientName)}</small></span><small>${p.payments.map((x) => `${LABEL[x.part] ?? "Payment"}: ${x.status}`).join(" · ")}</small></div>`)
        .join("")
    : `<p class="muted">No invoices yet. <a href="/admin/invoices">Make the first one →</a></p>`;
}

async function outreach() {
  try {
    const { rows, autoSend } = await api("/api/network", "GET");
    const count = (st) => rows.filter((r) => r.stage === st).length;
    $("net").innerHTML =
      `<div class="pills">${NET_STAGES.map(([st, l]) => `<span>${l} <b>${count(st)}</b></span>`).join("")}</div>` +
      `<p class="muted" style="margin-top:12px">${rows.length} businesses · emails ${autoSend ? "send automatically each morning" : "wait for you to press Send"}.</p>`;
  } catch (e) {
    if (e.status === 401) throw e;
    $("net").innerHTML = `<p class="muted">${e.status === 503 ? "Not switched on yet. It starts once the Supabase keys are added." : esc(e.message)}</p>`;
  }
}

signIn(() => Promise.all([money_(), outreach()]));
