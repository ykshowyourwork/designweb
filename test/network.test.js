import { test } from "node:test";
import assert from "node:assert/strict";
import { FOOTER, autoSendOn, cleanPatch, pickBatch, sendBatch, sendOne, upsertRows } from "../api/_network.js";
import { saveLead } from "../api/_lead.js";

const env = { SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "svc", RESEND_API_KEY: "re_test" };
const id = (n) => `00000000-0000-0000-0000-00000000000${n}`;

// A tiny fake of the Supabase REST API and Resend, enough for these tests.
function fakeWorld(rows, settings = { auto_send: false, auto_send_on: null, batch_size: 10 }) {
  const sent = [];
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method, path: u.pathname + u.search, body });
    const ok = (data, status = 200) => ({ ok: true, status, text: async () => JSON.stringify(data), json: async () => data });
    if (u.host === "api.resend.com") {
      sent.push(body);
      return ok({ id: `email_${sent.length}` });
    }
    const table = u.pathname.split("/").pop();
    if (table === "network_settings") return ok([settings]);
    const eq = u.searchParams.get("id")?.replace("eq.", "");
    if (init.method === "GET") {
      if (eq) return ok(rows.filter((r) => r.id === eq));
      const cidIn = u.searchParams.get("google_cid");
      if (cidIn) {
        const want = cidIn.slice(4, -1).split(",").map((s) => s.replace(/"/g, ""));
        return ok(rows.filter((r) => want.includes(r.google_cid)));
      }
      const emailIn = u.searchParams.get("email");
      if (emailIn) {
        const want = emailIn.slice(4, -1).split(",").map((s) => s.replace(/"/g, ""));
        return ok(rows.filter((r) => want.includes(r.email)));
      }
      return ok(rows);
    }
    if (init.method === "PATCH") {
      const r = rows.find((x) => x.id === eq);
      Object.assign(r, body);
      return ok([r]);
    }
    if (init.method === "POST") {
      const list = (Array.isArray(body) ? body : [body]).map((r, i) => ({ id: id(9 - i), ...r }));
      rows.push(...list);
      return ok(list, 201);
    }
    throw new Error(`unexpected ${init.method} ${url}`);
  };
  return { fetchImpl, sent, calls, rows };
}

const lead = (n, extra = {}) => ({ id: id(n), business: `Biz ${n}`, stage: "lead", email: `owner${n}@biz.com`, email_subject: "Hi", email_draft: "Body", reviews: n, followups: 0, ...extra });

test("the batch picks ready leads with the most reviews first, up to the batch size, plus follow-ups", () => {
  const rows = [lead(1), lead(2), lead(3), lead(4, { email: null }), lead(5, { email_draft: null }), lead(6, { stage: "messaged" }), lead(7, { stage: "follow_up", followup_subject: "Re", followup_draft: "Again" })];
  const { fresh, followUps } = pickBatch(rows, 2);
  assert.deepEqual(fresh.map((r) => r.business), ["Biz 3", "Biz 2"]);
  assert.deepEqual(followUps.map((r) => r.business), ["Biz 7"]);
});

test("a first email goes from gethelp@desiweb.org with the address footer, then the row is Sent with a follow-up in 3 days", async () => {
  const w = fakeWorld([lead(1)]);
  const row = await sendOne(id(1), {}, { ...w, env, today: "2026-10-24" });
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].from, "Jordan at DesiWeb <gethelp@desiweb.org>");
  assert.deepEqual(w.sent[0].to, ["owner1@biz.com"]);
  assert.equal(w.sent[0].reply_to, "gethelp@desiweb.org");
  assert.ok(w.sent[0].text.endsWith(FOOTER));
  assert.match(w.sent[0].text, /7300 W Sunset Blvd/);
  assert.equal(row.stage, "messaged");
  assert.equal(row.sent_on, "2026-10-24");
  assert.equal(row.follow_up_on, "2026-10-27");
  assert.match(row.log, /Email sent to owner1@biz.com/);
});

test("follow-ups: the first sets another in 7 days, the second ends it", async () => {
  const w = fakeWorld([lead(1, { stage: "follow_up", followup_subject: "Re: Hi", followup_draft: "Checking in" })]);
  let row = await sendOne(id(1), {}, { ...w, env, today: "2026-10-27" });
  assert.equal(row.stage, "messaged");
  assert.equal(row.followups, 1);
  assert.equal(row.follow_up_on, "2026-11-03");
  w.rows[0].stage = "follow_up"; // what the daily routine does when the 7 days are up
  row = await sendOne(id(1), {}, { ...w, env, today: "2026-11-03" });
  assert.equal(row.stage, "followed_up");
  assert.equal(row.followups, 2);
  assert.equal(w.sent.length, 2);
});

