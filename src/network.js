// The owner's Network page: every business DesiWeb reaches out to.
// Same sign-in as invoices. Talks to /api/network.
import { esc } from "./money.js";
import { api as call, signIn } from "./session.js";
import { callCard, wireCallCards } from "./callcard.js";

const $ = (id) => document.getElementById(id);
// Same as the server's noStop: Jordan texts from his own phone, so no "Reply STOP" line.
const noStop = (t) => String(t ?? "").replace(/\s*Reply STOP to opt out\.?/gi, "").trim();

const STAGES = [
  ["warm", "Warm (from the website)"],
  ["lead", "To email"],
  ["call", "To call or text"],
  ["messaged", "Sent"],
  ["follow_up", "Follow-up due"],
  ["followed_up", "Followed up"],
  ["replied", "Replied"],
  ["yes", "Yes"],
  ["pass", "Pass"],
];
const LABEL = Object.fromEntries(STAGES);
const HOT = ["warm", "replied", "yes", "follow_up"];

let rows = [];
let settings = {};
let autoSend = false;
let callers = null;
let tab = new URLSearchParams(location.search).get("tab") || "calllist";
let open = null; // the row in the contact drawer
let picking = null; // a Booked / Call back result waiting for its date
const filters = { trade: "", town: "", site: "", fit: "" };

const api = (method, body) => call("/api/network", method, body);

function toast(text) {
  const t = document.querySelector(".toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 4500);
}

const hasEmail = (r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email ?? "");
const todayIso = () => new Date().toLocaleDateString("en-CA");
const OPEN = ["lead", "call", "warm", "follow_up"];
// Today's list: what the morning routine lined up, plus anything due, minus who was already reached today.
const onToday = (r) => OPEN.includes(r.stage) && ((r.queue_on && r.queue_on <= todayIso()) || (r.stage === "follow_up") || r.stage === "warm");
const doneToday = (r) => r.last_contact_at && new Date(r.last_contact_at).toLocaleDateString("en-CA") === todayIso();
const digits = (p) => String(p ?? "").replace(/[^\d+]/g, "");
const igUrl = (u) => (/^https?:/i.test(u) ? u : `https://instagram.com/${String(u).replace(/^@/, "")}`);
function batchCounts() {
  const fresh = rows.filter((r) => ["lead", "warm"].includes(r.stage) && hasEmail(r) && r.email_draft && r.email_subject).length;
  const follow = rows.filter((r) => r.stage === "follow_up" && hasEmail(r) && r.followup_draft && r.followup_subject).length;
  return { fresh: Math.min(fresh, settings.batch_size ?? 10), follow };
}

// The tabs across the top, like YKE's Network: the call list first, then each stage in order.
const onCallList = (r) => (r.call_rank != null || r.added_by) && r.stage !== "pass" && !(r.tags ?? []).includes("unsubscribed");
const isBooked = (r) => r.stage === "yes" || Boolean(r.booked_at);
const TABS = [
  ["calllist", "Call list", onCallList],
  ["today", "Today", (r) => onToday(r)],
  ["lead", "To email", (r) => ["lead", "warm"].includes(r.stage)],
  ["call", "To call or text", (r) => r.stage === "call"],
  ["messaged", "Sent", (r) => ["messaged", "followed_up"].includes(r.stage)],
  ["follow_up", "Follow-up", (r) => r.stage === "follow_up"],
  ["replied", "Replied", (r) => r.stage === "replied"],
  ["booked", "Booked", isBooked],
  ["pass", "Pass", (r) => r.stage === "pass"],
  ["all", "Everyone", () => true],
];
// Old links (?tab=warm, ?tab=yes…) still land somewhere sensible.
const ALIAS = { warm: "lead", yes: "booked", followed_up: "messaged" };
if (ALIAS[tab]) tab = ALIAS[tab];

const hasSite = (r) => Boolean(r.website) && !r.no_website && r.research?.website_status !== "none";
function passFilters(r) {
  if (filters.trade && (r.category ?? "") !== filters.trade) return false;
  if (filters.town && (r.area ?? "") !== filters.town) return false;
  if (filters.site === "yes" && !hasSite(r)) return false;
  if (filters.site === "no" && hasSite(r)) return false;
  if (filters.fit === "researched" && r.fit_score == null) return false;
  if (/^\d+$/.test(filters.fit) && !((r.fit_score ?? -1) >= Number(filters.fit))) return false;
  return true;
}

// Filter menus list what's on the list, most common first.
function options(field, current, any) {
  const counts = {};
  rows.forEach((r) => r[field] && (counts[r[field]] = (counts[r[field]] ?? 0) + 1));
  const list = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 80);
  return `<option value="">${any}</option>` + list.map(([v, n]) => `<option value="${esc(v)}" ${v === current ? "selected" : ""}>${esc(v)} (${n})</option>`).join("");
}
function renderFilters() {
  $("f-trade").innerHTML = options("category", filters.trade, "Any trade");
  $("f-town").innerHTML = options("area", filters.town, "Any town");
  $("f-site").value = filters.site;
  $("f-fit").value = filters.fit;
  const on = Object.values(filters).filter(Boolean).length;
  $("f-clear").hidden = !on;
}

