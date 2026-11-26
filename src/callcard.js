// One business on the Call list, as a card: tap to call, why they fit, what to compliment, the pitch,
// one-tap results and the row's history. Used by the caller page (/admin/calls) and Jordan's Call list tab.
import { esc } from "./money.js";

export const RESULTS = [
  ["talked", "Talked"],
  ["no_answer", "No answer"],
  ["voicemail", "Voicemail"],
  ["booked", "Booked with Jordan"],
  ["not_interested", "Not interested"],
  ["call_back", "Call back"],
];
export const RESULT_LABEL = Object.fromEntries(RESULTS);

const digits = (p) => String(p ?? "").replace(/[^\d+]/g, "");
const known = (v) => v && !/^(unknown|none found|n\/a)$/i.test(String(v).trim());
export const todayKey = () => new Date().toLocaleDateString("en-CA");
const fmtWhen = (t) => new Date(t).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function websiteStatus(r) {
  const s = r.research?.website_status;
  if (s) return s === "none" ? "No website" : `Website: ${String(s).replace(/-/g, " ")}`;
  if (r.no_website) return "No website";
  return r.website ? "Has a website" : "";
}

/** What to say nice first. The research's own line when there is one, else their reviews and years. */
export function compliment(r) {
  const x = r.research ?? {};
  if (known(x.compliment)) return x.compliment;
  const bits = [];
  if (r.reviews) bits.push(`${r.reviews} Google reviews${r.rating ? ` at ${r.rating} stars` : ""}`);
  if (known(x.years_in_business)) bits.push(`${x.years_in_business} in business`);
  return bits.length ? `${bits.join(", ")}. That's a reputation people trust.` : "";
}

/** Where a row stands on the call list. */
export function callStatus(r) {
  if (r.booked_at || r.stage === "yes") return { key: "booked", label: r.booked_at ? `Booked ${fmtWhen(r.booked_at)}` : "Booked", hot: true };
  if (r.call_back_on) return { key: "callback", label: `Call back ${r.call_back_on}`, hot: r.call_back_on <= todayKey() };
  if (r.last_called_at && new Date(r.last_called_at).toLocaleDateString("en-CA") === todayKey()) return { key: "today", label: "Called today" };
  if (r.last_called_at) return { key: "called", label: "Called before" };
  return { key: "new", label: "Not called yet" };
}

export function callCard(r, { picking, extra = "" } = {}) {
  const x = r.research ?? {};
  const tel = digits(r.phone);
  const owner = r.contact_name || (known(x.owner) ? x.owner : "");
  const st = callStatus(r);
  const facts = [r.area, r.category, r.reviews != null && `${r.rating ?? "–"}★ · ${r.reviews} reviews`, websiteStatus(r), r.fit_score != null && `Fit ${r.fit_score}/10`].filter(Boolean);
  const nice = compliment(r);
  const pitch = x.pitch || r.opener;
  const pick =
    picking === "booked"
      ? `<div class="pick"><div><label>Call with Jordan on</label><input type="datetime-local" data-in="at" /></div><button class="b go" data-act="save-pick" data-result="booked">Save</button></div>`
      : picking === "call_back"
        ? `<div class="pick"><div><label>Call back on</label><input type="date" data-in="on" min="${todayKey()}" /></div><button class="b go" data-act="save-pick" data-result="call_back">Save</button></div>`
        : "";
  return `
  <div class="card cc" data-id="${r.id}">
    <h3>${r.call_rank ? `<span class="rank">#${r.call_rank}</span>` : ""}${esc(r.business)} <span class="pill ${st.hot ? "hot" : ""}">${esc(st.label)}</span></h3>
    ${owner ? `<div class="meta"><span>Ask for: <b style="color:var(--fg)">${esc(owner)}</b></span></div>` : ""}
    <div class="meta">${facts.map((f) => `<span>${esc(f)}</span>`).join("")}${r.google_maps ? `<a href="${esc(r.google_maps)}" target="_blank" rel="noopener">Google</a>` : ""}${r.website ? `<a href="${esc(r.website)}" target="_blank" rel="noopener">Their site</a>` : ""}</div>
    ${tel ? `<a class="b go callbtn" href="tel:${esc(tel)}">Call ${esc(r.phone)}</a>` : `<p class="say">No phone number yet.</p>`}
    ${r.why_fit ? `<p class="say"><b>Why they fit:</b> ${esc(r.why_fit)}</p>` : ""}
    ${nice ? `<p class="say"><b>Compliment:</b> ${esc(nice)}</p>` : ""}
    ${pitch ? `<p class="say"><b>Say:</b> ${esc(pitch)}</p>` : ""}
    ${known(x.website_notes) ? `<p class="say" style="color:var(--muted)">${esc(x.website_notes)}</p>` : ""}
    ${r.heads_up ? `<p class="say" style="color:var(--muted)">Heads up: ${esc(r.heads_up)}</p>` : ""}
    ${r.notes ? `<p class="say" style="color:var(--muted)">Notes: ${esc(r.notes)}</p>` : ""}
    <div class="results">${RESULTS.map(([k, l]) => `<button class="b ${picking === k ? "go" : ""}" data-act="result" data-result="${k}">${l}</button>`).join("")}</div>
    ${pick}
    <input data-in="note" placeholder="Add a note (optional)" style="margin-top:10px" />
    ${extra}
    ${r.log ? `<details class="hist"><summary>History</summary><pre>${esc(r.log)}</pre></details>` : ""}
  </div>`;
}

/** Wires result taps inside `listEl`. logFn(id, body) saves and returns the new row; done(row, label) updates the page. */
export function wireCallCards(listEl, { logFn, done, rerender, getPicking, setPicking }) {
  listEl.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || !listEl.contains(b)) return;
    const el = b.closest("[data-id]");
    if (!el || !["result", "save-pick"].includes(b.dataset.act)) return;
    const id = el.dataset.id;
    const result = b.dataset.result;
    // Booked and Call back need a date first.
    if (b.dataset.act === "result" && ["booked", "call_back"].includes(result)) {
      setPicking(getPicking()?.id === id && getPicking().result === result ? null : { id, result });
      rerender();
      return;
    }
    const body = { result, note: el.querySelector('[data-in="note"]')?.value || undefined };
    if (result === "booked") {
      const v = el.querySelector('[data-in="at"]')?.value;
      if (!v) return done(null, "Pick the day and time first.");
      body.at = new Date(v).toISOString();
    }
    if (result === "call_back") {
      body.on = el.querySelector('[data-in="on"]')?.value;
      if (!body.on) return done(null, "Pick the day first.");
    }
    b.disabled = true;
    try {
      const row = await logFn(id, body);
      setPicking(null);
      done(row, `${row.business}: ${RESULT_LABEL[result]}. Logged.`);
    } catch (err) {
      done(null, err.message);
    } finally {
      b.disabled = false;
    }
  });
}
