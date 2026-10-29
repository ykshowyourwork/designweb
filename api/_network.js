// The Network: DesiWeb's outreach list, stored in Supabase (table `network`),
// with emails sent through Resend from gethelp@desiweb.org.
//
//   Owner page  /admin/network → api/network.js     (x-admin-key = ADMIN_PASSWORD)
//   Daily routine               → api/network-api.js (x-network-key = NETWORK_API_KEY)
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY.
// Every function takes { fetchImpl, env, today } so tests can run without the network.

import { HttpError } from "./_core.js";

export const STAGES = ["warm", "lead", "call", "messaged", "follow_up", "followed_up", "replied", "yes", "pass"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f-]{36}$/i;

export const SENDER = "Jordan at DesiWeb";
export const FROM_ADDRESS = "gethelp@desiweb.org";
export const FOOTER =
  "\n\n--\nDesiWeb · desiweb.org\n7300 W Sunset Blvd, Ste L #801, Los Angeles, CA 90046\nNot interested? Reply \"no thanks\" and we won't email you again.";

// Fields the owner page and the routine may write. Everything else is the server's.
const WRITABLE = [
  "business", "stage", "category", "contact_name", "email", "phone", "website", "google_maps", "google_cid", "area",
  "rating", "reviews", "no_website", "unclaimed_google", "package", "budget", "opener", "why_fit", "heads_up",
  "email_subject", "email_draft", "followup_subject", "followup_draft", "deck_url", "demo_url", "notes", "source",
  "tags", "follow_up_on", "notion_page_id", "instagram", "contact_url", "text_draft", "dm_draft", "queue_on",
];

const dayString = (d) => d.toISOString().slice(0, 10);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return dayString(d);
};
const ctx = (o = {}) => ({ fetchImpl: o.fetchImpl ?? fetch, env: o.env ?? process.env, today: o.today ?? dayString(new Date()) });

/** Keeps only known fields, trims text, and checks stage and email. */
export function cleanPatch(p = {}) {
  const out = {};
  for (const k of WRITABLE) {
    if (!(k in p)) continue;
    let v = p[k];
    if (typeof v === "string") v = v.trim().slice(0, k.endsWith("draft") ? 5000 : 500) || null;
    out[k] = v;
  }
  if ("stage" in out && !STAGES.includes(out.stage)) throw new HttpError(400, "Unknown stage.");
  if (out.email) {
    out.email = String(out.email).toLowerCase();
    if (!EMAIL.test(out.email)) throw new HttpError(400, `That email doesn't look right: ${out.email}`);
  }
  if ("business" in out && !out.business) throw new HttpError(400, "Add the business name.");
  if (out.tags && !Array.isArray(out.tags)) out.tags = String(out.tags).split(",").map((t) => t.trim()).filter(Boolean);
  return out;
}

