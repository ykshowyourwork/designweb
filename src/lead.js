// The free mockup form: sends to /api/lead, which adds a row in Notion.
import brand from "../brand.json";

const form = document.getElementById("lead");
const msg = document.getElementById("lead-msg");
const send = document.getElementById("lead-send");

// Industry pages link here with ?industry=<slug>; pick that trade.
const fromPage = new URLSearchParams(location.search).get("industry");
if (fromPage) {
  const match = [...form.industry.options].find((o) => o.value.toLowerCase().replace(/ and /g, "-and-").replace(/\s+/g, "-") === fromPage);
  if (match) form.industry.value = match.value;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  send.disabled = true;
  msg.className = "msg";
  msg.textContent = "Sending…";
  const body = Object.fromEntries(new FormData(form));
  body.page = fromPage ? `/industries/${fromPage}` : document.referrer ? new URL(document.referrer).pathname : "/free-mockup";
  try {
    const res = await fetch("/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "That didn't send.");
    form.innerHTML = `<div class="card ok-box"><h2>Got it.</h2><p>We'll text or call you within one business day to set up your mockup call.</p></div>`;
  } catch (err) {
    msg.className = "msg err";
    msg.textContent = `${err.message} You can also email ${brand.email}.`;
    send.disabled = false;
  }
});
