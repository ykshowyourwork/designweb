// The owner's Network page (desiweb.org/admin/network). Same sign-in as invoices (_auth.js).
//   GET                                        → { rows, settings, autoSend }
//   POST { action: "add", row }                → the new row
//   POST { action: "update", id, patch }       → the updated row
//   POST { action: "send", id, subject?, body?, force? } → the row after sending
//   POST { action: "send-batch" }              → { sent, failed, results }
//   POST { action: "mark", id, channel }       → the row after a text, call, DM or contact form
//   POST { action: "run-today" }               → wakes the daily routine now
//   POST { action: "settings", patch }         → the settings
//   POST { action: "log-call", id, result, at?, on?, note? } → the row after a call (same as callers log)
//   POST { action: "invite-caller", name, email } → emails the caller a "set your password" link
//   POST { action: "caller-active", id, active } → turns a caller off or back on
//   GET also returns callers: [{ name, email, active, today, week, bookings }]
// Owner only: a caller's session is turned away by requireOwner, so none of this reaches them.
import { HttpError, handler } from "./_core.js";
import { inviteCaller, requireOwner } from "./_auth.js";
import { listCallers, logCall, setCallerActive } from "./_callers.js";
import { addRow, autoSendOn, getSettings, listRows, markContact, networkReady, runToday, sendBatch, sendOne, setSettings, updateRow } from "./_network.js";

const today = () => new Date().toISOString().slice(0, 10);

export default handler(async (req) => {
  const owner = await requireOwner(req);
  if (!networkReady()) throw new HttpError(503, "The Network database isn't connected yet (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).");
  if (req.method === "GET") {
    // Callers load on their own so a missing callers table never blanks the page.
    const [rows, settings, callers] = await Promise.all([listRows(), getSettings(), listCallers().catch(() => null)]);
    return { rows, settings, autoSend: autoSendOn(settings, today()), callers };
  }
  if (req.method !== "POST") throw new HttpError(405, "Not allowed.");
  const b = req.body ?? {};
  if (b.action === "add") return addRow(b.row ?? {});
  if (b.action === "update") return updateRow(b.id, b.patch ?? {});
  if (b.action === "send") return sendOne(b.id, { subject: b.subject, body: b.body, force: b.force === true });
  if (b.action === "send-batch") return sendBatch();
  if (b.action === "mark") return markContact(b.id, b.channel);
  if (b.action === "run-today") return runToday();
  if (b.action === "settings") return setSettings(b.patch ?? {});
  if (b.action === "log-call") return logCall(b.id, { result: b.result, at: b.at, on: b.on, note: b.note }, { role: "admin", email: typeof owner === "string" ? owner : "gethelp@desiweb.org", name: "Jordan" });
  if (b.action === "invite-caller") return inviteCaller({ name: b.name, email: b.email });
  if (b.action === "caller-active") return setCallerActive(b.id, b.active);
  throw new HttpError(400, "Unknown action.");
});
