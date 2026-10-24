// Owner sign-in for /admin and /admin/network: email + password accounts in
// Supabase Auth (Authentication → Users). New sign-ups are off, so only the
// accounts made in the dashboard can get in. ADMIN_EMAILS (comma list) narrows
// it further if set. The old ADMIN_PASSWORD header still works as a fallback.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS (optional).
import { HttpError, checkAdmin } from "./_core.js";

const opts = (c = {}) => ({ fetchImpl: c.fetchImpl ?? fetch, env: c.env ?? process.env });

async function gotrue(path, init, c) {
  const { SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: key } = c.env;
  if (!base || !key) throw new HttpError(503, "Sign-in isn't connected yet (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).");
  const res = await c.fetchImpl(`${base.replace(/\/$/, "")}/auth/v1/${path}`, {
    ...init,
    headers: { apikey: key, "content-type": "application/json", ...init.headers },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function allowed(email, env) {
  const list = String(env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !list.length || list.includes(String(email ?? "").toLowerCase());
}

const session = (d) => ({ token: d.access_token, refresh: d.refresh_token, expiresAt: d.expires_at, email: d.user?.email });

/** Email + password → a session, or 401. */
export async function signIn(email, password, c) {
  c = opts(c);
  if (!email || !password) throw new HttpError(400, "Enter your email and password.");
  const r = await gotrue("token?grant_type=password", { method: "POST", body: JSON.stringify({ email: String(email).trim(), password: String(password) }) }, c);
  if (!r.ok || !allowed(r.data.user?.email, c.env)) throw new HttpError(401, "Wrong email or password.");
  return session(r.data);
}

/** A refresh token → a new session, so the page stays signed in. */
export async function refresh(refreshToken, c) {
  c = opts(c);
  const r = await gotrue("token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: String(refreshToken ?? "") }) }, c);
  if (!r.ok || !allowed(r.data.user?.email, c.env)) throw new HttpError(401, "Please sign in again.");
  return session(r.data);
}

/** Lets the request through if it carries a signed-in owner's token (or the old admin password). */
export async function requireOwner(req, c) {
  c = opts(c);
  const bearer = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ""))?.[1];
  if (!bearer) return checkAdmin(req);
  const r = await gotrue("user", { method: "GET", headers: { authorization: `Bearer ${bearer}` } }, c);
  if (!r.ok || !r.data.email || !allowed(r.data.email, c.env)) throw new HttpError(401, "Please sign in again.");
  return r.data.email;
}