// ── Supabase (PostgREST) ──
async function db(c, method, path, body, prefer) {
  const { SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: key } = c.env;
  if (!base || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  const res = await c.fetchImpl(`${base.replace(/\/$/, "")}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Database said ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export const networkReady = (env = process.env) => Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

export async function getSettings(o) {
  const c = ctx(o);
  const rows = await db(c, "GET", "network_settings?id=eq.1&select=*");
  return rows?.[0] ?? { auto_send: false, auto_send_on: null, batch_size: 10 };
}

export async function setSettings(patch, o) {
  const c = ctx(o);
  const out = {};
  if ("auto_send" in patch) {
    out.auto_send = Boolean(patch.auto_send);
    // Turning it off also cancels the planned switch-on at the end of the review week.
    if (!out.auto_send) out.auto_send_on = null;
  }
  if ("batch_size" in patch) {
    const n = Math.round(Number(patch.batch_size));
    if (!(n >= 1 && n <= 50)) throw new HttpError(400, "Batch size has to be 1 to 50.");
    out.batch_size = n;
  }
  out.updated_at = new Date().toISOString();
  const rows = await db(c, "PATCH", "network_settings?id=eq.1", out, "return=representation");
  return rows?.[0];
}

/** Automatic sending is on when the switch is on, or once the review week has passed. */
export const autoSendOn = (s, today) => Boolean(s.auto_send || (s.auto_send_on && today >= s.auto_send_on));

export async function listRows(o) {
  const c = ctx(o);
  return db(c, "GET", "network?select=*&order=updated_at.desc&limit=5000");
}

export async function getRow(id, o) {
  if (!UUID.test(String(id))) throw new HttpError(400, "Bad id.");
  const rows = await db(ctx(o), "GET", `network?id=eq.${id}&select=*`);
  if (!rows?.length) throw new HttpError(404, "Not found.");
  return rows[0];
}

export async function addRow(patch, o) {
  const p = cleanPatch(patch);
  if (!p.business) throw new HttpError(400, "Add the business name.");
  p.stage ??= p.email ? "lead" : "call";
  p.source ??= "Added by hand";
  const rows = await db(ctx(o), "POST", "network", p, "return=representation");
  return rows[0];
}

export async function updateRow(id, patch, o) {
  if (!UUID.test(String(id))) throw new HttpError(400, "Bad id.");
  const rows = await db(ctx(o), "PATCH", `network?id=eq.${id}`, cleanPatch(patch), "return=representation");
  if (!rows?.length) throw new HttpError(404, "Not found.");
  return rows[0];
}

/** Adds or updates many rows at once (the routine and imports). Matches on google_cid, then email. */
export async function upsertRows(list, o) {
  const c = ctx(o);
  if (!Array.isArray(list) || !list.length) throw new HttpError(400, "Send a list of rows.");
  if (list.length > 500) throw new HttpError(400, "500 rows at most per call.");
  const rows = list.map((r) => {
    const p = cleanPatch(r);
    if (!p.business) throw new HttpError(400, "Every row needs a business name.");
    return p;
  });

  // Find the ones already on the list, by Google listing id or email.
  const quote = (v) => `"${String(v).replace(/"/g, "")}"`;
  const cids = [...new Set(rows.map((r) => r.google_cid).filter(Boolean))];
  const emails = [...new Set(rows.map((r) => r.email).filter(Boolean))];
  const existing = [];
  for (let i = 0; i < cids.length; i += 100) {
    existing.push(...((await db(c, "GET", `network?google_cid=in.(${cids.slice(i, i + 100).map(quote).join(",")})&select=id,google_cid,email`)) ?? []));
  }
  for (let i = 0; i < emails.length; i += 100) {
    existing.push(...((await db(c, "GET", `network?email=in.(${emails.slice(i, i + 100).map(quote).join(",")})&select=id,google_cid,email`)) ?? []));
  }
  const match = (r) => existing.find((e) => (r.google_cid && e.google_cid === r.google_cid) || (r.email && e.email === r.email));

  // Existing rows: update only what was sent (never reset their stage unless asked).
  let updated = 0;
  const fresh = [];
  for (const r of rows) {
    const e = match(r);
    if (e) {
      await db(c, "PATCH", `network?id=eq.${e.id}`, r);
      updated += 1;
    } else fresh.push({ ...r, stage: r.stage ?? (r.email ? "lead" : "call") });
  }
  // New rows: one insert, skipping any duplicate that slipped in.
  // Drop repeats inside this same list (same Google id or email).
  const seen = new Set();
  const unique = fresh.filter((r) => {
    const keys = [r.google_cid && `c:${r.google_cid}`, r.email && `e:${r.email}`].filter(Boolean);
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
  let added = 0;
  if (unique.length) {
    const columns = [...new Set(unique.flatMap(Object.keys))].join(",");
    added = (await db(c, "POST", `network?columns=${columns}`, unique, "missing=default,return=representation"))?.length ?? 0;
  }
  return { added, updated };
}

// ── Email (Resend) ──
async function sendEmail(c, { to, subject, text }) {
  const key = c.env.RESEND_API_KEY;
  if (!key) throw new HttpError(500, "The email service key (RESEND_API_KEY) is missing on the server.");
  const res = await c.fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${SENDER} <${FROM_ADDRESS}>`, to: [to], reply_to: FROM_ADDRESS, bcc: [FROM_ADDRESS], subject, text: text + FOOTER }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, `The email service refused it: ${data.message || res.status}`);
  return data.id;
}

const stamp = (row, line, today) => `${row.log ? `${row.log}\n` : ""}${today} ${line}`;

/** Sends a first email or a follow-up to one row, then moves it along. */
export async function sendOne(id, { subject, body, force = false } = {}, o) {
  const c = ctx(o);
  const row = await getRow(id, c);
  const to = String(row.email ?? "").trim();
  if (!EMAIL.test(to)) throw new HttpError(400, "This business has no email address.");
  const isFollowUp = row.stage === "follow_up";
  if (!isFollowUp && !["lead", "warm"].includes(row.stage) && !force) {
    throw new HttpError(409, `Already contacted (${row.stage}). Send anyway from the card if you mean it.`);
  }
  const subj = String(subject ?? (isFollowUp ? row.followup_subject : row.email_subject) ?? "").trim().slice(0, 200);
  const text = String(body ?? (isFollowUp ? row.followup_draft : row.email_draft) ?? "").trim().slice(0, 5000);
  if (!subj || !text) throw new HttpError(400, "Add a subject and a message.");
  await sendEmail(c, { to, subject: subj, text });

  const patch = { last_contact_at: new Date().toISOString() };
  if (isFollowUp) {
    patch.followups = (row.followups ?? 0) + 1;
    if (patch.followups < 2) Object.assign(patch, { stage: "messaged", follow_up_on: addDays(c.today, 7) });
    else Object.assign(patch, { stage: "followed_up", follow_up_on: null });
    patch.log = stamp(row, `Follow-up ${patch.followups} sent to ${to}: "${subj}"`, c.today);
  } else {
    Object.assign(patch, { stage: "messaged", sent_on: c.today, follow_up_on: addDays(c.today, 3), email_subject: subj, email_draft: text });
    patch.log = stamp(row, `Email sent to ${to}: "${subj}"`, c.today);
  }
  const rows = await db(c, "PATCH", `network?id=eq.${row.id}`, patch, "return=representation");
  return rows[0];
}

const CHANNELS = {
  text: "Texted",
  dm: "Instagram DM sent",
  form: "Contact form sent",
  email: "Emailed from my own inbox",
  talked: "Called: talked to them",
  no_answer: "Called: no answer",
  voicemail: "Called: left a voicemail",
};

/** Jordan reached out by hand (text, call, DM, form). Reaching them counts like an email: Sent, follow up in 3 days.
 *  A call nobody picked up is only logged, and the business stays on today's list. */
export async function markContact(id, channel, o) {
  const c = ctx(o);
  if (!CHANNELS[channel]) throw new HttpError(400, "Unknown way of reaching out.");
  const row = await getRow(id, c);
  const patch = { last_contact_at: new Date().toISOString(), log: stamp(row, CHANNELS[channel], c.today) };
  if (!["no_answer", "voicemail"].includes(channel)) {
    if (row.stage === "follow_up") {
      patch.followups = (row.followups ?? 0) + 1;
      if (patch.followups < 2) Object.assign(patch, { stage: "messaged", follow_up_on: addDays(c.today, 7) });
      else Object.assign(patch, { stage: "followed_up", follow_up_on: null });
    } else if (["lead", "call", "warm"].includes(row.stage)) {
      Object.assign(patch, { stage: "messaged", sent_on: c.today, follow_up_on: addDays(c.today, 3) });
    }
  }
  const rows = await db(c, "PATCH", `network?id=eq.${row.id}`, patch, "return=representation");
  return rows[0];
}

/** Moves sent rows whose follow-up date has come into "follow_up" so the routine can write the follow-up. */
export async function markDueFollowUps(o) {
  const c = ctx(o);
  const rows = await db(c, "PATCH", `network?stage=eq.messaged&follow_up_on=lte.${c.today}&followups=lt.2`, { stage: "follow_up" }, "return=representation");
  return { due: rows?.length ?? 0 };
}

/** What "Send today's batch" would send: new emails (up to the batch size) plus follow-ups that have a draft. */
export function pickBatch(rows, batchSize) {
  const ready = (r, d) => EMAIL.test(String(r.email ?? "")) && r[d];
  const fresh = rows
    .filter((r) => (r.stage === "lead" || r.stage === "warm") && ready(r, "email_draft") && r.email_subject)
    .sort((a, b) => (b.reviews ?? 0) - (a.reviews ?? 0))
    .slice(0, batchSize);
  const followUps = rows.filter((r) => r.stage === "follow_up" && ready(r, "followup_draft") && r.followup_subject);
  return { fresh, followUps };
}

/** Sends today's batch. One failure doesn't stop the rest; each result is reported. */
export async function sendBatch(o) {
  const c = ctx(o);
  const settings = await getSettings(c);
  const { fresh, followUps } = pickBatch(await listRows(c), settings.batch_size ?? 10);
  const results = [];
  for (const r of [...fresh, ...followUps]) {
    try {
      await sendOne(r.id, {}, c);
      results.push({ id: r.id, business: r.business, ok: true });
    } catch (e) {
      results.push({ id: r.id, business: r.business, ok: false, error: e.message });
    }
  }
  return { sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
}
