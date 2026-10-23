// The free mockup and book-a-call forms: send to /api/lead, which adds a row in Notion.
import brand from "../brand.json";

const form = document.getElementById("lead");
const msg = document.getElementById("lead-msg");
const send = document.getElementById("lead-send");

// Industry pages link here with ?industry=<slug>; pick that trade.
const kind = form.dataset.kind || "mockup";
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
  body.kind = kind;
  body.page = kind === "call" ? "/book-a-call" : fromPage ? `/industries/${fromPage}` : document.referrer ? new URL(document.referrer).pathname : "/free-mockup";
  try {
    const res = await fetch("/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "That didn't send.");
    location.href = kind === "call" ? "/thank-you?type=call" : "/thank-you";
  } catch (err) {
    msg.className = "msg err";
    msg.textContent = `${err.message} You can also email ${brand.email}.`;
    send.disabled = false;
  }
});
