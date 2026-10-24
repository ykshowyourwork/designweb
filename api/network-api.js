// For the daily outreach routine (Claude). Header x-network-key = NETWORK_API_KEY.
//   GET ?stage=lead,follow_up                  → { rows, settings, autoSend }
//   POST { action: "upsert", rows: [...] }     → { added, updated }   (new finds, drafts, follow-up drafts)
//   POST { action: "update", id, patch }       → the updated row
//   POST { action: "due-follow-ups" }          → { due }   (sent rows whose follow-up day came → stage follow_up)
//   POST { action: "send-batch" }              → { sent, failed, results } — only when automatic sending is on
import { timingSafeEqual } from "node:crypto";
import { HttpError, handler } from "./_core.js";
import { autoSendOn, getSettings, listRows, markDueFollowUps, networkReady, sendBatch, updateRow, upsertRows } from "./_network.js";

const today = () => new Date().toISOString().slice(0, 10);

function checkKey(req) {
  const want = process.env.NETWORK_API_KEY ?? "";
  const got = String(req.headers["x-network-key"] ?? "");
  if (want.length < 20 || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    throw new HttpError(401, "Wrong key.");
  }
}

export default handler(async (req) => {
  checkKey(req);
  if (!networkReady()) throw new HttpError(503, "The Network database isn't connected yet.");
  if (req.method === "GET") {
    const stages = String(req.query.stage ?? "").split(",").filter(Boolean);
    const [all, settings] = await Promise.all([listRows(), getSettings()]);
    const rows = stages.length ? all.filter((r) => stages.includes(r.stage)) : all;
    return { rows, settings, autoSend: autoSendOn(settings, today()) };
  }
  if (req.method !== "POST") throw new HttpError(405, "Not allowed.");
  const b = req.body ?? {};
  if (b.action === "upsert") return upsertRows(b.rows);
  if (b.action === "update") return updateRow(b.id, b.patch ?? {});
  if (b.action === "due-follow-ups") return markDueFollowUps();
  if (b.action === "send-batch") {
    const settings = await getSettings();
    if (!autoSendOn(settings, today())) throw new HttpError(409, "Automatic sending is off. Jordan reviews and sends from /admin/network.");
    return sendBatch();
  }
  throw new HttpError(400, "Unknown action.");
});
