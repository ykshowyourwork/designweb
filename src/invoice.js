// The client's invoice: /invoice/<token>. Paying opens Stripe's secure page.
import brand from "../brand.json";
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
    const p = await res.json().catch(() => ({}));
    if (!res.ok || !p.payments) throw new Error(p.error || "That invoice isn't available. Check the link in your email, or contact us.");

    const total = p.items.reduce((n, i) => n + i.amount, 0) || p.payments.reduce((n, x) => n + x.amount, 0);
    const allPaid = p.payments.length && p.payments.every((x) => x.status === "paid" || x.status === "canceled");

    show(`
      <div class="eyebrow">Invoice</div>
      <h1>${esc(p.title)}</h1>
      <div class="parties">
        <div><span class="muted">From</span><strong>${esc(brand.name)}</strong><span>${esc(brand.domain)}</span><span>${esc(brand.email)}</span></div>
        <div><span class="muted">Billed to</span><strong>${esc(p.clientName)}</strong></div>
      </div>

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
      <div class="card trust-note">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z"/></svg>
        <p>Payments are processed by <strong>Stripe</strong>, the payment company behind millions of businesses. Your card number goes straight to Stripe; ${esc(brand.name)} never sees it. You get an emailed receipt.</p>
      </div>
      <p class="note">By paying, you agree to our <a href="/terms">terms</a>, including the <a href="/terms#refunds">refund policy</a>. Questions? Email <a href="mailto:${esc(brand.email)}">${esc(brand.email)}</a> or reply to the invoice email.</p>
    `);
  } catch (e) {
    show(`<h1>Invoice</h1><p class="muted">${esc(e.message || "That invoice isn't available.")}</p>`);
  }
}

load();
