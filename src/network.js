// The owner's Network page: every business DesiWeb reaches out to.
// Same sign-in as invoices. Talks to /api/network.
import { esc } from "./money.js";
import { api as call, signIn } from "./session.js";

const $ = (id) => document.getElementById(id);
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
let tab = "today";
let open = null;

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

function render() {
  const counts = Object.fromEntries(STAGES.map(([s]) => [s, 0]));
  rows.forEach((r) => (counts[r.stage] = (counts[r.stage] ?? 0) + 1));
  const todayCount = rows.filter(onToday).length;
  $("tabs").innerHTML =
    `<button class="chip ${tab === "today" ? "on" : ""}" data-tab="today">Today ${todayCount}</button>` +
    STAGES.map(([s, l]) => `<button class="chip ${tab === s ? "on" : ""}" data-tab="${s}">${l} ${counts[s]}</button>`).join("") +
    `<button class="chip ${tab === "all" ? "on" : ""}" data-tab="all">Everyone ${rows.length}</button>`;

  const { fresh, follow } = batchCounts();
  $("send-batch").textContent = fresh + follow ? `Send today's batch (${fresh} new${follow ? ` + ${follow} follow-ups` : ""})` : "Nothing ready to send";
  $("send-batch").disabled = !(fresh + follow);
  $("auto").checked = Boolean(settings.auto_send) || autoSend;
  $("auto-note").textContent = autoSend
    ? "On: the morning routine sends the batch for you."
    : settings.auto_send_on
      ? `Review week: turns on by itself ${settings.auto_send_on}.`
      : "";
  $("summary").textContent = `Today: ${todayCount} to reach · ${rows.filter(doneToday).length} done · ${rows.length} businesses · ${counts.messaged + counts.follow_up + counts.followed_up + counts.replied + counts.yes + counts.pass} contacted · ${counts.replied + counts.yes} replied · batch size ${settings.batch_size ?? 10} a day`;

  const q = $("search").value.trim().toLowerCase();
  const shown = rows
    .filter((r) => tab === "all" || (tab === "today" ? onToday(r) : r.stage === tab))
    .filter((r) => !q || [r.business, r.area, r.phone, r.email, r.category, r.contact_name].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (b.reviews ?? 0) - (a.reviews ?? 0));

  $("list").innerHTML = shown.length
    ? shown.slice(0, 300).map(card).join("") + (shown.length > 300 ? `<p class="muted">Showing the first 300 of ${shown.length}. Search to narrow it down.</p>` : "")
    : `<p class="muted">Nobody here.</p>`;
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
  const isOpen = open === r.id;
  return `
  <div class="panel" data-id="${r.id}">
    <div class="row">
      <div>
        <h3>${esc(r.business)} <span class="stage ${HOT.includes(r.stage) ? "hot" : ""}">${esc(LABEL[r.stage] ?? r.stage)}</span></h3>
        <div class="meta">${facts.map((f) => `<span>${esc(f)}</span>`).join("")}</div>
        <div class="meta" style="margin-top:4px">${links.join("")}</div>
        ${r.heads_up ? `<p class="note-line" style="margin:8px 0 0">${esc(r.heads_up)}</p>` : ""}
        ${!isOpen && draft ? `<p class="note-line" style="margin:8px 0 0"><b>${esc(subj ?? "")}</b> — ${esc(draft.slice(0, 140))}…</p>` : ""}
        ${r.opener && OPEN.includes(r.stage) ? `<p class="note-line" style="margin:8px 0 0"><b>If you call, say:</b> ${esc(r.opener)}</p>` : ""}
      </div>
      <div class="acts" style="margin:0">
        <button class="b" data-act="open">${isOpen ? "Close" : "Open"}</button>
      </div>
    </div>
    ${reach(r, follow, subj, draft)}
    ${isOpen ? editor(r, follow, subj, draft) : ""}
  </div>`;
}

// Every way to reach them, best first: email from the site, text, call, Instagram, their contact form.
function reach(r, follow, subj, draft) {
  const tel = digits(r.phone);
  const textBody = r.text_draft || "";
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
    <textarea data-f="text_draft" style="min-height:70px">${esc(r.text_draft ?? "")}</textarea>
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
    ${r.why_fit ? `<p class="log"><b>Why they fit:</b> ${esc(r.why_fit)}</p>` : ""}
    ${r.log ? `<p class="log">${esc(r.log)}</p>` : ""}`;
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

$("list").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const el = b.closest("[data-id]");
  const id = el.dataset.id;
  const act = b.dataset.act;
  if (act === "open") {
    open = open === id ? null : id;
    render();
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
});
