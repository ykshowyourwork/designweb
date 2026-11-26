// Callers: they sign in with their own password and can only read the call list, log calls and add leads.
// Everything else (drafts, sending, settings, inviting) is refused on the server.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { signIn } from "../api/_auth.js";
import { callerLog, forCaller } from "../api/_callers.js";
import networkHandler from "../api/network.js";
import callHandler from "../api/call.js";

const ID1 = "11111111-1111-1111-1111-111111111111";
const ID2 = "22222222-2222-2222-2222-222222222222";
const ID3 = "33333333-3333-3333-3333-333333333333";
let db;
let emailsSent;

function fresh() {
  db = {
    callers: [
      { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "Essence", email: "caller@example.com", active: true },
      { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "Old", email: "off@example.com", active: false },
    ],
    network: [
      {
        id: ID1, business: "Roof Top Roofing", stage: "call", call_rank: 1, fit_score: 9, phone: "(424) 781-8722", area: "Torrance", category: "Roofer",
        email: "owner@rooftop.com", email_subject: "Quick idea", email_draft: "SECRET DRAFT", followup_draft: "SECRET FOLLOW", deck_url: "https://deck", package: "Full stack", budget: "$7,500",
        research: { pitch: "Say this", owner: "Sam", lead_tier: "Growth ($3,500 + $300/mo)" }, tags: [], log: "2026-11-20 Email sent to owner@rooftop.com: \"Quick idea\"",
      },
      { id: ID2, business: "Said Stop LLC", stage: "call", call_rank: 2, tags: ["unsubscribed"], phone: "555" },
      { id: ID3, business: "Passed Co", stage: "pass", call_rank: 3, tags: [], phone: "556" },
    ],
    calls: [],
  };
  emailsSent = 0;
}

const reply = (status, data) => ({ ok: status < 300, status, json: async () => data, text: async () => (data == null ? "" : JSON.stringify(data)) });

// A stand-in for Supabase (Auth + REST) and Resend.
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const body = init.body ? JSON.parse(init.body) : undefined;
  if (u.host === "api.resend.com") {
    emailsSent += 1;
    return reply(200, { id: "em_1" });
  }
  if (u.pathname.startsWith("/auth/v1/")) {
    const grant = u.searchParams.get("grant_type");
    const tokens = { "tok-caller": "caller@example.com", "tok-off": "off@example.com", "tok-owner": "gethelp@desiweb.org" };
    if (grant === "password") {
      const email = body.email.toLowerCase();
      if (body.password !== "right") return reply(400, {});
      const tok = Object.entries(tokens).find(([, e]) => e === email)?.[0];
      return reply(200, { access_token: tok, refresh_token: "r", expires_at: 2000000000, user: { email } });
    }
    if (u.pathname.endsWith("/user")) {
      const email = tokens[String(init.headers.authorization).replace("Bearer ", "")];
      return email ? reply(200, { email }) : reply(401, {});
    }
    if (u.pathname.endsWith("/admin/users")) return reply(200, { id: "u1" });
    if (u.pathname.endsWith("/admin/generate_link")) return reply(200, { hashed_token: "h" });
    throw new Error(`unexpected auth ${url}`);
  }
  const table = u.pathname.replace("/rest/v1/", "");
  const eq = (k) => u.searchParams.get(k)?.replace(/^eq\./, "");
  if (table === "network_callers") {
    if (init.method === "GET") {
      let list = db.callers;
      if (eq("email")) list = list.filter((k) => k.email === decodeURIComponent(eq("email")));
      if (u.searchParams.get("active") === "eq.true") list = list.filter((k) => k.active);
      return reply(200, list);
    }
    return reply(200, [db.callers[0]]);
  }
  if (table === "network_calls") {
    if (init.method === "POST") db.calls.push(body);
    return reply(200, init.method === "GET" ? db.calls : null);
  }
  if (table === "network_settings") return reply(200, [{ auto_send: false, batch_size: 10 }]);
  if (table === "network") {
    if (init.method === "GET") return reply(200, eq("id") ? db.network.filter((r) => r.id === eq("id")) : db.network);
    if (init.method === "PATCH") {
      const r = db.network.find((x) => x.id === eq("id"));
      Object.assign(r, body);
      return reply(200, [r]);
    }
    if (init.method === "POST") {
      const r = { id: "44444444-4444-4444-4444-444444444444", ...body };
      db.network.push(r);
      return reply(200, [r]);
    }
  }
  throw new Error(`unexpected ${init.method} ${url}`);
};
process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
process.env.RESEND_API_KEY = "re_test";