function render() {
  const counts = Object.fromEntries(STAGES.map(([s]) => [s, 0]));
  rows.forEach((r) => (counts[r.stage] = (counts[r.stage] ?? 0) + 1));
  const todayCount = rows.filter(onToday).length;
  const base = rows.filter(passFilters);
  $("tabs").innerHTML =
    TABS.map(([k, l, f]) => `<button class="chip ${tab === k ? "on" : ""}" data-tab="${k}">${l} ${base.filter(f).length}</button>`).join("") +
    `<button class="chip ${tab === "callers" ? "on" : ""}" data-tab="callers">Callers${callers ? ` ${callers.filter((k) => k.active).length}` : ""}</button>`;

  const { fresh, follow } = batchCounts();
  $("send-batch").textContent = fresh + follow ? `Send today's batch (${fresh} new${follow ? ` + ${follow} follow-ups` : ""})` : "Nothing ready to send";
  $("send-batch").disabled = !(fresh + follow);
  $("auto").checked = Boolean(settings.auto_send) || autoSend;
  $("auto-note").textContent = autoSend
    ? "On: the site sends the batch for you at 9am."
    : settings.auto_send_on
      ? `Review week: turns on by itself ${settings.auto_send_on}.`
      : "";
  $("summary").textContent = `Today: ${todayCount} to reach · ${rows.filter(doneToday).length} done · ${rows.length} businesses · ${counts.messaged + counts.follow_up + counts.followed_up + counts.replied + counts.yes + counts.pass} contacted · ${counts.replied + counts.yes} replied · ${rows.filter(isBooked).length} booked · batch size ${settings.batch_size ?? 10} a day`;

  const isCallers = tab === "callers";
  $("callers").hidden = !isCallers;
  $("finder").hidden = isCallers;
  $("list").hidden = isCallers;
  if (isCallers) return renderCallers();
  renderFilters();

  const q = $("search").value.trim().toLowerCase();
  const test = (TABS.find(([k]) => k === tab) ?? TABS[0])[2];
  const shown = base
    .filter(test)
    .filter((r) => !q || [r.business, r.area, r.phone, r.email, r.category, r.contact_name].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (tab === "calllist" ? (a.call_rank ?? 999) - (b.call_rank ?? 999) : (b.fit_score ?? -1) - (a.fit_score ?? -1) || (b.reviews ?? 0) - (a.reviews ?? 0)));

  const one = (r) => (tab === "calllist" ? callCard(r, { picking: picking?.id === r.id ? picking.result : null, extra: `<div class="acts"><button class="b" data-act="open">Open contact</button></div>` }) : card(r));
  $("list").innerHTML = shown.length
    ? shown.slice(0, 300).map(one).join("") + (shown.length > 300 ? `<p class="muted">Showing the first 300 of ${shown.length}. Search or filter to narrow it down.</p>` : "")
    : `<p class="muted">Nobody here.</p>`;
  renderDrawer();
}

