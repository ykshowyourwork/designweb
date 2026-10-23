// Free mockup and call requests from the site go straight into the Notion
// database "DesignWeb Inbound Leads" as a new row with Status = New. Call
// requests start their Message with "Call request" and the best time to call.

import { HttpError } from "./_core.js";

const INDUSTRIES = ["Tree service", "Roofing", "HVAC", "Plumbing", "Salons and barbers", "Wedding vendors", "Other"];
export const BUDGETS = ["Under $5k", "$5k – $15k", "$15k – $25k", "$25k – $40k", "$40k – $75k", "$75k+", "Not sure yet"];
const TIMES = ["Morning", "Midday", "Afternoon", "Evening", "Any time"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const url = (v) => {
  const s = clean(v, 300);
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    return new URL(withScheme).href;
  } catch {
    return null;
  }
};

export function parseLead(body) {
  const lead = {
    business: clean(body.business, 120),
    name: clean(body.name, 120),
    phone: clean(body.phone, 40),
    email: clean(body.email, 200).toLowerCase(),
    industry: INDUSTRIES.includes(body.industry) ? body.industry : "Other",
    google: url(body.google),
    website: url(body.website),
    message: clean(body.message, 1500),
    budget: BUDGETS.includes(body.budget) ? body.budget : null,
    kind: body.kind === "call" ? "call" : "mockup",
    when: TIMES.includes(body.when) ? body.when : "Any time",
    page: clean(body.page, 200),
    // A hidden field people never see; bots fill it in.
    bot: !!clean(body.company),
  };
  if (!lead.business || !lead.name) throw new HttpError(400, "Add your business name and your name.");
  if (lead.phone.replace(/\D/g, "").length < 10) throw new HttpError(400, "Add a phone number we can reach you at.");
  if (!EMAIL.test(lead.email)) throw new HttpError(400, "That email doesn't look right.");
  return lead;
}

const text = (s) => ({ rich_text: s ? [{ text: { content: s } }] : [] });

export function notionPage(lead, databaseId) {
  return {
    parent: { database_id: databaseId },
    properties: {
      Business: { title: [{ text: { content: lead.business } }] },
      Status: { status: { name: "New" } },
      Name: text(lead.name),
      Phone: { phone_number: lead.phone },
      Email: { email: lead.email },
      Industry: { select: { name: lead.industry } },
      Budget: { select: lead.budget ? { name: lead.budget } : null },
      "Google listing": { url: lead.google },
      "Current website": { url: lead.website },
      Message: text(lead.kind === "call" ? `Call request. Best time: ${lead.when}.${lead.message ? ` ${lead.message}` : ""}` : lead.message),
      Page: text(lead.page),
    },
  };
}

export async function saveLead(body, { fetchImpl = fetch, env = process.env } = {}) {
  const lead = parseLead(body);
  if (lead.bot) return { ok: true }; // Pretend it worked so the bot moves on.
  if (!env.NOTION_TOKEN || !env.NOTION_LEADS_DB) throw new Error("NOTION_TOKEN or NOTION_LEADS_DB is not set");
  const res = await fetchImpl("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.NOTION_TOKEN}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: JSON.stringify(notionPage(lead, env.NOTION_LEADS_DB)),
  });
  if (!res.ok) throw new Error(`Notion said ${res.status}: ${await res.text()}`);
  return { ok: true };
}
