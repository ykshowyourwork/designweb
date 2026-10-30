// Invoices live entirely in Stripe: no database. Each client project is one
// Stripe customer with two invoices, a deposit (sent right away) and a
// balance (held as a draft until launch day). Stripe emails them, takes the
// card, and sends receipts and reminders.
//
// The client's link is /invoice/<token>, where the token is the customer id
// plus a random secret kept on that customer, so links can't be guessed.

import { randomBytes, timingSafeEqual } from "node:crypto";
import brand from "../brand.json" with { type: "json" };

export const site = () => (process.env.SITE_URL || `https://${brand.domain}`).replace(/\/$/, "");

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);

export function tokenFor(customer) {
  return `${customer.id.replace(/^cus_/, "")}.${customer.metadata.secret}`;
}

/** The customer behind a token, or a 404 if the token is wrong in any way. */
export async function customerFor(stripe, token) {
  const m = /^([A-Za-z0-9]{8,40})\.([a-f0-9]{32})$/.exec(String(token ?? ""));
  if (!m) throw new HttpError(404, "That link looks wrong.");
  let customer;
  try {
    customer = await stripe.customers.retrieve(`cus_${m[1]}`);
  } catch {
    throw new HttpError(404, "That invoice isn't available.");
  }
  const secret = customer?.metadata?.secret ?? "";
  if (customer.deleted || secret.length !== 32 || !timingSafeEqual(Buffer.from(secret), Buffer.from(m[2]))) {
    throw new HttpError(404, "That invoice isn't available.");
  }
  return customer;
}

/** Checks the admin form and returns it in cents. */
export function parseProject(body) {
  const title = clean(body.title, 120);
  const clientName = clean(body.clientName, 120);
  const clientEmail = clean(body.clientEmail, 200).toLowerCase();
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((i) => ({ label: clean(i.label, 80), cents: Math.round(Number(i.amount) * 100) }))
    .filter((i) => i.label && Number.isFinite(i.cents) && i.cents > 0);
  const depositPercent = Number(body.depositPercent ?? 50);

  if (!title || !clientName) throw new HttpError(400, "Needs a title and the client's name.");
  if (!EMAIL.test(clientEmail)) throw new HttpError(400, "That email doesn't look right.");
  if (!items.length) throw new HttpError(400, "Add at least one line with an amount.");
  if (items.length > 10) throw new HttpError(400, "Ten lines at most.");
  if (!(depositPercent > 0 && depositPercent <= 100)) throw new HttpError(400, "Deposit has to be between 1 and 100%.");

  const total = items.reduce((n, i) => n + i.cents, 0);
  const deposit = Math.round((total * depositPercent) / 100);
  return { title, clientName, clientEmail, items, total, deposit, balance: total - deposit, depositPercent };
}

async function addInvoice(stripe, customer, p, part, cents) {
  const label = part === "deposit" ? (p.balance ? `Deposit (${p.depositPercent}%)` : "Payment in full") : "Balance at launch";
  const inv = await stripe.invoices.create({
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: part === "deposit" ? 3 : 7,
    description: `${p.title} · ${label}`,
    metadata: { part, title: p.title },
    pending_invoice_items_behavior: "exclude",
  });
  await stripe.invoiceItems.create({ customer: customer.id, invoice: inv.id, amount: cents, currency: "usd", description: `${p.title} · ${label}` });
  return inv;
}

/** Makes the client, both invoices, and sends the deposit. */
export async function createProject(stripe, body) {
  const p = parseProject(body);
  const customer = await stripe.customers.create({
    name: p.clientName,
    email: p.clientEmail,
    description: p.title,
    metadata: {
      secret: randomBytes(16).toString("hex"),
      title: p.title,
      // The full price list, so the client sees what the deposit is part of.
      items: JSON.stringify(p.items.map((i) => [i.label, i.cents])).slice(0, 500),
    },
  });

  const deposit = await addInvoice(stripe, customer, p, "deposit", p.deposit);
  await stripe.invoices.finalizeInvoice(deposit.id);
  if (body.send !== false) await stripe.invoices.sendInvoice(deposit.id);
  if (p.balance > 0) await addInvoice(stripe, customer, p, "balance", p.balance);

  return { token: tokenFor(customer), link: `${site()}/invoice/${tokenFor(customer)}` };
}

const partOf = (inv) => ({
  part: inv.metadata?.part ?? "other",
  amount: inv.amount_due,
  status: inv.status === "draft" ? "upcoming" : inv.status === "paid" ? "paid" : inv.status === "void" ? "canceled" : "due",
  dueDate: inv.status === "open" && inv.due_date ? inv.due_date : null,
  payUrl: inv.status === "open" ? inv.hosted_invoice_url : null,
  receiptUrl: inv.status === "paid" ? inv.hosted_invoice_url : null,
});
const ORDER = { deposit: 0, balance: 1, other: 2 };

/** What the client's page shows. */
export async function getProject(stripe, token) {
  const customer = await customerFor(stripe, token);
  const { data } = await stripe.invoices.list({ customer: customer.id, limit: 20 });
  let items = [];
  try {
    items = JSON.parse(customer.metadata.items || "[]").map(([label, cents]) => ({ label, amount: cents }));
  } catch {
    /* an old or trimmed list: show the payments only */
  }
  return {
    title: customer.metadata.title || customer.description || "Website project",
    clientName: customer.name,
    items,
    payments: data.map(partOf).sort((a, b) => ORDER[a.part] - ORDER[b.part]),
  };
}

/** Launch day: send the balance invoice. */
export async function sendBalance(stripe, token) {
  const customer = await customerFor(stripe, token);
  const { data } = await stripe.invoices.list({ customer: customer.id, status: "draft", limit: 20 });
  const balance = data.find((i) => i.metadata?.part === "balance");
  if (!balance) throw new HttpError(409, "There's no unsent balance on this project.");
  await stripe.invoices.finalizeInvoice(balance.id);
  await stripe.invoices.sendInvoice(balance.id);
  return { ok: true };
}

/** The admin list: one row per project, newest first. */
export async function listProjects(stripe) {
  const { data } = await stripe.customers.list({ limit: 50 });
  const projects = [];
  for (const c of data.filter((c) => c.metadata?.secret)) {
    const { data: invs } = await stripe.invoices.list({ customer: c.id, limit: 20 });
    projects.push({
      token: tokenFor(c),
      link: `${site()}/invoice/${tokenFor(c)}`,
      title: c.metadata.title || c.description,
      clientName: c.name,
      clientEmail: c.email,
      created: c.created,
      payments: invs.map(partOf).sort((a, b) => ORDER[a.part] - ORDER[b.part]),
    });
  }
  return projects;
}

export function checkAdmin(req) {
  const want = process.env.ADMIN_PASSWORD ?? "";
  const got = String(req.headers["x-admin-key"] ?? "");
  if (want.length < 8 || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    throw new HttpError(401, "Wrong password.");
  }
}

/** Shared wrapper: JSON in and out, errors as { error }. */
export function handler(fn) {
  return async (req, res) => {
    try {
      res.status(200).json(await fn(req, res));
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      res.status(status).json({ error: status === 500 ? "Something went wrong. Try again." : e.message });
    }
  };
}