// ── Callers: invite, turn off, see their numbers ──
function renderCallers() {
  const list = callers ?? [];
  $("caller-list").innerHTML =
    callers === null
      ? `<p class="muted">Couldn't load callers. Refresh to try again.</p>`
      : list.length
        ? `<table class="ctable"><thead><tr><th>Caller</th><th>Today</th><th>This week</th><th>Booked (week / all)</th><th></th></tr></thead><tbody>${list
            .map(
              (k) => `<tr data-caller="${k.id}">
                <td><b>${esc(k.name)}</b>${k.active ? "" : ` <span class="pill">Off</span>`}<br><span class="muted" style="font-size:13px">${esc(k.email)}</span></td>
                <td>${k.today} calls</td><td>${k.week} calls</td><td>${k.bookingsWeek} / ${k.bookings}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="b" data-cact="invite" data-name="${esc(k.name)}" data-email="${esc(k.email)}">Send invite again</button>
                  <button class="b" data-cact="active" data-on="${k.active ? "0" : "1"}">${k.active ? "Turn off" : "Turn on"}</button>
                </td></tr>`,
            )
            .join("")}</tbody></table>`
        : `<p class="muted">No callers yet. Invite one above.</p>`;
}

// ── Contact drawer: everything about one business, with its full history ──
function renderDrawer() {
  const r = open && rows.find((x) => x.id === open);
  $("drawer").hidden = !r;
  $("drawer-bg").hidden = !r;
  document.body.classList.toggle("drawer-open", Boolean(r));
  if (!r) return;
  const follow = r.stage === "follow_up";
  const subj = follow ? r.followup_subject : r.email_subject;
  const draft = follow ? r.followup_draft : r.email_draft;
  const facts = [r.category, r.area, r.contact_name && `Contact: ${r.contact_name}`, r.reviews != null && `${r.rating ?? "–"}★ · ${r.reviews} reviews`, r.no_website ? "No website" : r.website && "Has website", r.source && `From: ${r.source}`, r.booked_at && `Booked ${new Date(r.booked_at).toLocaleString()}`, r.call_back_on && `Call back ${r.call_back_on}`].filter(Boolean);
  $("drawer-body").innerHTML = `
    <div data-id="${r.id}">
      <h2 style="margin:0 0 6px">${esc(r.business)} <span class="stage ${HOT.includes(r.stage) ? "hot" : ""}">${esc(isBooked(r) ? "Booked" : LABEL[r.stage] ?? r.stage)}</span></h2>
      <div class="meta">${facts.map((f) => `<span>${esc(f)}</span>`).join("")}</div>
      ${(r.tags ?? []).length ? `<div class="meta" style="margin-top:6px">${r.tags.map((t) => `<span class="pill" style="margin:0">${esc(t)}</span>`).join("")}</div>` : ""}
      ${research(r)}
      ${r.why_fit ? `<p class="note-line" style="margin:8px 0 0"><b>Why they fit:</b> ${esc(r.why_fit)}</p>` : ""}
      ${reach(r, follow, subj, draft)}
      ${editor(r, follow, subj, draft)}
      <h3 style="margin:22px 0 6px">History</h3>
      ${r.log ? `<p class="log" style="margin-top:0">${esc(r.log)}</p>` : `<p class="muted">Nothing yet.</p>`}
      <p class="note-line">Added ${esc(new Date(r.created_at).toLocaleDateString())}${r.last_called_at ? ` · last called ${esc(new Date(r.last_called_at).toLocaleString())}` : ""}${r.last_contact_at ? ` · last reached ${esc(new Date(r.last_contact_at).toLocaleString())}` : ""}</p>
    </div>`;
}

