// Reads the gethelp@desiweb.org inbox (Apple Mail, account "Desiweb") and updates the CRM:
//   - a business that wrote back  -> stage "replied" (follow-ups stop)
//   - a business that said stop    -> stage "pass" + tag "unsubscribed" (never emailed again)
//   - an automatic out-of-office  -> logged only
// Run: node scripts/mark-replies.mjs [--days 45] [--dry]
// Runs on the Mac (it needs Mail), hourly from the scheduled task "desiweb-mark-replies".
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const DAYS = args.includes("--days") ? +args[args.indexOf("--days") + 1] : 45;
const DRY = args.includes("--dry");
const PROJECT = "ugylbemtlemmvltbitmb";
const RS = "\u001e", US = "\u001f"; // record / field separators

// 1. Pull recent inbox messages out of Mail.
const script = `
set RS to (ASCII character 30)
set US to (ASCII character 31)
set cutoff to (current date) - (${DAYS} * days)
set out to ""
with timeout of 300 seconds
tell application "Mail"
  set ib to mailbox "INBOX" of account "Desiweb"
  repeat with m in (messages of ib whose date received > cutoff)
    set c to content of m
    if (length of c) > 1500 then set c to text 1 thru 1500 of c
    set d to date received of m
    set iso to ((year of d) as text) & "-" & text -2 thru -1 of ("0" & ((month of d) as integer)) & "-" & text -2 thru -1 of ("0" & (day of d))
    set out to out & (sender of m) & US & (subject of m) & US & iso & US & c & RS
  end repeat
end tell
end timeout
return out`;
const raw = execFileSync("osascript", ["-e", script], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024, timeout: 330000 });
const mails = raw.split(RS).map((r) => r.split(US)).filter((f) => f.length >= 4).map(([sender, subject, date, body]) => {
  const email = (sender.match(/<([^>]+)>/)?.[1] || sender).trim().toLowerCase();
  // Only what they wrote: cut at the quoted thread.
  const lines = body.split(/\r?\n/);
  const cut = lines.findIndex((l) => /^\s*(On .+wrote:|-----\s*Original|From:\s|>)/i.test(l) || /^On \d{4}-\d{2}-\d{2}/.test(l));
  const reply = (cut >= 0 ? lines.slice(0, cut) : lines).join(" ").replace(/\s+/g, " ").trim();
  return { email, subject: subject.trim(), date, reply };
});

// Not businesses: us and the services we use.
const SKIP = /(desiweb\.org|fatsecret|supabase|resend|theset\.vip|ykentertainment|google\.com|stripe|vercel|github)/i;
const AUTO = /^(automatic reply|auto(matic)?[- ]?reply|out of (the )?office|away:)/i;
const STOP = /\b(stop|unsubscribe|remove me|take me off|no thanks|no thank you|not interested|do not (e-?mail|contact)|don'?t (e-?mail|contact)|stop (e-?mail|messag))/i;

// 2. Load the CRM rows we've emailed.
const sql = (q) => {
  const out = execFileSync("supabase", ["db", "query", "--linked", "--project-ref", PROJECT, q], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
  return JSON.parse(json).rows || [];
};
const rows = sql("select id, business, email, stage, tags, log from network where email is not null and email <> ''");
const byEmail = new Map(rows.map((r) => [String(r.email).trim().toLowerCase(), r]));
const byDomain = new Map(rows.filter((r) => !/@(gmail|yahoo|hotmail|outlook|icloud|aol|me|live|msn)\./i.test(r.email)).map((r) => [String(r.email).split("@")[1]?.toLowerCase(), r]));
const byName = (subject) => { const n = subject.replace(/^(re|fwd?):\s*/i, "").replace(/\s+on Google\s*$/i, "").trim().toLowerCase(); return rows.find((r) => r.business?.toLowerCase() === n); };

// 3. Decide and update, once per reply (the log line is the marker).
const q = (s) => { const tag = "r" + crypto.randomBytes(4).toString("hex"); return `$${tag}$${s}$${tag}$`; };
const results = [];
for (const m of mails) {
  if (SKIP.test(m.email)) continue;
  const row = byEmail.get(m.email) || byDomain.get(m.email.split("@")[1]) || (/on Google/i.test(m.subject) ? byName(m.subject) : null);
  if (!row) continue;
  const marker = `Reply ${m.date}: "${m.subject.slice(0, 80)}"`;
  if ((row.log || "").includes(marker)) continue;
  const said = m.reply.slice(0, 160);
  let stage = null, tags = null, line;
  if (AUTO.test(m.subject) || /out of (the )?office|auto(matic)?[- ]reply/i.test(m.reply.slice(0, 200))) {
    line = `${marker} (automatic reply, nothing changed)`;
  } else if (STOP.test(m.reply)) {
    stage = "pass"; tags = [...new Set([...(row.tags || []), "unsubscribed"])];
    line = `${marker} Asked to stop: "${said}". Unsubscribed.`;
  } else {
    if (["lead", "warm", "call", "messaged", "follow_up", "followed_up"].includes(row.stage)) stage = "replied";
    line = `${marker} They wrote back: "${said}"`;
  }
  results.push({ business: row.business, from: m.email, stage: stage || row.stage, line });
  if (DRY) continue;
  const sets = [`log = coalesce(log || E'\\n','') || ${q(`${new Date().toISOString().slice(0, 10)} ${line}`)}`, "updated_at = now()"];
  if (stage) sets.push(`stage = ${q(stage)}`, "follow_up_on = null");
  if (tags) sets.push(`tags = array[${tags.map(q).join(",")}]::text[]`);
  sql(`update network set ${sets.join(", ")} where id = ${q(row.id)}`);
  row.log = `${row.log || ""}\n${line}`;
}
console.log(results.length ? results.map((r) => `${r.business} (${r.from}) -> ${r.stage}: ${r.line}`).join("\n") : "No new replies.");
