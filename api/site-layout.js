// The order of cards on the public site.
//   GET                                    → { examples, industries } (public; the pages reorder their cards with it)
//   GET ?admin=1                           → { examples, industries, queue, demos } (owner)
//   POST { action: "save", examples?, industries? } (owner) → the saved layout
//   POST { action: "queue", slug, on }      (owner) → "Add to site" for a demo, or undo it
import { HttpError, handler } from "./_core.js";
import { requireOwner } from "./_auth.js";
import { getLayout, listDemos, networkReady, queueExample, saveLayout } from "./_network.js";

export default handler(async (req, res) => {
  if (!networkReady()) throw new HttpError(503, "The database isn't connected yet.");
  if (req.method === "GET" && !req.query?.admin) {
    res?.setHeader?.("Cache-Control", "public, s-maxage=20, stale-while-revalidate=300");
    const { examples, industries } = await getLayout();
    return { examples, industries };
  }
  await requireOwner(req);
  if (req.method === "GET") {
    const [layout, demos] = await Promise.all([getLayout(), listDemos()]);
    return { ...layout, demos };
  }
  if (req.method !== "POST") throw new HttpError(405, "Not allowed.");
  const b = req.body ?? {};
  if (b.action === "save") return saveLayout(b);
  if (b.action === "queue") return queueExample(b.slug, b.on !== false);
  throw new HttpError(400, "Unknown action.");
});