function card(r) {
  const follow = r.stage === "follow_up";
  const subj = follow ? r.followup_subject : r.email_subject;
  const draft = follow ? r.followup_draft : r.email_draft;
  const links = [
    r.phone && `<a href="tel:${esc(r.phone.replace(/[^\d+]/g, ""))}">${esc(r.phone)}</a>`,
    r.email && `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`,
    r.google_maps && `<a href="${esc(r.google_maps)}" target="_blank" rel="noopener">Google</a>`,
    r.website && `<a href="${esc(r.website)}" target="_blank" rel="noopener">Website</a>`,
    r.deck_url && `<a href="${esc(r.deck_url)}" target="_blank" rel="noopener">Audit deck</a>`,
    r.demo_url && `<a href="${esc(r.demo_url)}" target="_blank" rel="noopener">Demo</a>`,
  ].filter(Boolean);
  const facts = [r.category, r.area, r.reviews != null && `${r.rating ?? "–"}★ · ${r.reviews} reviews`, r.no_website && "No website", r.sent_on && `Sent ${r.sent_on}`, r.follow_up_on && `Follow up ${r.follow_up_on}`].filter(Boolean);
  return `
  <div class="panel" data-id="${r.id}">
    <div class="row">
      <div>
        <h3>${esc(r.business)} <span class="stage ${HOT.includes(r.stage) ? "hot" : ""}">${esc(LABEL[r.stage] ?? r.stage)}</span></h3>
        <div class="meta">${facts.map((f) => `<span>${esc(f)}</span>`).join("")}</div>
        <div class="meta" style="margin-top:4px">${links.join("")}</div>
        ${r.heads_up ? `<p class="note-line" style="margin:8px 0 0">${esc(r.heads_up)}</p>` : ""}
        ${research(r)}
        ${draft ? `<p class="note-line" style="margin:8px 0 0"><b>${esc(subj ?? "")}</b> — ${esc(draft.slice(0, 140))}…</p>` : ""}
        ${r.opener && OPEN.includes(r.stage) ? `<p class="note-line" style="margin:8px 0 0"><b>If you call, say:</b> ${esc(r.opener)}</p>` : ""}
      </div>
      <div class="acts" style="margin:0">
        <button class="b" data-act="open">Open</button>
      </div>
    </div>
    ${reach(r, follow, subj, draft)}
  </div>`;
}

// The caller's research: rank, fit, who they are, can they afford it, the pitch.
function research(r) {
  const x = r.research;
  if (!x && r.fit_score == null) return "";
  const head = [r.call_rank && `#${r.call_rank} to call`, r.fit_score != null && `Fit ${r.fit_score}/10`, x?.affordability && `Can afford: ${x.affordability}`, x?.lead_tier && `Lead with ${x.lead_tier}`, x?.website_status && `Website: ${x.website_status.replace(/-/g, " ")}`].filter(Boolean);
  const who = [x?.owner && x.owner !== "unknown" && `Owner: ${x.owner}`, x?.years_in_business && x.years_in_business !== "unknown" && `${x.years_in_business} in business`, x?.locations && x.locations !== "unknown" && `${x.locations} location(s)`, x?.team_size && x.team_size !== "unknown" && `Team: ${x.team_size}`].filter(Boolean);
  return `<div class="note-line" style="margin:8px 0 0;border-left:3px solid var(--brand);padding-left:10px">
    <b>${esc(head.join(" · "))}</b>
    ${x?.pitch ? `<br><b>Say:</b> ${esc(x.pitch)}` : ""}
    ${who.length ? `<br>${esc(who.join(" · "))}` : ""}
    ${x?.affordability_evidence ? `<br><span style="opacity:.8">Why they can pay: ${esc(x.affordability_evidence)}</span>` : ""}
    ${x?.website_notes ? `<br><span style="opacity:.8">Website: ${esc(x.website_notes)}</span>` : ""}
  </div>`;
}

