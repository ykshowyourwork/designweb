// Callers: people Jordan invites to work the Call list (table network_callers).
// A caller signs in with their own password and can only:
//   1. read the call list (safe fields only: no emails, drafts, decks or prices),
//   2. log a call on a row,
//   3. add their own lead.
// That is enforced by api/call.js, the only endpoint a caller session can use (api/network.js stays owner-only).
//
// Every function takes { fetchImpl, env, today } like _network.js so tests run without the network.
import { HttpError } from "./_core.js";
import { cleanPatch, ctx, db, getRow } from "./_network.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f-]{36}$/i;
const TZ = "America/Los_Angeles";
export const dayKey = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
const lower = (e) => String(e ?? "").trim().toLowerCase();

// ── Who the callers are ──

/** The active caller with this email, or null. */
export async function findCaller(email, o) {
  const e = lower(email);
  if (!EMAIL.test(e)) return null;
  const rows = await db(ctx(o), "GET", `network_callers?email=eq.${encodeURIComponent(e)}&active=eq.true&select=id,name,email`);
  return rows?.[0] ?? null;
}

/** Adds a caller (or turns an old one back on). Returns the caller row. */
export async function saveCaller({ name, email } = {}, o) {
  const c = ctx(o);
  const n = String(name ?? "").trim().slice(0, 80);
  const e = lower(email);
  if (!n) throw new HttpError(400, "Add the caller's name.");
  if (!EMAIL.test(e)) throw new HttpError(400, "That email doesn't look right.");
  const now = new Date().toISOString();
  const found = await db(c, "GET", `network_callers?email=eq.${encodeURIComponent(e)}&select=id`);
  if (found?.length) {
    const rows = await db(c, "PATCH", `network_callers?id=eq.${found[0].id}`, { name: n, active: true, invited_at: now, updated_at: now }, "return=representation");
    return rows[0];
  }
  const rows = await db(c, "POST", "network_callers", { name: n, email: e, active: true, invited_at: now }, "return=representation");
  return rows[0];
}

/** Turns a caller off (they can't sign in or use the list any more) or back on. */
export async function setCallerActive(id, active, o) {
  if (!UUID.test(String(id))) throw new HttpError(400, "Bad id.");
  const rows = await db(ctx(o), "PATCH", `network_callers?id=eq.${id}`, { active: Boolean(active), updated_at: new Date().toISOString() }, "return=representation");
  if (!rows?.length) throw new HttpError(404, "Not found.");
  return rows[0];
}

/** Monday of the week that `key` (YYYY-MM-DD) is in. */
const mondayOf = (key) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

/** Each caller with their calls today, this week (since Monday) and bookings. Jordan's own calls are counted too. */
export async function listCallers(o) {
  const c = ctx(o);
  const now = o?.now ?? Date.now();
  const today = dayKey(now);
  const monday = mondayOf(today);
  const since = new Date(new Date(`${monday}T00:00:00Z`).getTime() - 24 * 3600 * 1000).toISOString();
  const [callers, recent, booked] = await Promise.all([
    db(c, "GET", "network_callers?select=id,name,email,active,invited_at,created_at&order=created_at.asc"),
    db(c, "GET", `network_calls?created_at=gte.${since}&select=caller_email,result,created_at&limit=10000`),
    db(c, "GET", "network_calls?result=eq.booked&select=caller_email&limit=10000"),
  ]);
  const stats = (email) => {
    const mine = (recent ?? []).filter((x) => x.caller_email === email);
    return {
      today: mine.filter((x) => dayKey(x.created_at) === today).length,
      week: mine.filter((x) => dayKey(x.created_at) >= monday).length,
      bookingsWeek: mine.filter((x) => x.result === "booked" && dayKey(x.created_at) >= monday).length,
      bookings: (booked ?? []).filter((x) => x.caller_email === email).length,
    };
  };
  return (callers ?? []).map((k) => ({ ...k, ...stats(k.email) }));
}

// ── What a caller sees ──

// Row fields a caller may see. No email, drafts, decks, demo links, package or budget.
export const CALLER_FIELDS = [
  "id", "business", "contact_name", "phone", "area", "category", "rating", "reviews", "website", "no_website",
  "unclaimed_google", "google_maps", "why_fit", "opener", "heads_up", "call_rank", "fit_score", "stage",
  "call_back_on", "booked_at", "last_called_at", "notes", "log", "added_by", "tags", "research",
];
// Research keys a caller may see (lead_tier and anything with prices stays with Jordan).
const CALLER_RESEARCH = [
  "owner", "years_in_business", "locations", "team_size", "website_status", "website_notes", "pitch", "compliment",
  "listing_active", "social_activity", "services_price_level", "affordability", "affordability_evidence",
];
const EMAIL_IN_TEXT = /[^\s@"<>()]+@[^\s@"<>()]+\.[a-z]{2,}/gi;

/** History lines without email addresses or email subjects. */
export const callerLog = (log) =>
  log
    ? String(log)
        .split("\n")
        .map((l) => (/^(\S+ )?(Email sent|Follow-up \d+ sent)/i.test(l) ? l.replace(/ to .*$/, "") : l.replace(EMAIL_IN_TEXT, "their email")))
        .join("\n")
    : null;

