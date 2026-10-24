// The owner's Network page (desiweb.org/admin/network). Same password as invoices (x-admin-key).
//   GET                                        → { rows, settings, autoSend }
//   POST { action: "add", row }                → the new row
//   POST { action: "update", id, patch }       → the updated row
//   POST { action: "send", id, subject?, body?, force? } → the row after sending
//   POST { action: "send-batch" }              → { sent, failed, results }
//   POST { action: "settings", patch }         → the settings
import { HttpError, checkAdmin, handler } from "./_core.js";
import { addRow, autoSendOn, getSettings, listRows, networkReady, sendBatch, sendOne, setSettings, updateRow } from "./_network.js";

const today = () => new Date().toISOString().slice(0, 10);

export default handler(async (req) => {
  checkAdmin(req);
  if (!networkReady()) throw new HttpError(503, "The Network database isn't connected yet (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).");
  if (req.method === "GET") {
    const [rows, settings] = await Promise.all([listRows(), getSettings()]);
    return { rows, settings, autoSend: autoSendOn(settings, today()) };
  }
  if (req.method !== "POST") throw new HttpError(405, "Not allowed.");
  const b = req.body ?? {};
  if (b.action === "add") return addRow(b.row ?? {});
  if (b.action === "update") return updateRow(b.id, b.patch ?? {});
  if (b.action === "send") return sendOne(b.id, { subject: b.subject, body: b.body, force: b.force === true });
  if (b.action === "send-batch") return sendBatch();
  if (b.action === "settings") return setSettings(b.patch ?? {});
  throw new HttpError(400, "Unknown action.");
});
