import { test } from "node:test";
import assert from "node:assert/strict";
import { refresh, requireOwner, sendReset, setPassword, signIn } from "../api/_auth.js";

const env = { SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "svc", ADMIN_PASSWORD: "old-password-123" };

// A tiny stand-in for Supabase Auth: one account, one live token.
function fakeAuth(email = "gethelp@desiweb.org") {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : {};
    calls.push({ path: u.pathname + u.search, apikey: init.headers.apikey });
    const reply = (status, data) => ({ ok: status < 300, status, json: async () => data });
    const grant = u.searchParams.get("grant_type");
    const sess = { access_token: "tok", refresh_token: "ref2", expires_at: 2000000000, user: { email } };
    if (grant === "password") return body.email === email && body.password === "right" ? reply(200, sess) : reply(400, { error: "invalid_grant" });
    if (grant === "refresh_token") return body.refresh_token === "ref1" ? reply(200, sess) : reply(400, {});
    if (u.pathname.endsWith("/user")) return init.headers.authorization === "Bearer tok" ? reply(200, { email }) : reply(401, {});
    throw new Error(`unexpected ${url}`);
  };
  return { fetchImpl, calls };
}

test("the right email and password sign in; a wrong one is a plain 401", async () => {
  const a = fakeAuth();
  const s = await signIn("gethelp@desiweb.org", "right", { ...a, env });
  assert.deepEqual(s, { token: "tok", refresh: "ref2", expiresAt: 2000000000, email: "gethelp@desiweb.org" });
  await assert.rejects(signIn("gethelp@desiweb.org", "wrong", { ...a, env }), (e) => e.status === 401);
  assert.equal(a.calls[0].apikey, "svc");
});

test("a refresh token renews the session", async () => {
  const a = fakeAuth();
  assert.equal((await refresh("ref1", { ...a, env })).token, "tok");
  await assert.rejects(refresh("nope", { ...a, env }), (e) => e.status === 401);
});

test("owner APIs let in a live token and turn away a bad one", async () => {
  const a = fakeAuth();
  assert.equal(await requireOwner({ headers: { authorization: "Bearer tok" } }, { ...a, env }), "gethelp@desiweb.org");
  await assert.rejects(requireOwner({ headers: { authorization: "Bearer stale" } }, { ...a, env }), (e) => e.status === 401);
});

test("ADMIN_EMAILS keeps out any other account", async () => {
  const a = fakeAuth("someone@else.com");
  const only = { ...env, ADMIN_EMAILS: "gethelp@desiweb.org" };
  await assert.rejects(requireOwner({ headers: { authorization: "Bearer tok" } }, { ...a, env: only }), (e) => e.status === 401);
});

test("the old admin password still works while switching over", async () => {
  process.env.ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  await requireOwner({ headers: { "x-admin-key": "old-password-123" } }, { ...fakeAuth(), env });
  await assert.rejects(requireOwner({ headers: { "x-admin-key": "nope" } }, { ...fakeAuth(), env }), (e) => e.status === 401);
  delete process.env.ADMIN_PASSWORD;
});

test("before Supabase is connected, the old admin password signs in so Invoices never lock", async () => {
  process.env.ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  const none = { ADMIN_PASSWORD: env.ADMIN_PASSWORD };
  const s = await signIn("gethelp@desiweb.org", "old-password-123", { fetchImpl: fakeAuth().fetchImpl, env: none });
  await requireOwner({ headers: { authorization: `Bearer ${s.token}` } }, { env: none });
  await assert.rejects(signIn("gethelp@desiweb.org", "nope-nope-nope", { env: none }), (e) => e.status === 401);
  delete process.env.ADMIN_PASSWORD;
});

test("owner email + admin password signs in even when Supabase is connected; other emails don't", async () => {
  const a = fakeAuth();
  const s = await signIn("gethelp@desiweb.org", "old-password-123", { ...a, env });
  assert.equal(s.token, "pw:old-password-123");
  await assert.rejects(signIn("someone@else.com", "old-password-123", { ...a, env }), (e) => e.status === 401);
});

test("reset: the email link carries a one-time code that is only used when the owner saves", async () => {
  const calls = [];
  const sent = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : {};
    calls.push(u.pathname);
    const reply = (status, data) => ({ ok: status < 300, status, json: async () => data });
    if (u.host === "api.resend.com") { sent.push(body); return reply(200, { id: "e1" }); }
    if (u.pathname.endsWith("/admin/generate_link")) return reply(200, { properties: { hashed_token: "HASH1" } });
    if (u.pathname.endsWith("/verify")) return body.token_hash === "HASH1" ? reply(200, { access_token: "rec", user: { email: "gethelp@desiweb.org" } }) : reply(403, {});
    if (u.pathname.endsWith("/user")) return reply(200, { email: "gethelp@desiweb.org" });
    if (u.searchParams.get("grant_type") === "password") return reply(200, { access_token: "tok", refresh_token: "r", expires_at: 1, user: { email: "gethelp@desiweb.org" } });
    throw new Error(`unexpected ${url}`);
  };
  const e = { ...env, RESEND_API_KEY: "re_x" };
  await sendReset("gethelp@desiweb.org", { fetchImpl, env: e });
  assert.match(sent[0].text, /\/admin\/reset\?code=HASH1/);
  assert.ok(!calls.some((p) => p.endsWith("/verify")), "sending the email must not use the code");
  const s = await setPassword("HASH1", "new-password-1", { fetchImpl, env: e });
  assert.equal(s.token, "tok");
  await assert.rejects(setPassword("OLD", "new-password-1", { fetchImpl, env: e }), (x) => x.status === 401);
  await sendReset("someone@else.com", { fetchImpl, env: e });
  assert.equal(sent.length, 1, "no email for non-owner addresses");
});
