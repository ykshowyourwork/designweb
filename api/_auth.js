// Owner sign-in for /admin, /admin/invoices and /admin/network.
// Two ways in, either works:
//   1. The owner's email + the admin password (ADMIN_PASSWORD), same as YKE and The Set.
//   2. The owner's email + their own password on the Supabase Auth account, which they
//      set or reset themselves from the "Forgot password?" email.
// Only the owner emails get in: ADMIN_EMAILS (comma list), else the brand email.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD, ADMIN_EMAILS (optional).
import { timingSafeEqual } from "node:crypto";
import brand from "../brand.json" with { type: "json" };
import { HttpError, checkAdmin, site } from "./_core.js";

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
  const list = String(env.ADMIN_EMAILS || brand.email)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(String(email ?? "").trim().toLowerCase());
}

function isAdminPassword(password, env) {
  const want = String(env.ADMIN_PASSWORD ?? "");
  const got = String(password ?? "");
  return want.length >= 8 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

const session = (d) => ({ token: d.access_token, refresh: d.refresh_token, expiresAt: d.expires_at, email: d.user?.email });

/** Email + password → a session, or 401. */
export async function signIn(email, password, c) {
  c = opts(c);
  if (!email || !password) throw new HttpError(400, "Enter your email and password.");
  // The admin password always works for an owner email.
  if (isAdminPassword(password, c.env)) {
    if (!allowed(email, c.env)) throw new HttpError(401, "Wrong email or password.");
    return { token: `pw:${password}`, refresh: null, expiresAt: null, email: String(email).trim().toLowerCase() };
  }
  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_SERVICE_ROLE_KEY) throw new HttpError(401, "Wrong email or password.");
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
  if (bearer.startsWith("pw:")) return checkAdmin({ headers: { "x-admin-key": bearer.slice(3) } });
  const r = await gotrue("user", { method: "GET", headers: { authorization: `Bearer ${bearer}` } }, c);
  if (!r.ok || !r.data.email || !allowed(r.data.email, c.env)) throw new HttpError(401, "Please sign in again.");
  return r.data.email;
}

/** "Forgot password?": we make a one-time code with Supabase and email our own link through Resend.
 *  The link only opens the page. The code is used when the owner presses Save, so inbox
 *  link-scanners can't use it up first. Says the same thing whether or not the email exists. */
export async function sendReset(email, c) {
  c = opts(c);
  const to = String(email ?? "").trim().toLowerCase();
  if (!allowed(to, c.env)) return { ok: true };
  const r = await gotrue("admin/generate_link", { method: "POST", body: JSON.stringify({ type: "recovery", email: to }) }, c);
  const hash = r.data.hashed_token ?? r.data.properties?.hashed_token;
  if (!r.ok || !hash) return { ok: true };
  const link = `${site()}/admin/reset?code=${encodeURIComponent(hash)}`;
  const key = c.env.RESEND_API_KEY;
  if (!key) throw new HttpError(503, "Email isn't connected yet (RESEND_API_KEY).");
  const res = await c.fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `DesiWeb <${brand.email}>`,
      to: [to],
      subject: "Set your DesiWeb password",
      text: `Tap this link to set your password for the DesiWeb dashboard:\n\n${link}\n\nIt works once, for about an hour. Didn't ask for this? Ignore this email.`,
    }),
  });
  if (!res.ok) throw new HttpError(502, "The reset email didn't send. Try again in a minute.");
  return { ok: true };
}

/** The page from that email sends the code and the new password; we save it and sign in. */
export async function setPassword(code, password, c) {
  c = opts(c);
  if (String(password ?? "").length < 8) throw new HttpError(400, "Use at least 8 characters.");
  const v = await gotrue("verify", { method: "POST", body: JSON.stringify({ type: "recovery", token_hash: String(code ?? "") }) }, c);
  if (!v.ok || !v.data.access_token) throw new HttpError(401, "That link was already used or is over an hour old. Ask for a new one from the sign-in page.");
  const r = await gotrue("user", { method: "PUT", headers: { authorization: `Bearer ${v.data.access_token}` }, body: JSON.stringify({ password: String(password) }) }, c);
  const email = r.data.email ?? v.data.user?.email;
  if (!r.ok || !allowed(email, c.env)) throw new HttpError(401, "That password didn't save. Ask for a new link.");
  return signIn(email, password, c);
}