// Every way to reach them, best first: email from the site, text, call, Instagram, their contact form.
function reach(r, follow, subj, draft) {
  const tel = digits(r.phone);
  const textBody = noStop(r.text_draft);
  const form = r.contact_url || r.website;
  const ways = [
    hasEmail(r) && draft && subj && OPEN.includes(r.stage) && `<button class="b go" data-act="quick-send">${follow ? "Send follow-up" : "Send email"}</button>`,
    hasEmail(r) && draft && `<a class="b" href="mailto:${esc(r.email)}?subject=${encodeURIComponent(subj ?? "")}&body=${encodeURIComponent(draft)}">Open in my email</a>`,
    tel && `<a class="b" href="sms:${esc(tel)}${textBody ? `&body=${encodeURIComponent(textBody)}` : ""}">Text</a>`,
    tel && `<a class="b" href="tel:${esc(tel)}">Call</a>`,
    r.instagram && `<a class="b" href="${esc(igUrl(r.instagram))}" target="_blank" rel="noopener">Instagram</a>`,
    r.dm_draft && `<button class="b" data-act="copy" data-text="dm_draft">Copy DM</button>`,
    form && `<a class="b" href="${esc(form)}" target="_blank" rel="noopener">${r.contact_url ? "Contact form" : "Their website"}</a>`,
    form && draft && `<button class="b" data-act="copy" data-text="${follow ? "followup_draft" : "email_draft"}">Copy message</button>`,
  ].filter(Boolean);
  const done = OPEN.includes(r.stage)
    ? `<div class="acts done"><span class="note-line">Done:</span>
        ${tel ? `<button class="b" data-act="mark" data-ch="text">Texted</button><button class="b" data-act="mark" data-ch="talked">Talked</button><button class="b" data-act="mark" data-ch="no_answer">No answer</button><button class="b" data-act="mark" data-ch="voicemail">Voicemail</button>` : ""}
        ${r.instagram ? `<button class="b" data-act="mark" data-ch="dm">DM sent</button>` : ""}
        ${form ? `<button class="b" data-act="mark" data-ch="form">Form sent</button>` : ""}
        ${hasEmail(r) ? `<button class="b" data-act="mark" data-ch="email">Emailed myself</button>` : ""}
      </div>`
    : "";
  return ways.length ? `<div class="acts">${ways.join("")}</div>${done}` : done;
}

