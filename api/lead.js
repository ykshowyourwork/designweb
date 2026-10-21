// POST /api/lead → a free mockup request, saved to Notion.
import { HttpError, handler } from "./_core.js";
import { saveLead } from "./_lead.js";

export default handler(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Not allowed.");
  return saveLead(req.body ?? {});
});