async function hit(h, { token, method = "GET", body } = {}) {
  let status = 0;
  let data;
  const res = { status: (s) => ((status = s), { json: (d) => (data = d) }) };
  await h({ method, body, query: {}, headers: token ? { authorization: `Bearer ${token}` } : {} }, res);
  return { status, data };
}
const asCaller = (h, o) => hit(h, { token: "tok-caller", ...o });

beforeEach(fresh);

test("a caller signs in with their own password and their session says caller", async () => {
  fresh();
  const s = await signIn("caller@example.com", "right");
  assert.equal(s.role, "caller");
  assert.equal(s.name, "Essence");
  await assert.rejects(signIn("off@example.com", "right"), (e) => e.status === 401);
  await assert.rejects(signIn("stranger@example.com", "right"), (e) => e.status === 401);
});

test("the owner still signs in as admin, without touching the callers table", async () => {
  const s = await signIn("gethelp@desiweb.org", "right");
  assert.equal(s.role, "admin");
});

test("a caller can't read drafts, send, change settings or invite: the Network API turns them away", async () => {
  for (const body of [undefined, { action: "send", id: ID1 }, { action: "send-batch" }, { action: "settings", patch: { auto_send: true } }, { action: "update", id: ID1, patch: { stage: "lead" } }, { action: "invite-caller", name: "X", email: "x@example.com" }, { action: "run-today" }]) {
    const r = await asCaller(networkHandler, { method: body ? "POST" : "GET", body });
    assert.equal(r.status, 401, `network ${body?.action ?? "GET"}`);
    assert.equal(JSON.stringify(r.data).includes("SECRET"), false);
  }
  assert.equal(emailsSent, 0);
});

test("the call list API gives a caller the list without emails, drafts, decks, prices, or anyone who said stop", async () => {
  const r = await asCaller(callHandler);
  assert.equal(r.status, 200);
  assert.equal(r.data.me.name, "Essence");
  assert.deepEqual(r.data.rows.map((x) => x.business), ["Roof Top Roofing"]);
  const row = r.data.rows[0];
  for (const k of ["email", "email_subject", "email_draft", "followup_draft", "deck_url", "package", "budget"]) assert.equal(k in row, false, k);
  assert.equal(row.research.pitch, "Say this");
  assert.equal("lead_tier" in row.research, false);
  assert.equal(JSON.stringify(r.data).includes("SECRET"), false);
  assert.equal(JSON.stringify(r.data).includes("owner@rooftop.com"), false);
});

test("on the call API a caller can only log and add: send, settings and update are refused", async () => {
  for (const action of ["send", "send-batch", "settings", "update", "mark", "invite-caller"]) {
    const r = await asCaller(callHandler, { method: "POST", body: { action, id: ID1 } });
    assert.equal(r.status, 400, action);
  }
  assert.equal(emailsSent, 0);
  assert.equal(db.network[0].stage, "call");
});

test("a turned-off caller and a stranger can't use the call list", async () => {
  assert.equal((await hit(callHandler, { token: "tok-off" })).status, 401);
  assert.equal((await hit(callHandler, { token: "nope" })).status, 401);
  assert.equal((await hit(callHandler, {})).status, 401);
});

