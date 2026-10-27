// One-time move: copies the two Notion lists into the Network (desiweb.org/admin/network).
//   "Website Cold Call List"  → stage from its Status (Not called = call, Won = yes, …)
//   "DesignWeb Inbound Leads" → website form requests (New = warm)
// Safe to run again: rows already in the Network (same Google listing or email) are updated, not doubled.
//
// Run it with scripts/import-notion.sh, which loads the keys from Vercel without showing them.
// Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NOTION_TOKEN, and the Notion integration
// "DesiWeb site" connected to both lists (••• → Connections).
import { upsertRows } from "../api/_network.js";

export const COLD_CALL_DB = "67184cda17ee4835b65d157259e2a353";
export const INBOUND_DB = "9333b0479f054dbcb1f79abf3177d868";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Reads any Notion property as plain text, number, boolean or null.
export function value(prop) {
  if (!prop) return null;
  switch (prop.type) {
    case "title":
    case "rich_text":
      return prop[prop.type].map((t) => t.plain_text).join("").trim() || null;
    case "select":
    case "status":
      return prop[prop.type]?.name ?? null;
    case "number":
      return prop.number;
    case "checkbox":
      return prop.checkbox;
    case "url":
      return prop.url || null;
    case "email":
      return prop.email || null;
    case "phone_number":
      return prop.phone_number || null;
    case "date":
      return prop.date?.start ?? null;
    case "created_time":
      return prop.created_time;
    default:
      return null;
  }
}

const cidOf = (url) => (url ? (/[?&]cid=(\d+)/.exec(url) ?? [])[1] ?? null : null);
const email = (v) => (v && EMAIL.test(v.trim()) ? v.trim().toLowerCase() : null);

const COLD_STAGE = {
  "Not called": "call",
  "No answer": "call",
  Voicemail: "call",
  "Call back": "call",
  "Demo booked": "replied",
  Won: "yes",
  "Not interested": "pass",
};
const INBOUND_STAGE = { New: "warm", Contacted: "replied", "Mockup sent": "replied", Won: "yes", Lost: "pass" };

/** A "Website Cold Call List" page → a Network row. */
export function coldCallRow(page) {
  const p = page.properties;
  const status = value(p.Status);
  const notes = [value(p.Notes), status && !["Not called", "Won", "Not interested", "Demo booked"].includes(status) ? `Last call: ${status}.` : null]
    .filter(Boolean)
    .join(" ");
  return {
    business: value(p.Business),
    stage: COLD_STAGE[status] ?? "call",
    category: value(p.Category),
    phone: value(p.Phone),
    website: value(p.Website),
    google_maps: value(p["Google Maps"]),
    google_cid: cidOf(value(p["Google Maps"])),
    area: value(p.Area),
    rating: value(p.Rating),
    reviews: value(p.Reviews),
    no_website: Boolean(value(p["No website"])),
    unclaimed_google: Boolean(value(p["Unclaimed Google"])),
    package: value(p.Package),
    opener: value(p.Opener),
    notes: notes || null,
    follow_up_on: value(p["Follow up"]),
    source: "Notion: Website Cold Call List",
    notion_page_id: page.id,
  };
}

/** A "DesignWeb Inbound Leads" page (a website form request) → a Network row. */
export function inboundRow(page) {
  const p = page.properties;
  return {
    business: value(p.Business),
    stage: INBOUND_STAGE[value(p.Status)] ?? "warm",
    contact_name: value(p.Name),
    email: email(value(p.Email)),
    phone: value(p.Phone),
    category: value(p.Industry),
    website: value(p["Current website"]),
    google_maps: value(p["Google listing"]),
    budget: value(p.Budget),
    heads_up: value(p.Message),
    source: `Website form (${value(p.Page) || "/free-mockup"})`,
    notion_page_id: page.id,
  };
}

// Every page of a Notion database (100 at a time).
export async function allPages(dbId, { fetchImpl = fetch, env = process.env } = {}) {
  const pages = [];
  let cursor;
  do {
    const res = await fetchImpl(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.NOTION_TOKEN}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
    });
    const data = await res.json();
    if (!res.ok) {
      const hint = res.status === 404 ? ' Connect the "DesiWeb site" integration to this list in Notion (••• → Connections).' : "";
      throw new Error(`Notion said ${res.status} for list ${dbId}: ${data.message ?? ""}${hint}`);
    }
    pages.push(...data.results.filter((r) => !r.archived && !r.in_trash));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return pages;
}

async function main() {
  for (const k of ["NOTION_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[k]) throw new Error(`${k} is not set in Vercel yet. Run scripts/set-secrets.sh first.`);
  }
  const lists = [
    ["Website Cold Call List", COLD_CALL_DB, coldCallRow],
    ["DesignWeb Inbound Leads", INBOUND_DB, inboundRow],
  ];
  for (const [name, id, toRow] of lists) {
    const rows = (await allPages(id)).map(toRow).filter((r) => r.business && !/^TEST\b/i.test(r.business));
    let added = 0;
    let updated = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const r = await upsertRows(rows.slice(i, i + 200));
      added += r.added;
      updated += r.updated;
    }
    console.log(`${name}: ${rows.length} rows → ${added} added, ${updated} already there (updated).`);
  }
  console.log("Done. Open https://desiweb.org/admin/network");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
