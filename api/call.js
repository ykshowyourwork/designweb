// The Call list, for callers (and Jordan). The only endpoint a caller session can use.
//   GET                                                   → { me, rows }   (safe fields only)
//   POST { action: "log", id, result, at?, on?, note? }   → the row after the call
//   POST { action: "add", lead: { business, phone, area, category, notes } } → the new row
// Anything else is refused here, and every other owner API (network, admin, site) refuses callers.
import { HttpError, handler } from "./_core.js";
import { requireUser } from "./_auth.js";
import { addLead, callList, forCaller, logCall } from "./_callers.js";
import { networkReady } from "./_network.js";

export default handler(async (req) => {
  const who = await requireUser(req);
  if (!networkReady()) throw new HttpError(503, "The call list isn't connected yet.");
  if (req.method === "GET") return { me: { name: who.name, role: who.role }, rows: await callList() };
  if (req.method !== "POST") throw new HttpError(405, "Not allowed.");
  const b = req.body ?? {};
  if (b.action === "log") return forCaller(await logCall(b.id, { result: b.result, at: b.at, on: b.on, note: b.note }, who));
  if (b.action === "add") return forCaller(await addLead(b.lead ?? {}, who));
  throw new HttpError(400, "Unknown action.");
});
