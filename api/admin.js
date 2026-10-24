// Owner only (signed in, see _auth.js).
//   GET                                   → every project
//   POST { action: "create", …project }   → new project; emails the deposit invoice
//   POST { action: "balance", token }     → launch day: email the balance invoice
import { HttpError, createProject, handler, listProjects, sendBalance } from "./_core.js";
import { requireOwner } from "./_auth.js";
import { stripe } from "./_stripe.js";

export default handler(async (req) => {
  await requireOwner(req);
  if (req.method === "GET") return { projects: await listProjects(stripe()) };
  if (req.method !== "POST") throw new HttpError(405, "Not allowed.");
  const body = req.body ?? {};
  if (body.action === "create") return createProject(stripe(), body);
  if (body.action === "balance") return sendBalance(stripe(), body.token);
  throw new HttpError(400, "Unknown action.");
});
