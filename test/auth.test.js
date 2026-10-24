import { test } from "node:test";
import assert from "node:assert/strict";
import { refresh, requireOwner, signIn } from "../api/_auth.js";

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
