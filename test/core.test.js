import { test } from "node:test";
import assert from "node:assert/strict";
import { createProject, getProject, listProjects, parseProject, sendBalance } from "../api/_core.js";

// A small in-memory stand-in for the parts of Stripe the site uses.
function fakeStripe() {
  const customers = new Map();
  const invoices = new Map();
  let n = 0;
  const id = (p) => `${p}_TEST${String(++n).padStart(10, "0")}`;
  return {
    sent: [],
    customers: {
      create: async (c) => {
        const row = { id: id("cus"), created: n, deleted: false, ...c };
        customers.set(row.id, row);
        return row;
      },
      retrieve: async (cid) => {
        if (!customers.has(cid)) throw new Error("No such customer");
        return customers.get(cid);
      },
      list: async () => ({ data: [...customers.values()].reverse() }),
    },
    invoices: {
      create: async (i) => {
        const row = { id: id("in"), status: "draft", amount_due: 0, due_date: null, hosted_invoice_url: null, ...i };
        invoices.set(row.id, row);
        return row;
      },
      finalizeInvoice: async (iid) => Object.assign(invoices.get(iid), { status: "open", due_date: 1, hosted_invoice_url: `https://pay.stripe/${iid}` }),
      sendInvoice: async function (iid) {
        this._sent.push(iid);
      },
      _sent: [],
      list: async ({ customer, status }) => ({
        data: [...invoices.values()].filter((i) => i.customer === customer && (!status || i.status === status)),
      }),
    },
    invoiceItems: { create: async ({ invoice, amount }) => (invoices.get(invoice).amount_due += amount) },
  };
}

const project = {
  title: "Website build",
  clientName: "JL Absolute Tree Service",
  clientEmail: "Owner@Example.com",
  items: [
    { label: "Website", amount: "1500" },
    { label: "App Store add-on", amount: 1000 },
  ],
};

test("a project splits into a sent deposit and a held balance", async () => {
  const s = fakeStripe();
  const { token, link } = await createProject(s, project);
  assert.match(link, new RegExp(`/invoice/${token.replace(".", "\\.")}$`));
  assert.equal(s.invoices._sent.length, 1);

  const p = await getProject(s, token);
  assert.equal(p.clientName, "JL Absolute Tree Service");
  assert.deepEqual(p.items, [{ label: "Website", amount: 150000 }, { label: "App Store add-on", amount: 100000 }]);
  assert.deepEqual(p.payments.map((x) => [x.part, x.amount, x.status, !!x.payUrl]), [
    ["deposit", 125000, "due", true],
    ["balance", 125000, "upcoming", false],
  ]);

  await sendBalance(s, token);
  assert.equal(s.invoices._sent.length, 2);
  const after = await getProject(s, token);
  assert.equal(after.payments[1].status, "due");
  await assert.rejects(sendBalance(s, token), /no unsent balance/);

  const list = await listProjects(s);
  assert.equal(list.length, 1);
  assert.equal(list[0].token, token);
});

test("100% deposit makes one invoice", async () => {
  const s = fakeStripe();
  const { token } = await createProject(s, { ...project, depositPercent: 100 });
  const p = await getProject(s, token);
  assert.deepEqual(p.payments.map((x) => [x.part, x.amount]), [["deposit", 250000]]);
});

test("wrong or tampered tokens are refused", async () => {
  const s = fakeStripe();
  const { token } = await createProject(s, project);
  const [cid] = token.split(".");
  await assert.rejects(getProject(s, `${cid}.${"0".repeat(32)}`), { status: 404 });
  await assert.rejects(getProject(s, "nope"), { status: 404 });
  await assert.rejects(getProject(s, `TEST9999999999.${"a".repeat(32)}`), { status: 404 });
});

test("bad forms are refused", () => {
  assert.throws(() => parseProject({ ...project, clientEmail: "nope" }), /email/);
  assert.throws(() => parseProject({ ...project, items: [{ label: "x", amount: -5 }] }), /at least one line/);
  assert.throws(() => parseProject({ ...project, depositPercent: 0 }), /Deposit/);
  assert.equal(parseProject(project).clientEmail, "owner@example.com");
});