/** Strips a network row down to what a caller may see. */
export function forCaller(r) {
  const out = {};
  for (const k of CALLER_FIELDS) if (k in r) out[k] = r[k];
  if (r.research && typeof r.research === "object") {
    out.research = Object.fromEntries(CALLER_RESEARCH.filter((k) => r.research[k] != null).map((k) => [k, r.research[k]]));
  } else out.research = null;
  out.log = callerLog(r.log);
  out.tags = (r.tags ?? []).filter((t) => t !== "unsubscribed");
  return out;
}

const onCallList = (r) => (r.call_rank != null || r.added_by) && r.stage !== "pass" && !(r.tags ?? []).includes("unsubscribed");

/** The call list: ranked rows and callers' own leads. Never anyone marked pass or unsubscribed. */
export async function callList(o) {
  const c = ctx(o);
  const cols = [...new Set([...CALLER_FIELDS, "tags", "stage"])].join(",");
  const rows = await db(c, "GET", `network?or=(call_rank.not.is.null,added_by.not.is.null)&stage=neq.pass&select=${cols}&order=call_rank.asc.nullslast,created_at.desc&limit=1000`);
  return (rows ?? []).filter(onCallList).map(forCaller);
}

// ── Logging a call ──

export const RESULTS = {
  talked: "talked to them",
  no_answer: "no answer",
  voicemail: "left a voicemail",
  booked: "booked a call with Jordan",
  not_interested: "not interested",
  call_back: "call back",
};

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const when = (t) => new Date(t).toLocaleString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Logs one call. who = { email, name, role }. Writes a history line with the caller's name and moves the stage:
 *  talked → Sent (follow up in 3 days), booked → Yes + booked time, not interested → Pass, call back → call-back day.
 *  No answer and voicemail are only logged. */
export async function logCall(id, { result, at, on, note } = {}, who, o) {
  const c = ctx(o);
  if (!RESULTS[result]) throw new HttpError(400, "Pick what happened on the call.");
  const row = await getRow(id, c);
  if (who.role !== "admin" && !onCallList(row)) throw new HttpError(403, "That business isn't on the call list.");
  const now = new Date(o?.now ?? Date.now());
  const today = dayKey(now);
  const name = who.name || who.email;
  const extra = String(note ?? "").trim().slice(0, 500);

  let bookedFor = null;
  let callBack = null;
  if (result === "booked") {
    const t = new Date(String(at ?? ""));
    if (!at || Number.isNaN(t.getTime())) throw new HttpError(400, "Pick the day and time of the call with Jordan.");
    bookedFor = t.toISOString();
  }
  if (result === "call_back") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(on ?? ""))) throw new HttpError(400, "Pick the day to call back.");
    if (on < today) throw new HttpError(400, "The call-back day has already passed.");
    callBack = on;
  }

  const what = result === "booked" ? `${RESULTS.booked} for ${when(bookedFor)}` : result === "call_back" ? `call back ${callBack}` : RESULTS[result];
  const line = `${today} Called (${name}): ${what}${extra ? `. ${extra.replace(/\n+/g, " ")}` : ""}`;
  const patch = {
    last_called_at: now.toISOString(),
    last_contact_at: now.toISOString(),
    call_back_on: callBack,
    log: row.log ? `${row.log}\n${line}` : line,
  };
  if (result === "talked" && ["lead", "call", "warm"].includes(row.stage)) Object.assign(patch, { stage: "messaged", follow_up_on: addDays(today, 3) });
  if (result === "booked") Object.assign(patch, { stage: "yes", booked_at: bookedFor, follow_up_on: null, tags: [...new Set([...(row.tags ?? []), "booked"])] });
  if (result === "not_interested") Object.assign(patch, { stage: "pass", follow_up_on: null });

  const rows = await db(c, "PATCH", `network?id=eq.${row.id}`, patch, "return=representation");
  await db(c, "POST", "network_calls", { network_id: row.id, caller_email: who.email, caller_name: name, result, note: extra || null, booked_for: bookedFor, call_back_on: callBack }, "return=minimal");
  return rows[0];
}

/** A caller's own lead: lands on the call list, tagged with their name. */
export async function addLead(lead = {}, who, o) {
  const c = ctx(o);
  const p = cleanPatch({ business: lead.business, phone: lead.phone, area: lead.area, category: lead.category, notes: lead.notes, contact_name: lead.contact_name });
  if (!p.business) throw new HttpError(400, "Add the business name.");
  if (!p.phone) throw new HttpError(400, "Add their phone number.");
  const name = who.name || who.email;
  const row = {
    ...p,
    stage: "call",
    source: `Added by ${name} (caller)`,
    tags: [name],
    added_by: who.email,
    log: `${dayKey(o?.now ?? Date.now())} Added by ${name}`,
  };
  const rows = await db(c, "POST", "network", row, "return=representation");
  return rows[0];
}
