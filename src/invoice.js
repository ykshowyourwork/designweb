// The client's invoice: /invoice/<token>. Paying opens Stripe's secure page.
import { LABEL, day, esc, money } from "./money.js";

const app = document.getElementById("app");
const token = decodeURIComponent(location.pathname.split("/").filter(Boolean)[1] ?? "");

function show(html) {
  app.innerHTML = html;
  app.removeAttribute("aria-busy");
}

async function load() {
  try {
    const res = await fetch(`/api/invoice?token=${encodeURIComponent(token)}`);
    const p = await res.json();
    if (!res.ok) throw new Error(p.error || "That invoice isn't available.");

    const total = p.items.reduce((n, i) => n + i.amount, 0) || p.payments.reduce((n, x) => n + x.amount, 0);
    const allPaid = p.payments.length && p.payments.every((x) => x.status === "paid" || x.status === "canceled");

    show(`
      <div class="eyebrow">Invoice</div>
      <h1>${esc(p.title)}</h1>
      <p class="muted">For ${esc(p.clientName)}</p>

      ${p.items.length ? `
        <div class="card rows" style="margin-top: 24px">
          ${p.items.map((i) => `<div class="row"><span>${esc(i.label)}</span><span>${money(i.amount)}</span></div>`).join("")}
          <div class="row total"><span>Total</span><span>${money(total)}</span></div>
        </div>` : ""}

      <h2 style="margin-top: 32px; font-size: 1.3rem">Payments</h2>
      ${p.payments.map((x) => `
        <div class="card pay">
          <div>
            <strong>${LABEL[x.part] ?? "Payment"} · ${money(x.amount)}</strong>
            <div class="muted" style="font-size: 14px">${
              x.status === "due" && x.dueDate ? `Due ${day(x.dueDate)}`
              : x.status === "upcoming" ? "You'll get this one on launch day"
              : x.status === "canceled" ? "Canceled" : ""
            }</div>
          </div>
          ${x.status === "paid"
            ? `<span class="paid">Paid${x.receiptUrl ? ` · <a href="${esc(x.receiptUrl)}" target="_blank" rel="noopener">Receipt</a>` : ""}</span>`
            : x.payUrl ? `<a class="btn" href="${esc(x.payUrl)}">Pay ${money(x.amount)}</a>` : ""}
        </div>`).join("")}

      ${allPaid ? `<p class="paid" style="margin-top: 16px">All paid. Thank you.</p>` : ""}
      <p class="note">Paid securely by card through Stripe. Questions? Reply to the invoice email.</p>
    `);
  } catch (e) {
    show(`<h1>Invoice</h1><p class="muted">${esc(e.message || "That invoice isn't available.")}</p>`);
  }
}

load();