test("logging calls writes the caller's name and moves the stage", async () => {
  let r = await asCaller(callHandler, { method: "POST", body: { action: "log", id: ID1, result: "voicemail" } });
  assert.equal(r.status, 200);
  assert.equal(db.network[0].stage, "call");
  assert.match(db.network[0].log, /Called \(Essence\): left a voicemail$/);

  r = await asCaller(callHandler, { method: "POST", body: { action: "log", id: ID1, result: "booked" } });
  assert.equal(r.status, 400); // needs a time
  r = await asCaller(callHandler, { method: "POST", body: { action: "log", id: ID1, result: "booked", at: "2030-01-05T18:00:00Z", note: "Wants a quote" } });
  assert.equal(r.status, 200);
  assert.equal(db.network[0].stage, "yes");
  assert.equal(db.network[0].booked_at, "2030-01-05T18:00:00.000Z");
  assert.ok(db.network[0].tags.includes("booked"));
  assert.match(db.network[0].log, /Called \(Essence\): booked a call with Jordan for .*Wants a quote/);
  assert.equal(r.data.email_draft, undefined);
  assert.deepEqual(db.calls.map((c) => [c.caller_email, c.result]), [["caller@example.com", "voicemail"], ["caller@example.com", "booked"]]);
});

test("not interested → Pass, call back → a call-back day, and passed rows can't be logged by a caller", async () => {
  await asCaller(callHandler, { method: "POST", body: { action: "log", id: ID1, result: "call_back", on: "2099-01-01" } });
  assert.equal(db.network[0].call_back_on, "2099-01-01");
  await asCaller(callHandler, { method: "POST", body: { action: "log", id: ID1, result: "not_interested" } });
  assert.equal(db.network[0].stage, "pass");
  assert.equal(db.network[0].call_back_on, null);
  const r = await asCaller(callHandler, { method: "POST", body: { action: "log", id: ID3, result: "talked" } });
  assert.equal(r.status, 403);
});

test("a caller's own lead lands on the list tagged with their name", async () => {
  const r = await asCaller(callHandler, { method: "POST", body: { action: "add", lead: { business: "New Tree Co", phone: "555-0101", area: "Pasadena", category: "Tree service", notes: "Met at Home Depot", email: "sneaky@x.com", stage: "yes" } } });
  assert.equal(r.status, 200);
  const row = db.network.at(-1);
  assert.equal(row.stage, "call");
  assert.deepEqual(row.tags, ["Essence"]);
  assert.equal(row.added_by, "caller@example.com");
  assert.equal(row.email, undefined);
});

test("the owner can invite a caller; an owner email can't be made a caller", async () => {
  const ok = await hit(networkHandler, { token: "tok-owner", method: "POST", body: { action: "invite-caller", name: "Essence", email: "caller@example.com" } });
  assert.equal(ok.status, 200);
  assert.equal(emailsSent, 1);
  const no = await hit(networkHandler, { token: "tok-owner", method: "POST", body: { action: "invite-caller", name: "Me", email: "gethelp@desiweb.org" } });
  assert.equal(no.status, 400);
});

test("sending is still blocked for pass and unsubscribed rows", async () => {
  const r = await hit(networkHandler, { token: "tok-owner", method: "POST", body: { action: "send", id: ID3, force: true } });
  assert.equal(r.status, 400); // no email on this row
  db.network[1].email = "stop@example.com";
  const s = await hit(networkHandler, { token: "tok-owner", method: "POST", body: { action: "send", id: ID2, force: true } });
  assert.equal(s.status, 409);
  assert.equal(emailsSent, 0);
});

test("history shown to callers has no email addresses or subjects", () => {
  assert.equal(callerLog('2026-11-20 Email sent to a@b.com: "Hi"\n2026-11-21 Follow-up 1 sent to a@b.com: "Again"\n2026-11-22 Note from x@y.org'), "2026-11-20 Email sent\n2026-11-21 Follow-up 1 sent\n2026-11-22 Note from their email");
  assert.equal(forCaller({ id: "x", email: "a@b.com", tags: ["unsubscribed", "vip"] }).email, undefined);
});