test("nobody gets the first email twice by accident, and rows without an email are refused", async () => {
  const w = fakeWorld([lead(1, { stage: "messaged" }), lead(2, { email: null })]);
  await assert.rejects(sendOne(id(1), {}, { ...w, env }), /Already contacted/);
  await assert.rejects(sendOne(id(2), {}, { ...w, env }), /no email/);
  assert.equal(w.sent.length, 0);
});

test("send-batch sends the ready ones and reports each result", async () => {
  const w = fakeWorld([lead(1), lead(2), lead(3, { email: null })], { auto_send: false, batch_size: 10 });
  const r = await sendBatch({ ...w, env, today: "2026-10-24" });
  assert.equal(r.sent, 2);
  assert.equal(r.failed, 0);
  assert.equal(w.sent.length, 2);
  assert.ok(w.rows.filter((x) => x.email).every((x) => x.stage === "messaged"));
});

test("no email key on the server means a clear error, not a silent skip", async () => {
  const w = fakeWorld([lead(1)]);
  await assert.rejects(sendOne(id(1), {}, { ...w, env: { ...env, RESEND_API_KEY: "" } }), /RESEND_API_KEY/);
});

test("imports update existing rows without resetting their stage, and new rows start at To email or To call", async () => {
  const w = fakeWorld([lead(1, { stage: "messaged", google_cid: "111" })]);
  const r = await upsertRows(
    [
      { business: "Biz 1", google_cid: "111", reviews: 99 },
      { business: "New with email", email: "a@b.com", google_cid: "222" },
      { business: "New no email", phone: "(816) 555-0100" },
    ],
    { ...w, env },
  );
  assert.deepEqual(r, { added: 2, updated: 1 });
  assert.equal(w.rows[0].stage, "messaged");
  assert.equal(w.rows[0].reviews, 99);
  assert.equal(w.rows.find((x) => x.business === "New with email").stage, "lead");
  assert.equal(w.rows.find((x) => x.business === "New no email").stage, "call");
});

test("bad stages and bad emails are refused", () => {
  assert.throws(() => cleanPatch({ stage: "sent" }), /Unknown stage/);
  assert.throws(() => cleanPatch({ email: "nope" }), /doesn't look right/);
  assert.deepEqual(cleanPatch({ email: " Owner@Biz.com ", junk: 1 }), { email: "owner@biz.com" });
});

test("automatic sending: on by the switch, or once the review week is over", () => {
  assert.equal(autoSendOn({ auto_send: false, auto_send_on: "2026-10-31" }, "2026-10-24"), false);
  assert.equal(autoSendOn({ auto_send: false, auto_send_on: "2026-10-31" }, "2026-10-31"), true);
  assert.equal(autoSendOn({ auto_send: true, auto_send_on: null }, "2026-10-24"), true);
  assert.equal(autoSendOn({ auto_send: false, auto_send_on: null }, "2026-10-24"), false);
});

test("website form requests land in the Network as Warm when the database is connected", async () => {
  const w = fakeWorld([]);
  await saveLead({ business: "Pines Tree Service", name: "Sam", phone: "(346) 668-4946", email: "sam@pines.com", industry: "Tree service", kind: "call", when: "Morning", page: "/book-a-call" }, { fetchImpl: w.fetchImpl, env });
  const row = w.rows[0];
  assert.equal(row.stage, "warm");
  assert.equal(row.business, "Pines Tree Service");
  assert.match(row.heads_up, /Call request. Best time: Morning/);
  assert.equal(w.sent.length, 0);
});

test("texts, DMs and contact forms count as reaching out; an unanswered call is only logged", async () => {
  const w = fakeWorld([lead(1, { stage: "call", email: null }), lead(2, { stage: "call", email: null })]);
  const { markContact } = await import("../api/_network.js");
  let row = await markContact(id(1), "text", { ...w, env, today: "2026-10-29" });
  assert.equal(row.stage, "messaged");
  assert.equal(row.follow_up_on, "2026-11-01");
  assert.match(row.log, /Texted/);
  row = await markContact(id(2), "no_answer", { ...w, env, today: "2026-10-29" });
  assert.equal(row.stage, "call");
  assert.match(row.log, /no answer/);
  await assert.rejects(markContact(id(2), "pigeon", { ...w, env }), /Unknown way/);
});