function editor(r, follow, subj, draft) {
  return `
    <div class="grid2" style="margin-top:6px">
      <div><label>Stage</label><select data-f="stage">${STAGES.map(([s, l]) => `<option value="${s}" ${s === r.stage ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div><label>Email</label><input data-f="email" value="${esc(r.email ?? "")}" /></div>
      <div><label>Contact name</label><input data-f="contact_name" value="${esc(r.contact_name ?? "")}" /></div>
      <div><label>Follow up on</label><input data-f="follow_up_on" type="date" value="${esc(r.follow_up_on ?? "")}" /></div>
      <div><label>Phone</label><input data-f="phone" value="${esc(r.phone ?? "")}" /></div>
      <div><label>Instagram</label><input data-f="instagram" value="${esc(r.instagram ?? "")}" placeholder="@handle" /></div>
      <div><label>Contact form link</label><input data-f="contact_url" value="${esc(r.contact_url ?? "")}" /></div>
      <div><label>Website</label><input data-f="website" value="${esc(r.website ?? "")}" /></div>
    </div>
    <label>Text message</label>
    <textarea data-f="text_draft" style="min-height:70px">${esc(noStop(r.text_draft))}</textarea>
    <label>Instagram DM</label>
    <textarea data-f="dm_draft" style="min-height:70px">${esc(r.dm_draft ?? "")}</textarea>
    <label>${follow ? "Follow-up subject" : "Subject"}</label>
    <input data-f="${follow ? "followup_subject" : "email_subject"}" value="${esc(subj ?? "")}" />
    <label>${follow ? "Follow-up email" : "Email"} <span style="font-weight:400">(your sign-off and DesiWeb's address are added at the bottom)</span></label>
    <textarea data-f="${follow ? "followup_draft" : "email_draft"}">${esc(draft ?? "")}</textarea>
    <label>Notes</label>
    <textarea data-f="notes" style="min-height:70px">${esc(r.notes ?? "")}</textarea>
    <div class="acts">
      <button class="b" data-act="save">Save</button>
      ${hasEmail(r) ? `<button class="b go" data-act="send">${follow ? "Send follow-up" : ["lead", "warm"].includes(r.stage) ? "Send this email" : "Send again"}</button>` : ""}
      <button class="b" data-act="stage" data-stage="replied">They replied</button>
      <button class="b" data-act="stage" data-stage="yes">Yes</button>
      <button class="b" data-act="stage" data-stage="pass">Pass</button>
    </div>
    `;
}

function readEdits(el) {
  const patch = {};
  el.querySelectorAll("[data-f]").forEach((f) => (patch[f.dataset.f] = f.value || null));
  return patch;
}

async function load() {
  const data = await api("GET");
  rows = data.rows;
  settings = data.settings;
  autoSend = data.autoSend;
  callers = data.callers ?? null;
  render();
}

function replaceRow(row) {
  rows = rows.map((r) => (r.id === row.id ? row : r));
  render();
}

// ── Sign in ──
signIn(load);

// ── Clicks ──
$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  tab = b.dataset.tab;
  render();
});
$("search").addEventListener("input", render);
$("add-toggle").addEventListener("click", () => ($("add").hidden = !$("add").hidden));
$("add").addEventListener("submit", async (e) => {
  e.preventDefault();
  const row = Object.fromEntries(new FormData(e.target));
  try {
    const saved = await api("POST", { action: "add", row });
    rows.unshift(saved);
    e.target.reset();
    e.target.hidden = true;
    tab = saved.stage;
    render();
    toast(`Added ${saved.business}.`);
  } catch (err) {
    toast(err.message);
  }
});

$("send-batch").addEventListener("click", async () => {
  const { fresh, follow } = batchCounts();
  if (!confirm(`Send ${fresh} new email${fresh === 1 ? "" : "s"}${follow ? ` and ${follow} follow-up${follow === 1 ? "" : "s"}` : ""} now from gethelp@desiweb.org?`)) return;
  $("send-batch").disabled = true;
  $("send-batch").textContent = "Sending…";
  try {
    const r = await api("POST", { action: "send-batch" });
    toast(`Sent ${r.sent}.${r.failed ? ` ${r.failed} didn't go: ${r.results.filter((x) => !x.ok).map((x) => `${x.business} (${x.error})`).join("; ")}` : ""}`);
  } catch (err) {
    toast(err.message);
  }
  await load();
});

$("auto").addEventListener("change", async (e) => {
  try {
    settings = await api("POST", { action: "settings", patch: { auto_send: e.target.checked } });
    await load();
    toast(e.target.checked ? "Automatic sending is on." : "Automatic sending is off. You'll press Send each day.");
  } catch (err) {
    toast(err.message);
  }
});

async function onAct(e) {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const el = b.closest("[data-id]");
  if (!el) return;
  const id = el.dataset.id;
  const act = b.dataset.act;
  if (["result", "save-pick"].includes(act)) return; // call results: wireCallCards
  if (act === "open") {
    open = id;
    renderDrawer();
    return;
  }
  if (act === "copy") {
    const row = rows.find((r) => r.id === id);
    navigator.clipboard?.writeText(row[b.dataset.text] ?? "").then(() => toast("Copied. Paste it in."), () => toast("Couldn't copy."));
    return;
  }
  b.disabled = true;
  try {
    if (act === "save") {
      replaceRow(await api("POST", { action: "update", id, patch: readEdits(el) }));
      toast("Saved.");
    } else if (act === "mark") {
      const row = await api("POST", { action: "mark", id, channel: b.dataset.ch });
      replaceRow(row);
      toast(`${row.business}: ${b.textContent.toLowerCase()}. ${OPEN.includes(row.stage) ? "Still on your list." : "Moved to Sent."}`);
    } else if (act === "quick-send") {
      const row = rows.find((r) => r.id === id);
      const follow = row.stage === "follow_up";
      if (!confirm(`Send to ${row.email} now from gethelp@desiweb.org?\n\n${follow ? row.followup_subject : row.email_subject}`)) return;
      replaceRow(await api("POST", { action: "send", id }));
      toast(`Sent to ${row.email}.`);
    } else if (act === "stage") {
      replaceRow(await api("POST", { action: "update", id, patch: { stage: b.dataset.stage } }));
      toast(`Marked ${LABEL[b.dataset.stage]}.`);
    } else if (act === "send") {
      const p = readEdits(el);
      const row = rows.find((r) => r.id === id);
      const follow = row.stage === "follow_up";
      const subject = follow ? p.followup_subject : p.email_subject;
      const body = follow ? p.followup_draft : p.email_draft;
      if (!confirm(`Send this email to ${p.email || row.email} now?`)) return;
      if (p.email && p.email !== row.email) await api("POST", { action: "update", id, patch: { email: p.email } });
      replaceRow(await api("POST", { action: "send", id, subject, body, force: !["lead", "warm", "follow_up"].includes(row.stage) }));
      toast("Sent.");
    }
  } catch (err) {
    toast(err.message);
  } finally {
    b.disabled = false;
  }
}
$("list").addEventListener("click", onAct);
$("drawer-body").addEventListener("click", onAct);
$("drawer-close").addEventListener("click", () => ((open = null), renderDrawer()));
$("drawer-bg").addEventListener("click", () => ((open = null), renderDrawer()));
document.addEventListener("keydown", (e) => e.key === "Escape" && open && ((open = null), renderDrawer()));

// Filters
for (const [id, key] of [["f-trade", "trade"], ["f-town", "town"], ["f-site", "site"], ["f-fit", "fit"]]) {
  $(id).addEventListener("change", (e) => ((filters[key] = e.target.value), render()));
}
$("f-clear").addEventListener("click", () => {
  Object.keys(filters).forEach((k) => (filters[k] = ""));
  render();
});

// Call results on the Call list tab (same buttons the callers have; logged as Jordan).
wireCallCards($("list"), {
  logFn: (id, body) => api("POST", { action: "log-call", id, ...body }),
  done: (row, msg) => {
    if (row) replaceRow(row);
    toast(msg);
  },
  rerender: render,
  getPicking: () => picking,
  setPicking: (p) => (picking = p),
});

// Callers
$("invite").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { name, email } = Object.fromEntries(new FormData(e.target));
  if (!confirm(`Email ${name} an invite at ${email}? They'll get a link to set their password, then they only see the Call list.`)) return;
  try {
    await api("POST", { action: "invite-caller", name, email });
    e.target.reset();
    await load();
    toast(`Invite sent to ${email}.`);
  } catch (err) {
    toast(err.message);
  }
});
$("caller-list").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-cact]");
  if (!b) return;
  const id = b.closest("[data-caller]").dataset.caller;
  b.disabled = true;
  try {
    if (b.dataset.cact === "invite") {
      if (!confirm(`Email ${b.dataset.name} a new "set your password" link at ${b.dataset.email}?`)) return;
      await api("POST", { action: "invite-caller", name: b.dataset.name, email: b.dataset.email });
      toast(`New link sent to ${b.dataset.email}.`);
    } else {
      const on = b.dataset.on === "1";
      await api("POST", { action: "caller-active", id, active: on });
      toast(on ? "Turned back on. They can sign in again." : "Turned off. They can't sign in or see the list any more.");
    }
    await load();
  } catch (err) {
    toast(err.message);
  } finally {
    b.disabled = false;
  }
});
