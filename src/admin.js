// The owner's page: make invoices, see who paid, send the balance on launch day.
import { LABEL, esc, money } from "./money.js";
import { api as call, signIn } from "./session.js";

const $ = (id) => document.getElementById(id);
const api = (method, body) => call("/api/admin", method, body);

// ── Sign in ──
signIn(loadProjects);

// ── New invoice ──
function addLine(label = "", amount = "") {
  const row = document.createElement("div");
  row.className = "line";
  row.innerHTML = `<input placeholder="Website" aria-label="Line" value="${esc(label)}" /><input inputmode="decimal" placeholder="1750" aria-label="Amount in dollars" value="${esc(amount)}" /><button type="button" aria-label="Remove line">×</button>`;
  row.querySelector("button").onclick = () => {
    row.remove();
    split();
  };
  row.querySelectorAll("input").forEach((i) => (i.oninput = split));
  $("lines").append(row);
  split();
}
function lines() {
  return [...$("lines").children].map((r) => {
    const [l, a] = r.querySelectorAll("input");
    return { label: l.value.trim(), amount: Number(a.value.replace(/[^0-9.]/g, "")) || 0 };
  });
}
function split() {
  const total = Math.round(lines().reduce((n, i) => n + (i.label ? i.amount : 0), 0) * 100);
  const pct = Number($("deposit").value);
  const dep = Math.round((total * pct) / 100);
  $("split").textContent = total ? (pct === 100 ? `${money(total)} now.` : `${money(dep)} now, ${money(total - dep)} at launch. Total ${money(total)}.`) : "";
}
$("add-line").onclick = () => addLine();
$("deposit").onchange = split;
addLine("Website", "1750");

$("create").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("create-msg");
  if (!confirm(`Email the deposit invoice to ${$("clientEmail").value}? This sends a real email.`)) return;
  $("send").disabled = true;
  msg.className = "msg";
  msg.textContent = "Creating…";
  try {
    const r = await api("POST", {
      action: "create",
      title: $("title").value,
      clientName: $("clientName").value,
      clientEmail: $("clientEmail").value,
      items: lines(),
      depositPercent: Number($("deposit").value),
    });
    msg.innerHTML = `Sent. Their link: <a href="${esc(r.link)}" target="_blank" rel="noopener">${esc(r.link)}</a>`;
    $("create").reset();
    $("lines").innerHTML = "";
    addLine("Website", "1750");
    loadProjects();
  } catch (err) {
    msg.className = "msg err";
    msg.textContent = err.message;
  } finally {
    $("send").disabled = false;
  }
});

// ── Projects ──
async function loadProjects() {
  const { projects } = await api("GET");
  const box = $("projects");
  if (!projects.length) {
    box.innerHTML = `<p class="muted">No invoices yet.</p>`;
    return;
  }
  box.innerHTML = projects
    .map(
      (p) => `
      <div class="card project">
        <strong>${esc(p.title)}</strong>
        <div class="meta">${esc(p.clientName)} · ${esc(p.clientEmail)}</div>
        <div class="meta">${p.payments.map((x) => `${LABEL[x.part] ?? "Payment"} ${money(x.amount)}: ${x.status}`).join(" · ")}</div>
        <div class="acts">
          <button class="btn ghost" data-copy="${esc(p.link)}">Copy link</button>
          <a class="btn ghost" href="${esc(p.link)}" target="_blank" rel="noopener">Open</a>
          ${p.payments.some((x) => x.part === "balance" && x.status === "upcoming") ? `<button class="btn" data-balance="${esc(p.token)}">Send balance</button>` : ""}
        </div>
      </div>`,
    )
    .join("");
  box.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(b.dataset.copy).then(() => (b.textContent = "Copied"))));
  box.querySelectorAll("[data-balance]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (!confirm("Launch day? This emails the client their balance invoice.")) return;
        b.disabled = true;
        try {
          await api("POST", { action: "balance", token: b.dataset.balance });
          loadProjects();
        } catch (err) {
          alert(err.message);
          b.disabled = false;
        }
      }),
  );
}
